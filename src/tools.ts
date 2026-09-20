/**
 * エージェントへ開く口の中身（D13 / D18）。
 *
 * **MCP の話をここに持ち込まない。** ここは純粋な処理で、
 * MCP サーバ（`src/mcp.ts`）はこれを呼ぶだけ。
 * そうしておくと、**MCP を立てずにテストできる**（ベースルール §9）。
 *
 * ## 開けているもの / 開けていないもの
 *
 * | | |
 * |---|---|
 * | ○ 読む・検査する・測る・書き出す | 副作用が無い |
 * | ○ **新しい図を作る**（`create`） | **既にあれば失敗する。** 上書きの経路にしない |
 * | ○ **提案を入れる**（`propose`） | `pins` を読まず、競合は適用せずに返す |
 * | ✗ 競合の決着 | 開けた瞬間、**AI が自分の提案を自分で承認できる** |
 * | ✗ `pins` の書き換え | 人の指定は人のもの（仕様 §3.4 の規則 1） |
 * | ✗ 既存ファイルの無条件な上書き | `propose` を通せば人の指定は壊れない |
 *
 * ## エージェントが自分で直せるだけの情報を返す
 *
 * 返さないと、エージェントは当て推量で書く。
 * 実際、交差が 143 本ある図を出しても気づけなかった（Issue 004）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { toDrawio } from './drawio.ts';
import { placeEdgeLabels } from './edge-labels.ts';
import { getPins, parse } from './format.ts';
import { crossingEdges, crossings, edgesUnderBoxes, groupEscapes, layout, overlaps, straddles } from './layout.ts';
import { messages } from './messages.ts';
import { PASS_LINE, measure } from './measure.ts';
import { merge } from './merge.ts';
import type { Conflict } from './merge.ts';
import { toMermaid } from './mermaid.ts';
import { KINDS, kindOf, measureOf } from './kind.ts';
import { DIRECTIONS } from './direction.ts';
import { NORTHS } from './grid.ts';
import { ENDS } from './ends.ts';
import { LINES } from './line.ts';
import { SYMBOLS } from './symbol.ts';
import { WEIGHTS } from './weight.ts';
import { HATCHES } from './hatch.ts';
import { WRITES } from './write.ts';
import { CURVES } from './curve.ts';
import { VERTICALS } from './floor.ts';
import { MARKERS } from './marker.ts';
import { adriftNames, crowdedNames, extentOf, hiddenTags, overlappingText, planNames } from './names.ts';
import { OPENINGS, SIDES } from './openings.ts';
import type { Kind } from './kind.ts';
import { projection, smallestTextOf, PRINT_FLOOR, PROJECTION_FLOOR, SMALLEST_TEXT } from './projection.ts';
import { render } from './render.ts';
import { timelapse } from './timelapse.ts';
import type { Timelapse, TimelapseOptions } from './timelapse.ts';
import { reviewOf } from './review.ts';
import { APPEARANCE } from './tokens.ts';
import type { Intent, Theme } from './tokens.ts';
import { hasError, validate } from './validate.ts';
import type { Finding } from './validate.ts';

/** 図の正本の付け方（D13 §4）。**この名前でないとマージドライバが効かない。** */
const SUFFIX = '.zumen.yaml';

export interface Io {
  read: (path: string) => string;
  write: (path: string, text: string) => void;
  exists: (path: string) => boolean;
  list: (dir: string) => string[];
}

/** 既定は本物のファイル。テストからは差し替える。 */
export const realIo: Io = {
  read: (path) => readFileSync(path, 'utf8'),
  write: (path, text) => writeFileSync(path, text),
  exists: (path) => existsSync(path),
  list: (dir) => walk(dir, dir),
};

function walk(dir: string, root: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path, root));
    else if (name.endsWith(SUFFIX)) out.push(relative(root, path));
  }
  return out;
}

// --- 形式を教える ----------------------------------------------------------

