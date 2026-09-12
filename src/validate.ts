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

import { DIRECTIONS as DIRECTION_WORDS } from './direction.ts';
import { KINDS as KIND_WORDS } from './kind.ts';
import { MARKS, NORTHS } from './grid.ts';
import { messages } from './messages.ts';
import { OPENINGS, SIDES } from './openings.ts';

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

/**
 * 図ぜんたいの宣言に書ける語。**値は 1 か所から取る**（写すとズレる）。
 */
const KINDS = new Set<string>(KIND_WORDS);
const DIRECTIONS = new Set<string>(DIRECTION_WORDS);
const OPENING_KINDS = new Set<string>(OPENINGS);
const OPENING_SIDES = new Set<string>(SIDES);
const NORTH_WORDS = new Set<string>(NORTHS);
const MARK_WORDS = new Set<string>(MARKS);

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
  checkDeclarations(doc, add, m, at);
  checkGeometry(doc, add, m, at);
  checkGridAndScale(doc, add, m, at);
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

/**
 * 図ぜんたいの宣言（`kind` / `direction` / `wrap`）。
 *
 * **どれも警告。** 知らない語を書いても描画側は既定へ落ちるので、読めない文書ではない。
 * ただし**黙って落とすと、書いた側は「効かない」理由が分からない。**
 */
function checkDeclarations(doc: Document, add: Add, m: Messages, at: At): void {
  const kind = doc.get('kind');
  if (kind !== undefined && kind !== null && !KINDS.has(String(kind))) {
    add('warning', 'kind-unknown', m.kindUnknown(String(kind)), at(doc.get('kind', true)));
  }

  const direction = doc.get('direction');
  if (direction !== undefined && direction !== null && !DIRECTIONS.has(String(direction))) {
    add(
      'warning',
      'direction-unknown',
      m.directionUnknown(String(direction)),
      at(doc.get('direction', true)),
    );
  }

  const wrap = doc.get('wrap');
  if (wrap !== undefined && wrap !== null && typeof wrap !== 'boolean') {
    add('warning', 'wrap-not-boolean', m.wrapNotBoolean(String(wrap)), at(doc.get('wrap', true)));
  }
}

/**
 * **AI が書く置き場所・大きさ・建具**（仕様 §3.1）。
 *
 * ここを見ていなかったので、`at: { x: "ひだり" }` も
 * `kind: door` を構成図へ書いたのも、**黙って無視されていた。**
 * 書いた側は同じ間違いを書き続け、人は図を見るまで気づけない。
 */
/**
 * **通り芯・縮尺・方位**（`src/grid.ts`）。
 *
 * ここも AI が書く場所なので、黙って落とさない。
 * とくに **「通り芯はあるが縮尺が無い」** は気づきにくい ——
 * 芯は描かれるので図は出るが、**寸法の数値だけが出ない。**
 * 現場で使う図としては、それが抜けたら意味が無い。
 */
function checkGridAndScale(doc: Document, add: Add, m: Messages, at: At): void {
  const placement = String(doc.get('kind') ?? '') === 'placement';

  const north = doc.get('north');
  if (north !== undefined && north !== null && !NORTH_WORDS.has(String(north))) {
    add('warning', 'north-unknown', m.northUnknown(String(north)), at(doc.get('north', true)));
  }

  const scale = doc.get('scale', true);
  let hasScale = false;
  if (scale !== undefined && scale !== null) {
    const mm = isMap(scale) ? scale.get('mm') : undefined;
    if (typeof mm === 'number' && Number.isFinite(mm) && mm > 0) {
      hasScale = true;
    } else {
      add('warning', 'scale-invalid', m.scaleInvalid(String(mm)), at(scale));
    }
  }

  // **壁の厚みも mm で書く。** 縮尺が無ければ px にできない。
  const wall = doc.get('wall', true);
  if (wall !== undefined && wall !== null) {
    const mm = isMap(wall) ? wall.get('mm') : undefined;
    if (!isPositive(mm)) {
      add('warning', 'wall-invalid', m.wallInvalid(String(mm)), at(wall));
    } else if (!hasScale) {
      add('warning', 'wall-needs-scale', m.wallNeedsScale, at(wall));
    }
  }

  const grid = doc.get('grid', true);
  if (grid === undefined || grid === null || !isMap(grid)) return;

  if (!placement) {
    add('warning', 'grid-ignored', m.gridIgnored, at(grid));
    return;
  }

  let axes = 0;
  for (const key of ['x', 'y']) {
    const seq = grid.get(key, true);
    if (seq === undefined || seq === null || !isSeq(seq)) continue;
    let position = 0;
    for (const item of seq.items) {
      position += 1;
      const id = isMap(item) ? item.get('id') : undefined;
      const value = isMap(item) ? item.get('at') : undefined;
      if (id === undefined || id === null || String(id) === '' || !isNumber(value)) {
        add('warning', 'grid-axis-invalid', m.gridAxisInvalid(position), at(item));
        continue;
      }
      const mark = isMap(item) ? item.get('mark') : undefined;
      if (mark !== undefined && mark !== null && !MARK_WORDS.has(String(mark))) {
        add('warning', 'grid-mark-unknown', m.gridMarkUnknown(position, String(mark)), at(item));
      }
      axes += 1;
    }
  }

  // **芯が 2 本以上あってはじめて寸法が引ける。** 1 本では長さが無い。
  if (axes >= 2 && !hasScale) {
    add('warning', 'scale-missing', m.scaleMissing, at(grid));
  }
}

