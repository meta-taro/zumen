/**
 * **作図**（D36 / `src/construct.ts`）。
 *
 * ## ここでいちばん見たいもの
 *
 * **ソルバを持っていないこと。**
 *
 * 前から順に評価するだけなので、**後ろで決めた名前は引けない**し、
 * **「接するはず」を書く場所が無い**。だから「解けなかった」が起きない ——
 * 起きるのは**交点が無い**ことだけで、そこは黙らずに言う。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NAMED, angleOf, build, evaluate, meet, meetLine, pick } from '../src/construct.ts';

const phi = NAMED.golden!;
const look = (names: Record<string, number>) => (name: string) => names[name] ?? null;
const none = () => null;

describe('式', () => {
  const at = (text: string, names: Record<string, number> = {}) => evaluate(text, look(names), none);

  it('四則と括弧', () => {
    assert.equal(at('1 + 2 * 3'), 7);
    assert.equal(at('(1 + 2) * 3'), 9);
    assert.equal(at('10 / 4'), 2.5);
    assert.equal(at('-3 + 1'), -2);
  });

  it('**べき乗は右から結合する**（数学の書き方）', () => {
    assert.equal(at('2 ^ 3 ^ 2'), 512);
    assert.equal(at('2 ^ 3'), 8);
  });

  it('名前を引ける', () => {
    assert.equal(at('R * phi ^ 6', { R: 100, phi }), 100 * phi ** 6);
    assert.equal(Math.round(at('R * phi ^ 6', { R: 100, phi }) * 1000) / 1000, 1794.427);
  });

  it('**先に決めていない名前は引けない**（循環参照を作れない）', () => {
    assert.throws(() => at('R * 2'), /R/);
  });

  it('0 で割ったら黙らない', () => {
    assert.throws(() => at('1 / 0'), /0 で割/);
  });

  it('括弧が閉じていなければ黙らない', () => {
    assert.throws(() => at('(1 + 2'), /括弧/);
  });

  it('数がそのまま来たら、そのまま通す', () => {
    assert.equal(evaluate(200, none, none), 200);
  });

  it('distance は 2 点の距離', () => {
    const d = (a: string, b: string) => (a === 'A' && b === 'B' ? 5 : null);
    assert.equal(evaluate('distance(A, B) * 2', none, d), 10);
  });
});

describe('2 円の交点', () => {
  it('2 つ出る', () => {
    const got = meet({ cx: 0, cy: 0, r: 5 }, { cx: 6, cy: 0, r: 5 });
    assert.equal(got.length, 2);
    assert.equal(Math.round(got[0]!.x), 3);
  });

  it('**離れていれば 0 個**（「解けない」ではなく、交点が無い）', () => {
    assert.deepEqual(meet({ cx: 0, cy: 0, r: 1 }, { cx: 10, cy: 0, r: 1 }), []);
  });

  it('片方が中にあっても 0 個', () => {
    assert.deepEqual(meet({ cx: 0, cy: 0, r: 10 }, { cx: 0, cy: 1, r: 2 }), []);
  });

  it('接していれば 1 個', () => {
    assert.equal(meet({ cx: 0, cy: 0, r: 5 }, { cx: 10, cy: 0, r: 5 }).length, 1);
  });

  it('同心は交点を持たない', () => {
    assert.deepEqual(meet({ cx: 0, cy: 0, r: 5 }, { cx: 0, cy: 0, r: 5 }), []);
  });
});

describe('円と直線の交点', () => {
  it('水平線で切れる', () => {
    const got = meetLine({ cx: 0, cy: 0, r: 5 }, { x: 0, y: 3 }, { x: 1, y: 3 });
    assert.equal(got.length, 2);
    assert.equal(Math.round(Math.abs(got[0]!.x)), 4);
  });

  it('届かなければ 0 個', () => {
    assert.deepEqual(meetLine({ cx: 0, cy: 0, r: 1 }, { x: 0, y: 9 }, { x: 1, y: 9 }), []);
  });
});

describe('どちらの交点を採るか', () => {
  const two = [{ x: 3, y: -4 }, { x: 3, y: 4 }];
  it('upper は画面の上（y が小さい）', () => {
    assert.equal(pick(two, 'upper')!.y, -4);
    assert.equal(pick(two, 'lower')!.y, 4);
  });
  it('first / second は書いた順', () => {
    assert.equal(pick(two, 'first')!.y, -4);
    assert.equal(pick(two, 'second')!.y, 4);
  });
  it('1 つしか無ければ、それを返す', () => {
    assert.equal(pick([{ x: 1, y: 2 }], 'lower')!.x, 1);
  });
});

describe('組み立て', () => {
  const GOLDEN = {
    let: { R: 100, H: 200, phi: 'golden' },
    lengths: { stem: 'R * phi ^ 6', shoulder: 'R / phi' },
  };

  it('語で書いた定数が解ける（1.618… と書かせない）', () => {
    const got = build(GOLDEN);
    assert.equal(got.lengths.get('phi'), phi);
    assert.equal(Math.round(got.lengths.get('stem')! * 1000) / 1000, 1794.427);
    assert.equal(Math.round(got.lengths.get('shoulder')! * 1000) / 1000, 61.803);
  });

  it('**人が pin した定数が勝つ**（D36。手直しはここに効く）', () => {
    const got = build(GOLDEN, new Map([['R', 200]]));
    assert.equal(got.lengths.get('R'), 200);
    // **R を 1 つ変えると、全部が比を保ったまま動く。**
    assert.equal(Math.round(got.lengths.get('stem')! * 1000) / 1000, Math.round(200 * phi ** 6 * 1000) / 1000);
  });

  it('与えた点と、2 円の交点', () => {
    const got = build({
      let: { r: 100 },
      steps: [
        { id: 'A', at: { x: 0, y: 0 } },
        { id: 'B', at: { x: 120, y: 0 } },
        { id: 'cA', center: 'A', r: 'r' },
        { id: 'cB', center: 'B', r: 'r' },
        { id: 'M', intersect: ['cA', 'cB'], take: 'upper' },
      ],
    });
    assert.deepEqual(got.troubles, []);
    assert.equal(Math.round(got.points.get('M')!.x), 60);
    assert.ok(got.points.get('M')!.y < 0, 'upper は画面の上');
  });

  it('**どちらの交点かを書かなければ断る**（機械に推測させない）', () => {
    const got = build({
      let: { r: 100 },
      steps: [
        { id: 'A', at: { x: 0, y: 0 } },
        { id: 'B', at: { x: 120, y: 0 } },
        { id: 'cA', center: 'A', r: 'r' },
        { id: 'cB', center: 'B', r: 'r' },
        { id: 'M', intersect: ['cA', 'cB'] },
      ],
    });
    assert.equal(got.points.has('M'), false);
    assert.match(got.troubles.join(' '), /どちらの交点/);
  });

  it('**交わらなければ、そう言う**（黙って落とさない）', () => {
    const got = build({
      let: { r: 10 },
      steps: [
        { id: 'A', at: { x: 0, y: 0 } },
        { id: 'B', at: { x: 999, y: 0 } },
        { id: 'cA', center: 'A', r: 'r' },
        { id: 'cB', center: 'B', r: 'r' },
        { id: 'M', intersect: ['cA', 'cB'], take: 'upper' },
      ],
    });
    assert.match(got.troubles.join(' '), /交わりません/);
  });

  it('円と水平線の交点で、高さを角に直せる（縦棒の作り方）', () => {
    const got = build({
      let: { SR: 1000 },
      steps: [
        { id: 'C', at: { x: -1000, y: 0 } },
        { id: 'c1', center: 'C', r: 'SR' },
        { id: 'top', y: -100 },
        { id: 'P', intersect: ['c1', 'top'], take: 'right' },
      ],
    });
    assert.deepEqual(got.troubles, []);
    const p = got.points.get('P')!;
    assert.equal(Math.round(p.y), -100);
    // 半径 1000 の円が高さ 100 で、ふくらみは 1000 − √(1000²−100²) ≒ 5.01
    assert.ok(Math.abs(p.x + 5.012) < 0.01, `ふくらみ ${(-p.x).toFixed(3)}`);
  });

  it('弧は点で端を指せる', () => {
    const got = build({
      let: { r: 100 },
      steps: [
        { id: 'O', at: { x: 0, y: 0 } },
        { id: 'c', center: 'O', r: 'r' },
        { id: 'R1', at: { x: 100, y: 0 } },
      ],
      arcs: [{ of: 'c', from: 'R1', to: 180, weight: 4, cap: 'round' }],
    });
    assert.deepEqual(got.troubles, []);
    const [arc] = got.strokes;
    assert.equal(arc?.shape, 'arc');
    assert.equal(arc?.shape === 'arc' && arc.a0, 0);
    assert.equal(arc?.shape === 'arc' && arc.a1, 180);
    assert.equal(arc?.shape === 'arc' && arc.weight, 4);
  });

  it('**1 か所つまずいても、残りは描く**', () => {
    const got = build({
      let: { r: 100 },
      steps: [
        { id: 'O', at: { x: 0, y: 0 } },
        { id: 'c', center: 'O', r: 'r' },
        { id: 'bad', center: '居ない点', r: 'r' },
      ],
      arcs: [{ of: 'c', from: 0, to: 180, weight: 2 }],
    });
    assert.equal(got.strokes.length, 1, '良いほうは描く');
    assert.match(got.troubles.join(' '), /居ない点/);
  });

  it('同じ名前を 2 回書いたら言う', () => {
    const got = build({ let: { R: 1 }, lengths: { R: 2 } });
    assert.match(got.troubles.join(' '), /2 回/);
  });
});

describe('角', () => {
  it('SVG と同じ向き（0 が右、下へ回る）', () => {
    const c = { cx: 0, cy: 0 };
    assert.equal(angleOf(c, { x: 1, y: 0 }), 0);
    assert.equal(angleOf(c, { x: 0, y: 1 }), 90);
    assert.equal(angleOf(c, { x: -1, y: 0 }), 180);
    assert.equal(angleOf(c, { x: 0, y: -1 }), 270);
  });
});
