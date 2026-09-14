/**
 * **階と、階をまたぐ動線**（`floors` ／ `nodes[].floor` ／ `edges[].vertical`）。
 *
 * ## なぜ正本に階が要るか（D26 の ①）
 *
 * 多層の乗換案内は、階の枠も階名も**人が手で置いていた**（見本 82）。
 * だから機械は「この箱は何階か」を知らない ——
 * 枠を描き忘れても、箱を別の階の枠へ入れても、**誰も気づけない。**
 *
 * **階が正本の言葉になれば、枠と階名は機械が描く。**
 * そして 3D の描き手は、同じ正本を高さ方向に積むだけでよくなる。
 *
 * ## 階の名前は正本が決める
 *
 * `B2` / `1F` / `M2`（中 2 階）/ `ロビー階` —— **建物ごとに違う。**
 * こちらは名前を持たず、**並び順だけ**を受け取る（`palette` と同じ筋）。
 *
 * ```yaml
 * floors:      # 下から上へ
 *   - B2
 *   - B1
 *   - 1F
 * ```
 *
 * ## 箱は動かさない
 *
 * `floor` は**どの枠に属するかを言うだけ**で、位置は変えない。
 * 人が書いた座標がそのまま出ることは、この製品の保証（判定基準 3.1）。
 *
 * ## 縦動線の語は JIS が決めている
 *
 * `stair` / `escalator` / `elevator` は **JIS Z 8210（案内用図記号）**にある。
 * 決めているのは我々ではない —— `symbol` を IEC 60617 へ委ねたのと同じ筋（D22 の例外）。
 * **図記号そのものはまだ持っていない**ので、描くのは文字。
 */

export const VERTICALS = ['none', 'stair', 'escalator', 'elevator'] as const;
export type Vertical = (typeof VERTICALS)[number];

const WORDS = new Set<string>(VERTICALS);

export function verticalOf(raw: unknown): Vertical {
  if (typeof raw !== 'string' || !WORDS.has(raw)) return 'none';
  return raw as Vertical;
}

/**
 * 階の一覧。**下から上へ**並べる。
 *
 * **文字列だけを受ける。** 数を受けると `1F` と `B1` が混ざったときに
 * 並び順を機械が勝手に決めることになる。
 */
export function floorsOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string' && item !== '');
}
