# 依頼 — md-business に ```` ```zumen ```` の囲みを足す

- 宛先: **md-business を開発しているエージェント／担当者**
- 出どころ: zumen（別リポジトリ）。Issue 012 / 決定 D4
- **これは依頼であって PR ではない。** zumen 側から md-business へは commit しない
- zumen 側の準備は済んでいる。**足りないのは md-business 側の 1 か所だけ**

---

## 1. 何をしたいか

md-business の Markdown 本文に、こう書けるようにしたい。

````markdown
## 本番環境

```zumen
version: 1
title: 本番構成
nodes:
  - id: lb
    type: load-balancer
    label: Load Balancer
  - id: web01
    type: server
    label: Web 01
edges:
  - from: lb
    to: web01
```
````

これがプレビュー・PDF・HTML 書き出しの**3 経路すべてで図になる**。

**図は md-business の本文に埋まって初めて着地する**（zumen の D4）。
zumen が単体で図を出せても、貼る手作業が残るなら、図はまた腐る。

---

## 2. 既にある作りに、そのまま乗る形にしてある

md-business には `chart` の囲みが既にある。**同じ形にするだけ**で足りる。

| 段 | `chart` の場合 | `zumen` の場合（作ってほしいもの） |
|---|---|---|
| 拾う | `lib/markdown/fencedBlocks` | **同じものを使う**（`collectFencedBlocks(source, 'zumen')`） |
| 名前を付ける | `lib/chart/chartBlocks.ts` | `lib/zumen/zumenBlocks.ts` |
| 描く | `lib/chart/loadCharts.ts` | `lib/zumen/loadZumen.ts` |
| 仕上げに差し込む | `lib/preview/composeSource.ts` | **同じ場所に 1 行足す** |

**新しい作法を持ち込まない。** zumen 側は既に md-business の規則に合わせてある。

- 囲みの拾い方は `fencedBlocks.ts` と**同じ規則**にしてある
  （囲みの中の囲みは見本／同じ囲みは 1 回だけ／3 個以上の記号と `~` も囲み／言語名の後ろの空白）
- **差し替えは本文の段階で行う。** 後から画面へ挿すと、
  画面には出るのに書き出すと消える（`composeSource.ts` 冒頭のコメントと同じ理由）
- **描けなかったときは理由をその位置に出し、書いた指定もそのまま残す**
  （`loadData.ts` と同じ作法）。黙って空にすると、書いた人は気づかない

---

## 3. zumen 側の口

**呼ぶ口は 1 つだけ。**

```ts
toSvg(zumenSource: string): Promise<string>
```

`src/embed.ts` にある。SVG の文字列が返る。

囲みの拾い出しと差し替えも、必要なら zumen 側のものを使える
（`collectZumenBlocks` / `replaceZumenBlocks` / `renderZumenBlocks`）が、
**md-business 側の `fencedBlocks` を使うほうがよい。** 拾い方が 2 つに割れないため。

書き出した SVG は、貼り先で崩れないように機能を狭めてある（zumen の Issue 007）。
`<style>` / `foreignObject` / グラデーション / `dominant-baseline` を使わず、
すべての文字に `font-family` を持つ。

---

## 4. **決めてほしいこと — 依存の持ち込み方**

ここが本題で、**md-business 側で決めることなので、zumen からは決めない。**

zumen はレイアウトに **elkjs** を使っている。elkjs のライセンスは
**EPL-2.0 OR GPL-3.0-or-later** で、md-business は MIT。

> zumen 側の判断は「**未改変のまま依存として使う。フォークしない・ソースを取り込まない**」
> （zumen の D6）。前例として `@mermaid-js/layout-elk` は MIT で elkjs に依存している。
> **これは法的助言ではない。**

取り込み方は 3 通りある。**どれを採るかで、上の話が関係するかどうかが変わる。**

| | やり方 | elkjs が md-business の依存に入るか | 代償 |
|---|---|---|---|
| **A** | zumen を npm 依存として import する | **入る** | ライセンスの確認が要る |
| **B** | zumen の CLI を別プロセスで呼ぶ（Tauri の sidecar） | **入らない** | zumen の実行環境が要る。プレビューの応答が 1 段遅くなる |
| **C** | 図を先に SVG にしておき、本文には画像として置く | **入らない** | **囲みが図にならない。この依頼の目的を満たさない** |

**C は目的を満たさないので、実質 A か B。**
zumen 側はどちらでも動く形にしてある（D13。CLI と library の両方の口がある）。

---

## 5. 完了の確かめ方（zumen の Issue 012 の完了条件）

- md-business の文書に ```` ```zumen ```` を書くと図が出る
- **3 経路すべて**（プレビュー / PDF / HTML 書き出し）で出る
- 描けないときに、**理由がその位置に出て、書いた指定が残る**
- **合否は実物を見た人が記入する**（AI が代筆しない）

試すための実物が zumen 側にある。

- `examples/設計書サンプル.md` — 囲みを含む Markdown
- `examples/本番構成.zumen.yaml` — 図の正本
- `examples/本番構成.svg` — 期待される見た目

---

## 6. 見た目について

zumen の図の色は、**md-business のデザイントークンへ揃えてある**
（`apps/desktop/src/lib/styles/tokens.css` のライトの値。zumen の `DESIGN.md`）。

- ノードの地 = `--bg-app` / 枠 = `--border-strong`
- 囲み = `--bg-subtle` / `--border`
- `appearance: primary` = `--accent-subtle` / `--accent`

**ただし書き出した SVG は CSS 変数を使えない**（貼り先に md-business の CSS が無いため）。
値が直に書かれているので、**ダークテーマでは地の色が合わない。**
そこをどう扱うかは md-business 側の判断（図の背景を敷く／ライト固定で見せる等）。

---

## 7. 返してほしいもの

1. **A か B か**（§4）
2. 実装したうえで、§5 の 3 経路の結果
3. 見た目で困った点（特に §6 のダークテーマ）

zumen 側で直す必要があれば、こちらで直す。**md-business 側のコードには触らない。**
