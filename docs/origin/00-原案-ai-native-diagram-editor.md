# AIネイティブ構成図エディター — OSS企画草案

> md-business 姉妹プロジェクト / Desktop-first / Local-first / AI-first

## 1. 企画概要

PowerPoint・Google Slides・draw.ioなどで作られてきた、**サーバー構成図・ネットワーク構成図・クラウド構成図・システム構成図**を、AIとの共同編集を前提としてゼロから再設計するOSSデスクトップアプリ。

従来の「人間が白紙から図形を並べる作図ソフト」ではなく、

**AIが90%作図 → 人間がGUIで10%微調整 → AIが再編集**

というワークフローを中心に据える。

md-businessとは姉妹プロジェクトとし、単体でも利用できる独立OSSとして開発する。

---

## 2. 背景・課題

### 2.1 既存ツールの問題

#### draw.io / diagrams.net

- 非常に高機能で成熟している
- 汎用作図ツールであり、今回の用途には機能過多
- XMLが正本で、AI・Git・人間による差分レビューには冗長
- AIが小さな変更を行う場合でも低レベルなXML操作になりやすい
- Web由来のアーキテクチャで、ローカルAIとの密結合を前提としていない

#### PowerPoint / Google Slides

- 構成図を自由に描ける
- プレゼン資料の一部としては便利
- 図そのものの意味構造を正本として扱いにくい
- AIによる継続的・構造的な編集に向いていない
- Git管理に向かない

#### Mermaid

- AI・Markdown・Gitとの相性が非常に良い
- ER図やフロー図などには有効
- 一方、顧客提出資料やPowerPointに載せるような「見栄えの良い構成図」では表現力・微調整能力が不足する

### 2.2 狙う空白

```text
Mermaid
  │  軽量 / Diagram as Code
  │
  ▼
本プロジェクト
  │  AIネイティブ / GUI微調整 / 高品質構成図
  │
  ▼
draw.io
     超高機能 / 汎用作図
```

本プロジェクトは、この中間領域を狙う。

---

## 3. プロダクト原則

### 3.1 AI First

白紙から人間が大量の図形を配置することを主目的にしない。

ユーザーは例えば次のように依頼する。

- 「このシステムの構成図を作って」
- 「Webサーバーを2台にしてLBを追加」
- 「AWS構成図として整理して」
- 「この部分を冗長化して」
- 「顧客説明用にもう少し簡単にして」

AIが構造を変更し、Editorが即時反映する。

### 3.2 Human Editable

AIの出力を人間が直接修正できる。

- Drag
- Resize
- Connect
- Label変更
- 複数選択
- Align
- Distribute
- Group
- 色・線・強調変更
- Undo / Redo

GUIで修正した内容もAIが次の指示で理解できる。

### 3.3 Local First

- デスクトップアプリ
- 図データはローカル保存
- ローカルAIとの連携を第一級機能とする
- Webサービスを経由しなくても利用可能
- 外部AI APIは任意

### 3.4 Text as Source of Truth

SVG、PNG、XMLを正本にしない。

人間・AI・Gitのすべてが扱いやすいテキスト形式を正本とする。

### 3.5 Rendererとデータを分離

```text
Semantic Diagram
       ↓
Layout Engine
       ↓
Renderer
       ↓
SVG / PNG / Preview
```

見た目は生成物であり、意味構造を正本とする。

---

## 4. 主な対象図

初期版では対象を意図的に限定する。

### 最優先

- システム構成図
- サーバー構成図
- ネットワーク構成図
- クラウド構成図
- インフラ構成図
- アプリケーション構成図

### 次段階

- データフロー図
- デプロイ構成図
- 簡易ER図
- サービス依存図
- CI/CD構成図
- Kubernetes構成図

### 当面対象外

- 本格BPMN
- 電気回路図
- 建築図面
- CAD
- 自由描画・イラスト
- Visio完全互換
- draw.io完全互換

「何でも描ける」を目標にしない。

---

## 5. Semantic Diagram Format

仮拡張子：

```text
.diagram.yaml
```

JSON対応も検討するが、人間による可読性を考えてYAMLを第一候補とする。

### 5.1 例

```yaml
version: 1

title: Production Architecture

theme: technical
layout:
  direction: top-to-bottom

nodes:
  - id: internet
    type: internet
    label: Internet

  - id: lb
    type: load-balancer
    label: Load Balancer

  - id: web01
    type: server
    label: Web 01
    technology: Apache

  - id: web02
    type: server
    label: Web 02
    technology: Apache

  - id: db
    type: database
    label: MariaDB

edges:
  - from: internet
    to: lb
    protocol: HTTPS

  - from: lb
    to: web01

  - from: lb
    to: web02

  - from: web01
    to: db

  - from: web02
    to: db
```

