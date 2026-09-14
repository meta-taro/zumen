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
import { drawDimensions, drawGrid, drawNorth } from './dimensions.ts';
import type { Frame, Ink } from './dimensions.ts';
import { hasGrid } from './grid.ts';
import { drawEnd, hasEnds } from './ends.ts';
import { drawHatch, drawHatchIn } from './hatch.ts';
import type { Hatch } from './hatch.ts';
import { pathOf } from './curve.ts';
import { ALIGN_INSET, anchorOf } from './align.ts';
import { laysDown } from './write.ts';
import { DOUBLE_GAP, dashOf, doubled } from './line.ts';
import { roundedOf, widthOf } from './weight.ts';
import { drawMarker } from './marker.ts';
import { drawSymbol } from './symbol.ts';
import { NAME_FONT, SUB_FONT, planNames, tagFits, textRectOf } from './names.ts';
import type { Plan } from './names.ts';
import { drawRange, ringOf } from './range.ts';
import { wallFits, wallWidth } from './wall.ts';
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

/** 囲みの名前の字の大きさ。 */
const GROUP_FONT = 13;

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
  // **壁の厚みは平面図だけの話。** 構成図の箱は壁ではない。
  const wall = plan ? wallWidth(placed.wall, placed.mm) : null;
  const outerWall = plan ? wallWidth(placed.wall, placed.mm, true) : null;
  // **配置図の文字の置き方は、図ぜんたいを見て決める**（`src/names.ts`）。
  // 1 つずつ決めると、外へ出した文字が他の箱に乗る。
  const names = plan
    ? planNames(
        placed.boxes,
        placed.boxes.length > 0 ? frameOf(placed) : null,
        placed.edges,
        placed.groups,
      )
    : new Map<string, Plan>();
  const paper = paperFor(placed, names);
  // **置けなかったラベルは、ここに入ってこない**（重ねて出さない。Issue #3 の 3）。
  const labels = new Map(
    placeEdgeLabels(placed.edges, placed.boxes, placed.groups).map((label) => [label.id, label]),
  );
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size(paper.w)}" height="${size(paper.h)}" viewBox="0 0 ${size(paper.w)} ${size(paper.h)}">`,
    /**
     * **図の題は、絵の中には描かないが SVG の中には入れる。**
     *
     * SVG を 1 枚だけ人へ渡す使い方（チャットへ投げる）が実際にある。
     * `<title>` は表示されないので図の見た目は変わらないが、
     * **絵を見られない人と機械には、何の図かが届く**（読み上げ・貼り先の説明）。
     * いちばん最初の子に置く —— 読み上げの順がそこで決まる。
     */
    placed.title === null || placed.title === '' ? '' : `<title>${escapeText(placed.title)}</title>`,
    `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.edge.stroke}"/></marker></defs>`,
    /**
     * **地の色は、図そのものが持つ。**
     *
     * 2026-09-15 まで敷いていなかった。`-dark.svg` をそのまま開くと、
     * **箱の外に書いた注記が 1 行も見えなかった** ——
     * 文字は明るい灰で正しいのに、**白い紙の上では白い字**になる。
     * 紹介ページは暗い背景の上に置いているので気づかない（D33）。
     */
    `<rect data-paper="1" x="0" y="0" width="${size(paper.w)}" height="${size(paper.h)}" fill="${palette.paper}"/>`,
    // **時間の目盛りは、帯の下に敷く**（`mark: tick`）。
    // 通り芯は基準線なので最前面だが、目盛りは目盛りで、
    // 上に載せると帯の中の文字を串刺しにする（2026-09-15。見本 64）。
    ...(plan && hasGrid(placed.grid) ? [gridLayer(placed, palette, 'tick')].filter(Boolean) : []),
    // **階の枠は機械が描く**（`src/floor.ts`）。
    // 人が手で枠を置くと、箱を足したときに枠が合わなくなる。
    ...(plan ? floorBands(placed, palette) : []),
    ...placed.groups.map((group) => renderGroup(group, palette, plan, outerWall)),
    // **向きの無い線は、図そのもの。箱の下に敷く**（`src/arrows.ts`）。
    //
    // 路線図の線を駅の上に描くと、駅の印を線が串刺しにして潰す。
    // 構成図の辺も同じで、箱が辺の端を隠すことで繋がって見える。
    ...(plan && placed.arrows
      ? []
      : placed.edges.map((edge) => renderEdge(edge, labels.get(edge.id) ?? null, palette, plan, placed.arrows))),
    ...stack(placed.boxes, plan).map((box) =>
      renderNode(box, palette, plan, wall, names.get(box.id) ?? null, onPattern(box, placed.boxes, names)),
    ),
    // **向きのある矢印は、図の上に載せる注記。**
    //
    // 部屋の塗りは透けないので、下に置くと**隣どうしの矢印が完全に消える。**
    // 壁に厚みを付けたら、避難経路の矢印が丸ごと壁の下に入った（2026-09-12）。
    // 避難経路図は**矢印が主役**の図で、消えたら図の意味が無い。
    //
    // **矢印を出すかは正本が決める**（辺を書かなければ出ない。間取りがそれ）。
    ...(plan && placed.arrows
      ? placed.edges.map((edge) => renderEdge(edge, labels.get(edge.id) ?? null, palette, true, true))
      : []),
    // **範囲の円は、箱の上・寸法の下**（`src/range.ts`）。
    //
    // 箱の下に敷くと、クレーンの作業半径が資材置場の塗りで切れる。
    // 寸法より上に出すと、破線の円が数値を横切る。
    ...(plan ? placed.boxes.map((box) => renderRange(box, placed.mm, palette)) : []),
    // **通り芯・寸法・方位は最前面。**
    //
    // 一度、通り芯を下敷きにした。**建物の中で消えた** —— 箱の塗りは透けないので、
    // スラブや部屋の下に入ると、外側の切れ端しか見えない。
    // 実物では一点鎖線が**建物を貫いて**見えている。基準線なので、
    // 隠れたら基準として使えない。
    ...(plan && hasGrid(placed.grid)
      ? [gridLayer(placed, palette, 'datum'), dimensionLayer(placed, palette)].filter(Boolean)
      : []),
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

