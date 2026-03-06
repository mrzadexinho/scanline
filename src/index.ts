// SARIF parsing
export { parseSarif, parseSarifFromObject, normalizeUri, deduplicateFindings, mergeSarifLogs, diffFindings, formatDiffReport } from './sarif/index.js';
export type { SarifLog, SarifRun, SarifResult, SarifRule, Finding, TriageVerdict, TriagedFinding, DiffResult } from './sarif/index.js';

// Semgrep integration
export { detectLanguagesFromFiles, selectRulesets, detectFrameworks, selectRulesetsWithFrameworks, buildScanCommand, checkSemgrepInstalled, checkSemgrepPro } from './semgrep/index.js';
export type { ScanConfig, ScanResult, Language, LanguageDetection, Framework, FrameworkDetection } from './semgrep/index.js';

// Triage engine
export { triageFinding, triageFindings, summarizeTriage } from './triage/index.js';
export type { TriageOptions, TriageSummary, TriageContext, TriageResult, TriageRule } from './triage/index.js';
