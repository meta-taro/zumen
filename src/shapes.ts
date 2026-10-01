/**
 * **`type` を形にする**（Issue #9）。
 *
 * ## なぜ要るか
 *
 * [#6] で「**色は補助、意味は形と位置で持たせる**」と決めた
 * （白黒でも色覚特性でも縮小でも失われないため）。
 * ところが**その形が 1 種類しか無かった。**
 *
 * ```
 * $ grep -o '<\(rect\|circle\|ellipse\|polygon\)' 図.svg | sort | uniq -c
 *      17 <rect     ← ノード 12 ＋ 囲み 5。円も楕円も多角形も 0
 * ```
 *
 * `render.ts` が `box.type` を一度も読んでいなかった。
 * **Mermaid だけが形を出していた**ので、同じ正本から書き出し先ごとに違う絵が出ていた。
 *
 * ## どこまで形にするか
 *
 * **全部に別の形を与えない。** 見分けが付くことが目的で、形を増やすのが目的ではない。
 * 4〜5 種が明確に違えば、残りは矩形でも読める（報告者の整理）。
 *
 * ここで形を持つのは 6 種。**残りは矩形のまま。**
 *
 * ## ベンダーのロゴは持ち込まない
 *
 * D7（ライセンス）と [#6] の整理のとおり、**抽象化した形だけ**。
 * AWS のアイコンを使うと「AWS 上にある」と読まれ、自前サーバの図に使えない。
 *
 * ## 寸法
 *
 * 形によって、ラベルの外に要る余白が変わる（円柱は上下、六角形は左右）。
 * `growFor()` が返す分を `layout.ts` が箱の寸法へ足す。
 * **先に形を決めて、幅の計算をそれに合わせる**（順序が逆だとラベルがはみ出す）。
 */

/** 形の種類。**`type` から引く。** */
export type ShapeKind =
  | 'rect'
  | 'cylinder'
  | 'stacked'
  | 'cloud'
  | 'hexagon'
  | 'queue'
  | 'double';

/**
 * `type` から形へ。**知らない語は矩形。**
 *
 * Mermaid（`src/mermaid.ts`）と同じ割り当てにしてある。
 * **書き出し先どうしで図の読み方が変わらないため。**
 */
const SHAPES: Record<string, ShapeKind> = {
  database: 'cylinder',
  storage: 'stacked',
  internet: 'cloud',
  cache: 'hexagon',
  queue: 'queue',
  container: 'double',
};

export function shapeOf(type: string | null): ShapeKind {
  if (type === null) return 'rect';
  return SHAPES[type] ?? 'rect';
}

/** 円柱の上面・下面の高さ（半径）。 */
const CAP = 9;
/** 六角形の左右の張り出し。 */
const POINT = 14;
/** 積み重ねのずらし幅。 */
const OFFSET = 6;
/** 二重枠の内側の間隔。 */
const INSET = 4;

/**
 * その形が、矩形より余分に要る寸法。
 *
 * **ラベルの外側に要る分だけ。** 中身が同じなら、形が違っても字は同じ大きさで入る。
 */
export function growFor(kind: ShapeKind): { w: number; h: number } {
  if (kind === 'cylinder') return { w: 0, h: CAP * 2 };
  if (kind === 'hexagon') return { w: POINT * 2, h: 0 };
  // 雲は**輪郭が内側へ食い込む**（上下の弧が左右を削る）ので、
  // 見た目の幅より広く取らないとラベルがはみ出す（実際にはみ出した）。
  if (kind === 'cloud') return { w: 64, h: 24 };
  if (kind === 'stacked') return { w: OFFSET, h: OFFSET };
  // 仕切りの線が右側を占めるぶん。**線の下に字が来ないだけ広げる。**
  if (kind === 'queue') return { w: 32, h: 0 };
  if (kind === 'double') return { w: INSET * 2, h: INSET * 2 };
  return { w: 0, h: 0 };
}