/**
 * 通り芯（`src/grid.ts`）。**建物を貫いて描く。**
 *
 * 実物では一点鎖線が建物を貫いて外まで伸び、端に符号が丸で付く。
 * **下敷きにすると建物の中で消える**（箱の塗りは透けない）。
 * 基準線が隠れたら、基準として使えない。
 */
function gridLayer(placed: Placed, palette: Palette, only?: 'tick' | 'datum'): string {
  const frame = frameOf(placed);
  const ink = inkOf(palette);
  const body = drawGrid(placed.grid, frame, ink, only);
  // **空の層は出さない。** 出すと「通り芯は箱より後ろ」を測る側が、
  // 中身の無い層を先に見つけてしまう。
  if (body === '') return '';
  return `<g data-grid="${only === 'tick' ? 'tick' : 'true'}">${body}</g>`;
}

/** 寸法線と方位。**最前面**（数値が隠れると読めない）。 */
function dimensionLayer(placed: Placed, palette: Palette): string {
  const frame = frameOf(placed);
  const ink = inkOf(palette);
  const north = placed.north === null ? '' : drawNorth(placed.north, frame, ink);
  return (
    '<g data-dimensions="true">' +
    drawDimensions(placed.grid, frame, placed.mm, ink) +
    north +
    '</g>'
  );
}

/** 図の中身が占める矩形。通り芯の長さと、寸法線を置く位置がここから決まる。 */
/**
 * **外へ出した名前の分だけ、紙を広げる。**
 *
 * 名前は箱の外へ出るので、箱の外周で紙を切ると**端の名前が切れる。**
 * 広げられるのは右と下だけ（左と上は座標が負になるので `src/names.ts` が避ける）。
 */
