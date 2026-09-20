import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  loadManifest,
  parseManifest,
  validateManifest,
  type ActionFeature,
  type FeatureManifest,
  type SourceArchitecture,
  type SourcePlatform,
  type SourceRef,
  type StateFeature,
} from "../packages/hcb-manifest/src/index.js";

const examplePath = (name: string): string => fileURLToPath(new URL(`../examples/${name}`, import.meta.url));

function action(): ActionFeature {
  return {
    id: "queryOrder",
    kind: "ACTION",
    title: "Query order",
    contract: { inputs: [{ name: "orderId", type: "string", required: true }], output: { type: "object" } },
    hints: { userInvokable: true },
  };
}

function manifest(feature = action()): FeatureManifest {
  return { schemaVersion: "0.1", application: { id: "com.example.orders", sourcePlatforms: ["linux"] }, features: [feature] };
}

function state(): StateFeature {
  return {
    id: "orderProgress",
    kind: "STATE",
    title: "Order progress",
    contract: { entityIdField: "orderId", states: ["WAITING", "FINISHED"], terminalStates: ["FINISHED"] },
  };
}

function sourceRef(): SourceRef {
  return { platform: "linux", architecture: "c86", file: "src/order.cpp", lineStart: 10, lineEnd: 20, confidence: 0.94 };
}

describe("manifest fixtures", () => {
  it.each(["appointment.feature.yaml", "native-desktop.feature.yaml"])("accepts specification example %s", async (name) => {
    const result = await loadManifest(examplePath(name));
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("preserves JSON values without applying defaults or mutating input", () => {
    const input = manifest();
    const before = structuredClone(input);
    const result = parseManifest(JSON.stringify(input), "json");
    expect(result).toEqual({ valid: true, value: input, diagnostics: [] });
    expect(validateManifest(input).valid).toBe(true);
    expect(input).toEqual(before);
    expect(input.application.sourceAvailability).toBeUndefined();
  });

  it.each<[SourcePlatform, SourceArchitecture]>([
    ["android", "arm64"], ["ios", "arm64"], ["windows", "x86_64"], ["linux", "c86"], ["macos", "arm64"], ["linux", "unknown"],
  ])("accepts %s / %s as provenance", (platform, architecture) => {
    const input = manifest();
    input.application.sourcePlatforms = [platform];
    input.application.sourceArchitectures = [architecture];
    const feature = action();
    feature.sourceRefs = [{ ...sourceRef(), platform, architecture }];
    input.features = [feature];
    expect(validateManifest(input).valid).toBe(true);
  });
});

describe("strict feature contracts", () => {
  it.each(["layout", "uiHierarchy", "style", "targetMachineCodeTranslation"])("rejects %s at all extensible object boundaries", (field) => {
    const base = manifest();
    const feature = action();
    const candidates: unknown[] = [
      { ...base, [field]: {} },
      { ...base, application: { ...base.application, [field]: {} } },
      { ...base, features: [{ ...feature, [field]: {} }] },
      { ...base, features: [{ ...feature, contract: { ...feature.contract, [field]: {} } }] },
      { ...base, features: [{ ...feature, hints: { [field]: {} } }] },
      { ...base, features: [{ ...feature, sourceRefs: [{ ...sourceRef(), [field]: {} }] }] },
      { ...base, features: [{ ...feature, contract: { ...feature.contract, output: { type: "object", [field]: {} } } }] },
    ];
    for (const input of candidates) {
      const result = validateManifest(input);
      expect(result.valid).toBe(false);
      expect(result.diagnostics.some((diagnostic) => diagnostic.path.endsWith(`/${field}`))).toBe(true);
    }
  });

  it("rejects branch-specific contracts and hints on another feature kind", () => {
    const feature = action();
    expect(validateManifest(manifest({ ...feature, contract: {} } as ActionFeature)).valid).toBe(false);
    expect(validateManifest({ ...manifest(), features: [{ ...feature, hints: { realtime: true } }] }).valid).toBe(false);
    expect(validateManifest({ ...manifest(), features: [{ ...feature, kind: "RESOURCE" }] }).valid).toBe(false);
  });

  it("rejects unsupported resource types and invalid output counts", () => {
    const resource = { id: "scan", kind: "RESOURCE", title: "Scan", contract: { resourceType: "document_scan", acceptedOutputs: ["image", "pdf"], maxCount: 2 } };
    expect(validateManifest({ ...manifest(), features: [resource] }).valid).toBe(true);
    for (const override of [{ resourceType: "nfc" }, { acceptedOutputs: [] }, { maxCount: 0 }, { maxCount: 1.5 }]) {
      expect(validateManifest({ ...manifest(), features: [{ ...resource, contract: { ...resource.contract, ...override } }] }).valid).toBe(false);
    }
  });

  it("reports duplicate feature IDs and input names with useful paths", () => {
    const feature = action();
    feature.contract.inputs.push({ name: "orderId", type: "string" });
    const result = validateManifest({ ...manifest(), features: [feature, action()] });
    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "HCB_DUPLICATE_INPUT_NAME", path: "/features/0/contract/inputs/1/name" }),
      expect.objectContaining({ code: "HCB_DUPLICATE_FEATURE_ID", path: "/features/1/id" }),
    ]));
  });

  it("requires terminal states to exist and retains a non-terminal state", () => {
    const feature = state();
    const input = { ...manifest(), features: [feature] };
    expect(validateManifest(input).valid).toBe(true);
    feature.contract.terminalStates = ["MISSING"];
    expect(validateManifest(input).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_UNKNOWN_TERMINAL_STATE" }));
    feature.contract.terminalStates = ["WAITING", "FINISHED"];
    expect(validateManifest(input).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_STATE_NO_ACTIVE_STATE" }));
    feature.contract.terminalStates = [];
    expect(validateManifest(input).valid).toBe(false);
  });

  it("rejects nonfinite confidence and whitespace identifiers", () => {
    for (const confidence of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.01]) {
      expect(validateManifest(manifest({ ...action(), sourceRefs: [{ ...sourceRef(), confidence }] })).valid).toBe(false);
    }
    expect(validateManifest(manifest({ ...action(), id: "  " })).valid).toBe(false);
  });
});

