/**
 * 形式の検証器（Issue 014 / 仕様 §8）。
 *
 * **弾くための道具ではない。** v1 の規則は「知らないキーは捨てずに保つ」（§9）なので、
 * 知らないものを見つけても失敗にしない。ここが確かめるのは 2 つだけ。
 *
 * 1. **その文書が読めるか**（`version` / `nodes` / `id` の一意性 / 参照先の実在）
 * 2. **人の手直しが行き先を失っていないか**（迷子の `pins`。§3.4 の規則 3）
 *
 * **迷子を `error` にしない。** 迷子は「文書が壊れている」のではなく
 * 「人の指定の紐づけが切れた」状態で、解くのは人であって検証器ではない（§6.2）。
 * ここで失敗にすると、id が改名された図が CI で落ちるだけになり、
 * **人が競合として解く経路を潰してしまう。**
 */
import { LineCounter, isMap, isSeq, parseDocument } from 'yaml';
import type { Document, Node, YAMLMap } from 'yaml';

import { messages } from './messages.ts';

/**
 * `error` は読めない文書。`warning` は読めるが、人が見たほうがよいもの。
 *
 * **警告で失敗にしない**（`hasError` を見る）。
 */
export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  /** 機械が拾うための印。**文言が変わっても、これは変わらない。** */
  code: string;
  /** 人へ出す文。文言表から来る。 */
  message: string;
  /** 1 起点の行番号。位置が取れないこともある。 */
  line?: number;
}

/** v1 が定める体裁の語（仕様 §4）。これ以外は捨てずに保ち、警告だけ出す。 */
const KNOWN_APPEARANCE = new Set(['primary', 'muted']);

/** `pins` の中で、位置や体裁ではなく人の決定を表す鍵。迷子の判定には関係しない。 */
const EDGE_KEY = /^(.+)>(.+)$/;

export function validate(text: string): Finding[] {
  const lines = new LineCounter();
  const doc = parseDocument(text, { lineCounter: lines });
  const at = (node: unknown): number | undefined => {
    const range = (node as Node | undefined)?.range;
    if (range === undefined || range === null) return undefined;
    return lines.linePos(range[0]).line;
  };

  const found: Finding[] = [];
  const add = (severity: Severity, code: string, message: string, line?: number): void => {
    found.push(line === undefined ? { severity, code, message } : { severity, code, message, line });
  };
  const m = messages().validate;

  // 構文誤りは、それ以上読んでも意味が無い。ここで返す。
  for (const error of doc.errors) {
    add('error', 'syntax', error.message, error.linePos?.[0]?.line);
  }
  if (found.length > 0) return found;

  if (!isMap(doc.contents)) {
    add('error', 'not-mapping', m.notMapping, 1);
    return found;
  }

  checkVersion(doc, add, m, at);
  const nodeIds = checkNodes(doc, add, m, at);
  if (nodeIds === undefined) return found;

  const groupIds = collectIds(seqOf(doc, 'groups'));
  checkGroups(doc, nodeIds, groupIds, add, m, at);
  const edgeKeys = checkEdges(doc, nodeIds, add, m, at);
  checkPins(doc, nodeIds, edgeKeys, add, m, at);
  checkRoundTrip(doc, text, add, m);

  return found;
}

/** `error` を 1 つでも含むか。**警告だけなら通す。** */
export function hasError(findings: Finding[]): boolean {
  return findings.some((finding) => finding.severity === 'error');
}

type Add = (severity: Severity, code: string, message: string, line?: number) => void;
type Messages = ReturnType<typeof messages>['validate'];
type At = (node: unknown) => number | undefined;

function seqOf(doc: Document, key: string): YAMLMap[] {
  const node = doc.get(key, true);
  if (!isSeq(node)) return [];
  return node.items.filter((item): item is YAMLMap => isMap(item));
}

function collectIds(items: YAMLMap[]): Set<string> {
  const ids = new Set<string>();
  for (const item of items) {
    const id = item.get('id');
    if (id !== undefined && id !== null) ids.add(String(id));
  }
  return ids;
}

function checkVersion(doc: Document, add: Add, m: Messages, at: At): void {
  const version = doc.get('version');
  if (version === undefined || version === null) {
    add('error', 'version-missing', m.versionMissing, 1);
    return;
  }
  if (version !== 1) {
    add('error', 'version-unsupported', m.versionUnsupported(String(version)), at(doc.get('version', true)));
  }
}

