/**
 * **線の太さ**（`edges[].weight`）。
 *
 * オーナーの指示（2026-09-13）——「路線図は**日本の路線図を参考に**描けるように
 * なってほしい」。
 *
 * 実物を調べたところ、日本の路線図の決まりごとは次のとおりだった。
 *
 * | | |
 * |---|---|
 * | 線の角度 | **水平・垂直・斜め 45 度のみ** |
 * | 駅の識別 | **駅ナンバリング**（路線記号＋番号）。色と番号で読む |
 * | 線 | **太く、角を丸く**（丸ゴシック体に合わせた柔らかさ） |
 * | 乗換駅 | 駅名を**白枠に収める** |
 *
 * 45 度は座標で書ける。駅ナンバリングは `tag` で書ける。
 * **足りないのは線の太さだけ** —— いまは 2px で、駅の丸より細い。
 *
 * 値は太さの名前だけ（`marker` `hatch` `ends` `line` と同じ約束）。
 * **`weight: subway`（地下鉄）のような意味の語は足さない。**
 *
 * これは **D23 のあとで最初に書くテスト**なので、
 * **実装より先に書いて red を確かめる**（`.claude/decisions.md` の D23）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { WEIGHTS, weightOf, widthOf } from '../src/weight.ts';
import { validate } from '../src/validate.ts';

const ROUTE = `version: 1
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
    label: 桜台
    tag: H02
    marker: circle
    at: { x: 200, y: 100 }
    size: { w: 34, h: 34 }
edges:
  - from: a
    to: b
    weight: thick
`;

describe('太さを読む', () => {
  it('**3 つで閉じる。意味の語は無い**', () => {
    assert.deepEqual([...WEIGHTS], ['thin', 'normal', 'thick']);
    assert.equal(weightOf('subway'), 'normal', '意味の語を受けてはいけない');
    assert.equal(weightOf('5'), 'normal', '数を受けてはいけない');
  });

  it('書かなければ normal（これまでの図の見え方を変えない）', () => {
    assert.equal(weightOf(undefined), 'normal');
    assert.equal(weightOf('thick'), 'thick');
  });

  it('太さは px になる。**太いほうが駅の丸より太くない**（丸が埋もれる）', () => {
    assert.ok(widthOf('thin') < widthOf('normal'));
    assert.ok(widthOf('normal') < widthOf('thick'));
    assert.ok(widthOf('thick') <= 6, `${widthOf('thick')}px は太すぎる`);
  });
});

describe('太さを描く', () => {
  it('**太い線で描く**', async () => {
    const out = render(await layout(ROUTE), 'light', 'safe', true);
    assert.match(out, new RegExp(`<path d="[^"]*"[^>]*stroke-width="${widthOf('thick')}"`));
  });

  it('**太い線は角を丸める。** 日本の路線図は角丸で描く', async () => {
    const out = render(await layout(ROUTE), 'light', 'safe', true);
    assert.match(out, /stroke-linejoin="round"/, '角が丸まっていない');
    assert.match(out, /stroke-linecap="round"/, '端が丸まっていない');
  });

  it('書かなければ、これまでどおりの太さ（角も丸めない）', async () => {
    const out = render(await layout(ROUTE.replace('    weight: thick\n', '')), 'light', 'safe', true);
    assert.ok(!out.includes('stroke-linejoin="round"'), '書いていないのに角が丸まった');
  });

  it('**駅の丸は線の上に出る。** 線に串刺しにされない', async () => {
    const out = render(await layout(ROUTE), 'light', 'safe', true);
    assert.ok(out.indexOf('data-edge=') < out.indexOf('data-node='), '線が駅の上にある');
  });

  it('知らない語を警告する', () => {
    const found = validate(ROUTE.replace('weight: thick', 'weight: futoi'));
    assert.ok(found.some((f) => f.code === 'weight-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('spec が太さの語を返す', () => {
    assert.deepEqual(spec().weights, ['thin', 'normal', 'thick']);
    assert.match(spec().shape, /weight:/);
  });
});
