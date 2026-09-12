/**
 * **辺の端の記号**（`edges[].ends`）。
 *
 * ER 図で多重度を **「1 対 多」と文字で**書いていた。**実物は記号で書く** ——
 * 鳥の足（crow's foot）。データベースをやる人は**文字ではなく端の形で読む。**
 *
 * 文字で書くと、**辺が増えるほど置き場が無くなって消える**（`hiddenLabels`）。
 * 記号は辺の端に必ず置ける。
 *
 * 値は形の名前だけ（`marker` と `hatch` と同じ約束）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENDS, drawEnd, endsOf, hasEnds } from '../src/ends.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const ER = `version: 1
nodes:
  - id: kokyaku
    type: database
    label: 顧客
  - id: juchu
    type: database
    label: 受注
edges:
  - from: kokyaku
    to: juchu
    ends: { from: bar, to: crow }
`;

describe('端の記号を読む', () => {
  it('7 つで閉じる。**意味の語は無い**', () => {
    assert.deepEqual([...ENDS], ['none', 'arrow', 'bar', 'crow', 'dot', 'dot-bar', 'dot-crow']);
    assert.deepEqual(endsOf({ from: 'one-to-many' }), { from: 'none', to: 'none' });
  });

  it('書かなければ記号は無い', () => {
    assert.deepEqual(endsOf(undefined), { from: 'none', to: 'none' });
    assert.equal(hasEnds({ from: 'none', to: 'none' }), false);
    assert.equal(hasEnds({ from: 'bar', to: 'none' }), true);
  });

  it('片側だけでも読む', () => {
    assert.deepEqual(endsOf({ to: 'crow' }), { from: 'none', to: 'crow' });
  });
});

describe('端の記号を描く', () => {
  const tip = { x: 100, y: 100 };
  const back = { x: 0, y: 100 };

  it('無しと矢印は、ここでは描かない（矢印は marker-end が出す）', () => {
    assert.equal(drawEnd('none', tip, back, '#111'), '');
    assert.equal(drawEnd('arrow', tip, back, '#111'), '');
  });

  it('棒は 1 本（ER の「1」）', () => {
    const out = drawEnd('bar', tip, back, '#111');
    assert.equal(out.match(/<line /g)!.length, 1);
  });

  it('鳥の足は 3 本（ER の「多」）', () => {
    assert.equal(drawEnd('crow', tip, back, '#111').match(/<line /g)!.length, 3);
  });

  it('**鳥の足は実体へ向かって開く。** 逆だと矢印に見えて、向きを言っていると読まれる', () => {
    const out = drawEnd('crow', tip, back, '#111');
    const lines = [...out.matchAll(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/g)].map((m) =>
      m.slice(1).map(Number),
    );
    // 3 本の始点は同じ（束ねた側）で、終点がばらける（広がった側）。
    const starts = new Set(lines.map((l) => `${l[0]},${l[1]}`));
    const endsAt = new Set(lines.map((l) => `${l[2]},${l[3]}`));
    assert.equal(starts.size, 1, '束ねた側が 1 点になっていない');
    assert.equal(endsAt.size, 3, '広がった側が 3 点になっていない');
    // 束ねた側は線の側（tip より内側）にある。
    assert.ok(lines[0]![0]! < tip.x, '束ねた側が実体の側にある（向きが逆）');
  });

  it('丸つきは、丸と本体の 2 つ（ER の「0 以上」）', () => {
    const out = drawEnd('dot-crow', tip, back, '#111');
    assert.equal(out.match(/<circle /g)!.length, 1);
    assert.equal(out.match(/<line /g)!.length, 3);
  });

  it('向きは線から決める（正本に角度を書かせない）', () => {
    const down = drawEnd('bar', { x: 100, y: 100 }, { x: 100, y: 0 }, '#111');
    const right = drawEnd('bar', { x: 100, y: 100 }, { x: 0, y: 100 }, '#111');
    assert.notEqual(down, right, '向きが線に追従していない');
  });

  it('線の長さが無ければ描かない', () => {
    assert.equal(drawEnd('crow', tip, tip, '#111'), '');
  });
});

describe('図に載せる', () => {
  it('記号が出る', async () => {
    const out = render(await layout(ER));
    assert.ok(out.includes('stroke-width="1.2"'), '端の記号が描かれていない');
  });

  it('**端の記号を書いた辺には、既定の矢印を付けない**（向きが二重になる）', async () => {
    const out = render(await layout(ER));
    assert.ok(!out.includes('marker-end'), '記号と矢印が両方出ている');
  });

  it('書かない辺は、これまでどおり矢印', async () => {
    const out = render(await layout(ER.replace('    ends: { from: bar, to: crow }\n', '')));
    assert.ok(out.includes('marker-end'));
  });

  it('知らない語を警告する', () => {
    const found = validate(ER.replace('to: crow', 'to: karasu'));
    assert.ok(found.some((f) => f.code === 'ends-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('spec が端の記号を返す', () => {
    assert.deepEqual(spec().ends, [...ENDS]);
    assert.match(spec().shape, /ends:/);
  });
});
