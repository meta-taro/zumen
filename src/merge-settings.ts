/**
 * 図の設定（`title` / `palette` / `grid` / `views` …）と作図の節（`let` / `steps` …）を、提案から人の正本へ入れる。
 *
 * **直す前は、merge がこれを 1 つも見ていなかった。** 提案が題を変えても・色の鍵を足しても・
 * 作図の定数を変えても、正本は 1 文字も変わらず、競合も出なかった。頼んだ変更が黙って捨てられていた。
 *
 * 規則（仕様 §6.2）——
 *
 * 1. **提案が書かなければ触らない。** 設定は要素ではなく、書いていないのは「消して」ではなく
 *    「触っていない」と読む（`scale` と同じ）。消すときは `null` と書く
 * 2. 値が変わったところだけ入れる。写像は鍵ごと、`id`（`as`）を持つ並びは要素ごと、
 *    **それ以外は提案の書き方のまま丸ごと**
 * 3. `pins` / `review` / `markup` は**提案から読まない**（人だけが書く）
 * 4. 人が `pins.<名前>.value` で決めた作図の定数は書き換えない。**食い違いは競合で返す**
 * 5. 図の種類（`kind`）は入れない。種類が違う提案は前提が違うので、**競合で返して人に選ばせる**
 */
import { isMap, isScalar, isSeq } from 'yaml';
import type { Pair, YAMLMap, YAMLSeq } from 'yaml';

import { getPins } from './format.ts';
import type { Diagram, Pins } from './format.ts';
import type { Conflict } from './merge.ts';
import { cloneOf, insertSection, keyText, rootOf } from './merge-placement.ts';

/** 別の所で入れる節（`src/merge.ts` / `src/merge-placement.ts`）。`version` は人の正本のもの。 */
const ELSEWHERE: ReadonlySet<string> = new Set([
  'version',
  'kind',
  'groups',
  'nodes',
  'edges',
  'paths',
  'dims',
  'parts',
  'place',
  'scale',
]);

/** 提案から読まない。**人だけが書く**（`pins` は手直し、`review` は人が見た印、`markup` は赤入れ）。 */
const HUMAN_ONLY: ReadonlySet<string> = new Set(['pins', 'review', 'markup']);

/** 人が `pins.<名前>.value` で決められる作図の定数（§3.6）。 */
const CONSTANTS: ReadonlySet<string> = new Set(['let', 'lengths']);

/** 最上位の並び（仕様 §3 の表の順）。足す節は、これより後ろにある最初の節の前へ入れる。 */
const ORDER = [
  'version', 'title', 'sources', 'watermark', 'kind', 'direction', 'wrap', 'arrows', 'grid', 'scale', 'north', 'wall',
  'palette', 'styles', 'floors', 'projection', 'groups', 'nodes', 'edges', 'paths', 'dims', 'parts', 'place',
  'views', 'let', 'lengths', 'steps', 'points', 'circles', 'lines', 'arcs', 'segments', 'define',
  'pins', 'review', 'markup',
];

/** 並びの要素を照合する鍵の候補。 */
const ITEM_KEYS = ['id', 'as'] as const;

/**
 * 提案の最上位にある設定を、人の正本へ入れる。
 *
 * **知らない鍵も入れる。** 鍵の一覧で絞ると、節を足すたびに merge が黙って捨てる穴が開く
 * （`paths` / `dims` がまさにそれだった）。
 */
export function mergeSettings(current: Diagram, proposal: Diagram, pins: Pins, conflicts: Conflict[]): void {
  const root = rootOf(current);
  const given = rootOf(proposal);
  if (root === null || given === null) return;
  mergeKind(root, given, conflicts);

  for (const pair of given.items) {
    const key = keyText(pair.key);
    if (ELSEWHERE.has(key) || HUMAN_ONLY.has(key)) continue;
    const next = pair.value;
    const own = pairOf(root, key);
    if (isNull(next)) {
      if (own !== undefined) root.delete(own.key);
      continue;
    }
    if (own === undefined) {
      // 正本に無い設定は、中身があるときだけ足す。誰も書いていない `wall: {}` を生やさない。
      if (!isEmpty(next)) insertSection(current.doc, root, key, cloneOf(next), after(key));
      continue;
    }
    if (CONSTANTS.has(key) && isMap(own.value) && isMap(next)) {
      mergeConstants(own.value, next, pins, conflicts);
      continue;
    }
    mergeInto(own, next);
  }
}

