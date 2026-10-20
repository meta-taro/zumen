/**
 * **赤入れ**（`markup`）。図の上に重ねる、人へ伝えるための手書きの線と付箋。
 *
 * 2026-10-20（D46）。図を見た人が「ここを太く」「この線は要らない」を、図そのものを変えずに書き込みたい。
 *
 * - **図には効かない。** 描画にも、意味の指紋（`review`）にも、AI の提案のマージにも入らない
 * - **正本の中に置く。** ファイルを渡せば赤入れも一緒に渡る（D4：人の指定を別ファイルへ逃がさない）
 * - **AI は読めるが書けない**（`pins` と同じ）。人が書き、AI が案を出し、人が承認する往復に乗る
 * - **箱に結べる**（`on`）。結んだ赤入れの座標は箱の左上から測るので、AI が箱を動かしてもついていく
 *
 * ```yaml
 * markup:
 *   - ink: [[10, 20], [40, 60], [80, 70]]   # 手書きの線（点の並び）
 *     color: blue                            # red（既定）/ blue / green / black / orange
 *     width: thick                           # thin / normal（既定）/ thick
 *   - note: ここを太く                        # 付箋
 *     at: { x: 120, y: 40 }
 *     on: db                                 # 結ぶ箱の id（書かなければ紙の座標）
 * ```
 */

import { isMap, isSeq } from 'yaml';
import type { YAMLMap, YAMLSeq } from 'yaml';

import { parse, serialize } from './format.ts';

export interface Point {
  x: number;
  y: number;
}

/** 選べる色。**数色に絞る** —— 赤入れは伝えるための印で、作図の色ではない。 */
export const MARKUP_COLORS = {
  red: '#d0312d',
  blue: '#1f5fbf',
  green: '#2e8b3e',
  black: '#222222',
  orange: '#e07b00',
} as const;
export type MarkupColor = keyof typeof MARKUP_COLORS;

/** 線の太さ（px）。語は図の線と同じ thin / normal / thick。 */
export const MARKUP_WIDTHS = { thin: 1.5, normal: 3, thick: 6 } as const;
export type MarkupWidth = keyof typeof MARKUP_WIDTHS;

interface Common {
  color: MarkupColor;
  width: MarkupWidth;
  /** 結んだ箱の id。null なら紙の座標。 */
  on: string | null;
}
export type Markup = ({ kind: 'ink'; points: Point[] } | { kind: 'note'; text: string; at: Point }) & Common;

const isColor = (v: unknown): v is MarkupColor => typeof v === 'string' && Object.hasOwn(MARKUP_COLORS, v);
const isWidth = (v: unknown): v is MarkupWidth => typeof v === 'string' && Object.hasOwn(MARKUP_WIDTHS, v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `[x, y]` か `{ x, y }`。読めなければ null。 */
export function pointOf(v: unknown): Point | null {
  if (Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1])) return { x: v[0], y: v[1] };
  if (v !== null && typeof v === 'object') {
    const r = v as Record<string, unknown>;
    if (num(r.x) && num(r.y)) return { x: r.x, y: r.y };
  }
  return null;
}

/** 手書きの線の点。2 点に満たなければ null。 */
export function inkOf(v: unknown): Point[] | null {
  if (!Array.isArray(v)) return null;
  const points = v.map(pointOf);
  if (points.length < 2 || points.some((p) => p === null)) return null;
  return points as Point[];
}

/**
 * 読めない項目は落とす（`validate` が知らせる）。色・太さが選べない語なら既定へ戻す。
 */
export function markupOf(raw: unknown): Markup[] {
  if (!Array.isArray(raw)) return [];
  const out: Markup[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const common: Common = {
      color: isColor(r.color) ? r.color : 'red',
      width: isWidth(r.width) ? r.width : 'normal',
      on: typeof r.on === 'string' && r.on.trim() !== '' ? r.on.trim() : null,
    };
    if ('ink' in r) {
      const points = inkOf(r.ink);
      if (points !== null) out.push({ kind: 'ink', points, ...common });
      continue;
    }
    if (typeof r.note === 'string' && r.note.trim() !== '') {
      const at = pointOf(r.at);
      if (at !== null) out.push({ kind: 'note', text: r.note.trim(), at, ...common });
    }
  }
  return out;
}

