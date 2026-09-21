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
import type { Marker } from './marker.ts';
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
/**
 * **塗りと模様が乗る形**（`src/marker.ts` の印と同じ形）。
 *
 * 丸い印を四角で塗ると、**丸の上に四角が乗る**（2026-09-13。
 * 停車駅案内図の ● で踏んだ）。形は印が決めているので、面もそれに従う。
 */
function faceOf(marker: Marker, box: Rect, attrs: string): string {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (marker === 'circle' || marker === 'double') {
    return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.min(box.w, box.h) / 2)}" ${attrs}/>`;
  }
  if (marker === 'ellipse') {
    return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(box.w / 2)}" ry="${n(box.h / 2)}" ${attrs}/>`;
  }
  if (marker === 'triangle') {
    const d = `M ${n(cx)} ${n(box.y)} L ${n(box.x + box.w)} ${n(box.y + box.h)} L ${n(box.x)} ${n(box.y + box.h)} Z`;
    return `<path d="${d}" ${attrs}/>`;
  }
  if (marker === 'triangle-down') {
    const d = `M ${n(box.x)} ${n(box.y)} L ${n(box.x + box.w)} ${n(box.y)} L ${n(cx)} ${n(box.y + box.h)} Z`;
    return `<path d="${d}" ${attrs}/>`;
  }
  if (marker === 'diamond') {
    const d = `M ${n(cx)} ${n(box.y)} L ${n(box.x + box.w)} ${n(cy)} L ${n(cx)} ${n(box.y + box.h)} L ${n(box.x)} ${n(cy)} Z`;
    return `<path d="${d}" ${attrs}/>`;
  }
  return `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" ${attrs}/>`;
}

