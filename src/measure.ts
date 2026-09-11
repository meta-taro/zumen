/**
 * 「AI が 9 割描けた」を数える（Issue 003 / D3）。
 *
 * **この数字が無いと、出来上がりが従来の作図ソフトと同じでも気づけない。**
 * 機能が増えるほど「使える」ようには見える。だが人が図形を並べ直しているなら、
 * それは高機能な作図ソフトであって、この企画ではない。
 *
 * ## 何を数えるか
 *
 * 人の手直しは `pins` にしか書かれない（仕様 §3.4。**AI は `pins` を書かない**）。
 * だから**正本 1 つを見れば、人がどれだけ手を入れたかが分かる。**
 * 別途ログを取る必要が無く、後から仕込んだ計測が都合よく歪むこともない。
 *
 * | 指標 | 数え方 | 合格 |
 * |---|---|---|
 * | **自力率** | 1 − 人が触った要素 / 全要素 | **90% 以上** |
 * | **配置の自力率** | 1 − 人が幾何を決めた要素 / 全要素 | **90% 以上** |
 *
 * 2 つ目を分けているのは、**この企画が壊れる形が「人が図形を並べ直す」だから**。
 * ラベルの直しは 1 割の範囲だが、配置の直しが増えたら作図ソフトに戻っている。
 *
 * ## 数えないもの
 *
 * **人の作業時間を数えない。** 測っているのは製品であって人ではない（Issue 003 の注意）。
 */
import { getPins, parse } from './format.ts';
import { kindOf } from './kind.ts';
import type { Kind } from './kind.ts';
import { reviewOf } from './review.ts';
import type { Pin } from './format.ts';

/** 人が幾何を決めた印。ここが増えると「人が並べ直している」。 */
const GEOMETRY_KEYS = ['position', 'size', 'waypoints'] as const;
/** 人が中身を直した印。 */
const CONTENT_KEYS = ['label', 'appearance'] as const;

/** 合格ライン。**9 割**（原案の掲げる「AI が 9 割描き、人が 1 割直す」そのもの）。 */
export const PASS_LINE = 0.9;

export interface Measurement {
  /**
   * 図の種類（Issue #4）。**物差しの向きが、ここで変わる。**
   *
   * 構成図は「人が触っていないほど良い」、**配置図は逆**。
   * 同じ数字を逆に読まないために、**種類も一緒に返す。**
   */
  kind: Kind;
  /**
   * **人がこの図を見たか**（仕様 §3.5）。
   *
   * 自力率 100% には 2 通りある ──「AI が描いて人が直す必要が無かった」と
   * 「**誰も見ていない**」。手直しの量だけでは区別が付かない。
   */
  reviewed: boolean;
  /** 見たあとに意味が変わったか。 */
  reviewStale: boolean;
  /** 要素の総数（ノード + エッジ）。 */
  elements: number;
  /** 人が何かしら手を入れた要素の数。 */
  touched: number;
  /** 人が位置・大きさ・線の曲げ方を決めた要素の数。 */
  placed: number;
  /** 1 − touched / elements。 */
  autonomy: number;
  /** 1 − placed / elements。 */
  layoutAutonomy: number;
  /** 両方が合格ラインに届いているか。 */
  pass: boolean;
}

export function measure(text: string): Measurement {
  const diagram = parse(text);
  const pins = getPins(diagram);
  const elements = diagram.nodeIds().length + diagram.edges().length;

  // 迷子の pin（どの要素も指していない）は数えない。**居ない要素の手直しは、
  // 手直し率を押し上げるだけで、実際の図の状態を表さない。**
  const alive = new Set([
    ...diagram.nodeIds(),
    ...diagram.edges().map((edge) => `${edge.from}>${edge.to}`),
  ]);
  const entries = Object.entries(pins).filter(([key]) => alive.has(key));

  const touched = entries.filter(([, pin]) => hasAny(pin, [...GEOMETRY_KEYS, ...CONTENT_KEYS])).length;
  const placed = entries.filter(([, pin]) => hasAny(pin, GEOMETRY_KEYS)).length;

  const seen = reviewOf(text);
  const kind = kindOf(text);
  const autonomy = ratio(elements, touched);
  const layoutAutonomy = ratio(elements, placed);
  return {
    kind,
    reviewed: seen.reviewed,
    reviewStale: seen.stale,
    elements,
    touched,
    placed,
    autonomy,
    layoutAutonomy,
    /**
     * **合格の向きは、種類によらない**（Issue #4。2026-09-11 に考え直した）。
     *
     * 配置図でも「人が触った要素が少ないほど良い」。
     * **AI が `nodes[].at` で置けるから**で、置けなければ反転すると考えていたのは
     * 「配置は人がやるもの」という誤った前提のせいだった。
     */
    pass: autonomy >= PASS_LINE && layoutAutonomy >= PASS_LINE,
  };
}

/**
 * 要素が 0 のときは 1（＝手直し 0）とする。
 *
 * 割れないので数字を作れない。**空の図を「不合格」にしない。**
 */
function ratio(elements: number, touched: number): number {
  if (elements === 0) return 1;
  return 1 - touched / elements;
}

function hasAny(pin: Pin, keys: readonly (keyof Pin)[]): boolean {
  return keys.some((key) => pin[key] !== undefined);
}

/** 百分率を小数 1 桁で。**基準線として記録するので、丸め方を固定する。** */
export function percent(value: number): string {
  return `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
}
