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
 * | `triangle` | 中抜きの三角 | UML の汎化（継承）・実現 |
 * | `diamond` | 中抜きの菱形 | UML の集約 |
 * | `solid-diamond` | 塗った菱形 | UML のコンポジション |
 *
 * **端の記号を書いた辺には、既定の矢印を付けない。** 記号が矢印の代わりになる
 * （両方出すと、向きが二重に言われて読めなくなる）。
 */

export const ENDS = [
  'none',
  'arrow',
  'bar',
  'crow',
  'dot',
  'dot-bar',
  'dot-crow',
  'triangle',
  'diamond',
  'solid-diamond',
] as const;
export type End = (typeof ENDS)[number];

export interface Ends {
  /** 始点の記号。 */
  from: End;
  /** 終点の記号。 */
  to: End;
}

export const NO_ENDS: Ends = { from: 'none', to: 'none' };

/**
 * 端の記号を読む。**書いていなければ `null`。**
 *
 * `{ from: none, to: none }` と「書いていない」を区別する。
 * **書いてあれば、既定の矢印を出さない** —— UML の関連線は無向で、
 * `ends: { to: none }` と書いたのに矢印が出ると、
 * 「向きがある」という別の意味になる（2026-09-12 に実際にそうなった）。
 */
export function endsOf(raw: unknown): Ends | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null;
  const { from, to } = raw as Record<string, unknown>;
  return { from: oneOf(from), to: oneOf(to) };
}

function oneOf(raw: unknown): End {
  return ENDS.includes(raw as End) ? (raw as End) : 'none';
}

/** 端の記号を書いたか。**書いてあれば、既定の矢印は出さない。** */
export function hasEnds(ends: Ends | null): boolean {
  return ends !== null;
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
export function drawEnd(
  kind: End,
  tip: Point,
  back: Point,
  stroke: string,
  /** 地の色。**中抜きの記号を塗るのに使う**（線が透けると意味が変わる）。 */
  paper = '#ffffff',
): string {
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

  if (kind === 'triangle') {
    // **中抜きの三角**（UML の汎化・実現）。**地の色で塗る** ——
    // 線が三角の中を通って見えると、汎化ではなく「単なる矢印」に見える。
    const back2 = { x: tip.x + ux * 12, y: tip.y + uy * 12 };
    parts.push(
      `<path d="M ${n(tip.x)} ${n(tip.y)} L ${n(back2.x + px * 6)} ${n(back2.y + py * 6)} ` +
        `L ${n(back2.x - px * 6)} ${n(back2.y - py * 6)} Z" fill="${paper}" stroke="${stroke}" stroke-width="1.2"/>`,
    );
  }

  if (kind === 'diamond' || kind === 'solid-diamond') {
    // 菱形（UML の集約・コンポジション）。**塗りの有無で意味が変わる。**
    const mid = { x: tip.x + ux * 7, y: tip.y + uy * 7 };
    const far = { x: tip.x + ux * 14, y: tip.y + uy * 14 };
    const fill = kind === 'solid-diamond' ? stroke : paper;
    parts.push(
      `<path d="M ${n(tip.x)} ${n(tip.y)} L ${n(mid.x + px * 5)} ${n(mid.y + py * 5)} ` +
        `L ${n(far.x)} ${n(far.y)} L ${n(mid.x - px * 5)} ${n(mid.y - py * 5)} Z" ` +
        `fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`,
    );
  }

  return parts.join('');
}
