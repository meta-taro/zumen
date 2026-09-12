/**
 * **範囲を示す円**（`nodes[].radius`）。
 *
 * [#4](https://github.com/meta-taro/zumen/issues/4) の原題は総合仮設計画図で、
 * 実物に必ず入る 10 種のうち**揚重機だけが矩形では描けなかった。**
 *
 * クレーンの作業計画に要るのは、機種・定格荷重・**作業半径**・揚程・据付位置。
 * **作業半径が描けないと、そのクレーンで届くかが図から読めない。**
 *
 * D22（業界ごとに `type` を増やさない）には当たらない ——
 * **クレーンは円ではない。円はクレーンが届く範囲**で、寸法線と同じ種類のもの。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { radiusOf, ringOf } from '../src/range.ts';
import { render } from '../src/render.ts';

const SITE = `version: 1
kind: placement
scale: { mm: 250 }
nodes:
  - id: crane
    label: 移動式クレーン
    tag: CR-1
    technology: 25t 吊・定格 5.0t/10m
    at: { x: 200, y: 200 }
    size: { w: 40, h: 40 }
    radius: 100
  - id: shizai
    label: 資材置場
    at: { x: 0, y: 0 }
    size: { w: 120, h: 80 }
`;

async function svg(text: string): Promise<string> {
  return render(await layout(text), 'light', 'safe', true);
}

describe('半径を読む', () => {
  it('正の数だけ読む', () => {
    assert.equal(radiusOf(100), 100);
    assert.equal(radiusOf(0), null);
    assert.equal(radiusOf(-5), null);
    assert.equal(radiusOf('100'), null);
    assert.equal(radiusOf(undefined), null);
  });

  it('中心は箱の中心', () => {
    const ring = ringOf({ x: 200, y: 200, w: 40, h: 40, radius: 100 }, null)!;
    assert.equal(ring.cx, 220);
    assert.equal(ring.cy, 220);
    assert.equal(ring.r, 100);
  });

  it('**縮尺があれば mm を書き添える**（100px × 250 = 25,000）', () => {
    assert.equal(ringOf({ x: 0, y: 0, w: 0, h: 0, radius: 100 }, 250)!.label, 'R=25,000');
  });

  it('**縮尺が無ければ数値を出さない**（寸法線と同じ）', () => {
    assert.equal(ringOf({ x: 0, y: 0, w: 0, h: 0, radius: 100 }, null)!.label, null);
  });

  it('書かなければ円は無い', () => {
    assert.equal(ringOf({ x: 0, y: 0, w: 0, h: 0, radius: null }, 250), null);
  });
});

describe('範囲を描く', () => {
  it('**作業半径の円が出る**', async () => {
    const out = await svg(SITE);
    assert.match(out, /<circle [^>]*r="100"/, '作業半径の円が描かれていない');
    assert.ok(out.includes('>R=25,000<'), '半径の数値が出ていない');
  });

  it('**破線で描く。** 実線だと「物がある」ことになる', async () => {
    assert.match(await svg(SITE), /<circle [^>]*r="100"[^>]*stroke-dasharray="8 5"/);
  });

  it('塗らない（下の図が隠れる）', async () => {
    assert.match(await svg(SITE), /<circle [^>]*r="100"[^>]*fill="none"/);
  });

  it('**箱の上に描く。** 下だと資材置場の塗りで切れる', async () => {
    const out = await svg(SITE);
    assert.ok(out.indexOf('data-range=') > out.lastIndexOf('data-node='), '円が箱の下にある');
  });

  it('半径を書いた箱だけに出る', async () => {
    assert.equal((await svg(SITE)).match(/data-range=/g)!.length, 1);
  });

  it('**構成図には描かない**（範囲は置き場所のある図のもの）', async () => {
    const out = render(await layout(SITE.replace('kind: placement', '')), 'light', 'safe', false);
    assert.ok(!out.includes('data-range='));
  });

  it('円が図からはみ出しても、描くこと自体は止めない', async () => {
    const out = await svg(SITE.replace('radius: 100', 'radius: 400'));
    assert.match(out, /<circle [^>]*r="400"/);
  });
});
