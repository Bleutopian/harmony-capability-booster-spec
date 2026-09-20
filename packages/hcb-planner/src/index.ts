import { validateManifest, type Feature, type FeatureManifest } from '@hcb/manifest';
import { validateRegistry, validateTargetProfile, type CapabilityId, type CapabilityRegistry, type TargetProfile } from '@hcb/registry';

export type PlanDecision = 'recommend' | 'conditional' | 'reject';

export interface PlanItem {
  featureId: string;
  capability: CapabilityId;
  decision: PlanDecision;
  reasons: string[];
  requiredChecks: string[];
  generatedArtifacts: string[];
}

export interface EnhancementPlan {
  planVersion: '0.1';
  applicationId: string;
  target: TargetProfile;
  items: PlanItem[];
}

const capabilityForKind: Record<Feature['kind'], CapabilityId> = {
  ACTION: 'intents',
  STATE: 'live_view',
  RESOURCE: 'service_collaboration',
};

function planFeature(feature: Feature, manifest: FeatureManifest, target: TargetProfile, registry: CapabilityRegistry): PlanItem {
  const capability = capabilityForKind[feature.kind];
  const definition = registry.capabilities[capability];
  const item: PlanItem = {
    featureId: feature.id,
    capability,
    decision: 'recommend',
    reasons: [],
    requiredChecks: [],
    generatedArtifacts: [],
  };
  const reject = (reason: string): void => {
    item.decision = 'reject';
    item.reasons.push(reason);
  };
  const requireCheck = (check: string, reason: string): void => {
    if (item.decision !== 'reject') item.decision = 'conditional';
    if (!item.requiredChecks.includes(check)) item.requiredChecks.push(check);
    item.reasons.push(reason);
  };

  // Hard platform failures stay rejected even when later business checks succeed.
  if (!target.stageModel) {
    reject('HCB requires a Stage-model HarmonyOS target.');
  }
  for (const device of target.devices) {
    const support = definition.targets[device].supported;
    if (support === false || (capability === 'live_view' && device === 'pc')) {
      reject(`${capability} is not supported for target device ${device} in HCB V0.1.`);
    } else if (support === 'conditional') {
      requireCheck(`deviceSupport.${device}`, `Support for target device ${device} needs official verification.`);
    }
  }
  if (definition.apiMin === null) {
    requireCheck('minimumApiVersion', 'The minimum supported API version has not been verified.');
  } else if (target.apiVersion < definition.apiMin) {
    reject(`Target API ${target.apiVersion} is below the required API ${definition.apiMin}.`);
  }
  if (definition.status !== 'stable' || definition.provenance !== 'official' || definition.verifiedAt === null) {
    requireCheck('officialApiVerification', 'The capability is experimental and cannot enter adapter generation.');
  }
  for (const check of definition.requiredChecks) {
    requireCheck(check, `Registry requires ${check} before implementation.`);
  }

  if (feature.review?.status === 'pending') {
    reject('The feature contract is pending developer confirmation.');
  } else if (manifest.application.sourceAvailability === 'binary_only' && feature.review?.status !== 'confirmed') {
    reject('Binary-only evidence requires explicit developer confirmation of the feature contract.');
  }

  switch (feature.kind) {
    case 'ACTION': {
      if (feature.hints?.visualOnly === true) reject('A visual-only interaction has no independent business action.');
      for (const key of ['existingImplementation', 'callable', 'userInvokable'] as const) {
        if (feature.hints?.[key] === false) {
          reject(`ACTION requires ${key} to describe an existing callable business action.`);
        } else if (feature.hints?.[key] !== true) {
          requireCheck(`action.${key}`, `Confirm ACTION ${key} before creating an intent binding.`);
        }
      }
      item.reasons.push('ACTION has a structured input/output contract for an existing host binding.');
      break;
    }
    case 'STATE': {
      if (target.liveViewEligible === false || feature.hints?.eligibilityConfirmed === false) {
        reject('The business scenario is not eligible for Live View.');
      } else if (target.liveViewEligible !== true && feature.hints?.eligibilityConfirmed !== true) {
        requireCheck('liveViewEligibility', 'Live View scenario eligibility has not been confirmed.');
      }
      if (target.liveViewEntitled === false) {
        reject('The target does not have the required Live View entitlement.');
      } else if (target.liveViewEntitled !== true) {
        requireCheck('liveViewEntitlement', 'Live View entitlement has not been confirmed.');
      }
      if (feature.hints?.lifecycle !== undefined && feature.hints.lifecycle !== 'ongoing') {
        reject('Live View requires an ongoing lifecycle, not a static state or single event.');
      } else if (feature.hints?.lifecycle !== 'ongoing') {
        requireCheck('state.ongoingLifecycle', 'Confirm that the state has an ongoing business lifecycle.');
      }
      for (const key of ['startDefined', 'endDefined', 'realtime'] as const) {
        if (feature.hints?.[key] === false) {
          reject(`Live View requires state ${key}.`);
        } else if (feature.hints?.[key] !== true) {
          requireCheck(`state.${key}`, `Confirm state ${key} before creating a Live View mapping.`);
        }
      }
      if (feature.hints?.userAttention === 'low') {
        reject('The state does not have sufficient continuing user attention value.');
      } else if (feature.hints?.userAttention === undefined) {
        requireCheck('state.userAttention', 'Confirm that users benefit from tracking the ongoing state.');
      }
      item.reasons.push('STATE provides lifecycle states and terminal states for a host state mapping.');
      break;
    }
    case 'RESOURCE': {
      if (feature.hints?.existingLocalImplementation !== true) {
        reject('Service Collaboration requires an existing local resource implementation for fallback.');
      }
      if (feature.hints?.allowCrossDevice === false) {
        reject('The host feature explicitly disallows cross-device resource acquisition.');
      } else if (feature.hints?.allowCrossDevice !== true) {
        requireCheck('resource.allowCrossDevice', 'Confirm cross-device resource acquisition for this existing feature.');
      }
      if (!feature.hints?.fallback?.trim()) {
        requireCheck('originalLocalImplementationBinding', 'Bind the existing local implementation as the fallback before implementation.');
      }
      item.reasons.push(`RESOURCE requests the supported ${feature.contract.resourceType} operation.`);
      break;
    }
  }
  return item;
}

export function createPlan(manifest: FeatureManifest, target: TargetProfile, registry: CapabilityRegistry): EnhancementPlan {
  const validations = [validateManifest(manifest), validateTargetProfile(target), validateRegistry(registry)];
  const diagnostics = validations.flatMap((result) => result.diagnostics);
  if (validations.some((result) => !result.valid)) {
    throw new Error(diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`).join('\n'));
  }
  return {
    planVersion: '0.1',
    applicationId: manifest.application.id,
    target: structuredClone(target),
    items: manifest.features.map((feature) => planFeature(feature, manifest, target, registry)),
  };
}
