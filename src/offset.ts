/**
 * **並走する線のずらし**（`edges[].offset`）。
 *
 * 路線図では、同じ駅の間を 2 つの路線が並んで走る所を、
 * **同じ道に重ねず、少しずらして平行に描く**（重ねると下の路線が消える）。
 *
 * 値は px。**正は進む向き（`from` → `to`）の右、負は左**
 * （紙の座標は y が下向きなので、東へ進む線の右は南）。
 *
 * ## 折れ点でも平行を保つ
 *
 * 点を 1 つずつ法線方向へ動かすと、折れ点で線の幅が変わる。
 * **線分ごとに法線方向へずらし、折れ点は隣り合う線分の交点に置く**
 * （製図でいう平行線の描き方と同じ）。
 * 一直線に並んだ折れ点（交点が無い）は、法線方向へずらすだけ。
 */
export interface Point {
  x: number;
  y: number;
}

/** 交点を取らない角の下限。**ほとんど折り返す線分では、交点が遠くへ飛ぶ。** */
const PARALLEL = 1e-9;
/** 折れ点を、ずらした量の何倍まで離してよいか（それより鋭い角は角を落とす）。 */
const MITER = 4;

/**
 * 点の列を、進む向きの右へ `d` px ずらす。
 *
 * `closed` なら、最後の点から最初の点へ戻る線分も含めて数える（閉じた輪）。
 */
export function offsetLine(points: readonly Point[], d: number, closed = false): Point[] {
  if (d === 0 || points.length < 2) return points.map((p) => ({ ...p }));
  return points.map((p, i) => {
    const before = directionAt(points, i, -1, closed);
    const after = directionAt(points, i, 1, closed);
    if (before === null && after === null) return { ...p };
    if (before === null || after === null) {
      const dir = (before ?? after)!;
      return shift(p, dir, d);
    }
    // 2 本の線分をそれぞれ右へずらし、その交点を取る
    const a = shift(p, before, d);
    const b = shift(p, after, d);
    const cross = before.x * after.y - before.y * after.x;
    if (Math.abs(cross) < PARALLEL) return a;
    // a + t·before = b + s·after を t について解く
    const t = ((b.x - a.x) * after.y - (b.y - a.y) * after.x) / cross;
    const at = { x: a.x + t * before.x, y: a.y + t * before.y };
    // **折り返しに近い角では、交点が遠くへ飛ぶ。** そこだけ 2 点の中ほどで止める。
    if (Math.hypot(at.x - p.x, at.y - p.y) > MITER * Math.abs(d)) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    return at;
  });
}

/**
 * 点 `i` の前（`step = -1`）または後（`step = 1`）の線分の向き（長さ 1）。
 * **長さ 0 の線分は飛ばして、その先を見る**（同じ点が並んでも崩れない）。
 */
function directionAt(points: readonly Point[], i: number, step: 1 | -1, closed: boolean): Point | null {
  const count = points.length;
  const here = points[i]!;
  for (let k = 1; k < count; k += 1) {
    let j = i + step * k;
    if (closed) j = ((j % count) + count) % count;
    else if (j < 0 || j >= count) return null;
    const there = points[j]!;
    const dx = step === 1 ? there.x - here.x : here.x - there.x;
    const dy = step === 1 ? there.y - here.y : here.y - there.y;
    const length = Math.hypot(dx, dy);
    if (length > 1e-9) return { x: dx / length, y: dy / length };
  }
  return null;
}

/** 向き `dir` に対して右へ `d` ずらす（右の法線は `(-dy, dx)`）。 */
function shift(p: Point, dir: Point, d: number): Point {
  return { x: p.x - dir.y * d, y: p.y + dir.x * d };
}
