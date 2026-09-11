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

describe('**種類が決めるのは、置き場所の出どころ**', () => {
  it('構成図は、機械が計算する', () => {
    assert.equal(measureOf('structure').positionsInSource, false);
  });

  it('**配置図は、正本に書いてある**', () => {
    assert.equal(measureOf('placement').positionsInSource, true);
  });

  it('**物差しは、どちらも同じ向き**（2026-09-11 に考え直した）', async () => {
    const { measure } = await import('../src/measure.ts');
    // AI が置けるなら、配置図でも「人が触っていないほど良い」で正しい。
    const placed = [
      'version: 1',
      'kind: placement',
      'nodes:',
      '  - id: a',
      '    at: { x: 40, y: 40 }',
      '  - id: b',
      '    at: { x: 300, y: 40 }',
      '',
    ].join('\n');
    assert.equal(measure(placed).pass, true, 'AI が置いた配置図が不合格になっている');

    const nudged = placed.replace(
      'nodes:',
      'pins:\n  a:\n    position: { x: 60, y: 60 }\n  b:\n    position: { x: 320, y: 60 }\n\nnodes:',
    );
    assert.equal(measure(nudged).pass, false, '人が全部動かしたのに合格している');
  });

  it('どちらの物差しにも、合格の説明がある', () => {
    for (const kind of KINDS) {
      const m = measureOf(kind);
      assert.ok(m.label.length > 0, `${kind} に名前が無い`);
      assert.ok(m.why.length > 0, `${kind} に理由が無い`);
    }
  });
});

describe('**AI が位置を書ける**（`nodes[].at`）', () => {
  const AT = [
    'version: 1',
    'kind: placement',
    'nodes:',
    '  - id: a',
    '    label: 事務室',
    '    at: { x: 40, y: 40 }',
    '  - id: b',
    '    label: 倉庫',
    '    at: { x: 400, y: 40 }',
    'edges:',
    '  - from: a',
    '    to: b',
    '',
  ].join('\n');

  it('**書いた位置に置かれる**（機械が並べ直さない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(AT);
    const a = placed.boxes.find((box) => box.id === 'a')!;
    assert.equal(a.x, 40);
    assert.equal(a.y, 40);
  });

  it('**AI が置いても、人の手直しとして数えない**（`pins` ではない）', async () => {
    const { measure } = await import('../src/measure.ts');
    const got = measure(AT);
    assert.equal(got.placed, 0, 'AI の配置が人の手直しに数えられている');
    assert.equal(got.layoutAutonomy, 1);
  });

  it('**人の `pins` が、AI の `at` より強い**（D5 の向きは変わらない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const source = AT.replace('nodes:', 'pins:\n  a:\n    position: { x: 700, y: 500 }\n\nnodes:');
    const placed = await layout(source);
    const a = placed.boxes.find((box) => box.id === 'a')!;
    assert.equal(a.x, 700);
    assert.equal(a.y, 500);
    assert.equal(a.pinned, true);
  });

  it('構成図では `at` を見ない（機械が並べる）', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(AT.replace('kind: placement\n', ''));
    const a = placed.boxes.find((box) => box.id === 'a')!;
    assert.notEqual(`${a.x},${a.y}`, '40,40');
  });

  it('**配置図で `at` が無い要素は、機械が置く**（黙って重ねない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { overlaps } = await import('../src/layout.ts');
    const source = AT.replace('edges:', '  - id: c\n    label: 置き忘れ\nedges:');
    const placed = await layout(source);
    assert.equal(placed.boxes.length, 3);
    assert.deepEqual(overlaps(placed), []);
  });

  it('**検査から、種類と出どころが見える**', async () => {
    const { inspect } = await import('../src/tools.ts');
    const out = await inspect(AT);
    assert.equal(out.kind, 'placement');
    assert.equal(out.positionsInSource, true);
  });
});

