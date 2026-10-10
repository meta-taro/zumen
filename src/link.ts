/**
 * **節のリンク**（`nodes[].link`。仕様 §3.0.24。2026-10-10）。
 *
 * 図を Markdown の本文に埋めたとき、箱から本文の該当節・別の図・外の文書へ飛べるようにする。
 * D2・Mermaid・Ilograph が持っていて、zumen に無かった（`docs/aeo/competitors-2026-10-10.md`）。
 *
 * **URL を持つだけ。** 別の図の中身は取り込まない（図の分割は保留中。D30）。
 *
 * ## 通す書き方
 *
 * `http:` ／ `https:` ／ `mailto:` と、スキームの無い相対パス（`./order-db.zumen.yaml`・`#在庫`）。
 * **`javascript:` ・ `data:` などは通さない** —— 図は人から人へ渡り、Markdown の本文に埋まる。
 * 開いた人の手元で何かを実行させる口にしない。
 */

const ALLOWED = /^(https?:|mailto:)/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** 通してよいリンクなら、その文字列。だめなら null。 */
export function linkOf(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (value === '') return null;
  if (ALLOWED.test(value)) return value;
  // スキームが付いていて、許したもの以外（javascript: ・ data: ・ file: など）。
  if (SCHEME.test(value)) return null;
  return value;
}
