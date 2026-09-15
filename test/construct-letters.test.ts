/**
 * **実在のロゴを、座標を書かずに出せるか**（D36 / 姉妹側 Issue #6）。
 *
 * ## なぜこの題材か
 *
 * **答えが分かっている。** 姉妹側のロゴ（murmuraura）は
 * φ・H=200・R=100 の 3 定数から出ていて、**確定値が公表されている。**
 * だから「同じ数字が出るか」で正誤が付く —— 架空の見本ではこうならない。
 *
 * ## ここで見るもの
 *
 * **字の送り幅**（外接の幅）。ここには φ の閉じた式が無く、
 * **線の太さの半分**と**縦棒の円弧のふくらみ（サジッタ）**が乗る。
 * ふくらみは**棒の本数だけ**乗るので、`a`（棒 1 本）と `u`（棒 2 本）で値が違う。
 *
 * **つまり、この数字が出れば作図が正しい。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readFileSync } from 'node:fs';

import { build, inkBounds } from '../src/construct.ts';
import { parse } from '../src/format.ts';
import type { Stroke } from '../src/construct.ts';

const PHI = (1 + Math.sqrt(5)) / 2;
const H = 200;
const R = 100;
const R2 = R / PHI;
const W = H / PHI ** 5;

/** 定数と長さ。**ここだけが与えられたもの。** */
const LET = { R: 100, H: 200, phi: 'golden' };
const LENGTHS = {
  stem: 'R * phi ^ 6',
  shoulder: 'R / phi',
  weight: 'H / phi ^ 5',
};

/**
 * 縦棒 1 本ぶんの手順。
 *
 * **半径 stem の円が、点 (tx, ty) を通る。** その円を高さ ya / yb の
 * 水平線で切った 2 点のあいだが、棒になる。
 * **直線は 1 本も使わない** —— わずかにふくらんでいる。
 */
function stem(
  id: string,
  tx: string,
  ty: number,
  ya: number,
  yb: number,
  side: 1 | -1,
): { steps: Record<string, unknown>[]; arc: Record<string, unknown> } {
  const cx = side > 0 ? `${tx} - stem` : `${tx} + stem`;
  const take = side > 0 ? 'right' : 'left';
  return {
    steps: [
      { id: `${id}c`, at: { x: cx, y: ty } },
      { id: `${id}o`, center: `${id}c`, r: 'stem' },
      { id: `${id}ya`, y: ya },
      { id: `${id}yb`, y: yb },
      { id: `${id}pa`, intersect: [`${id}o`, `${id}ya`], take },
      { id: `${id}pb`, intersect: [`${id}o`, `${id}yb`], take },
    ],
    arc: { of: `${id}o`, from: `${id}pa`, to: `${id}pb`, weight: 'weight', cap: 'round' },
  };
}

/** 字 1 つを組む（`a` と `u`）。 */
function letter(which: 'a' | 'u'): ReturnType<typeof build> {
  if (which === 'a') {
    const s = stem('s', '2 * R', R, 0, H, -1);
    return build({
      let: LET,
      lengths: LENGTHS,
      steps: [{ id: 'O', at: { x: 'R', y: 'R' } }, { id: 'bowl', center: 'O', r: 'R' }, ...s.steps],
      circles: [{ id: 'bowl', center: 'O', r: 'R', draw: true, weight: 'weight' }],
      arcs: [s.arc],
    });
  }
  const left = stem('l', '0', R, 0, R, 1);
  const right = stem('r', '2 * R', R, 0, R, -1);
  return build({
    let: LET,
    lengths: LENGTHS,
    steps: [{ id: 'O', at: { x: 'R', y: 'R' } }, { id: 'bowl', center: 'O', r: 'R' }, ...left.steps, ...right.steps],
    arcs: [
      { of: 'bowl', from: 180, to: 0, weight: 'weight', cap: 'round' },
      left.arc,
      right.arc,
    ],
  });
}

/** 外接の幅。**端の玉は数えない**（公表値は玉なしのもの）。 */
function widthOf(strokes: readonly Stroke[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const one of strokes) {
    const pad = one.weight / 2;
    if (one.shape === 'segment') {
      lo = Math.min(lo, one.x0 - pad, one.x1 - pad);
      hi = Math.max(hi, one.x0 + pad, one.x1 + pad);
      continue;
    }
    if (one.shape === 'circle') {
      lo = Math.min(lo, one.cx - one.r - pad);
      hi = Math.max(hi, one.cx + one.r + pad);
      continue;
    }
    const at = (deg: number): void => {
      const x = one.cx + one.r * Math.cos((deg * Math.PI) / 180);
      lo = Math.min(lo, x - pad);
      hi = Math.max(hi, x + pad);
    };
    at(one.a0);
    at(one.a1);
    const a = Math.min(one.a0, one.a1);
    const b = Math.max(one.a0, one.a1);
    for (const axis of [-180, 0, 180, 360]) if (axis > a && axis < b) at(axis);
  }
  return hi - lo;
}

describe('サジッタ（縦棒のふくらみ）', () => {
  const SR = R * PHI ** 6;
  const sag = (h: number): number => SR - Math.sqrt(SR * SR - h * h);

  it('公表された 2 つの値が出る', () => {
    assert.equal(Math.round(sag(R) * 1000) / 1000, 2.789);
    assert.equal(Math.round(sag(H - R2) * 1000) / 1000, 5.329);
  });
});

