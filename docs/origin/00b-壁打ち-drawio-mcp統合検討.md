# md-business × draw.io / MCP 統合検討メモ

> **ステータス:** 企画化前のアイデア保存\
> **目的:**
> 現時点の発想を失わないために記録する。採用・実装を確定する文書ではない。\
> **作成日:** 2026-08-28

------------------------------------------------------------------------

## 1. 発端

図・フローチャート・ER図・システム構成図などを作成できる
**draw.io（diagrams.net）**
を、md-businessの機能としてどこまで利用・統合できるか検討する。

検討の起点は以下。

-   draw.io自体がOSSである
-   draw.io周辺でMCP対応が進んでいる
-   実際にAIへ依頼してdraw.ioの図を生成した経験があり、実用性を感じている
-   ゼロから図形エディタを構築する必要性があるのか検討したい
-   draw.ioを部品として利用する方が合理的な可能性が高い
-   md-businessのMarkdown / TSV / HTML / Git / MCPとの親和性が高そう
-   「AIが資料を読み、図を作り、人間がGUIで直し、再びAIが編集する」という循環をmd-business内で完結できる可能性がある

現段階では正式機能として採用するかは未決定。

------------------------------------------------------------------------

## 2. draw.ioについて

draw.io（diagrams.net）は汎用ダイアグラムエディタ。

代表的な用途：

-   フローチャート
-   ER図
-   UML
-   シーケンス図
-   システム構成図
-   ネットワーク構成図
-   AWS / Azure / GCP構成図
-   Kubernetes構成図
-   BPMN
-   組織図
-   ワイヤーフレーム
-   ホワイトボード
-   業務フロー

### OSS

draw.io本体はOSSとして公開されている。

-   Apache License 2.0
-   Fork可能
-   改造可能
-   商用利用可能（ライセンス条件遵守）
-   セルフホスト可能
-   Desktop版あり
-   Git管理可能

ただし、コードのOSSライセンスと「draw.io」名称・ロゴ等の商標は別問題として扱う。

------------------------------------------------------------------------

## 3. MCP / AI対応

draw.io周辺ではAI・MCP対応が進んでいる。

想定される利用方法：

``` text
人間
  ↓
「このシステムの構成図を作って」
  ↓
AI Agent
  ↓
draw.io MCP / Plugin
  ↓
draw.io XML / Mermaid等を生成
  ↓
draw.ioで表示
  ↓
人間がGUI編集
```

AIに特殊な構文を毎回入力させるのではなく、自然言語の依頼から図生成へ繋げられる方向が望ましい。

例：

-   「この仕様からER図を作って」
-   「認証処理をフローチャートにして」
-   「現在の実装を読んでシステム構成図を作って」
-   「この部分だけシーケンス図にして」
-   「AWS構成図として整理して」
-   「DBをMariaDBからPostgreSQLへ変更して」
-   「この図をもっと分かりやすく整理して」

------------------------------------------------------------------------

## 4. md-businessへ組み込む場合の基本思想

draw.ioそのものをmd-businessで再開発するのではなく、

> **draw.ioを図の編集・描画エンジンとして利用し、md-businessが文書・AI・Git・ファイル管理・プレビューを統合する**

方向を第一候補とする。

### 役割分担

``` text
md-business
    │
    ├─ Markdown管理
    ├─ TSV / データ管理
    ├─ HTML
    ├─ Git
    ├─ MCP / AI Agent
    ├─ プレビュー
    └─ draw.io連携
          │
          ├─ 図生成
          ├─ 図編集
          ├─ SVG表示
          └─ .drawio保存
```

------------------------------------------------------------------------

## 5. 理想UX

### 5.1 開いている資料から図を作る

ユーザーが `system-design.md` を開いている。

依頼：

> これを構成図にして

md-business側は「これ」が現在開いているファイルであることを理解する。

``` text
system-design.md
       ↓
   AI Agent
       ↓
 draw.io生成
       ↓
プレビュー領域へ表示
```

ユーザーがファイル内容をコピーしてAIへ渡す必要をなくす。

------------------------------------------------------------------------

## 6. 選択範囲から図を作る

Markdownの一部分を選択。

> ここだけフロー図にして

