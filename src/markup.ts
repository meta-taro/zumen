/**
 * **赤入れ**（`markup`）。図の上に重ねる、人へ伝えるための手書きの線と付箋。
 *
 * 2026-10-20（D46）。図を見た人が「ここを太く」「この線は要らない」を、図そのものを変えずに書き込みたい。
 *
 * - **図には効かない。** 描画にも、意味の指紋（`review`）にも、AI の提案のマージにも入らない
 * - **正本の中に置く。** ファイルを渡せば赤入れも一緒に渡る（D4：人の指定を別ファイルへ逃がさない）
 * - **AI は読めるが書けない**（`pins` と同じ）。人が書き、AI が案を出し、人が承認する往復に乗る
 * - **箱に結べる**（`on`）。結んだ赤入れの座標は箱の左上から測るので、AI が箱を動かしてもついていく
 *
 * ```yaml
 * markup:
 *   - ink: [[10, 20], [40, 60], [80, 70]]   # 手書きの線（点の並び）
 *     color: blue                            # red（既定）/ blue / green / black / orange
 *     width: thick                           # thin / normal（既定）/ thick
 *   - note: ここを太く                        # 付箋
 *     at: { x: 120, y: 40 }
 *     on: db                                 # 結ぶ箱の id（書かなければ紙の座標）
 * ```
 */

export interface Point {
  x: number;
  y: number;
}

/** 選べる色。**数色に絞る** —— 赤入れは伝えるための印で、作図の色ではない。 */
export const MARKUP_COLORS = {
  red: '#d0312d',
  blue: '#1f5fbf',
  green: '#2e8b3e',
  black: '#222222',
  orange: '#e07b00',
} as const;
export type MarkupColor = keyof typeof MARKUP_COLORS;

/** 線の太さ（px）。語は図の線と同じ thin / normal / thick。 */
export const MARKUP_WIDTHS = { thin: 1.5, normal: 3, thick: 6 } as const;
export type MarkupWidth = keyof typeof MARKUP_WIDTHS;

interface Common {
  color: MarkupColor;
  width: MarkupWidth;
  /** 結んだ箱の id。null なら紙の座標。 */
  on: string | null;
}
export type Markup = ({ kind: 'ink'; points: Point[] } | { kind: 'note'; text: string; at: Point }) & Common;

const isColor = (v: unknown): v is MarkupColor => typeof v === 'string' && Object.hasOwn(MARKUP_COLORS, v);
const isWidth = (v: unknown): v is MarkupWidth => typeof v === 'string' && Object.hasOwn(MARKUP_WIDTHS, v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** `[x, y]` か `{ x, y }`。読めなければ null。 */
export function pointOf(v: unknown): Point | null {
  if (Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1])) return { x: v[0], y: v[1] };
  if (v !== null && typeof v === 'object') {
    const r = v as Record<string, unknown>;
    if (num(r.x) && num(r.y)) return { x: r.x, y: r.y };
  }
  return null;
}

/** 手書きの線の点。2 点に満たなければ null。 */
export function inkOf(v: unknown): Point[] | null {
  if (!Array.isArray(v)) return null;
  const points = v.map(pointOf);
  if (points.length < 2 || points.some((p) => p === null)) return null;
  return points as Point[];
}

/**
 * 読めない項目は落とす（`validate` が知らせる）。色・太さが選べない語なら既定へ戻す。
 */
export function markupOf(raw: unknown): Markup[] {
  if (!Array.isArray(raw)) return [];
  const out: Markup[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const common: Common = {
      color: isColor(r.color) ? r.color : 'red',
      width: isWidth(r.width) ? r.width : 'normal',
      on: typeof r.on === 'string' && r.on.trim() !== '' ? r.on.trim() : null,
    };
    if ('ink' in r) {
      const points = inkOf(r.ink);
      if (points !== null) out.push({ kind: 'ink', points, ...common });
      continue;
    }
    if (typeof r.note === 'string' && r.note.trim() !== '') {
      const at = pointOf(r.at);
      if (at !== null) out.push({ kind: 'note', text: r.note.trim(), at, ...common });
    }
  }
  return out;
}

export const isMarkupColor = isColor;
export const isMarkupWidth = isWidth;
