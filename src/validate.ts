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
import { LineCounter, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import type { Document, Node, YAMLMap } from 'yaml';

import { DIRECTIONS as DIRECTION_WORDS } from './direction.ts';
import { KINDS as KIND_WORDS } from './kind.ts';
import { MARKS, NORTHS } from './grid.ts';
import { ENDS } from './ends.ts';
import { LINES } from './line.ts';
import { CURVES, viaOf } from './curve.ts';
import { VERTICALS, floorsOf } from './floor.ts';
import { achromatic, faintOn, faintWhere, paletteOf as routePalette } from './palette.ts';
import { WEIGHTS, weightOf, type Weight } from './weight.ts';
import { HATCHES } from './hatch.ts';
import { SYMBOLS } from './symbol.ts';
import { MARKERS } from './marker.ts';
import { ALIGNS } from './align.ts';
import { WRITES } from './write.ts';
import { TO_STRING_OPTIONS } from './format.ts';
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
  checkViews(doc, add, m, at);
  checkConstruction(doc, add, m, at);
  checkSharedIds(doc, add, m, at);
  checkLabelMarkdown(doc, add, m, at);
  checkNumberText(doc, add, m, at);
  checkEnds(doc, add, m, at);
  checkColors(doc, add, m, at);
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
    // **作図には節が無い**（D36）。あるのは円と弧だけ。
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
  for (const part of ['nodes', 'edges'] as const) {
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
 * **作図**（`kind: construction`。D36）。
 *
 * ## いちばん大事な検査 —— **位置の pin を黙殺しない**
 *
 * この図では位置を手順が決めるので、`pins.position` は効かない。
 * **黙って消えるのが唯一の本当の事故**（姉妹側オーナーの条件。2026-09-15）——
 * 人が箱を動かして、次の生成で何も言わずに戻るのは、
 * 利用者から見ると **D5 が壊れたのと区別が付かない。**
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
 * **1 枚に複数の図**（`views`。D35）。
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
    for (const key of ['weight', 'curve', 'ends', 'via', 'close'] as const) {
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
  // **太さの話は辺にしか効かない。** 節の枠に `weight` は無い。
  for (const item of seqOf(doc, 'edges')) {
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
  for (const item of seqOf(doc, 'edges')) {
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
] as const;

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
