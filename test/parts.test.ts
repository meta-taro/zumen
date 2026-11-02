/**
 * **部品を定義して使い回す**（`parts` / `place`。仕様 §3.0.28）。
 *
 * 配置図には「同じ形をもう 1 つ」の書き方が無かった。だから見本は、同じ部品を置くたびに全部書いていた
 * —— 同じ形の節が 30 個以上ある見本が 44 枚、囲碁の盤は 1,587 行（`.claude/issues/parts-proposal.md`）。
 *
 * ここで確かめること。
 *
 * - **読んだ直後に展開する。** 中の節・線・寸法は `<as>.<id>`、格子は `<as>.<行>.<列>.<id>` のふつうの節になる
 * - `set` で置いたものごとに変える。形（位置・大きさ・点）は変えられない
 * - `rotate` は 90 度刻みで形を回す。**文字は回さない**
 * - 辺から中の節を引ける（`L1.body`）
 * - `pins.<as>.position` は置いたもの全体を動かし、`pins["L1.ch"]` は中の 1 つを直す
 * - **正本には展開した結果を書き戻さない**（書き戻しても `parts` / `place` のまま）
 * - 構成図では描かず、知らせる（`parts-ignored`）
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toDrawio } from '../src/drawio.ts';
import { parse, serialize } from '../src/format.ts';
import { layout } from '../src/layout.ts';
import { measure } from '../src/measure.ts';
import { toMermaid } from '../src/mermaid.ts';
import { expandParts } from '../src/parts.ts';
import { render } from '../src/render.ts';
import { inspect } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

function codes(text: string): string[] {
  return validate(text).map((finding) => finding.code);
}

const FIXTURE = `version: 1
kind: placement
arrows: false
parts:
  par64:
    nodes:
      - { id: body, label: "", marker: circle, at: { x: 0, y: 0 }, size: { w: 24, h: 24 } }
      - { id: ch, label: "", marker: none, at: { x: 2, y: 28 }, size: { w: 20, h: 12 } }
    paths:
      - id: yoke
        points: [ [ -4, 12 ], [ 28, 12 ] ]
        ends: { from: none, to: none }
nodes:
  - id: stage
    label: 舞台
    at: { x: 0, y: 0 }
    size: { w: 400, h: 200 }
place:
  - { part: par64, as: L1, at: { x: 120, y: 80 }, set: { ch: { label: "101" } } }
  - { part: par64, as: L2, at: { x: 200, y: 80 } }
`;

describe('parts / place —— 読んだ直後に、ふつうの節と線になる', () => {
  it('**中の名前は `<as>.<id>`。** 座標は置いた所から', async () => {
    const placed = await layout(FIXTURE);
    const box = (id: string) => placed.boxes.find((b) => b.id === id);
    assert.deepEqual(
      placed.boxes.map((b) => b.id),
      ['stage', 'L1.body', 'L1.ch', 'L2.body', 'L2.ch'],
    );
    assert.deepEqual({ x: box('L1.body')!.x, y: box('L1.body')!.y }, { x: 120, y: 80 });
    assert.deepEqual({ x: box('L2.ch')!.x, y: box('L2.ch')!.y }, { x: 202, y: 108 });
    assert.deepEqual(placed.edges.find((e) => e.id === 'L1.yoke')?.points, [
      { x: 116, y: 92 },
      { x: 148, y: 92 },
    ]);
  });

  it('**`set` は置いたもの 1 つだけを変える**', async () => {
    const placed = await layout(FIXTURE);
    assert.equal(placed.boxes.find((b) => b.id === 'L1.ch')?.label, '101');
    assert.equal(placed.boxes.find((b) => b.id === 'L2.ch')?.label, '');
  });

  it('**正本には展開した結果を書き戻さない**（読んで書き戻しても `parts` / `place` のまま）', () => {
    assert.equal(serialize(parse(FIXTURE)), FIXTURE);
    assert.deepEqual(codes(FIXTURE), []);
    // 展開した文書は別のもの（描く・検査する側だけが読む）
    const expanded = expandParts(FIXTURE);
    assert.ok(!/^parts:/m.test(expanded));
    assert.ok(!/^place:/m.test(expanded));
    assert.ok(expanded.includes('L1.body'));
  });

  it('**置いたものが無い正本は、1 文字も変えない**', () => {
    const plain = 'version: 1\nkind: placement\nnodes:\n  - id: a\n';
    assert.equal(expandParts(plain), plain);
  });

  it('**辺の端に、中の節を書ける**（照明器具へ回路を引く）', async () => {
    const text = `${FIXTURE}edges:
  - from: L1.body
    to: L2.body
`;
    assert.deepEqual(codes(text), []);
    const placed = await layout(text);
    assert.ok(placed.edges.some((e) => e.from === 'L1.body' && e.to === 'L2.body'));
  });

  it('**寸法も部品の中に書ける。** 中の節の辺を指したら、置いたものの節の辺になる', async () => {
    const text = `version: 1
kind: placement
scale: { mm: 10 }
parts:
  desk:
    nodes:
      - { id: top, label: 机, at: { x: 0, y: 0 }, size: { w: 120, h: 60 } }
    dims:
      - { id: w, from: { node: top, side: left }, to: { node: top, side: right }, offset: 10 }
place:
  - { part: desk, as: d1, at: { x: 100, y: 100 } }
nodes:
  - { id: room, label: 部屋, at: { x: 0, y: 0 }, size: { w: 400, h: 300 } }
`;
    assert.deepEqual(codes(text), []);
    const placed = await layout(text);
    const line = placed.edges.find((e) => e.id === 'd1.w');
    assert.ok(line !== undefined, '寸法が描かれていない');
    assert.equal(line.label, '1,200');
  });
});

describe('parts / place —— 格子に並べる（`grid`）', () => {
  const BOARD = `version: 1
kind: placement
parts:
  cell:
    nodes:
      - { id: sq, label: "", at: { x: 0, y: 0 }, size: { w: 28, h: 28 } }
place:
  - { part: cell, as: g, at: { x: 44, y: 44 }, grid: { cols: 3, rows: 2, step: { x: 28, y: 28 } } }
`;

  it('**名前は `<as>.<行>.<列>.<id>`。** 行ごとに左から', async () => {
    const placed = await layout(BOARD);
    assert.deepEqual(
      placed.boxes.map((b) => `${b.id}@${b.x},${b.y}`),
      [
        'g.0.0.sq@44,44',
        'g.0.1.sq@72,44',
        'g.0.2.sq@100,44',
        'g.1.0.sq@44,72',
        'g.1.1.sq@72,72',
        'g.1.2.sq@100,72',
      ],
    );
    assert.deepEqual(codes(BOARD), []);
  });

  it('**`pins.<as>.position` は格子ぜんたい、`pins.<as>.<行>.<列>.position` はその 1 マスを動かす**', async () => {
    const text = `${BOARD}pins:
  g:
    position: { x: 0, y: 0 }
  g.1.2:
    position: { x: 300, y: 300 }
`;
    const placed = await layout(text);
    const at = (id: string) => {
      const b = placed.boxes.find((box) => box.id === id)!;
      return `${b.x},${b.y}`;
    };
    assert.equal(at('g.0.0.sq'), '0,0');
    assert.equal(at('g.1.1.sq'), '28,28');
    assert.equal(at('g.1.2.sq'), '300,300');
    assert.deepEqual(codes(text), []);
  });

  it('**手直しの数え方では、1 マスが 1 要素**（節がいくつあっても）', () => {
    const nine = measure(`${BOARD}pins:
  g.1.2:
    position: { x: 300, y: 300 }
  g.0.0.sq:
    label: 天元
`);
    assert.equal(nine.elements, 6);
    assert.equal(nine.touched, 2);
    assert.equal(nine.placed, 1);
  });

  it('**読めない格子は置かず、知らせる**（列・行は正の整数、送りは数）', async () => {
    for (const grid of ['{ cols: 0, rows: 2, step: { x: 28, y: 28 } }', '{ cols: 2, rows: 1.5, step: { x: 28, y: 28 } }', '{ cols: 2, rows: 2 }']) {
      const text = BOARD.replace('grid: { cols: 3, rows: 2, step: { x: 28, y: 28 } }', `grid: ${grid}`);
      assert.ok(codes(text).includes('place-grid-invalid'), grid);
      assert.equal((await layout(text)).boxes.length, 0, grid);
    }
  });
});

describe('parts / place —— 回す（`rotate`）', () => {
  const TURN = `version: 1
kind: placement
scale: { mm: 10 }
parts:
  signal:
    nodes:
      - { id: head, label: 出発, at: { x: 0, y: 0 }, size: { w: 40, h: 20 } }
    paths:
      - { id: post, points: [ [ 0, 30 ], [ 40, 30 ] ] }
      - { id: lamp, arc: { center: [ 10, 10 ], r: 5, from: 0, to: 90 } }
    dims:
      - { id: w, from: { node: head, side: left }, to: { node: head, side: right }, offset: 8 }
place:
  - { part: signal, as: s, at: { x: 200, y: 200 }, rotate: 90 }
`;

  it('**部品の原点を中心に、時計回り。** 箱は縦横が入れ替わる', async () => {
    const placed = await layout(TURN);
    const head = placed.boxes.find((b) => b.id === 's.head')!;
    assert.deepEqual({ x: head.x, y: head.y, w: head.w, h: head.h }, { x: 180, y: 200, w: 20, h: 40 });
    assert.deepEqual(placed.edges.find((e) => e.id === 's.post')?.points, [
      { x: 170, y: 200 },
      { x: 170, y: 240 },
    ]);
    // 弧は中心が回り、角は 90 度進む（0 度だった所が、真下になる）
    const lamp = placed.edges.find((e) => e.id === 's.lamp')!;
    assert.deepEqual(lamp.points[0], { x: 190, y: 215 });
  });

  it('**寸法の辺も回る**（左右の辺で測っていた幅が、上下の辺で測る高さになる）', async () => {
    const placed = await layout(TURN);
    const line = placed.edges.find((e) => e.id === 's.w')!;
    assert.equal(line.label, '400');
    // 縦の寸法線（x が揃う）
    assert.equal(line.points[0]!.x, line.points[1]!.x);
  });

  it('**文字は部品と一緒に回さない**（回した形の、ふつうの箱と同じに描く）', async () => {
    const group = (svg: string) => /<text [^>]*>出発<\/text>/.exec(svg)?.[0] ?? '';
    const turned = group(render(await layout(TURN), 'light', 'safe', true));
    const plain = group(
      render(
        await layout(`version: 1
kind: placement
nodes:
  - { id: s.head, label: 出発, at: { x: 180, y: 200 }, size: { w: 20, h: 40 } }
`),
        'light',
        'safe',
        true,
      ),
    );
    assert.ok(turned !== '', '名前が描かれていない');
    assert.equal(turned, plain);
  });

  it('**180 度は三角の向きも返す。** 90 度では返せないので知らせる', async () => {
    const tri = (rotate: number) => `version: 1
kind: placement
parts:
  arrow:
    nodes:
      - { id: t, label: "", marker: triangle, at: { x: 0, y: 0 }, size: { w: 20, h: 20 } }
place:
  - { part: arrow, as: a, at: { x: 100, y: 100 }, rotate: ${rotate} }
`;
    const half = await layout(tri(180));
    assert.equal(half.boxes[0]!.marker, 'triangle-down');
    assert.ok(!codes(tri(180)).includes('place-rotate-partial'));
    assert.ok(codes(tri(90)).includes('place-rotate-partial'));
  });

  it('**90 度刻みでなければ回さず、知らせる**', async () => {
    const text = TURN.replace('rotate: 90', 'rotate: 45');
    assert.ok(codes(text).includes('place-rotate-invalid'));
    const head = (await layout(text)).boxes.find((b) => b.id === 's.head')!;
    assert.deepEqual({ x: head.x, y: head.y, w: head.w }, { x: 200, y: 200, w: 40 });
  });
});

describe('parts / place —— 人の手直し', () => {
  it('**`pins.<as>.position` は置いたもの全体を動かす**（人がつかむのは器具で、器具の中の丸ではない）', async () => {
    const text = `${FIXTURE}pins:
  L1:
    position: { x: 300, y: 10 }
`;
    const placed = await layout(text);
    const box = (id: string) => placed.boxes.find((b) => b.id === id)!;
    assert.deepEqual({ x: box('L1.body').x, y: box('L1.body').y }, { x: 300, y: 10 });
    assert.deepEqual({ x: box('L1.ch').x, y: box('L1.ch').y }, { x: 302, y: 38 });
    assert.deepEqual(placed.edges.find((e) => e.id === 'L1.yoke')?.points[0], { x: 296, y: 22 });
    assert.deepEqual(codes(text), [], '置いたものの名前を迷子にしている');
  });

  it('**`pins["L1.ch"]` は中の 1 つだけを直す**', async () => {
    const text = `${FIXTURE}pins:
  L1.ch:
    label: "201"
`;
    const placed = await layout(text);
    assert.equal(placed.boxes.find((b) => b.id === 'L1.ch')?.label, '201');
    assert.equal(placed.boxes.find((b) => b.id === 'L2.ch')?.label, '');
    assert.deepEqual(codes(text), []);
  });

  it('**置いたもの全体の pin に位置以外を書いても効かない**（中の何を直すのか読めない）', () => {
    const text = `${FIXTURE}pins:
  L1:
    label: 器具
`;
    assert.ok(codes(text).includes('pin-instance-key-ignored'));
  });

  it('**手直しの数え方では、置いたもの 1 つが 1 要素**（全体を動かしても、中を直しても 1 つ）', () => {
    const nine = measure(`${FIXTURE}pins:
  L1:
    position: { x: 300, y: 10 }
  L1.ch:
    label: "201"
`);
    // stage と、置いたもの 2 つ
    assert.equal(nine.elements, 3);
    assert.equal(nine.touched, 1);
    assert.equal(nine.placed, 1);
  });

  it('**居ない中の名前への pin は迷子**', () => {
    const text = `${FIXTURE}pins:
  L1.nothing:
    label: x
`;
    assert.ok(codes(text).includes('pin-orphan'));
    assert.equal(measure(text).touched, 0);
  });
});

describe('parts / place —— 並び順', () => {
  const ORDER = (placeFirst: boolean) => {
    const place = `parts:
  stone:
    nodes:
      - { id: s, label: "", marker: circle, hatch: solid, at: { x: 0, y: 0 }, size: { w: 20, h: 20 } }
place:
  - { part: stone, as: m1, at: { x: 10, y: 10 } }
`;
    const nodes = `nodes:
  - { id: cell, label: "", at: { x: 0, y: 0 }, size: { w: 40, h: 40 } }
`;
    return `version: 1\nkind: placement\n${placeFirst ? place + nodes : nodes + place}`;
  };

  it('**書いた順に並ぶ。** `place` が `nodes` より前なら、展開した節は `nodes` の前', async () => {
    assert.deepEqual((await layout(ORDER(true))).boxes.map((b) => b.id), ['m1.s', 'cell']);
    assert.deepEqual((await layout(ORDER(false))).boxes.map((b) => b.id), ['cell', 'm1.s']);
  });
});

describe('parts / place —— 効かない所・読めない所は、知らせる', () => {
  it('**構成図では展開せず、知らせる**（`parts-ignored`）', async () => {
    const text = `version: 1
parts:
  p:
    nodes:
      - { id: a }
place:
  - { part: p, as: x }
nodes:
  - id: b
`;
    assert.ok(codes(text).includes('parts-ignored'));
    assert.deepEqual((await layout(text)).boxes.map((b) => b.id), ['b']);
  });

  const BAD = (place: string, parts = `  p:
    nodes:
      - { id: a, label: "", at: { x: 0, y: 0 }, size: { w: 10, h: 10 } }
`) => `version: 1
kind: placement
parts:
${parts}place:
${place}nodes:
  - { id: n, label: "", at: { x: 0, y: 0 }, size: { w: 10, h: 10 } }
`;

  it('定義の無い部品・名前の無い置き方・同じ名前', () => {
    assert.ok(codes(BAD('  - { part: q, as: x, at: { x: 0, y: 0 } }\n')).includes('place-part-unknown'));
    assert.ok(codes(BAD('  - { part: p, at: { x: 0, y: 0 } }\n')).includes('place-as-invalid'));
    assert.ok(codes(BAD('  - { part: p, as: a.b, at: { x: 0, y: 0 } }\n')).includes('place-as-invalid'));
    assert.ok(
      codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n  - { part: p, as: x, at: { x: 20, y: 0 } }\n')).includes(
        'place-as-duplicated',
      ),
    );
    assert.ok(codes(BAD('  - { part: p, as: x }\n')).includes('place-at-invalid'));
  });

  it('**展開した名前が、いまある節と被ったら置かない**（`pins` の鍵がどちらか読めない）', async () => {
    const text = BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n').replace('id: n,', 'id: x.a,');
    assert.ok(codes(text).includes('place-id-collision'));
    assert.ok(!codes(text).includes('node-id-duplicated'));
    assert.deepEqual((await layout(text)).boxes.map((b) => b.id), ['x.a']);
  });

  it('中身の無い部品・部品に書けない語・部品の中の部品', () => {
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n', '  p: {}\n')).includes('part-empty'));
    const edges = '  p:\n    nodes:\n      - { id: a, at: { x: 0, y: 0 } }\n    edges:\n      - { from: a, to: a }\n';
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n', edges)).includes('part-key-unknown'));
    const nested = '  p:\n    nodes:\n      - { id: a, at: { x: 0, y: 0 } }\n    place:\n      - { part: p, as: y }\n';
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n', nested)).includes('part-nested'));
  });

  it('中の名前が無い・`.` を含む・被る', () => {
    const missing = '  p:\n    nodes:\n      - { label: a, at: { x: 0, y: 0 } }\n';
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n', missing)).includes('part-member-id-invalid'));
    const dotted = '  p:\n    nodes:\n      - { id: a.b, at: { x: 0, y: 0 } }\n';
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n', dotted)).includes('part-member-id-invalid'));
    const twice = '  p:\n    nodes:\n      - { id: a, at: { x: 0, y: 0 } }\n    paths:\n      - { id: a, points: [ [ 0, 0 ], [ 1, 1 ] ] }\n';
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 } }\n', twice)).includes('part-member-id-duplicated'));
  });

  it('`set` が無い中の名前を指す・形を変えようとする・読めない', async () => {
    assert.ok(
      codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 }, set: { z: { label: q } } }\n')).includes('place-set-member-unknown'),
    );
    const fixed = BAD('  - { part: p, as: x, at: { x: 0, y: 0 }, set: { a: { at: { x: 50, y: 50 } } } }\n');
    assert.ok(codes(fixed).includes('place-set-key-fixed'));
    const box = (await layout(fixed)).boxes.find((b) => b.id === 'x.a')!;
    assert.deepEqual({ x: box.x, y: box.y }, { x: 0, y: 0 });
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 }, set: [ a ] }\n')).includes('place-set-invalid'));
  });

  it('置き方に書けない語', () => {
    assert.ok(codes(BAD('  - { part: p, as: x, at: { x: 0, y: 0 }, size: { w: 1, h: 1 } }\n')).includes('place-key-unknown'));
  });

  it('`parts` が写像でない・`place` が一覧でない', () => {
    assert.ok(codes('version: 1\nkind: placement\nparts: [ a ]\nnodes:\n  - id: n\n').includes('parts-not-map'));
    assert.ok(codes('version: 1\nkind: placement\nplace: { a: 1 }\nnodes:\n  - id: n\n').includes('place-not-list'));
  });

  it('**同じ定義から出た同じ指摘は 1 回だけ**（置いた数だけ同じことを言わない）', () => {
    const wrong = '  p:\n    nodes:\n      - { id: a, marker: star, at: { x: 0, y: 0 } }\n';
    const text = BAD('  - { part: p, as: x, at: { x: 0, y: 0 }, grid: { cols: 5, rows: 5, step: { x: 20, y: 20 } } }\n', wrong);
    const markers = validate(text).filter((f) => f.code === 'marker-unknown');
    assert.equal(markers.length, 1);
    assert.equal(markers[0]!.line, 6, '部品の定義の行を指していない');
  });
});

describe('parts / place —— 書き出しと数え方', () => {
  it('**inspect は展開したあとの節を数える**', async () => {
    const seen = await inspect(FIXTURE);
    assert.equal(seen.nodes, 5);
    assert.equal(seen.paths, 2);
  });

  it('**draw.io へは展開した節で出す**', async () => {
    const xml = toDrawio(await layout(FIXTURE));
    assert.ok(xml.includes('id="L1.body"'));
    assert.ok(xml.includes('id="L2.ch"'));
  });

  it('**Mermaid も展開した節を出す**（名前の `.` は Mermaid では使えないので `_` に）', () => {
    const out = toMermaid(`${FIXTURE}edges:\n  - from: L1.body\n    to: L2.body\n`);
    assert.ok(out.includes('L1_body'));
    assert.ok(out.includes('L1_body --> L2_body'));
    assert.ok(!out.includes('L1.body -->'));
  });
});
