/**
 * 図の設定と作図の節を、提案から人の正本へ入れる（仕様 §6.2）。
 *
 * **直す前は、merge が `title` も `palette` も `let` も見ていなかった。**
 * 提案が題を変えても・色の鍵を足しても・作図の定数を変えても、正本は 1 文字も変わらず、
 * 競合も出ず、`propose` は ok を返した。頼んだ変更が黙って捨てられていた。
 *
 * 規則 ——
 *
 * 1. 提案が書いた設定は、値が変わったところだけ入れる。**提案が書かなければ触らない**（`scale` と同じ）
 * 2. `markup`（赤入れ）と `review`（人が見た印）は**提案から読まない**（`pins` と同じ）
 * 3. 人が `pins` で決めた作図の定数は、提案で書き換えない。**食い違いは競合で返す**
 * 4. 図の種類（`kind`）は入れない。**前提が違う提案なので、競合で返す**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getPins, parse } from '../src/format.ts';
import { merge, resolve } from '../src/merge.ts';

const HUMAN = `version: 1
# 人が付けた題
title: 駅の案内 # 仮
kind: placement
direction: down
palette:
  # 路線の色
  JY: "#80c241"
  JC: "#f15a22"
styles:
  living: { fill: JY, hatch: rows }
grid:
  x:
    - { id: X1, at: 40 } # 西の芯
    - { id: X2, at: 240 }
floors:
  - B1
  - 1F
views:
  - id: upper
    title: 上
    at: { x: 0, y: 0 }
    size: { w: 100, h: 100 }
sources:
  - { name: 国土地理院, retrieved: 2026-09-29 }
nodes:
  - { id: gate, label: 改札, at: { x: 40, y: 40 }, size: { w: 120, h: 40 } }
review:
  at: 2026-09-08T04:00:00Z
  of: 3f2a1b9c7e4d5068
markup:
  - note: ここを太く
    at: { x: 120, y: 40 }
pins:
  gate:
    label: 改札口
`;

/** HUMAN と同じ意味の提案（pins・review・markup は持たない）。 */
const SAME = HUMAN.slice(0, HUMAN.indexOf('review:'));

function replaced(from: string, to: string): string {
  assert.ok(SAME.includes(from), `提案の元に無い: ${from}`);
  return SAME.replace(from, to);
}

function value(text: string, key: string): unknown {
  return parse(text).doc.toJS()[key];
}

describe('図の設定 — 何も変えない提案', () => {
  it('同じ意味の提案なら、正本は 1 文字も変わらない', () => {
    const result = merge(HUMAN, SAME);
    assert.equal(result.text, HUMAN);
    assert.deepEqual(result.conflicts, []);
  });

  it('提案が設定を書かなければ触らない（消してではなく、触っていない）', () => {
    const bare = ['version: 1', 'kind: placement', 'nodes:', '  - { id: gate, label: 改札, at: { x: 40, y: 40 }, size: { w: 120, h: 40 } }', ''].join('\n');
    const result = merge(HUMAN, bare);
    for (const key of ['title', 'direction', 'palette', 'styles', 'grid', 'floors', 'views', 'sources']) {
      assert.deepEqual(value(result.text, key), value(HUMAN, key), key);
    }
  });
});

