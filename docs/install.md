# 別の機械で使う

> **いまはアルファ。clone して入れてもらう。**
> 署名された配布物（`.dmg` / `.msi`）を作る仕組みは置いてあるが、
> **試験導入の前に署名の手続きと費用を払う必要はない。**
> 中身が固まってからでよい。

**2 通りある。目的が違うので、要るほうだけ入れればよい。**

| | 何ができるか | 要るもの |
|---|---|---|
| **A. MCP サーバだけ** | **エージェントに図を描かせる**（この製品の中心） | Node 22 以上 |
| **B. デスクトップアプリ** | 図を見る・人が直す・**承認する** | 配布物（`.dmg` / `.msi`） |

**エージェントに描かせて試すだけなら A で足りる。**
GUI は承認のための窓であって、描くための入口ではない（D11 / D18）。

---

## A. MCP サーバ

### 要るもの

- **Node 22 以上**だけ。
  ネイティブ拡張を持つ依存が無いので、mac / Windows / Linux のどこでも同じに動く
- Rust は**要らない**（殻を建てないため）

### 入れる

```bash
git clone https://github.com/meta-taro/zumen.git
cd zumen
corepack enable
pnpm install --frozen-lockfile
```

**リポジトリが private の間は、アクセスできるアカウントでの clone が要る。**
できないなら、tarball を渡してもらう。

### 繋ぐ

エージェント側の設定へ、こう書く（Claude Code なら `.mcp.json`）。

```json
{
  "mcpServers": {
    "zumen": {
      "command": "node",
      "args": ["<zumen を置いた場所>/src/mcp.ts"]
    }
  }
}
```

**Windows でも道の書き方は同じでよい**（`C:\\Users\\...` でも `C:/Users/...` でも通る）。

### 動いているかを確かめる

```bash
pnpm mcp
```

何も表示されずに待つのが正しい（stdio で話す）。`Ctrl+C` で止める。

繋がったら、エージェントにこう言えば分かる。

> zumen_spec を呼んで、図の形式を教えて

### 表示を英語にする

```bash
ZUMEN_LOCALE=en pnpm mcp
```

---

## B. デスクトップアプリ

**アルファの間は、これも clone して `pnpm app` で立てるのが早い。**
Rust と、その機械の WebView が要る（[Tauri 2 の前提条件](https://v2.tauri.app/start/prerequisites/)）。

```bash
pnpm app          # 立てる
```

配布物が要るようになったら、下記。

### 配布物を作る仕組み（まだ使っていない）

**置いたが、まだ配っていない。**

`.github/workflows/release.yml` が `macos-latest` と `windows-latest` の両方を回して、
`.dmg` と `.msi` を作る。タグを打つか、Actions から手で回す。

### **署名していない**

**受け取った機械は、そのままでは開かない。**

| | 何が出るか | 開き方 |
|---|---|---|
| macOS | 「壊れているため開けません」 | アプリを**右クリック → 開く**（初回だけ） |
| Windows | 「WindowsによってPCが保護されました」 | **詳細情報 → 実行** |

これは不具合ではなく、**署名していないことの当然の結果**。
まともに配るには、

- macOS: Apple Developer Program と Developer ID 証明書、公証
- Windows: コード署名証明書

が要る。**どちらも人の手続きと費用**で、AI は代われない。
秘密情報は人が GitHub の Secrets へ入れる（名前は `release.yml` の冒頭にある）。

### 手元で配布物を作る場合

```bash
pnpm app:build
```

**1 台の機械では、その機械の分しか作れない**（Tauri はクロスビルドを実質サポートしない）。
mac と Windows の両方が要るなら CI を回す。

---

## 動かないときに見るところ

| 症状 | たいていの原因 |
|---|---|
| `pnpm mcp` が何もせずに終わる | Node が 22 未満。`node -v` を見る |
| エージェントが zumen の口を見つけられない | 設定の道が違う。**絶対の道**で書く |
| `pnpm install` が止まる | 公開直後のパッケージを 24 時間隔離している（`minimumReleaseAge`）。時間を置く |
| 図が描かれない | まず `pnpm validate <図>` を叩く。**行番号つきで理由が出る** |
