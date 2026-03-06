import type { Finding, TriageVerdict } from '../sarif/types.js';

export interface TriageContext {
  finding: Finding;
  sourceLines: string[];
  surroundingLines: number;
}

export interface TriageResult {
  finding: Finding;
  verdict: TriageVerdict;
  reason: string;
  confidence: number;
}

export type TriageRule = {
  name: string;
  check: (context: TriageContext) => TriageRuleResult | null;
};

export type TriageRuleResult = {
  verdict: TriageVerdict;
  reason: string;
  confidence: number;
};
