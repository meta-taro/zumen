/**
 * **配置図での印の描き方**（`nodes[].marker`）。
 *
 * 路線図を実物らしくするには駅を丸で描く必要があるが、
 * D22 で「業界ごとに `type` を増やさない」と決めてある。
 *
 * **これは形の追加ではない。**
 * `type` は「これは円柱だ」＝**物の種類**、`marker` は「ここは丸で印を付ける」＝
 * **その図の描き方**。平面図で壁を塗り潰したのと、断面で基準線を三角にしたのと同じ筋。
 *
 * **値は幾何だけ。** `marker: extinguisher`（消火器）のような語は絶対に足さない
 * —— そこを開けると設備記号の裏口になり、D22 で断った語彙の増殖がそのまま起きる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { MARKERS, markerOf } from '../src/marker.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const STATION = `version: 1
kind: placement
arrows: false
nodes:
  - id: a
    label: 西ヶ丘
    tag: H01
    marker: circle
    at: { x: 0, y: 100 }
    size: { w: 34, h: 34 }
  - id: b
    label: 中央
    tag: H03
    marker: double
    at: { x: 200, y: 100 }
    size: { w: 34, h: 34 }
edges:
  - from: a
    to: b
`;

async function svg(text: string, plan = true): Promise<string> {
  return render(await layout(text), 'light', 'safe', plan);
}

describe('印を読む', () => {
  it('4 つで閉じる。**意味の語は無い**', () => {
    assert.deepEqual([...MARKERS], ['box', 'circle', 'double', 'none']);
    assert.equal(markerOf('extinguisher'), 'box', '意味の語を受けてはいけない');
  });

  it('書かなければ矩形', () => {
    assert.equal(markerOf(undefined), 'box');
    assert.equal(markerOf('circle'), 'circle');
  });
});

describe('印を描く', () => {
  it('**丸で描く**（駅・経穴・計器）', async () => {
    assert.match(await svg(STATION), /data-node="a"[\s\S]*?<circle [^>]*r="17"/);
  });

  it('**二重丸で描く**（乗換駅）', async () => {
    const out = await svg(STATION);
    const part = out.slice(out.indexOf('data-node="b"'));
    assert.equal(part.slice(0, part.indexOf('</g>')).match(/<circle /g)!.length, 2);
  });

  it('`none` は枠を描かない（折れ点・注記だけの場所）', async () => {
    const out = await svg(STATION.replace('marker: circle', 'marker: none'));
    const part = out.slice(out.indexOf('data-node="a"'));
    const body = part.slice(0, part.indexOf('</g>'));
    assert.ok(!body.includes('<circle'), '枠なしなのに丸が出た');
    assert.ok(!body.includes('<rect'), '枠なしなのに矩形が出た');
    assert.ok(body.includes('>西ヶ丘<'), '名前まで消えた');
  });

  it('**丸の大きさは箱の短いほうの半分**（正本に半径を書かせない）', async () => {
    const out = await svg(STATION.replace('size: { w: 34, h: 34 }', 'size: { w: 80, h: 40 }'));
    assert.match(out, /data-node="a"[\s\S]*?<circle [^>]*r="20"/);
  });

  it('**名前は印の外へ出る。** 丸の中には入らない', async () => {
    const placed = await layout(STATION);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>西ヶ丘</)![1]);
    assert.ok(y < box.y || y > box.y + box.h, '名前が丸の中にある');
  });

  it('**符号は印の中に残る**（実物の路線図も駅番号は丸の中）', async () => {
    const placed = await layout(STATION);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>H01</)![1]);
    assert.ok(y >= box.y && y <= box.y + box.h, '符号が外へ出た');
  });

  it('**構成図では効かない**（形は `type` が決める）', async () => {
    const out = await svg(STATION.replace('kind: placement', ''), false);
    assert.ok(!out.includes('<circle'), '構成図で印が効いた');
  });
});

describe('知らせる', () => {
  it('知らない印を警告する（矩形で描く）', () => {
    const found = validate(STATION.replace('marker: circle', 'marker: hoshi'));
    assert.ok(found.some((f) => f.code === 'marker-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('構成図に書いても効かないことを知らせる', () => {
    const found = validate(STATION.replace('kind: placement\n', ''));
    assert.ok(found.some((f) => f.code === 'marker-ignored'));
  });

  it('spec が印の語を返す', () => {
    assert.deepEqual(spec().markers, ['box', 'circle', 'double', 'none']);
    assert.match(spec().shape, /marker:/);
  });
});

describe('枠なし（none）は、枠を描かない注記', () => {
  /**
   * 座席図の列名（A〜F）で出た（2026-09-12）。
   * **枠が無いのに「枠の外」へ出しても意味が無い。**
   * `none` は「枠を描かない注記」なので、文字は箱の場所に置く。
   */
  const ROW = `version: 1
kind: placement
nodes:
  - id: row
    label: A
    marker: none
    at: { x: 0, y: 0 }
    size: { w: 22, h: 20 }
  - id: seat
    label: 1
    marker: circle
    at: { x: 30, y: 0 }
    size: { w: 21, h: 20 }
`;

  it('**文字は箱の場所に置く**（外へ出さない）', async () => {
    const placed = await layout(ROW);
    const box = placed.boxes.find((b) => b.id === 'row')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>A</)![1]);
    assert.ok(y >= box.y && y <= box.y + box.h, '枠なしの文字が外へ出た');
  });
});

describe('壁の厚みは「部屋」のもの', () => {
  it('**丸い印には効かせない。** 座席の丸が塗り潰された', async () => {
    const out = render(
      await layout(`version: 1
kind: placement
scale: { mm: 25 }
wall: { mm: 150 }
nodes:
  - id: seat
    label: 1
    marker: circle
    at: { x: 0, y: 0 }
    size: { w: 21, h: 20 }
  - id: room
    label: 前通路
    at: { x: 40, y: 0 }
    size: { w: 200, h: 40 }
`),
      'light',
      'safe',
      true,
    );
    assert.match(out, /data-node="seat"[\s\S]*?<circle [^>]*stroke-width="1"/, '座席に壁厚が効いた');
    assert.match(out, /data-node="room"[\s\S]*?stroke-width="6"/, '部屋に壁厚が効いていない');
  });
});
