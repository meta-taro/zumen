/**
 * **図の種類と、種類ごとの物差し**（Issue #4）。
 *
 * ## なぜ要るか
 *
 * 「縮尺のある図をやらない」という判断を、オーナーが覆した（2026-09-11）。
 * **開ける前に、測り方を分ける必要がある。**
 *
 * いまの自力率は「**人が触った要素が少ないほど良い**」という向き。
 * 構成図ではこれが正しい —— 人が図形を並べ直しているなら、
 * それは高機能な作図ソフトであって、この製品ではない（D3）。
 *
 * **配置図では逆になる。**
 *
 * ```
 * 誰も置いていない  → 自力率 100%
 * 人が全部置いた    → 自力率 0%    ← 配置図ではこれが正しい状態
 * ```
 *
 * 実測でそうなった（#4 の調査）。**同じ物差しを当てると、意味が反転する。**
 *
 * ## だから、まず種類を宣言させる
 *
 * 図が自分で「私は構成図です」「私は配置図です」と言えないと、
 * **どちらの物差しで測るかを機械が決められない。**
 *
 * 種類を増やすのは語彙を広げることなので、**2 つだけ**にする。
 * 3 つ目が要るときは、**測り方が 3 つ目になるときだけ。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { KINDS, kindOf, measureOf } from '../src/kind.ts';

const PLAIN = 'version: 1\nnodes:\n  - id: a\n  - id: b\n';

describe('図の種類', () => {
  it('**書いていなければ構成図**（いままでの図が、いままでどおり測られる）', () => {
    assert.equal(kindOf(PLAIN), 'structure');
  });

  it('宣言できる', () => {
    assert.equal(kindOf('version: 1\nkind: placement\nnodes:\n  - id: a\n'), 'placement');
    assert.equal(kindOf('version: 1\nkind: structure\nnodes:\n  - id: a\n'), 'structure');
  });

  it('**知らない語は構成図へ落ちる**（捨てずに描く。仕様 §9）', () => {
    assert.equal(kindOf('version: 1\nkind: 立面図\nnodes:\n  - id: a\n'), 'structure');
  });

  it('**種類は 2 つだけ**（増やすのは、測り方が増えるときだけ）', () => {
    assert.deepEqual([...KINDS], ['structure', 'placement']);
  });
});

describe('**種類ごとに、物差しが違う**', () => {
  it('構成図は「人が触っていないほど良い」', () => {
    const m = measureOf('structure');
    assert.equal(m.humanPlacementIsGood, false);
    assert.match(m.label, /自力/);
  });

  it('**配置図は「人が置くのが正しい」**', () => {
    const m = measureOf('placement');
    assert.equal(m.humanPlacementIsGood, true);
  });

  it('**同じ数字を、逆に読まない**', () => {
    assert.notEqual(
      measureOf('structure').humanPlacementIsGood,
      measureOf('placement').humanPlacementIsGood,
    );
  });

  it('どちらの物差しにも、合格の説明がある', () => {
    for (const kind of KINDS) {
      const m = measureOf(kind);
      assert.ok(m.label.length > 0, `${kind} に名前が無い`);
      assert.ok(m.why.length > 0, `${kind} に理由が無い`);
    }
  });
});

describe('**測る側が、種類を見る**', () => {
  const PLACED = [
    'version: 1',
    'kind: placement',
    'pins:',
    '  a:',
    '    position: { x: 100, y: 100 }',
    '  b:',
    '    position: { x: 400, y: 100 }',
    'nodes:',
    '  - id: a',
    '  - id: b',
    '',
  ].join('\n');

  const UNPLACED = 'version: 1\nkind: placement\nnodes:\n  - id: a\n  - id: b\n';

  it('測るものに、種類が入っている', async () => {
    const { measure } = await import('../src/measure.ts');
    assert.equal(measure(PLACED).kind, 'placement');
    assert.equal(measure(PLAIN).kind, 'structure');
  });

  it('**配置図では、人が全部置いた図が「合格」**', async () => {
    const { measure } = await import('../src/measure.ts');
    const got = measure(PLACED);
    assert.equal(got.layoutAutonomy, 0, '自力率の数字そのものは 0 のまま');
    assert.equal(got.pass, true, '配置図なのに不合格になっている');
  });

  it('**配置図では、誰も置いていない図が「不合格」**', async () => {
    const { measure } = await import('../src/measure.ts');
    const got = measure(UNPLACED);
    assert.equal(got.layoutAutonomy, 1, '自力率の数字そのものは 100% のまま');
    assert.equal(got.pass, false, '誰も置いていないのに合格になっている');
  });

  it('構成図の判定は、これまでどおり', async () => {
    const { measure } = await import('../src/measure.ts');
    assert.equal(measure(PLAIN).pass, true);
    const touched = PLAIN.replace(
      'nodes:',
      'pins:\n  a:\n    position: { x: 1, y: 1 }\n  b:\n    position: { x: 2, y: 2 }\n\nnodes:',
    );
    assert.equal(measure(touched).pass, false, '構成図で人が全部置いたのに合格している');
  });

  it('**検査からも種類が見える**（エージェントが物差しを取り違えない）', async () => {
    const { inspect } = await import('../src/tools.ts');
    const out = await inspect(PLACED);
    assert.equal(out.kind, 'placement');
    assert.equal(out.humanPlacementIsGood, true);
  });
});