/**
 * 形式の仕様。**これが無いとゼロから描けない。**
 *
 * エージェントに推測で書かせない。書ける語も一緒に返す。
 */
export function spec(): {
  version: number;
  suffix: string;
  shape: string;
  nodeTypes: string[];
  /** 図の種類（`src/kind.ts`）。**配置図に入る口。** */
  kinds: string[];
  /** 向き（`src/direction.ts`）。 */
  directions: string[];
  /** 建具の種類と、付く辺（`src/openings.ts`）。**配置図でだけ効く。** */
  openings: string[];
  sides: string[];
  /** 配置図での印（`src/marker.ts`）。**形の名前だけ。意味の語は無い。** */
  markers: string[];
  /** 材料と区域の模様（`src/hatch.ts`）。**模様の名前だけ。材料の語は無い。** */
  hatches: string[];
  /** 文字の組み方（`src/write.ts`）。**縦組みは、回すのとは別。** */
  writes: string[];
  /** 辺の丸め方（`src/curve.ts`）。**形の名前だけ。意味の語は無い。** */
  curves: string[];
  /** 階をまたぐ動線（`src/floor.ts`）。**JIS Z 8210 の語。** */
  verticals: string[];
  /** 辺の端の記号（`src/ends.ts`）。**形の名前だけ。意味の語は無い。** */
  ends: string[];
  /** 辺の線種（`src/line.ts`）。 */
  lines: string[];
  /** 電気・電子の図記号（`src/symbol.ts`）。**IEC／JIS の名前。** */
  symbols: string[];
  /** 辺の太さ（`src/weight.ts`）。 */
  weights: string[];
  /** 方位（`src/grid.ts`）。 */
  norths: string[];
  /** **書き出せる形**。`png` は絵そのもの（Chrome があるときだけ）。 */
  exports: string[];
  appearances: string[];
  rules: string[];
} {
  const m = messages().tools;
  return {
    version: 1,
    suffix: SUFFIX,
    shape: m.shape,
    nodeTypes: [
      'server',
      'database',
      'storage',
      'cache',
      'queue',
      'internet',
      'load-balancer',
      'container',
      'cluster',
      'network',
      'generic',
    ],
    // **語の一覧は 1 か所から取る**（写すとズレる）。
    // ここに載っていないキーは、エージェントにとって存在しないのと同じ。
    kinds: [...KINDS],
    directions: [...DIRECTIONS],
    openings: [...OPENINGS],
    sides: [...SIDES],
    markers: [...MARKERS],
    hatches: [...HATCHES],
    writes: [...WRITES],
    curves: [...CURVES],
    verticals: [...VERTICALS],
    ends: [...ENDS],
    lines: [...LINES],
    symbols: [...SYMBOLS],
    weights: [...WEIGHTS],
    norths: [...NORTHS],
    exports: ['svg', 'png', 'mermaid', 'drawio'],
    appearances: Object.keys(APPEARANCE),
    rules: m.rules,
  };
}

// --- 読む ------------------------------------------------------------------

export function list(dir: string, io: Io = realIo): string[] {
  return io.list(dir);
}

export function read(path: string, io: Io = realIo): string {
  return io.read(path);
}

// --- 検査する・測る --------------------------------------------------------