export interface Box2 {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Paint {
  fill: string;
  stroke: string;
  strokeWidth: number;
  dash: string | null;
}

/** 座標を整数にする（`src/render.ts` と同じ扱い）。 */
function n(value: number): number {
  return Math.round(value);
}

function attrs(paint: Paint): string {
  const dash = paint.dash === null ? '' : ` stroke-dasharray="${paint.dash}"`;
  return `fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"${dash}`;
}

/**
 * 形を描く。
 *
 * **貼り先で崩れない範囲だけを使う**（Issue 007）。
 * `<path>` `<rect>` `<ellipse>` `<polygon>` `<line>` のみ。
 * グラデーション・フィルタ・`<style>` は使わない。
 */
export function drawShape(kind: ShapeKind, box: Box2, paint: Paint): string {
  const { x, y, w, h } = { x: n(box.x), y: n(box.y), w: n(box.w), h: n(box.h) };
  const a = attrs(paint);

  if (kind === 'cylinder') {
    // 上面の楕円 ＋ 胴。**下面は胴の弧で閉じる**（線が二重にならない）。
    const body =
      `M ${x} ${y + CAP} L ${x} ${y + h - CAP} ` +
      `A ${w / 2} ${CAP} 0 0 0 ${x + w} ${y + h - CAP} L ${x + w} ${y + CAP}`;
    return [
      `<path d="${body}" ${a}/>`,
      `<ellipse cx="${x + w / 2}" cy="${y + CAP}" rx="${w / 2}" ry="${CAP}" ${a}/>`,
    ].join('');
  }

  if (kind === 'stacked') {
    // 後ろの 1 枚をずらして重ねる。**「複数ある入れ物」に見える。**
    return [
      `<rect x="${x + OFFSET}" y="${y}" width="${w - OFFSET}" height="${h - OFFSET}" rx="4" ${a}/>`,
      `<rect x="${x}" y="${y + OFFSET}" width="${w - OFFSET}" height="${h - OFFSET}" rx="4" ${a}/>`,
    ].join('');
  }

  if (kind === 'cloud') {
    // 円を 3 つ重ねた輪郭。**外の世界＝境界が曖昧なもの**を表す。
    const r = Math.min(h / 2, w / 5);
    const cy = y + h / 2;
    const d =
      `M ${x + r} ${y + h} ` +
      `A ${r} ${r} 0 0 1 ${x + r} ${cy - r * 0.2} ` +
      `A ${r * 1.2} ${r * 1.2} 0 0 1 ${x + w / 2} ${y} ` +
      `A ${r * 1.1} ${r * 1.1} 0 0 1 ${x + w - r} ${cy - r * 0.2} ` +
      `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} Z`;
    return `<path d="${d}" ${a}/>`;
  }

  if (kind === 'hexagon') {
    const p = [
      `${x + POINT},${y}`,
      `${x + w - POINT},${y}`,
      `${x + w},${y + h / 2}`,
      `${x + w - POINT},${y + h}`,
      `${x + POINT},${y + h}`,
      `${x},${y + h / 2}`,
    ].join(' ');
    return `<polygon points="${p}" ${a}/>`;
  }

  if (kind === 'queue') {
    // 矩形に縦の仕切り。**並んで待っているもの**に見える。
    const gap = 7;
    const lines = [1, 2, 3]
      .map(
        (i) =>
          `<line x1="${x + w - gap * i}" y1="${y}" x2="${x + w - gap * i}" y2="${y + h}" ` +
          `stroke="${paint.stroke}" stroke-width="${paint.strokeWidth}"/>`,
      )
      .join('');
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" ${a}/>${lines}`;
  }

  if (kind === 'double') {
    // 二重の枠。**中に何かを入れる器**であることを示す。
    return [
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${a}/>`,
      `<rect x="${x + INSET}" y="${y + INSET}" width="${w - INSET * 2}" height="${h - INSET * 2}" ` +
        `rx="4" fill="none" stroke="${paint.stroke}" stroke-width="1"/>`,
    ].join('');
  }

  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${a}/>`;
}

/**
 * 文字を置く中心の、上下のずらし。
 *
 * 円柱は上面の楕円があるので、その分だけ下げる。**楕円に字がかかると読めない。**
 */
export function textShift(kind: ShapeKind): number {
  if (kind === 'cylinder') return CAP;
  if (kind === 'stacked') return OFFSET / 2;
  return 0;
}

/**
 * draw.io（mxGraph）の形。
 *
 * **長く存在する形だけを使う。** 新しい名前は、受け取った draw.io の版で
 * 描かれない可能性がある。**描かれないより、四角のほうがまし。**
 *
 * ここに無い形（`stacked` / `double`）は**四角へ落ちる**。仕様 §7 に書いてある。
 * こちらで draw.io を開いて確かめられないので、**確実なものだけに絞ってある。**
 */
export function drawioStyleOf(kind: ShapeKind): string {
  if (kind === 'cylinder') return 'shape=cylinder;boundedLbl=1;';
  if (kind === 'hexagon') return 'shape=hexagon;';
  if (kind === 'cloud') return 'ellipse;shape=cloud;';
  if (kind === 'queue') return 'shape=process;';
  return 'rounded=1;';
}
