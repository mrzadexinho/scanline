import type { Finding, TriagedFinding } from '../sarif/types.js';
import type { TriageResult, TriageContext, TriageRule } from './types.js';
import { defaultTriageRules } from './rules.js';

export interface TriageOptions {
  rules?: TriageRule[];
  surroundingLines?: number;
  sourceReader?: (filePath: string) => string | null;
}

export function triageFinding(
  finding: Finding,
  source: string | null,
  options: TriageOptions = {}
): TriageResult {
  const rules = options.rules ?? defaultTriageRules;
  const surroundingLines = options.surroundingLines ?? 10;

  const sourceLines = source ? source.split('\n') : [];

  const context: TriageContext = {
    finding,
    sourceLines,
    surroundingLines,
  };

  // Apply rules in order — first match wins
  for (const rule of rules) {
    const result = rule.check(context);
    if (result) {
      return {
        finding,
        verdict: result.verdict,
        reason: `[${rule.name}] ${result.reason}`,
        confidence: result.confidence,
      };
    }
  }

  // Default: true positive (conservative — false negatives are worse)
  return {
    finding,
    verdict: 'true_positive',
    reason: 'No false positive indicators found',
    confidence: finding.confidence,
  };
}

export function triageFindings(
  findings: Finding[],
  options: TriageOptions = {}
): TriagedFinding[] {
  const sourceReader = options.sourceReader ?? (() => null);
  const sourceCache = new Map<string, string | null>();

  return findings.map(finding => {
    let source = sourceCache.get(finding.filePath);
    if (source === undefined) {
      source = sourceReader(finding.filePath);
      sourceCache.set(finding.filePath, source);
    }

    const result = triageFinding(finding, source, options);

    return {
      ...finding,
      verdict: result.verdict,
      reason: result.reason,
      confidence: result.confidence,
    };
  });
}

export function summarizeTriage(triaged: TriagedFinding[]): TriageSummary {
  const truePositives = triaged.filter(t => t.verdict === 'true_positive');
  const falsePositives = triaged.filter(t => t.verdict === 'false_positive');
  const uncertain = triaged.filter(t => t.verdict === 'uncertain');

  const bySeverity: Record<string, number> = {};
  for (const tp of truePositives) {
    bySeverity[tp.level] = (bySeverity[tp.level] ?? 0) + 1;
  }

  const byRule: Record<string, number> = {};
  for (const tp of truePositives) {
    byRule[tp.ruleId] = (byRule[tp.ruleId] ?? 0) + 1;
  }

  return {
    total: triaged.length,
    truePositives: truePositives.length,
    falsePositives: falsePositives.length,
    uncertain: uncertain.length,
    bySeverity,
    byRule,
  };
}

export interface TriageSummary {
  total: number;
  truePositives: number;
  falsePositives: number;
  uncertain: number;
  bySeverity: Record<string, number>;
  byRule: Record<string, number>;
}
