/**
 * **赤入れ**（`markup`。`src/markup.ts`）。
 *
 * 2026-10-20。図の上に、人へ伝えるための手書きと付箋を重ねたい、という声から。
 * **図には効かない。** 描画にも、意味の指紋（`review`）にも、AI の提案のマージにも入らない。
 * 正本の中に置くので、ファイルを渡せば赤入れも一緒に渡る（D4：人の指定を別ファイルへ逃がさない）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { MARKUP_COLORS, markupOf } from '../src/markup.ts';
import { merge } from '../src/merge.ts';
import { render } from '../src/render.ts';
import { meaningOf } from '../src/review.ts';
import { validate } from '../src/validate.ts';

const doc = (markup: string): string =>
  'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 部屋\n    at: { x: 0, y: 0 }\n    size: { w: 300, h: 200 }\n' + markup;

const INK = 'markup:\n  - ink: [[10, 20], [40, 60], [80, 70]]\n    color: blue\n    width: thick\n';
const NOTE = 'markup:\n  - note: ここを太く\n    at: { x: 120, y: 40 }\n    on: a\n';

describe('赤入れ（markup）を読む', () => {
  it('**手書きの線と付箋を読む。色と太さを書かなければ赤・普通**', () => {
    const items = markupOf([
      { ink: [[0, 0], [10, 10]] },
      { note: '確認', at: { x: 5, y: 6 }, on: 'a', color: 'green' },
    ]);
    assert.deepEqual(items, [
      { kind: 'ink', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], color: 'red', width: 'normal', on: null },
      { kind: 'note', text: '確認', at: { x: 5, y: 6 }, color: 'green', width: 'normal', on: 'a' },
    ]);
  });

  it('**読めない項目は落とす**（線が 2 点に満たない、付箋に置き場所が無い、どちらでもない）', () => {
    assert.deepEqual(markupOf([{ ink: [[0, 0]] }, { note: 'x' }, { foo: 1 }, 'str', null]), []);
    assert.deepEqual(markupOf('not a list'), []);
  });

  it('**選べる色は数色に絞る**（赤・青・緑・黒・橙）', () => {
    assert.deepEqual(Object.keys(MARKUP_COLORS), ['red', 'blue', 'green', 'black', 'orange']);
  });
});

describe('赤入れは、図に効かない', () => {
  it('**書き出す図は、赤入れがあっても無くても同じ**', async () => {
    const plain = render(await layout(doc('')), 'light', 'safe', true);
    assert.equal(render(await layout(doc(INK)), 'light', 'safe', true), plain);
    assert.equal(render(await layout(doc(NOTE)), 'light', 'safe', true), plain);
  });

  it('**人が見た印（review）を外さない** —— 赤入れは図の意味ではない', () => {
    assert.equal(meaningOf(doc(INK)), meaningOf(doc('')));
  });

  it('**AI の提案を入れても、人の赤入れは残る。提案に書かれた赤入れは採らない**', () => {
    const current = doc(NOTE);
    const proposal = doc('markup:\n  - note: AI が書いた\n    at: { x: 0, y: 0 }\n').replace('部屋', '居間');
    const { text } = merge(current, proposal);
    assert.match(text, /note: ここを太く/);
    assert.doesNotMatch(text, /AI が書いた/);
    assert.match(text, /label: 居間/);
  });
});

describe('赤入れの検査', () => {
  const codes = (markup: string): string[] => validate(doc(markup)).map((f) => f.code).filter((c) => c.startsWith('markup'));

  it('**正しく書いた赤入れには何も言わない**', () => {
    assert.deepEqual(codes(INK), []);
    assert.deepEqual(codes(NOTE), []);
  });

  it('**一覧でなければ知らせる**', () => {
    assert.deepEqual(codes('markup: ここ\n'), ['markup-not-list']);
  });

  it('**線でも付箋でもない項目、2 点に満たない線、置き場所の無い付箋を知らせる**', () => {
    assert.deepEqual(codes('markup:\n  - { color: red }\n'), ['markup-kind']);
    assert.deepEqual(codes('markup:\n  - ink: [[0, 0]]\n'), ['markup-ink-short']);
    assert.deepEqual(codes('markup:\n  - note: x\n'), ['markup-note-at']);
  });

  it('**選べない色・太さを知らせる**（太さは thin / normal / thick）', () => {
    assert.deepEqual(codes('markup:\n  - ink: [[0, 0], [1, 1]]\n    color: pink\n'), ['markup-color']);
    assert.deepEqual(codes('markup:\n  - ink: [[0, 0], [1, 1]]\n    width: heavy\n'), ['markup-width']);
  });

  it('**結んだ先の箱が無ければ「行き先の無い赤入れ」として知らせる**（黙って捨てない）', () => {
    assert.deepEqual(codes('markup:\n  - note: x\n    at: { x: 0, y: 0 }\n    on: gone\n'), ['markup-orphaned']);
  });
});
