/**
 * **投影して読めるか**（Issue #6）。
 *
 * ## なぜ投影を基準にするか
 *
 * | | 下限 | 短辺に対する比 |
 * |---|---|---|
 * | A3 印刷 | 2.5mm（JIS Z 8313 の最小文字高 / 297mm） | 0.84% |
 * | 投影 | 16px 相当（1080p を後方から） | **1.5%** |
 *
 * **投影を通れば A3 も通る。逆は通らない。** 厳しいほうを採る。
 *
 * ## **長辺で測る**
 *
 * 図は画面に収めるとき `min(画面幅/図幅, 画面高/図高)` で縮む。
 * **縮小率を決めるのは長いほうの辺。** 短辺で測ると**縦長の図が素通りする。**
 *
 * ## **文字を大きくしない**
 *
 * 下回ったときに文字を上げると、**図が伸びて比がさらに下がる。**
 * 追いかけっこになる直し方は入れない。
 *
 * そして**図を分けるかどうかは意味の判断**で、機械が決めるものではない。
 * `pins` や競合と同じで、**機械は指摘し、人が決める**。
 *
 * 報告者の言葉では「**分けるべき図を機械が指摘する**ほうが、
 * 腐らせない側の価値と揃う」。
 */

/**
 * 投影で読める下限（長辺に対する比）。
 *
 * **甘くして通さない。** 下回る図があるのは、下限が厳しいからではなく
 * 図が大きいから（報告された 3 枚とも 1.05〜1.32% で下回っている）。
 */
export const PROJECTION_FLOOR = 0.015;

/**
 * 図の中でいちばん小さい字。
 *
 * 辺のラベル（`src/edge-labels.ts`）と副題（`src/render.ts` の `technology`）が
 * どちらも 11px。**ここを変えたらこの値も変える。**
 */
export const SMALLEST_TEXT = 11;

export interface Projection {
  /** いちばん小さい字の大きさ。 */
  smallestText: number;
  /** 縮小率を決める辺。**長いほう。** */
  longestSide: number;
  /** 小さい字 ÷ 長辺。**測れないときは null。** */
  textRatio: number | null;
  /** 下限。**こちらが握ったままにせず、返す。** */
  projectionFloor: number;
  /** 下回っているか。**真でも図は正しい。読みにくいだけ。** */
  tooSmallToProject: boolean;
}

export function projection(width: number, height: number): Projection {
  const longestSide = Math.max(width, height);
  const base = {
    smallestText: SMALLEST_TEXT,
    longestSide,
    projectionFloor: PROJECTION_FLOOR,
  };
  // 空の図では割れない。**数字を作らない。**
  if (longestSide <= 0) {
    return { ...base, textRatio: null, tooSmallToProject: false };
  }
  const textRatio = SMALLEST_TEXT / longestSide;
  return { ...base, textRatio, tooSmallToProject: textRatio < PROJECTION_FLOOR };
}
