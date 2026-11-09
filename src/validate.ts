/**
 * 形式の検証器（仕様 §8）。
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
import { LineCounter, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Document, Node, YAMLMap } from 'yaml';

import { DIRECTIONS as DIRECTION_WORDS } from './direction.ts';
import { KINDS as KIND_WORDS } from './kind.ts';
import { ownerOf, pointEnd } from './image.ts';
import { linkOf } from './link.ts';
import { MARKS, NORTHS } from './grid.ts';
import { ENDS } from './ends.ts';
import { LINES } from './line.ts';
import { CURVES, viaOf } from './curve.ts';
import { arcOf, pointsOf } from './paths.ts';
import {
  FIXED_KEYS,
  PART_KEYS,
  PLACE_KEYS,
  ROTATE_KEPT_KEYS,
  expandDocument,
  gridOf,
  membersOf,
  mentionsParts,
  nameOf,
  pointOf as placePointOf,
  rotationOf,
} from './parts.ts';
import type { Expansion } from './parts.ts';
import { DIM_ENDS, dimLabel, dimPointOf, dimValue, measureDim, rulerAt, textDiffers } from './dims.ts';
import type { Rect } from './dims.ts';
import { UNITS } from './units.ts';
import { scaleOf } from './grid.ts';
import { viewsOf } from './views.ts';
import { VERTICALS, floorsOf } from './floor.ts';
import { achromatic, faintOn, faintWhere, PAPER, paletteOf as routePalette } from './palette.ts';
import { WEIGHTS, weightOf, type Weight } from './weight.ts';
import { axonOf } from './axon.ts';
import { HATCHES } from './hatch.ts';
import { SYMBOLS } from './symbol.ts';
import { MARKERS } from './marker.ts';
import { ALIGNS } from './align.ts';
import { WRITES } from './write.ts';
import { TO_STRING_OPTIONS } from './format.ts';
import { messages } from './messages.ts';
import { HINGES, OPENINGS, SIDES, SWINGS } from './openings.ts';
import { areaIssues } from './area.ts';
import { paperTroubles } from './paper.ts';
import { inkOf, isMarkupColor, isMarkupWidth, pointOf } from './markup.ts';

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
const OPENING_SWINGS = new Set<string>(SWINGS);
const OPENING_HINGES = new Set<string>(HINGES);
const NORTH_WORDS = new Set<string>(NORTHS);
const MARK_WORDS = new Set<string>(MARKS);
const MARKER_WORDS = new Set<string>(MARKERS);
const WRITE_WORDS = new Set<string>(WRITES);
const ALIGN_WORDS = new Set<string>(ALIGNS);
const HATCH_WORDS = new Set<string>(HATCHES);
const SYMBOL_WORDS = new Set<string>(SYMBOLS);
const END_WORDS = new Set<string>(ENDS);
const LINE_WORDS = new Set<string>(LINES);
const CURVE_WORDS = new Set<string>(CURVES);
const VERTICAL_WORDS = new Set<string>(VERTICALS);
const WEIGHT_WORDS = new Set<string>(WEIGHTS);

/** `pins` の中で、位置や体裁ではなく人の決定を表す鍵。迷子の判定には関係しない。 */
const EDGE_KEY = /^(.+)>(.+)$/;

export function validate(text: string): Finding[] {
  const lines = new LineCounter();
  let doc = parseDocument(text, { lineCounter: lines });
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
  /**
   * **置いた部品は、展開した写しの上で検査する**（`parts` / `place`。`src/parts.ts`）。
   * 部品そのものの書き方は正本（`source`）で見て、節・線・寸法の検査は展開したもの（`doc`）で見る。
   * 写しの節は部品の定義の行を持ったままなので、指摘は定義の行を指す。書き戻しの検査だけは正本で見る。
   */
  const source = doc;
  let firstOfCopies = Number.POSITIVE_INFINITY;
  if (mentionsParts(text)) {
    doc = parseDocument(text);
    const expansion = expandDocument(doc);
    checkParts(source, expansion, add, m, at);
    firstOfCopies = found.length;
  }
  const nodeIds = checkNodes(doc, add, m, at);
  if (nodeIds === undefined) return found;

  const groupIds = collectIds(seqOf(doc, 'groups'));
  checkGroups(doc, nodeIds, groupIds, add, m, at);
  checkDeclarations(doc, add, m, at);
  checkGeometry(doc, add, m, at);
  checkGridAndScale(doc, add, m, at);
  checkAreaText(doc, add, m, at);
  checkSources(doc, add, m, at);
  checkMarkup(doc, nodeIds, add, m, at);
  checkViews(doc, add, m, at);
  checkConstruction(doc, add, m, at);
  checkSharedIds(doc, add, m, at);
  checkLabelMarkdown(doc, add, m, at);
  checkNumberText(doc, add, m, at);
  checkEnds(doc, add, m, at);
  checkColors(doc, add, m, at);
  checkStyles(doc, add, m, at);
  const edgeKeys = checkEdges(doc, nodeIds, add, m, at);
  const pathIds = checkPaths(doc, nodeIds, add, m, at);
  const dimIds = checkDims(doc, nodeIds, pathIds, add, m, at);
  checkPins(doc, nodeIds, edgeKeys, add, m, at, pathIds, dimIds);
  checkRoundTrip(source, text, add, m);

  return onceForEachPart(source, found, firstOfCopies, at);
}

/**
 * **同じ定義から出た同じ指摘は 1 回だけ**（置いた数だけ同じことを言わない）。
 * 部品の定義の行を指す指摘を、印と行の組で 1 つにまとめる。
 */
