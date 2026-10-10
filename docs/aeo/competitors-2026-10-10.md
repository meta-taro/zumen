# 競合の機能と、zumen に無いもの —— 2026-10-10

> **調べ方。** WebSearch は上限に達していたため使っていない。読んだのは、下の各行に書いた URL（WebFetch）と、
> GitHub の README（`gh api repos/<owner>/<repo>/readme`）・リポジトリ情報（`gh api repos/<owner>/<repo>`）だけ。
> WebFetch は小さいモデルが頁を要約して返すため、**「原文」と書いた引用も要約経由のものがある**（GitHub README からの引用は原文どおり）。
> **読んでいないことは「確かめていない」と書いた。** 推測では埋めていない。
> 星の数・最終 push は `gh api` の 2026-10-10 時点の値。

---

## 1. 競合 × 観点の表

### 1a. 正本・AI の口・手直し

| 競合 | 正本の形式 | AI・MCP の口 | 人の手直しが再生成で残るか | 出典 |
|---|---|---|---|---|
| **zumen**（基準） | YAML 1 本（`spec/zumen-format-v1.md`、実装から分けた仕様） | MCP 15 本（`zumen_spec` / `examples` / `read` / `pins` / `inspect` / `create` / `propose` / `export` / `timelapse` / `live_*` 4 本ほか）。**正本を直接書く口は無い**（D13） | **残る。** 人だけが書ける `pins:` を AI は書けない。実測 10/10、見本 210/210 | README.md、src/mcp.ts |
| **D2**（Terrastruct） | `.d2` テキスト（独自言語） | 確かめていない（README に MCP の記載なし） | 確かめていない | https://github.com/terrastruct/d2 、https://d2lang.com/ |
| **Eraser** | 独自 DSL（diagram-as-code）＋キャンバス | `eraser_mcp`：作成・検索・更新・書き出し。`manually_` で始まる道具は「AI を通さずそのまま書く」 | 確かめていない（頁が 404。MCP 文書は「`manually_` の道具は渡した内容をそのまま書く」とだけ） | https://www.eraser.io 、https://docs.eraser.io/docs/mcp |
| **Structurizr** | DSL（C4 モデル）。**座標は正本に書かない**（workspace の JSON 側） | 無料・OSS の MCP サーバ（DSL の検証・workspace 管理） | **条件つきで残る。** 新旧 workspace を名前（次に内部 id）で突き合わせて手置きを移す。**改名と並べ替えが重なると失われる**、ビューの key が変わると図ごと失われる、と文書が明記 | https://structurizr.com 、https://docs.structurizr.com/ui/diagrams/manual-layout |
| **IcePanel** | クラウド上のモデル（C4） | Claude・OpenAI・Cursor と連携（中身は確かめていない） | 確かめていない | https://icepanel.io |
| **Mermaid**（OSS） | Markdown 風テキスト | なし（OSS 本体） | 該当しない（座標を持たない） | https://github.com/mermaid-js/mermaid |
| **Mermaid（mermaid.ai、旧 Mermaid Chart）** | Mermaid テキスト | 自然言語・文書・議事録から生成、MCP サーバ（Claude・VS Code・Cursor） | 確かめていない（視覚エディタは「コードと双方向に同期」とあるが、配置を正本へどう残すかは未確認） | https://mermaid.ai/ |
| **draw.io MCP**（公式 jgraph） | draw.io XML（CSV・Mermaid も可） | MCP App（チャット内に図を描く）／Tool Server（`npx @drawio/mcp`）／Claude Code・Codex・Copilot 向けプラグイン。`search_shapes` で 1 万超の図形を検索 | **配置を保ったまま線だけ引き直す**（libavoid）経路がある。再生成時の扱いは確かめていない | https://github.com/jgraph/drawio-mcp |
| **drawio-mcp-server**（lgazo） | draw.io XML | 要素の CRUD、頁・層の管理、複数エージェントの直列化 | 該当しない（要素単位で直に書き換える） | https://github.com/lgazo/drawio-mcp-server |
| **Excalidraw MCP**（公式） | Excalidraw のシーン | MCP App。道具は書式の参照と `create_view` の 2 本 | 該当しない（チャット内のチェックポイントから再生成） | https://github.com/excalidraw/excalidraw-mcp |
| **mcp_excalidraw**（yctimlin） | `.excalidraw`（**書き出しはバイト単位で安定**、と明記） | MCP 26 本＋CLI＋REST。`describe`・`screenshot` で AI が絵を見る。名前付きスナップショットと巻き戻し | 該当しない（要素単位の CRUD） | https://github.com/yctimlin/mcp_excalidraw |
| **tldraw** | SDK（無限キャンバス） | 「LLM と作るためのキャンバスの部品」 | 確かめていない | https://github.com/tldraw/tldraw |
| **Kroki** | 他の記法（D2・Mermaid・PlantUML ほか 25 以上）をそのまま受ける | なし | 該当しない | https://github.com/yuzutech/kroki |
| **PlantUML** | テキスト | 確かめていない | 確かめていない | https://github.com/plantuml/plantuml （リポジトリ情報のみ） |
| **diagram-design**（Claude 等の skill） | **正本なし。** 1 枚の HTML＋SVG | Agent Skill（Claude Code・Codex・Copilot・Cursor ほか） | **残らない。** README 自身が「編集できる正本ではない。PR で差分にできるテキストも、箱を動かすキャンバスも無い」「同じ指示でも 2 回目は配置が変わる」と認めている | https://github.com/cathrynlavery/diagram-design |
| **Ilograph** | YAML（diagrams-as-code） | 確かめていない | 確かめていない（自動レイアウト前提） | https://www.ilograph.com 、https://www.ilograph.com/docs/editing/perspectives/ |

