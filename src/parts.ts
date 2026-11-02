/**
 * **部品を定義して使い回す**（`parts` / `place`。仕様 §3.0.28）。
 *
 * ## なぜ入れたか
 *
 * 配置図には「同じ形をもう 1 つ」の書き方が無かった。だから見本は、**同じ部品を置くたびに全部書いていた** ——
 * 同じ形の節が 30 個以上ある見本が 44 枚、囲碁の盤は 1,587 行のほとんどが同じ 4 行の繰り返し
 * （`.claude/issues/parts-proposal.md`）。直すときは置いた数だけ直し、1 つ書き漏らすとその 1 つだけ違う形で出る。
 *
 * ## 描き方も検査も増やさない
 *
 * ここでやるのは、**読んだ直後に、ふつうの節・線・寸法へ展開すること**だけ。
 * 中の名前は `<as>.<id>`（格子は `<as>.<行>.<列>.<id>`）。描き方・検査・書き出しは、
 * 展開したあとのものを**いまのまま**見る。
 *
 * **正本には書き戻さない。** 展開した結果を書き戻すと、元の 1,587 行に戻る。
 * 展開は YAML の写しの上でやり、正本の文書には触らない（`expandParts` は別の文字列を返す）。
 *
 * ## 決めたこと
 *
 * - **回すのは部品の原点（`at` の点）を中心に、時計回り。** 外接の箱を中心にすると、
 *   部品に節を 1 つ足しただけで、置いたもの全部が動く
 * - **並び順は書いた順。** `place` を `nodes` より前に書けば、展開した節は `nodes` の前に並ぶ
 *   （配置図の描く順は大きいものから。同じ大きさの間でだけ効く。仕様 §3.1.5）
 * - **`set` で変えられるのは形でない語だけ**（`id` / `at` / `size` / `points` / `arc` / `from` / `to` は部品のもの）
 * - 人が置いたもの全体を動かすのは `pins.<as>.position`（格子は `pins.<as>` で全体、`pins.<as>.<行>.<列>` で 1 マス）。
 *   展開のときに原点へ当てて、`pins` からは外す（節ではないので、迷子と言わないため）
 */
import { isMap, isNode, isScalar, isSeq, parseDocument, YAMLMap, YAMLSeq } from 'yaml';
import type { Document } from 'yaml';

import { TO_STRING_OPTIONS } from './format.ts';

/** 回せる角（度。時計回り）。 */
export const ROTATIONS = [0, 90, 180, 270] as const;
export type Rotation = (typeof ROTATIONS)[number];

/** 置き方（`place[]`）に書ける語。 */
export const PLACE_KEYS = ['part', 'as', 'at', 'set', 'grid', 'rotate'] as const;
/** 部品（`parts.<名前>`）に書ける語。**辺は持たない**（線は `paths` で足りる）。 */
export const PART_KEYS = ['nodes', 'paths', 'dims'] as const;
export type PartKind = (typeof PART_KEYS)[number];
/** **`set` で変えられない語**（形は部品のもの）。 */
export const FIXED_KEYS = ['id', 'at', 'size', 'points', 'arc', 'from', 'to'] as const;
/** **回しても向きが変わらない語**（回すと形と食い違う）。 */
export const ROTATE_KEPT_KEYS = ['openings', 'height', 'image', 'symbol'] as const;
/** 格子のマスの上限。**書き間違いで何万個も作らない。** */
export const MAX_CELLS = 10_000;

const MARK = /^(parts|place):/m;

export interface Point {
  x: number;
  y: number;
}

export interface Grid {
  cols: number;
  rows: number;
  step: Point;
}

/** 置いたもの 1 つ（格子はマスごと）。 */
export interface Instance {
  /** `as`（格子は `<as>.<行>.<列>`）。`pins` の鍵。 */
  name: string;
  /** 置き方の `as`。 */
  place: string;
  /** 展開した中の名前。 */
  ids: string[];
}

export interface Expansion {
  /** 展開したか（`false` なら、文書には何もしていない）。 */
  changed: boolean;
  instances: Instance[];
  /** 格子に並べた置き方の `as`（`pins.<as>` で全体を動かす）。 */
  grids: string[];
  /** いまある名前と被ったので置かなかった名前と、その置き方。 */
  collisions: { id: string; item: unknown }[];
}

/** 名前に使えるか。**`.` と `>` は使えない**（`.` は中の名前の区切り、`>` は辺の鍵の区切り）。 */
export function nameOf(raw: unknown): string | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const name = String(raw);
  if (name === '' || name.includes('.') || name.includes('>')) return null;
  return name;
}

export function pointOf(raw: unknown): Point | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { x, y } = raw as Record<string, unknown>;
  return finite(x) && finite(y) ? { x, y } : null;
}

