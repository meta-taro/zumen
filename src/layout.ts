/**
 * 自動レイアウト。ELK に任せ、**人が置いた場所だけは動かさない**。
 *
 * 原案 §26 の 2（人が微調整した後に Auto Layout と共存できるか）がここ。
 * 正本に pin が残っていても、描くときに無視されるなら保持したことにならない。
 *
 * 採った方針は「ELK に全部組ませてから、pin のノードだけ人の座標へ戻す」。
 * ELK の interactive 指定で pin を組み立ての入力として渡す手もあるが、
 * その形は **pin の座標が「ヒント」になり、1 の位まで一致しなくなる**。
 * 人が置いた場所が数ピクセルずれて返るのは、判定基準 3.1 では失われたと数える。
 *
 * 代償として、pin と自動配置が重なりうる。**これは隠さず数えて記録する**
 * （`overlaps`）。合否には使わない（判定基準 §0 — 綺麗さで判定しない）が、
 * 実用に耐えるかの材料になる。
 */
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js';

import { asText, getPins, parse } from './format.ts';
import { directionOf, elkDirection } from './direction.ts';
import { gridOf, marginFor, northOf, scaleOf } from './grid.ts';
import type { Grid, North } from './grid.ts';
import { arrowsOf } from './arrows.ts';
import { hatchOf } from './hatch.ts';
import type { Hatch } from './hatch.ts';
import { markerOf } from './marker.ts';
import type { Marker } from './marker.ts';
import { endsOf } from './ends.ts';
import type { Ends } from './ends.ts';
import { radiusOf } from './range.ts';
import { wallOf } from './wall.ts';
import type { Wall } from './wall.ts';
import { wrapOf, wrapOptions } from './wrap.ts';
import { kindOf, measureOf } from './kind.ts';
import { separate } from './separate.ts';
import { openingsOf } from './openings.ts';
import type { Hole } from './openings.ts';
import { growFor, shapeOf } from './shapes.ts';

export interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 属するグループ。無所属は null。 */
  group: string | null;
  label: string;
  type: string;
  /** 体裁の指定。人が与えたものだけが入る。 */
  appearance: string | null;
  /** **壁に開く穴**（扉・窓）。平面図でだけ描く。 */
  openings: Hole[];
  /**
   * 版や役割（仕様 §3.1 の `technology`）。**箱の中に副題として描く。**
   *
   * 形式にあって検証も通るのに描かれていなかった（Issue #3 の 4）。
   * 所属や版を書ける唯一の場所なので、描かれないとラベルへ畳むしかなくなる。
   */
  technology: string | null;
  /**
   * **符号**（仕様 §3.1 の `tag`）。箱の左上に小さく描く。
   *
   * 業界の専門性は、形ではなく符号で表されている（D22）。
   * 構造図の `C1`（柱）・`G1`（大梁）、配管の `2"-CS-101`、電気の盤番号。
   * **`label` の代わりではない。** 名前と符号は別のもので、図面は両方を出す。
   */
  tag: string | null;
  /**
   * **範囲を示す円の半径**（px。`src/range.ts`）。
   *
   * クレーンの作業半径・影の離隔・消火器の警戒区域。
   * **物の形ではなく、届く範囲の注記。**
   */
  radius: number | null;
  /** **配置図での印の描き方**（`src/marker.ts`）。既定は矩形。 */
  marker: Marker;
  /** **ハッチング**（材料・区域の模様。`src/hatch.ts`）。既定は無地。 */
  hatch: Hatch;
  /** 人が置いた場所か。 */
  pinned: boolean;
}

export interface PlacedEdge {
  /** `from>to`。pin の鍵と同じ。 */
  id: string;
  from: string;
  to: string;
  label: string | null;
  /** 実際に通る点の列。両端は箱の縁。 */
  points: { x: number; y: number }[];
  /** 人が曲げたか。 */
  pinned: boolean;
  /** **端の記号**（`src/ends.ts`）。ER の多重度・端子・接続点。 */
  ends: Ends;
}

