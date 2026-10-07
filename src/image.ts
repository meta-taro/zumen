/**
 * **画像を下に敷く**（`nodes[].image`。仕様 §3.0.22。2026-10-06）。
 *
 * 画面仕様書は、キャプチャに番号付きの引き出し線を出して横に仕様を書く。
 * 箱で画面を描き直すと、**実物とずれた絵に仕様を書く**ことになる —— 敷くのは実物そのもの。
 *
 * ## ここはファイルを読まない
 *
 * 図を組む処理（`src/layout.ts`）はアプリの画面の中でも動く。
 * **読むのは呼ぶ側**（`src/image-files.ts`）で、ここは読んだバイト列から大きさを取るのと、
 * 「画像のこの点」の書き方を解くだけ。
 *
 * ## 点は画像の px で持つ
 *
 * `to: { node: sp, at: [120, 56] }` の `[120, 56]` は**元の画像の px**。
 * 箱の大きさ（`size`）で拡大・縮小しても、**指している所はずれない。**
 */

/** 読んだ画像。`href` は図に埋める値（data URI）か、読めなければ書いたままのパス。 */
export interface ImageInfo {
  href: string;
  /** 元の画像の幅と高さ（px）。 */
  w: number;
  h: number;
}

export type Images = Map<string, ImageInfo>;

/** 受ける形式。**png / jpg / webp だけ**（画面のキャプチャはこのどれか）。 */
export const IMAGE_TYPES = ['png', 'jpeg', 'webp'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * **バイト列の頭から、形式と大きさを取る。** 画像でなければ null。
 *
 * 拡張子は見ない —— `.png` と書いた JPEG もあるし、
 * **画像でないファイルを図へ埋めない**ための門でもある。
 */
export function imageSize(bytes: Uint8Array): { type: ImageType; w: number; h: number } | null {
  return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes);
}

function u32be(b: Uint8Array, i: number): number {
  return ((b[i]! << 24) >>> 0) + (b[i + 1]! << 16) + (b[i + 2]! << 8) + b[i + 3]!;
}

function u16be(b: Uint8Array, i: number): number {
  return (b[i]! << 8) + b[i + 1]!;
}

function u16le(b: Uint8Array, i: number): number {
  return b[i]! + (b[i + 1]! << 8);
}

function u24le(b: Uint8Array, i: number): number {
  return b[i]! + (b[i + 1]! << 8) + (b[i + 2]! << 16);
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngSize(b: Uint8Array): { type: ImageType; w: number; h: number } | null {
  if (b.length < 24 || PNG.some((v, i) => b[i] !== v)) return null;
  // 署名の次は必ず IHDR（幅・高さの順）。
  const w = u32be(b, 16);
  const h = u32be(b, 20);
  return w > 0 && h > 0 ? { type: 'png', w, h } : null;
}

function jpegSize(b: Uint8Array): { type: ImageType; w: number; h: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    // 区切りだけの印（長さを持たない）。
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    // **フレームの頭（SOF）に大きさがある。** DHT（c4）・JPG（c8）・DAC（cc）は SOF ではない。
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = u16be(b, i + 5);
      const w = u16be(b, i + 7);
      return w > 0 && h > 0 ? { type: 'jpeg', w, h } : null;
    }
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webpSize(b: Uint8Array): { type: ImageType; w: number; h: number } | null {
  const tag = (i: number) => String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
  if (b.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return null;
  const chunk = tag(12);
  let w = 0;
  let h = 0;
  if (chunk === 'VP8 ') {
    w = u16le(b, 26) & 0x3fff;
    h = u16le(b, 28) & 0x3fff;
  } else if (chunk === 'VP8L') {
    const v = b[21]! | (b[22]! << 8) | (b[23]! << 16) | (b[24]! << 24);
    w = (v & 0x3fff) + 1;
    h = ((v >>> 14) & 0x3fff) + 1;
  } else if (chunk === 'VP8X') {
    w = u24le(b, 24) + 1;
    h = u24le(b, 27) + 1;
  } else {
    return null;
  }
  return w > 0 && h > 0 ? { type: 'webp', w, h } : null;
}

/**
 * **画像の中の点**（`<節>@<x>,<y>`）。
 *
 * 正本には `to: { node: sp, at: [120, 56] }` と書く。読むとき（`src/format.ts`）に
 * この 1 語へ寄せるので、**辺の端はこれまでどおり文字列のまま**で、
 * 書き戻し・`pins` の鍵（`from>to`）・検査はどれも形を変えずに済む。
 */
export interface PointRef {
  node: string;
  x: number;
  y: number;
}

const POINT = /^(.+)@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

export function pointRef(end: string): PointRef | null {
  const m = POINT.exec(end);
  if (m === null) return null;
  return { node: m[1]!, x: Number(m[2]), y: Number(m[3]) };
}

/** 端が指している**節**。画像の中の点なら、その画像の節。 */
export function ownerOf(end: string): string {
  return pointRef(end)?.node ?? end;
}

/** 正本の `{ node, at: [x, y] }` を 1 語へ。形が違えば null（そのまま文字列として扱う）。 */
export function pointEnd(raw: unknown): string | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { node, at } = raw as { node?: unknown; at?: unknown };
  if (typeof node !== 'string' && typeof node !== 'number') return null;
  const xy = Array.isArray(at)
    ? { x: at[0] as unknown, y: at[1] as unknown }
    : at !== null && typeof at === 'object'
      ? (at as { x?: unknown; y?: unknown })
      : null;
  if (xy === null || typeof xy.x !== 'number' || typeof xy.y !== 'number') return null;
  if (!Number.isFinite(xy.x) || !Number.isFinite(xy.y)) return null;
  return `${node}@${xy.x},${xy.y}`;
}
