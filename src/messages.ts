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
      '読めるか・要素の数・線の交差・箱の重なり・囲みからのはみ出し・図の大きさ・「9 割」を返す。書いたら必ずこれを見ること。tooTangled が真なら、線が絡みすぎて目で追えない。hiddenLabels に辺の id があれば、そのラベルは置き場が無くて絵に出ていない（短くするか、辺を減らす）。**kind を必ず見ること** — placement（配置図）では positionsInSource が真で、**置き場所は自分で書く**（nodes[].at に { x, y }）。機械は並べ直さない。**大きさも nodes[].size に書ける**（{ w, h }。構成図でも効く）—— 間取りのように大きさが意味を持つ図では、書かないと全部同じ箱になる。pins は人のものなので書かないこと。tooSmallToProject が真なら、投影すると字が読めない大きさ。**文字を大きくして直そうとしないこと**（図が伸びて比がさらに下がる）。**まず wrap: true を試すこと** —— 横一列に伸びているだけなら、折り返すと収まる（8 個の鎖で比 13.9 → 2.2）。それでも足りなければ、図を分けられないかを人へ聞くこと。crowdedNames に id があれば、その名前は箱に入りきらず、外へ出した先も空いていない（他の箱に重なって出ている）。箱を大きくするか、technology を短くすること。**消してはいない** —— 部屋の名前が消えるのは、重なるより悪いため。reviewed が偽なら、まだ誰もこの図を見ていない。',
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
  },

  about: {
    oneLine:
      'AI が構成図を描き、人が 1 か所直し、その直しが次の生成で壊れない — テキスト正本の作図ツール。',
    purpose: [
      '勝負するのは 1 枚目ではなく 2 枚目以降。「構成が変わったので図を直す」場面のための道具。',
      '**人が直す往復を残すことが目的**。全自動で出るだけの図は、誰も理解しないまま貼られる。',
      '正本はテキスト（`*.zumen.yaml`）。仕様は実装から分離してあるので、この製品が終わっても図は読める。',
      '人の手直しは `pins` にしか書かれない。**正本 1 つを見れば、人がどれだけ手を入れたかが分かる。**',
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
      'kind: <structure（既定。構成図）| placement（配置図）>',
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
      '    marker: <box（既定）| circle | double | none>  # 配置図での印。丸は駅・経穴・計器',
      '    hatch: <none（既定）| solid | dots | lines | cross>  # 材料と区域の模様',
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
      '    ends: { from: <ENDS から>, to: <ENDS から> }   # 端の記号（ER の多重度など）',
    ].join('\n'),
    /** **守らせたいこと。** 実測では毎回 pins を書いてきたので、明示する。 */
    rules: [
      'pins は書かない。人が手で決めたことを置く節で、書いても採られない。',
      'kind: placement（配置図）では、置き場所を自分で書く。機械は並べ直さない。間取り・伏図・売場・避難経路はこちら。nodes[].at と nodes[].size の両方を書くこと。大きさを書かないと、便所と 16 畳の LDK が同じ箱で出る。',
      '建築の図（間取り・伏図・平面詳細図）を描くなら、grid（通り芯）と scale を必ず書く。寸法の数値が出ない図は、現場では使えない。通り芯は壁や柱の芯に置き、符号は X1 / Y1 のように付ける。',
      '断面図・立面図も kind: placement で描く（測り方は同じ。y を高さとして読む）。横の基準線は mark: level にして、id に GL±0 や 2FL+3,200 と書く。方位は書かない。',
      '配置図では部屋や棚が接しているのが普通で、隙間を空けない。壁は隣どうしで共有する。',
      'type を増やさない。業界の専門性は形ではなく符号（tag）で表されている。柱は C1 であって円柱の絵ではない。',
      '横一列に伸びすぎたら wrap: true を書く。文字を大きくして直そうとしない（図が伸びて比がさらに下がる）。',
      '届く範囲は radius（範囲の円）で書く。クレーンの作業半径・消火器の警戒区域・影の離隔。物の形ではなく注記なので、type は増やさない。',
      '配置図で丸い印を打つなら marker: circle（乗換駅などは double）。路線図の駅・経穴・計器はこれ。marker の値は形の名前だけで、消火器のような意味の語は無い（type も増やさない）。名前は印の外へ出るが、丸に入る短い文字（番号）は中に書く。',
      'ER 図の多重度は文字で書かず ends で書く（1 は bar、多は crow、0 以上は dot-crow）。データベースをやる人は端の形で読む。文字で書くと辺が増えるほど置き場が無くなって消える。ends の値は形の名前だけで、one-to-many のような意味の語は無い。',
      '材料と区域は hatch で描き分ける。solid はアスコン・コンクリート、dots は砕石・砂、lines は地盤・既存部分、cross は撤去や立入禁止の区域。断面図と区域図は、模様が無いと専門の図に見えない（縮小すると文字は消えるが模様は残る）。値は模様の名前だけで、アスコンのような材料の語は無い。',
      '一度付けた id は、意味が変わらないのに書き換えない。人の手直しが id に紐づいている。',
      'nodes の並び順には意味がある。人が読む順序なので、理由なく並べ替えない。',
      '知らないキーは捨てずに保つ。',
      '桁を揃える空白を入れない。流れ形式の並び（[{ ... }, { ... }]）も書かない。読んで書き戻すと詰められ、人が触っていない行に差分が出る（validate が round-trip-changed で落とす）。',
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
    scaleInvalid: (found: string) =>
      `scale.mm が ${found} になっています。正の数を書きます（1px が何 mm か）。寸法の数値は出ません。`,
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
    hatchUnknown: (id: string, word: string) =>
      `ノード "${id}" の hatch が "${word}" になっています（none / solid / dots / lines / cross）。無地で描きます。`,
    hatchIgnored: (id: string) =>
      `ノード "${id}" に hatch がありますが、構成図では描かれません（kind: placement で描かれます）。`,
    endsUnknown: (edge: string, word: string) =>
      `エッジ ${edge} の ends が "${word}" になっています（none / arrow / bar / crow / dot / dot-bar / dot-crow）。記号は描かれません。`,
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
      'Returns readability, element counts, edge crossings, box overlaps, group escapes, size, and the autonomy figure. Always look at this after writing. If tooTangled is true, the edges are too knotted to follow by eye. Any edge id in hiddenLabels has a label that did not fit and is not drawn — shorten it or use fewer edges. **Always check kind**: for a placement drawing positionsInSource is true, meaning you write the positions yourself (nodes[].at as { x, y }) and the machine will not re-arrange them. You can also set sizes with nodes[].size ({ w, h }, which works for structure diagrams too) — without it every room comes out the same size. Never write pins — those belong to the person. If tooSmallToProject is true the text is too small to read when projected; do NOT fix it by enlarging the text (that grows the diagram and lowers the ratio further). **Try wrap: true first** — if the diagram is just one long row, wrapping brings it back (a chain of 8 goes from 13.9 to 2.2). If that is not enough, ask the person whether the diagram can be split. Any id in crowdedNames has a name that did not fit its box and had nowhere free outside it, so it is drawn overlapping something. Make the box bigger or shorten technology. It is NOT dropped — a room losing its name is worse than an overlap. If reviewed is false, nobody has looked at this diagram yet.',
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

  kind: {
    structure: 'Autonomy',
    structureWhy:
      'What connects to what is the content, so the machine may decide placement. If a person is re-arranging shapes, this is a fancy drawing app, not this product.',
    placement: 'Placed in the source',
    placementWhy:
      'Where things sit is the content, so positions live in the source (nodes[].at). The machine does not re-arrange them. The AI writes at; a person overrides with pins.',
  },

  about: {
    oneLine:
      'A text-source diagram tool: the AI draws, a person fixes one spot, and that fix survives the next generation.',
    purpose: [
      'The contest is not the first drawing but every one after it — for when the architecture changed and the diagram must follow.',
      '**Keeping the human in the loop is the point.** A diagram nobody argued with is a diagram nobody understood.',
      'The source of truth is text (`*.zumen.yaml`), and the format is specified apart from this implementation, so the diagrams outlive the tool.',
      'Hand edits land only in `pins`, so one file tells you how much a person touched.',
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
      'kind: <structure (default) | placement>',
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
      '    marker: <box (default) | circle | double | none>  # how it is marked on a plan',
      '    hatch: <none (default) | solid | dots | lines | cross>  # material / zone pattern',
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
      '    ends: { from: <from ENDS>, to: <from ENDS> }   # end symbols (ER cardinality)',
    ].join('\n'),
    rules: [
      'Do not write pins. That section holds what a person decided by hand; anything you write there is dropped.',
      'With kind: placement you place things yourself; the machine does not lay them out. Floor plans, framing plans, store layouts and escape routes are placement. Write both nodes[].at and nodes[].size. Without sizes, a toilet and a 16-mat living room come out the same box.',
      'For an architectural drawing, always write grid and scale. A drawing with no dimension figures cannot be used on site. Put the grid lines on the centre of walls and columns, and code them X1 / Y1.',
      'Sections and elevations also use kind: placement (the measure is the same; read y as height). Mark the horizontal reference lines with mark: level and write the id as GL±0 or 2FL+3,200. Do not write north.',
      'In a placement diagram rooms and shelves normally touch. Do not leave gaps; neighbours share a wall.',
      'Do not add to type. Domain specificity is carried by the code (tag), not by shape. A column is C1, not a cylinder.',
      'If a diagram stretches into one long row, write wrap: true. Do not try to fix it by enlarging the text.',
      'Use radius for a reach or zone: crane working radius, fire-extinguisher coverage, shading offset. It is an annotation, not a shape, so type stays as it is.',
      'On a plan, use marker: circle for a round mark (double for an interchange): transit stations, acupuncture points, instruments. marker values are shape names only — there is no semantic value like an extinguisher, and type does not grow. The name is drawn outside the mark, except a short label (a number) which goes inside.',
      'Write ER cardinality with ends, not words (bar for one, crow for many, dot-crow for zero-or-more). Database people read the end shape. Words run out of room as edges multiply. ends values are shape names only, never a semantic value like one-to-many.',
      'Distinguish materials and zones with hatch: solid for asphalt and concrete, dots for crushed stone and sand, lines for ground and existing work, cross for removal or no-entry areas. A section or a zoning drawing does not read as professional without patterns (shrink it and the text disappears but the pattern remains). Values are pattern names only, never a material name.',
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
    scaleInvalid: (found: string) =>
      `scale.mm is ${found}. Write a positive number (how many mm one pixel is). No dimension figures are drawn.`,
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
    hatchUnknown: (id: string, word: string) =>
      `Node "${id}" has hatch "${word}" (none / solid / dots / lines / cross). It is drawn plain.`,
    hatchIgnored: (id: string) =>
      `Node "${id}" has a hatch, but hatching is not drawn on a structure diagram. Use kind: placement.`,
    endsUnknown: (edge: string, word: string) =>
      `Edge ${edge} has ends "${word}" (none / arrow / bar / crow / dot / dot-bar / dot-crow). No symbol is drawn.`,
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
