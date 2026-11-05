# Changelog

## 0.3.0

- **zumen** view in the Explorer: every `*.zumen.yaml` in the workspace as a card with a thumbnail. Search by title, path or anything in the source (labels, ids, sections); click a card to open the file with its preview.

## 0.2.0

- Bundles zumen 0.7.0: free lines and shapes (`paths`), dimensions measured from two points (`dims`), and reusable parts (`parts` / `place`) now draw in the preview and in ```` ```zumen ```` blocks.
- Agents' proposals now carry every section of the source (titles, grids, views, constants, paths, dims, parts); before, changes outside nodes and edges were dropped. A human's pinned edits still win.

## 0.1.1

- Marketplace page: says what it solves, shows an example, and links the gallery, GitHub, npm and md-business. No change to the extension itself.

## 0.1.0

- Preview `.zumen.yaml` beside the editor, redrawn as you type. Save as SVG or PNG.
- Draw ```` ```zumen ```` blocks in the Markdown preview.
- Bundled zumen MCP server, registered with VS Code for Copilot (VS Code 1.101+). No Node needed.
- **zumen: Connect Terminal Agents** puts the `claude mcp add` line in a terminal; you press Enter.
