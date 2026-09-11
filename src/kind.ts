/**
 * **図の種類と、種類ごとの物差し**（Issue #4）。
 *
 * ## 埋めている穴
 *
 * 「縮尺のある図をやらない」という判断を、オーナーが覆した（2026-09-11）。
 * **開ける前に、測り方を分ける必要がある。**
 *
 * いまの自力率（D3）は「**人が触った要素が少ないほど良い**」という向き。
 * 構成図ではこれが正しい —— 人が図形を並べ直しているなら、
 * それは高機能な作図ソフトであって、この製品ではない。
 *
 * **配置図では逆になる。** 実測（#4 の調査）:
 *
 * ```
 * 誰も置いていない  → 自力率 100%
 * 人が全部置いた    → 自力率 0%    ← 配置図ではこれが正しい状態
 * ```
 *
 * **同じ物差しを当てると、意味が反転する。**
 * 図が自分で種類を言えないと、**どちらで測るかを機械が決められない。**
 *
 * ## 種類は 2 つだけ
 *
 * 種類を増やすのは語彙を広げること（PRD §4 が戒めているもの）。
 * **3 つ目を足すのは、測り方が 3 つ目になるときだけ。**
 * 「立面図」「断面図」を足したくなっても、**測り方が配置図と同じなら足さない。**
 */
import { parse } from './format.ts';
import { messages } from './messages.ts';

/**
 * 図の種類。
 *
 * | | |
 * |---|---|
 * | `structure` | 構成図。**何がどこへ繋がるか**が内容。置き場所は機械が決める |
 * | `placement` | 配置図。**どこに在るか**が内容。置き場所は人が決める |
 */
export const KINDS = ['structure', 'placement'] as const;
export type Kind = (typeof KINDS)[number];

/** 書いていなければ構成図。**いままでの図が、いままでどおり測られる。** */
export const DEFAULT_KIND: Kind = 'structure';

export function kindOf(source: string): Kind {
  const raw = (parse(source).doc.toJS() as { kind?: unknown }).kind;
  return KINDS.includes(raw as Kind) ? (raw as Kind) : DEFAULT_KIND;
}

export interface Ruler {
  /** 人へ見せる名前。 */
  label: string;
  /**
   * **人が置いたことを、良しとするか。**
   *
   * ここが物差しの向きそのもの。構成図では偽、配置図では真。
   * **同じ数字を逆に読まないため**に、真偽で持つ。
   */
  humanPlacementIsGood: boolean;
  /** なぜその向きなのか。**理由の無い指標は、都合よく歪む。** */
  why: string;
}

/**
 * 種類から物差しを引く。
 *
 * **配置図の「良い」を、まだ数字にしていない。**
 * 「人が置き直した回数」を考えたが、
 * **1 回で正しく置けた AI と、誰も見ていない図が区別できない**（#5 と同じ穴）。
 * ここは #4 で人と詰める。いまは**向きだけ**を持つ。
 */
export function measureOf(kind: Kind): Ruler {
  const m = messages().kind;
  if (kind === 'placement') {
    return { label: m.placement, humanPlacementIsGood: true, why: m.placementWhy };
  }
  return { label: m.structure, humanPlacementIsGood: false, why: m.structureWhy };
}
