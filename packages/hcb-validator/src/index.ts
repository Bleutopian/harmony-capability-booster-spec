import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSON5 from 'json5';
import { validateManifest, type Diagnostic, type FeatureManifest } from '@hcb/manifest';
import { createPlan, type EnhancementPlan } from '@hcb/planner';
import {
  validateRegistry,
  validateTargetProfile,
  type CapabilityRegistry,
  type TargetProfile,
} from '@hcb/registry';

export interface ProjectValidationReport {
  status: 'pass' | 'pass_with_warnings' | 'fail';
  errors: Diagnostic[];
  warnings: Diagnostic[];
  checks: { compile_check: 'skipped'; compile_reason: string };
  plan: EnhancementPlan;
}

type Metadata = Record<string, unknown>;

function record(value: unknown): Metadata | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Metadata
    : undefined;
}

function diagnostic(code: string, path: string, message: string): Diagnostic {
  return { code, path, message };
}

async function readMetadata(
  root: string,
  relative: string,
  errors: Diagnostic[],
  optional = false,
): Promise<Metadata | undefined> {
  let source: string;
  try {
    source = await readFile(join(root, relative), 'utf8');
  } catch (error: unknown) {
    const code = record(error)?.['code'];
    if (optional && code === 'ENOENT') return undefined;
    errors.push(diagnostic('HCB_HOST_METADATA_READ', relative, 'Host metadata could not be read. Check that the file exists and is readable.'));
    return undefined;
  }
  try {
    const parsed = record(JSON5.parse(source.replace(/^\uFEFF/, '')) as unknown);
    if (parsed) return parsed;
  } catch {
    // Parser messages may contain source fragments, including signing metadata.
  }
  errors.push(diagnostic('HCB_HOST_METADATA_INVALID', relative, 'Host metadata must be a valid JSON5 object.'));
  return undefined;
}

function checkAbis(value: unknown, path: string, registry: CapabilityRegistry, errors: Diagnostic[]): boolean {
  if (value === undefined) return false;
  if (!Array.isArray(value) || value.some((abi: unknown) => typeof abi !== 'string')) {
    errors.push(diagnostic('HCB_NATIVE_ABI_INVALID', path, 'Native ABI filters must be an array of target ABI names.'));
    return false;
  }
  for (const abi of value as string[]) {
    if (!registry.native.supportedTargetAbis.includes(abi)) {
      errors.push(diagnostic('HCB_NATIVE_ABI_UNSUPPORTED', path, 'A declared target ABI is not supported by the Native Toolchain Registry. Source architecture names cannot establish target compatibility.'));
    }
  }
  return value.length > 0;
}

function checkNativeOptions(profile: Metadata, path: string, registry: CapabilityRegistry, errors: Diagnostic[]): boolean {
  let declared = false;
  const inspect = (option: unknown, optionPath: string): void => {
    const filters = record(record(option)?.['externalNativeOptions'])?.['abiFilters'];
    declared = checkAbis(filters, `${optionPath}/externalNativeOptions/abiFilters`, registry, errors) || declared;
  };
  inspect(profile['buildOption'], `${path}/buildOption`);
  if (Array.isArray(profile['buildOptionSet'])) {
    profile['buildOptionSet'].forEach((option: unknown, index: number) => inspect(option, `${path}/buildOptionSet/${index}`));
  }
  return declared;
}

function checkModule(moduleFile: Metadata, nativeProfile: Metadata | undefined, target: TargetProfile, errors: Diagnostic[]): void {
  const path = 'entry/src/main/module.json5/module';
  const module = record(moduleFile['module']);
  const hasEntry = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';
  const entries = [module?.['abilities'], module?.['extensionAbilities']];
  const stageEntry = hasEntry(module?.['srcEntry']) || entries.some((items) =>
    Array.isArray(items) && items.some((item: unknown) => hasEntry(record(item)?.['srcEntry'])));
  const apiType = nativeProfile?.['apiType'];
  if (!stageEntry || (apiType !== undefined && apiType !== 'stageMode')) {
    errors.push(diagnostic('HCB_HOST_STAGE_REQUIRED', path, 'Stage srcEntry metadata is required on the module, an ability or an extension. FA metadata is not supported.'));
  }
  const devices = module?.['deviceTypes'];
  if (!Array.isArray(devices) || devices.length === 0 || devices.some((device: unknown) => typeof device !== 'string')) {
    errors.push(diagnostic('HCB_HOST_DEVICES_INVALID', `${path}/deviceTypes`, 'The host module must declare deviceTypes as a nonempty array of device names.'));
    return;
  }
  const normalized = devices.map((device: string) => device === '2in1' ? 'pc' : device);
  for (const device of target.devices) {
    if (!normalized.includes(device)) {
      errors.push(diagnostic('HCB_HOST_DEVICE_UNSUPPORTED', `${path}/deviceTypes`, `The host module does not declare support for target device '${device}'.`));
    }
  }
}