function onceForEachPart(source: Document, found: Finding[], first: number, at: At): Finding[] {
  if (first === Number.POSITIVE_INFINITY) return found;
  const parts = source.get('parts', true);
  const range = (parts as Node | undefined)?.range;
  if (range === undefined || range === null) return found;
  const top = at(parts) ?? 0;
  const bottom = at({ range: [range[1], range[1], range[1]] }) ?? top;
  const seen = new Set<string>();
  return found.filter((finding, index) => {
    if (index < first || finding.line === undefined || finding.line < top || finding.line > bottom) return true;
    const key = `${finding.code}@${finding.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * **出典**（`sources`。`src/sources.ts`）。名前と取得日が無ければ知らせる。
 * 実在のデータを描いた図は、出典と日付を図に出すと決めている —— 日付の無い出典は、いつの数かが分からない。
 */
function checkSources(doc: Document, add: Add, m: Messages, at: At): void {
  const raw = doc.get('sources', true);
  if (raw === undefined || raw === null) return;
  if (!isSeq(raw)) {
    add('warning', 'sources-not-list', m.sourcesNotList, at(raw));
    return;
  }
  raw.items.forEach((item, i) => {
    const name = isMap(item) ? item.get('name') : undefined;
    if (typeof name !== 'string' || name.trim() === '') {
      add('warning', 'source-name-missing', m.sourceNameMissing(String(i + 1)), at(item));
      return;
    }
    const date = isMap(item) ? item.get('retrieved') : undefined;
    const text = date instanceof Date ? date.toISOString().slice(0, 10) : date === undefined || date === null ? '' : String(date);
    // 取得日を求めるのは Web の資料（url あり）だけ。書籍・規格は版や発行年を名前に書く
    const url = isMap(item) ? item.get('url') : undefined;
    if (text === '' && typeof url === 'string' && url.trim() !== '') add('warning', 'source-date-missing', m.sourceDateMissing(name), at(item));
    else if (text !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(text)) add('warning', 'source-date-format', m.sourceDateFormat(name, text), at(item));
  });
}

/**
 * **赤入れ**（`markup`。`src/markup.ts`）。図には効かないので、読めない項目は描かれないだけ —— それを知らせる。
 * 結んだ箱が無い赤入れは**行き先の無い赤入れ**として知らせる（`pins` の迷子と同じく、黙って捨てない）。
 */
function checkMarkup(doc: Document, nodeIds: ReadonlySet<string>, add: Add, m: Messages, at: At): void {
  const raw = doc.get('markup', true);
  if (raw === undefined || raw === null) return;
  if (!isSeq(raw)) {
    add('warning', 'markup-not-list', m.markupNotList, at(raw));
    return;
  }
  raw.items.forEach((item, i) => {
    const n = String(i + 1);
    const r = (isMap(item) ? item.toJSON() : null) as Record<string, unknown> | null;
    if (r === null || (!('ink' in r) && !('note' in r))) {
      add('warning', 'markup-kind', m.markupKind(n), at(item));
      return;
    }
    if ('ink' in r && inkOf(r.ink) === null) add('warning', 'markup-ink-short', m.markupInkShort(n), at(item));
    if (!('ink' in r) && pointOf(r.at) === null) add('warning', 'markup-note-at', m.markupNoteAt(n), at(item));
    if (r.color !== undefined && !isMarkupColor(r.color)) add('warning', 'markup-color', m.markupColor(n, String(r.color)), at(item));
    if (r.width !== undefined && !isMarkupWidth(r.width)) add('warning', 'markup-width', m.markupWidth(n, String(r.width)), at(item));
    if (typeof r.on === 'string' && !nodeIds.has(r.on)) add('warning', 'markup-orphaned', m.markupOrphaned(n, r.on), at(item));
  });
}

/**
 * **書いた面積と帖数を、箱の大きさと照らす**（`src/area.ts`）。縮尺（mm）がある配置図だけ。
 */
function checkAreaText(doc: Document, add: Add, m: Messages, at: At): void {
  /** **刷る紙**（`src/paper.ts`）。読めない語は黙って捨てず、px のままになることを言う。 */
  const paperNode = doc.get('paper', true);
  for (const trouble of paperTroubles(doc.toJS()?.paper)) {
    const said = trouble === 'size' ? m.paperSizeInvalid : trouble === 'orient' ? m.paperOrientInvalid : m.paperMarginInvalid;
    add('warning', `paper-${trouble}-invalid`, said, at(paperNode));
  }

  const scale = doc.get('scale', true);
  const mm = isMap(scale) ? scale.get('mm') : undefined;
  if (!isPositive(mm)) return;
  const items = seqOf(doc, 'nodes');
  const nodes: { id: string; text: string; x: number; y: number; w: number; h: number; drawn: boolean }[] = [];
  const where = new Map<string, unknown>();
  for (const item of items) {
    const size = item.get('size', true);
    const w = isMap(size) ? size.get('w') : undefined;
    const h = isMap(size) ? size.get('h') : undefined;
    if (!isPositive(w) || !isPositive(h)) continue;
    const id = String(item.get('id') ?? '');
    const text = `${String(item.get('label') ?? '')} ${String(item.get('technology') ?? '')}`;
    const pos = item.get('at', true);
    const x = isMap(pos) ? Number(pos.get('x')) : NaN;
    const y = isMap(pos) ? Number(pos.get('y')) : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    nodes.push({ id, text, x, y, w: w as number, h: h as number, drawn: String(item.get('marker') ?? '') !== 'none' });
    where.set(id, item);
  }
  for (const issue of areaIssues(nodes, mm as number)) {
    add('warning', 'area-text-mismatch', issue.unit === 'sqm'
      ? m.areaSqmMismatch(issue.id, String(issue.written), issue.expected.toFixed(2))
      : m.areaMatMismatch(issue.id, String(issue.written), issue.expected.toFixed(1)), at(where.get(issue.id) as never));
  }
}

/** `error` を 1 つでも含むか。**警告だけなら通す。** */
export function hasError(findings: Finding[]): boolean {
  return findings.some((finding) => finding.severity === 'error');
}

type Add = (severity: Severity, code: string, message: string, line?: number) => void;
type Messages = ReturnType<typeof messages>['validate'];
type At = (node: unknown) => number | undefined;

/** **線を持つもの**（辺と、節に属さない線 `paths`）。色・太さ・名前の検査は同じに見る。 */
function linesOf(doc: Document): YAMLMap[] {
  return [...seqOf(doc, 'edges'), ...seqOf(doc, 'paths')];
}

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
    // **作図には節が無い**。あるのは円と弧だけ。
    if (String(doc.get('kind') ?? '') === 'construction') return new Set();
    add('error', 'nodes-missing', m.nodesMissing, 1);
    return undefined;
  }
  if (!isSeq(node)) {
    add('error', 'nodes-not-sequence', m.nodesNotSequence, at(node));
    return undefined;
  }

  /**
   * **重なった相手の行まで言う**（2026-09-20）。
   *
   * 前は「id "p3" が 2 か所以上にあります」と**片方の行だけ**だった。
   * ところが重複は、**もう 1 つを見つけないと直せない** ——
   * 自動で名前を振る道具（`p0` `p1` …）と手で書いた名前がぶつかると、
   * どちらを直すかを決めるのに、結局こちらで探すことになる。
   * **このセッションで 3 回踏んだ**（`n1`/`p1`、`p3`/`p4`）。
   */
  const ids = new Map<string, number | undefined>();
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
      add('error', 'node-id-duplicated', m.nodeIdDuplicated(key, ids.get(key)), at(item));
      continue;
    }
    ids.set(key, at(item));
  }
  return new Set(ids.keys());
}

/**
 * 図ぜんたいの宣言（`kind` / `direction` / `wrap` / `arrows` / `projection`）。
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

  // **矢印**（`src/arrows.ts`）。消えるのは `false` と書いたときだけ。`"false"` は矢印が出る。
  const arrows = doc.get('arrows');
  if (arrows !== undefined && arrows !== null && typeof arrows !== 'boolean') {
    add('warning', 'arrows-not-boolean', m.arrowsNotBoolean(String(arrows)), at(doc.get('arrows', true)));
  }

  // **軸測投影**（`src/axon.ts`）。知らない語は投影されず、平面のまま出る。
  const projection = doc.get('projection');
  if (projection !== undefined && projection !== null && axonOf(projection) === null) {
    add('warning', 'projection-unknown', m.projectionUnknown(String(projection)), at(doc.get('projection', true)));
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

  /**
   * 方位（`src/grid.ts`）。**語だけでも、置き場所つきでも書ける**（2026-09-18）。
   * 見るのは向きの語で、置き場所は数でなければ紙の右上へ戻る（捨てても図は出る）。
   */
  const northNode = doc.get('north', true);
  const north = doc.get('north');
  if (north !== undefined && north !== null) {
    const face = isMap(northNode) ? northNode.get('face') : north;
    if (face === undefined || face === null || !NORTH_WORDS.has(String(face))) {
      add('warning', 'north-unknown', m.northUnknown(String(face ?? north)), at(northNode));
    }
  }

  const scale = doc.get('scale', true);
  let hasScale = false;
  if (scale !== undefined && scale !== null) {
    const mm = isMap(scale) ? scale.get('mm') : undefined;
    // **インチでも書ける**（2026-09-16）。`scale: { in: 1.5 }` なら寸法はフィート表記。
    const inches = isMap(scale) ? scale.get('in') : undefined;
    if (isPositive(mm) || isPositive(inches)) {
      hasScale = true;
      // **両方書いてあったら mm を採る**（`src/grid.ts`）。黙って片方を捨てない。
      if (isPositive(mm) && isPositive(inches)) {
        add('warning', 'scale-two-units', m.scaleTwoUnits, at(scale));
      }
    } else {
      add('warning', 'scale-invalid', m.scaleInvalid(String(mm ?? inches)), at(scale));
    }
    checkScaleUnit(scale, add, m, at);
  }

  // **壁の厚みも mm で書く。** 縮尺が無ければ px にできない。
  const wall = doc.get('wall', true);
  if (wall !== undefined && wall !== null) {
    const mm = isMap(wall) ? wall.get('mm') : undefined;
    const inches = isMap(wall) ? wall.get('in') : undefined;
    if (!isPositive(mm) && !isPositive(inches)) {
      add('warning', 'wall-invalid', m.wallInvalid(String(mm ?? inches)), at(wall));
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

  // **時間軸には寸法を引かない**ので、縮尺は要らない（`src/grid.ts` の `tick`）。
  const onlyTicks = ['x', 'y'].every((key) => {
    const seq = grid.get(key, true);
    if (seq === undefined || seq === null || !isSeq(seq)) return true;
    return seq.items.every((item) => isMap(item) && String(item.get('mark')) === 'tick');
  });

  // **芯が 2 本以上あってはじめて寸法が引ける。** 1 本では長さが無い。
  if (axes >= 2 && !hasScale && !onlyTicks) {
    add('warning', 'scale-missing', m.scaleMissing, at(grid));
  }
}

/**
 * **文字として書いたはずの値が、数として読まれていないか**（2026-09-15）。
 *
 * 見本 132（クレーン揚重計画図）の定格総荷重表で踏んだ。
 *
 * ```yaml
 * label: 32.0   # → YAML は数として読む → 絵には「32」と出る
 * ```
 *
 * **`.0` が黙って消える。** 表の値・寸法・版番号・電話番号のように、
 * **書いたとおりに出したい文字**でこれが起きると、
 * 書き手は「書いたのに違う」としか分からない。
 *
 * 見るのは**書いた字と、読んだ値を戻した字が違うか**だけ。
 * `label: 32` はどちらも `32` なので鳴らない —— **消えたときだけ言う。**
 */
function checkNumberText(doc: Document, add: Add, m: Messages, at: At): void {
  const look = (item: YAMLMap, key: string, id: string): void => {
    const node = item.get(key, true);
    if (!isScalar(node) || typeof node.value !== 'number') return;
    const written = typeof node.source === 'string' ? node.source : '';
    if (written === '' || written === String(node.value)) return;
    add('warning', 'number-text-changed', m.numberTextChanged(id, key, written, String(node.value)), at(node));
  };
  for (const part of ['nodes', 'edges', 'paths'] as const) {
    for (const item of seqOf(doc, part)) {
      const id = String(item.get('id') ?? item.get('from') ?? '');
      for (const key of ['label', 'technology', 'tag', 'title']) look(item, key, id);
    }
  }
  for (const item of seqOf(doc, 'groups')) look(item, 'label', String(item.get('id') ?? ''));
}

/**
 * **同じ id を、節と囲みで使っていないか**（2026-09-15）。
 *
 * 見本 21（テーブルの関係）で、囲み `zaiko`（在庫）と節 `zaiko`（在庫）が
 * 同じ id を持っていた。結果、**囲みが二重に描かれ、名前が同じ場所に 2 回出ていた。**
 *
 * **絵の上では完全に重なるので、目で見ても分からない。**
 * 数の検査も、囲みどうしの重なりを見ていないので鳴らなかった。
 * 見つかったのは、書き出した SVG の文字を総当たりで比べたとき。
 */
/**
 * **名前の中の `**` は、そのまま絵に出る**（2026-09-19）。
 *
 * zumen の名前は**素のテキスト**で、Markdown ではない。
 * ところが正本のコメントも CHANGELOG も Markdown なので、
 * **強調の印をそのまま名前へ持ち込む**ことが起きる（見本 193 と 200 で 2 回やった）。
 * 絵を見れば気づくが、**表のセルは 1 行が短く、見落とす。**
 */
function checkLabelMarkdown(doc: Document, add: Add, m: Messages, at: At): void {
  /**
   * **節だけを見ていた**（2026-09-20 に直した）。
   *
   * 絵に出る文字は節の名前だけではない —— **辺のラベルも、図（views）の名前も出る。**
   * ところがこの検査は `nodes` しか回っていなかったので、
   * `edges[].label: "**強く**"` は素通りしていた。
   * いまの見本に該当は 0 件だが、**穴が開いていることは確かめた**
   * （辺のラベルと図の名前に `**` を入れて、何も言われなかった）。
   */
  const scan = (item: YAMLMap, who: string, fields: readonly string[]): void => {
    for (const field of fields) {
      const text = item.get(field);
      if (typeof text !== 'string') continue;
      if (text.includes('**')) {
        add('warning', 'label-markdown', m.labelMarkdown(who), at(item.get(field, true)));
      }
      const glued = GLUED.exec(text);
      if (glued !== null) {
        add('warning', 'label-glued-word', m.labelGluedWord(who, glued[0]), at(item.get(field, true)));
      }
      /**
       * **`undefined` / `NaN` が、そのまま絵に出る**（2026-09-21）。
       *
       * 見本 322 を組んでいて踏んだ —— 組み立てるスクリプトの引数が 1 つ足りず、
       * **「undefined」と書かれた行が 6 か所に描かれた。**
       * 交差 0・文字の重なり 0 と言われ、**絵を見るまで誰も止めなかった。**
       * 図の言葉としては意味を持たないので、出たら書き間違い。
       */
      const placeholder = PLACEHOLDER.exec(text);
      if (placeholder !== null) {
        add(
          'warning',
          'label-placeholder',
          m.labelPlaceholder(who, placeholder[0]),
          at(item.get(field, true)),
        );
      }
    }
  };

  // **名前だけではない。** 符号（tag）も版（technology）も、そのまま絵に出る。
  for (const item of seqOf(doc, 'nodes')) {
    scan(item, String(item.get('id') ?? ''), ['label', 'tag', 'technology']);
  }
  for (const item of seqOf(doc, 'edges')) {
    scan(item, edgeNameOf(item), ['label']);
  }
  for (const item of seqOf(doc, 'paths')) {
    scan(item, String(item.get('id') ?? ''), ['label']);
  }
  for (const item of seqOf(doc, 'views')) {
    scan(item, String(item.get('id') ?? ''), ['title']);
  }
}

/** 辺には id が無いので「from → to」で呼ぶ（ほかの検査と同じ呼び方）。 */
function edgeNameOf(item: YAMLMap): string {
  return `${String(item.get('from') ?? '?')} → ${String(item.get('to') ?? '?')}`;
}

/**
 * **日本語の字のすぐ隣に、小文字の英単語がくっついている**（2026-09-20）。
 *
 * 棚板の図を描いていて、**「前framing」という無い言葉**を自分で作った
 * （正しくは幕板）。英語の用語を下書きから写して、日本語に直し忘れた形。
 * **絵にはそのまま出るのに、どの検査も見ていなかった。**
 *
 * 測ったら**見本 249 枚で 2 件**だけ当たった —— どちらも本物で、
 * 見本 195 の「身長 160 以上cm」（正しくは「160cm 以上」）。
 *
 * **中黒（・）を字に数えない。** 数えると `mm・` が当たって 62 件になる。
 * 単位（mm・cm・kg）は ASCII だけなので当たらず、
 * 「PoE の」「R600a」のように**間に空きがある書き方も当たらない。**
 */
const GLUED =
  /[\u3041-\u3096\u30a1-\u30fa\u30fc\u4e00-\u9fff][a-z]{2,}|[a-z]{2,}[\u3041-\u3096\u30a1-\u30fa\u30fc\u4e00-\u9fff]/;

/** **計算や組み立ての失敗が、そのまま文字になったもの。** 図の言葉ではない。 */
const PLACEHOLDER = /(?<![A-Za-z])(undefined|NaN|\[object Object\])(?![A-Za-z])/;

function checkSharedIds(doc: Document, add: Add, m: Messages, at: At): void {
  const groups = new Set<string>();
  for (const item of seqOf(doc, 'groups')) {
    const id = item.get('id');
    if (id !== undefined && id !== null) groups.add(String(id));
  }
  if (groups.size === 0) return;
  for (const item of seqOf(doc, 'nodes')) {
    const id = String(item.get('id') ?? '');
    if (id !== '' && groups.has(id)) {
      add('warning', 'id-shared-with-group', m.idSharedWithGroup(id), at(item));
    }
  }
}

/**
 * **作図**（`kind: construction`）。
 *
 * ## いちばん大事な検査 —— **位置の pin を黙殺しない**
 *
 * この図では位置を手順が決めるので、`pins.position` は効かない。
 * **黙って消えるのが唯一の本当の事故**（姉妹側の条件。2026-09-15）——
 * 人が箱を動かして、次の生成で何も言わずに戻るのは、
 * 利用者から見ると **「人の指定が勝つ」が壊れたのと区別が付かない。**
 *
 * だから**上書きでも黙殺でもなく、明示で断る。**
 * 何を代わりに直せばよいか（＝`let` の定数）まで言う。
 */
function checkConstruction(doc: Document, add: Add, m: Messages, at: At): void {
  if (String(doc.get('kind') ?? '') !== 'construction') return;

  const pins = doc.get('pins', true);
  if (isMap(pins)) {
    for (const pair of pins.items) {
      const value = pair.value;
      if (!isMap(value) || value.get('position', true) === undefined) continue;
      add('warning', 'pin-position-in-construction', m.pinPositionInConstruction(String(pair.key)), at(value));
    }
  }

  // **描くものが 1 つも無ければ、絵にならない。**
  // かたまり（`define`）の中も見る —— 字は全部そちらにある。
  /**
   * 描くものがあるか。
   *
   * **`get` は Document と Map の両方にある**が、`isMap` は Document に真を返さない。
   * 最初ここで `isMap(doc)` を通していて、**最上位を丸ごと見落としていた**
   * （2026-09-15。見本 129 が「描くものがありません」と言われ続けた）。
   */
  const draws = (get: (key: string) => unknown): boolean => {
    const drawn = (key: string): boolean => {
      const seq = get(key);
      if (!isSeq(seq)) return false;
      // 弧と線分は、あるだけで描く。円は `draw: true` が要る。
      if (key === 'arcs' || key === 'segments') return seq.items.length > 0;
      return seq.items.some((one) => isMap(one) && one.get('draw') === true);
    };
    // **`steps` の中の円も見る。** 点と円は混ぜて書けるようにしてある。
    return drawn('arcs') || drawn('segments') || drawn('circles') || drawn('steps');
  };
  const define = doc.get('define', true);
  const inShapes =
    isMap(define) &&
    define.items.some((pair) => isMap(pair.value) && draws((key) => (pair.value as YAMLMap).get(key, true)));
  if (!draws((key) => doc.get(key, true)) && !inShapes) {
    add('warning', 'construction-nothing-drawn', m.constructionNothingDrawn, 1);
  }
}

/**
 * **1 枚に複数の図**（`views`）。
 *
 * 落ちたことを黙らない —— 形が揃っていない図は描かれないので、
 * **書いたのに出ない**という、いちばん分かりにくい壊れ方をする。
 */
function checkViews(doc: Document, add: Add, m: Messages, at: At): void {
  const views = doc.get('views', true);
  if (views === undefined || views === null) return;
  if (!isSeq(views)) {
    add('warning', 'views-invalid', m.viewsInvalid, at(views));
    return;
  }
  if (String(doc.get('kind') ?? '') !== 'placement') {
    add('warning', 'views-ignored', m.viewsIgnored, at(views));
    return;
  }

  const seen = new Set<string>();
  let withGrid = 0;
  let position = 0;
  for (const item of views.items) {
    position += 1;
    const id = isMap(item) ? item.get('id') : undefined;
    const name = id === undefined || id === null ? '' : String(id);
    if (name === '') {
      add('warning', 'view-id-missing', m.viewIdMissing(position), at(item));
      continue;
    }
    if (seen.has(name)) add('warning', 'view-id-duplicate', m.viewIdDuplicate(name), at(item));
    seen.add(name);

    const box = isMap(item) ? item.get('at', true) : undefined;
    const size = isMap(item) ? item.get('size', true) : undefined;
    const placed =
      isMap(box) && isNumber(box.get('x')) && isNumber(box.get('y'));
    const sized =
      isMap(size) && isPositive(size.get('w')) && isPositive(size.get('h'));
    // **枠が無ければ、どこへ何を描くか決められない。** 勝手に決めない。
    if (!placed || !sized) {
      add('warning', 'view-frame-missing', m.viewFrameMissing(name), at(item));
      continue;
    }

    if (isMap(item) && item.get('grid', true) !== undefined && item.get('grid', true) !== null) {
      withGrid += 1;
    }
    if (isMap(item)) checkScaleUnit(item.get('scale', true), add, m, at);
  }

  /**
   * **芯を 1 本も持たない図の集まり。**
   *
   * 1 つの図に芯が無いのは間違いではない —— 実物の一般配置図でも、
   * **甲板の平面図は上の側面図と縦に揃えてある**ので、肋骨番号は
   * いちばん下の図と側面図にしか書かない。
   *
   * **縮尺を書いている図だけを見る。** 縮尺がどこにも無ければ、
   * その図は寸法を出す気が無い —— コンパスの作図図（見本 127）は
   * 目盛りを使わないことが中身なので、**寸法が無いのは正しい。**
   * 書き忘れだけを拾う（2026-09-15。次の見本で鳴って気づいた）。
   */
  const scaled =
    doc.get('scale', true) !== undefined ||
    views.items.some((item) => isMap(item) && item.get('scale', true) !== undefined);
  /**
   * **図ごとに縮尺を宣言しているなら、責めない**（2026-09-19）。
   *
   * `views[].scale` は**絵に出なくても正本に残る** ——
   * 読む側と別の実装へ「この範囲は 1px が何 mm か」を伝える。
   * 1 枚に縮尺が 2 つある図（詳細図と全体図）では、それ自体が中身なので、
   * **grid が無いことは書き忘れではない。**
   *
   * 線引きは**縮尺が図ごとに違うかどうか** —— 2 つ以上の違う縮尺が並んでいれば、
   * 書き手は縮尺のために views を使っている。同じ縮尺しか無いなら、
   * これまでどおり「縮尺があるのに芯が無い ＝ 書き忘れ」（2026-09-15 の決定）。
   */
  const scales = new Set(
    views.items
      .filter((item) => isMap(item) && item.get('scale', true) !== undefined)
      .map((item) => JSON.stringify((item as YAMLMap).get('scale'))),
  );
  if (seen.size > 0 && withGrid === 0 && scaled && scales.size < 2) {
    add('warning', 'views-no-grid', m.viewsNoGrid, at(views));
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

    // **リンク**（`src/link.ts`）。通さない書き方（javascript: など）は描かない。
    const link = item.get('link', true);
    if (link !== undefined && link !== null && linkOf(item.get('link')) === null) {
      add('warning', 'node-link-invalid', m.nodeLinkInvalid(id), at(link));
    }

    // **立体の高さ**（`src/solid.ts`）。配置図で、投影を書き、置き場所と大きさがあるときだけ効く。
    const height = item.get('height', true);
    if (height !== undefined && height !== null) {
      if (!isPositive(item.get('height'))) {
        add('warning', 'node-height-invalid', m.nodeHeightInvalid(id), at(height));
      } else if (!placement || doc.get('projection') === undefined || point == null || size == null) {
        add('warning', 'node-height-ignored', m.nodeHeightIgnored(id), at(height));
      }
    }

    const radius = item.get('radius', true);
    if (radius !== undefined && radius !== null) {
      if (!isPositive(isMap(radius) ? undefined : item.get('radius'))) {
        add('warning', 'radius-invalid', m.radiusInvalid(id), at(radius));
      } else if (!placement) {
        add('warning', 'radius-ignored', m.radiusIgnored(id), at(radius));
      } else if (isMap(size) && isPositive(size.get('w')) && isPositive(size.get('h'))) {
        /**
         * **節より小さい「範囲の円」**（2026-09-20）。
         *
         * `radius` は**範囲の円**（作業半径・警戒区域）で、**角の丸みではない。**
         * CSS の `border-radius` のつもりで小さい値を書くと、
         * **節の中に点線の丸が出るだけ**で、書いた人には飾りに見える。
         * 見本 281 を描いていて自分で踏んだ ——
         * 手元の 24 節を測ると**節より小さい円は 1 つも無かった**ので、noise にならない。
         */
        const half = Math.min(Number(size.get('w')), Number(size.get('h'))) / 2;
        const drawn = Number(item.get('radius'));
        if (drawn <= half) {
          add(
            'warning',
            'radius-too-small',
            m.radiusTooSmall(id, String(drawn), String(Math.round(half * 2))),
            at(radius),
          );
        }
      }
    }

    const marker = item.get('marker');
    if (marker !== undefined && marker !== null) {
      if (!MARKER_WORDS.has(String(marker))) {
        add('warning', 'marker-unknown', m.markerUnknown(id, String(marker), MARKERS.join(' / ')), at(item.get('marker', true)));
      } else if (!placement) {
        add('warning', 'marker-ignored', m.markerIgnored(id), at(item.get('marker', true)));
      } else {
        /**
         * **丸に長方形の `size` を書いても、短いほうしか描かれない**（2026-09-20）。
         *
         * `circle` と `double` は半径を `min(w, h) / 2` で描く（`src/marker.ts`）。
         * だから `size: { w: 80, h: 34 }` と書いても**直径 34 の丸**が出る ——
         * 書いた 80 は消える。ところが名前の置き場所も重なりの判定も
         * **書いた 80 のほうを見る**ので、丸の横に空きが残る。
         *
         * 測ったら**見本 8 枚・42 節**がこうなっていた
         * （フェリーの発着表の港名は 80×34。描かれるのは 34 の丸）。
         * **横長の丸が欲しいなら `ellipse`** があり、そちらは w と h の両方を使う。
         */
        const round = String(marker) === 'circle' || String(marker) === 'double';
        const w = isMap(size) ? Number(size.get('w')) : NaN;
        const h = isMap(size) ? Number(size.get('h')) : NaN;
        if (round && Number.isFinite(w) && Number.isFinite(h) && Math.abs(w - h) > 1) {
          add(
            'warning',
            'circle-not-square',
            m.circleNotSquare(id, String(marker), Math.round(w), Math.round(h), Math.round(Math.min(w, h))),
            at(size),
          );
        }
      }
    }

    /**
     * **枠の線種**（`src/line.ts`。2026-09-19 から節にも効く）。
     * 敷地境界線は一点鎖線、安全領域は破線、点字の「出ていない点」は点線。
     */
    const nodeLine = item.get('line');
    if (nodeLine !== undefined && nodeLine !== null && !LINE_WORDS.has(String(nodeLine))) {
      add('warning', 'line-unknown', m.lineUnknown(id, String(nodeLine)), at(item.get('line', true)));
    }

    /**
     * **辺だけの語を、節に書いていないか**（2026-09-19）。
     *
     * `edges[].fill` の裏返し。`weight` / `curve` / `ends` / `via` / `close` は
     * **辺のもの**で、節に書いても黙って落ちる。
     * 敷地境界線を太くしようとして `weight: thick` と書き、
     * **何も言われないまま細い線が出た**（見本 214 を描いていて踏んだ）。
     */
    for (const key of ['weight', 'curve', 'ends', 'via', 'close', 'casing', 'offset', 'vertical'] as const) {
      const wrote = item.get(key, true);
      if (wrote !== undefined && wrote !== null) {
        add('warning', 'node-edge-key-ignored', m.nodeEdgeKeyIgnored(id, key), at(wrote));
      }
    }

    /**
     * **体裁は人のもの**（`pins`。仕様 §4）。
     *
     * 知らない鍵は捨てずに保つのが仕様だが、**`appearance` は別の場所で
     * 定めている語**なので「ここでは効かない」と言える。
     * 言わないと、書いた人は効いていると思ったままになる（見本 6 枚が実際そうだった）。
     */
    /**
     * **階**（`src/floor.ts`）。名前は正本が `floors` で決める。
     * 一覧に無い階は枠が描かれないので、**黙って落とさずに言う。**
     */
    const floor = item.get('floor');
    if (floor !== undefined && floor !== null) {
      const raw = doc.get('floors', true);
      const known = floorsOf(isSeq(raw) ? raw.toJSON() : undefined);
      if (known.length === 0) {
        add('warning', 'floors-missing', m.floorsMissing(id), at(item.get('floor', true)));
      } else if (!known.includes(String(floor))) {
        add('warning', 'floor-unknown', m.floorUnknown(id, String(floor)), at(item.get('floor', true)));
      }
    }

    const appearance = item.get('appearance');
    if (appearance !== undefined && appearance !== null) {
      add('warning', 'appearance-in-nodes', m.appearanceInNodes(id), at(item.get('appearance', true)));
    }

    const write = item.get('write');
    if (write !== undefined && write !== null) {
      if (!WRITE_WORDS.has(String(write))) {
        add('warning', 'write-unknown', m.writeUnknown(id, String(write)), at(item.get('write', true)));
      } else if (!placement) {
        add('warning', 'write-ignored', m.writeIgnored(id), at(item.get('write', true)));
      }
    }

    const align = item.get('align');
    if (align !== undefined && align !== null) {
      if (!ALIGN_WORDS.has(String(align))) {
        add('warning', 'align-unknown', m.alignUnknown(id, String(align)), at(item.get('align', true)));
      } else if (!placement) {
        add('warning', 'align-ignored', m.alignIgnored(id), at(item.get('align', true)));
      }
    }

    const symbol = item.get('symbol');
    if (symbol !== undefined && symbol !== null && !SYMBOL_WORDS.has(String(symbol))) {
      add('warning', 'symbol-unknown', m.symbolUnknown(id, String(symbol)), at(item.get('symbol', true)));
    }

    const hatch = item.get('hatch');
    if (hatch !== undefined && hatch !== null) {
      if (!HATCH_WORDS.has(String(hatch))) {
        add('warning', 'hatch-unknown', m.hatchUnknown(id, String(hatch)), at(item.get('hatch', true)));
      } else if (!placement) {
        add('warning', 'hatch-ignored', m.hatchIgnored(id), at(item.get('hatch', true)));
      }
    }
    checkHatchColor(doc, item, id, add, m, at);

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
    const swing = hole.get('swing');
    if (swing !== undefined && !OPENING_SWINGS.has(String(swing))) {
      add('warning', 'opening-swing-unknown', m.openingSwingUnknown(id, String(swing)), at(hole));
    }
    const hinge = hole.get('hinge');
    if (hinge !== undefined && !OPENING_HINGES.has(String(hinge))) {
      add('warning', 'opening-hinge-unknown', m.openingHingeUnknown(id, String(hinge)), at(hole));
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
    // **画像の中の点**（`{ node, at }`）は、読むときと同じ 1 語へ寄せる（`src/image.ts`）。
    const word = (raw: unknown) => pointEnd(isMap(raw) ? raw.toJSON() : null) ?? String(raw);
    const key = `${word(from)}>${word(to)}`;
    keys.add(key);
    for (const end of [word(from), word(to)]) {
      if (nodeIds.has(ownerOf(end))) continue;
      add('error', 'edge-endpoint-unknown', m.edgeEndpointUnknown(key, end), at(item));
    }
    /**
     * **自分自身への辺は、閉じた形を描くための書き方**（見本 97 の視野）。
     *
     * `via` を並べれば扇形も輪郭も引けるが、**書かないと長さ 0 の線**になり、
     * 節の真ん中に矢印の粒が出るだけになる（2026-09-14 に実際に出た）。
     */
    if (String(from) === String(to)) {
      const via = item.get('via');
      const empty = via === undefined || via === null || (isSeq(via) && via.items.length === 0);
      if (empty) add('warning', 'edge-self-open', m.edgeSelfOpen(String(from)), at(item));
    }
  }
  return keys;
}

/** 辺の端の記号（`src/ends.ts`）。知らない語は描かないので、知らせる。 */
/**
 * **路線の色**（`src/palette.ts`）。
 *
 * 色は `DESIGN.md` §7 の例外として入れた（色が記法そのものである業界のため）。
 * **例外である以上、外れ方を見張る。**
 *
 * - 鍵が `palette` に無い（色が付かない）
 * - 色が薄すぎる（**白黒に落とすと消える**）
 * - **色だけで示している**（`tag` に路線記号が出ていない）
 */
function checkColors(doc: Document, add: Add, m: Messages, at: At): void {
  const raw = doc.get('palette', true);
  const table = routePalette(isMap(raw) ? raw.toJSON() : undefined);

  /**
   * **読めない色は、値を名指しする**（2026-09-19）。
   *
   * `paletteOf` は `#rrggbb` でない値を黙って落とす（`src/palette.ts`）。
   * 落ちた鍵を使うと、これまでは「**palette にその鍵がありません**」と言っていた ——
   * 鍵はある。読めなかったのは**値**のほう。**嘘の指摘は、直す先を間違えさせる。**
   */
  const declared = new Set<string>();
  if (isMap(raw)) {
    for (const entry of raw.items) {
      const key = String(entry.key?.toString() ?? '');
      declared.add(key);
      if (table[key] !== undefined) continue;
      const value = entry.value?.toString() ?? '';
      add('warning', 'color-not-hex', m.colorNotHex(key, value), at(entry.value ?? raw));
    }
  }

  /**
   * **面だけに使う鍵には、線の下限を当てない**（2026-09-18）。
   *
   * `color-faint` は「**地に沈んで線が消える**」ことを言う検査で、
   * 下限 3:1 は `DESIGN.md` §7 の**非文字（線・枠）**の下限。
   * `fill`（面の色）は地を置き換えず、**薄く敷く**もので、
   * 淡いことがそのまま仕様 —— ここに 3:1 を当てると、
   * 販売図面の淡い色分けが、全部この警告で埋まる。
   */
  const onLines = new Set<string>();
  /**
   * **いちばん細いところの太さ**（2026-09-21）。
   *
   * 逃げ道に「線の太さだけ確かめてください」と書いておきながら、
   * **確かめたかどうかを道具が見ていなかった**（課題 19・`structure-too-thin` に続いて 3 度目）。
   * その色を使っている辺のうち、**いちばん細いもの**を覚えておいて、文に入れる。
   */
  const thinnest = new Map<string, Weight>();
  const thinner = (a: Weight, b: Weight): Weight =>
    WEIGHTS.indexOf(a) <= WEIGHTS.indexOf(b) ? a : b;
  for (const item of seqOf(doc, 'nodes')) {
    const key = item.get('color');
    if (key !== undefined && key !== null) onLines.add(String(key));
  }
  // **太さの話は辺にしか効かない。** 節の枠に `weight` は無い（節に属さない線 `paths` は辺と同じ）。
  for (const item of linesOf(doc)) {
    const key = item.get('color');
    if (key === undefined || key === null) continue;
    onLines.add(String(key));
    const weight = weightOf(item.get('weight'));
    const known = thinnest.get(String(key));
    thinnest.set(String(key), known === undefined ? weight : thinner(known, weight));
  }
  const tints = new Set<string>();
  for (const item of seqOf(doc, 'nodes')) {
    const key = item.get('fill');
    if (key !== undefined && key !== null) tints.add(String(key));
  }
  /**
   * **縁取りと模様の色も、地には乗らない**（`casing` ／ `hatch_color`）。
   * 縁は線の下、模様は面の上に描くので、地との比べ方は当たらない ——
   * 黒い縁は暗い地で沈むが、そのときも縁の内側の線は読める。
   */
  for (const kind of ['nodes', 'edges', 'paths'] as const) {
    for (const item of seqOf(doc, kind)) {
      for (const field of ['casing', 'hatch_color'] as const) {
        const key = item.get(field);
        if (key !== undefined && key !== null) tints.add(String(key));
      }
    }
  }
  /**
   * **見せ方の表（`styles`）の中の色も数える**（2026-09-28）。
   * 表の `fill` は面、`color` は線。数えないと、面に敷く淡い色を「線が薄すぎる」と誤って言う。
   */
  const looks = doc.get('styles', true);
  if (isMap(looks)) {
    for (const entry of looks.items) {
      if (!isMap(entry.value)) continue;
      const fill = entry.value.get('fill');
      const line = entry.value.get('color');
      if (fill !== undefined && fill !== null) tints.add(String(fill));
      if (line !== undefined && line !== null) onLines.add(String(line));
    }
  }
  /**
   * **符号が文字で出ているかを、先に見る**（2026-09-21）。
   *
   * 逃げ道（「色以外の見分けを添えてください」）を満たしているのに
   * 同じ文で鳴り続けていた —— 測ったら `color-faint` の 10 件は
   * **どれも実物の路線色で、どれも符号が図に出ていた。**
   */
  const asText: string[] = [];
  const titleText = doc.get('title');
  if (titleText !== undefined && titleText !== null) asText.push(String(titleText));
  for (const item of seqOf(doc, 'nodes')) {
    for (const field of ['label', 'tag', 'technology'] as const) {
      const value = item.get(field);
      if (value !== undefined && value !== null) asText.push(String(value));
    }
  }
  for (const item of linesOf(doc)) {
    const value = item.get('label');
    if (value !== undefined && value !== null) asText.push(String(value));
  }
  const allText = asText.join('\n');

  for (const [key, value] of Object.entries(table)) {
    if (tints.has(key) && !onLines.has(key)) continue;
    if (faintOn(value)) {
      const where = faintWhere(value);
      const advice = allText.includes(key) ? m.colorFaintCoded : m.colorFaintPlain;
      const weight = thinnest.get(key);
      const room =
        weight === undefined
          ? m.colorFaintNodes
          : weight === 'thick'
            ? m.colorFaintThick
            : m.colorFaintThin;
      add(
        'warning',
        'color-faint',
        m.colorFaint(key, value, where.light, where.dark, `${advice}${room}`),
        at(raw),
      );
    }
  }

  /**
   * **色だけに頼らせない。**
   *
   * 見るのは節ごとではなく**図ぜんたい**（2026-09-14 に変えた）。
   * 前は「その節の `tag` が鍵で始まっているか」を節ごとに見ていて、穴が 2 つあった。
   *
   * 1. **`tag` が無い節では一度も鳴らなかった。** 符号がどこにも無いのがいちばん危ない
   * 2. **`tag` が別の意味を持つ図で誤って鳴った。**
   *    積付図の `tag` はリーファーと危険物の印で、揚地の符号ではない
   *
   * 実物の路線図も、駅ごとに色名を書いてはいない。**凡例に 1 回書いてある。**
   * だから「その鍵が図のどこかに文字として出ているか」だけを見る。
   */
  const used = new Map<string, YAMLMap>();
  const written: string[] = [];
  const titleOf = doc.get('title');
  if (titleOf !== undefined && titleOf !== null) written.push(String(titleOf));

  const seen = (item: YAMLMap, name: string, field: 'color' | 'fill' = 'color'): void => {
    const key = item.get(field);
    if (key === undefined || key === null) return;
    if (table[String(key)] === undefined) {
      // 鍵はあるが値が読めなかったときは、palette 側で 1 度だけ言う（color-not-hex）
      if (!declared.has(String(key))) {
        add('warning', 'color-unknown', m.colorUnknown(name, String(key)), at(item.get(field, true)));
      }
      return;
    }
    if (!used.has(String(key))) used.set(String(key), item);
  };

  for (const item of seqOf(doc, 'nodes')) {
    for (const field of ['label', 'tag', 'technology'] as const) {
      const value = item.get(field);
      if (value !== undefined && value !== null) written.push(String(value));
    }
    seen(item, String(item.get('id')));
    // **面の色も同じ扱い。** 鍵に無ければ色が付かないし、
    // 色だけで示していれば、それは色を落とした瞬間に読めなくなる。
    seen(item, String(item.get('id')), 'fill');
  }
  for (const item of seqOf(doc, 'edges')) {
    const label = item.get('label');
    if (label !== undefined && label !== null) written.push(String(label));
    seen(item, `${String(item.get('from'))}>${String(item.get('to'))}`);
  }
  for (const item of seqOf(doc, 'paths')) {
    const label = item.get('label');
    if (label !== undefined && label !== null) written.push(String(label));
    seen(item, String(item.get('id') ?? ''));
  }

  for (const [key, item] of used) {
    if (written.some((text) => text.includes(key))) continue;
    /**
     * **下敷きの灰色には、凡例を求めない**（2026-09-19）。
     *
     * この検査は「色を落としたら読めなくなる」ことを防ぐためのもの。
     * **無彩色はどちらでも落ちない** —— 白黒で刷ってもその灰色のまま出るし、
     * 色覚特性でも他の人と同じに見える。
     *
     * ただし**線の色に使っているなら今までどおり言う。** 線の色は
     * 「どれがどれか」を運んでいて、読む人が色 → 意味を引く必要があるから。
     * 面（`fill`）だけに使った無彩色は、表の 1 行を淡く敷くような**強調**で、
     * それ自体は何の意味も運んでいない（見本 211 の表で要った）。
     */
    if (tints.has(key) && !onLines.has(key) && achromatic(table[key]!)) continue;
    add('warning', 'color-without-code', m.colorWithoutCode(key), at(item));
  }
}

/**
 * **見せ方の表**（`styles` ／ `nodes[].style`。2026-09-28）。
 *
 * 書けるのは面（`fill`）・線（`color`）・模様（`hatch`）だけ。置き場所や大きさを表で配ると、
 * 間取りと見せ方が混ざり、表を差し替えたときに部屋が動く。
 */
const STYLE_KEYS = new Set(['fill', 'color', 'hatch']);
function checkStyles(doc: Document, add: Add, m: Messages, at: At): void {
  const raw = doc.get('styles', true);
  const names = new Set<string>();
  if (isMap(raw)) {
    const palette = doc.get('palette', true);
    const keys = new Set(isMap(palette) ? palette.items.map((entry) => String(entry.key?.toString() ?? '')) : []);
    for (const entry of raw.items) {
      const name = String(entry.key?.toString() ?? '');
      names.add(name);
      if (!isMap(entry.value)) continue;
      for (const field of entry.value.items) {
        const key = String(field.key?.toString() ?? '');
        const value = String(field.value?.toString() ?? '');
        if (!STYLE_KEYS.has(key)) add('warning', 'style-key-unknown', m.styleKeyUnknown(name, key), at(field.key ?? entry.value));
        else if (key === 'hatch' && !HATCHES.includes(value as (typeof HATCHES)[number])) {
          add('warning', 'hatch-unknown', m.hatchUnknown(`styles.${name}`, value), at(field.value ?? entry.value));
        } else if (key !== 'hatch' && !keys.has(value)) {
          add('warning', 'color-unknown', m.colorUnknown(`styles.${name}`, value), at(field.value ?? entry.value));
        }
      }
    }
  }
  for (const item of seqOf(doc, 'nodes')) {
    const style = item.get('style');
    if (style === undefined || style === null) continue;
    if (!names.has(String(style))) {
      add('warning', 'style-unknown', m.styleUnknown(String(item.get('id')), String(style)), at(item.get('style', true)));
    }
  }
}

/**
 * **節だけの語**（辺に書いても落ちる）。
 *
 * 辺は 2 点を結ぶ線なので、置き場所も大きさも印も持たない。
 */
const NODE_ONLY_KEYS = [
  'at',
  'size',
  'marker',
  'align',
  'tag',
  'radius',
  'technology',
  'write',
  'symbol',
  'openings',
  'floor',
  'style',
] as const;

/**
 * **`palette` に書いた鍵**（値が読めるかどうかは問わない）。
 * 値が読めない鍵は `color-not-hex` が 1 度だけ言うので、ここでは重ねて言わない。
 */
function paletteKeys(doc: Document): Set<string> {
  const raw = doc.get('palette', true);
  return new Set(isMap(raw) ? raw.items.map((entry) => String(entry.key?.toString() ?? '')) : []);
}

/** 縁取り・模様の色として読めるか（`paper` か、palette の鍵）。 */
function paintKnown(doc: Document, value: unknown): boolean {
  return value === PAPER || (typeof value === 'string' && paletteKeys(doc).has(value));
}

/**
 * **模様の色**（`nodes[].hatch_color` ／ `edges[].hatch_color`）。
 *
 * 読めない色は無視して、模様は枠の色で描かれる。**模様が無ければ、色を付ける相手が無い。**
 * どちらも黙って落とすと、書いた側は「効かない」理由が分からない。
 */
function checkHatchColor(doc: Document, item: YAMLMap, name: string, add: Add, m: Messages, at: At): void {
  const value = item.get('hatch_color');
  if (value === undefined || value === null) return;
  const where = at(item.get('hatch_color', true));
  if (!paintKnown(doc, value)) {
    add('warning', 'hatch-color-unknown', m.hatchColorUnknown(name, String(value)), where);
    return;
  }
  const hatch = item.get('hatch');
  if (hatch === undefined || hatch === null || String(hatch) === 'none') {
    add('warning', 'hatch-color-ignored', m.hatchColorIgnored(name), where);
  }
}

/**
 * **線の縁取りと、並走のずらし**（`edges[].casing` ／ `edges[].offset`）。
 *
 * 縁取りの色が読めなければ縁は描かれない。ずらしが数でなければずらさない。
 */
function checkRailStyles(doc: Document, item: YAMLMap, name: string, add: Add, m: Messages, at: At): void {
  const casing = item.get('casing');
  if (casing !== undefined && casing !== null && !paintKnown(doc, casing)) {
    add('warning', 'casing-unknown', m.casingUnknown(name, String(casing)), at(item.get('casing', true)));
  }
  const offset = item.get('offset');
  if (offset !== undefined && offset !== null && (typeof offset !== 'number' || !Number.isFinite(offset))) {
    add('warning', 'offset-not-number', m.offsetNotNumber(name, String(offset)), at(item.get('offset', true)));
  }
}

/** そのノードが何階にあるか。無ければ null。 */
function floorOfNode(doc: Document, id: string): string | null {
  for (const item of seqOf(doc, 'nodes')) {
    if (String(item.get('id')) !== id) continue;
    const floor = item.get('floor');
    return floor === undefined || floor === null ? null : String(floor);
  }
  return null;
}

function checkEnds(doc: Document, add: Add, m: Messages, at: At): void {
  const placement = String(doc.get('kind') ?? '') === 'placement';
  for (const item of seqOf(doc, 'edges')) {
    const name = `${String(item.get('from'))}>${String(item.get('to'))}`;

    // **通り道と、その丸め方**（`src/curve.ts`）。
    const curve = item.get('curve');
    if (curve !== undefined && curve !== null && !CURVE_WORDS.has(String(curve))) {
      add('warning', 'curve-unknown', m.curveUnknown(name, String(curve)), at(item.get('curve', true)));
    }
    /** **階をまたぐ動線**（`src/floor.ts`）。またがないものは縦動線ではない。 */
    const vertical = item.get('vertical');
    if (vertical !== undefined && vertical !== null) {
      if (!VERTICAL_WORDS.has(String(vertical))) {
        add('warning', 'vertical-unknown', m.verticalUnknown(name, String(vertical)), at(item.get('vertical', true)));
      } else if (floorOfNode(doc, String(item.get('from'))) === floorOfNode(doc, String(item.get('to')))) {
        add('warning', 'vertical-same-floor', m.verticalSameFloor(name), at(item.get('vertical', true)));
      }
    }

    /**
     * **辺に `fill` は無い**（2026-09-19。見本 192 を描いていて踏んだ）。
     *
     * 面の色は `nodes[].fill`、線の色は `color`。
     * **閉じた輪の中を塗るのは `hatch` で、その色は `color`。**
     * 「面を塗るのだから fill だろう」と書くと、これまでは
     * **何も言われないまま、塗られない図が出ていた** ——
     * 描かれないものを名指しする、というこの道具の約束の反対。
     */
    const edgeFill = item.get('fill', true);
    if (edgeFill !== undefined && edgeFill !== null) {
      add('warning', 'edge-fill-ignored', m.edgeFillIgnored(name), at(edgeFill));
    }

    /**
     * **節だけの語を、辺に書いていないか**（2026-09-19）。
     *
     * `node-edge-key-ignored` の裏返し。辺は 2 点を結ぶ線なので、
     * 置き場所も大きさも印も持たない。書いても黙って落ちる。
     * **片側だけ塞ぐと、もう片側で同じことが起きる。**
     */
    for (const key of NODE_ONLY_KEYS) {
      const wrote = item.get(key, true);
      if (wrote !== undefined && wrote !== null) {
        add('warning', 'edge-node-key-ignored', m.edgeNodeKeyIgnored(name, key), at(wrote));
      }
    }

    const close = item.get('close');
    if (close !== undefined && close !== null) {
      if (typeof close !== 'boolean') {
        add('warning', 'close-not-boolean', m.closeNotBoolean(name), at(item.get('close', true)));
      } else if (!placement) {
        add('warning', 'close-ignored', m.closeIgnored(name), at(item.get('close', true)));
      }
    }
    /**
     * **閉じた輪の中の模様**（`edges[].hatch`）。
     *
     * 閉じていない辺には面が無いので、**書いても塗りようがない。**
     * 黙って捨てると、書いた側は「効かない」理由が分からない。
     */
    const edgeHatch = item.get('hatch');
    if (edgeHatch !== undefined && edgeHatch !== null && String(edgeHatch) !== 'none') {
      if (!HATCHES.includes(String(edgeHatch) as (typeof HATCHES)[number])) {
        add('warning', 'hatch-unknown', m.hatchUnknown(name, String(edgeHatch)), at(item.get('hatch', true)));
      } else if (item.get('close') !== true) {
        add('warning', 'edge-hatch-ignored', m.edgeHatchIgnored(name), at(item.get('hatch', true)));
      }
    }
    checkHatchColor(doc, item, name, add, m, at);
    checkRailStyles(doc, item, name, add, m, at);
    const via = item.get('via', true);
    if (via !== undefined && via !== null) {
      if (!placement) {
        // 構成図の線の通り道は機械が決める。**書いても効かないことを言う。**
        add('warning', 'via-ignored', m.viaIgnored(name), at(via));
      } else if (!isSeq(via) || via.items.length === 0 || viaOf(via.toJSON()).length !== via.items.length) {
        add('warning', 'via-invalid', m.viaInvalid(name), at(via));
      }
    }
    const line = item.get('line');
    if (line !== undefined && line !== null && !LINE_WORDS.has(String(line))) {
      add('warning', 'line-unknown', m.lineUnknown(name, String(line)), at(item.get('line', true)));
    }
    const weight = item.get('weight');
    if (weight !== undefined && weight !== null && !WEIGHT_WORDS.has(String(weight))) {
      add('warning', 'weight-unknown', m.weightUnknown(name, String(weight)), at(item.get('weight', true)));
    }
    const ends = item.get('ends', true);
    if (ends === undefined || ends === null || !isMap(ends)) continue;
    for (const side of ['from', 'to']) {
      const value = ends.get(side);
      if (value === undefined || value === null) continue;
      if (!END_WORDS.has(String(value))) {
        add('warning', 'ends-unknown', m.endsUnknown(name, String(value)), at(ends));
      }
    }
  }
}

/**
 * **部品と、置き方**（`parts` / `place`。`src/parts.ts`）。
 *
 * 置けないもの（部品が無い・名前が無い・位置が読めない・格子が読めない）は描かれないので、黙って落とさずに言う。
 * 中の節・線・寸法の書き方は、ここでは見ない —— 展開した写しを、いつもの検査が見る。
 */
function checkParts(doc: Document, expansion: Expansion, add: Add, m: Messages, at: At): void {
  const rawParts = doc.get('parts', true);
  const rawPlace = doc.get('place', true);
  const hasParts = rawParts !== undefined && rawParts !== null;
  const hasPlace = rawPlace !== undefined && rawPlace !== null;
  if (!hasParts && !hasPlace) return;
  if (String(doc.get('kind') ?? '') !== 'placement') {
    add('warning', 'parts-ignored', m.partsIgnored, at(hasParts ? rawParts : rawPlace));
    return;
  }
  let parts: YAMLMap | null = null;
  if (hasParts && !isMap(rawParts)) add('warning', 'parts-not-map', m.partsNotMap, at(rawParts));
  if (isMap(rawParts)) {
    parts = rawParts;
    for (const pair of rawParts.items) checkPart(String(isScalar(pair.key) ? pair.key.value : pair.key), pair.value, add, m, at);
  }
  if (!hasPlace) return;
  if (!isSeq(rawPlace)) {
    add('warning', 'place-not-list', m.placeNotList, at(rawPlace));
    return;
  }
  const seen = new Set<string>();
  rawPlace.items.forEach((item, index) => {
    const as = isMap(item) ? nameOf(item.get('as')) : null;
    const label = as ?? m.placeNth(index + 1);
    if (!isMap(item)) {
      add('warning', 'place-part-unknown', m.placePartUnknown(label, ''), at(item));
      return;
    }
    for (const pair of item.items) {
      const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
      if (!(PLACE_KEYS as readonly string[]).includes(key)) add('warning', 'place-key-unknown', m.placeKeyUnknown(label, key), at(pair.key));
    }
    const part = parts?.get(item.get('part'), true);
    if (!isMap(part)) add('warning', 'place-part-unknown', m.placePartUnknown(label, String(item.get('part') ?? '')), at(item));
    if (as === null) add('warning', 'place-as-invalid', m.placeAsInvalid(index + 1, String(item.get('as') ?? '')), at(item));
    else if (seen.has(as)) add('warning', 'place-as-duplicated', m.placeAsDuplicated(as), at(item));
    if (as !== null) seen.add(as);
    const where = item.get('at', true);
    if (placePointOf(isMap(where) ? where.toJSON() : null) === null) add('warning', 'place-at-invalid', m.placeAtInvalid(label), at(where ?? item));
    const grid = item.get('grid', true);
    if (grid !== undefined && grid !== null && gridOf(isMap(grid) ? grid.toJSON() : null) === null) {
      add('warning', 'place-grid-invalid', m.placeGridInvalid(label), at(grid));
    }
    const rotate = rotationOf(item.get('rotate'));
    if (rotate === null) add('warning', 'place-rotate-invalid', m.placeRotateInvalid(label, String(item.get('rotate'))), at(item.get('rotate', true)));
    const members = membersOf(part);
    if (rotate !== null && rotate !== 0) {
      const kept = members.flatMap((member) => rotateKept(member.item, rotate).map((key) => `${member.id}.${key}`));
      if (kept.length > 0) add('warning', 'place-rotate-partial', m.placeRotatePartial(label, kept.join(' / ')), at(item.get('rotate', true)));
    }
    checkPlaceSet(item.get('set', true), new Set(members.map((member) => member.id)), label, add, m, at);
  });
  for (const collision of expansion.collisions) {
    add('warning', 'place-id-collision', m.placeIdCollision(collision.id), at(collision.item));
  }
  checkInstancePins(doc, expansion, add, m, at);
}

/** 部品 1 つ。**辺と、部品の中の部品は持たない**（この版では）。 */
function checkPart(name: string, part: unknown, add: Add, m: Messages, at: At): void {
  if (!isMap(part)) {
    add('warning', 'part-empty', m.partEmpty(name), at(part));
    return;
  }
  for (const pair of part.items) {
    const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
    if ((PART_KEYS as readonly string[]).includes(key)) continue;
    if (key === 'place' || key === 'parts') add('warning', 'part-nested', m.partNested(name), at(pair.key));
    else add('warning', 'part-key-unknown', m.partKeyUnknown(name, key), at(pair.key));
  }
  const ids = new Set<string>();
  for (const kind of PART_KEYS) {
    const list = part.get(kind, true);
    if (!isSeq(list)) continue;
    list.items.forEach((item, index) => {
      const raw = isMap(item) ? item.get('id') : undefined;
      const id = nameOf(raw);
      if (id === null) {
        add('warning', 'part-member-id-invalid', m.partMemberIdInvalid(name, kind, index + 1, raw == null ? '' : String(raw)), at(item));
        return;
      }
      if (ids.has(id)) add('warning', 'part-member-id-duplicated', m.partMemberIdDuplicated(name, id), at(item));
      ids.add(id);
    });
  }
  if (ids.size === 0) add('warning', 'part-empty', m.partEmpty(name), at(part));
}

/** 回しても向きが変わらない語（`openings` ほか。90 度では三角の向きも返せない）。 */
function rotateKept(item: YAMLMap, rotate: number): string[] {
  const kept: string[] = ROTATE_KEPT_KEYS.filter((key) => item.get(key) !== undefined && item.get(key) !== null);
  const marker = item.get('marker');
  if (rotate !== 180 && (marker === 'triangle' || marker === 'triangle-down')) kept.push('marker');
  return kept;
}

/** `set`。**中に無い名前・形の語は当てない。** */
function checkPlaceSet(set: unknown, members: ReadonlySet<string>, label: string, add: Add, m: Messages, at: At): void {
  if (set === undefined || set === null) return;
  if (!isMap(set)) {
    add('warning', 'place-set-invalid', m.placeSetInvalid(label), at(set));
    return;
  }
  for (const pair of set.items) {
    const id = String(isScalar(pair.key) ? pair.key.value : pair.key);
    if (!members.has(id)) {
      add('warning', 'place-set-member-unknown', m.placeSetMemberUnknown(label, id), at(pair.key));
      continue;
    }
    if (!isMap(pair.value)) {
      add('warning', 'place-set-invalid', m.placeSetInvalid(label), at(pair.value ?? pair.key));
      continue;
    }
    for (const field of pair.value.items) {
      const key = String(isScalar(field.key) ? field.key.value : field.key);
      if ((FIXED_KEYS as readonly string[]).includes(key)) add('warning', 'place-set-key-fixed', m.placeSetKeyFixed(label, id, key), at(field.key));
    }
  }
}

/** **置いたもの全体の pin**（`pins.<as>`）。効くのは `position` だけ。 */
function checkInstancePins(doc: Document, expansion: Expansion, add: Add, m: Messages, at: At): void {
  const pins = doc.get('pins', true);
  if (!isMap(pins)) return;
  const names = new Set([...expansion.instances.map((instance) => instance.name), ...expansion.grids]);
  for (const pair of pins.items) {
    const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
    if (!names.has(key) || !isMap(pair.value)) continue;
    for (const field of pair.value.items) {
      const name = String(isScalar(field.key) ? field.key.value : field.key);
      if (name !== 'position' && name !== 'locked') add('warning', 'pin-instance-key-ignored', m.pinInstanceKeyIgnored(key, name), at(field.key));
    }
  }
}

/**
 * **節に属さない線と形**（`paths`。`src/paths.ts`）。
 *
 * 描けないもの（id が無い・形が読めない）は描かれないので、**黙って落とさずに言う。**
 * 線の語（線種・太さ・端・丸め方・模様・色）は辺と同じ印で見る —— 語が同じなら、間違い方も同じ。
 * 返すのは id の集合（`pins` の鍵として迷子にしないため）。
 */
function checkPaths(doc: Document, nodeIds: ReadonlySet<string>, add: Add, m: Messages, at: At): Set<string> {
  const ids = new Set<string>();
  const raw = doc.get('paths', true);
  if (raw === undefined || raw === null) return ids;
  if (!isSeq(raw)) {
    add('warning', 'paths-not-list', m.pathsNotList, at(raw));
    return ids;
  }
  if (String(doc.get('kind') ?? '') !== 'placement') {
    add('warning', 'paths-ignored', m.pathsIgnored, at(raw));
  }
  let position = 0;
  for (const item of raw.items) {
    position += 1;
    const rawId = isMap(item) ? item.get('id') : undefined;
    if (!isMap(item) || rawId === undefined || rawId === null || String(rawId) === '') {
      add('warning', 'path-id-missing', m.pathIdMissing(position), at(item));
      continue;
    }
    const id = String(rawId);
    if (ids.has(id)) add('warning', 'path-id-duplicated', m.pathIdDuplicated(id), at(item));
    else if (nodeIds.has(id)) add('warning', 'path-id-shared-with-node', m.pathIdSharedWithNode(id), at(item));
    ids.add(id);
    checkPathShape(item, id, add, m, at);
    checkPathWords(doc, item, id, add, m, at);
  }
  return ids;
}

/** 形（`points` か `arc` のどちらか 1 つ）と、閉じ方（`close`）。 */
function checkPathShape(item: YAMLMap, id: string, add: Add, m: Messages, at: At): void {
  const points = item.get('points', true);
  const arc = item.get('arc', true);
  const hasPoints = points !== undefined && points !== null;
  const hasArc = arc !== undefined && arc !== null;
  if (!hasPoints && !hasArc) add('warning', 'path-shape-missing', m.pathShapeMissing(id), at(item));
  if (hasPoints && hasArc) add('warning', 'path-shape-both', m.pathShapeBoth(id), at(arc));
  if (hasPoints) {
    const read = pointsOf(isSeq(points) ? points.toJSON() : null);
    if (read === null) add('warning', 'path-points-invalid', m.pathPointsInvalid(id), at(points));
    else if (read.length < 2) add('warning', 'path-points-short', m.pathPointsShort(id), at(points));
  }
  if (hasArc && arcOf(isMap(arc) ? arc.toJSON() : null) === null) {
    add('warning', 'path-arc-invalid', m.pathArcInvalid(id), at(arc));
  }
  const close = item.get('close');
  const closed = close === true || (close === 'sector' && hasArc);
  if (close !== undefined && close !== null && typeof close !== 'boolean' && !closed) {
    add('warning', 'path-close-invalid', m.pathCloseInvalid(id), at(item.get('close', true)));
  }
  const hatch = item.get('hatch');
  if (hatch !== undefined && hatch !== null && String(hatch) !== 'none') {
    if (!HATCHES.includes(String(hatch) as (typeof HATCHES)[number])) {
      add('warning', 'hatch-unknown', m.hatchUnknown(id, String(hatch)), at(item.get('hatch', true)));
    } else if (!closed) {
      add('warning', 'path-hatch-ignored', m.pathHatchIgnored(id), at(item.get('hatch', true)));
    }
  }
}

/** **線に書いても効かない語**（辺の端・通り道、節だけの語）。 */
const PATH_IGNORED_KEYS = ['from', 'to', 'via', 'offset', 'vertical', 'callout', 'fill', ...NODE_ONLY_KEYS] as const;

/** 線の語。**辺と同じ印で見る**（`checkEnds`）。 */
function checkPathWords(doc: Document, item: YAMLMap, id: string, add: Add, m: Messages, at: At): void {
  for (const key of PATH_IGNORED_KEYS) {
    const wrote = item.get(key, true);
    if (wrote !== undefined && wrote !== null) add('warning', 'path-key-ignored', m.pathKeyIgnored(id, key), at(wrote));
  }
  const curve = item.get('curve');
  if (curve !== undefined && curve !== null && !CURVE_WORDS.has(String(curve))) {
    add('warning', 'curve-unknown', m.curveUnknown(id, String(curve)), at(item.get('curve', true)));
  }
  const line = item.get('line');
  if (line !== undefined && line !== null && !LINE_WORDS.has(String(line))) {
    add('warning', 'line-unknown', m.lineUnknown(id, String(line)), at(item.get('line', true)));
  }
  const weight = item.get('weight');
  if (weight !== undefined && weight !== null && !WEIGHT_WORDS.has(String(weight))) {
    add('warning', 'weight-unknown', m.weightUnknown(id, String(weight)), at(item.get('weight', true)));
  }
  const casing = item.get('casing');
  if (casing !== undefined && casing !== null && !paintKnown(doc, casing)) {
    add('warning', 'casing-unknown', m.casingUnknown(id, String(casing)), at(item.get('casing', true)));
  }
  checkHatchColor(doc, item, id, add, m, at);
  const ends = item.get('ends', true);
  if (!isMap(ends)) return;
  for (const side of ['from', 'to']) {
    const value = ends.get(side);
    if (value !== undefined && value !== null && !END_WORDS.has(String(value))) {
      add('warning', 'ends-unknown', m.endsUnknown(id, String(value)), at(ends));
    }
  }
}

/**
 * **図ぜんたいの単位**（`scale.unit`。`src/units.ts`）。`mm` / `m` / `um` で、**ミリの縮尺にだけ付く。**
 * 読めない単位は使わず、縮尺が決める（黙って捨てずに言う）。
 */
function checkScaleUnit(scale: unknown, add: Add, m: Messages, at: At): void {
  if (!isMap(scale)) return;
  const unit = scale.get('unit');
  if (unit === undefined || unit === null) return;
  const where = at(scale.get('unit', true));
  if (!UNITS.includes(String(unit) as (typeof UNITS)[number])) {
    add('warning', 'scale-unit-invalid', m.scaleUnitInvalid(String(unit)), where);
  } else if (!isPositive(scale.get('mm'))) {
    add('warning', 'scale-unit-invalid', m.scaleUnitOnInch(String(unit)), where);
  }
}

/** 寸法に書ける語。**これ以外は効かない**（`dim-key-ignored`）。 */
const DIM_KEYS = new Set(['id', 'from', 'to', 'along', 'offset', 'text', 'exact', 'ends']);

/**
 * **2 点を指して引く寸法**（`dims`。`src/dims.ts`）。
 *
 * 描けないもの（id が無い・端が読めない・測れない）は描かれないので、**黙って落とさずに言う。**
 * **人の数値が図と 1 % 以上違えば言う**（`dim-text-differs`）—— 図形を直しても数値が追ってこない、
 * を見つけるために入れた。測るのは正本の箱（人の `pins` を当てたもの）で、縮尺はその点の図の縮尺。
 * 返すのは id の集合（`pins` の鍵として迷子にしないため）。
 */
function checkDims(
  doc: Document,
  nodeIds: ReadonlySet<string>,
  pathIds: ReadonlySet<string>,
  add: Add,
  m: Messages,
  at: At,
): Set<string> {
  const ids = new Set<string>();
  const raw = doc.get('dims', true);
  if (raw === undefined || raw === null) return ids;
  if (!isSeq(raw)) {
    add('warning', 'dims-not-list', m.dimsNotList, at(raw));
    return ids;
  }
  if (String(doc.get('kind') ?? '') !== 'placement') {
    add('warning', 'dims-ignored', m.dimsIgnored, at(raw));
  }
  const boxes = sourceBoxes(doc);
  const all = doc.toJS() as { scale?: unknown; views?: unknown };
  const views = viewsOf(all.views);
  const sheet = scaleOf(all.scale);
  let unscaled = 0;
  let position = 0;
  for (const item of raw.items) {
    position += 1;
    const rawId = isMap(item) ? item.get('id') : undefined;
    if (!isMap(item) || rawId === undefined || rawId === null || String(rawId) === '') {
      add('warning', 'dim-id-missing', m.dimIdMissing(position), at(item));
      continue;
    }
    const id = String(rawId);
    if (ids.has(id)) add('warning', 'dim-id-duplicated', m.dimIdDuplicated(id), at(item));
    else if (nodeIds.has(id) || pathIds.has(id)) add('warning', 'dim-id-shared', m.dimIdShared(id), at(item));
    ids.add(id);
    checkDimWords(item, id, add, m, at);
    const ends = checkDimEnds(item, id, nodeIds, add, m, at);
    if (ends === null) continue;
    const dim = { id, ...ends, along: dimAlong(item), offset: 0, text: dimText(item), exact: item.get('exact') !== false, ends: 'arrow' as const };
    const measured = measureDim(dim, (node) => boxes.get(node) ?? null);
    if (measured === 'side-mismatch') {
      add('warning', 'dim-side-mismatch', m.dimSideMismatch(id), at(item));
      continue;
    }
    if (measured === 'zero-length') {
      add('warning', 'dim-zero-length', m.dimZeroLength(id), at(item));
      continue;
    }
    // 知らない節は `checkDimEnds` が言った。箱の大きさが読めない節は、ここでは測らない。
    if (measured === 'node-unknown') continue;
    const middle = { x: (measured.from.x + measured.to.x) / 2, y: (measured.from.y + measured.to.y) / 2 };
    const ruler = rulerAt(middle, views, sheet);
    if (ruler === null) {
      unscaled += 1;
      continue;
    }
    if (dim.exact && dim.text !== null && !dim.text.includes('{}') && textDiffers(dim.text, measured.length, ruler)) {
      const value = dimLabel(null, dimValue(measured.length, ruler)) ?? '';
      add('warning', 'dim-text-differs', m.dimTextDiffers(id, dim.text, value), at(item.get('text', true)));
    }
  }
  if (unscaled > 0) add('warning', 'dim-no-scale', m.dimNoScale(unscaled), at(raw));
  return ids;
}

/** 端（`from` / `to`）。**どちらも読めて、知っている節を指していれば**読んだものを返す。 */
function checkDimEnds(
  item: YAMLMap,
  id: string,
  nodeIds: ReadonlySet<string>,
  add: Add,
  m: Messages,
  at: At,
): { from: NonNullable<ReturnType<typeof dimPointOf>>; to: NonNullable<ReturnType<typeof dimPointOf>> } | null {
  const read: ReturnType<typeof dimPointOf>[] = [];
  for (const key of ['from', 'to'] as const) {
    const node = item.get(key, true);
    const end = dimPointOf(isMap(node) || isSeq(node) ? node.toJSON() : undefined);
    read.push(end);
    if (end === null) {
      add('warning', 'dim-end-invalid', m.dimEndInvalid(id, key), at(node) ?? at(item));
    } else if ('node' in end && !nodeIds.has(end.node)) {
      add('warning', 'dim-node-unknown', m.dimNodeUnknown(id, end.node), at(node));
      read[read.length - 1] = null;
    }
  }
  const [from, to] = read;
  return from == null || to == null ? null : { from, to };
}

/** 寸法の語（`along` / `offset` / `ends` / `exact`）と、寸法に効かない語。 */
function checkDimWords(item: YAMLMap, id: string, add: Add, m: Messages, at: At): void {
  for (const pair of item.items) {
    const key = String(isScalar(pair.key) ? pair.key.value : pair.key);
    if (!DIM_KEYS.has(key)) add('warning', 'dim-key-ignored', m.dimKeyIgnored(id, key), at(pair.value) ?? at(item));
  }
  const along = item.get('along');
  if (along !== undefined && along !== null && along !== 'x' && along !== 'y') {
    add('warning', 'dim-along-invalid', m.dimAlongInvalid(id, String(along)), at(item.get('along', true)));
  }
  const offset = item.get('offset');
  if (offset !== undefined && offset !== null && !isNumber(offset)) {
    add('warning', 'dim-offset-invalid', m.dimOffsetInvalid(id, String(offset)), at(item.get('offset', true)));
  }
  const ends = item.get('ends');
  if (ends !== undefined && ends !== null && !DIM_ENDS.includes(String(ends) as (typeof DIM_ENDS)[number])) {
    add('warning', 'dim-ends-unknown', m.dimEndsUnknown(id, String(ends)), at(item.get('ends', true)));
  }
  const exact = item.get('exact');
  if (exact !== undefined && exact !== null && typeof exact !== 'boolean') {
    add('warning', 'dim-exact-invalid', m.dimExactInvalid(id, String(exact)), at(item.get('exact', true)));
  }
  // **略図に `{}`**（書かなければ `{}` と同じ）。略図から測った数を、実寸として出すことになる。
  const text = dimText(item);
  if (exact === false && (text === null || text.includes('{}'))) {
    add('warning', 'dim-sketch-value', m.dimSketchValue(id), at(item.get('exact', true)));
  }
}

function dimAlong(item: YAMLMap): 'x' | 'y' | null {
  const along = item.get('along');
  return along === 'x' || along === 'y' ? along : null;
}

function dimText(item: YAMLMap): string | null {
  const text = item.get('text');
  return typeof text === 'string' || typeof text === 'number' ? String(text) : null;
}

/**
 * **正本の箱**（配置図の `at` ／ `size`。人の `pins.position` ／ `size` が勝つ）。
 * 寸法を測るためだけに使う。どちらかが読めない節は入れない（測れない）。
 */
function sourceBoxes(doc: Document): Map<string, Rect> {
  const pins = (doc.toJS() as { pins?: Record<string, { position?: unknown; size?: unknown }> }).pins ?? {};
  const out = new Map<string, Rect>();
  for (const item of seqOf(doc, 'nodes')) {
    const id = String(item.get('id') ?? '');
    const node = item.toJSON() as { at?: unknown; size?: unknown };
    const pin = pins[id] ?? {};
    const point = (pin.position ?? node.at) as { x?: unknown; y?: unknown } | undefined;
    const size = (pin.size ?? node.size) as { w?: unknown; h?: unknown } | undefined;
    if (!isNumber(point?.x) || !isNumber(point?.y) || !isNumber(size?.w) || !isNumber(size?.h)) continue;
    out.set(id, { x: point!.x as number, y: point!.y as number, w: size!.w as number, h: size!.h as number });
  }
  return out;
}

function checkPins(
  doc: Document,
  nodeIds: Set<string>,
  edgeKeys: Set<string>,
  add: Add,
  m: Messages,
  at: At,
  pathIds: ReadonlySet<string> = new Set(),
  dimIds: ReadonlySet<string> = new Set(),
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

    /**
     * **節に属さない線**（`paths`）の手直しは、線の id を鍵にする（`pins.<id>.points`）。
     * 読めない点は使われないので、黙って落とさずに言う。
     */
    if (pathIds.has(key)) {
      const points = target?.get('points', true);
      if (points !== undefined && points !== null) {
        const read = pointsOf(isSeq(points) ? points.toJSON() : null);
        if (read === null || read.length < 2) add('warning', 'pin-points-invalid', m.pinPointsInvalid(key), at(points));
      }
      continue;
    }
    /** **寸法**（`dims`）の手直しは、寸法線の位置（`pins.<id>.offset`）。数でなければ使わない。 */
    if (dimIds.has(key)) {
      const offset = target?.get('offset', true);
      if (offset !== undefined && offset !== null && !isNumber(target?.get('offset'))) {
        add('warning', 'pin-offset-invalid', m.pinOffsetInvalid(key), at(offset));
      }
      continue;
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
  const back = doc.toString(TO_STRING_OPTIONS);
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
