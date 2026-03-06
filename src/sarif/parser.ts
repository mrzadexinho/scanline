import type { SarifLog, SarifResult, SarifRun, Finding } from './types.js';

export function parseSarif(input: string): Finding[] {
  const log = JSON.parse(input) as SarifLog;
  validateSarifLog(log);

  const findings: Finding[] = [];

  for (const run of log.runs) {
    const toolName = run.tool.driver.name;
    const ruleMap = buildRuleMap(run);

    for (const result of run.results) {
      findings.push(resultToFinding(result, toolName, ruleMap));
    }
  }

  return findings;
}

export function parseSarifFromObject(log: SarifLog): Finding[] {
  validateSarifLog(log);

  const findings: Finding[] = [];

  for (const run of log.runs) {
    const toolName = run.tool.driver.name;
    const ruleMap = buildRuleMap(run);

    for (const result of run.results) {
      findings.push(resultToFinding(result, toolName, ruleMap));
    }
  }

  return findings;
}

function validateSarifLog(log: SarifLog): void {
  if (!log.version) {
    throw new Error('Invalid SARIF: missing version');
  }
  if (!Array.isArray(log.runs)) {
    throw new Error('Invalid SARIF: missing runs array');
  }
}

function buildRuleMap(run: SarifRun): Map<string, { level?: string }> {
  const map = new Map<string, { level?: string }>();
  const rules = run.tool.driver.rules ?? [];
  for (const rule of rules) {
    map.set(rule.id, {
      level: rule.defaultConfiguration?.level,
    });
  }
  return map;
}

function resultToFinding(
  result: SarifResult,
  toolName: string,
  ruleMap: Map<string, { level?: string }>
): Finding {
  const loc = result.locations?.[0]?.physicalLocation;
  const region = loc?.region;
  const ruleId = result.ruleId ?? 'unknown';

  const level = resolveLevel(result.level, ruleId, ruleMap);
  const fingerprint = extractFingerprint(result);

  return {
    ruleId,
    level,
    message: result.message?.text ?? '',
    filePath: normalizeUri(loc?.artifactLocation?.uri ?? 'unknown'),
    startLine: region?.startLine ?? 0,
    endLine: region?.endLine,
    startColumn: region?.startColumn,
    endColumn: region?.endColumn,
    snippet: region?.snippet?.text,
    fingerprint,
    tool: toolName,
    confidence: levelToConfidence(level),
  };
}

function resolveLevel(
  resultLevel: string | undefined,
  ruleId: string,
  ruleMap: Map<string, { level?: string }>
): Finding['level'] {
  const level = resultLevel ?? ruleMap.get(ruleId)?.level ?? 'warning';
  if (['error', 'warning', 'note', 'none'].includes(level)) {
    return level as Finding['level'];
  }
  return 'warning';
}

function extractFingerprint(result: SarifResult): string | undefined {
  if (result.partialFingerprints) {
    const values = Object.values(result.partialFingerprints);
    if (values.length > 0) return values[0];
  }
  if (result.fingerprints) {
    const values = Object.values(result.fingerprints);
    if (values.length > 0) return values[0];
  }
  return undefined;
}

export function normalizeUri(uri: string): string {
  if (uri.startsWith('file://')) {
    uri = uri.slice(7);
  }
  return decodeURIComponent(uri);
}

function levelToConfidence(level: Finding['level']): number {
  switch (level) {
    case 'error': return 90;
    case 'warning': return 75;
    case 'note': return 60;
    case 'none': return 40;
  }
}

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const unique: Finding[] = [];

  for (const f of findings) {
    const key = f.fingerprint ?? `${f.ruleId}:${f.filePath}:${f.startLine}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(f);
    }
  }

  return unique;
}

export function mergeSarifLogs(...inputs: string[]): Finding[] {
  const allFindings: Finding[] = [];
  for (const input of inputs) {
    allFindings.push(...parseSarif(input));
  }
  return deduplicateFindings(allFindings);
}
