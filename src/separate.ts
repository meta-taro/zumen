/**
 * 重なりを解く（Issue 015）。**人が置いたノードは動かさない。**
 *
 * ## なぜ既存の手法をそのまま使えないか
 *
 * 重なりの除去は解かれている問題で、手法に名前がある
 * （PRISM / GTree / Force-Transfer / VPSC。`docs/specs/010-既存OSSの調査.md` §4）。
 *
 * **どれも全ノードを動かす前提**で、この製品が要るのは
 * 「**人が置いたノードは動かさず、機械が置いたノードだけを退ける**」。
 * 人の位置を動かして重なりを解いたら、それは**手直しを壊したこと**になる（判定基準 3.1）。
 *
 * ## やり方
 *
 * Force-Transfer に近い、素直な押し出し。
 *
 * 1. 重なっている組を集める
 * 2. **重なりが浅いほうの軸**へ退ける（縦横のうち、動かす距離が短いほう）
 * 3. 片方が固定なら、**動くほうだけ**が退ける。両方動くなら半分ずつ
 * 4. 重なりが無くなるまで繰り返す（上限あり）
 *
 * **両方とも人が置いていたら、動かさない。** その組を返して人へ知らせる。
 * 黙って動かすと、人の指定が消えたことに誰も気づかない。
 *
 * ## 決め方を固定する
 *
 * 同じ入力から同じ結果が出ること。**揺れると差分が読めなくなる**（D2）。
 * そのため、組の並びも押し出す向きも id で決める。
 */
import type { Box } from './layout.ts';

/** 箱どうしの隙間。触れていると読めない。 */
const GAP = 12;
/** 押し出しの繰り返しの上限。**解けないまま無限に回さない。** */
const ROUNDS = 40;

export interface Separation {
  /** **人が置いたものどうしが重なっている組。** 動かしていない。 */
  locked: [string, string][];
  /** 実際に動かしたノードの id。 */
  moved: string[];
}

/**
 * 重なりを解く。`boxes` を直接動かす。
 *
 * `pinned` が真の箱は 1 px も動かさない。
 */
/**
 * 重なりを解く。
 *
 * `fixed` に入れた id は**動かさないし、その組は衝突として数えない**。
 * 配置図で `at` を書いた箱がこれ（2026-09-11）。
 * **間取りや売場では、部屋や棚が接しているのが普通**で、重なりではない。
 * `GAP` の隙間を要求すると、接している箱が黙って離れる。
 */
export function separate(boxes: Box[], fixed: ReadonlySet<string> = new Set()): Separation {
  const moved = new Set<string>();
  const locked: [string, string][] = [];
  const seenLocked = new Set<string>();

  for (let round = 0; round < ROUNDS; round += 1) {
    const pairs = collisions(boxes);
    if (pairs.length === 0) break;

    let didMove = false;
    for (const [a, b] of pairs) {
      // **書いて置いたものどうしは、触れていてよい。** 数えない。
      if (fixed.has(a.id) && fixed.has(b.id)) continue;
      if (a.pinned && b.pinned) {
        const key = `${a.id} ${b.id}`;
        if (!seenLocked.has(key)) {
          seenLocked.add(key);
          locked.push([a.id, b.id]);
        }
        continue;
      }
      if (push(a, b, fixed)) {
        didMove = true;
        if (!a.pinned) moved.add(a.id);
        if (!b.pinned) moved.add(b.id);
      }
    }
    // 動かせるものが無くなったら、それ以上回しても変わらない。
    if (!didMove) break;
  }

  return { locked, moved: [...moved].sort() };
}

/** 重なっている組。**並びを id で固定する**（同じ入力から同じ結果を出すため）。 */
function collisions(boxes: Box[]): [Box, Box][] {
  const found: [Box, Box][] = [];
  const sorted = [...boxes].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i]!;
      const b = sorted[j]!;
      if (gapX(a, b) < GAP && gapY(a, b) < GAP) found.push([a, b]);
    }
  }
  return found;
}

/** 横方向の隙間。負なら食い込んでいる。 */
function gapX(a: Box, b: Box): number {
  return Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w));
}

function gapY(a: Box, b: Box): number {
  return Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h));
}

/**
 * 1 組を離す。動かしたら真。
 *
 * **浅いほうの軸へ退ける。** 深いほうへ退けると、図が不必要に広がる。
 */
function push(a: Box, b: Box, fixed: ReadonlySet<string>): boolean {
  const needX = GAP - gapX(a, b);
  const needY = GAP - gapY(a, b);
  if (needX <= 0 || needY <= 0) return false;

  if (needX <= needY) return shift(a, b, needX, 'x', fixed);
  return shift(a, b, needY, 'y', fixed);
}

/** `axis` の向きへ `need` だけ離す。固定されている側は動かさない。 */
function shift(a: Box, b: Box, need: number, axis: 'x' | 'y', fixed: ReadonlySet<string>): boolean {
  // どちらが手前か。同じなら id で決める（揺れないため）。
  const aFirst = a[axis] === b[axis] ? a.id < b.id : a[axis] < b[axis];
  const back = aFirst ? a : b;
  const front = aFirst ? b : a;

  // **人が置いたもの**（`pinned`）と、**書いて置いたもの**（`fixed`）は動かさない。
  const stuck = (box: Box): boolean => box.pinned || fixed.has(box.id);

  if (stuck(back) && stuck(front)) return false;
  if (stuck(back)) {
    front[axis] += need;
    return true;
  }
  if (stuck(front)) {
    back[axis] -= need;
    return true;
  }
  const half = need / 2;
  back[axis] -= half;
  front[axis] += half;
  return true;
}
