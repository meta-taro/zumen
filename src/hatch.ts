/**
 * **ハッチング（材料・区域の模様）**（`nodes[].hatch`）。
 *
 * ## なぜ要るか
 *
 * オーナーの指摘（2026-09-12）。
 *
 * > 路面図と弁当なんですが、**専門的な図面になれてない**と思うんです。
 * > **今の既存でできる範囲でやっている。** そこはブラッシュアップして、
 * > **その業界専用の表示**を実現してほしい。
 *
 * そのとおりだった。舗装構成の断面図を「層の名前を書いた箱の積み重ね」で描いたが、
 * **実物は材料を模様で描き分けている** —— アスコンは黒、砕石は点、路床は斜線。
 *
 * **模様は飾りではない。**
 *
 * - **名前を読まなくても材料が分かる。** 図面は縮小して見るもので、
 *   小さくすると文字は消えるが**模様は残る**
 * - **同じ材料が離れた場所にあることが、一目で分かる**（区域の塗り分け）
 * - 白黒で印刷しても消えない（`DESIGN.md` §7 と同じ考え）
 *
 * ## 値は模様の名前だけ
 *
 * `marker` と同じ約束（`src/marker.ts`）。
 * **`hatch: asphalt`（アスコン）のような材料の語は足さない。**
 * そこを開けると業界ごとに語彙が増える（D22 で断ったもの）。
 *
 * | 値 | 模様 | 何に当てるか |
 * |---|---|---|
 * | `none`（既定） | 無地 | ふつうの部屋・区画 |
 * | `solid` | 塗り潰し | アスコン・コンクリート・躯体 |
 * | `dots` | 点 | 砕石・砂・盛土 |
 * | `lines` | 斜線 | 地盤・路床・既存部分 |
 * | `cross` | 格子 | 撤去・除外・立入禁止の区域 |
 *
 * ## `<pattern>` を使わない
 *
 * SVG の `<pattern>` で描くほうが短いが、**貼り先で崩れる恐れがある**
 * （Issue 007。使う機能を狭めるという約束）。
 * **線と点を数えて置く。** 要素は増えるが、崩れない。
 *
 * 間隔には下限を置く（**細かすぎると潰れて黒い面になる**）。
 */
import type { Rect } from './openings.ts';

export const HATCHES = ['none', 'solid', 'dots', 'lines', 'cross'] as const;
export type Hatch = (typeof HATCHES)[number];

export function hatchOf(raw: unknown): Hatch {
  return HATCHES.includes(raw as Hatch) ? (raw as Hatch) : 'none';
}

/** 模様の間隔（px）。**これより細かくしない。** */
const STEP = 9;
/** 1 つの箱に置く線の上限。**広い面で要素が膨らむのを止める。** */
const LIMIT = 160;

function n(value: number): number {
  return Math.round(value);
}

/**
 * 模様を描く。
 *
 * **箱の縁からはみ出さない。** はみ出すと隣の区画の模様と混ざって、
 * どこまでが同じ材料か読めなくなる。
 */
export function drawHatch(hatch: Hatch, box: Rect, stroke: string): string {
  if (hatch === 'none' || box.w <= 2 || box.h <= 2) return '';

  if (hatch === 'solid') {
    // 塗り潰し。**枠は別に描かれているので、ここは面だけ。**
    return `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="${stroke}" fill-opacity="0.82"/>`;
  }

  const parts: string[] = [];

  if (hatch === 'dots') {
    let count = 0;
    for (let y = box.y + STEP / 2; y < box.y + box.h; y += STEP) {
      for (let x = box.x + STEP / 2; x < box.x + box.w; x += STEP) {
        if (count >= LIMIT * 3) break;
        parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="0.9" fill="${stroke}"/>`);
        count += 1;
      }
    }
    return parts.join('');
  }

  // 斜線と格子。**45 度**（製図の決まり）。
  //
  // 直線の族として数える —— 右下がりは `y - x = c`、右上がりは `y + x = c`。
  // **左辺からだけ引くと、箱の右上が埋まらない**（2026-09-12 に実際に踏んだ。
  // 幅 400 の路床で、左下の三角しか斜線が入らなかった）。
  let count = 0;
  for (const dir of hatch === 'cross' ? ([1, -1] as const) : ([1] as const)) {
    const from = dir === 1 ? box.y - (box.x + box.w) : box.y + box.x;
    const to = dir === 1 ? box.y + box.h - box.x : box.y + box.h + box.x + box.w;
    for (let c = Math.ceil(from / STEP) * STEP; c <= to; c += STEP) {
      if (count >= LIMIT * 2) break;
      const seg = span(box, c, dir);
      if (seg === null) continue;
      parts.push(
        `<line x1="${n(seg.a.x)}" y1="${n(seg.a.y)}" x2="${n(seg.b.x)}" y2="${n(seg.b.y)}" ` +
          `stroke="${stroke}" stroke-width="0.7"/>`,
      );
      count += 1;
    }
  }
  return parts.join('');
}

/**
 * 箱の中に収まる区間を出す。収まらなければ null。
 *
 * `dir` が 1 なら `y - x = c`、-1 なら `y + x = c`。
 */
function span(
  box: Rect,
  c: number,
  dir: 1 | -1,
): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
  const lo = box.x;
  const hi = box.x + box.w;
  const top = box.y;
  const bottom = box.y + box.h;
  const yAt = (x: number): number => (dir === 1 ? x + c : c - x);
  const xAt = (y: number): number => (dir === 1 ? y - c : c - y);

  const found: { x: number; y: number }[] = [];
  for (const x of [lo, hi]) {
    const y = yAt(x);
    if (y >= top && y <= bottom) found.push({ x, y });
  }
  for (const y of [top, bottom]) {
    const x = xAt(y);
    if (x > lo && x < hi) found.push({ x, y });
  }
  if (found.length < 2) return null;
  return { a: found[0]!, b: found[1]! };
}
