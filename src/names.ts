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
import { ALIGN_INSET } from './align.ts';
import type { Align } from './align.ts';
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
    /**
     * **紙の外へ出た名前も「混んでいる」に数える。**
     *
     * 紙は右と下へなら広げられるが、**左と上へは広げられない**
     * （人が書いた座標をそのまま出す保証があるので、図ぜんたいをずらせない）。
     * だから切れる。**切れている文字は、重なっている文字と同じく読めない** ——
     * 拾わないと、書いた人は出ていると思ったままになる
     * （2026-09-14。舞台照明仕込図の「シーリング」が左端で切れていた）。
     */
    // **紙の縁は 0**（`frame` は中身の外周であって紙ではない）。
    // 中身の外周より少し外へ出るのは、ふつうに起きるし切れない。
    const clipped = spot.x < 0 || spot.y < 0;
    out.set(box.id, {
      kind: 'outside',
      ...place(box, rows, chosen.side),
      crowded: chosen.cost > 0 || clipped,
    });
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

/**
 * **混んでいる名前** —— **置き場所が無くて、きれいに置けなかったもの。**
 *
 * 2 通りある。どちらも「読めない」という同じ結果になる。
 *
 * - 他の箱や文字に**重なって**置いた
 * - 紙の**外へはみ出して**切れている（左と上へは紙を広げられない）
 */
export function crowdedNames(plans: Map<string, Plan>): string[] {
  return [...plans]
    .filter(([, plan]) => plan.kind === 'outside' && plan.crowded)
    .map(([id]) => id)
    .sort();
}

/**
 * **その箱の文字が占める矩形。** 文字が無ければ null。
 *
 * 外へ出したものは置き場所が決まっている（`place`）ので、そこから起こす。
 * 中に収まったものは箱の真ん中 —— ただし**幅は箱を超えない**（超えていれば
 * `shape` が外へ出している）。
 */
export function textRectOf(box: Box, plan: Plan): Rect | null {
  if (box.label === '') return null;
  const rows = box.technology === null ? 1 : 2;
  if (plan.kind === 'outside') {
    const w = textWidth(box);
    const h = rows * NAME_FONT;
    return { x: plan.x - w / 2, y: plan.above ? plan.y - h : plan.y - NAME_FONT, w, h };
  }
  const text = plan.kind === 'joined' ? plan.text : box.label;
  const w = Math.min(labelWidth(text, NAME_FONT), box.w);
  const h = (plan.kind === 'joined' ? 1 : rows) * NAME_FONT;
  // **寄せた文字は、寄せた先に居る**（`src/align.ts`）。
  // ここを中央のままにすると、左寄せの注記どうしの重なりを見落とす。
  const inset = box.marker === 'none' ? 0 : ALIGN_INSET;
  const left =
    plan.kind === 'stack' || plan.kind === 'along'
      ? box.x + box.w / 2 - w / 2
      : anchorLeft(box.align, box, inset, w);
  return { x: left, y: box.y + box.h / 2 - h / 2, w, h };
}

/**
 * **文字どうしが重なっている組**（配置図だけ）。合否ではなく観測値。
 *
 * 2026-09-14。見本 86 で、注記の箱を動かし忘れて**枠の上に文が乗ったまま**
 * 出ていた。`crowdedNames`・`hiddenLabels`・`crossings` はどれも 0 のまま
 * —— **どれも見ていない所だった。**
 *
 * **箱の重なりは意図のことがある**（枠の中に節を入れる、盤の上に石を置く）。
 * だから `overlaps` は配置図では鳴りっぱなしで、誰も見なくなる。
 * **文字の重なりは、ほぼ必ず間違い**なので、そこだけを数える。
 *
 * **縦組み（`stack`）は数えない。** 字を 1 つずつ積むので、
 * 横幅の見積もりがそのまま当てはまらない。
 */
export function overlappingText(boxes: readonly Box[], plans: Map<string, Plan>): [string, string][] {
  const rects: [string, Rect][] = [];
  for (const box of boxes) {
    const plan = plans.get(box.id);
    if (plan === undefined || plan.kind === 'stack') continue;
    const rect = textRectOf(box, plan);
    if (rect !== null) rects.push([box.id, rect]);
  }

  const found: [string, string][] = [];
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const [aid, a] = rects[i]!;
      const [bid, b] = rects[j]!;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      if (!apart) found.push([aid, bid]);
    }
  }
  return found;
}

/** 符号の文字の大きさ（`src/render.ts` と揃える）。 */
export const TAG_FONT = 10;
/** 符号を箱の角から離す分（`src/layout.ts` の `TAG_INSET` と揃える）。 */
const TAG_GAP = 8;

/**
 * **その箱に符号が入るか。**
 *
 * 入らない符号は描かない（伏図の小梁は幅 20px しかなく、`0×60` と切れて隣へはみ出した）。
 * **丸の中の符号は真ん中**なので角の余白が要らず、矩形より少しだけ広く使える。
 */
export function tagFits(box: Box): boolean {
  if (box.tag === null) return true;
  // **菱形も真ん中へ**（`src/render.ts` と揃える）。角に置くと斜めの辺が文字を横切る。
  const round =
    box.marker === 'circle' ||
    box.marker === 'double' ||
    box.marker === 'ellipse' ||
    box.marker === 'diamond';
  const room = round ? box.w - 4 : box.w - TAG_GAP;
  return labelWidth(box.tag, TAG_FONT) <= room;
}

/**
 * **書いたのに絵に出ない符号**（配置図だけ）。
 *
 * `hiddenLabels`（辺のラベル）と同じ扱い。**黙って落とすのが問題**で、
 * 落とすこと自体は正しい。書いた側が気づけば、印を大きくするか符号を短くできる。
 *
 * 見本 92（防虫モニタリングの定点配置図）で、22px の印に `tag: LT-1` を書いたのに
 * **番号が 1 つも出ていなかった。** 図としては「番号の無い丸が 14 個」で、
 * 定点配置図として成立していない（2026-09-14）。
 */
export function hiddenTags(boxes: readonly Box[]): string[] {
  return boxes.filter((box) => box.tag !== null && !tagFits(box)).map((box) => box.id);
}

/**
 * **広い箱から出ていった名前**（`adriftNames`）。
 *
 * 名前が箱に入らなければ外へ出す。**小さい印ではそれが正しい**
 * —— 駅の丸、回路の記号、伏図の小梁。外に書くのが実物の作法。
 *
 * **広い箱では話が違う。** 表の欄が 330px あって名前が入らないなら、
 * その文字は欄の外へ飛び、**行が空に見える**（2026-09-15。実物を見て見つけた）。
 * `crowdedNames` は当たらなければ何も言わない —— 当たっていないのが問題ではなく、
 * **欄と値が離れてしまったこと**が問題。
 *
 * 見るのは**枠のある広い箱だけ**。図記号（`symbol`）は名前を外へ出すのが決まりなので外す。
 */
const WIDE_ENOUGH = 200;

export function adriftNames(boxes: readonly Box[], plans: Map<string, Plan>): string[] {
  return boxes
    .filter(
      (box) =>
        box.label !== '' &&
        box.w >= WIDE_ENOUGH &&
        box.marker === 'box' &&
        box.symbol === null &&
        plans.get(box.id)?.kind === 'outside',
    )
    .map((box) => box.id)
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

/** 寄せたときの、文字の左端。 */
function anchorLeft(align: Align, box: { x: number; w: number }, inset: number, w: number): number {
  if (align === 'left') return box.x + inset;
  if (align === 'right') return box.x + box.w - inset - w;
  return box.x + box.w / 2 - w / 2;
}
