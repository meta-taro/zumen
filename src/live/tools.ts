/**
 * 画面と繋ぐ口の中身（D34）。**MCP の話をここに持ち込まない**（`src/tools.ts` と同じ）。
 *
 * ## 何が新しいか
 *
 * これまで、エージェントが見ていたのは**ディスク**だった。
 * 人が画面で箱を動かしても、保存するまでエージェントには見えない。
 * 提案を入れても、開いている画面は**古い図を映したまま**だった。
 *
 * ここを通すと、**エージェントが見るのは画面**になる。
 *
 * ## 承認の線は動かさない
 *
 * 提案は画面に出るだけで、正本には入らない。
 * 入れるのは人が「正本へ入れる」を押したとき。**ここに押す口は無い。**
 */
import { messages } from '../messages.ts';
import { hasError, validate } from '../validate.ts';
import type { Finding } from '../validate.ts';
import type { Hub } from './hub.ts';
import type { Decision } from './protocol.ts';

/** 待てる上限。**無限に待たない** —— エージェントが止まったように見える。 */
export const MAX_WAIT_S = 300;

export interface LiveStatus {
  /** 繋がっている画面の数。**0 なら、人はこの画面を見ていない。** */
  screens: number;
  /** 開いている図の道。 */
  path: string | null;
  name: string | null;
  /** 人がいま選んでいる要素。**「どれの話か」の手掛かり。** */
  selected: string | null;
  /** 保存していない手直しがあるか。 */
  dirty: boolean;
  conflicts: number;
  reviewed: boolean;
  /** 人の答えを待っている提案。 */
  waiting: string[];
}

export function status(hub: Hub): LiveStatus {
  const { screens, screen, waiting } = hub.status;
  return {
    screens,
    path: screen?.path ?? null,
    name: screen?.name ?? null,
    selected: screen?.selected ?? null,
    dirty: screen?.dirty ?? false,
    conflicts: screen?.conflicts ?? 0,
    reviewed: screen?.reviewed ?? false,
    waiting,
  };
}

export type LiveRead =
  | { ok: true; source: string; path: string | null; name: string | null }
  | { ok: false; reason: string };

/** 画面が持っている正本を読む。**保存前の手直しを含む。** */
export function read(hub: Hub): LiveRead {
  return hub.source();
}

export type LiveOffer =
  | { ok: true; id: string; screens: number; waited: false; note: string }
  | { ok: true; id: string; screens: number; waited: true; decision: Decision; note: string }
  | { ok: false; reason: string; findings?: Finding[] };

export interface OfferOptions {
  path?: string;
  note?: string;
  /** 人の答えを待つ秒数。省略すると待たない。 */
  wait?: number;
}

/**
 * 提案を画面へ出す。
 *
 * **形式に適合しないものは出さない。** 読めない図を人の画面に出しても、
 * 人にできることが無い（`zumen_propose` と同じ考え方）。
 */
export async function offer(hub: Hub, source: string, options: OfferOptions = {}): Promise<LiveOffer> {
  const m = messages().tools;
  const findings = validate(source);
  if (hasError(findings)) return { ok: false, reason: m.invalidProposal, findings };

  const put = hub.offer(source, { path: options.path, note: options.note });
  if (!put.ok) return put;

  const w = messages().mcp;
  if (options.wait === undefined) {
    return { ok: true, id: put.id, screens: put.screens, waited: false, note: w.liveWaitingHuman };
  }
  const seconds = Math.min(Math.max(options.wait, 1), MAX_WAIT_S);
  const decision = await hub.decision(put.id, seconds * 1000);
  return { ok: true, id: put.id, screens: put.screens, waited: true, decision, note: explain(decision) };
}

/** 結果の読み方。**`timeout` を「断られた」と読ませない。** */
function explain(decision: Decision): string {
  const m = messages().mcp;
  if (decision === 'applied') return m.liveApplied;
  if (decision === 'discarded') return m.liveDiscarded;
  if (decision === 'timeout') return m.liveTimeout;
  return m.liveGone;
}

/** 出した提案を引っ込める。 */
export function withdraw(hub: Hub, id: string): { ok: boolean } {
  return { ok: hub.withdraw(id) };
}

/** 「この箱のことです」と指す。**選ぶだけ。** */
export function point(
  hub: Hub,
  ids: string[],
  note?: string,
): { ok: true; screens: number } | { ok: false; reason: string } {
  return hub.point(ids, note);
}
