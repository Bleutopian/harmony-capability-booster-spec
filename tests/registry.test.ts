import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { capabilityIds, loadRegistry, RegistryError, validateRegistry, validateTargetProfile } from '@hcb/registry';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function registryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'hcb-registry-'));
  temporaryDirectories.push(directory);
  const registry = await loadRegistry();
  await Promise.all([
    ...capabilityIds.map((id) => writeFile(join(directory, `${id}.yaml`), stringify(registry.capabilities[id]))),
    writeFile(join(directory, 'ohos-native-abi.yaml'), stringify(registry.native)),
  ]);
  return directory;
}

describe('capability registry', () => {
  it('loads only the three V0.1 capabilities with honest verification status', async () => {
    const registry = await loadRegistry();
    expect(Object.keys(registry.capabilities)).toEqual(capabilityIds);
    for (const capability of Object.values(registry.capabilities)) {
      expect(capability.status).toBe('experimental');
      expect(capability.provenance).toBe('spec');
      expect(capability.apiMin).toBeNull();
      expect(capability.verifiedAt).toBeNull();
    }
    expect(registry.capabilities.live_view.targets.pc.supported).toBe(false);
    expect(registry.native.status).toBe('experimental');
    expect(registry.native.supportedTargetAbis).toEqual(['arm64-v8a', 'x86_64']);
    expect(registry.native.acceptedSourceArchitectures).toContain('c86');
  });

  it('loads an explicit directory', async () => {
    expect(await loadRegistry(await registryDirectory())).toEqual(await loadRegistry());
  });

  it('rejects malformed and duplicate-key YAML', async () => {
    const directory = await registryDirectory();
    const path = join(directory, 'intents.yaml');
    await writeFile(path, `${await readFile(path, 'utf8')}\nid: intents\n`);
    await expect(loadRegistry(directory)).rejects.toBeInstanceOf(RegistryError);
    await writeFile(path, 'id: [invalid');
    await expect(loadRegistry(directory)).rejects.toThrow('Invalid YAML');
  });

  it('rejects unknown YAML tags instead of silently using their values', async () => {
    const directory = await registryDirectory();
    const path = join(directory, 'intents.yaml');
    await writeFile(path, (await readFile(path, 'utf8')).replace('id: intents', 'id: !unrecognized intents'));
    await expect(loadRegistry(directory)).rejects.toThrow('TAG_RESOLVE_FAILED');
  });

  it('reports parser locations without exposing source fragments', async () => {
    const directory = await registryDirectory();
    await writeFile(join(directory, 'intents.yaml'), 'credentials: [private-review-token');
    await expect(loadRegistry(directory)).rejects.toThrow('at line 1');
    await expect(loadRegistry(directory)).rejects.not.toThrow('private-review-token');
  });

  it('rejects alias expansion with a sanitized registry diagnostic', async () => {
    const directory = await registryDirectory();
    await writeFile(join(directory, 'intents.yaml'), 'private-review-token: &entry [secret]\nid: *entry\n');
    await expect(loadRegistry(directory)).rejects.toBeInstanceOf(RegistryError);
    await expect(loadRegistry(directory)).rejects.toThrow('unsupported alias expansion');
    await expect(loadRegistry(directory)).rejects.not.toThrow('private-review-token');
  });

  it('rejects invalid registry entries at the load boundary', async () => {
    const directory = await registryDirectory();
    await writeFile(join(directory, 'intents.yaml'), 'id: wallet\n');
    await expect(loadRegistry(directory)).rejects.toBeInstanceOf(RegistryError);
  });

  it('does not promote specification references to stable entries', async () => {
    const registry = await loadRegistry();
    registry.capabilities.intents.status = 'stable';
    const result = validateRegistry(registry);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain('HCB_REGISTRY_UNVERIFIED');
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toContain('/capabilities/intents/apiMin');
  });

  it('accepts stable capability fixtures with complete verification evidence', async () => {
    const registry = await loadRegistry();
    Object.assign(registry.capabilities.intents, {
      status: 'stable', provenance: 'official', verifiedAt: '2026-09-21', apiMin: 20,
    });
    expect(validateRegistry(registry).valid).toBe(true);
  });

  it('rejects mismatched IDs, invalid dates and unverified native entries', async () => {
    const registry = await loadRegistry();
    registry.capabilities.intents.id = 'live_view';
    registry.capabilities.intents.verifiedAt = '2026-02-30';
    registry.native.status = 'stable';
    const result = validateRegistry(registry);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.path)).toEqual([
      '/capabilities/intents/id', '/capabilities/intents/verifiedAt', '/native',
    ]);
  });

  it('rejects unknown capability families and source architectures used as target ABIs', async () => {
    const registry = await loadRegistry();
    expect(validateRegistry({ ...registry, capabilities: { ...registry.capabilities, wallet: {} } }).valid).toBe(false);
    registry.native.supportedTargetAbis = ['c86'];
    expect(validateRegistry(registry).valid).toBe(false);
  });

  it('requires official Huawei HTTPS references', async () => {
    const registry = await loadRegistry();
    registry.capabilities.intents.sourceUrls = ['https://developer.huawei.com.example.org/api'];
    expect(validateRegistry(registry).valid).toBe(false);
  });
});

describe('target profile validation', () => {
  it('accepts supported targets without coercing or mutating input', () => {
    const target = { devices: ['phone', 'tablet', 'pc'], apiVersion: 20, stageModel: true, nativeAbis: ['arm64-v8a'] };
    expect(validateTargetProfile(target)).toEqual({ valid: true, value: target, diagnostics: [] });
  });

  it.each([
    null,
    { devices: [], apiVersion: 20, stageModel: true },
    { devices: ['phone', 'phone'], apiVersion: 20, stageModel: true },
    { devices: ['watch'], apiVersion: 20, stageModel: true },
    { devices: ['pc'], apiVersion: '20', stageModel: true },
    { devices: ['pc'], apiVersion: 0, stageModel: true },
    { devices: ['pc'], apiVersion: 20.5, stageModel: true },
    { devices: ['pc'], apiVersion: 20, stageModel: true, unknown: true },
  ])('rejects invalid target profile %#', (target) => {
    const result = validateTargetProfile(target);
    expect(result.valid).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('HCB_TARGET_INVALID');
  });
});
