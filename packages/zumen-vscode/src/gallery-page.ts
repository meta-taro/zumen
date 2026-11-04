/**
 * エクスプローラーの「zumen」の欄（Webview View の HTML）。
 *
 * プレビューと同じく、**外から何も読まない。** 台本は拡張に同梱した 1 本だけを nonce 付きで許す。
 */
import type { PageParts } from './page.ts';

export function galleryPage({ script, cspSource, nonce }: PageParts): string {
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} https: data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; padding: 8px; color: var(--vscode-foreground); font-size: var(--vscode-font-size); }
  #query { width: 100%; box-sizing: border-box; padding: 4px 6px; color: var(--vscode-input-foreground);
    background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; }
  #query:focus { outline: 1px solid var(--vscode-focusBorder); }
  #count { margin: 6px 0; opacity: 0.75; font-size: 0.9em; }
  #list { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .card { display: block; width: 100%; text-align: left; padding: 6px; cursor: pointer; color: inherit; font: inherit;
    background: var(--vscode-sideBar-background); border: 1px solid var(--vscode-panel-border, transparent); border-radius: 4px; }
  .card:hover, .card:focus { border-color: var(--vscode-focusBorder); outline: none; }
  .thumb { height: 90px; display: flex; align-items: center; justify-content: center; overflow: hidden;
    background: var(--vscode-editor-background); border-radius: 2px; }
  .thumb svg { max-width: 100%; max-height: 90px; width: auto; height: auto; }
  .thumb .wait { opacity: 0.4; }
  .title { margin-top: 4px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .path { opacity: 0.7; font-size: 0.85em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .error { color: var(--vscode-errorForeground); font-size: 0.85em; padding: 4px; }
  #empty { opacity: 0.75; line-height: 1.5; }
</style>
</head>
<body>
<input id="query" type="search" placeholder="Search diagrams (title, label, id…)" aria-label="Search diagrams">
<div id="count"></div>
<div id="list"></div>
<div id="empty" hidden>No <code>*.zumen.yaml</code> in this workspace yet.</div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}