describe("source evidence", () => {
  it("rejects descending line ranges and mismatched provenance declarations", () => {
    const input = manifest({ ...action(), sourceRefs: [{ ...sourceRef(), lineStart: 30 }] });
    input.application.sourcePlatforms = ["windows"];
    input.application.sourceArchitectures = ["arm64"];
    const result = validateManifest(input);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(expect.arrayContaining([
      "HCB_INVALID_SOURCE_LINE_RANGE", "HCB_UNDECLARED_SOURCE_PLATFORM", "HCB_UNDECLARED_SOURCE_ARCHITECTURE",
    ]));
  });

  it("requires platform, architecture, confidence and a single source location", () => {
    const reference = sourceRef();
    for (const property of ["platform", "architecture", "confidence", "file", "lineEnd"] as const) {
      const candidate: Record<string, unknown> = { ...reference };
      delete candidate[property];
      expect(validateManifest({ ...manifest(), features: [{ ...action(), sourceRefs: [candidate] }] }).valid).toBe(false);
    }
    expect(validateManifest(manifest({ ...action(), sourceRefs: [{ ...reference, binary: "app.exe" }] })).valid).toBe(false);
  });

  it("keeps unreviewed binary inventory valid but requires review for high confidence", () => {
    const feature = action();
    feature.sourceRefs = [{ platform: "linux", architecture: "x86_64", binary: "app", evidenceKind: "import_or_string", confidence: 0.69 }];
    const input = manifest(feature);
    input.application.sourceAvailability = "binary_only";
    expect(validateManifest(input).valid).toBe(true);
    feature.sourceRefs[0]!.confidence = 0.9;
    expect(validateManifest(input).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_BINARY_EVIDENCE_REQUIRES_REVIEW" }));
    feature.review = { status: "pending" };
    expect(validateManifest(input).valid).toBe(false);
    feature.review = { status: "confirmed", confirmedBy: "developer" };
    expect(validateManifest(input).valid).toBe(true);
  });

  it("applies binary confidence limits to binary references in mixed source input", () => {
    const input = manifest({ ...action(), sourceRefs: [{ platform: "linux", architecture: "unknown", binary: "vendor.so", confidence: 0.8 }] });
    expect(validateManifest(input).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_BINARY_EVIDENCE_REQUIRES_REVIEW" }));
  });

  it("does not allow a binary-only manifest to claim source evidence", () => {
    const input = manifest({ ...action(), sourceRefs: [sourceRef()] });
    input.application.sourceAvailability = "binary_only";
    expect(validateManifest(input).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_BINARY_ONLY_SOURCE_REFERENCE" }));
  });
});

describe("parsing and loading", () => {
  it("reports duplicate YAML keys and malformed JSON", () => {
    expect(parseManifest('schemaVersion: "0.1"\nschemaVersion: "0.2"').diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_MANIFEST_PARSE" }));
    expect(parseManifest('{"schemaVersion":', "json").diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_MANIFEST_PARSE" }));
    expect(parseManifest("").valid).toBe(false);
    expect(parseManifest("null", "json").valid).toBe(false);
  });

  it("does not expose source text in parser diagnostics", () => {
    const secret = "secret-token-must-not-appear";
    const yaml = parseManifest(`key: ${secret}\nkey: duplicate`);
    const json = parseManifest(`{"key":"${secret}" trailing}`, "json");
    expect(yaml.valid).toBe(false);
    expect(json.valid).toBe(false);
    expect(JSON.stringify(yaml.diagnostics)).not.toContain(secret);
    expect(JSON.stringify(json.diagnostics)).not.toContain(secret);
    expect(yaml.diagnostics[0]?.message).toContain("line 2");
  });

  it("rejects unsupported YAML tags rather than accepting parser recovery", () => {
    const input = JSON.stringify(manifest()).replace('"0.1"', '!untrusted "0.1"');
    expect(parseManifest(input).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_MANIFEST_PARSE" }));
  });

  it("rejects multiple YAML documents", async () => {
    const source = await readFile(examplePath("appointment.feature.yaml"), "utf8");
    expect(parseManifest(`${source}\n---\n${source}`).valid).toBe(false);
  });

  it("returns explicit diagnostics for unsupported formats and missing files", async () => {
    expect((await loadManifest("manifest.txt")).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_MANIFEST_FORMAT" }));
    expect((await loadManifest(examplePath("does-not-exist.yaml"))).diagnostics).toContainEqual(expect.objectContaining({ code: "HCB_MANIFEST_READ" }));
  });
});
