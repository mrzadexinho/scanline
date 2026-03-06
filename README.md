# scanline

[![CI](https://github.com/mrzadexinho/scanline/actions/workflows/ci.yml/badge.svg)](https://github.com/mrzadexinho/scanline/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/scanline-mcp.svg)](https://www.npmjs.com/package/scanline-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Security scanning MCP server. Semgrep integration, SARIF parsing, and automated finding triage for Claude Code.

## Problem

Security scanners produce noisy output. scanline wraps semgrep with automatic language detection and ruleset selection, parses SARIF from any scanner, and triages findings to separate true positives from noise — all as MCP tools with zero configuration.

## Quick Start

### As MCP Server (Claude Code)

```json
{
  "mcpServers": {
    "scanline": {
      "command": "npx",
      "args": ["-y", "scanline-mcp"]
    }
  }
}
```

### As Library

```typescript
import { parseSarif, triageFindings, summarizeTriage } from 'scanline-mcp';
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
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `scan_code` | Run semgrep security scan with auto language detection and triage |
| `detect_languages` | Detect languages in a directory and suggest rulesets |
| `parse_sarif` | Parse SARIF output from any scanner into structured findings |
| `triage_finding` | Analyze a specific finding with source context |

## Triage Engine

scanline automatically classifies findings as true or false positives:

| Rule | What it catches | Verdict |
|------|----------------|---------|
| Test file | Findings in `*.test.*`, `*.spec.*`, `__tests__/` | False positive |
| Example file | Findings in `examples/`, `docs/`, `samples/` | False positive |
| Suppression comment | Lines with `nosemgrep`, `noqa`, `nolint` | False positive |
| Generated code | Files in `dist/`, `build/`, `vendor/`, or with generated headers | False positive |
| Dead code | Commented-out lines | False positive |
| Default | No false positive indicators found | True positive |

Conservative by default: when uncertain, findings are classified as true positives.

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
    semgrep/         # Semgrep integration
      types          # ScanConfig, Language, rulesets
      detector       # Language detection, ruleset selection
      runner         # Build commands, execute scans
    triage/          # Finding triage engine
      types          # TriageContext, TriageRule
      rules          # 5 triage rules (test, example, suppression, generated, dead)
      engine         # Apply rules, summarize results
    mcp/             # MCP server layer
      tools/         # 4 MCP tools
  tests/             # 63 tests mirroring src/ structure
```

## Supported Languages

Auto-detection and ruleset selection for: TypeScript, JavaScript, Python, Go, Ruby, Java, PHP, C/C++, Rust, Kotlin, Swift, C#

## Prerequisites

- **Node.js** >= 20.0.0
- **Semgrep** (for `scan_code` tool): `pip install semgrep`
- SARIF parsing and triage work without semgrep installed

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
