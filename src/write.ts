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
 * D22 で断った語彙の増殖が、そこから始まる。
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
