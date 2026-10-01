/**
 * **フィートとインチで寸法を書く**（2026-09-16）。
 *
 * ## なぜ足したか
 *
 * `lengthText` は mm と m しか持っていなかった。
 * アメリカの間取り図を描いたら、44 フィートの家に **`13,411`** と出た。
 * **その業界の人が読める単位で書かないなら、寸法を書いていないのと同じ**
 * —— 保安距離図に `200,000` と出たときと、まったく同じ話（`src/units.ts`）。
 *
 * ## どちらで書くかは、正本が言う
 *
 * 環境変数でもロケールでもない。**縮尺の書き方**が単位を決める。
 *
 * | 書き方 | 1 px | 寸法 |
 * |---|---|---|
 * | `scale: { mm: 40 }` | 40 mm | `14,000` |
 * | `scale: { in: 1.5 }` | 1.5 in | `46'-0"` |
 *
 * 図ぜんたいで 1 つ。**同じ図に `12'-6"` と `3,800` が並ぶことはない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lengthText } from '../src/units.ts';
import { scaleOf } from '../src/grid.ts';
import { wallOf } from '../src/wall.ts';

describe('フィートとインチ', () => {
  it('**フィートとインチで書く**（建築の書き方）', () => {
    assert.equal(lengthText(96, 25.4, true), `8'-0"`);
    assert.equal(lengthText(102, 25.4, true), `8'-6"`);
  });

  it('1 フィートに満たなければインチだけ', () => {
    assert.equal(lengthText(9, 25.4, true), `9"`);
  });

  it('**丸めるのは 1 インチまで。** 1/2 インチの図面は詳細図の仕事', () => {
    assert.equal(lengthText(100.4, 25.4, true), `8'-4"`);
  });

  it('**12 インチは 1 フィートへ繰り上がる**', () => {
    assert.equal(lengthText(143.6, 25.4, true), `12'-0"`);
  });

  it('負の長さでも向きは持たない（寸法は長さ）', () => {
    assert.equal(lengthText(-96, 25.4, true), `8'-0"`);
  });

  it('言わなければ、これまでどおりミリ', () => {
    assert.equal(lengthText(100, 40), '4,000');
    assert.equal(lengthText(100, 200), '20 m');
  });
});

describe('縮尺が単位を決める', () => {
  it('`scale: { mm: 40 }` は 1 px = 40 mm のミリ', () => {
    assert.deepEqual(scaleOf({ mm: 40 }), { mm: 40, feet: false });
  });

  it('**`scale: { in: 1.5 }` は 1 px = 1.5 インチのフィート表記**', () => {
    const scale = scaleOf({ in: 1.5 });
    assert.equal(scale?.feet, true);
    assert.ok(Math.abs((scale?.mm ?? 0) - 38.1) < 1e-9, '1.5 in = 38.1 mm');
  });

  it('書いていなければ null（寸法を出さない）', () => {
    assert.equal(scaleOf({}), null);
    assert.equal(scaleOf({ in: 0 }), null);
    assert.equal(scaleOf(null), null);
  });

  it('**両方書いたら mm を採る**（黙って混ぜない）', () => {
    assert.deepEqual(scaleOf({ mm: 40, in: 1.5 }), { mm: 40, feet: false });
  });
});

describe('壁の厚みもインチで書ける', () => {
  it('`wall: { in: 4, outer: 8 }`', () => {
    const wall = wallOf({ in: 4, outer: 8 });
    assert.ok(Math.abs((wall?.mm ?? 0) - 101.6) < 1e-9);
    assert.ok(Math.abs((wall?.outer ?? 0) - 203.2) < 1e-9);
  });

  it('ミリはこれまでどおり', () => {
    assert.deepEqual(wallOf({ mm: 100, outer: 200 }), { mm: 100, outer: 200 });
  });
});
