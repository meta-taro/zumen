/**
 * draw.io（diagrams.net）の XML へ書き出す。
 *
 * **Mermaid 書き出しとは担保するものが違う。**
 *
 * | 書き出し先 | 何を担保するか |
 * |---|---|
 * | Mermaid | この製品が終わった翌日、図が**読める** |
 * | draw.io | この製品が終わった翌日、図を**編集できる** |
 *
 * ## 圧縮しない
 *
 * draw.io は既定で本文を deflate + base64 する。**それをしない。**
 * 圧縮すると `git diff` が読めなくなり、テキスト正本にした意味が消える。
 * draw.io は非圧縮の XML もそのまま開く。
 *
 * ## 落ちるものを黙って落とさない
 *
 * いちばん大きいのは、**人が置いた位置と自動配置の区別**。
 * draw.io は全要素が座標を持つので、**形式にその区別が無い。**
 * `zumenPinned="1"` を添えて残すが、draw.io で保存し直すと失われることがある。
 * 落ちるものは XML の先頭コメントに列挙する（Mermaid 書き出しと同じ作法）。
 *
 * ## 往復はしない
 *
 * 書き出しであって取り込みではない（PRD §4）。**正本は `.zumen.yaml` の側。**
 */
import type { Box, Placed, PlacedEdge } from './layout.ts';
import { messages } from './messages.ts';
import { drawioStyleOf, shapeOf } from './shapes.ts';
import { GROUP, lookOf } from './tokens.ts';

/** 囲みは中身より薄く。塗らないと、中の要素が読めなくなる。 */
const GROUP_STYLE = `rounded=0;fillColor=${GROUP.fill};strokeColor=${GROUP.stroke};dashed=1;verticalAlign=top;`;

export function toDrawio(placed: Placed, title = 'zumen'): string {
  const pinned = [...placed.boxes, ...placed.edges].some((item) => item.pinned);
  const cells = [
    '        <mxCell id="0" />',
    '        <mxCell id="1" parent="0" />',
    // 囲みを先に置く。draw.io は後の要素を手前に描くので、逆にすると中身が隠れる。
    ...placed.groups.map((group) => vertex(group, GROUP_STYLE)),
    ...placed.boxes.map((box) => vertex(box, nodeStyle(box))),
    ...placed.edges.map(edge),
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    losses(pinned),
    `<mxfile host="zumen">`,
    `  <diagram name="${escapeXml(title)}">`,
    '    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" math="0" shadow="0">',
    '      <root>',
    ...cells,
    '      </root>',
    '    </mxGraphModel>',
    '  </diagram>',
    '</mxfile>',
    '',
  ].join('\n');
}

/** 落ちるものの一覧。**先頭に置く。** 末尾だと読まれない。 */
function losses(hasPinned: boolean): string {
  const m = messages().drawio;
  const lines = [m.lossPinned, m.lossAppearance, m.lossComments, m.lossLocked, m.lossRoundTrip];
  const body = [
    m.lossHeading,
    ...lines.map((line) => `  - ${line}`),
    ...(hasPinned ? [`  ${m.pinnedNote}`] : []),
  ];
  // XML のコメントに `--` は書けない。文言側で使わない約束にせず、ここで潰す。
  return `<!--\n${body.map((line) => line.replaceAll('--', '–')).join('\n')}\n-->`;
}

function nodeStyle(box: Box): string {
  const look = lookOf(box.appearance);
  // **破線は色を捨てても残る 2 本目の道**（`DESIGN.md` §7）。
  // draw.io へ持ち出しても、白黒で `muted` と `primary` が見分けられるようにする。
  const dashed = look.dash === null ? '' : 'dashed=1;';
  // **`type` の形も持ち出す**（Issue #9）。持ち出せない形は四角へ落ちる（仕様 §7）。
  const shape = drawioStyleOf(shapeOf(box.type));
  return `${shape}whiteSpace=wrap;html=1;fillColor=${look.fill};strokeColor=${look.stroke};${dashed}`;
}

/**
 * 座標を整数にする。
 *
 * 自動配置は `74.66666666666666` のような値を返す。そのまま書くと
 * **差分が読めなくなる**（1 px 動いただけで長い小数が並ぶ）。
 * draw.io は整数で困らないし、人が置いた座標はもともと整数。
 */
function px(value: number): number {
  return Math.round(value);
}

/**
 * 箱を 1 つ書く。
 *
 * 人が置いたものは `<object>` で包み、`zumenPinned` を持たせる。
 * **draw.io の「データを編集」で見える形**にしておくと、
 * 開いた人が「これは誰が置いたのか」を確かめられる。
 *
 * `<object>` が id と表示名を持ち、**中の `mxCell` は id を持たない**（draw.io の書き方）。
 */
function vertex(box: Box, style: string): string {
  const geometry = `<mxGeometry x="${px(box.x)}" y="${px(box.y)}" width="${px(box.w)}" height="${px(box.h)}" as="geometry" />`;

  if (box.pinned) {
    return [
      `        <object label="${escapeXml(box.label)}" zumenPinned="1" id="${escapeXml(box.id)}">`,
      `          <mxCell style="${style}" vertex="1" parent="1">`,
      `            ${geometry}`,
      '          </mxCell>',
      '        </object>',
    ].join('\n');
  }

  return [
    `        <mxCell id="${escapeXml(box.id)}" value="${escapeXml(box.label)}" style="${style}" vertex="1" parent="1">`,
    `          ${geometry}`,
    '        </mxCell>',
  ].join('\n');
}

function edge(placedEdge: PlacedEdge): string {
  // 両端は箱の縁の点。draw.io は source / target から自分で引くので、中間だけ渡す。
  const waypoints = placedEdge.points.slice(1, -1);
  const style = 'edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;';
  const value = placedEdge.label === null ? '' : ` value="${escapeXml(placedEdge.label)}"`;
  const open = placedEdge.pinned
    ? `        <object${value} zumenPinned="1" id="${escapeXml(placedEdge.id)}">`
    : undefined;

  const cell = [
    open === undefined
      ? `        <mxCell id="${escapeXml(placedEdge.id)}"${value} style="${style}" edge="1" parent="1" source="${escapeXml(placedEdge.from)}" target="${escapeXml(placedEdge.to)}">`
      : `          <mxCell style="${style}" edge="1" parent="1" source="${escapeXml(placedEdge.from)}" target="${escapeXml(placedEdge.to)}">`,
  ];
  const pad = open === undefined ? '          ' : '            ';
  if (waypoints.length === 0) {
    // 中間点が無いなら空の要素を残さない。**意味の無い行を差分に出さない。**
    cell.push(`${pad}<mxGeometry relative="1" as="geometry" />`);
  } else {
    cell.push(`${pad}<mxGeometry relative="1" as="geometry">`);
    cell.push(`${pad}  <Array as="points">`);
    for (const point of waypoints) {
      cell.push(`${pad}    <mxPoint x="${px(point.x)}" y="${px(point.y)}" />`);
    }
    cell.push(`${pad}  </Array>`);
    cell.push(`${pad}</mxGeometry>`);
  }
  cell.push(open === undefined ? '        </mxCell>' : '          </mxCell>');

  if (open === undefined) return cell.join('\n');
  return [open, ...cell, '        </object>'].join('\n');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