### 1b. 描き方・出し方・値段

| 競合 | 自動レイアウト | 書き出し | 埋め込み | 差分・レビュー | 専門図面 | 価格・ライセンス | 訴求の一文（原文） |
|---|---|---|---|---|---|---|---|
| **zumen** | elkjs（構成図）。配置図は座標が正 | SVG / PNG / Mermaid / draw.io、動く SVG（timelapse） | Markdown 本文へ | **適用前に行の差分**、人が押すまで変わらない。Git のマージドライバ | 389 枚（照明仕込図・歯周チャート・積付図・販売図面ほか） | MIT（README） | Let an AI draw the diagram, fix what you want by hand, ask the AI again — and your fix is still there. |
| **D2** | 3 種同梱（dagre 移植・ELK 移植・TALA は任意）。シーケンス図・グリッドも | SVG・PNG・GIF・PDF・PPTX（d2lang.com は ASCII も） | 確かめていない | 確かめていない | 確かめていない | MPL-2.0。星 25,590 | A modern diagram scripting language that turns text to diagrams. |
| **Eraser** | 「見栄えのよい配置を自動で作る」 | PNG・JPEG・draw.io（MCP 経由） | Confluence・Notion・VS Code・GitHub | 「versioning/diff」（要約経由。中身は確かめていない） | クラウド構成・ERD・シーケンス・BPMN・フロー | Free（3 ファイル・AI 3 回）／$15／$45／Enterprise（いずれも 1 人・月、年払い） | AI for diagrams that matter |
| **Structurizr** | あり（自動レイアウトと手置きの併用） | PlantUML・Mermaid・静的 HTML（CLI） | 確かめていない | 確かめていない | C4 の 6 種 | server の配布バイナリ以外は無料 | multiple software architecture diagrams from a single model（要約経由） |
| **IcePanel** | 確かめていない | 確かめていない | Confluence・SharePoint | **現在と将来の設計の比較（fork・merge）** | C4 | Free（1〜5 編集者）／$40／$80（1 編集者・月）／Enterprise | Start designing free, upgrade when you grow or scale design.（料金頁） |
| **Mermaid**（OSS） | あり | SVG（描画器） | Markdown | なし | 確かめていない | MIT。星 90,597 | Generate diagrams from Markdown-like text. ／ Doc-Rot is a Catch-22 that Mermaid helps to solve. |
| **mermaid.ai** | あり | 確かめていない | VS Code・Confluence・GitHub Copilot、**発表モード** | 確かめていない | 確かめていない | 無料登録あり、Enterprise あり（詳細は確かめていない） | You already think in systems. Now you can diagram them just as fast. |
| **draw.io MCP** | ELK で並べ直す／libavoid で線だけ迂回 | `.drawio`・PNG / SVG / PDF（**図の XML を埋め込んだまま**） | チャット内（MCP Apps） | 確かめていない | P&ID・電気・Cisco・AWS 等の図形ライブラリ | Apache-2.0。星 5,600 | The official draw.io MCP server that enables LLMs to create and open diagrams in the draw.io editor. |
| **drawio-mcp-server** | 確かめていない | XML・SVG / PNG（XML 埋め込み） | iframe | 確かめていない | AWS・GCP・Azure・Cisco の図形を実行時に発見 | MIT。星 1,481 | Let's do some Vibe Diagramming with the most wide-spread diagramming tool |
| **Excalidraw MCP**（公式） | なし | 確かめていない | チャット内（MCP Apps） | なし | なし | MIT（README 末尾） | MCP server that streams hand-drawn Excalidraw diagrams with smooth viewport camera control and interactive fullscreen editing. |
| **mcp_excalidraw** | なし（整列・等間隔の道具あり） | PNG・SVG（ヘッドレス）・`.excalidraw`・`.excalidraw.md`（Obsidian） | Obsidian | スナップショットと巻き戻し | なし | MIT。星 2,521 | gives AI agents a live Excalidraw canvas they can draw on, look at, refine, and save into your repo. |
| **tldraw** | 確かめていない | 画像 | DOM 埋め込み（YouTube・Figma 等を図に） | 確かめていない | 該当しない（SDK） | **独自ライセンス。本番利用は鍵が要る** | Build infinite canvas apps in React with the tldraw SDK. |
| **Kroki** | 各記法に従う | 各記法に従う | 統一 API（どの記法も 1 つの口で描く） | なし | BlockDiag・WaveDrom・Bytefield・WireViz ほか | MIT。星 4,365 | Creates diagrams from textual descriptions! |
| **diagram-design** | エージェントが 4px 格子に置き、重なり・はみ出しを CI で検査 | HTML（SVG 内蔵）→ SVG・PNG | 確かめていない | なし（本人が認めている） | 44 種（Wardley・Sankey・魚骨・分解軸測など） | MIT。星 48,104 | Editorial diagram design for Claude Code, Codex, GitHub Copilot, Factory Droid, and Pi. 44 diagram types. … No Mermaid slop. |
| **Ilograph** | 自動 | 確かめていない | Confluence Cloud | 確かめていない | 確かめていない | 無料試用＋有料（詳細は確かめていない）。Web とデスクトップ（オフライン） | best diagramming tool for communicating complex distributed systems（利用者の声） |