/** 競合で「提案を採る」と決めた図の種類を入れる。 */
export function takeKind(diagram: Diagram, ai: string): void {
  const root = rootOf(diagram);
  if (root === null) return;
  const own = pairOf(root, 'kind');
  if (own !== undefined && isScalar(own.value)) own.value.value = ai;
  else insertSection(diagram.doc, root, 'kind', ai, after('kind'));
}

/**
 * 競合で「提案を採る」と決めた作図の定数を入れる。**人の pin は外す** ——
 * 残すと pin が勝ち、採ったはずの値が絵に出ない。
 */
export function takeConstant(diagram: Diagram, name: string, ai: number | string): void {
  const root = rootOf(diagram);
  if (root === null) return;
  for (const section of CONSTANTS) {
    const holder = pairOf(root, section)?.value;
    if (!isMap(holder)) continue;
    const own = pairOf(holder, name);
    if (own === undefined) continue;
    if (isScalar(own.value)) own.value.value = ai;
    else own.value = diagram.doc.createNode(ai);
  }
  const pinsNode = diagram.doc.get('pins', true);
  if (isMap(pinsNode)) pinsNode.delete(name);
}

/** 人の正本に効いている作図の定数の pin（数のときだけ）。 */
export function constantPin(diagram: Diagram, name: string): number | undefined {
  const value = getPins(diagram)[name]?.value;
  return typeof value === 'number' ? value : undefined;
}

// --- 図の種類 --------------------------------------------------------------

function mergeKind(root: YAMLMap, given: YAMLMap, conflicts: Conflict[]): void {
  const next = pairOf(given, 'kind')?.value;
  if (next === undefined || isNull(next)) return;
  const ai = String(plain(next));
  const own = pairOf(root, 'kind')?.value;
  // 書いていない kind は `structure`（§2.3）。書き方が違うだけなら食い違いにしない。
  const human = own === undefined || isNull(own) ? 'structure' : String(plain(own));
  if (ai !== human) conflicts.push({ kind: 'kind-proposed', elementId: 'kind', human, ai });
}

// --- 作図の定数 ------------------------------------------------------------

/**
 * `let` / `lengths` を鍵ごとに入れる。**人が pin した定数は、人のもの。**
 *
 * pin は正本の値より勝つ（§3.6）ので、黙って書き換えても絵は変わらない ——
 * それは「頼んだ変更が黙って捨てられる」と同じ事故になる。だから入れずに聞く。
 */
function mergeConstants(existing: YAMLMap, next: YAMLMap, pins: Pins, conflicts: Conflict[]): void {
  const proposed = new Set(next.items.map((pair) => keyText(pair.key)));
  existing.items = existing.items.filter((pair) => {
    const name = keyText(pair.key);
    if (proposed.has(name)) return true;
    if (pins[name] === undefined) return false;
    conflicts.push({ kind: 'pin-orphaned', elementId: name, reason: 'removed' });
    return true;
  });

  for (const pair of next.items) {
    const name = keyText(pair.key);
    const own = pairOf(existing, name);
    if (own === undefined) {
      existing.items.push(pair.clone() as Pair);
      continue;
    }
    const human = pins[name]?.value;
    const ai = plain(pair.value);
    if (typeof human === 'number' && !same(own.value, pair.value) && ai !== human) {
      const shown = typeof ai === 'number' ? ai : String(ai);
      conflicts.push(
        pins[name]?.locked === true
          ? { kind: 'value-suppressed', elementId: name, ai: shown }
          : { kind: 'value-proposed', elementId: name, human, ai: shown },
      );
      continue;
    }
    mergeInto(own, pair.value);
  }
}

// --- 値を入れる ------------------------------------------------------------

