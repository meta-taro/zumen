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
    /** 人が「見た」と印を付ける（仕様 §3.5）。**この口は画面にしかない。** */
    review: '見た',
    reviewed: '見ました',
    reviewStale: 'もう一度見る',
    reviewHint: 'この図を見たという印を付けます。人にしか押せません。',
    reviewAgain: '見たあとに図の意味が変わりました。もう一度見てください。',
    open: '開く',
    save: '保存',
    readProposal: '提案を読む',
    openSample: '同梱の例を開く',
    /** 図が 1 つも開かれていないとき。**行き止まりにしない。** */
    emptyHint: '図を開いてください。ここへ落としても開きます。',
    unreadable: 'この図は読めません。',
    /** 指摘に添える行番号。 */
    atLine: (line: number) => `${line} 行目: `,
    resetView: '等倍に戻す（0）',
    zoomOut: '縮める（−）',
    zoomIn: '広げる（＋）',
    fit: '全体',
    fitHint: '図ぜんぶが見える大きさにする（F）',

    /** エージェントと繋がる線（D34）。**繋がっていないことを黙らない。** */
    liveOn: 'エージェントと繋がっています',
    liveOff: 'エージェントと繋がっていません',
    liveConnecting: 'エージェントを探しています…',
    liveOnHint: 'エージェントが出した提案が、この画面に出ます。入れるかどうかは人が決めます。',
    liveOffHint: 'MCP サーバ（pnpm mcp）が立っていません。立てると、話しながら図を直せます。',
    liveFrom: 'エージェントから',

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
    usageInspect: '使い方: pnpm inspect <図のファイル> ...',
    usageSvg: '使い方: pnpm svg <図のファイル> [書き出し先] [--dark] [--vivid]',
    usageTimelapse:
      '使い方: pnpm timelapse <段のファイル…> [--out 置き場] [--hold 1 段の秒数]（2 段以上）',
    timelapseWrote: (steps: number, seconds: number, path: string) =>
      `${steps} 段 ${seconds} 秒のタイムラプスを ${path} へ書きました（連番の SVG も同じ場所）。`,
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
    inspected: (path: string) => `${path}`,
    inspectCounts: (nodes: number, edges: number) => `  節 ${nodes} ／ 辺 ${edges}`,
    inspectClean: '  交差 0 ／ またぎ 0 ／ 文字の重なり 0 ／ 隠れた辺 0 ／ 名前も符号も全部出ています',
    inspectCrossings: (count: number, groups: number, pairs: string) =>
      `  **交差 ${count}**（${groups} 組。同じ 2 本が何か所で交わっても 1 組）\n    ${pairs}`,
    inspectStraddles: (count: number, pairs: string) => `  **またぎ ${count}**（${pairs}）`,
    inspectOverlaps: (count: number, pairs: string) => `  **文字の重なり ${count}**（${pairs}）`,
    inspectUnderBoxes: (count: number, pairs: string) => `  **箱に隠れた辺 ${count}**（${pairs}）`,
    inspectHiddenLabels: (count: number, ids: string) => `  **絵に出ていない辺のラベル ${count}**（${ids}）`,
    inspectCrowded: (count: number, ids: string) => `  **外へ出す先も無い名前 ${count}**（${ids}）`,
    inspectAdrift: (count: number, ids: string) => `  名前が箱から離れている ${count}（${ids}）`,
    inspectHiddenTags: (count: number, ids: string) => `  印に入らなかった符号 ${count}（${ids}）`,
    inspectPaper: (smallest: number, longest: number, ratio: string) =>
      `  いちばん小さい字 ${smallest}px ／ 長辺 ${longest}px ／ 比 ${ratio}`,
    inspectPrint: '  **A3 に印刷しても字が読めません。**',
    inspectProject: '  投影には小さすぎます（印刷して読む図なら、これでよい）。',
    inspectNote:
      'これは合否ではなく**観測値**です。交差もまたぎも、中身がそうなら正しい —— 止めません。',
    /**
     * **止めないが、放っておくと落ちる**（2026-09-20）。
     *
     * `pnpm inspect` は観測値なので 0 を返す。ところが**見本として登録すると**、
     * `test/names.test.ts` が交差とまたぎを 0 だと決めているので落ちる
     * （理由を書いて表へ入れれば通る）。
     * 洗濯機（見本 250）で、**inspect が 8 件出したのを読んだまま登録して落とした。**
     */
    inspectUnreadable: (count: number) =>
      `**${count} 件は読めませんでした。** 観測値は出していません —— 上の指摘を直してから、もう一度見てください。`,
    inspectGate:
      '見本として `examples/gallery/` へ置くなら、**交差とまたぎは 0 にするか、`test/names.test.ts` の表へ理由を書いて入れてください。** そのままだとテストが落ちます。',
    measured: (path: string, autonomy: string, layout: string) =>
      `${path} — 自力率 ${autonomy} / 配置の自力率 ${layout}`,
    measurePassed: (count: number, line: string) => `${count} 件すべてが合格ライン ${line} に届いています。`,
    /**
     * **誰も見ていない図があることを黙らない**（ベースルール §29）。
     *
     * AI は commit もテスト通過も無人で出せる。**人が見ていないことは、
     * 言わない限り誰も気づかない。** 図は理解を共有するために描くので、
     * 誰も見ていない図は、この製品が無くても得られる（PRD §4）。
     *
     * 手直しが 0 件の図は必ず自力率 100% になるので、
     * **数字だけ出すと「AI が上手い」と読まれる**（Issue #3 の指摘）。
     */
    measureUnseen: (count: number) =>
      `うち ${count} 件は**まだ誰も見ていません**（pnpm app で開いて「見た」を付けてください）。`,
    measureStale: (count: number) =>
      `うち ${count} 件は**人が見たあとに図の意味が変わりました**。もう一度見てください。`,
    /** **これが本物の 100%。**「人が見て、直すところが無かった」。 */
    measureApproved: (count: number) =>
      `うち ${count} 件は**人が見て、直すところがありませんでした**。この 100% は本物です。`,
    measureFailed: (count: number, line: string) =>
      `${count} 件が合格ライン ${line} に届いていません。**人が図形を並べ直している可能性があります。**`,
    /**
     * **配置図は、置き場所が正本に書いてある**（仕様 §3.1 の `at`）。
     *
     * 物差しの向きは構成図と同じ —— **人が触った要素が少ないほど良い。**
     * AI が `at` に置けるので、反転しない。
     */
    measurePlacement: (count: number) =>
      `うち ${count} 件は**配置図**です（置き場所は正本の at に書かれ、機械は並べ直しません）。`,
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
    lossDouble: '二重線（line: double）。draw.io の辺に二重線の型が無いので、実線で出る —— **相続関係説明図の婚姻は、ここで親子と同じ線になる。**（破線・点線・一点鎖線は刻みとして出る）',
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
    aboutTitle: 'この道具について',
    aboutDesc:
      '**はじめに 1 回叩くこと。** 何をする道具か、何をしないか、**どの口が開いていないか**（試す前に分かる）、版ごとに何が変わったかを返す。ここを読めば、断られる往復が減る。',
    specTitle: '図の形式',
    specDesc:
      '図の形式・書ける type と appearance の語・守る規則を返す。図を書く前にこれを読むこと。読まずに書くと当て推量になる。',
    listTitle: '図を探す',
    listDesc: 'その下にある図（*.zumen.yaml）の道を返す。**まず既にある図を見ること** —— 同じ図が既にあるなら、新しく作らずにそれを直す（id を変えると人の手直しが外れる）。返るのは道だけなので、中身は zumen_read で読む。',
    listDir: '探し始める場所',
    examplesTitle: '同梱の見本を引く',
    examplesDesc:
      '**この道具に同梱されている見本 189 枚の目次と、その正本**を返す。' +
      '**何を描くか迷ったら、まずここを見ること。** zumen_spec は「どう書くか」しか渡さない —— ' +
      'zumen の値打ちは書き方ではなく、**歯周チャート・木取り図・舞台の仕込図・中古車の査定図・' +
      '継手と仕口・点字ブロック**のような、その業界の人が実務で使う図が**どう組まれているか**のほうにある。' +
      '一行は題名ではなく**その図の決まりごと**（「販売図面（作るための図ではなく、決めるための図）」）。' +
      '引数なしなら分類と枚数だけ返す。query（「型紙」「歯」「ホーム」など和英どちらでも）で絞る。' +
      'name を渡すと**その見本の正本（YAML）そのもの**が返るので、**真似て書ける**。' +
      '**道具の名前でも引ける**（query に views / hatch / chain / openings など）—— ' +
      '書き方は zumen_spec にあるが、**効いている実物**は見本の中にしかない。' +
      '**汎用のネットワーク図・フローチャートを量産しないこと** —— 既存の作図ソフトが得意な所を足しても、表現力の証明にならない。',
    examplesQuery: '絞り込む語（名前と一行に当たる。和英どちらでもよい）',
    examplesName: '正本を読みたい見本の名前（目次の name をそのまま）',
    examplesNone: '見本がこの配り方には同梱されていません（npm の files に examples/gallery/*.zumen.yaml が入っているかを見てください）。',
    examplesMissing: (name: string) =>
      `見本 "${name}" はありません。引数なしで呼ぶか、query で絞って、目次の name をそのまま渡してください。`,
    readTitle: '図を読む',
    readDesc: '正本（*.zumen.yaml）をそのまま返す。**直す前に必ず読むこと** —— 中身を知らずに書き換えると、人が手で入れた pins や、知らないキーを落とす。書き換えるときは zumen_propose へ渡す（直接ファイルを書く口は開いていない）。',
    readPath: '図の道',
    pinsTitle: '人が手で決めたこと',
    pinsDesc:
      '人が置いた位置・大きさ・ラベル・体裁を返す。読むだけで、書き換える口は無い。ここを避けて構造だけを直すこと。',
    inspectTitle: '図を検査する',
    inspectDesc:
      '読めるか・要素の数・線の交差・箱の重なり・囲みからのはみ出し・図の大きさ・「9 割」を返す。書いたら必ずこれを見ること。tooTangled が真なら、線が絡みすぎて目で追えない。hiddenLabels に辺の id があれば、そのラベルは置き場が無くて絵に出ていない（短くするか、辺を減らす）。**kind を必ず見ること** — placement（配置図）では positionsInSource が真で、**置き場所は自分で書く**（nodes[].at に { x, y }）。機械は並べ直さない。**大きさも nodes[].size に書ける**（{ w, h }。構成図でも効く）—— 間取りのように大きさが意味を持つ図では、書かないと全部同じ箱になる。pins は人のものなので書かないこと。tooSmallToProject が真なら、投影すると字が読めない大きさ。**ただし tooSmallToPrint が偽なら、その図は「印刷して読む図」で、投影に向かないだけ**（路線図・査定図・仕込図・積付図はここに入る。見本 95 枚のうち 36 枚がこれ）。**両方が真のときだけ、本当に直すところがある。** 直すときは **文字を大きくしないこと**（図が伸びて比がさらに下がる）。**まず wrap: true を試すこと** —— 横一列に伸びているだけなら、折り返すと収まる（8 個の鎖で比 13.9 → 2.2）。それでも足りなければ、図を分けられないかを人へ聞くこと。crowdedNames に id があれば、その名前は箱に入りきらず、外へ出した先も空いていない（他の箱に重なって出ている）。箱を大きくするか、technology を短くすること。**消してはいない** —— 部屋の名前が消えるのは、重なるより悪いため。adriftNames に id があれば、**幅のある箱から名前が出ていっている**（表の欄なら、値が欄から離れて行が空に見える）。hiddenTags に id があれば、**書いた符号（tag）が印に入りきらず描かれていない** —— 印を大きくするか符号を短くすること（黙って落としている）。crossingEdges に組があれば、**その 2 本の線が交わっている**（crossings は交差の数、crossingEdges はどの辺どうしか）。straddles に組があれば、**その 2 つの箱がはみ出して重なっている**（どちらも相手を含んでいない）。物どうしが同じ場所を取っている状態で、入れ子（overlaps）とは別。ただし伏図の柱・断面の水抜管・盤の上の石のように、**わざと重ねる図もある**。overlappingText に組があれば、**その 2 つの文字が重なって描かれている**（配置図だけ）。箱の重なり（overlaps）は枠の中に節を入れる図では当たり前だが、**文字の重なりはほぼ必ず間違い**。器の名前を器の真ん中に書くと中身の名前に乗るので、**器の名前は端の欄へ出すこと**。edgesUnderBoxes に組があれば、**その辺は箱の塗りに隠れて描かれない** —— arrows: false は線を箱より先に描くので、枠の中へ引いた線は消える。線を上に出すなら arrows: true にすること。reviewed が偽なら、まだ誰もこの図を見ていない。',
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
    timelapseTitle: '図が育つところを 1 本にする',
    timelapseDesc:
      '段（正本の並び）から、動く SVG 1 枚と、紙を揃えた連番の SVG を書き出す。画面録画が要らないので、リモートでも作れる。**符号化器は同梱しない** —— mp4 が要るときの作り方は返り値の recipe に入る。',
    timelapseSources: '段の正本そのもの（2 段以上）。paths とどちらか。',
    timelapsePaths: '段のファイルの道（2 段以上）。sources とどちらか。',
    timelapseOut: '書き出す場所（無ければ作る）。timelapse.svg と step-001.svg… が並ぶ。',
    timelapseHold: '1 段を映す秒数（既定 2）。',
    exportTitle: '書き出す',
    exportDesc:
      'svg（見せる）／**png（自分で見る）**／mermaid（翌日読める）／drawio（翌日編集できる）へ書き出す。落ちるものは、それぞれの書き出しが自分で断る。**png は絵そのものを返す** —— 描いたら必ず 1 枚は png で見ること（数の検査は「読めるか」しか見ていない）。Chrome が要る（無ければ、無いと言う）。',
    exportTheme:
      '貼り先の地の色（svg にだけ効く）。省略するとライト。暗い地へ貼るときだけ dark を渡すこと。',
    exportIntent:
      '主役をどれくらい強く出すか（svg にだけ効く）。省略すると safe（淡く添える）。遠くから見せる場では vivid（塗り潰す）。どちらでも白黒で読めることは保たれる。',
    needSourceOrPath: 'source か path のどちらかが要ります',

    // --- 画面と繋ぐ（D34）。**承認の線は動かさない。** ---
    liveStatusTitle: '画面と繋がっているか',
    liveStatusDesc:
      'デスクトップアプリが線の向こうに居るか、いま何を映しているかを返す。**zumen_live_* を使う前にこれを見ること。**繋がっていなければ、提案はファイルへ入れる口（zumen_propose）を使う。screens が 0 なら、人はこの画面を見ていない。',
    liveReadTitle: '画面が映している図を読む',
    liveReadDesc:
      '**ディスクではなく画面を読む。**人がさっき動かして、まだ保存していない手直しがここに入っている。zumen_read はディスクを読むので、その手直しが見えない。直す前にこれを読むこと。',
    liveProposeTitle: '提案を画面へ出す',
    liveProposeDesc:
      '提案を**画面に出すだけ**。正本には入らない。人が「正本へ入れる」を押すまで何も起きない。**あなたに押す口は無い。**wait を渡すと、人が答えるまで待って結果を返す（applied＝人が入れた／discarded＝人がやめた／timeout＝まだ見ていない／gone＝画面が消えた）。**timeout は断られたという意味ではない。**形式に適合しない提案は画面に出さない。',
    liveProposeSource: '提案（図の全文）',
    liveProposePath: '画面が開いているはずの図の道。渡すと、その図を開いている画面にだけ出す',
    liveProposeNote: '人へ添える一言（「幅を揃えました」など）。画面に出る',
    liveProposeWait: '人の答えを待つ秒数（最大 300）。省略すると待たずに返る',
    livePointTitle: 'この要素のことだと指す',
    livePointDesc:
      '画面でその要素を選ぶ。**選ぶだけで、図は何も変わらない。**「どれの話か」を言葉で説明する代わりに使う。',
    livePointIds: '指す要素の id',
    livePointNote: '添える一言',
    liveNoScreen:
      'デスクトップアプリが繋がっていません。アプリを立ち上げる（pnpm app）か、ファイルへ入れる口（zumen_propose）を使ってください。',
    liveNothingOpen: '画面は繋がっていますが、図を開いていません。',
    liveOtherDiagram: (asked: string, showing: string | null) =>
      showing === null
        ? `画面は ${asked} を開いていません。`
        : `画面が開いているのは ${showing} です（${asked} ではありません）。`,
    liveOffOn: '線を開けませんでした',
    liveWaitingHuman: '画面に出しました。**人が押すまで、正本は変わりません。**',
    liveApplied: '人が正本へ入れました。',
    liveDiscarded: '人はこの提案を採りませんでした。**別の案を出すか、何が違うのかを聞いてください。**',
    liveTimeout:
      'まだ人は答えていません。**断られたわけではありません。**提案は画面に残っています。',
    liveGone: '画面が消えました。人はこの提案を見ていません。',
  },

  /**
   * **この道具の説明**（`zumen_about`）。
   *
   * エージェントが最初に読むもの。**開いていない口を試して断られる往復**を減らす。
   * 版ごとに何が変わったかは `CHANGELOG.md` から読む（ここに書き写さない）。
   */
  /** 図の種類ごとの物差し（`src/kind.ts`。Issue #4）。 */
  kind: {
    structure: '自力率',
    structureWhy:
      '何がどこへ繋がるかが内容なので、置き場所は機械が決めてよい。人が並べ直しているなら、それは高機能な作図ソフトであってこの製品ではない。',
    placement: '正本に書かれた配置',
    placementWhy:
      'どこに在るかが内容なので、置き場所は正本（nodes[].at）に書く。機械は並べ直さない。AI が at へ書き、人が直すときは pins が勝つ。',
    construction: '定数の自力率',
    constructionWhy:
      '座標を持たない図。位置は作図の手順が決めるので、「置き場所を人が決めた割合」という問いが成立しない。数えるのは人が pin した定数の数で、向きは同じ（少ないほど AI が自力）。',
  },

  about: {
    oneLine:
      'AI が構成図を描き、人が 1 か所直し、その直しが次の生成で壊れない — テキスト正本の作図ツール。',
    purpose: [
      '勝負するのは 1 枚目ではなく 2 枚目以降。「構成が変わったので図を直す」場面のための道具。',
      '**人が直す往復を残すことが目的**。全自動で出るだけの図は、誰も理解しないまま貼られる。',
      '正本はテキスト（`*.zumen.yaml`）。仕様は実装から分離してあるので、この製品が終わっても図は読める。',
      '人の手直しは `pins` にしか書かれない。**正本 1 つを見れば、人がどれだけ手を入れたかが分かる。**',
      '**画面と線で繋がる**（`zumen_live_status` で確かめる）。繋がっていれば、提案は画面に出て、人がその場で採るかどうかを決める —— 「そうじゃなくてこう」の往復ができる。ファイルへ先に書く `zumen_propose` は、繋がっていないときの口。',
    ],
    closed: [
      {
        what: '競合の決着',
        why: '開けた瞬間、AI が自分の提案を自分で承認できる。人が見ずに責任は負えない。',
      },
      {
        what: '`pins` の書き換え',
        why: '人が手で決めたことは人のもの。提案に `pins` を書いても採らない（実測で 10 回中 10 回書いてきた）。',
      },
      {
        what: '「見た」の印を書くこと',
        why: '画面からしか付けられない。開けると、誰も見ていない図を AI が「見た」ことにできる。',
      },
      {
        what: '既存ファイルの無条件な上書き',
        why: '`zumen_create` は既にあれば失敗する。直すなら `zumen_propose` を通すこと。',
      },
      {
        what: '画面へ出した提案を、自分で採ること',
        why: '線の向こうに「正本へ入れる」を押す口は無い。`zumen_live_propose` が返す applied は、人が押したときだけ。timeout は「まだ見ていない」であって、断られたではない。',
      },
    ],
    notDoing: [
      '図形の網羅を追わない。対象は構成図の語彙だけ（`type` は 11 語、うち形が変わるのは 6 つ）。',
      '縮尺のある図（配置図・仮設計画図・平面図）をやらない。置き場所を決めるのは人であって AI ではない。',
      'リアルタイム共同編集をやらない。',
      'Web 版を先に作らない。デスクトップであることが最初の判断そのもの。',
      '他形式のインポートを最初に作らない。入口を広げると、出力品質が他所のデータ品質に引きずられる。',
    ],
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
      'kind: <structure（既定。構成図）| placement（配置図）| construction（作図。座標を書かない。仕様 §3.6）>',
      'direction: <right（既定。横へ流す）| down（縦へ流す）>',
      'wrap: <true なら長い鎖を折り返す。既定は折り返さない>',
      'groups:            # 囲み（VPC・サブネット・階・区域）。省いてよい',
      '  - id: <英数字とハイフン。文書内で一意>',
      '    label: <表示名>',
      'nodes:             # 必須',
      '  - id: <英数字とハイフン。文書内で一意>',
      '    type: <nodeTypes から。未知の値は generic として描かれる>',
      '    label: <表示名>',
      '    technology: <版・役割・広さ。箱の中に副題として出る>',
      '    tag: <符号。C1 / G1 / LBS-1。箱の左上に小さく出る>',
      '    group: <属する囲みの id。無所属なら書かない>',
      '    size: { w: <幅>, h: <高さ> }      # 構成図でも効く',
      '    radius: <px>                       # 範囲の円（作業半径・警戒区域）',
      '    marker: <box（既定）| circle | double | ellipse | diamond | bar | none>  # 配置図での印',
      '                                          # 丸は駅・経穴・計器。bar は帯（停車駅一覧）',
      '    hatch: <none（既定）| solid | dots | lines | cross>  # 材料と区域の模様',
      '    write: <across（既定）| down>       # 縦組み。駅名を縦に積む（ラテン文字は寝る）',
      '    align: <left | center（既定）| right> # 文字の寄せ。注記を並べるときは left',
      '    floor: <floors の名前>               # どの階にあるか。位置は変えない',
      '    symbol: <SYMBOLS から>              # 電気・電子の図記号（IEC／JIS）',
      '    at:   { x: <左>, y: <上> }        # kind: placement でだけ効く',
      '    openings:                          # kind: placement でだけ効く（建具）',
      '      - { kind: <openings から>, side: <sides から>, at: <0〜1>, width: <px> }',
      'scale: { mm: <1px が何 mm か> }      # 寸法の数値を出すのに要る',
      'north: <up / right / down / left>    # 方位記号',
      'wall: { mm: <間仕切の厚み>, outer: <外壁の厚み> }   # 平面図の壁を塗り潰す',
      'grid:                                 # 通り芯。kind: placement でだけ効く',
      '  x:',
      '    - { id: X1, at: <px> }',
      '    - { id: X2, at: <px> }',
      '  y:',
      '    - { id: Y1, at: <px> }',
      '    - { id: GL±0, at: <px>, mark: level }   # 断面図の高さ基準線',
      'edges:',
      '  - from: <ノードの id>',
      '    to: <ノードの id>',
      '    label: <省いてよい>',
      '    ends: { from: <ENDS から>, to: <ENDS から> }   # 端の記号（ER の多重度・UML の関係）',
      '    line: <solid（既定）| dashed | dotted | double | chain>  # 線種（UML の実現・依存、仮設、婚姻、**中心線**）',
      '    weight: <thin | normal（既定）| thick>        # 線の太さ（路線図の路線）',
      '    via: [{ x: <左>, y: <上> }, ...]              # 線の通り道。kind: placement でだけ効く',
      '    curve: <none（既定）| smooth>                 # 通り道を丸める（道路・河川・園路）',
      '    close: <true なら輪を閉じる>                  # 池・トラック・外形の輪郭',
      '    hatch: <none（既定）| solid | dots | lines | cross>  # **閉じた輪の中を塗る**',
      '                                              # **from と to を同じ節にして via を並べると、',
      '                                              # 扇形（カメラの視野・照明の照射）も描ける**',
      '    vertical: <none（既定）| stair | escalator | elevator>      # 階をまたぐ動線（JIS Z 8210）',
    ].join('\n'),
    /** **守らせたいこと。** 実測では毎回 pins を書いてきたので、明示する。 */
    rules: [
      'pins は書かない。人が手で決めたことを置く節で、書いても採られない。',
      'kind: placement（配置図）では、置き場所を自分で書く。機械は並べ直さない。間取り・伏図・売場・避難経路はこちら。nodes[].at と nodes[].size の両方を書くこと。大きさを書かないと、便所と 16 畳の LDK が同じ箱で出る。',
      '建築の図（間取り・伏図・平面詳細図）を描くなら、grid（通り芯）と scale を必ず書く。寸法の数値が出ない図は、現場では使えない。通り芯は壁や柱の芯に置き、符号は X1 / Y1 のように付ける。',
      '断面図・立面図も kind: placement で描く（測り方は同じ。y を高さとして読む）。横の基準線は mark: level にして、id に GL±0 や 2FL+3,200 と書く。方位は書かない。',
      '**何を描くかで迷ったら zumen_examples を見ること。** ここに書いてあるのは**書き方**だけで、**何を描くか**は見本の中にしかない —— 歯周チャート・木取り図・舞台の仕込図・中古車の査定図・継手と仕口・点字ブロックが、実務でどう組まれているか。name を渡せば**正本そのもの**が返るので、真似て書ける。道具の名前（views / hatch / chain / openings…）でも引けるので、**その書き方が効いている実物**を先に見られる。**汎用のネットワーク図・フローチャートを量産しないこと。**',
      '**1 枚に図を 2 つ以上置くなら views を書く**（各階平面図・船の一般配置図・三面図・展開図）。views が無いと grid と scale が図ぜんたいに 1 組しかないので、**通しで測って意味のない数字が出る**（2 階を合わせた全長 82,000）。通り芯も隣の図を串刺しにする。views には id・at・size を必ず書き、その図だけの grid と scale を持たせる。**縮尺は図ごとに変えられる** —— 全体図 1/200 の横に詳細図 1/20 を置ける。突起 12mm の詳細と、ホーム 1.5m の並びのように、**1 枚の紙に桁の違う寸法を載せたいときは、1 つの縮尺に寄せず views を分ける**。title を書くと図の名前が下に出る（どちらが何階か読めない図にしない）。**節は views に属さない** —— 座標で置く図なので、どの図の中かは座標が決めている。\n\n（図どうしで寸法が通っているかは、まだ機械が見ていない。三面図で正面図と側面図の高さを揃えるのは、いまは書き手の責任。）',
      '**views を置いたら、図の下に 130 px 以上空ける。** 図の下には通り芯の符号（90 px）と図の名前（116 px）が出るので、そこへ次の図や注記を置くと重なる。**検証器は鳴る**（紙の上の文字として、図の名前も符号も寸法の数値も数えている）—— ただし `zumen_inspect` の overlappingText は節の文字どうししか見ていないので、**pnpm validate まで通すこと**。左右も同じで、符号は図の両側に出る（1 枚に 2 つ並べるなら 260 px は離す）。',
      '配置図では部屋や棚が接しているのが普通で、隙間を空けない。壁は隣どうしで共有する。',
      '**注記を何行も並べるなら align: left を書く。** 文字は既定で箱の中央へ置かれるので、行の長さが違うと行頭が揃わず、箇条書きが階段状になる（実物を見るまで気づかない。数の検査は「読めるか」しか見ていない）。**箱の幅を文字に合わせて揃えようとしない** —— 幅の見積もりは行ごとに ±20px ずれる（D32）。',
      '**表の欄は、値が入る幅にする。** 幅のある箱で名前が入りきらないと、文字が欄の外へ出て行が空に見える（zumen_inspect の adriftNames と validate の name-adrift が知らせる）。',
      '**中に箱を入れる器には、名前を真ん中に書かない。** 器の名前は中央へ置かれるので、中の箱の名前に乗る（Header の上に Global Navigation が重なる、区画の名前にトラップが乗る）。器は label を空にして、名前だけの節（marker: none）を端へ置くこと。zumen_inspect の overlappingText と validate の text-overlap が、置いてみないと分からないこの重なりを知らせる。',
      '**物どうしを、床の同じ場所に置かない。** 冷蔵ケースと弁当什器、クレーンと車輌通路、消防車と立入禁止区域 —— 入れ子（箱の中に箱）は意図だが、はみ出した重なりはたいてい間違い。zumen_inspect の straddles が知らせる。わざと重ねる図（伏図の柱とスラブ、断面の水抜管、盤の上の石）もあるので、合否ではなく観測値。',
      'type を増やさない。業界の専門性は形ではなく符号（tag）で表されている。柱は C1 であって円柱の絵ではない。',
      '横一列に伸びすぎたら wrap: true を書く。文字を大きくして直そうとしない（図が伸びて比がさらに下がる）。',
      '届く範囲は radius（範囲の円）で書く。クレーンの作業半径・消火器の警戒区域・影の離隔。物の形ではなく注記なので、type は増やさない。',
      '縦に長い箱へ日本語を入れるなら write: down（字を 1 つずつ積む。ラテン文字だけは寝る）。路線の駅名一覧のように、駅の間隔を詰めたまま名前を並べたいときに使う。回す（along）のとは別物で、実物の路線図は積んである。',
      '**枠の線種は nodes[].line で書く**（solid / dashed / dotted / chain）。敷地境界線は一点鎖線、仕上がりの内側の安全領域や想定線は破線、点字の「出ていない点」は点線の丸 —— 実物の図面は線種で意味を分けている。**枠の太さを変える語は無い** —— weight / curve / ends / via / close は辺（edges）のもので、節に書いても黙って落ちる（validate の node-edge-key-ignored が知らせる）。逆に at / size / marker / tag は節のもので、辺に書いても落ちる。',
      '配置図で丸い印を打つなら marker: circle（乗換駅などは double）。路線図の駅・経穴・計器はこれ。marker の値は形の名前だけで、消火器のような意味の語は無い（type も増やさない）。名前は印の外へ出るが、丸に入る短い文字（番号）は中に書く。',
      'UML のクラス図は ends と line で書く。汎化は実線＋triangle、実現は破線＋triangle、集約は diamond、コンポジションは solid-diamond、依存は破線＋arrow。端の記号が同じでも線種で意味が変わる（汎化と実現は線種でしか区別できない）。**属性と操作は描かない** —— コードに書いてあるものを図へ写すと、コードが変わった瞬間に図が嘘になる。',
      'ER 図の多重度は文字で書かず ends で書く（1 は bar、多は crow、0 以上は dot-crow）。データベースをやる人は端の形で読む。文字で書くと辺が増えるほど置き場が無くなって消える。ends の値は形の名前だけで、one-to-many のような意味の語は無い。',
      '電子回路図は symbol で描く（抵抗は resistor、コンデンサは capacitor）。記号は IEC／JIS の形で、抵抗は長方形。ジグザグの ANSI 形は描かない。**枠は描かず記号だけ**が出て、部品名と値は記号の脇に出る。配線は自動で直角に曲がり、部品の足へ繋がる。**トランジスタとオペアンプは足に名前が要るので、まだ描けない。**',
      '材料と区域は hatch で描き分ける。solid はアスコン・コンクリート、dots は砕石・砂、lines は地盤・既存部分、cross は撤去や立入禁止の区域。断面図と区域図は、模様が無いと専門の図に見えない（縮小すると文字は消えるが模様は残る）。値は模様の名前だけで、アスコンのような材料の語は無い。',
      '一度付けた id は、意味が変わらないのに書き換えない。人の手直しが id に紐づいている。',
      'nodes の並び順には意味がある。人が読む順序なので、理由なく並べ替えない。',
      '知らないキーは捨てずに保つ。',
      '桁を揃える空白を入れない。流れ形式の並び（[{ ... }, { ... }]）も書かない。読んで書き戻すと詰められ、人が触っていない行に差分が出る（validate が round-trip-changed で落とす）。',
      '色コードを書かない。体裁は appearances の語で書く。',
      '**その図面が実在するかを、描く前に調べること。** 「○○らしい絵」を記憶から描かない —— 歯科なら歯のイラストではなく歯式と歯周チャート、釣りなら魚の絵ではなく仕掛け図、舞台なら舞台の絵ではなく照明仕込図。実物が何を載せているか（誰が・何の作業に使い・何が節で・何が線で・座標と寸法に意味があるか・業界固有の記号があるか）まで調べてから描くこと。日本語だけでなく英語の専門語でも探すこと。**調べずに描いた図は、その業界の人が見た瞬間に分かる。**',
      '**描いたら、絵にして見ること。** 数の検査（zumen_inspect / validate）は「読めるか」しか見ていない —— 名前が扉の弧に乗る、線が設備を横切る、扇の半径が読めない、といったことは**実物を見るまで分からない**。svg を書き出して開くか、png（Chrome があれば画像で返る）で見ること。**1 枚も見ずに完成と言わないこと。**',
      '**色が記法そのものである図だけ、palette に色を書く**（路線の色・配管の識別色・工区の色分け）。線に乗せるなら nodes/edges の color、面に敷くなら nodes[].fill。**この 2 つは別物** —— color は枠の線に乗るので、淡い色を書くと壁まで消える。fill は面だけを薄く敷くので、ライトでもダークでも上の文字が読める。どちらも **鍵を図のどこかに文字として出す**こと（凡例に 1 回でよい。色を落とすと読めない図にしない）。',
    ],
    noChrome:
      'Chrome が見つからないので、絵にできませんでした。svg で書き出して開くか、CHROME_PATH に Chrome の場所を渡してください（符号化器は同梱しません）。',
    pngMade: '図を png にしました（2 倍の大きさ）。**絵を見てから直すこと。**',
    pngFailed: 'png にできませんでした。svg で書き出して開いてください。',
    mustEndWith: (suffix: string) =>
      `名前は ${suffix} で終わること（マージドライバが効かなくなる）`,
    alreadyExists: '既にあります。既存の図を変えるなら propose を使ってください',
    notFound: 'ありません。新しく作るなら create を使ってください',
    invalid: '形式に適合していません',
    invalidProposal: '提案が形式に適合していません',
  },

  /** 形式の検証（`src/validate.ts`） */
  timelapse: {
    needTwo: '段が 1 つしかありません。タイムラプスは、図が育つところを見せるものなので、2 段以上要ります。',
    noPaper: '紙の大きさが読めませんでした。',
    stepBroken: (step: number, why: string) =>
      `${step} 段目が読めません（${why}）。黙って飛ばすと、出来上がった動画から段が 1 つ消えたことに誰も気づけないので、ここで止めます。`,
    recipeHead: 'mp4 が要るなら、手元の道具で作れます（zumen は符号化器を同梱しません）。',
    recipeTail: '  H は絵の高さ。webm なら -c:v libvpx-vp9 -crf 36 -b:v 0 に替えてください。',
  },
  validate: {
    notMapping: '文書の最上位が写像になっていません。version: 1 から始まる形にします。',
    versionMissing: 'version がありません。v1 の文書は version: 1 から始めます。',
    versionUnsupported: (found: string) =>
      `version が ${found} になっています。この検証器が読めるのは 1 です。`,
    nodesMissing: 'nodes がありません。要素を 1 つも持たない図は描けません。',
    nodesNotSequence: 'nodes が並びになっていません。- で始まる行を並べます。',
    nodeIdMissing: (position: number) => `nodes の ${position} 番目に id がありません。`,
    nodeIdDuplicated: (id: string, first?: number) =>
      `id "${id}" が 2 か所以上にあります。id は文書の中で一意です。${first === undefined ? '' : `**先に出てきたのは ${first} 行目**です —— どちらかの名前を変えてください。`}`,
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

    /**
     * **AI が書く場所の検査**（仕様 §3.1）。どれも `warning`。
     *
     * 読めない文書になるわけではなく、描画側が黙って無視する。
     * **黙って無視されると、書いた側は「効かない」理由が分からない。**
     */
    nodeAtInvalid: (id: string) =>
      `ノード "${id}" の at が { x: 数, y: 数 } になっていません。置き場所は無視されます。`,
    nodeAtIgnored: (id: string) =>
      `ノード "${id}" に at がありますが、構成図では効きません。置き場所は機械が決めます（kind: placement で効きます）。`,
    nodeSizeInvalid: (id: string) =>
      `ノード "${id}" の size が { w: 正の数, h: 正の数 } になっていません。大きさは無視されます。`,
    openingKindUnknown: (id: string, word: string) =>
      `ノード "${id}" の建具 "${word}" は v1 が定めたものではありません（door / double / slide / window / open）。この建具は描かれません。`,
    openingSideUnknown: (id: string, word: string) =>
      `ノード "${id}" の建具が辺 "${word}" に付いています（top / right / bottom / left）。この建具は描かれません。`,
    openingIgnored: (id: string) =>
      `ノード "${id}" に openings がありますが、構成図では描かれません（kind: placement で描かれます）。`,
    kindUnknown: (word: string) =>
      `kind が "${word}" になっています（structure / placement）。構成図として描きます。`,
    directionUnknown: (word: string) =>
      `direction が "${word}" になっています（right / down）。既定の横で描きます。`,
    wrapNotBoolean: (found: string) =>
      `wrap が ${found} になっています。折り返すのは true と書いたときだけです。`,
    gridAxisInvalid: (position: number) =>
      `通り芯の ${position} 番目が { id: 符号, at: 数 } になっていません。この芯は描かれません。`,
    gridIgnored:
      'grid（通り芯）がありますが、構成図では描かれません（kind: placement で描かれます）。',
    gridMarkUnknown: (position: number, word: string) =>
      `通り芯の ${position} 番目の mark が "${word}" になっています（code / level）。丸の符号で描きます。`,
    scaleMissing:
      '通り芯はありますが scale がありません。寸法の数値は出ません（scale: { mm: 20 } で 1px = 20mm）。',
    viewsInvalid: 'views が一覧になっていません。1 枚に複数の図を置くには - id: … を並べます。',
    viewsIgnored:
      'views（1 枚に複数の図）がありますが、構成図では描かれません（kind: placement で描かれます）。',
    viewIdMissing: (position: number) =>
      `views の ${position} 番目に id がありません。この図は描かれません。`,
    viewIdDuplicate: (id: string) =>
      `views に同じ id が 2 つあります（"${id}"）。どちらの寸法かが読めません。`,
    viewFrameMissing: (id: string) =>
      `views の "${id}" に at と size がありません（at: { x, y } / size: { w, h }）。どこへ描くか決められないので、この図は描かれません。`,
    viewsNoGrid:
      'views はありますが、どの図にも grid がありません。名前は出ますが、**寸法も通り芯も描かれません** —— 出したいなら、その図の grid を書いてください。ただし**縮尺を図ごとに変えているなら、それだけで意味があります**（views[].scale は絵に出なくても正本に残り、読む側と別の実装へ「この範囲は 1px が何 mm か」を伝えます）。',
    pinPositionInConstruction: (id: string) =>
      `この図では位置を直せません（"${id}" の pins.position）。位置は作図の手順が決めています。**直すのは let の定数です**（R など）。定数を 1 つ直すと、図全体が比を保ったまま動きます。`,
    constructionNothingDrawn:
      '描くものがありません。arcs を書くか、circles に draw: true を付けてください（点と円は決まっていても、描く指定が無ければ絵に出ません）。',
    numberTextChanged: (id: string, key: string, written: string, got: string) =>
      `"${id}" の ${key} に ${written} と書いてありますが、**数として読まれて ${got} になります**（絵には ${got} と出ます）。書いたとおりに出すには "${written}" と引用符で囲んでください。`,
    idSharedWithGroup: (id: string) =>
      `"${id}" を囲みと節の両方で使っています。**囲みが二重に描かれ、名前が同じ場所に 2 回出ます**（重なるので目で見ても分かりません）。どちらかの id を変えてください。`,
    scaleInvalid: (found: string) =>
      `scale.mm が ${found} になっています。正の数を書きます（1px が何 mm か）。インチで描くなら scale.in を書きます。寸法の数値は出ません。`,
    scaleTwoUnits:
      'scale に mm と in の両方が書いてあります。mm のほうを採ります（寸法はミリで出ます）。フィートとインチで書きたいなら mm を消してください。',
    northUnknown: (word: string) =>
      `north が "${word}" になっています（up / right / down / left）。方位記号は描かれません。`,
    wallInvalid: (found: string) =>
      `wall.mm が ${found} になっています。正の数を書きます（壁の厚み・mm）。壁の太さは変わりません。`,
    wallNeedsScale:
      'wall（壁の厚み）はありますが scale がありません。mm を px にできないので、壁の太さは変わりません。',
    radiusInvalid: (id: string) =>
      `ノード "${id}" の radius が正の数になっていません。範囲の円は描かれません。`,
    radiusIgnored: (id: string) =>
      `ノード "${id}" に radius がありますが、構成図では描かれません（kind: placement で描かれます）。`,
    markerUnknown: (id: string, word: string) =>
      `ノード "${id}" の marker が "${word}" になっています（box / circle / double / none）。矩形で描きます。`,
    markerIgnored: (id: string) =>
      `ノード "${id}" に marker がありますが、構成図では効きません（形は type で決まります）。`,
    curveUnknown: (name: string, word: string) =>
      `エッジ ${name} の curve が "${word}" になっています（none / smooth）。折れ線で描きます。`,
    viaInvalid: (name: string) =>
      `エッジ ${name} の via が点の並びになっていません（- { x: 100, y: 40 }）。通り道は使いません。`,
    viaIgnored: (name: string) =>
      `エッジ ${name} に via がありますが、構成図では効きません（線の通り道は機械が決めます）。`,
    closeNotBoolean: (name: string) =>
      `エッジ ${name} の close が true / false になっていません。輪は閉じません。`,
    closeIgnored: (name: string) =>
      `エッジ ${name} に close がありますが、構成図では効きません（線の通り道は機械が決めます）。`,
    edgeUnderBox: (edge: string, box: string) =>
      `エッジ ${edge} は、箱 "${box}" の塗りに隠れて描かれません（arrows: false のとき、線は箱より先に描きます）。線を箱の上に出すなら arrows: true にしてください。`,
    alignUnknown: (id: string, word: string) =>
      `ノード "${id}" の align が "${word}" になっています（left / center / right）。中央で描きます。`,
    alignIgnored: (id: string) =>
      `ノード "${id}" に align がありますが、構成図では効きません（箱の大きさを文字から決めているためです）。`,
    writeUnknown: (id: string, word: string) =>
      `ノード "${id}" の write が "${word}" になっています（across / down）。横組みで描きます。`,
    floorUnknown: (id: string, name: string) =>
      `ノード "${id}" の floor が "${name}" ですが、floors の一覧にありません。階の枠は描かれません。`,
    floorsMissing: (id: string) =>
      `ノード "${id}" に floor がありますが、floors の一覧がありません（floors に下から順に並べてください）。`,
    verticalUnknown: (name: string, word: string) =>
      `エッジ ${name} の vertical が "${word}" になっています（stair / escalator / elevator）。縦動線として扱いません。`,
    verticalSameFloor: (name: string) =>
      `エッジ ${name} に vertical がありますが、両端が同じ階です。階をまたがないものは縦動線ではありません。`,
    appearanceInNodes: (id: string) =>
      `ノード "${id}" に appearance がありますが、体裁は人が pins に書くものです（nodes では効きません）。`,
    writeIgnored: (id: string) =>
      `ノード "${id}" に write がありますが、構成図では効きません（箱の大きさを文字から決めているためです）。`,
    hatchUnknown: (id: string, word: string) =>
      `ノード "${id}" の hatch が "${word}" になっています（none / solid / dots / lines / cross）。無地で描きます。`,
    symbolUnknown: (id: string, word: string) =>
      `ノード "${id}" の symbol が "${word}" になっています。描ける図記号は SYMBOLS の語だけです（矩形で描きます）。`,
    hatchIgnored: (id: string) =>
      `ノード "${id}" に hatch がありますが、構成図では描かれません（kind: placement で描かれます）。`,
    endsUnknown: (edge: string, word: string) =>
      `エッジ ${edge} の ends が "${word}" になっています（ENDS の語のいずれか）。記号は描かれません。`,
    lineUnknown: (edge: string, word: string) =>
      `エッジ ${edge} の line が "${word}" になっています（solid / dashed / dotted / double / chain）。実線で描きます。**chain は一点鎖線** —— 中心線・対称軸・光軸・基準線・切断線はこれです。`,
    weightUnknown: (edge: string, word: string) =>
      `エッジ ${edge} の weight が "${word}" になっています（thin / normal / thick）。ふつうの太さで描きます。`,
    colorUnknown: (target: string, key: string) =>
      `${target} の color が "${key}" ですが、palette にその鍵がありません。色は付きません。`,
    colorFaint: (key: string, value: string, light: number, dark: number) =>
      `palette の "${key}"（${value}）が薄すぎます。地に沈んで線が消えます。**白地で ${light}:1 ／ 暗い地で ${dark}:1**（非文字の下限は 3:1）—— **${light < 3 && dark < 3 ? 'どちらの地でも' : light < 3 ? '白地だけ' : '暗い地だけ'}**足りません。${light < 3 && dark >= 3 ? '実物の色で変えられないなら（路線図の路線色など）、線を太くするか、色以外の見分け（符号・線種）を必ず添えてください。' : ''}`,
    labelMarkdown: (id: string) =>
      `"${id || '(id なし)'}" の名前に ** が入っています（節でも、辺のラベルでも、図の名前でも同じ）。**zumen の名前は素のテキスト**で、Markdown ではありません —— ** は強調にならず、**そのまま絵に出ます**。正本のコメントや変更の記録は Markdown なので、そこから持ち込みやすいところです。`,
    colorNotHex: (key: string, value: string) =>
      `palette の "${key}" の色 "${value}" が読めません。**#rrggbb（6 桁）**で書いてください。3 桁（#a33）も色名（red）も受けません —— 貼り先で解釈が割れるためです。この鍵は色が付かないまま残ります。`,
    edgeSelfOpen: (id: string) =>
      `ノード "${id}" から自分自身への辺に via がありません。長さ 0 の線になり、節の真ん中に矢印の粒が出るだけになります。自分自身への辺は、via を並べて close: true にすると閉じた形（視野・範囲・輪郭）が描けます。`,
    edgeFillIgnored: (edge: string) =>
      `エッジ ${edge} に fill がありますが、辺に fill はありません（面の色は nodes[].fill）。**閉じた輪の中を塗るのは hatch で、その色は color** です —— close: true ＋ hatch: solid ＋ color: <palette の鍵> と書いてください。いまは塗られません。`,
    edgeHatchIgnored: (edge: string) =>
      `エッジ ${edge} に hatch がありますが、close: true でないので効きません。閉じていない辺には面が無く、塗りようがありません。`,
    nameCrowded: (id: string) =>
      `ノード "${id}" の名前は箱に入りきらず、外へ出した先も空いていません（**他の要素に重なる**か、**紙の縁で切れます**）。箱を大きくするか、名前を **\`\\n\`** で折り返すか、文字を短くしてください（消してはいません —— 名前が消えるのは、重なるより悪いためです）。`,
    nameAdrift: (id: string, needs: number, has: number) =>
      `ノード "${id}" は幅のある箱ですが、名前が入りきらず外へ出ています（名前に ${needs}px 要るところ、箱は ${has}px。${needs - has}px 足りません）。表の欄なら、値が欄から離れて行が空に見えます。箱を広げるか、名前を **\`\\n\`** で折り返すか（いちばん長い行で測ります）、文字を短くしてください。`,
    tagHidden: (id: string) =>
      `ノード "${id}" の tag は、印に入りきらないので描かれません。印を大きくするか、符号を短くしてください（消してはいません。書いたのに出ない状態を知らせています）。`,
    /** 長辺の向き（`tooSmallToPrint` に渡す語）。 */
    alongVertical: '縦',
    alongHorizontal: '横',
    tooSmallToPrint: (
      ratio: string,
      floor: string,
      smallest: number,
      longest: number,
      need: number,
      /** 長辺の向きの語（`alongVertical` / `alongHorizontal`）と、その両端にいる要素。 */
      axis: string,
      head: string,
      tail: string,
      /**
       * **いちばん空いている帯**（無ければ 4 つとも空文字）。
       * **どこを詰めればよいか**を名指しする。文字で受けるのは、
       * 文言表の検査が「引数が出力に現れること」を見るため（`test/messages.test.ts`）。
       */
      gapAxis: string,
      gapAt: string,
      gapTo: string,
      gapWide: string,
    ) =>
      `この図は A3 に印刷しても字が読めません（いちばん小さい字 ${smallest}px ÷ 長辺 ${longest}px ＝ ${ratio}。下限は ${floor}）。**あと ${Math.max(1, Math.ceil(longest - need))}px 詰めてください** —— 長辺が ${need}px 以下なら収まります。**長辺は${axis}で、端は "${head}" と "${tail}" です。**この 2 つの間を詰めてください。**文字を大きくしないでください**（図が伸びて比がさらに下がります）。表や注記を詰めるか、図を分けてください。${gapAxis === '' ? '' : `**いちばん空いているのは ${gapAxis} ${gapAt}〜${gapTo} の ${gapWide}px** です —— ここに中身がありません。`}`,
    inkOverlap: (a: string, b: string, x: number, y: number) =>
      `紙の上で ${a} と ${b} の文字が重なって描かれます。名前どうしだけでなく、符号・寸法の数値・通り芯の符号・図の名前も同じ場所を取ります。**横に ${x}px か、縦に ${y}px** ずらせば離れます（どちらへ逃がすかは、図の都合で決めてください）。`,
    textOverlap: (a: string, b: string) =>
      `${a} と ${b} の文字が重なって描かれます。器の名前を器の真ん中に書くと、中の節の名前に乗ります（器の名前は端の欄へ出してください）。`,
    edgeNodeKeyIgnored: (name: string, key: string) =>
      `辺 "${name}" に \`${key}\` を書いていますが、**これは節（nodes）の語**です。辺に書いても黙って落ちます。辺は 2 点を結ぶ線なので、置き場所も大きさも印も持ちません。通り道を曲げたいなら \`via\`、線の見た目なら \`line\` / \`weight\` / \`color\`、端の形なら \`ends\` を使ってください。`,
    nodeEdgeKeyIgnored: (id: string, key: string) =>
      `ノード "${id}" に \`${key}\` を書いていますが、**これは辺（edges）の語**です。節に書いても黙って落ちます。枠の線種なら \`line\`（実線・破線・点線・一点鎖線）、面の模様なら \`hatch\`、線の色なら \`color\` を使ってください。**枠の太さを変える語は、いまはありません** —— 太さで示したいなら、線種を変えるか \`hatch\` で面を示してください。`,
    viewTitleCovered: (view: string, box: string, grow: number) =>
      `図 "${view}" の名前が、"${box}" の上に乗って描かれます。**図の名前は、その図の下辺のすぐ下**に置かれるので、\`size\` に書いた高さより中身が下へ出ていると重なります。**この図の \`size.h\` を ${grow}px 増やすか、中身を上へ詰めてください。**`,
    labelGluedWord: (id: string, found: string) =>
      `"${id}" の名前に **"${found}"** が入っています —— 日本語の字のすぐ隣に、小文字の英単語がくっついています。下書きの英語を日本語へ直し忘れた形（「前framing」のような、**無い言葉**）か、語の順が入れ替わった形（「160 以上cm」＝「160cm 以上」）です。**そのまま絵に出ます。** 日本語に直すか、あいだに空きを入れてください。単位（mm・cm・kg）や「PoE の」のように空きがある書き方は当たりません。`,
    circleNotSquare: (id: string, marker: string, w: number, h: number, d: number) =>
      `ノード "${id}" は \`marker: ${marker}\`（丸）ですが、\`size\` が ${w}×${h} で正方形ではありません。**丸は短いほうが直径になる**ので、描かれるのは**直径 ${d} の丸**で、長いほうの ${Math.max(w, h)} は消えます。ところが名前の置き場所と重なりの判定は ${w}×${h} のほうを見るので、**丸の横に空きが残ります**。横長・縦長の丸が欲しいなら \`marker: ellipse\`（w と h の両方を使います）、丸でよいなら \`size\` を正方形にしてください。`,
    hatchTooThin: (id: string, hatch: string, side: number) =>
      `ノード "${id}" に \`hatch: ${hatch}\` を書いていますが、**面の短いほうが ${side}px しかないので、模様は 1 つも描かれません**（無地と見分けがつきません）。点は間隔 9px で置くので半間隔に満たない面には乗らず、斜線・格子は面で切り取られるので細いほど切れ端が短くなります。**線のつもりなら \`hatch\` を外して \`line\` で線種を指定**し、模様で材料を示したいなら**短いほうを 9px 以上**にしてください。`,
    colorWithoutCode: (key: string) =>
      `色 "${key}" を使っていますが、その記号が図のどこにも文字として出ていません。色だけだと、白黒と色覚特性で読めなくなります。どこか 1 か所（凡例でも可）に "${key}" を文字で出してください。`,
  },

  /** Mermaid への書き出し（`src/mermaid.ts`） */
  /** **作図**（`src/construct.ts`。D36）。 */
  construct: {
    exprUnreadable: (text: string) => `式が読めません: ${text}`,
    exprLeftover: (text: string) => `式の後ろに余りがあります: ${text}`,
    parenMissing: '括弧が閉じていません。',
    dividedByZero: '0 で割っています。',
    distanceNeedsTwo: 'distance は 2 つの点を取ります（distance(A, B)）。',
    unknownName: (name: string) =>
      `"${name}" が分かりません。**作図は前から順に評価する**ので、先に決めた名前しか引けません。`,
    unknownPoint: (name: string) => `点 "${name}" がありません。先に points で決めてください。`,
    noMeeting: (a: string, b: string) =>
      `"${a}" と "${b}" は交わりません（離れているか、片方がもう片方の中にあります）。この点は決まりません。`,
    takeMissing: (id: string) =>
      `"${id}" にどちらの交点を採るかがありません（take: upper / lower / left / right / first / second）。**機械に推測させません** —— 次の生成で反対を採ると、図が裏返ります。`,
    takeUnknown: (id: string, word: string) =>
      `"${id}" の take が "${word}" になっています（upper / lower / left / right / first / second）。`,
    unknownCircle: (name: string) => `円 "${name}" がありません。先に circles で決めてください。`,
    unknownShape: (name: string) =>
      `かたまり "${name}" がありません。define で決めるか、after に置いたものの名前（as）を書いてください。`,
    circleNeedsCenter: (id: string) => `円 "${id}" に center がありません。`,
    duplicate: (id: string) => `"${id}" が 2 回出てきます。名前は 1 つの意味しか持てません。`,
    pinPosition: (id: string) =>
      `この図では位置を直せません（"${id}" の pins.position）。位置は手順が決めています。**直すのは let の定数です**（R など）。`,
  },

  mermaid: {
    /**
     * 手直しが落ちることの断り書き。**書き出したものを人が貼る前に読む場所**なので、
     * 落ちた事実と、正本がどちらかを、この 2 行で言い切る。
     */
    lossPlacement:
      'この正本は**配置図**です。どこに何があるかが中身ですが、**Mermaid には位置と大きさの器がありません** —— 以下は位置を失った箱の一覧で、元の図とは別のものです。図として使うなら SVG か draw.io で書き出してください。',
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
    review: 'Reviewed?',
    reviewed: 'Reviewed',
    reviewStale: 'Review again',
    reviewHint: 'Mark that you have looked at this diagram. Only a person can press this.',
    reviewAgain: 'The diagram changed meaning after it was reviewed. Please look again.',
    open: 'Open',
    save: 'Save',
    readProposal: 'Load proposal',
    openSample: 'Open the bundled example',
    emptyHint: 'Open a diagram. You can also drop one here.',
    unreadable: 'This diagram cannot be read.',
    atLine: (line: number) => `line ${line}: `,
    resetView: 'Back to 100% (0)',
    zoomOut: 'Zoom out (−)',
    zoomIn: 'Zoom in (+)',
    fit: 'Fit',
    fitHint: 'Size it so the whole diagram is visible (F)',

    liveOn: 'Connected to the agent',
    liveOff: 'Not connected to an agent',
    liveConnecting: 'Looking for an agent…',
    liveOnHint: 'Proposals from the agent appear on this screen. Whether they go in is your call.',
    liveOffHint: 'The MCP server (pnpm mcp) is not running. Start it to adjust the diagram by talking.',
    liveFrom: 'From the agent',

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
    usageInspect: 'Usage: pnpm inspect <diagram file> ...',
    usageSvg: 'Usage: pnpm svg <diagram file> [output path] [--dark] [--vivid]',
    usageTimelapse:
      'Usage: pnpm timelapse <step files…> [--out dir] [--hold seconds per step] (two or more steps)',
    timelapseWrote: (steps: number, seconds: number, path: string) =>
      `Wrote a ${seconds}s timelapse of ${steps} steps to ${path} (numbered SVGs are beside it).`,
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
    inspected: (path: string) => `${path}`,
    inspectCounts: (nodes: number, edges: number) => `  ${nodes} nodes / ${edges} edges`,
    inspectClean: '  0 crossings / 0 straddles / 0 text overlaps / 0 buried edges / every name and tag is drawn',
    inspectCrossings: (count: number, groups: number, pairs: string) =>
      `  **${count} crossings** (${groups} pairs; two lines that cross more than once count as one pair)\n    ${pairs}`,
    inspectStraddles: (count: number, pairs: string) => `  **${count} straddles** (${pairs})`,
    inspectOverlaps: (count: number, pairs: string) => `  **${count} text overlaps** (${pairs})`,
    inspectUnderBoxes: (count: number, pairs: string) => `  **${count} edges buried under boxes** (${pairs})`,
    inspectHiddenLabels: (count: number, ids: string) => `  **${count} edge labels never drawn** (${ids})`,
    inspectCrowded: (count: number, ids: string) => `  **${count} names with nowhere to go** (${ids})`,
    inspectAdrift: (count: number, ids: string) => `  ${count} names drifting away from their box (${ids})`,
    inspectHiddenTags: (count: number, ids: string) => `  ${count} tags that did not fit their marker (${ids})`,
    inspectPaper: (smallest: number, longest: number, ratio: string) =>
      `  smallest text ${smallest}px / longest side ${longest}px / ratio ${ratio}`,
    inspectPrint: '  **Too small to read when printed on A3.**',
    inspectProject: '  Too small to project (fine if this drawing is meant to be printed).',
    inspectNote:
      'These are **observations, not a verdict**. Crossings and straddles are right when the subject crosses — nothing is stopped here.',
    inspectUnreadable: (count: number) =>
      `**${count} could not be read.** No observations were produced — fix what is listed above, then look again.`,
    inspectGate:
      'To ship this as a gallery sample, **bring crossings and straddles to zero, or add it to the table in `test/names.test.ts` with the reason.** Left as is, the test fails.',
    measured: (path: string, autonomy: string, layout: string) =>
      `${path} — autonomy ${autonomy} / layout autonomy ${layout}`,
    measurePassed: (count: number, line: string) => `All ${count} diagram(s) meet the ${line} line.`,
    measureUnseen: (count: number) =>
      `${count} of them have not been looked at yet (open it with pnpm app and mark it reviewed).`,
    measureStale: (count: number) =>
      `${count} of them changed meaning after a person reviewed them. Please look again.`,
    measureApproved: (count: number) =>
      `${count} of them were reviewed by a person with nothing to change. That 100% is real.`,
    measureFailed: (count: number, line: string) =>
      `${count} diagram(s) fall short of the ${line} line. A human may be re-arranging shapes by hand.`,
    measurePlacement: (count: number) =>
      `${count} of them are placement drawings (positions come from \`at\` in the source; the machine does not re-arrange them).`,
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
    lossDouble: 'The double line (line: double). draw.io edges have no double-line style, so it comes out solid — **in a family-register chart, a marriage becomes indistinguishable from a parent link.** (dashed, dotted and chain do survive, as dash patterns.)',
    lossComments: 'Comments and ordering from the source of truth.',
    lossLocked: 'The record of resolved conflicts (locked).',
    lossRoundTrip: 'The source of truth stays in .zumen.yaml. Edits made here cannot come back.',
    pinnedNote:
      'Hand-placed elements carry zumenPinned="1" (visible via Edit Data in draw.io). Re-saving may drop it.',
  },
  mcp: {
    aboutTitle: 'About this tool',
    aboutDesc:
      'Call this once, first. Says what the tool is for, what it will not do, **which doors are closed** (so you do not try them), and what changed in each version.',
    specTitle: 'Diagram format',
    specDesc:
      'Returns the format, the type and appearance words you may use, and the rules to follow. Read this before writing a diagram. Writing without it is guesswork.',
    listTitle: 'Find diagrams',
    listDesc: 'Returns the paths of diagrams (*.zumen.yaml) underneath. **Look at what already exists first** — if the diagram is already there, edit it rather than creating a new one (changing ids detaches a person\'s edits). Only paths come back; read the contents with zumen_read.',
    listDir: 'Where to start looking',
    examplesTitle: 'Browse the bundled examples',
    examplesDesc:
      '**Returns the catalogue of the 189 examples bundled with this tool, and their sources.** ' +
      '**Look here first when deciding what to draw.** zumen_spec only tells you how to write a file — ' +
      "the value of zumen is not the syntax but how the drawings that professionals actually use are put together: " +
      'a periodontal chart, a plywood cutting diagram, a stage lighting plot, a used-car appraisal chart, ' +
      'a timber joint, tactile paving. Each one-liner states **what that drawing must get right**, not its title. ' +
      'With no arguments you get the categories and counts. Narrow with query (Japanese or English). ' +
      'Pass name to get **that example’s YAML source**, so you can copy how it is written. ' +
      'You can also query by feature (views, hatch, chain, openings…) — the syntax is in zumen_spec, but a **working example** only exists here. ' +
      '**Do not churn out generic network diagrams and flowcharts** — adding what existing tools already do proves nothing.',
    examplesQuery: 'Filter (matches the name and the one-liner, in either language)',
    examplesName: 'Name of the example whose source you want (use the name from the catalogue)',
    examplesNone: 'No examples are bundled with this build (check that examples/gallery/*.zumen.yaml is in the npm files list).',
    examplesMissing: (name: string) =>
      `There is no example called "${name}". Call with no arguments, or narrow with query, then pass a name from the catalogue.`,
    readTitle: 'Read a diagram',
    readDesc: 'Returns the source (*.zumen.yaml) verbatim. **Always read before changing it** — rewriting without knowing the contents drops the pins a person added and any keys you do not recognise. Pass changes through zumen_propose; there is no tool that writes a file directly.',
    readPath: 'Path to the diagram',
    pinsTitle: 'What a person decided by hand',
    pinsDesc:
      'Returns the positions, sizes, labels and appearance a person set. Read only; there is no way to write here. Leave it alone and change the structure instead.',
    inspectTitle: 'Inspect a diagram',
    inspectDesc:
      'Returns readability, element counts, edge crossings, box overlaps, group escapes, size, and the autonomy figure. Always look at this after writing. If tooTangled is true, the edges are too knotted to follow by eye. Any edge id in hiddenLabels has a label that did not fit and is not drawn — shorten it or use fewer edges. **Always check kind**: for a placement drawing positionsInSource is true, meaning you write the positions yourself (nodes[].at as { x, y }) and the machine will not re-arrange them. You can also set sizes with nodes[].size ({ w, h }, which works for structure diagrams too) — without it every room comes out the same size. Never write pins — those belong to the person. If tooSmallToProject is true the text is too small to read when projected. **If tooSmallToPrint is false, the drawing is simply one to be printed rather than projected** (transit maps, appraisal charts, lighting plots and stowage plans land here — 36 of the 95 examples do). **Only when both are true is there really something to fix.** Do NOT fix it by enlarging the text (that grows the diagram and lowers the ratio further). **Try wrap: true first** — if the diagram is just one long row, wrapping brings it back (a chain of 8 goes from 13.9 to 2.2). If that is not enough, ask the person whether the diagram can be split. Any id in crowdedNames has a name that did not fit its box and had nowhere free outside it, so it is drawn overlapping something. Make the box bigger or shorten technology. It is NOT dropped — a room losing its name is worse than an overlap. Any id in adriftNames is a wide box whose name did not fit and is drawn outside it — in a table that leaves the row looking empty. Any id in hiddenTags has a tag that does not fit its marker and is not drawn — make the marker bigger or shorten the tag. Any pair in crossingEdges is two edges that cross (crossings is the count, crossingEdges names which edges). Any pair in straddles is two boxes overlapping without either containing the other: two things taking the same place on the floor (distinct from nesting, which `overlaps` also counts). Some drawings layer on purpose (a column on a slab, a stone on a board). Any pair in overlappingText is two labels drawn on top of each other (placement drawings only). Any pair in edgesUnderBoxes is an edge that is hidden under a box fill: with arrows: false, lines are drawn before boxes, so a line drawn inside a filled box disappears. Set arrows: true to bring the lines above the boxes. Overlapping boxes are often intended (a frame around sections), but overlapping text almost never is. A container that holds children should not repeat its name in the middle — move it to an edge cell. If reviewed is false, nobody has looked at this diagram yet.',
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
    timelapseTitle: 'Film the drawing growing',
    timelapseDesc:
      'Writes one animated SVG plus numbered SVGs (all padded to the same paper) from a list of steps. No screen recording, so it works remotely. **No encoder is bundled** — the returned recipe shows how to make an mp4 with the tools you already have.',
    timelapseSources: 'The step sources themselves (two or more). Either this or paths.',
    timelapsePaths: 'Paths to the step files (two or more). Either this or sources.',
    timelapseOut: 'Where to write (created if missing). timelapse.svg and step-001.svg… land there.',
    timelapseHold: 'Seconds each step stays on screen (2 unless given).',
    exportTitle: 'Export',
    exportDesc:
      'Exports to svg (to show), **png (to look at yourself)**, mermaid (readable tomorrow) or drawio (editable tomorrow). Each exporter states what it could not carry. **png comes back as the picture itself** — always look at one before calling a drawing done (the numeric checks only tell you whether it is readable). It needs Chrome, and says so when Chrome is missing.',
    exportTheme:
      'The background the diagram will be pasted onto (svg only). Light unless given. Pass dark only when the destination is dark.',
    exportIntent:
      'How strongly to show the main element (svg only). safe unless given (a quiet tint). Use vivid for a room viewed from a distance. Either way the diagram stays readable in black and white.',
    needSourceOrPath: 'Either source or path is required',

    liveStatusTitle: 'Is the app connected?',
    liveStatusDesc:
      'Reports whether the desktop app is on the other end of the live link and what it is showing. **Check this before using any zumen_live_* tool.** If nothing is connected, use zumen_propose (which writes the file) instead. screens = 0 means no human is looking at this screen.',
    liveReadTitle: 'Read what the screen is showing',
    liveReadDesc:
      '**Reads the screen, not the disk.** Edits the person just made but has not saved live here; zumen_read would not see them. Read this before changing anything.',
    liveProposeTitle: 'Put a proposal on the screen',
    liveProposeDesc:
      'Puts a proposal **on the screen only**. It does not enter the source of truth; nothing happens until the person presses "apply". **You have no way to press it.** With wait, this blocks until the person answers (applied = they took it / discarded = they rejected it / timeout = they have not looked yet / gone = the screen went away). **timeout does not mean rejected.** A proposal that fails validation is never shown.',
    liveProposeSource: 'The proposal (the whole diagram)',
    liveProposePath: 'Path the screen should have open. Given, the proposal goes only to a screen showing that diagram',
    liveProposeNote: 'One line for the person ("evened out the widths"). It appears on screen',
    liveProposeWait: 'Seconds to wait for the person to answer (max 300). Returns at once if omitted',
    livePointTitle: 'Point at an element',
    livePointDesc:
      'Selects that element on screen. **Selecting only; the diagram does not change.** Use it instead of describing in words which thing you mean.',
    livePointIds: 'Ids of the elements to point at',
    livePointNote: 'One line to go with it',
    liveNoScreen:
      'The desktop app is not connected. Start it (pnpm app), or use zumen_propose, which writes the file.',
    liveNothingOpen: 'The app is connected but has no diagram open.',
    liveOtherDiagram: (asked: string, showing: string | null) =>
      showing === null
        ? `The screen does not have ${asked} open.`
        : `The screen has ${showing} open, not ${asked}.`,
    liveOffOn: 'Could not open the live link',
    liveWaitingHuman: 'It is on the screen. **Nothing changes until the person presses apply.**',
    liveApplied: 'The person applied it to the source of truth.',
    liveDiscarded: 'The person did not take this proposal. **Offer a different one, or ask what is wrong with it.**',
    liveTimeout:
      'The person has not answered yet. **This is not a rejection.** The proposal is still on screen.',
    liveGone: 'The screen went away. The person never saw this proposal.',
  },

  kind: {
    structure: 'Autonomy',
    structureWhy:
      'What connects to what is the content, so the machine may decide placement. If a person is re-arranging shapes, this is a fancy drawing app, not this product.',
    placement: 'Placed in the source',
    placementWhy:
      'Where things sit is the content, so positions live in the source (nodes[].at). The machine does not re-arrange them. The AI writes at; a person overrides with pins.',
    construction: 'Constant autonomy',
    constructionWhy:
      'A drawing with no coordinates. The steps decide position, so "what share of placement a person decided" is not a question here. What is counted is how many constants a person pinned, in the same direction (fewer means the AI did more).',
  },

  about: {
    oneLine:
      'A text-source diagram tool: the AI draws, a person fixes one spot, and that fix survives the next generation.',
    purpose: [
      'The contest is not the first drawing but every one after it — for when the architecture changed and the diagram must follow.',
      '**Keeping the human in the loop is the point.** A diagram nobody argued with is a diagram nobody understood.',
      'The source of truth is text (`*.zumen.yaml`), and the format is specified apart from this implementation, so the diagrams outlive the tool.',
      'Hand edits land only in `pins`, so one file tells you how much a person touched.',
      '**It links to the open window** (check with `zumen_live_status`). When linked, a proposal appears on screen and the person decides there and then — the "no, like this" round trip. `zumen_propose`, which writes the file first, is the unlinked path.',
    ],
    closed: [
      {
        what: 'Resolving conflicts',
        why: 'The moment this opens, the AI can approve its own proposal. Nobody can take responsibility for what they did not look at.',
      },
      {
        what: 'Writing `pins`',
        why: 'What a person set by hand is theirs. A proposal that writes `pins` is ignored (measured: 10 of 10 runs tried).',
      },
      {
        what: 'Marking a diagram reviewed',
        why: 'Only the desktop window can set it. Open it and the AI can call a diagram reviewed that nobody has seen.',
      },
      {
        what: 'Overwriting an existing file',
        why: '`zumen_create` fails if the file exists. Change it through `zumen_propose`.',
      },
      {
        what: 'Accepting your own proposal on the screen',
        why: 'There is no way across the link to press apply. The applied that `zumen_live_propose` returns only comes from a person pressing it. timeout means "has not looked yet", not rejected.',
      },
    ],
    notDoing: [
      'No chase after shape coverage. The vocabulary is architecture diagrams only (11 `type` words, 6 of which change shape).',
      'No to-scale drawings (site plans, floor plans). There, a person decides placement, not the AI.',
      'No realtime collaborative editing.',
      'No web version first. Being a desktop app is the first decision itself.',
      'No importing other formats first. A wider entrance drags output quality down to whatever came in.',
    ],
  },
  tools: {
    shape: [
      'version: 1',
      'title: <diagram title>',
      'kind: <structure (default) | placement | construction (a drawing with no coordinates; spec §3.6)>',
      'direction: <right (default, flows sideways) | down>',
      'wrap: <true wraps a long chain. off by default>',
      'groups:            # containers (VPC, subnet, floor, zone). optional',
      '  - id: <letters, digits, hyphen. unique in the document>',
      '    label: <display name>',
      'nodes:             # required',
      '  - id: <letters, digits, hyphen. unique in the document>',
      '    type: <one of nodeTypes. unknown values are drawn as generic>',
      '    label: <display name>',
      '    technology: <version, role, area. drawn as a subtitle in the box>',
      '    tag: <code. C1 / G1 / LBS-1. drawn small at the top left>',
      '    group: <id of the containing group. omit if none>',
      '    size: { w: <width>, h: <height> }   # applies to structure diagrams too',
      '    radius: <px>                         # range circle (crane reach, alarm zone)',
      '    marker: <box (default) | circle | double | ellipse | diamond | bar | none>  # how it is marked on a plan',
      '                                          # circle for stations, acupoints, instruments; bar for a band',
      '    hatch: <none (default) | solid | dots | lines | cross>  # material / zone pattern',
      '    write: <across (default) | down>     # vertical setting: stack the glyphs (Latin is laid on its side)',
      '    align: <left | center (default) | right> # which edge the label lines up on; use left for a run of notes',
      '    floor: <a name from floors>          # which floor; does not move the box',
      '    symbol: <from SYMBOLS>               # electrical symbol (IEC / JIS)',
      '    at:   { x: <left>, y: <top> }       # only with kind: placement',
      '    openings:                            # only with kind: placement',
      '      - { kind: <from openings>, side: <from sides>, at: <0..1>, width: <px> }',
      'scale: { mm: <how many mm one pixel is> }   # required for dimension figures',
      'north: <up / right / down / left>',
      'wall: { mm: <partition thickness>, outer: <outer wall thickness> }  # poché walls',
      'grid:                                 # only with kind: placement',
      '  x:',
      '    - { id: X1, at: <px> }',
      '    - { id: X2, at: <px> }',
      '  y:',
      '    - { id: Y1, at: <px> }',
      '    - { id: GL±0, at: <px>, mark: level }   # 断面図の高さ基準線',
      'edges:',
      '  - from: <node id>',
      '    to: <node id>',
      '    label: <optional>',
      '    ends: { from: <from ENDS>, to: <from ENDS> }   # end symbols (ER cardinality, UML)',
      '    line: <solid (default) | dashed | dotted | double | chain>  # line style (UML realization, temporary works, marriage, **centre line**)',
      '    weight: <thin | normal (default) | thick>      # line width (transit routes)',
      '    via: [{ x: <left>, y: <top> }, ...]            # waypoints; only with kind: placement',
      '    curve: <none (default) | smooth>               # round the waypoints (roads, rivers, paths)',
      '    close: <true closes the loop>                  # pond, running track, outline',
      '    hatch: <none (default) | solid | dots | lines | cross>  # **fills a closed loop**',
      '                                              # **from and to on the same node, plus via,',
      '                                              # draws a sector (a camera field of view)**',
      '    vertical: <none (default) | stair | escalator | elevator>   # level change (JIS Z 8210)',
    ].join('\n'),
    rules: [
      'Do not write pins. That section holds what a person decided by hand; anything you write there is dropped.',
      'With kind: placement you place things yourself; the machine does not lay them out. Floor plans, framing plans, store layouts and escape routes are placement. Write both nodes[].at and nodes[].size. Without sizes, a toilet and a 16-mat living room come out the same box.',
      'For an architectural drawing, always write grid and scale. A drawing with no dimension figures cannot be used on site. Put the grid lines on the centre of walls and columns, and code them X1 / Y1.',
      'Sections and elevations also use kind: placement (the measure is the same; read y as height). Mark the horizontal reference lines with mark: level and write the id as GL±0 or 2FL+3,200. Do not write north.',
      '**When unsure what to draw, call zumen_examples.** What is written here is only the syntax; **what to draw** exists only in the examples — how a periodontal chart, a plywood cutting diagram, a stage lighting plot, a used-car appraisal chart, a timber joint or tactile paving is actually put together. Pass a name to get the source itself, so you can copy how it is written; query by feature (views, hatch, chain, openings…) to find a working example of that syntax. **Do not churn out generic network diagrams and flowcharts.**',
      'To put two or more drawings on one sheet, write views (floor-by-floor plans, a ship general arrangement, a three-view drawing, an unfolded room). Without views there is only one grid and one scale for the whole sheet, so dimensions are measured straight through both drawings and meaningless figures come out (an "overall length" spanning two floors), and grid lines skewer the neighbouring drawing. Every view needs id, at and size, plus its own grid and scale. **The scale can differ per view** — a 1/20 detail can sit beside a 1/200 general drawing. When one sheet must carry dimensions orders of magnitude apart (a 12 mm stud and a 1.5 m run of paving), **split them into views instead of forcing one scale**. A title is drawn under each view so a reader can tell which floor is which. Nodes do NOT belong to a view — this is a coordinate drawing, so which drawing a node is in is decided by where it is.\n\n(Whether dimensions agree between drawings is not checked yet. In a three-view drawing, keeping the front and side heights equal is the writer\'s job for now.)',
      'Leave 130px or more below a view. Grid-line codes (90px) and the view title (116px) are drawn below it, so anything placed there collides. **The validator does report it** (it counts view titles, grid codes and dimension figures as ink on the paper) — but zumen_inspect overlappingText only looks at node text, so run pnpm validate as well. The same applies sideways: codes appear on both sides, so leave 260px between two views placed side by side.',
      'In a placement diagram rooms and shelves normally touch. Do not leave gaps; neighbours share a wall.',
      'When you line up several notes, write align: left. Text is centred in its box by default, so lines of different length do not share a left edge and the list comes out as a staircase. Do NOT try to fix it by matching each box width to its text — the width estimate is off by up to 20px per line.',
      'Make a table cell wide enough for its value. If a name does not fit a wide box, the text is drawn outside the cell and the row looks empty (zumen_inspect reports it as adriftNames, validate as name-adrift).',
      'A container that holds other boxes must not carry its name in the middle. The name is centred, so it lands on the names of the children (Global Navigation printed over Header; a trap printed over the zone it sits in). Leave the container label empty and put a name-only node (marker: none) in an edge cell instead. zumen_inspect reports this as overlappingText and validate as text-overlap — it is the kind of collision you cannot see until the drawing is laid out.',
      'Do not put two things in the same place on the floor. A chilled case and a bento fixture, a crane and a vehicle route, a fire engine and a keep-out zone. Nesting (a box inside a box) is intentional; a partial overlap usually is not. zumen_inspect reports it as straddles. Some drawings layer on purpose (a column on a slab, a drain pipe through a wall, a stone on a board), so it is an observation, not a verdict.',
      'Do not pad with spaces to line up columns, and do not use flow style ([{ ... }, { ... }]). Reading and writing the file back collapses them, which puts a diff on lines nobody touched.',
      'Do not add to type. Domain specificity is carried by the code (tag), not by shape. A column is C1, not a cylinder.',
      'If a diagram stretches into one long row, write wrap: true. Do not try to fix it by enlarging the text.',
      'Use radius for a reach or zone: crane working radius, fire-extinguisher coverage, shading offset. It is an annotation, not a shape, so type stays as it is.',
      'For a tall narrow box holding Japanese, use write: down (glyphs are stacked one per line; Latin runs are laid on their side). It is what a transit line-guide needs: station names stay readable while the stops stay close together. It is not the same as rotating (along) — real transit charts stack.',
      '**Set a box outline\u2019s line type with nodes[].line** (solid / dashed / dotted / chain). A property boundary is a chain line; a safety margin or an assumed line is dashed; an unraised braille dot is a dotted circle — real drawings separate meanings by line type. **There is no word for outline thickness**: weight / curve / ends / via / close belong to edges and are dropped in silence on a node (validate reports node-edge-key-ignored). The other way round, at / size / marker / tag belong to nodes and are dropped on an edge.',
      'On a plan, use marker: circle for a round mark (double for an interchange): transit stations, acupuncture points, instruments. marker values are shape names only — there is no semantic value like an extinguisher, and type does not grow. The name is drawn outside the mark, except a short label (a number) which goes inside.',
      'A UML class diagram is written with ends and line: generalization is solid + triangle, realization is dashed + triangle, aggregation is diamond, composition is solid-diamond, dependency is dashed + arrow. The same end symbol means different things depending on the line style (generalization and realization differ only in that). Do NOT draw attributes and operations — copying what the code already says makes the diagram a lie the moment the code changes.',
      'Write ER cardinality with ends, not words (bar for one, crow for many, dot-crow for zero-or-more). Database people read the end shape. Words run out of room as edges multiply. ends values are shape names only, never a semantic value like one-to-many.',
      'Draw an electronic circuit with symbol (resistor, capacitor, and so on). Symbols follow IEC / JIS shapes — a resistor is a rectangle, not an ANSI zigzag. No box is drawn, only the symbol; the part name and value go beside it. Wires bend at right angles automatically and attach to the legs. Transistors and op-amps need named legs and cannot be drawn yet.',
      'Distinguish materials and zones with hatch: solid for asphalt and concrete, dots for crushed stone and sand, lines for ground and existing work, cross for removal or no-entry areas. A section or a zoning drawing does not read as professional without patterns (shrink it and the text disappears but the pattern remains). Values are pattern names only, never a material name.',
      'Do not rename an id whose meaning has not changed. Hand edits are tied to ids.',
      'The order of nodes carries meaning. It is the order a person reads. Do not reorder without a reason.',
      'Keep keys you do not recognise.',
      'Do not write colour codes. Express appearance with the words in appearances.',
      '**Before drawing, find out whether the drawing actually exists in the trade.** Never draw "something that looks like the field" from memory: for dentistry it is a tooth chart and a periodontal chart, not a picture of teeth; for fishing it is a rig diagram, not a fish; for theatre it is a lighting plot, not a stage. Research what the real sheet carries (who uses it, for which task, what is a node, what is a line, whether coordinates and dimensions carry meaning, which symbols the trade has) before you draw. Search in the trade\'s own language as well as your own. **A drawing made without that research is obvious to anyone in the field.**',
      '**Once drawn, look at it as a picture.** The numeric checks (zumen_inspect / validate) only tell you whether it is readable — a name landing on a door swing, a line crossing a fixture, a radius you cannot read: none of that shows up until you look. Export the svg and open it, or use png (returned as an image when Chrome is present). **Never call a drawing finished without having looked at one.**',
      'Write colours in palette ONLY where colour is the notation itself (transit line colours, pipe identification colours, zone colour-coding). Put it on lines with color (nodes/edges), on areas with fill (nodes). They are NOT the same: color paints the frame, so a pale value makes the walls vanish; fill tints the face only, laid thinly over the ground so the text on it stays readable in both light and dark. Either way the key must appear somewhere as text (once in a legend is enough) — never let colour alone carry the meaning.',
    ],
    noChrome:
      'Chrome was not found, so the drawing could not be rendered. Export svg and open it, or pass the path to Chrome in CHROME_PATH (no encoder is bundled).',
    pngMade: 'Rendered the drawing to png (at 2x). **Look at it before you fix anything.**',
    pngFailed: 'Could not render to png. Export svg and open it instead.',
    mustEndWith: (suffix: string) => `The name must end with ${suffix} (the merge driver keys off it)`,
    alreadyExists: 'It already exists. Use propose to change an existing diagram.',
    notFound: 'It does not exist. Use create to make a new one.',
    invalid: 'Does not conform to the format',
    invalidProposal: 'The proposal does not conform to the format',
  },

  timelapse: {
    needTwo:
      'Only one step. A timelapse shows a drawing growing, so it needs two or more steps.',
    noPaper: 'Could not read the paper size.',
    stepBroken: (step: number, why: string) =>
      `Step ${step} could not be read (${why}). Skipping it silently would drop a step from the finished film without anyone noticing, so this stops here.`,
    recipeHead: 'If you need mp4, build it with the tools you already have (zumen ships no encoder).',
    recipeTail: '  H is the height of the drawing. For webm use -c:v libvpx-vp9 -crf 36 -b:v 0.',
  },
  validate: {
    notMapping: 'The top level of the document is not a mapping. It should start with version: 1.',
    versionMissing: 'version is missing. A v1 document starts with version: 1.',
    versionUnsupported: (found: string) =>
      `version is ${found}. This validator reads version 1.`,
    nodesMissing: 'nodes is missing. A diagram with no elements cannot be drawn.',
    nodesNotSequence: 'nodes is not a sequence. It should be a list of items starting with -.',
    nodeIdMissing: (position: number) => `Item ${position} of nodes has no id.`,
    nodeIdDuplicated: (id: string, first?: number) =>
      `id "${id}" appears more than once. Ids are unique per document.${first === undefined ? '' : ` **The first one is on line ${first}** — rename one of them.`}`,
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

    nodeAtInvalid: (id: string) =>
      `Node "${id}" has an at that is not { x: number, y: number }. The position is ignored.`,
    nodeAtIgnored: (id: string) =>
      `Node "${id}" has an at, but it has no effect on a structure diagram (positions are computed). Use kind: placement.`,
    nodeSizeInvalid: (id: string) =>
      `Node "${id}" has a size that is not { w: positive number, h: positive number }. The size is ignored.`,
    openingKindUnknown: (id: string, word: string) =>
      `Node "${id}" has an opening "${word}" that v1 does not define (door / double / slide / window / open). It is not drawn.`,
    openingSideUnknown: (id: string, word: string) =>
      `Node "${id}" has an opening on side "${word}" (top / right / bottom / left). It is not drawn.`,
    openingIgnored: (id: string) =>
      `Node "${id}" has openings, but they are not drawn on a structure diagram. Use kind: placement.`,
    kindUnknown: (word: string) =>
      `kind is "${word}" (structure / placement). Drawing it as a structure diagram.`,
    directionUnknown: (word: string) =>
      `direction is "${word}" (right / down). Drawing it in the default horizontal direction.`,
    wrapNotBoolean: (found: string) =>
      `wrap is ${found}. Wrapping happens only when it is written as true.`,
    gridAxisInvalid: (position: number) =>
      `Axis ${position} of grid is not { id: code, at: number }. It is not drawn.`,
    gridIgnored: 'grid is present, but grid lines are not drawn on a structure diagram. Use kind: placement.',
    gridMarkUnknown: (position: number, word: string) =>
      `Axis ${position} of grid has mark "${word}" (code / level). It is drawn as a circled code.`,
    scaleMissing:
      'There is a grid but no scale, so no dimension figures are drawn (scale: { mm: 20 } means 1px = 20mm).',
    viewsInvalid: 'views is not a list. To put several drawings on one sheet, list them as - id: ….',
    viewsIgnored:
      'There is a views block (several drawings on one sheet) but it is not drawn in an architecture diagram (use kind: placement).',
    viewIdMissing: (position: number) => `views entry ${position} has no id, so that drawing is not drawn.`,
    viewIdDuplicate: (id: string) =>
      `Two views share the id "${id}", so it cannot be told which drawing a dimension belongs to.`,
    viewFrameMissing: (id: string) =>
      `View "${id}" has no at and size (at: { x, y } / size: { w, h }). There is no way to tell where to draw it, so it is not drawn.`,
    viewsNoGrid:
      'There are views but not one of them has a grid, so names are drawn but **no dimensions or grid lines**. Add a grid to the view if you want them. Note that **declaring a different scale per view is worthwhile on its own**: views[].scale stays in the source even when nothing is drawn from it, telling a reader (and another implementation) how many mm one pixel is in that region.',
    pinPositionInConstruction: (id: string) =>
      `Position cannot be edited in this drawing (pins.position on "${id}"). The construction steps decide it. **Edit the constants under let** (R and so on) — change one and the whole drawing moves while keeping its ratios.`,
    constructionNothingDrawn:
      'Nothing is drawn. Add arcs, or draw: true on a circle (points and circles can be decided without appearing).',
    numberTextChanged: (id: string, key: string, written: string, got: string) =>
      `The ${key} on "${id}" is written as ${written} but **is read as a number and becomes ${got}** (the drawing shows ${got}). Quote it as "${written}" to keep what you wrote.`,
    idSharedWithGroup: (id: string) =>
      `"${id}" is used both as a group and as a node. **The container is drawn twice and its name appears twice in the same spot** — they overlap exactly, so you cannot see it. Change one of the ids.`,
    scaleInvalid: (found: string) =>
      `scale.mm is ${found}. Write a positive number (how many mm one pixel is), or scale.in to draw in inches. No dimension figures are drawn.`,
    scaleTwoUnits:
      'scale has both mm and in. mm wins, so the dimensions come out in millimetres. Drop mm if you want feet and inches.',
    northUnknown: (word: string) =>
      `north is "${word}" (up / right / down / left). No north arrow is drawn.`,
    wallInvalid: (found: string) =>
      `wall.mm is ${found}. Write a positive number (wall thickness in mm). Wall thickness is unchanged.`,
    wallNeedsScale:
      'wall is present but scale is not, so mm cannot be turned into pixels and the wall thickness is unchanged.',
    radiusInvalid: (id: string) =>
      `Node "${id}" has a radius that is not a positive number. The range circle is not drawn.`,
    radiusIgnored: (id: string) =>
      `Node "${id}" has a radius, but range circles are not drawn on a structure diagram. Use kind: placement.`,
    markerUnknown: (id: string, word: string) =>
      `Node "${id}" has marker "${word}" (box / circle / double / none). It is drawn as a rectangle.`,
    markerIgnored: (id: string) =>
      `Node "${id}" has a marker, but it has no effect on a structure diagram (shape comes from type).`,
    curveUnknown: (name: string, word: string) =>
      `Edge ${name} has curve "${word}" (none / smooth). It is drawn as a polyline.`,
    viaInvalid: (name: string) =>
      `Edge ${name} has a via that is not a list of points (- { x: 100, y: 40 }). The route is ignored.`,
    viaIgnored: (name: string) =>
      `Edge ${name} has via, but it has no effect on a structure diagram (the machine routes the line).`,
    closeNotBoolean: (name: string) =>
      `Edge ${name} has a close that is not true / false. The loop is left open.`,
    closeIgnored: (name: string) =>
      `Edge ${name} has close, but it has no effect on a structure diagram (the machine routes the line).`,
    edgeUnderBox: (edge: string, box: string) =>
      `Edge ${edge} is hidden under the fill of box "${box}" (with arrows: false, lines are drawn before boxes). Set arrows: true to bring the line above the boxes.`,
    alignUnknown: (id: string, word: string) =>
      `Node "${id}" has align "${word}" (left / center / right). It is centred.`,
    alignIgnored: (id: string) =>
      `Node "${id}" has align, but it has no effect on a structure diagram (box size is derived from the text there).`,
    writeUnknown: (id: string, word: string) =>
      `Node "${id}" has write "${word}" (across / down). It is set horizontally.`,
    floorUnknown: (id: string, name: string) =>
      `Node "${id}" has floor "${name}", which is not listed in floors. No floor band is drawn.`,
    floorsMissing: (id: string) =>
      `Node "${id}" has a floor, but there is no floors list (list them bottom to top).`,
    verticalUnknown: (name: string, word: string) =>
      `Edge ${name} has vertical "${word}" (stair / escalator / elevator). It is not treated as a level change.`,
    verticalSameFloor: (name: string) =>
      `Edge ${name} has vertical, but both ends are on the same floor. That is not a level change.`,
    appearanceInNodes: (id: string) =>
      `Node "${id}" has appearance, but appearance belongs to pins (it has no effect under nodes).`,
    writeIgnored: (id: string) =>
      `Node "${id}" has write, but it has no effect on a structure diagram (box size is derived from the text there).`,
    hatchUnknown: (id: string, word: string) =>
      `Node "${id}" has hatch "${word}" (none / solid / dots / lines / cross). It is drawn plain.`,
    symbolUnknown: (id: string, word: string) =>
      `Node "${id}" has symbol "${word}". Only the words in SYMBOLS are drawn (it falls back to a rectangle).`,
    hatchIgnored: (id: string) =>
      `Node "${id}" has a hatch, but hatching is not drawn on a structure diagram. Use kind: placement.`,
    endsUnknown: (edge: string, word: string) =>
      `Edge ${edge} has ends "${word}" (one of ENDS). No symbol is drawn.`,
    lineUnknown: (edge: string, word: string) =>
      `Edge ${edge} has line "${word}" (solid / dashed / dotted / double / chain). It is drawn solid. **chain is the drafting centre line** — use it for axes of symmetry, optical axes, datum lines and cutting planes.`,
    weightUnknown: (edge: string, word: string) =>
      `Edge ${edge} has weight "${word}" (thin / normal / thick). It is drawn at the normal width.`,
    colorUnknown: (target: string, key: string) =>
      `${target} has color "${key}", but palette has no such key. No colour is applied.`,
    colorFaint: (key: string, value: string) =>
      `palette entry "${key}" (${value}) is too faint: the line sinks into the ground (3:1 is the floor for non-text; both the light and the dark ground are checked).`,
    labelMarkdown: (id: string) =>
      `"${id || '(no id)'}" has ** in its label (nodes, edge labels and view titles alike). **Labels are plain text**, not Markdown — the asterisks are not emphasis, they are **drawn as they are**. They creep in from the Markdown used in source comments and changelogs.`,
    colorNotHex: (key: string, value: string) =>
      `palette entry "${key}" has the colour "${value}", which cannot be read. Write it as **#rrggbb** (six digits). Three digits (#a33) and colour names (red) are not accepted — they are interpreted differently wherever the drawing is pasted. The key stays, with no colour.`,
    edgeSelfOpen: (id: string) =>
      `The edge from node "${id}" to itself has no via points, so it draws a zero-length line — just an arrowhead at the node's centre. A self-edge with via points and close: true draws a closed shape (a field of view, a range, an outline).`,
    edgeFillIgnored: (edge: string) =>
      `Edge ${edge} has fill, but edges have no fill (that is nodes[].fill). **A closed loop is filled with hatch, and its colour is color** — write close: true, hatch: solid and color: <a palette key>. Nothing is filled as written.`,
    edgeHatchIgnored: (edge: string) =>
      `Edge ${edge} has a hatch, but without close: true there is no face to fill, so it does nothing.`,
    nameCrowded: (id: string) =>
      `The name on node "${id}" does not fit its box and there is no free room outside either: it either lands on something else or is cut off at the edge of the sheet. Make the box bigger, break the name with **\`\\n\`**, or shorten the text. It is NOT dropped: losing a name is worse than an overlap.`,
    nameAdrift: (id: string, needs: number, has: number) =>
      `Node "${id}" is a wide box whose name did not fit, so it is drawn outside: the name needs ${needs}px and the box is ${has}px, so it is ${needs - has}px short. In a table that leaves the row looking empty. Widen the box, break the name with **\`\\n\`** (it is measured by its longest line), or shorten the text.`,
    tagHidden: (id: string) =>
      `The tag on node "${id}" does not fit its marker and is not drawn. Make the marker bigger or shorten the tag.`,
    alongVertical: 'vertically',
    alongHorizontal: 'horizontally',
    tooSmallToPrint: (
      ratio: string,
      floor: string,
      smallest: number,
      longest: number,
      need: number,
      axis: string,
      head: string,
      tail: string,
      gapAxis: string,
      gapAt: string,
      gapTo: string,
      gapWide: string,
    ) =>
      `This drawing is too small to read even printed on A3 (smallest text ${smallest}px / longest side ${longest}px = ${ratio}; the floor is ${floor}). **Take ${Math.max(1, Math.ceil(longest - need))}px off** — a longest side of ${need}px or less fits. **The long side runs ${axis}, between "${head}" and "${tail}".** Close the gap between those two. **Do not enlarge the text** (that grows the drawing and lowers the ratio further). Tighten the tables and notes, or split the drawing.${gapAxis === '' ? '' : ` **The widest empty band is ${gapAxis} ${gapAt}-${gapTo}, ${gapWide}px wide** with nothing in it.`}`,
    inkOverlap: (a: string, b: string, x: number, y: number) =>
      `On the sheet, ${a} and ${b} are drawn on top of each other. It is not only names: tags, dimension values, grid codes and view titles take room too. **Moving one ${x}px sideways or ${y}px vertically** clears it — which way is yours to choose.`,
    textOverlap: (a: string, b: string) =>
      `The labels of ${a} and ${b} are drawn on top of each other. A container that holds children should not repeat its name in the middle — move it to an edge cell.`,
    edgeNodeKeyIgnored: (name: string, key: string) =>
      `Edge "${name}" carries \`${key}\`, but **that word belongs to nodes**. On an edge it is dropped in silence: an edge joins two points, so it has no position, no size and no marker. Bend its route with \`via\`, style the line with \`line\` / \`weight\` / \`color\`, shape its ends with \`ends\`.`,
    nodeEdgeKeyIgnored: (id: string, key: string) =>
      `Node "${id}" carries \`${key}\`, but **that word belongs to edges**. On a node it is dropped in silence. Use \`line\` for the outline's line type (solid / dashed / dotted / chain), \`hatch\` for a fill pattern, \`color\` for the stroke colour. **There is no word for outline thickness yet** — change the line type, or show the area with \`hatch\`.`,
    viewTitleCovered: (view: string, box: string, grow: number) =>
      `The title of view "${view}" is drawn on top of "${box}". **A view title sits just below the view's bottom edge**, so anything that reaches past the height you wrote in \`size\` ends up underneath it. **Grow this view's \`size.h\` by ${grow}px, or move its contents up.**`,
    labelGluedWord: (id: string, found: string) =>
      `The label of "${id}" contains **"${found}"** — a lowercase English word glued straight onto Japanese text. That is usually a draft term left untranslated (an invented word), or two parts in the wrong order. **It is drawn exactly as written.** Translate it, or put a space between the scripts. Units (mm, cm, kg) and spaced forms like "PoE の" are not flagged.`,
    circleNotSquare: (id: string, marker: string, w: number, h: number, d: number) =>
      `Node "${id}" is \`marker: ${marker}\` (a circle), but its \`size\` is ${w}x${h}, not square. **A circle takes the shorter side as its diameter**, so what gets drawn is a **${d} circle** and the ${Math.max(w, h)} you wrote is gone. Label placement and overlap still measure the ${w}x${h} box, so **empty room is left beside the circle**. Use \`marker: ellipse\` for an oval (it uses both w and h), or make \`size\` square.`,
    hatchTooThin: (id: string, hatch: string, side: number) =>
      `Node "${id}" carries \`hatch: ${hatch}\`, but **its short side is only ${side}px, so not one mark is drawn** — it comes out indistinguishable from plain. Dots sit on a 9px pitch, so a face narrower than half that holds none; diagonals and cross-hatch are clipped to the face, so the thinner it is the shorter the stubs. **If you meant a line, drop \`hatch\` and set \`line\` instead**; if the pattern is meant to name a material, make the short side 9px or more.`,
    colorWithoutCode: (key: string) =>
      `Colour "${key}" carries meaning, but that code appears nowhere as text in the drawing. Colour alone fails in black and white and for colour vision deficiency. Write "${key}" as text somewhere — a legend entry is enough.`,
  },
  construct: {
    exprUnreadable: (text: string) => `Cannot read the expression: ${text}`,
    exprLeftover: (text: string) => `Leftover after the expression: ${text}`,
    parenMissing: 'A bracket is not closed.',
    dividedByZero: 'Division by zero.',
    distanceNeedsTwo: 'distance takes two points: distance(A, B).',
    unknownName: (name: string) =>
      `"${name}" is unknown. **A construction is evaluated in order**, so only names decided earlier can be used.`,
    unknownPoint: (name: string) => `There is no point "${name}". Decide it first under points.`,
    noMeeting: (a: string, b: string) =>
      `"${a}" and "${b}" do not meet (too far apart, or one is inside the other), so this point is undecided.`,
    takeMissing: (id: string) =>
      `"${id}" does not say which of the two intersections to take (take: upper / lower / left / right / first / second). **The machine will not guess** — take the other one and the drawing flips.`,
    takeUnknown: (id: string, word: string) =>
      `The take on "${id}" is "${word}" (upper / lower / left / right / first / second).`,
    unknownCircle: (name: string) => `There is no circle "${name}". Decide it first under circles.`,
    unknownShape: (name: string) =>
      `There is no shape "${name}". Define it under define, or give after the name (as) of something already placed.`,
    circleNeedsCenter: (id: string) => `Circle "${id}" has no center.`,
    duplicate: (id: string) => `"${id}" appears twice. A name can only mean one thing.`,
    pinPosition: (id: string) =>
      `Position cannot be edited in this drawing (pins.position on "${id}"). The steps decide it. **Edit the constants under let** (R and so on).`,
  },

  mermaid: {
    lossPlacement:
      'This source is a **placement drawing**: what matters is where things are, and **Mermaid has no place for positions or sizes**. What follows is a list of boxes with the geometry gone — it is not the same drawing. Export to SVG or draw.io if you need the drawing itself.',
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
