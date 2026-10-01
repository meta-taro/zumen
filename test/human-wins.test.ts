/**
 * **人の手直しが、AI の書いた値に勝つ**（S1 の判定基準 3.1 / D5）。
 *
 * この製品の本体価値はここ 1 点しかない。
 * ここが崩れたら、**残るのは「機能の少ない作図ソフト」**（`.claude/roadmap.md`）。
 *
 * ## なぜいま書くか
 *
 * S1 の往復実験を通したあと、**AI が書ける場所を 4 つ増やした**
 * —— `nodes[].at`（置き場所）・`nodes[].size`（大きさ）・
 * `nodes[].tag`（符号）・`nodes[].openings`（建具）。
 *
 * **増やした場所が、人の指定を上書きしていないかは測っていなかった。**
 * とくに `at` は `pins.position` と同じものを指すので、
 * 適用の順が 1 行入れ替わるだけで、**人が動かした位置が黙って戻る。**
 *
 * 実験は一度きりだが、テストは毎回走る。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { merge } from '../src/merge.ts';

/** 人が位置・大きさ・ラベル・体裁を直した配置図。**AI も同じ要素へ書いている。** */
const BOTH = `version: 1
kind: placement
pins:
  a:
    position: { x: 500, y: 400 }
    size: { w: 300, h: 200 }
    label: 人が付けた名前
    appearance: primary
nodes:
  - id: a
    label: AI が付けた名前
    tag: C1
    at: { x: 10, y: 20 }
    size: { w: 80, h: 40 }
  - id: b
    label: 隣
    at: { x: 200, y: 20 }
    size: { w: 80, h: 40 }
`;

describe('配置図で、人の指定が AI の指定に勝つ', () => {
  it('**置き場所は人が勝つ**（`pins.position` > `nodes[].at`）', async () => {
    const box = (await layout(BOTH)).boxes.find((b) => b.id === 'a')!;
    assert.equal(box.x, 500, 'AI の at が人の位置を上書きした');
    assert.equal(box.y, 400);
  });

  it('**大きさも人が勝つ**（`pins.size` > `nodes[].size`）', async () => {
    const box = (await layout(BOTH)).boxes.find((b) => b.id === 'a')!;
    assert.equal(box.w, 300);
    assert.equal(box.h, 200);
  });

  it('名前も体裁も人が勝つ', async () => {
    const box = (await layout(BOTH)).boxes.find((b) => b.id === 'a')!;
    assert.equal(box.label, '人が付けた名前');
    assert.equal(box.appearance, 'primary');
  });

  it('**人が直した箱は `pinned` として出る。** 見えないと、戻されても気づけない', async () => {
    const box = (await layout(BOTH)).boxes.find((b) => b.id === 'a')!;
    assert.equal(box.pinned, true);
  });

  it('人が触っていない箱は、AI の `at` のまま', async () => {
    const box = (await layout(BOTH)).boxes.find((b) => b.id === 'b')!;
    assert.equal(box.x, 200, 'AI が書いた置き場所が効いていない');
    assert.equal(box.y, 20);
  });

  it('**人が動かしても、AI の符号は残る。** 別のものなので奪い合わない', async () => {
    const box = (await layout(BOTH)).boxes.find((b) => b.id === 'a')!;
    assert.equal(box.tag, 'C1');
  });
});

describe('取り込みで、人の指定が消えない', () => {
  /** AI が全部書き直した提案。**人の `pins` は無い**（AI は書けない。D5）。 */
  const PROPOSAL = `version: 1
kind: placement
nodes:
  - id: a
    label: AI が付け直した名前
    tag: G1
    at: { x: 999, y: 999 }
    size: { w: 60, h: 60 }
    openings:
      - { kind: door, side: top }
  - id: b
    label: 隣
    at: { x: 200, y: 20 }
`;

  it('**`pins` が丸ごと残る**（AI の提案に `pins` が無くても消さない）', () => {
    const { text } = merge(BOTH, PROPOSAL);
    assert.match(text, /position: \{ x: 500, y: 400 \}/);
    assert.match(text, /label: 人が付けた名前/);
    assert.match(text, /appearance: primary/);
  });

  it('取り込んだあとも、描くと人の値が出る', async () => {
    const { text } = merge(BOTH, PROPOSAL);
    const box = (await layout(text)).boxes.find((b) => b.id === 'a')!;
    assert.equal(box.x, 500, '取り込みで人の位置が消えた');
    assert.equal(box.w, 300, '取り込みで人の大きさが消えた');
    assert.equal(box.label, '人が付けた名前');
    assert.equal(box.pinned, true);
  });

  it('**AI が足した符号と建具は入る。** 人の指定と競合しないものは取り込む', () => {
    const { text } = merge(BOTH, PROPOSAL);
    assert.match(text, /tag: G1/);
    assert.match(text, /kind: door/);
  });

  it('AI の新しい `at` も入る（人が触っていない要素の位置は動いてよい）', () => {
    const { text } = merge(BOTH, PROPOSAL);
    assert.ok(text.includes('999'), 'AI の置き場所が捨てられた');
  });
});