/** ノードを見て id の集合を返す。`nodes` そのものが無ければ `undefined`（以降は見ない）。 */
function checkNodes(doc: Document, add: Add, m: Messages, at: At): Set<string> | undefined {
  const node = doc.get('nodes', true);
  if (node === undefined || node === null) {
    add('error', 'nodes-missing', m.nodesMissing, 1);
    return undefined;
  }
  if (!isSeq(node)) {
    add('error', 'nodes-not-sequence', m.nodesNotSequence, at(node));
    return undefined;
  }

  const ids = new Set<string>();
  let position = 0;
  for (const item of node.items) {
    position += 1;
    if (!isMap(item)) continue;
    const id = item.get('id');
    if (id === undefined || id === null || String(id) === '') {
      add('error', 'node-id-missing', m.nodeIdMissing(position), at(item));
      continue;
    }
    const key = String(id);
    if (ids.has(key)) {
      add('error', 'node-id-duplicated', m.nodeIdDuplicated(key), at(item));
      continue;
    }
    ids.add(key);
  }
  return ids;
}

function checkGroups(
  doc: Document,
  nodeIds: Set<string>,
  groupIds: Set<string>,
  add: Add,
  m: Messages,
  at: At,
): void {
  void nodeIds;
  for (const item of seqOf(doc, 'nodes')) {
    const group = item.get('group');
    if (group === undefined || group === null) continue;
    const key = String(group);
    if (groupIds.has(key)) continue;
    // 描けなくはない（囲みが無いものとして描く）ので、警告に留める。
    add('warning', 'node-group-unknown', m.nodeGroupUnknown(String(item.get('id')), key), at(item));
  }
}

/** エッジを見て、`<from>>​<to>` の鍵の集合を返す（§5.2）。 */
function checkEdges(doc: Document, nodeIds: Set<string>, add: Add, m: Messages, at: At): Set<string> {
  const keys = new Set<string>();
  let position = 0;
  for (const item of seqOf(doc, 'edges')) {
    position += 1;
    const from = item.get('from');
    const to = item.get('to');
    if (from === undefined || from === null || to === undefined || to === null) {
      add('error', 'edge-endpoint-missing', m.edgeEndpointMissing(position), at(item));
      continue;
    }
    const key = `${String(from)}>${String(to)}`;
    keys.add(key);
    for (const end of [String(from), String(to)]) {
      if (nodeIds.has(end)) continue;
      add('error', 'edge-endpoint-unknown', m.edgeEndpointUnknown(key, end), at(item));
    }
  }
  return keys;
}

function checkPins(
  doc: Document,
  nodeIds: Set<string>,
  edgeKeys: Set<string>,
  add: Add,
  m: Messages,
  at: At,
): void {
  const pins = doc.get('pins', true);
  if (!isMap(pins)) return;

  for (const item of pins.items) {
    const key = String(item.key);
    const target = isMap(item.value) ? item.value : undefined;

    if (target !== undefined) {
      const appearance = target.get('appearance');
      if (appearance !== undefined && appearance !== null && !KNOWN_APPEARANCE.has(String(appearance))) {
        add('warning', 'appearance-unknown', m.appearanceUnknown(String(appearance)), at(item.value));
      }
    }

    const isEdge = EDGE_KEY.test(key);
    const known = isEdge ? edgeKeys.has(key) : nodeIds.has(key);
    if (known) continue;
    // 迷子（§3.4 の規則 3）。**捨てない。失敗にもしない。人へ出すだけ。**
    add('warning', 'pin-orphan', m.pinOrphan(key), at(item.value) ?? at(item.key));
  }
}

/**
 * §6.1 の書き戻し。**読んで書き戻して行が変わらないこと**を、その文書自身で確かめる。
 *
 * ここが落ちるのは文書の落ち度ではなく、**こちらの実装の落ち度**であることが多い。
 * それでも文書ごとに見るのは、実際に壊れるのが「特定の書き方をした文書」だから。
 */
function checkRoundTrip(doc: Document, text: string, add: Add, m: Messages): void {
  const back = doc.toString({ lineWidth: 0 });
  if (back === text) return;
  add('error', 'round-trip-changed', m.roundTripChanged, firstDifferingLine(text, back));
}

function firstDifferingLine(a: string, b: string): number {
  const left = a.split('\n');
  const right = b.split('\n');
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return i + 1;
  }
  return 1;
}
