/**
 * **平面図の描き方**（Issue #4 の続き）。
 *
 * ## なぜ要るか
 *
 * `kind: placement` で座標と大きさを書けるようにしたが、
 * 出てくる絵は**角丸の箱に名前を書いて矢印で繋いだもの**だった。
 * 実物の間取り図・製図図面と並べると、**別物**（2026-09-12。人の指摘）。
 *
 * 実物を見て、差が出ているところを数えた。
 *
 * | | 実物 | zumen |
 * |---|---|---|
 * | 部屋の境 | **壁**。隣どうしが共有し、隙間がない | 角丸の箱が別々に浮く |
 * | 外周 | 太い線の**ひとつながり** | 破線の囲み |
 * | 矢印 | **無い** | 部屋の間に引いている |
 * | 建具 | 扉の開き勝手・窓・引き戸 | 無い |
 * | 文字 | 部屋名と広さを小さく | 箱の中央に大きく |
 *
 * ## どこまでやるか
 *
 * **建具の記号までは入れる。設備（浴槽・便器・流し）は入れない。**
 *
 * 建具は**壁に開く穴**なので、壁の話の続きで済む。
 * 設備は**物の形**で、入れ始めると `type` が 30 語を超える
 * —— [#6](https://github.com/meta-taro/zumen/issues/6) の報告者が警告した
 * 「構成図の語彙が少しずつ広がる」の、いちばん極端な形になる。
 *
 * **訂正（2026-09-12）。** ここには「通り芯・寸法線も入れない」と書いてあったが、
 * **取り消した**（`src/grid.ts`）。寸法の無い図は工事に使えないという指摘があり、そのとおりだった。
 * **寸法が無い図では、何も建てられない。**
 *
 * 表題欄は入れない。**あれは図ではなく用紙の話**で、貼り先が持っている。
 */

/** 建具。**壁に開く穴**として持つ。 */
export const OPENINGS = ['door', 'slide', 'window', 'double', 'open'] as const;
export type Opening = (typeof OPENINGS)[number];

/** どの辺に付くか。 */
export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];

/** 開く向き。**in は部屋の中へ（既定）、out は壁の外へ。** 日本の玄関ドアは外開き。 */
export const SWINGS = ['in', 'out'] as const;
export type Swing = (typeof SWINGS)[number];

/** 蝶番の側。**start は辺の始まり（上・左）、end は終わり（下・右）。** 戸を壁に沿わせる向きを選ぶ。 */
export const HINGES = ['start', 'end'] as const;
export type Hinge = (typeof HINGES)[number];

export interface Hole {
  /** 建具の種類。 */
  kind: Opening;
  /** どの辺か。 */
  side: Side;
  /** 辺のどこか（0〜1。既定は中央）。 */
  at: number;
  /** 幅（px）。 */
  width: number;
  /** 開く向き（書いたときだけ持つ。既定は in）。 */
  swing?: Swing;
  /** 蝶番の側（書いたときだけ持つ。既定は start。両開きには効かない）。 */
  hinge?: Hinge;
}