export interface Placed {
  boxes: Box[];
  groups: Box[];
  edges: PlacedEdge[];
  width: number;
  height: number;
  /**
   * **人が置いたものどうしが重なっている組**（Issue 015）。
   *
   * 動かしていない。人の指定を動かして重なりを解いたら、
   * それは手直しを壊したことになる（判定基準 3.1）。**人へ出して選んでもらう。**
   */
  collisions: [string, string][];
  /** **通り芯**（`src/grid.ts`）。書かなければ空。配置図でだけ描く。 */
  grid: Grid;
  /** 1 px が何 mm か。**書かなければ寸法の数値を出さない。** */
  mm: number | null;
  /** 方位。書かなければ描かない。 */
  north: North | null;
  /** **壁の厚み**（`src/wall.ts`）。書かなければこれまでどおりの線の太さ。 */
  wall: Wall | null;
  /** **線に向きがあるか**（`src/arrows.ts`）。既定は真。 */
  arrows: boolean;
}

/** 箱の下限と上限。**文字から決めるが、際限なく広げない**（Issue #3 の 2）。 */
const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;
const NODE_MAX_WIDTH = 320;
/** 文字の左右に空ける分。 */
const LABEL_PADDING = 24;
/** 描くときの文字の大きさ（`src/render.ts` と揃える）。 */
const LABEL_FONT = 15;
/** 副題（`technology`）の文字の大きさ。 */
const SUB_FONT = 11;
/** 符号（`tag`）の文字の大きさ。**副題よりさらに小さい。** */
const TAG_FONT = 10;
/** 符号を箱の角から離す分。 */
export const TAG_INSET = 8;

/**
 * ラベルの見た目の幅を測る。
 *
 * **全角は半角の 2 倍**として数える。日本語のラベルが箱に入らず、
 * 左端のノードでは x が負になって画面外へ切れていた（Issue #3 の 2）。
 *
 * 正確な字送りは書体で変わるが、**書体は貼り先が決める**ので正確には測れない
 * （Issue 007 §3.1）。ここは「入らないよりはまし」を狙う見積もり。
 */
export function labelWidth(label: string, font = LABEL_FONT): number {
  let units = 0;
  for (const ch of label) {
    // 半角の範囲（ASCII と半角カナ）は 1、それ以外は 2。
    units += /[\u0020-\u007e\uff61-\uff9f]/.test(ch) ? 1 : 2;
  }
  // 半角 1 文字を、字の大きさのおよそ 0.55 倍として見積もる。
  return Math.ceil((units * font * 0.55) / 2) * 2;
}

/**
 * ラベルが入る箱の幅。**下限より狭くせず、上限より広げない。**
 *
 * 副題（`technology`）があれば、そちらも入る幅にする。
 */
function widthFor(
  label: string,
  technology: string | null = null,
  tag: string | null = null,
): number {
  const sub = technology === null ? 0 : labelWidth(technology, SUB_FONT);
  const needed = Math.max(labelWidth(label), sub) + LABEL_PADDING * 2;
  // **符号は角に置くので、ラベルとは別に幅が要る**（B5）。
  // `2"-CS-101-A3` のような配管のライン番号は、部屋名より長い。
  const code = tag === null ? 0 : labelWidth(tag, TAG_FONT) + TAG_INSET * 2;
  return Math.min(NODE_MAX_WIDTH, Math.max(NODE_WIDTH, needed, code));
}

/**
 * 向きは正本が決める（`src/direction.ts`）。**既定は横。**
 *
 * 余白は詰めてある。以前は箱が図の **17〜24%** しか占めておらず、
 * 8 割が余白だった。**空いているほど良い図ではない。**
 */
