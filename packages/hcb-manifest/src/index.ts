import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { parseDocument } from "yaml";
import type { Diagnostic, FeatureManifest, ValidationResult } from "./types.js";

export type * from "./types.js";

const schema = JSON.parse(
  readFileSync(new URL("../../../schemas/feature-manifest.schema.json", import.meta.url), "utf8"),
) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateStructure = ajv.compile<FeatureManifest>(schema);

function pointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function schemaDiagnostic(error: ErrorObject): Diagnostic {
  const property: unknown = error.params["additionalProperty"] ?? error.params["missingProperty"];
  const path = typeof property === "string"
    ? `${error.instancePath}/${pointerSegment(property)}`
    : error.instancePath;
  return {
    code: "HCB_MANIFEST_SCHEMA",
    path,
    message: error.message ?? `Schema constraint failed: ${error.keyword}`,
  };
}

export function validateManifest(input: unknown): ValidationResult<FeatureManifest> {
  if (!validateStructure(input)) {
    return {
      valid: false,
      diagnostics: (validateStructure.errors ?? []).filter((error) => error.keyword !== "if").map(schemaDiagnostic),
    };
  }

  const diagnostics: Diagnostic[] = [];
  const featureIds = new Set<string>();
  const add = (code: string, path: string, message: string): void => {
    diagnostics.push({ code, path, message });
  };

  input.features.forEach((feature, featureIndex) => {
    const path = `/features/${featureIndex}`;
    if (featureIds.has(feature.id)) {
      add("HCB_DUPLICATE_FEATURE_ID", `${path}/id`, `Feature ID '${feature.id}' must be unique.`);
    }
    featureIds.add(feature.id);

    if (feature.kind === "ACTION") {
      const names = new Set<string>();
      feature.contract.inputs.forEach((parameter, index) => {
        if (names.has(parameter.name)) {
          add("HCB_DUPLICATE_INPUT_NAME", `${path}/contract/inputs/${index}/name`, `Input '${parameter.name}' must be unique within an ACTION.`);
        }
        names.add(parameter.name);
      });
    }

    if (feature.kind === "STATE") {
      feature.contract.terminalStates.forEach((state, index) => {
        if (!feature.contract.states.includes(state)) {
          add("HCB_UNKNOWN_TERMINAL_STATE", `${path}/contract/terminalStates/${index}`, `Terminal state '${state}' is not declared in states.`);
        }
      });
      if (feature.contract.states.every((state) => feature.contract.terminalStates.includes(state))) {
        add("HCB_STATE_NO_ACTIVE_STATE", `${path}/contract/states`, "STATE must include at least one non-terminal state.");
      }
    }

    feature.sourceRefs?.forEach((reference, index) => {
      const referencePath = `${path}/sourceRefs/${index}`;
      if (!input.application.sourcePlatforms.includes(reference.platform)) {
        add("HCB_UNDECLARED_SOURCE_PLATFORM", `${referencePath}/platform`, "Source reference platform must be declared by the application.");
      }
      if (input.application.sourceArchitectures && !input.application.sourceArchitectures.includes(reference.architecture)) {
        add("HCB_UNDECLARED_SOURCE_ARCHITECTURE", `${referencePath}/architecture`, "Source reference architecture must be declared by the application.");
      }
      if (reference.lineStart !== undefined && reference.lineEnd !== undefined && reference.lineEnd < reference.lineStart) {
        add("HCB_INVALID_SOURCE_LINE_RANGE", `${referencePath}/lineEnd`, "lineEnd must be greater than or equal to lineStart.");
      }
      if (input.application.sourceAvailability === "binary_only" && reference.file !== undefined) {
        add("HCB_BINARY_ONLY_SOURCE_REFERENCE", `${referencePath}/file`, "Binary-only input cannot claim source file evidence.");
      }
      if ((input.application.sourceAvailability === "binary_only" || reference.binary !== undefined)
          && reference.confidence > 0.69 && feature.review?.status !== "confirmed") {
        add("HCB_BINARY_EVIDENCE_REQUIRES_REVIEW", `${referencePath}/confidence`, "Binary evidence above 0.69 confidence requires a manually confirmed feature contract.");
      }
    });
  });

  return diagnostics.length === 0
    ? { valid: true, value: input, diagnostics }
    : { valid: false, diagnostics };
}

export function parseManifest(source: string, format: "yaml" | "json" = "yaml"): ValidationResult<FeatureManifest> {
  let input: unknown;
  try {
    if (format === "json") {
      input = JSON.parse(source) as unknown;
    } else {
      const document = parseDocument(source, { uniqueKeys: true, strict: true });
      const parsingIssues = [...document.errors, ...document.warnings];
      if (parsingIssues.length > 0) {
        return {
          valid: false,
          diagnostics: parsingIssues.map((error) => {
            const position = error.linePos?.[0];
            const location = position ? ` at line ${position.line}, column ${position.col}` : "";
            return {
              code: "HCB_MANIFEST_PARSE",
              path: "",
              message: `Invalid YAML (${error.code})${location}.`,
            };
          }),
        };
      }
      input = document.toJS({ maxAliasCount: 100 }) as unknown;
    }
  } catch {
    return {
      valid: false,
      diagnostics: [{
        code: "HCB_MANIFEST_PARSE",
        path: "",
        message: format === "json" ? "Invalid JSON syntax." : "Invalid YAML syntax or unsupported alias expansion.",
      }],
    };
  }
  return validateManifest(input);
}

export async function loadManifest(filePath: string): Promise<ValidationResult<FeatureManifest>> {
  const extension = extname(filePath).toLowerCase();
  if (![".json", ".yaml", ".yml"].includes(extension)) {
    return { valid: false, diagnostics: [{ code: "HCB_MANIFEST_FORMAT", path: filePath, message: "Manifest file must have a .json, .yaml or .yml extension." }] };
  }
  let source: string;
  try {
    source = await readFile(filePath, "utf8");
  } catch (error: unknown) {
    return {
      valid: false,
      diagnostics: [{ code: "HCB_MANIFEST_READ", path: filePath, message: error instanceof Error ? error.message : String(error) }],
    };
  }
  return parseManifest(source.replace(/^\uFEFF/, ""), extension === ".json" ? "json" : "yaml");
}
