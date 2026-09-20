import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FeatureManifest } from '@hcb/manifest';
import { capabilityIds, loadRegistry, type CapabilityRegistry, type TargetProfile } from '@hcb/registry';
import { validateProject } from '@hcb/validator';

const target: TargetProfile = { devices: ['pc'], apiVersion: 16, stageModel: true };

function manifest(): FeatureManifest {
  return {
    schemaVersion: '0.1',
    application: { id: 'validator.example', sourcePlatforms: ['linux'], sourceArchitectures: ['c86'] },
    features: [{
      id: 'queryOrder',
      title: 'Query an existing order',
      kind: 'ACTION',
      contract: { inputs: [], output: { type: 'object' } },
      hints: { existingImplementation: true, callable: true, userInvokable: true },
    }],
  };
}

async function stableRegistry(): Promise<CapabilityRegistry> {
  const registry = await loadRegistry();
  // Synthetic verification evidence exercises validator logic, not real API support.
  for (const id of capabilityIds) {
    Object.assign(registry.capabilities[id], {
      status: 'stable', provenance: 'official', verifiedAt: '2026-09-21', apiMin: 12, requiredChecks: [],
    });
  }
  registry.capabilities.intents.targets.pc.supported = true;
  Object.assign(registry.native, { status: 'stable', provenance: 'official', verifiedAt: '2026-09-21' });
  return registry;
}