function checkHostApi(profile: Metadata, target: TargetProfile, errors: Diagnostic[], warnings: Diagnostic[]): void {
  const products = record(profile['app'])?.['products'];
  if (!Array.isArray(products) || products.length !== 1) {
    warnings.push(diagnostic('HCB_HOST_API_UNVERIFIED', 'build-profile.json5/app/products', 'A single host product could not be identified. Verify its API level against the explicit target profile.'));
    return;
  }
  const product = record(products[0]);
  const minimum = product?.['compatibleSdkVersion'];
  const declaredTarget = product?.['targetSdkVersion'] ?? product?.['compileSdkVersion'];
  const numericMinimum = typeof minimum === 'number' && Number.isInteger(minimum) && minimum > 0;
  const numericTarget = typeof declaredTarget === 'number' && Number.isInteger(declaredTarget) && declaredTarget > 0;
  if (numericMinimum && target.apiVersion < minimum) {
    errors.push(diagnostic('HCB_HOST_API_TOO_LOW', 'build-profile.json5/app/products/0/compatibleSdkVersion', 'The explicit target API is below the host minimum supported API.'));
  }
  if (!numericMinimum || !numericTarget || declaredTarget !== target.apiVersion) {
    warnings.push(diagnostic('HCB_HOST_API_UNVERIFIED', 'build-profile.json5/app/products/0', 'Verify the host SDK API level against the explicit target profile. Marketing versions and SDK version strings are not converted to API levels.'));
  }
}

async function checkHost(
  root: string,
  target: TargetProfile,
  registry: CapabilityRegistry,
  errors: Diagnostic[],
  warnings: Diagnostic[],
): Promise<boolean> {
  const profile = await readMetadata(root, 'build-profile.json5', errors);
  const module = await readMetadata(root, 'entry/src/main/module.json5', errors);
  await readMetadata(root, 'entry/oh-package.json5', errors);
  const nativeProfile = await readMetadata(root, 'entry/build-profile.json5', errors, true);
  if (module) checkModule(module, nativeProfile, target, errors);
  let nativeDeclared = false;
  if (profile) {
    checkHostApi(profile, target, errors, warnings);
    nativeDeclared = checkNativeOptions(profile, 'build-profile.json5', registry, errors);
  }
  if (nativeProfile) nativeDeclared = checkNativeOptions(nativeProfile, 'entry/build-profile.json5', registry, errors) || nativeDeclared;
  return nativeDeclared;
}

export async function validateProject(
  manifest: FeatureManifest,
  target: TargetProfile,
  registry: CapabilityRegistry,
  hostRoot?: string,
): Promise<ProjectValidationReport> {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];
  const manifestResult = validateManifest(manifest);
  const targetResult = validateTargetProfile(target);
  const registryResult = validateRegistry(registry);
  for (const result of [manifestResult, targetResult, registryResult]) errors.push(...result.diagnostics);
  let plan: EnhancementPlan = {
    planVersion: '0.1',
    applicationId: manifestResult.valid ? manifestResult.value.application.id : '',
    target,
    items: [],
  };

  if (manifestResult.valid && manifestResult.value.features.length === 0) {
    warnings.push(diagnostic('HCB_MANIFEST_EMPTY', '/features', 'The manifest contains no existing features to enhance.'));
  }
  if (targetResult.valid && !targetResult.value.stageModel) {
    errors.push(diagnostic('HCB_TARGET_STAGE_REQUIRED', '/target/stageModel', 'HCB requires the HarmonyOS Stage model.'));
  }
  if (manifestResult.valid && targetResult.valid && registryResult.valid) {
    plan = createPlan(manifestResult.value, targetResult.value, registryResult.value);
    for (const [index, item] of plan.items.entries()) {
      const path = `/plan/items/${index}`;
      if (item.decision === 'reject') {
        errors.push(diagnostic('HCB_PLAN_REJECTED', path, `${item.featureId}: ${item.reasons.join(' ')}`));
      } else if (item.decision === 'conditional') {
        warnings.push(diagnostic('HCB_PLAN_CONDITIONAL', path, `${item.featureId}: ${item.reasons.join(' ')} Required checks: ${item.requiredChecks.join(', ') || 'see plan reasons'}.`));
      }
    }
  }

  if (targetResult.valid && registryResult.valid) {
    let nativeDeclared = checkAbis(targetResult.value.nativeAbis, '/target/nativeAbis', registryResult.value, errors);
    if (hostRoot !== undefined) {
      nativeDeclared = await checkHost(hostRoot, targetResult.value, registryResult.value, errors, warnings) || nativeDeclared;
    } else {
      warnings.push(diagnostic('HCB_HOST_NOT_CHECKED', '/hostRoot', 'No HarmonyOS host was provided; host metadata has not been checked.'));
    }
    if (nativeDeclared && registryResult.value.native.status === 'experimental') {
      warnings.push(diagnostic('HCB_NATIVE_REGISTRY_EXPERIMENTAL', '/registry/native', 'Native ABI metadata matches an experimental registry only. Official toolchain compatibility still requires verification.'));
    }
  }

  return {
    status: errors.length > 0 ? 'fail' : warnings.length > 0 ? 'pass_with_warnings' : 'pass',
    errors,
    warnings,
    checks: {
      compile_check: 'skipped',
      compile_reason: 'No platform artifacts generated in this milestone; HarmonyOS compilation and Runtime HAR integration were not checked.',
    },
    plan,
  };
}
