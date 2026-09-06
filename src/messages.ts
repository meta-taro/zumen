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


  /** コマンドの口（`src/cli.ts`） */
  cli: {
    usage: '使い方: pnpm validate <図のファイル> ...',
    usageMergeDriver: '使い方: merge-driver <base> <ours> <theirs>',
    usageDrawio: '使い方: pnpm drawio <図のファイル> [書き出し先]',
    usageMeasure: '使い方: pnpm measure <図のファイル> ...',
    /** 「9 割」の測り方は `docs/specs/003-9割の定義.md`。 */
    measured: (path: string, autonomy: string, layout: string) =>
      `${path} — 自力率 ${autonomy} / 配置の自力率 ${layout}`,
    measurePassed: (count: number, line: string) => `${count} 件すべてが合格ライン ${line} に届いています。`,
    measureFailed: (count: number, line: string) =>
      `${count} 件が合格ライン ${line} に届いていません。**人が図形を並べ直している可能性があります。**`,
    wrote: (path: string) => `${path} へ書き出しました。`,
    unknownCommand: (name: string) => `${name} という命令はありません。`,
    /** ドライバが解いたとき。**何を解いたかを黙らない。** */
    mergedClean: (path: string) => `${path} を構造で解きました。衝突はありません。`,
    /** 解けなかったとき。**片方を黙って捨てない**ので、人が選ぶ。 */
    mergedWithConflicts: (path: string, count: number) =>
      `${path} に ${count} 件、両方が別々に変えた箇所があります。印を付けたので、人が選んでください。`,
    fileUnreadable: (path: string, reason: string) => `${path} を読めません: ${reason}`,
    /** 1 ファイルぶんの見出し。指摘が無いときは出さない。 */
    fileHeading: (path: string) => `${path}`,
    severityError: 'エラー',
    severityWarning: '警告',
    allClear: (count: number) => `${count} 件の図を見て、直すところはありませんでした。`,
    /** 警告だけなら止めない。**迷子は人が解くもので、失敗ではない。** */
    warningsOnly: (count: number) => `警告が ${count} 件あります。読める図なので、止めません。`,
    failed: (count: number) => `読めない図が ${count} 件あります。`,
  },

  /** draw.io への書き出し（`src/drawio.ts`） */
  drawio: {
    /**
     * 落ちるものの断り書き。**XML のコメントとして先頭に置く。**
     * draw.io で開いて保存し直すと消えることがあるので、それも書いておく。
     */
    lossHeading: 'zumen から書き出したもの。次は写せていない。',
    lossPinned:
      '人が置いた位置と、自動配置の区別。draw.io は全要素が座標を持つため、形式に区別が無い。',
    lossAppearance: '体裁の「意味の語」（primary / muted）。色に変換されるので語は残らない。',
    lossComments: '正本のコメントと並び順。',
    lossLocked: '競合を解いたときの記録（locked）。',
    lossRoundTrip: '正本は .zumen.yaml の側。ここで編集しても zumen へは戻せない。',
    /** `zumenPinned` を持たせた要素があるときだけ添える。 */
    pinnedNote:
      '人が置いた要素には zumenPinned="1" を付けた（draw.io の「データを編集」で見える）。保存し直すと失われることがある。',
  },

  /** 形式の検証（`src/validate.ts`） */
  validate: {
    notMapping: '文書の最上位が写像になっていません。version: 1 から始まる形にします。',
    versionMissing: 'version がありません。v1 の文書は version: 1 から始めます。',
    versionUnsupported: (found: string) =>
      `version が ${found} になっています。この検証器が読めるのは 1 です。`,
    nodesMissing: 'nodes がありません。要素を 1 つも持たない図は描けません。',
    nodesNotSequence: 'nodes が並びになっていません。- で始まる行を並べます。',
    nodeIdMissing: (position: number) => `nodes の ${position} 番目に id がありません。`,
    nodeIdDuplicated: (id: string) => `id "${id}" が 2 か所以上にあります。id は文書の中で一意です。`,
    edgeEndpointUnknown: (edge: string, id: string) =>
      `エッジ ${edge} が id "${id}" を指していますが、そのノードがありません。`,
    edgeEndpointMissing: (position: number) =>
      `edges の ${position} 番目に from か to がありません。`,
    nodeGroupUnknown: (nodeId: string, groupId: string) =>
      `ノード "${nodeId}" が group "${groupId}" に属していますが、その囲みがありません。`,
    /** 迷子。**壊れているのではなく、人の手直しの行き先が失われている状態。** */
    pinOrphan: (key: string) =>
      `pins の "${key}" は、どの要素も指していません。手直しの行き先が失われています。`,
    /** 知らない語は捨てずに保つのが v1 の規則（仕様 §4）。**弾かずに知らせるだけ。** */
    appearanceUnknown: (word: string) =>
      `体裁の語 "${word}" は v1 が定めたものではありません。既定の体裁で描きます。`,
    /** §6.1。**読み書きで行が変われば、差分が「人が何を直したか」を映さなくなる。** */
    roundTripChanged: '読んで書き戻すと行が変わります。人が触っていない行に差分が出ます。',
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
  cli: {
    usage: 'Usage: pnpm validate <diagram file> ...',
    usageMergeDriver: 'Usage: merge-driver <base> <ours> <theirs>',
    usageDrawio: 'Usage: pnpm drawio <diagram file> [output path]',
    usageMeasure: 'Usage: pnpm measure <diagram file> ...',
    measured: (path: string, autonomy: string, layout: string) =>
      `${path} — autonomy ${autonomy} / layout autonomy ${layout}`,
    measurePassed: (count: number, line: string) => `All ${count} diagram(s) meet the ${line} line.`,
    measureFailed: (count: number, line: string) =>
      `${count} diagram(s) fall short of the ${line} line. A human may be re-arranging shapes by hand.`,
    wrote: (path: string) => `Wrote ${path}.`,
    unknownCommand: (name: string) => `There is no command named ${name}.`,
    mergedClean: (path: string) => `Merged ${path} structurally. No conflicts.`,
    mergedWithConflicts: (path: string, count: number) =>
      `${path} has ${count} place(s) both sides changed differently. They are marked for you to choose.`,
    fileUnreadable: (path: string, reason: string) => `Cannot read ${path}: ${reason}`,
    fileHeading: (path: string) => `${path}`,
    severityError: 'error',
    severityWarning: 'warning',
    allClear: (count: number) => `Looked at ${count} diagram(s); nothing to fix.`,
    warningsOnly: (count: number) => `${count} warning(s). The diagrams are readable, so this is not a failure.`,
    failed: (count: number) => `${count} diagram(s) could not be read.`,
  },
  drawio: {
    lossHeading: 'Exported from zumen. The following did not survive.',
    lossPinned:
      'The distinction between hand-placed and auto-laid-out elements. Everything in draw.io carries coordinates, so the format has no such distinction.',
    lossAppearance: 'Appearance words (primary / muted). They become colors, so the word is gone.',
    lossComments: 'Comments and ordering from the source of truth.',
    lossLocked: 'The record of resolved conflicts (locked).',
    lossRoundTrip: 'The source of truth stays in .zumen.yaml. Edits made here cannot come back.',
    pinnedNote:
      'Hand-placed elements carry zumenPinned="1" (visible via Edit Data in draw.io). Re-saving may drop it.',
  },
  validate: {
    notMapping: 'The top level of the document is not a mapping. It should start with version: 1.',
    versionMissing: 'version is missing. A v1 document starts with version: 1.',
    versionUnsupported: (found: string) =>
      `version is ${found}. This validator reads version 1.`,
    nodesMissing: 'nodes is missing. A diagram with no elements cannot be drawn.',
    nodesNotSequence: 'nodes is not a sequence. It should be a list of items starting with -.',
    nodeIdMissing: (position: number) => `Item ${position} of nodes has no id.`,
    nodeIdDuplicated: (id: string) => `id "${id}" appears more than once. Ids are unique per document.`,
    edgeEndpointUnknown: (edge: string, id: string) =>
      `Edge ${edge} points at id "${id}", but no such node exists.`,
    edgeEndpointMissing: (position: number) => `Item ${position} of edges has no from or no to.`,
    nodeGroupUnknown: (nodeId: string, groupId: string) =>
      `Node "${nodeId}" belongs to group "${groupId}", but no such group exists.`,
    pinOrphan: (key: string) =>
      `pins entry "${key}" points at nothing. A hand edit has lost its target.`,
    appearanceUnknown: (word: string) =>
      `Appearance word "${word}" is not one v1 defines. It will be drawn with the default style.`,
    roundTripChanged: 'Reading and writing back changes lines that nobody edited.',
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
