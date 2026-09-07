/**
 * 辺のラベルの置き場所（Issue #3 の 3）。
 *
 * **報告された実害をそのまま置く。**
 *
 * > 別々の辺のラベルが同じ座標に描かれ、読めなくなりました。
 * > `画像` と `②DB行` が重なって「画像DB行」に見えます。
 * > 線に沿ってずらすか、置けないなら出さない、のどちらかかと。
 *
 * 採ったのは**両方**。まず線に沿ってずらし、それでも当たるなら出さない。
 *
 * ## 出さないほうを選ぶ理由
 *
 * 重なった文字は、**間違った文字として読めてしまう**（「画像DB行」）。
 * 無いラベルは「書いていない」と分かるが、重なったラベルは
 * **嘘の情報になる。** 欠けるより悪い。
 *
 * ## もう 1 つ直したこと
 *
 * ラベルは**両端の中点**に置かれていた。直交ルーティング（#3 の 1）で
 * 線が回り込むようになったため、**中点は線の上ではなくなった。**
 * 線に沿った中央（弧長の半分）へ移した。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { placeEdgeLabels } from '../src/edge-labels.ts';
import type { Box, PlacedEdge } from '../src/layout.ts';

function edge(id: string, label: string | null, points: [number, number][]): PlacedEdge {
  const [from = id, to = id] = id.split('>');
  return { id, from, to, label, pinned: false, points: points.map(([x, y]) => ({ x, y })) };
}

function box(id: string, x: number, y: number, w = 160, h = 60): Box {
  return { id, label: id, x, y, w, h, group: null, type: 'server', appearance: null, technology: null, pinned: false };
}

describe('線に沿った中央へ置く', () => {
  it('まっすぐな線では、両端の中点と同じ', () => {
    const [label] = placeEdgeLabels([edge('a>b', 'HTTPS', [[0, 0], [0, 200]])], []);
    assert.equal(label?.x, 0);
    assert.ok(Math.abs(label!.y - 100) <= 8, `y=${label?.y}`);
  });

  it('**回り込む線では、線の上に乗る**（両端の中点は線の外）', () => {
    // コの字。両端の中点は (0, 100) で、**線が通っていない**。
    const points: [number, number][] = [[0, 0], [0, 100], [400, 100], [400, 200]];
    const [label] = placeEdgeLabels([edge('a>b', 'HTTPS', points)], []);
    assert.equal(label?.y ?? 0, 100 - 6, `y=${label?.y}`);
    assert.ok(label!.x > 100, `x=${label?.x} が折れ線の上に無い`);
  });

  it('ラベルが無い辺は出てこない', () => {
    assert.deepEqual(placeEdgeLabels([edge('a>b', null, [[0, 0], [0, 100]])], []), []);
  });
});

describe('重ならないようにする', () => {
  /** 報告そのもの。同じ所を通る 2 本に、別々のラベル。 */
  const COLLIDING = [
    edge('a>b', '画像', [[0, 0], [0, 200]]),
    edge('c>d', '②DB行', [[4, 0], [4, 200]]),
  ];

  it('**「画像DB行」が起きない**（ずらすか、出さない）', () => {
    const labels = placeEdgeLabels(COLLIDING, []);
    for (const a of labels) {
      for (const b of labels) {
        if (a.id === b.id) continue;
        assert.equal(overlaps(a, b), false, `${a.id} と ${b.id} が重なっている`);
      }
    }
  });

  it('ずらせるなら、両方とも残す', () => {
    // 長い線なら、片方を線に沿ってずらせば両方置ける。
    const long: [number, number][] = [[0, 0], [0, 600]];
    const labels = placeEdgeLabels(
      [edge('a>b', '画像', long), edge('c>d', '②DB行', [[4, 0], [4, 600]])],
      [],
    );
    assert.equal(labels.length, 2);
  });

  it('線の上下を使い分ける（片側だけだと置き場が尽きる）', () => {
    const labels = placeEdgeLabels(
      [edge('a>b', '画像', [[0, 0], [0, 24]]), edge('c>d', '②DB行', [[4, 0], [4, 24]])],
      [],
    );
    // 短い線でも、上と下に分ければ 2 本とも置ける。
    assert.equal(labels.length, 2);
    assert.notEqual(labels[0]!.y, labels[1]!.y);
  });

  it('**それでも置けないなら出さない**（重ねて出さない）', () => {
    // 同じ所を通る 4 本。上下 2 段しか無いので、逃げ場が尽きる。
    const crowd = ['画像', '②DB行', '③更新', '④同期'].map((text, i) =>
      edge(`a${i}>b${i}`, text, [[i * 3, 0], [i * 3, 20]]),
    );
    const labels = placeEdgeLabels(crowd, []);
    assert.ok(labels.length < crowd.length, `${labels.length} 本とも置けてしまった`);
  });

  it('**箱の上には置かない**（ノードのラベルと重なって読めなくなる）', () => {
    const points: [number, number][] = [[100, 0], [100, 400]];
    const labels = placeEdgeLabels([edge('a>b', 'HTTPS', points)], [box('mid', 20, 150)]);
    for (const label of labels) {
      assert.equal(label.y > 150 && label.y < 210, false, `y=${label.y} が箱の中`);
    }
  });

  it('置く順は入力の順で決まる（同じ図なら同じ結果）', () => {
    const once = placeEdgeLabels(COLLIDING, []);
    const twice = placeEdgeLabels(COLLIDING, []);
    assert.deepEqual(once, twice);
  });
});

function overlaps(a: { x: number; y: number; w: number }, b: { x: number; y: number; w: number }): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < 14
  );
}
