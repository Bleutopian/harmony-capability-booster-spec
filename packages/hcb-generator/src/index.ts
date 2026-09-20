import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import type { Diagnostic, FeatureManifest } from '@hcb/manifest';
import type { EnhancementPlan } from '@hcb/planner';

const owner = 'HCB_GENERATED';
const artifactPaths = [
  '.hcb/generated/enhancement-plan.json',
  '.hcb/generated/binding-contracts.json'
] as const;

export interface GeneratedArtifact {
  path: string;
  content: string;
}

export interface PatchItem extends GeneratedArtifact {
  operation: 'create' | 'update' | 'unchanged' | 'conflict';
  diff: string;
}

export interface PatchPreview {
  patchVersion: '0.1';
  mode: 'dry-run';
  platformArtifactsGenerated: false;
  changes: PatchItem[];
  diagnostics: Diagnostic[];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function checksum(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function serialize(payload: Record<string, unknown>): string {
  const normalized = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  return `${JSON.stringify({ _hcb: { owner, version: '0.1', sha256: checksum(normalized) }, ...normalized }, null, 2)}\n`;
}

function isManaged(content: string): boolean {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false;
    const { _hcb, ...payload } = parsed as Record<string, unknown>;
    if (typeof _hcb !== 'object' || _hcb === null || Array.isArray(_hcb)) return false;
    const metadata = _hcb as Record<string, unknown>;
    return metadata.owner === owner && metadata.version === '0.1' && metadata.sha256 === checksum(payload);
  } catch {
    return false;
  }
}

export function generateArtifacts(manifest: FeatureManifest, plan: EnhancementPlan): GeneratedArtifact[] {
  if (manifest.application.id !== plan.applicationId) {
    throw new Error('HCB-GN-001: Plan application does not match the manifest.');
  }
  const manifestIds = new Set(manifest.features.map(feature => feature.id));
  const planIds = new Set(plan.items.map(item => item.featureId));
  if (plan.items.length !== planIds.size || planIds.size !== manifestIds.size ||
      plan.items.some(item => !manifestIds.has(item.featureId))) {
    throw new Error('HCB-GN-002: Plan features do not match the manifest.');
  }
  if (plan.items.some(item => item.generatedArtifacts.length > 0)) {
    throw new Error('HCB-GN-003: Platform adapter generation is not implemented in this milestone.');
  }
  if (manifest.features.length === 0) return [];
  const bindings = manifest.features.flatMap(feature => {
    const item = plan.items.find(candidate => candidate.featureId === feature.id);
    if (!item || item.decision === 'reject') return [];
    return [{
      featureId: feature.id,
      kind: feature.kind,
      capability: item.capability,
      decision: item.decision,
      contract: feature.contract,
      requiredChecks: item.requiredChecks,
      bindingStatus: 'unbound',
      requiredBinding: feature.kind === 'ACTION' ? 'execute' : feature.kind === 'STATE' ? 'getCurrent' : 'requestLocal'
    }];
  });
  return [
    { path: artifactPaths[0], content: serialize({ artifactKind: 'enhancement-plan', plan }) },
    { path: artifactPaths[1], content: serialize({ artifactKind: 'binding-contracts', applicationId: plan.applicationId, bindings }) }
  ];
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

// Refuse links before reading an existing artifact, so a preview cannot expose
// arbitrary files through a redirected .hcb directory or artifact filename.
async function readExisting(root: string, relativePath: string): Promise<string | undefined> {
  const segments = relativePath.split('/');
  let current = resolve(root);
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not allowed in generated artifact paths.');
      if (index < segments.length - 1 && !stat.isDirectory()) throw new Error('Artifact parent is not a directory.');
      if (index === segments.length - 1 && !stat.isFile()) throw new Error('Artifact path is not a file.');
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }
  return readFile(current, 'utf8');
}

export async function previewArtifacts(artifacts: GeneratedArtifact[], root: string): Promise<PatchPreview> {
  const preview: PatchPreview = {
    patchVersion: '0.1', mode: 'dry-run', platformArtifactsGenerated: false, changes: [], diagnostics: []
  };
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    if (!artifactPaths.some(path => path === artifact.path) || seen.has(artifact.path)) {
      preview.diagnostics.push({ code: 'HCB-GN-004', path: artifact.path, message: 'Unsupported or duplicate generated artifact path.' });
      continue;
    }
    seen.add(artifact.path);
    try {
      const existing = await readExisting(root, artifact.path);
      const operation = existing === undefined ? 'create' : !isManaged(existing) ? 'conflict' : existing === artifact.content ? 'unchanged' : 'update';
      if (operation === 'conflict') {
        preview.diagnostics.push({ code: 'HCB-GN-005', path: artifact.path, message: 'Existing artifact is unowned, detached or has been edited.' });
      }
      preview.changes.push({
        ...artifact, operation,
        diff: operation === 'unchanged' || operation === 'conflict' ? '' : createTwoFilesPatch(
          existing === undefined ? '/dev/null' : `a/${artifact.path}`, `b/${artifact.path}`, existing ?? '', artifact.content
        )
      });
    } catch {
      preview.diagnostics.push({ code: 'HCB-GN-006', path: artifact.path, message: 'Cannot inspect artifact: path is unreadable, redirected or not a regular file.' });
    }
  }
  return preview;
}
