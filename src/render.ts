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
import { drawShape, shapeOf, textShift } from './shapes.ts';
import { placeEdgeLabels } from './edge-labels.ts';
import type { EdgeLabel } from './edge-labels.ts';
import type { Box, Placed, PlacedEdge } from './layout.ts';
import type { Look } from './tokens.ts';
import { STROKE_WIDTH, lookOf, paletteOf } from './tokens.ts';
import type { Intent, Palette, Theme } from './tokens.ts';

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

/**
 * SVG にする。
 *
 * **テーマを渡さなければライト**（`DESIGN.md` §3）。
 * 貼り先が自分の地の色を知っているときだけ `dark` を渡す（md-business#240）。
 */
export function render(placed: Placed, theme: Theme = 'light', intent: Intent = 'safe'): string {
  const palette = paletteOf(theme, intent);
  // **置けなかったラベルは、ここに入ってこない**（重ねて出さない。Issue #3 の 3）。
  const labels = new Map(
    placeEdgeLabels(placed.edges, placed.boxes, placed.groups).map((label) => [label.id, label]),
  );
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size(placed.width)}" height="${size(placed.height)}" viewBox="0 0 ${size(placed.width)} ${size(placed.height)}">`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.edge.stroke}"/></marker></defs>`,
    ...placed.groups.map((group) => renderGroup(group, palette)),
    ...placed.edges.map((edge) => renderEdge(edge, labels.get(edge.id) ?? null, palette)),
    ...placed.boxes.map((box) => renderNode(box, palette)),
    '</svg>',
  ];
  return parts.join('\n');
}

function renderGroup(group: Box, palette: Palette): string {
  return [
    `<g data-group="${escapeAttr(group.id)}">`,
    `<rect x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" rx="8" fill="${palette.group.fill}" stroke="${palette.group.stroke}" stroke-dasharray="${palette.group.dash}"/>`,
    `<text x="${n(group.x + 12)}" y="${n(group.y + 22)}" font-family="${FONT}" font-size="13" fill="${palette.group.text}">${escapeText(group.label)}</text>`,
    '</g>',
  ].join('');
}

function renderNode(box: Box, palette: Palette): string {
  const style = lookOf(box.appearance, palette);
  const attributes = [
    `data-node="${escapeAttr(box.id)}"`,
    `data-pinned="${box.pinned}"`,
    box.appearance === null ? '' : `data-appearance="${escapeAttr(box.appearance)}"`,
  ]
    .filter((part) => part !== '')
    .join(' ');

  // **`type` を形にする**（Issue #9）。以前はここが `<rect>` 固定で、
  // Mermaid だけが形を出していた（同じ正本から違う絵が出ていた）。
  const kind = shapeOf(box.type);
  const shape = drawShape(kind, box, {
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: box.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto,
    dash: style.dash,
  });

  return [
    `<g ${attributes} data-shape="${kind}">`,
    shape,
    ...nodeText(box, palette, style, textShift(kind)),
    '</g>',
  ].join('');
}

/**
 * 副題（`technology`）の色。
 *
 * **塗り潰した箱の上では、主題と同じ文字色を使う。**
 * 既定の薄い副題色をそのまま載せると、アクセントの上で読めなくなる
 * （`vivid` で実際にそうなった）。
 */
function subtitleOn(style: Look, palette: Palette): string {
  return style.text === palette.text.node ? palette.text.group : style.text;
}

/**
 * 箱の中の文字。
 *
 * 副題（`technology`）があれば 2 行にする。無ければ 1 行のまま中央へ。
 * **所属や版を書ける唯一の場所**なので、描かないとラベルへ畳むしかなくなる（Issue #3 の 4）。
 */
function nodeText(box: Box, palette: Palette, style: Look, shift = 0): string[] {
  const cx = n(box.x + box.w / 2);
  const main = (dy: number): string =>
    `<text x="${cx}" y="${n(box.y + box.h / 2 + dy + shift)}" text-anchor="middle" font-family="${FONT}" font-size="14" fill="${style.text}">${escapeText(box.label)}</text>`;

  if (box.technology === null) return [main(5)];
  return [
    main(-2),
    `<text x="${cx}" y="${n(box.y + box.h / 2 + 16 + shift)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${subtitleOn(style, palette)}">${escapeText(box.technology)}</text>`,
  ];
}

function renderEdge(edge: PlacedEdge, placedLabel: EdgeLabel | null, palette: Palette): string {
  if (edge.points.length < 2) return '';
  const [head, ...rest] = edge.points;
  const path = `M ${n(head!.x)} ${n(head!.y)} ${rest.map((p) => `L ${n(p.x)} ${n(p.y)}`).join(' ')}`;
  const label =
    placedLabel === null
      ? ''
      : `<text x="${n(placedLabel.x)}" y="${n(placedLabel.y)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${palette.text.edge}">${escapeText(placedLabel.text)}</text>`;
  return [
    `<g data-edge="${escapeAttr(edge.id)}" data-pinned="${edge.pinned}">`,
    `<path d="${path}" fill="none" stroke="${palette.edge.stroke}" stroke-width="${edge.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto}" marker-end="url(#arrow)"/>`,
    label,
    '</g>',
  ].join('');
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