function layoutOptions(direction: string): Record<string, string> {
  return { ...LAYOUT_OPTIONS, 'elk.direction': direction };
}

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '30',
  'elk.layered.spacing.nodeNodeBetweenLayers': '56',
  'elk.padding': '[top=40,left=24,bottom=24,right=24]',
  /**
   * **囲みをまたぐ辺を、層の計算に使わせる**（Issue #1）。
   *
   * これが無いと、囲みの中と外が別々に並べられ、
   * **囲みどうしの順序が辺から決まらない。**
   * 一方向の鎖でも終点が最上段に来て、図の全高を逆流する矢印が生まれ、
   * 途中のノードの箱を突き抜ける。
   *
   * 実測（4 ノード・3 辺・一方向）:
   *
   * | | 外部 | 本番 | 保管先 |
   * |---|---|---|---|
   * | 無し | 40 | 184 | **40**（最上段へ戻る） |
   * | 有り | 40 | 238 | **560** |
   */
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  /**
   * **線を直角で引く**（Issue #3 の 1）。
   *
   * 以前は中心から中心へ斜めの直線を引いていた。
   * ノードが増えるほど交差が増え、線が箱の上を通る。
   * **ELK は箱を避ける経路を計算できるのに、それを捨てて自前で直線を引いていた。**
   */
  'elk.edgeRouting': 'ORTHOGONAL',
};

