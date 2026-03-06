import { describe, it, expect } from 'vitest';
import { diffFindings, formatDiffReport } from '../../src/sarif/diff.js';
import type { Finding } from '../../src/sarif/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r1',
    level: 'warning',
    message: 'test',
    filePath: 'src/app.ts',
    startLine: 10,
    tool: 'test',
    confidence: 75,
    ...overrides,
  };
}

describe('diffFindings', () => {
  it('should identify new findings', () => {
    const baseline: Finding[] = [];
    const current = [makeFinding({ ruleId: 'new-rule', startLine: 5 })];

    const diff = diffFindings(baseline, current);
    expect(diff.newFindings).toHaveLength(1);
    expect(diff.fixedFindings).toHaveLength(0);
    expect(diff.unchangedFindings).toHaveLength(0);
    expect(diff.summary.new).toBe(1);
  });

  it('should identify fixed findings', () => {
    const baseline = [makeFinding({ ruleId: 'old-rule', startLine: 5 })];
    const current: Finding[] = [];

    const diff = diffFindings(baseline, current);
    expect(diff.newFindings).toHaveLength(0);
    expect(diff.fixedFindings).toHaveLength(1);
    expect(diff.summary.fixed).toBe(1);
  });

  it('should identify unchanged findings', () => {
    const finding = makeFinding();
    const baseline = [finding];
    const current = [{ ...finding }];

    const diff = diffFindings(baseline, current);
    expect(diff.unchangedFindings).toHaveLength(1);
    expect(diff.summary.unchanged).toBe(1);
  });

  it('should handle mixed changes', () => {
    const baseline = [
      makeFinding({ ruleId: 'stays', filePath: 'a.ts', startLine: 1 }),
      makeFinding({ ruleId: 'fixed', filePath: 'b.ts', startLine: 2 }),
    ];
    const current = [
      makeFinding({ ruleId: 'stays', filePath: 'a.ts', startLine: 1 }),
      makeFinding({ ruleId: 'new-one', filePath: 'c.ts', startLine: 3 }),
    ];

    const diff = diffFindings(baseline, current);
    expect(diff.newFindings).toHaveLength(1);
    expect(diff.newFindings[0].ruleId).toBe('new-one');
    expect(diff.fixedFindings).toHaveLength(1);
    expect(diff.fixedFindings[0].ruleId).toBe('fixed');
    expect(diff.unchangedFindings).toHaveLength(1);
  });

  it('should use fingerprint for matching when available', () => {
    const baseline = [makeFinding({ fingerprint: 'fp1', startLine: 10 })];
    // Same fingerprint but different line (code shifted)
    const current = [makeFinding({ fingerprint: 'fp1', startLine: 15 })];

    const diff = diffFindings(baseline, current);
    expect(diff.unchangedFindings).toHaveLength(1);
    expect(diff.newFindings).toHaveLength(0);
  });

  it('should handle empty inputs', () => {
    const diff = diffFindings([], []);
    expect(diff.summary.new).toBe(0);
    expect(diff.summary.fixed).toBe(0);
    expect(diff.summary.unchanged).toBe(0);
  });

  it('should report correct totals in summary', () => {
    const baseline = [
      makeFinding({ ruleId: 'a', startLine: 1 }),
      makeFinding({ ruleId: 'b', startLine: 2 }),
    ];
    const current = [
      makeFinding({ ruleId: 'b', startLine: 2 }),
      makeFinding({ ruleId: 'c', startLine: 3 }),
      makeFinding({ ruleId: 'd', startLine: 4 }),
    ];

    const diff = diffFindings(baseline, current);
    expect(diff.summary.baselineTotal).toBe(2);
    expect(diff.summary.currentTotal).toBe(3);
  });
});

describe('formatDiffReport', () => {
  it('should produce markdown report', () => {
    const diff = diffFindings(
      [makeFinding({ ruleId: 'fixed-rule', filePath: 'old.ts', startLine: 1 })],
      [makeFinding({ ruleId: 'new-rule', filePath: 'new.ts', startLine: 5 })]
    );

    const report = formatDiffReport(diff);
    expect(report).toContain('Scan Diff');
    expect(report).toContain('New Findings');
    expect(report).toContain('new-rule');
    expect(report).toContain('Fixed Findings');
    expect(report).toContain('fixed-rule');
  });

  it('should omit sections when empty', () => {
    const diff = diffFindings([], []);
    const report = formatDiffReport(diff);
    expect(report).not.toContain('New Findings');
    expect(report).not.toContain('Fixed Findings');
  });
});
