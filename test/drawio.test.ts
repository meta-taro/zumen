/**
 * draw.io への書き出し（Issue 013）。
 *
 * Mermaid 書き出しとは担保するものが違う。
 * Mermaid は「翌日**読める**」、draw.io は「翌日**編集できる**」。
 *
 * ここで守るのは 3 つ。
 *
 * 1. **圧縮しない**（差分が読めなくなる）
 * 2. **落ちるものを黙って落とさない**（先頭のコメントに列挙する）
 * 3. XML として壊れていない（ラベルに `&` や `<` が入っても）
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { toDrawio } from '../src/drawio.ts';
import { parse, serialize, setPin } from '../src/format.ts';
import { layout } from '../src/layout.ts';
import { messages } from '../src/messages.ts';
import { APPEARANCE } from '../src/tokens.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

async function exported(text: string, title?: string): Promise<string> {
  return toDrawio(await layout(text), title);
}

function withPin(text: string, id: string): string {
  const doc = parse(text);
  setPin(doc, id, { position: { x: 620, y: 410 }, appearance: 'primary' });
  return serialize(doc);
}

describe('draw.io が開ける形になっている', () => {
  it('mxfile / diagram / mxGraphModel の入れ子がある', async () => {
    const xml = await exported(R0);
    assert.match(xml, /<mxfile host="zumen">/);
    assert.match(xml, /<diagram name=/);
    assert.match(xml, /<mxGraphModel /);
    assert.match(xml, /<root>/);
  });

  it('draw.io が要る土台の 2 セル（id 0 と 1）がある', async () => {
    const xml = await exported(R0);
    assert.match(xml, /<mxCell id="0" \/>/);
    assert.match(xml, /<mxCell id="1" parent="0" \/>/);
  });

  it('ノードが箱として出る', async () => {
    const xml = await exported(R0);
    assert.match(xml, /id="web01"[^>]*vertex="1"/);
    assert.match(xml, /<mxGeometry x="\d+" y="\d+" width="\d+" height="\d+"/);
  });

  it('エッジが両端を指して出る', async () => {
    const xml = await exported(R0);
    assert.match(xml, /edge="1"[^>]*source="internet" target="lb"/);
  });

  it('囲みがノードより先に出る（後の要素が手前に描かれるため）', async () => {
    const xml = await exported(R0);
    assert.ok(xml.indexOf('id="vpc"') < xml.indexOf('id="web01"'));
  });

  it('開いていないタグを残さない（中間点が無いエッジは空要素にしない）', async () => {
    const xml = await exported(R0);
    assert.equal(xml.includes('<mxGeometry relative="1" as="geometry">\n          </mxGeometry>'), false);
  });
});

describe('**圧縮しない**（差分が読めなくなる）', () => {
  it('本文がそのまま読める', async () => {
    const xml = await exported(R0);
    assert.match(xml, /value="Load Balancer"/);
  });

  it('deflate + base64 の塊を作らない', async () => {
    const xml = await exported(R0);
    // draw.io の圧縮形式は <diagram>…</diagram> の中が base64 の 1 行になる。
    assert.equal(/<diagram[^>]*>[A-Za-z0-9+/=]{80,}<\/diagram>/.test(xml), false);
  });
});

describe('**落ちるものを黙って落とさない**', () => {
  it('落ちるものが先頭のコメントに並ぶ', async () => {
    const xml = await exported(R0);
    const head = xml.slice(0, xml.indexOf('<mxfile'));
    const m = messages().drawio;
    assert.ok(head.includes(m.lossHeading));
    assert.ok(head.includes(m.lossPinned));
    assert.ok(head.includes(m.lossAppearance));
    assert.ok(head.includes(m.lossRoundTrip));
  });

  it('人の指定が無ければ、pin の断り書きは出さない（要らない行を増やさない）', async () => {
    const xml = await exported(R0);
    assert.equal(xml.includes(messages().drawio.pinnedNote), false);
  });

  it('人が置いた要素があれば、断り書きを添える', async () => {
    const xml = await exported(withPin(R0, 'db'));
    assert.ok(xml.includes(messages().drawio.pinnedNote));
  });

  it('人が置いた要素は zumenPinned を持つ（誰が置いたかが残る）', async () => {
    const xml = await exported(withPin(R0, 'db'));
    assert.match(xml, /<object label="MariaDB" zumenPinned="1" id="db">/);
  });

  it('自動配置の要素には zumenPinned を付けない', async () => {
    const xml = await exported(withPin(R0, 'db'));
    assert.equal(/id="web01"[^>]*zumenPinned/.test(xml), false);
  });

  it('体裁は色に変換される（語は残らない。だから落ちるものに書いてある）', async () => {
    const xml = await exported(withPin(R0, 'db'));
    assert.ok(xml.includes(`fillColor=${APPEARANCE['primary']!.fill}`));
    assert.equal(xml.includes('appearance'), false);
  });
});

describe('XML として壊れない', () => {
  const nasty = [
    'version: 1',
    'title: A & B <test>',
    'nodes:',
    '  - id: a',
    '    label: "引用符\\" と & と <tag>"',
    '  - id: b',
    '    label: B',
    'edges:',
    '  - from: a',
    '    to: b',
    '    label: "a > b"',
    '',
  ].join('\n');

  it('ラベルの & < > " が実体参照になる', async () => {
    const xml = await exported(nasty);
    assert.match(xml, /value="引用符&quot; と &amp; と &lt;tag&gt;"/);
  });

  it('題の特殊文字も逃がす', async () => {
    const xml = await exported(nasty, 'A & B <test>');
    assert.match(xml, /<diagram name="A &amp; B &lt;test&gt;">/);
  });

  it('エッジの id（from>to）が属性として壊れない', async () => {
    const xml = await exported(nasty);
    assert.match(xml, /id="a&gt;b"/);
  });

  it('生の & が属性値に残っていない', async () => {
    const xml = await exported(nasty);
    // 実体参照の始まりでない & が無いこと。
    assert.equal(/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), false);
  });
});

describe('差分が読める', () => {
  it('座標は整数（長い小数を差分に出さない）', async () => {
    const xml = await exported(R0);
    assert.equal(/(?:x|y|width|height)="\d+\.\d+"/.test(xml), false);
  });

  it('同じ入力なら同じ出力（並びが揺れない）', async () => {
    assert.equal(await exported(R0), await exported(R0));
  });
});

describe('書き出しで、符号と副題を落とさない', () => {
  it('**副題（technology）が落ちない**', async () => {
    const out = toDrawio(
      await layout('version: 1\nnodes:\n  - id: a\n    label: DB\n    technology: PostgreSQL 16\n'),
    );
    assert.ok(out.includes('PostgreSQL 16'), '副題が黙って落ちた');
  });

  it('**符号（tag）が落ちない**', async () => {
    const out = toDrawio(await layout('version: 1\nnodes:\n  - id: c1\n    label: 柱\n    tag: C1\n'));
    assert.ok(out.includes('C1'), '符号が黙って落ちた');
  });

  it('符号・名前・副題は行を分ける（1 つの名前に潰さない）', async () => {
    const out = toDrawio(
      await layout('version: 1\nnodes:\n  - id: c1\n    label: 柱\n    tag: C1\n    technology: 700×700\n'),
    );
    assert.ok(out.includes('C1&lt;br&gt;柱&lt;br&gt;700×700'), out.match(/value="[^"]*"/)?.[0]);
  });

  it('符号も副題も無ければ、名前だけのまま', async () => {
    const out = toDrawio(await layout('version: 1\nnodes:\n  - id: a\n    label: あ\n'));
    assert.ok(out.includes('value="あ"'), '余分な区切りが入った');
  });
});

/**
 * **線種が、書き出しで黙って落ちていた**（2026-09-19。`line: chain` を足して気づいた）。
 *
 * draw.io へ出すと、`dashed` も `dotted` も `double` も `chain` も**ぜんぶ実線**になる。
 * これは「落ちる」だけでは済まない ——
 * **相続関係説明図は婚姻が二重線、親子が単線**と決まっていて、
 * 二重線が単線になった図は、**情報が失われたのではなく、別のことを言っている。**
 *
 * しかも `<!-- 落ちるもの -->` の一覧にも書いていなかった。
 * **黙って落とすのは、この道具がいちばん嫌う壊れ方。**
 */
