/**
 * **辺の通り道と、その丸め方**（`edges[].via` ／ `edges[].curve`）。
 *
 * ## なぜ入れたか
 *
 * 課題 2 の「辺の曲線」は「**代用できるうちは入れない**」で保留していた。
 * 2026-09-13、代用できない図が出た —— 道路の平面線形・河川・庭園の園路。
 * **曲がっていること自体が内容**で、直角で代用すると別の意味になる
 * （道路の平面線形は「どこで曲がるか」が図の中身そのもの）。
 *
 * ## 2 つに分けた
 *
 * | | 誰が書くか | 何を言うか |
 * |---|---|---|
 * | `via` | **正本（AI も書く）** | この線はここを通る（内容） |
 * | `pins.waypoints` | **人だけ** | いや、こう通してほしい（上書き） |
 *
 * `nodes[].at` と `pins.position` の関係と同じ形にしてある。
 * **人が書いたほうが勝つ**のはこの製品の保証（判定基準 3.1）で、曲線でも変えない。
 *
 * ## 値は形の名前だけ
 *
 * `curve: river`（河川）のような**意味の語は足さない**。
 * 道具の名前（`bezier`）も受けない —— 正本は**どう見えるか**を書く場所で、
 * 何で描くかは描き手の都合。
 */

export const CURVES = ['none', 'smooth'] as const;
export type Curve = (typeof CURVES)[number];

const WORDS = new Set<string>(CURVES);

export function curveOf(raw: unknown): Curve {
  if (typeof raw !== 'string' || !WORDS.has(raw)) return 'none';
  return raw as Curve;
}

export interface Point {
  x: number;
  y: number;
}

/** 正本の `via` を点の並びにする。**点になっていないものは落とす。** */
export function viaOf(raw: unknown): Point[] {
  if (!Array.isArray(raw)) return [];
  const out: Point[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const { x, y } = item as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

/** 小数を短く（`src/render.ts` と同じ作法）。 */
function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * 点の並びを SVG の道にする。
 *
 * **`smooth` は点を通る。** 近くを通るだけの曲線にしない ——
 * 通り道は「ここを通る」と書いたものなので、外したら書いた意味が無い
 * （Catmull-Rom を三次ベジェへ置き換える。制御点は前後の点から作る）。
 *
 * **2 点しかなければ直線。** 丸める角が無い。
 */
export function pathOf(points: readonly Point[], curve: Curve): string {
  if (points.length < 2) return '';
  const [head, ...rest] = points;
  const start = `M ${n(head!.x)} ${n(head!.y)}`;
  if (curve === 'none' || points.length === 2) {
    return `${start} ${rest.map((p) => `L ${n(p.x)} ${n(p.y)}`).join(' ')}`;
  }
  const parts: string[] = [start];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    parts.push(`C ${n(c1.x)} ${n(c1.y)}, ${n(c2.x)} ${n(c2.y)}, ${n(p2.x)} ${n(p2.y)}`);
  }
  return parts.join(' ');
}
