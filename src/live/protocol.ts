/**
 * 画面とエージェントを繋ぐ線の、形（D34）。
 *
 * ## なぜ線が要るか
 *
 * これまで、エージェントが `zumen_propose` を呼ぶと**ファイルだけが書き換わり**、
 * 開いているアプリは**古い図を映したまま**だった。人は開き直すしかない。
 * それでは「あー、そうじゃなくてこう」という往復ができない。
 *
 * ## ここに何を置かないか
 *
 * **判断を置かない。** ここは語彙だけ。誰が何をしてよいかは `hub.ts`、
 * 外との出入りは `server.ts` にある。
 *
 * ## 承認の線は動かさない（D5 / D13 / D18）
 *
 * 線が繋がっても、**提案は画面に出るだけ**で正本には入らない。
 * 入れるのは人が「正本へ入れる」を押したとき。
 * **エージェント側には、押す口が無い。**
 */

/** 線を張る場所。**127.0.0.1 にしか開かない。** */
export const LIVE_HOST = '127.0.0.1';
export const LIVE_PORT = 4999;

/**
 * 繋いでよい相手（`Origin`）。
 *
 * ## これが何を止めるか
 *
 * ブラウザで開いていた**どこかの web ページ**が、裏で `127.0.0.1:4999` へ
 * 繋いで、開いている図を読んでいくこと。そのページの `Origin` は
 * `https://どこか` なので、ここで止まる。
 *
 * ## これが何を止めないか
 *
 * **同じ機械で動く別のプログラム。** `Origin` は自分で名乗るものなので、
 * ブラウザの外からは何とでも書ける。**これは鍵ではない。**
 * 線は 127.0.0.1 にしか開かないので、いまはここまでとする。
 * **止めるべき条件は D34 に書いた。**
 *
 * ## なぜ番号を決め打ちにしないか
 *
 * 画面は `pnpm dev` なら 5173、埋まっていれば 5180、
 * `pnpm gui:check` なら 5178 で立つ。**番号を並べると、必ず足りなくなる。**
 * 手元の番号を 1 つ増やすたびに線が切れるのは、守りではなく事故。
 * **localhost かどうかだけを見る** —— 遠くのページは localhost を名乗れない。
 */
const LOCAL_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

/** 殻（Tauri）の中から来る `Origin`。**OS で違う。** */
export const SHELL_ORIGINS: readonly string[] = [
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
];

/** `Origin` が無い相手（`curl` や殻の一部）は通す。**ブラウザは必ず付ける。** */
export function originAllowed(origin: string | undefined): boolean {
  if (origin === undefined || origin === '') return true;
  return SHELL_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);
}

/** 画面がいま映しているもの。**保存前の手直しを含む。** */
export interface Screen {
  /** 開いている図の道。**ブラウザで開いたときは名前しか分からない。** */
  path: string | null;
  name: string | null;
  /** 画面が持っている正本そのもの。**ディスクより新しいことがある。** */
  source: string;
  /** 人がいま選んでいる要素。 */
  selected: string | null;
  /** 保存していない手直しがあるか。 */
  dirty: boolean;
  /** 決着していない食い違いの数。 */
  conflicts: number;
  /** 人がこの図を見たと印を付けているか。 */
  reviewed: boolean;
}

/** 画面が何も開いていない状態。**「繋がっているが空」と「繋がっていない」は別。** */
export const EMPTY_SCREEN: Screen = {
  path: null,
  name: null,
  source: '',
  selected: null,
  dirty: false,
  conflicts: 0,
  reviewed: false,
};

/** 人が提案に出した答え。**`timeout` と `gone` は答えではない。** */
export type Decision = 'applied' | 'discarded' | 'timeout' | 'gone';

/** 画面へ送るもの。 */
export type ToScreen =
  /** 繋がった。 */
  | { kind: 'hello'; server: string }
  /** 提案が来た。**画面に出すだけ。正本には入れない。** */
  | { kind: 'offer'; id: string; path: string | null; source: string; note: string | null }
  /** 「この箱のことです」と指す。**選ぶだけで、何も変えない。** */
  | { kind: 'point'; ids: string[]; note: string | null }
  /** 出した提案を引っ込める（エージェントが言い直した）。 */
  | { kind: 'withdraw'; id: string };

/** 画面から来るもの。 */
export type FromScreen =
  | { kind: 'showing'; screen: Screen }
  | { kind: 'decided'; id: string; choice: 'applied' | 'discarded' };

/** 画面から来た JSON を、形が合っているときだけ通す。**当て推量で埋めない。** */
export function readFromScreen(value: unknown): FromScreen | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;
  if (body.kind === 'decided') {
    const { id, choice } = body;
    if (typeof id !== 'string' || (choice !== 'applied' && choice !== 'discarded')) return null;
    return { kind: 'decided', id, choice };
  }
  if (body.kind !== 'showing') return null;
  const screen = readScreen(body.screen);
  return screen === null ? null : { kind: 'showing', screen };
}

function readScreen(value: unknown): Screen | null {
  if (typeof value !== 'object' || value === null) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.source !== 'string') return null;
  return {
    path: typeof body.path === 'string' ? body.path : null,
    name: typeof body.name === 'string' ? body.name : null,
    source: body.source,
    selected: typeof body.selected === 'string' ? body.selected : null,
    dirty: body.dirty === true,
    conflicts: typeof body.conflicts === 'number' ? body.conflicts : 0,
    reviewed: body.reviewed === true,
  };
}
