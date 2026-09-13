/**
 * **配置図の文字を、どこへ置くか。**
 *
 * ## なぜ選ぶ必要があるか
 *
 * 配置図は**箱の大きさを人と AI が書く**ので、入らない箱が出る。
 * 構成図では起きない（箱の大きさを文字から決めるので必ず入る）。
 *
 * 落とすのは行き過ぎで（路線図で駅名が全部消えた）、
 * 何でも外へ出すと**他の部屋の上に落ちる**（映画館の横通路で出た）。
 *
 * ## 5 段で選ぶ
 *
 * | | 置き方 | そうする図 |
 * |---|---|---|
 * | `inside` | そのまま中へ | ふつうの部屋 |
 * | `joined` | 名前と副題を**1 行に繋いで**中へ | 通路・農道（背が低い） |
 * | `aside` | 名前は中へ、**副題を横に回して**添える | 駐車場の区画（`W1`／`車椅子 3,500`） |
 * | `along` | 帯に沿って**縦へ**（寝かせる） | 用水路・廊下（横に入らない） |
 * | `stack` | **字を 1 つずつ積む**（`write: down`） | 路線の駅名一覧 |
 * | `outside` | 箱の外へ | それ以外 |
 *
 * ## 外へ出すときは、当たりを見る
 *
 * 上下左右の 4 方向を順に試し、**他の箱にも、先に置いた文字にも、線にも当たらない**
 * 場所を選ぶ。どこも空いていなければ、**いちばん当たりの少ない所へ置いて、
 * 混んでいることを記録する**（`crowded`）。
 *
 * **線を避けるのは、路線図で要る。** 中央駅のように上下へ路線が抜ける駅は
 * 真上も真下も空いていない —— 実物の路線図は、こういう駅名を横へ逃がしてある。
 *
 * **消さない。** 部屋の名前が消えるのは、重なるより悪い。
 * 辺のラベル（`src/edge-labels.ts`）は消してよいが、あれは
 * 「どこへ繋がるか」が線で分かるから消せる。**名前は線では分からない。**
 */
import type { Box } from './layout.ts';
import { labelWidth } from './layout.ts';

/** 文字の大きさ（`src/render.ts` と揃える）。 */
export const NAME_FONT = 12;
export const SUB_FONT = 10;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Plan =
  | { kind: 'inside' }
  | { kind: 'joined'; text: string }
  | { kind: 'aside' }
  | { kind: 'along' }
  | { kind: 'stack' }
  | { kind: 'outside'; x: number; y: number; above: boolean; crowded: boolean };

/** 横に入るか。 */
function wide(box: Box, text: string, font: number): boolean {
  return labelWidth(text, font) + 6 <= box.w;
}

/** 名前と副題を繋いだもの。 */
export function joinedText(box: Box): string {
  return box.technology === null ? box.label : `${box.label}　${box.technology}`;
}

/** その箱の文字が外へ出るか（外へ出るものだけ、置き場所を探す）。 */
export function goesOutside(box: Box): boolean {
  const plan = shape(box);
  return plan === 'outside';
}