export async function layout(text: string): Promise<Placed> {
  const diagram = parse(text);
  const pins = getPins(diagram);
  const nodes = readNodes(diagram);
  const groupIds = diagram.groupIds();

  const groupLabels = readGroupLabels(diagram);
  // **向きは正本が決める**（`direction: right | down`。既定は横）。
  const raw = diagram.doc.toJS() as {
    direction?: unknown;
    wrap?: unknown;
    grid?: unknown;
    scale?: unknown;
    north?: unknown;
    wall?: unknown;
    arrows?: unknown;
  };
  const direction = elkDirection(directionOf(raw.direction));
  // **折り返すかは正本が決める**（`src/wrap.ts`）。既定は折り返さない。
  const wrap = wrapOptions(wrapOf(raw.wrap));
  const graph = buildGraph(nodes, groupIds, diagram.edges(), pins, direction, wrap);
  const laid = await new ELK().layout(graph);

  const boxes: Box[] = [];
  const groups: Box[] = [];
  collect(laid, 0, 0, nodes, groupLabels, boxes, groups);
  const routes = collectRoutes(laid, groups, nodes);

  /**
   * **ELK がどこへ置いたか**を控える（Issue #8）。
   *
   * このあと箱は 2 回動く（人の `pins` と、重なりの解消）。
   * **辺の通り道は ELK が組んだときの位置で計算されている**ので、
   * 動いた箱に繋がる辺は、そのままだと**元の位置を指したまま宙で切れる。**
   *
   * 実際にそうなっていた。同梱の例で `db` を動かしてあり、
   * **GUI を開いた人が最初に見る図で、箱に線が 1 本も繋がっていなかった。**
   */
  const laidAt = new Map(boxes.map((box) => [box.id, { x: box.x, y: box.y }]));

  /**
   * **AI が書いた置き場所を当てる**（配置図のみ。仕様 §3.1 の `at`）。
   *
   * 人の `pins` より先に当てる —— **下に置いて、人の値で上書きされる**ようにする。
   * `at` が無い要素は、機械が置いた場所のまま（黙って重ねない）。
   *
   * 構成図では見ない。置き場所は機械が決めるのが構成図の定義（`src/kind.ts`）。
   */
  const inSource = measureOf(kindOf(text)).positionsInSource;
  /** **書いて置かれた箱。** 動かさないし、接していても重なりとして数えない。 */
  const written = new Set<string>();
  if (inSource) {
    const at = new Map(nodes.filter((n) => n.at !== null).map((n) => [n.id, n.at!]));
    for (const box of boxes) {
      const point = at.get(box.id);
      if (point === undefined) continue;
      box.x = point.x;
      box.y = point.y;
      written.add(box.id);
    }
  }

  // 人が置いた場所・付けた体裁へ戻す。ELK が何を決めたかに関わらず、人の値が勝つ。
  for (const box of boxes) {
    const pin = pins[box.id];
    if (pin === undefined) continue;
    if (pin.position !== undefined) {
      box.x = pin.position.x;
      box.y = pin.position.y;
      box.pinned = true;
    }
    // **人が書く場所なので、ここも数字が来る**（`label: 8080`）。Issue #5 と同じ。
    const label = asText(pin.label);
    if (label !== null) box.label = label;
    const appearance = asText(pin.appearance);
    if (appearance !== null) box.appearance = appearance;
  }

  /**
   * 人が置いた場所と重なった機械の箱を退ける（Issue 015）。
   * **人の箱は 1 px も動かさない。** 動かせない組（人どうし）は返して人へ出す。
   *
   * **配置図では退けない**（2026-09-11。店舗のレイアウトを描かせて出た）。
   * 間取りや売場では、**部屋や棚が接しているのが普通**で、重なりではない。
   * 退けると、書いた座標が黙って動く —— **配置図では座標そのものが内容。**
   */
  const { locked } = separate(boxes, written);

  // 人が枠の外へ動かしたら、枠のほうを広げる。
  // 人の位置を枠の中へ押し戻すと、それは手直しを壊したことになる（判定基準 3.1）。
  // 枠は「この範囲が VPC」という意味なので、中身に合わせて動くほうが正しい。
  fitGroups(boxes, groups, inSource);

  // **動いた箱に繋がる辺だけ引き直す。** 動いていない辺は 1 px も変えない
  // （ELK の直交ルーティングは、そのままのほうが読める）。
  const moved = new Set(
    boxes.filter((box) => {
      const was = laidAt.get(box.id);
      return was !== undefined && (was.x !== box.x || was.y !== box.y);
    }).map((box) => box.id),
  );

  const edges = routeEdges(readEdges(diagram), boxes, pins, routes, moved);
  /**
   * **通り芯と寸法線の分だけ、外側へ空ける**（`src/grid.ts`）。
   *
   * 正本の座標は余白を知らないので、**描く直前に全部ずらす。**
   * 先にずらすと `at` に書いた値と図の座標が食い違い、
   * 人が「40 と書いたのに 118 にある」と読むことになる。
   */
  const grid = gridOf(raw.grid);
  const margin = marginFor(grid);
  if (margin.left > 0 || margin.top > 0) {
    for (const box of [...boxes, ...groups]) {
      box.x += margin.left;
      box.y += margin.top;
    }
    for (const edge of edges) {
      for (const point of edge.points) {
        point.x += margin.left;
        point.y += margin.top;
      }
    }
    // **通り芯も一緒にずらす。** ここでずらしておけば、描く側は余白を知らずに済む。
    for (const axis of grid.x) axis.at += margin.left;
    for (const axis of grid.y) axis.at += margin.top;
  }

  const size = extent(boxes, groups);
  return {
    boxes,
    groups,
    edges,
    collisions: locked,
    grid,
    mm: scaleOf(raw.scale),
    north: northOf(raw.north),
    wall: wallOf(raw.wall),
    arrows: arrowsOf(raw.arrows),
    width: size.width + margin.right,
    height: size.height + margin.bottom,
  };
}

/** グループの枠を、中身を含む大きさへ広げる。 */
/**
 * 枠を中身に合わせる。
 *
 * 構成図では**広げるだけ** —— 人が枠の外へ動かしたら枠のほうを広げる。
 * 中へ押し戻すと、それは手直しを壊したことになる（判定基準 3.1）。
 *
 * **配置図では縮めもする**（`shrink`）。
 * `at` で中身が寄ったのに枠が元の大きさのまま残ると、**囲みどうしが重なる**
 * （2026-09-11。店舗のレイアウトで、売場の枠がバックヤードに飲み込まれた）。
 */
