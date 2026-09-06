/**
 * SVG を書く。
 *
 * S1 では見た目を競わない（判定基準 §0）。ここで要るのは 2 つだけ。
 *
 * 1. **人の指定が描画まで届いていることが、出力から確かめられる**こと。
 *    大きさ・ラベル・体裁・線の曲げ方を、目でも機械でも読める形で出す
 * 2. **どれが人の指定かが見える**こと（`data-pinned`）。
 *    見えないと、AI が戻したことに人が気づけない（PRD §2 の動かした点 2）
 *
 * ## 貼り先で崩れないための約束（Issue 007）
 *
 * 図は単体で見るものではなく、**資料に貼るもの**。貼り先で崩れると人は手作業に戻る。
 * そこで、**使う SVG の機能を意図的に狭めている。**
 *
 * - `<style>` を使わない。CSS の解釈は貼り先ごとに違う
 * - `foreignObject` を使わない。対応していない貼り先が多い
 * - グラデーション・フィルタを使わない
 * - **`dominant-baseline` を使わない。** 文字の縦位置は座標で決める
 *   （この属性は貼り先によって効かず、効かないと**文字だけがずれる**）
 * - `orient="auto-start-reverse"` を使わない。**SVG 2 の値**で、
 *   ここでは `marker-end` しか使わないので SVG 1.1 の `auto` で足りる
 * - `width` / `height` と `viewBox` の両方を書く。片方だけだと寸法を決められない貼り先がある
 *
 * 詳細と、回避できないものは `docs/specs/007-貼り先で崩れないか.md`。
 */
import type { Box, Placed, PlacedEdge } from './layout.ts';

/** 体裁の訳。renderer 側が持ち、正本には色を書かない（原案 §5.3）。 */
const APPEARANCE: Record<string, { fill: string; stroke: string }> = {
  primary: { fill: '#dbeafe', stroke: '#1d4ed8' },
  muted: { fill: '#f1f5f9', stroke: '#94a3b8' },
};
const DEFAULT_STYLE = { fill: '#ffffff', stroke: '#334155' };

/**
 * 文字の書体。**総称ファミリだけを書く。**
 *
 * 書かないと貼り先の既定に委ねることになり、**日本語のラベルが豆腐（□）になり得る。**
 * これは体裁の指定ではなく、**壊れないための最低限**。
 *
 * どの書体を使うかは人が決める領域なので（ベースルール §11）、
 * 具体的な書体名はここに書かない。**`DESIGN.md` が決まったら差し替える。**
 */
const FONT = 'sans-serif';

/**
 * 座標と寸法を整数にする。
 *
 * 自動配置は `490.66666666666663` のような値を返す。そのまま書くと、
 *
 * - 貼り先へ渡す寸法が不安定になる
 * - **Markdown へ埋め込むときの data URI が無駄に膨らむ**（D4 の着地点）
 * - 差分が読めない（1 px 動いただけで長い小数が並ぶ）
 *
 * 図の見え方は 1 px 未満しか変わらない。`src/drawio.ts` と同じ扱いに揃えてある。
 */
function n(value: number): number {
  return Math.round(value);
}

/** 全体の寸法は**切り上げる**。丸めて縮めると、端の要素が 1 px 欠ける。 */
function size(value: number): number {
  return Math.ceil(value);
}

export function render(placed: Placed): string {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size(placed.width)}" height="${size(placed.height)}" viewBox="0 0 ${size(placed.width)} ${size(placed.height)}">`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/></marker></defs>',
    ...placed.groups.map(renderGroup),
    ...placed.edges.map(renderEdge),
    ...placed.boxes.map(renderNode),
    '</svg>',
  ];
  return parts.join('\n');
}

function renderGroup(group: Box): string {
  return [
    `<g data-group="${escapeAttr(group.id)}">`,
    `<rect x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="6 4"/>`,
    `<text x="${n(group.x + 12)}" y="${n(group.y + 22)}" font-family="${FONT}" font-size="13" fill="#64748b">${escapeText(group.label)}</text>`,
    '</g>',
  ].join('');
}

function renderNode(box: Box): string {
  const style = (box.appearance === null ? undefined : APPEARANCE[box.appearance]) ?? DEFAULT_STYLE;
  const attributes = [
    `data-node="${escapeAttr(box.id)}"`,
    `data-pinned="${box.pinned}"`,
    box.appearance === null ? '' : `data-appearance="${escapeAttr(box.appearance)}"`,
  ]
    .filter((part) => part !== '')
    .join(' ');

  return [
    `<g ${attributes}>`,
    `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" rx="6" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${box.pinned ? 2 : 1}"/>`,
    `<text x="${n(box.x + box.w / 2)}" y="${n(box.y + box.h / 2 + 5)}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="#0f172a">${escapeText(box.label)}</text>`,
    '</g>',
  ].join('');
}

function renderEdge(edge: PlacedEdge): string {
  if (edge.points.length < 2) return '';
  const [head, ...rest] = edge.points;
  const path = `M ${n(head!.x)} ${n(head!.y)} ${rest.map((p) => `L ${n(p.x)} ${n(p.y)}`).join(' ')}`;
  const label =
    edge.label === null
      ? ''
      : `<text x="${n(midpoint(edge).x)}" y="${n(midpoint(edge).y - 6)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#475569">${escapeText(edge.label)}</text>`;
  return [
    `<g data-edge="${escapeAttr(edge.id)}" data-pinned="${edge.pinned}">`,
    `<path d="${path}" fill="none" stroke="#334155" stroke-width="${edge.pinned ? 2 : 1}" marker-end="url(#arrow)"/>`,
    label,
    '</g>',
  ].join('');
}

function midpoint(edge: PlacedEdge): { x: number; y: number } {
  const a = edge.points[0]!;
  const b = edge.points[edge.points.length - 1]!;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 図の中の文字は人が書いたもので、そのまま記法へ入れない。
 * ここを通さないと、ラベルに `<` を書いただけで図が壊れる。
 */
function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return escapeText(value);
}
