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
  it('**形の名前だけで閉じる。意味の語は無い**', () => {
    assert.deepEqual(
      [...ENDS],
      ['none', 'arrow', 'bar', 'crow', 'dot', 'dot-bar', 'dot-crow', 'triangle', 'diamond', 'solid-diamond'],
    );
    // 意味の語は受けない（ER の `one-to-many`、UML の `generalization`）。
    assert.deepEqual(endsOf({ from: 'one-to-many' }), { from: 'none', to: 'none' });
    assert.deepEqual(endsOf({ to: 'generalization' }), { from: 'none', to: 'none' });
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

describe('UML の関係記号', () => {
  const tip = { x: 100, y: 100 };
  const back = { x: 0, y: 100 };

  it('**中抜きの三角は地の色で塗る。** 線が透けると汎化に見えない', () => {
    const out = drawEnd('triangle', tip, back, '#111', '#ffffff');
    assert.match(out, /<path [^>]*fill="#ffffff"/);
  });

  it('集約は中抜きの菱形、コンポジションは塗った菱形', () => {
    assert.match(drawEnd('diamond', tip, back, '#111', '#fff'), /fill="#fff"/);
    assert.match(drawEnd('solid-diamond', tip, back, '#111', '#fff'), /fill="#111"/);
  });

  it('三角も菱形も、閉じた形（1 つの path）', () => {
    for (const kind of ['triangle', 'diamond', 'solid-diamond'] as const) {
      const out = drawEnd(kind, tip, back, '#111', '#fff');
      assert.equal(out.match(/<path /g)!.length, 1, `${kind} が 1 つの path でない`);
      assert.ok(out.includes(' Z"'), `${kind} が閉じていない`);
    }
  });
});

describe('辺の線種', () => {
  const UML = `version: 1
nodes:
  - id: a
    label: SqlOrderRepository
  - id: b
    label: OrderRepository
edges:
  - from: a
    to: b
    line: dashed
    ends: { to: triangle }
`;

  it('**破線で描く。** 汎化と実現は線種でしか区別できない', async () => {
    const { lineOf, dashOf } = await import('../src/line.ts');
    assert.equal(lineOf('dashed'), 'dashed');
    assert.equal(dashOf('dashed'), '7 4');
    assert.equal(dashOf('solid'), null);
    const out = render(await layout(UML));
    assert.match(out, /<path d="[^"]*"[^>]*stroke-dasharray="7 4"/);
  });

  it('書かなければ実線（これまでの図の見え方を変えない）', async () => {
    const out = render(await layout(UML.replace('    line: dashed\n', '')));
    assert.ok(!out.includes('stroke-dasharray="7 4"'));
  });

  it('意味の語は受けない', async () => {
    const { lineOf } = await import('../src/line.ts');
    assert.equal(lineOf('dependency'), 'solid');
  });

  it('知らない語を警告する', () => {
    const found = validate(UML.replace('line: dashed', 'line: nami'));
    assert.ok(found.some((f) => f.code === 'line-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('spec が線種を返す', () => {
    assert.deepEqual(spec().lines, ['solid', 'dashed', 'dotted']);
    assert.match(spec().shape, /line:/);
  });
});
