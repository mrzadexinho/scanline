import { describe, it, expect } from 'vitest';
import { detectLanguagesFromFiles, selectRulesets } from '../../src/semgrep/detector.js';

describe('detectLanguagesFromFiles', () => {
  it('should detect Python files', () => {
    const files = ['src/app.py', 'src/utils.py', 'tests/test_app.py'];
    const result = detectLanguagesFromFiles(files);
    expect(result).toHaveLength(1);
    expect(result[0].language).toBe('python');
    expect(result[0].fileCount).toBe(3);
  });

  it('should detect multiple languages', () => {
    const files = ['app.ts', 'server.js', 'main.py', 'lib.go'];
    const result = detectLanguagesFromFiles(files);
    expect(result.length).toBeGreaterThanOrEqual(3);
    const langs = result.map(r => r.language);
    expect(langs).toContain('typescript');
    expect(langs).toContain('javascript');
    expect(langs).toContain('python');
    expect(langs).toContain('go');
  });

  it('should sort by file count descending', () => {
    const files = ['a.py', 'b.py', 'c.py', 'app.ts'];
    const result = detectLanguagesFromFiles(files);
    expect(result[0].language).toBe('python');
    expect(result[0].fileCount).toBe(3);
  });

  it('should handle empty input', () => {
    expect(detectLanguagesFromFiles([])).toHaveLength(0);
  });

  it('should handle files without extensions', () => {
    const files = ['Makefile', 'Dockerfile', 'README'];
    expect(detectLanguagesFromFiles(files)).toHaveLength(0);
  });

  it('should detect JSX/TSX', () => {
    const files = ['App.jsx', 'Page.tsx'];
    const result = detectLanguagesFromFiles(files);
    const langs = result.map(r => r.language);
    expect(langs).toContain('javascript');
    expect(langs).toContain('typescript');
  });

  it('should track extensions per language', () => {
    const files = ['a.js', 'b.mjs', 'c.jsx'];
    const result = detectLanguagesFromFiles(files);
    const js = result.find(r => r.language === 'javascript')!;
    expect(js.extensions).toContain('.js');
    expect(js.extensions).toContain('.mjs');
    expect(js.extensions).toContain('.jsx');
  });
});

describe('selectRulesets', () => {
  it('should always include baseline rulesets', () => {
    const rulesets = selectRulesets([]);
    expect(rulesets).toContain('p/security-audit');
    expect(rulesets).toContain('p/secrets');
  });

  it('should add language-specific rulesets', () => {
    const rulesets = selectRulesets(['python', 'go']);
    expect(rulesets).toContain('p/python');
    expect(rulesets).toContain('p/golang');
  });

  it('should use custom rulesets when provided', () => {
    const rulesets = selectRulesets(['python'], ['p/custom-rules']);
    expect(rulesets).toEqual(['p/custom-rules']);
    expect(rulesets).not.toContain('p/security-audit');
  });

  it('should include nodejs for javascript', () => {
    const rulesets = selectRulesets(['javascript']);
    expect(rulesets).toContain('p/javascript');
    expect(rulesets).toContain('p/nodejs');
  });

  it('should not duplicate rulesets', () => {
    const rulesets = selectRulesets(['python', 'python']);
    const pythonCount = rulesets.filter(r => r === 'p/python').length;
    expect(pythonCount).toBe(1);
  });
});
