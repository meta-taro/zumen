/**
 * AI の提案を、人が持っている正本へ入れる。
 *
 * **向きが逆だと成立しない。** AI の出力を新しい正本として採用すると、その瞬間に
 * 人の手直しもコメントも並び順も消える。ここでは AI が出すのは提案（semantics）で、
 * 書き換わるのは人の正本のほう、という向きにする。
 *
 * 守る規則は 3 つ。
 *
 * 1. **`pins` は提案から読まない。** AI が書いてきても採らない。人の指定は人のもの
 * 2. **黙って上書きしない。** 人の指定とぶつかったら、適用せずに競合として返す
 * 3. **値が同じキーには触らない。** 触ると人が直していない行に差分が出る
 *
 * 配置図の節（`paths` / `dims` / `parts` / `place` / `scale`）も同じ規則で入れる（`src/merge-placement.ts`）。
 * 図の設定と作図の節（`title` / `palette` / `grid` / `let` …）も同じ（`src/merge-settings.ts`）。
 * **`review` と `markup` も提案から読まない**（`pins` と同じく、人だけが書く）。
 */
import { isMap, isSeq } from 'yaml';
import type { YAMLMap, YAMLSeq } from 'yaml';

import { deletePin, getPins, parse, serialize, setPin } from './format.ts';
import type { Diagram, Pin } from './format.ts';
import { mergePlacement, mergeScale, pinsOfPlace, placeOf, placesOf, removePlacementElement } from './merge-placement.ts';
import { mergeSettings, takeConstant, takeKind } from './merge-settings.ts';

export type Position = { x: number; y: number };

export type Conflict =
  /**
   * pin を持つものを AI が消そうとした。消さずに残して聞く。
   * `elementId` はノード・線・寸法の `id`、エッジの `from>to`、置いたものの `as`、部品の中の `<as>.<id>`。
   */
  | { kind: 'pin-orphaned'; elementId: string; reason: 'removed' }
  /** pin を持つノードに AI が別の位置を出してきた。まだ決まっていない。 */
  | { kind: 'position-proposed'; elementId: string; human: Position; ai: Position }
  /** 同じ提案だが、人が既に「自分の位置を採る」と決めている。聞き直さない。 */
  | { kind: 'position-suppressed'; elementId: string; ai: Position }
  /** 人が pin した作図の定数（`pins.<名前>.value`）に、AI が別の値を出してきた（§3.6）。 */
  | { kind: 'value-proposed'; elementId: string; human: number; ai: number | string }
  /** 同じ提案だが、人が既に「自分の値を採る」と決めている。聞き直さない。 */
  | { kind: 'value-suppressed'; elementId: string; ai: number | string }
  /**
   * 提案が図の種類（`kind`）を変えてきた。**入れない。** 種類が変わると、正本の座標・pin の読み方ごと変わる。
   * 書く場所（pin）が無いので、人が `kind` を変えない限り、同じ提案ではまた聞く。
   */
  | { kind: 'kind-proposed'; elementId: 'kind'; human: string; ai: string };

export interface MergeResult {
  text: string;
  conflicts: Conflict[];
}

/** 提案の側にだけ意味があり、正本のノード定義には書かないキー。 */
const INTENT_KEYS = new Set(['position']);

export function merge(currentText: string, proposalText: string): MergeResult {
  const current = parse(currentText);
  const proposal = parse(proposalText);
  const pins = getPins(current);
  const conflicts: Conflict[] = [];

  mergeSettings(current, proposal, pins, conflicts);
  const proposalNodes = itemsById(proposal, 'nodes', 'id');
  const kept = mergeNodes(current, proposalNodes, pins, conflicts);
  mergeGroups(current, proposal);
  mergeScale(current, proposal);
  const keptPlaces = mergePlacement(current, proposal, pins, conflicts);
  const proposalPlaces = new Set(placesOf(proposal));
  mergeEdges(current, proposal, { nodes: kept, places: keptPlaces, proposalPlaces }, pins, conflicts);
  applyPositionIntents(current, proposalNodes, pins, conflicts);

  return { text: serialize(current), conflicts };
}

/**
 * 競合を解く。
 *
 * 決めた結果は**正本へ書く**。実行中の変数に持つと、次に開いたときに消えて
 * 同じことを聞き直す羽目になる（判定基準 3.3 の「持続」）。
 */
export function resolve(text: string, conflict: Conflict, choice: 'human' | 'ai'): string {
  if (conflict.kind === 'kind-proposed' && choice === 'human') return text;
  const doc = parse(text);
  const id = conflict.elementId;

  if (conflict.kind === 'kind-proposed') {
    takeKind(doc, conflict.ai);
    return serialize(doc);
  }
  if (conflict.kind === 'value-proposed' || conflict.kind === 'value-suppressed') {
    if (choice === 'ai') takeConstant(doc, id, conflict.ai);
    else lockPin(doc, id);
    return serialize(doc);
  }

  if (conflict.kind === 'pin-orphaned') {
    if (choice === 'ai') removeElement(doc, id);
    else lockPins(doc, id);
    return serialize(doc);
  }

  if (choice === 'ai') {
    // 人が AI の位置を受け入れた。以後はそれが人の指定になる。
    const pin = getPins(doc)[id] ?? {};
    setPin(doc, id, { ...pin, position: conflict.ai, locked: undefined });
  } else {
    lockPin(doc, id);
  }
  return serialize(doc);
}

