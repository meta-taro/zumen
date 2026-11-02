/**
 * 配置図の節（`paths` / `dims` / `parts` / `place` / `scale`）を、提案から人の正本へ入れる。
 *
 * **直す前は、この 5 つを merge が 1 つも見ていなかった。** 提案が線を足しても・寸法の文字を
 * 変えても・置いたものを消しても、正本は 1 文字も変わらず、競合も出ず、`propose` は ok を返した。
 * AI に頼んだ変更が、黙って捨てられていた。
 *
 * 入れ方は節（`nodes` / `edges`）と同じ（仕様 §6.2）——
 * 鍵で照合し、値が同じキーには触らず、人の手直し（`pins`）があるものは消さずに競合として返す。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getPins, parse } from '../src/format.ts';
import { measure } from '../src/measure.ts';
import { merge, resolve } from '../src/merge.ts';

/** 人の正本。`anchor` の線と `L1` の中の `ch` を、人が手で直してある。 */
const HUMAN = `version: 1
kind: placement
scale: { mm: 25 }
parts:
  # 器具の形。人が書いた註
  par64:
    nodes:
      - { id: body, label: "", marker: circle, at: { x: 0, y: 0 }, size: { w: 24, h: 24 } }
      - { id: ch, label: "", marker: none, at: { x: 2, y: 28 }, size: { w: 20, h: 12 } }
place:
  - part: par64
    as: L1 # 上手の 1 灯目
    at: { x: 120, y: 80 }
  - { part: par64, as: L2, at: { x: 300, y: 80 } }
paths:
  # 舞台端のテープ
  - id: anchor
    points: [ [ 0, 0 ], [ 100, 0 ] ]
  - id: tape
    points: [ [ 0, 50 ], [ 100, 50 ] ]
dims:
  - id: length
    from: [ 0, 0 ]
    to: [ 100, 0 ]
    offset: 20
nodes:
  - { id: stage, label: 舞台, at: { x: 0, y: 200 }, size: { w: 400, h: 120 } }
edges:
  - { from: L1.body, to: L2.body }
pins:
  anchor:
    points: [ [ 0, 10 ], [ 100, 10 ] ]
  L1.ch:
    label: "101"
`;

/** HUMAN と同じ意味の提案（pins は持たない）。ここから 1 か所ずつ変える。 */
const SAME = HUMAN.slice(0, HUMAN.indexOf('pins:'));

function replaced(from: string, to: string): string {
  assert.ok(SAME.includes(from), `提案の元に無い: ${from}`);
  return SAME.replace(from, to);
}

describe('配置図の節 — 何も変えない提案', () => {
  it('同じ意味の提案なら、正本は 1 文字も変わらない（註・書き方・並び順）', () => {
    const result = merge(HUMAN, SAME);
    assert.equal(result.text, HUMAN);
    assert.deepEqual(result.conflicts, []);
  });

  it('正本にも提案にも無い節を、勝手に足さない', () => {
    const plain = ['version: 1', 'kind: placement', 'nodes:', '  - id: a', ''].join('\n');
    const result = merge(plain, plain);
    assert.equal(result.text, plain);
  });
});

