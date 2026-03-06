import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { checkSemgrepInstalled, checkSemgrepPro, runSemgrep } from '../../semgrep/runner.js';
import { detectLanguagesFromFiles, selectRulesetsWithFrameworks, detectFrameworks } from '../../semgrep/detector.js';
import { parseSarif } from '../../sarif/parser.js';
import { triageFindings, summarizeTriage } from '../../triage/engine.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function collectFiles(dir: string, maxDepth = 5, depth = 0): string[] {
  if (depth >= maxDepth) return [];
  const files: string[] = [];

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === 'vendor') continue;
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...collectFiles(fullPath, maxDepth, depth + 1));
        } else if (stat.isFile() && extname(fullPath)) {
          files.push(fullPath);
        }
      } catch {
        // skip inaccessible files
      }
    }
  } catch {
    // skip inaccessible directories
  }

  return files;
}

export function registerScanTools(server: McpServer): void {
  server.tool(
    'scan_code',
    'Run a semgrep security scan on a directory or file. Returns structured findings with severity levels.',
    {
      target: z.string().describe('Path to file or directory to scan'),
      rulesets: z.array(z.string()).optional().describe('Semgrep rulesets to use (e.g., ["p/security-audit", "p/python"]). Auto-detected if omitted.'),
      min_confidence: z.number().min(0).max(100).optional().describe('Minimum confidence threshold (0-100, default 0)'),
    },
    async ({ target, rulesets, min_confidence }) => {
      const installed = await checkSemgrepInstalled();
      if (!installed) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'semgrep is not installed. Install with: pip install semgrep',
            }),
          }],
        };
      }

      const usePro = await checkSemgrepPro();

      // Auto-detect languages and frameworks if no rulesets provided
      let selectedRulesets = rulesets;
      if (!selectedRulesets || selectedRulesets.length === 0) {
        const files = collectFiles(target);
        const languages = detectLanguagesFromFiles(files);
        const frameworks = detectFrameworks(files, (path) => {
          try { return readFileSync(path, 'utf-8'); } catch { return null; }
        });
        selectedRulesets = selectRulesetsWithFrameworks(
          languages.map(l => l.language),
          frameworks
        );
      }

      const result = await runSemgrep({
        target,
        rulesets: selectedRulesets,
        usePro,
        metricsOff: true,
      });

      if (!result.success) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Scan failed',
              errors: result.errors,
              command: result.command,
            }),
          }],
        };
      }

      // Parse and triage findings
      let findings = result.jsonOutput ? parseSemgrepJson(result.jsonOutput) : [];

      // Apply confidence filter
      const minConf = min_confidence ?? 0;
      if (minConf > 0) {
        findings = findings.filter(f => f.confidence >= minConf);
      }

      const triaged = triageFindings(findings, {
        sourceReader: (filePath) => {
          try { return readFileSync(filePath, 'utf-8'); } catch { return null; }
        },
      });

      const summary = summarizeTriage(triaged);
      const truePositives = triaged.filter(t => t.verdict === 'true_positive');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            summary: {
              scanned: target,
              engine: usePro ? 'Semgrep Pro' : 'Semgrep OSS',
              rulesets: selectedRulesets,
              duration: `${result.duration}ms`,
              ...summary,
            },
            findings: truePositives.map(f => ({
              rule: f.ruleId,
              level: f.level,
              message: f.message,
              file: f.filePath,
              line: f.startLine,
              confidence: f.confidence,
            })),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'detect_languages',
    'Detect programming languages and frameworks in a directory and suggest semgrep rulesets.',
    {
      target: z.string().describe('Path to directory to analyze'),
    },
    async ({ target }) => {
      const files = collectFiles(target);
      const languages = detectLanguagesFromFiles(files);
      const frameworks = detectFrameworks(files, (path) => {
        try { return readFileSync(path, 'utf-8'); } catch { return null; }
      });
      const rulesets = selectRulesetsWithFrameworks(
        languages.map(l => l.language),
        frameworks
      );

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            totalFiles: files.length,
            languages: languages.map(l => ({
              language: l.language,
              fileCount: l.fileCount,
              extensions: l.extensions,
            })),
            frameworks: frameworks.map(f => ({
              framework: f.framework,
              confidence: f.confidence,
              detectedBy: f.detectedBy,
            })),
            suggestedRulesets: rulesets,
          }, null, 2),
        }],
      };
    }
  );
}

function parseSemgrepJson(jsonOutput: string): import('../../sarif/types.js').Finding[] {
  try {
    const parsed = JSON.parse(jsonOutput);
    const results = parsed.results ?? [];

    return results.map((r: {
      check_id?: string;
      extra?: { severity?: string; message?: string; lines?: string; fingerprint?: string };
      path?: string;
      start?: { line?: number; col?: number };
      end?: { line?: number; col?: number };
    }) => ({
      ruleId: r.check_id ?? 'unknown',
      level: semgrepSeverityToLevel(r.extra?.severity),
      message: r.extra?.message ?? '',
      filePath: r.path ?? 'unknown',
      startLine: r.start?.line ?? 0,
      endLine: r.end?.line,
      startColumn: r.start?.col,
      endColumn: r.end?.col,
      snippet: r.extra?.lines,
      fingerprint: r.extra?.fingerprint,
      tool: 'semgrep',
      confidence: severityToConfidence(r.extra?.severity),
    }));
  } catch {
    return [];
  }
}

function semgrepSeverityToLevel(severity?: string): 'error' | 'warning' | 'note' | 'none' {
  switch (severity?.toUpperCase()) {
    case 'ERROR': return 'error';
    case 'WARNING': return 'warning';
    case 'INFO': return 'note';
    default: return 'warning';
  }
}

function severityToConfidence(severity?: string): number {
  switch (severity?.toUpperCase()) {
    case 'ERROR': return 90;
    case 'WARNING': return 75;
    case 'INFO': return 60;
    default: return 70;
  }
}
