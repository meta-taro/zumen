# zumen — diagrams on GitHub

A Chrome extension that draws [zumen](https://meta-taro.github.io/zumen/) diagrams on github.com.

- **Pull requests:** for every changed `*.zumen.yaml`, the diagram before and after the change, side by side. Added nodes are marked 新, removed nodes 消, and nodes a person placed by hand (`pins`) 人 — so you can see that an AI rewrite kept the human edits.
- `*.zumen.yaml` files: the diagram appears above the source.
- ```` ```zumen ```` blocks in Markdown (README, issues, pull requests): the diagram appears above each block.

The source text stays as it is; the diagram is a collapsible panel you can fold away.

**Nothing leaves GitHub.** The extension draws with the same zumen renderer that ships in the VS Code extension, inside your browser. In pull requests it reads the two versions of each changed file from github.com, with your current sign-in. It only runs on `https://github.com/*` and asks for no other permissions. The renderer is loaded only on pages that contain zumen.

## Build

```bash
pnpm chrome:build      # packages/zumen-chrome/dist (load it unpacked from chrome://extensions)
pnpm chrome:package    # also writes zumen-chrome-<version>.zip for the Chrome Web Store
```

## Links

- Gallery of diagrams: https://meta-taro.github.io/zumen/
- Source: https://github.com/meta-taro/zumen
- VS Code extension: https://marketplace.visualstudio.com/items?itemName=meta-taro.zumen-vscode

MIT License.
