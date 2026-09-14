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

export const LINES = ['solid', 'dashed', 'dotted', 'double'] as const;
export type Line = (typeof LINES)[number];

export function lineOf(raw: unknown): Line {
  return LINES.includes(raw as Line) ? (raw as Line) : 'solid';
}

/** SVG の `stroke-dasharray`。実線なら null。 */
export function dashOf(line: Line): string | null {
  if (line === 'dashed') return '7 4';
  if (line === 'dotted') return '2 3';
  return null;
}

/** **同じ道を 2 回描くか**（二重線）。 */
export function doubled(line: Line): boolean {
  return line === 'double';
}

/** 二重線の、外側の線が太くなる分。**この差が、2 本の間隔になる。** */
export const DOUBLE_GAP = 3;
