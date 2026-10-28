# zumen for VS Code (prototype)

Install one extension, and your agents can draw [zumen](https://github.com/meta-taro/zumen) diagrams. You don't need Node or npm: the zumen MCP server ships inside the extension and runs on VS Code's own runtime.

- **Copilot (agent mode).** The extension registers the zumen MCP server with VS Code (VS Code 1.101 or later). Copilot can read the spec, browse the worked examples, create a diagram, and propose edits as a diff you apply.
- **Terminal agents (Claude Code and others).** Run **zumen: Connect Terminal Agents**. A terminal opens with `claude mcp add …` typed in; press Enter to add zumen. Other agents can register the launcher path it shows as an MCP (stdio) server. The launcher is rewritten every time the extension starts, so it keeps working after updates.
- **`.zumen.yaml` beside the editor.** Press the preview button in the editor title bar (or run **zumen: Open Preview to the Side**). The diagram is redrawn as you type. If the source can't be drawn, the last diagram is dimmed and the reason is shown above it.
- **```` ```zumen ```` blocks in the Markdown preview.** Fenced blocks whose info string is exactly `zumen` are drawn as diagrams. A block that can't be drawn shows the reason and keeps the source visible.

The extension never writes your source. Agents propose; you apply.

## Try it from this repository

```bash
pnpm install
pnpm vscode:build
code --extensionDevelopmentPath="$PWD/packages/zumen-vscode" examples/gallery
```

Not published to the Marketplace yet. MIT.
