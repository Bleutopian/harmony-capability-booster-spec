# Project Validator

`validateProject(manifest, target, registry, hostRoot?)` revalidates the input
contracts, creates a plan and returns structured errors, warnings and the plan.
Rejected plan items fail validation; conditional items remain explicit warnings.

When a host directory is supplied, the validator reads only these JSON5 metadata
files: root `build-profile.json5`, `entry/src/main/module.json5`,
`entry/oh-package.json5`, and optional `entry/build-profile.json5`. It checks Stage
entry declarations, host devices, numeric SDK metadata and declared Native ABI
filters. `2in1` maps to the target device `pc`. It does not infer API levels from
marketing SDK version strings or target ABI compatibility from source CPU names.
File errors never include parser source fragments or signing metadata.

This milestone generates no platform artifacts. Every report explicitly marks
`compile_check` as `skipped`; a metadata pass is not a HarmonyOS build, Runtime
HAR integration check or device test. Host files are never modified.
