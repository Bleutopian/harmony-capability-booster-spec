# Implementation Plan

## Scope Of This Increment

Deliver the M0/M1/M2 foundation and the initial deterministic planner rules. Keep
the existing HarmonyOS host unchanged. Work on `feat/hcb-foundation`, preserving
the original host and archive in an initial baseline commit.

| Milestone | Status | Acceptance |
| --- | --- | --- |
| Baseline | Complete | Original host/archive committed; remote configured |
| Architecture | Complete | Six package boundaries, dependency direction, ADR and CI defined |
| M0 workspace | Complete | npm lockfile, strict project references, lint and Windows/Linux CI |
| M1 Manifest | Complete | Strict contracts, source metadata, examples and rejection tests |
| M2 CLI | Complete | init, manifest validate, plan, apply --dry-run, validate |
| Initial planner | Complete | Reasons, eligibility/fallback rules, experimental registry gates |
| Verification | Complete | Clean install, 135 tests, per-file coverage gates and host integrity checked |

## Next Increments

1. M3: Verify Huawei API signatures/device/API/entitlement constraints, persist
   official evidence, and promote only verified registry entries.
2. M4: Implement Intents templates, HAR wrapper, binding hooks and host patches.
   Add preview approval, apply, conflict detection, rollback and detach.
3. M5/M6: Add Live View and Service Collaboration with real fallback/device tests.
4. M7/M8: Add source analyzers, candidate review and cross-source fixtures.
5. M9: Run the manual-vs-HCB productivity experiment and complete V0.1 acceptance.

## Verification Record

Verified on Windows with Node.js 24.14.1 and npm 11.11.0:

- `npm ci`: reproducible install; dependency audit reported zero vulnerabilities.
- `npm run check`: TypeScript build/test type checks, ESLint and 135 tests passed.
- Coverage: 98.97% statements, 94.95% branches, 97.64% functions, 99.31% lines.
- Every measured implementation source file meets 80% statement/branch/function/line coverage thresholds.
- Generator snapshots, repeated dry-run equality, ownership conflicts, modified
  artifacts, redirected paths and explicit-undefined hash stability are tested.
- Public Planner inputs cannot bypass Stage or registry evidence requirements.
- CLI integration covers initialization, refusal to overwrite, invalid inputs,
  conditional/rejected plans, read-only previews and paths containing spaces.
- The actual supplied Stage host passes static inspection with explicit API
  verification warnings. No original host source/configuration differs from baseline.
- A Windows/Linux GitHub Actions workflow is configured; hosted CI results are
  separate from these local verification results.

Against `spec/acceptance/ACCEPTANCE_CHECKLIST.md`, this increment delivers strict
Manifest checks, initial Planner rules, review-document dry-run behavior and static
Validator checks. It does not complete adapter/Runtime acceptance, real apply
idempotency, rollback/detach, source analyzers, device tests or productivity POCs.
Compilation reports `skipped`: there are no generated platform artifacts yet.