### 5.2 人間による位置調整

必要に応じて位置を保持する。

```yaml
position:
  x: 620
  y: 410
```

ただし、低レベルな描画属性を大量に正本へ入れない。

### 5.3 Semantic Style

```yaml
appearance:
  emphasis: primary
  size: medium
  variant: production
```

rendererが具体的な色・stroke・font等へ変換する。

これによりAIは「意味」を編集し、SVG実装詳細を意識しなくてよい。

---

## 6. AI編集モデル

AIはCanvasをマウス操作しない。

```text
User Prompt
    ↓
AI Agent
    ↓
Semantic Diagram更新
    ↓
Validation
    ↓
Auto Layout
    ↓
Render
    ↓
即時Preview
```

例：

> 「DBの前にProxySQLを追加して」

AIが行う変更は、基本的に1ノード追加＋edge変更だけで済む。

これを本プロジェクトの最大の技術的特徴とする。

---

## 7. GUI Editor

### 7.1 基本UI

```text
┌────────────────────────────────────────────────────┐
│ File  Edit  View                         Export     │
├──────────┬──────────────────────────────┬───────────┤
│ Shapes   │                              │ Property  │
│          │          Canvas              │           │
│ Server   │                              │ Label     │
│ DB       │                              │ Type      │
│ Network  │                              │ Style     │
│ Cloud    │                              │           │
│ User     │                              │           │
├──────────┴──────────────────────────────┴───────────┤
│ AI:「この構成を冗長化して」              [ Run ]   │
└────────────────────────────────────────────────────┘
```

### 7.2 v0必須操作

- ノード追加
- ノード削除
- Drag
- Resize
- Edge接続
- Label編集
- 複数選択
- Copy / Paste
- Undo / Redo
- Zoom / Pan
- Align
- Distribute
- Group
- Auto Layout

### 7.3 AI選択編集

GUI選択状態をAIへ渡す。

例：Web Server 2台を選択して、

> 「この2台をAuto Scaling Groupとして囲って」

AIには以下を渡す。

```text
Current Diagram
+ Selected Node IDs
+ User Prompt
```

自然言語とGUI選択を組み合わせる。

---

## 8. Shape Library

### Generic

- Server
- Database
- Storage
- Load Balancer
- Firewall
- Router
- Switch
- Internet / Cloud
- Client
- User
- API
- Queue
- Cache
- Container
- Cluster
- Network

### Cloud

ライセンス条件を確認した上で公式アイコン等を利用する。

- AWS
- Microsoft Azure
- Google Cloud
- Cloudflare
- Docker
- Kubernetes

ShapeはPlugin/Packageとして追加可能な設計を検討する。

---

## 9. Layout Engine

見栄えの品質を左右する最重要コンポーネント。

ゼロからGraph Layout Algorithmを実装せず、既存OSS利用を前提に比較検証する。

候補：

- ELK.js
- Dagre
- その他Graph Layout Engine

必要なレイアウト：

- Top → Bottom
- Left → Right
- Tree
- Layered
- Cluster
- Grid

AIには原則として細かな座標を計算させず、意味構造とlayout hintを生成させる。

---

## 10. Renderer

第一候補：SVG。

理由：

- 高解像度
- PowerPoint等へ貼り付けやすい
- Markdown/HTMLに直接埋め込み可能
- DOMとして編集可能
- PNGへの変換が容易
- 印刷品質を維持しやすい

Canvas/WebGLは、大規模図で性能問題が発生した場合に検討する。

---

## 11. Export

### MVP

- SVG
- PNG
- `.diagram.yaml`

### 将来

- PDF
- Mermaid
- draw.io XML
- PowerPoint向けSVG/PNG
- HTML embed

特にdraw.ioは競合としてだけでなく、**高度編集が必要になった場合のExport先**として利用できる。

```text
.diagram.yaml
     ↓
 draw.io Exporter
     ↓
.drawio
```

---

## 12. Mermaidとの関係

Mermaidを置き換えるものではない。

### Mermaid

- Markdown直書き
- 高速
- 軽量
- Git差分が優秀
- ER/Flow/Sequence等

### 本プロジェクト

- プレゼン品質
- サーバー/ネットワーク/クラウド構成図
- GUI微調整
- AIとの共同編集

