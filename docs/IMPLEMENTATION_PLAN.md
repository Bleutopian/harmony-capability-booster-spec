# Implementation Plan

## Scope Of This Increment

Deliver the M0/M1/M2 foundation and the initial deterministic planner rules. Keep
the existing HarmonyOS host unchanged. Work on `feat/hcb-foundation`, preserving
the original host and archive in an initial baseline commit.

| Milestone | Status | Acceptance |
| --- | --- | --- |
| Baseline | Complete | Original host/archive committed; remote configured |
| Architecture | In progress | Package boundaries, dependency direction, ADR and CI defined |
| M0 workspace | In progress | Reproducible install, strict build, lint and tests |
| M1 Manifest | In progress | Strict contracts, source metadata, examples and rejection tests |
| M2 CLI | In progress | init, manifest validate, plan, apply --dry-run, validate |
| Initial planner | In progress | Reasons, eligibility/fallback rules, experimental registry gates |
| Verification | Pending | Integration, preview repeatability, coverage and host integrity |

## Next Increments

1. M3: Verify Huawei API signatures/device/API/entitlement constraints, persist
   official evidence, and promote only verified registry entries.
2. M4: Implement Intents templates, HAR wrapper, binding hooks and host patches.
   Add preview approval, apply, conflict detection, rollback and detach.
3. M5/M6: Add Live View and Service Collaboration with real fallback/device tests.
4. M7/M8: Add source analyzers, candidate review and cross-source fixtures.
5. M9: Run the manual-vs-HCB productivity experiment and complete V0.1 acceptance.

## Verification Record

Pending implementation checks. No real API, host compilation, cross-device or
productivity acceptance is claimed by the foundation milestone.
