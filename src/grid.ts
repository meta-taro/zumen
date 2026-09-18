/**
 * **通り芯と寸法線**（2026-09-12）。
 *
 * ## なぜ要るか
 *
 * 建築の図を出したところ、オーナーからこう返った。
 *
 * > 建築設備は、これ工事現場では使えないかと。**不動産の間取り図レベル**です。
 *
 * **そのとおりだった。** 実物の平面詳細図・伏図と並べると、
 * 部屋の形は合っていても、**現場が必要とする情報が 1 つも無い。**
 *
 * | | 不動産の間取り図 | 現場の図面 |
 * |---|---|---|
 * | 寸法 | **無い**（「16 畳」だけ） | **数値で入る**（1000 / 1650 / 750 / 総 4200） |
 * | 基準 | 無い | **通り芯**（X1・Y1…）。全部これから測る |
 * | 方位 | 無いことが多い | **方位記号** |
 *
 * **寸法が無い図では、何も建てられない。**
 * 「不動産の間取り図レベル」というのは、そういう意味だった。
 *
 * ## 前に「入れない」と書いたことの訂正
 *
 * `src/openings.ts` と仕様 §3.1.2 に
 * **「通り芯・寸法線・柱・表題欄は入れない」**と書いた。**これを取り消す。**
 *
 * 理由は「あれは建物を記述する道具で、zumen とはデータの形が違う」だったが、
 * **形は違わなかった。** 通り芯は「軸の上の位置に名前を付けたもの」で、
 * 寸法はそこから機械的に出る。ノードを増やすわけでも `type` を増やすわけでもない。
 *
 * **入れないままなら、建築の人はこの道具を使えない。**
 *
 * ## それでも入れないもの
 *
 * **設備（浴槽・便器・ポンプ・バルブ）と表題欄は、まだ入れない。**
 * 設備は物の形で、入れ始めると `type` が 30 語を超える。
 * 表題欄は図ではなく用紙の話で、貼り先（資料・Markdown）が持っている。
 */
import { labelWidth } from './layout.ts';
import { INCH } from './units.ts';
import type { Box } from './layout.ts';

/** 基準線の印。 */
export const MARKS = ['code', 'level', 'tick'] as const;
export type Mark = (typeof MARKS)[number];

/** 通り芯 1 本。 */
export interface Axis {
  /** 符号（`X1` / `Y1` / `GL±0` / `2FL+3,200`）。 */
  id: string;
  /** 図の座標（px）。 */
  at: number;
  /**
   * **印の形。**
   *
   * | | |
   * |---|---|
   * | `code`（既定） | 丸で囲んだ符号。**平面図の通り芯** |
   * | `level` | 三角の高さ記号と、その脇に書く値。**断面図・立面図のレベル** |
   * | `tick` | 目盛りと名前だけ。**時間軸**（工程表・ガントチャート） |
   *
   * ## `tick` —— 時間軸
   *
   * 工程表を 1 枚描いて分かった（2026-09-13）。**道具は 1 つ足りなかった。**
   *
   * | | 通り芯（`code`） | 時間軸（`tick`） |
   * |---|---|---|
   * | 印 | 丸で囲んだ符号 | **名前だけ**（`4月`・`T+0`） |
   * | 寸法 | 芯どうしと総寸法 | **引かない** |
   *
   * 丸で囲むと「通り芯」に見え、寸法を引くと
   * **`60 / 60 / 60 / 60 / 総 240` という意味のない数字**が並ぶ
   * （名前が既に月を言っている）。
   *
   * 工程表・ネットワーク工程表・ガントチャート・タイムチャートは、
   * すべて「時刻の目盛りと、その上に伸びる帯」でできている。
   *
   * ## なぜ `kind: section` を足さなかったか
   *
   * 断面図を 1 枚描いて確かめた（2026-09-12）。**8 割はそのまま描けた。**
   * 座標の `y` を高さとして読み替えるだけで、寸法も通り芯も効く。
   *
   * 違ったのは 3 点。
   *
   * 1. 横の基準線が**通り芯ではなくレベル**（`GL±0` / `2FL+3,200`）で、記号が違う
   * 2. **方位が要らない** —— これは `north` を書かなければ済む（正本が決める）
   * 3. 貫通・埋設で**箱が重なるのが普通** —— 重なりは観測値で、失敗ではない
   *
   * **測り方は配置図と同じ**（置き場所は正本に書いてある）。
   * `src/kind.ts` に「3 つ目の `kind` を足すのは、測り方が 3 つ目になるときだけ。
   * 断面図を足したくなっても、測り方が配置図と同じなら足さない」と書いてあり、
   * **自分で書いた歯止めに当たった。**
   *
   * 残った違いは 1 だけなので、**基準線の印を選べるようにした。**
   */
  mark: Mark;
}

