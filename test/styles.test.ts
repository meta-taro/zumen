/**
 * **見せ方の表（`styles` ／ `nodes[].style`）**（2026-09-28。販売図面のブラッシュアップ）。
 *
 * 方針 —— 業者ごとの作風を、**どのパターンでも作れて、組み合わせもできる**ように広げる。
 *
 * 販売図面の作風の差は、**間取りではなく見せ方**にある（LDK を塗るか、床を縞にするか、水まわりをタイルにするか）。
 * 部屋ごとに色と模様を書くと、作風を変えるたびに全部の部屋を書き換えることになる。
 * **見せ方を表にして 1 か所に置き、部屋はその名前だけを持つ。** 表を差し替えれば作風が変わる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { validate } from '../src/validate.ts';

const PLAN = (styles: string, node = '    style: living\n') => `version: 1
kind: placement
palette:
  LD: "#f3d9d0"
  Wall: "#555555"
${styles}
nodes:
  - id: ldk
    label: LDK
${node}    at: { x: 0, y: 0 }
    size: { w: 200, h: 120 }
`;

const STYLES = `styles:
  living: { fill: LD, color: Wall, hatch: rows }`;

async function boxOf(text: string) {
  const placed = await layout(text);
  const box = placed.boxes.find((b) => b.id === 'ldk');
  assert.ok(box !== undefined);
  return box;
}

describe('見せ方の表', () => {
  it('部屋は `style` の名前だけで、面の色・線の色・模様を受け取る', async () => {
    const box = await boxOf(PLAN(STYLES));
    assert.equal(box.tint, '#f3d9d0');
    assert.equal(box.color, '#555555');
    assert.equal(box.hatch, 'rows');
  });

  it('**部屋に直接書いた値が勝つ**（表は既定で、部屋ごとの例外を消さない）', async () => {
    const box = await boxOf(PLAN(STYLES, '    style: living\n    hatch: grid\n'));
    assert.equal(box.hatch, 'grid');
    assert.equal(box.tint, '#f3d9d0');
  });

  it('**表を差し替えるだけで、作風が変わる**（間取りは 1 行も変えない）', async () => {
    const gray = await boxOf(PLAN(`styles:\n  living: { hatch: solid }`));
    const color = await boxOf(PLAN(STYLES));
    assert.equal(gray.hatch, 'solid');
    assert.equal(gray.tint, null);
    assert.equal(color.hatch, 'rows');
  });

  it('表に無い名前は警告する（見せ方なしで描く）', () => {
    const found = validate(PLAN(STYLES, '    style: bedroom\n'));
    assert.ok(found.some((f) => f.code === 'style-unknown'), JSON.stringify(found.map((f) => f.code)));
  });

  it('表に書けるのは fill / color / hatch だけ。ほかの語は警告する', () => {
    const found = validate(PLAN(`styles:\n  living: { fill: LD, size: 3 }`));
    assert.ok(found.some((f) => f.code === 'style-key-unknown'), JSON.stringify(found.map((f) => f.code)));
  });

  it('正しく書けば、何も言わない', () => {
    const found = validate(PLAN(STYLES)).filter((f) => f.code.startsWith('style'));
    assert.deepEqual(found, []);
  });
});
