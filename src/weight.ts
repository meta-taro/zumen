/**
 * **線の太さ**（`edges[].weight`）。
 *
 * ## なぜ要るか
 *
 * オーナーの指示（2026-09-13）——「路線図は**日本の路線図を参考に**描けるように
 * なってほしい」。
 *
 * 実物の決まりごとを調べた。
 *
 * | | |
 * |---|---|
 * | 線の角度 | **水平・垂直・斜め 45 度のみ** |
 * | 駅の識別 | **駅ナンバリング**（路線記号＋番号）。色と番号で読む |
 * | 線 | **太く、角を丸く**（丸ゴシック体に合わせた柔らかさ） |
 * | 乗換駅 | 駅名を白枠に収める |
 *
 * **45 度は座標で書ける。駅ナンバリングは `tag` で書ける。**
 * 足りなかったのは**線の太さだけ** —— いまは 2px で、駅の丸の枠より細い。
 *
 * ## 値は太さの名前だけ
 *
 * `marker` `hatch` `ends` `line` と同じ約束。
 * **`weight: subway`（地下鉄）のような意味の語も、`weight: 5` のような数も足さない。**
 * 数を許すと、正本ごとに太さがばらけて**図の見え方が揃わなくなる。**
 *
 * ## 色は入れていない
 *
 * 日本の路線図は**色が路線の名前**（銀座線はオレンジ）。
 * だが zumen は「**色ではなく形で意味を持たせる**」と決めてある
 * （`DESIGN.md` §7。白黒で印刷しても、色覚特性でも、縮小しても失われないため）。
 *
 * **これは人が決めることなので、勝手に変えない**（ベースルール §15）。
 * 白黒でも路線を見分ける道は、実物にもある —— **駅ナンバリングの路線記号**
 * （`G-09` の `G`）と、**線種**（`line: dashed`）。
 */

export const WEIGHTS = ['thin', 'normal', 'thick'] as const;
export type Weight = (typeof WEIGHTS)[number];

export function weightOf(raw: unknown): Weight {
  return WEIGHTS.includes(raw as Weight) ? (raw as Weight) : 'normal';
}

/**
 * 太さ（px）。
 *
 * **`thick` を 6px より太くしない。** 駅の丸（枠 1px・直径 34px）より太くすると、
 * 丸が線に埋もれて駅に見えなくなる。
 */
export function widthOf(weight: Weight): number {
  if (weight === 'thin') return 1;
  if (weight === 'thick') return 5;
  return 2;
}

/**
 * 角と端を丸めるか。
 *
 * **太い線だけ丸める。** 日本の路線図は角丸で描く決まりで、
 * 細い線で丸めても見た目は変わらないのに、要素だけ増える。
 */
export function roundedOf(weight: Weight): boolean {
  return weight === 'thick';
}
