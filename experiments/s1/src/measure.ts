/**
 * 判定基準の 3 軸（保持 / 反映 / 競合）を数える。
 *
 * **要約を出さない。分母と分子を出す**（判定基準 §5）。
 * 「保持された」とだけ書くと、何個中何個なのかが後から検証できない。
 *
 * 保持と反映は必ず並べて返す。片方だけを見ると、全部を固定して保持 100%・反映 0%
 * という逆方向の失敗が「成功」に見える（判定基準 3.2）。
 */
import { getPins, parse } from './format.ts';
import type { Pin } from './format.ts';

/** 何が起きるはずかを、往復の前に書き出したもの。 */
export type Expectation =
  | { kind: 'node-added'; id: string }
  | { kind: 'node-removed'; id: string }
  | { kind: 'edge-added'; from: string; to: string }
  | { kind: 'edge-removed'; from: string; to: string }
  | { kind: 'label-changed'; id: string; to: string };

export interface Retention {
  kept: number;
  total: number;
  /** 失われたものを個別に出す。列挙できない欠落は条件として書けない（判定基準 3.1）。 */
  lost: string[];
}

export interface Measurement {
  /** 人が明示した位置・大きさ・ラベル。合格線 100%。 */
  tierA: Retention;
  /** 体裁・線の曲げ方・グループ所属・コメントと並び順。合格線 80%。 */
  tierB: Retention;
  reflection: { expected: number; applied: number; missing: string[] };
}

const TIER_A_FIELDS = ['position', 'size', 'label'] as const;
const TIER_B_FIELDS = ['appearance', 'waypoints'] as const;

export function measure(before: string, after: string, expectations: Expectation[]): Measurement {
  return {
    tierA: retention(before, after, TIER_A_FIELDS),
    tierB: tierB(before, after),
    reflection: reflection(after, expectations),
  };
}

// --- 保持 ------------------------------------------------------------------

function retention(
  before: string,
  after: string,
  fields: readonly (keyof Pin)[],
): Retention {
  const was = getPins(parse(before));
  const now = getPins(parse(after));
  let kept = 0;
  let total = 0;
  const lost: string[] = [];

  for (const [id, pin] of Object.entries(was)) {
    for (const field of fields) {
      if (pin[field] === undefined) continue;
      total += 1;
      // 近い値・丸められた値は「残っていない」と数える（判定基準 3.1）。
      if (JSON.stringify(now[id]?.[field]) === JSON.stringify(pin[field])) {
        kept += 1;
        continue;
      }
      lost.push(`${id}.${String(field)}`);
    }
  }
  return { kept, total, lost };
}

function tierB(before: string, after: string): Retention {
  const base = retention(before, after, TIER_B_FIELDS);
  const groups = groupMembership(before, after);
  const text = textShape(before, after);
  return {
    kept: base.kept + groups.kept + text.kept,
    total: base.total + groups.total + text.total,
    lost: [...base.lost, ...groups.lost, ...text.lost],
  };
}

/** グループ所属。AI の書き換えでノードが VPC の外へ出ていないか。 */
function groupMembership(before: string, after: string): Retention {
  const was = nodeGroups(before);
  const now = nodeGroups(after);
  let kept = 0;
  let total = 0;
  const lost: string[] = [];

  for (const [id, group] of was) {
    if (!now.has(id)) continue; // 消えたノードは反映の側で数える
    total += 1;
    if (now.get(id) === group) kept += 1;
    else lost.push(`${id}.group`);
  }
  return { kept, total, lost };
}

/** コメントと並び順（原案 §26 の 9）。 */
function textShape(before: string, after: string): Retention {
  const lost: string[] = [];

  const comments = commentLines(before);
  const survived = comments.filter((line) => after.includes(line));
  for (const line of comments) {
    if (!after.includes(line)) lost.push(`comment: ${line.trim()}`);
  }

  const wasOrder = parse(before).nodeIds();
  const nowOrder = parse(after).nodeIds();
  const stillThere = wasOrder.filter((id) => nowOrder.includes(id));
  const ordered = nowOrder.filter((id) => stillThere.includes(id));
  const orderKept = JSON.stringify(stillThere) === JSON.stringify(ordered);
  if (!orderKept) lost.push('node order');

  return {
    kept: survived.length + (orderKept ? 1 : 0),
    total: comments.length + 1,
    lost,
  };
}

function commentLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#'));
}

function nodeGroups(text: string): Map<string, string | null> {
  const raw = parse(text).doc.toJS() as { nodes?: { id: string; group?: string }[] };
  return new Map((raw.nodes ?? []).map((node) => [node.id, node.group ?? null]));
}

// --- 反映 ------------------------------------------------------------------

function reflection(
  after: string,
  expectations: Expectation[],
): { expected: number; applied: number; missing: string[] } {
  const diagram = parse(after);
  const ids = new Set(diagram.nodeIds());
  const edges = diagram.edges();
  const labels = new Map(
    ((diagram.doc.toJS() as { nodes?: { id: string; label?: string }[] }).nodes ?? []).map(
      (node) => [node.id, node.label],
    ),
  );
  const missing: string[] = [];

  for (const want of expectations) {
    if (applied(want, ids, edges, labels)) continue;
    missing.push(describe(want));
  }
  return { expected: expectations.length, applied: expectations.length - missing.length, missing };
}

function applied(
  want: Expectation,
  ids: Set<string>,
  edges: { from: string; to: string }[],
  labels: Map<string, string | undefined>,
): boolean {
  switch (want.kind) {
    case 'node-added':
      return ids.has(want.id);
    case 'node-removed':
      return !ids.has(want.id);
    case 'edge-added':
      return edges.some((e) => e.from === want.from && e.to === want.to);
    case 'edge-removed':
      return !edges.some((e) => e.from === want.from && e.to === want.to);
    case 'label-changed':
      return labels.get(want.id) === want.to;
  }
}

function describe(want: Expectation): string {
  switch (want.kind) {
    case 'node-added':
      return `ノード ${want.id} が増える`;
    case 'node-removed':
      return `ノード ${want.id} が消える`;
    case 'edge-added':
      return `線 ${want.from}>${want.to} が増える`;
    case 'edge-removed':
      return `線 ${want.from}>${want.to} が消える`;
    case 'label-changed':
      return `${want.id} のラベルが ${want.to} になる`;
  }
}
