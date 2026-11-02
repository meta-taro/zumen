/**
 * GitHub のページから、zumen の正本を見つける決まり。
 *
 * **ブラウザを立てずに確かめられる所だけを置く**（`test/chrome.test.ts`）。
 * DOM を触る入口（`content.ts`）は薄く保つ。
 *
 * どこに正本があるか（2026-11-02 に github.com の実物で確かめた）：
 *
 * | 画面 | 正本の置き場 |
 * |---|---|
 * | Markdown の表示（README・Issue・PR 本文）| ```` ```zumen ```` の囲みが `pre[lang="zumen"] > code` になる |
 * | `*.zumen.yaml` のファイル表示 | 全文が `#read-only-cursor-text-area`（読み取り専用の textarea）に入る |
 */

export type Theme = 'light' | 'dark';

/** Markdown の中の zumen の囲み。 */
export const FENCE_SELECTOR = 'pre[lang="zumen"]';
/** ファイル表示で、全文を持っている欄。 */
export const BLOB_TEXT_SELECTOR = '#read-only-cursor-text-area';
/** 描いた欄に付ける印。同じものを 2 度描かない。 */
export const PANEL_CLASS = 'zumen-chrome-panel';

/** `/<owner>/<repo>/blob/<ref>/…/<名前>.zumen.yaml` か。ref や途中の階層は問わない。 */
export function isZumenBlobPath(pathname: string): boolean {
  return /^\/[^/]+\/[^/]+\/blob\/.+\.zumen\.ya?ml$/.test(pathname);
}

/**
 * GitHub の色の決まり（`<html data-color-mode>`）から、図の地を選ぶ。
 * `auto` は OS の設定に従う（GitHub 自身と同じ）。
 */
export function themeOf(colorMode: string | undefined, prefersDark: boolean): Theme {
  if (colorMode === 'dark') return 'dark';
  if (colorMode === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
