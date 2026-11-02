/**
 * **2 点を指して引く寸法**（`dims`。仕様 §3.0.27）。
 *
 * ## なぜ入れたか
 *
 * 寸法は通り芯の間からしか出なかった（`src/dimensions.ts`）。通り芯の無い図 ——
 * 機械・競技場・断面・家具 —— は、寸法線を `paths` で引き、**数値を注記の箱に手で書いていた。**
 * 図形を直しても、数値は追ってこない。見本 386 の全長は、線が 558 px（1 px ＝ 25 mm で 13.95 m）
 * なのに注記は「14m」で、**図と数値がずれていても誰も気づけなかった**（`.claude/primitives-audit.md` §3-D）。
 *
 * ## 曖昧な所から測らない
 *
 * 通り芯からしか出さなかった理由は「部屋の箱から出すと、壁の厚みをどちらに数えるかで値が変わる」。
 * この決めは崩さない。**どこからどこまでを測るかを、正本に明示させる** ——
 * 点（`[x, y]`）か、**箱のどの辺か**（`{ node, side }`）。「箱から測る（辺は道具が決める）」はやらない。
 *
 * ## 描き方を 3 本にしない
 *
 * 寸法線・寸法補助線 2 本を、**辺が描かれる直前の形（`PlacedEdge`）に直すだけ**。
 * 描くのは辺と同じ `renderEdge`、数値は辺のラベルと同じ置き方（`src/edge-labels.ts`）。
 * 違うのは、数値を**線の外側**に置くこと（`labelSide`）だけ。
 *
 * ## 寸法線の位置
 *
 * `offset` は**測る物の外側から**数える。測る点のうち、寸法線の側でいちばん外にある点から
 * `|offset|` だけ離す —— 寸法線が、測る物を横切らない。符号は**進む向き（from → to）の右が正**
 * （`edges[].offset` と同じ）。辺で指したときは、その辺の端のうち寸法線に近いほうから補助線を出す。
 */
import { lengthText, inMetres } from './units.ts';
import type { Unit } from './units.ts';
import type { Point } from './curve.ts';
import type { PlacedEdge } from './layout.ts';
import type { Scale } from './grid.ts';
import { NO_ENDS } from './ends.ts';
import type { Ends } from './ends.ts';

/** 箱のどの辺か。 */
export const DIM_SIDES = ['left', 'right', 'top', 'bottom'] as const;
export type DimSide = (typeof DIM_SIDES)[number];

/** 寸法の端の形。**既定は矢印**（機械・競技場）。`tick` は斜線（建築）。 */
export const DIM_ENDS = ['arrow', 'tick'] as const;
export type DimEnd = (typeof DIM_ENDS)[number];

/** 測る点。座標か、箱の辺。 */
export type DimPoint = { point: Point } | { node: string; side: DimSide };

export interface DimInfo {
  id: string;
  from: DimPoint;
  to: DimPoint;
  /** 水平（`x`）か垂直（`y`）の成分だけを測る。書かなければ null（辺で指せば辺が決め、点だけなら from → to に沿う）。 */
  along: 'x' | 'y' | null;
  offset: number;
  /** 書いた文字。`{}` に機械の数値が入る。書かなければ null（数値だけ）。 */
  text: string | null;
  /** **略図か**（`exact: false`）。人の数値と図のずれを知らせない。 */
  exact: boolean;
  ends: DimEnd;
}

