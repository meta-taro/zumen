/**
 * **範囲を示す円**（`nodes[].radius`）。
 *
 * ## なぜ要るか
 *
 * [#4](https://github.com/meta-taro/zumen/issues/4) の原題は
 * **総合仮設計画図**（縮尺のある配置図）だった。
 * 実物に必ず入るのは 10 種
 * （仮囲い・出入口／仮設事務所・便所／材料置場・加工場／**揚重機・重機**／
 * 足場・仮設通路／仮設電気水道／廃棄物置場／防災設備／近隣対策／安全表示）。
 *
 * このうち**揚重機だけが、矩形では描けなかった。**
 * クレーンの作業計画に要るのは、機種・定格荷重・**作業半径**・揚程・据付位置。
 * **作業半径が描けないと、そのクレーンで届くかが図から読めない。**
 *
 * ## なぜ形を増やす話ではないのか
 *
 * D22 で「業界ごとに `type` を増やさない」と決めた。これはそこに当たらない。
 *
 * | | `type` を増やす | `radius` |
 * |---|---|---|
 * | 何を変えるか | **物の形** | **範囲の注記** |
 * | 語彙 | 業界ごとに増える | **1 つだけ** |
 * | 何を言うか | 「これは円柱だ」 | 「ここから ○m 届く」 |
 *
 * クレーンは円ではない。**円はクレーンが届く範囲**で、寸法線と同じ種類のもの。
 *
 * ## 何に使えるか
 *
 * - クレーンの作業半径（仮設計画図）
 * - 影の離隔（太陽光の架台配置）
 * - 消火器の警戒区域（消防設備図。**歩行距離 20m 以内**）
 * - 電波・照明・スプリンクラーの到達
 *
 * **`scale` があれば、半径を mm で書き添える。** 無ければ円だけ描く
 * （知らない縮尺で数値を出さないのは、寸法線と同じ）。
 */

/** 範囲の円。書かなければ描かない。 */
export function radiusOf(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

export interface Ring {
  /** 中心（箱の中心）。 */
  cx: number;
  cy: number;
  /** 半径（px）。 */
  r: number;
  /** 添える文字（`R=25,000`）。縮尺が無ければ null。 */
  label: string | null;
}

export function ringOf(
  box: { x: number; y: number; w: number; h: number; radius: number | null },
  mm: number | null,
): Ring | null {
  if (box.radius === null) return null;
  return {
    cx: box.x + box.w / 2,
    cy: box.y + box.h / 2,
    r: box.radius,
    label: mm === null ? null : `R=${Math.round(box.radius * mm).toLocaleString('en-US')}`,
  };
}

/**
 * 範囲を描く。
 *
 * **破線の細い線。** 実物の図面でも、範囲は実線で描かない ——
 * 実線は「物がある」ことを言うので、**届く範囲と物の輪郭が見分けられなくなる。**
 */
export function drawRange(ring: Ring, stroke: string, text: string, font: string): string {
  const n = Math.round;
  const label =
    ring.label === null
      ? ''
      : `<text x="${n(ring.cx)}" y="${n(ring.cy - ring.r + 14)}" text-anchor="middle" font-family="${font}" font-size="10" fill="${text}">${ring.label}</text>`;
  return (
    `<circle cx="${n(ring.cx)}" cy="${n(ring.cy)}" r="${n(ring.r)}" fill="none" ` +
    `stroke="${stroke}" stroke-width="1" stroke-dasharray="8 5"/>` +
    label
  );
}
