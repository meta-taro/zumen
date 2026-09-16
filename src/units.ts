/**
 * **寸法の単位**（mm か m か）。
 *
 * ## なぜ要るか
 *
 * 花火大会の保安距離図（見本 93）で、200 m の円に **`R=200,000`** と出た。
 * 実物の保安距離図は **200 m** と書く。**桁を数えないと読めない数字**は、
 * 図面としては書いていないのと同じ。
 *
 * 同じことが既にあった —— ダムの平面図に `200000`、圃場整備に `125000`、
 * 総合仮設に `60000`。どれも実物は m で書く。
 *
 * ## どちらで書くかは、図が自分で言っている
 *
 * **建築はミリ、土木はメートル。** ただし「建築か土木か」は正本に書いていない。
 * 代わりに**縮尺**がある。
 *
 * | 1 px | 図 | 単位 |
 * |---|---|---|
 * | 0.5〜50 mm | 間取り・伏図・断面・駐車場の区画 | **mm**（`7,000`） |
 * | 100 mm 以上 | 仮設計画・圃場整備・ダム・保安距離 | **m**（`60.0 m`） |
 *
 * **1 px が 100 mm 以上の図は、1:100 より小さい縮尺。**
 * その縮尺の図面をミリで書く業界は無い。
 *
 * ## 図の中で単位を混ぜない
 *
 * 数値の大きさでは決めない。**同じ図に `45.0 m` と `5,000` が並ぶ**ことになる。
 * 決めるのは縮尺 1 つで、図ぜんたいで同じ単位になる。
 *
 * ## フィートとインチ（2026-09-16）
 *
 * 同じ話が**国をまたぐ**ときに起きる。アメリカの間取り図に `13,411` と出したら、
 * それは読めない図面 —— 向こうは **`44'-0"`** と書く。
 * **どちらで書くかも、やはり縮尺が言う**（`scale: { in: 1.5 }`）。
 */

/** 1 インチのミリ。 */
export const INCH = 25.4;

/** **1 px がこれ以上なら m で書く。** 1:100 より小さい縮尺。 */
export const METRE_SCALE = 100;

/** その図が m で書くか。 */
export function inMetres(mm: number): boolean {
  return mm >= METRE_SCALE;
}

/**
 * px の長さを、その図の単位の文字にする。
 *
 * mm は 3 桁ごとに区切る（`7,000`）。m は小数 1 桁まで（`60.0` / `2.5`）。
 */
export function lengthText(px: number, mm: number, feet = false): string {
  const value = Math.abs(px) * mm;
  if (feet) return feetText(value);
  if (!inMetres(mm)) return Math.round(value).toLocaleString('en-US');
  const metres = value / 1000;
  // **整数なら小数点を書かない。** 200 m を 200.0 m と書く図面は無い。
  const rounded = Math.round(metres * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} m` : `${rounded.toFixed(1)} m`;
}

/**
 * ミリを**フィートとインチ**にする（`12'-6"`）。
 *
 * **丸めるのは 1 インチまで。** 1/2 インチや 1/4 インチを書くのは詳細図の仕事で、
 * 平面図の寸法線に出すと、読む側が桁を数えることになる（ミリを m にしたのと同じ理由）。
 *
 * **12 インチは 1 フィートへ繰り上げる。** `11'-12"` という寸法は無い。
 */
export function feetText(mm: number): string {
  const inches = Math.round(mm / INCH);
  const feet = Math.floor(inches / 12);
  const rest = inches - feet * 12;
  if (feet === 0) return `${rest}"`;
  return `${feet.toLocaleString('en-US')}'-${rest}"`;
}
