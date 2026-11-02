/**
 * 配置図の節（`paths` / `dims` / `parts` / `place` / `scale`）を、提案から人の正本へ入れる。
 *
 * **入れ方は節（`nodes` / `edges`）と同じ**（仕様 §6.2。`src/merge.ts`）——
 *
 * 1. 鍵で照合する。線と寸法は `id`、置き方は `as`、部品は名前、部品の中は `id`
 * 2. **値が同じキーには触らない。** 変えるときも、提案の書き方（`[ x, y ]` の 1 行）のまま入れる
 * 3. 提案に無いものは消す。ただし**人の手直し（`pins`）があるものは消さずに競合として返す**
 *
 * 直す前は、この 5 つを merge が 1 つも見ていなかった。提案が線を足しても・寸法の文字を変えても・
 * 置いたものを消しても、正本は 1 文字も変わらず、競合も出なかった。**頼んだ変更が黙って捨てられていた。**
 */
import { isMap, isScalar, isSeq } from 'yaml';
import type { Document, Pair, YAMLMap, YAMLSeq } from 'yaml';

import { deletePin, getPins } from './format.ts';
import type { Diagram, Pins } from './format.ts';
import type { Conflict } from './merge.ts';

/** 消そうとしたものに人の手直しがあれば、競合に書く鍵を返す。無ければ undefined。 */
type Pinned = (id: string) => string | undefined;

/** 部品の中に書ける節（§3.0.28）。 */
const PART_SECTIONS = ['nodes', 'paths', 'dims'] as const;
const PART_SECTION_SET: ReadonlySet<string> = new Set(PART_SECTIONS);

/**
 * 線・寸法・置き方・部品を入れる。返すのは、入れたあとも正本に残っている置き方の名前。
 *
 * **置き方を部品より先に見る。** 競合で残した置き方が使う部品を、消してしまわないように。
 */
export function mergePlacement(current: Diagram, proposal: Diagram, pins: Pins, conflicts: Conflict[]): Set<string> {
  const root = rootOf(current);
  if (root === null) return new Set();
  const given = rootOf(proposal);
  const doc = current.doc;
  const own: Pinned = (id) => (pins[id] !== undefined ? id : undefined);

  const places = mergeKeyed(doc, root, given, 'place', 'as', (as) => (pinsOfPlace(pins, as).length > 0 ? as : undefined), conflicts);
  mergeKeyed(doc, root, given, 'paths', 'id', own, conflicts);
  mergeKeyed(doc, root, given, 'dims', 'id', own, conflicts);
  mergeParts(current, given, pins, conflicts);
  return places;
}

/**
 * 縮尺（`scale`）は語ごとに入れる（`scale.unit` を足す提案で、`mm` の行を書き直さない）。
 *
 * **提案が `scale` を書かなければ触らない。** 縮尺は要素ではなく図の設定で、
 * 書いていないのは「消して」ではなく「触っていない」と読む（`title` と同じ）。
 */
export function mergeScale(current: Diagram, proposal: Diagram): void {
  const next = rootOf(proposal)?.get('scale', true);
  if (!isMap(next)) return;
  const root = rootOf(current);
  if (root === null) return;
  const existing = root.get('scale', true);
  if (isMap(existing)) {
    updateFieldsAsWritten(existing, next);
    return;
  }
  if (existing === undefined) {
    insertSection(current.doc, root, 'scale', next.clone(), ['parts', 'place', 'paths', 'dims', 'nodes', 'edges', 'pins']);
  }
}

/** 置いたものの中の名前（`L1.body`）から、置いたもの（`L1`）を出す。`.` が無ければそのまま。 */
export function placeOf(id: string): string {
  const dot = id.indexOf('.');
  return dot === -1 ? id : id.slice(0, dot);
}

/** 置き方の名前（`place[].as`）。 */
export function placesOf(diagram: Diagram): string[] {
  return keysOf(readSeq(diagram, 'place'), 'as');
}

/**
 * 競合で「AI を採る」と決めた線・寸法・置き方・部品の中の 1 つを消す。消せたら true。
 *
 * **置き方を消すときは、その中の手直し（`pins.<as>` と `pins.<as>.…`）も全部消す。**
 * 残すと、居ない要素を指す迷子の pin になる。
 */
export function removePlacementElement(diagram: Diagram, id: string): boolean {
  if (diagram.pathIds().includes(id)) return removeOne(diagram, 'paths', 'id', id);
  if (diagram.dimIds().includes(id)) return removeOne(diagram, 'dims', 'id', id);

  const places = placesOf(diagram);
  if (places.includes(id)) {
    removeItems(readSeq(diagram, 'place'), (item) => String(item.get('as')) === id);
    removeEdgesTouching(diagram, (end) => end.includes('.') && placeOf(end) === id);
    for (const key of pinsOfPlace(getPins(diagram), id)) deletePin(diagram, key);
    return true;
  }
  if (id.includes('.') && places.includes(placeOf(id))) {
    removeMember(diagram, placeOf(id), id);
    removeEdgesTouching(diagram, (end) => end === id);
    deletePin(diagram, id);
    return true;
  }
  return false;
}

