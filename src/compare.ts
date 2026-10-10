/**
 * **変更前と変更後を並べる**（`pnpm compare`。2026-10-10）。
 *
 * AI の書き換えを、YAML を読まない人（専門家・上司）にも見せる。
 * 左に変更前、右に変更後を**同じ縮尺で並べ**、印を 3 つだけ付ける。
 *
 * | 印 | どこに | 意味 |
 * |---|---|---|
 * | 太枠と「新」 | 変更後 | 足された節 |
 * | 点線の枠と「消」 | 変更前 | 消えた節 |
 * | 「人」 | 両方 | 人が `pins` で置いた節 —— **AI が描き直しても、人の直しが残っている**のが並べると見える |
 *
 * **重ねない。** 承認の窓で図の上に変更を重ねない決まり（DESIGN.md §2.5）に合わせ、
 * 2 枚を横に並べる。差分の行（YAML）は承認の窓の仕事で、ここは絵だけ。
 *
 * 競合（IcePanel の現在と将来・Eraser の差分）にあって zumen に無かった（`docs/aeo/competitors-2026-10-10.md`）。
 */
import { getPins, parse } from './format.ts';
import type { Images } from './image.ts';
import { kindOf } from './kind.ts';
import { layout } from './layout.ts';
import type { Box, Placed } from './layout.ts';
import { messages } from './messages.ts';
import { render } from './render.ts';
import type { Intent, Theme } from './tokens.ts';
import { paletteOf } from './tokens.ts';

export interface CompareOptions {
  theme?: Theme;
  intent?: Intent;
  /** 変更前・変更後それぞれの読んでおいた画像（`src/image-files.ts`）。 */
  images?: { before?: Images; after?: Images };
}

export interface Comparison {
  svg: string;
  added: string[];
  removed: string[];
  /** 両方で人が置いた節（人の直しが残った節）。 */
  kept: string[];
}

/** 2 枚の間の空き、見出しの高さ、印の字の大きさ（px）。 */
const GAP = 48;
const HEAD = 34;
const MARK_FONT = 11;
/** 紙の左右の余白（px）。見出しが縁に付かないように。 */
const PAD = 16;

export async function compare(before: string, after: string, options: CompareOptions = {}): Promise<Comparison> {
  const theme = options.theme ?? 'light';
  const intent = options.intent ?? 'safe';
  const a = await layout(before, options.images?.before);
  const b = await layout(after, options.images?.after);
  const ids = (placed: Placed) => new Set(placed.boxes.map((box) => box.id));
  const beforeIds = ids(a);
  const afterIds = ids(b);
  const added = [...afterIds].filter((id) => !beforeIds.has(id));
  const removed = [...beforeIds].filter((id) => !afterIds.has(id));
  const pinnedIn = (text: string) =>
    new Set(Object.entries(getPins(parse(text))).filter(([, pin]) => pin.position !== undefined).map(([id]) => id));
  const pinsBefore = pinnedIn(before);
  const pinsAfter = pinnedIn(after);
  const kept = [...pinsAfter].filter((id) => pinsBefore.has(id) && beforeIds.has(id));

  const left = render(a, theme, intent, kindOf(before) === 'placement');
  const right = render(b, theme, intent, kindOf(after) === 'placement');
  const size = (svg: string) => {
    const m = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
    return { w: Number(m?.[1] ?? 0), h: Number(m?.[2] ?? 0) };
  };
  const ls = size(left);
  const rs = size(right);
  const palette = paletteOf(theme, intent);
  const ink = palette.text.edge;
  const m = messages().compare;
  const width = PAD + ls.w + GAP + rs.w + PAD;
  const height = HEAD + Math.max(ls.h, rs.h);
  const marks = (placed: Placed, dx: number, pick: (box: Box) => 'new' | 'gone' | null, human: Set<string>) =>
    placed.boxes
      .flatMap((box) => {
        const kind = pick(box);
        const out: string[] = [];
        const x = dx + box.x;
        const y = HEAD + box.y;
        if (kind === 'new') {
          out.push(`<rect x="${x - 3}" y="${y - 3}" width="${box.w + 6}" height="${box.h + 6}" fill="none" stroke="${ink}" stroke-width="2.5"/>`);
          out.push(badge(x + box.w, y - 3, m.added, ink, palette.paper));
        }
        if (kind === 'gone') {
          out.push(`<rect x="${x - 3}" y="${y - 3}" width="${box.w + 6}" height="${box.h + 6}" fill="none" stroke="${ink}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
          out.push(badge(x + box.w, y - 3, m.removed, ink, palette.paper));
        }
        if (human.has(box.id)) out.push(badge(x, y - 3, m.human, ink, palette.paper));
        return out;
      })
      .join('');
  const nested = (svg: string, x: number) =>
    svg.replace(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `<svg x="${x}" y="${HEAD}"`);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(m.title)}">`,
    `<rect width="${width}" height="${height}" fill="${palette.paper}"/>`,
    `<text x="${PAD}" y="20" font-family="sans-serif" font-size="13" font-weight="700" fill="${ink}">${escape(m.before)}</text>`,
    `<text x="${PAD + ls.w + GAP}" y="20" font-family="sans-serif" font-size="13" font-weight="700" fill="${ink}">${escape(m.after)}</text>`,
    nested(left, PAD),
    nested(right, PAD + ls.w + GAP),
    marks(a, PAD, (box) => (removed.includes(box.id) ? 'gone' : null), new Set(kept)),
    marks(b, PAD + ls.w + GAP, (box) => (added.includes(box.id) ? 'new' : null), new Set(kept)),
    '</svg>',
  ].join('\n');
  return { svg, added, removed, kept };
}

/** 角に置く小さな札（白抜きの字）。 */
function badge(x: number, y: number, text: string, ink: string, paper: string): string {
  const w = [...text].length * MARK_FONT + 8;
  return (
    `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="16" rx="3" fill="${ink}"/>` +
    `<text x="${x}" y="${y + 3}" text-anchor="middle" font-family="sans-serif" font-size="${MARK_FONT}" font-weight="700" fill="${paper}">${escape(text)}</text>`
  );
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