export interface Grid {
  /** 縦に走る芯（左右方向の位置を決める）。 */
  x: Axis[];
  /** 横に走る芯（上下方向の位置を決める）。 */
  y: Axis[];
}

/** 空の通り芯。**書かなければ何も描かない。** */
export const NO_GRID: Grid = { x: [], y: [] };

export function gridOf(raw: unknown): Grid {
  if (raw === null || typeof raw !== 'object') return NO_GRID;
  const { x, y } = raw as Record<string, unknown>;
  return { x: axesOf(x), y: axesOf(y) };
}

function axesOf(raw: unknown): Axis[] {
  if (!Array.isArray(raw)) return [];
  const out: Axis[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const { id, at } = item as Record<string, unknown>;
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    const label = id === undefined || id === null ? '' : String(id);
    if (label === '') continue;
    const mark = (item as Record<string, unknown>).mark;
    out.push({ id: label, at, mark: mark === 'level' || mark === 'tick' ? mark : 'code' });
  }
  // **同じ入力から同じ絵**（D2）。書いた順に依らず、位置の順で並べる。
  return out.sort((a, b) => a.at - b.at);
}

export function hasGrid(grid: Grid): boolean {
  return grid.x.length > 0 || grid.y.length > 0;
}

/**
 * **1 px が何 mm か**（`scale: { mm: 25 }`）。
 *
 * 書かなければ寸法の数値を出さない。**知らない値を出すより出さないほうがよい。**
 * 現場の図面で寸法が間違っていることの害は、寸法が無いことより大きい。
 */
export interface Scale {
  /** 1 px が何 mm か。**中では必ずミリで持つ。** */
  mm: number;
  /** 寸法をフィートとインチで書くか（`scale: { in: … }` と書いたとき）。 */
  feet: boolean;
}

/**
 * 縮尺を読む。**単位もここで決まる。**
 *
 * | 書き方 | 1 px | 寸法 |
 * |---|---|---|
 * | `scale: { mm: 40 }` | 40 mm | `14,000` |
 * | `scale: { in: 1.5 }` | 1.5 インチ | `46'-0"` |
 *
 * **両方書いてあったらミリを採る。** 黙って混ぜるより、片方を無視して
 * 検証器に言わせるほうが、書いた側が気づける（`scale-both-units`）。
 */
export function scaleOf(raw: unknown): Scale | null {
  if (raw === null || typeof raw !== 'object') return null;
  const { mm, in: inches } = raw as Record<string, unknown>;
  if (typeof mm === 'number' && Number.isFinite(mm) && mm > 0) return { mm, feet: false };
  if (typeof inches === 'number' && Number.isFinite(inches) && inches > 0) {
    return { mm: inches * INCH, feet: true };
  }
  return null;
}

/** 方位。**書かなければ描かない。** */
export const NORTHS = ['up', 'right', 'down', 'left'] as const;
export type North = (typeof NORTHS)[number];

/**
 * **方位の印**（向きと、置き場所）。
 *
 * 置き場所は書かなくてよい（既定は紙の右上）。
 * **書けるようにしたのは、図が紙の一部しか使っていない紙があるため**
 * —— 右半分が表の紙では、右上の印が図から遠く離れて浮く（2026-09-18）。
 * 実物の販売図面は、**必ず図のそば**に小さく置いてある。
 */
export interface NorthMark {
  face: North;
  /** 紙の座標。**書かなければ紙の右上**（これまでどおり）。 */
  at: { x: number; y: number } | null;
}

