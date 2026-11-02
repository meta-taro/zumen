/**
 * Git の 3-way マージ。
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

/**
 * 節（nodes / edges）以外の節。**直す前は、ドライバが `version` / `title` / `groups` / `nodes` / `edges` / `pins`
 * しか見ていなかった。** 2 人が別々に線（`paths`）を直しても、片方（theirs）の直しは黙って消え、
 * 同じ線を別々に直しても競合にならず、ours が黙って勝っていた。
 */
const PLACED = [
  'version: 1',
  'kind: placement',
  'scale: { mm: 25 }',
  'palette:',
  '  A: "#111111"',
  '  B: "#222222"',
  'parts:',
  '  par64:',
  '    nodes:',
  '      - { id: body, at: { x: 0, y: 0 }, size: { w: 24, h: 24 } }',
  'place:',
  '  - { part: par64, as: L1, at: { x: 120, y: 80 } }',
  '  - { part: par64, as: L2, at: { x: 300, y: 80 } }',
  'paths:',
  '  - id: anchor',
  '    points: [ [ 0, 0 ], [ 100, 0 ] ]',
  '  - id: tape',
  '    points: [ [ 0, 50 ], [ 100, 50 ] ]',
  'dims:',
  '  - { id: length, from: [ 0, 0 ], to: [ 100, 0 ], offset: 20 }',
  'nodes:',
  '  - { id: stage, label: 舞台, at: { x: 0, y: 200 }, size: { w: 400, h: 120 } }',
  '',
].join('\n');

function edit(from: string, to: string): string {
  assert.ok(PLACED.includes(from), `元に無い: ${from}`);
  return PLACED.replace(from, to);
}

describe('配置図の節と設定も 3-way で見る', () => {
  it('2 人が別々の線（paths）を直したら、両方残る', () => {
    const ours = edit('[ [ 0, 0 ], [ 100, 0 ] ]', '[ [ 0, 5 ], [ 100, 5 ] ]');
    const theirs = edit('[ [ 0, 50 ], [ 100, 50 ] ]', '[ [ 0, 60 ], [ 100, 60 ] ]');
    const result = mergeThreeWay(PLACED, ours, theirs);
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /\[ \[ 0, 5 \], \[ 100, 5 \] \]/);
    assert.match(result.text, /\[ \[ 0, 60 \], \[ 100, 60 \] \]/);
  });

  it('同じ線を別々に直したら、ぶつかったまま返す', () => {
    const ours = edit('[ [ 0, 0 ], [ 100, 0 ] ]', '[ [ 0, 5 ], [ 100, 5 ] ]');
    const theirs = edit('[ [ 0, 0 ], [ 100, 0 ] ]', '[ [ 0, 9 ], [ 100, 9 ] ]');
    const result = mergeThreeWay(PLACED, ours, theirs);
    assert.deepEqual(result.conflicts.map((c) => [c.section, c.key]), [['paths', 'anchor']]);
    assert.match(result.text, /^<<<<<<< ours$/m);
  });

  it('寸法（dims）・置き方（place）・部品（parts）も鍵で照合する', () => {
    const ours = edit('offset: 20', 'offset: 30').replace('as: L1, at: { x: 120', 'as: L1, at: { x: 130');
    const theirs = edit('as: L2, at: { x: 300', 'as: L2, at: { x: 310').replace(
      '      - { id: body',
      '      - { id: ch, at: { x: 2, y: 28 }, size: { w: 20, h: 12 } }\n      - { id: body',
    );
    const result = mergeThreeWay(PLACED, ours, theirs);
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /offset: 30/);
    assert.match(result.text, /x: 130/);
    assert.match(result.text, /x: 310/);
    assert.match(result.text, /id: ch/);
  });

  it('同じ置き方を別々に動かしたら、ぶつかったまま返す', () => {
    const result = mergeThreeWay(
      PLACED,
      edit('as: L1, at: { x: 120', 'as: L1, at: { x: 130'),
      edit('as: L1, at: { x: 120', 'as: L1, at: { x: 140'),
    );
    assert.deepEqual(result.conflicts.map((c) => [c.section, c.key]), [['place', 'L1']]);
  });

  it('縮尺（scale）を片方だけが変えたら、その変更が残る', () => {
    const result = mergeThreeWay(PLACED, PLACED, edit('scale: { mm: 25 }', 'scale: { mm: 20 }'));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /scale: \{ mm: 20 \}/);
  });

  it('縮尺を別々に変えたら、ぶつかったまま返す（片方を黙って採らない）', () => {
    const result = mergeThreeWay(PLACED, edit('scale: { mm: 25 }', 'scale: { mm: 20 }'), edit('scale: { mm: 25 }', 'scale: { mm: 30 }'));
    assert.deepEqual(result.conflicts.map((c) => [c.section, c.key]), [['root', 'scale']]);
    assert.match(result.text, /mm: 20/);
    assert.match(result.text, /mm: 30/);
  });

  it('色の鍵（palette）は鍵ごとに見る。別々の鍵なら両方残る', () => {
    const result = mergeThreeWay(PLACED, edit('A: "#111111"', 'A: "#aaaaaa"'), edit('B: "#222222"', 'B: "#bbbbbb"'));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /A: "#aaaaaa"/);
    assert.match(result.text, /B: "#bbbbbb"/);
  });

  it('作図の定数（let）を別々に変えたら、ぶつかったまま返す', () => {
    const base = ['version: 1', 'kind: construction', 'let:', '  R: 100', '  H: 200', ''].join('\n');
    const result = mergeThreeWay(base, base.replace('R: 100', 'R: 110'), base.replace('R: 100', 'R: 120'));
    assert.deepEqual(result.conflicts.map((c) => [c.section, c.key]), [['let', 'R']]);
    const both = mergeThreeWay(base, base.replace('R: 100', 'R: 110'), base.replace('H: 200', 'H: 220'));
    assert.deepEqual(both.conflicts, []);
    assert.match(both.text, /R: 110/);
    assert.match(both.text, /H: 220/);
  });

  it('片方だけが足した設定（title 以外の最上位の鍵）が入る', () => {
    const result = mergeThreeWay(PLACED, PLACED, edit('kind: placement', 'kind: placement\nnorth: left'));
    assert.deepEqual(result.conflicts, []);
    assert.match(result.text, /^north: left$/m);
  });

  it('解けた結果は、形式として読める', () => {
    const ours = edit('[ [ 0, 0 ], [ 100, 0 ] ]', '[ [ 0, 5 ], [ 100, 5 ] ]');
    const theirs = edit('offset: 20', 'offset: 30');
    assert.equal(hasError(validate(mergeThreeWay(PLACED, ours, theirs).text)), false);
  });

  it('最上位の値の競合は、その場で囲む（ours 側を採ると、そのまま読める。鍵が 2 つ残らない）', () => {
    const base = ['version: 1', 'title: 元 # 註', 'nodes:', '  - id: a', ''].join('\n');
    const result = mergeThreeWay(base, base.replace('元', '甲'), base.replace('元', '乙'));
    const keptOurs = result.text.replace(/<<<<<<< ours\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> theirs\n/g, '$1');
    assert.equal(keptOurs, base.replace('元', '甲'));
  });

  it('何も変わっていなければ、本文はそのまま', () => {
    assert.equal(mergeThreeWay(PLACED, PLACED, PLACED).text, PLACED);
  });
});
