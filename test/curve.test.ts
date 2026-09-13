/**
 * **辺の通り道と、その丸め方**（`edges[].via` ／ `edges[].curve`）。
 *
 * 課題 2 の「辺の曲線」。**代用できるうちは入れない**と書いてあったが、
 * 2026-09-13 に代用できない図が出た —— 野球場の扇形スタンド、道路の平面線形、
 * 河川、庭園の園路。どれも**曲がっていること自体が内容**で、
 * 直角で代用すると「どこを通っているか」が別の意味になる。
 *
 * ## 2 つに分けた
 *
 * | | 誰が書くか | 何を言うか |
 * |---|---|---|
 * | `edges[].via` | **正本（AI も書く）** | この線はここを通る（内容） |
 * | `pins.waypoints` | **人だけ** | いや、こう通してほしい（上書き） |
 *
 * `nodes[].at` と `pins.position` の関係と同じ。**人が書いたほうが勝つ**のは
 * この製品の保証（判定基準 3.1）で、曲線でも変わらない。
 *
 * ## 値は形の名前だけ
 *
 * `curve: river`（河川）のような**意味の語は足さない**。
 * D22 で断った語彙の増殖が、そこから始まる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CURVES, curveOf, pathOf } from '../src/curve.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const ROAD = `version: 1
kind: placement
arrows: false
nodes:
  - id: a
    label: 起点
    marker: none
    at: { x: 0, y: 200 }
    size: { w: 30, h: 20 }
  - id: b
    label: 終点
    marker: none
    at: { x: 400, y: 200 }
    size: { w: 30, h: 20 }
edges:
  - from: a
    to: b
    via:
      - { x: 140, y: 60 }
      - { x: 260, y: 340 }
    curve: smooth
`;

/** その辺の `d` 属性。 */
function pathOfEdge(out: string, id = 'a&gt;b'): string {
  return out.match(new RegExp(`data-edge="${id}"[^>]*>[^"]*<path d="([^"]+)"`))![1]!;
}

describe('丸め方を読む', () => {
  it('**形の名前だけで閉じる。意味の語は無い**', () => {
    assert.deepEqual([...CURVES], ['none', 'smooth']);
    assert.equal(curveOf('river'), 'none', '意味の語を受けてはいけない');
    assert.equal(curveOf('road'), 'none');
    assert.equal(curveOf('bezier'), 'none', '道具の名前も受けない');
  });

  it('書かなければ丸めない', () => {
    assert.equal(curveOf(undefined), 'none');
    assert.equal(curveOf('smooth'), 'smooth');
  });
});

describe('通り道を通す', () => {
  it('**書いた点を、書いた順に通る**', async () => {
    const placed = await layout(ROAD);
    const edge = placed.edges[0]!;
    const inner = edge.points.slice(1, -1).map((p) => `${p.x},${p.y}`);
    assert.deepEqual(inner, ['140,60', '260,340'], '通り道を通っていない');
  });

  it('両端は箱の縁で切る（線が箱に潜らない）', async () => {
    const placed = await layout(ROAD);
    const edge = placed.edges[0]!;
    assert.notDeepEqual(edge.points[0], { x: 140, y: 60 });
    assert.ok(edge.points.length === 4, `点の数が ${edge.points.length}`);
  });

  it('**人が曲げたら人が勝つ**（`pins.waypoints` が `via` を上書きする）', async () => {
    const placed = await layout(
      ROAD.replace(
        'nodes:',
        `pins:
  a>b:
    waypoints:
      - { x: 200, y: 500 }
nodes:`,
      ),
    );
    const edge = placed.edges[0]!;
    assert.deepEqual(
      edge.points.slice(1, -1).map((p) => `${p.x},${p.y}`),
      ['200,500'],
      '人の通り道が負けた',
    );
    assert.equal(edge.pinned, true, '人の指定という印が付いていない');
  });
});

describe('丸めて描く', () => {
  it('**`smooth` は曲線で描く**（角が無い）', async () => {
    const out = render(await layout(ROAD), 'light', 'safe', true);
    const d = pathOfEdge(out);
    assert.match(d, / C /, '曲線になっていない');
    assert.ok(!d.includes(' L '), `角が残っている（${d}）`);
  });

  it('`none` は、これまでどおり折れ線', async () => {
    const out = render(await layout(ROAD.replace('    curve: smooth\n', '')), 'light', 'safe', true);
    const d = pathOfEdge(out);
    assert.match(d, / L /, '折れ線になっていない');
    assert.ok(!d.includes(' C '), '書いていないのに曲げた');
  });

  it('**通り道の点は、曲線の上にある**（近くを通るだけにしない）', async () => {
    const out = render(await layout(ROAD), 'light', 'safe', true);
    const d = pathOfEdge(out);
    assert.ok(d.includes('140 60'), `通り道の点を外した（${d}）`);
    assert.ok(d.includes('260 340'), `通り道の点を外した（${d}）`);
  });

  it('**2 点の辺は、丸めても直線**（丸める角が無い）', async () => {
    const straight = ROAD.replace(/    via:\n(      - \{[^}]+\}\n)+/, '');
    const out = render(await layout(straight), 'light', 'safe', true);
    const d = pathOfEdge(out);
    assert.ok(!d.includes(' C '), `2 点なのに曲げた（${d}）`);
  });
});

describe('道を作る（pathOf）', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 20, y: 0 },
  ];

  it('折れ線は L で繋ぐ', () => {
    assert.equal(pathOf(pts, 'none'), 'M 0 0 L 10 10 L 20 0');
  });

  it('曲線は、点の数だけ C を出す', () => {
    assert.equal((pathOf(pts, 'smooth').match(/ C /g) ?? []).length, 2);
  });

  it('点が 1 つ以下なら空（描くものが無い）', () => {
    assert.equal(pathOf([{ x: 1, y: 2 }], 'smooth'), '');
    assert.equal(pathOf([], 'none'), '');
  });
});

describe('知らせる', () => {
  it('知らない丸め方を警告する（折れ線で描く）', () => {
    const found = validate(ROAD.replace('curve: smooth', 'curve: guruguru'));
    assert.ok(found.some((f) => f.code === 'curve-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('通り道が点の並びでなければ警告する', () => {
    const found = validate(ROAD.replace('      - { x: 140, y: 60 }', '      - ここ'));
    assert.ok(found.some((f) => f.code === 'via-invalid'));
  });

  it('**構成図では効かないことを知らせる**（置き場所は機械が決める）', () => {
    const found = validate(ROAD.replace('kind: placement\n', ''));
    assert.ok(found.some((f) => f.code === 'via-ignored'));
  });

  it('spec が丸め方の語を返す', () => {
    assert.deepEqual(spec().curves, ['none', 'smooth']);
    assert.match(spec().shape, /via:/);
  });
});
