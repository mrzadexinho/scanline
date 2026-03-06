# scanline

[![CI](https://github.com/mrzadexinho/scanline/actions/workflows/ci.yml/badge.svg)](https://github.com/mrzadexinho/scanline/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@mrzadexinho/scanline.svg)](https://www.npmjs.com/package/@mrzadexinho/scanline)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Security scanning MCP server. Semgrep integration, SARIF parsing, baseline diffing, framework-aware ruleset selection, and automated finding triage.

## Problem

Security scanners produce noisy output. scanline wraps semgrep with automatic language and framework detection for smart ruleset selection, parses SARIF from any scanner, diffs against baselines to surface only new findings, and triages results to separate true positives from noise — all as MCP tools with zero configuration.

## Quick Start

### As MCP Server

Works with any MCP-compatible client — **Claude Code**, Claude Desktop, Cursor, Windsurf, VS Code (Copilot), Continue.dev, Zed, Cline, and more.

```json
{
  "mcpServers": {
    "scanline": {
      "command": "npx",
      "args": ["-y", "@mrzadexinho/scanline"]
    }
  }
}
```

### As Library

```typescript
import {
  parseSarif, triageFindings, summarizeTriage,
  diffFindings, formatDiffReport,
  detectFrameworks, selectRulesetsWithFrameworks
} from '@mrzadexinho/scanline';
import { readFileSync } from 'fs';

// Parse SARIF from any scanner
const sarif = readFileSync('results.sarif', 'utf-8');
const findings = parseSarif(sarif);

// Triage findings with source context
const triaged = triageFindings(findings, {
  sourceReader: (path) => readFileSync(path, 'utf-8'),
});

const summary = summarizeTriage(triaged);
console.log(`True positives: ${summary.truePositives}/${summary.total}`);

// Diff against baseline
const baseline = parseSarif(readFileSync('baseline.sarif', 'utf-8'));
const diff = diffFindings(baseline, findings);
console.log(formatDiffReport(diff));
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `scan_code` | Run semgrep scan with auto language + framework detection and triage |
| `detect_languages` | Detect languages and frameworks in a directory, suggest rulesets |
| `parse_sarif` | Parse SARIF output from any scanner into structured findings |
| `triage_finding` | Analyze a specific finding with source context |
| `diff_sarif` | Compare baseline vs current SARIF to find new, fixed, and unchanged findings |

## Triage Engine

scanline automatically classifies findings as true or false positives:

| Rule | What it catches | Verdict |
|------|----------------|---------|
| Test file | Findings in `*.test.*`, `*.spec.*`, `__tests__/` | False positive |
| Example file | Findings in `examples/`, `docs/`, `samples/` | False positive |
| Suppression comment | Lines with `nosemgrep`, `noqa`, `nolint` | False positive |
| Generated code | Files in `dist/`, `build/`, `vendor/`, or with generated headers | False positive |
| Dead code | Commented-out lines | False positive |
| Input validation | Sanitized/validated input upstream (sanitize, escape, Zod, ORM, parameterized queries) | False positive |
| Unreachable code | Code behind `if(false)`, feature flags, or after early return/throw | False positive / Uncertain |
| Default | No false positive indicators found | True positive |

Conservative by default: when uncertain, findings are classified as true positives.

## SARIF Diff

Compare scan results against a baseline to focus on what changed:

- **New findings** — introduced since baseline
- **Fixed findings** — resolved since baseline
- **Unchanged findings** — still present
- Fingerprint-based matching for accurate comparison
- Markdown report generation

## Framework Detection

scanline automatically detects frameworks from project files and adds framework-specific semgrep rulesets:

| Framework | Detected by | Ruleset |
|-----------|------------|---------|
| Django | `settings.py`, `requirements.txt` | `p/django` |
| Flask | `requirements.txt`, `pyproject.toml` | `p/flask` |
| FastAPI | `requirements.txt`, `pyproject.toml` | `p/fastapi` |
| React | `package.json` | `p/react` |
| Next.js | `next.config.js`, `package.json` | `p/nextjs` |
| Angular | `angular.json`, `package.json` | `p/angular` |
| Express | `package.json` | `p/express` |
| Rails | `Gemfile`, `config.ru` | `p/rails` |
| Spring | `pom.xml` | `p/spring` |
| Laravel | `composer.json`, `artisan` | `p/laravel` |
| Symfony | `composer.json` | `p/symfony` |

## SARIF Support

scanline parses SARIF 2.1.0 from any scanner:

- **Semgrep** — native integration
- **CodeQL** — parse SARIF output
- **ESLint** — with SARIF formatter
- **Any tool** — that outputs standard SARIF

Features: fingerprint-based deduplication, multi-run merging, URI normalization, confidence scoring.

## Architecture

```
scanline/
  src/
    sarif/           # SARIF parsing layer
      types          # SarifLog, Finding, TriagedFinding
      parser         # Parse, deduplicate, merge SARIF
      diff           # Baseline comparison, diff reports
    semgrep/         # Semgrep integration
      types          # ScanConfig, Language, Framework, rulesets
      detector       # Language + framework detection, ruleset selection
      runner         # Build commands, execute scans
    triage/          # Finding triage engine
      types          # TriageContext, TriageRule
      rules          # 7 triage rules
      engine         # Apply rules, summarize results
    mcp/             # MCP server layer
      tools/         # 5 MCP tools
  tests/             # 101 tests mirroring src/ structure
```

## Supported Languages

Auto-detection and ruleset selection for: TypeScript, JavaScript, Python, Go, Ruby, Java, PHP, C/C++, Rust, Kotlin, Swift, C#

## Prerequisites

- **Node.js** >= 20.0.0
- **Semgrep** (for `scan_code` tool): `pip install semgrep`
- SARIF parsing, diffing, and triage work without semgrep installed

## Development

```bash
git clone https://github.com/mrzadexinho/scanline.git
cd scanline
npm install
npm run build
npm test
```

## License

MIT
