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
import type { ElkNode } from 'elkjs/lib/elk-api.js';

import { getPins, parse } from './format.ts';

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
}

export interface Placed {
  boxes: Box[];
  groups: Box[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

/** S1 では図形ごとの寸法を持たない。大きさは勝負どころではない（PRD §4）。 */
const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '48',
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.padding': '[top=40,left=24,bottom=24,right=24]',
};

export async function layout(text: string): Promise<Placed> {
  const diagram = parse(text);
  const pins = getPins(diagram);
  const nodes = readNodes(diagram);
  const groupIds = diagram.groupIds();

  const graph = buildGraph(nodes, groupIds, diagram.edges(), pins);
  const laid = await new ELK().layout(graph);

  const boxes: Box[] = [];
  const groups: Box[] = [];
  collect(laid, 0, 0, nodes, groupIds, boxes, groups);

  // 人が置いた場所・付けた体裁へ戻す。ELK が何を決めたかに関わらず、人の値が勝つ。
  for (const box of boxes) {
    const pin = pins[box.id];
    if (pin === undefined) continue;
    if (pin.position !== undefined) {
      box.x = pin.position.x;
      box.y = pin.position.y;
      box.pinned = true;
    }
    if (pin.label !== undefined) box.label = pin.label;
    if (pin.appearance !== undefined) box.appearance = pin.appearance;
  }

  const edges = routeEdges(readEdges(diagram), boxes, pins);
  return { boxes, groups, edges, ...extent(boxes, groups) };
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

// --- 組み立て --------------------------------------------------------------

interface NodeInfo {
  id: string;
  label: string;
  type: string;
  group: string | null;
}

function readNodes(diagram: ReturnType<typeof parse>): NodeInfo[] {
  const raw = diagram.doc.toJS() as {
    nodes?: { id: string; label?: string; type?: string; group?: string }[];
  };
  return (raw.nodes ?? []).map((node) => ({
    id: node.id,
    label: node.label ?? node.id,
    type: node.type ?? 'generic',
    group: node.group ?? null,
  }));
}

interface EdgeInfo {
  id: string;
  from: string;
  to: string;
  label: string | null;
}

function readEdges(diagram: ReturnType<typeof parse>): EdgeInfo[] {
  return diagram.edges().map((edge) => ({
    id: `${edge.from}>${edge.to}`,
    from: edge.from,
    to: edge.to,
    label: edge.label ?? edge.protocol ?? null,
  }));
}

/**
 * 線の通り道を決める。
 *
 * **人が曲げた線は、その点列をそのまま通す。** 曲げ方は好みではなく
 * 「この経路で説明したい」という意思なので、機械が引き直さない。
 * 曲げていない線は、箱の中心どうしを結んで縁で切る。S1 では回り込みまで見ない
 * （原案 §26 の 3 = Connector routing の品質は Issue 004 の側）。
 */
function routeEdges(
  edges: EdgeInfo[],
  boxes: Box[],
  pins: Record<string, { waypoints?: { x: number; y: number }[] }>,
): PlacedEdge[] {
  const byId = new Map(boxes.map((box) => [box.id, box]));
  return edges.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) {
      return { ...edge, points: [], pinned: false };
    }
    const waypoints = pins[edge.id]?.waypoints;
    const start = center(from);
    const end = center(to);
    if (waypoints !== undefined && waypoints.length > 0) {
      const first = waypoints[0]!;
      const last = waypoints[waypoints.length - 1]!;
      return {
        ...edge,
        points: [clip(from, first), ...waypoints, clip(to, last)],
        pinned: true,
      };
    }
    return { ...edge, points: [clip(from, end), clip(to, start)], pinned: false };
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

function buildGraph(
  nodes: NodeInfo[],
  groupIds: string[],
  edges: { from: string; to: string }[],
  pins: Record<string, { size?: { w: number; h: number } }>,
): ElkNode {
  const leaf = (node: NodeInfo): ElkNode => ({
    id: node.id,
    // 人が変えた大きさは、組み立ての入力の段階で効かせる。
    // 後から広げると、周りが元の大きさのまま詰められていて重なる。
    width: pins[node.id]?.size?.w ?? NODE_WIDTH,
    height: pins[node.id]?.size?.h ?? NODE_HEIGHT,
  });

  const children: ElkNode[] = groupIds.map((groupId) => ({
    id: groupId,
    layoutOptions: LAYOUT_OPTIONS,
    children: nodes.filter((node) => node.group === groupId).map(leaf),
  }));
  children.push(...nodes.filter((node) => node.group === null).map(leaf));

  return {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
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
  groupIds: string[],
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
      group: groupIds.includes(node.id) ? node.id : null,
      label: nodes.find((n) => n.id === child.id)?.label ?? child.id,
      type: nodes.find((n) => n.id === child.id)?.type ?? 'generic',
      appearance: null,
      pinned: false,
    };
    if (groupIds.includes(child.id)) {
      groups.push(box);
      collect(child, x, y, nodes, groupIds, boxes, groups);
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
