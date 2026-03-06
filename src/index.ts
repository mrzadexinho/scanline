// SARIF parsing
export { parseSarif, parseSarifFromObject, normalizeUri, deduplicateFindings, mergeSarifLogs } from './sarif/index.js';
export type { SarifLog, SarifRun, SarifResult, SarifRule, Finding, TriageVerdict, TriagedFinding } from './sarif/index.js';

// Semgrep integration
export { detectLanguagesFromFiles, selectRulesets, buildScanCommand, checkSemgrepInstalled, checkSemgrepPro } from './semgrep/index.js';
export type { ScanConfig, ScanResult, Language, LanguageDetection } from './semgrep/index.js';

// Triage engine
export { triageFinding, triageFindings, summarizeTriage } from './triage/index.js';
export type { TriageOptions, TriageSummary, TriageContext, TriageResult, TriageRule } from './triage/index.js';
