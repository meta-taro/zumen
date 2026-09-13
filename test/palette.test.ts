/**
 * **路線の色**（`palette` と `color`）。
 *
 * ## なぜ DESIGN.md §7 の例外を作るのか
 *
 * `DESIGN.md` §7 は「**色ではなく形で意味を持たせる**」と決めている
 * （白黒で印刷しても、色覚特性でも、縮小しても失われないため）。
 *
 * オーナーの判断（2026-09-13）。
 *
 * > **色が文化であれば色のルールが優先されます。**
 *
 * 日本の路線図では**色が路線の名前**（銀座線はオレンジ、丸ノ内線は赤）。
 * 「オレンジの線」と言えば銀座線のことで、**色を落とすと名前が消える。**
 * ここは §7 が想定した「見た目の飾り」ではなく、**記法そのもの。**
 *
 * ## それでも、色だけに頼らせない
 *
 * 実物の東京メトロも**色と番号の両方**で読ませている（`G-09` の `G`）。
 * 色覚特性のある人と、白黒で刷った人が読めなくなるため。
 *
 * そこで **`palette` の鍵は路線記号そのもの**にし、
 * **その記号が図に文字として出ていること**（`tag` の頭）を検証器が見る。
 * 色を使っているのに記号が出ていなければ知らせる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { colorOf, contrastOn, paletteOf as routePalette } from '../src/palette.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';

const MAP = `version: 1
kind: placement
arrows: false
palette:
  G: "#f39700"
  M: "#e5171f"
nodes:
  - id: a
    label: 浅草
    tag: G-01
    color: G
    marker: circle
    at: { x: 0, y: 0 }
    size: { w: 34, h: 34 }
  - id: b
    label: 上野
    tag: G-16
    color: G
    marker: circle
    at: { x: 200, y: 0 }
    size: { w: 34, h: 34 }
edges:
  - from: a
    to: b
    color: G
    weight: thick
`;

describe('路線の色を読む', () => {
  it('**正本が色を決める。** こちらは色を持たない', () => {
    assert.deepEqual(routePalette({ G: '#f39700' }), { G: '#f39700' });
  });

  it('`#rrggbb` でないものは落とす', () => {
    assert.deepEqual(routePalette({ G: 'orange', M: '#e5171f' }), { M: '#e5171f' });
    assert.deepEqual(routePalette({ G: '#fff' }), {});
    assert.deepEqual(routePalette(undefined), {});
  });

  it('鍵に無い色は使わない', () => {
    assert.equal(colorOf('G', { G: '#f39700' }), '#f39700');
    assert.equal(colorOf('Z', { G: '#f39700' }), null);
    assert.equal(colorOf(undefined, { G: '#f39700' }), null);
  });

  it('**地とのコントラストを測れる**（薄い色は線が消える）', () => {
    assert.ok(contrastOn('#f39700', '#ffffff') > 1.5);
    assert.ok(contrastOn('#fefefe', '#ffffff') < 1.2);
  });
});

describe('路線の色を描く', () => {
  it('**線が路線の色になる**', async () => {
    const out = render(await layout(MAP), 'light', 'safe', true);
    assert.match(out, /<path d="[^"]*"[^>]*stroke="#f39700"/);
  });

  it('**駅の印も路線の色になる**（線と駅が同じ路線だと分かる）', async () => {
    const out = render(await layout(MAP), 'light', 'safe', true);
    assert.match(out, /data-node="a"[\s\S]*?<circle [^>]*stroke="#f39700"/);
  });

  it('**文字までは染めない。** 地の上で読めなくなる', async () => {
    const out = render(await layout(MAP), 'light', 'safe', true);
    assert.ok(!/<text[^>]*fill="#f39700"/.test(out), '文字まで色を付けた');
  });

  it('色を書かなければ、これまでどおり', async () => {
    const out = render(await layout(MAP.replace(/    color: G\n/g, '')), 'light', 'safe', true);
    assert.ok(!out.includes('#f39700'));
  });
});

describe('色だけに頼らせない', () => {
  it('**色を使うなら、路線記号が図に出ていること**（`G-01` の `G`）', () => {
    // `tag: 01` は YAML で数の `1` になる（書き戻しで落ちる）ので、A-01 を使う。
    const found = validate(MAP.replace('tag: G-01', 'tag: A-01'));
    assert.ok(
      found.some((f) => f.code === 'color-without-code'),
      '色だけで路線を示しているのに、知らせていない',
    );
  });

  it('記号が出ていれば、何も言わない', () => {
    assert.ok(!validate(MAP).some((f) => f.code === 'color-without-code'));
  });

  it('**薄すぎる色を知らせる**（白黒に落とすと消える）', () => {
    const found = validate(MAP.replace('#f39700', '#fdfdfd'));
    assert.ok(found.some((f) => f.code === 'color-faint'));
  });

  it('鍵に無い色を知らせる', () => {
    assert.ok(validate(MAP.replace('color: G\n    marker', 'color: Z\n    marker')).some((f) => f.code === 'color-unknown'));
  });

  it('どれも warning（読めない図ではない）', () => {
    const found = validate(MAP.replace('tag: G-01', 'tag: A-01').replace('#f39700', '#fdfdfd'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });
});

/**
 * **塗りにも色が乗る。**
 *
 * 停車駅案内図の ●（停車）で出た（2026-09-13）。枠だけ色を付けて中を
 * 既定の墨で塗ったので、**どの種別の ● なのか、色で読めなかった。**
 * 実物の案内も、●そのものが種別の色をしている。
 */
describe('塗りにも色が乗る', () => {
  const DOT = `version: 1
kind: placement
palette:
  kyuko: "#d95f02"
nodes:
  - id: stop
    label: ""
    marker: circle
    hatch: solid
    color: kyuko
    at: { x: 0, y: 0 }
    size: { w: 20, h: 20 }
`;

  it('**塗りは、その色**（既定の墨で塗らない）', async () => {
    const out = render(await layout(DOT), 'light', 'safe', true);
    assert.match(out, /<circle [^>]*fill="#d95f02" fill-opacity="0.82"/);
  });

  it('色を書かなければ、これまでどおり墨で塗る', async () => {
    const out = render(await layout(DOT.replace('    color: kyuko\n', '')), 'light', 'safe', true);
    assert.match(out, /<circle [^>]*fill="#1c1c22" fill-opacity="0.82"/);
  });
});
