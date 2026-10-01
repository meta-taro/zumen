/**
 * **人が見たという記録。**
 *
 * ## 埋めている穴
 *
 * `pins` は「人が**直した**」記録であって、
 * 「人が**見て、直す必要が無いと判断した**」記録ではない。
 *
 * そのため、この 2 つが区別できなかった。
 *
 * | 実際に起きたこと | 自力率 |
 * |---|---|
 * | AI が描いて、**人が見て、直す必要が無かった** | 100% |
 * | AI が描いて、**誰も見ていない** | 100% |
 *
 * **後者はこの製品の失敗そのもの。** 図は理解を共有するために描くので、
 * 誰も見ないまま貼られる図は、この製品が無くても得られる（PRD §4 / CLAUDE.md 禁止事項 4）。
 *
 * そしてベースルール §29 のとおり、**AI は活動量なら無人で出せる。**
 * 人が関与していないことは、記録しない限り検出できない。
 *
 * ## 書ける場所を絞る
 *
 * **MCP に書く口を開けない。** 開けた瞬間、AI が自分の絵を自分で承認できる。
 * これは `zumen_propose` が競合を決着させない理由（D18）と同じ。
 *
 * 書くのは GUI だけ。`propose` は**提案の `review` を読まない**
 * （`pins` を読まないのと同じ扱い）。
 *
 * ## 何に対する承認か
 *
 * 見たのは**そのときの意味**であって、ファイルではない。
 * `nodes` / `edges` / `groups` / `title` が変われば、また見てもらう。
 *
 * **`pins` が変わっても無効にしない。** それは人が自分で動かした結果で、
 * 動かした人は当然その図を見ている。
 *
 * 註釈や空行の違いでは無効にしない。**意味は同じだから。**
 */
import { parse } from './format.ts';

/** 正本に置く節の名前。 */
export const SECTION = 'review';

export interface Review {
  /** いま見たことになっているか。 */
  reviewed: boolean;
  /** 最後に見た時刻（ISO 8601）。**一度も見ていなければ null。** */
  at: string | null;
  /**
   * **見たあとに意味が変わったか。**
   *
   * `reviewed: false` の理由が「一度も見ていない」なのか
   * 「見たが、そのあと変わった」なのかを分ける。
   * 後者は**人へ見せる文言が変わる**（「もう一度見てください」）。
   */
  stale: boolean;
}

/**
 * 図の**意味**の指紋。
 *
 * 意味に入るもの … `version` / `title` / `groups` / `nodes` / `edges`
 * 意味に入らないもの … `pins`（人自身の手）・`review`（記録そのもの）・註釈・並べ方
 */
export function meaningOf(text: string): string {
  const raw = parse(text).doc.toJS() as Record<string, unknown>;
  const meaning = {
    version: raw['version'] ?? null,
    title: raw['title'] ?? null,
    groups: raw['groups'] ?? null,
    nodes: raw['nodes'] ?? null,
    edges: raw['edges'] ?? null,
  };
  // JSON にしてから取るので、**空行・註釈では変わらない。**
  return fingerprint(JSON.stringify(meaning));
}

/**
 * 変化を見つけるための指紋。**改竄を防ぐためのものではない。**
 *
 * 防ぐ相手は AI だが、**AI にはそもそも書く口が無い**（それが歯止め）。
 * 正本を手で書き換えられる人は、指紋も一緒に書き換えられる。
 * 暗号学的な強さを足しても、**守れるものが 1 つも増えない。**
 *
 * だから `node:crypto` を使わない。**画面（ブラウザ）でも同じ関数が動く**ほうが要る。
 * 印を付けるのは画面だけなので、ここが Node 専用だと**書く側が動かない。**
 *
 * FNV-1a を 2 本、別の種で回して並べる（32 bit 1 本では、
 * 図の規模でも偶然の一致が起き得るため）。
 */
function fingerprint(text: string): string {
  return [hash32(text, 0x811c9dc5), hash32(text, 0x01000193)]
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('');
}

function hash32(text: string, seed: number): number {
  let value = seed;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    // FNV の素数 16777619 を掛ける。32 bit に収めるため Math.imul を使う。
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

export function reviewOf(text: string): Review {
  const raw = parse(text).doc.toJS() as { review?: { at?: unknown; of?: unknown } };
  const at = typeof raw.review?.at === 'string' ? raw.review.at : null;
  const of = typeof raw.review?.of === 'string' ? raw.review.of : null;
  if (at === null || of === null) return { reviewed: false, at: null, stale: false };

  const matches = of === meaningOf(text);
  // **見た時刻は残す。** 消すと「一度も見ていない」と区別が付かない。
  return { reviewed: matches, at, stale: !matches };
}

/**
 * 「見た」印を付ける。**GUI からだけ呼ぶ。**
 *
 * ここを `src/tools.ts` から export しない。**それが唯一の歯止め。**
 */
export function setReviewed(text: string, now: Date = new Date()): string {
  const diagram = parse(text);
  diagram.doc.set(SECTION, {
    at: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    of: meaningOf(text),
  });
  return diagram.doc.toString({ lineWidth: 0 });
}

/** 印を落とす。**意味が変わったときに、提案側が持ち込んだ印を捨てる。** */
export function stripReview(text: string): string {
  const diagram = parse(text);
  diagram.doc.delete(SECTION);
  return diagram.doc.toString({ lineWidth: 0 });
}
