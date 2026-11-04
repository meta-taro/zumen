# zumen for VS Code

Diagrams as code in VS Code: specialist drawings (lighting plots, floor plans, wiring diagrams, warehouse layouts, appraisal charts…) from one YAML file, drawn by you or by your agent. Nothing else to install: no Node, no npm.

**What it solves:** ask Copilot or Claude Code for a diagram and get one you can still edit by hand. The source is plain text, so you review it in a git diff, and the agent proposes later changes as diffs instead of redrawing over your fixes.

![A stadium lighting plot drawn with zumen: truss positions, channels, circuits and a patch table](https://meta-taro.github.io/zumen/og/369.png)

## What it does

1. **A live preview of `.zumen.yaml`.** Press the preview button in the editor title bar (or run **zumen: Open Preview to the Side**). The diagram is redrawn as you type. **Save SVG** / **Save PNG** write it next to the source (drawn on white, PNG at 2×). If the source can't be drawn, the last diagram is dimmed and the reason is shown above it.
2. **```` ```zumen ```` blocks in the Markdown preview.** Fenced blocks whose info string is exactly `zumen` are drawn as diagrams. A block that can't be drawn shows the reason and keeps the source visible.
3. **The zumen MCP tools for agent mode.** The MCP server ships inside the extension and runs on VS Code's own runtime.
   - **Copilot** (VS Code 1.101 or later) finds it automatically. Ask it to draw a diagram: it reads the spec and the bundled worked examples, creates the file, and proposes later edits as diffs.
   - **Terminal agents** (Claude Code and others): run **zumen: Connect Terminal Agents**. A terminal opens with `claude mcp add …` typed in; press Enter. Other agents can register the launcher path it shows as an MCP (stdio) server.
4. **Every diagram in the workspace, in the Explorer.** The **zumen** view lists each `*.zumen.yaml` as a card with a thumbnail. Type in its search box to filter by title, path, or anything in the source (a label, an id, a section name); click a card to open the file with its preview. Up to 500 files are listed; sources over 512 KB are listed but not searched.

The extension never writes your source. Agents propose; you apply.

## Try it

Install **zumen** from the Marketplace, open any `.zumen.yaml`, and press the preview button. Over 400 worked examples are in the [gallery](https://meta-taro.github.io/zumen/).

From this repository:

```bash
pnpm install
pnpm vscode:package   # writes zumen-vscode-<version>.vsix
```

## Links

- [Gallery and docs](https://meta-taro.github.io/zumen/) — every example has its own page with the source
- [GitHub](https://github.com/meta-taro/zumen) — the format spec, the desktop app and issues
- [npm: @metataro/zumen](https://www.npmjs.com/package/@metataro/zumen) — the CLI and MCP server outside VS Code
- [md-business](https://marketplace.visualstudio.com/items?itemName=meta-taro.md-business-vscode) — Markdown business documents that embed zumen diagrams

MIT.
