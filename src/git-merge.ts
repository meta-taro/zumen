/**
 * Git の 3-way マージ。
 *
 * 保存形式の実測で、6 場面中 2 場面が **Git の行単位マージでは解けない**ことが分かった。
 * 2 人が別々のノードを動かす／別々のノードを足す、の 2 つ。
 * どちらも「同じ場所へ同時に挿入した」というだけで、**中身はぶつかっていない。**
 *
 * これは YAML の欠点ではない。Mermaid でも DOT でも draw.io XML でも同じで、
 * 行で管理する以上、同じ場所への同時挿入は必ずぶつかる。
 * **形式を変えても解けないので、マージドライバで解く。**
 *
 * ## 向き
 *
 * **出来上がりは ours の書式を保つ。** theirs の変更を構造で当てる。
 * `src/merge.ts`（AI の提案を人の正本へ入れる）と同じ向きで、
 * 書式・コメント・並び順を持っているほうを土台にする。
 *
 * ## 黙って通さない
 *
 * **本当にぶつかっているものは、ぶつかったまま返す。**
 * 衝突しなければ良いドライバ、ではない。黙って片方を採ると、
 * 人の直しが片方だけ消え、しかも**消えたことが誰にも見えない**。
 */
import { TO_STRING_OPTIONS } from './format.ts';
import { Document, YAMLSeq, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Pair, YAMLMap } from 'yaml';

/** 要素を照合する鍵の出し方。並びの節ごとに決まっている（仕様 §5・§6.2 と同じ鍵）。 */
const LISTS = {
  groups: (item: YAMLMap) => String(item.get('id')),
  nodes: (item: YAMLMap) => String(item.get('id')),
  edges: (item: YAMLMap) => `${String(item.get('from'))}>${String(item.get('to'))}`,
  paths: (item: YAMLMap) => String(item.get('id')),
  dims: (item: YAMLMap) => String(item.get('id')),
  place: (item: YAMLMap) => String(item.get('as')),
  views: (item: YAMLMap) => String(item.get('id')),
} as const;

/**
 * 鍵ごとに見る写像の節。`pins` は手直しの鍵、`parts` は部品の名前、
 * `let` / `lengths` は作図の定数、`palette` / `styles` は色と見せ方の名前。
 */
const MAPS = ['pins', 'parts', 'let', 'lengths', 'palette', 'styles'] as const;

type ListSection = keyof typeof LISTS;
type MapSection = (typeof MAPS)[number];

/**
 * 要素を数える単位。`root` は、それ以外の最上位の値（`version` / `title` / `scale` / `grid` / `steps` …）を
 * 鍵ごとに丸ごと見る。
 */
export type Section = 'root' | ListSection | MapSection;
type Keyed = Exclude<Section, 'root'>;

export interface ThreeWayConflict {
  section: Section;
  /** 要素の `id`、エッジの `from>to`、置き方の `as`、写像の鍵、最上位のキー。 */
  key: string;
  /** ours 側の姿。**消したのなら `undefined`。** */
  ours: string | undefined;
  /** theirs 側の姿。 */
  theirs: string | undefined;
}

export interface ThreeWayResult {
  text: string;
  conflicts: ThreeWayConflict[];
}

const SECTIONS: readonly Keyed[] = [...(Object.keys(LISTS) as ListSection[]), ...MAPS];
const SECTION_SET: ReadonlySet<string> = new Set(SECTIONS);

/** 要素 1 つ。`start` は、競合で囲み始める位置（並びの要素なら要素、写像なら鍵）。 */
interface Entry {
  node: unknown;
  start: number | undefined;
}

export function mergeThreeWay(baseText: string, oursText: string, theirsText: string): ThreeWayResult {
  const base = parseDocument(baseText);
  const ours = parseDocument(oursText);
  const theirs = parseDocument(theirsText);

  const conflicts: ThreeWayConflict[] = [];

  mergeRoot(base, ours, theirs, conflicts);
  for (const section of SECTIONS) mergeSection(section, base, ours, theirs, conflicts);

  const merged = ours.toString(TO_STRING_OPTIONS);
  return { text: conflicts.length === 0 ? merged : markConflicts(merged, conflicts), conflicts };
}

