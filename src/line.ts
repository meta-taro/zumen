/**
 * **辺の線種**（`edges[].line`）。
 *
 * ## なぜ要るか
 *
 * UML のクラス図で、**実線と破線は別の意味**を持つ。
 *
 * | | 線 | 端 |
 * |---|---|---|
 * | 汎化（継承） | **実線** | 中抜きの三角 |
 * | 実現（インタフェース） | **破線** | 中抜きの三角 |
 * | 依存 | **破線** | 矢印 |
 * | 集約 | 実線 | 中抜きの菱形 |
 *
 * **端の記号が同じでも、線種で意味が変わる。**
 * 汎化と実現は端が同じ三角で、**実線か破線かでしか区別できない。**
 *
 * UML 以外にも効く —— 仮設・計画線・将来増設・撤去予定は、
 * どの業界の図面でも破線か点線で描く。
 *
 * ## 二重線
 *
 * 相続関係説明図・家系図では、**婚姻が二重線、親子が単線**と決まっている
 * （法務局の記載例）。**太さでも破線でも代わりにならない** ——
 * 二重線であること自体が記法で、読む側はそれで婚姻を見分けている。
 *
 * 描き方は「**太い線を引いて、その上に地の色で細い線を重ねる**」。
 * 平行な線を 2 本計算し直さないので、折れ線でも曲線でも同じやり方で効く。
 * **下にあるものは隠れる**（実物の二重線も紙を占める）。
 *
 * ## 値は線種の名前だけ
 *
 * `marker` `hatch` `ends` と同じ約束。
 * **`line: dependency`（依存）や `line: marriage`（婚姻）のような
 * 意味の語は足さない。** 足すのは線の形の名前だけ。
 */

/**
 * ## 一点鎖線（`chain`）
 *
 * **中心線・対称軸・光軸・基準線・切断線は一点鎖線**と、製図で決まっている
 * （JIS Z 8312 の細い一点鎖線）。実線でも破線でもない ——
 * **線種そのものが「これは実体ではなく基準だ」と言っている。**
 *
 * これは**通り芯（`grid`）だけが持っていて、人が引く線には無かった**
 * （2026-09-19。見本 191 の光軸で当たった）。
 * 点線で代用すると、点線は「見えない輪郭」の意味を持つので、読む側には別の意味に見える。
 * 刻みは通り芯と同じ —— **1 枚の紙で基準線の見た目が割れないように。**
 */
export const LINES = ['solid', 'dashed', 'dotted', 'double', 'chain'] as const;
export type Line = (typeof LINES)[number];

export function lineOf(raw: unknown): Line {
  return LINES.includes(raw as Line) ? (raw as Line) : 'solid';
}

/** **一点鎖線の刻み。** 通り芯（`src/dimensions.ts`）と同じ値を使う。 */
export const CHAIN = '14 3 3 3';

/** SVG の `stroke-dasharray`。実線なら null。 */
export function dashOf(line: Line): string | null {
  if (line === 'dashed') return '7 4';
  if (line === 'dotted') return '2 3';
  if (line === 'chain') return CHAIN;
  return null;
}

/** **同じ道を 2 回描くか**（二重線）。 */
export function doubled(line: Line): boolean {
  return line === 'double';
}

/** 二重線の、外側の線が太くなる分。**この差が、2 本の間隔になる。** */
export const DOUBLE_GAP = 3;
