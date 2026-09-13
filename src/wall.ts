/**
 * **壁の厚み**（2026-09-12）。
 *
 * ## なぜ要るか
 *
 * 通り芯と寸法を入れたあと、まだ残っていた差。
 * **実物の平面図では、壁が「太さのあるもの」として描かれている。**
 * 1 本線だと、部屋と部屋を分ける**境界線**には見えても、**壁**には見えない。
 *
 * 壁に厚みがあることは、図の飾りではない。
 *
 * - **有効寸法が変わる。** 芯々 1,820 の廊下は、壁厚 120 なら内法 1,700
 * - **どちらに寄っているかが読める。** 芯に対して壁が振ってあるかどうか
 * - **建具の幅が壁の厚みの中に収まる**ことが、見て分かる
 *
 * ## なぜ 2 本線ではなく太い線か
 *
 * 実物は縮尺で描き分けられている。
 *
 * | 縮尺 | 壁の描き方 |
 * |---|---|
 * | 1/50 以上（平面詳細図） | **2 本線**。間に仕上げの線も入る |
 * | 1/100 前後（平面図・伏図） | **塗り潰し**（ポシェ） |
 *
 * zumen が出す図は 1/100 前後の粗さなので、**塗り潰しのほうが実物に近い。**
 * 2 本線にすると、この大きさでは 2 本が潰れて 1 本の太線に見えるだけで、
 * **描画は複雑になるのに絵は同じ**になる。
 *
 * ## 厚みは正本が決める
 *
 * `scale` が無ければ mm を px にできないので、**何も変えない。**
 * 知らない厚みで壁を太らせると、**寸法と食い違う絵**が出る。
 */

export interface Wall {
  /** 間仕切壁の厚み（mm）。 */
  mm: number;
  /** 外壁の厚み（mm）。書かなければ間仕切の 1.5 倍。 */
  outer: number;
}

/** 壁の厚みを書いていない図。**これまでどおりの線の太さで描く。** */
export const NO_WALL: Wall | null = null;

export function wallOf(raw: unknown): Wall | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { mm, outer } = raw as Record<string, unknown>;
  if (typeof mm !== 'number' || !Number.isFinite(mm) || mm <= 0) return null;
  const thick = typeof outer === 'number' && Number.isFinite(outer) && outer > 0 ? outer : mm * 1.5;
  return { mm, outer: thick };
}

/**
 * 壁の太さを px にする。
 *
 * **上限を置く。** 厚い壁を大きな縮尺で描くと、
 * 太さが部屋の幅に迫って**部屋が消える**（壁厚 300mm ＝ 1px 5mm なら 60px）。
 * そこまで行くなら、それは図ではなく詳細図で描くもの。
 */
export function wallWidth(wall: Wall | null, mm: number | null, outer = false): number | null {
  if (wall === null || mm === null) return null;
  const px = (outer ? wall.outer : wall.mm) / mm;
  return Math.max(1, Math.min(24, Math.round(px * 10) / 10));
}

/**
 * **壁が箱を食い尽くさない下限**（短辺が壁の何倍あれば壁として描くか）。
 *
 * フードコートの配置図で出た（2026-09-13）。
 * **凡例の見本（26×20）が、6.8px の壁でほとんど枠になっていた。**
 *
 * 縮尺のある平面図の中には、**縮尺の外のもの**（凡例・注記の見本）が混じる。
 * 機械にはそれが部屋なのか見本なのか分からないが、
 * **壁が短辺の 1/5 を超える箱は、どちらにしても読めない。**
 *
 * 本当に細い物入れは poché を失う。それでも**全部が壁の箱よりはまし**で、
 * そこまで細いものは詳細図で描くもの（`wallWidth` の上限と同じ考え）。
 */
const ROOM_ENOUGH = 5;

/** その箱に壁を効かせてよいか。**小さすぎる箱には効かせない。** */
export function wallFits(width: number | null, box: { w: number; h: number }): boolean {
  if (width === null) return false;
  return Math.min(box.w, box.h) >= width * ROOM_ENOUGH;
}