export interface Inspection {
  readable: boolean;
  findings: Finding[];
  nodes: number;
  edges: number;
  groups: number;
  /** 線どうしの交差。**多いと読めない。** */
  crossings: number;
  /** **交わっている辺の組。** 数だけでは、どれとどれかを探せない（2026-09-19）。 */
  crossingEdges: [string, string][];
  /** 箱どうしの重なり。**入れ子も数える。** */
  overlaps: [string, string][];
  /**
   * **はみ出して重なっている組**（どちらも相手を含んでいない）。合否ではなく観測値。
   *
   * `overlaps` は入れ子も数えるので、配置図では鳴りっぱなしになる。
   * **直すところがあるのは、こちら** —— 物どうしが床の同じ場所を取っている状態。
   * ただし**わざと重ねる図もある**（伏図の柱、断面の水抜管、盤の上の石）。
   */
  straddles: [string, string][];
  /** 囲みからはみ出した要素。 */
  groupEscapes: string[];
  /** **人が置いたものどうしが重なっている組。** 動かしていない。 */
  collisions: [string, string][];
  width: number;
  height: number;
  /**
   * 図の種類（Issue #4）。**物差しの向きが、ここで変わる。**
   */
  kind: Kind;
  /**
   * **置き場所が正本に書いてあるか**（配置図）。
   *
   * 真なら、機械は並べ直さない。**`nodes[].at` に書くこと。**
   * `pins` は人のものなので、そこへは書かない（D5）。
   */
  positionsInSource: boolean;
  /** 「9 割」（D3）。合格線は `passLine`。 */
  autonomy: number | null;
  layoutAutonomy: number | null;
  passLine: number;
  /** **読みにくさの目安。** 交差がエッジ数を超えたら、目で追えない（Issue 004）。 */
  tooTangled: boolean;
  /**
   * **書いたのに絵に出ないラベルの、辺の id。**
   *
   * 重なるラベルは出さない（Issue #3 の 3）。それは正しいが、
   * **黙って消すのは別の壊れ方**になる。書いた側が気づけない。
   * ここへ返せば、**描いた AI が自分で短くできる。**
   */
  hiddenLabels: string[];
  /**
   * **混んでいる名前**（配置図だけ）。
   *
   * 箱に入りきらない名前は外へ出す。**外も空いていないことがある**
   * —— 上下とも別の部屋なら、どちらへ出しても重なる。
   *
   * 消しはしない（**部屋の名前が消えるのは、重なるより悪い**）。
   * 代わりにここへ返す。**箱を大きくするか、文字を短くすれば直る。**
   */
  crowdedNames: string[];
  /** **階の一覧**（`src/floor.ts`）。下から上へ。書かなければ空。 */
  floors: string[];
  /**
   * **広い箱から出ていった名前**（配置図だけ）。
   *
   * 小さい印では外へ出すのが正しいが、**表の欄のような広い箱**で外へ出ると、
   * 値が欄から離れて**行が空に見える。** 欄を広げるか、文字を短くすれば直る。
   */
  adriftNames: string[];
  /**
   * **書いたのに絵に出ない符号**（配置図だけ）。
   *
   * `hiddenLabels`（辺のラベル）と同じ扱い。印が小さいと符号が入らない。
   * **黙って落とすと、書いた側が気づけない** ——
   * 印を大きくするか、符号を短くすれば出る（2026-09-14）。
   */
  hiddenTags: string[];
  /**
   * **文字どうしが重なっている組**（配置図だけ）。合否ではなく観測値。
   *
   * `overlaps` は**箱**を数えるので、枠の中に節を入れた図では鳴りっぱなしになり、
   * 誰も見なくなる。**文字の重なりは、ほぼ必ず間違い**なので分けて数える
   * （2026-09-14。見本 86 で注記が枠の上に乗ったまま出ていた）。
   */
  overlappingText: [string, string][];
  /**
   * **箱の塗りに隠れて消える辺**（辺の id と、隠す箱の id）。配置図だけ。
   *
   * `arrows: false` は辺を箱より先に描く。**枠の中へ引いた線は塗りに隠れて消える。**
   * 2026-09-14〜15 に 3 回踏んだ（見本 97・101・111）。
   * **どの数の観測値も 0 のまま**で、ブラウザで開くまで気づかなかった。
   */
  edgesUnderBoxes: [string, string][];
  /**
   * **人がこの図を見たか。**
   *
   * `pins` は「人が**直した**」記録で、これは「人が**見た**」記録（仕様 §3.5）。
   * 両方が空なら、**誰もこの図を見ていない。**
   *
   * 自力率 100% には 2 通りある ──「AI が描いて人が直す必要が無かった」と
   * 「**誰も見ていない**」。後者はこの製品の失敗そのもの（PRD §4）。
   *
   * **ここへ書く口は開けていない。** 開けた瞬間、AI が自分の絵を自分で承認できる。
   * 人が GUI で印を付けるまで false のままにしておくこと。
   */
  reviewed: boolean;
  /** 最後に人が見た時刻。**一度も見ていなければ null。** */
  reviewedAt: string | null;
  /** 見たあとに意味が変わったか。真なら「もう一度見てもらう」段。 */
  reviewStale: boolean;
  /** 図の中でいちばん小さい字。 */
  smallestText: number;
  /** **縮小率を決める辺**（長いほう）。 */
  longestSide: number;
  /** 小さい字 ÷ 長辺。測れないときは null。 */
  textRatio: number | null;
  /** 投影で読める下限。**値をこちらが握ったままにしない。** */
  projectionFloor: number;
  /** 印刷（A3）で読める下限。 */
  printFloor: number;
  /**
   * **投影には小さすぎるか**（Issue #6）。
   *
   * 真でも**図は正しい。読みにくいだけ。**
   * 直し方は文字を大きくすることではない（図が伸びて比がさらに下がる）。
   * **図を分けるかどうかは意味の判断**なので、ここでは指摘だけする。
   */
  tooSmallToProject: boolean;
  /**
   * **A3 に印刷しても読めないか**（2026-09-14）。
   *
   * `tooSmallToProject` だけが真なら、**その図は印刷して読むもの**で、
   * 投影に向かないだけ。路線図・査定図・仕込図・積付図はここに入る
   * （見本 95 枚のうち 36 枚がこれ）。
   * **両方が真のときだけ、本当に直すところがある。**
   */
  tooSmallToPrint: boolean;
}

