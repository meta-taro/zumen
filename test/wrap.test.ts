/**
 * 長い鎖を折り返す（`wrap`）。**既定では折り返さない。**
 *
 * 折り返さないと、7 工程の業務フローが横 2584 × 縦 124（比 20.8）で出る。
 * 資料に貼ると幅に合わせて縮むので、**文字が読めない。**
 *
 * **既定にはしない。** 折り返すと 2 行目の先頭が 1 行目の末尾より左に来るので、
 * 繋ぐ辺が図を右から左へ戻る —— [#1](https://github.com/meta-taro/zumen/issues/1)
 * で報告された壊れ方（終点が最上段に来て、全高を逆流する矢印が生まれた）と同じ絵になる。
 *
 * 実際、既定にしたら `test/groups.test.ts` の 4 件が落ちた。
 * **落ちたテストを消さずに、既定を変えないほうを採った。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { wrapOf, wrapOptions } from '../src/wrap.ts';

/** `count` 個の一直線の鎖。 */
function chain(count: number, wrap: boolean): string {
  const ids = Array.from({ length: count }, (_, i) => `n${i}`);
  return [
    'version: 1',
    ...(wrap ? ['wrap: true'] : []),
    'nodes:',
    ...ids.map((id) => `  - id: ${id}\n    label: ${id}`),
    'edges:',
    ...ids.slice(1).map((id, i) => `  - from: ${ids[i]}\n    to: ${id}`),
  ].join('\n');
}

async function ratio(count: number, wrap: boolean): Promise<number> {
  const placed = await layout(chain(count, wrap));
  return placed.width / placed.height;
}

describe('折り返すかを読む（wrap）', () => {
  it('書かなければ折り返さない', () => {
    assert.equal(wrapOf(undefined), false);
    assert.equal(wrapOf(false), false);
    assert.equal(wrapOf(null), false);
  });

  it('`true` のときだけ折り返す。**文字列の "true" では折り返さない**', () => {
    assert.equal(wrapOf(true), true);
    assert.equal(wrapOf('true'), false);
    assert.equal(wrapOf(1), false);
  });

  it('折り返さないなら、ELK へ何も渡さない（既定の挙動を変えない）', () => {
    assert.deepEqual(wrapOptions(false), {});
  });

  it('折り返すなら MULTI_EDGE。**単辺だけだと分岐のある図で効かない**', () => {
    assert.equal(wrapOptions(true)['elk.layered.wrapping.strategy'], 'MULTI_EDGE');
  });
});

describe('折り返しの効き目', () => {
  it('**8 個の鎖が、横長すぎる状態から収まる**', async () => {
    const before = await ratio(8, false);
    const after = await ratio(8, true);
    assert.ok(before > 6, `折り返し無しで比 ${before.toFixed(2)}。前提が変わっている`);
    assert.ok(after < 3, `折り返しても比 ${after.toFixed(2)} のまま`);
  });

  it('**2 個なら折り返さない。** 2 つ並べるだけの図に折り返す理由は無い', async () => {
    assert.ok((await ratio(2, true)) > 2.5, '2 個の図が縦に積まれた');
  });

  it('書かなければ、これまでどおり横一列のまま', async () => {
    assert.ok((await ratio(8, false)) > 6);
  });

  it('折り返しても、ノードは 1 つも落ちない', async () => {
    const placed = await layout(chain(8, true));
    assert.equal(placed.boxes.length, 8);
    assert.equal(placed.edges.length, 7);
  });

  it('折り返しても、矢印が箱を突き抜けない', async () => {
    const { crossings, overlaps } = await import('../src/layout.ts');
    const placed = await layout(chain(8, true));
    assert.equal(crossings(placed), 0);
    assert.deepEqual(overlaps(placed), []);
  });
});
