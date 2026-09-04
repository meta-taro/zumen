# 依存ライブラリのライセンス

このリポジトリのコードは MIT（`package.json` の `license`）。
依存として配布に含まれるものを、ここに明記する。

`LICENSE` に MIT の本文がある（著作権者 `meta-taro`。2026-09-04、人の指示で設置）。
**MIT は著作権表示と許諾文の保持を条件にしているので、著作権者の行が無い MIT は成立しない。**

> md-business の `LICENSE` は `metataro`（ハイフン無し）で、
> こちらは `meta-taro`（ハイフン有り、GitHub アカウント名）。**表記が割れている。**

| パッケージ | ライセンス | 扱い |
|---|---|---|
| [elkjs](https://github.com/kieler/elkjs) | **EPL-2.0 OR GPL-3.0-or-later** | 自動レイアウト。**未改変のまま依存として使う**（フォークしない・ソースを取り込まない） |
| [yaml](https://github.com/eemeli/yaml) | ISC | 正本の読み書き |

## elkjs について

EPL-2.0 はファイル単位の弱いコピーレフトで、より大きな著作物への同梱を認めるかわりに、
EPL の対象部分のソースを入手可能にすることを求める。
zumen は npm から取得した**未改変の elkjs をそのまま使う**ため、対象部分のソースは
上記のリポジトリで公開されたままである。

判断の経緯は `.claude/decisions.md` の D6。

> **これは法的助言ではない。** 配布の前に、ライセンスの最終確認は人が行うこと。

## 図形・アイコンについて

**クラウド各社の公式アイコン（AWS / Azure / Google Cloud / Cloudflare / Docker /
Kubernetes）は同梱しない。** 各社とも改変を明確に禁じており、
**第三者の作図ツールへの同梱を明示的に許可した文はどこにも無い**ため。
調査は `docs/specs/006-図形とアイコンのライセンス.md`、判断は `.claude/decisions.md` の D7。

| 種別 | ライセンス | 扱い |
|---|---|---|
| zumen の汎用図形（Internet / Cloud / Client / User / API / Queue / Cache / Container / Cluster / Network） | MIT | zumen が自分で描く。**各社のアイコンをなぞらない** |
| 各社の公式アイコン | 提供元の条件による | **同梱しない。** 利用者が提供元から取得し `.zumen/icons/<パック名>/` へ置く |

利用者が置いたアイコンについて、**帰属表示の文言は利用者がパックに書く**。
zumen は既定値を持たない（持てば zumen が各社の条件を代弁したことになる）。
