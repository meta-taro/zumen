/**
 * **通り芯と寸法線を描く**（`src/grid.ts` の続き）。
 *
 * 実物に合わせた書き方。
 *
 * - **通り芯は一点鎖線**で、建物の外まで伸ばす。端に**符号を丸で囲んで**置く
 * - **寸法線は建物の外**に、内から順に「芯どうしの寸法」「総寸法」の 2 段
 * - 端は**斜めの短い線**（建築の図面では矢印より斜線が普通）
 * - 数値は**線の上**に置く。線の上下どちらでもよいが、揃っていないと読めない
 *
 * **寸法は通り芯からしか出さない。** 部屋の箱から出すと、
 * 壁の厚みをどちらに数えるかで値が変わり、**現場で食い違う**。
 * 実物の図面が通り芯を基準にしているのは、そこを一意にするため。
 */
import type { Axis, Grid, North } from './grid.ts';
import { MARGIN } from './grid.ts';

export interface Frame {
  /** 図の中身の矩形（余白を足したあとの絶対座標）。 */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Ink {
  /** 線の色。 */
  stroke: string;
  /** 文字の色。 */
  text: string;
  /** 地の色。**数値の下に敷いて線を切る**（実物の図面も数値のところで線が切れる）。 */
  paper: string;
  /** 書体。 */
  font: string;
}

/** 一点鎖線。**通り芯の決まりごと**（実線でも破線でもない）。 */
const CHAIN = '14 3 3 3';
/** 符号を囲む丸の半径。 */
const CODE_R = 12;

function n(value: number): number {
  return Math.round(value);
}

/**
 * 通り芯を描く。
 *
 * 座標は**余白を足したあとのもの**（`src/layout.ts` でずらしてある）。
 * ここで余白を知る必要は無い。
 */
export function drawGrid(grid: Grid, frame: Frame, ink: Ink): string {
  const parts: string[] = [];
  const top = frame.y - MARGIN.top + CODE_R + 4;
  const bottom = frame.y + frame.h + MARGIN.code;
  const left = frame.x - MARGIN.code;
  const right = frame.x + frame.w + MARGIN.right - CODE_R - 4;

  for (const axis of grid.x) {
    const x = axis.at;
    if (axis.mark === 'tick') {
      // **時間軸。** 目盛りの線と、上に名前だけ（丸で囲むと通り芯に見える）。
      parts.push(line(x, frame.y - 10, x, frame.y + frame.h, ink.stroke, CHAIN));
      parts.push(
        `<text x="${n(x)}" y="${n(frame.y - 16)}" text-anchor="middle" font-family="${ink.font}" font-size="11" fill="${ink.text}">${axis.id}</text>`,
      );
      continue;
    }
    parts.push(line(x, top, x, bottom, ink.stroke, CHAIN));
    parts.push(code(x, top - CODE_R - 2, axis.id, ink));
    parts.push(code(x, bottom + CODE_R + 2, axis.id, ink));
  }
  for (const axis of grid.y) {
    const y = axis.at;
    parts.push(line(left, y, right, y, ink.stroke, CHAIN));
    if (axis.mark === 'tick') {
      parts.push(line(frame.x - 10, y, frame.x + frame.w, y, ink.stroke, CHAIN));
      parts.push(
        `<text x="${n(frame.x - 16)}" y="${n(y + 4)}" text-anchor="end" font-family="${ink.font}" font-size="11" fill="${ink.text}">${axis.id}</text>`,
      );
      continue;
    }
    if (axis.mark === 'level') {
      // **高さの基準線**（断面図・立面図）。丸ではなく三角と値。
      parts.push(level(left - 4, y, axis.id, ink, 'left'));
      parts.push(level(right + 4, y, axis.id, ink, 'right'));
      continue;
    }
    parts.push(code(left - CODE_R - 2, y, axis.id, ink));
    parts.push(code(right + CODE_R + 2, y, axis.id, ink));
  }
  return parts.join('');
}

/**
 * 寸法線を描く。**`scale` が無ければ何も描かない。**
 *
 * 知らない縮尺で数値を出すより、出さないほうがよい。
 * 現場では、**寸法が間違っていることの害が、無いことより大きい。**
 */
export function drawDimensions(grid: Grid, frame: Frame, mm: number | null, ink: Ink): string {
  if (mm === null) return '';
  const parts: string[] = [];

  // **時間軸には寸法を引かない。** 名前が既に時刻を言っているので、
  // 引くと `60 / 60 / 60 / 総 240` という意味のない数字が並ぶ。
  const spanX = grid.x.filter((axis) => axis.mark !== 'tick');
  const spanY = grid.y.filter((axis) => axis.mark !== 'tick');

  // 下側 —— 横方向の寸法。
  if (spanX.length >= 2) {
    const near = frame.y + frame.h + MARGIN.near;
    parts.push(chainOf(spanX, near, mm, ink, 'x'));
    // **芯が 2 本なら、総寸法は芯どうしの寸法と同じ。** 同じ数字を 2 段書かない。
    if (spanX.length > 2) {
      parts.push(totalOf(spanX, frame.y + frame.h + MARGIN.far, mm, ink, 'x'));
    }
  }
  // 左側 —— 縦方向の寸法。
  if (spanY.length >= 2) {
    parts.push(chainOf(spanY, frame.x - MARGIN.near, mm, ink, 'y'));
    if (spanY.length > 2) {
      parts.push(totalOf(spanY, frame.x - MARGIN.far, mm, ink, 'y'));
    }
  }
  return parts.join('');
}

/** 芯どうしの寸法を、隣どうしで並べる。 */
function chainOf(
  axes: Axis[],
  at: number,
  mm: number,
  ink: Ink,
  axis: 'x' | 'y',
): string {
  const parts: string[] = [];
  for (let i = 0; i + 1 < axes.length; i += 1) {
    parts.push(segment(axes[i]!.at, axes[i + 1]!.at, at, mm, ink, axis));
  }
  return parts.join('');
}

/** 総寸法。**端から端まで 1 本。** */
function totalOf(
  axes: Axis[],
  at: number,
  mm: number,
  ink: Ink,
  axis: 'x' | 'y',
): string {
  return segment(axes[0]!.at, axes[axes.length - 1]!.at, at, mm, ink, axis);
}

/**
 * 寸法 1 本。線・両端の斜線・数値。
 *
 * `axis === 'x'` なら `at` は y 座標（下側に水平な線）、
 * `axis === 'y'` なら `at` は x 座標（左側に垂直な線）。
 */
function segment(
  from: number,
  to: number,
  at: number,
  mm: number,
  ink: Ink,
  axis: 'x' | 'y',
): string {
  const value = Math.round(Math.abs(to - from) * mm);
  const mid = (from + to) / 2;
  const horizontal = axis === 'x';

  const body = horizontal
    ? line(from, at, to, at, ink.stroke, null)
    : line(at, from, at, to, ink.stroke, null);

  // 端の斜線。**建築の図面では矢印より斜線が普通。**
  const tick = (pos: number): string =>
    horizontal
      ? line(pos - 4, at + 4, pos + 4, at - 4, ink.stroke, null)
      : line(at - 4, pos - 4, at + 4, pos + 4, ink.stroke, null);

  // 数値は線の外側へ。縦のときは 90 度回す（図面の決まり）。
  //
  // **数値の下に地の色を敷く。** 通り芯が数値の上を通ると読めない。
  // 実物の図面でも、数値のところで線が切れている。
  const width = String(value).length * 6 + 6;
  const tx = horizontal ? mid : at - 5;
  const ty = horizontal ? at - 5 : mid;
  const erase = horizontal
    ? `<rect x="${n(mid - width / 2)}" y="${n(at - 15)}" width="${n(width)}" height="13" fill="${ink.paper}"/>`
    : `<rect x="${n(at - 16)}" y="${n(mid - width / 2)}" width="13" height="${n(width)}" fill="${ink.paper}"/>`;
  const turn = horizontal ? '' : ` transform="rotate(-90 ${n(tx)} ${n(ty)})"`;
  const label = `<text x="${n(tx)}" y="${n(ty)}" text-anchor="middle" font-family="${ink.font}" font-size="10" fill="${ink.text}"${turn}>${value}</text>`;

  return body + tick(from) + tick(to) + erase + label;
}

/**
 * **高さの基準線の印**（`GL±0` / `2FL+3,200`）。
 *
 * 実物の断面図では、丸ではなく**塗った三角**を線の上に置き、
 * その脇に値を書く。**丸は平面の通り芯の記号**なので、
 * 断面で使うと「この線は通り芯だ」と読まれる。
 */
function level(x: number, y: number, id: string, ink: Ink, side: 'left' | 'right'): string {
  const dir = side === 'left' ? -1 : 1;
  const tip = x + dir * 2;
  return (
    `<path d="M ${n(tip)} ${n(y)} L ${n(tip + dir * 11)} ${n(y - 6)} L ${n(tip + dir * 11)} ${n(y + 6)} Z" fill="${ink.stroke}"/>` +
    `<text x="${n(x + dir * 15)}" y="${n(y - 5)}" text-anchor="${side === 'left' ? 'end' : 'start'}" font-family="${ink.font}" font-size="10" fill="${ink.text}">${id}</text>`
  );
}

/** 符号を丸で囲んで置く。**丸の中は地の色で塗る**（芯の線が文字に重なる）。 */
function code(x: number, y: number, id: string, ink: Ink): string {
  return (
    `<circle cx="${n(x)}" cy="${n(y)}" r="${CODE_R}" fill="${ink.paper}" stroke="${ink.stroke}"/>` +
    `<text x="${n(x)}" y="${n(y + 4)}" text-anchor="middle" font-family="${ink.font}" font-size="11" fill="${ink.text}">${id}</text>`
  );
}

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  dash: string | null,
): string {
  const dashed = dash === null ? '' : ` stroke-dasharray="${dash}"`;
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-width="1"${dashed}/>`;
}

/**
 * 方位記号。**右上に置く。**
 *
 * 実物では円の中に矢印と「N」。**向きだけが情報**なので、装飾は足さない。
 */
export function drawNorth(north: North, frame: Frame, ink: Ink): string {
  const cx = frame.x + frame.w + MARGIN.right / 2 - 6;
  const cy = frame.y - MARGIN.top / 2;
  const angle = { up: 0, right: 90, down: 180, left: 270 }[north];
  return (
    `<g transform="rotate(${angle} ${n(cx)} ${n(cy)})">` +
    `<path d="M ${n(cx)} ${n(cy - 13)} L ${n(cx + 5)} ${n(cy + 9)} L ${n(cx)} ${n(cy + 4)} L ${n(cx - 5)} ${n(cy + 9)} Z" fill="${ink.stroke}"/>` +
    '</g>' +
    `<text x="${n(cx)}" y="${n(cy + 22)}" text-anchor="middle" font-family="${ink.font}" font-size="10" fill="${ink.text}">N</text>`
  );
}
