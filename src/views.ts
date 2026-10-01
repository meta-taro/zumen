/**
 * **1 枚の紙に、図を 2 つ以上置く**（D35。課題 1 ＋ 課題 3）。
 *
 * ## なぜ要るか
 *
 * 駅の構内図を 1 枚描いて当たった（2026-09-12。見本 45）。
 * 1F と B1F を横に並べるところまでは、**いまの道具で描けた** ——
 * 実物の「各階平面図」と同じ並べ方で、層をまたぐ同一性は `tag` が担っていた。
 *
 * **通らなかったのは寸法だった。**
 *
 * `grid` と `scale` が図ぜんたいに 1 組しかないので、2 つの図を並べると
 * **通しで測ってしまう。** 見本 45 では
 * **「2 階を合わせた全長 82,000」という意味のない数字**が出た。
 * 通り芯も 2 階分を貫いた。だから見本 45 は
 * **`scale` と `grid` を書かないことで避けていた**（＝直っていなかった）。
 *
 * ## 1 枚に複数の図が要る場面
 *
 * | | |
 * |---|---|
 * | 各階平面図 | 1F・2F・B1F を並べる |
 * | 船の一般配置図 | 甲板ごとに 1 枚ずつ、縦に積む |
 * | 三面図 | 正面・側面・平面 |
 * | 展開図 | 室内の四面 |
 * | 全体 ＋ 詳細 | 横断図に舗装構成を添える |
 *
 * ## 新しい語は増やしていない
 *
 * `at` / `size` / `grid` / `scale` / `title` —— **すべて既にある語**。
 * 置ける場所が 1 つ増えただけで、書き方は節と同じ（D31 と同じ考え方）。
 *
 * ## D30 に反しない
 *
 * D30 は「**実務規模の図を別の図へ分ける**仕組みは、いまは足さない」。
 * あれは**図から別の図への参照**（1 つの構成を複数のファイルへ割る）の話で、
 * こちらは**1 枚の紙の中に座標系を 2 つ以上持つ**話。向きが逆で、参照も増えない。
 */
import { gridOf, hasGrid, scaleOf } from './grid.ts';
import type { Grid } from './grid.ts';

/** 紙の上の 1 つの図。 */
export interface View {
  id: string;
  /** 図の名前（「上甲板」「1 階平面図」）。**書かなければ描かない。** */
  title: string | null;
  /** 図が占める矩形（紙の座標）。 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** この図だけの通り芯。 */
  grid: Grid;
  /**
   * この図だけの縮尺（1 px が何 mm か）。
   *
   * **書かなければ、図ぜんたいの `scale` を使う。**
   * 図ごとに変えられるのは、実物がそうだから ——
   * 全体図 1/200 の横に、詳細図 1/20 を置く。
   */
  mm: number | null;
  /** **この図だけフィートで書くか**（`scale: { in: … }`）。 */
  feet: boolean;
}

export const NO_VIEWS: readonly View[] = [];

/**
 * `views:` を読む。
 *
 * **形が揃っていないものは落とす**（当て推量で埋めない）。
 * 落ちたことは検証器が言う（`view-unreadable`）。
 */
export function viewsOf(raw: unknown): View[] {
  if (!Array.isArray(raw)) return [];
  const out: View[] = [];
  for (const item of raw) {
    const view = viewOf(item);
    if (view !== null) out.push(view);
  }
  return out;
}

function viewOf(raw: unknown): View | null {
  if (raw === null || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const id = body.id === undefined || body.id === null ? '' : String(body.id);
  if (id === '') return null;

  const at = pair(body.at, 'x', 'y');
  const size = pair(body.size, 'w', 'h');
  // **矩形が無ければ、どこに何を描くか決められない。** 勝手に決めない。
  if (at === null || size === null || size.a <= 0 || size.b <= 0) return null;

  const scale = scaleOf(body.scale);
  return {
    id,
    title: body.title === undefined || body.title === null ? null : String(body.title),
    x: at.a,
    y: at.b,
    w: size.a,
    h: size.b,
    grid: gridOf(body.grid),
    mm: scale?.mm ?? null,
    feet: scale?.feet ?? false,
  };
}

function pair(raw: unknown, first: string, second: string): { a: number; b: number } | null {
  if (raw === null || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const a = body[first];
  const b = body[second];
  if (typeof a !== 'number' || !Number.isFinite(a)) return null;
  if (typeof b !== 'number' || !Number.isFinite(b)) return null;
  return { a, b };
}

/** 紙ぜんたいをずらすとき、図も一緒に動かす。 */
export function slideViews(views: readonly View[], dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  for (const view of views) {
    view.x += dx;
    view.y += dy;
    for (const axis of view.grid.x) axis.at += dx;
    for (const axis of view.grid.y) axis.at += dy;
  }
}

/**
 * 余白と紙の大きさを決めるための、**全部の図の通り芯をまとめたもの**。
 *
 * **描くときには使わない**（描くのは図ごと）。
 * まとめるのは「紙からはみ出さないか」を測るときだけ。
 */
export function allAxes(views: readonly View[], grid: Grid): Grid {
  if (views.length === 0) return grid;
  return {
    x: [...grid.x, ...views.flatMap((view) => view.grid.x)],
    y: [...grid.y, ...views.flatMap((view) => view.grid.y)],
  };
}

/** 図が置かれている範囲（紙の大きさを決めるのに使う）。 */
export function viewBounds(
  views: readonly View[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (views.length === 0) return null;
  return {
    minX: Math.min(...views.map((v) => v.x)),
    minY: Math.min(...views.map((v) => v.y)),
    maxX: Math.max(...views.map((v) => v.x + v.w)),
    maxY: Math.max(...views.map((v) => v.y + v.h)),
  };
}

/** 通り芯を持たない図は、寸法も符号も出ない（名前だけの枠）。 */
export function hasAxes(view: View): boolean {
  return hasGrid(view.grid);
}
