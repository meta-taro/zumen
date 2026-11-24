/**
 * 辺のラベルを、**読める場所にだけ置く**（Issue #3 の 3）。
 *
 * 報告された壊れ方は、`画像` と `②DB行` が同じ座標に描かれ、
 * **「画像DB行」という別の語に見えた**というもの。
 *
 * 重なった文字は、無い文字より悪い。無ければ「書いていない」と分かるが、
 * 重なると**嘘の情報として読めてしまう。**
 * だからここは、ずらして駄目なら**出さない**。
 *
 * 直交ルーティング（#3 の 1）で線が回り込むようになったため、
 * 両端の中点はもう線の上ではない。**弧長の半分**で置き場所を決める。
 */
import { labelWidth } from './layout.ts';
import type { Box, PlacedEdge } from './layout.ts';

/** 辺のラベルの字の大きさ。`src/render.ts` と揃える。 */
const FONT = 11;

/** 文字の高さの見積り。当たり判定にだけ使う。 */
const LINE = 14;

/** 囲みの題の字の大きさと左の余白。`src/render.ts` と揃える。 */
const GROUP_FONT = 13;
const GROUP_TITLE_PAD = 12;

/**
 * 囲みの見出しが占める帯の高さ（囲みの上端から）。
 *
 * `src/render.ts` は囲みの題を上端 + 22 のベースラインに 13px で描く。
 * **その帯を辺のラベルが通ると、囲みの名前と重なって両方読めなくなる**
 * （`doko001（さくら VPS）` に `掲載停止` が 7px かぶった。2026-09-07）。
 */
const GROUP_TITLE_BAND = 30;

/** 線から浮かせる量。線の上に字が乗ると読めない。 */
const LIFT = 6;

/**
 * 線のどちら側に置くか。**上を先に試す。**
 *
 * 上だけだと、同じ通り道を何本も通る図（辺が密なところ）で置き場が尽きる。
 * 下も使うと倍になる。どちらでも同じ線を指しているので、読み間違えない。
 */
const SIDES = [-LIFT, LIFT + LINE - 3];

/**
 * 線に沿って試す位置（弧長に対する割合）。
 *
 * 中央から始めて、外側へ広げる。**端に寄せすぎると、どの辺のラベルか分からなくなる**ので
 * 0.25〜0.75 で止める。
 */
const SPOTS = [0.5, 0.4, 0.6, 0.3, 0.7, 0.25, 0.75];

export interface EdgeLabel {
  /** 元の辺の id。 */
  id: string;
  text: string;
  /** 文字の中央。 */
  x: number;
  /** 文字のベースライン。 */
  y: number;
  /** 見積った幅。当たり判定に使ったものをそのまま返す（試験で確かめられるように）。 */
  w: number;
  /**
   * **立てて書くか**（左へ 90° 回し、右から読む。縦の寸法線の数値。2026-11-24）。
   * 立てたときの `x` は字の下端の線、`y` は字の真ん中（回す中心が `x, y`）。
   */
  upright?: true;
}

/** 字が占める矩形。**立てた字は縦に長い。** */
export function labelRect(label: EdgeLabel): { x0: number; y0: number; x1: number; y1: number } {
  if (label.upright === true) {
    return { x0: label.x - LINE + 3, y0: label.y - label.w / 2, x1: label.x + 3, y1: label.y + label.w / 2 };
  }
  return { x0: label.x - label.w / 2, y0: label.y - LINE + 3, x1: label.x + label.w / 2, y1: label.y + 3 };
}

/**
 * 置けるラベルだけを返す。**置けなかったものは返さない。**
 *
 * 入力の順に決めるので、同じ図なら同じ結果になる。
 */
export function placeEdgeLabels(
  edges: PlacedEdge[],
  boxes: Box[],
  groups: Box[] = [],
): EdgeLabel[] {
  // **囲みの中そのものは避けない。** 辺の大半は囲みの中を通るので、
  // 避けさせるとほとんどのラベルが消える。**避けるのは見出しの帯だけ。**
  const titles = groups.map((group) => ({
    ...group,
    h: Math.min(GROUP_TITLE_BAND, group.h),
    w: Math.min(group.w, labelWidth(group.label, GROUP_FONT) + GROUP_TITLE_PAD * 2),
  }));

  const placed: EdgeLabel[] = [];
  for (const edge of edges) {
    if (edge.label === null || edge.points.length < 2) continue;
    // **まず別の辺の上に乗らない場所を探し、無ければ前と同じ探し方**（名札を落とさない）
    const spot =
      findSpot(edge, edge.label, [...boxes, ...titles], placed, edges) ??
      findSpot(edge, edge.label, [...boxes, ...titles], placed);
    if (spot !== null) placed.push(spot);
  }
  return placed;
}

function findSpot(
  edge: PlacedEdge,
  text: string,
  boxes: Box[],
  taken: EdgeLabel[],
  /** 渡したら、ほかの辺の上に乗る場所も避ける（2026-10-05）。 */
  others: readonly PlacedEdge[] = [],
): EdgeLabel | null {
  const w = labelWidth(text, FONT);
  // **立てる置き場所を、どの位置でも先に探す**（寝かせるのは、どこにも立てられないときだけ）
  const all = SPOTS.flatMap((ratio) => beside(edge, text, w, along(edge.points, ratio)));
  for (const candidate of [...all.filter((c) => c.upright === true), ...all.filter((c) => c.upright !== true)]) {
    if (boxes.some((box) => hitsBox(candidate, box))) continue;
    if (taken.some((other) => hitsLabel(candidate, other))) continue;
    if (others.some((other) => other.id !== edge.id && runsUnder(other, candidate))) continue;
    return candidate;
  }
  return null;
}