/** 測る物から補助線までの隙間（px）。**物の線と補助線をくっつけない**（製図の決まり）。 */
const GAP = 2;
/** 補助線を寸法線の先へ延ばす長さ（px）。 */
const OVER = 3;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 正本の端を読む。**読めなければ null**（`dim-end-invalid`）。知らない節かどうかは見ない。 */
export function dimPointOf(raw: unknown): DimPoint | null {
  if (Array.isArray(raw)) {
    if (raw.length !== 2) return null;
    const [x, y] = raw as unknown[];
    return finite(x) && finite(y) ? { point: { x, y } } : null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  const { node, side } = raw as Record<string, unknown>;
  if ((typeof node !== 'string' && typeof node !== 'number') || String(node) === '') return null;
  if (!DIM_SIDES.includes(side as DimSide)) return null;
  return { node: String(node), side: side as DimSide };
}

/**
 * 正本の `dims` を読む。**描けないもの（id が無い・端が読めない）は落とす** ——
 * 落とした理由は検証器が言う（`src/validate.ts` の `checkDims`）。
 */
export function readDims(raw: unknown): DimInfo[] {
  if (!Array.isArray(raw)) return [];
  const out: DimInfo[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    const dim = item as Record<string, unknown>;
    const id = dim.id;
    if ((typeof id !== 'string' && typeof id !== 'number') || String(id) === '' || seen.has(String(id))) continue;
    const from = dimPointOf(dim.from);
    const to = dimPointOf(dim.to);
    if (from === null || to === null) continue;
    seen.add(String(id));
    out.push({
      id: String(id),
      from,
      to,
      along: dim.along === 'x' || dim.along === 'y' ? dim.along : null,
      offset: finite(dim.offset) ? dim.offset : 0,
      text: typeof dim.text === 'string' || typeof dim.text === 'number' ? String(dim.text) : null,
      exact: dim.exact !== false,
      ends: DIM_ENDS.includes(dim.ends as DimEnd) ? (dim.ends as DimEnd) : 'arrow',
    });
  }
  return out;
}

/** 測った結果。座標は正本の座標（px）。 */
export interface Measured {
  /** 測る点（物の上）。 */
  from: Point;
  to: Point;
  /** 寸法線の両端。 */
  line: [Point, Point];
  /** 寸法補助線（測る点の少し外から、寸法線の少し先まで）。要らなければ null。 */
  extensions: [[Point, Point] | null, [Point, Point] | null];
  /** 測った長さ（px）。 */
  length: number;
  /** 寸法線から見て、外側の向き（単位ベクトル）。数値はこちらへ置く。 */
  outward: Point;
}

/** 測れなかった理由。 */
export type Trouble = 'node-unknown' | 'side-mismatch' | 'zero-length';

/**
 * **測る。** 辺で指したときは、その節の箱（人が動かしたあとの位置と大きさ）を使う。
 * `offset` は人の手直し（`pins.<id>.offset`）を当てたあとの値を渡す。
 */
export function measureDim(dim: DimInfo, boxOf: (id: string) => Rect | null, offset = dim.offset): Measured | Trouble {
  const axisOf = (end: DimPoint): 'x' | 'y' | null =>
    'point' in end ? null : end.side === 'left' || end.side === 'right' ? 'x' : 'y';
  const along = dim.along ?? axisOf(dim.from) ?? axisOf(dim.to);
  for (const end of [dim.from, dim.to]) {
    const axis = axisOf(end);
    if (axis !== null && axis !== along) return 'side-mismatch';
  }
  const fromCandidates = candidatesOf(dim.from, boxOf);
  const toCandidates = candidatesOf(dim.to, boxOf);
  if (fromCandidates === null || toCandidates === null) return 'node-unknown';

  // 進む向き。辺で指したときも、辺の上の点はどれも測る向きの成分が同じなので、最初の点で足りる。
  const a = fromCandidates[0]!;
  const b = toCandidates[0]!;
  const dx = along === 'y' ? 0 : b.x - a.x;
  const dy = along === 'x' ? 0 : b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) return 'zero-length';
  const d = { x: dx / length, y: dy / length };
  // 進む向きの右（紙の y は下向き）。`edges[].offset` と同じ向き。
  const right = { x: -d.y, y: d.x };
  // **0 のときは、数値を左（横の線なら上、縦の線なら右）へ置く。** 補助線は引かない。
  const sign = offset > 0 ? 1 : -1;
  const out = { x: right.x * sign, y: right.y * sign };
  const dot = (p: Point): number => p.x * out.x + p.y * out.y;
  const pick = (points: Point[]): Point => points.reduce((best, p) => (dot(p) > dot(best) ? p : best));
  const from = pick(fromCandidates);
  const to = pick(toCandidates);
  const level = Math.max(dot(from), dot(to)) + Math.abs(offset);
  const onLine = (p: Point): Point => ({ x: round(p.x + out.x * (level - dot(p))), y: round(p.y + out.y * (level - dot(p))) });
  const extension = (p: Point): [Point, Point] | null => {
    const reach = level - dot(p);
    if (reach <= GAP) return null;
    return [
      { x: round(p.x + out.x * GAP), y: round(p.y + out.y * GAP) },
      { x: round(p.x + out.x * (reach + OVER)), y: round(p.y + out.y * (reach + OVER)) },
    ];
  };
  return {
    from,
    to,
    line: [onLine(from), onLine(to)],
    extensions: [extension(from), extension(to)],
    length,
    outward: out,
  };
}