function paperFor(placed: Placed, plans: Map<string, Plan>): { w: number; h: number } {
  let w = placed.width;
  let h = placed.height;
  for (const box of placed.boxes) {
    const plan = plans.get(box.id);
    if (plan === undefined || plan.kind !== 'outside') continue;
    const half =
      Math.max(
        labelWidth(box.label, NAME_FONT),
        box.technology === null ? 0 : labelWidth(box.technology, SUB_FONT),
      ) / 2;
    const rows = box.technology === null ? 1 : 2;
    w = Math.max(w, plan.x + half + 12);
    h = Math.max(h, (plan.above ? plan.y : plan.y + (rows - 1) * 12) + 12);
  }
  // **囲みの名前も、囲みより長いことがある。**
  // 見本 39（経絡と経穴）で「手の陽明大腸経　LI　20 穴　流注は手から顔へ」が
  // 紙の 110px 外まで伸びていた（2026-09-15）。名前は囲みの左上から右へ書く。
  for (const group of placed.groups) {
    w = Math.max(w, group.x + 12 + labelWidth(group.label, GROUP_FONT) + 12);
  }
  return { w, h };
}

/**
 * **階の枠**（`floors` ／ `nodes[].floor`）。
 *
 * その階の箱をぜんぶ囲む矩形と、階名を描く。
 * **箱は 1 px も動かさない** —— 枠は「どこからどこまでが何階か」を言うだけ。
 * 人が書いた座標がそのまま出ることは、この製品の保証（判定基準 3.1）。
 *
 * 書いていない階（`floors` に無い名前）の枠は描かない。**知らせるのは検証器の仕事。**
 */
function floorBands(placed: Placed, palette: Palette): string[] {
  if (placed.floors.length === 0) return [];
  const pad = 14;
  const out: string[] = [];
  for (const name of placed.floors) {
    const boxes = placed.boxes.filter((box) => box.floor === name);
    if (boxes.length === 0) continue;
    const x = Math.min(...boxes.map((b) => b.x)) - pad;
    const y = Math.min(...boxes.map((b) => b.y)) - pad;
    const w = Math.max(...boxes.map((b) => b.x + b.w)) + pad - x;
    const h = Math.max(...boxes.map((b) => b.y + b.h)) + pad - y;
    out.push(
      `<g data-floor="${escapeAttr(name)}">` +
        `<rect data-floor-rect="1" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ` +
        `fill="none" stroke="${palette.group.stroke}"/>` +
        `<text x="${n(x)}" y="${n(y - 6)}" font-family="${FONT}" font-size="12" fill="${palette.text.group}">${escapeText(name)}</text>` +
        `</g>`,
    );
  }
  return out;
}

function frameOf(placed: Placed): Frame {
  const all = [...placed.boxes, ...placed.groups];
  const x = Math.min(...all.map((b) => b.x));
  const y = Math.min(...all.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...all.map((b) => b.x + b.w)) - x,
    h: Math.max(...all.map((b) => b.y + b.h)) - y,
  };
}

function inkOf(palette: Palette): Ink {
  return { stroke: palette.node.stroke, text: palette.text.group, paper: palette.paper, font: FONT };
}

/** 範囲を示す円（`src/range.ts`）。書かなければ何も出さない。 */
function renderRange(box: Box, mm: number | null, palette: Palette): string {
  const ring = ringOf(box, mm);
  if (ring === null) return '';
  return `<g data-range="${escapeAttr(box.id)}">${drawRange(ring, palette.edge.stroke, palette.text.group, FONT)}</g>`;
}

function renderGroup(group: Box, palette: Palette, plan = false, wall: number | null = null): string {
  // **平面図の囲みは「外周の壁」。** 破線の角丸だと、囲いであって壁に見えない。
  // 実物は、外周だけが内壁より太いひとつながりの線で描かれる。
  //
  // **厚みを書いていれば、その太さで描く**（`src/wall.ts`）。
  const rect = plan
    ? `<rect x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" ` +
      `fill="${palette.group.fill}" stroke="${palette.node.stroke}" stroke-width="${wall ?? 3}"/>`
    : `<rect x="${n(group.x)}" y="${n(group.y)}" width="${n(group.w)}" height="${n(group.h)}" rx="8" fill="${palette.group.fill}" stroke="${palette.group.stroke}" stroke-dasharray="${palette.group.dash}"/>`;

  return [
    `<g data-group="${escapeAttr(group.id)}">`,
    rect,
    `<text x="${n(group.x + 12)}" y="${n(group.y + 22)}" font-family="${FONT}" font-size="${GROUP_FONT}" fill="${palette.group.text}">${escapeText(group.label)}</text>`,
    '</g>',
  ].join('');
}