function fitGroups(boxes: Box[], groups: Box[], shrink = false): void {
  /**
   * 囲みと中身の間。
   *
   * **配置図では詰める。** 実物の平面図では、外周の壁が部屋の壁そのもので、
   * 間に隙間は無い。24px 空けると、建物の周りに廊下があるように見える。
   * 見出しの分だけは上に残す（囲みの名前を書く場所）。
   */
  const PADDING = shrink ? 4 : 24;
  const TITLE = shrink ? 26 : 40;
  for (const group of groups) {
    const children = boxes.filter((box) => box.group === group.id);
    if (children.length === 0) continue;
    const around = {
      left: Math.min(...children.map((c) => c.x - PADDING)),
      top: Math.min(...children.map((c) => c.y - TITLE)),
      right: Math.max(...children.map((c) => c.x + c.w + PADDING)),
      bottom: Math.max(...children.map((c) => c.y + c.h + PADDING)),
    };
    const left = shrink ? around.left : Math.min(group.x, around.left);
    const top = shrink ? around.top : Math.min(group.y, around.top);
    const right = shrink ? around.right : Math.max(group.x + group.w, around.right);
    const bottom = shrink ? around.bottom : Math.max(group.y + group.h, around.bottom);
    group.x = left;
    group.y = top;
    group.w = right - left;
    group.h = bottom - top;
  }
}

/** 枠からはみ出した子を返す。合否ではなく観測値。 */
export function groupEscapes(placed: Placed): string[] {
  const out: string[] = [];
  for (const box of placed.boxes) {
    if (box.group === null) continue;
    const group = placed.groups.find((g) => g.id === box.group);
    if (group === undefined) continue;
    const inside =
      box.x >= group.x &&
      box.y >= group.y &&
      box.x + box.w <= group.x + group.w &&
      box.y + box.h <= group.y + group.h;
    if (!inside) out.push(box.id);
  }
  return out;
}

/** 重なっている組を返す。合否ではなく観測値。 */
export function overlaps(placed: Placed): [string, string][] {
  const found: [string, string][] = [];
  const boxes = placed.boxes;
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      const apart =
        a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      if (!apart) found.push([a.id, b.id]);
    }
  }
  return found;
}

/**
 * 線どうしが交差している数（Issue 004）。**合否ではなく観測値。**
 *
 * 交差が多い図は読めない。ただし**少なければ良いとも限らない**ので、
 * 数えるだけにして、良し悪しは人が決める（Issue 004 の注意 — AI に自己採点させない）。
 *
 * 同じ点から出ている線どうしは数えない（扇形に広がるのは交差ではない）。
 */
export function crossings(placed: Placed): number {
  const segments: [P, P][] = [];
  for (const edge of placed.edges) {
    for (let i = 0; i + 1 < edge.points.length; i += 1) {
      segments.push([edge.points[i]!, edge.points[i + 1]!]);
    }
  }

  let count = 0;
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      if (intersects(segments[i]!, segments[j]!)) count += 1;
    }
  }
  return count;
}

interface P {
  x: number;
  y: number;
}

/** 線分が交わるか。**端点を共有しているだけなら交差としない。** */
function intersects([a, b]: [P, P], [c, d]: [P, P]): boolean {
  if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) return false;
  const d1 = side(c, d, a);
  const d2 = side(c, d, b);
  const d3 = side(a, b, c);
  const d4 = side(a, b, d);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function same(a: P, b: P): boolean {
  return a.x === b.x && a.y === b.y;
}

function side(a: P, b: P, p: P): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

// --- 組み立て --------------------------------------------------------------

