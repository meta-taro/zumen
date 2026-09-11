/**
 * 書き出す図のテーマ（md-business#240 の依頼）。
 *
 * ## なぜ足したか
 *
 * `DESIGN.md` §3 は「**ダークの値は書き出さない**」と決めていた。
 * 理由は「**貼り先の地の色が分からない**」から。
 *
 * その理由は、**貼り先が自分で名乗るなら当たらない。**
 * md-business は自分がダークかを知っていて、それを渡してくる。
 *
 * > 背景を敷く案は採りません。敷いても図自身の線と枠はライトの値のままなので、
 * > 暗い地の上に明るい線が浮いた状態が残ります。
 * >   — md-business#240
 *
 * **既定はライトのまま。** 名乗らない貼り先の見え方は 1 mm も変えない。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toSvg } from '../src/embed.ts';
import { exportAs } from '../src/tools.ts';
import { DARK, TOKEN, paletteOf } from '../src/tokens.ts';

const SOURCE = [
  'version: 1',
  // `appearance` は人が書くもので、`pins` にしか書けない（仕様 §3.4）。
  'pins:',
  '  web:',
  '    appearance: primary',
  'groups:',
  '  - id: vpc',
  '    label: VPC',
  'nodes:',
  '  - id: lb',
  '    label: Load Balancer',
  '    group: vpc',
  '  - id: web',
  '    label: Web',
  '    group: vpc',
  'edges:',
  '  - from: lb',
  '    to: web',
  '    label: HTTPS',
  '',
].join('\n');

describe('色の対応表', () => {
  it('ダークの値を持っている', () => {
    assert.equal(DARK.bgApp, '#0f0f13');
    assert.equal(DARK.textPrimary, '#f4f4f6');
  });

  it('**ライトと同じ名前をすべて持つ**（片方にしか無い色を作らない）', () => {
    assert.deepEqual(Object.keys(DARK).sort(), Object.keys(TOKEN).sort());
  });

  it('明暗が逆になっている（取り違えていない）', () => {
    assert.notEqual(DARK.bgApp, TOKEN.bgApp);
    assert.notEqual(DARK.textPrimary, TOKEN.textPrimary);
  });

  it('**既定はライト**', () => {
    assert.deepEqual(paletteOf(), paletteOf('light'));
  });
});

describe('SVG を書き出す', () => {
  it('**何も言わなければライト**（名乗らない貼り先の見え方を変えない）', async () => {
    const svg = await toSvg(SOURCE);
    assert.ok(svg.includes(TOKEN.bgApp), 'ライトの地が入っていない');
    assert.equal(svg.includes(DARK.bgApp), false, 'ダークの値が混ざっている');
  });

  it('dark と言えばダークで返る', async () => {
    const svg = await toSvg(SOURCE, { theme: 'dark' });
    // **箱の地は `neutralBg`**（ダークでは箱を一段持ち上げる。`DESIGN.md` §8）。
    // `bgApp` を探すと、地と同じ塗りだった頃の前提になる。
    assert.ok(svg.includes(DARK.neutralBg), 'ダークの箱の地が入っていない');
    assert.ok(svg.includes(DARK.textPrimary), 'ダークの文字色が入っていない');
  });

  it('**ライトの値が 1 つも残らない**（混ざると、その要素だけ浮く）', async () => {
    const svg = await toSvg(SOURCE, { theme: 'dark' });
    for (const [name, value] of Object.entries(TOKEN)) {
      if ((DARK as Record<string, string>)[name] === value) continue;
      // ライトの `textPrimary`（#1c1c22）は、**ダークでは使わないが値としては同じ**
      // ではない。ただし `textOnAccent` はどちらも #ffffff で、
      // **ダークの箱の枠に使う**（地から最も遠いインク。`DESIGN.md` §8）。
      if (name === 'bgApp' && DARK.textOnAccent === value) continue;
      assert.equal(svg.includes(value), false, `${name}（${value}）が残っている`);
    }
  });

  it('囲み・線・体裁の語も、ダークの値になる', async () => {
    const svg = await toSvg(SOURCE, { theme: 'dark' });
    assert.ok(svg.includes(DARK.bgSubtle), '囲みの地');
    assert.ok(svg.includes(DARK.textSecondary), '線');
    assert.ok(svg.includes(DARK.accentSubtle), 'appearance: primary の地');
  });

  it('図の形はテーマで変わらない（色だけが変わる）', async () => {
    const strip = (svg: string) => svg.replace(/#[0-9a-f]{6}/g, '#');
    assert.equal(strip(await toSvg(SOURCE)), strip(await toSvg(SOURCE, { theme: 'dark' })));
  });

  it('**エージェントの口からも渡せる**（zumen_export）', async () => {
    const svg = await exportAs(SOURCE, 'svg', { theme: 'dark' });
    assert.ok(svg.includes(DARK.neutralBg));
  });

  it('SVG 以外はテーマを持たない（draw.io は貼り先が色を持つ／mermaid は自前のテーマ）', async () => {
    const xml = await exportAs(SOURCE, 'drawio', { theme: 'dark' });
    assert.equal(xml.includes(DARK.bgApp), false);
  });
});
