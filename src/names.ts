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
 * | `along` | 帯に沿って**縦へ** | 用水路・廊下（横に入らない） |
 * | `outside` | 箱の外へ | それ以外 |
 *
 * ## 外へ出すときは、当たりを見る
 *
 * 上下左右の 4 方向を順に試し、**他の箱にも、先に置いた文字にも当たらない**
 * 場所を選ぶ。どこも空いていなければ、**いちばん当たりの少ない所へ置いて、
 * 混んでいることを記録する**（`crowded`）。
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
function shape(box: Box): 'inside' | 'joined' | 'aside' | 'along' | 'outside' {
  // **印を付けたものの文字。**
  //
  // 丸は小さいので、たいてい中に名前が入らない
  // —— 実物の路線図も駅名は丸の外に書く。
  //
  // **ただし丸に入る短い文字は、中に書く。**
  // 盛付指示書の丸数字（①②③）や駅番号がそれで、
  // **中に書くことがその印の意味**（外へ出すと、何の番号か分からなくなる）。
  if (box.marker === 'circle' || box.marker === 'double') {
    const bore = Math.min(box.w, box.h) * (box.marker === 'double' ? 0.5 : 1);
    return labelWidth(box.label, NAME_FONT) + 6 <= bore && box.technology === null
      ? 'inside'
      : 'outside';
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

/** 外へ出す文字が占める矩形。 */
function patch(box: Box, rows: number, above: boolean): Rect {
  const w = Math.max(
    labelWidth(box.label, NAME_FONT),
    box.technology === null ? 0 : labelWidth(box.technology, SUB_FONT),
  );
  const h = rows * 12 + 4;
  return {
    x: box.x + box.w / 2 - w / 2,
    y: above ? box.y - 6 - h : box.y + box.h + 4,
    w,
    h,
  };
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
export function planNames(boxes: readonly Box[], frame: Rect | null): Map<string, Plan> {
  const out = new Map<string, Plan>();
  const taken: Rect[] = [];
  const solid: Rect[] = boxes.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
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
    // 上下を試す。**図の外へ出るほうは先に落とす**（y が負になると消える）。
    const sides: boolean[] = [];
    const roomAbove = frame === null ? Infinity : box.y - frame.y;
    if (roomAbove >= rows * 12 + 6) sides.push(true);
    sides.push(false);

    let best: { above: boolean; cost: number } | null = null;
    for (const above of sides) {
      const spot = patch(box, rows, above);
      // 自分の箱は当たりに数えない（外へ出しているので触れていて当然）。
      const cost =
        solid.reduce((sum, r) => sum + (r === undefined ? 0 : hits(spot, r)), 0) -
        hits(spot, { x: box.x, y: box.y, w: box.w, h: box.h }) +
        taken.reduce((sum, r) => sum + hits(spot, r) * 2, 0);
      if (best === null || cost < best.cost) best = { above, cost };
      if (cost === 0) break;
    }

    const chosen = best!;
    const spot = patch(box, rows, chosen.above);
    taken.push(spot);
    out.set(box.id, {
      kind: 'outside',
      x: box.x + box.w / 2,
      y: chosen.above ? box.y - 6 : box.y + box.h + 13,
      above: chosen.above,
      crowded: chosen.cost > 0,
    });
  }
  return out;
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