/** 5 段のどれになるかを、当たり判定なしで決める。 */
function shape(box: Box): 'inside' | 'joined' | 'aside' | 'along' | 'stack' | 'outside' {
  // **縦組みは正本が書いたとおりにする**（`src/write.ts`）。
  // 5 段の判断より先 —— 書いてあるものを機械が選び直さない。
  if (box.write === 'down') return 'stack';
  // **図記号の文字は外へ出す**（`src/symbol.ts`）。
  // 実物の回路図も、部品名（R1）と値（10kΩ）は記号の脇に書いてある。
  if (box.symbol !== null) return 'outside';
  // **印を付けたものの文字。**
  //
  // 丸は小さいので、たいてい中に名前が入らない
  // —— 実物の路線図も駅名は丸の外に書く。
  //
  // **ただし丸に入る短い文字は、中に書く。**
  // 盛付指示書の丸数字（①②③）や駅番号がそれで、
  // **中に書くことがその印の意味**（外へ出すと、何の番号か分からなくなる）。
  if (box.marker === 'circle' || box.marker === 'double') {
    /**
     * **印の中に置けるのは 1 つだけ。**
     *
     * 符号（`tag`）があるなら、中はそれのもの ——
     * 路線図の丸に入るのは**駅番号**で、駅名は外（実物もそう）。
     * 符号が無いときだけ、短い名前が中に入る（盛付指示書の丸数字がそれ）。
     *
     * 一度、符号があるのに短い名前まで中へ入れた（2026-09-13）。
     * **駅名が駅番号に重なった。**
     */
    const bore = Math.min(box.w, box.h) * (box.marker === 'double' ? 0.5 : 1);
    const alone = box.technology === null && box.tag === null;
    return alone && labelWidth(box.label, NAME_FONT) + 6 <= bore ? 'inside' : 'outside';
  }
  // **楕円と菱形は、中に文字が入る。** UML のユースケース名と判断の条件は
  // 中に書くのが決まり（外へ出すと、どの図形の話か分からなくなる）。
  // 矩形と同じ段で見る。
  //
  // **帯（`bar`）は塗った面**なので、中に書くと読めない。外へ出す。
  if (box.marker === 'bar') return 'outside';
  // 枠なし（`none`）は「枠を描かない注記」。**文字は箱の場所に置く** ——
  // 枠が無いのに「枠の外」へ出しても意味が無い（座席図の列名 A〜F がこれ）。
  // 以降の段（入るか／繋ぐか／回すか）は矩形と同じに見る。
  if (box.technology === null && wide(box, box.label, NAME_FONT)) return 'inside';
  if (
    box.technology !== null &&
    box.h >= 34 &&
    wide(box, box.label, NAME_FONT) &&
    wide(box, box.technology, SUB_FONT)
  ) {
    return 'inside';
  }
  if (box.technology !== null && box.h < 34 && wide(box, joinedText(box), NAME_FONT)) {
    return 'joined';
  }
  if (
    box.technology !== null &&
    wide(box, box.label, NAME_FONT) &&
    labelWidth(box.technology, SUB_FONT) + 8 <= box.h &&
    box.w >= 30
  ) {
    return 'aside';
  }
  if (
    !wide(box, box.label, NAME_FONT) &&
    box.h > box.w &&
    labelWidth(box.label, NAME_FONT) + 8 <= box.h
  ) {
    return 'along';
  }
  return 'outside';
}

/**
 * 外へ出す先。**上下・左右・斜めの 8 方向。**
 *
 * 斜めは路線図で要る —— 上下左右へ路線が抜ける乗換駅は、
 * 4 方向がすべて線で塞がっている。**実物の路線図も、そこは斜めに書いてある。**
 */
type Side =
  | 'above'
  | 'below'
  | 'left'
  | 'right'
  | 'above-left'
  | 'above-right'
  | 'below-left'
  | 'below-right';

/**
 * 丸からは、もう少し離す。
 *
 * 丸は箱いっぱいに描かれるので、箱の縁から詰めると
 * **文字の端が丸の線に触れる**（2026-09-13。日本式の路線図で出た）。
 */
function clearOf(box: Box): number {
  return box.marker === 'circle' || box.marker === 'double' ? 5 : 0;
}

/** 外へ出す文字の幅。 */
function textWidth(box: Box): number {
  return Math.max(
    labelWidth(box.label, NAME_FONT),
    box.technology === null ? 0 : labelWidth(box.technology, SUB_FONT),
  );
}

/** 文字の中心を、どこへ置くか（横方向）。 */
function centerX(box: Box, side: Side): number {
  const mid = box.x + box.w / 2;
  const step = textWidth(box) / 2 + 6 + clearOf(box);
  if (side === 'left' || side === 'above-left' || side === 'below-left') return mid - step - box.w / 2;
  if (side === 'right' || side === 'above-right' || side === 'below-right') return mid + step + box.w / 2;
  return mid;
}

/** 上へ積むか（1 行目の基準線から上へ伸ばすか）。 */
function goesUp(side: Side): boolean {
  return side === 'above' || side === 'above-left' || side === 'above-right';
}

/** 横だけへ出すか（箱の高さの真ん中へ揃える）。 */
function sideways(side: Side): boolean {
  return side === 'left' || side === 'right';
}

/** 外へ出す文字が占める矩形。 */
function patch(box: Box, rows: number, side: Side): Rect {
  const w = textWidth(box);
  const h = rows * 12 + 4;
  const gap = clearOf(box);
  const x = centerX(box, side) - w / 2;
  if (sideways(side)) return { x, y: box.y + box.h / 2 - h / 2, w, h };
  if (goesUp(side)) return { x, y: box.y - 6 - gap - h, w, h };
  return { x, y: box.y + box.h + 4 + gap, w, h };
}

/**
 * **線を、当たり判定の障害物にする。**
 *
 * 斜めの線があるので、外接矩形では大きく取りすぎる。
 * **点列を細かく刻んで、小さな四角の列にする**（曲がりにも斜めにも効く）。
 */