/** 格子。**読めなければ null**（`place-grid-invalid`）。 */
export function gridOf(raw: unknown): Grid | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { cols, rows, step } = raw as Record<string, unknown>;
  if (!count(cols) || !count(rows)) return null;
  const at = pointOf(step);
  if (at === null || cols * rows > MAX_CELLS) return null;
  return { cols, rows, step: at };
}

/** 回す角。書かなければ 0。**読めなければ null**（`place-rotate-invalid`。回さない）。 */
export function rotationOf(raw: unknown): Rotation | null {
  if (raw === undefined || raw === null) return 0;
  return ROTATIONS.includes(raw as Rotation) ? (raw as Rotation) : null;
}

/** 部品の中の 1 つ。 */
export interface Member {
  kind: PartKind;
  id: string;
  item: YAMLMap;
}

/** 部品の中身。**名前の無いもの・被ったものは落とす**（落とした理由は検証器が言う）。 */
export function membersOf(part: unknown): Member[] {
  if (!isMap(part)) return [];
  const out: Member[] = [];
  const seen = new Set<string>();
  for (const kind of PART_KEYS) {
    const list = part.get(kind, true);
    if (!isSeq(list)) continue;
    for (const item of list.items) {
      if (!isMap(item)) continue;
      const id = nameOf(item.get('id'));
      if (id === null || seen.has(id)) continue;
      seen.add(id);
      out.push({ kind, id, item });
    }
  }
  return out;
}

/** 置き方 1 つを読んだもの。 */
export interface PlaceRead {
  item: YAMLMap;
  part: YAMLMap;
  as: string;
  at: Point;
  grid: Grid | null;
  rotate: Rotation;
  set: YAMLMap | null;
}

/**
 * 置き方を読む。**置けないもの（部品が無い・名前が無い・位置が読めない・格子が読めない）は null。**
 * 回す角が読めないときは回さない（置きはする）。
 */
export function placeOf(item: unknown, parts: YAMLMap | null): PlaceRead | null {
  if (!isMap(item) || parts === null) return null;
  const part = parts.get(item.get('part'), true);
  if (!isMap(part)) return null;
  const as = nameOf(item.get('as'));
  if (as === null) return null;
  const at = pointOf(plain(item.get('at', true)));
  if (at === null) return null;
  const rawGrid = item.get('grid', true);
  const grid = rawGrid === undefined || rawGrid === null ? null : gridOf(plain(rawGrid));
  if (rawGrid !== undefined && rawGrid !== null && grid === null) return null;
  const set = item.get('set', true);
  return { item, part, as, at, grid, rotate: rotationOf(item.get('rotate')) ?? 0, set: isMap(set) ? set : null };
}

/** 正本に `parts` か `place` があるか（**無ければ何もしない**ための速い判定）。 */
export function mentionsParts(text: string): boolean {
  return MARK.test(text);
}

/** 展開した文字列の控え。**同じ正本を 1 回の検査で何度も読む**ので、作り直さない。 */
const cache = new Map<string, string>();
const CACHE_SIZE = 8;

/**
 * **描く・検査する側が読む文字列**を返す。正本に置いたものが無ければ、**同じ文字列をそのまま返す。**
 * 配置図でなければ展開しない（`parts-ignored`）。
 */
export function expandParts(text: string): string {
  if (!mentionsParts(text)) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const doc = parseDocument(text);
  let out = text;
  if (doc.errors.length === 0 && expandDocument(doc).changed) out = doc.toString(TO_STRING_OPTIONS);
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(text, out);
  return out;
}

/** 正本から、置いたものの一覧だけを読む（**正本には触らない**）。手直しの数え方が使う。 */
export function expansionOf(text: string): Expansion {
  const doc = parseDocument(text);
  if (doc.errors.length > 0) return { changed: false, instances: [], grids: [], collisions: [] };
  return expandDocument(doc);
}

/**
 * **文書を、その場で展開する**（渡した文書は書き換わる。正本の文書を渡さないこと）。
 *
 * 中の節・線・寸法は写しを作り（**行の位置を持ったまま** —— 検証器が部品の定義の行を指せる）、
 * 名前と座標だけを置き換える。
 */
