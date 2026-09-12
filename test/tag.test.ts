/**
 * 符号（`nodes[].tag`）が、箱の隅に出ること（B5 / D22）。
 *
 * ## なぜ形ではなく文字なのか
 *
 * 「各業界の専門性を満たしたい」という指示（2026-09-12）を、
 * **図形を増やす**と読むと、ロードマップが自分で採らないと書いた道に戻る。
 *
 * 構造図の記号を調べたら、解き方が変わった。
 * `C1`（柱）・`G1`（大梁）・`S1`（床）・`F1`（基礎）は**絵ではなく符号**で、
 * **矩形の中に書く 2 文字**だった。
 * 一級建築士が読んでいるのは部材の形ではなく、**符号と断面リストの対応**。
 *
 * 配管の `2"-CS-101`、電気の盤番号、工場の工程番号も同じ形をしている。
 * **文字を置く場所さえあれば、業界が増えても `type` は 11 語のまま。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const SOURCE = `version: 1
title: 2 階 床伏図
nodes:
  - id: c1
    label: 柱
    tag: C1
    technology: 700×700
  - id: g1
    label: 大梁
    tag: G1
edges:
  - from: c1
    to: g1
`;

async function svg(text: string): Promise<string> {
  return render(await layout(text));
}

describe('符号を読む（nodes[].tag）', () => {
  it('正本に書いた符号が、箱まで届く', async () => {
    const placed = await layout(SOURCE);
    assert.equal(placed.boxes.find((b) => b.id === 'c1')!.tag, 'C1');
    assert.equal(placed.boxes.find((b) => b.id === 'g1')!.tag, 'G1');
  });

  it('書かなければ null。**既定で何かを出さない**', async () => {
    const placed = await layout('version: 1\nnodes:\n  - id: a\n    label: あ\n');
    assert.equal(placed.boxes[0]!.tag, null);
  });

  it('数字で書かれた符号も文字として読む（`tag: 101`）', async () => {
    const placed = await layout('version: 1\nnodes:\n  - id: a\n    tag: 101\n');
    assert.equal(placed.boxes[0]!.tag, '101');
  });
});

describe('符号を描く', () => {
  it('符号が SVG に出る', async () => {
    const out = await svg(SOURCE);
    assert.ok(out.includes('>C1<'), '符号 C1 が描かれていない');
    assert.ok(out.includes('>G1<'), '符号 G1 が描かれていない');
  });

  it('**ラベルとは別に出る。** 名前を符号で置き換えない', async () => {
    const out = await svg(SOURCE);
    assert.ok(out.includes('>柱<'), '符号を出したらラベルが消えた');
  });

  it('**副題とも別に出る。** `technology` を食わない', async () => {
    const out = await svg(SOURCE);
    assert.ok(out.includes('>700×700<'), '副題が消えた');
  });

  it('符号は箱の左上に置く（中央のラベルと重ねない）', async () => {
    const placed = await layout(SOURCE);
    const box = placed.boxes.find((b) => b.id === 'c1')!;
    const out = render(placed);
    const m = out.match(/<text x="(-?\d+)" y="(-?\d+)"[^>]*>C1</)!;
    const [x, y] = m.slice(1).map(Number);
    assert.ok(x! < box.x + box.w / 2, '符号が左半分に無い');
    assert.ok(y! < box.y + box.h / 2, '符号が上半分に無い');
    assert.ok(x! >= box.x, '符号が箱の外へ出た');
    assert.ok(y! >= box.y, '符号が箱の上へ出た');
  });

  it('符号は中央揃えにしない（左端に揃える）', async () => {
    const out = await svg(SOURCE);
    const m = out.match(/<text [^>]*>C1</)!;
    assert.ok(!m[0].includes('text-anchor="middle"'), '符号が中央揃えになっている');
  });

  it('符号が無い箱には、符号の文字を出さない', async () => {
    const out = await svg('version: 1\nnodes:\n  - id: a\n    label: あ\n');
    assert.equal(out.match(/<text /g)!.length, 1, 'ラベル以外の文字が出ている');
  });

  it('**符号が長くても箱からはみ出さない**（幅に数える）', async () => {
    const placed = await layout('version: 1\nnodes:\n  - id: a\n    label: 管\n    tag: 2"-CS-101-A3\n');
    const box = placed.boxes[0]!;
    assert.ok(box.w >= 110, `幅 ${box.w} は符号 2"-CS-101-A3 に足りない`);
  });

  it('符号は escape される（`<` を書いても壊れない）', async () => {
    const out = await svg('version: 1\nnodes:\n  - id: a\n    tag: "<C1>"\n');
    assert.ok(out.includes('&lt;C1&gt;'), '符号が escape されていない');
    assert.ok(!out.includes('><C1><'), '生の < が出ている');
  });
});