interface NodeInfo {
  id: string;
  label: string;
  type: string;
  group: string | null;
  /** 版や役割（仕様 §3.1 の `technology`）。無ければ null。 */
  technology: string | null;
  /** 符号（仕様 §3.1 の `tag`）。無ければ null。 */
  tag: string | null;
  /** 範囲を示す円の半径（px）。無ければ null。 */
  radius: number | null;
  /** 印の描き方（`src/marker.ts`）。 */
  marker: Marker;
  /** 模様（`src/hatch.ts`）。 */
  hatch: Hatch;
  /**
   * **AI が書いた置き場所**（仕様 §3.1。配置図で使う）。
   *
   * `pins.position`（人）とは別。**人のほうが常に強い**（D5 の向きは変わらない）。
   * 構成図では見ない —— 置き場所は機械が決める。
   */
  at: { x: number; y: number } | null;
  /**
   * **AI が書いた大きさ**（仕様 §3.1）。
   *
   * 間取りを描かせてみて分かった —— **部屋の大きさが全部同じでは図にならない。**
   * 16 畳の LDK と便所が同じ箱で出た（2026-09-11）。
   *
   * `pins.size`（人）とは別。**人のほうが常に強い。**
   * 置き場所と違い、**構成図でも効く**（大きさは並べ方と関係ない）。
   */
  size: { w: number; h: number } | null;
  /** **壁に開く穴**（扉・窓）。平面図でだけ使う（`src/openings.ts`）。 */
  openings: Hole[];
}

function readNodes(diagram: ReturnType<typeof parse>): NodeInfo[] {
  const raw = diagram.doc.toJS() as {
    nodes?: {
      id?: unknown;
      label?: unknown;
      type?: unknown;
      group?: unknown;
      technology?: unknown;
      tag?: unknown;
      radius?: unknown;
      marker?: unknown;
      hatch?: unknown;
      at?: unknown;
      size?: unknown;
      openings?: unknown;
    }[];
  };
  return (raw.nodes ?? []).map((node) => {
    const id = asText(node.id) ?? '';
    return {
      id,
      label: asText(node.label) ?? id,
      type: asText(node.type) ?? 'generic',
      group: asText(node.group),
      technology: asText(node.technology),
      tag: asText(node.tag),
      radius: radiusOf(node.radius),
      marker: markerOf(node.marker),
      hatch: hatchOf(node.hatch),
      at: asPoint(node.at),
      size: asSize(node.size),
      openings: openingsOf(node.openings),
    };
  });
}

interface EdgeInfo {
  id: string;
  from: string;
  to: string;
  label: string | null;
  /** 端の記号（`src/ends.ts`）。 */
  ends: Ends;
}

/** グループの表示名。無ければ id を使う。 */
/** `{ x, y }` として読めるものだけ受ける。**読めなければ機械が置く。** */
function asPoint(raw: unknown): { x: number; y: number } | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { x, y } = raw as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** `{ w, h }` として読めるものだけ受ける。**読めなければラベルから決める。** */
function asSize(raw: unknown): { w: number; h: number } | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { w, h } = raw as { w?: unknown; h?: unknown };
  if (typeof w !== 'number' || typeof h !== 'number') return null;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return { w, h };
}

function readGroupLabels(diagram: ReturnType<typeof parse>): Map<string, string> {
  const raw = diagram.doc.toJS() as { groups?: { id?: unknown; label?: unknown }[] };
  return new Map(
    (raw.groups ?? []).map((group) => {
      const id = asText(group.id) ?? '';
      return [id, asText(group.label) ?? id];
    }),
  );
}

function readEdges(diagram: ReturnType<typeof parse>): EdgeInfo[] {
  return diagram.edges().map((edge) => {
    const from = asText(edge.from) ?? '';
    const to = asText(edge.to) ?? '';
    return {
      id: `${from}>${to}`,
      from,
      to,
      label: asText(edge.label) ?? asText(edge.protocol),
      ends: endsOf(edge.ends),
    };
  });
}

/**
 * 線の通り道を決める。
 *
 * **人が曲げた線は、その点列をそのまま通す。** 曲げ方は好みではなく
 * 「この経路で説明したい」という意思なので、機械が引き直さない。
 * 曲げていない線は、箱の中心どうしを結んで縁で切る。S1 では回り込みまで見ない
 * （原案 §26 の 3 = Connector routing の品質は Issue 004 の側）。
 */
/**
 * ELK が計算した経路を集める。
 *
 * ## 座標の基準に注意
 *
 * **辺の座標は「両端の、最も近い共通の親」からの相対**で返る。
 * 両端が同じ囲みの中なら、その囲みからの相対。またぐなら根からの相対。
 * ここを取り違えると、線が囲みの位置ぶんずれる。
 *
 * v1 は囲みの入れ子を持たない（仕様 §3.3）ので、**同じ囲みか否か**だけで決まる。
 */
