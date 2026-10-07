/**
 * **立体**（`nodes[].height`。仕様 §3.0.23。2026-10-07）。
 *
 * 軸測投影（`projection`。`src/axon.ts`）の図で、箱に高さを書くと**角柱として描く。**
 * 間取りの平面図に `projection: isometric` と部屋の `height` を足すだけで、
 * 同じ正本から**立体の線画**が出る（正本は平面図のまま）。
 *
 * ## 描き方（図解の作法）
 *
 * - **輪郭は太く、内側の稜線は細く**（2 : 1）。輪郭は 8 つの角を紙へ落とした点の凸包
 * - **面は地の色で塗り、奥から手前へ重ねる。** 隠れ線は計算しない —— 手前の立体が奥の線を塗りで隠す
 * - 見える面は、外向きに回した頂点を紙へ落としたときの回り方で決める（上の面と同じ向きに回れば見える）
 *
 * **JIS の製図とは違う。** JIS B 0001:2019 は見える稜線をすべて外形線（太い実線）で描く（6.2）。
 * 輪郭だけを太くするのは図解（テクニカルイラストレーション）の作法で、
 * 立体の形を一目で読ませるためのもの。出典と照合は `.claude/refs/立体の線画.md`。
 *
 * ## 奥行きの順（記録済みの決定の例外）
 *
 * 重なり順は記載順で、奥行きで並べ替えない（`src/axon.ts`）。**立体だけは例外**で、
 * 奥から手前へ描く —— 面を塗って隠す描き方は、順が狂うと手前の立体が奥に消える。
 * 平面の箱（床・敷地）はこれまでどおり、立体より先に描く。
 */
import { project } from './axon.ts';
import type { Axon } from './axon.ts';

export interface SolidPoint {
  x: number;
  y: number;
}

export interface Solid {
  /** 見える面（紙の座標）。上の面は `top`。描く順（側面 → 上）に並ぶ。 */
  faces: { points: SolidPoint[]; top: boolean }[];
  /** 輪郭（凸包。紙の座標）。 */
  hull: SolidPoint[];
  /** 奥行き（大きいほど手前）。床の中心を z = 0 で紙へ落とした y、同じなら下にあるほうが奥。 */
  depth: number;
  /** 床からの高さ（同じ奥行きのときの順）。 */
  base: number;
  /** 名前を書く点（上の面の中心）。 */
  label: SolidPoint;
  /** 投影する前の範囲（前後を決めるのに使う）。 */
  min: V3;
  max: V3;
  /** 見る人へ向かう向き（投影で 1 点に潰れる向き。上から見るので z は正）。 */
  toward: V3;
}

type V3 = [number, number, number];

/**
 * 床（`x`・`y`・`z`）と大きさ（`w` × `h`）と高さから、紙の上の立体を作る。
 * 投影が無ければ null（平面の図に高さは無い）。
 */
export function solidOf(
  ground: { x: number; y: number; z: number },
  size: { w: number; h: number },
  height: number,
  axon: Axon | null,
): Solid | null {
  if (axon === null || height <= 0) return null;
  const { x: x0, y: y0, z: z0 } = ground;
  const x1 = x0 + size.w;
  const y1 = y0 + size.h;
  const z1 = z0 + height;
  const on = ([x, y, z]: V3): SolidPoint => project({ x, y, z }, axon);

  // 外向きに回した 6 面（右ねじで外を向く）。
  const raw: { corners: V3[]; normal: V3; top: boolean }[] = [
    { corners: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], normal: [0, 0, 1], top: true },
    { corners: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], normal: [0, -1, 0], top: false },
    { corners: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], normal: [1, 0, 0], top: false },
    { corners: [[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], normal: [0, 1, 0], top: false },
    { corners: [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], normal: [-1, 0, 0], top: false },
  ];
  const outward = raw.map(({ corners, normal, top }) => ({ corners: outwardOrder(corners, normal), top }));
  const projected = outward.map(({ corners, top }) => ({ points: corners.map(on), top }));
  // 上の面はかならず見える。**同じ回り方に見える面だけが、こちらを向いている。**
  const sign = Math.sign(area(projected[0]!.points));
  const faces = projected
    .filter((face) => face.top || Math.sign(area(face.points)) === sign)
    .sort((a, b) => Number(a.top) - Number(b.top));

  const corners: V3[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) corners.push([x, y, z]);
  const center = on([(x0 + x1) / 2, (y0 + y1) / 2, 0]);
  return {
    faces,
    hull: hull(corners.map(on)),
    depth: center.y,
    base: z0,
    label: on([(x0 + x1) / 2, (y0 + y1) / 2, z1]),
    min: [x0, y0, z0],
    max: [x1, y1, z1],
    toward: towardOf(axon),
  };
}

/**
 * **見る人へ向かう向き。** 投影は 3 次元を 2 次元へ潰すので、潰れて 1 点になる向きが 1 本ある
 * （x 行と y 行の外積）。上から見下ろすので、z が正になる側を採る。
 */