export function openingsOf(raw: unknown): Hole[] {
  if (!Array.isArray(raw)) return [];
  const out: Hole[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const { kind, side, at, width, swing, hinge } = item as Record<string, unknown>;
    if (!OPENINGS.includes(kind as Opening)) continue;
    if (!SIDES.includes(side as Side)) continue;
    const hole: Hole = {
      kind: kind as Opening,
      side: side as Side,
      at: typeof at === 'number' && at >= 0 && at <= 1 ? at : 0.5,
      width: typeof width === 'number' && width > 0 ? width : 36,
    };
    if (SWINGS.includes(swing as Swing)) hole.swing = swing as Swing;
    if (HINGES.includes(hinge as Hinge)) hole.hinge = hinge as Hinge;
    out.push(hole);
  }
  return out;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 辺の上の、穴の始点と向き。 */
function seat(box: Rect, hole: Hole): { x: number; y: number; dx: number; dy: number } {
  const span = hole.side === 'top' || hole.side === 'bottom' ? box.w : box.h;
  const offset = Math.max(0, Math.min(span - hole.width, span * hole.at - hole.width / 2));
  if (hole.side === 'top') return { x: box.x + offset, y: box.y, dx: 1, dy: 0 };
  if (hole.side === 'bottom') return { x: box.x + offset, y: box.y + box.h, dx: 1, dy: 0 };
  if (hole.side === 'left') return { x: box.x, y: box.y + offset, dx: 0, dy: 1 };
  return { x: box.x + box.w, y: box.y + offset, dx: 0, dy: 1 };
}

/** 壁の内側へ向かう向き（扉の弧を描く側）。 */
function inward(hole: Hole): { x: number; y: number } {
  if (hole.side === 'top') return { x: 0, y: 1 };
  if (hole.side === 'bottom') return { x: 0, y: -1 };
  if (hole.side === 'left') return { x: 1, y: 0 };
  return { x: -1, y: 0 };
}

function n(value: number): number {
  return Math.round(value);
}

/**
 * 建具を描く。
 *
 * **壁と同じ色の線だけで描く。** 塗りも影も使わない。
 * 記号は実物に合わせた —— 片開き戸は**弧と戸**、引き戸は**2 本の平行線**、
 * 窓は**壁を細い 2 本線で置き換える**、両開きは弧が 2 つ。
 */
export function drawOpenings(
  box: Rect,
  holes: readonly Hole[],
  stroke: string,
  paper: string,
  /** 壁の太さ（`src/wall.ts`）。**消す線はこれより太くないと壁が残る。** */
  wall = 2,
): string {
  const parts: string[] = [];
  for (const hole of holes) {
    const { x, y, dx, dy } = seat(box, hole);
    const w = hole.width;
    const to = { x: x + dx * w, y: y + dy * w };
    const into = inward(hole);

    // **まず壁を消す。** 建具は穴なので、そこに壁があってはいけない。
    parts.push(
      `<line x1="${n(x)}" y1="${n(y)}" x2="${n(to.x)}" y2="${n(to.y)}" ` +
        `stroke="${paper}" stroke-width="${wall + 2}"/>`,
    );

    if (hole.kind === 'open') continue; // 開口だけ（建具なし）。

    if (hole.kind === 'window') {
      // 窓。**壁を細い 2 本線で置き換える。**
      const off = 2;
      for (const s of [-off, off]) {
        parts.push(
          `<line x1="${n(x + into.x * s)}" y1="${n(y + into.y * s)}" ` +
            `x2="${n(to.x + into.x * s)}" y2="${n(to.y + into.y * s)}" ` +
            `stroke="${stroke}" stroke-width="1"/>`,
        );
      }
      continue;
    }

    if (hole.kind === 'slide') {
      // 引き戸。**2 本の平行線を半分ずつずらす。**
      const off = 2.5;
      parts.push(
        `<line x1="${n(x)}" y1="${n(y)}" ` +
          `x2="${n(x + dx * w * 0.55)}" y2="${n(y + dy * w * 0.55)}" ` +
          `stroke="${stroke}" stroke-width="2"/>`,
        `<line x1="${n(x + dx * w * 0.45 + into.x * off * 2)}" y1="${n(y + dy * w * 0.45 + into.y * off * 2)}" ` +
          `x2="${n(to.x + into.x * off * 2)}" y2="${n(to.y + into.y * off * 2)}" ` +
          `stroke="${stroke}" stroke-width="2"/>`,
      );
      continue;
    }

    // 片開き戸・両開き戸。**戸と、開き勝手の弧。**
    // 外開きは、戸と弧を壁の外側へ出す（2026-09-30。玄関がすべて内開きだった）。
    const out = hole.swing === 'out' ? -1 : 1;
    const opens = { x: into.x * out, y: into.y * out };
    const leaves = hole.kind === 'double' ? 2 : 1;
    const leaf = w / leaves;
    for (let i = 0; i < leaves; i += 1) {
      // 左右の戸は、それぞれ外側の端を軸に開く。片開きは hinge で側を選ぶ。
      const fromEnd = leaves === 2 ? i === 0 : hole.hinge !== 'end';
      const hinge = fromEnd
        ? { x, y }
        : { x: to.x, y: to.y };
      const dir = fromEnd ? 1 : -1;
      const tip = {
        x: hinge.x + opens.x * leaf,
        y: hinge.y + opens.y * leaf,
      };
      const arcEnd = {
        x: hinge.x + dx * leaf * dir,
        y: hinge.y + dy * leaf * dir,
      };
      parts.push(
        // 戸そのもの。
        `<line x1="${n(hinge.x)}" y1="${n(hinge.y)}" x2="${n(tip.x)}" y2="${n(tip.y)}" ` +
          `stroke="${stroke}" stroke-width="2"/>`,
        // 開き勝手の弧。**中心は蝶番**（戸の先が通る軌跡）。
        // 2026-09-29 まで sweep-flag が逆で、中心が蝶番の向かいの角に来て、弧が蝶番側へ凹んでいた
        // （扉は扇状に開くはず、という指摘）。向きは外積で決める。
        `<path d="M ${n(tip.x)} ${n(tip.y)} A ${n(leaf)} ${n(leaf)} 0 0 ${
          (tip.x - hinge.x) * (arcEnd.y - hinge.y) - (tip.y - hinge.y) * (arcEnd.x - hinge.x) > 0 ? 1 : 0
        } ${n(arcEnd.x)} ${n(arcEnd.y)}" fill="none" stroke="${stroke}" stroke-width="1"/>`,
      );
    }
  }
  return parts.join('');
}

/** **開き戸の扇**（蝶番を中心にした四分円）。`u` は戸が開いた向き、`v` は壁に沿って弧が向かう向き。 */
export interface Swing2D {
  cx: number;
  cy: number;
  r: number;
  u: { x: number; y: number };
  v: { x: number; y: number };
}

/** 開き戸・両開き戸が、開くときに通る扇。`drawOpenings` と同じ幾何。 */
export function swingsOf(box: Rect, holes: readonly Hole[]): Swing2D[] {
  const out: Swing2D[] = [];
  for (const hole of holes) {
    if (hole.kind !== 'door' && hole.kind !== 'double') continue;
    const { x, y, dx, dy } = seat(box, hole);
    const into = inward(hole);
    const sign = hole.swing === 'out' ? -1 : 1;
    const leaves = hole.kind === 'double' ? 2 : 1;
    const leaf = hole.width / leaves;
    for (let i = 0; i < leaves; i += 1) {
      const fromEnd = leaves === 2 ? i === 0 : hole.hinge !== 'end';
      const hinge = fromEnd ? { x, y } : { x: x + dx * hole.width, y: y + dy * hole.width };
      const dir = fromEnd ? 1 : -1;
      out.push({ cx: hinge.x, cy: hinge.y, r: leaf, u: { x: into.x * sign, y: into.y * sign }, v: { x: dx * dir, y: dy * dir } });
    }
  }
  return out;
}

/** 矩形が扇に食い込むか（縁に触れるだけは数えない）。 */
export function swingHits(swing: Swing2D, rect: Rect): boolean {
  const steps = 6;
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps; j += 1) {
      const px = rect.x + (rect.w * i) / steps - swing.cx;
      const py = rect.y + (rect.h * j) / steps - swing.cy;
      const a = px * swing.u.x + py * swing.u.y;
      const b = px * swing.v.x + py * swing.v.y;
      if (a > 2 && b > 2 && a * a + b * b < (swing.r - 2) ** 2) return true;
    }
  }
  return false;
}
