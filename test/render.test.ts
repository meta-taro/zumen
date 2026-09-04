/**
 * 描画まで通して、人の指定が効いているかを見る。
 *
 * 判定基準の Tier B は、位置以外の手直し（大きさ・ラベル・体裁・エッジの曲げ方）。
 * 正本に残っていても描画が無視するなら保持したことにならないので、
 * ここでは **SVG に出た値** で確かめる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parse, serialize, setPin } from '../src/format.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

function pinned(id: string, pin: Parameters<typeof setPin>[2]): string {
  const doc = parse(R0);
  setPin(doc, id, pin);
  return serialize(doc);
}

async function svgOf(text: string): Promise<string> {
  return render(await layout(text));
}

describe('Tier B — 位置以外の手直しが描画まで届くか', () => {
  it('人が変えた大きさが、そのまま描かれる', async () => {
    const svg = await svgOf(pinned('db', { size: { w: 240, h: 96 } }));
    assert.match(svg, /width="240" height="96"/);
  });

  it('人が変えたラベルが、そのまま描かれる', async () => {
    const svg = await svgOf(pinned('db', { label: '本番 DB' }));
    assert.match(svg, /本番 DB/);
    assert.doesNotMatch(svg, />MariaDB</);
  });

  it('人が指定した体裁が、描画の属性として出る', async () => {
    const svg = await svgOf(pinned('db', { appearance: 'primary' }));
    assert.match(svg, /data-appearance="primary"/);
  });

  it('人が曲げたエッジの経路が、そのまま通る', async () => {
    const svg = await svgOf(
      pinned('web01>db', { waypoints: [{ x: 10, y: 20 }, { x: 30, y: 40 }] }),
    );
    // 曲げた点が、そのままの値で経路に入っていること。
    assert.match(svg, /data-edge="web01&gt;db"[\s\S]*?d="M [^"]*L 10 20 L 30 40 L/);
  });
});

describe('render', () => {
  it('ノード・グループ・エッジがすべて出る', async () => {
    const placed = await layout(R0);
    const svg = render(placed);
    for (const box of placed.boxes) {
      assert.match(svg, new RegExp(`data-node="${box.id}"`), `${box.id} が描かれていない`);
    }
    assert.match(svg, /data-group="vpc"/);
    assert.equal((svg.match(/data-edge=/g) ?? []).length, 8);
  });

  it('人が置いたノードには印が付く（画面で見分けられる）', async () => {
    // どれが人の指定かが見えないと、AI が戻したことに気づけない（PRD §2 の動かした点 2）。
    const svg = await svgOf(pinned('db', { position: { x: 620, y: 410 } }));
    assert.match(svg, /data-node="db"[^>]*data-pinned="true"/);
  });

  it('ラベルは記法を壊さない形で入る', async () => {
    const svg = await svgOf(pinned('db', { label: '<script>&"' }));
    assert.doesNotMatch(svg, /<script>/);
    assert.match(svg, /&lt;script&gt;&amp;&quot;/);
  });
});
