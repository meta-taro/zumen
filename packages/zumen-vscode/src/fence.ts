/**
 * VS Code の Markdown プレビューで、```` ```zumen ```` の囲みを図の置き場へ替える。
 *
 * **ここでは描かない。** VS Code の `extendMarkdownIt` は同期で返す決まりで、
 * 描画（ELK のレイアウト）は非同期だから。置き場には指定をそのまま持たせ、
 * プレビューの中の小さな台本（`markdown-preview.ts`）が描く。
 *
 * **描けるまでは指定がそのまま見える。** 黙って空にしない（`src/embed.ts` と同じ作法）。
 *
 * 囲みの言語は `src/embed.ts` と同じく、**情報文字列がちょうど `zumen` のときだけ**。
 * 同じ規則を 2 か所に持つことになるので、片方だけ直さない。
 */

/** markdown-it の型を持ち込まずに済ませるための、使う分だけの形。 */
export interface FenceToken {
  info: string;
  content: string;
}

export type FenceRule = (
  tokens: FenceToken[],
  index: number,
  options: unknown,
  env: unknown,
  self: { renderToken: (tokens: FenceToken[], index: number, options: unknown) => string },
) => string;

export interface MarkdownItLike {
  renderer: { rules: { fence?: FenceRule } };
}

export const BLOCK_CLASS = 'zumen-block';
export const SOURCE_ATTRIBUTE = 'data-zumen';

export function isZumenFence(info: string): boolean {
  return info.trim() === 'zumen';
}

export function placeholder(source: string): string {
  return (
    `<div class="${BLOCK_CLASS}" ${SOURCE_ATTRIBUTE}="${escapeHtml(source)}">` +
    `<pre><code>${escapeHtml(source)}</code></pre></div>\n`
  );
}

/** 既にある囲みの描き方は残し、`zumen` の囲みだけを横取りする。 */
export function zumenFence<T extends MarkdownItLike>(md: T): T {
  const fallback: FenceRule =
    md.renderer.rules.fence ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index];
    if (token === undefined || !isZumenFence(token.info)) return fallback(tokens, index, options, env, self);
    return placeholder(token.content);
  };
  return md;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