/** 切り抜きの名前に使える字だけにする（`id` は人が書くもの）。 */
function slug(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * **面の色**（`nodes[].fill`）。枠も模様も描かず、**面だけ**を薄く敷く。
 * 印の形（丸・菱形）に沿わせるので、`faceOf` をここから使う。
 */
export function drawTint(box: Rect, color: string, opacity: number, marker: Marker = 'box'): string {
  // **細い面にも敷く**（2026-09-20）。塗り潰しと同じ理由 ——
  // 下限は模様を置く余地の話で、面の色には要らない。
  // いまの見本に該当は無いが、**片方だけ描けるほうが罠になる。**
  if (box.w <= 0 || box.h <= 0) return '';
  return faceOf(marker, box, `fill="${color}" fill-opacity="${opacity}" stroke="none"`);
}

/**
 * **点・斜線・格子が読めない面**（2026-09-20）。
 *
 * - **点**は `STEP` 間隔で置くので、**短辺が半間隔に満たない面には 1 つも乗らない。**
 * - **斜線・格子**は箱で切り取るので、短辺が細いほど**切れ端が短くなる。**
 *   3px を切ると、線ではなく点の列に見える（＝模様として読めない）。
 *
 * 描かれないこと自体は正しいが、**黙って無地になるのが良くない** ——
 * 書いた人は模様を頼んだのに、無地と見分けがつかない図が出る。
 * 測ったら**見本 4 枚・10 節**が該当した（線のつもりで細い箱に模様を書いたもの）。
 *
 * `drawHatch` と検査の両方がここを見る。**判定を 2 か所に書かない。**
 */
export function tooThinForPattern(hatch: Hatch, box: Rect): boolean {
  const min = Math.min(box.w, box.h);
  if (hatch === 'dots') return min <= STEP / 2;
  if (hatch === 'lines' || hatch === 'cross') return min < 3;
  return false;
}

export function drawHatch(
  hatch: Hatch,
  box: Rect,
  stroke: string,
  marker: Marker = 'box',
  id = '',
): string {
  if (hatch === 'none' || box.w <= 0 || box.h <= 0) return '';

  if (hatch === 'solid') {
    /**
     * 塗り潰し。**枠は別に描かれているので、ここは面だけ。**
     *
     * **細い面にも塗る**（2026-09-20）。前は 2px 以下の面を模様ごと断っていたが、
     * その下限は**点や斜線を置く余地**の話で、塗り潰しには要らない ——
     * 幅 2px の垂木は塗れる。測ったら**見本 10 枚・67 節**が
     * 「`hatch: solid` と書いたのに面が塗られていない」状態だった
     * （屋根伏図の垂木 44 本、車線規制図の車線、冷蔵庫の放熱スペース）。
     */
    return faceOf(marker, box, `fill="${stroke}" fill-opacity="0.82"`);
  }

  // **点・斜線・格子は、置く余地が要る。**
  // 余地が無いときは 1 つも描かない —— そのことは検査（`hatch-too-thin`）が言う。
  if (tooThinForPattern(hatch, box)) return '';

  const parts: string[] = [];

  if (hatch === 'dots') {
    /**
     * **上限に当たったとき、間隔を広げる**（2026-09-19）。
     *
     * 前は数えて `break` していたが、**抜けるのは内側のくり返しだけ**だった ——
     * 上限に届いたあとの行は 1 つも描かれず、**箱の上だけが埋まった面**が出ていた。
     * 測ったら**見本 9 枚**がそうなっていた（ビリヤード台の羅紗は **20%** しか点がない）。
     *
     * **半分だけ模様が入った面は、無地より悪い** —— 材料が途中で変わって見える。
     * 上限は要素数を抑えるためのものなので、**間隔のほうを広げて面ぜんたいを埋める。**
     */
    const step = spread(STEP, (Math.ceil(box.w / STEP) + 1) * (Math.ceil(box.h / STEP) + 1), LIMIT * 3);
    for (let y = box.y + step / 2; y < box.y + box.h; y += step) {
      for (let x = box.x + step / 2; x < box.x + box.w; x += step) {
        parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="0.9" fill="${stroke}"/>`);
      }
    }
    return clipped(parts.join(''), marker, box, id);
  }

  // 斜線と格子。**45 度**（製図の決まり）。
  //
  // 直線の族として数える —— 右下がりは `y - x = c`、右上がりは `y + x = c`。
  // **左辺からだけ引くと、箱の右上が埋まらない**（2026-09-12 に実際に踏んだ。
  // 幅 400 の路床で、左下の三角しか斜線が入らなかった）。
  // **点と同じ扱い**（2026-09-19）。数えて止めると、箱の片側だけに斜線が入る。
  const ways = hatch === 'cross' ? 2 : 1;
  const step = spread(STEP, Math.ceil((box.w + box.h) / STEP) * ways + ways, LIMIT * 2);
  for (const dir of hatch === 'cross' ? ([1, -1] as const) : ([1] as const)) {
    const from = dir === 1 ? box.y - (box.x + box.w) : box.y + box.x;
    const to = dir === 1 ? box.y + box.h - box.x : box.y + box.h + box.x + box.w;
    for (let c = Math.ceil(from / step) * step; c <= to; c += step) {
      const seg = span(box, c, dir);
      if (seg === null) continue;
      parts.push(
        `<line x1="${n(seg.a.x)}" y1="${n(seg.a.y)}" x2="${n(seg.b.x)}" y2="${n(seg.b.y)}" ` +
          `stroke="${stroke}" stroke-width="0.7"/>`,
      );
    }
  }
  return clipped(parts.join(''), marker, box, id);
}

/**
 * **入りきらないときの間隔。**
 *
 * `want` 個が上限 `limit` を超えるなら、**その分だけ間隔を広げる。**
 * 数えて途中で止めると、面の片側だけに模様が入る（2026-09-19 に 9 枚で踏んだ）。
 */
function spread(step: number, want: number, limit: number): number {
  return want <= limit ? step : step * Math.sqrt(want / limit);
}

/**
 * **閉じた輪の中を塗る**（`edges[].hatch`。2026-09-15）。
 *
 * 池・敷地・区画のように、**輪郭ではなく面**を表す図で要る。
 * README が長く「まだ無いもの」に挙げていた**面の塗り**がこれ
 * （「池の輪郭は描けるが、塗れない」）。
 *
 * やり方は矩形のときと同じ —— **外接矩形に模様を描いて、輪で切り抜く。**
 * 輪は `close: true` の辺が引いた道そのものなので、
 * **曲線でも折れ線でも同じように効く。**
 */
export function drawHatchIn(hatch: Hatch, path: string, box: Rect, stroke: string, id: string): string {
  if (hatch === 'none' || box.w <= 2 || box.h <= 2) return '';
  if (hatch === 'solid') return `<path d="${path}" fill="${stroke}" fill-opacity="0.82" stroke="none"/>`;
  const body = drawHatch(hatch, box, stroke, 'box', id);
  if (body === '') return '';
  const name = `face-${slug(id)}`;
  return `<clipPath id="${name}"><path d="${path}"/></clipPath><g clip-path="url(#${name})">${body}</g>`;
}

/**
 * **模様は印からはみ出さない。**
 *
 * 矩形はそのまま（切り抜きは要らない）。丸や菱形のときだけ、印の形で切る。
 */
function clipped(body: string, marker: Marker, box: Rect, id: string): string {
  if (body === '' || marker === 'box' || marker === 'none' || marker === 'bar') return body;
  const name = `hatch-${slug(id)}`;
  return `<clipPath id="${name}">${faceOf(marker, box, '')}</clipPath><g clip-path="url(#${name})">${body}</g>`;
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