// --- 最上位 ----------------------------------------------------------------

/**
 * 節でない最上位の値は、鍵ごとに丸ごと見る。
 *
 * **鍵の一覧で絞らない。** 絞ると、節を足すたびに theirs の変更が黙って消える穴が開く
 * （`scale` / `paths` / `dims` がまさにそれだった）。
 */
function mergeRoot(base: Document, ours: Document, theirs: Document, conflicts: ThreeWayConflict[]): void {
  const keys = union(rootEntries(base), rootEntries(ours), rootEntries(theirs)).filter((key) => !SECTION_SET.has(key));
  for (const key of keys) {
    const b = json(base.get(key, true));
    const o = json(ours.get(key, true));
    const t = json(theirs.get(key, true));
    if (o === t) continue;
    if (b === o) {
      const next = theirs.get(key, true);
      if (!theirs.has(key)) ours.delete(key);
      else if (ours.has(key)) ours.set(key, next);
      else insertLike(ours, theirs, key, next);
      continue;
    }
    if (b === t) continue;
    conflicts.push({ section: 'root', key, ours: renderPair(ours, key), theirs: renderPair(theirs, key) });
  }
}

function rootEntries(doc: Document): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (!isMap(doc.contents)) return out;
  for (const pair of doc.contents.items as Pair[]) out.set(keyText(pair.key), pair.value);
  return out;
}

/**
 * ours に無い最上位の鍵を、theirs で直後にある鍵の前へ入れる。
 * 末尾へ足すと、`pins` の後ろに設定が生える。
 */
function insertLike(ours: Document, theirs: Document, key: string, value: unknown): void {
  const root = ours.contents;
  if (!isMap(root)) {
    ours.set(key, value);
    return;
  }
  const order = [...rootEntries(theirs).keys()];
  const later = new Set(order.slice(order.indexOf(key) + 1));
  const pair = ours.createPair(key, value) as Pair;
  const at = (root.items as Pair[]).findIndex((item) => later.has(keyText(item.key)));
  if (at === -1) root.items.push(pair);
  else root.items.splice(at, 0, pair);
}

function renderPair(doc: Document, key: string): string | undefined {
  if (!doc.has(key)) return undefined;
  const holder = new Document({});
  (holder.contents as YAMLMap).set(key, doc.get(key, true));
  return holder.toString(TO_STRING_OPTIONS).trimEnd();
}

// --- 節ごと ----------------------------------------------------------------

function mergeSection(
  section: Keyed,
  base: Document,
  ours: Document,
  theirs: Document,
  conflicts: ThreeWayConflict[],
): void {
  const b = elements(base, section);
  const o = elements(ours, section);
  const t = elements(theirs, section);

  for (const key of union(b, o, t)) {
    const bj = json(b.get(key)?.node);
    const oj = json(o.get(key)?.node);
    const tj = json(t.get(key)?.node);

    if (oj === tj) continue;
    if (bj === oj) {
      adopt(section, key, ours, theirs, o.get(key)?.node, t.get(key)?.node);
      continue;
    }
    if (bj === tj) continue;

    // **ここだけは自動で決めない。** 両方が別々に変えていて、どちらが正しいか機械には分からない。
    conflicts.push({
      section,
      key,
      ours: render(section, o.get(key)?.node, key),
      theirs: render(section, t.get(key)?.node, key),
    });
  }
}

/** ours 側が base のままなら、theirs の変更をそのまま採る。 */
function adopt(
  section: Keyed,
  key: string,
  ours: Document,
  theirs: Document,
  oursElement: unknown,
  theirsElement: unknown,
): void {
  if (theirsElement === undefined) {
    removeElement(ours, section, key);
    return;
  }
  if (oursElement === undefined) {
    addElement(ours, theirs, section, key, theirsElement);
    return;
  }
  if (!isMap(oursElement) || !isMap(theirsElement)) {
    // 写像の値が数や文字（作図の定数・色）なら、丸ごと差し替える
    const node = ours.get(section, true);
    if (isMap(node)) node.set(key, theirsElement);
    return;
  }
  // 値が変わったキーだけを差し替える。**同じ値を書き直すと、そのキーのコメントが入れ替わる。**
  const next = theirsElement.toJSON() as Record<string, unknown>;
  const before = oursElement.toJSON() as Record<string, unknown>;
  for (const [field, value] of Object.entries(next)) {
    if (json(before[field]) === json(value)) continue;
    // **theirs の節をそのまま置く。** JSON へ落として作り直すと、
    // `{ x: 1, y: 2 }` のような書き方が展開され、人が書いていない行の形が変わる。
    oursElement.set(field, theirsElement.get(field, true));
  }
  for (const field of Object.keys(before)) {
    if (field in next) continue;
    oursElement.delete(field);
  }
}