function checkGeometry(doc: Document, add: Add, m: Messages, at: At): void {
  const placement = String(doc.get('kind') ?? '') === 'placement';

  for (const item of seqOf(doc, 'nodes')) {
    const id = String(item.get('id') ?? '');

    const point = item.get('at', true);
    if (point !== undefined && point !== null) {
      if (!isMap(point) || !isNumber(point.get('x')) || !isNumber(point.get('y'))) {
        add('warning', 'node-at-invalid', m.nodeAtInvalid(id), at(point));
      } else if (!placement) {
        // **構成図では置き場所を機械が決める**（仕様 §2.3）。書いても効かない。
        add('warning', 'node-at-ignored', m.nodeAtIgnored(id), at(point));
      }
    }

    const size = item.get('size', true);
    if (size !== undefined && size !== null) {
      if (!isMap(size) || !isPositive(size.get('w')) || !isPositive(size.get('h'))) {
        add('warning', 'node-size-invalid', m.nodeSizeInvalid(id), at(size));
      }
    }

    const radius = item.get('radius', true);
    if (radius !== undefined && radius !== null) {
      if (!isPositive(isMap(radius) ? undefined : item.get('radius'))) {
        add('warning', 'radius-invalid', m.radiusInvalid(id), at(radius));
      } else if (!placement) {
        add('warning', 'radius-ignored', m.radiusIgnored(id), at(radius));
      }
    }

    checkOpenings(item, id, placement, add, m, at);
  }
}

function checkOpenings(
  item: YAMLMap,
  id: string,
  placement: boolean,
  add: Add,
  m: Messages,
  at: At,
): void {
  const holes = item.get('openings', true);
  if (holes === undefined || holes === null || !isSeq(holes)) return;

  if (!placement) {
    add('warning', 'opening-ignored', m.openingIgnored(id), at(holes));
    return;
  }

  for (const hole of holes.items) {
    if (!isMap(hole)) continue;
    const kind = String(hole.get('kind') ?? '');
    if (!OPENING_KINDS.has(kind)) {
      add('warning', 'opening-kind-unknown', m.openingKindUnknown(id, kind), at(hole));
    }
    const side = String(hole.get('side') ?? '');
    if (!OPENING_SIDES.has(side)) {
      add('warning', 'opening-side-unknown', m.openingSideUnknown(id, side), at(hole));
    }
  }
}

function isNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value: unknown): boolean {
  return isNumber(value) && (value as number) > 0;
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
/**
 * 読んで書き戻したときに、人が触っていない行が動かないか。
 *
 * **改行コードの違いは差分として数えない。**
 *
 * Windows の Git は `core.autocrlf` で CRLF に展開する。書き戻すのは常に LF なので、
 * 中身が 1 文字も違わないのに**全行が「変わった」**になっていた（Issue #5 のコメント）。
 * `pnpm validate` は最初に叩くコマンドで、**同梱の手本が落ちていた。**
 *
 * 改行そのものは `.gitattributes` で LF に固定してあるが、
 * **既に CRLF で clone 済みの手元は、それでは救われない。**
 */
function checkRoundTrip(doc: Document, text: string, add: Add, m: Messages): void {
  const back = doc.toString({ lineWidth: 0 });
  if (normalizeEol(back) === normalizeEol(text)) return;
  add('error', 'round-trip-changed', m.roundTripChanged, firstDifferingLine(text, back));
}

/** CRLF と CR を LF に寄せる。**改行の種類だけを消し、行の中身は触らない。** */
function normalizeEol(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function firstDifferingLine(a: string, b: string): number {
  const left = normalizeEol(a).split('\n');
  const right = normalizeEol(b).split('\n');
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) return i + 1;
  }
  return 1;
}
