# Contributing to zumen

> **まだ土台を作っている段階です。** GUI は動きますが、
> 形式もインタフェースも変わり得ます（[`.claude/decisions.md`](.claude/decisions.md)）。

---

## この製品が守っていること（先に読んでください）

zumen が勝負しているのは 1 枚目の図ではなく、**2 枚目以降**です。

```text
文章で頼む → 図が出る → 人が 1 か所だけ直す → もう一度文章で頼む → 直した分が壊れない
```

**最後の「壊れない」が唯一の勝負どころ**で、機能を足す提案はここに効くかで判断します。

- **`pins` に書いてよいのは人だけ。** AI は書かない（[`spec/zumen-format-v1.md`](spec/zumen-format-v1.md) §3.4）
- **AI の出力は提案であって正本ではない。** 書き換わるのは人の正本のほう（D5）
- **黙って上書きしない。** ぶつかったら競合として人へ返す
- **人が触っていない行に差分を出さない。** 差分は「人が何を直したか」の記録

---

## 開発環境

必要なもの:

- Node.js 22 以上
- pnpm（`corepack enable` で有効化）
- Git

```bash
git clone https://github.com/meta-taro/zumen.git
cd zumen
corepack enable
pnpm install
```

デスクトップアプリ（`pnpm app`）を動かす場合は、加えて
[Tauri 2 の前提条件](https://v2.tauri.app/start/prerequisites/)（Rust ツールチェーンと
プラットフォームの WebView）が要ります。
**殻が無くても `pnpm dev` でブラウザで動きます。**

**npm / yarn は使いません。** pnpm だけです
（install script の許可リストと、公開直後のパッケージの隔離を効かせるため。
設定は [`pnpm-workspace.yaml`](pnpm-workspace.yaml)）。

---

## 品質ゲート

変更を入れる前に、次が通ることを確認します。

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # node --test（外部サービスへ繋がない）
pnpm gui:check   # 画面の 8 操作を実際に動かす（Chrome が要る）
```

公開リポジトリなので、**個人名・個人メールが混じっていないか**も見ます。
CI と同じものが手元で走ります。

```bash
bash .github/scripts/oss-privacy-check.sh
```

**同じものが CI でも走ります**（`.github/workflows/checks.yml`）。
手元で通らないものを CI で通そうとしないでください。逆も同じで、
**CI を無効化して進むのは禁止です。**

殻（Rust）を触ったときは、加えて次も見ます。

```bash
cd src-tauri && cargo check && cargo clippy -- -D warnings && cargo fmt --check
```

---

## 変更を出すときの約束

### テストを後回しにしない

**落ちるテストを消して通ったことにしない。** 直したなら、
同じ壊れ方を止めるテストを足してください。

数を満たすためのテストは書かなくてよいです。**意味のないテストは負債**です。

### 文言は 1 か所に集める

利用者に見える文字列は [`src/messages.ts`](src/messages.ts) にだけ置きます。
`src/` の他の場所に日本語の文字列リテラルがあると、テストが落ちます。

**日本語を直すのは歓迎します。** テストは文面を見ていないので、
`ja` を書き換えても落ちません。書き方の約束は
[`docs/specs/文言の規則.md`](docs/specs/文言の規則.md)。

### 図の色を直書きしない

色は [`src/tokens.ts`](src/tokens.ts) の 1 か所から取ります
（以前は 3 か所に複製されていて、ズレる寸前でした）。

### 決まっていることを、実装だけで覆さない

[`.claude/decisions.md`](.claude/decisions.md) に記録された決定を変えるなら、
**実装ではなく提案を出してください。** どの決定にも
「これを止めるべき条件」が書いてあります。

### 機能を足す提案について

**編集機能をそろえることは目的ではありません。**
GUI の操作は 8 つに限ってあり、すべて「AI の書き換えを人が承認できる」ことに
紐づいています（[`docs/specs/005-承認のための最小GUI.md`](docs/specs/005-承認のための最小GUI.md)）。

足したい操作があるときは、**`pnpm measure` の数字が改善するか**で判断します
（[`docs/specs/003-9割の定義.md`](docs/specs/003-9割の定義.md)）。
改善しない機能は、この製品の機能ではありません。

---

## 公開リポジトリでの書き方

- **役割で書きます**（メンテナ / 利用者 / 貢献者）。役職名や個人名を書きません
- 個人メールアドレスを commit に残しません。clone した直後に 1 回、

```bash
git config user.email "<GitHub の noreply メール>"
git config user.name  "<GitHub アカウント名>"
```

**これを飛ばすと、1 個目の commit から個人メールが history に焼き付きます。**
history に入ったものは、書き換えても完全には消えません。

---

## 何から手をつけるか

やることは [`.claude/issues/`](.claude/issues/) にあります。
それぞれ「目的 / 決めること / 完了条件 / 注意」が書いてあり、
**注意に書いてあることは、たいてい一度失敗したことです。**
