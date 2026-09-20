# Harmony Capability Booster

HCB enhances existing mobile and desktop business features with HarmonyOS
capabilities. It does not migrate UI, rewrite business logic or translate binaries.

This repository contains the first working CLI foundation (M0/M1/M2): strict
feature manifests, capability metadata, explainable planning, read-only patch
previews and static host validation. The original HarmonyOS Stage application
remains at `entry/` and can be opened separately in DevEco Studio.

## Development

Requirements: Node.js 24 or newer and npm. DevEco is not required for CLI checks.

```sh
npm ci
npm run build
npm run check
npm run hcb -- --help
```

`npm run check` runs TypeScript checks, ESLint and Vitest coverage. CI runs the same
checks on Windows and Linux. Workspace dependencies are pinned by `package-lock.json`.

## Try The Existing Examples

```sh
npm run hcb -- manifest validate examples/native-desktop.feature.yaml
npm run hcb -- plan --manifest examples/native-desktop.feature.yaml --target examples/desktop.target.yaml
npm run hcb -- apply --dry-run --manifest examples/native-desktop.feature.yaml --target examples/desktop.target.yaml --project .
npm run hcb -- validate --manifest examples/native-desktop.feature.yaml --target examples/desktop.target.yaml --project .
```

The supplied registry is intentionally experimental: no current Huawei API has
been independently verified in this milestone. Eligible features therefore remain
`conditional` and list their required checks. A PC Live View request is rejected.
The example API level is illustrative; select the actual level for your target.

Command results are JSON on stdout. For scripts without npm's command banner, use
`node packages/hcb-cli/dist/index.js ...`. Exit codes are `0` for a successful
command (conditional results may still need review), `1` for validation rejection
or preview conflict, and `2` for invalid arguments/input or operational errors.

## Start A Manifest

```sh
npm run hcb -- init ./my-integration --app-id com.example.existingapp --platform windows --source-arch x86_64 --device pc --api 24
```

Initialization creates `hcb.feature.yaml` and `hcb.target.yaml`, refuses overwrites
and starts with no features. Describe only existing business actions, states or
resources. The examples show the required contracts. Source architecture never
sets a HarmonyOS build ABI. Binary-only evidence requires explicit feature review.

The three feature kinds map to:

| Feature | Planned capability | Required business evidence |
| --- | --- | --- |
| ACTION | Intents | Existing callable action and structured inputs/outputs |
| STATE | Live View | Ongoing dynamic lifecycle, clear start/end, device and entitlement eligibility |
| RESOURCE | Service Collaboration | Existing camera/scan/gallery operation and original local fallback |

## Preview And Validation Boundaries

`apply --dry-run` returns unified diffs for two proposed review documents:
`.hcb/generated/enhancement-plan.json` and `.hcb/generated/binding-contracts.json`.
It writes nothing. Documents carry ownership and a content hash; edited, detached
or unowned files produce conflicts. Repeated previews are deterministic. An empty
manifest has no generated artifacts. Host business/UI files are never preview targets.

Real `apply` is deliberately unavailable until platform adapters, host configuration
patching, approval, rollback and detach are implemented. There is no Runtime HAR or
generated ArkTS adapter yet. `validate` checks Stage metadata, devices, explicit API
compatibility and Native ABI declarations, and reports `compile_check: skipped`
because this increment generates no platform code. Static success is not a claim
of HarmonyOS build, entitlement or real-device acceptance.

## Repository Guide

- [Architecture and package boundaries](docs/ARCHITECTURE.md)
- [Architecture decision](docs/adr/0001-foundation.md)
- [Implementation plan and verification](docs/IMPLEMENTATION_PLAN.md)
- [Changelog](CHANGELOG.md)
- [Original specification](spec/README.md)
- [Complete V0.1 acceptance checklist](spec/acceptance/ACCEPTANCE_CHECKLIST.md)

The next increment is official API verification and an Intents adapter with
reviewable host patches. Live View, Service Collaboration, analyzers and device
acceptance follow the milestone order in the original specification.