/** 置いたもの（全体・格子のマス・中の 1 つ）に付いた pin の鍵。辺の鍵（`>`）は含めない。 */
export function pinsOfPlace(pins: Pins, as: string): string[] {
  return Object.keys(pins).filter((key) => !key.includes('>') && (key === as || key.startsWith(`${as}.`)));
}

// --- 並びを鍵で入れる ------------------------------------------------------

/**
 * `holder[key]` の並びへ、提案の同じ並びを `idKey` で照合して入れる。返すのは残った鍵。
 *
 * 名前（`idKey`）の無いものは照合できないので触らない（消さない）。
 */
function mergeKeyed(
  doc: Document,
  holder: YAMLMap,
  proposalHolder: YAMLMap | null,
  key: string,
  idKey: string,
  pinned: Pinned,
  conflicts: Conflict[],
): Set<string> {
  const given = proposalHolder?.get(key, true);
  const proposed = new Map<string, YAMLMap>();
  for (const item of isSeq(given) ? given.items : []) {
    const id = isMap(item) ? item.get(idKey) : undefined;
    if (id !== undefined && id !== null) proposed.set(String(id), item as YAMLMap);
  }

  const kept = new Set<string>();
  const existing = holder.get(key, true);
  if (!isSeq(existing)) {
    // 正本に無い節は、提案に中身があるときだけ足す。誰も書いていない `paths: []` を生やさない。
    if (existing !== undefined || !isSeq(given) || proposed.size === 0) return kept;
    insertSection(doc, holder, key, given.clone(), ['pins']);
    for (const id of proposed.keys()) kept.add(id);
    return kept;
  }

  const hadItems = existing.items.length > 0;
  const remaining: unknown[] = [];
  for (const item of existing.items) {
    const raw = isMap(item) ? item.get(idKey) : undefined;
    if (raw === undefined || raw === null) {
      remaining.push(item);
      continue;
    }
    const id = String(raw);
    const next = proposed.get(id);
    if (next === undefined) {
      const pin = pinned(id);
      if (pin !== undefined) {
        // 人が直したものを黙って消さない。消してから聞いても戻せない（§6.2）。
        conflicts.push({ kind: 'pin-orphaned', elementId: pin, reason: 'removed' });
        remaining.push(item);
        kept.add(id);
      }
      continue;
    }
    updateFieldsAsWritten(item as YAMLMap, next);
    remaining.push(item);
    kept.add(id);
    proposed.delete(id);
  }
  for (const [id, next] of proposed) {
    const added = next.clone() as YAMLMap;
    added.spaceBefore = true;
    remaining.push(added);
    kept.add(id);
  }
  existing.items = remaining;
  // 提案が節ごと書かず、中が全部消えたなら、空の節も残さない
  if (hadItems && remaining.length === 0 && given === undefined) holder.delete(key);
  return kept;
}

// --- 部品 ------------------------------------------------------------------

function mergeParts(current: Diagram, proposalRoot: YAMLMap | null, pins: Pins, conflicts: Conflict[]): void {
  const root = rootOf(current);
  if (root === null) return;
  const given = proposalRoot?.get('parts', true);
  const proposed = isMap(given) ? given : null;
  const existing = root.get('parts', true);
  if (!isMap(existing)) {
    if (existing === undefined && proposed !== null && proposed.items.length > 0) {
      insertSection(current.doc, root, 'parts', proposed.clone(), ['place', 'paths', 'dims', 'nodes', 'edges', 'pins']);
    }
    return;
  }

  const used = new Set(keysOf(readSeq(current, 'place'), 'part'));
  const hadItems = existing.items.length > 0;
  const seen = new Set<string>();
  const remaining: Pair[] = [];
  for (const pair of existing.items) {
    const name = keyText(pair.key);
    seen.add(name);
    const next = proposed?.get(name, true);
    if (!isMap(next)) {
      // 競合で残した置き方が使う部品は残す。置き方だけ残すと、何も描かれない。
      if (used.has(name)) remaining.push(pair);
      continue;
    }
    if (isMap(pair.value)) mergePart(current, name, pair.value, next, pins, conflicts);
    else pair.value = next.clone();
    remaining.push(pair);
  }
  for (const pair of proposed?.items ?? []) {
    if (seen.has(keyText(pair.key))) continue;
    remaining.push(pair.clone());
  }
  existing.items = remaining;
  if (hadItems && remaining.length === 0 && given === undefined) root.delete('parts');
}

/**
 * 部品の中を入れる。中の 1 つに人の手直し（`pins["L1.ch"]`）があれば、部品から消さない。
 * **手直しの鍵は、置いたもの（`L1`）ごとに付く** —— どれか 1 つでも直してあれば残す。
 */
