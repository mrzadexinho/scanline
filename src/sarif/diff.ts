import type { Finding } from './types.js';

export interface DiffResult {
  newFindings: Finding[];
  fixedFindings: Finding[];
  unchangedFindings: Finding[];
  summary: {
    new: number;
    fixed: number;
    unchanged: number;
    baselineTotal: number;
    currentTotal: number;
  };
}

export function diffFindings(baseline: Finding[], current: Finding[]): DiffResult {
  const baselineKeys = new Map<string, Finding>();
  const currentKeys = new Map<string, Finding>();

  for (const f of baseline) {
    baselineKeys.set(fingerprintKey(f), f);
  }
  for (const f of current) {
    currentKeys.set(fingerprintKey(f), f);
  }

  const newFindings: Finding[] = [];
  const fixedFindings: Finding[] = [];
  const unchangedFindings: Finding[] = [];

  // Findings in current but not in baseline = new
  for (const [key, finding] of currentKeys) {
    if (baselineKeys.has(key)) {
      unchangedFindings.push(finding);
    } else {
      newFindings.push(finding);
    }
  }

  // Findings in baseline but not in current = fixed
  for (const [key, finding] of baselineKeys) {
    if (!currentKeys.has(key)) {
      fixedFindings.push(finding);
    }
  }

  return {
    newFindings,
    fixedFindings,
    unchangedFindings,
    summary: {
      new: newFindings.length,
      fixed: fixedFindings.length,
      unchanged: unchangedFindings.length,
      baselineTotal: baseline.length,
      currentTotal: current.length,
    },
  };
}

function fingerprintKey(finding: Finding): string {
  // Prefer explicit fingerprint if available
  if (finding.fingerprint) {
    return finding.fingerprint;
  }

  // Fall back to rule + relative path + line content
  // Using rule + file + line is fragile (line numbers shift with edits)
  // But it's the best we can do without fingerprints
  return `${finding.ruleId}::${finding.filePath}::${finding.startLine}`;
}

export function formatDiffReport(diff: DiffResult): string {
  const lines: string[] = [];

  lines.push(`## Scan Diff`);
  lines.push(``);
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Baseline findings | ${diff.summary.baselineTotal} |`);
  lines.push(`| Current findings | ${diff.summary.currentTotal} |`);
  lines.push(`| **New (introduced)** | **${diff.summary.new}** |`);
  lines.push(`| Fixed (resolved) | ${diff.summary.fixed} |`);
  lines.push(`| Unchanged | ${diff.summary.unchanged} |`);

  if (diff.newFindings.length > 0) {
    lines.push(``);
    lines.push(`### New Findings`);
    for (const f of diff.newFindings) {
      lines.push(`- **[${f.level}]** \`${f.ruleId}\` at ${f.filePath}:${f.startLine} — ${f.message}`);
    }
  }

  if (diff.fixedFindings.length > 0) {
    lines.push(``);
    lines.push(`### Fixed Findings`);
    for (const f of diff.fixedFindings) {
      lines.push(`- ~~\`${f.ruleId}\` at ${f.filePath}:${f.startLine}~~ — ${f.message}`);
    }
  }

  return lines.join('\n');
}
