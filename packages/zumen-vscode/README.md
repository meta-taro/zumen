# zumen for VS Code (prototype)

Preview [zumen](https://github.com/meta-taro/zumen) diagrams inside VS Code.

- **`.zumen.yaml` beside the editor.** Open a `.zumen.yaml` file and press the preview button in the editor title bar (or run **zumen: Open Preview to the Side**). The diagram is redrawn as you type. If the source can't be drawn, the last diagram is dimmed and the reason is shown above it.
- **```` ```zumen ```` blocks in the Markdown preview.** Fenced blocks whose info string is exactly `zumen` are drawn as diagrams. A block that can't be drawn shows the reason and keeps the source visible.

The extension only reads and draws. It never writes your source: edits stay in your hands, in the editor.

## Try it from this repository

```bash
pnpm install
pnpm vscode:build
code --extensionDevelopmentPath="$PWD/packages/zumen-vscode" examples/gallery
```

Not published to the Marketplace yet. MIT.