describe('project validator', () => {
  let host: string;
  let registry: CapabilityRegistry;

  beforeEach(async () => {
    host = await mkdtemp(join(tmpdir(), 'hcb-validator-'));
    registry = await stableRegistry();
    await mkdir(join(host, 'entry/src/main'), { recursive: true });
    await writeFile(join(host, 'build-profile.json5'), '{ app: { products: [{ name: "default", compatibleSdkVersion: 12, targetSdkVersion: 16, }], }, }');
    await writeFile(join(host, 'entry/src/main/module.json5'), '{ module: { srcEntry: "./ets/Application/AbilityStage.ets", deviceTypes: ["2in1"], } }');
    await writeFile(join(host, 'entry/oh-package.json5'), '{ name: "entry", dependencies: {}, }');
  });

  afterEach(async () => {
    const location = relative(resolve(tmpdir()), resolve(host));
    if (location.startsWith('hcb-validator-') && !location.includes('..')) await rm(host, { recursive: true, force: true });
  });

  it('validates JSON5 Stage metadata and maps 2in1 to pc without claiming compilation', async () => {
    const files = ['build-profile.json5', 'entry/src/main/module.json5', 'entry/oh-package.json5'];
    const before = await Promise.all(files.map((file) => readFile(join(host, file), 'utf8')));
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.status).toBe('pass');
    expect(report.errors).toEqual([]);
    expect(report.plan.items[0]?.decision).toBe('recommend');
    expect(report.plan.items[0]?.generatedArtifacts).toEqual([]);
    expect(report.checks).toEqual({
      compile_check: 'skipped',
      compile_reason: 'No platform artifacts generated in this milestone; HarmonyOS compilation and Runtime HAR integration were not checked.',
    });
    expect(await Promise.all(files.map((file) => readFile(join(host, file), 'utf8')))).toEqual(before);
  });

  it('reports no host and experimental plans as unverified', async () => {
    const report = await validateProject(manifest(), target, await loadRegistry());
    expect(report.status).toBe('pass_with_warnings');
    expect(report.warnings.map((item) => item.code)).toEqual(expect.arrayContaining(['HCB_HOST_NOT_CHECKED', 'HCB_PLAN_CONDITIONAL']));
    expect(report.warnings.find((item) => item.code === 'HCB_PLAN_CONDITIONAL')?.message).toContain('officialApiVerification');
  });

  it('recognizes the actual repository Stage host whose entry is on an ability', async () => {
    const repository = fileURLToPath(new URL('../', import.meta.url));
    const report = await validateProject(manifest(), target, registry, repository);
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((item) => item.code)).toContain('HCB_HOST_API_UNVERIFIED');
    expect(report.checks.compile_check).toBe('skipped');
  });

  it.each(['abilities', 'extensionAbilities'])('accepts Stage srcEntry declared by %s', async (section) => {
    await writeFile(join(host, 'entry/src/main/module.json5'), JSON.stringify({ module: {
      deviceTypes: ['2in1'], [section]: [{ srcEntry: './ets/EntryAbility.ets' }],
    } }));
    await writeFile(join(host, 'entry/build-profile.json5'), '{apiType:"stageMode"}');
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.status).toBe('pass');
  });

  it('rejects explicit FA apiType even if srcEntry metadata exists', async () => {
    await writeFile(join(host, 'entry/build-profile.json5'), '{apiType:"faMode"}');
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_HOST_STAGE_REQUIRED');
  });

  it('rejects invalid manifest, target and registry without invoking the planner', async () => {
    const badManifest = { ...manifest(), pages: [] } as FeatureManifest;
    const badTarget = { ...target, apiVersion: 0 };
    const badRegistry = { ...registry, schemaVersion: 'invalid' } as unknown as CapabilityRegistry;
    const report = await validateProject(badManifest, badTarget, badRegistry, host);
    expect(report.status).toBe('fail');
    expect(report.errors.map((item) => item.code)).toEqual(expect.arrayContaining(['HCB_MANIFEST_SCHEMA', 'HCB_TARGET_INVALID', 'HCB_REGISTRY_INVALID']));
    expect(report.plan.items).toEqual([]);
  });

  it('warns about empty manifests and rejects a non-Stage target even without features', async () => {
    const empty = { ...manifest(), features: [] };
    const report = await validateProject(empty, { ...target, stageModel: false }, registry);
    expect(report.status).toBe('fail');
    expect(report.errors.map((item) => item.code)).toContain('HCB_TARGET_STAGE_REQUIRED');
    expect(report.warnings.map((item) => item.code)).toContain('HCB_MANIFEST_EMPTY');
  });

  it('reports missing metadata without exposing filesystem errors or file contents', async () => {
    const report = await validateProject(manifest(), target, registry, join(host, 'missing'));
    expect(report.status).toBe('fail');
    expect(report.errors).toHaveLength(3);
    expect(report.errors.every((item) => item.code === 'HCB_HOST_METADATA_READ')).toBe(true);
    expect(JSON.stringify(report)).not.toContain(host);
  });

  it.each(['{ signing: "fixture-secret", @ }', '[]', 'null'])('rejects invalid JSON5 metadata without echoing parser source: %s', async (source) => {
    await writeFile(join(host, 'build-profile.json5'), source);
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_HOST_METADATA_INVALID');
    expect(JSON.stringify(report)).not.toContain('fixture-secret');
  });

  it.each([
    { module: { deviceTypes: ['2in1'], abilities: [{ name: 'LegacyAbility' }] } },
    { module: { srcEntry: '  ', deviceTypes: ['2in1'] } },
    { app: { apiVersion: { compatible: 8 } } },
  ])('rejects FA or missing Stage srcEntry: %j', async (metadata) => {
    await writeFile(join(host, 'entry/src/main/module.json5'), JSON.stringify(metadata));
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_HOST_STAGE_REQUIRED');
  });

  it.each([{ deviceTypes: [] }, { deviceTypes: 'phone' }, { deviceTypes: [42] }])('rejects malformed module devices: %j', async ({ deviceTypes }) => {
    await writeFile(join(host, 'entry/src/main/module.json5'), JSON.stringify({ module: { srcEntry: 'stage.ets', deviceTypes } }));
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_HOST_DEVICES_INVALID');
  });

  it('rejects devices the host module does not support', async () => {
    const report = await validateProject(manifest(), { ...target, devices: ['tablet'] }, registry, host);
    expect(report.status).toBe('fail');
    expect(report.errors.map((item) => item.code)).toContain('HCB_HOST_DEVICE_UNSUPPORTED');
  });

  it.each([
    { compatibleSdkVersion: '26.0.0', targetSdkVersion: '26.0.0' },
    { compatibleSdkVersion: 12, compileSdkVersion: '5.0.0(12)' },
    { compatibleSdkVersion: 12, targetSdkVersion: 17 },
  ])('does not infer API compatibility from ambiguous SDK metadata: %j', async (product) => {
    await writeFile(join(host, 'build-profile.json5'), JSON.stringify({ app: { products: [product] } }));
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.status).toBe('pass_with_warnings');
    expect(report.warnings.map((item) => item.code)).toContain('HCB_HOST_API_UNVERIFIED');
    expect(report.checks.compile_check).toBe('skipped');
  });

  it.each([{}, { app: { products: [] } }, { app: { products: [{ name: 'a' }, { name: 'b' }] } }])('requires API verification when no single host product is known', async (metadata) => {
    await writeFile(join(host, 'build-profile.json5'), JSON.stringify(metadata));
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.warnings.map((item) => item.code)).toContain('HCB_HOST_API_UNVERIFIED');
  });

  it('rejects a target below a numeric host minimum API', async () => {
    await writeFile(join(host, 'build-profile.json5'), '{app:{products:[{compatibleSdkVersion:17,targetSdkVersion:17}]}}');
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_HOST_API_TOO_LOW');
  });

  it('preserves planner rejection and the concrete reason', async () => {
    const input = manifest();
    input.features[0] = {
      id: 'visualEffect', kind: 'ACTION', title: 'Visual effect',
      contract: { inputs: [], output: { type: 'null' } }, hints: { visualOnly: true },
    };
    const report = await validateProject(input, target, registry, host);
    expect(report.status).toBe('fail');
    expect(report.errors.find((item) => item.code === 'HCB_PLAN_REJECTED')?.message).toContain('visual-only');
  });

  it('does not use source c86 metadata as target ABI and checks explicit native targets', async () => {
    const valid = await validateProject(manifest(), { ...target, nativeAbis: ['arm64-v8a'] }, registry, host);
    expect(valid.status).toBe('pass');
    const invalid = await validateProject(manifest(), { ...target, nativeAbis: ['c86', 'x86'] }, registry, host);
    expect(invalid.errors.filter((item) => item.code === 'HCB_NATIVE_ABI_UNSUPPORTED')).toHaveLength(2);
  });

  it('checks host Native build options and marks experimental ABI evidence', async () => {
    await writeFile(join(host, 'entry/build-profile.json5'), '{buildOption:{externalNativeOptions:{abiFilters:["x86_64"]}},buildOptionSet:[{name:"release",externalNativeOptions:{abiFilters:["c86"]}}]}');
    registry.native.status = 'experimental';
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_NATIVE_ABI_UNSUPPORTED');
    expect(report.warnings.map((item) => item.code)).toContain('HCB_NATIVE_REGISTRY_EXPERIMENTAL');
  });

  it('rejects malformed ABI filters in root host metadata', async () => {
    await writeFile(join(host, 'build-profile.json5'), '{app:{products:[{compatibleSdkVersion:12,targetSdkVersion:16}]},buildOption:{externalNativeOptions:{abiFilters:"c86"}}}');
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.errors.map((item) => item.code)).toContain('HCB_NATIVE_ABI_INVALID');
  });

  it('ignores unrelated private configuration and does not report signing fields', async () => {
    await writeFile(join(host, 'local.properties'), 'signing-password=fixture-private');
    await writeFile(join(host, '.env'), 'TOKEN=fixture-token');
    await writeFile(join(host, 'build-profile.json5'), '{app:{signingConfigs:[{password:"fixture-signing"}],products:[{compatibleSdkVersion:12,targetSdkVersion:16}]}}');
    const report = await validateProject(manifest(), target, registry, host);
    expect(report.status).toBe('pass');
    expect(JSON.stringify(report)).not.toMatch(/fixture-private|fixture-token|fixture-signing/);
  });
});
