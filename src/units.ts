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

/**
 * **図ぜんたいの単位を、正本が選ぶ**（`scale.unit`。2026-11-02）。
 *
 * 縮尺で決めると、競技場や家具（1 px が 25 mm）は `14,000` になる。
 * 実物の競技規則は **`14 m`** と書く。逆に、粗い縮尺でもミリで書きたい図もある。
 * はめあいの公差域は **μm** で書く（JIS B 0401 の表がそう）。
 *
 * **選べるのは図ぜんたいで 1 つ。** 1 つの図に mm と m を混ぜない決めは変えない ——
 * 選んだ単位は、通り芯の寸法・`dims`・範囲の円・物差しのすべてに効く。
 *
 * | 値 | 書き方 |
 * |---|---|
 * | `mm` | `14,000`（縮尺が粗くてもミリ） |
 * | `m` | `14 m` ／ `13.95 m`（ミリの縮尺なら cm まで） |
 * | `um` | `21 μm`（1 μm に満たない縮尺なら小数 1 桁まで） |
 *
 * **インチの縮尺（`scale.in`）には付けない。** フィートとインチの書き方は 1 つしか無い。
 */
export const UNITS = ['mm', 'm', 'um'] as const;
export type Unit = (typeof UNITS)[number];

/** 単位を読む。**読めなければ null**（縮尺が決める。検証器が `scale-unit-invalid` で言う）。 */
export function unitOf(raw: unknown): Unit | null {
  return UNITS.includes(raw as Unit) ? (raw as Unit) : null;
}

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
export function lengthText(px: number, mm: number, feet = false, unit: Unit | null = null): string {
  const value = Math.abs(px) * mm;
  if (feet) return feetText(value);
  if (unit === 'um') return micronText(value, mm);
  if (unit === 'm' || (unit === null && inMetres(mm))) return metreText(value, mm);
  /**
   * **1px が 1mm 未満の図では、小数が意味を持つ**（2026-09-19。見本 194 の点字）。
   *
   * ミリの整数に丸めると、点字の点間隔 **2.6mm が「3」**になる。
   * 2.6 も 3.4 も同じ「3」になってしまい、**規格の図面としては書いていないのと同じ。**
   * どちらで書くかは、ここでも縮尺が言う —— 1:1 より拡大した図だけ、小数 1 桁まで。
   */
  const fine = mm < 1;
  const rounded = fine ? Math.round(value * 10) / 10 : Math.round(value);
  return rounded.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/**
 * m で書く。**整数なら小数点を書かない**（200 m を 200.0 m と書く図面は無い）。
 *
 * 1 px が 100 mm 以上の図は小数 1 桁まで（これより細かい値を縮尺が持っていない）。
 * **ミリの縮尺で m を選んだ図は cm まで** —— ピストの `13.95 m` を `14 m` に丸めると、
 * 図と規則の値のずれが数値から消える。
 */
function metreText(value: number, mm: number): string {
  const metres = value / 1000;
  if (!inMetres(mm)) {
    const rounded = Math.round(metres * 100) / 100;
    return `${rounded} m`;
  }
  const rounded = Math.round(metres * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded} m` : `${rounded.toFixed(1)} m`;
}

/** μm で書く。**1 px が 1 μm に満たない図だけ、小数 1 桁まで。** */
function micronText(value: number, mm: number): string {
  const microns = value * 1000;
  const rounded = mm * 1000 < 1 ? Math.round(microns * 10) / 10 : Math.round(microns);
  return `${rounded.toLocaleString('en-US', { maximumFractionDigits: 1 })} μm`;
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
