import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { parseDocument } from 'yaml';
import type { Diagnostic, ValidationResult } from '@hcb/manifest';

export const capabilityIds = ['intents', 'live_view', 'service_collaboration'] as const;
export const targetDevices = ['phone', 'tablet', 'pc'] as const;
export type CapabilityId = (typeof capabilityIds)[number];
export type TargetDevice = (typeof targetDevices)[number];

export interface TargetProfile {
  devices: TargetDevice[];
  apiVersion: number;
  stageModel: boolean;
  liveViewEligible?: boolean;
  liveViewEntitled?: boolean;
  nativeAbis?: string[];
}

interface VerificationEvidence {
  status: 'experimental' | 'stable';
  provenance: 'spec' | 'official';
  verifiedAt: string | null;
  sourceUrls: string[];
}

export interface CapabilityDefinition extends VerificationEvidence {
  id: CapabilityId;
  apiMin: number | null;
  targets: Record<TargetDevice, { supported: boolean | 'conditional' }>;
  stageModelRequired: boolean;
  permissions: string[];
  constraints: string[];
  requiredChecks: string[];
}

export interface NativeToolchainDefinition extends VerificationEvidence {
  id: 'ohos.native.abi';
  supportedTargetAbis: string[];
  acceptedSourceArchitectures: string[];
  constraints: string[];
}

export interface CapabilityRegistry {
  schemaVersion: '0.1';
  capabilities: Record<CapabilityId, CapabilityDefinition>;
  native: NativeToolchainDefinition;
}

const stringList = {
  type: 'array',
  uniqueItems: true,
  items: { type: 'string', minLength: 1, pattern: '\\S' },
};
const evidenceProperties = {
  status: { enum: ['experimental', 'stable'] },
  provenance: { enum: ['spec', 'official'] },
  verifiedAt: { anyOf: [{ type: 'null' }, { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }] },
  sourceUrls: { ...stringList, minItems: 1, items: { type: 'string', pattern: '^https://developer\\.huawei\\.com/' } },
};
const capabilitySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', ...Object.keys(evidenceProperties), 'apiMin', 'targets', 'stageModelRequired', 'permissions', 'constraints', 'requiredChecks'],
  properties: {
    id: { enum: capabilityIds },
    ...evidenceProperties,
    apiMin: { anyOf: [{ type: 'null' }, { type: 'integer', minimum: 1 }] },
    targets: {
      type: 'object',
      additionalProperties: false,
      required: targetDevices,
      properties: Object.fromEntries(targetDevices.map((device) => [device, {
        type: 'object',
        additionalProperties: false,
        required: ['supported'],
        properties: { supported: { enum: [true, false, 'conditional'] } },
      }])),
    },
    stageModelRequired: { type: 'boolean' },
    permissions: stringList,
    constraints: stringList,
    requiredChecks: stringList,
  },
};
const nativeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', ...Object.keys(evidenceProperties), 'supportedTargetAbis', 'acceptedSourceArchitectures', 'constraints'],
  properties: {
    id: { const: 'ohos.native.abi' },
    ...evidenceProperties,
    supportedTargetAbis: { ...stringList, minItems: 1, items: { enum: ['arm64-v8a', 'x86_64'] } },
    acceptedSourceArchitectures: { ...stringList, minItems: 1, items: { enum: ['arm', 'arm64', 'x86', 'x86_64', 'c86', 'unknown'] } },
    constraints: stringList,
  },
};
const ajv = new Ajv2020({ allErrors: true, strict: true });
const checkRegistry = ajv.compile<CapabilityRegistry>({
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'capabilities', 'native'],
  properties: {
    schemaVersion: { const: '0.1' },
    capabilities: {
      type: 'object',
      additionalProperties: false,
      required: capabilityIds,
      properties: Object.fromEntries(capabilityIds.map((id) => [id, capabilitySchema])),
    },
    native: nativeSchema,
  },
});
const checkTarget = ajv.compile<TargetProfile>({
  type: 'object',
  additionalProperties: false,
  required: ['devices', 'apiVersion', 'stageModel'],
  properties: {
    devices: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: targetDevices } },
    apiVersion: { type: 'integer', minimum: 1 },
    stageModel: { type: 'boolean' },
    liveViewEligible: { type: 'boolean' },
    liveViewEntitled: { type: 'boolean' },
    nativeAbis: stringList,
  },
});

