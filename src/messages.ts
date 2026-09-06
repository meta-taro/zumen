/**
 * 利用者に見える文字列を、ここ 1 か所に集める。
 *
 * **なぜ 1 か所か。** 理由は 3 つあって、どれも「気をつける」では解けない。
 *
 * 1. **多言語化。** 後から入れると、文字列を探して回る作業になる。
 *    画面がまだ無いうちに入れておけば、足すときの手間はほぼ増えない
 * 2. **日本語の質。** 散らばっていると誰も全文を読まない。
 *    1 か所なら、人が数分で通読して直せる。**文言を直すのは人の仕事**であり、
 *    ここはそのための机である
 * 3. **言い方の揺れ。** 同じものを「正本」と呼んだり「元ファイル」と呼んだりしない
 *
 * **散らばったらテストが落ちる**（`test/messages.test.ts`）。
 * `src/` の中で、この階層より外に日本語の文字列リテラルを置くと red になる。
 *
 * 日本語の文面を直すときは `ja` を直接書き換えてよい。**テストは文面に依存していない。**
 * 書き方の約束は `docs/specs/文言の規則.md`。
 */

/** 対応するロケール。増やすときは `catalogs` に足す。 */
export type Locale = 'ja' | 'en';

export const LOCALES: readonly Locale[] = ['ja', 'en'];

/**
 * 日本語。**これが正本**で、`en` はこれに追随する。
 *
 * この製品の読み手は日本語で設計書を書く人なので、迷ったら日本語を優先する。
 */
const ja = {
  /** 埋め込み（`src/embed.ts`） */
  embed: {
    /** 囲みを図にできなかったとき、囲みの上に出す理由。 */
    renderFailed: (reason: string) => `図を描けませんでした: ${reason}`,
    /** `title` の無い図の代替テキスト。読み上げと、画像が出ないときに出る。 */
    untitledDiagram: '構成図',
  },

  /** 正本の読み書き（`src/format.ts`） */
  format: {
    /** 構文誤りに行番号を添える。行が分からないこともあるので、そのときは付けない。 */
    atLine: (line: number, reason: string) => `${line} 行目: ${reason}`,
  },

  /** Mermaid への書き出し（`src/mermaid.ts`） */
  mermaid: {
    /**
     * 手直しが落ちることの断り書き。**書き出したものを人が貼る前に読む場所**なので、
     * 落ちた事実と、正本がどちらかを、この 2 行で言い切る。
     */
    geometryDroppedHeading: '【注意】Mermaid には位置・大きさ・線の曲げ方を書く場所が無い。',
    geometryDroppedDetail: '次の手直しは、この書き出しでは失われている。正本は .zumen.yaml の側。',
  },
};

/** 英語。**`ja` と同じ鍵をすべて持つこと**（`test/messages.test.ts` が確認する）。 */
const en: Catalog = {
  embed: {
    renderFailed: (reason: string) => `Could not draw the diagram: ${reason}`,
    untitledDiagram: 'Diagram',
  },
  format: {
    atLine: (line: number, reason: string) => `line ${line}: ${reason}`,
  },
  mermaid: {
    geometryDroppedHeading:
      'NOTE: Mermaid has nowhere to put positions, sizes, or edge waypoints.',
    geometryDroppedDetail:
      'The edits below are lost in this export. The source of truth stays in .zumen.yaml.',
  },
};

/**
 * 文言の型。**`ja` の形がそのまま契約になる。**
 *
 * `ja` に鍵を足せば `en` が型エラーになる。**足し忘れをコンパイルで止める**ため、
 * 型を手で二重に書かない。
 */
export type Catalog = typeof ja;

const catalogs: Record<Locale, Catalog> = { ja, en };

/** 指定したロケールの文言を返す。 */
export function messages(locale: Locale = defaultLocale()): Catalog {
  return catalogs[locale];
}

/**
 * 環境からロケールを決める。**分からなければ日本語**。
 *
 * `ZUMEN_LOCALE` を最優先にするのは、`LANG` が意図と食い違う環境
 * （CI・Docker・SSH 越し）で、利用者が明示的に上書きできる口を残すため。
 */
export function resolveLocale(env: Record<string, string | undefined> = process.env): Locale {
  const raw = env['ZUMEN_LOCALE'] ?? env['LC_ALL'] ?? env['LC_MESSAGES'] ?? env['LANG'] ?? '';
  const tag = raw.toLowerCase().replace('_', '-');
  for (const locale of LOCALES) {
    if (tag === locale || tag.startsWith(`${locale}-`) || tag.startsWith(`${locale}.`)) return locale;
  }
  return 'ja';
}

let cached: Locale | undefined;

/**
 * 既定のロケール。プロセスの間は変わらないものとして 1 回だけ解決する。
 *
 * **テストから環境を差し替えたいときは `resolveLocale` と `messages` を直に呼ぶ。**
 * ここに設定用の口を足すと、どこからでも書き換えられる隠れた状態になる。
 */
export function defaultLocale(): Locale {
  cached ??= resolveLocale();
  return cached;
}
