export type SourcePlatform = "android" | "ios" | "windows" | "linux" | "macos";
export type SourceArchitecture = "arm" | "arm64" | "x86" | "x86_64" | "c86" | "unknown";
export type ValueType = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
export type ResourceType = "camera_capture" | "document_scan" | "gallery_pick";

export interface SourceRef {
  platform: SourcePlatform;
  architecture: SourceArchitecture;
  language?: string;
  framework?: string;
  buildSystem?: string;
  file?: string;
  binary?: string;
  lineStart?: number;
  lineEnd?: number;
  evidence?: string;
  evidenceKind?: "ast" | "manual" | "import_or_string" | "metadata" | "build" | "symbol";
  confidence: number;
}

export interface FeatureReview {
  status: "confirmed" | "pending";
  confirmedBy?: string;
}

export interface ValueDescriptor {
  type: ValueType;
  description?: string;
}

export interface InputDescriptor extends ValueDescriptor {
  name: string;
  required?: boolean;
}

interface FeatureBase {
  id: string;
  title: string;
  sourceRefs?: SourceRef[];
  review?: FeatureReview;
}

export interface ActionFeature extends FeatureBase {
  kind: "ACTION";
  contract: {
    inputs: InputDescriptor[];
    output: ValueDescriptor;
    sideEffect?: boolean;
  };
  hints?: {
    userInvokable?: boolean;
    existingImplementation?: boolean;
    callable?: boolean;
    visualOnly?: boolean;
  };
}

export interface StateFeature extends FeatureBase {
  kind: "STATE";
  contract: {
    entityIdField: string;
    states: string[];
    terminalStates: string[];
    durationHintMinutes?: number;
  };
  hints?: {
    userAttention?: "low" | "medium" | "high";
    realtime?: boolean;
    externallyUpdated?: boolean;
    lifecycle?: "ongoing" | "static" | "instant";
    startDefined?: boolean;
    endDefined?: boolean;
    eligibilityConfirmed?: boolean;
  };
}

export interface ResourceFeature extends FeatureBase {
  kind: "RESOURCE";
  contract: {
    resourceType: ResourceType;
    acceptedOutputs: ("image" | "pdf")[];
    maxCount?: number;
  };
  hints?: {
    existingLocalImplementation?: boolean;
    allowCrossDevice?: boolean;
    fallback?: string;
  };
}

export type Feature = ActionFeature | StateFeature | ResourceFeature;

export interface FeatureManifest {
  schemaVersion: "0.1";
  application: {
    id: string;
    sourcePlatforms: SourcePlatform[];
    sourceArchitectures?: SourceArchitecture[];
    sourceAvailability?: "source" | "binary_only";
  };
  features: Feature[];
}

export interface Diagnostic {
  code: string;
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { valid: true; value: T; diagnostics: Diagnostic[] }
  | { valid: false; diagnostics: Diagnostic[] };