export function expandDocument(doc: Document): Expansion {
  const out: Expansion = { changed: false, instances: [], grids: [], collisions: [] };
  if (String(doc.get('kind') ?? '') !== 'placement' || !isMap(doc.contents)) return out;
  const rawParts = doc.get('parts', true);
  const rawPlace = doc.get('place', true);
  if (rawParts === undefined && rawPlace === undefined) return out;
  const parts = isMap(rawParts) ? rawParts : null;
  const pins = doc.get('pins', true);
  const pinMap = isMap(pins) ? pins : null;

  const taken = new Set<string>();
  for (const kind of PART_KEYS) {
    const list = doc.get(kind, true);
    if (!isSeq(list)) continue;
    for (const item of list.items) {
      const id = isMap(item) ? item.get('id') : undefined;
      if (id !== undefined && id !== null) taken.add(String(id));
    }
  }

  const made: Record<PartKind, YAMLMap[]> = { nodes: [], paths: [], dims: [] };
  const used = new Set<string>();
  const seenAs = new Set<string>();
  for (const item of isSeq(rawPlace) ? rawPlace.items : []) {
    const read = placeOf(item, parts);
    if (read === null || seenAs.has(read.as)) continue;
    seenAs.add(read.as);
    const base = pinPosition(pinMap, read.as, used) ?? read.at;
    const members = membersOf(read.part);
    const own = new Set(members.map((member) => member.id));
    if (read.grid !== null) out.grids.push(read.as);
    for (const cell of cellsOf(read, base)) {
      const origin = (read.grid === null ? null : pinPosition(pinMap, cell.name, used)) ?? cell.origin;
      const ids: string[] = [];
      for (const member of members) {
        const id = `${cell.name}.${member.id}`;
        if (taken.has(id)) {
          out.collisions.push({ id, item });
          continue;
        }
        taken.add(id);
        const copy = member.item.clone() as YAMLMap;
        copy.set('id', id);
        place(doc, copy, member.kind, origin, read.rotate, cell.name, own);
        applySet(copy, read.set?.get(member.id, true));
        made[member.kind].push(copy);
        ids.push(id);
      }
      out.instances.push({ name: cell.name, place: read.as, ids });
    }
  }

  // **置いたもの全体の pin は、原点へ当てたので外す**（節ではないので、迷子と言わないため）。
  if (pinMap !== null) for (const key of used) pinMap.delete(key);

  const keys = doc.contents.items.map((pair) => String(isScalar(pair.key) ? pair.key.value : pair.key));
  const placeAt = keys.indexOf('place');
  for (const kind of PART_KEYS) {
    const list = made[kind];
    if (list.length === 0) continue;
    let seq = doc.get(kind, true);
    if (seq === undefined || seq === null) {
      seq = new YAMLSeq();
      doc.set(kind, seq);
    }
    if (!isSeq(seq)) continue;
    // **書いた順に並べる。** `place` が先に書いてあれば、`nodes` の前に（同じ大きさの間の描く順になる）。
    const before = placeAt >= 0 && keys.indexOf(kind) > placeAt;
    if (before) seq.items.unshift(...list);
    else seq.items.push(...list);
  }
  doc.delete('parts');
  doc.delete('place');
  out.changed = true;
  return out;
}

/** 置いたもの（格子はマスごと）の名前と原点。 */
function cellsOf(read: PlaceRead, base: Point): { name: string; origin: Point }[] {
  if (read.grid === null) return [{ name: read.as, origin: base }];
  const out: { name: string; origin: Point }[] = [];
  for (let row = 0; row < read.grid.rows; row += 1) {
    for (let col = 0; col < read.grid.cols; col += 1) {
      out.push({
        name: `${read.as}.${row}.${col}`,
        origin: { x: base.x + col * read.grid.step.x, y: base.y + row * read.grid.step.y },
      });
    }
  }
  return out;
}

/** 人が置いたもの全体を動かした位置。**当てたら控える**（あとで `pins` から外す）。 */
function pinPosition(pins: YAMLMap | null, key: string, used: Set<string>): Point | null {
  if (pins === null) return null;
  const pin = pins.get(key, true);
  if (pin === undefined) return null;
  used.add(key);
  return isMap(pin) ? pointOf(plain(pin.get('position', true))) : null;
}