describe('paths / dims — id で照合する', () => {
  it('足した線が入る（書き方は提案のまま。括弧の内側に空白）', () => {
    const proposal = replaced('dims:', '  - id: pond\n    points: [ [ 0, 90 ], [ 100, 90 ] ]\ndims:');
    const result = merge(HUMAN, proposal);
    assert.ok(parse(result.text).pathIds().includes('pond'));
    assert.match(result.text, /- id: pond\n {4}points: \[ \[ 0, 90 \], \[ 100, 90 \] \]/);
  });

  it('変えた線の語だけが変わり、隣の行と人の註は残る', () => {
    const proposal = replaced(
      '  - id: tape\n    points: [ [ 0, 50 ], [ 100, 50 ] ]',
      '  - id: tape\n    points: [ [ 0, 50 ], [ 100, 50 ] ]\n    weight: thick',
    );
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /- id: tape\n {4}points: \[ \[ 0, 50 \], \[ 100, 50 \] \]\n {4}weight: thick/);
    assert.match(result.text, /# 舞台端のテープ\n {2}- id: anchor/);
  });

  it('寸法の文字の変更が入る', () => {
    const proposal = replaced('    offset: 20', '    offset: 20\n    text: "{}（全長）"');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /text: "\{\}（全長）"/);
  });

  it('人が触っていない線を消すと、消える', () => {
    const proposal = replaced('  - id: tape\n    points: [ [ 0, 50 ], [ 100, 50 ] ]\n', '');
    const result = merge(HUMAN, proposal);
    assert.ok(!parse(result.text).pathIds().includes('tape'));
    assert.deepEqual(result.conflicts, []);
  });

  it('人が描き直した線（pins.<id>.points）を消そうとしたら、消さずに競合として出す', () => {
    const proposal = replaced('  - id: anchor\n    points: [ [ 0, 0 ], [ 100, 0 ] ]\n', '');
    const result = merge(HUMAN, proposal);
    assert.ok(parse(result.text).pathIds().includes('anchor'));
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'anchor', reason: 'removed' }]);
  });

  it('AI が線の点を変えても、人の pins.<id>.points は残る（描くときは人が勝つ）', () => {
    const proposal = replaced('points: [ [ 0, 0 ], [ 100, 0 ] ]', 'points: [ [ 0, 0 ], [ 200, 0 ] ]');
    const result = merge(HUMAN, proposal);
    assert.deepEqual(getPins(parse(result.text)).anchor?.points, [
      [0, 10],
      [100, 10],
    ]);
  });

  it('人が動かした寸法（pins.<id>.offset）を消そうとしたら、競合として出す', () => {
    const current = HUMAN.replace('pins:\n', 'pins:\n  length:\n    offset: 40\n');
    const proposal = SAME.replace(/dims:\n(?: {2,}.*\n)+/, '');
    const result = merge(current, proposal);
    assert.ok(parse(result.text).dimIds().includes('length'));
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'length', reason: 'removed' }]);
  });

  it('提案が節ごと書かなければ、人が触っていないものは消え、空の節は残さない', () => {
    const current = HUMAN.replace(/ {2}anchor:\n.*\n/, '');
    const proposal = SAME.replace(/paths:\n(?: {2,}.*\n)+/, '');
    const result = merge(current, proposal);
    assert.doesNotMatch(result.text, /^paths:/m);
  });

  it('正本に無い節を提案が足したら、pins の前に入る', () => {
    const current = HUMAN.replace(/dims:\n(?: {2,}.*\n)+/, '');
    const result = merge(current, SAME);
    assert.ok(parse(result.text).dimIds().includes('length'));
    assert.ok(result.text.indexOf('dims:') < result.text.indexOf('pins:'));
  });

  it('選択 — 線について AI を採ると、線も pin も消える', () => {
    const proposal = replaced('  - id: anchor\n    points: [ [ 0, 0 ], [ 100, 0 ] ]\n', '');
    const result = merge(HUMAN, proposal);
    const after = parse(resolve(result.text, result.conflicts[0]!, 'ai'));
    assert.ok(!after.pathIds().includes('anchor'));
    assert.equal('anchor' in getPins(after), false);
  });
});

describe('place — as で照合する', () => {
  it('足した置き方が入る', () => {
    const proposal = replaced('paths:', '  - { part: par64, as: L3, at: { x: 500, y: 80 } }\npaths:');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /- \{ part: par64, as: L3, at: \{ x: 500, y: 80 \} \}/);
  });

  it('置き方の set の変更が入り、人の註は残る', () => {
    const proposal = replaced(
      '    at: { x: 120, y: 80 }',
      '    at: { x: 120, y: 80 }\n    set: { body: { color: red } }',
    );
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /as: L1 # 上手の 1 灯目/);
    assert.match(result.text, /set: \{ body: \{ color: red \} \}/);
  });

  it('人が触っていない置き方を消すと消え、そこへ繋がる線も消える', () => {
    const proposal = replaced('  - { part: par64, as: L2, at: { x: 300, y: 80 } }\n', '').replace(
      '  - { from: L1.body, to: L2.body }\n',
      '',
    );
    const result = merge(HUMAN, proposal);
    assert.doesNotMatch(result.text, /as: L2/);
    assert.equal(parse(result.text).edges().length, 0);
    assert.deepEqual(result.conflicts, []);
  });

  it('中を人が直した置き方（pins["L1.ch"]）を消そうとしたら、消さずに競合として出す。線も残す', () => {
    const proposal = replaced(
      '  - part: par64\n    as: L1 # 上手の 1 灯目\n    at: { x: 120, y: 80 }\n',
      '',
    ).replace('  - { from: L1.body, to: L2.body }\n', '');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /as: L1/);
    assert.equal(parse(result.text).edges().length, 1);
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'L1', reason: 'removed' }]);
    assert.equal(getPins(parse(result.text))['L1.ch']?.label, '101');
  });

  it('動かした置き方（pins.<as>.position）を消そうとしても、競合として出す', () => {
    const current = HUMAN.replace('pins:\n', 'pins:\n  L2:\n    position: { x: 310, y: 90 }\n');
    const proposal = replaced('  - { part: par64, as: L2, at: { x: 300, y: 80 } }\n', '');
    const result = merge(current, proposal);
    assert.match(result.text, /as: L2/);
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'L2', reason: 'removed' }]);
  });

  it('選択 — 置き方について AI を採ると、置き方も中の pin も消える', () => {
    const proposal = replaced(
      '  - part: par64\n    as: L1 # 上手の 1 灯目\n    at: { x: 120, y: 80 }\n',
      '',
    ).replace('  - { from: L1.body, to: L2.body }\n', '');
    const result = merge(HUMAN, proposal);
    const text = resolve(result.text, result.conflicts[0]!, 'ai');
    assert.doesNotMatch(text, /as: L1/);
    assert.equal('L1.ch' in getPins(parse(text)), false);
    assert.equal(parse(text).edges().length, 0);
  });
  it('選択 — 置き方について人を採ると、中の手直しに印が付く（正本に書く）', () => {
    const proposal = replaced(
      '  - part: par64\n    as: L1 # 上手の 1 灯目\n    at: { x: 120, y: 80 }\n',
      '',
    ).replace('  - { from: L1.body, to: L2.body }\n', '');
    const result = merge(HUMAN, proposal);
    const text = resolve(result.text, result.conflicts[0]!, 'human');
    assert.match(text, /as: L1/);
    assert.equal(getPins(parse(text))['L1.ch']?.locked, true);
  });
});

