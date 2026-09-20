# Changelog

## 0.1.0 Foundation - 2026-09-21

- Preserve the initial HarmonyOS host and source specification in version control.
- Define a separate TypeScript workspace and CLI architecture with strict package boundaries.
- Track the M0/M1/M2 implementation separately from full V0.1 platform integration.
- Add six npm workspace packages: Manifest, Registry, Planner, Generator, Validator and CLI.
- Validate strict ACTION/STATE/RESOURCE contracts, source provenance and binary-only review.
- Add explicit target/device/API metadata and experimental capability/toolchain registries.
- Produce explainable recommendations, conditional decisions and rejections with global Stage enforcement.
- Implement `init`, `manifest validate`, `plan`, `apply --dry-run` and `validate`.
- Preview deterministic review artifacts with unified diffs, ownership checks and content hashes.
- Inspect HarmonyOS Stage/device/API/Native metadata without modifying the host application.
- Add Windows/Linux CI, deterministic snapshots and 135 tests; enforce 80% per-file coverage gates.

### Known Limitations

- Official API verification and real HarmonyOS adapters/Runtime HAR are pending.
- Only read-only apply previews are implemented; apply/rollback/detach are future work.
- Compiler, device, analyzer and productivity acceptance are not claimed by this milestone.
