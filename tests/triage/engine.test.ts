import { describe, it, expect } from 'vitest';
import { triageFinding, triageFindings, summarizeTriage } from '../../src/triage/engine.js';
import type { Finding, TriagedFinding } from '../../src/sarif/types.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'test-rule',
    level: 'warning',
    message: 'test message',
    filePath: 'src/app.ts',
    startLine: 10,
    tool: 'test',
    confidence: 75,
    ...overrides,
  };
}

describe('triageFinding', () => {
  it('should classify test file findings as false positive', () => {
    const finding = makeFinding({ filePath: 'tests/app.test.ts' });
    const result = triageFinding(finding, null);
    expect(result.verdict).toBe('false_positive');
    expect(result.reason).toContain('test');
  });

  it('should default to true positive for production code', () => {
    const finding = makeFinding({ filePath: 'src/auth.ts' });
    const source = 'function login() {\n  return authenticate();\n}\n';
    const result = triageFinding(finding, source);
    expect(result.verdict).toBe('true_positive');
  });

  it('should detect suppression comments', () => {
    const finding = makeFinding({ startLine: 2 });
    const source = 'line1\ncode() // nosemgrep\nline3';
    const result = triageFinding(finding, source);
    expect(result.verdict).toBe('false_positive');
  });

  it('should detect generated files', () => {
    const finding = makeFinding({ filePath: 'dist/bundle.js' });
    const result = triageFinding(finding, null);
    expect(result.verdict).toBe('false_positive');
  });

  it('should handle null source gracefully', () => {
    const finding = makeFinding();
    const result = triageFinding(finding, null);
    expect(result.verdict).toBe('true_positive');
  });

  it('should apply custom rules', () => {
    const customRule = {
      name: 'always-fp',
      check: () => ({
        verdict: 'false_positive' as const,
        reason: 'Custom rule triggered',
        confidence: 100,
      }),
    };

    const finding = makeFinding();
    const result = triageFinding(finding, null, { rules: [customRule] });
    expect(result.verdict).toBe('false_positive');
    expect(result.reason).toContain('Custom rule triggered');
  });
});

describe('triageFindings', () => {
  it('should triage multiple findings', () => {
    const findings = [
      makeFinding({ filePath: 'tests/test.ts' }),
      makeFinding({ filePath: 'src/app.ts' }),
      makeFinding({ filePath: 'dist/bundle.js' }),
    ];

    const triaged = triageFindings(findings);
    expect(triaged).toHaveLength(3);
    expect(triaged[0].verdict).toBe('false_positive');
    expect(triaged[1].verdict).toBe('true_positive');
    expect(triaged[2].verdict).toBe('false_positive');
  });

  it('should use sourceReader for source code', () => {
    const findings = [makeFinding({ filePath: 'src/app.ts', startLine: 1 })];
    const triaged = triageFindings(findings, {
      sourceReader: () => '// nosemgrep\nsome_code()',
    });
    expect(triaged[0].verdict).toBe('false_positive');
  });

  it('should cache source reads', () => {
    let readCount = 0;
    const findings = [
      makeFinding({ filePath: 'src/app.ts' }),
      makeFinding({ filePath: 'src/app.ts', startLine: 20 }),
    ];

    triageFindings(findings, {
      sourceReader: () => { readCount++; return 'code'; },
    });

    expect(readCount).toBe(1);
  });
});

describe('summarizeTriage', () => {
  it('should summarize triage results', () => {
    const triaged: TriagedFinding[] = [
      { ...makeFinding({ level: 'error', ruleId: 'r1' }), verdict: 'true_positive', reason: '' },
      { ...makeFinding({ level: 'error', ruleId: 'r1' }), verdict: 'true_positive', reason: '' },
      { ...makeFinding({ level: 'warning', ruleId: 'r2' }), verdict: 'true_positive', reason: '' },
      { ...makeFinding(), verdict: 'false_positive', reason: '' },
      { ...makeFinding(), verdict: 'uncertain', reason: '' },
    ];

    const summary = summarizeTriage(triaged);
    expect(summary.total).toBe(5);
    expect(summary.truePositives).toBe(3);
    expect(summary.falsePositives).toBe(1);
    expect(summary.uncertain).toBe(1);
    expect(summary.bySeverity['error']).toBe(2);
    expect(summary.bySeverity['warning']).toBe(1);
    expect(summary.byRule['r1']).toBe(2);
    expect(summary.byRule['r2']).toBe(1);
  });

  it('should handle empty input', () => {
    const summary = summarizeTriage([]);
    expect(summary.total).toBe(0);
    expect(summary.truePositives).toBe(0);
  });
});
