/**
 * **辺の端の記号**（`edges[].ends`）。
 *
 * ## なぜ要るか
 *
 * オーナーの指摘「**その業界専用の表示**を実現してほしい」の続き。
 *
 * ER 図（見本 21）で多重度を **「1 対 多」と文字で**書いていた。
 * **実物は記号で書く** —— 鳥の足（crow's foot）。
 * データベースをやる人は、**文字ではなく端の形で読む。**
 *
 * | 記法 | 読み |
 * |---|---|
 * | 棒 1 本 | 1 |
 * | 鳥の足 | 多 |
 * | 丸 ＋ 棒 | 0 または 1 |
 * | 丸 ＋ 鳥の足 | 0 以上 |
 *
 * 文字で書くと、**辺が増えるほど読めなくなる**（置き場が無くなり、
 * `hiddenLabels` に落ちる）。記号は辺の端に必ず置ける。
 *
 * ## 値は形の名前だけ
 *
 * `marker` と `hatch` と同じ約束。**`ends: one-to-many` のような
 * 意味の語は足さない。** 7 つで閉じる。
 *
 * | 値 | 絵 | 何に使うか |
 * |---|---|---|
 * | `none`（既定） | 何も描かない | ふつうの線 |
 * | `arrow` | 矢印 | 流れ・依存 |
 * | `bar` | 棒 1 本 | ER の「1」・端子 |
 * | `crow` | 鳥の足 | ER の「多」 |
 * | `dot` | 丸 | ER の「0 または」・接続点 |
 * | `dot-bar` | 丸 ＋ 棒 | ER の「0 または 1」 |
 * | `dot-crow` | 丸 ＋ 鳥の足 | ER の「0 以上」 |
 *
 * **端の記号を書いた辺には、既定の矢印を付けない。** 記号が矢印の代わりになる
 * （両方出すと、向きが二重に言われて読めなくなる）。
 */

export const ENDS = ['none', 'arrow', 'bar', 'crow', 'dot', 'dot-bar', 'dot-crow'] as const;
export type End = (typeof ENDS)[number];

export interface Ends {
  /** 始点の記号。 */
  from: End;
  /** 終点の記号。 */
  to: End;
}

export const NO_ENDS: Ends = { from: 'none', to: 'none' };

export function endsOf(raw: unknown): Ends {
  if (raw === null || typeof raw !== 'object') return NO_ENDS;
  const { from, to } = raw as Record<string, unknown>;
  return { from: oneOf(from), to: oneOf(to) };
}

function oneOf(raw: unknown): End {
  return ENDS.includes(raw as End) ? (raw as End) : 'none';
}

export function hasEnds(ends: Ends): boolean {
  return ends.from !== 'none' || ends.to !== 'none';
}

export interface Point {
  x: number;
  y: number;
}

function n(value: number): number {
  return Math.round(value);
}

/**
 * 端の記号を 1 つ描く。
 *
 * `tip` は線の端、`back` はその 1 つ手前の点。
 * **向きは線から決める** —— 正本に角度を書かせない。
 */
export function drawEnd(kind: End, tip: Point, back: Point, stroke: string): string {
  if (kind === 'none' || kind === 'arrow') return '';

  const dx = tip.x - back.x;
  const dy = tip.y - back.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  // 線に沿う向き（内側へ向かう）と、それに直交する向き。
  const ux = -dx / len;
  const uy = -dy / len;
  const px = -uy;
  const py = ux;

  const parts: string[] = [];
  const dotted = kind === 'dot' || kind === 'dot-bar' || kind === 'dot-crow';
  // 丸は端から少し内側。棒と鳥の足はその内側へ続く。
  const gap = dotted ? 11 : 0;

  if (dotted) {
    parts.push(
      `<circle cx="${n(tip.x + ux * 5)}" cy="${n(tip.y + uy * 5)}" r="4" fill="none" stroke="${stroke}" stroke-width="1.2"/>`,
    );
  }

  if (kind === 'bar' || kind === 'dot-bar') {
    // 棒 1 本。**線に直交**して引く。
    const at = { x: tip.x + ux * (gap + 2), y: tip.y + uy * (gap + 2) };
    parts.push(
      `<line x1="${n(at.x + px * 5)}" y1="${n(at.y + py * 5)}" x2="${n(at.x - px * 5)}" y2="${n(at.y - py * 5)}" stroke="${stroke}" stroke-width="1.2"/>`,
    );
  }

  if (kind === 'crow' || kind === 'dot-crow') {
    /**
     * 鳥の足。**多側の実体へ向かって開く。**
     *
     * 一度、逆に描いた（端で束ね、線のほうへ広げた）。
     * それでは矢印に見えてしまい、**向きを言っているように読まれる。**
     * 実物は、束ねた側が線、広がった側が実体（2026-09-12 に直した）。
     */
    const apex = { x: tip.x + ux * (gap + 12), y: tip.y + uy * (gap + 12) };
    for (const side of [-1, 0, 1]) {
      parts.push(
        `<line x1="${n(apex.x)}" y1="${n(apex.y)}" x2="${n(tip.x + px * side * 5)}" y2="${n(tip.y + py * side * 5)}" stroke="${stroke}" stroke-width="1.2"/>`,
      );
    }
  }

  if (kind === 'dot') {
    // 丸だけ。上で描いてある。
  }

  return parts.join('');
}