// --- 要素の出し入れ --------------------------------------------------------

function isList(section: Keyed): section is ListSection {
  return section in LISTS;
}

/** 節の要素を鍵で引けるようにする。鍵は写像なら写像の鍵、並びなら id・`as`・エッジの組。 */
function elements(doc: Document, section: Keyed): Map<string, Entry> {
  const out = new Map<string, Entry>();
  const node = doc.get(section, true);

  if (!isList(section)) {
    if (!isMap(node)) return out;
    for (const item of node.items as Pair[]) {
      const at = (item.key as { range?: [number, number, number] } | null)?.range;
      out.set(keyText(item.key), { node: item.value, start: node.flow === true ? undefined : at?.[0] });
    }
    return out;
  }

  if (!isSeq(node)) return out;
  for (const item of node.items) {
    if (!isMap(item)) continue;
    out.set(LISTS[section](item), { node: item, start: node.flow === true ? undefined : item.range?.[0] });
  }
  return out;
}

function removeElement(doc: Document, section: Keyed, key: string): void {
  const node = doc.get(section, true);
  if (!isList(section)) {
    if (isMap(node)) node.delete(key);
    return;
  }
  if (!isSeq(node)) return;
  node.items = node.items.filter((item) => !(isMap(item) && LISTS[section](item) === key));
}

/**
 * theirs だけが足した要素を入れる。
 *
 * **末尾へ足す。** ours の並び順は人が読む順序なので、途中へ差し込まない
 * （仕様 §3.1）。節そのものが無ければ、theirs で直後にある節の前へ作る。
 */
function addElement(doc: Document, theirs: Document, section: Keyed, key: string, element: unknown): void {
  // **theirs の節をそのまま入れる。** 書き方（flow style・コメント）を保つため、
  // JSON へ落として作り直さない。
  const node = doc.get(section, true);

  if (!isList(section)) {
    if (isMap(node)) node.set(key, element);
    else insertLike(doc, theirs, section, doc.createNode({ [key]: plain(element) }));
    return;
  }
  if (isMap(element)) element.spaceBefore = true;
  if (isSeq(node)) node.items.push(element);
  else insertLike(doc, theirs, section, doc.createNode([plain(element)]));
}

// --- 競合の見せ方 ----------------------------------------------------------

/** 要素 1 つを YAML の断片として起こす。コメントは持っているぶんだけ付いてくる。 */
function render(section: Keyed, element: unknown, key: string): string | undefined {
  if (element === undefined) return undefined;
  if (!isList(section)) {
    const holder = new Document({});
    (holder.contents as YAMLMap).set(key, element);
    return holder.toString(TO_STRING_OPTIONS).trimEnd();
  }
  const holder = new Document(new YAMLSeq());
  (holder.contents as YAMLSeq).items.push(element);
  return holder.toString(TO_STRING_OPTIONS).trimEnd();
}

/**
 * 競合した要素を `<<<<<<<` で囲む。
 *
 * **Git と同じ形にする。** 独自の印を使うと、人が使い慣れた道具
 * （エディタの競合表示・`git checkout --ours`）が効かなくなる。
 *
 * 囲むのは**ぶつかった要素だけ**で、その前後の行は巻き込まない。
 * 行単位のマージが「隣の行まで巻き込む」ことが、そもそもの動機だった。
 */
