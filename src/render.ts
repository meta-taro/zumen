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
import { drawOpenings } from './openings.ts';
import { drawShape, shapeOf, textShift } from './shapes.ts';
import { placeEdgeLabels } from './edge-labels.ts';
import type { EdgeLabel } from './edge-labels.ts';
import { TAG_INSET, labelWidth } from './layout.ts';
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
export function render(
  placed: Placed,
  theme: Theme = 'light',
  intent: Intent = 'safe',
  /**
   * **平面図として描く**（Issue #4）。
   *
   * 実物の間取り図と並べて、差が出ていたところを直す。
   *
   * - **角を四角に。** 角丸だと隣の部屋と壁を共有して見えない
   * - **文字を小さく、上へ寄せる。** 実物は `LDK 18.2帖` を隅に小さく置く
   * - **入らない文字は出さない。** 大きさを人が書くので、入らない箱が出る
   * - **大きいものから先に描く。** 後に描いたものが前に出る
   * - **建具を描く**（`src/openings.ts`）
   *
   * 通り芯・寸法線・柱・設備（浴槽・便器）は入れない。
   * **あれは「建物を記述する」道具**で、この製品とはデータの形が違う。
   */
  plan = false,
): string {
  const palette = paletteOf(theme, intent);
  // **置けなかったラベルは、ここに入ってこない**（重ねて出さない。Issue #3 の 3）。
  const labels = new Map(
    placeEdgeLabels(placed.edges, placed.boxes, placed.groups).map((label) => [label.id, label]),
  );
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size(placed.width)}" height="${size(placed.height)}" viewBox="0 0 ${size(placed.width)} ${size(placed.height)}">`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.edge.stroke}"/></marker></defs>`,
    ...placed.groups.map((group) => renderGroup(group, palette, plan)),
    // **矢印を出すかは、正本が決める。**
    //
    // 一度ここで「平面図に矢印は無い」として落としたが、**間違いだった。**
    // 売場の補充動線が黙って消え、避難経路図は描けなくなる。
    // 間取りが矢印無しで出るのは、**正本に辺が書いていないから**であって、
    // 平面図だから落としているのではない。
    ...placed.edges.map((edge) => renderEdge(edge, labels.get(edge.id) ?? null, palette)),
    ...stack(placed.boxes, plan).map((box) => renderNode(box, palette, plan)),
    '</svg>',
  ];
  return parts.join('\n');
}

/**
 * 描く順。**平面図では、大きいものから先に描く。**
 *
 * 箱の塗りは透けないので、後に描いたものが前に出る。
 * 伏図で、スラブ（152×276）が正本の後ろに来ていたため、
 * **大梁と柱の線をスラブが塗り潰した**。
 * 平面図でも、広い部屋が狭い部屋の壁を消す同じ壊れ方になる。
 *
 * 構成図では起きない（箱は重ならない）ので、並べ替えない。
 * **正本の順序は、読み手が意味を持たせている可能性がある。**
 */
function stack(boxes: Box[], plan: boolean): Box[] {
  if (!plan) return boxes;
  return [...boxes].sort((a, b) => b.w * b.h - a.w * a.h);
}

function renderGroup(group: Box, palette: Palette, plan = false): string {
  // **平面図の囲みは「外周の壁」。** 破線の角丸だと、囲いであって壁に見えない。
  // 実物は、外周だけが内壁より太いひとつながりの線で描かれる。
  const rect = plan
    ? `<rect x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" ` +
      `fill="${palette.group.fill}" stroke="${palette.node.stroke}" stroke-width="3"/>`
    : `<rect x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" rx="8" fill="${palette.group.fill}" stroke="${palette.group.stroke}" stroke-dasharray="${palette.group.dash}"/>`;

  return [
    `<g data-group="${escapeAttr(group.id)}">`,
    rect,
    `<text x="${n(group.x + 12)}" y="${n(group.y + 22)}" font-family="${FONT}" font-size="13" fill="${palette.group.text}">${escapeText(group.label)}</text>`,
    '</g>',
  ].join('');
}