/** 値が変わったところだけ入れる。**同じ値を書き直すと、その行の註と書き方が入れ替わる。** */
function mergeInto(own: Pair, next: unknown): void {
  const existing = own.value;
  if (same(existing, next)) return;
  if (isMap(existing) && isMap(next)) {
    mergeMap(existing, next);
    return;
  }
  if (isSeq(existing) && isSeq(next) && mergeSeq(existing, next)) return;
  if (isScalar(existing) && isScalar(next)) {
    // 値だけ替える。行の終わりの註（`title: … # 仮`）は残る
    existing.value = next.value;
    return;
  }
  own.value = cloneOf(next);
}

function mergeMap(existing: YAMLMap, next: YAMLMap): void {
  const proposed = new Set(next.items.map((pair) => keyText(pair.key)));
  existing.items = existing.items.filter((pair) => proposed.has(keyText(pair.key)));
  for (const pair of next.items) {
    const own = pairOf(existing, keyText(pair.key));
    if (own === undefined) existing.items.push(pair.clone() as Pair);
    else mergeInto(own, pair.value);
  }
}

/**
 * `id`（または `as`）で照合できる並びを、要素ごとに入れる。入れられたら true。
 *
 * **並び順が変わったら、要素ごとには入れない**（false を返し、丸ごと入れる）。
 * 作図の手順（`steps`）や階（`floors`）は書いた順に意味があり、
 * 途中へ足した要素を末尾へ回すと、評価の順が壊れる。
 */
function mergeSeq(existing: YAMLSeq, next: YAMLSeq): boolean {
  const idKey = ITEM_KEYS.find((key) => keyed(existing, key) && keyed(next, key));
  if (idKey === undefined) return false;
  const idOf = (item: unknown): string => String((item as YAMLMap).get(idKey));
  const nextIds = next.items.map(idOf);
  const proposed = new Set(nextIds);
  const kept = existing.items.map(idOf).filter((id) => proposed.has(id));
  const keptSet = new Set(kept);
  const expected = [...kept, ...nextIds.filter((id) => !keptSet.has(id))];
  if (expected.join('\n') !== nextIds.join('\n')) return false;

  existing.items = existing.items.filter((item) => proposed.has(idOf(item)));
  for (const item of next.items) {
    const own = existing.items.find((mine) => idOf(mine) === idOf(item));
    if (own === undefined) existing.items.push(cloneOf(item));
    else mergeMap(own as YAMLMap, item as YAMLMap);
  }
  return true;
}

/** 要素が全部写像で、`key` を持ち、重ならないか。 */
function keyed(seq: YAMLSeq, key: string): boolean {
  if (seq.items.length === 0) return false;
  const seen = new Set<string>();
  for (const item of seq.items) {
    if (!isMap(item)) return false;
    const id = item.get(key);
    if (id === undefined || id === null || typeof id === 'object') return false;
    if (seen.has(String(id))) return false;
    seen.add(String(id));
  }
  return true;
}

// --- 小道具 ----------------------------------------------------------------

/** 鍵を文字で引く。`map.get('1')` は数の鍵 `1` に当たらないので、鍵の書き方によらず引けるようにする。 */
function pairOf(map: YAMLMap, key: string): Pair | undefined {
  return (map.items as Pair[]).find((pair) => keyText(pair.key) === key);
}

/** 足す節を入れる場所。§3 の表で自分より後ろの節の前。表に無い鍵は人の節（`pins` ほか）の前。 */
function after(key: string): string[] {
  const at = ORDER.indexOf(key);
  return at === -1 ? [...HUMAN_ONLY] : ORDER.slice(at + 1);
}

function plain(node: unknown): unknown {
  if (typeof node === 'object' && node !== null && 'toJSON' in node) {
    return (node as { toJSON(): unknown }).toJSON();
  }
  return node;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(plain(a) ?? null) === JSON.stringify(plain(b) ?? null);
}

function isNull(node: unknown): boolean {
  return node === null || (isScalar(node) && node.value === null);
}

function isEmpty(node: unknown): boolean {
  return (isMap(node) || isSeq(node)) && node.items.length === 0;
}