// --- ノード ----------------------------------------------------------------

function mergeNodes(
  current: Diagram,
  proposalNodes: Map<string, YAMLMap>,
  pins: Record<string, Pin>,
  conflicts: Conflict[],
): Set<string> {
  const kept = new Set<string>();
  // 作図（`kind: construction`）には節が無い。読むだけで `nodes: []` を生やさない
  if (readSeq(current, 'nodes') === null && proposalNodes.size === 0) return kept;
  const seq = getSeq(current, 'nodes');
  const remaining: unknown[] = [];

  for (const item of seq.items) {
    if (!isMap(item)) continue;
    const id = String(item.get('id'));
    const proposed = proposalNodes.get(id);

    if (proposed === undefined) {
      if (pins[id] !== undefined) {
        // 人が場所を決めたノードを黙って消さない。消してから聞いても戻せない。
        conflicts.push({ kind: 'pin-orphaned', elementId: id, reason: 'removed' });
        remaining.push(item);
        kept.add(id);
      }
      continue;
    }

    updateFields(current, item, proposed);
    remaining.push(item);
    kept.add(id);
  }

  seq.items = remaining;

  for (const [id, proposed] of proposalNodes) {
    if (kept.has(id)) continue;
    const added = current.doc.createNode(withoutIntent(proposed.toJSON())) as YAMLMap;
    added.spaceBefore = true;
    seq.items.push(added);
    kept.add(id);
  }

  return kept;
}

function mergeGroups(current: Diagram, proposal: Diagram): void {
  const proposed = itemsById(proposal, 'groups', 'id');
  if (readSeq(current, 'groups') === null && proposed.size === 0) return;
  const seq = getSeq(current, 'groups');
  const remaining: unknown[] = [];

  for (const item of seq.items) {
    if (!isMap(item)) continue;
    const id = String(item.get('id'));
    const next = proposed.get(id);
    if (next === undefined) continue;
    updateFields(current, item, next);
    remaining.push(item);
    proposed.delete(id);
  }
  for (const [, next] of proposed) {
    const added = current.doc.createNode(next.toJSON()) as YAMLMap;
    added.spaceBefore = true;
    remaining.push(added);
  }
  seq.items = remaining;
}

// --- エッジ ----------------------------------------------------------------

/** エッジには id が無い。両端の組で照合する。pin の鍵と同じ形にする。 */
function edgeKey(item: YAMLMap): string {
  return `${String(item.get('from'))}>${String(item.get('to'))}`;
}

/** 線の端が、merge のあとも居るか。置いたものの中（`L1.body`）は、置いたもの（`L1`）で見る。 */
interface KeptEnds {
  nodes: Set<string>;
  places: Set<string>;
  proposalPlaces: Set<string>;
}

function mergeEdges(
  current: Diagram,
  proposal: Diagram,
  kept: KeptEnds,
  pins: Record<string, Pin>,
  conflicts: Conflict[],
): void {
  const proposed = new Map<string, YAMLMap>();
  for (const item of readSeq(proposal, 'edges')?.items ?? []) {
    if (isMap(item)) proposed.set(edgeKey(item), item);
  }
  if (readSeq(current, 'edges') === null && proposed.size === 0) return;
  const seq = getSeq(current, 'edges');
  const proposalIds = new Set(proposal.nodeIds());
  const stays = (id: string) => kept.nodes.has(id) || kept.places.has(placeOf(id));
  const inProposal = (id: string) => proposalIds.has(id) || kept.proposalPlaces.has(placeOf(id));

  const remaining: unknown[] = [];
  for (const item of seq.items) {
    if (!isMap(item)) continue;
    const key = edgeKey(item);
    const next = proposed.get(key);
    if (next === undefined) {
      // 人が手で曲げた線を黙って消さない。ノードと同じ扱いで、残して聞く。
      if (pins[key] !== undefined) {
        conflicts.push({ kind: 'pin-orphaned', elementId: key, reason: 'removed' });
        remaining.push(item);
        continue;
      }
      // 競合で残したノードに繋がる線は、ノードと一緒に残す。片端の無い線を作らない。
      const from = String(item.get('from'));
      const to = String(item.get('to'));
      const bothStillProposed = inProposal(from) && inProposal(to);
      if (stays(from) && stays(to) && !bothStillProposed) {
        remaining.push(item);
      }
      continue;
    }
    updateFields(current, item, next);
    remaining.push(item);
    proposed.delete(key);
  }

  for (const [, next] of proposed) {
    const added = current.doc.createNode(next.toJSON()) as YAMLMap;
    added.spaceBefore = true;
    remaining.push(added);
  }
  seq.items = remaining;
}

// --- 位置の意思 ------------------------------------------------------------

