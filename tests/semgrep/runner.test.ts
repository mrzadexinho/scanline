import { describe, it, expect } from 'vitest';
import { buildScanCommand } from '../../src/semgrep/runner.js';

describe('buildScanCommand', () => {
  it('should build basic scan command', () => {
    const cmd = buildScanCommand({
      target: '/path/to/code',
      rulesets: ['p/security-audit'],
    });
    expect(cmd).toContain('semgrep');
    expect(cmd).toContain('--config p/security-audit');
    expect(cmd).toContain('--json');
    expect(cmd).toContain('--metrics=off');
    expect(cmd).toContain('/path/to/code');
  });

  it('should include --pro when usePro is true', () => {
    const cmd = buildScanCommand({
      target: '.',
      usePro: true,
    });
    expect(cmd).toContain('--pro');
  });

  it('should not include --pro when usePro is false', () => {
    const cmd = buildScanCommand({
      target: '.',
      usePro: false,
    });
    expect(cmd).not.toContain('--pro');
  });

  it('should add --include patterns', () => {
    const cmd = buildScanCommand({
      target: '.',
      include: ['*.py', '*.js'],
    });
    expect(cmd).toContain('--include="*.py"');
    expect(cmd).toContain('--include="*.js"');
  });

  it('should add --exclude patterns', () => {
    const cmd = buildScanCommand({
      target: '.',
      exclude: ['tests/', 'vendor/'],
    });
    expect(cmd).toContain('--exclude="tests/"');
    expect(cmd).toContain('--exclude="vendor/"');
  });

  it('should add SARIF output when outputDir specified', () => {
    const cmd = buildScanCommand({
      target: '.',
      outputDir: './results',
    });
    expect(cmd).toContain('--sarif');
    expect(cmd).toContain('--sarif-output=./results/results.sarif');
  });

  it('should handle multiple rulesets', () => {
    const cmd = buildScanCommand({
      target: '.',
      rulesets: ['p/security-audit', 'p/python', 'p/secrets'],
    });
    expect(cmd).toContain('--config p/security-audit');
    expect(cmd).toContain('--config p/python');
    expect(cmd).toContain('--config p/secrets');
  });

  it('should default to security-audit when no rulesets', () => {
    const cmd = buildScanCommand({ target: '.' });
    expect(cmd).toContain('--config p/security-audit');
  });
});