相互変換可能な範囲ではImport/Exportを検討する。

---

## 13. md-business連携

姉妹プロジェクトとして密接に連携するが、依存は分離する。

### 単体

```text
Diagram Desktop App
        ↓
*.diagram.yaml
```

### md-business

```text
md-business
    ↓
「ここに本番環境の構成図を入れて」
    ↓
Diagram Engine / CLI / MCP
    ↓
system.diagram.yaml
    ↓
system.svg
    ↓
Markdownへ自動挿入
```

ユーザーが別アプリを操作する必要をなくす。

図をクリックした場合のみ姉妹Editorで詳細編集できる。

---

## 14. MCP / Agent Interface

MCPは後付けではなく、初期設計から考慮する。

想定Tool：

```text
diagram.create
diagram.read
diagram.update
diagram.add_node
diagram.remove_node
diagram.add_edge
diagram.remove_edge
diagram.layout
diagram.render
diagram.export
diagram.validate
diagram.describe
```

ただしAIがファイルへ安全に直接アクセスできる環境では、MCPを必須にしない。

CLIも提供する。

```bash
diagram render architecture.diagram.yaml
diagram export architecture.diagram.yaml --format svg
diagram validate architecture.diagram.yaml
```

これによりClaude Code、Codex、Gemini CLI等からも扱いやすくする。

---

## 15. Git First

Semantic Diagram FormatをGit管理する。

例えば、

```diff
+ - id: redis
+   type: cache
+   label: Redis
```

のように、レビュー時に変更内容を人間が理解できることを重視する。

生成SVG/PNGは設定によりGit管理対象外にもできる。

---

## 16. Desktop技術候補

md-businessとの技術共有を考え、Tauriを第一候補とする。

```text
Tauri
├ Rust backend
├ WebView frontend
├ Semantic Diagram Parser
├ Layout Engine
├ SVG Renderer
├ Local File Access
├ AI Adapter
└ MCP / CLI
```

フロントエンドフレームワークは実装時に選定。

重要なのは特定UI frameworkではなく、Diagram EngineをUIから独立させること。

---

## 17. Core Architecture

```text
                  ┌────────────────┐
                  │      GUI       │
                  └───────┬────────┘
                          │
                          ▼
┌───────────┐     ┌────────────────┐
│ AI Agent  │────▶│ Diagram Model  │◀──── CLI / MCP
└───────────┘     └───────┬────────┘
                          │
                 ┌────────┴─────────┐
                 ▼                  ▼
          ┌─────────────┐    ┌─────────────┐
          │ Validator   │    │ Layout      │
          └─────────────┘    └──────┬──────┘
                                    ▼
                             ┌─────────────┐
                             │ SVG Renderer│
                             └──────┬──────┘
                                    ▼
                              SVG / PNG
```

Diagram Modelを中心に据える。

---

## 18. AI Provider設計

特定AIベンダーへ依存しない。

候補：

- Claude Code
- OpenAI Codex
- Gemini CLI
- Ollama等ローカルLLM
- OpenAI互換API

AI Adapterを分離する。

また、AIを使わなくてもGUI Editorとして利用可能にする。

---

## 19. MVP

### Phase 0 — Format PoC

最優先。

- `.diagram.yaml`仕様
- Node / Edge / Group
- Semantic Style
- Position
- Layout Hint
- Validator

まずGUIを作らず、YAML → SVGが成立するか確認する。

### Phase 1 — Renderer

- YAML Parser
- ELK.js等によるAuto Layout
- SVG Renderer
- Generic Shape 10〜20種
- SVG Export

### Phase 2 — Minimal Editor

- Desktop App
- Select
- Drag
- Resize
- Connect
- Text編集
- Delete
- Undo / Redo
- Zoom / Pan
- Save

### Phase 3 — AI

- Prompt → Diagram生成
- 既存Diagram変更
- 選択ノード＋Prompt
- Validation / Repair
- Auto Layout

### Phase 4 — Professional Diagram

- AWS/GCP/Azure等Shape
- Group / Network / Subnet
- Align / Distribute
- Themes
- PNG/PDF Export

### Phase 5 — md-business

- CLI
- MCP
- md-businessから生成
- Markdown自動挿入
- Diagram click → Editor

### Phase 6 — Ecosystem

- Shape Package
- Theme Package
- Import / Export Adapter
- Mermaid Adapter
- draw.io Adapter

---

## 20. やらないこと

初期開発を守るため明文化する。