すると選択範囲をコンテキストとして図を生成。

同様に：

-   選択範囲 → フローチャート
-   選択範囲 → シーケンス図
-   選択範囲 → マインドマップ
-   選択範囲 → 業務フロー
-   選択範囲 → UML

などを可能にする。

------------------------------------------------------------------------

## 7. TSV / DB資料との連携

例：

``` text
database.tsv
     ↓
「ER図にして」
     ↓
AI
     ↓
database.drawio.svg
```

md-businessが持つTSVとの連携は特に重要。

将来的には：

-   DB定義TSV → ER図
-   API一覧TSV → API構成図
-   タスクTSV → ワークフロー
-   組織データ → 組織図
-   スケジュール → フロー / ガント的表現

なども検討できる。

------------------------------------------------------------------------

## 8. ソースコードから図を作る

md-businessがGitリポジトリを扱う場合、

> 実装を読んで現在の構成図を作って

という依頼を可能にする。

``` text
Repository
 ├─ source
 ├─ config
 ├─ database
 ├─ API
 └─ README
       ↓
   AI Agent
       ↓
architecture.drawio.svg
```

設計書ではなく、**実装を正として現状図を生成する**使い方も可能。

------------------------------------------------------------------------

## 9. 図から文書へ逆方向に同期

重要な将来機能。

人間がGUI上で構成図を変更した場合：

``` text
[Web]
  ↓
[API]
  ↓
[MariaDB]
```

にRedisを追加。

``` text
[Web]
  ↓
[API]
  ↓
[Redis]
  ↓
[MariaDB]
```

AIが差分を検知。

> 構成図にRedisが追加されていますが、system-design.mdには記載がありません。仕様書も更新しますか？

と提案できる。

つまり、

``` text
文書 → 図
```

だけでなく、

``` text
図 → 文書
```

も扱う。

------------------------------------------------------------------------

## 10. Markdownへの埋め込み

候補として `.drawio.svg` を検討する。

例：

``` markdown
## システム構成

![システム構成](./diagrams/architecture.drawio.svg)
```

通常のMarkdownプレビューではSVGとして表示。

クリックするとdraw.io編集画面へ遷移。

``` text
Markdown Preview
      ↓ click
draw.io Editor
      ↓ save
.drawio.svg更新
      ↓
Markdown Preview即時更新
```

表示用画像と編集可能ファイルを極力分離しないUXを目指す。

------------------------------------------------------------------------

## 11. md-business内へのdraw.io Editor埋め込み

可能であればiframe / integration方式等を利用して、

**md-businessから外部サイトへ移動せず編集できる状態**

を目標とする。

イメージ：

``` text
┌────────────────────────────────────────────┐
│ md-business                                │
├──────────┬─────────────────────────────────┤
│ Files    │ architecture.drawio.svg         │
│          │                                 │
│ README   │  ┌───────────────────────────┐  │
│ API      │  │                           │  │
│ DB       │  │      draw.io Editor       │  │
│ Diagram  │  │                           │  │
│          │  └───────────────────────────┘  │
├──────────┴─────────────────────────────────┤
│ AI: 「認証部分だけ詳細化して」              │
└────────────────────────────────────────────┘
```

------------------------------------------------------------------------

## 12. AIとGUIの往復編集

この統合の重要ポイント。

### AI → GUI

> この仕様から構成図を作って

AIが生成。

### GUI → AI

人間が箱を移動、追加、削除。

> ここを整理して

AIが再編集。

### AI → GUI → AI

``` text
AI生成
 ↓
人間が微修正
 ↓
AIが続きを編集
 ↓
Git保存
```

画像生成AIとは異なり、**編集可能な構造化された図を維持する**ことに価値がある。

------------------------------------------------------------------------

## 13. Mermaidとの棲み分け

draw.io導入後もMermaidは残す。

### Mermaid

向いている用途：

-   小規模な図
-   Markdown内に直接記述
-   AI生成
-   Git差分
-   Diagram as Code

### draw.io

向いている用途：

-   大規模な図
-   自由配置
-   高度なレイアウト
-   人間によるGUI微調整
-   クラウド / ネットワーク等のアイコン
-   プレゼン資料レベルの図

構造：