---

## 2. 競合にあって zumen に無いもの

「衝突」は CLAUDE.md「この製品に固有の禁止事項」1〜5、PRD §4、`.claude/decisions.md`、`DESIGN.md` と照らした。

| # | 機能 | どの競合が | 何ができる | 利用者に効く場面 | 禁止事項と衝突するか | 大きさ |
|---|---|---|---|---|---|---|
| 1 | **1 行で入る MCP**（`npx` ＋ Claude Code プラグイン） | draw.io（`npx @drawio/mcp`、`/plugin install drawio@drawio`）、lgazo（`npx drawio-mcp-server install claude-code`）、diagram-design（`npx skills add`） | clone も pnpm も要らずに繋がる | 初めて試す人。いまの zumen は `git clone`→`corepack`→`pnpm install`→パス手書き。**npm パッケージは `!dist/mcp.*` で MCP を外している** | **しない。** 道具を増やす話ではなく配り方。承認の線（D13）も動かない | 小 |
| 2 | **変更前／変更後を並べた絵**（PR・文書に貼れる） | IcePanel（現在と将来の比較）、diagram-design（Architecture delta：Before・Changes・After）、Eraser（versioning/diff） | 変わった所を絵で見せる | YAML を読まない人（専門家・上司）が AI の書き換えを承認するとき。PR の確認 | **並べるならしない。重ねるならする。** `DESIGN.md` §2.5 は「適用前の差分は図の上に重ねない」。左右に並べ、行の差分も添える形なら衝突しない。承認窓の中を変える話ではない | 中 |
| 3 | **節のリンク**（押すと飛ぶ・浮き札） | D2（Interactive tooltips and clickable links）、Mermaid（`click`）、Ilograph（掘り下げ） | 図の中の箱から、文書の節・別の図・URL へ飛ぶ | md-business に埋めた図から本文の該当節へ。大きい構成を別図へ分けたとき | **しない。** 描画の属性 1 つ。ただし「別の図の中身を取り込む」まで行くと D30（分割は保留）に触れるので、**URL を持つだけ**に留める | 小 |
| 4 | **段（steps / scenarios）を 1 本の正本に** | D2（layers・scenarios・steps、動く SVG）、IcePanel（現在／将来）、Ilograph（sequence perspectives）、mermaid.ai（発表モード） | 同じ図の「今」「移行後」「障害時」を 1 ファイルで持ち、紙芝居や動く SVG で出す | 移行計画・転換図（舞台の場転）・工程の段階 | **しない**（形式の変更なので D 番号を起こしてから）。`zumen_timelapse` は Git 履歴の成長を撮るもので、意図した段とは別 | 中〜大 |
| 5 | **PDF 書き出し**（PPTX も） | D2（PDF・PPTX）、draw.io（PDF） | 印刷・配布 | 専門家は紙・A3 で回す（照明仕込図・積付図）。いまは SVG→各自で印刷 | **しない** | 中（依存を足すかの判断が要る） |
| 6 | **チャットの中に図を出す（MCP Apps）** | draw.io 公式、Excalidraw 公式 | アプリを入れずに、会話の中で図を見る | Claude Desktop / claude.ai の利用者が最初に触るとき | **見せるだけならしない。** 適用ボタンを置くと D34（線越しに押せない）と衝突しうる。**表示専用**に限る | 中 |
| 7 | **書き出しに正本を埋め込む**（SVG / PNG から YAML を取り戻せる） | draw.io（`--embed-diagram`、XML 入り PNG / SVG）、lgazo | 絵だけ渡されても、元の図を開き直せる | 文書・Slack に貼られた絵から直したいとき。「この製品が終わっても図が読める」（D2 決定の趣旨）を補強 | **しない** | 小 |
| 8 | **JSON Schema（エディタでの補完・検査）** | D2（自動整形・構文強調・LSP 予定）、Ilograph（autocomplete） | YAML を手で書くとき、キー名の補完と赤線 | 人が正本を直接直すとき | **しない。** 編集機能ではなく形式の公開 | 小 |
| 9 | 見た目の作風（テーマ・手描き風・ブランド取り込み） | D2（themes・sketch）、diagram-design（サイトから色と書体を取り込む）、Excalidraw | 見栄えを揃える | 社内資料 | **衝突の恐れ。** ベースルール §11・`DESIGN.md`「見た目は人が決める」。`styles` 表で人が持つ範囲は既にある。**AI がサイトから色を決める取り込みは採らない** | 中 |
| 10 | LaTeX・コード片のラベル | D2（mathjax、構文強調） | 式・コードを図に | 理工系の図 | しない | 中 |
| 11 | ASCII 書き出し | D2 | 端末・コードのコメントに | 開発者 | しない（効きは薄い） | 小〜中 |
| 12 | 他形式の読み込み（Mermaid・draw.io・Excalidraw・Visio・画像・Terraform） | Eraser、diagram-design、lgazo、mcp_excalidraw | 既存の図を取り込む | 乗り換え | **する。** 禁止事項 5・PRD §4「他形式インポートを先に作らない」 | — |
| 13 | リアルタイム共同編集・共有リンク | mermaid.ai、tldraw、IcePanel、mcp_excalidraw | 複数人で同時に | チーム | **する。** 禁止事項 5 | — |
| 14 | Web 版・プレイグラウンド | D2、Structurizr、mermaid.ai、Eraser | ブラウザだけで試す | 初見の人 | **する。** 禁止事項 5（Web 版を先に作らない） | — |
| 15 | 要素単位の操作（整列・等間隔・ロック・複製・頁管理） | mcp_excalidraw、lgazo | キャンバスを細かく直す | 手で描く人 | **する。** 禁止事項 3（作図ソフトの機能一覧を追わない）、D11 | — |
| 16 | 1 万超の図形ライブラリ（クラウド各社のアイコン含む）を検索 | draw.io（`search_shapes`）、lgazo | 公式アイコンで描く | クラウド構成図 | **する（同梱部分）。** D7「公式アイコンは同梱しない」。zumen の答えは `zumen_examples` の見本検索 | — |
| 17 | 自然言語の指示で、承認なしに直接書き換える | Eraser（`manually_` でない道具）、mcp_excalidraw、lgazo | 速い | — | **する。** D5・D13（AI の出力を正本にしない、直接書く口を作らない）、禁止事項 4 | — |
| 18 | 1 つのモデルから複数の視点・掘り下げ（C4 の文脈→器→部品） | Structurizr、IcePanel、Ilograph | 大きい構成を段階に割る | 30 節超の構成図 | **決定と衝突（保留中）。** D30「分割の仕組みはいまは足さない」。覆す条件（実物の依頼で 30 節超）は未達 | 大 |
| 19 | 承認窓で図の上に変更を重ねて見せる | （Eraser の diff、IcePanel の比較を窓に持ち込む形） | — | — | **する。** `DESIGN.md` §2.5（人が書く設計判断） | — |