function collectRoutes(
  laid: ElkNode,
  groups: Box[],
  nodes: NodeInfo[],
): Map<string, { x: number; y: number }[]> {
  const groupOf = new Map(nodes.map((node) => [node.id, node.group]));
  const groupAt = new Map(groups.map((group) => [group.id, group]));
  const out = new Map<string, { x: number; y: number }[]>();

  for (const edge of (laid as { edges?: ElkExtendedEdge[] }).edges ?? []) {
    const section = edge.sections?.[0];
    if (section === undefined) continue;

    const from = edge.sources?.[0];
    const to = edge.targets?.[0];
    const shared =
      from !== undefined && to !== undefined && groupOf.get(from) === groupOf.get(to)
        ? groupAt.get(groupOf.get(from) ?? '')
        : undefined;
    const dx = shared?.x ?? 0;
    const dy = shared?.y ?? 0;

    out.set(edge.id, [
      { x: round(section.startPoint.x + dx), y: round(section.startPoint.y + dy) },
      ...(section.bendPoints ?? []).map((point) => ({
        x: round(point.x + dx),
        y: round(point.y + dy),
      })),
      { x: round(section.endPoint.x + dx), y: round(section.endPoint.y + dy) },
    ]);
  }
  return out;
}

function routeEdges(
  edges: EdgeInfo[],
  boxes: Box[],
  pins: Record<string, { waypoints?: { x: number; y: number }[] }>,
  routes: Map<string, { x: number; y: number }[]>,
  /** **組んだあとに動いた箱**。ここに触れる辺は、ELK の経路を使わない（Issue #8）。 */
  moved: Set<string>,
): PlacedEdge[] {
  const byId = new Map(boxes.map((box) => [box.id, box]));
  return edges.map((edge, index) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) {
      return { ...edge, points: [], pinned: false };
    }

    // 人が曲げた線は、人の通り道が勝つ。
    const waypoints = pins[edge.id]?.waypoints;
    if (waypoints !== undefined && waypoints.length > 0) {
      const first = waypoints[0]!;
      const last = waypoints[waypoints.length - 1]!;
      return {
        ...edge,
        points: [clip(from, first), ...waypoints, clip(to, last)],
        pinned: true,
      };
    }

    // ELK の経路を使う。**箱を避けて回り込む道が入っている。**
    //
    // **ただし、端点が動いていたら使わない**（Issue #8）。
    // その経路は ELK が組んだときの位置で計算されたもので、
    // 動いた先の箱には届かない。**届かない線を描くくらいなら、直線で結ぶ。**
    const route = routes.get(`e${index}`);
    const stale = moved.has(edge.from) || moved.has(edge.to);
    if (!stale && route !== undefined && route.length >= 2) {
      return { ...edge, points: route, pinned: false };
    }

    // 直線で結ぶ。**両端は箱の縁で切る**ので、動かした先へ必ず届く。
    return { ...edge, points: [clip(from, center(to)), clip(to, center(from))], pinned: false };
  });
}

