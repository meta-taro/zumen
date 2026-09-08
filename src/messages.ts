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


  /**
   * 画面（`app/`）。
   *
   * **画面の文言もここに置く。** 置かないと、多言語化が画面で効かない
   * （D9 の穴。2026-09-07 に塞いだ）。
   */
  app: {
    open: '開く',
    save: '保存',
    readProposal: '提案を読む',
    openSample: '同梱の例を開く',
    /** 図が 1 つも開かれていないとき。**行き止まりにしない。** */
    emptyHint: '図を開いてください。ここへ落としても開きます。',
    unreadable: 'この図は読めません。',
    /** 指摘に添える行番号。 */
    atLine: (line: number) => `${line} 行目: `,
    resetView: '見え方を戻す',
    zoomOut: '縮める',
    zoomIn: '広げる',

    conflictsHeading: '競合',
    noConflicts: '食い違いはありません。',
    takeMine: '自分の指定を採る',
    takeProposal: '提案を採る',
    takeProposalAnyway: 'やはり提案を採る',
    conflictRemoved: '提案では消えています。人が指定した要素なので、消さずに残しました。',
    conflictSuppressed: (x: number, y: number) =>
      `提案は (${x}, ${y})。自分の指定を採ると決めてあるので、聞き直しません。`,
    conflictPosition: (humanX: number, humanY: number, aiX: number, aiY: number) =>
      `人の指定 (${humanX}, ${humanY}) / 提案 (${aiX}, ${aiY})`,

    diffHeading: '入れる前に見る',
    noChange: '変わるところはありません。',
    notApplied: (count: number) =>
      `${count} 件は入れません。人の指定と食い違っているので、入れたあとに選んでもらいます。`,
    apply: '正本へ入れる',
    discard: 'やめる',

    measureHeading: 'いま何割まで自動か',
    autonomy: '自力率',
    layoutAutonomy: '配置の自力率',
    measureNote: (placed: number, elements: number) =>
      `人が動かした要素 ${placed} / ${elements}。並べ直しているなら、それは作図ソフトに戻っている。`,

    warningsHeading: '気にしたほうがよいこと',

    /** **人どうしが重なった**（Issue 015）。動かしていないので、人が選ぶ。 */
    collisionsHeading: '重なったまま',
    collision: (a: string, b: string) =>
      `"${a}" と "${b}" は、どちらも人が置いた位置で重なっています。動かしていません。`,

    canvasLabel: '図',
    undo: '戻る',
    redo: '進む',
    /** 自動保存の状態。**黙って保存しない** — 保存したことが見えないと不安になる。 */
    saving: '保存しています…',
    saved: '保存しました',
    unsaved: '未保存',
    /** 保存先が決まっていないので、自動保存できない。 */
    autosaveOff: '保存先が決まっていないので、自動では保存しません',
    /** ファイル選択のダイアログに出る種別名。**利用者に見える。** */
    fileKind: 'zumen の図',
    /** 画面を差し込む先が無い。**組み立てが壊れているときにしか出ない。** */
    mountTargetMissing: '画面を差し込む先（#app）がありません。',
  },

  /** コマンドの口（`src/cli.ts`） */
  cli: {
    usage: '使い方: pnpm validate <図のファイル> ...',
    usageMergeDriver: '使い方: merge-driver <base> <ours> <theirs>',
    usageDrawio: '使い方: pnpm drawio <図のファイル> [書き出し先]',
    usageMeasure: '使い方: pnpm measure <図のファイル> ...',
    usageSvg: '使い方: pnpm svg <図のファイル> [書き出し先] [--dark] [--vivid]',
    usageMermaid: '使い方: pnpm mermaid <図のファイル> [書き出し先]',
    usageEmbed: '使い方: pnpm embed <Markdown のファイル> [書き出し先]',
    usageMerge: '使い方: pnpm merge <正本> <提案>',
    /** 囲みが 1 つも無い Markdown。**黙って何もしない、をしない。** */
    embedNoBlocks: (path: string) => `${path} に zumen の囲みがありません。`,
    /** 競合は適用していない。**決めるのは人。** */
    mergedConflicts: (count: number) => `${count} 件、人の指定と提案が食い違っています。適用していません。`,
    conflictLine: (elementId: string, detail: string) => `  ${elementId}: ${detail}`,
    conflictRemoved: '提案では消えていますが、人が指定した要素なので残しました。',
    conflictPosition: (human: string, ai: string) => `人の指定 ${human} / 提案 ${ai}`,
    conflictSuppressed: (ai: string) => `提案 ${ai}。人が自分の指定を採ると決めているので聞き直しません。`,
    mergedClean2: '食い違いはありません。',
    /** 「9 割」の測り方は `docs/specs/003-9割の定義.md`。 */
    measured: (path: string, autonomy: string, layout: string) =>
      `${path} — 自力率 ${autonomy} / 配置の自力率 ${layout}`,
    measurePassed: (count: number, line: string) => `${count} 件すべてが合格ライン ${line} に届いています。`,
    /**
     * **1 枚目の 100% は成績ではない。**
     *
     * 手直しは `pins` にしか書かれないので、まだ誰も直していない図は必ず 100% になる。
     * 数字だけ出すと「AI が上手い」と読まれる（Issue #3 の指摘）。
     */
    measureUntouched: (count: number) =>
      `うち ${count} 件は**まだ人の手直しがありません**（pins が空）。この 100% は、まだ何も測っていないという意味です。`,
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

  /**
   * MCP の口（`src/mcp.ts`）。
   *
   * **これはエージェントが読む文。** 曖昧に書くと、そのぶん当て推量で動かれる。
   * 「してはいけないこと」は、理由まで書く。
   */
  mcp: {
    specTitle: '図の形式',
    specDesc:
      '図の形式・書ける type と appearance の語・守る規則を返す。図を書く前にこれを読むこと。読まずに書くと当て推量になる。',
    listTitle: '図を探す',
    listDesc: 'その下にある図（*.zumen.yaml）の道を返す。',
    listDir: '探し始める場所',
    readTitle: '図を読む',
    readDesc: '正本をそのまま返す。',
    readPath: '図の道',
    pinsTitle: '人が手で決めたこと',
    pinsDesc:
      '人が置いた位置・大きさ・ラベル・体裁を返す。読むだけで、書き換える口は無い。ここを避けて構造だけを直すこと。',
    inspectTitle: '図を検査する',
    inspectDesc:
      '読めるか・要素の数・線の交差・箱の重なり・囲みからのはみ出し・図の大きさ・「9 割」を返す。書いたら必ずこれを見ること。tooTangled が真なら、線が絡みすぎて目で追えない。hiddenLabels に辺の id があれば、そのラベルは置き場が無くて絵に出ていない（短くするか、辺を減らす）。',
    inspectSource: '図の中身。path とどちらか',
    inspectPath: '図の道。source とどちらか',
    createTitle: '新しい図を作る',
    createDesc:
      '新しい図を作る。既にファイルがあれば失敗する（上書きの経路にしない）。形式に適合しないものは書かない。既存の図を変えるなら zumen_propose を使うこと。',
    createPath: '作る場所。.zumen.yaml で終わること',
    createSource: '図の中身',
    proposeTitle: '提案を正本へ入れる',
    proposeDesc:
      '既にある図へ提案を入れる。提案の pins は読まないので、人の手直しは壊れない。人の指定と食い違うところは適用せず、競合として返す。競合を決めるのは人であって、あなたではない。',
    proposePath: '変える図の道',
    proposeSource: '提案（図の全文）',
    exportTitle: '書き出す',
    exportDesc:
      'svg（見せる）／mermaid（翌日読める）／drawio（翌日編集できる）へ書き出す。落ちるものは、それぞれの書き出しが自分で断る。',
    exportTheme:
      '貼り先の地の色（svg にだけ効く）。省略するとライト。暗い地へ貼るときだけ dark を渡すこと。',
    exportIntent:
      '主役をどれくらい強く出すか（svg にだけ効く）。省略すると safe（淡く添える）。遠くから見せる場では vivid（塗り潰す）。どちらでも白黒で読めることは保たれる。',
    needSourceOrPath: 'source か path のどちらかが要ります',
  },

  /**
   * エージェントへ開く口（`src/tools.ts`）。
   *
   * **形式の説明もここに置く。** これが無いとエージェントは当て推量で書く。
   */
  tools: {
    shape: [
      'version: 1',
      'title: <図の題>',
      'groups:            # 囲み（VPC・サブネット等）。省いてよい',
      '  - id: <英数字とハイフン。文書内で一意>',
      '    label: <表示名>',
      'nodes:             # 必須',
      '  - id: <英数字とハイフン。文書内で一意>',
      '    type: <nodeTypes から。未知の値は generic として描かれる>',
      '    label: <表示名>',
      '    group: <属する囲みの id。無所属なら書かない>',
      'edges:',
      '  - from: <ノードの id>',
      '    to: <ノードの id>',
      '    label: <省いてよい>',
    ].join('\n'),
    /** **守らせたいこと。** 実測では毎回 pins を書いてきたので、明示する。 */
    rules: [
      'pins は書かない。人が手で決めたことを置く節で、書いても採られない。',
      '一度付けた id は、意味が変わらないのに書き換えない。人の手直しが id に紐づいている。',
      'nodes の並び順には意味がある。人が読む順序なので、理由なく並べ替えない。',
      '知らないキーは捨てずに保つ。',
      '色コードを書かない。体裁は appearances の語で書く。',
    ],
    mustEndWith: (suffix: string) =>
      `名前は ${suffix} で終わること（マージドライバが効かなくなる）`,
    alreadyExists: '既にあります。既存の図を変えるなら propose を使ってください',
    notFound: 'ありません。新しく作るなら create を使ってください',
    invalid: '形式に適合していません',
    invalidProposal: '提案が形式に適合していません',
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
  app: {
    open: 'Open',
    save: 'Save',
    readProposal: 'Load proposal',
    openSample: 'Open the bundled example',
    emptyHint: 'Open a diagram. You can also drop one here.',
    unreadable: 'This diagram cannot be read.',
    atLine: (line: number) => `line ${line}: `,
    resetView: 'Reset the view',
    zoomOut: 'Zoom out',
    zoomIn: 'Zoom in',

    conflictsHeading: 'Conflicts',
    noConflicts: 'No disagreements.',
    takeMine: 'Keep mine',
    takeProposal: 'Take the proposal',
    takeProposalAnyway: 'Take the proposal after all',
    conflictRemoved: 'The proposal drops it. A person placed it, so it was kept.',
    conflictSuppressed: (x: number, y: number) =>
      `The proposal says (${x}, ${y}). You chose your own placement, so this is not asked again.`,
    conflictPosition: (humanX: number, humanY: number, aiX: number, aiY: number) =>
      `yours (${humanX}, ${humanY}) / proposal (${aiX}, ${aiY})`,

    diffHeading: 'Look before applying',
    noChange: 'Nothing changes.',
    notApplied: (count: number) =>
      `${count} are not applied. They disagree with a hand edit, so you choose afterwards.`,
    apply: 'Apply to the source of truth',
    discard: 'Cancel',

    measureHeading: 'How much is still automatic',
    autonomy: 'Autonomy',
    layoutAutonomy: 'Layout autonomy',
    measureNote: (placed: number, elements: number) =>
      `${placed} of ${elements} elements were moved by hand. If you are re-arranging, this is a drawing tool again.`,

    warningsHeading: 'Worth a look',

    collisionsHeading: 'Still overlapping',
    collision: (a: string, b: string) =>
      `"${a}" and "${b}" are both placed by hand and overlap. Nothing was moved.`,

    canvasLabel: 'Diagram',
    undo: 'Undo',
    redo: 'Redo',
    saving: 'Saving…',
    saved: 'Saved',
    unsaved: 'Not saved',
    autosaveOff: 'No destination yet, so nothing is saved automatically',
    fileKind: 'zumen diagram',
    mountTargetMissing: 'There is no #app to mount into.',
  },

  cli: {
    usage: 'Usage: pnpm validate <diagram file> ...',
    usageMergeDriver: 'Usage: merge-driver <base> <ours> <theirs>',
    usageDrawio: 'Usage: pnpm drawio <diagram file> [output path]',
    usageMeasure: 'Usage: pnpm measure <diagram file> ...',
    usageSvg: 'Usage: pnpm svg <diagram file> [output path] [--dark] [--vivid]',
    usageMermaid: 'Usage: pnpm mermaid <diagram file> [output path]',
    usageEmbed: 'Usage: pnpm embed <markdown file> [output path]',
    usageMerge: 'Usage: pnpm merge <source of truth> <proposal>',
    embedNoBlocks: (path: string) => `${path} has no zumen blocks.`,
    mergedConflicts: (count: number) => `${count} place(s) where the proposal disagrees with a hand edit. Not applied.`,
    conflictLine: (elementId: string, detail: string) => `  ${elementId}: ${detail}`,
    conflictRemoved: 'The proposal drops it, but a person placed it, so it was kept.',
    conflictPosition: (human: string, ai: string) => `hand edit ${human} / proposal ${ai}`,
    conflictSuppressed: (ai: string) => `proposal ${ai}. The person chose their own placement, so this is not asked again.`,
    mergedClean2: 'No disagreements.',
    measured: (path: string, autonomy: string, layout: string) =>
      `${path} — autonomy ${autonomy} / layout autonomy ${layout}`,
    measurePassed: (count: number, line: string) => `All ${count} diagram(s) meet the ${line} line.`,
    measureUntouched: (count: number) =>
      `${count} of them have no hand edits yet (pins is empty). That 100% means nothing has been measured yet.`,
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
  mcp: {
    specTitle: 'Diagram format',
    specDesc:
      'Returns the format, the type and appearance words you may use, and the rules to follow. Read this before writing a diagram. Writing without it is guesswork.',
    listTitle: 'Find diagrams',
    listDesc: 'Returns the paths of diagrams (*.zumen.yaml) underneath.',
    listDir: 'Where to start looking',
    readTitle: 'Read a diagram',
    readDesc: 'Returns the source of truth as it is.',
    readPath: 'Path to the diagram',
    pinsTitle: 'What a person decided by hand',
    pinsDesc:
      'Returns the positions, sizes, labels and appearance a person set. Read only; there is no way to write here. Leave it alone and change the structure instead.',
    inspectTitle: 'Inspect a diagram',
    inspectDesc:
      'Returns readability, element counts, edge crossings, box overlaps, group escapes, size, and the autonomy figure. Always look at this after writing. If tooTangled is true, the edges are too knotted to follow by eye. Any edge id in hiddenLabels has a label that did not fit and is not drawn — shorten it or use fewer edges.',
    inspectSource: 'The diagram body. Either this or path',
    inspectPath: 'Path to the diagram. Either this or source',
    createTitle: 'Create a new diagram',
    createDesc:
      'Creates a new diagram. Fails if the file already exists (this is not an overwrite path). Nothing is written unless it conforms to the format. To change an existing diagram, use zumen_propose.',
    createPath: 'Where to create it. Must end with .zumen.yaml',
    createSource: 'The diagram body',
    proposeTitle: 'Apply a proposal to the source of truth',
    proposeDesc:
      'Applies a proposal to an existing diagram. The pins in your proposal are not read, so hand edits survive. Anything that disagrees with a hand edit is not applied and comes back as a conflict. Conflicts are decided by a person, not by you.',
    proposePath: 'Path to the diagram to change',
    proposeSource: 'The proposal (the whole diagram)',
    exportTitle: 'Export',
    exportDesc:
      'Exports to svg (to show), mermaid (readable tomorrow) or drawio (editable tomorrow). Each exporter states what it could not carry.',
    exportTheme:
      'The background the diagram will be pasted onto (svg only). Light unless given. Pass dark only when the destination is dark.',
    exportIntent:
      'How strongly to show the main element (svg only). safe unless given (a quiet tint). Use vivid for a room viewed from a distance. Either way the diagram stays readable in black and white.',
    needSourceOrPath: 'Either source or path is required',
  },

  tools: {
    shape: [
      'version: 1',
      'title: <diagram title>',
      'groups:            # containers (VPC, subnet, ...). optional',
      '  - id: <letters, digits, hyphen. unique in the document>',
      '    label: <display name>',
      'nodes:             # required',
      '  - id: <letters, digits, hyphen. unique in the document>',
      '    type: <one of nodeTypes. unknown values are drawn as generic>',
      '    label: <display name>',
      '    group: <id of the containing group. omit if none>',
      'edges:',
      '  - from: <node id>',
      '    to: <node id>',
      '    label: <optional>',
    ].join('\n'),
    rules: [
      'Do not write pins. That section holds what a person decided by hand; anything you write there is dropped.',
      'Do not rename an id whose meaning has not changed. Hand edits are tied to ids.',
      'The order of nodes carries meaning. It is the order a person reads. Do not reorder without a reason.',
      'Keep keys you do not recognise.',
      'Do not write colour codes. Express appearance with the words in appearances.',
    ],
    mustEndWith: (suffix: string) => `The name must end with ${suffix} (the merge driver keys off it)`,
    alreadyExists: 'It already exists. Use propose to change an existing diagram.',
    notFound: 'It does not exist. Use create to make a new one.',
    invalid: 'Does not conform to the format',
    invalidProposal: 'The proposal does not conform to the format',
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
 * いま動いている場所の環境。
 *
 * **`process` はブラウザに無い。** 既定引数で `process.env` を触ると、
 * 画面側で文言を 1 つ使った瞬間に `process is not defined` で全体が止まる
 * （2026-09-06、実際にそうなった）。
 *
 * 画面では `navigator.language` を見る。ここが利用者の設定に相当する。
 */
function ambient(): Record<string, string | undefined> {
  const runtime = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    navigator?: { language?: string };
  };
  const fromProcess = runtime.process?.env;
  if (fromProcess !== undefined) return fromProcess;
  const language = runtime.navigator?.language;
  return language === undefined ? {} : { LANG: language };
}

/**
 * 環境からロケールを決める。**分からなければ日本語**。
 *
 * `ZUMEN_LOCALE` を最優先にするのは、`LANG` が意図と食い違う環境
 * （CI・Docker・SSH 越し）で、利用者が明示的に上書きできる口を残すため。
 */
export function resolveLocale(env: Record<string, string | undefined> = ambient()): Locale {
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
