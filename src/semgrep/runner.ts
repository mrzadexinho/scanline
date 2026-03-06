import { exec } from 'child_process';
import { promisify } from 'util';
import type { ScanConfig, ScanResult } from './types.js';

const execAsync = promisify(exec);

export async function checkSemgrepInstalled(): Promise<boolean> {
  try {
    await execAsync('semgrep --version');
    return true;
  } catch {
    return false;
  }
}

export async function checkSemgrepPro(): Promise<boolean> {
  try {
    await execAsync('semgrep --pro --validate --config p/default 2>/dev/null');
    return true;
  } catch {
    return false;
  }
}

export function buildScanCommand(config: ScanConfig): string {
  const parts = ['semgrep'];

  if (config.usePro) {
    parts.push('--pro');
  }

  if (config.metricsOff !== false) {
    parts.push('--metrics=off');
  }

  for (const ruleset of config.rulesets ?? ['p/security-audit']) {
    parts.push('--config', ruleset);
  }

  parts.push('--json');

  if (config.outputDir) {
    parts.push('--sarif', `--sarif-output=${config.outputDir}/results.sarif`);
  }

  if (config.include) {
    for (const pattern of config.include) {
      parts.push(`--include="${pattern}"`);
    }
  }

  if (config.exclude) {
    for (const pattern of config.exclude) {
      parts.push(`--exclude="${pattern}"`);
    }
  }

  parts.push(config.target);

  return parts.join(' ');
}

export async function runSemgrep(config: ScanConfig): Promise<ScanResult> {
  const command = buildScanCommand(config);
  const start = Date.now();

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB for large codebases
      timeout: 600_000, // 10 minutes
    });

    const duration = Date.now() - start;
    const errors: string[] = [];
    if (stderr) {
      const stderrLines = stderr.split('\n').filter(l => l.trim());
      errors.push(...stderrLines);
    }

    let findingsCount = 0;
    try {
      const parsed = JSON.parse(stdout);
      findingsCount = parsed.results?.length ?? 0;
    } catch {
      // stdout might not be valid JSON if there were issues
    }

    return {
      success: true,
      findingsCount,
      jsonOutput: stdout,
      errors,
      command,
      duration,
    };
  } catch (error: unknown) {
    const duration = Date.now() - start;
    const err = error as { stdout?: string; stderr?: string; message: string };

    // semgrep exits with code 1 when it finds issues, that's still success
    if (err.stdout) {
      let findingsCount = 0;
      try {
        const parsed = JSON.parse(err.stdout);
        findingsCount = parsed.results?.length ?? 0;
      } catch {
        // ignore parse errors
      }

      if (findingsCount > 0) {
        return {
          success: true,
          findingsCount,
          jsonOutput: err.stdout,
          errors: err.stderr ? [err.stderr] : [],
          command,
          duration,
        };
      }
    }

    return {
      success: false,
      findingsCount: 0,
      errors: [err.message],
      command,
      duration,
    };
  }
}
