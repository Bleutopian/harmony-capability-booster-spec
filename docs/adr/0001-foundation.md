# ADR-0001: Add a CLI workspace beside the HarmonyOS host

- Status: Accepted
- Date: 2026-09-21

## Context

The repository starts with a HarmonyOS Hello World Stage host and a specification
archive. The specified product is a CLI toolchain; implementing it inside an ArkUI
page would mix development tooling with the host business application. The archive
schema leaves contracts and source references open, despite requiring UI rejection.

## Decision

Use npm workspaces, TypeScript ESM project references, AJV 2020-12, YAML, Commander
and Vitest. Preserve the supplied specification byte-for-byte under `spec/` and
maintain implementation schemas in `schemas/`. Complete strict feature contracts
using the supplied examples and documented feature semantics. Keep the existing
Hvigor application in place as an integration host.

Implement M0/M1/M2 as a manual-manifest workflow, including initial rule planning.
Capability entries remain experimental until official API evidence is independently
verified. Dry-run previews contain reviewable plan and binding-contract documents;
they do not claim that a platform adapter has been implemented. Reject a real apply
request explicitly. An empty manifest is a valid initialization state but produces
a readiness warning and no proposed enhancement.

Use target profiles with canonical `phone`, `tablet`, `pc` device values and an
explicit integer API level. Normalize host `2in1` to `pc` only in host inspection.
Do not infer API level from an SDK marketing version or from source architecture.

## Alternatives

- Build the tool inside the existing HAP: rejected because development-machine IO
  and source analysis are separate from HarmonyOS runtime behavior.
- Create all planned packages as stubs: deferred until an implementation exists.
- Mark registry entries stable from the source spec: rejected because sample
  evidence does not establish current API signatures or support conditions.

## Consequences

The CLI can be built and tested without DevEco. The repository has two independent
build systems. M2 proves schema/planning/review workflows, but not real HarmonyOS
capability integration. API research and Runtime HAR work remain M3-M6 tasks.

## Acceptance Impact

M0/M1/M2 checks are tracked separately from full V0.1 acceptance. Repeated dry-run
equality is tested now; real apply idempotency and rollback are not reported as done.
