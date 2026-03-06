export { parseSarif, parseSarifFromObject, normalizeUri, deduplicateFindings, mergeSarifLogs } from './parser.js';
export { diffFindings, formatDiffReport } from './diff.js';
export type { DiffResult } from './diff.js';
export type { SarifLog, SarifRun, SarifResult, SarifRule, SarifLocation, SarifArtifact, Finding, TriageVerdict, TriagedFinding } from './types.js';
