# HCB Development Instructions

Read `spec/AGENTS.md` and `spec/docs/04-capability-matrix.md` before implementation.
The original specification is preserved in `spec/`. Apply its product boundaries
to all packages in this repository. Track implementation decisions in `docs/adr/`.

- Only enhance existing ACTION, STATE and RESOURCE business features.
- Never migrate UI, rewrite host business logic or infer binary compatibility.
- Keep source architecture separate from HarmonyOS target ABI.
- Preview all host patches; generation must be deterministic and reversible.
- Verify Huawei APIs before implementing adapters. Unverified registry entries
  remain experimental and cannot enable platform code generation.
- Keep the existing `entry/` and `AppScope/` host separate from the Node toolchain.
- Use TypeScript ESM, explicit contracts and structured JSON/YAML parsers.
- Run `npm run check` before committing implementation changes.
- Test schema rejection, planner rejection, unsupported targets and deterministic
  previews. Do not claim device or compiler validation when it was not performed.
- Update `docs/IMPLEMENTATION_PLAN.md` and `CHANGELOG.md` for each milestone.
- Keep commits scoped. Do not commit local SDK paths, credentials or build output.
