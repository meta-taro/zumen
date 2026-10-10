#!/usr/bin/env node
// zumen の MCP サーバ（stdio）。中身は dist/mcp.js（本体と同じ組み立て物）。
import { startMcp } from '../dist/mcp.js';

await startMcp();
