/**
 * **節に属さない線と形**（`paths`。仕様 §3.0.26）。
 *
 * ## なぜ入れたか
 *
 * 線は辺でしか描けず、辺は節から節へしか引けなかった。
 * だから見本は、**線を引くためだけに見えない点（名前も枠も無い 2×2 の節）を置いていた** ——
 * 8,044 個・218 枚、辺ぜんたいの 87% が両端とも見えない点だった（`.claude/primitives-audit.md` §3-A）。
 *
 * 困るのは 3 つ。長い（点 1 つに 5 行）。人の手直しが `p17>p18` のような**読めない鍵**に付く。
 * 点が節として数えられ、重なりの検査・手直しの測り方・書き出しが「要素」として扱う。
 *
 * ## 描き方を 2 本にしない
 *
 * ここでやるのは、**辺が描かれる直前の形（`PlacedEdge`）に直すこと**だけ。
 * 描くのは辺と同じ道（`src/render.ts` の `renderEdge`）で、層も辺と同じ。
 * 違うのは端だけ —— **点のまま**で、箱の縁では切らない（切る箱が無い）。
 *
 * ## 弧は点に刻む
 *
 * 描き手は折れ線と、点を通る曲線しか持たない。弧のために SVG の `A` を足すと、
 * 描き分けが 2 本になり、検査（交差・重なり）も弧を別に数えることになる。
 * だから**弦が円から 0.25px より離れない細かさで刻む**（描くときは 0.1px に丸めるので、
 * 目に見える差は出ない）。
 */
import { curveOf } from './curve.ts';
import type { Curve, Point } from './curve.ts';
import { endsOf } from './ends.ts';
import type { Ends } from './ends.ts';
import { hatchOf } from './hatch.ts';
import type { Hatch } from './hatch.ts';
import type { PlacedEdge } from './layout.ts';
import { lineOf } from './line.ts';
import type { Line } from './line.ts';
import { weightOf } from './weight.ts';
import type { Weight } from './weight.ts';

/** 正本から読んだ図形 1 つ。**色は鍵のまま**（引くのは辺と同じ所。`src/layout.ts`）。 */
export interface PathInfo {
  id: string;
  label: string | null;
  ends: Ends | null;
  line: Line;
  weight: Weight;
  curve: Curve;
  /** 閉じるか。`sector`（扇形）も閉じる。 */
  close: boolean;
  hatch: Hatch;
  colorKey: unknown;
  casingKey: unknown;
  hatchColorKey: unknown;
  /** 正本の点（弧は刻んだあと、扇形なら中心を前後に足したあと）。**閉じる前。** */
  points: Point[];
}

/** 弧を刻む細かさ。**弦の中点が円から離れてよい距離**（px）。 */
const SAGITTA = 0.25;
/** 小さい円でも角張らないように、1 刻みの角の上限（度）。 */
const MAX_STEP = 15;

/**
 * 点 1 つ。**`[x, y]` も `{ x, y }` も読む**（`via` と同じ書き方でも書ける）。
 * 読めなければ null。
 */
export function pointOf(raw: unknown): Point | null {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) return null;
    const [x, y] = raw as unknown[];
    return finite(x) && finite(y) ? { x, y } : null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  const { x, y } = raw as { x?: unknown; y?: unknown };
  return finite(x) && finite(y) ? { x, y } : null;
}

/** 点の並び。**1 つでも読めなければ null**（黙って間引くと、別の形になる）。 */
export function pointsOf(raw: unknown): Point[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Point[] = [];
  for (const item of raw) {
    const point = pointOf(item);
    if (point === null) return null;
    out.push(point);
  }
  return out;
}

/** 弧の数。**読めなければ null**（`path-arc-invalid`）。 */
export function arcOf(raw: unknown): { center: Point; r: number; from: number; to: number } | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { center, r, from, to } = raw as Record<string, unknown>;
  const c = pointOf(center);
  if (c === null || !finite(r) || r <= 0 || !finite(from) || !finite(to)) return null;
  const sweep = Math.abs(to - from);
  if (sweep === 0 || sweep > 360) return null;
  return { center: c, r, from, to };
}

/**
 * 弧を点に刻む。**0 度が右（東）、角が増えると時計回り**（紙の y は下向き）。
 * `to` が `from` より小さければ、反時計回りに進む。
 */