/**
 * 線のどちら側に置くかの候補。ふつうの辺は**上、なければ下**（`SIDES`）。
 *
 * **寸法の数値（`dims`）は、線の外側に、線から離して置く**（`labelSide`。2026-11-02）。
 * 上下にずらすだけだと、**縦の寸法線では数値が線の真上に乗る** —— 板が線を切り、
 * 横の物に重なれば置き場が無くなる。外側を先に、だめなら内側。
 */
function beside(edge: PlacedEdge, text: string, w: number, point: { x: number; y: number }): EdgeLabel[] {
  const side = edge.labelSide;
  if (side === undefined) return SIDES.map((lift) => ({ id: edge.id, text, x: point.x, y: point.y + lift, w }));
  /**
   * **縦の寸法線の数値は立てる**（JIS B 0001:2019 11.4 d) 1)・JIS A 0150。右から読む）。
   * 外側へは字の高さの半分だけ出せばよい（立てた字の横幅は字の高さ）。
   *
   * **立てて置けないときは、寝かせて置く。** 短い寸法（台の高さ）では立てた字が隣の箱に当たる。
   * 数値が消えるより、向きが決まりから外れるほうがまし（見本 386 の podium-height）。
   */
  const flat = [1, -1].map((sign) => {
    const nx = side.x * sign;
    const ny = side.y * sign;
    // 線から LIFT だけ離し、さらに文字の半分（向きに応じて幅か高さ）だけ外へ。
    const reach = LIFT + (Math.abs(nx) * w) / 2 + (Math.abs(ny) * LINE) / 2;
    const cx = point.x + nx * reach;
    const cy = point.y + ny * reach;
    // 当たり判定の矩形は、ベースラインの LINE - 3 上から 3 下まで。真ん中はベースラインの 4 上。
    return { id: edge.id, text, x: cx, y: cy + LINE / 2 - 3, w };
  });
  if (side.y !== 0 || side.x === 0) return flat;
  const upright = [1, -1].map((sign) => {
    const cx = point.x + side.x * sign * (LIFT + LINE / 2);
    return { id: edge.id, text, x: cx + LINE / 2 - 3, y: point.y, w, upright: true as const };
  });
  return [...upright, ...flat];
}

/** 折れ線を弧長で辿り、割合の位置の点を返す。 */
function along(points: { x: number; y: number }[], ratio: number): { x: number; y: number } {
  const lengths = points.slice(1).map((p, i) => distance(points[i]!, p));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (total === 0) return points[0]!;

  let remaining = total * ratio;
  for (const [i, length] of lengths.entries()) {
    if (remaining > length) {
      remaining -= length;
      continue;
    }
    const a = points[i]!;
    const b = points[i + 1]!;
    const t = length === 0 ? 0 : remaining / length;
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  return points[points.length - 1]!;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** 箱の上に字を置くと、ノードのラベルと重なって両方読めなくなる。 */
function hitsBox(label: EdgeLabel, box: Box): boolean {
  const r = labelRect(label);
  return r.x1 > box.x && r.x0 < box.x + box.w && r.y1 > box.y && r.y0 < box.y + box.h;
}

function hitsLabel(a: EdgeLabel, b: EdgeLabel): boolean {
  const p = labelRect(a);
  const q = labelRect(b);
  return p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
}

/**
 * **辺の名札の下を、別の辺が通っている組**（`[通っている辺, 名札の辺]`）。合否ではなく観測値。
 *
 * 2026-10-05。献血の流れ（見本 296）で、名札「成分献血（血小板）」の下を遠心分離へ行く線が通り、
 * **血小板を遠心分離するように読めた**（2 回続けて同じ型）。名札の重なり（overlappingText）も
 * 線と注記（linesOverText）も、辺の名札と別の辺の組は見ていなかった。
 */
export function edgesUnderLabels(
  edges: readonly PlacedEdge[],
  labels: readonly EdgeLabel[],
): [string, string][] {
  const found: [string, string][] = [];
  for (const label of labels) {
    for (const edge of edges) {
      if (edge.id !== label.id && runsUnder(edge, label)) found.push([edge.id, label.id]);
    }
  }
  return found;
}

/** 辺のどれかの線分が、名札の字の上を 6px 以上通るか。 */
function runsUnder(edge: PlacedEdge, label: EdgeLabel, height = 12): boolean {
  const box = labelRect(label);
  const r = label.upright === true
    ? { x0: label.x - height + 1, y0: box.y0 + 1, x1: label.x + 2, y1: box.y1 - 1 }
    : { x0: label.x - label.w / 2 + 1, y0: label.y - height + 1, x1: label.x + label.w / 2 - 1, y1: label.y + 2 };
  for (let i = 1; i < edge.points.length; i += 1) {
    const a = edge.points[i - 1]!;
    const c = edge.points[i]!;
    let t0 = 0;
    let t1 = 1;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const clip = (p: number, q: number): boolean => {
      if (p === 0) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
      return true;
    };
    if (clip(-dx, a.x - r.x0) && clip(dx, r.x1 - a.x) && clip(-dy, a.y - r.y0) && clip(dy, r.y1 - a.y)) {
      if ((t1 - t0) * Math.hypot(dx, dy) >= 6) return true;
    }
  }
  return false;
}