export function validateTargetProfile(input: unknown): ValidationResult<TargetProfile> {
  if (!checkTarget(input)) {
    return {
      valid: false,
      diagnostics: (checkTarget.errors ?? []).map((error) => ({
        code: 'HCB_TARGET_INVALID',
        path: error.instancePath || '/',
        message: error.message ?? 'Invalid target profile',
      })),
    };
  }
  return { valid: true, value: input, diagnostics: [] };
}

function verifyEvidence(entry: VerificationEvidence, path: string, diagnostics: Diagnostic[]): void {
  if (entry.verifiedAt !== null) {
    const date = new Date(`${entry.verifiedAt}T00:00:00Z`);
    if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== entry.verifiedAt) {
      diagnostics.push({ code: 'HCB_REGISTRY_INVALID', path: `${path}/verifiedAt`, message: 'Verification date must be a real calendar date' });
    }
  }
  if (entry.status === 'stable' && (entry.provenance !== 'official' || entry.verifiedAt === null)) {
    diagnostics.push({ code: 'HCB_REGISTRY_UNVERIFIED', path, message: 'Stable entries require official provenance and a verification date' });
  }
}

export function validateRegistry(input: unknown): ValidationResult<CapabilityRegistry> {
  if (!checkRegistry(input)) {
    return {
      valid: false,
      diagnostics: (checkRegistry.errors ?? []).map((error) => ({
        code: 'HCB_REGISTRY_INVALID',
        path: error.instancePath || '/',
        message: error.message ?? 'Invalid capability registry',
      })),
    };
  }
  const diagnostics: Diagnostic[] = [];
  for (const id of capabilityIds) {
    const entry = input.capabilities[id];
    const path = `/capabilities/${id}`;
    if (entry.id !== id) {
      diagnostics.push({ code: 'HCB_REGISTRY_INVALID', path: `${path}/id`, message: `Expected capability id ${id}` });
    }
    verifyEvidence(entry, path, diagnostics);
    if (entry.status === 'stable' && entry.apiMin === null) {
      diagnostics.push({ code: 'HCB_REGISTRY_UNVERIFIED', path: `${path}/apiMin`, message: 'Stable capabilities require a verified minimum API version' });
    }
  }
  verifyEvidence(input.native, '/native', diagnostics);
  return diagnostics.length > 0 ? { valid: false, diagnostics } : { valid: true, value: input, diagnostics };
}

export class RegistryError extends Error {
  constructor(public readonly diagnostics: Diagnostic[]) {
    super(diagnostics.map((diagnostic) => `${diagnostic.path}: ${diagnostic.message}`).join('\n'));
    this.name = 'RegistryError';
  }
}

async function readEntry(directory: string, filename: string): Promise<unknown> {
  const path = join(directory, filename);
  const source = await readFile(path, 'utf8');
  try {
    const document = parseDocument(source, { uniqueKeys: true, strict: true });
    const parsingIssues = [...document.errors, ...document.warnings];
    if (parsingIssues.length > 0) {
      throw new RegistryError(parsingIssues.map((error) => {
        const position = error.linePos?.[0];
        const location = position ? ` at line ${position.line}, column ${position.col}` : '';
        return { code: 'HCB_REGISTRY_INVALID', path: filename, message: `Invalid YAML (${error.code})${location}.` };
      }));
    }
    return document.toJS({ maxAliasCount: 0 }) as unknown;
  } catch (error) {
    if (error instanceof RegistryError) throw error;
    throw new RegistryError([{ code: 'HCB_REGISTRY_INVALID', path: filename, message: 'Invalid YAML syntax or unsupported alias expansion.' }]);
  }
}

export async function loadRegistry(directory = fileURLToPath(new URL('../../../capability-registry/', import.meta.url))): Promise<CapabilityRegistry> {
  const entries = await Promise.all(capabilityIds.map(async (id) => [id, await readEntry(directory, `${id}.yaml`)] as const));
  const input: unknown = {
    schemaVersion: '0.1',
    capabilities: Object.fromEntries(entries),
    native: await readEntry(directory, 'ohos-native-abi.yaml'),
  };
  const result = validateRegistry(input);
  if (!result.valid) throw new RegistryError(result.diagnostics);
  return result.value;
}