---

## 3. 推奨 —— 衝突しないもののうち、利用者に効く順に 3 つ

### 第 1 位　1 行で入る MCP ＋ Claude Code プラグイン（小）

**何を作るか**

- npm パッケージ `@metataro/zumen` に MCP を入れる（いまは `files` で `!dist/mcp.*` と外している）。`bin` を 1 つ足す。

```bash
npx -y @metataro/zumen mcp                 # MCP サーバとして起動（stdio）
npx -y @metataro/zumen install claude-code # .mcp.json に書く（claude-desktop / codex も）
```

```json
{ "mcpServers": { "zumen": { "command": "npx", "args": ["-y", "@metataro/zumen", "mcp"] } } }
```

- Claude Code のプラグイン市場に置く（リポジトリ直下に `.claude-plugin/`）。

```text
/plugin marketplace add meta-taro/zumen
/plugin install zumen@zumen
```

- `live_*`（画面との線）は窓が要るので、npx 版では「窓が無い」と返すだけでよい。

**なぜ効くか**

- 競合 3 つ（draw.io 公式・lgazo・diagram-design）が**全部この形で配っている**。いまの zumen は 4 行の clone と、パスの手書きが要る。**最初の 1 回で離脱する所**を消す。
- 道具も承認の線も増えない。CLAUDE.md の「MCP は人が気づいたときに広げる」は道具の話で、配り方には当たらない（ただし判断は人へ。§注を参照）。