/**
 * 図を検査して、**エージェントが自分で直せるだけの情報**を返す。
 *
 * **位置は直させない**（それは人の領分）。直すのは構造。
 */
export async function inspect(source: string): Promise<Inspection> {
  const findings = validate(source);
  if (hasError(findings)) {
    return {
      readable: false,
      findings,
      nodes: 0,
      edges: 0,
      groups: 0,
      crossings: 0,
      overlaps: [],
      straddles: [],
      crossingEdges: [],
      groupEscapes: [],
      collisions: [],
      width: 0,
      height: 0,
      autonomy: null,
      layoutAutonomy: null,
      passLine: PASS_LINE,
      tooTangled: false,
      hiddenLabels: [],
      crowdedNames: [],
      floors: [],
      adriftNames: [],
      hiddenTags: [],
      overlappingText: [],
      edgesUnderBoxes: [],
      kind: 'structure',
      positionsInSource: false,
      reviewed: false,
      reviewedAt: null,
      reviewStale: false,
      smallestText: SMALLEST_TEXT,
      longestSide: 0,
      textRatio: null,
      projectionFloor: PROJECTION_FLOOR,
      printFloor: PRINT_FLOOR,
      tooSmallToProject: false,
      tooSmallToPrint: false,
    };
  }

  const placed = await layout(source);
  const crossed = crossings(placed);
  const nine = measure(source);
  const shown = new Set(
    placeEdgeLabels(placed.edges, placed.boxes, placed.groups).map((label) => label.id),
  );

  return {
    readable: true,
    findings,
    nodes: placed.boxes.length,
    edges: placed.edges.length,
    groups: placed.groups.length,
    crossings: crossed,
    overlaps: overlaps(placed),
    straddles: straddles(placed),
    crossingEdges: crossingEdges(placed),
    groupEscapes: groupEscapes(placed),
    collisions: placed.collisions,
    width: placed.width,
    height: placed.height,
    autonomy: nine.autonomy,
    layoutAutonomy: nine.layoutAutonomy,
    passLine: PASS_LINE,
    tooTangled: placed.edges.length > 0 && crossed > placed.edges.length,
    hiddenLabels: placed.edges.filter((e) => e.label !== null && !shown.has(e.id)).map((e) => e.id),
    crowdedNames:
      kindOf(source) === 'placement' ? crowdedNames(planNames(placed.boxes, extentOf(placed.boxes), placed.edges, placed.groups)) : [],
    floors: placed.floors,
    adriftNames:
      kindOf(source) === 'placement'
        ? adriftNames(placed.boxes, planNames(placed.boxes, extentOf(placed.boxes), placed.edges, placed.groups))
        : [],
    hiddenTags: kindOf(source) === 'placement' ? hiddenTags(placed.boxes) : [],
    edgesUnderBoxes: edgesUnderBoxes(placed),
    overlappingText:
      kindOf(source) === 'placement'
        ? overlappingText(placed.boxes, planNames(placed.boxes, extentOf(placed.boxes), placed.edges, placed.groups))
        : [],
    ...(() => {
      const seen = reviewOf(source);
      return { reviewed: seen.reviewed, reviewedAt: seen.at, reviewStale: seen.stale };
    })(),
    ...projection(placed.width, placed.height, smallestTextOf(placed, kindOf(source) === 'placement')),
    ...(() => {
      const kind = kindOf(source);
      return { kind, positionsInSource: measureOf(kind).positionsInSource };
    })(),
  };
}