function center(box: Box): { x: number; y: number } {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** 箱の中心から `toward` へ向かう線が、箱の縁と交わる点。 */
function clip(box: Box, toward: { x: number; y: number }): { x: number; y: number } {
  const c = center(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const scale = Math.min(
    dx === 0 ? Infinity : box.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : box.h / 2 / Math.abs(dy),
  );
  return { x: round(c.x + dx * scale), y: round(c.y + dy * scale) };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 描かれるラベル。**人が書き換えていれば、そちらの幅で測る。**
 *
 * 幅を測る段階でも `pins` を読むので、**ここでも文字列に寄せる**（Issue #5）。
 * 描くときだけ直しても、幅の計算がここで落ちる。
 */
function labelOf(node: NodeInfo, pins: Record<string, { label?: unknown }>): string {
  return asText(pins[node.id]?.label) ?? node.label;
}

function buildGraph(
  nodes: NodeInfo[],
  groupIds: string[],
  edges: { from: string; to: string }[],
  pins: Record<string, { size?: { w: number; h: number }; label?: unknown }>,
  direction: string,
  /** 折り返しの指定（`src/wrap.ts`）。折り返さないなら空。 */
  wrap: Record<string, string> = {},
): ElkNode {
  const options = { ...layoutOptions(direction), ...wrap };
  const leaf = (node: NodeInfo): ElkNode => ({
    id: node.id,
    // 人が変えた大きさは、組み立ての入力の段階で効かせる。
    // 後から広げると、周りが元の大きさのまま詰められていて重なる。
    // **ラベルの幅も同じ段階で効かせる**（後から広げると同じことが起きる）。
    // **形の分だけ広げる**（Issue #9）。円柱は上下に、六角形は左右に余分が要る。
    // ここで足さないと、形を付けたときにラベルがはみ出す。
    //
    // 強さは **人（`pins.size`）> AI（`nodes[].size`）> ラベルから見積もる** の順。
    width:
      pins[node.id]?.size?.w ??
      node.size?.w ??
      widthFor(labelOf(node, pins), node.technology, node.tag) + growFor(shapeOf(node.type)).w,
    height:
      pins[node.id]?.size?.h ??
      node.size?.h ??
      (node.technology === null ? NODE_HEIGHT : NODE_HEIGHT + 16) + growFor(shapeOf(node.type)).h,
  });

  const children: ElkNode[] = groupIds.map((groupId) => ({
    id: groupId,
    layoutOptions: options,
    children: nodes.filter((node) => node.group === groupId).map(leaf),
  }));
  children.push(...nodes.filter((node) => node.group === null).map(leaf));

  return {
    id: 'root',
    layoutOptions: options,
    children,
    edges: edges.map((edge, index) => ({
      id: `e${index}`,
      sources: [edge.from],
      targets: [edge.to],
    })),
  };
}

/** ELK は子の座標を親からの相対で返す。絶対座標へ直しながら拾う。 */
function collect(
  node: ElkNode,
  offsetX: number,
  offsetY: number,
  nodes: NodeInfo[],
  groupLabels: Map<string, string>,
  boxes: Box[],
  groups: Box[],
): void {
  for (const child of node.children ?? []) {
    const x = offsetX + (child.x ?? 0);
    const y = offsetY + (child.y ?? 0);
    const box: Box = {
      id: child.id,
      x,
      y,
      w: child.width ?? NODE_WIDTH,
      h: child.height ?? NODE_HEIGHT,
      group: groupLabels.has(node.id) ? node.id : null,
      label: groupLabels.get(child.id) ?? nodes.find((n) => n.id === child.id)?.label ?? child.id,
      type: nodes.find((n) => n.id === child.id)?.type ?? 'generic',
      appearance: null,
      technology: nodes.find((n) => n.id === child.id)?.technology ?? null,
      tag: nodes.find((n) => n.id === child.id)?.tag ?? null,
      radius: nodes.find((n) => n.id === child.id)?.radius ?? null,
      marker: nodes.find((n) => n.id === child.id)?.marker ?? 'box',
      hatch: nodes.find((n) => n.id === child.id)?.hatch ?? 'none',
      openings: nodes.find((n) => n.id === child.id)?.openings ?? [],
      pinned: false,
    };
    if (groupLabels.has(child.id)) {
      groups.push(box);
      collect(child, x, y, nodes, groupLabels, boxes, groups);
      continue;
    }
    boxes.push(box);
  }
}

function extent(boxes: Box[], groups: Box[]): { width: number; height: number } {
  const all = [...boxes, ...groups];
  if (all.length === 0) return { width: 0, height: 0 };
  return {
    width: Math.max(...all.map((b) => b.x + b.w)) + 24,
    height: Math.max(...all.map((b) => b.y + b.h)) + 24,
  };
}
