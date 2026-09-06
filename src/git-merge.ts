/**
 * Git の 3-way マージ（Issue 011）。
 *
 * D2 の実測で、6 場面中 2 場面が **Git の行単位マージでは解けない**ことが分かった。
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
import { Document, YAMLSeq, isMap, isSeq, parseDocument } from 'yaml';
import type { Pair, YAMLMap } from 'yaml';

/** 要素を数える単位。`root` は `version` / `title` のような最上位の値。 */
export type Section = 'root' | 'groups' | 'nodes' | 'edges' | 'pins';

export interface ThreeWayConflict {
  section: Section;
  /** ノードの `id`、エッジの `from>to`、`pins` の鍵、最上位のキー。 */
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

const SECTIONS: readonly Exclude<Section, 'root'>[] = ['groups', 'nodes', 'edges', 'pins'];
/** 最上位で 3-way に見る値。並びと写像はそれぞれの節で扱う。 */
const ROOT_KEYS = ['version', 'title'] as const;

export function mergeThreeWay(baseText: string, oursText: string, theirsText: string): ThreeWayResult {
  const base = parseDocument(baseText);
  const ours = parseDocument(oursText);
  const theirs = parseDocument(theirsText);

  const conflicts: ThreeWayConflict[] = [];

  mergeRoot(base, ours, theirs, conflicts);
  for (const section of SECTIONS) mergeSection(section, base, ours, theirs, conflicts);

  const merged = ours.toString({ lineWidth: 0 });
  return { text: conflicts.length === 0 ? merged : markConflicts(merged, conflicts), conflicts };
}

// --- 最上位 ----------------------------------------------------------------

function mergeRoot(base: Document, ours: Document, theirs: Document, conflicts: ThreeWayConflict[]): void {
  for (const key of ROOT_KEYS) {
    const b = json(base.get(key));
    const o = json(ours.get(key));
    const t = json(theirs.get(key));
    if (o === t) continue;
    if (b === o) {
      if (theirs.get(key) === undefined) ours.delete(key);
      else ours.set(key, theirs.get(key, true));
      continue;
    }
    if (b === t) continue;
    conflicts.push({ section: 'root', key, ours: scalarText(key, ours), theirs: scalarText(key, theirs) });
  }
}

function scalarText(key: string, doc: Document): string | undefined {
  const value = doc.get(key);
  return value === undefined ? undefined : `${key}: ${String(value)}`;
}

// --- 節ごと ----------------------------------------------------------------

function mergeSection(
  section: Exclude<Section, 'root'>,
  base: Document,
  ours: Document,
  theirs: Document,
  conflicts: ThreeWayConflict[],
): void {
  const b = elements(base, section);
  const o = elements(ours, section);
  const t = elements(theirs, section);

  for (const key of union(b, o, t)) {
    const bj = json(b.get(key)?.toJSON());
    const oj = json(o.get(key)?.toJSON());
    const tj = json(t.get(key)?.toJSON());

    if (oj === tj) continue;
    if (bj === oj) {
      adopt(section, key, ours, o.get(key), t.get(key));
      continue;
    }
    if (bj === tj) continue;

    // **ここだけは自動で決めない。** 両方が別々に変えていて、どちらが正しいか機械には分からない。
    conflicts.push({
      section,
      key,
      ours: render(section, o.get(key), key),
      theirs: render(section, t.get(key), key),
    });
  }
}

/** ours 側が base のままなら、theirs の変更をそのまま採る。 */
function adopt(
  section: Exclude<Section, 'root'>,
  key: string,
  ours: Document,
  oursElement: YAMLMap | undefined,
  theirsElement: YAMLMap | undefined,
): void {
  if (theirsElement === undefined) {
    removeElement(ours, section, key);
    return;
  }
  if (oursElement === undefined) {
    addElement(ours, section, key, theirsElement);
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

/** 節の要素を鍵で引けるようにする。鍵は `pins` なら写像の鍵、他は id かエッジの組。 */
function elements(doc: Document, section: Exclude<Section, 'root'>): Map<string, YAMLMap> {
  const out = new Map<string, YAMLMap>();
  const node = doc.get(section, true);

  if (section === 'pins') {
    if (!isMap(node)) return out;
    for (const item of node.items as Pair[]) {
      if (isMap(item.value)) out.set(String(item.key), item.value);
    }
    return out;
  }

  if (!isSeq(node)) return out;
  for (const item of node.items) {
    if (!isMap(item)) continue;
    out.set(keyOf(section, item), item);
  }
  return out;
}

function keyOf(section: Exclude<Section, 'root'>, item: YAMLMap): string {
  if (section === 'edges') return `${String(item.get('from'))}>${String(item.get('to'))}`;
  return String(item.get('id'));
}

function removeElement(doc: Document, section: Exclude<Section, 'root'>, key: string): void {
  const node = doc.get(section, true);
  if (section === 'pins') {
    if (isMap(node)) node.delete(key);
    return;
  }
  if (!isSeq(node)) return;
  node.items = node.items.filter((item) => !(isMap(item) && keyOf(section, item) === key));
}

/**
 * theirs だけが足した要素を入れる。
 *
 * **末尾へ足す。** ours の並び順は人が読む順序なので、途中へ差し込まない
 * （仕様 §3.1）。節そのものが無ければ作る。
 */
function addElement(
  doc: Document,
  section: Exclude<Section, 'root'>,
  key: string,
  element: YAMLMap,
): void {
  // **theirs の節をそのまま入れる。** 書き方（flow style・コメント）を保つため、
  // JSON へ落として作り直さない。
  const node = doc.get(section, true);

  if (section === 'pins') {
    if (isMap(node)) node.set(key, element);
    else doc.set(section, doc.createNode({ [key]: element.toJSON() }));
    return;
  }
  element.spaceBefore = true;
  if (isSeq(node)) node.items.push(element);
  else doc.set(section, doc.createNode([element.toJSON()]));
}

// --- 競合の見せ方 ----------------------------------------------------------

/** 要素 1 つを YAML の断片として起こす。コメントは持っているぶんだけ付いてくる。 */
function render(section: Exclude<Section, 'root'>, element: YAMLMap | undefined, key: string): string | undefined {
  if (element === undefined) return undefined;
  if (section === 'pins') {
    const holder = new Document({});
    (holder.contents as YAMLMap).set(key, element);
    return holder.toString({ lineWidth: 0 }).trimEnd();
  }
  const holder = new Document(new YAMLSeq());
  (holder.contents as YAMLSeq).items.push(element);
  return holder.toString({ lineWidth: 0 }).trimEnd();
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

/**
 * `start` より前で、`<鍵>:` だけが書かれている行の行頭を返す。
 *
 * `pins` の要素は、鍵の行と中身の行に分かれている。中身の行から囲むと
 * **鍵が競合の外に取り残され、解いたあとに壊れた YAML が残る。**
 */
function lineStartOfKey(text: string, start: number, key: string): number | undefined {
  let cursor = start;
  while (cursor > 0) {
    const previous = text.lastIndexOf('\n', cursor - 2);
    const lineStart = previous + 1;
    const line = text.slice(lineStart, cursor - 1);
    if (line.trim() === `${key}:`) return lineStart;
    if (lineStart === 0) return undefined;
    cursor = lineStart;
  }
  return undefined;
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

/** マージ後のテキストの中で、その要素が占めている行の範囲を探す。 */
function locate(
  doc: Document,
  text: string,
  conflict: ThreeWayConflict,
): { start: number; end: number } | undefined {
  if (conflict.ours === undefined || conflict.section === 'root') return undefined;
  const element = elements(doc, conflict.section).get(conflict.key);
  const range = element?.range;
  if (range === undefined || range === null) return undefined;
  // 並びの要素は `- ` が、`pins` の要素は鍵の行が範囲の外に出る。行頭まで戻して揃える。
  const start = text.lastIndexOf('\n', range[0]) + 1;
  if (conflict.section !== 'pins') return { start, end: range[1] };
  // `pins` は鍵の行から囲まないと、`db:` だけが競合の外に取り残される。
  return { start: lineStartOfKey(text, start, conflict.key) ?? start, end: range[1] };
}

// --- 小道具 ----------------------------------------------------------------

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function union(...maps: Map<string, unknown>[]): string[] {
  const keys: string[] = [];
  for (const map of maps) for (const key of map.keys()) if (!keys.includes(key)) keys.push(key);
  return keys;
}