// --- 書く ------------------------------------------------------------------

export interface WriteResult {
  ok: boolean;
  path: string;
  /** うまくいかなかった理由。**握り潰さない。** */
  reason?: string;
  findings?: Finding[];
  conflicts?: Conflict[];
}

/**
 * 新しい図を作る（D18）。
 *
 * **既にファイルがあれば失敗する。** 上書きの経路にしない。
 * 形式に適合しないものは書かない（**壊れた図をディスクに残さない**）。
 */
export function create(path: string, source: string, io: Io = realIo): WriteResult {
  if (!path.endsWith(SUFFIX)) {
    return { ok: false, path, reason: messages().tools.mustEndWith(SUFFIX) };
  }
  if (io.exists(path)) {
    return { ok: false, path, reason: messages().tools.alreadyExists };
  }

  const findings = validate(source);
  if (hasError(findings)) return { ok: false, path, reason: messages().tools.invalid, findings };

  io.write(path, source);
  return { ok: true, path, findings };
}

/**
 * 提案を、人の正本へ入れる（D5）。
 *
 * **提案から `pins` を読まない。** 競合は適用せずに返す。
 * **この口を通る限り、人の指定は壊れない。**
 */
export function propose(path: string, source: string, io: Io = realIo): WriteResult {
  if (!io.exists(path)) {
    return { ok: false, path, reason: messages().tools.notFound };
  }

  const findings = validate(source);
  if (hasError(findings)) return { ok: false, path, reason: messages().tools.invalidProposal, findings };

  const merged = merge(io.read(path), source);
  io.write(path, merged.text);
  return { ok: true, path, conflicts: merged.conflicts };
}

// --- 書き出す --------------------------------------------------------------

export type ExportKind = 'svg' | 'mermaid' | 'drawio' | 'png';

export interface ExportOptions {
  /**
   * 貼り先の地の色。**SVG にだけ効く。渡さなければライト。**
   *
   * draw.io は貼り先の道具が自分の色を持ち、mermaid は自前のテーマを持つので、
   * ここで色を決めない（決めると、あちらの設定と二重になる）。
   */
  theme?: Theme;
  /** 主役の強さ（svg にだけ効く）。**渡さなければ `safe`。** */
  intent?: Intent;
}