/** 中の 1 つを、置いた所へ動かして回す。 */
function place(doc: Document, copy: YAMLMap, kind: PartKind, origin: Point, rotate: Rotation, name: string, own: ReadonlySet<string>): void {
  const to = (point: Point): Point => {
    const turned = turn(point, rotate);
    return { x: tidy(origin.x + turned.x), y: tidy(origin.y + turned.y) };
  };
  if (kind === 'nodes') {
    const at = plain(copy.get('at', true)) as Record<string, unknown> | null;
    const from = pointOf(at) ?? { x: 0, y: 0 };
    const size = plain(copy.get('size', true)) as { w?: unknown; h?: unknown } | null;
    const w = finite(size?.w) ? size.w : 0;
    const h = finite(size?.h) ? size.h : 0;
    const corner = to(topLeft(from, w, h, rotate));
    const next: Record<string, number> = { x: corner.x, y: corner.y };
    if (at !== null && finite(at.z)) next.z = at.z;
    copy.set('at', flow(doc.createNode(next)));
    if ((rotate === 90 || rotate === 270) && finite(size?.w) && finite(size?.h)) {
      copy.set('size', flow(doc.createNode({ w: size.h, h: size.w })));
    }
    // **180 度は三角の向きを返す**（90 度で返せる印は無い。検証器が言う）
    if (rotate === 180) {
      const marker = copy.get('marker');
      if (marker === 'triangle') copy.set('marker', 'triangle-down');
      else if (marker === 'triangle-down') copy.set('marker', 'triangle');
    }
    return;
  }
  if (kind === 'paths') {
    const points = plain(copy.get('points', true));
    if (Array.isArray(points)) {
      const read = points.map(anyPoint);
      if (read.every((point) => point !== null)) {
        copy.set('points', flowAll(doc.createNode(read.map((point) => { const p = to(point!); return [p.x, p.y]; }))));
      }
    }
    const arc = plain(copy.get('arc', true)) as Record<string, unknown> | null;
    const center = arc === null ? null : anyPoint(arc.center);
    if (arc !== null && center !== null) {
      const c = to(center);
      const next: Record<string, unknown> = { ...arc, center: [c.x, c.y] };
      if (finite(arc.from)) next.from = arc.from + rotate;
      if (finite(arc.to)) next.to = arc.to + rotate;
      copy.set('arc', flowAll(doc.createNode(next)));
    }
    return;
  }
  // 寸法: 点は動かして回す。中の節の辺は、置いたものの節の辺にして、辺も回す。
  for (const end of ['from', 'to'] as const) {
    const raw = plain(copy.get(end, true));
    const point = Array.isArray(raw) ? anyPoint(raw) : null;
    if (point !== null) {
      const p = to(point);
      copy.set(end, flowAll(doc.createNode([p.x, p.y])));
      continue;
    }
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const { node, side } = raw as Record<string, unknown>;
    const inside = (typeof node === 'string' || typeof node === 'number') && own.has(String(node));
    if (!inside) continue;
    const next = { ...(raw as Record<string, unknown>), node: `${name}.${String(node)}` } as Record<string, unknown>;
    if (typeof side === 'string') next.side = turnSide(side, rotate);
    copy.set(end, flowAll(doc.createNode(next)));
  }
  const along = copy.get('along');
  if ((rotate === 90 || rotate === 270) && (along === 'x' || along === 'y')) copy.set('along', along === 'x' ? 'y' : 'x');
}

/** 点を原点のまわりに時計回りに回す（紙の y は下向き）。 */
function turn(point: Point, rotate: Rotation): Point {
  if (rotate === 90) return { x: -point.y, y: point.x };
  if (rotate === 180) return { x: -point.x, y: -point.y };
  if (rotate === 270) return { x: point.y, y: -point.x };
  return point;
}

/** 回したあとの箱の左上が、回す前のどの角だったか（回す前の座標で返す）。 */
function topLeft(at: Point, w: number, h: number, rotate: Rotation): Point {
  if (rotate === 90) return { x: at.x, y: at.y + h };
  if (rotate === 180) return { x: at.x + w, y: at.y + h };
  if (rotate === 270) return { x: at.x + w, y: at.y };
  return at;
}

const SIDE_TURN: Record<string, string> = { top: 'right', right: 'bottom', bottom: 'left', left: 'top' };

function turnSide(side: string, rotate: Rotation): string {
  let out = side;
  for (let i = 0; i < rotate / 90; i += 1) out = SIDE_TURN[out] ?? out;
  return out;
}

/** `set` を当てる。**形の語は当てない**（検証器が `place-set-key-fixed` で言う）。`null` は消す。 */
function applySet(copy: YAMLMap, raw: unknown): void {
  if (!isMap(raw)) return;
  for (const pair of raw.items) {
    const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
    if ((FIXED_KEYS as readonly string[]).includes(key)) continue;
    const value = pair.value;
    if (value === null || (isScalar(value) && value.value === null)) {
      copy.delete(key);
      continue;
    }
    copy.set(key, isNode(value) ? value.clone() : value);
  }
}

/** `[ x, y ]` か `{ x, y }`。 */
function anyPoint(raw: unknown): Point | null {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) return null;
    const [x, y] = raw as unknown[];
    return finite(x) && finite(y) ? { x, y } : null;
  }
  return pointOf(raw);
}

function plain(node: unknown): unknown {
  if (node === undefined || node === null) return null;
  return isNode(node) ? node.toJSON() : node;
}

function flow<T>(node: T): T {
  if (isMap(node) || isSeq(node)) node.flow = true;
  return node;
}

/** 入れ子の一覧と写像も 1 行で（`[ [ 1, 2 ], [ 3, 4 ] ]`）。 */
function flowAll<T>(node: T): T {
  flow(node);
  if (isMap(node) || isSeq(node)) for (const item of node.items) flowAll(isMap(node) ? (item as { value: unknown }).value : item);
  return node;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** 0.01px に丸める。**`-0` を 0 にする。** */
function tidy(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}
