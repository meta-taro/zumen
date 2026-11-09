/**
 * **刷る紙の大きさ**（`paper:`。2026-11-10）。
 *
 * ## なぜ要るか
 *
 * 解答用紙（見本 411〜415）・配席表・掲示物は、**刷って配る図**。
 * それまでの SVG は px で幅を言うだけだったので、刷ると紙の大きさは
 * 印刷ダイアログの「合わせる」任せで、**B4 の様式が A4 に縮んで出ても誰も気づけない。**
 *
 * ## 何をするか —— **紙から逆算して作れるように**
 *
 * - SVG の幅と高さを **mm で書く**（`width="257mm"`）。ブラウザも印刷も、その大きさで出す
 * - **1 px は 96 dpi の 1 px（0.2646 mm）で紙に載せる。** 画面で見た大きさのまま刷られる。
 *   だから紙を決めた時点で、**余白の内側が何 px か**（B4 の縦なら 896 × 1300 px）が分かり、
 *   その枠に合わせて図を作れる（アプリは紙の枠を画面に出す）
 * - 図の左上は、紙の余白の左上に来る（正本の (0, 0) が紙のどこかが動かない）
 * - **はみ出したら、縮めて 1 枚に収める。** 黙って縮めず、検査が何割に縮めたかを言う
 * - 地の色は紙いっぱいに敷く
 *
 * 図の座標（px）は変えない。**紙を決めても、正本の `at` と `size` はそのまま。**
 *
 * ## 縮尺（`scale`）とは別
 *
 * `scale.mm` は**描いた物の実寸**（1 px が現実の何 mm か）。
 * `paper` は**紙の上の大きさ**。同じ図に両方書ける。
 */

/** JIS P 0138 の A 列・B 列と、北米の紙（mm、縦長で書く）。 */
export const PAPER_SIZES = {
  A3: { w: 297, h: 420 },
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  B4: { w: 257, h: 364 },
  B5: { w: 182, h: 257 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
  Tabloid: { w: 279.4, h: 431.8 },
} as const;
export type PaperSize = keyof typeof PAPER_SIZES;
export const PAPER_NAMES = Object.keys(PAPER_SIZES) as PaperSize[];

export const ORIENTS = ['portrait', 'landscape'] as const;
export type Orient = (typeof ORIENTS)[number];

/** 既定の余白（mm）。家庭用・事務用のプリンタが刷れない縁より少し広く。 */
export const DEFAULT_MARGIN = 10;

export interface Paper {
  size: PaperSize;
  orient: Orient;
  /** 紙の幅と高さ（mm。向きを入れたあと）。 */
  w: number;
  h: number;
  /** 余白（mm）。四辺とも同じ。 */
  margin: number;
}

/** 大文字・小文字を問わずに紙の名前を引く（`b4` も `B4`）。 */
function sizeOf(raw: unknown): PaperSize | null {
  if (typeof raw !== 'string') return null;
  return PAPER_NAMES.find((name) => name.toLowerCase() === raw.trim().toLowerCase()) ?? null;
}

/**
 * 正本の `paper` を読む。**読めなければ null**（紙を決めない＝これまでどおり px の SVG）。
 *
 * 書き方は 2 通り：`paper: B4` ／ `paper: { size: B4, orient: landscape, margin: 12 }`。
 */
export function paperOf(raw: unknown): Paper | null {
  const map = typeof raw === 'object' && raw !== null ? (raw as { size?: unknown; orient?: unknown; margin?: unknown }) : { size: raw };
  const size = sizeOf(map.size);
  if (size === null) return null;
  const orient: Orient = map.orient === 'landscape' ? 'landscape' : 'portrait';
  const base = PAPER_SIZES[size];
  const [w, h] = orient === 'landscape' ? [base.h, base.w] : [base.w, base.h];
  const margin = typeof map.margin === 'number' && Number.isFinite(map.margin) && map.margin >= 0 && map.margin * 2 < Math.min(w, h) ? map.margin : DEFAULT_MARGIN;
  return { size, orient, w, h, margin };
}

/** 検証器が言うこと。**黙って既定へ落とさない。** */
export function paperTroubles(raw: unknown): ('size' | 'orient' | 'margin')[] {
  if (raw === undefined || raw === null) return [];
  const map = typeof raw === 'object' ? (raw as { size?: unknown; orient?: unknown; margin?: unknown }) : { size: raw };
  const out: ('size' | 'orient' | 'margin')[] = [];
  if (sizeOf(map.size) === null) out.push('size');
  if (map.orient !== undefined && !ORIENTS.includes(map.orient as Orient)) out.push('orient');
  if (map.margin !== undefined && (typeof map.margin !== 'number' || !(map.margin >= 0))) out.push('margin');
  return out;
}

/** **96 dpi の 1 px（mm）。** 紙を決めた図は、はみ出さない限りこの大きさで刷る。 */
export const MM_PER_PX = 25.4 / 96;

/** **余白の内側が何 px か**（96 dpi）。紙から逆算して作るときの枠。 */
export function printableArea(paper: Paper): { w: number; h: number } {
  return { w: (paper.w - paper.margin * 2) / MM_PER_PX, h: (paper.h - paper.margin * 2) / MM_PER_PX };
}

/**
 * **1 px が紙の上で何 mm になるか。** はみ出さなければ 96 dpi のまま、
 * はみ出せば余白の内側へ比を保って縮める（拡げはしない）。
 */
export function printScale(paper: Paper, width: number, height: number): number {
  return Math.min(MM_PER_PX, (paper.w - paper.margin * 2) / width, (paper.h - paper.margin * 2) / height);
}

/** **何割に縮めて刷るか。** はみ出していなければ 1。 */
export function shrinkOf(paper: Paper, width: number, height: number): number {
  return printScale(paper, width, height) / MM_PER_PX;
}

/**
 * 紙ぜんたいを px の座標で言う（`viewBox`）。
 * 図の (0, 0) は、紙の余白の左上に来る。
 */
export function pageBox(paper: Paper, width: number, height: number): { x: number; y: number; w: number; h: number } {
  const k = printScale(paper, width, height);
  return { x: -paper.margin / k, y: -paper.margin / k, w: paper.w / k, h: paper.h / k };
}

/** 1 pt は 1/72 インチ。 */
export const MM_PER_PT = 25.4 / 72;

/**
 * **SVG の大きさを px で読む。** 紙を決めた図は幅が `257mm` なので、`viewBox` から読む。
 * 読めなければ null。画面に撮る・ページに寸法を書く側が使う。
 */
export function svgPixels(svg: string): { w: number; h: number } | null {
  const head = /<svg\b[^>]*>/.exec(svg)?.[0];
  if (head === undefined) return null;
  const px = /\swidth="([\d.]+)" height="([\d.]+)"/.exec(head);
  if (px !== null) return { w: Math.ceil(Number(px[1])), h: Math.ceil(Number(px[2])) };
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(head);
  return box === null ? null : { w: Math.ceil(Number(box[1])), h: Math.ceil(Number(box[2])) };
}
