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
 * `md-business/apps/desktop/src/lib/styles/tokens.css`（**ライトの値**）。
 * 姉妹アプリのデザイン正本へ揃える（`DESIGN.md`）。
 *
 * **ダークの値は持たない。** 貼り先の地の色が分からないので、
 * 書き出しは常にライトを使う（`DESIGN.md` §3）。
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
export function lookOf(appearance: string | null): Look {
  if (appearance === null) return NODE;
  return APPEARANCE[appearance] ?? NODE;
}