/**
 * **その文字が、他の箱の模様の上に載っているか。**
 *
 * 仕様は「模様の上に文字を重ねると読めないので、**文字の下地を抜く**」と書いてある。
 * ところが抜いていたのは**自分の箱が持つ模様だけ**だった ——
 * **別の箱の上に載った文字は、そのまま模様に埋もれていた**（2026-09-15。実物を見て見つけた）。
 *
 * いちばんひどいのは塗り潰しの上 ——
 * Bottom Navigation の帯（`solid`）の上に、同じ濃さの文字が出ていた。
 *
 * 見るのは**その文字が丸ごと入っている箱**だけ。半分かかっている程度なら、
 * 下地を抜くほうが逆に汚くなる。
 */
function onPattern(box: Box, boxes: readonly Box[], names: Map<string, Plan>): Hatch {
  if (box.label === '') return 'none';
  const plan = names.get(box.id);
  if (plan === undefined) return 'none';
  const rect = textRectOf(box, plan);
  if (rect === null) return 'none';
  let found: Box | null = null;
  for (const other of boxes) {
    if (other.id === box.id || other.hatch === 'none') continue;
    const covers =
      other.x <= rect.x &&
      other.y <= rect.y &&
      other.x + other.w >= rect.x + rect.w &&
      other.y + other.h >= rect.y + rect.h;
    // **いちばん内側の箱**を採る（区画の中の区画の上に文字が載ることがある）。
    if (covers && (found === null || other.w * other.h < found.w * found.h)) found = other;
  }
  return found === null ? 'none' : found.hatch;
}

