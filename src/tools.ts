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
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { toDrawio } from './drawio.ts';
import { placeEdgeLabels } from './edge-labels.ts';
import { getPins, parse } from './format.ts';
import { crossings, groupEscapes, layout, overlaps } from './layout.ts';
import { messages } from './messages.ts';
import { PASS_LINE, measure } from './measure.ts';
import { merge } from './merge.ts';
import type { Conflict } from './merge.ts';
import { toMermaid } from './mermaid.ts';
import { projection, PROJECTION_FLOOR, SMALLEST_TEXT } from './projection.ts';
import { render } from './render.ts';
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
  /** 箱どうしの重なり。 */
  overlaps: [string, string][];
  /** 囲みからはみ出した要素。 */
  groupEscapes: string[];
  /** **人が置いたものどうしが重なっている組。** 動かしていない。 */
  collisions: [string, string][];
  width: number;
  height: number;
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
  /**
   * **投影には小さすぎるか**（Issue #6）。
   *
   * 真でも**図は正しい。読みにくいだけ。**
   * 直し方は文字を大きくすることではない（図が伸びて比がさらに下がる）。
   * **図を分けるかどうかは意味の判断**なので、ここでは指摘だけする。
   */
  tooSmallToProject: boolean;
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
      groupEscapes: [],
      collisions: [],
      width: 0,
      height: 0,
      autonomy: null,
      layoutAutonomy: null,
      passLine: PASS_LINE,
      tooTangled: false,
      hiddenLabels: [],
      reviewed: false,
      reviewedAt: null,
      reviewStale: false,
      smallestText: SMALLEST_TEXT,
      longestSide: 0,
      textRatio: null,
      projectionFloor: PROJECTION_FLOOR,
      tooSmallToProject: false,
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
    groupEscapes: groupEscapes(placed),
    collisions: placed.collisions,
    width: placed.width,
    height: placed.height,
    autonomy: nine.autonomy,
    layoutAutonomy: nine.layoutAutonomy,
    passLine: PASS_LINE,
    tooTangled: placed.edges.length > 0 && crossed > placed.edges.length,
    hiddenLabels: placed.edges.filter((e) => e.label !== null && !shown.has(e.id)).map((e) => e.id),
    ...(() => {
      const seen = reviewOf(source);
      return { reviewed: seen.reviewed, reviewedAt: seen.at, reviewStale: seen.stale };
    })(),
    ...projection(placed.width, placed.height),
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

export type ExportKind = 'svg' | 'mermaid' | 'drawio';

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
 * 書き出す。**落ちるものは、それぞれの書き出しが自分で断る。**
 */
export async function exportAs(
  source: string,
  kind: ExportKind,
  options: ExportOptions = {},
): Promise<string> {
  if (kind === 'mermaid') return toMermaid(source);
  const placed = await layout(source);
  if (kind === 'drawio') return toDrawio(placed, titleOf(source));
  return render(placed, options.theme, options.intent);
}

function titleOf(source: string): string {
  const found = /^title:\s*(.+)$/m.exec(source);
  return found?.[1]?.trim() ?? 'zumen';
}

/** 人が手で決めたことの一覧。**読むだけ。書き換える口は開けていない。** */
export function pinsOf(source: string): Record<string, unknown> {
  return getPins(parse(source));
}
