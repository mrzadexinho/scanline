export interface SarifLog {
  version: string;
  $schema?: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      version?: string;
      rules?: SarifRule[];
    };
    extensions?: Array<{
      name: string;
      version?: string;
    }>;
  };
  results: SarifResult[];
  artifacts?: SarifArtifact[];
}

export interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text: string };
  fullDescription?: { text: string };
  defaultConfiguration?: { level?: string };
  properties?: Record<string, unknown>;
}

export interface SarifResult {
  ruleId?: string;
  ruleIndex?: number;
  level?: 'error' | 'warning' | 'note' | 'none';
  message: { text: string };
  locations?: SarifLocation[];
  fingerprints?: Record<string, string>;
  partialFingerprints?: Record<string, string>;
  properties?: Record<string, unknown>;
}

export interface SarifLocation {
  physicalLocation?: {
    artifactLocation?: {
      uri?: string;
      uriBaseId?: string;
    };
    region?: {
      startLine?: number;
      startColumn?: number;
      endLine?: number;
      endColumn?: number;
      snippet?: { text: string };
    };
  };
}

export interface SarifArtifact {
  location?: {
    uri?: string;
  };
  length?: number;
  mimeType?: string;
}

export interface Finding {
  ruleId: string;
  level: 'error' | 'warning' | 'note' | 'none';
  message: string;
  filePath: string;
  startLine: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
  snippet?: string;
  fingerprint?: string;
  tool: string;
  confidence: number;
}

export type TriageVerdict = 'true_positive' | 'false_positive' | 'uncertain';

export interface TriagedFinding extends Finding {
  verdict: TriageVerdict;
  reason: string;
}