describe('parts — 部品の名前で照合し、中は id で照合する', () => {
  it('部品の中の変更が入り、触っていない中の行と人の註は残る', () => {
    const proposal = replaced('marker: circle,', 'marker: square,');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /# 器具の形。人が書いた註\n {2}par64:/);
    assert.match(result.text, /- \{ id: ch, label: "", marker: none, at: \{ x: 2, y: 28 \}, size: \{ w: 20, h: 12 \} \}/);
    assert.ok(result.text.includes('marker: square'));
  });

  it('足した部品が入る', () => {
    const proposal = replaced('place:', '  stone:\n    nodes:\n      - { id: s, marker: circle }\nplace:');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /stone:\n {4}nodes:\n {6}- \{ id: s, marker: circle \}/);
  });

  it('どこにも置かれなくなった部品は消える', () => {
    const proposal = SAME.replace(/parts:\n(?: {2,}.*\n)+/, '')
      .replace(/place:\n(?: {2,}.*\n)+/, '')
      .replace('  - { from: L1.body, to: L2.body }\n', '');
    const current = HUMAN.replace(/ {2}L1\.ch:\n.*\n/, '');
    const result = merge(current, proposal);
    assert.doesNotMatch(result.text, /par64:/);
    assert.deepEqual(result.conflicts, []);
  });

  it('競合で残した置き方が使う部品は、提案に無くても残す（片方だけ残さない）', () => {
    const proposal = SAME.replace(/parts:\n(?: {2,}.*\n)+/, '')
      .replace(/place:\n(?: {2,}.*\n)+/, '')
      .replace('  - { from: L1.body, to: L2.body }\n', '');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /par64:\n {4}nodes:/);
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'L1', reason: 'removed' }]);
  });

  it('人が直した中の節（pins["L1.ch"]）を部品から消そうとしたら、消さずに競合として出す', () => {
    const proposal = replaced(
      '      - { id: ch, label: "", marker: none, at: { x: 2, y: 28 }, size: { w: 20, h: 12 } }\n',
      '',
    );
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /- \{ id: ch,/);
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'L1.ch', reason: 'removed' }]);
  });

  it('選択 — 中の節について AI を採ると、部品から消え、pin も消える', () => {
    const proposal = replaced(
      '      - { id: ch, label: "", marker: none, at: { x: 2, y: 28 }, size: { w: 20, h: 12 } }\n',
      '',
    );
    const result = merge(HUMAN, proposal);
    const text = resolve(result.text, result.conflicts[0]!, 'ai');
    assert.doesNotMatch(text, /id: ch/);
    assert.equal('L1.ch' in getPins(parse(text)), false);
  });
});

describe('scale — 語ごとに入れる', () => {
  it('scale.unit を足した提案が入り、書き方（1 行）は保つ', () => {
    const proposal = replaced('scale: { mm: 25 }', 'scale: { mm: 25, unit: m }');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /^scale: \{ mm: 25, unit: m \}$/m);
  });

  it('提案が scale を書かなければ、人の scale に触らない', () => {
    const proposal = replaced('scale: { mm: 25 }\n', '');
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /^scale: \{ mm: 25 \}$/m);
  });
});

describe('S1 — AI が 1 周回っても、人の手直しが数え続けられる', () => {
  it('線を足す提案のあとも、描き直した線と置いたものの手直しが 2 つ数えられる', () => {
    const before = measure(HUMAN);
    const proposal = replaced('dims:', '  - id: pond\n    points: [ [ 0, 90 ], [ 100, 90 ] ]\ndims:');
    const after = measure(merge(HUMAN, proposal).text);
    assert.equal(before.touched, 2);
    assert.equal(after.touched, 2);
    assert.equal(after.elements, before.elements + 1);
  });
});
