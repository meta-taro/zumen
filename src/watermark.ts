/**
 * **透かし**（`watermark`）。図の真ん中を斜めに横切る薄い字と、その下の 1 行。
 *
 * 2026-11-11。公的な様式（届書・履歴書の様式例・税の様式）を PDF から写した見本は、
 * 罫線が原本と重ねてぴったり合う（見本 421・422 を重ねて確かめた）。**刷ればそのまま出せてしまう。**
 * 婚姻届は自分で刷った A3 でも受け付けられる。だから「本物として使わせない」印を図そのものに入れる。
 *
 * 字は製品名ではなく「見本 SAMPLE」のように**無効であることが伝わる語**にする（役所の記載例も「見本」「記載例」と入れる）。
 * 下の 1 行には、**いつ時点の様式を写したか**と、公式ではないことを書く。
 *
 * ```yaml
 * watermark:
 *   text: 見本 SAMPLE
 *   note: 2026-11-10 時点の様式を写したもの。公式の様式ではなく、提出には使えません
 * ```
 *
 * `watermark: 見本 SAMPLE` と字だけを書いてもよい。
 */

export interface Watermark {
  text: string;
  /** 透かしの下に添える 1 行（いつ時点か・公式ではないこと）。書かなければ null。 */
  note: string | null;
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** 読めなければ null（`validate` が知らせる）。 */
export function watermarkOf(raw: unknown): Watermark | null {
  const direct = text(raw);
  if (direct !== null) return { text: direct, note: null };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const body = text(r.text);
  return body === null ? null : { text: body, note: text(r.note) };
}

/** 透かしの字の濃さ（下の図が読める薄さ）と、添える 1 行の濃さ。 */
export const WATERMARK_OPACITY = 0.14;
export const WATERMARK_NOTE_OPACITY = 0.38;
