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
    // **形は `type` で変わる**（Issue #9。`db` は円柱）ので、`<rect>` を直に見ない。
    // 見るのは「人の値が配置まで届いたか」と「その大きさで描かれたか」の 2 つ。
    const source = pinned('db', { size: { w: 240, h: 96 } });
    const placed = await layout(source);
    const db = placed.boxes.find((box) => box.id === 'db')!;
    assert.equal(db.w, 240);
    assert.equal(db.h, 96);

    const svg = await svgOf(source);
    const group = /<g data-node="db"[\s\S]*?<\/g>/.exec(svg)?.[0] ?? '';
    assert.notEqual(group, '', 'db が描かれていない');
    // 円柱は幅の半分を横半径に使う。**人の値から出た数字が絵に入っていること。**
    assert.match(group, /120/, group);
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
    // グループは id ではなく label で描く。id が出ていたら人には意味が伝わらない。
    assert.match(svg, /data-group="vpc"[\s\S]*?>Production VPC</);
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

/**
 * **図の題を SVG の中へ入れる**（`<title>`）。
 *
 * 2026-09-13。`title` は Markdown へ埋め込むときの代替文字にしか使っていなかった。
 * **書き出した SVG そのものには、何の図かがどこにも書かれていない。**
 *
 * SVG を 1 枚だけ人に渡す使い方（グループチャットへ投げる）が実際にあるので、
 * **絵を見られない人と機械にも、何の図かが届く**必要がある。
 * 描くものは増やさない —— `<title>` は表示されない。
 */
describe('図の題は SVG の中にある', () => {
  const SRC = `version: 1
title: 中央本町商店街 店舗案内図
nodes:
  - id: a
    label: 甲
  - id: b
    label: 乙
`;

  it('**`<title>` が、svg のいちばん最初の子になる**（読み上げの順）', async () => {
    const out = render(await layout(SRC), 'light', 'safe', false);
    assert.match(out, /^<svg [^>]*>\s*<title>中央本町商店街 店舗案内図<\/title>/);
  });

  it('題が無ければ、`<title>` を出さない（空の題を作らない）', async () => {
    const out = render(await layout(SRC.replace(/^title: .*\n/m, '')), 'light', 'safe', false);
    assert.ok(!out.includes('<title>'), '題が無いのに出した');
  });

  it('題の記号は逃がす（図が壊れない）', async () => {
    const out = render(await layout(SRC.replace('中央本町商店街 店舗案内図', 'A & B <試作>')), 'light', 'safe', false);
    assert.match(out, /<title>A &amp; B &lt;試作&gt;<\/title>/);
  });

  it('配置図でも入る', async () => {
    const out = render(
      await layout('version: 1\nkind: placement\ntitle: 平面図\nnodes:\n  - id: a\n    label: 室\n    at: { x: 0, y: 0 }\n    size: { w: 80, h: 40 }\n'),
      'light',
      'safe',
      true,
    );
    assert.match(out, /<title>平面図<\/title>/);
  });
});

/**
 * **別の箱の模様の上に載った文字も、下地を抜く。**
 *
 * 仕様は「模様の上に文字を重ねると読めないので、文字の下地を抜く」と書いてある。
 * ところが抜いていたのは**自分の箱が持つ模様だけ**で、
 * **別の箱の上に載った文字は模様に埋もれていた**（2026-09-15。実物を見て見つけた）。
 *
 * いちばんひどいのは塗り潰しの上 ——
 * Bottom Navigation の帯（`solid`）の上に、同じ濃さの文字が出ていた（見本 87）。
 */
describe('模様の上に載った文字', () => {
  const BAND = `version: 1
kind: placement
nodes:
  - id: bar
    label: ""
    hatch: solid
    at: { x: 0, y: 0 }
    size: { w: 300, h: 40 }
  - id: tab
    label: ホーム
    marker: none
    at: { x: 20, y: 6 }
    size: { w: 60, h: 28 }
`;

  it('**帯の上のタブ名に、下地が入る**', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(BAND), 'light', 'safe', true);
    const node = out.match(/<g data-node="tab"[\s\S]*?<\/g>/)![0];
    assert.match(node, /<rect [^>]*fill="#ffffff"/, '下地が抜かれていない');
  });

  it('**帯が無ければ、下地も入らない**（余計な白い板を出さない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(BAND.replace('    hatch: solid\n', '')), 'light', 'safe', true);
    const node = out.match(/<g data-node="tab"[\s\S]*?<\/g>/)![0];
    assert.ok(!/<rect /.test(node), '何も無いのに下地を抜いた');
  });

  it('文字が半分しかかかっていなければ、抜かない', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(BAND.replace('at: { x: 20, y: 6 }', 'at: { x: 270, y: 6 }')), 'light', 'safe', true);
    const node = out.match(/<g data-node="tab"[\s\S]*?<\/g>/)![0];
    assert.ok(!/<rect /.test(node));
  });
});

/**
 * **文字を地の色にした箱では、下地を抜かない。**
 *
 * 塗り潰し（`solid`）の箱は、文字を地の色（白）にしている。
 * そこへ下地（白い板）を敷くと、**白い板に白い字**になって消える。
 *
 * 2026-09-15、区画（`dots`）の中に置いた塗り潰しの箱で実際に踏んだ ——
 * 「別の箱の模様の上でも下地を抜く」を入れた直後の回帰。
 */
describe('地の色にした文字と、下地', () => {
  const ZONE = `version: 1
kind: placement
nodes:
  - id: zone
    label: ""
    hatch: dots
    at: { x: 0, y: 0 }
    size: { w: 300, h: 200 }
  - id: door
    label: 搬入口
    hatch: solid
    at: { x: 20, y: 40 }
    size: { w: 100, h: 30 }
`;

  it('**白い板に白い字にしない**', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(ZONE), 'light', 'safe', true);
    const node = out.match(/<g data-node="door"[\s\S]*?<\/g>/)![0];
    // 文字は地の色。**その直前に白い板があってはいけない。**
    assert.match(node, /<text[^>]*fill="#ffffff"/, '塗りの上の文字が地の色になっていない');
    assert.ok(!/<rect [^>]*fill="#ffffff"\/><text/.test(node), '白い板に白い字を書いている');
  });
});