/**
 * **図を絵にして返す**（2026-09-18）。
 *
 * これまで書き出しは SVG を**文字で**返していた。文字は読めても**絵は見えない** ——
 * だから「名前が扉の弧に乗っている」「扇の半径が読めない」に気づけるのは、
 * 人が画面を開いたときだけだった。**リモートでは誰も開かない。**
 *
 * ## 符号化器は同梱しない
 *
 * PNG にするのに Chrome を使う（`scripts/icon.mjs` と同じ理由。依存を増やさない）。
 * **無ければ、無いと言う。** 黙って落とすと、絵を見ないまま「見た」ことになる。
 */
export interface Png {
  /** PNG の中身（base64）。**Chrome が無ければ null。** */
  image: string | null;
  /** 人とエージェントへの一言（どこで何をしたか／なぜ返せないか）。 */
  note: string;
}

/** Chrome の探し方（`scripts/icon.mjs` と同じ並び）。 */
const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

function findChrome(): string | null {
  for (const path of CHROME) {
    if (typeof path === 'string' && path.length > 0 && existsSync(path)) return path;
  }
  return null;
}

/** SVG を PNG にする（Chrome を 1 回だけ起動する）。 */
function shoot(chrome: string, svg: string): Buffer {
  const dir = mkdtempSync(join(tmpdir(), 'zumen-png-'));
  const page = join(dir, 'p.html');
  const out = join(dir, 'p.png');
  const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 1200);
  const height = Number(/height="(\d+)"/.exec(svg)?.[1] ?? 800);
  writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>*{margin:0}</style>${svg}`);
  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--default-background-color=FFFFFF',
    `--screenshot=${out}`,
    `--window-size=${width},${height}`,
    `file://${page}`,
  ], { stdio: 'ignore' });
  const png = readFileSync(out);
  rmSync(dir, { recursive: true, force: true });
  return png;
}

export async function pngOf(
  source: string,
  options: ExportOptions = {},
  chromeOf: () => string | null = findChrome,
  shootWith: (chrome: string, svg: string) => Buffer = shoot,
): Promise<Png> {
  const m = messages().tools;
  const svg = await exportAs(source, 'svg', options);
  const chrome = chromeOf();
  if (chrome === null) return { image: null, note: m.noChrome };
  try {
    return { image: shootWith(chrome, svg).toString('base64'), note: m.pngMade };
  } catch (error) {
    return { image: null, note: `${m.pngFailed} ${String(error)}` };
  }
}

/**
 * 書き出す。**落ちるものは、それぞれの書き出しが自分で断る。**
 */
export async function exportAs(
  source: string,
  kind: ExportKind,
  options: ExportOptions = {},
): Promise<string> {
  if (kind === 'mermaid') return toMermaid(source);
  // png はここでは扱わない（絵は文字ではないので `pngOf` が返す）。
  if (kind === 'png') return (await pngOf(source, options)).note;
  const placed = await layout(source);
  if (kind === 'drawio') return toDrawio(placed, titleOf(source));
  return render(placed, options.theme, options.intent, kindOf(source) === 'placement');
}

/**
 * **図が育つところを 1 本にする**（D34 の隣。2026-09-16）。
 *
 * これまで、この絵を作るには**画面録画**が要った ——
 * 画面の前に人が座っていないと作れない。**リモートで作れない機能は、無いのと同じ。**
 *
 * ここでは段（正本の並び）から、動く SVG と、紙を揃えた連番を作る。
 * **符号化器は同梱しない**（ベースルール §1・§12）。mp4 が要るなら、
 * 手元の道具で作る手順を文字で返す。
 */
export async function filmOf(
  steps: readonly string[],
  options: TimelapseOptions = {},
): Promise<Timelapse> {
  return timelapse(steps, options);
}

function titleOf(source: string): string {
  const found = /^title:\s*(.+)$/m.exec(source);
  return found?.[1]?.trim() ?? 'zumen';
}

/** 人が手で決めたことの一覧。**読むだけ。書き換える口は開けていない。** */
export function pinsOf(source: string): Record<string, unknown> {
  return getPins(parse(source));
}
