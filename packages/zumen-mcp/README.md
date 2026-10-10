# @metataro/zumen-mcp

The MCP server for [zumen](https://github.com/meta-taro/zumen) — **AI-editable diagrams as code.**
An AI agent (Claude Code and others) draws from one YAML file; a human fixes the layout; the fix survives the next regeneration.

```bash
claude mcp add zumen -- npx -y @metataro/zumen-mcp
```

Other MCP clients: run `npx -y @metataro/zumen-mcp` as a stdio server.

**What the agent gets:** `zumen_spec` (read this first), `zumen_examples` (389 worked examples — floor plans, lighting plots, pallet patterns, rail maps…), `zumen_propose` (a diff a human applies — **there is no tool that writes the source directly**), `zumen_inspect`, `zumen_export` (SVG / PNG / Mermaid / draw.io), and a live link to the open desktop window.

This package exists so that the library package [`@metataro/zumen`](https://www.npmjs.com/package/@metataro/zumen) stays at three dependencies: only people who want the MCP server install the MCP SDK.

MIT.