/**
 * 提案に書かれた位置を扱う。
 *
 * 規約として、**AI は位置を書かない**。書いてあるということは、人の指示が
 * 場所についてのものだった、ということ以外にありえない。だから無視もしないし、
 * 黙って採りもしない。
 */
function applyPositionIntents(
  current: Diagram,
  proposalNodes: Map<string, YAMLMap>,
  pins: Record<string, Pin>,
  conflicts: Conflict[],
): void {
  for (const [id, node] of proposalNodes) {
    const ai = toPosition(node);
    if (ai === null) continue;

    const pin = pins[id];
    if (pin === undefined || pin.position === undefined) {
      // 人の指定が無いところへの位置指定は、ぶつかる相手がいない。そのまま人の指定にする。
      setPin(current, id, { ...pin, position: ai });
      continue;
    }
    if (samePosition(pin.position, ai)) continue;

    conflicts.push(
      pin.locked === true
        ? { kind: 'position-suppressed', elementId: id, ai }
        : { kind: 'position-proposed', elementId: id, human: pin.position, ai },
    );
  }
}

// --- 小道具 ----------------------------------------------------------------

/** 読むだけ。無い節を勝手に作らない。 */
function readSeq(diagram: Diagram, key: string): YAMLSeq | null {
  const node = diagram.doc.get(key, true);
  return isSeq(node) ? node : null;
}

/**
 * 書き込む用。無ければ作る。
 *
 * **足すものがあるときだけ呼ぶ。** 読むだけのつもりで呼ぶと、
 * 誰も書いていない `groups: []` のような行が正本に生える。
 * 人が書いていない行を増やさないのが、この形式のいちばん大事な性質。
 */
function getSeq(diagram: Diagram, key: string): YAMLSeq {
  const existing = readSeq(diagram, key);
  if (existing !== null) return existing;
  const created = diagram.doc.createNode([]) as YAMLSeq;
  diagram.doc.set(key, created);
  return created;
}

function itemsById(diagram: Diagram, key: string, idKey: string): Map<string, YAMLMap> {
  const out = new Map<string, YAMLMap>();
  for (const item of readSeq(diagram, key)?.items ?? []) {
    if (isMap(item)) out.set(String(item.get(idKey)), item);
  }
  return out;
}

function withoutIntent(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (INTENT_KEYS.has(key)) continue;
    out[key] = inner;
  }
  return out;
}

/**
 * 値が変わったキーだけを書き換える。
 *
 * 同じ値でも書き直すと、そのキーに付いていたコメントや書き方が入れ替わり、
 * 人が直していない行に差分が出る。**差分は人の手直しの記録**なので汚さない。
 */
function updateFields(current: Diagram, item: YAMLMap, proposed: YAMLMap): void {
  const next = withoutIntent(proposed.toJSON()) as Record<string, unknown>;
  const before = item.toJSON() as Record<string, unknown>;

  for (const [key, value] of Object.entries(next)) {
    if (JSON.stringify(before[key]) === JSON.stringify(value)) continue;
    item.set(key, current.doc.createNode(value));
  }
  for (const key of Object.keys(before)) {
    if (key in next) continue;
    if (INTENT_KEYS.has(key)) continue;
    item.delete(key);
  }
}

function removeNode(diagram: Diagram, id: string): void {
  const nodes = readSeq(diagram, 'nodes');
  if (nodes !== null) {
    nodes.items = nodes.items.filter((item) => !(isMap(item) && String(item.get('id')) === id));
  }
  const edges = readSeq(diagram, 'edges');
  if (edges === null) return;
  edges.items = edges.items.filter(
    (item) => !(isMap(item) && (String(item.get('from')) === id || String(item.get('to')) === id)),
  );
}

function removeEdge(diagram: Diagram, id: string): void {
  const [from, to] = id.split('>');
  const edges = readSeq(diagram, 'edges');
  if (edges === null) return;
  edges.items = edges.items.filter(
    (item) => !(isMap(item) && String(item.get('from')) === from && String(item.get('to')) === to),
  );
}

function removeElement(diagram: Diagram, id: string): void {
  if (id.includes('>')) removeEdge(diagram, id);
  else if (!removePlacementElement(diagram, id)) removeNode(diagram, id);
  deletePin(diagram, id);
}

/** 置いたものは、中の手直し（`pins.<as>.…`）にも全部印を付ける。どれか 1 つ残すと、また聞かれる。 */
function lockPins(diagram: Diagram, id: string): void {
  const isPlace = !id.includes('>') && placesOf(diagram).includes(id);
  const keys = isPlace ? pinsOfPlace(getPins(diagram), id) : [id];
  for (const key of keys) lockPin(diagram, key);
}

function lockPin(diagram: Diagram, id: string): void {
  const pin = getPins(diagram)[id];
  if (pin === undefined) return;
  setPin(diagram, id, { ...pin, locked: true });
}

function toPosition(node: YAMLMap): Position | null {
  const raw: unknown = node.get('position', true);
  // `get` は入れ子を YAML の節のまま返す。比較に使うので素の値へ落とす。
  const value = isMap(raw) ? (raw.toJSON() as unknown) : raw;
  if (typeof value !== 'object' || value === null) return null;
  const { x, y } = value as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return { x, y };
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}