``` text
md-business
 ├─ Markdown
 ├─ TSV
 ├─ HTML
 ├─ Mermaid
 └─ draw.io
```

両者を競合させず用途で使い分ける。

------------------------------------------------------------------------

## 14. draw.ioのShape資産

draw.ioが持つ大量のShape / Stencilを活用できることは大きな利点。

例：

-   AWS
-   Azure
-   Google Cloud
-   Kubernetes
-   Cisco
-   UML
-   BPMN
-   Network
-   Database
-   UI

AIが必要なShapeを選択して図を構築できれば、単純な四角形だけのAI生成図より実用的になる。

------------------------------------------------------------------------

## 15. Gitとの統合

md-businessの既存思想との親和性が高い。

``` text
diagrams/
 ├─ architecture.drawio
 ├─ database.drawio
 ├─ auth-flow.drawio
 └─ network.drawio
```

または、

``` text
diagrams/
 ├─ architecture.drawio.svg
 ├─ database.drawio.svg
 └─ auth-flow.drawio.svg
```

としてGit管理。

AI操作についても、

-   何を変更したか
-   誰が変更したか
-   AIが変更したか
-   人間が変更したか
-   変更前後
-   使用した指示

を作業ログへ残す。

------------------------------------------------------------------------

## 16. MCPとの統合イメージ

md-business MCP側から図操作を提供する案。

概念的な操作：

``` text
diagram.create
diagram.open
diagram.update
diagram.export
diagram.render
diagram.validate
diagram.list
diagram.describe
```

自然言語では：

-   「図を作って」
-   「この図を開いて」
-   「DB部分を変更して」
-   「PNGで出して」
-   「SVGで出して」
-   「この図の内容を説明して」
-   「仕様書との差分を確認して」

など。

実際のMCP設計ではdraw.io公式MCPを再利用・ラップできる範囲を調査する。

------------------------------------------------------------------------

## 17. ゼロ構築について

### 現時点の仮判断

draw.io相当の図形エディタをゼロから作る優先度は低い。

再実装対象が巨大になるため。

-   Canvas
-   Shapes
-   Connectors
-   Snap
-   Grid
-   Layers
-   Group
-   Undo / Redo
-   Zoom
-   Styling
-   SVG
-   PNG
-   XML
-   Templates
-   Stencils
-   Import / Export

これらはmd-business独自価値ではない。

### ゼロ構築する可能性がある領域

一方、

**AIが理解・操作しやすいSemantic Diagram**

には将来的な独自価値がある可能性がある。

例：

``` yaml
type: architecture

nodes:
  - id: web
    type: service
    label: Web App

  - id: api
    type: service
    label: API

  - id: db
    type: database
    label: MariaDB

edges:
  - from: web
    to: api

  - from: api
    to: db
```

これを正本として、

``` text
Semantic Diagram
      │
      ├─ Mermaid
      ├─ draw.io
      ├─ SVG
      ├─ PNG
      └─ HTML
```

へ出力する構想。

ただし初期段階では実装しない。

draw.io XML / Mermaidでどこまで十分かを先に検証する。

------------------------------------------------------------------------

## 18. draw.io依存をどう考えるか

初期段階ではdraw.ioを積極利用する。

ただしmd-business全体をdraw.io専用設計にはしない。

抽象化イメージ：

``` text
md-business Diagram Layer
           │
    ┌──────┼─────────┐
    ↓      ↓         ↓
 Mermaid  draw.io   将来形式
```

将来的に別エディタや独自Canvasへ切り替えられる余地を残す。

------------------------------------------------------------------------

## 19. 想定ディレクトリ

``` text
project/
│
├─ README.md
├─ requirements.md
├─ system-design.md
│
├─ data/
│   ├─ database.tsv
│   └─ api.tsv
│
├─ diagrams/
│   ├─ architecture.drawio.svg
│   ├─ database.drawio.svg
│   ├─ auth-flow.drawio.svg
│   └─ business-flow.drawio.svg
│
├─ assets/
│   └─ images/
│
└─ index.html
```

md-businessではこれらを同じWorkspaceとして扱う。

------------------------------------------------------------------------

## 20. UX上の最終イメージ

重要なのは「draw.io機能」をユーザーへ押し出すことではない。

