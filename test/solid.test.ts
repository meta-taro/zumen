/**
 * **立体**（`nodes[].height` ＋ `projection`。`src/solid.ts`）。
 *
 * - 見える面だけを描く（等角図なら上・手前 2 面の 3 面）
 * - 輪郭は太く、内側の稜線は細く（1 : 2）
 * - **奥から手前へ描く** —— 面の塗りで奥の線を隠すので、順が狂うと手前の立体が消える
 * - 投影の無い図・高さの無い節は、これまでどおり
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { behind, paintOrder, solidOf } from '../src/solid.ts';
import { validate } from '../src/validate.ts';

const SRC = `version: 1
kind: placement
projection: isometric
nodes:
  - id: base
    label: 台
    at: { x: 0, y: 0 }
    size: { w: 100, h: 100 }
    height: 40
  - id: top
    label: 上
    at: { x: 20, y: 20, z: 40 }
    size: { w: 40, h: 40 }
    height: 20
  - id: front
    label: 手前
    at: { x: 0, y: 120 }
    size: { w: 60, h: 40 }
    height: 30
`;

describe('立体の形', () => {
  it('**等角図では、上と手前の 2 面だけが見える**', () => {
    const solid = solidOf({ x: 0, y: 0, z: 0 }, { w: 100, h: 60 }, 40, 'isometric')!;
    assert.equal(solid.faces.length, 3);
    assert.equal(solid.faces.filter((f) => f.top).length, 1);
    assert.equal(solid.faces[solid.faces.length - 1]!.top, true, '上の面は最後に描く');
  });

  it('**輪郭は 6 つの角**（直方体の凸包）', () => {
    const solid = solidOf({ x: 0, y: 0, z: 0 }, { w: 100, h: 60 }, 40, 'isometric')!;
    assert.equal(solid.hull.length, 6);
  });

  it('**投影が無ければ立体にしない**', () => {
    assert.equal(solidOf({ x: 0, y: 0, z: 0 }, { w: 10, h: 10 }, 10, null), null);
  });
});

describe('奥から手前へ', () => {
  it('**上に載せた立体は、下の立体のあとに描く**', () => {
    const base = solidOf({ x: 0, y: 0, z: 0 }, { w: 100, h: 100 }, 40, 'isometric')!;
    const top = solidOf({ x: 20, y: 20, z: 40 }, { w: 40, h: 40 }, 20, 'isometric')!;
    assert.ok(behind(base, top));
    assert.ok(!behind(top, base));
    const order = paintOrder([{ id: 'top', solid: top }, { id: 'base', solid: base }]).map((i) => i.id);
    assert.deepEqual(order, ['base', 'top']);
  });

  it('**手前（y が大きい）の立体は、奥の立体のあと**', () => {
    const far = solidOf({ x: 0, y: 0, z: 0 }, { w: 60, h: 40 }, 30, 'isometric')!;
    const near = solidOf({ x: 0, y: 60, z: 0 }, { w: 60, h: 40 }, 30, 'isometric')!;
    assert.deepEqual(paintOrder([{ id: 'near', solid: near }, { id: 'far', solid: far }]).map((i) => i.id), ['far', 'near']);
  });

  it('**平面の箱は、立体より先に描く**', () => {
    const s = solidOf({ x: 0, y: 0, z: 0 }, { w: 10, h: 10 }, 10, 'isometric')!;
    assert.deepEqual(paintOrder([{ id: 's', solid: s }, { id: 'flat' }]).map((i) => i.id), ['flat', 's']);
  });
});

describe('図として', () => {
  it('**正本として読める**', () => {
    assert.deepEqual(validate(SRC).filter((f) => f.severity === 'error'), []);
  });

  it('**SVG で、下の台 → 上の立体 → 手前の立体の順に描く**', async () => {
    const svg = render(await layout(SRC), 'light', 'safe', true);
    const at = (id: string) => svg.indexOf(`data-node="${id}"`);
    assert.ok(at('base') >= 0 && at('base') < at('top'), '上の立体が台の下に隠れる');
    assert.ok(at('top') < at('front') || at('base') < at('front'));
  });

  it('**輪郭は内側の稜線の 2 倍の太さ**（JIS B 0001:2019 6.2 の細 : 太）', async () => {
    const svg = render(await layout(SRC), 'light', 'safe', true);
    const node = svg.slice(svg.indexOf('data-node="base"'));
    const widths = [...node.slice(0, node.indexOf('</g>')).matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.equal(Math.max(...widths), Math.min(...widths) * 2);
  });

  it('**名前は上の面の真ん中に書く**', async () => {
    const placed = await layout(SRC);
    const base = placed.boxes.find((b) => b.id === 'base')!;
    const svg = render(placed, 'light', 'safe', true);
    const m = /<g data-name="base"><text x="([\d.]+)" y="([\d.]+)"/.exec(svg)!;
    assert.ok(Math.abs(Number(m[1]) - base.solid!.label.x) <= 0.5);
  });

  it('**投影の無い図では、height を書いても平面の箱のまま**', async () => {
    const placed = await layout(SRC.replace('projection: isometric\n', ''));
    assert.ok(placed.boxes.every((b) => b.solid === undefined));
  });
});

describe('効かない height を知らせる', () => {
  it('**投影の無い図に書いた height は node-height-ignored**', () => {
    const codes = validate(SRC.replace('projection: isometric\n', '')).map((f) => f.code);
    assert.ok(codes.includes('node-height-ignored'));
  });

  it('**正の数でない height は node-height-invalid**', () => {
    const codes = validate(SRC.replace('height: 40', 'height: -5')).map((f) => f.code);
    assert.ok(codes.includes('node-height-invalid'));
  });

  it('**効いている height には何も言わない**', () => {
    const codes = validate(SRC).map((f) => f.code);
    assert.ok(!codes.some((c) => c.startsWith('node-height')));
  });
});

describe('立体どうしの重なり', () => {
  it('**積んだ・並べた立体は重なりに数えない**（紙の上の外接矩形は重なっていても）', async () => {
    const { overlaps } = await import('../src/layout.ts');
    assert.deepEqual(overlaps(await layout(SRC)), []);
  });

  it('**食い込んでいる立体は重なりに数える**', async () => {
    const { overlaps } = await import('../src/layout.ts');
    const bad = SRC.replace('at: { x: 20, y: 20, z: 40 }', 'at: { x: 20, y: 20, z: 30 }');
    assert.deepEqual(overlaps(await layout(bad)), [['base', 'top']]);
  });
});

describe('2 つの軸で離れている組（交互列積み）', () => {
  it('**紙の上で重ならない組には前後を立てない** —— 輪にならず、上の段が下の段のあとになる', () => {
    // 1 段目の x の大きい箱と、2 段目の x の小さい箱。x では 2 段目が奥、z では 1 段目が奥。
    const lowRight = solidOf({ x: 100, y: 0, z: 0 }, { w: 100, h: 100 }, 50, 'isometric')!;
    const lowLeft = solidOf({ x: 0, y: 0, z: 0 }, { w: 100, h: 100 }, 50, 'isometric')!;
    const upLeft = solidOf({ x: 0, y: 0, z: 50 }, { w: 100, h: 100 }, 50, 'isometric')!;
    const order = paintOrder([
      { id: 'upLeft', solid: upLeft },
      { id: 'lowRight', solid: lowRight },
      { id: 'lowLeft', solid: lowLeft },
    ]).map((i) => i.id);
    assert.ok(order.indexOf('lowLeft') < order.indexOf('upLeft'), `上の段が下の段より先: ${order}`);
    assert.ok(order.indexOf('lowLeft') < order.indexOf('lowRight'), `奥の箱が手前の箱より後: ${order}`);
  });

  it('**立体に fill を書いても、外接矩形に色の四角を敷かない**', async () => {
    const svg = render(await layout(SRC.replace('    height: 40\n', '    height: 40\n    fill: a\n').replace('projection: isometric\n', 'projection: isometric\npalette:\n  a: "#2e6ab1"\n')), 'light', 'safe', true);
    const node = svg.slice(svg.indexOf('data-node="base"'));
    assert.ok(!node.slice(0, node.indexOf('</g>')).includes('<rect'), '外接矩形に四角が出た');
  });
});

describe('人が動かした立体', () => {
  it('**pins.position が勝つ**（外接矩形の左上がそこへ来る。立体ごと動く）', async () => {
    // 負の座標が出ない図（負があると図ぜんたいがずれる —— 人の位置も一緒にずれる既存の決まり）。
    const ONE = 'version: 1\nkind: placement\nprojection: isometric\nnodes:\n  - id: front\n    label: 箱\n    at: { x: 200, y: 0 }\n    size: { w: 50, h: 50 }\n    height: 20\n';
    const pinned = `${ONE}pins:\n  front:\n    position: { x: 400, y: 300 }\n`;
    const before = (await layout(ONE)).boxes.find((b) => b.id === 'front')!;
    const after = (await layout(pinned)).boxes.find((b) => b.id === 'front')!;
    assert.deepEqual([after.x, after.y], [400, 300]);
    assert.deepEqual([after.w, after.h].map((v) => v.toFixed(2)), [before.w, before.h].map((v) => v.toFixed(2)), '動かしただけで形が変わった');
    assert.equal(after.pinned, true);
  });
});