describe('図の設定 — 提案が変えたものは入る', () => {
  it('題を変える（行の註は残す）', () => {
    const result = merge(HUMAN, replaced('title: 駅の案内 # 仮', 'title: 新宿駅の案内'));
    assert.match(result.text, /^title: 新宿駅の案内 # 仮$/m);
    assert.match(result.text, /# 人が付けた題/);
    assert.deepEqual(result.conflicts, []);
  });

  it('流れる向き・折り返し・矢印・方位・投影を変える／足す', () => {
    const proposal = replaced('direction: down', 'direction: right\nwrap: true\narrows: false\nnorth: left\nprojection: isometric');
    const result = merge(HUMAN, proposal);
    assert.equal(value(result.text, 'direction'), 'right');
    assert.equal(value(result.text, 'wrap'), true);
    assert.equal(value(result.text, 'arrows'), false);
    assert.equal(value(result.text, 'north'), 'left');
    assert.equal(value(result.text, 'projection'), 'isometric');
  });

  it('足した設定は節（nodes）より前に入る', () => {
    const result = merge(HUMAN, replaced('direction: down', 'direction: down\nwall: { outer: 12 }'));
    assert.ok(result.text.indexOf('wall:') < result.text.indexOf('nodes:'));
  });

  it('色の鍵は鍵ごとに入れる（変えていない鍵の註と行は残す）', () => {
    const result = merge(HUMAN, replaced('JC: "#f15a22"', 'JC: "#ff0000"\n  G: "#f39700"'));
    assert.match(result.text, /# 路線の色\n {2}JY: "#80c241"/);
    assert.deepEqual(value(result.text, 'palette'), { JY: '#80c241', JC: '#ff0000', G: '#f39700' });
  });

  it('色の鍵を消す', () => {
    const result = merge(HUMAN, replaced('  JC: "#f15a22"\n', ''));
    assert.deepEqual(value(result.text, 'palette'), { JY: '#80c241' });
  });

  it('見せ方の表を変える（書き方は提案のまま）', () => {
    const result = merge(HUMAN, replaced('living: { fill: JY, hatch: rows }', 'living: { fill: JC, hatch: grid }'));
    assert.match(result.text, /living: \{ fill: JC, hatch: grid \}/);
  });

  it('通り芯は id で照合する（足すのは末尾、変えていない芯の註は残す）', () => {
    const result = merge(HUMAN, replaced('    - { id: X2, at: 240 }', '    - { id: X2, at: 250 }\n    - { id: X3, at: 440 }'));
    assert.match(result.text, /- \{ id: X1, at: 40 \} # 西の芯/);
    assert.deepEqual(value(result.text, 'grid'), {
      x: [
        { id: 'X1', at: 40 },
        { id: 'X2', at: 250 },
        { id: 'X3', at: 440 },
      ],
    });
  });

  it('並び順を変えた並びは、提案の並びで入れる（順に意味がある並びを壊さない）', () => {
    const result = merge(HUMAN, replaced('  - B1\n  - 1F', '  - B2\n  - B1\n  - 1F'));
    assert.deepEqual(value(result.text, 'floors'), ['B2', 'B1', '1F']);
  });

  it('図（views）と出典（sources）を変える', () => {
    const proposal = replaced('    title: 上\n', '    title: 上甲板\n').replace('retrieved: 2026-09-29', 'retrieved: 2026-10-01');
    const result = merge(HUMAN, proposal);
    assert.equal((value(result.text, 'views') as { title: string }[])[0]?.title, '上甲板');
    assert.equal((value(result.text, 'sources') as { retrieved: string }[])[0]?.retrieved, '2026-10-01');
  });

  it('`null` と書いた設定は消す（書かないのは「触っていない」なので、消すには明示が要る）', () => {
    const result = merge(HUMAN, replaced('direction: down', 'direction: null'));
    assert.equal(/^direction:/m.test(result.text), false);
  });

  it('正本に無い設定を、空のまま足さない', () => {
    const result = merge(HUMAN, replaced('direction: down', 'direction: down\nwall: {}'));
    assert.equal(result.text.includes('wall:'), false);
  });
});

describe('提案から読まないもの', () => {
  it('提案の赤入れ（markup）は読まない。人の赤入れは残る', () => {
    const proposal = `${SAME}markup:\n  - note: AI が書いた付箋\n    at: { x: 0, y: 0 }\n`;
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /ここを太く/);
    assert.equal(result.text.includes('AI が書いた付箋'), false);
  });

  it('提案の review は読まない（AI が自分の絵を承認できない）', () => {
    const proposal = `${SAME}review:\n  at: 2030-01-01T00:00:00Z\n  of: ffffffffffffffff\n`;
    const result = merge(HUMAN, proposal);
    assert.match(result.text, /of: 3f2a1b9c7e4d5068/);
    assert.equal(result.text.includes('ffffffffffffffff'), false);
  });

  it('正本に赤入れが無ければ、提案の赤入れで生やさない', () => {
    const plain = SAME;
    const result = merge(plain, `${SAME}markup:\n  - note: x\n    at: { x: 0, y: 0 }\n`);
    assert.equal(result.text.includes('markup'), false);
  });
});

describe('図の種類（kind）—— 入れずに競合で返す', () => {
  it('配置図を構成図へ変える提案は入れない', () => {
    const result = merge(HUMAN, replaced('kind: placement', 'kind: structure'));
    assert.match(result.text, /^kind: placement$/m);
    assert.deepEqual(result.conflicts, [{ kind: 'kind-proposed', elementId: 'kind', human: 'placement', ai: 'structure' }]);
  });

  it('書いていない kind は structure と同じ（食い違いにしない）', () => {
    const structure = ['version: 1', 'nodes:', '  - id: a', ''].join('\n');
    const result = merge(structure, ['version: 1', 'kind: structure', 'nodes:', '  - id: a', ''].join('\n'));
    assert.deepEqual(result.conflicts, []);
    assert.equal(result.text, structure);
  });

  it('「提案を採る」で種類が変わる', () => {
    const result = merge(HUMAN, replaced('kind: placement', 'kind: structure'));
    const text = resolve(result.text, result.conflicts[0]!, 'ai');
    assert.match(text, /^kind: structure$/m);
  });

  it('「自分を採る」では何も変えない', () => {
    const result = merge(HUMAN, replaced('kind: placement', 'kind: structure'));
    assert.equal(resolve(result.text, result.conflicts[0]!, 'human'), result.text);
  });
});

/** 作図。人が `R` を pin で 120 にしてある。 */
const DRAWN = `version: 1
kind: construction
let:
  R: 100 # 基準
  H: 200
lengths:
  stem: R * 2
steps:
  - id: O
    at: { x: 0, y: 0 }
  - id: bowl
    center: O
    r: R
segments:
  - { from: O, to: bowl }
pins:
  R:
    value: 120
`;
const DRAWN_SAME = DRAWN.slice(0, DRAWN.indexOf('pins:'));

function drawn(from: string, to: string): string {
  assert.ok(DRAWN_SAME.includes(from), `提案の元に無い: ${from}`);
  return DRAWN_SAME.replace(from, to);
}

describe('作図の節 —— 人が pin した定数は人のもの', () => {
  it('同じ意味の提案なら、正本は 1 文字も変わらない', () => {
    assert.equal(merge(DRAWN, DRAWN_SAME).text, DRAWN);
  });

  it('pin の無い定数は、提案の値が入る', () => {
    const result = merge(DRAWN, drawn('H: 200', 'H: 240'));
    assert.match(result.text, /^ {2}H: 240$/m);
    assert.match(result.text, /R: 100 # 基準/);
    assert.deepEqual(result.conflicts, []);
  });

  it('pin した定数を提案が変えたら、入れずに競合で返す', () => {
    const result = merge(DRAWN, drawn('R: 100 # 基準', 'R: 150'));
    assert.match(result.text, /R: 100 # 基準/);
    assert.deepEqual(result.conflicts, [{ kind: 'value-proposed', elementId: 'R', human: 120, ai: 150 }]);
  });

  it('pin した定数を提案が消したら、消さずに競合で返す', () => {
    const result = merge(DRAWN, drawn('  R: 100 # 基準\n', ''));
    assert.match(result.text, /R: 100/);
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', elementId: 'R', reason: 'removed' }]);
  });

  it('「提案を採る」で、定数が提案の値になり pin が外れる', () => {
    const result = merge(DRAWN, drawn('R: 100 # 基準', 'R: 150'));
    const text = resolve(result.text, result.conflicts[0]!, 'ai');
    assert.equal((parse(text).doc.toJS() as { let: { R: number } }).let.R, 150);
    assert.equal(getPins(parse(text)).R, undefined);
  });

  it('「自分を採る」は正本に書く。以後は聞き直さない', () => {
    const result = merge(DRAWN, drawn('R: 100 # 基準', 'R: 150'));
    const text = resolve(result.text, result.conflicts[0]!, 'human');
    assert.equal(getPins(parse(text)).R?.locked, true);
    const again = merge(text, drawn('R: 100 # 基準', 'R: 150'));
    assert.deepEqual(again.conflicts, [{ kind: 'value-suppressed', elementId: 'R', ai: 150 }]);
  });

  it('手順（steps）と線分（segments）の変更が入る', () => {
    const proposal = drawn('    r: R\n', '    r: H\n').replace('  - { from: O, to: bowl }', '  - { from: O, to: bowl, weight: 2 }');
    const result = merge(DRAWN, proposal);
    const js = parse(result.text).doc.toJS() as { steps: { r?: string }[]; segments: { weight?: number }[] };
    assert.equal(js.steps[1]?.r, 'H');
    assert.equal(js.segments[0]?.weight, 2);
  });

  it('手順の途中へ足した点は、提案の並びで入る（書いた順に評価するので、末尾へ回さない）', () => {
    const proposal = drawn('  - id: bowl\n', '  - id: P\n    at: { x: 10, y: 0 }\n  - id: bowl\n');
    const result = merge(DRAWN, proposal);
    const ids = (parse(result.text).doc.toJS() as { steps: { id: string }[] }).steps.map((step) => step.id);
    assert.deepEqual(ids, ['O', 'P', 'bowl']);
  });

  it('足した節（arcs）は pins より前に入る', () => {
    const result = merge(DRAWN, `${DRAWN_SAME}arcs:\n  - { of: bowl, from: 0, to: 180 }\n`);
    assert.ok(result.text.indexOf('arcs:') < result.text.indexOf('pins:'));
  });
});
