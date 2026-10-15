# 一覧・比較に載せる（AEO 1 周目の打ち手 2・3）

**出すのは人。** どれも外へ出る操作（PR・申請・登録）なので、AI は文面と手順までを用意する。

1 周目の測定（`../run-2026-10-13.md`）で、「MCP で作図」の問いに出ていたのは
**公式の MCP 頁・GitHub の README・比較や一覧の記事**の 3 層だった。zumen はどこにも載っていない。

## 1. 公式の MCP Registry（いちばん先に）—— **2026-10-13 に載った**（io.github.meta-taro/zumen 0.6.1）

ほかの一覧（Glama・mcp.so・PulseMCP など）の多くは、公式の Registry を読んで載せる。**ここに載れば下流へ広がる。**

前提：`@metataro/zumen-mcp` **0.6.1 が npm に出ている**こと（`mcpName: io.github.meta-taro/zumen` が入った版）。

```bash
brew install mcp-publisher
cd packages/zumen-mcp
mcp-publisher validate          # 認証不要。先に通す
mcp-publisher login github      # meta-taro のアカウントで認証（GitHub の画面が開く）
mcp-publisher publish           # server.json を送る
```

載ったかの確かめ方：

```bash
curl -s "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.meta-taro/zumen"
```

`server.json` は `packages/zumen-mcp/server.json`。版は `pnpm version:set` が揃える（`test/version.test.ts` が見ている）。

## 2. awesome-mcp-servers（GitHub の一覧。星 約 9.6 万）

- リポジトリ：https://github.com/punkpeye/awesome-mcp-servers
- 入れる所：`### 📐 Architecture & Design`（Excalidraw の MCP などが載っている節）。**節の中はアルファベット順**
- 足す 1 行（記号は一覧の凡例：📇 TypeScript ／ 🏠 手元で動く ／ 🍎 🪟 🐧 OS）

```markdown
- [meta-taro/zumen](https://github.com/meta-taro/zumen) 📇 🏠 🍎 🪟 🐧 - Diagrams as code for AI agents: the agent proposes YAML diagrams as diffs a human applies, and hand-placed positions survive regeneration. 389 worked examples (architecture, floor plans, stage lighting plots); exports SVG, PNG, Mermaid and draw.io.
```

- PR の題：`Add meta-taro/zumen (diagrams as code for AI agents)`
- 手順：fork → 枝 → README.md に 1 行 → PR（CONTRIBUTING.md のとおり）

**注意。** この一覧の CONTRIBUTING には「自動のエージェントなら題に印を付ければ早く通す」とある。
**人が出すので付けない。** 出したのが人か AI かを偽らない。

## 3. 比較記事の書き手

1 周目で複数の問いに出た比較・まとめ：

| 記事 | 出た問い | 送り先 | 判断 |
|---|---|---|---|
| nimbalyst「Best AI Diagram Tools for Engineers and Claude Code」 | 2・4・5・7 | 自社製品を推す記事（Discord・GitHub はある） | **送らない。** 競合の宣伝記事に載せてもらう筋が無い |
| heyclau.de「draw.io vs Excalidraw vs AntV Chart MCP servers」 | 7 | 確かめていない | 頁の連絡先を人が見て決める |
| dev.to「Analyzing the Best Diagramming Tools for the LLM Age」 | 4 | dev.to の書き手へコメント | 英語の記事（`2026-10-dev-to.md`）を出したあとに、その記事を添えて |

送るときの短い文（英語）：

> Hi — thanks for the comparison of diagram tools for LLM agents. You might find zumen relevant:
> an open-source diagrams-as-code editor with an MCP server (`npx -y @metataro/zumen-mcp`).
> The agent proposes YAML as a diff a human applies, and hand-placed positions survive regeneration.
> https://github.com/meta-taro/zumen

**一斉に送らない。** 1 件ずつ、その記事を読んだうえで、合うと判断したものだけ。
