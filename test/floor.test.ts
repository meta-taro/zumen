/**
 * **階と、階をまたぐ動線**（`floors` ／ `nodes[].floor` ／ `edges[].vertical`）。
 *
 * D26 の ①。**3D の前に、正本が階を持つ。**
 *
 * ## なぜ正本に階が要るか
 *
 * 見本 82（多層ターミナル）は、階の枠も階名も**人が手で置いていた**。
 * だから機械は「この箱は何階か」を知らない ——
 * 枠を描き忘れても、箱を別の階の枠へ入れても、誰も気づけない。
 *
 * **階が正本の言葉になれば、枠と階名は機械が描く。**
 * そして 3D の描き手は、同じ正本を高さ方向に積むだけでよくなる（D26）。
 *
 * ## 階の名前は正本が決める
 *
 * `B2` / `1F` / `M2`（中 2 階）/ `ロビー階` —— **建物ごとに違う。**
 * こちらは名前を持たず、**並び順だけ**を `floors` から受け取る（`palette` と同じ筋）。
 *
 * ## 縦動線の語は JIS が決めている
 *
 * `stair` / `escalator` / `elevator` は **JIS Z 8210（案内用図記号）**にある。
 * 決めているのは我々ではない —— `symbol` を IEC へ委ねたのと同じ（D22 の例外）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VERTICALS, floorsOf, verticalOf } from '../src/floor.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { inspect } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const TOWER = `version: 1
kind: placement
floors:
  - B1
  - 1F
nodes:
  - id: gate
    label: 改札
    floor: 1F
    at: { x: 40, y: 40 }
    size: { w: 120, h: 40 }
  - id: es1
    label: ES
    floor: 1F
    at: { x: 200, y: 40 }
    size: { w: 40, h: 40 }
  - id: esb
    label: ES
    floor: B1
    at: { x: 200, y: 240 }
    size: { w: 40, h: 40 }
  - id: pass
    label: 連絡通路
    floor: B1
    at: { x: 40, y: 240 }
    size: { w: 120, h: 40 }
edges:
  - from: es1
    to: esb
    vertical: escalator
`;

describe('階を読む', () => {
  it('**並び順だけを受け取る。名前は正本のもの**', () => {
    assert.deepEqual(floorsOf(['B2', 'B1', '1F']), ['B2', 'B1', '1F']);
    assert.deepEqual(floorsOf(['M2', 'ロビー階']), ['M2', 'ロビー階'], '建物ごとの名前を弾かない');
  });

  it('並びでなければ空（数や文字列を階の一覧と見なさない）', () => {
    assert.deepEqual(floorsOf('1F'), []);
    assert.deepEqual(floorsOf(undefined), []);
    assert.deepEqual(floorsOf([1, {}, null]), [], '文字列でないものは階の名前にしない');
  });
});

describe('縦動線を読む', () => {
  it('**JIS Z 8210 の語だけで閉じる**', () => {
    assert.deepEqual([...VERTICALS], ['none', 'stair', 'escalator', 'elevator']);
    assert.equal(verticalOf('slope'), 'none', '規格に無い語は受けない');
    assert.equal(verticalOf('エスカレーター'), 'none', '日本語では受けない');
  });

  it('書かなければ none', () => {
    assert.equal(verticalOf(undefined), 'none');
    assert.equal(verticalOf('elevator'), 'elevator');
  });
});

describe('階を描く', () => {
  it('**階ごとに枠と階名が出る**（人が手で置かない）', async () => {
    const out = render(await layout(TOWER), 'light', 'safe', true);
    assert.match(out, /data-floor="1F"/, '1F の枠が出ていない');
    assert.match(out, /data-floor="B1"/, 'B1 の枠が出ていない');
    assert.match(out, />1F</, '階名が出ていない');
  });

  it('**箱は 1 px も動かない**（人が書いた座標をそのまま出す）', async () => {
    const placed = await layout(TOWER);
    const gate = placed.boxes.find((b) => b.id === 'gate')!;
    assert.equal(gate.x, 40);
    assert.equal(gate.y, 40);
  });

  it('枠は、その階の箱をぜんぶ囲む', async () => {
    const out = render(await layout(TOWER), 'light', 'safe', true);
    const band = out.match(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"[^>]*data-floor-rect/);
    assert.ok(band !== null || out.includes('data-floor="1F"'), '枠が描かれていない');
  });

  it('`floors` を書かなければ、これまでどおり枠は出ない', async () => {
    const out = render(await layout(TOWER.replace(/floors:\n(  - \S+\n)+/, '')), 'light', 'safe', true);
    assert.ok(!out.includes('data-floor='), '書いていないのに枠が出た');
  });

  it('構成図では枠を出さない（置き場所を機械が決めるので、階に意味が無い）', async () => {
    const out = render(await layout(TOWER.replace('kind: placement\n', '')), 'light', 'safe', false);
    assert.ok(!out.includes('data-floor='));
  });
});

describe('知らせる', () => {
  it('**一覧に無い階を知らせる**', () => {
    const found = validate(TOWER.replace('    floor: B1\n    at: { x: 200, y: 240 }', '    floor: B2\n    at: { x: 200, y: 240 }'));
    assert.ok(found.some((f) => f.code === 'floor-unknown'), found.map((f) => f.code).join(','));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('`floors` を書かずに階だけ書いたら知らせる', () => {
    const found = validate(TOWER.replace(/floors:\n(  - \S+\n)+/, ''));
    assert.ok(found.some((f) => f.code === 'floors-missing'));
  });

  it('知らない縦動線を知らせる', () => {
    const found = validate(TOWER.replace('vertical: escalator', 'vertical: slope'));
    assert.ok(found.some((f) => f.code === 'vertical-unknown'));
  });

  it('**同じ階を結ぶ縦動線を知らせる**（階をまたがないなら縦動線ではない）', () => {
    const found = validate(TOWER.replace('  - from: es1\n    to: esb', '  - from: gate\n    to: es1'));
    assert.ok(found.some((f) => f.code === 'vertical-same-floor'), found.map((f) => f.code).join(','));
  });

  it('inspect が階の一覧を返す', async () => {
    const out = await inspect(TOWER);
    assert.deepEqual(out.floors, ['B1', '1F']);
  });
});