export const isMarkupColor = isColor;
export const isMarkupWidth = isWidth;

const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * **赤入れを 1 件足す**（画面のペン・付箋から）。正本のほかの行・コメントには触らない。
 * 既定の色（red）・太さ（normal）は書かない —— 人が選んでいない行を増やさない。
 */
export function addMarkup(text: string, item: Markup): string {
  const diagram = parse(text);
  const doc = diagram.doc;
  let seq = doc.get('markup', true);
  if (!isSeq(seq)) {
    seq = doc.createNode([]) as YAMLSeq;
    doc.set('markup', seq);
  }
  const list = seq as YAMLSeq;
  list.flow = false;
  const body: Record<string, unknown> =
    item.kind === 'ink'
      ? { ink: item.points.map((p) => [r1(p.x), r1(p.y)]) }
      : { note: item.text, at: { x: r1(item.at.x), y: r1(item.at.y) } };
  if (item.color !== 'red') body.color = item.color;
  if (item.kind === 'ink' && item.width !== 'normal') body.width = item.width;
  if (item.on !== null) body.on = item.on;
  const node = doc.createNode(body) as YAMLMap;
  node.flow = false;
  for (const key of ['ink', 'at']) {
    const inner = node.get(key, true);
    if (isSeq(inner) || isMap(inner)) inner.flow = true;
    if (isSeq(inner)) for (const p of inner.items) if (isSeq(p)) p.flow = true;
  }
  list.add(node);
  return serialize(diagram);
}

/** **赤入れを 1 件消す**（何件目か）。最後の 1 件を消したら `markup:` ごと消す。 */
export function removeMarkup(text: string, index: number): string {
  const diagram = parse(text);
  const seq = diagram.doc.get('markup', true);
  if (!isSeq(seq) || index < 0 || index >= seq.items.length) return text;
  seq.items.splice(index, 1);
  if (seq.items.length === 0) diagram.doc.delete('markup');
  return serialize(diagram);
}

/** 紙の上に置いた赤入れ。`index` は正本の中の何件目か（消すときに使う）。 */
export type PlacedMarkup =
  | { item: Markup & { kind: 'ink' }; index: number; points: Point[]; orphaned: boolean }
  | { item: Markup & { kind: 'note' }; index: number; at: Point; orphaned: boolean };

/**
 * **紙の座標へ直す。** 箱に結んだ赤入れは箱の左上を足す。結んだ箱が無ければ、書いた数をそのまま紙の座標として出し、
 * `orphaned` の印を付ける（黙って捨てない）。
 */
export function placeMarkup(items: Markup[], boxes: readonly { id: string; x: number; y: number }[]): PlacedMarkup[] {
  const byId = new Map(boxes.map((b) => [b.id, b]));
  return items.map((item, index) => {
    const box = item.on === null ? undefined : byId.get(item.on);
    const orphaned = item.on !== null && box === undefined;
    const dx = box?.x ?? 0, dy = box?.y ?? 0;
    const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
    return item.kind === 'ink'
      ? { item, index, points: item.points.map(shift), orphaned }
      : { item, index, at: shift(item.at), orphaned };
  });
}

/**
 * **ペンの軌跡を間引く**（Douglas–Peucker、許す幅 `tol` px）。端は必ず残す。
 * 手の震えの点をそのまま正本へ書くと、1 本で数百行になる。
 */
export function strokeOf(points: readonly Point[], tol = 1.5): Point[] {
  if (points.length <= 2) return points.map((p) => ({ x: r1(p.x), y: r1(p.y) }));
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [i, j] = stack.pop() as [number, number];
    const a = points[i] as Point, b = points[j] as Point;
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    let best = -1, at = -1;
    for (let k = i + 1; k < j; k++) {
      const p = points[k] as Point;
      const d = len === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / len;
      if (d > best) { best = d; at = k; }
    }
    if (best > tol) { keep[at] = 1; stack.push([i, at], [at, j]); }
  }
  return points.filter((_, k) => keep[k] === 1).map((p) => ({ x: r1(p.x), y: r1(p.y) }));
}