- draw.ioクローンを作らない
- PowerPointを作らない
- Figmaを作らない
- CADを作らない
- ホワイトボードアプリを作らない
- 全Diagram規格に対応しない
- 人間向け機能を無制限に増やさない
- AIにCanvasをGUI操作させない
- SVGを正本にしない
- XMLを正本にしない

---

## 21. draw.ioから学ぶもの

Forkではなく、成熟した作図UXの参考対象とする。

参考にする領域：

- Connector UX
- Snap
- Alignment
- Selection
- Resize Handle
- Group
- Shape Library
- Keyboard Shortcut
- Zoom / Pan
- Property Panel
- Export UX

一方、データモデル・AI統合・Git管理についてはAI時代向けに再設計する。

---

## 22. 差別化

本プロジェクトの価値は「draw.ioより図形が多い」ことではない。

### 主要な差別化

1. AIが正本データを直接、安全に編集できる
2. 人間にも読めるSemantic Diagram Format
3. Git差分が意味のある形で残る
4. Local-first Desktop
5. GUI選択 + 自然言語編集
6. Auto Layout前提
7. PowerPoint品質の構成図に用途を集中
8. CLI / MCP / Agentから第一級操作
9. Markdown/OSS開発環境との親和性
10. md-businessとのシームレスな連携

---

## 23. OSSとしての位置付け

単なるmd-business内部機能にはしない。

独立OSSにすることで、

- Markdown Editor
- IDE
- AI Agent
- Documentation Tool
- Wiki
- Static Site Generator
- GitHub Repository
- 社内ドキュメント基盤

などから利用できるDiagram Engineを目指す。

Editorはその公式Desktop Clientという位置付けにする。

```text
OSS Diagram Engine
├ Desktop Editor
├ CLI
├ MCP Server
├ Renderer
├ Format Specification
└ SDK

        ▲
        │
    md-business
```

---

## 24. 仮リポジトリ構成

```text
project/
├ apps/
│  └ desktop/
├ packages/
│  ├ core/
│  ├ schema/
│  ├ layout/
│  ├ renderer-svg/
│  ├ shapes-generic/
│  ├ ai/
│  ├ mcp/
│  └ cli/
├ adapters/
│  ├ mermaid/
│  └ drawio/
├ examples/
├ docs/
└ README.md
```

---

## 25. 名前について

名称は別途決定する。

方向性としては、draw.ioのような「作図ソフト名」よりも、

**AIと人間が共同で構造を描く**

ことが伝わる名称が望ましい。

md-businessの姉妹OSSであることはREADMEや公式サイト上で示すが、単独利用しやすい名称にする。

---

## 26. 最初に検証すべき技術課題

実装開始前に以下をPoCする。

1. Semantic YAML → ELK.js → SVGで十分綺麗な構成図になるか
2. 人間がノード位置を微調整した後、Auto Layoutと共存できるか
3. Connector routingの品質
4. Group/VPC/Subnet等のnested layout
5. 100〜500ノード程度での性能
6. AIによる部分変更時に既存レイアウトをどこまで維持できるか
7. SVGをPowerPoint/Google Slidesへ持ち込んだ際の品質
8. Shape/iconのライセンスと配布方法
9. YAMLのコメント・順序をGUI保存時に維持できるか
10. Git merge conflictをどこまで抑えられるか

特に **1・2・6** が成立するかを最初に確認する。

---

## 27. 成功条件

ユーザーが次の操作をできれば成功とする。

```text
「このリポジトリの本番構成図作って」
            ↓
       数秒で図が出る
            ↓
      DBを少し右へDrag
            ↓
「Redis追加してキャッシュ経路を描いて」
            ↓
       図が更新される
            ↓
          Export
```

人間が図形ツールの操作方法を考える時間を極小化する。

---

## 28. プロジェクトの一文定義

> **AIが描き、人間が直し、またAIが理解できる。サーバー・ネットワーク・クラウド構成図に特化したLocal-first OSSデスクトップエディター。**

---

## 29. 現時点の開発判断

- draw.io Fork：しない
- draw.io XMLを正本：しない
- 新規OSS：作る
- Desktop-first：採用
- Local-first：採用
- Semantic text format：採用
- SVG Renderer：第一候補
- 既存Layout Engine：積極利用
- AI-first：プロジェクトの中核
- GUI：AI生成物の修正に必要な範囲から開始
- md-business：姉妹プロジェクトとして連携
- Mermaid：競合ではなく補完
- draw.io：将来的なImport/Export先およびUX参考対象

