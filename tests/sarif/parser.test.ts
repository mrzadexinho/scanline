import { describe, it, expect } from 'vitest';
import { parseSarif, normalizeUri, deduplicateFindings, mergeSarifLogs } from '../../src/sarif/parser.js';

const minimalSarif = JSON.stringify({
  version: '2.1.0',
  runs: [{
    tool: { driver: { name: 'test-tool', rules: [] } },
    results: [{
      ruleId: 'rule-001',
      level: 'error',
      message: { text: 'Found a vulnerability' },
      locations: [{
        physicalLocation: {
          artifactLocation: { uri: 'src/app.ts' },
          region: { startLine: 10, startColumn: 5, endLine: 10, endColumn: 20 },
        },
      }],
    }],
  }],
});

describe('parseSarif', () => {
  it('should parse minimal SARIF', () => {
    const findings = parseSarif(minimalSarif);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('rule-001');
    expect(findings[0].level).toBe('error');
    expect(findings[0].message).toBe('Found a vulnerability');
    expect(findings[0].filePath).toBe('src/app.ts');
    expect(findings[0].startLine).toBe(10);
    expect(findings[0].tool).toBe('test-tool');
  });

  it('should assign confidence based on level', () => {
    const findings = parseSarif(minimalSarif);
    expect(findings[0].confidence).toBe(90); // error = 90
  });

  it('should handle multiple results', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'scanner' } },
        results: [
          { ruleId: 'r1', level: 'error', message: { text: 'msg1' } },
          { ruleId: 'r2', level: 'warning', message: { text: 'msg2' } },
          { ruleId: 'r3', level: 'note', message: { text: 'msg3' } },
        ],
      }],
    });

    const findings = parseSarif(sarif);
    expect(findings).toHaveLength(3);
    expect(findings[0].confidence).toBe(90);
    expect(findings[1].confidence).toBe(75);
    expect(findings[2].confidence).toBe(60);
  });

  it('should handle multiple runs', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [
        { tool: { driver: { name: 'tool-a' } }, results: [{ ruleId: 'a1', message: { text: 'from A' } }] },
        { tool: { driver: { name: 'tool-b' } }, results: [{ ruleId: 'b1', message: { text: 'from B' } }] },
      ],
    });

    const findings = parseSarif(sarif);
    expect(findings).toHaveLength(2);
    expect(findings[0].tool).toBe('tool-a');
    expect(findings[1].tool).toBe('tool-b');
  });

  it('should extract fingerprints from partialFingerprints', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'scanner' } },
        results: [{
          ruleId: 'r1',
          message: { text: 'msg' },
          partialFingerprints: { primaryLocationLineHash: 'abc123' },
        }],
      }],
    });

    const findings = parseSarif(sarif);
    expect(findings[0].fingerprint).toBe('abc123');
  });

  it('should extract snippet text', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'scanner' } },
        results: [{
          ruleId: 'r1',
          message: { text: 'msg' },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: 'file.py' },
              region: { startLine: 5, snippet: { text: 'dangerous_call()' } },
            },
          }],
        }],
      }],
    });

    const findings = parseSarif(sarif);
    expect(findings[0].snippet).toBe('dangerous_call()');
  });

  it('should throw on invalid SARIF (no version)', () => {
    expect(() => parseSarif('{}')).toThrow('missing version');
  });

  it('should throw on invalid SARIF (no runs)', () => {
    expect(() => parseSarif('{"version":"2.1.0"}')).toThrow('missing runs');
  });

  it('should handle empty results', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [{ tool: { driver: { name: 'scanner' } }, results: [] }],
    });
    const findings = parseSarif(sarif);
    expect(findings).toHaveLength(0);
  });

  it('should resolve level from rule defaultConfiguration', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'scanner',
            rules: [{ id: 'r1', defaultConfiguration: { level: 'error' } }],
          },
        },
        results: [{ ruleId: 'r1', message: { text: 'msg' } }],
      }],
    });

    const findings = parseSarif(sarif);
    expect(findings[0].level).toBe('error');
  });
});

describe('normalizeUri', () => {
  it('should strip file:// prefix', () => {
    expect(normalizeUri('file:///path/to/file.ts')).toBe('/path/to/file.ts');
  });

  it('should decode URI encoding', () => {
    expect(normalizeUri('path/to/my%20file.ts')).toBe('path/to/my file.ts');
  });

  it('should handle plain paths', () => {
    expect(normalizeUri('src/app.ts')).toBe('src/app.ts');
  });
});

describe('deduplicateFindings', () => {
  it('should remove duplicates by fingerprint', () => {
    const findings = [
      { ruleId: 'r1', level: 'error' as const, message: 'msg', filePath: 'a.ts', startLine: 1, tool: 't', confidence: 90, fingerprint: 'fp1' },
      { ruleId: 'r1', level: 'error' as const, message: 'msg', filePath: 'a.ts', startLine: 1, tool: 't', confidence: 90, fingerprint: 'fp1' },
    ];

    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it('should remove duplicates by rule+file+line when no fingerprint', () => {
    const findings = [
      { ruleId: 'r1', level: 'error' as const, message: 'msg', filePath: 'a.ts', startLine: 1, tool: 't', confidence: 90 },
      { ruleId: 'r1', level: 'error' as const, message: 'msg', filePath: 'a.ts', startLine: 1, tool: 't', confidence: 90 },
    ];

    expect(deduplicateFindings(findings)).toHaveLength(1);
  });

  it('should keep findings with different locations', () => {
    const findings = [
      { ruleId: 'r1', level: 'error' as const, message: 'msg', filePath: 'a.ts', startLine: 1, tool: 't', confidence: 90 },
      { ruleId: 'r1', level: 'error' as const, message: 'msg', filePath: 'a.ts', startLine: 5, tool: 't', confidence: 90 },
    ];

    expect(deduplicateFindings(findings)).toHaveLength(2);
  });
});

describe('mergeSarifLogs', () => {
  it('should merge findings from multiple SARIF inputs', () => {
    const sarif1 = JSON.stringify({
      version: '2.1.0',
      runs: [{ tool: { driver: { name: 'tool-a' } }, results: [{ ruleId: 'a1', message: { text: 'from A' } }] }],
    });
    const sarif2 = JSON.stringify({
      version: '2.1.0',
      runs: [{ tool: { driver: { name: 'tool-b' } }, results: [{ ruleId: 'b1', message: { text: 'from B' } }] }],
    });

    const findings = mergeSarifLogs(sarif1, sarif2);
    expect(findings).toHaveLength(2);
  });

  it('should deduplicate across merged logs', () => {
    const sarif = JSON.stringify({
      version: '2.1.0',
      runs: [{
        tool: { driver: { name: 'tool' } },
        results: [{
          ruleId: 'r1',
          message: { text: 'msg' },
          locations: [{ physicalLocation: { artifactLocation: { uri: 'a.ts' }, region: { startLine: 1 } } }],
        }],
      }],
    });

    const findings = mergeSarifLogs(sarif, sarif);
    expect(findings).toHaveLength(1);
  });
});
