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
 * 投影先の縦横比。**16:9**（会議室の投影機も、いまの画面もこれ）。
 *
 * ここを変えると「効く辺」が変わる。4:3 の投影機しか無い場では
 * 横長の図が不利になるが、**いまの既定は 16:9 でよい。**
 */
export const SCREEN_RATIO = 9 / 16;

/**
 * 図に出る字の大きさ（`src/render.ts` と `src/dimensions.ts` の実際の値）。
 *
 * **ここが実装とずれると、門が測るものを間違える。**
 * 2026-09-13 に実際にずれていた —— 11px 決め打ちで測っていたが、
 * 見本の SVG には **10px の字（符号・寸法・方位）** が出ていて、
 * **投影の比を 1 割ぶん甘く報告していた。**
 */
export const FONT_SIZE = {
  /** 構成図の名前。 */
  title: 15,
  /** 囲みの名前。 */
  group: 13,
  /** 配置図の名前（`src/names.ts` の `NAME_FONT`）。 */
  name: 12,
  /** 構成図の副題・辺のラベル。 */
  sub: 11,
  /** 符号・寸法値・方位・範囲・配置図の副題（`src/names.ts` の `SUB_FONT`）。 */
  small: 10,
} as const;

/**
 * 図の中でいちばん小さい字。**その図に実際に出る字だけ**を数える。
 *
 * 出ない字を数えると、**大きさに関係なく全部の図が下限を割る。**
 * 出る字を数え落とすと、**読めない図が門を通る。**
 */
export const SMALLEST_TEXT = FONT_SIZE.sub;

/** どの字が出るかを見るのに要るもの（`src/layout.ts` の `Placed` の一部）。 */
export interface Inked {
  boxes: readonly { technology: string | null; tag: string | null; radius: number | null }[];
  groups: readonly unknown[];
  edges: readonly { label: string | null }[];
  grid: { x: readonly unknown[]; y: readonly unknown[] };
  north: unknown;
}

export function smallestTextOf(placed: Inked, plan: boolean): number {
  const used: number[] = [plan ? FONT_SIZE.name : FONT_SIZE.title];
  if (placed.groups.length > 0) used.push(FONT_SIZE.group);
  if (placed.edges.some((edge) => edge.label !== null)) used.push(FONT_SIZE.sub);
  if (placed.boxes.some((box) => box.technology !== null)) {
    used.push(plan ? FONT_SIZE.small : FONT_SIZE.sub);
  }
  // 符号は**構成図でも 10px で描かれる**（`src/render.ts` の `nodeTag`）。
  if (placed.boxes.some((box) => box.tag !== null)) used.push(FONT_SIZE.small);
  if (plan) {
    // 寸法値・通り芯の符号・方位・範囲の注記。**配置図でだけ出る。**
    if (placed.grid.x.length > 0 || placed.grid.y.length > 0) used.push(FONT_SIZE.small);
    if (placed.north !== null) used.push(FONT_SIZE.small);
    if (placed.boxes.some((box) => box.radius !== null)) used.push(FONT_SIZE.small);
  }
  return Math.min(...used);
}

export interface Projection {
  /** いちばん小さい字の大きさ。 */
  smallestText: number;
  /**
   * 縮小率を決める辺。**「画面からはみ出すほうの辺」**（16:9 に対して）。
   *
   * 縦長の図では高さ、16:9 より横長の図では `幅 × 9/16`。
   */
  longestSide: number;
  /** 小さい字 ÷ 長辺。**測れないときは null。** */
  textRatio: number | null;
  /** 下限。**こちらが握ったままにせず、返す。** */
  projectionFloor: number;
  /** 下回っているか。**真でも図は正しい。読みにくいだけ。** */
  tooSmallToProject: boolean;
}

export function projection(width: number, height: number, smallestText: number = SMALLEST_TEXT): Projection {
  // **長辺ではない。** 16:9 の画面に収めたとき、縮小率を決めるほうの辺。
  const longestSide = Math.max(height, width * SCREEN_RATIO);
  const base = { smallestText, longestSide, projectionFloor: PROJECTION_FLOOR };
  // 空の図では割れない。**数字を作らない。**
  if (longestSide <= 0) {
    return { ...base, textRatio: null, tooSmallToProject: false };
  }
  const textRatio = smallestText / longestSide;
  return { ...base, textRatio, tooSmallToProject: textRatio < PROJECTION_FLOOR };
}
