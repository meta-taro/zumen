/**
 * **文字の寄せ**（`nodes[].align`）。
 *
 * ## なぜ要るか
 *
 * 2026-09-15、見本 111（閉塞と信号現示）を**ブラウザで見て**出た。
 * 注記を 8 行並べたら、**1 行ごとに左端がずれて**、箇条書きに見えなかった。
 *
 * zumen の文字は長いあいだ**すべて中央寄せ**だった（`text-anchor="middle"`）。
 * 箱の中の名前は、それでいい —— 部屋名も駅名も中央にある。
 * **注記だけは違う。** 行の長さが揃わないので、中央に置くと左端が毎行ずれる。
 *
 * 見本を数えたら、**25 枚・158 行**が同じ形で出ていた。
 * 1 枚の事故ではなく、注記を書くたびに起きていた。
 *
 * ## 値は位置の名前だけ
 *
 * `align: note`（注記）・`align: caption` のような**役割の語は足さない**（D22）。
 * 寄せ先は left / center / right の 3 つで閉じる。
 *
 * ## 効く所を広げない
 *
 * 効くのは**横組みで、箱の中に収まった名前**だけ。
 * 縦組み（`stack`）・回した字（`along`）・外へ出した名前（`outside`）では
 * 「左」の指すものが変わるので、**既定のまま**にする。
 */

export const ALIGNS = ['left', 'center', 'right'] as const;
export type Align = (typeof ALIGNS)[number];

const WORDS = new Set<string>(ALIGNS);

export function alignOf(raw: unknown): Align {
  if (typeof raw !== 'string' || !WORDS.has(raw)) return 'center';
  return raw as Align;
}

/**
 * 枠から文字を離す分。
 *
 * **印の無い箱（`marker: none`）では 0。** 枠が無いのだから、
 * 書き手が置いた `at.x` がそのまま行頭であってほしい（注記はこれ）。
 * 枠のある箱では少し入れる —— 線に文字がぶつかると読みにくい。
 */
export const ALIGN_INSET = 6;

/** 寄せたときの、文字の基準 x と `text-anchor`。 */
export function anchorOf(
  align: Align,
  box: { x: number; w: number },
  inset: number,
): { x: number; anchor: 'start' | 'middle' | 'end' } {
  if (align === 'left') return { x: box.x + inset, anchor: 'start' };
  if (align === 'right') return { x: box.x + box.w - inset, anchor: 'end' };
  return { x: box.x + box.w / 2, anchor: 'middle' };
}
