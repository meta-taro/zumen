/**
 * SVG を書く。
 *
 * S1 では見た目を競わない（判定基準 §0）。ここで要るのは 2 つだけ。
 *
 * 1. **人の指定が描画まで届いていることが、出力から確かめられる**こと。
 *    大きさ・ラベル・体裁・線の曲げ方を、目でも機械でも読める形で出す
 * 2. **どれが人の指定かが見える**こと（`data-pinned`）。
 *    見えないと、AI が戻したことに人が気づけない（PRD §2 の動かした点 2）
 */
import type { Box, Placed, PlacedEdge } from './layout.ts';

/** 体裁の訳。renderer 側が持ち、正本には色を書かない（原案 §5.3）。 */
const APPEARANCE: Record<string, { fill: string; stroke: string }> = {
  primary: { fill: '#dbeafe', stroke: '#1d4ed8' },
  muted: { fill: '#f1f5f9', stroke: '#94a3b8' },
};
const DEFAULT_STYLE = { fill: '#ffffff', stroke: '#334155' };

export function render(placed: Placed): string {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${placed.width}" height="${placed.height}" viewBox="0 0 ${placed.width} ${placed.height}">`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#334155"/></marker></defs>',
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
    `<rect x="${group.x}" y="${group.y}" width="${group.w}" height="${group.h}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="6 4"/>`,
    `<text x="${group.x + 12}" y="${group.y + 22}" font-size="13" fill="#64748b">${escapeText(group.label)}</text>`,
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
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="6" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${box.pinned ? 2 : 1}"/>`,
    `<text x="${box.x + box.w / 2}" y="${box.y + box.h / 2 + 5}" text-anchor="middle" font-size="14" fill="#0f172a">${escapeText(box.label)}</text>`,
    '</g>',
  ].join('');
}

function renderEdge(edge: PlacedEdge): string {
  if (edge.points.length < 2) return '';
  const [head, ...rest] = edge.points;
  const path = `M ${head!.x} ${head!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
  const label =
    edge.label === null
      ? ''
      : `<text x="${midpoint(edge).x}" y="${midpoint(edge).y - 6}" text-anchor="middle" font-size="11" fill="#475569">${escapeText(edge.label)}</text>`;
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
