/**
 * **エージェント専用カーソル**の指示（2026-11-12）。MCP の `screen` から画面へ降りる。
 *
 * 人が開いているアプリの画面の中で、エージェントが「いまどこを指しているか・何を押したか」を見せる。
 * **人のマウスとキーボードは使わない。** 動くのは画面の中に描いた紫の矢印だけ。
 * 仕様の正本は tadori の「エージェント専用カーソル」（各アプリで同じ見え方・同じ口）。
 *
 * ## やらないこと
 *
 * - **人の承認・保存の代わりをしない。** 「正本へ入れる」「見た」「保存」などは画面で `data-human-only` を付け、
 *   カーソルからは押せない（`app/lib/agent.ts` が止め、`pnpm gui:check` が見張る）
 * - OS のマウス・キー・ダイアログを動かさない。外のページへ移らない（`go` は `#` だけ）。座標で指さない
 *
 * ここは形の検査と、置き場所・表示時間の計算だけ。**DOM を知らない**ので、node で試験できる。
 */

export const AGENT_ACTIONS = ['point', 'click', 'type', 'go', 'say', 'filter'] as const;
export type AgentVerb = (typeof AGENT_ACTIONS)[number];

export interface AgentAction {
  action: AgentVerb;
  /** **画面に見えている言葉**（ボタンの文字・見出し・id）。座標は使わない。`go` は `#` で始まる場所 */
  target: string | null;
  /** `type` で欄に打つ文字。 */
  text: string | null;
  /** 吹き出しの文（500 文字まで）。 */
  message: string | null;
  /** 吹き出しを出す秒数（1〜60）。書かなければ文の長さで決める（`showMs`）。 */
  seconds: number | null;
}

/** 断る理由（文言は `messages()` の `agent*` が持つ）。 */
export type AgentRefusal =
  | 'not-object'
  | 'action-unknown'
  | 'target-missing'
  | 'target-too-long'
  | 'go-not-hash'
  | 'text-missing'
  | 'text-too-long'
  | 'message-missing'
  | 'message-too-long'
  | 'seconds-out-of-range';

export const MESSAGE_MAX = 500;
export const TARGET_MAX = 200;
export const TEXT_MAX = 2000;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);

/** 届いた指示を、形が合っているときだけ通す。**当て推量で埋めない。** */
export function parseAgentAction(raw: unknown): { ok: true; value: AgentAction } | { ok: false; reason: AgentRefusal } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'not-object' };
  const r = raw as Record<string, unknown>;
  const action = r.action;
  if (typeof action !== 'string' || !(AGENT_ACTIONS as readonly string[]).includes(action)) return { ok: false, reason: 'action-unknown' };
  const verb = action as AgentVerb;
  const target = str(r.target);
  const text = typeof r.text === 'string' ? r.text : null;
  const message = str(r.message);

  if (verb !== 'say' && target === null) return { ok: false, reason: 'target-missing' };
  if (target !== null && [...target].length > TARGET_MAX) return { ok: false, reason: 'target-too-long' };
  if (verb === 'go' && !target!.startsWith('#')) return { ok: false, reason: 'go-not-hash' };
  if (verb === 'type' && text === null) return { ok: false, reason: 'text-missing' };
  if (text !== null && [...text].length > TEXT_MAX) return { ok: false, reason: 'text-too-long' };
  if (verb === 'say' && message === null) return { ok: false, reason: 'message-missing' };
  if (message !== null && [...message].length > MESSAGE_MAX) return { ok: false, reason: 'message-too-long' };

  let seconds: number | null = null;
  if (r.seconds !== undefined && r.seconds !== null) {
    if (typeof r.seconds !== 'number' || !Number.isFinite(r.seconds) || r.seconds < 1 || r.seconds > 60) {
      return { ok: false, reason: 'seconds-out-of-range' };
    }
    seconds = r.seconds;
  }
  return { ok: true, value: { action: verb, target, text: verb === 'type' ? text : null, message, seconds } };
}

/** 吹き出しを出しておく時間。**5 秒＋1 文字 0.1 秒、上限 20 秒**（`seconds` があればそれ）。 */
export function showMs(message: string, seconds: number | null = null): number {
  if (seconds !== null) return seconds * 1000;
  return Math.min(20000, 5000 + [...message].length * 100);
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Side = 'top' | 'bottom' | 'right' | 'left';

/** 窓の端から内側へ空ける幅（px）。 */
export const BUBBLE_INSET = 8;
/** 指した所と吹き出しの間（しっぽの長さ）。 */
export const BUBBLE_GAP = 12;
/** 吹き出しの最大幅。これより長い文は折り返す。 */
export const BUBBLE_MAX_W = 280;

/**
 * **吹き出しの置き場所。** 上 → 下 → 右 → 左の順で、窓に収まる向きを選ぶ。
 * どれにも収まらなければ、いちばん空いている向きに置いて窓の内側へ押し込む。
 * しっぽ（`tail`）は指した所の真ん中を向く —— 吹き出しの縁の上で、指した所にいちばん近い点。
 */
export function bubblePlacement(
  target: Rect,
  bubble: { w: number; h: number },
  view: { w: number; h: number },
): { side: Side; x: number; y: number; tail: { x: number; y: number } } {
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const room: Record<Side, number> = {
    top: target.y - BUBBLE_GAP - BUBBLE_INSET,
    bottom: view.h - (target.y + target.h) - BUBBLE_GAP - BUBBLE_INSET,
    right: view.w - (target.x + target.w) - BUBBLE_GAP - BUBBLE_INSET,
    left: target.x - BUBBLE_GAP - BUBBLE_INSET,
  };
  const need: Record<Side, number> = { top: bubble.h, bottom: bubble.h, right: bubble.w, left: bubble.w };
  const order: Side[] = ['top', 'bottom', 'right', 'left'];
  const side = order.find((s) => room[s] >= need[s]) ?? order.reduce((a, b) => (room[b] - need[b] > room[a] - need[a] ? b : a));

  let x: number;
  let y: number;
  if (side === 'top' || side === 'bottom') {
    x = cx - bubble.w / 2;
    y = side === 'top' ? target.y - BUBBLE_GAP - bubble.h : target.y + target.h + BUBBLE_GAP;
  } else {
    y = cy - bubble.h / 2;
    x = side === 'left' ? target.x - BUBBLE_GAP - bubble.w : target.x + target.w + BUBBLE_GAP;
  }
  // **窓の内側 8px に収める**（はみ出す向きしか無いときも、吹き出しは窓の外へ出さない）
  const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
  x = clamp(x, BUBBLE_INSET, Math.max(BUBBLE_INSET, view.w - BUBBLE_INSET - bubble.w));
  y = clamp(y, BUBBLE_INSET, Math.max(BUBBLE_INSET, view.h - BUBBLE_INSET - bubble.h));
  const tail = { x: clamp(cx, x, x + bubble.w), y: clamp(cy, y, y + bubble.h) };
  return { side, x, y, tail };
}
