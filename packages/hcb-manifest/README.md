# @hcb/manifest

The manifest package defines the stable, UI-free description of existing host
features. It validates the JSON Schema 2020-12 document in
`schemas/feature-manifest.schema.json`, then checks relationships that JSON Schema
cannot express directly: unique feature and input IDs, terminal-state membership,
source declarations, line ranges, and reviewed binary evidence.

`validateManifest(input)`, `parseManifest(source, "yaml" | "json")`, and
`loadManifest(path)` return a discriminated `ValidationResult<FeatureManifest>`.
Diagnostics carry a stable code, a JSON Pointer path for validation failures, and
a readable message. Loading errors use the supplied file path. Validation does
not mutate the input or apply defaults. Consumers interpret omitted
`application.sourceAvailability` as `source`.

ACTION requires structured `inputs` and `output`. STATE requires entity identity,
at least two declared states, and terminal states. RESOURCE supports
`camera_capture`, `document_scan`, and `gallery_pick`, with image/PDF output.
Contracts and hints are restricted per feature kind. Unknown fields are rejected
at each object boundary, including UI layouts and binary translation settings.

Source references distinguish source files from binaries and always declare the
source platform, architecture, and confidence. Binary evidence above 0.69 requires
`review.status: confirmed`. Low-confidence binary manifests remain valid for
inventory and manual review; validity alone never grants capability eligibility
or authorizes generation. Planner applies those restrictions separately.

The two examples in `examples/` preserve the specification fixtures. Tests cover
their compatibility as well as invalid contracts, unrecognized fields, cross-source
metadata, parsing failures, and binary review restrictions. HarmonyOS SDK APIs are
not called by this package.
