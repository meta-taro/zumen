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
 * ## 値は線種の名前だけ
 *
 * `marker` `hatch` `ends` と同じ約束。
 * **`line: dependency`（依存）のような意味の語は足さない。**
 */

export const LINES = ['solid', 'dashed', 'dotted'] as const;
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