/** 測る点の候補。点ならその点、辺ならその辺の両端（寸法線に近いほうを `measureDim` が選ぶ）。 */
function candidatesOf(end: DimPoint, boxOf: (id: string) => Rect | null): Point[] | null {
  if ('point' in end) return [end.point];
  const box = boxOf(end.node);
  if (box === null) return null;
  const { x, y, w, h } = box;
  if (end.side === 'left') return [{ x, y }, { x, y: y + h }];
  if (end.side === 'right') return [{ x: x + w, y }, { x: x + w, y: y + h }];
  if (end.side === 'top') return [{ x, y }, { x: x + w, y }];
  return [{ x, y: y + h }, { x: x + w, y: y + h }];
}

/** 長さの書き方（縮尺・フィートか・単位）。縮尺が無ければ null。 */
export type Ruler = Pick<Scale, 'mm' | 'feet' | 'unit'>;

/**
 * **その寸法の縮尺**。`views` の中なら、その図の縮尺（書いていなければ紙ぜんたいの）。
 * どの図の中かは、測る 2 点の真ん中で決める（節と同じく、座標が決める。§3.0.18）。
 */
export function rulerAt(
  point: Point,
  views: readonly { x: number; y: number; w: number; h: number; mm: number | null; feet: boolean; unit: Unit | null }[],
  sheet: Ruler | null,
): Ruler | null {
  const view = views.find((v) => point.x >= v.x && point.x <= v.x + v.w && point.y >= v.y && point.y <= v.y + v.h);
  if (view === undefined || view.mm === null) return sheet;
  return { mm: view.mm, feet: view.feet, unit: view.unit };
}

/** 機械の数値（文字）。縮尺が無ければ null。 */
export function dimValue(length: number, ruler: Ruler | null): string | null {
  return ruler === null ? null : lengthText(length, ruler.mm, ruler.feet, ruler.unit);
}

/**
 * **描く文字。** `{}` に機械の数値が入る。`text` を書かなければ数値だけ。
 * 縮尺が無ければ `{}` を消す（数値を出さない）。何も残らなければ null（線だけ）。
 */
export function dimLabel(text: string | null, value: string | null): string | null {
  const template = text ?? '{}';
  const out = value === null ? template.replaceAll('{}', '').replace(/\s+/g, ' ').trim() : template.replaceAll('{}', value);
  return out === '' ? null : out;
}

/** 長さの単位 1 つが何 mm か。 */
const PER: Record<string, number> = { mm: 1, cm: 10, m: 1000, km: 1_000_000, um: 0.001, μm: 0.001, µm: 0.001 };

/**
 * **人が書いた文字の中の長さ**（mm）。単位を読む（`mm` `cm` `m` `km` `μm` `'` `"`）。
 *
 * 単位の無い数は、**図の単位**で読む（mm の図なら mm、m の図なら m）。フィートの図では読まない
 * （`12` がフィートかインチか決められない）。記号の一部の数（`H7` `g6` `t.17`）は読まない。
 */
