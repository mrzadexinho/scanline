#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerScanTools } from './tools/scan-tools.js';
import { registerSarifTools } from './tools/sarif-tools.js';

async function main() {
  const server = new McpServer({
    name: 'scanline',
    version: '0.1.0',
  });

  registerScanTools(server);
  registerSarifTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('scanline MCP server running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
