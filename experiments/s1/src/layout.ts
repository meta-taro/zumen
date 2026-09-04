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
  /** 人が置いた場所か。 */
  pinned: boolean;
}

export interface PlacedEdge {
  from: string;
  to: string;
  label: string | null;
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

  const graph = buildGraph(nodes, groupIds, diagram.edges());
  const laid = await new ELK().layout(graph);

  const boxes: Box[] = [];
  const groups: Box[] = [];
  collect(laid, 0, 0, nodes, groupIds, boxes, groups);

  // 人が置いた場所へ戻す。ELK が何を決めたかに関わらず、ここは人の値が勝つ。
  for (const box of boxes) {
    const position = pins[box.id]?.position;
    if (position === undefined) continue;
    box.x = position.x;
    box.y = position.y;
    box.pinned = true;
  }

  return { boxes, groups, edges: readEdges(diagram), ...extent(boxes, groups) };
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

function readEdges(diagram: ReturnType<typeof parse>): PlacedEdge[] {
  return diagram.edges().map((edge) => ({
    from: edge.from,
    to: edge.to,
    label: edge.label ?? edge.protocol ?? null,
  }));
}

function buildGraph(
  nodes: NodeInfo[],
  groupIds: string[],
  edges: { from: string; to: string }[],
): ElkNode {
  const leaf = (node: NodeInfo): ElkNode => ({
    id: node.id,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
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