### 第 2 位　変更前／変更後を**並べた**絵（中）

**何を作るか**

CLI と MCP の書き出しに 1 種足す。**重ねない。左右（狭い紙なら上下）に並べ、変わった節に印を付け、行の差分を下に添える。**

```bash
pnpm compare before.zumen.yaml after.zumen.yaml out.svg   # 並べた 1 枚の SVG
git show HEAD~1:arch.zumen.yaml | pnpm compare - arch.zumen.yaml out.svg
```

```ts
// zumen_export に kind を 1 つ足す（読みと書き出しだけ。正本は変えない）
zumen_export({ path: 'arch.zumen.yaml', kind: 'compare', against: '<提案の本文 or Git の版>' })
```

印の付け方（案）：足された節は太枠＋「新」、消えた節は変更前の側だけに点線、**人の `pins` で止まっている節には「人が置いた」印**（「あなたの手直しは残っています」が絵で読める）。

**なぜ効くか**

- **この製品の勝負どころ（手直しが残る）を、YAML を読まない人に見せられる唯一の形。** 専門家・上司・顧客は行の差分を読まない。
- IcePanel（現在と将来）・diagram-design（Architecture delta）・Eraser（diff）が同じ需要を示している。zumen は「AI の書き換えを人が承認する」製品なので、**承認の材料を増やす方向**で禁止事項 3・4 と逆を向かない。
- `DESIGN.md` §2.5（重ねない）とは、**並べる**ことで両立させる。承認窓の中は変えない。§2.5 は人が書く文書なので、**この解釈でよいかは人の確認が要る。**

### 第 3 位　節のリンク `nodes[].link`（小）

**何を作るか**

