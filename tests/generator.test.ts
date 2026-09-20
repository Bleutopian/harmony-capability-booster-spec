import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest } from '@hcb/manifest';
import type { FeatureManifest } from '@hcb/manifest';
import { loadRegistry } from '@hcb/registry';
import { createPlan } from '@hcb/planner';
import type { EnhancementPlan } from '@hcb/planner';
import { generateArtifacts, previewArtifacts } from '../packages/hcb-generator/src/index.js';

let manifest: FeatureManifest;
let plan: EnhancementPlan;
const directories: string[] = [];
async function temporary(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'hcb-generator-'));
  directories.push(directory);
  return directory;
}

beforeAll(async () => {
  const result = await loadManifest(fileURLToPath(new URL('../examples/native-desktop.feature.yaml', import.meta.url)));
  if (!result.valid) throw new Error('Invalid test manifest.');
  manifest = result.value;
  plan = createPlan(manifest, { devices: ['pc'], apiVersion: 24, stageModel: true }, await loadRegistry());
});
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('review artifact generation', () => {
  it('produces deterministic review documents with ownership, without platform code', () => {
    const first = generateArtifacts(manifest, plan);
    expect(first).toEqual(generateArtifacts(structuredClone(manifest), structuredClone(plan)));
    expect(first.map(artifact => ({ path: artifact.path, document: JSON.parse(artifact.content) as unknown }))).toMatchSnapshot();
    expect(first.every(artifact => artifact.path.startsWith('.hcb/generated/') && artifact.path.endsWith('.json'))).toBe(true);
  });

  it('keeps dry-run read-only and repeats the same diff', async () => {
    const root = await temporary();
    const artifacts = generateArtifacts(manifest, plan);
    const first = await previewArtifacts(artifacts, root);
    expect(first).toEqual(await previewArtifacts(artifacts, root));
    expect(first.platformArtifactsGenerated).toBe(false);
    expect(first.changes.every(change => change.operation === 'create' && change.diff.includes('--- /dev/null'))).toBe(true);
    expect(await readdir(root)).toEqual([]);
  });

  it('recognizes unchanged generated artifacts and legitimate updates', async () => {
    const root = await temporary();
    const artifacts = generateArtifacts(manifest, plan);
    await mkdir(join(root, '.hcb/generated'), { recursive: true });
    for (const artifact of artifacts) await writeFile(join(root, artifact.path), artifact.content);
    expect((await previewArtifacts(artifacts, root)).changes.every(change => change.operation === 'unchanged' && change.diff === '')).toBe(true);
    const changed = structuredClone(plan);
    changed.items[0]!.requiredChecks.push('new.review');
    expect((await previewArtifacts(generateArtifacts(manifest, changed), root)).changes.every(change => change.operation === 'update')).toBe(true);
    expect(await readFile(join(root, artifacts[0]!.path), 'utf8')).toBe(artifacts[0]!.content);
  });

  it('hashes the serialized payload when optional fields are explicitly undefined', async () => {
    const root = await temporary();
    const withUndefined = structuredClone(plan);
    withUndefined.target.liveViewEligible = undefined;
    const artifacts = generateArtifacts(manifest, withUndefined);
    await mkdir(join(root, '.hcb/generated'), { recursive: true });
    for (const artifact of artifacts) await writeFile(join(root, artifact.path), artifact.content);
    expect((await previewArtifacts(artifacts, root)).changes.every(change => change.operation === 'unchanged')).toBe(true);
  });

  it.each(['manual content', '{}', 'null', '[]', '{"_hcb":null}', '{"_hcb":{"owner":"HCB_GENERATED","version":"0.1","sha256":"changed"}}'])(
  'refuses unowned or modified artifacts: %s', async existing => {
    const root = await temporary();
    const artifacts = generateArtifacts(manifest, plan);
    await mkdir(join(root, '.hcb/generated'), { recursive: true });
    await writeFile(join(root, artifacts[0]!.path), existing);
    const preview = await previewArtifacts(artifacts, root);
    expect(preview.changes[0]?.operation).toBe('conflict');
    expect(preview.changes[0]?.diff).toBe('');
    expect(preview.diagnostics[0]?.code).toBe('HCB-GN-005');
    expect(await readFile(join(root, artifacts[0]!.path), 'utf8')).toBe(existing);
  });

  it('detects user edits to an otherwise owned document', async () => {
    const root = await temporary();
    const artifacts = generateArtifacts(manifest, plan);
    await mkdir(join(root, '.hcb/generated'), { recursive: true });
    await writeFile(join(root, artifacts[0]!.path), artifacts[0]!.content.replace('queryOrder', 'userEdited'));
    expect((await previewArtifacts(artifacts, root)).changes[0]?.operation).toBe('conflict');
  });

  it('never reads or previews UI paths, traversal paths or duplicate destinations', async () => {
    const root = await temporary();
    const artifact = generateArtifacts(manifest, plan)[0]!;
    const preview = await previewArtifacts([
      { path: '../outside.txt', content: 'unsafe' },
      { path: 'entry/src/main/ets/pages/Index.ets', content: 'unsafe' },
      artifact, artifact
    ], root);
    expect(preview.diagnostics).toHaveLength(3);
    expect(preview.changes).toHaveLength(1);
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects redirected .hcb directories', async () => {
    const root = await temporary();
    const outside = await temporary();
    await symlink(outside, join(root, '.hcb'), process.platform === 'win32' ? 'junction' : 'dir');
    const preview = await previewArtifacts(generateArtifacts(manifest, plan), root);
    expect(preview.changes).toEqual([]);
    expect(preview.diagnostics.every(item => item.code === 'HCB-GN-006')).toBe(true);
  });

  it('reports directory/file collisions', async () => {
    const root = await temporary();
    await writeFile(join(root, '.hcb'), 'not a directory');
    expect((await previewArtifacts(generateArtifacts(manifest, plan), root)).diagnostics).toHaveLength(2);
    const other = await temporary();
    await mkdir(join(other, '.hcb/generated/enhancement-plan.json'), { recursive: true });
    expect((await previewArtifacts(generateArtifacts(manifest, plan), other)).diagnostics[0]?.code).toBe('HCB-GN-006');
  });

  it('rejects mismatched or platform-generating plans', () => {
    expect(() => generateArtifacts(manifest, { ...plan, applicationId: 'other' })).toThrow('HCB-GN-001');
    expect(() => generateArtifacts(manifest, { ...plan, items: [] })).toThrow('HCB-GN-002');
    expect(() => generateArtifacts(manifest, { ...plan, items: [...plan.items, plan.items[0]!] })).toThrow('HCB-GN-002');
    const changed = structuredClone(plan);
    changed.items[0]!.generatedArtifacts.push('Intent.ets');
    expect(() => generateArtifacts(manifest, changed)).toThrow('HCB-GN-003');
  });

  it('emits nothing for an empty manifest and no binding for rejected items', () => {
    expect(generateArtifacts({ ...manifest, features: [] }, { ...plan, items: [] })).toEqual([]);
    const rejected = { ...plan, items: plan.items.map(item => ({ ...item, decision: 'reject' as const })) };
    const binding = JSON.parse(generateArtifacts(manifest, rejected)[1]!.content) as { bindings: unknown[] };
    expect(binding.bindings).toEqual([]);
  });

  it('describes STATE binding without implementing it', async () => {
    const result = await loadManifest(fileURLToPath(new URL('../examples/appointment.feature.yaml', import.meta.url)));
    if (!result.valid) throw new Error('Invalid test manifest.');
    const statePlan = createPlan(result.value, { devices: ['phone', 'tablet'], apiVersion: 24, stageModel: true }, await loadRegistry());
    const binding = JSON.parse(generateArtifacts(result.value, statePlan)[1]!.content) as { bindings: { requiredBinding: string }[] };
    expect(binding.bindings.some(item => item.requiredBinding === 'getCurrent')).toBe(true);
  });
});
