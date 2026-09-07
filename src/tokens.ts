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
};

/** 貼り先が名乗るもの。**名乗らなければライト。** */
export type Theme = 'light' | 'dark';

export interface Look {
  fill: string;
  stroke: string;
}

/**
 * `appearance`（仕様 §4 の意味の語）から見た目へ。
 *
 * **正本には色を書かない。** 語だけを書き、色はここで決める。
 * 知らない語は `NODE` として描く（捨てずに保つ。仕様 §9）。
 */
export const APPEARANCE: Record<string, Look> = {
  primary: { fill: TOKEN.accentSubtle, stroke: TOKEN.accent },
  muted: { fill: TOKEN.neutralBg, stroke: TOKEN.textTertiary },
};

/** 既定のノード。**図の主役は関係であって箱ではない**ので、静かに。 */
export const NODE: Look = { fill: TOKEN.bgApp, stroke: TOKEN.borderStrong };

/** 囲み（VPC・サブネット）。中身より一段沈める。 */
export const GROUP: Look = { fill: TOKEN.bgSubtle, stroke: TOKEN.border };

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
export function paletteOf(theme: Theme = 'light'): Palette {
  const t = theme === 'dark' ? DARK : TOKEN;
  return {
    appearance: {
      primary: { fill: t.accentSubtle, stroke: t.accent },
      muted: { fill: t.neutralBg, stroke: t.textTertiary },
    },
    node: { fill: t.bgApp, stroke: t.borderStrong },
    group: { fill: t.bgSubtle, stroke: t.border },
    edge: { stroke: t.textSecondary },
    text: { node: t.textPrimary, group: t.textSecondary, edge: t.textSecondary },
  };
}