describe('線種を書き出す', () => {
  const LINES = `version: 1
kind: placement
arrows: true
nodes:
  - id: a
    label: "あ"
    at: { x: 0, y: 0 }
    size: { w: 80, h: 40 }
  - id: b
    label: "い"
    at: { x: 200, y: 0 }
    size: { w: 80, h: 40 }
edges:
  - from: a
    to: b
    line: LINE
`;
  const of = async (word: string): Promise<string> => toDrawio(await layout(LINES.replace('LINE', word)));

  it('**破線は破線として出る**', async () => {
    assert.match(await of('dashed'), /dashed=1/);
  });

  it('**点線は、破線と違う刻みで出る**', async () => {
    const dotted = await of('dotted');
    assert.match(dotted, /dashed=1/);
    assert.match(dotted, /dashPattern=/);
    assert.notEqual(/dashPattern=([^;"]*)/.exec(dotted)?.[1], /dashPattern=([^;"]*)/.exec(await of('dashed'))?.[1]);
  });

  it('**一点鎖線も、それと分かる刻みで出る**', async () => {
    const chain = await of('chain');
    assert.match(chain, /dashPattern=/);
    assert.notEqual(/dashPattern=([^;"]*)/.exec(chain)?.[1], /dashPattern=([^;"]*)/.exec(await of('dotted'))?.[1]);
  });

  it('実線には刻みを付けない', async () => {
    assert.ok(!/dashed=1[^"]*edge="1"/.test(await of('solid')));
  });

  /**
   * **二重線だけは出せない。** draw.io の辺に二重線の型が無い。
   * 出せないなら、**出せないと書く**（黙って単線にしない）。
   */
  it('**二重線は、落ちると一覧に書いてある**', async () => {
    const out = await of('double');
    assert.match(out, /二重線|double/);
  });
});