export function northOf(raw: unknown): NorthMark | null {
  if (NORTHS.includes(raw as North)) return { face: raw as North, at: null };
  if (raw === null || typeof raw !== 'object') return null;
  const map = raw as { face?: unknown; at?: unknown };
  if (!NORTHS.includes(map.face as North)) return null;
  const at = map.at as { x?: unknown; y?: unknown } | undefined;
  const has = at !== null && typeof at === 'object' && typeof at?.x === 'number' && typeof at?.y === 'number';
  return { face: map.face as North, at: has ? { x: Number(at!.x), y: Number(at!.y) } : null };
}

/**
 * 通り芯と寸法線のために、図の外側へ空ける分。
 *
 * 実物では、建物の外側へ**内から順に**置かれる —— 詳細の寸法、総寸法、通り芯の符号。
 * 下と左に寸法、四方に符号が出る。
 */
export const MARGIN = { near: 26, far: 50, code: 78, top: 46, right: 46 } as const;

/** レベルの矢印と、その先に名前を書き始めるまでの距離（`src/dimensions.ts` と揃える）。 */
const LEVEL_ARM = 19;

/** 通り芯の符号を囲む丸の半径（`src/dimensions.ts` と揃える）。 */
export const CODE_R = 12;

/**
 * **符号の丸が、紙の中に収まるのに要る余白。**
 *
 * 丸の中心は芯の先から `CODE_R + 2` 外側にあり、丸はさらに `CODE_R` 外へ広がる。
 * ここを足していなかったので、**上に並ぶ符号がまるごと紙の外へ出ていた**
 * （2026-09-15。見本 27・28・31 で X1〜X6 の丸が 1 つも描かれていなかった）。
 */
const CODE_MARGIN = MARGIN.code + CODE_R + 2 + CODE_R;

export function marginFor(grid: Grid): { left: number; top: number; right: number; bottom: number } {
  if (!hasGrid(grid)) return { left: 0, top: 0, right: 0, bottom: 0 };
  // **レベルは値を脇に書く**ので、丸の符号より外へ張り出す（`GL±0` / `2FL+3,200`）。
  //
  // **2026-09-15 の訂正。** 見積もりが `字数 × 9 + 24` で、
  // **矢印の位置（`MARGIN.code` ＋ 19）が入っていなかった。**
  // そのため見本 42・43 の断面図で、左のレベル名が 50px ほど切れて
  // **矢印の先だけが画用紙の縁に残っていた。**
  // 断面図でレベルが読めないなら、それは断面図ではない。
  const level = grid.y.some((axis) => axis.mark === 'level');
  const widest = level
    ? Math.max(
        ...grid.y
          .filter((a) => a.mark === 'level')
          .map((a) => MARGIN.code + LEVEL_ARM + labelWidth(a.id, 10)),
      )
    : 0;
  // **時間軸は名前だけ。** 丸も寸法も出ないので、余白は少なくて済む。
  const ticksX = grid.x.length > 0 && grid.x.every((axis) => axis.mark === 'tick');
  const ticksY = grid.y.length > 0 && grid.y.every((axis) => axis.mark === 'tick');
  return {
    left: grid.y.length === 0 ? 0 : ticksY ? 56 : Math.max(CODE_MARGIN, widest),
    top: MARGIN.top + CODE_R - 2,
    right: Math.max(MARGIN.right + CODE_R - 2, widest),
    bottom: grid.x.length === 0 ? 0 : ticksX ? 12 : CODE_MARGIN,
  };
}

/** 図の中身が占める矩形（通り芯の長さを決めるのに使う）。 */
export function extentOf(boxes: readonly Box[], groups: readonly Box[]): Box | null {
  const all = [...boxes, ...groups];
  if (all.length === 0) return null;
  const x = Math.min(...all.map((b) => b.x));
  const y = Math.min(...all.map((b) => b.y));
  return {
    ...all[0]!,
    x,
    y,
    w: Math.max(...all.map((b) => b.x + b.w)) - x,
    h: Math.max(...all.map((b) => b.y + b.h)) - y,
  };
}
