/**
 * **図の向き**（Issue #2 / #9 の続き）。
 *
 * ## なぜ足したか
 *
 * ずっと `DOWN` で固定だった。その結果、**どの図も縦長になる。**
 *
 *     01 サーバ構成   499x944   縦横比 1:1.89
 *     03 データの流れ  448x818   縦横比 1:1.83
 *
 * 縦長は**流れ図に見える。** 構成図は横に読ませるもので、
 * 画面にも資料にも横長のほうが収まる。
 *
 * 同じ正本を `right` で組み直すと横長になり、**投影の比も上がる**
 * （長辺が縮むため。Issue #6）。
 *
 * ## 正本に書く（書き出しの指定ではない）
 *
 * **「この構成は左から右へ読む」は、図そのものの性質。**
 * 書き出すたびに指定するものではない。
 *
 * [#2](../../issues/2) で `layout` 節（`rank` / `order` を含む）を提案されたとき、
 * こちらは「いまは作らない」と答えた。**向きだけは別**とも書いた。
 *
 * > `direction` だけは別で、**いまは `DOWN` で固定**です。
 * > ここは意図を表す語で、**AI が書いても人の承認を侵しません。**
 *
 * 並び（`rank` / `order`）は**人の承認の領分に踏み込む**が、
 * 向きは 2 つに 1 つで、**figure 全体の読み方**にしか効かない。
 */

/** 図をどちらへ流すか。**語の一覧は 1 か所から取る**（写すとズレる）。 */
export const DIRECTIONS = ['down', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/**
 * 既定は `right`。
 *
 * **構成図は横に読むもの**で、画面も資料も横長。
 * `down` は手順や流れを表すときに選ぶ。
 */
export const DEFAULT_DIRECTION: Direction = 'right';

/** ELK へ渡す語。 */
export function elkDirection(direction: Direction): string {
  return direction === 'down' ? 'DOWN' : 'RIGHT';
}

/**
 * 正本から読む。**知らない語は既定へ落とす**（捨てずに描く。仕様 §9）。
 */
export function directionOf(raw: unknown): Direction {
  if (raw === 'down' || raw === 'DOWN') return 'down';
  if (raw === 'right' || raw === 'RIGHT') return 'right';
  return DEFAULT_DIRECTION;
}