describe('**実在のロゴの送り幅が、正本から出る**', () => {
  it('`a`（棒 1 本）── 220.823', () => {
    const got = letter('a');
    assert.deepEqual(got.troubles, []);
    assert.equal(Math.round(widthOf(got.strokes) * 1000) / 1000, 220.823);
  });

  it('`u`（棒 2 本）── 223.611', () => {
    const got = letter('u');
    assert.deepEqual(got.troubles, []);
    assert.equal(Math.round(widthOf(got.strokes) * 1000) / 1000, 223.611);
  });

  it('**`a` と `u` が違う値になる**（ふくらみは棒の本数だけ乗る）', () => {
    const a = widthOf(letter('a').strokes);
    const u = widthOf(letter('u').strokes);
    const SR = R * PHI ** 6;
    const sag = SR - Math.sqrt(SR * SR - R * R);
    assert.equal(Math.round((u - a) * 1000) / 1000, Math.round(sag * 1000) / 1000);
  });

  it('**縦棒は直線ではない**（半径 1794.427 の円の一部）', () => {
    const got = letter('a');
    const arc = got.strokes.find((one) => one.shape === 'arc');
    assert.equal(arc?.shape, 'arc');
    assert.equal(Math.round((arc as { r: number }).r * 1000) / 1000, 1794.427);
  });

  it('線の太さが `H/φ⁵` で出る', () => {
    assert.equal(Math.round(letter('a').strokes[0]!.weight * 1000) / 1000, 18.034);
    assert.equal(Math.round(W * 1000) / 1000, 18.034);
  });
});

describe('**R を変えると、全部が比を保ったまま動く**', () => {
  it('R を 2 倍にしたら、送り幅も 2 倍', () => {
    const one = widthOf(letter('a').strokes);
    // 人が pin できるのは定数（D36）。**位置ではない。**
    const s = stem('s', '2 * R', 200, 0, 400, -1);
    const twice = build(
      {
        let: LET,
        lengths: LENGTHS,
        steps: [{ id: 'O', at: { x: 'R', y: 'R' } }, { id: 'bowl', center: 'O', r: 'R' }, ...s.steps],
        circles: [{ id: 'bowl', center: 'O', r: 'R', draw: true, weight: 'weight' }],
        arcs: [s.arc],
      },
      new Map([['R', 200]]),
    );
    assert.deepEqual(twice.troubles, []);
    assert.equal(Math.round(widthOf(twice.strokes) / one), 2);
  });
});

describe('**見本 128 —— 座標を 1 つも書かない正本**', () => {
  const source = readFileSync(new URL('../examples/gallery/128-ロゴの作図.zumen.yaml', import.meta.url), 'utf8');

  it('正本に `at:` の座標が、与える点以外に無い', () => {
    // **与える点だけが `at:` を持つ。** しかもその中身は式（R / shoulder）で、数ではない。
    const numbers = [...source.matchAll(/at: \{ x: ([^,]+), y: ([^}]+) \}/g)];
    assert.ok(numbers.length > 0, 'at: が 1 つも無いのは、取り出し方が壊れている');
    for (const [, x, y] of numbers) {
      assert.equal(/^-?\d+(\.\d+)?$/.test(x!.trim()) && /^-?\d+(\.\d+)?$/.test(y!.trim()), false, `数の座標がある: ${x} ${y}`);
    }
  });

  it('**横組の外寸 2527.308 × 218.034 が、その正本から出る**', () => {
    const got = build(parse(source).doc.toJS() as Parameters<typeof build>[0]);
    assert.deepEqual(got.troubles, []);
    const ink = inkBounds(got.strokes)!;
    assert.equal(Math.round((ink.right - ink.left) * 1000) / 1000, 2527.308);
    assert.equal(Math.round(heightOf(got.strokes) * 1000) / 1000, 218.034);
  });

  it('弧が 29 本（字 10 個ぶん）', () => {
    const got = build(parse(source).doc.toJS() as Parameters<typeof build>[0]);
    assert.equal(got.strokes.length, 29);
  });

  it('**見本 122 より 1 桁小さい**（コンパスで作れる図は、正本も小さい）', () => {
    const old = readFileSync(new URL('../examples/gallery/122-円だけで作る動物のマーク.zumen.yaml', import.meta.url), 'utf8');
    assert.ok(source.length * 10 < old.length, `${source.length} バイト / ${old.length} バイト`);
  });
});

/** 上下の端（端の玉は数えない）。 */
function heightOf(strokes: readonly Stroke[]): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const one of strokes) {
    const pad = one.weight / 2;
    const add = (y: number): void => {
      lo = Math.min(lo, y - pad);
      hi = Math.max(hi, y + pad);
    };
    if (one.shape === 'segment') {
      add(one.y0);
      add(one.y1);
      continue;
    }
    if (one.shape === 'circle' || Math.abs(one.a1 - one.a0) >= 360) {
      add(one.cy - one.r);
      add(one.cy + one.r);
      continue;
    }
    const at = (deg: number): void => add(one.cy + one.r * Math.sin((deg * Math.PI) / 180));
    at(one.a0);
    at(one.a1);
    const a = Math.min(one.a0, one.a1);
    const b = Math.max(one.a0, one.a1);
    for (const axis of [-270, -90, 90, 270, 450]) if (axis > a && axis < b) at(axis);
  }
  return hi - lo;
}
