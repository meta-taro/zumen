/**
 * 図の色。**トークンから値への対応表を、ここ 1 か所に置く。**
 *
 * ## なぜ 1 か所か
 *
 * 以前は `render.ts` / `mermaid.ts` / `drawio.ts` の 3 か所に同じ色が書いてあり、
 * 「同じ値にしておく」というコメントが添えてあった。**それはズレる。**
 *
 * ## なぜ CSS 変数ではなく値なのか
 *
 * 書き出した図は**貼り先へ持ち出される**（Issue 007）。
 * 貼り先に zumen の CSS は無いので、**値を直に書くしかない。**
 *
 * ## 値の出どころ
 *
 * `md-business/apps/desktop/src/lib/styles/tokens.css`。
 * 姉妹アプリのデザイン正本へ揃える（`DESIGN.md`）。
 * **zumen が独自に決めた色はここに無い。**
 *
 * ## ダークの値も持つ（md-business#240）
 *
 * 以前は「**貼り先の地の色が分からない**」ので持たなかった（`DESIGN.md` §3）。
 * その理由は、**貼り先が自分で名乗るなら当たらない。**
 * 姉妹アプリは自分がダークかを知っていて、それを渡してくる。
 *
 * **既定はライトのまま。** 名乗らない貼り先の見え方は変えない。
 */

/** 姉妹アプリ `tokens.css` のライトの値。**名前はあちらに合わせる。** */
export const TOKEN = {
  accent: '#5b5bd6',
  accentSubtle: '#eeeefb',
  bgApp: '#ffffff',
  bgSubtle: '#fbfbfd',
  border: '#e8e8ed',
  borderStrong: '#d4d4dc',
  textPrimary: '#1c1c22',
  textSecondary: '#63636e',
  textTertiary: '#9b9ba5',
  neutralBg: '#f0f0f3',
  textOnAccent: '#ffffff',
} as const;

/**
 * 姉妹アプリ `tokens.css` の `:root[data-theme='dark']` の値。
 *
 * **ライトと同じ名前をすべて持つ。** 片方にしか無い色を作ると、
 * テーマを切り替えたときにその要素だけ浮く。
 */
export const DARK: Record<keyof typeof TOKEN, string> = {
  accent: '#7c7cf0',
  accentSubtle: '#1e1e3a',
  bgApp: '#0f0f13',
  bgSubtle: '#141418',
  border: '#26262d',
  borderStrong: '#34343d',
  textPrimary: '#f4f4f6',
  textSecondary: '#a0a0ab',
  textTertiary: '#6b6b76',
  neutralBg: '#22222a',
  textOnAccent: '#ffffff',
};

/** 貼り先が名乗るもの。**名乗らなければライト。** */
export type Theme = 'light' | 'dark';

/**
 * 見た目の濃さ。**呼ぶ側が選ぶ**（人の操作でも、エージェントへの指示でも）。
 *
 * オーナーの判断（2026-09-08）。**映えと安全のどちらかを常に勝たせない。**
 *
 * | | |
 * |---|---|
 * | `safe` | 淡く添える。既定。資料に混ぜても本文を邪魔しない |
 * | `vivid` | 主役を強く出す。遠くから見る場に向く |
 *
 * **「読めなくてよい」は選べない。** 白黒で区別が消えないことは、
 * どちらを選んでも守る（`DESIGN.md` §7、`test/legibility.test.ts`）。
 */
export type Intent = 'safe' | 'vivid';

export interface Look {
  fill: string;
  stroke: string;
  /** この地の上に置く文字。 */
  text: string;
  /**
   * 枠の破線。**色を捨てても残る 2 本目の道**（`null` なら実線）。
   *
   * `DESIGN.md` §2.3 の「**太さで示し、色で示さない**」と同じ考え。
   * 濃淡だけで区別しようとすると、**淡い色どうしが白から等距離**にあるため、
   * 白黒で 1.01:1 まで近づく（Issue #6 で実測）。
   * 文字を落として離そうとすると、今度は**その文字が地から読めなくなる**（2.42:1）。
   *
   * 囲みの破線（`6 4`）とは別の間隔にして、囲みと取り違えないようにする。
   */
  dash: string | null;
}

/**
 * `appearance`（仕様 §4 の意味の語）から見た目へ。
 *
 * **正本には色を書かない。** 語だけを書き、色はここで決める。
 * 知らない語は `NODE` として描く（捨てずに保つ。仕様 §9）。
 */