export function writtenLengths(text: string, ruler: Ruler): number[] {
  const out: number[] = [];
  // フィートとインチ（`44'-0"` ／ `9"`）を先に取り、残りから十進の数を読む。
  const rest = text.replace(/(\d+)'(?:\s*-?\s*(\d+)")?|(\d+)"/g, (_, feet?: string, inches?: string, only?: string) => {
    const total = only !== undefined ? Number(only) : Number(feet) * 12 + Number(inches ?? 0);
    out.push(total * 25.4);
    return ' ';
  });
  const bare = ruler.feet ? null : ruler.unit ?? (inMetres(ruler.mm) ? 'm' : 'mm');
  for (const m of rest.matchAll(/(?<![A-Za-z.\d])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(mm|cm|km|m|um|μm|µm)?(?![A-Za-z])/g)) {
    const unit = m[2] ?? bare;
    if (unit === null) continue;
    out.push(Number(m[1]!.replaceAll(',', '')) * PER[unit]!);
  }
  return out;
}

/**
 * **人の数値が、機械の数値と 1 % 以上違うか**（`dim-text-differs`）。
 * 数がどれか 1 つ合えば違わない（「1.5〜2m」のような幅）。数が 1 つも無ければ見ない。
 */
export function textDiffers(text: string, length: number, ruler: Ruler): boolean {
  const written = writtenLengths(text, ruler);
  if (written.length === 0) return false;
  const machine = length * ruler.mm;
  return !written.some((value) => Math.abs(value - machine) < machine * 0.01);
}

/**
 * **描く直前の形にする**（辺と同じ `PlacedEdge`）。寸法線 1 本と、補助線 0〜2 本。
 *
 * 寸法線は寸法の `id`、補助線は `<id>/from` と `<id>/to`。**人の `pins.<id>.offset` が勝つ。**
 * 測れないもの（知らない節・辺の向きの食い違い・長さ 0）は描かない（検証器が言う）。
 */
export function routeDims(
  dims: DimInfo[],
  boxOf: (id: string) => Rect | null,
  pins: Record<string, { offset?: unknown }>,
  rulerOf: (point: Point) => Ruler | null,
): PlacedEdge[] {
  const out: PlacedEdge[] = [];
  for (const dim of dims) {
    const human = pins[dim.id]?.offset;
    const pinned = finite(human);
    const measured = measureDim(dim, boxOf, pinned ? human : dim.offset);
    if (typeof measured === 'string') continue;
    const middle = { x: (measured.from.x + measured.to.x) / 2, y: (measured.from.y + measured.to.y) / 2 };
    const label = dimLabel(dim.text, dimValue(measured.length, rulerOf(middle)));
    out.push({
      ...line(dim.id, dim.id, measured.line, { from: dim.ends, to: dim.ends }),
      label,
      pinned,
      labelSide: measured.outward,
    });
    const [head, tail] = measured.extensions;
    if (head !== null) out.push({ ...line(`${dim.id}/from`, dim.id, head, NO_ENDS), pinned });
    if (tail !== null) out.push({ ...line(`${dim.id}/to`, dim.id, tail, NO_ENDS), pinned });
  }
  return out;
}

/** 細い実線 1 本。**辺と同じ形**で、端は点のまま（`paths` と同じ）。 */
function line(id: string, dim: string, points: [Point, Point], ends: Ends): PlacedEdge {
  return {
    id,
    from: '',
    to: '',
    path: true,
    dim,
    label: null,
    points: points.map((p) => ({ ...p })),
    pinned: false,
    ends,
    line: 'solid',
    weight: 'thin',
    curve: 'none',
    close: false,
    hatch: 'none',
    vertical: 'none',
    color: null,
    casing: null,
    hatchColor: null,
    offset: 0,
  };
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 0.01px に丸める。**`-0` を 0 にする。** */
function round(value: number): number {
  return Math.round(value * 100) / 100 || 0;
}
