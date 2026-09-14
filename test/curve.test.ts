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

/**
 * **輪を閉じる**（`edges[].close`）。
 *
 * 庭園の平面図で出た（2026-09-13）。池の輪郭を、輪に並べた点を 1 本の辺で
 * 通して代用したが、**1 区間ぶん口が開いた。**
 * 開いた池は池に見えない —— 輪郭が閉じていることが「面」の意味そのもの。
 *
 * **塗りは入れない。** 面の塗りは課題 5（自由形状）で、ここは輪郭だけ。
 * 実物の庭園平面図も、池は輪郭と「池」の字で足りている。
 */
describe('輪を閉じる', () => {
  const POND = `version: 1
kind: placement
arrows: false
nodes:
  - id: a
    label: ""
    marker: none
    at: { x: 100, y: 20 }
    size: { w: 4, h: 4 }
  - id: b
    label: ""
    marker: none
    at: { x: 60, y: 60 }
    size: { w: 4, h: 4 }
edges:
  - from: a
    to: b
    curve: smooth
    close: true
    via:
      - { x: 180, y: 60 }
      - { x: 140, y: 140 }
      - { x: 40, y: 140 }
`;

  it('**最後から最初へ戻る**（口が開かない）', async () => {
    const placed = await layout(POND);
    const points = placed.edges[0]!.points;
    assert.deepEqual(points[points.length - 1], points[0], '輪が閉じていない');
  });

  it('**閉じた曲線は、継ぎ目でも滑らか**（角が立たない）', async () => {
    const out = render(await layout(POND), 'light', 'safe', true);
    const d = pathOfEdge(out);
    assert.match(d, / Z$/, '道が閉じていない');
    assert.ok(!d.includes(' L '), `継ぎ目に角が立った（${d}）`);
  });

  it('書かなければ、これまでどおり開いたまま', async () => {
    const placed = await layout(POND.replace('    close: true\n', ''));
    const points = placed.edges[0]!.points;
    assert.notDeepEqual(points[points.length - 1], points[0]);
  });

  it('折れ線でも閉じる（`curve: none`）', async () => {
    const out = render(await layout(POND.replace('curve: smooth', 'curve: none')), 'light', 'safe', true);
    assert.match(pathOfEdge(out), / Z$/);
  });

  it('真偽でない値を警告する', () => {
    const found = validate(POND.replace('close: true', 'close: はい'));
    assert.ok(found.some((f) => f.code === 'close-not-boolean'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('構成図では効かないことを知らせる', () => {
    const found = validate(POND.replace('kind: placement\n', ''));
    assert.ok(found.some((f) => f.code === 'close-ignored'));
  });

  /**
   * **閉じた輪に矢印は付けない。**
   *
   * 矢印は「こちらへ向かう」という意味だが、**輪は出発点へ戻る。**
   * 池の輪郭に矢印が付いていると、水が一方向へ流れているように読める。
   */
  it('**閉じた輪には、矢印を付けない**', async () => {
    const out = render(await layout(POND.replace('arrows: false\n', '')), 'light', 'safe', true);
    assert.ok(!out.includes('marker-end'), '輪に矢印が付いた');
  });

  it('閉じていない辺には、これまでどおり矢印が付く', async () => {
    const out = render(
      await layout(POND.replace('arrows: false\n', '').replace('    close: true\n', '')),
      'light',
      'safe',
      true,
    );
    assert.match(out, /marker-end/, '矢印が消えた');
  });
});

/**
 * **輪の始まりで、曲線が跳ねない。**
 *
 * 自分自身への辺で閉じた形を描くと（見本 97・109）、
 * **出口の点と入口の点が同じ節の縁で 1〜2 px 離れて並ぶ。**
 * そのまま `curve: smooth` へ渡すと、2 点の向きから制御点が跳ね、
 * **輪の始まりに 8 px ほどの角が出る**（2026-09-15。実物を見て見つけた）。
 *
 * ```
 * C 251.7 219.3, 259.8 189.4, 260 181 C 260.2 172.6, 260.8 180, 261 179.8 Z
 *                              ^^^^^^^ ここが 1.6 px しか離れていない
 * ```
 */
describe('閉じた輪の始まり', () => {
  const RING = `version: 1
kind: placement
arrows: false
nodes:
  - id: a
    label: ""
    marker: none
    at: { x: 199, y: 199 }
    size: { w: 2, h: 2 }
edges:
  - from: a
    to: a
    close: true
    curve: smooth
    ends: { from: none, to: none }
    via:
      - { x: 300, y: 160 }
      - { x: 340, y: 250 }
      - { x: 240, y: 300 }
`;

  it('**ほとんど同じ点を、2 つ並べない**', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(RING);
    const points = placed.edges[0]!.points;
    // 最後の 1 点は輪を閉じる写しなので、そこだけは最初と同じでよい。
    const body = points.slice(0, -1);
    for (let i = 1; i < body.length; i += 1) {
      const gap = Math.hypot(body[i]!.x - body[i - 1]!.x, body[i]!.y - body[i - 1]!.y);
      assert.ok(gap >= 2.5, `${i} 番目が ${gap.toFixed(2)} px しか離れていない`);
    }
    assert.deepEqual(points[points.length - 1], points[0], '輪が閉じていない');
  });

  it('**人が書いた点は畳まない**（離れていれば全部残る）', async () => {
    const { layout } = await import('../src/layout.ts');
    const placed = await layout(RING);
    // 錨 1 ＋ 通り道 3 ＋ 閉じる写し 1。
    assert.equal(placed.edges[0]!.points.length, 5);
  });
});

/**
 * **画用紙の大きさを、辺の通り道も見て決める。**
 *
 * 2026-09-15、テーピングの図で足の輪郭を閉じた曲線で描こうとして出た。
 * 節は輪郭の端に置いた 2px の点だけだったので、**画用紙がその点の大きさになり、
 * 輪郭のほとんどが外へ落ちて消えた。**
 *
 * 四隅を測っているのは**箱だけ**だった。
 * `via` で描く形（池・グリーン・体の輪郭）は、**箱で囲っておかないと切れる。**
 * 負の座標へ回した通り道も同じで、まとめてずらす計算から漏れていた。
 */
describe('画用紙は、辺の通り道も入れて測る', () => {
  const RING = `version: 1
kind: placement
arrows: true
nodes:
  - id: a
    label: ""
    marker: none
    at: { x: 100, y: 100 }
    size: { w: 2, h: 2 }
  - id: b
    label: ""
    marker: none
    at: { x: 120, y: 100 }
    size: { w: 2, h: 2 }
edges:
  - from: a
    to: b
    curve: smooth
    close: true
    ends: { from: none, to: none }
    via:
      - { x: 400, y: 160 }
      - { x: 380, y: 500 }
      - { x: 120, y: 460 }
`;

  it('**輪郭が画用紙から外へ落ちない**', async () => {
    const placed = await layout(RING);
    assert.ok(placed.width >= 400, `幅が輪郭に足りない（${placed.width}）`);
    assert.ok(placed.height >= 500, `高さが輪郭に足りない（${placed.height}）`);
  });

  it('負の座標へ回した通り道も、まとめてずらす計算に入る', async () => {
    const placed = await layout(RING.replace('{ x: 120, y: 460 }', '{ x: -60, y: 460 }'));
    for (const edge of placed.edges) {
      for (const point of edge.points) {
        assert.ok(point.x >= 0, `通り道が画用紙の外にある（x: ${point.x}）`);
      }
    }
  });
});
