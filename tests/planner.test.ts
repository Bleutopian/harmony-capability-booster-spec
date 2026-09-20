import { beforeEach, describe, expect, it } from 'vitest';
import type { Feature, FeatureManifest } from '@hcb/manifest';
import { createPlan } from '@hcb/planner';
import { loadRegistry, type CapabilityRegistry, type TargetProfile } from '@hcb/registry';

const action: Feature = {
  id: 'queryOrder', kind: 'ACTION', title: 'Query order',
  contract: { inputs: [{ name: 'orderId', type: 'string', required: true }], output: { type: 'object' } },
  hints: { userInvokable: true, existingImplementation: true, callable: true },
};
const state: Feature = {
  id: 'orderProgress', kind: 'STATE', title: 'Order progress',
  contract: { entityIdField: 'orderId', states: ['PROCESSING', 'COMPLETED'], terminalStates: ['COMPLETED'] },
  hints: { lifecycle: 'ongoing', startDefined: true, endDefined: true, realtime: true, userAttention: 'high' },
};
const resource: Feature = {
  id: 'scanDocument', kind: 'RESOURCE', title: 'Scan document',
  contract: { resourceType: 'document_scan', acceptedOutputs: ['image', 'pdf'] },
  hints: { existingLocalImplementation: true, allowCrossDevice: true, fallback: 'DocumentService.scanLocally' },
};
const target: TargetProfile = { devices: ['tablet'], apiVersion: 20, stageModel: true, liveViewEligible: true, liveViewEntitled: true };

function manifest(...features: Feature[]): FeatureManifest {
  return { schemaVersion: '0.1', application: { id: 'com.example.orders', sourcePlatforms: ['android'], sourceAvailability: 'source' }, features };
}

let registry: CapabilityRegistry;
beforeEach(async () => {
  registry = await loadRegistry();
  for (const entry of Object.values(registry.capabilities)) {
    Object.assign(entry, { status: 'stable', provenance: 'official', verifiedAt: '2026-09-21', apiMin: 20, requiredChecks: [] });
    entry.targets = { phone: { supported: true }, tablet: { supported: true }, pc: { supported: true } };
  }
});

