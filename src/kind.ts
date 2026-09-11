/**
 * **図の種類と、種類ごとの物差し**（Issue #4）。
 *
 * ## 何を決める語か
 *
 * **置き場所を、機械が計算するのか、正本に書いてあるのか。**
 *
 * | | |
 * |---|---|
 * | `structure` | 機械が計算する（ELK）。何がどこへ繋がるかが内容 |
 * | `placement` | **正本に書いてある**（`nodes[].at`）。どこに在るかが内容 |
 *
 * ## 一度、考えすぎた（2026-09-11）
 *
 * 当初「配置図では**自力率の意味が反転する**」と考えた。
 *
 * ```
 * 誰も置いていない  → 自力率 100%
 * 人が全部置いた    → 自力率 0%
 * ```
 *
 * **前提が間違っていた。**「配置は人がやるもの」と決めてかかっていたが、
 * 人からの報告で **AI が置けることが分かった**（別の道具で、ほぼ置けた）。
 *
 * **AI が置けるなら、反転しない。**
 *
 * ```
 * AI が全部置いた → 人の pins は空  → 自力率 100%   ← 正しい
 * 人が 2 つ直した → pins が 2 件    → 自力率 約 85% ← 正しい
 * ```
 *
 * 足りなかったのは**指標ではなく、AI が位置を書ける場所**だった。
 * 位置を書けるのが `pins` だけで、そこは AI が書けない（D5）ので、
 * **AI は永久に置けない作り**になっていた。`nodes[].at` を足した。
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
   * **置き場所が正本に書いてあるか。**
   *
   * 真なら、機械は並べ直さない（`nodes[].at` をそのまま使う）。
   * **物差しは変わらない** —— どちらも「人が触った要素が少ないほど良い」。
   */
  positionsInSource: boolean;
  /** なぜそうなのか。**理由の無い決まりは、都合よく歪む。** */
  why: string;
}

export function measureOf(kind: Kind): Ruler {
  const m = messages().kind;
  if (kind === 'placement') {
    return { label: m.placement, positionsInSource: true, why: m.placementWhy };
  }
  return { label: m.structure, positionsInSource: false, why: m.structureWhy };
}