export function edgeObstacles(edges: readonly EdgeShape[]): Rect[] {
  const out: Rect[] = [];
  const half = 4;
  for (const edge of edges) {
    for (let i = 1; i < edge.points.length; i += 1) {
      const a = edge.points[i - 1]!;
      const b = edge.points[i]!;
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(span / 8));
      for (let k = 0; k <= steps; k += 1) {
        const t = k / steps;
        out.push({
          x: a.x + (b.x - a.x) * t - half,
          y: a.y + (b.y - a.y) * t - half,
          w: half * 2,
          h: half * 2,
        });
      }
    }
  }
  return out;
}

/** 線の形（`src/layout.ts` の `PlacedEdge` の、ここで要る分だけ）。 */
export interface EdgeShape {
  points: readonly { x: number; y: number }[];
}

function hits(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return x * y;
}

/**
 * 図の中の文字の置き方を、全部まとめて決める。
 *
 * **順番は大きい箱から。** 大きい部屋の名前を先に置く
 * （小さい箱の名前に押し出されると、広い部屋の名前が外へ行く）。
 */
export function planNames(
  boxes: readonly Box[],
  frame: Rect | null,
  edges: readonly EdgeShape[] = [],
): Map<string, Plan> {
  const out = new Map<string, Plan>();
  const taken: Rect[] = [];
  const solid: Rect[] = boxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
  const wires = edgeObstacles(edges);
  const order = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h);

  for (const box of order) {
    const kind = shape(box);
    if (kind === 'joined') {
      out.set(box.id, { kind, text: joinedText(box) });
      continue;
    }
    if (kind !== 'outside') {
      out.set(box.id, { kind });
      continue;
    }

    const rows = box.technology === null ? 1 : 2;
    // **上下を先に試す**（読み慣れた置き方）。横は、上下が塞がっているときだけ。
    // 図の外へ出るほうは先に落とす（y が負になると消える）。
    /**
     * **左と上へは、はみ出せない。**
     *
     * 紙は右と下へなら広げられる（`src/render.ts` が文字の分だけ広げる）が、
     * 左と上へ出た文字は座標が負になり、**viewBox に入らず消える。**
     * 中身を全部ずらせば入るが、それは人が書いた座標を動かすことになる。
     */
    const roomAbove = frame === null || box.y - frame.y >= rows * 12 + 6;
    const roomLeft = frame === null || box.x - frame.x >= textWidth(box) + box.w / 2 + 6;
    // **読み慣れた順に試す。** 斜めは、上下左右が塞がっているときだけ。
    const sides: Side[] = [];
    if (roomAbove) sides.push('above');
    sides.push('below', 'right');
    if (roomLeft) sides.push('left');
    if (roomAbove) sides.push('above-right');
    sides.push('below-right');
    if (roomLeft) {
      if (roomAbove) sides.push('above-left');
      sides.push('below-left');
    }

    let best: { side: Side; cost: number } | null = null;
    for (const side of sides) {
      const spot = patch(box, rows, side);
      // 自分の箱は当たりに数えない（外へ出しているので触れていて当然）。
      const cost =
        solid.reduce((sum, r) => sum + (r === undefined ? 0 : hits(spot, r)), 0) -
        hits(spot, { x: box.x, y: box.y, w: box.w, h: box.h }) +
        taken.reduce((sum, r) => sum + hits(spot, r) * 2, 0) +
        wires.reduce((sum, r) => sum + hits(spot, r), 0);
      if (best === null || cost < best.cost) best = { side, cost };
      if (cost === 0) break;
    }

    const chosen = best!;
    const spot = patch(box, rows, chosen.side);
    taken.push(spot);
    out.set(box.id, { kind: 'outside', ...place(box, rows, chosen.side), crowded: chosen.cost > 0 });
  }
  return out;
}

/**
 * 外へ出す文字の、1 行目の基準線と積む向き。
 *
 * **ここで余白まで決める**（`src/render.ts` は決まったとおりに描くだけ）。
 */
function place(box: Box, rows: number, side: Side): { x: number; y: number; above: boolean } {
  const gap = clearOf(box);
  const x = centerX(box, side);
  // 横は、箱の高さの真ん中へ揃えて下へ積む。
  if (sideways(side)) return { x, y: box.y + box.h / 2 - (rows - 1) * 6 + 4, above: false };
  if (goesUp(side)) return { x, y: box.y - 6 - gap, above: true };
  return { x, y: box.y + box.h + 13 + gap, above: false };
}

/** **混んでいる名前**（他の箱や文字に重なって置いたもの）。人へ出す。 */
export function crowdedNames(plans: Map<string, Plan>): string[] {
  return [...plans]
    .filter(([, plan]) => plan.kind === 'outside' && plan.crowded)
    .map(([id]) => id)
    .sort();
}

/** 箱ぜんたいが占める矩形。**外へ出す先が図の外にならないか**を見るのに使う。 */
export function extentOf(boxes: readonly Box[]): Rect | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}
