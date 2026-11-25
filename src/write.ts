/**
 * **縦組み**（`nodes[].write`）。
 *
 * ## なぜ要るか
 *
 * 大阪メトロの「1 路線を直線に伸ばした案内図」を実物と並べて出た（2026-09-13）。
 * **駅名が縦に組んである。** 駅の間隔は狭く、横書きでは隣の駅名にぶつかる。
 * 縦に組むと、駅の間隔を詰めたまま何十駅でも並べられる。
 *
 * ## 回すのと、積むのは別
 *
 * zumen には既に「箱に沿って**回す**」（`along`）がある。用水路や廊下の名前で使う。
 * **回した日本語は、実物の路線図とは別の見え方になる** ——
 * 実物は字を 1 つずつ上から積んでいて、寝かせていない。
 *
 * ## ラテン文字だけは回す
 *
 * 日本語の縦組みでは、**ラテン文字は 90 度回す**（JIS X 4051 の横倒し）。
 * 実物の路線図も、駅名は積んでありローマ字は寝ている。
 *
 * **文字列ぜんたいで決める。** 1 文字ずつ見分けると
 * 「JR 線」のような混ざった文字列がばらばらの向きになって読めなくなる。
 *
 * ## 値は形の名前だけ
 *
 * `write: station`（駅名）のような**意味の語は足さない**。
 * 断っている「業界ごとの語彙の増殖」が、そこから始まる。
 */

export const WRITES = ['across', 'down'] as const;
export type Write = (typeof WRITES)[number];

const WORDS = new Set<string>(WRITES);

export function writeOf(raw: unknown): Write {
  if (typeof raw !== 'string' || !WORDS.has(raw)) return 'across';
  return raw as Write;
}

/**
 * 縦組みのとき、この文字列を**寝かせる**か。
 *
 * ラテン文字・数字・記号だけなら寝かせる。仮名や漢字が 1 つでもあれば積む。
 */
export function laysDown(text: string): boolean {
  return text !== '' && !/[^ -~]/.test(text);
}

/**
 * **縦組みで、1 字をどこへ・どの向きで描くか**（Issue 016・JIS X 4051）。
 *
 * 横組みの字形をそのまま積むと、句読点はますの左下に、長音記号は横棒のまま出る。
 * 縦組みでは —— 句読点（、。，．）はますの右上、小書きの仮名は少し右上、
 * 長音記号・波ダッシュ・三点リーダー・ダッシュは 90° 回して縦にする。
 *
 * **正本の文字は変えない**（U+FE11 のような縦組み用の字に置き換えない）。描く位置と向きだけ。
 * ずらす量は字の大きさに対する比（`dx`・`dy`、右と下が正）。
 */
export interface Upright {
  readonly dx: number;
  readonly dy: number;
  readonly turn: boolean;
}

const STILL: Upright = { dx: 0, dy: 0, turn: false };
const PUNCT = new Set([...'、。，．']);
// 小書きの仮名（ぁぃぅぇぉっゃゅょゎゕゖ と、その片仮名）。字の並びは文言ではないので符号位置で書く
const SMALL = new Set(
  [0x3041, 0x3043, 0x3045, 0x3047, 0x3049, 0x3063, 0x3083, 0x3085, 0x3087, 0x308e, 0x3095, 0x3096].flatMap((c) => [
    String.fromCodePoint(c),
    String.fromCodePoint(c + 0x60),
  ]),
);
const TURN = new Set([...'ー〜～…‥―－']);

export function uprightGlyph(glyph: string): Upright {
  if (PUNCT.has(glyph)) return { dx: 0.6, dy: -0.62, turn: false };
  if (SMALL.has(glyph)) return { dx: 0.12, dy: -0.1, turn: false };
  if (TURN.has(glyph)) return { dx: 0, dy: 0, turn: true };
  return STILL;
}