function renderNode(
  box: Box,
  palette: Palette,
  plan = false,
  wall: number | null = null,
  name: Plan | null = null,
  under: Hatch = 'none',
): string {
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
    // **路線の色は枠にだけ載せる**（`src/palette.ts`）。
    // 文字まで染めると、地の上で読めなくなる。
    stroke: box.color ?? style.stroke,
    // **平面図で壁の厚みを書いていれば、その太さで描く**（`src/wall.ts`）。
    // 人が置いた印（太い枠）より壁のほうが優先 —— 壁の厚みは図の内容であって、
    // 誰が置いたかの印ではない。
    //
    // **ただし壁の厚みは「部屋」のもの。** 丸い印（`marker`）には効かせない ——
    // 座席図で、壁厚 150mm（6px）が 21px の座席の丸を塗り潰した（2026-09-12）。
    //
    // **小さすぎる箱にも効かせない**（`wallFits`）——
    // フードコートの凡例の見本（26×20）が、壁でほとんど枠になった（2026-09-13）。
    strokeWidth:
      (box.marker === 'box' && wallFits(wall, box) ? wall : null) ??
      (box.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto),
    dash: style.dash,
  };

  // **平面図は角を四角に。** 角丸だと、隣の部屋と壁を共有して見えない。
  // **印の描き方は正本が選ぶ**（`src/marker.ts`。丸・二重丸・枠なし）。
  //
  // **図記号があれば、枠を描かずに記号だけを描く**（`src/symbol.ts`）。
  // 抵抗やコンデンサに枠は無い —— 枠があると「箱の中に部品がある」ように見える。
  const shape =
    box.symbol !== null
      ? drawSymbol(box.symbol, box, { stroke: style.stroke, paper: palette.paper })
      : plan
        ? drawMarker(box.marker, box, paint)
        : drawShape(kind, box, paint);

  // **材料と区域の模様**（`src/hatch.ts`）。枠の内側に、枠と同じ色で描く。
  // **建具より先。** 建具は穴なので、模様の上に開ける。
  // **塗りにも路線の色を乗せる**（`src/palette.ts`）。停車駅案内図の ● は、
  // ●そのものが種別の色をしている（枠だけ色を付けても読めない）。
  const pattern = plan ? drawHatch(box.hatch, box, box.color ?? style.stroke, box.marker, box.id) : '';

  // **塗り潰した面の上では、文字を地の色にする。**
  // 黒く塗ったアスコンの上に黒い文字を書くと読めない
  // （`DESIGN.md` §8 と同じ考え —— 地から遠いインクを選ぶ）。
  // **反転してよいのは、塗った面の上に載る文字だけ。**
  // 外へ出した名前は白い紙の上なので、反転すると**白い紙に白い字**になる
  // （2026-09-14。配線略図の信号機で踏んだ）。
  const outside = name !== null && name.kind === 'outside';
  const ink =
    plan && box.hatch === 'solid' && !outside ? { ...style, text: palette.paper } : style;

  /**
   * **模様の上の文字は、下地を抜く。**
   *
   * 点や斜線の上に文字を重ねると読めない。実物の図面も、
   * **文字のところで模様を切っている**（寸法線の数値と同じ扱い）。
   *
   * 塗り潰し（`solid`）は抜かない —— 文字を地の色にしてあるので、
   * 抜くと文字が消える。
   */
  //
  // **別の箱の模様の上に載った文字も抜く**（`under`。2026-09-15）。
  // 帯（`solid`）の上のタブ名が、同じ濃さで沈んでいた。
  // こちらは塗り潰しでも抜く —— 文字の色は変えられないので、下地を白く抜く。
  //
  // **文字を地の色にした箱では抜かない。** 抜くと白い板に白い字になる
  // （2026-09-15。区画の上に置いた塗り潰しの箱で踏んだ）。
  const inverted = ink.text === palette.paper;
  const halo =
    plan && !inverted && ((box.hatch !== 'none' && box.hatch !== 'solid') || under !== 'none')
      ? palette.paper
      : null;

  // **建具は壁に開く穴**（`src/openings.ts`）。壁を消してから記号を描く。
  const holes =
    plan && box.openings.length > 0
      ? drawOpenings(box, box.openings, style.stroke, style.fill, paint.strokeWidth)
      : '';

  return [
    `<g ${attributes} data-shape="${kind}">`,
    shape,
    pattern,
    holes,
    // **符号も、塗り潰した面の上では地の色にする**（`ink`）。
    // 本文だけ反転させて符号を置き去りにすると、符号が塗りに沈む
    // （2026-09-14。UI 構造図の「fixed」で出た）。書いたのに読めないのは、
    // 書いていないのと同じ。
    ...nodeTag(box, palette, ink, halo, textShift(kind)),
    ...nodeText(box, palette, ink, textShift(kind), plan ? name : null, halo),
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
function nodeTag(
  box: Box,
  palette: Palette,
  style: Look,
  halo: string | null = null,
  shift = 0,
): string[] {
  if (box.tag === null) return [];
  // **符号も、入らないなら出さない。** 伏図の小梁は幅 20px しかない。
  // **判断は `src/names.ts` に置いてある** —— `inspect` と `validate` が
  // 「出なかった符号」を知らせるので、ここと同じ物差しでないと嘘になる。
  if (!tagFits(box)) return [];
  /**
   * **印の中の符号は、印の真ん中。**
   *
   * 左上へ寄せていたので、二重丸（乗換駅）の**内側の丸が駅番号を横切っていた**
   * （2026-09-13）。実物の路線図の駅番号は丸の中央にある。
   * 矩形はこれまでどおり左上（伏図の部材符号は隅にある）。
   */
  // **菱形も真ん中へ。** 角に置くと、斜めの辺が文字を横切る
  // （2026-09-15。防虫の定点配置図で `ST-2` が線に食われていた）。
  const round =
    box.marker === 'circle' ||
    box.marker === 'double' ||
    box.marker === 'ellipse' ||
    box.marker === 'diamond';
  /**
   * **名前が無ければ、符号が中身そのもの。**
   *
   * 符号は本来「名前の脇に添える小さな字」だが、名前が無い箱では
   * **符号しか書いていない** —— 舞台照明の器具番号、花火の筒場、
   * ダンスの踊り手、定点の番号。見本 8 枚・78 個がこの形だった。
   * 副題の色と大きさで描くと、**図の主役がいちばん薄い字**になる（2026-09-15）。
   */
  const alone = box.label === '' && box.technology === null;
  const font = alone ? NAME_FONT : 10;
  const color = alone ? style.text : subtitleOn(style, palette);
  if (round || alone) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2 + (alone ? font / 3 : 4);
    const cover =
      halo === null
        ? ''
        : `<rect x="${n(cx - labelWidth(box.tag, font) / 2 - 2)}" y="${n(cy - font + 1)}" width="${n(labelWidth(box.tag, font) + 4)}" height="${n(font + 2)}" fill="${halo}"/>`;
    return [
      cover +
        `<text x="${n(cx)}" y="${n(cy)}" text-anchor="middle" font-family="${FONT}" font-size="${font}" fill="${color}">${escapeText(box.tag)}</text>`,
    ];
  }
  const x = box.x + TAG_INSET;
  /**
   * **上面の楕円の分だけ下げる**（`src/shapes.ts` の `textShift`）。
   *
   * 名前には掛けてあったのに、**符号にだけ掛けていなかった** ——
   * 見本 21（テーブルの関係）で、表名が円柱の上面の楕円に
   * 串刺しにされていた（2026-09-15。見本 7 枚・15 個）。
   * `textShift` のコメントが言うとおり、**楕円に字がかかると読めない。**
   */
  const y = box.y + TAG_INSET + 9 + shift * 2;
  // **模様の上では下地を抜く**（`halo`）。符号は拾い読みするものなので、
  // 読めないと役に立たない。
  const patch =
    halo === null
      ? ''
      : `<rect x="${n(x - 2)}" y="${n(y - 9)}" width="${n(labelWidth(box.tag, 10) + 4)}" height="12" fill="${halo}"/>`;
  return [
    patch +
      `<text x="${n(x)}" y="${n(y)}" font-family="${FONT}" font-size="10" fill="${subtitleOn(style, palette)}">${escapeText(box.tag)}</text>`,
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
 *
 * **配置図の置き方は `src/names.ts` が決める**（5 段 ＋ 外へ出すときの当たり判定）。
 * ここは決まったとおりに描くだけ。
 */
/** 縦に積んだときの、見た目の高さ。 */
function stackHeight(body: string, font: number): number {
  if (laysDown(body)) return font;
  return ([...body].length - 1) * font * 1.06 + font;
}

function nodeText(
  box: Box,
  palette: Palette,
  style: Look,
  shift = 0,
  plan: Plan | null = null,
  halo: string | null = null,
): string[] {
  // **名前が空なら、何も書かない。** 停車駅案内図の ● のように、
  // 名前を持たない印がある（駅名は上の行にある）。
  if (box.label === '' && box.technology === null) return [];
  // **文字の寄せ**（`src/align.ts`）。注記を箇条書きに見せるために要る。
  // 効くのは**横組みで箱に収まった名前**だけ —— 縦組み・回した字・外へ出した名前では
  // 「左」の指すものが変わるので、既定の中央のままにする。
  const stays =
    plan === null || plan.kind === 'stack' || plan.kind === 'along' || plan.kind === 'outside';
  // 印の無い箱には枠が無い。**書き手が置いた x が、そのまま行頭**であってほしい。
  const spot = anchorOf(
    stays ? 'center' : box.align,
    box,
    box.marker === 'none' ? 0 : ALIGN_INSET,
  );
  const cx = n(spot.x);
  const anchor = spot.anchor;
  const size = plan === null ? 15 : NAME_FONT;
  const subSize = plan === null ? 11 : SUB_FONT;
  const sub = subtitleOn(style, palette);

  const text = (
    x: number,
    y: number,
    body: string,
    font: number,
    fill: string,
    turn = '',
    at: 'start' | 'middle' | 'end' = anchor,
  ): string => {
    const label = `<text x="${n(x)}" y="${n(y)}" text-anchor="${at}" font-family="${FONT}" font-size="${font}" fill="${fill}"${turn}>${escapeText(body)}</text>`;
    if (halo === null) return label;
    // 文字の下地を抜く（模様を切る）。回っている文字にも同じ変換をかける。
    const w = labelWidth(body, font) + 6;
    const h = font + 3;
    const left = at === 'start' ? x - 3 : at === 'end' ? x - w + 3 : x - w / 2;
    const patch = `<rect x="${n(left)}" y="${n(y - font + 1)}" width="${n(w)}" height="${n(h)}" fill="${halo}"${turn}/>`;
    return patch + label;
  };

  // 構成図は、箱の大きさを文字から決めてある。必ず入るので選ばない。
  if (plan === null) {
    const mid = box.y + box.h / 2 + shift;
    if (box.technology === null) return [text(cx, mid + 5, box.label, size, style.text)];
    return [
      text(cx, mid - 2, box.label, size, style.text),
      text(cx, mid + 16, box.technology, subSize, sub),
    ];
  }

  // **符号の分だけ、中の文字を下げる。** 背の低い箱では符号と名前が重なる
  // （車両編成図で「2 号車」と「モハ 100-1」が同じ行に出た）。
  const crown = box.tag === null ? 0 : 12;
  const cy = box.y + crown + (box.h - crown) / 2;
  const turnAt = (x: number): string => ` transform="rotate(-90 ${n(x)} ${n(cy)})"`;

  if (plan.kind === 'joined') return [text(cx, cy + 4, plan.text, size, style.text)];

  if (plan.kind === 'aside') {
    return [
      text(cx + 6, cy + 4, box.label, size, style.text),
      text(box.x + 12, cy, box.technology!, subSize, sub, turnAt(box.x + 12)),
    ];
  }

  /**
   * **縦組み**（`src/write.ts`）。字を 1 つずつ上から積む。
   *
   * 副題は**右へ、小さく**（ふりがなの定位置）。
   * **ラテン文字だけは寝かせる** —— 積むと読めない（JIS X 4051 の横倒し）。
   * 寝かせる向きは**時計回り**で、実物の路線図のローマ字と同じ。
   */
  if (plan.kind === 'stack') {
    const hasSub = box.technology !== null;
    const total = size + (hasSub ? subSize + 2 : 0);
    const left = box.x + box.w / 2 - total / 2;
    const column = (body: string, colX: number, font: number, fill: string): string[] => {
      if (laysDown(body)) {
        const midY = box.y + stackHeight(box.label, size) / 2;
        return [text(colX, midY, body, font, fill, ` transform="rotate(90 ${n(colX)} ${n(midY)})"`)];
      }
      return [...body].map((glyph, i) => text(colX, box.y + font + i * font * 1.06, glyph, font, fill));
    };
    const lines = column(box.label, left + size / 2, size, style.text);
    if (hasSub) lines.push(...column(box.technology!, left + size + 2 + subSize / 2, subSize, sub));
    return lines;
  }

  if (plan.kind === 'along') {
    const lines = [text(cx, cy, box.label, size, style.text, turnAt(cx))];
    if (box.technology !== null && labelWidth(box.technology, subSize) + 8 <= box.h && box.w >= 26) {
      const sx = box.x + box.w / 2 + 11;
      lines.push(text(sx, cy, box.technology, subSize, sub, turnAt(sx)));
    }
    return lines;
  }

  if (plan.kind === 'outside') {
    // **どこへ、どれだけ離して置くかは `src/names.ts` が決めてある。**
    // ここは 1 行目の基準線から積むだけ。
    const step = (i: number): number => (plan.above ? plan.y - i * 12 : plan.y + i * 12);
    const first = plan.above && box.technology !== null ? 1 : 0;
    const lines = [text(plan.x, step(first), box.label, size, style.text)];
    if (box.technology !== null) {
      lines.push(text(plan.x, step(plan.above ? 0 : 1), box.technology, subSize, sub));
    }
    return lines;
  }

  if (box.technology === null) return [text(cx, cy + 4, box.label, size, style.text)];
  return [
    text(cx, cy - 4, box.label, size, style.text),
    text(cx, cy + 11, box.technology, subSize, sub),
  ];
}

function renderEdge(
  edge: PlacedEdge,
  placedLabel: EdgeLabel | null,
  palette: Palette,
  plan = false,
  arrows = true,
): string {
  if (edge.points.length < 2) return '';
  // **通り道の丸め方は正本が決める**（`src/curve.ts`）。書かなければ折れ線。
  const path = pathOf(edge.points, edge.curve, edge.close);
  const label =
    placedLabel === null
      ? ''
      : `<text x="${n(placedLabel.x)}" y="${n(placedLabel.y)}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${palette.text.edge}">${escapeText(placedLabel.text)}</text>`;
  return [
    `<g data-edge="${escapeAttr(edge.id)}" data-pinned="${edge.pinned}">`,
    // **配置図の動線は太く。** 壁を塗り潰したあと、細い線では動線が
    // 壁の黒に負けて読めない（避難経路図は矢印が主役）。
    //
    // **端の記号を書いた辺には、既定の矢印を付けない**（`src/ends.ts`）。
    // 記号が矢印の代わりで、両方出すと向きが二重に言われる。
    // **太さを書いていれば、それに従う**（`src/weight.ts`。路線図の路線）。
    // 書いていなければ、これまでどおり（配置図は太め、構成図は細め）。
    ...(() => {
      const width =
        edge.weight === 'normal'
          ? edge.pinned || plan
            ? STROKE_WIDTH.pinned
            : STROKE_WIDTH.auto
          : widthOf(edge.weight);
      const round = roundedOf(edge.weight) ? ' stroke-linejoin="round" stroke-linecap="round"' : '';
      const dash = dashOf(edge.line) === null ? '' : ` stroke-dasharray="${dashOf(edge.line)}"`;
      // **閉じた輪に矢印は付けない**（`src/curve.ts` の `close`）。
      // 矢印は「こちらへ向かう」意味だが、輪は出発点へ戻る ——
      // 池の輪郭に矢印が付くと、水が一方向へ流れているように読める。
      const head = arrows && !edge.close && !hasEnds(edge.ends) ? ' marker-end="url(#arrow)"' : '';
      const stroke = edge.color ?? palette.edge.stroke;
      /**
       * **閉じた輪の中を塗る**（`edges[].hatch`）。
       *
       * 線より先に描く —— 後から描くと、模様が輪郭に乗る。
       */
      const face =
        edge.close && edge.hatch !== 'none' && edge.points.length > 2
          ? drawHatchIn(edge.hatch, path, boundsOf(edge.points), edge.color ?? palette.edge.stroke, edge.id)
          : '';
      // **二重線は、同じ道を 2 回描く**（`src/line.ts`）。
      // 太い線の上に地の色の細い線を重ねると、線が 2 本に見える。
      // 平行線を計算し直さないので、折れ線でも曲線でも同じやり方で効く。
      if (!doubled(edge.line)) {
        return [face, `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}"${round}${dash}${head}/>`];
      }
      return [
        face,
        `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${n(width + DOUBLE_GAP * 2)}"${round}${head}/>`,
        `<path d="${path}" fill="none" stroke="${palette.paper}" stroke-width="${n(width)}"${round}/>`,
      ];
    })(),
    // 端の記号（ER の多重度・端子・接続点）。**向きは線から決める。**
    edge.points.length < 2
      ? ''
      : drawEnd(edge.ends?.to ?? 'none', edge.points[edge.points.length - 1]!, edge.points[edge.points.length - 2]!, palette.edge.stroke, palette.paper),
    edge.points.length < 2
      ? ''
      : drawEnd(edge.ends?.from ?? 'none', edge.points[0]!, edge.points[1]!, palette.edge.stroke, palette.paper),
    label,
    '</g>',
  ].join('');
}

/** 点列の外接矩形（閉じた輪の中を塗るのに使う）。 */
function boundsOf(points: { x: number; y: number }[]): { x: number; y: number; w: number; h: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
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