function markConflicts(merged: string, conflicts: ThreeWayConflict[]): string {
  const doc = parseDocument(merged);
  type Span = { start: number; end: number; conflict: ThreeWayConflict };
  const spans: Span[] = [];
  const trailing: ThreeWayConflict[] = [];

  for (const conflict of conflicts) {
    const span = locate(doc, merged, conflict);
    if (span === undefined) trailing.push(conflict);
    else spans.push({ ...span, conflict });
  }

  // 後ろから差し込む。前から入れると、後ろの位置がずれる。
  let out = merged;
  for (const span of spans.sort((a, b) => b.start - a.start)) {
    const body = out.slice(span.start, span.end);
    // theirs 側は断片として起こしたものなので、ours と同じ深さへ寄せる。
    const theirs = indent(span.conflict.theirs, indentOf(out, span.start));
    out = `${out.slice(0, span.start)}${block(body.trimEnd(), theirs)}\n${out.slice(span.end)}`;
  }
  for (const conflict of trailing) {
    out = `${out.trimEnd()}\n${block(conflict.ours ?? '', conflict.theirs)}\n`;
  }
  return out;
}

/** その位置の行頭にある空白の数。 */
function indentOf(text: string, start: number): number {
  const line = text.slice(start, text.indexOf('\n', start) === -1 ? undefined : text.indexOf('\n', start));
  return line.length - line.trimStart().length;
}

function indent(fragment: string | undefined, width: number): string | undefined {
  if (fragment === undefined || width === 0) return fragment;
  const pad = ' '.repeat(width);
  return fragment
    .split('\n')
    .map((line) => (line === '' ? line : `${pad}${line}`))
    .join('\n');
}

function block(ours: string, theirs: string | undefined): string {
  return ['<<<<<<< ours', ours, '=======', theirs ?? '', '>>>>>>> theirs'].filter((line) => line !== '').join('\n');
}

/**
 * マージ後のテキストの中で、その要素が占めている行の範囲を探す。
 *
 * 写像の要素は、鍵の行から囲む。中身の行から囲むと、**鍵が競合の外に取り残され、
 * 解いたあとに壊れた YAML が残る。** 1 行（flow）の中の要素は囲めないので、末尾へ回す。
 */
function locate(
  doc: Document,
  text: string,
  conflict: ThreeWayConflict,
): { start: number; end: number } | undefined {
  if (conflict.ours === undefined) return undefined;
  const entry = conflict.section === 'root' ? rootEntry(doc, conflict.key) : elements(doc, conflict.section).get(conflict.key);
  const end = (entry?.node as { range?: [number, number, number] } | null | undefined)?.range?.[1];
  if (entry?.start === undefined || end === undefined) return undefined;
  return { start: text.lastIndexOf('\n', entry.start) + 1, end: lineEnd(text, end) };
}

/**
 * 値が行の途中で終わるなら（`R: 110 # 註`）、その行の終わりまで囲む。
 * 値の終わりで切ると、行の残り（註）が印の外の 1 行に取り残される。
 */
function lineEnd(text: string, end: number): number {
  if (end === 0 || text[end - 1] === '\n') return end;
  const next = text.indexOf('\n', end);
  return next === -1 ? text.length : next + 1;
}

function rootEntry(doc: Document, key: string): Entry | undefined {
  if (!isMap(doc.contents)) return undefined;
  const pair = (doc.contents.items as Pair[]).find((item) => keyText(item.key) === key);
  if (pair === undefined) return undefined;
  return { node: pair.value, start: (pair.key as { range?: [number, number, number] } | null)?.range?.[0] };
}

// --- 小道具 ----------------------------------------------------------------

/** 比べる用。YAML の節は素の値へ落とす。 */
function json(value: unknown): string {
  return JSON.stringify(plain(value) ?? null);
}

function plain(node: unknown): unknown {
  if (typeof node === 'object' && node !== null && 'toJSON' in node) {
    return (node as { toJSON(): unknown }).toJSON();
  }
  return node;
}

function keyText(key: unknown): string {
  return isScalar(key) ? String(key.value) : String(key);
}

function union(...maps: Map<string, unknown>[]): string[] {
  const keys: string[] = [];
  for (const map of maps) for (const key of map.keys()) if (!keys.includes(key)) keys.push(key);
  return keys;
}