function mergePart(current: Diagram, name: string, part: YAMLMap, next: YAMLMap, pins: Pins, conflicts: Conflict[]): void {
  const places = itemsOf(readSeq(current, 'place'))
    .filter((item) => String(item.get('part')) === name)
    .map((item) => String(item.get('as')));
  const pinned: Pinned = (id) => memberPin(pins, places, id);
  for (const section of PART_SECTIONS) mergeKeyed(current.doc, part, next, section, 'id', pinned, conflicts);
  updateFieldsAsWritten(part, next, PART_SECTION_SET);
}

/** 中の `id` を指す手直しの鍵（`<as>.<id>`、格子なら `<as>.<行>.<列>.<id>`）。 */
function memberPin(pins: Pins, places: readonly string[], id: string): string | undefined {
  for (const key of Object.keys(pins)) {
    if (key.includes('>')) continue;
    for (const as of places) {
      if (!key.startsWith(`${as}.`)) continue;
      if (innerOf(key.slice(as.length + 1)) === id) return key;
    }
  }
  return undefined;
}

/** 置いたものの名前を除いた残り（`ch` か `0.1.ch`）から、中の `id` を出す。 */
function innerOf(rest: string): string {
  return rest.replace(/^\d+\.\d+\./, '');
}

function removeMember(diagram: Diagram, as: string, id: string): void {
  const place = itemsOf(readSeq(diagram, 'place')).find((item) => String(item.get('as')) === as);
  const parts = rootOf(diagram)?.get('parts', true);
  if (place === undefined || !isMap(parts)) return;
  const part = parts.get(String(place.get('part')), true);
  if (!isMap(part)) return;
  const inner = innerOf(id.slice(as.length + 1));
  for (const section of PART_SECTIONS) {
    const seq = part.get(section, true);
    if (isSeq(seq)) removeItems(seq, (item) => String(item.get('id')) === inner);
  }
}

// --- 小道具 ----------------------------------------------------------------

/**
 * 値が変わったキーだけを、**提案の書き方のまま**書き換える。
 *
 * 素の値から作り直すと `[ 0, 50 ]` が縦に崩れ、書き戻しの検査（`round-trip-changed`）で落ちる。
 */
export function updateFieldsAsWritten(item: YAMLMap, proposed: YAMLMap, skip: ReadonlySet<string> = new Set()): void {
  const before = item.toJSON() as Record<string, unknown>;
  const next = proposed.toJSON() as Record<string, unknown>;
  for (const [key, value] of Object.entries(next)) {
    if (skip.has(key)) continue;
    if (JSON.stringify(before[key]) === JSON.stringify(value)) continue;
    item.set(key, cloneOf(proposed.get(key, true)));
  }
  for (const key of Object.keys(before)) {
    if (skip.has(key) || key in next) continue;
    item.delete(key);
  }
}

export function cloneOf(node: unknown): unknown {
  if (typeof node === 'object' && node !== null && 'clone' in node) {
    return (node as { clone(): unknown }).clone();
  }
  return node;
}

/** 足す節を、`before` に挙げた節のうち最初に見つかったものの前へ入れる。無ければ末尾。 */
export function insertSection(doc: Document, root: YAMLMap, key: string, value: unknown, before: readonly string[]): void {
  const pair = doc.createPair(key, value) as Pair;
  const at = root.items.findIndex((item) => before.includes(keyText(item.key)));
  if (at === -1) root.items.push(pair);
  else root.items.splice(at, 0, pair);
}

export function rootOf(diagram: Diagram): YAMLMap | null {
  const contents = diagram.doc.contents;
  return isMap(contents) ? contents : null;
}

function readSeq(diagram: Diagram, key: string): YAMLSeq | null {
  const node = diagram.doc.get(key, true);
  return isSeq(node) ? node : null;
}

function itemsOf(seq: YAMLSeq | null): YAMLMap[] {
  return (seq?.items ?? []).filter((item): item is YAMLMap => isMap(item));
}

function keysOf(seq: YAMLSeq | null, key: string): string[] {
  return itemsOf(seq)
    .map((item) => item.get(key))
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value));
}

export function keyText(key: unknown): string {
  return isScalar(key) ? String(key.value) : String(key);
}

function removeOne(diagram: Diagram, key: string, idKey: string, id: string): boolean {
  removeItems(readSeq(diagram, key), (item) => String(item.get(idKey)) === id);
  deletePin(diagram, id);
  return true;
}

function removeItems(seq: YAMLSeq | null, match: (item: YAMLMap) => boolean): void {
  if (seq === null) return;
  seq.items = seq.items.filter((item) => !(isMap(item) && match(item)));
}

function removeEdgesTouching(diagram: Diagram, touches: (end: string) => boolean): void {
  removeItems(readSeq(diagram, 'edges'), (item) => touches(String(item.get('from'))) || touches(String(item.get('to'))));
}
