/**
 * **配置図での印の描き方**（`nodes[].marker`）。
 *
 * ## なぜ `type` を増やさないのか
 *
 * 路線図を実物らしくするには、駅を**丸**で描く必要がある。
 * だが D22 で「業界ごとに `type` を増やさない」と決めてある。
 *
 * **これは形の追加ではない。**
 *
 * | | `type` を増やす | `marker` |
 * |---|---|---|
 * | 何を言うか | 「これは**円柱**だ」＝ 物の種類 | 「ここは**丸で印を付ける**」＝ 図の描き方 |
 * | 語の数 | 業界ごとに増える | **4 つで閉じる** |
 * | どこで効くか | どの図でも | **配置図だけ** |
 *
 * 平面図で壁を塗り潰したのと、断面図で基準線を三角にしたのと同じ筋
 * —— **その図の決まった描き方**を、正本から選べるようにしただけ。
 *
 * ## 値は幾何だけ。意味の語は入れない
 *
 * **`marker: extinguisher`（消火器）のような語は、絶対に足さない。**
 * そこを開けると、これは設備記号（課題 4）の裏口になり、
 * D22 で断った「業界ごとに語彙が増える」がそのまま起きる。
 *
 * 入れてよいのは**形の名前だけ**。4 つで閉じる。
 *
 * | 値 | 絵 | そう描く図 |
 * |---|---|---|
 * | `box`（既定） | 矩形 | 部屋・区画・棚 |
 * | `circle` | 丸 | 路線図の駅、経穴、計器 |
 * | `double` | 二重丸 | 路線図の乗換駅 |
 * | `ellipse` | 楕円 | UML のユースケース |
 * | `diamond` | 菱形 | UML の判断（分岐）・フローチャートの条件 |
 * | `bar` | 太い帯 | UML のフォーク／ジョイン |
 * | `none` | 枠を描かない | 折れ点・注記だけの場所 |
 *
 * ## 印を付けたものは、文字が外へ出る
 *
 * 丸は小さい。**中に名前は入らない**ので、外へ出す（`src/names.ts`）。
 * 実物の路線図も、駅名は丸の外に書いてある。
 */

export const MARKERS = [
  'box',
  'circle',
  'double',
  'ellipse',
  'diamond',
  'bar',
  'none',
] as const;
export type Marker = (typeof MARKERS)[number];

export function markerOf(raw: unknown): Marker {
  return MARKERS.includes(raw as Marker) ? (raw as Marker) : 'box';
}

export interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: string | null;
}

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

function n(value: number): number {
  return Math.round(value);
}

/**
 * 印を描く。
 *
 * **丸の大きさは、箱の短いほうの半分。** 箱の指定をそのまま使えるので、
 * 正本に半径を書かせない（書かせると `size` と食い違う）。
 */
export function drawMarker(marker: Marker, box: Frame, paint: Paint): string {
  const dash = paint.dash === null ? '' : ` stroke-dasharray="${paint.dash}"`;
  const skin = `fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"${dash}`;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const r = Math.min(box.w, box.h) / 2;

  if (marker === 'none') return '';

  if (marker === 'ellipse') {
    // UML のユースケース。**箱いっぱいの楕円**（丸と違い、横長の名前が入る）。
    return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(box.w / 2)}" ry="${n(box.h / 2)}" ${skin}/>`;
  }

  if (marker === 'diamond') {
    // UML の判断。**箱の 4 辺の中点を結ぶ。**
    return (
      `<path d="M ${n(cx)} ${n(box.y)} L ${n(box.x + box.w)} ${n(cy)} ` +
      `L ${n(cx)} ${n(box.y + box.h)} L ${n(box.x)} ${n(cy)} Z" ${skin}/>`
    );
  }

  if (marker === 'bar') {
    // UML のフォーク／ジョイン。**塗った帯。** 枠ではなく面で示す。
    return `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="${paint.stroke}"/>`;
  }

  if (marker === 'circle') {
    return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${skin}/>`;
  }
  if (marker === 'double') {
    // 乗換駅。**外の丸は地の色で塗らない**（内の丸が見えなくなる）。
    return (
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${skin}/>` +
      `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 0.55)}" fill="none" ` +
      `stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"/>`
    );
  }
  return (
    `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" ${skin}/>`
  );
}
