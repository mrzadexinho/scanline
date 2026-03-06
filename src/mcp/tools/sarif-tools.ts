import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { parseSarif, deduplicateFindings } from '../../sarif/parser.js';
import { diffFindings, formatDiffReport } from '../../sarif/diff.js';
import { triageFindings, summarizeTriage } from '../../triage/engine.js';
import { readFileSync } from 'fs';

export function registerSarifTools(server: McpServer): void {
  server.tool(
    'parse_sarif',
    'Parse SARIF output from any security scanner into structured findings with triage.',
    {
      sarif_input: z.string().describe('SARIF JSON string or file path to a .sarif file'),
      triage: z.boolean().optional().describe('Run triage to classify true/false positives (default true)'),
      min_confidence: z.number().min(0).max(100).optional().describe('Minimum confidence threshold (0-100, default 0)'),
    },
    async ({ sarif_input, triage, min_confidence }) => {
      let sarifContent: string;

      // Determine if input is file path or raw JSON
      if (sarif_input.trim().startsWith('{')) {
        sarifContent = sarif_input;
      } else {
        try {
          sarifContent = readFileSync(sarif_input, 'utf-8');
        } catch {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: `Cannot read file: ${sarif_input}` }),
            }],
          };
        }
      }

      try {
        let findings = parseSarif(sarifContent);
        findings = deduplicateFindings(findings);

        const minConf = min_confidence ?? 0;
        if (minConf > 0) {
          findings = findings.filter(f => f.confidence >= minConf);
        }

        if (triage !== false) {
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
                summary,
                findings: truePositives.map(f => ({
                  rule: f.ruleId,
                  level: f.level,
                  message: f.message,
                  file: f.filePath,
                  line: f.startLine,
                  confidence: f.confidence,
                  verdict: f.verdict,
                  reason: f.reason,
                })),
              }, null, 2),
            }],
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              totalFindings: findings.length,
              findings: findings.map(f => ({
                rule: f.ruleId,
                level: f.level,
                message: f.message,
                file: f.filePath,
                line: f.startLine,
                confidence: f.confidence,
                tool: f.tool,
              })),
            }, null, 2),
          }],
        };
      } catch (error: unknown) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to parse SARIF',
              details: (error as Error).message,
            }),
          }],
        };
      }
    }
  );

  server.tool(
    'triage_finding',
    'Analyze a specific finding with source context to determine if it is a true or false positive.',
    {
      rule_id: z.string().describe('Rule ID of the finding'),
      file_path: z.string().describe('Path to the source file'),
      line: z.number().describe('Line number of the finding'),
      message: z.string().optional().describe('Finding message'),
    },
    async ({ rule_id, file_path, line, message }) => {
      let source: string | null = null;
      try {
        source = readFileSync(file_path, 'utf-8');
      } catch {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: `Cannot read source file: ${file_path}` }),
          }],
        };
      }

      const finding = {
        ruleId: rule_id,
        level: 'warning' as const,
        message: message ?? '',
        filePath: file_path,
        startLine: line,
        tool: 'manual',
        confidence: 75,
      };

      const triaged = triageFindings([finding], {
        sourceReader: () => source,
      });

      const result = triaged[0];

      // Show surrounding context
      const lines = source.split('\n');
      const start = Math.max(0, line - 6);
      const end = Math.min(lines.length, line + 5);
      const context = lines.slice(start, end).map((l, i) => {
        const lineNum = start + i + 1;
        const marker = lineNum === line ? '>>>' : '   ';
        return `${marker} ${lineNum}: ${l}`;
      }).join('\n');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            verdict: result.verdict,
            reason: result.reason,
            confidence: result.confidence,
            context,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'diff_sarif',
    'Compare two SARIF scans to find new, fixed, and unchanged findings. Use for regression checking.',
    {
      baseline: z.string().describe('Baseline SARIF (file path or JSON string)'),
      current: z.string().describe('Current SARIF (file path or JSON string)'),
    },
    async ({ baseline, current }) => {
      const readSarif = (input: string): string => {
        if (input.trim().startsWith('{')) return input;
        return readFileSync(input, 'utf-8');
      };

      try {
        const baselineFindings = deduplicateFindings(parseSarif(readSarif(baseline)));
        const currentFindings = deduplicateFindings(parseSarif(readSarif(current)));

        const diff = diffFindings(baselineFindings, currentFindings);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              summary: diff.summary,
              newFindings: diff.newFindings.map(f => ({
                rule: f.ruleId,
                level: f.level,
                message: f.message,
                file: f.filePath,
                line: f.startLine,
              })),
              fixedFindings: diff.fixedFindings.map(f => ({
                rule: f.ruleId,
                level: f.level,
                message: f.message,
                file: f.filePath,
                line: f.startLine,
              })),
              report: formatDiffReport(diff),
            }, null, 2),
          }],
        };
      } catch (error: unknown) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Failed to diff SARIF files',
              details: (error as Error).message,
            }),
          }],
        };
      }
    }
  );
}