export function arcPoints(arc: { center: Point; r: number; from: number; to: number }): Point[] {
  const sweep = arc.to - arc.from;
  // 弦の中点が円から SAGITTA だけ離れる角: r(1 - cos(θ/2)) = SAGITTA
  const fit = arc.r <= SAGITTA ? 180 : (2 * Math.acos(1 - SAGITTA / arc.r) * 180) / Math.PI;
  const step = Math.min(MAX_STEP, fit);
  const count = Math.max(1, Math.ceil(Math.abs(sweep) / step));
  const out: Point[] = [];
  for (let i = 0; i <= count; i += 1) {
    const deg = arc.from + (sweep * i) / count;
    const rad = (deg * Math.PI) / 180;
    out.push({ x: round(arc.center.x + arc.r * Math.cos(rad)), y: round(arc.center.y + arc.r * Math.sin(rad)) });
  }
  return out;
}

/**
 * 正本の `paths` を読む。**描けないもの（id が無い・形が読めない）は落とす** ——
 * 落とした理由は検証器が言う（`src/validate.ts` の `checkPaths`）。
 */
export function readPaths(raw: unknown): PathInfo[] {
  if (!Array.isArray(raw)) return [];
  const out: PathInfo[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const path = item as Record<string, unknown>;
    const id = path.id;
    if ((typeof id !== 'string' && typeof id !== 'number') || seen.has(String(id))) continue;
    const points = shapeOf(path);
    if (points === null) continue;
    seen.add(String(id));
    out.push({
      id: String(id),
      label: typeof path.label === 'string' || typeof path.label === 'number' ? String(path.label) : null,
      ends: endsOf(path.ends),
      line: lineOf(path.line),
      weight: weightOf(path.weight),
      curve: curveOf(path.curve),
      close: path.close === true || (path.close === 'sector' && path.arc !== undefined),
      hatch: hatchOf(path.hatch),
      colorKey: path.color,
      casingKey: path.casing,
      hatchColorKey: path.hatch_color,
      points,
    });
  }
  return out;
}

/** 点の並び（`points`）か、弧を刻んだもの（`arc`）。どちらか 1 つだけのときに限る。 */
function shapeOf(path: Record<string, unknown>): Point[] | null {
  const hasPoints = path.points !== undefined && path.points !== null;
  const hasArc = path.arc !== undefined && path.arc !== null;
  if (hasPoints === hasArc) return null;
  if (hasPoints) {
    const points = pointsOf(path.points);
    return points === null || points.length < 2 ? null : points;
  }
  const arc = arcOf(path.arc);
  if (arc === null) return null;
  const points = arcPoints(arc);
  // **扇形は中心から出て、中心へ戻る**（`close: sector`）。戻りは閉じるときに足す。
  return path.close === 'sector' ? [{ ...arc.center }, ...points] : points;
}

/**
 * **描く直前の形にする**（辺と同じ `PlacedEdge`）。
 *
 * 人の `pins.<id>.points` があれば、そちらが勝つ（`pins.waypoints` と同じ筋。仕様 §3.4）。
 * 読めない人の点は使わない（検証器が `pin-points-invalid` で言う）。
 */
export function routePaths(paths: PathInfo[], pins: Record<string, { points?: unknown }>): PlacedEdge[] {
  return paths.map((path) => {
    const human = pointsOf(pins[path.id]?.points);
    const pinned = human !== null && human.length >= 2;
    const points = (pinned ? human : path.points).map((point) => ({ ...point }));
    // **輪を閉じる**（辺の `close` と同じ）。最後が最初と同じ点なら、重ねずに閉じる。
    if (path.close) {
      const head = points[0]!;
      const tail = points[points.length - 1]!;
      if (points.length > 2 && tail.x === head.x && tail.y === head.y) points.pop();
      points.push({ ...points[0]! });
    }
    return {
      id: path.id,
      from: '',
      to: '',
      path: true,
      label: path.label,
      points,
      pinned,
      ends: path.ends,
      line: path.line,
      weight: path.weight,
      curve: path.curve,
      close: path.close,
      hatch: path.hatch,
      vertical: 'none',
      color: null,
      casing: null,
      hatchColor: null,
      offset: 0,
    };
  });
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 0.01px に丸める。**`-0` を 0 にする**（真下・真右の点で `cos` が -0 を返す）。 */
function round(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}