describe('**AI が大きさを書ける**（`nodes[].size`）', () => {
  // 間取りを描かせてみて分かった。**部屋の大きさが全部同じ**では図にならない。
  // 16 畳の LDK と便所が同じ箱で出た（2026-09-11）。
  //
  // 位置と同じ穴が、大きさに残っていた。
  //
  //     位置   AI: nodes[].at   人: pins.position
  //     大きさ AI: **無い**      人: pins.size
  const ROOMS = [
    'version: 1',
    'kind: placement',
    'nodes:',
    '  - id: ldk',
    '    label: LDK',
    '    at: { x: 40, y: 40 }',
    '    size: { w: 320, h: 240 }',
    '  - id: wc',
    '    label: 便所',
    '    at: { x: 380, y: 40 }',
    '    size: { w: 80, h: 80 }',
    '',
  ].join('\n');

  it('**書いた大きさで描かれる**', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(ROOMS);
    const ldk = placed.boxes.find((box) => box.id === 'ldk')!;
    assert.equal(ldk.w, 320);
    assert.equal(ldk.h, 240);
  });

  it('**大きさの違いが出る**（16 畳と便所が同じ箱にならない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(ROOMS);
    const ldk = placed.boxes.find((box) => box.id === 'ldk')!;
    const wc = placed.boxes.find((box) => box.id === 'wc')!;
    assert.ok(ldk.w * ldk.h > wc.w * wc.h * 4, `LDK ${ldk.w}x${ldk.h} / 便所 ${wc.w}x${wc.h}`);
  });

  it('**人の `pins.size` が、AI の `size` より強い**', async () => {
    const { layout } = await import('../src/layout.ts');
    const source = ROOMS.replace(
      'nodes:',
      'pins:\n  ldk:\n    size: { w: 500, h: 400 }\n\nnodes:',
    );
    const placed = await layout(source);
    const ldk = placed.boxes.find((box) => box.id === 'ldk')!;
    assert.equal(ldk.w, 500);
    assert.equal(ldk.h, 400);
  });

  it('**AI が書いた大きさは、人の手直しに数えない**', async () => {
    const { measure } = await import('../src/measure.ts');
    assert.equal(measure(ROOMS).placed, 0);
  });

  it('書いていなければ、これまでどおりラベルから決まる', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(ROOMS.replace(/^\s*size:.*$/gm, ''));
    const ldk = placed.boxes.find((box) => box.id === 'ldk')!;
    assert.equal(ldk.h, 60);
  });

  it('構成図でも効く（大きさは並べ方と関係ない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(ROOMS.replace('kind: placement\n', '').replace(/^\s*at:.*$/gm, ''));
    assert.equal(placed.boxes.find((box) => box.id === 'ldk')!.w, 320);
  });
});

describe('**配置図では、置いたものを動かさない**', () => {
  // 店舗のレイアウトを描かせてみて出た（2026-09-11）。
  //
  // 1. **接している箱を `separate()` が押し退けた。**
  //    間取りや売場では、部屋や棚が接しているのが普通。**重なりではない。**
  // 2. **囲みが縮まなかった。** 広げる向きにしか動かないので、
  //    `at` で中身が寄っても枠が元の大きさのまま残り、**囲みどうしが重なった。**
  const TOUCHING = [
    'version: 1',
    'kind: placement',
    'groups:',
    '  - id: left',
    '    label: 左の区画',
    '  - id: right',
    '    label: 右の区画',
    'nodes:',
    '  - id: a',
    '    label: 部屋 A',
    '    at: { x: 40, y: 40 }',
    '    size: { w: 200, h: 120 }',
    '    group: left',
    '  - id: b',
    '    label: 部屋 B',
    '    at: { x: 240, y: 40 }',   // ← A と接している
    '    size: { w: 200, h: 120 }',
    '    group: left',
    '  - id: c',
    '    label: 倉庫',
    '    at: { x: 520, y: 40 }',
    '    size: { w: 160, h: 120 }',
    '    group: right',
    '',
  ].join('\n');

  it('**接している箱を、押し退けない**', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(TOUCHING);
    for (const [id, x, y] of [['a', 40, 40], ['b', 240, 40], ['c', 520, 40]] as const) {
      const box = placed.boxes.find((n) => n.id === id)!;
      assert.equal(box.x, x, `${id} の x が動いた`);
      assert.equal(box.y, y, `${id} の y が動いた`);
    }
  });

  it('**囲みどうしが重ならない**（中身に合わせて縮む）', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(TOUCHING);
    const [g1, g2] = placed.groups;
    assert.ok(g1 !== undefined && g2 !== undefined);
    const apart =
      g1.x + g1.w <= g2.x || g2.x + g2.w <= g1.x || g1.y + g1.h <= g2.y || g2.y + g2.h <= g1.y;
    assert.ok(
      apart,
      `${g1.id} x ${g1.x}..${g1.x + g1.w} / ${g2.id} x ${g2.x}..${g2.x + g2.w}`,
    );
  });

  it('囲みが、中身をちゃんと含んでいる', async () => {
    const { layout, groupEscapes } = await import('../src/layout.ts');
    assert.deepEqual(groupEscapes(await layout(TOUCHING)), []);
  });

  it('**構成図では、これまでどおり押し退ける**（重なりは重なり）', async () => {
    const { layout, overlaps } = await import('../src/layout.ts');
    const source = [
      'version: 1',
      'pins:',
      '  a:',
      '    position: { x: 24, y: 24 }',
      'nodes:',
      '  - id: a',
      '  - id: b',
      '  - id: c',
      'edges:',
      '  - from: a',
      '    to: b',
      '',
    ].join('\n');
    assert.deepEqual(overlaps(await layout(source)), []);
  });
});
