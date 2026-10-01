/**
 * Git の 3-way マージ（Issue 011）。
 *
 * **衝突しなければ良い、ではない。**
 * 本当にぶつかっているのに黙って通すドライバは、人の直しを片方だけ消す。
 * しかも**消えたことが誰にも見えない**ので、いちばん見つかりにくい壊れ方になる。
 *
 * したがってここでは、2 つを同じ重さで確かめる。
 *
 * 1. ぶつかっていないものが解けること
 * 2. **ぶつかっているものが、ぶつかったまま返ること**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mergeThreeWay } from '../src/git-merge.ts';
import { hasError, validate } from '../src/validate.ts';

const BASE = [
  'version: 1',
  'pins: {}',
  'nodes:',
  '  - id: lb',
  '    label: LB',
  '',
  '  - id: db',
  '    label: DB',
  '',
].join('\n');

/** `pins` に 1 件だけ位置を書いた版を作る。 */
function moved(id: string, x: number, y: number): string {
  return BASE.replace('pins: {}', `pins:\n  ${id}:\n    position: { x: ${x}, y: ${y} }`);
}

/** `nodes` の末尾へ 1 件足した版を作る。 */
function added(id: string, label: string): string {
  return BASE.replace('    label: DB\n', `    label: DB\n\n  - id: ${id}\n    label: ${label}\n`);
}

function relabelled(id: string, label: string): string {
  return BASE.replace(new RegExp(`(- id: ${id}\\n    label: )\\w+`), `$1${label}`);
}

describe('ぶつかっていないものは解ける（行では解けなかった 2 件）', () => {
  it('2 人が別々のノードを動かす', () => {
    const result = mergeThreeWay(BASE, moved('db', 620, 410), moved('lb', 100, 100));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /db:/);
    assert.match(result.text, /lb:/);
  });

  it('2 人が別々のノードを足す', () => {
    const result = mergeThreeWay(BASE, added('redis', 'Redis'), added('mq', 'RabbitMQ'));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /id: redis/);
    assert.match(result.text, /id: mq/);
  });

  it('2 人が別々のノードのラベルを直す', () => {
    const result = mergeThreeWay(BASE, relabelled('lb', 'LB2'), relabelled('db', 'DB2'));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /label: LB2/);
    assert.match(result.text, /label: DB2/);
  });

  it('解けた結果は、形式として読める（黙って壊していない）', () => {
    const result = mergeThreeWay(BASE, added('redis', 'Redis'), added('mq', 'RabbitMQ'));
    assert.equal(hasError(validate(result.text)), false);
  });

  it('片方だけが変えたなら、その変更が残る', () => {
    const result = mergeThreeWay(BASE, BASE, relabelled('db', 'DB2'));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /label: DB2/);
  });

  it('両方が同じ変え方をしたなら、衝突にしない', () => {
    const same = relabelled('db', 'DB2');
    const result = mergeThreeWay(BASE, same, same);
    assert.deepEqual(result.conflicts, []);
  });
});

describe('**ぶつかっているものは、ぶつかったまま返す**', () => {
  it('2 人が同じノードを別の場所へ動かす', () => {
    const result = mergeThreeWay(BASE, moved('db', 620, 410), moved('db', 100, 900));
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0]?.key, 'db');
  });

  it('印は Git と同じ形（使い慣れた道具が効くこと）', () => {
    const result = mergeThreeWay(BASE, moved('db', 620, 410), moved('db', 100, 900));
    assert.match(result.text, /^<<<<<<< ours$/m);
    assert.match(result.text, /^=======$/m);
    assert.match(result.text, /^>>>>>>> theirs$/m);
  });

  it('両方の値が印の中に残る（片方を捨てない）', () => {
    const result = mergeThreeWay(BASE, moved('db', 620, 410), moved('db', 100, 900));
    assert.match(result.text, /620/);
    assert.match(result.text, /900/);
  });

  it('囲むのはぶつかった要素だけで、隣の行を巻き込まない', () => {
    const result = mergeThreeWay(BASE, moved('db', 620, 410), moved('db', 100, 900));
    const inside = result.text.split('<<<<<<< ours')[1]?.split('>>>>>>> theirs')[0] ?? '';
    // nodes 節は無関係。巻き込まれていたら、行単位マージと同じことをしている。
    assert.equal(inside.includes('id: lb'), false);
  });

  it('同じ id を別の中身で足したら、ぶつかったままにする', () => {
    const result = mergeThreeWay(BASE, added('x', 'Ours'), added('x', 'Theirs'));
    assert.equal(result.conflicts.length, 1);
    assert.match(result.text, /Ours/);
    assert.match(result.text, /Theirs/);
  });

  it('片方が消し、他方が直したなら、ぶつかったままにする', () => {
    const removed = BASE.replace('\n  - id: db\n    label: DB\n', '\n');
    const result = mergeThreeWay(BASE, removed, relabelled('db', 'DB2'));
    assert.equal(result.conflicts.length, 1);
    assert.equal(result.conflicts[0]?.ours, undefined);
  });

  it('両方が消したなら、衝突にしない', () => {
    const removed = BASE.replace('\n  - id: db\n    label: DB\n', '\n');
    const result = mergeThreeWay(BASE, removed, removed);
    assert.deepEqual(result.conflicts, []);
    assert.equal(result.text.includes('id: db'), false);
  });
});

describe('人が書いていない行に差分を出さない', () => {
  it('何も変わっていなければ、本文はそのまま', () => {
    assert.equal(mergeThreeWay(BASE, BASE, BASE).text, BASE);
  });

  it('theirs の書き方を保つ（flow style を展開しない）', () => {
    const result = mergeThreeWay(BASE, BASE, moved('db', 620, 410));
    assert.match(result.text, /position: \{ x: 620, y: 410 \}/);
  });

  it('コメントが消えない', () => {
    const commented = BASE.replace('nodes:', '# 監視は本番と同じ VPC に置く\nnodes:');
    const result = mergeThreeWay(commented, commented, relabelled('db', 'DB2').replace('nodes:', '# 監視は本番と同じ VPC に置く\nnodes:'));
    assert.match(result.text, /# 監視は本番と同じ VPC に置く/);
  });
});
