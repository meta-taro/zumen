/**
 * **軸測投影** —— xyz を紙の上へ落とす（2026-09-25）。
 *
 * ## なぜ足したか
 *
 * **立体・断面・奥行きに触れている見本が 50 枚あるのに、3D の口が無かった。**
 * 等角図の見本（197）は **104 点を手計算で打ってある**
 * （`399 + 100 × cos30° = 485.6` を人が電卓で出している）。
 *
 * オーナーの見立て ——「zumen は 2D から **3D 表現に幅を利かせる**と思います」。
 *
 * ## 足したのは変換 1 本だけ
 *
 * ```yaml
 * projection: isometric
 * nodes:
 *   - id: a
 *     at: { x: 0, y: 0, z: 100 }
 * ```
 *
 * `kind: construction` と同じ思想（**座標を書かず、比と長さから出す**）の延長で、
 * `z` が 1 つ増えるだけ。**別世界を作らない**（`UIワイヤーフレームの方針.md` §9 と同じ）。
 *
 * ## 重なり順は変えない（D41 と衝突しない）
 *
 * **`z` がやるのは座標だけ。** どちらが手前かは**いままでどおり**
 * （種類順 ＋ 同じ種類の中は正本の記載順）。
 * 奥行きで自動的に並べ替えるのは別の決定で、いまは要らない ——
 * **記載順で書けることは D41 で確かめてある。**
 *
 * ## 隠れ線は機械が判定しない
 *
 * 実物の図面は隠れた辺を破線にするが、**それは意味の判断**。
 * 書いた人が `line: dashed` で書く（`pins` や競合と同じで、
 * **機械は指摘し、人が決める**）。
 */

/** 軸測投影の種類。**4 つで足りる**（製図で実際に使われているもの）。 */
export const AXONS = ['isometric', 'dimetric', 'cabinet', 'cavalier'] as const;
export type Axon = (typeof AXONS)[number];

export function axonOf(raw: unknown): Axon | null {
  return AXONS.includes(raw as Axon) ? (raw as Axon) : null;
}

/**
 * 1 つの軸が、紙の上でどちらへ何倍で伸びるか。
 *
 * | | x 軸 | y 軸（奥行き）| z 軸（高さ）| 奥行きの縮み |
 * |---|---|---|---|---|
 * | **等角**（isometric）| 右下 30° | 左下 30° | 真上 | **1.000** |
 * | 二等角（dimetric）| 右下 7° | 左下 42° | 真上 | 0.5 |
 * | **キャビネット**（cabinet）| 真右 | 左下 45° | 真上 | **0.5** |
 * | カバリエ（cavalier）| 真右 | 左下 45° | 真上 | 1.0 |
 *
 * **キャビネットの 1/2 には理由がある** —— 実寸で描くと、目には太って見える。
 * 家具や木工の図が昔からこれを使うのは、そのため。
 */
interface Axes {
  /** 図の x が、紙の (dx, dy) へ。 */
  x: readonly [number, number];
  /** 図の y（奥行き）が、紙の (dx, dy) へ。 */
  y: readonly [number, number];
  /** 図の z（高さ）が、紙の (dx, dy) へ。**紙は下が正なので、上は負。** */
  z: readonly [number, number];
}

const RAD = Math.PI / 180;
const at = (deg: number, scale = 1): readonly [number, number] =>
  [Math.cos(deg * RAD) * scale, Math.sin(deg * RAD) * scale];

const AXES: Readonly<Record<Axon, Axes>> = {
  isometric: { x: at(30), y: at(150), z: [0, -1] },
  dimetric: { x: at(7), y: at(180 - 42, 0.5), z: [0, -1] },
  cabinet: { x: [1, 0], y: at(135, 0.5), z: [0, -1] },
  cavalier: { x: [1, 0], y: at(135), z: [0, -1] },
};

/**
 * xyz を紙の xy へ。**z を書いていなければ、そのまま**（2D の図は何も変わらない）。
 */
export function project(
  point: { x: number; y: number; z?: number | null },
  axon: Axon | null,
): { x: number; y: number } {
  if (axon === null || point.z === undefined || point.z === null) {
    return { x: point.x, y: point.y };
  }
  const a = AXES[axon];
  return {
    x: point.x * a.x[0] + point.y * a.y[0] + point.z * a.z[0],
    y: point.x * a.x[1] + point.y * a.y[1] + point.z * a.z[1],
  };
}

/**
 * **等角図の円は楕円になる。** その長短の比。
 *
 * 等角面に置いた円は、長軸と短軸の比が **1 : 0.5774**（＝ 1/√3）。
 * 見本 197 の見出しが「**ただし円は楕円になる**」と書いているのは、これ。
 *
 * **いまは使う側がいない**（`marker: circle` に投影を掛けていない）。
 * 掛けるときにここを見る。
 */
export const ISO_CIRCLE_RATIO = 1 / Math.sqrt(3);