ユーザー操作：

> これ図にして

> このDBをER図にして

> ここ分かりにくいから整理して

> AWSの構成図にして

> この図と実装が合ってるか確認して

> Redisを追加した構成に直して

これだけ。

内部では：

``` text
現在のWorkspace
      ↓
Context取得
      ↓
AI Agent
      ↓
draw.io MCP
      ↓
編集可能な図
      ↓
md-business Preview
      ↓
Git
```

となる。

------------------------------------------------------------------------

## 21. md-businessに追加する価値

この機能を入れた場合、md-businessの対象は単なるMarkdown管理から拡張される。

``` text
文章
 +
表
 +
図
 +
Web
 +
画像
 +
Git
 +
AI
```

を同じWorkspaceで扱える。

特に重要なのは、

> **AIが文書・表・図を別々の成果物ではなく、一つのプロジェクトの情報として横断的に理解・更新する**

こと。

これはdraw.io単体を組み込むこと自体より重要な価値になる。

------------------------------------------------------------------------

## 22. 仮フェーズ

### Phase 0 --- 技術検証

-   draw.ioライセンス再確認
-   draw.io Integration調査
-   draw.io MCP調査
-   Claude Code / Codexで実際に図生成
-   `.drawio`
-   `.drawio.svg`
-   SVG内XML
-   iframe埋め込み
-   ローカル保存
-   Git差分

を検証。

### Phase 1 --- 表示

-   md-businessでMermaid表示
-   `.drawio.svg`プレビュー
-   ファイルツリー対応

### Phase 2 --- 編集

-   draw.io Editor埋め込み
-   開く
-   編集
-   保存
-   即時プレビュー

### Phase 3 --- AI生成

-   現在開いているMarkdown → 図
-   選択範囲 → 図
-   TSV → ER図
-   Repository → 構成図

### Phase 4 --- AI編集

-   既存図をAI修正
-   部分変更
-   Shape検索
-   レイアウト調整
-   Git差分

### Phase 5 --- 相互同期

-   図 → Markdown
-   Markdown → 図
-   TSV → 図
-   ソース → 図
-   不整合検知

### Phase 6 --- 必要ならSemantic Diagram

既存形式ではAI/Git連携に限界があると判明した場合のみ独自中間形式を検討。

------------------------------------------------------------------------

## 23. 現時点の仮結論

**draw.io対抗ソフトをゼロから作ることは現時点では目的にしない。**

まず、

> draw.ioの成熟したGUI・Shape・MCP・OSS資産を利用し、md-business側で「現在の資料・データ・ソースコード・Git・AI」と接続する

ことを検証する。

md-business独自価値は作図エンジンそのものではなく、

> **「今見ているものを図にする」「図から資料を直す」「AIと人間が同じ図を往復編集する」**

というWorkspace体験に置く。

------------------------------------------------------------------------

## 24. 未検討・思い出したら追記する項目

今回、このdraw.io案とは別にもう一つ関連するアイデアが浮かんでいたが、会話中に失念したため未記載。

思い出した時点で、このセクションまたは別企画として追記する。

### TODO

-   [ ] 忘れたもう一つのアイデアを追記
-   [ ] draw.io MCPを実機で再検証
-   [ ] 過去にAIへどのような指示でdraw.io図を生成したか確認
-   [ ] md-businessへのiframe埋め込みPoC
-   [ ] `.drawio` と `.drawio.svg` のどちらを正本にするか比較
-   [ ] Git差分の可読性を確認
-   [ ] Claude Code / Codex / Geminiからの操作方法を比較
-   [ ] draw.io公式MCPをそのまま利用するかmd-business
    MCPでラップするか検討
-   [ ] オフライン / ローカル完結構成を確認
-   [ ] 商標・配布時の表示要件を確認

------------------------------------------------------------------------

## 25. キーワード

`md-business`\
`draw.io`\
`diagrams.net`\
`MCP`\
`Claude Code`\
`Codex`\
`Mermaid`\
`Diagram as Code`\
`AI-native diagram`\
`Git`\
`.drawio`\
`.drawio.svg`\
`ER図`\
`システム構成図`\
`フローチャート`\
`Semantic Diagram`\
`Workspace`
