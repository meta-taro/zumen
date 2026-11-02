/**
 * `.zumen.yaml` の横に出すプレビューの枠（Webview の HTML）。
 *
 * **外から何も読まない。** 台本は拡張に同梱した 1 本だけを nonce 付きで許す。
 * 図は人から人へ渡るので、図の中身が台本を走らせる道を残さない。
 */
export interface PageParts {
  /** 同梱した台本の URL（`webview.asWebviewUri` を通したもの）。 */
  script: string;
  /** Webview の `cspSource`。 */
  cspSource: string;
  nonce: string;
}

export function page({ script, cspSource, nonce }: PageParts): string {
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
  body { margin: 0; padding: 16px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
  #diagram svg { max-width: 100%; height: auto; display: block; }
  .zumen-error { margin-bottom: 12px; padding: 8px 12px; border-left: 3px solid var(--vscode-inputValidation-errorBorder, #be1100);
    background: var(--vscode-inputValidation-errorBackground, transparent); font-family: var(--vscode-editor-font-family); white-space: pre-wrap; }
  .stale { opacity: 0.45; }
  #tools { display: flex; gap: 8px; margin-bottom: 12px; }
  #tools button { font: inherit; padding: 4px 10px; border: 1px solid var(--vscode-button-border, transparent);
    color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border-radius: 2px; cursor: pointer; }
  #tools button:hover { background: var(--vscode-button-secondaryHoverBackground); }
</style>
</head>
<body>
<div id="tools"><button id="save-svg" type="button">Save SVG</button><button id="save-png" type="button">Save PNG</button></div>
<div id="status"></div>
<div id="diagram"></div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
}

export function nonce(random: () => number = Math.random): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i += 1) out += letters[Math.floor(random() * letters.length)];
  return out;
}