describe('enhancement planner', () => {
  it('maps each confirmed feature to one capability without promising adapters', () => {
    const plan = createPlan(manifest(action, state, resource), target, registry);
    expect(plan.items.map((item) => [item.capability, item.decision])).toEqual([
      ['intents', 'recommend'], ['live_view', 'recommend'], ['service_collaboration', 'recommend'],
    ]);
    expect(plan.items.every((item) => item.generatedArtifacts.length === 0 && item.reasons.length > 0)).toBe(true);
    expect(plan.applicationId).toBe('com.example.orders');
    expect(plan.planVersion).toBe('0.1');
  });

  it('keeps every default unverified capability conditional', async () => {
    const plan = createPlan(manifest(action, state, resource), target, await loadRegistry());
    expect(plan.items.map((item) => item.decision)).toEqual(['conditional', 'conditional', 'conditional']);
    for (const item of plan.items) {
      expect(item.requiredChecks).toContain('officialApiVerification');
      expect(item.requiredChecks).toContain('minimumApiVersion');
      expect(item.requiredChecks).toContain('deviceSupport.tablet');
      expect(new Set(item.requiredChecks).size).toBe(item.requiredChecks.length);
    }
  });

  it('rejects PC Live View even if an external registry marks it supported', () => {
    const plan = createPlan(manifest(state), { ...target, devices: ['phone', 'pc'] }, registry);
    expect(plan.items[0]?.decision).toBe('reject');
    expect(plan.items[0]?.reasons[0]).toContain('pc');
  });

  it('enforces Stage, API version, and device hard constraints', () => {
    registry.capabilities.intents.targets.tablet.supported = false;
    const plan = createPlan(manifest(action), { ...target, apiVersion: 19, stageModel: false }, registry);
    expect(plan.items[0]?.decision).toBe('reject');
    expect(plan.items[0]?.reasons).toEqual(expect.arrayContaining([
      expect.stringContaining('Stage'), expect.stringContaining('tablet'), expect.stringContaining('API 19'),
    ]));
  });

  it('enforces Stage globally even when a custom registry relaxes its capability requirement', () => {
    registry.capabilities.intents.stageModelRequired = false;
    const item = createPlan(manifest(action), { ...target, stageModel: false }, registry).items[0];
    expect(item?.decision).toBe('reject');
    expect(item?.reasons[0]).toContain('HCB requires a Stage-model');
  });

  it('keeps hard platform rejections when later checks are conditional', async () => {
    const plan = createPlan(manifest(state), { ...target, devices: ['pc'] }, await loadRegistry());
    expect(plan.items[0]?.decision).toBe('reject');
    expect(plan.items[0]?.requiredChecks).toContain('officialApiVerification');
  });

  it('does not use source architecture, operating system or source confidence in business decisions', () => {
    const original = manifest(action, resource);
    const desktop = structuredClone(original);
    desktop.application.sourcePlatforms = ['windows', 'linux'];
    desktop.application.sourceArchitectures = ['x86_64', 'c86'];
    const mobile = structuredClone(original);
    mobile.application.sourceArchitectures = ['arm64'];
    expect(createPlan(desktop, target, registry).items).toEqual(createPlan(mobile, target, registry).items);
  });

  it('requires explicit review for binary-only contracts', () => {
    const binary = manifest(action);
    binary.application.sourceAvailability = 'binary_only';
    expect(createPlan(binary, target, registry).items[0]?.decision).toBe('reject');
    binary.features = [{ ...action, review: { status: 'confirmed' } }];
    expect(createPlan(binary, target, registry).items[0]?.decision).toBe('recommend');
  });

  it('rejects pending review even for source inputs', () => {
    expect(createPlan(manifest({ ...action, review: { status: 'pending' } }), target, registry).items[0]?.decision).toBe('reject');
  });

  it('rejects visual-only actions and explicit absence of callable business logic', () => {
    for (const hints of [{ visualOnly: true }, { callable: false }, { existingImplementation: false }, { userInvokable: false }]) {
      expect(createPlan(manifest({ ...action, hints }), target, registry).items[0]?.decision).toBe('reject');
    }
  });

  it('requires action binding evidence when hints are absent', () => {
    const unbound = structuredClone(action);
    delete unbound.hints;
    const item = createPlan(manifest(unbound), target, registry).items[0];
    expect(item?.decision).toBe('conditional');
    expect(item?.requiredChecks).toEqual(['action.existingImplementation', 'action.callable', 'action.userInvokable']);
  });

  it('rejects static, instantaneous, unbounded or low-attention states', () => {
    for (const hints of [
      { lifecycle: 'static' as const }, { lifecycle: 'instant' as const }, { startDefined: false },
      { endDefined: false }, { realtime: false }, { userAttention: 'low' as const }, { eligibilityConfirmed: false },
    ]) {
      expect(createPlan(manifest({ ...state, hints }), target, registry).items[0]?.decision).toBe('reject');
    }
  });

  it('requires missing lifecycle evidence and Live View admission', () => {
    const unconfirmed = structuredClone(state);
    delete unconfirmed.hints;
    const item = createPlan(manifest(unconfirmed), { devices: ['phone'], apiVersion: 20, stageModel: true }, registry).items[0];
    expect(item?.decision).toBe('conditional');
    expect(item?.requiredChecks).toEqual([
      'liveViewEligibility', 'liveViewEntitlement', 'state.ongoingLifecycle', 'state.startDefined',
      'state.endDefined', 'state.realtime', 'state.userAttention',
    ]);
  });

  it('rejects explicit Live View eligibility or entitlement denial', () => {
    for (const profile of [{ ...target, liveViewEligible: false }, { ...target, liveViewEntitled: false }]) {
      expect(createPlan(manifest(state), profile, registry).items[0]?.decision).toBe('reject');
    }
  });

  it('rejects resource features without existing local implementation or cross-device consent', () => {
    for (const hints of [{ existingLocalImplementation: false }, { existingLocalImplementation: true, allowCrossDevice: false }]) {
      expect(createPlan(manifest({ ...resource, hints }), target, registry).items[0]?.decision).toBe('reject');
    }
  });

  it('keeps resource plans conditional until the local fallback and cross-device use are bound', () => {
    const item = createPlan(manifest({ ...resource, hints: { existingLocalImplementation: true } }), target, registry).items[0];
    expect(item?.decision).toBe('conditional');
    expect(item?.requiredChecks).toEqual(['resource.allowCrossDevice', 'originalLocalImplementationBinding']);
  });

  it('produces deterministic plans and does not alias the caller target', () => {
    const profile = structuredClone(target);
    const plan = createPlan(manifest(action), profile, registry);
    expect(plan).toEqual(createPlan(manifest(action), profile, registry));
    profile.devices.push('pc');
    expect(plan.target.devices).toEqual(['tablet']);
  });

  it('rejects malformed runtime target input', () => {
    expect(() => createPlan(manifest(action), { ...target, devices: [] }, registry)).toThrow('must NOT have fewer than 1 items');
  });

  it('rejects unverified stable registry data at its public API boundary', () => {
    registry.capabilities.intents.verifiedAt = null;
    expect(() => createPlan(manifest(action), target, registry)).toThrow('HCB_REGISTRY_UNVERIFIED');
  });

  it('rejects semantically invalid manifests at its public API boundary', () => {
    expect(() => createPlan(manifest(action, action), target, registry)).toThrow('HCB_DUPLICATE_FEATURE_ID');
  });
});