```yaml
nodes:
  - id: order-db
    label: Order DB
    link: ./order-db.zumen.yaml        # 別の図へ（相対パス）
  - id: stock-api
    label: Stock API
    link: https://example.com/api#stock # URL・文書の節へ
    note: 在庫引当は 5 秒で打ち切り     # 浮き札（SVG の <title>）。名乗りは要検討
```

- SVG では箱を `<a href>` で包む（出典 `sources` の URL と同じ作り。src/render.ts に既にある）。
- draw.io 書き出しは `link` 属性、Mermaid 書き出しは `click <id> href "<url>"` へ写す。
- `link` は **URL を持つだけ**。別の図の中身を取り込まない（D30 に触れないため）。検査は「相対パスの先が無い」を知らせる 1 本だけ。

**なぜ効くか**

- 着地点（D4）は **md-business の本文に埋まった図**。図の箱から本文の該当節・API 文書へ飛べると、図が「眺める絵」から「文書の索引」になる。
- 30 節を超える構成を手で何枚かに割ったとき、**図どうしを行き来できる最小の手立て**になる（D30 の本格的な分割を待たずに済む）。
- D2・Mermaid・Ilograph が当たり前に持っていて、無いと「貼っただけの絵」に見える。

**次点**：書き出しに正本を埋め込む（#7、小）、PDF（#5）、段（#4）。#7 は「絵だけ渡されても図に戻れる」で D2 決定（読めなくならない）を補強するので、第 3 位と入れ替えてもよい。

> **注（人の判断が要るもの）。** 第 1 位は MCP の配り方、第 2 位は `DESIGN.md` §2.5 の読み方、第 3 位は形式への属性追加（spec の版内追加）。どれも CLAUDE.md の禁止事項には当たらないと判断したが、**着手の可否は人が決める。**

---

## 4. 訴求の語 —— 競合が使い、zumen の名乗り（README 英語版）に無いもの

README.md を語で数えた（2026-10-10）。

| 語 | 使っている競合（読んだ所） | zumen の README | 当てるなら |
|---|---|---|---|
| **text-to-diagram** / **declarative** | D2（README・d2lang.com、比較サイト text-to-diagram.com） | 0 | 「diagrams as code」は名乗っているが、検索語としての text-to-diagram は無い |
| **doc-rot** / documentation catch up with development | Mermaid（README） | 0（「the diagram becomes a lie」は 5 箇所ある） | zumen の「Why」と同じ問題。語として借りられる |
| **C4** / single model, multiple views | Structurizr、IcePanel | 0 | 名乗るなら D30 の後。いまは名乗らない |
| **interactive**（clickable links, walkthrough, drill-down） | D2、Ilograph、Eraser、Excalidraw 公式 | 0 | 第 3 位（`link`）を作ってから |
| **offline** / **diagram never leaves the machine** / data residency | draw.io MCP（Data Residency & Offline Use の節）、Ilograph（desktop, offline） | 0（`local` は 2 だが localhost の文脈） | **zumen は元から手元で完結する**（D16 鍵を持たない、live は 127.0.0.1）。語が無いだけで、事実はある。いちばん安く足せる |
| **review** / versioning / diff（PR で） | Eraser、diagram-design（PR で差分にできない、と自ら弱点に挙げる） | `review` は 0（`diff` は本文にあり） | 「PR で読める差分」は zumen の強み。語を立てる |
| **deterministic** / **byte-stable** / no phantom git diffs | mcp_excalidraw | 0 | zumen は `git diff` を前提にしている。事実を確かめてから名乗る |
| **agent skill** / **plugin** | draw.io、diagram-design、lgazo | 0 | 第 1 位の後 |
| **open source** / **free** | Kroki、各 OSS | 0（MIT は 5 箇所） | 「open source」の語そのものが無い |
| **vibe diagramming** | lgazo | 0 | zumen の主旨（往復を残す）とは逆向き。**採らない** |
| **production-ready** / beautiful / editorial | Eraser、D2、diagram-design | 0 | 「AI がきれいな図を出す」側の語。禁止事項 1 と逆向き。**採らない** |
| **live canvas** / real-time sync | mcp_excalidraw、mermaid.ai | 0 | 共同編集を連想させる（禁止事項 5）。**採らない** |
