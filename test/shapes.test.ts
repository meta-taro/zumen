/**
 * **`type` を形にする**（Issue #9）。
 *
 * ## 報告された壊れ方
 *
 * > 12 個のノードが**全部同じ角丸四角**になります。
 * > `src/render.ts` を見たところ、**`node.type` を一度も参照していませんでした。**
 *
 * > **同じ正本から、Mermaid では円柱や六角形になり、本体の SVG では全部四角になります。**
 *
 * ## なぜ重いか
 *
 * [#6](../../issues/6) で「**色は補助、意味は形と位置で持たせる**」と決めた。
 * **その形が 1 種類しか無かった。** 白黒にして残るのは位置と `muted` の破線だけで、
 * データベースもキューもロードバランサも見分けが付かなかった。
 *
 * **形は色と違って、白黒でも色覚特性でも縮小でも失われない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { toSvg } from '../src/embed.ts';
import { toMermaid } from '../src/mermaid.ts';
import { growFor, shapeOf } from '../src/shapes.ts';

/** 形を持つ 6 種と、その形。 */
const SHAPED: [string, string][] = [
  ['database', 'cylinder'],
  ['storage', 'stacked'],
  ['internet', 'cloud'],
  ['cache', 'hexagon'],
  ['queue', 'queue'],
  ['container', 'double'],
];

/** 形を持たない（矩形のままでよい）もの。 */
const PLAIN = ['server', 'cluster', 'network', 'load-balancer', 'generic'];

function diagram(types: string[]): string {
  const nodes = types.map((type, i) => `  - id: n${i}\n    type: ${type}\n    label: ${type}`);
  return `version: 1\nnodes:\n${nodes.join('\n')}\n`;
}

describe('`type` から形を引く', () => {
  for (const [type, kind] of SHAPED) {
    it(`${type} → ${kind}`, () => {
      assert.equal(shapeOf(type), kind);
    });
  }

  it('形を持たないものは矩形', () => {
    for (const type of PLAIN) assert.equal(shapeOf(type), 'rect');
  });

  it('**知らない語も矩形**（捨てずに描く。仕様 §9）', () => {
    assert.equal(shapeOf('quantum-thing'), 'rect');
    assert.equal(shapeOf(null), 'rect');
  });
});

describe('**四角以外が絵に出る**（報告された実測そのもの）', () => {
  it('矩形だけ、ということが無くなった', async () => {
    const svg = await toSvg(diagram(SHAPED.map(([type]) => type)));
    for (const tag of ['<ellipse', '<polygon', '<path', '<line']) {
      assert.ok(svg.includes(tag), `${tag} が 1 つも無い`);
    }
  });

  it('6 種がそれぞれ違う形として描かれる', async () => {
    const svg = await toSvg(diagram(SHAPED.map(([type]) => type)));
    const kinds = [...svg.matchAll(/data-shape="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      [...new Set(kinds)].sort(),
      SHAPED.map(([, kind]) => kind).sort(),
    );
  });

  it('形を持たないものは、これまでどおり矩形', async () => {
    const svg = await toSvg(diagram(PLAIN));
    assert.deepEqual([...new Set([...svg.matchAll(/data-shape="([^"]+)"/g)].map((m) => m[1]))], [
      'rect',
    ]);
  });
});

describe('**形の分だけ箱を広げる**（ラベルがはみ出さない）', () => {
  it('円柱は上下に余分が要る', () => {
    assert.ok(growFor('cylinder').h > 0);
    assert.equal(growFor('cylinder').w, 0);
  });

  it('六角形は左右に余分が要る', () => {
    assert.ok(growFor('hexagon').w > 0);
  });

  it('矩形は広げない', () => {
    assert.deepEqual(growFor('rect'), { w: 0, h: 0 });
  });

  it('**同じラベルなら、形が付いたほうが大きい**', async () => {
    const plain = (await layout(diagram(['server']))).boxes[0]!;
    for (const [type] of SHAPED) {
      const shaped = (await layout(diagram([type]))).boxes[0]!;
      assert.ok(
        shaped.w >= plain.w && shaped.h >= plain.h,
        `${type} が ${shaped.w}x${shaped.h}、矩形が ${plain.w}x${plain.h}`,
      );
    }
  });

  it('人が決めた大きさは、形に関わらずそのまま', async () => {
    const source = diagram(['database']).replace(
      'nodes:',
      'pins:\n  n0:\n    size: { w: 300, h: 120 }\n\nnodes:',
    );
    const box = (await layout(source)).boxes[0]!;
    assert.equal(box.w, 300);
    assert.equal(box.h, 120);
  });
});

describe('**書き出し先で図の読み方が変わらない**', () => {
  // 報告された食い違い。Mermaid だけが形を出していた。
  it('SVG で形が付く 6 種は、Mermaid でも四角ではない', () => {
    const mermaid = toMermaid(diagram(SHAPED.map(([type]) => type)));
    const plain = [...mermaid.matchAll(/^\s+(n\d+)\["/gm)].map((m) => m[1]);
    assert.deepEqual(plain, [], `${plain.join(' ')} が Mermaid で四角のまま`);
  });

  it('SVG で矩形のものは、Mermaid でも四角', () => {
    const mermaid = toMermaid(diagram(PLAIN));
    for (const [i] of PLAIN.entries()) {
      assert.match(mermaid, new RegExp(`n${i}\\["`), `n${i} が Mermaid で四角でない`);
    }
  });

  it('**書ける語でないものに、分岐を持たない**（`cloud` の取り残し）', async () => {
    const { spec } = await import('../src/tools.ts');
    const known = new Set(spec().nodeTypes);
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../src/mermaid.ts', import.meta.url), 'utf8'),
    );
    for (const [, word] of source.matchAll(/case '([a-z-]+)':/g)) {
      assert.ok(known.has(word!), `${word} は type の一覧に無いのに分岐がある`);
    }
  });
});