function towardOf(axon: Axon): V3 {
  const ex = project({ x: 1, y: 0, z: 0 }, axon);
  const ey = project({ x: 0, y: 1, z: 0 }, axon);
  const ez = project({ x: 0, y: 0, z: 1 }, axon);
  const r1: V3 = [ex.x, ey.x, ez.x];
  const r2: V3 = [ex.y, ey.y, ez.y];
  const d: V3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  return d[2] < 0 ? [-d[0], -d[1], -d[2]] : d;
}

/**
 * **a が b より奥にあるか。** 重ならない箱どうしは、どれかの軸で離れている。
 * その軸で、見る人から遠い側にあるほうが奥（軸測なので遠近は無い）。
 */
export function behind(a: Solid, b: Solid): boolean {
  for (let k = 0; k < 3; k += 1) {
    const d = a.toward[k]!;
    if (Math.abs(d) < 1e-9) continue;
    if (d > 0 && a.max[k]! <= b.min[k]! + 1e-9) return true;
    if (d < 0 && a.min[k]! >= b.max[k]! - 1e-9) return true;
  }
  return false;
}

/** 外へ向く回り方に揃える（外積が外向きの法線と同じ向きになるように）。 */
function outwardOrder(corners: V3[], normal: V3): V3[] {
  const [a, b, c] = corners as [V3, V3, V3];
  const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2];
  return dot >= 0 ? corners : [...corners].reverse();
}

/** 多角形の符号つき面積（紙の座標）。 */
function area(points: SolidPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
}

/** 凸包（単調連鎖）。 */
function hull(input: SolidPoint[]): SolidPoint[] {
  const pts = [...input].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: SolidPoint, a: SolidPoint, b: SolidPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: SolidPoint[] = [];
  for (const p of pts) {
    while (lower.length > 1 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: SolidPoint[] = [];
  for (let i = pts.length - 1; i >= 0; i -= 1) {
    const p = pts[i]!;
    while (upper.length > 1 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

/** 立体を紙の上でずらす（余白を空けるとき）。 */
export function shiftSolid(solid: Solid, dx: number, dy: number): void {
  const move = (p: SolidPoint) => {
    p.x += dx;
    p.y += dy;
  };
  for (const face of solid.faces) face.points.forEach(move);
  solid.hull.forEach(move);
  move(solid.label);
  solid.depth += dy;
}

/** 立体の外接矩形。 */
export function solidBounds(solid: Solid): { x: number; y: number; w: number; h: number } {
  const xs = solid.hull.map((p) => p.x);
  const ys = solid.hull.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * **描く順に並べる**：平面の箱（床・敷地）が先、立体は奥から手前へ。
 * 平面の箱どうしの順は渡された順のまま。
 */
export function paintOrder<T extends { solid?: Solid }>(items: T[]): T[] {
  const flat = items.filter((item) => item.solid === undefined);
  // 下ごしらえの順（奥行き → 高さ）。前後の決まらない組は、この順のまま。
  const rest = items
    .filter((item) => item.solid !== undefined)
    .sort((a, b) => a.solid!.depth - b.solid!.depth || a.solid!.base - b.solid!.base);
  // **奥にあるものが残っていない立体から順に描く**（前後の関係で並べる）。
  const out: T[] = [];
  while (rest.length > 0) {
    // **前後は、紙の上で重なる組でだけ数える。** 重ならない組は 2 つの軸で離れていることがあり、
    // そのとき「x では手前・z では奥」と両方向に奥が立って輪になる（交互列積みで必ず出る）。
    const i = rest.findIndex(
      (item) => !rest.some((other) => other !== item && overlapOnPaper(other.solid!, item.solid!) && behind(other.solid!, item.solid!)),
    );
    // 輪になった（箱が食い込んでいる）ときは、下ごしらえの順で 1 つ進める。
    out.push(rest.splice(i < 0 ? 0 : i, 1)[0]!);
  }
  return [...flat, ...out];
}

/** **2 つの立体が食い込んでいるか**（接しているだけなら食い込みではない）。 */
export function solidsIntersect(a: Solid, b: Solid): boolean {
  for (let k = 0; k < 3; k += 1) {
    if (a.max[k]! <= b.min[k]! + 1e-9 || b.max[k]! <= a.min[k]! + 1e-9) return false;
  }
  return true;
}

/** **紙の上で、2 つの立体の輪郭が重なるか**（凸多角形の分離軸。接しているだけなら重ならない）。 */
export function overlapOnPaper(a: Solid, b: Solid): boolean {
  for (const poly of [a.hull, b.hull]) {
    for (let i = 0; i < poly.length; i += 1) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const nx = q.y - p.y;
      const ny = p.x - q.x;
      const span = (pts: SolidPoint[]) => {
        let lo = Infinity;
        let hi = -Infinity;
        for (const t of pts) {
          const v = t.x * nx + t.y * ny;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
        return [lo, hi] as const;
      };
      const [alo, ahi] = span(a.hull);
      const [blo, bhi] = span(b.hull);
      const eps = 1e-6 * Math.hypot(nx, ny);
      if (ahi <= blo + eps || bhi <= alo + eps) return false;
    }
  }
  return true;
}
