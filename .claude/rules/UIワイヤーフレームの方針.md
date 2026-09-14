# UI ワイヤーフレーム・画面構造図 対応方針

> **オーナーの指示（2026-09-14）。**
> `専門図面の調査と実装方針.md` と同じ強さで読む。

---

## 0. 目的と、目的でないもの

PC・Tablet・Smartphone の**シンプルな**ワイヤーフレームを扱う。
**Figma や UI 生成 AI と競争しない。**

いまは AI が「要件 → 完成 UI → コード」まで直接出せる。
**「デザイン前に詳細なワイヤーフレームを作る」工程そのものの重要性は下がっている。**

だから zumen では、ワイヤーフレームを**デザインの下書きとして扱わない。**

> **人間と AI が共有できる UI 構造の正本**として扱う。

### 追わないもの

美しい UI ／ ブランドカラー ／ 詳細な Typography ／ 写真・イラスト ／ 装飾 ／
Pixel Perfect ／ Design System の完全再現 ／ **Figma の代替**

これらは Figma や UI 生成 AI のほうが適している。

### 表すもの

**何が存在するか／どこに／どの順番で／何と関連するか／
PC と SP でどう変わるか／操作するとどこへ遷移するか／どの Component でできているか。**

---

## 1. シンプルワイヤーフレーム

一般的な Web / App 画面が表せればよい。
Browser / Screen・Header・Footer・Sidebar・Navigation・Section・Card・
Image placeholder・Text・Heading・Button・Input・Textarea・Select・Checkbox・
Radio・Tabs・Table・List・Modal・Drawer・Bottom Navigation。

**UI Component を大量に専用実装しない。**
既存の zumen プリミティブ（`marker` / `hatch` / `at` / `size` / `tag`）で組む。

---

## 2. PC / SP の比較 —— **これを重要機能として扱う**

同じ画面の Desktop / Tablet / Mobile を並べ、**構造の差**を確認できるようにする。

**単なる縮小ではない。** レスポンシブで起きるのはこれ。

横並び → 縦並び ／ Sidebar → Drawer ／ Navigation → ハンバーガー ／
要素の非表示 ／ 要素の追加 ／ 表示順の変更 ／ Sticky・Fixed 化 ／
Grid の列数変更 ／ Desktop 専用 Component ／ Mobile 専用 Component

**絵を 2 枚並べるだけでは足りない。** 何がどう変わるかを**表で言う**。

---

## 3. Responsive Layout Specification

Breakpoint ごとの構造を書けるようにする。

```
Main Layout
  >= 1024      Main ＋ Sidebar
  768 - 1023   Main ＋ Compact Sidebar
  < 768        Main（Sidebar の中身は Main の下へ移動）
```

---

## 4. User Flow ＋ Wireframe

**画面を単なる箱にしない。** 画面そのものを**小型のワイヤーフレーム**として描き、
遷移でつなぐ。1 枚で「流れ」と「画面の構造」が同時に読める。

## 5. Interaction Flow

遷移だけでなく操作も表す。

```
[Add Cart] --click--> Cart Updated
                        ├ success → Toast
                        └ error   → Error Modal
```

## 6. Component 構造

ワイヤーフレームを Component の木と結び付ける。
これで**画像ではなく、実装できる構造データ**になる。

> **「この zumen を正として React / Vue / Flutter で実装してください」**

## 7. AI 開発との連携

```
要件 → AI → zumen の UI 構造 → 人が確認・修正 → AI Coding Agent → 完成 UI
```

zumen は完成デザインではなく、**要件と実装の間にある構造化された視覚仕様**。

## 8. 逆方向（将来）

既存 Web / App → AI 解析 → zumen → 画面一覧・Navigation・Component 構造・
Responsive 構造・User Flow の可視化。既存システムの把握やリプレイスに使う。

## 9. **ワイヤーフレームを独立した世界にしない**

**「Wireframe 機能」という巨大な別システムを作らない。**

zumen の強みは、ネットワーク図・建築・舞台照明・釣りの仕掛け・車両損傷・医療・
ワイヤーフレーム・User Flow が、**できるだけ同じ描画モデルとプリミティブで成立する**こと。
**UI だけ特別扱いしすぎない。**

---

## 10. 作るサンプル（最低限）

| | 中身 | 状態 |
|---|---|---|
| EC 商品ページ | Desktop / Mobile 比較 | **見本 74** |
| 画面遷移＋ワイヤーフレーム | Login → Home → Detail | **見本 75** |
| 管理画面 | Desktop は Sidebar、Mobile は Drawer | **見本 76** |
| Checkout Flow | Cart → Address → Payment → Confirm → Complete | **見本 85** |
| CRUD Admin | List → Create → Edit → Delete Confirmation | **見本 86** |
| Mobile App | Bottom Navigation を持つ | **見本 87** |
| Responsive LP | Desktop / Tablet / Mobile で Section 構造が変わる | **見本 88** |

---

## 11. 目指さないもの / 残す価値

zumen を「**AI で綺麗な Web サイトを作るツール**」にはしない。
そこは今後さらにコモディティ化する。

残す価値は、

> **「何を作るのか」を、人間と AI の双方が理解できる構造として残すこと。**

完成 UI が何度作り直されても、その背後の
Screen / Component / Layout / Relationship / Flow / Responsive behavior は残る。

**完成形を AI が直接出せる時代だからこそ、完成形そのものではなく
「なぜその画面がその構造なのか」「何と何がどう関係するのか」を、
機械可読かつ人間にも視覚的に読める形で保持する。**

---

## 12. 作ってみて分かったこと（2026-09-14）

**7 件すべてが、道具を足さずに描けた。** §9 のとおり、UI だけを別世界にしていない。

分かったのは 2 つ。

1. **器の名前を器の真ん中に書くと、中身の名前に乗る。**
   Header・Product Info のような**中身を持つ箱**は、名前を中央へ置くと
   子の名前とぶつかる。器の名前は**端の欄へ出す**（見本 74 を直した）。
2. **それを、どの検査も見ていなかった。**
   `crowdedNames` は外へ出した名前、`hiddenLabels` は辺のラベル、
   `overlaps` は箱 —— **中に収まった文字どうしは誰も見ていなかった。**
   `overlappingText` を足して、見本 3 枚の実害を見つけた。
