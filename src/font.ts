/**
 * **書体を図に埋め込む**（2026-09-28。`.claude/decisions.md` の D44）。
 *
 * 図の字は、開いた端末の `sans-serif` で描かれる。**訓練で iPad、災害時に Android** で開くと、
 * 同じ図が違う字面で出て、字の幅も変わる。書き出すときにだけ、**その図で使う字だけを
 * 切り出した Noto Sans JP**（SIL OFL 1.1、`fonts/OFL.txt`）を SVG の中に入れる。
 *
 * - **文字は文字のまま。** 線の形（アウトライン）に変えないので、選べる・探せる・読み上げられる
 * - **紹介ページの見本には入れない。** 全部に入れるとリポジトリが約 60MB 増える
 * - 画像（`<img>`）として出しても効く —— 外の書体を読みに行かないから
 *
 * 書体名は `zumen-embed`。OFL の予約書体名（`Source`）は使わない。
 */
import { readFileSync } from 'node:fs';
// @ts-expect-error subset-font は型を持たない（BSD-3-Clause。harfbuzz を wasm で使う）
import subsetFont from 'subset-font';

export const EMBEDDED_FAMILY = 'zumen-embed';

const FONT = new URL('../fonts/NotoSansJP-VF.woff2', import.meta.url);

/** 太さは 400（本文）と 600（見出し・表の頭）しか使わないので、その範囲だけ残す。 */
const WEIGHTS = { wght: { min: 400, max: 600 } };

let cached: Buffer | null = null;
function font(): Buffer {
  cached ??= readFileSync(FONT);
  return cached;
}

/** SVG の中の文字（`<text>` と `<title>` の中身）を、重ねずに集める。 */
function charsOf(svg: string): string {
  const parts = [...svg.matchAll(/<(text|title)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2] ?? '');
  const plain = parts
    .join('')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return [...new Set(plain)].join('');
}

export async function embedFont(svg: string): Promise<string> {
  const chars = charsOf(svg).replace(/\s/g, '');
  if (chars === '') return svg;
  const woff2: Buffer = await subsetFont(font(), chars, { targetFormat: 'woff2', variationAxes: WEIGHTS });
  const face = `<style>@font-face{font-family:"${EMBEDDED_FAMILY}";src:url(data:font/woff2;base64,${woff2.toString('base64')}) format("woff2");}</style>`;
  return svg
    .replace(/(<svg\b[^>]*>)/, `$1${face}`)
    .replace(/font-family="sans-serif"/g, `font-family="${EMBEDDED_FAMILY}, sans-serif"`);
}