function renderNode(box: Box, palette: Palette, plan = false): string {
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
  //
  // **平面図では形を使わない。** 部屋は部屋で、円柱でも六角形でもない。
  const kind = plan ? 'rect' : shapeOf(box.type);
  const paint = {
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: box.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto,
    dash: style.dash,
  };

  // **平面図は角を四角に。** 角丸だと、隣の部屋と壁を共有して見えない。
  const shape = plan
    ? `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" ` +
      `fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"` +
      `${paint.dash === null ? '' : ` stroke-dasharray="${paint.dash}"`}/>`
    : drawShape(kind, box, paint);

  // **建具は壁に開く穴**（`src/openings.ts`）。壁を消してから記号を描く。
  const holes =
    plan && box.openings.length > 0
      ? drawOpenings(box, box.openings, style.stroke, style.fill)
      : '';

  return [
    `<g ${attributes} data-shape="${kind}">`,
    shape,
    holes,
    ...nodeTag(box, palette, style),
    ...nodeText(box, palette, style, textShift(kind), plan),
    '</g>',
  ].join('');
}

/**
 * **符号**（`tag`）。箱の左上へ小さく置く（B5 / D22）。
 *
 * 中央のラベルと重ねない。図面では名前と符号が**別々に**書かれていて、
 * 読み手は符号だけを拾って断面リストと突き合わせる。
 * **中央に混ぜると、その拾い読みができなくなる。**
 */
function nodeTag(box: Box, palette: Palette, style: Look): string[] {
  if (box.tag === null) return [];
  // **符号も、入らないなら出さない。** 伏図の小梁は幅 20px しかない。
  if (labelWidth(box.tag, 10) + TAG_INSET > box.w) return [];
  return [
    `<text x="${n(box.x + TAG_INSET)}" y="${n(box.y + TAG_INSET + 9)}" font-family="${FONT}" font-size="10" fill="${subtitleOn(style, palette)}">${escapeText(box.tag)}</text>`,
  ];
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
function nodeText(box: Box, palette: Palette, style: Look, shift = 0, plan = false): string[] {
  const cx = n(box.x + box.w / 2);

  // **平面図の文字は小さい。** 実物は `LDK 18.2帖` を隅に小さく置く。
  // 大きく中央に置くと、部屋ではなく「箱に書いたラベル」に見える。
  const size = plan ? 12 : 15;
  const subSize = plan ? 10 : 11;

  // **入らないなら出さない**（平面図・伏図）。
  //
  // 構成図では箱の大きさをラベルから決めるので、必ず入る。
  // 平面図では大きさを人と AI が書くので、**入らない箱が出る** ——
  // 伏図の小梁（幅 20px）に「小梁 300×600」は入らず、
  // 実際に `0×60` と切れた文字が隣の部材の上へはみ出した。
  //
  // 辺のラベルと同じ扱いにする（`src/edge-labels.ts`）。
  // **置けないものを、重ねてでも出すことはしない。**
  const fits = (text: string, font: number): boolean =>
    !plan || labelWidth(text, font) + 6 <= box.w;
  const room = !plan || box.h >= 34;

  const main = (dy: number): string =>
    `<text x="${cx}" y="${n(box.y + box.h / 2 + dy + shift)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="${style.text}">${escapeText(box.label)}</text>`;

  if (!room || !fits(box.label, size)) return [];
  if (box.technology === null || !fits(box.technology, subSize) || (plan && box.h < 44)) {
    return [main(5)];
  }
  return [
    main(plan ? -4 : -2),
    `<text x="${cx}" y="${n(box.y + box.h / 2 + (plan ? 11 : 16) + shift)}" text-anchor="middle" font-family="${FONT}" font-size="${subSize}" fill="${subtitleOn(style, palette)}">${escapeText(box.technology)}</text>`,
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