export const APPEARANCE: Record<string, Look> = paletteOf().appearance;

/** 既定のノード。**図の主役は関係であって箱ではない**ので、静かに。 */
export const NODE: Look = paletteOf().node;

/** 囲み（VPC・サブネット）。中身より一段沈める。 */
export const GROUP: Look = paletteOf().group;

/**
 * 線と、その頭。
 *
 * **枠の色（`borderStrong`）を使わない。** ヘアライン用の薄さなので、
 * 線に当てると地に沈んで読めなくなる（実際にそうなった）。
 * **図の主役は関係**なので、箱の枠より濃く出す。
 */
export const EDGE = { stroke: TOKEN.textSecondary } as const;

/** 文字。 */
export const TEXT = {
  node: TOKEN.textPrimary,
  group: TOKEN.textSecondary,
  edge: TOKEN.textSecondary,
} as const;

/**
 * 太さ。**人が置いたものは太くする。色は変えない。**
 *
 * 色で示すと `appearance` と混ざり、
 * 「人が青くした」のか「人が置いた」のかが区別できなくなる（`DESIGN.md` §2.3）。
 */
export const STROKE_WIDTH = { auto: 1, pinned: 2 } as const;

/** 語から見た目を引く。知らない語は既定へ落とす。 */
export function lookOf(appearance: string | null, palette: Palette = paletteOf()): Look {
  if (appearance === null) return palette.node;
  return palette.appearance[appearance] ?? palette.node;
}

export interface Palette {
  appearance: Record<string, Look>;
  node: Look;
  group: Look;
  edge: { stroke: string };
  text: { node: string; group: string; edge: string };
}

/**
 * テーマから、図に使う色をひとそろい作る。
 *
 * **上の定数（`NODE` 等）はライトのそれと同じもの。**
 * 既存の呼び出しを壊さないために残してある。
 */
/**
 * 相対輝度。**白黒にしたときの明るさ**（WCAG の定義）。
 *
 * ここに置くのは、**塗り潰した上に載せる文字を機械に選ばせる**ため。
 * 姉妹アプリのアクセントはライトで暗く、ダークで明るい。
 * どちらの文字が読めるかを人が覚えていると、**あちらが色を変えたときに崩れる。**
 */
function luminance(hex: string): number {
  const parts = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 塗り潰した地の上で、**読めるほうの文字**を選ぶ。 */
function inkOn(fill: string, light: string, dark: string): string {
  return contrast(light, fill) >= contrast(dark, fill) ? light : dark;
}

export function paletteOf(theme: Theme = 'light', intent: Intent = 'safe'): Palette {
  const t = theme === 'dark' ? DARK : TOKEN;

  /**
   * `primary` は「説明の主役」。**濃さだけが選べる。**
   *
   * `vivid` はアクセントで塗り潰す（遠くから見る場で効く）。
   * `safe` は淡い地にアクセントの枠（資料に混ぜても本文を邪魔しない）。
   */
  const primary: Look =
    intent === 'vivid'
      ? { fill: t.accent, stroke: t.accent, text: inkOn(t.accent, t.textOnAccent, t.bgApp), dash: null }
      : { fill: t.accentSubtle, stroke: t.accent, text: t.textPrimary, dash: null };

  return {
    appearance: {
      primary,
      /**
       * `muted` は「背景として添えるもの」。**枠を破線にする。**
       *
       * 色の濃淡だけでは足りない。姉妹アプリの淡い色は**どれも白の近く**にあり、
       * `primary` の地と 1.01:1 までしか離れない。
       * 文字を落として離そうとすると、その文字が地から読めなくなる（2.42:1）。
       *
       * **破線は色を捨てても残る。** 文字は `textSecondary` にして、
       * 読める濃さ（5.21:1）を保ったまま `primary` より静かにする。
       */
      muted: { fill: t.neutralBg, stroke: t.textTertiary, text: t.textSecondary, dash: '3 3' },
    },
    node: { fill: t.bgApp, stroke: t.borderStrong, text: t.textPrimary, dash: null },
    group: { fill: t.bgSubtle, stroke: t.border, text: t.textSecondary, dash: '6 4' },
    edge: { stroke: t.textSecondary },
    text: { node: t.textPrimary, group: t.textSecondary, edge: t.textSecondary },
  };
}
