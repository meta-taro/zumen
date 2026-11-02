/**
 * **2 点を指して引く寸法**（`dims`。仕様 §3.0.27）。
 *
 * 寸法は通り芯の間からしか出なかった。通り芯の無い図 —— 機械・競技場・断面 —— は、
 * 寸法線を `paths` で引き、数値を注記の箱に**手で書いていた**。
 * 図形を直しても数値は追ってこない（見本 386 の全長は、線が 558 px ＝ 13.95 m なのに「14m」）。
 *
 * ここで確かめること。
 *
 * - **測る点は正本が言う**（点か、箱のどの辺か）。曖昧な所から測らない
 * - 数値は**縮尺から機械が出す**。書式は通り芯の寸法と同じ（mm・m・フィート）。`scale.unit` で図ぜんたいの単位を選べる
 * - **描き方は辺と同じ道**（寸法線・寸法補助線・数値。3 本目の描き方を作らない）
 * - 人の数値が機械の数値と 1 % 以上違えば知らせる（`dim-text-differs`）。略図は `exact: false`
 * - **人の `pins.<id>.offset` が勝つ**
 * - 構成図では描かない（`dims-ignored`）
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toDrawio } from '../src/drawio.ts';
import { placeEdgeLabels } from '../src/edge-labels.ts';
import { layout } from '../src/layout.ts';
import { measure } from '../src/measure.ts';
import { toMermaid } from '../src/mermaid.ts';
import { render } from '../src/render.ts';
import { inspect } from '../src/tools.ts';
import { lengthText } from '../src/units.ts';
import { validate } from '../src/validate.ts';

/** 長さ 14m・幅 1.5m のピスト（1 px ＝ 25 mm で 560 × 60）。 */
const BASE = `version: 1
kind: placement
arrows: true
scale: { mm: 25 }
nodes:
  - id: piste
    label: ""
    at: { x: 200, y: 280 }
    size: { w: 560, h: 60 }
`;

function codes(text: string): string[] {
  return validate(text).map((finding) => finding.code);
}

function messagesOf(text: string, code: string): string[] {
  return validate(text)
    .filter((finding) => finding.code === code)
    .map((finding) => finding.message);
}

async function linesOf(text: string, id: string) {
  const placed = await layout(text);
  const own = placed.edges.filter((edge) => edge.id === id || edge.id.startsWith(`${id}/`));
  return { placed, line: own.find((edge) => edge.id === id), extensions: own.filter((edge) => edge.id !== id) };
}

describe('dims —— 単位（`scale.unit`）', () => {
  it('**`m` を選べば、ミリの縮尺でも m で書く**（cm まで。整数なら小数点を書かない）', () => {
    assert.equal(lengthText(560, 25, false, 'm'), '14 m');
    assert.equal(lengthText(60, 25, false, 'm'), '1.5 m');
    assert.equal(lengthText(558, 25, false, 'm'), '13.95 m');
  });

  it('**`mm` を選べば、粗い縮尺でもミリで書く**', () => {
    assert.equal(lengthText(100, 200, false, 'mm'), '20,000');
  });

  it('**`um` は μm で書く**（はめあいの公差域）', () => {
    assert.equal(lengthText(67.2, 0.0003125, false, 'um'), '21 μm');
    assert.equal(lengthText(41.6, 0.0003125, false, 'um'), '13 μm');
  });

  it('**選ばなければ、これまでどおり縮尺が決める**', () => {
    assert.equal(lengthText(560, 25), '14,000');
    assert.equal(lengthText(25, 100), '2.5 m');
  });

  it('**通り芯の寸法も同じ単位で書く**（1 枚に mm と m を混ぜない）', async () => {
    const text = `version: 1
kind: placement
scale: { mm: 25, unit: m }
grid:
  x:
    - { id: X1, at: 0 }
    - { id: X2, at: 560 }
nodes:
  - id: room
    label: 部屋
    at: { x: 0, y: 0 }
    size: { w: 560, h: 200 }
`;
    const svg = render(await layout(text), 'light', 'safe', true);
    assert.ok(svg.includes('>14 m</text>'), '通り芯の寸法が m で出ていない');
    assert.ok(!svg.includes('>14,000</text>'));
    assert.deepEqual(codes(text), []);
  });

  it('**物差しも同じ単位で書く**', async () => {
    const svg = render(await layout(`${BASE.replace('{ mm: 25 }', '{ mm: 0.0003125, unit: um }')}`), 'light', 'safe', true);
    const bar = svg.slice(svg.indexOf('data-name="scalebar"'));
    assert.ok(bar.includes('>μm</text>'), '物差しの単位が μm でない');
  });

  it('知らない単位・インチの縮尺に付けた単位は使わず、知らせる', () => {
    assert.ok(codes(BASE.replace('{ mm: 25 }', '{ mm: 25, unit: cm }')).includes('scale-unit-invalid'));
    assert.ok(codes(BASE.replace('{ mm: 25 }', '{ in: 1, unit: m }')).includes('scale-unit-invalid'));
    assert.equal(lengthText(560, 25, false, null), '14,000');
  });
});

describe('dims —— 箱の辺で指す', () => {
  const text = `${BASE}dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 40
`;

  it('**辺の位置から測る。** 寸法線は、測る物の外側から `offset` だけ離す（正は進む向きの右）', async () => {
    const { line } = await linesOf(text, 'length');
    assert.ok(line !== undefined);
    // 左の辺（x 200）から右の辺（x 760）まで。下の辺（y 340）から 40 px 下。
    assert.deepEqual(line.points, [
      { x: 200, y: 380 },
      { x: 760, y: 380 },
    ]);
    assert.equal(line.label, '14,000');
  });

  it('**寸法補助線を自動で引く**（測る点の少し外から、寸法線の少し先まで）', async () => {
    const { extensions } = await linesOf(text, 'length');
    assert.deepEqual(
      extensions.map((edge) => edge.points),
      [
        [
          { x: 200, y: 342 },
          { x: 200, y: 383 },
        ],
        [
          { x: 760, y: 342 },
          { x: 760, y: 383 },
        ],
      ],
    );
    for (const edge of extensions) {
      assert.equal(edge.label, null);
      assert.equal(edge.weight, 'thin');
      assert.deepEqual(edge.ends, { from: 'none', to: 'none' });
    }
  });

  it('**負の `offset` は反対側**（上の辺より上へ）', async () => {
    const { line } = await linesOf(text.replace('offset: 40', 'offset: -30'), 'length');
    assert.deepEqual(line?.points, [
      { x: 200, y: 250 },
      { x: 760, y: 250 },
    ]);
  });

  it('**上下の辺は y を測る**（向きは辺が決める）。補助線は寸法線の側の角から出る', async () => {
    const { line, extensions } = await linesOf(
      `${BASE}dims:
  - id: width
    from: { node: piste, side: top }
    to: { node: piste, side: bottom }
    offset: -30
`,
      'width',
    );
    // 下へ進む線の右は −x。負なので +x —— 右の辺（x 760）から 30 px 右。
    assert.deepEqual(line?.points, [
      { x: 790, y: 280 },
      { x: 790, y: 340 },
    ]);
    assert.equal(line?.label, '1,500');
    assert.deepEqual(extensions[0]?.points, [
      { x: 762, y: 280 },
      { x: 793, y: 280 },
    ]);
  });

  it('**辺の向きが食い違えば描かない**（左の辺から上の辺へは、何を測るか決められない）', async () => {
    const broken = `${BASE}dims:
  - id: odd
    from: { node: piste, side: left }
    to: { node: piste, side: top }
`;
    const { line } = await linesOf(broken, 'odd');
    assert.equal(line, undefined);
    assert.ok(codes(broken).includes('dim-side-mismatch'));
    assert.ok(codes(broken.replace('side: top', 'side: right').replace('    to:', '    along: y\n    to:')).includes('dim-side-mismatch'));
  });

  it('**人が動かした箱の辺から測る**（`pins.position` / `size` が勝つ）', async () => {
    const { line } = await linesOf(
      `${text}pins:
  piste:
    size: { w: 600, h: 60 }
`,
      'length',
    );
    assert.deepEqual(line?.points.at(-1), { x: 800, y: 380 });
    assert.equal(line?.label, '15,000');
  });
});

describe('dims —— 点で指す', () => {
  it('**斜めも測る**（`from` → `to` に沿う）。補助線は寸法線に直交する', async () => {
    const { line, extensions } = await linesOf(
      `${BASE}dims:
  - id: slant
    from: [ 100, 100 ]
    to: [ 400, 500 ]
    offset: 10
`,
      'slant',
    );
    // 長さ 500 px ＝ 12,500 mm。進む向き (0.6, 0.8) の右は (−0.8, 0.6)。
    assert.equal(line?.label, '12,500');
    assert.deepEqual(line?.points, [
      { x: 92, y: 106 },
      { x: 392, y: 506 },
    ]);
    assert.equal(extensions.length, 2);
  });

  it('**`along: x` は水平の成分だけ。** 寸法線は外側の点からはかる', async () => {
    const { line, extensions } = await linesOf(
      `${BASE}dims:
  - id: run
    from: [ 100, 500 ]
    to: [ 300, 540 ]
    along: x
    offset: 20
`,
      'run',
    );
    assert.equal(line?.label, '5,000');
    assert.deepEqual(line?.points, [
      { x: 100, y: 560 },
      { x: 300, y: 560 },
    ]);
    assert.deepEqual(
      extensions.map((edge) => edge.points[0]),
      [
        { x: 100, y: 502 },
        { x: 300, y: 542 },
      ],
    );
  });

  it('**`offset` を書かなければ 0**（線の上に引き、補助線は引かない）', async () => {
    const { line, extensions } = await linesOf(
      `${BASE}dims:
  - id: flat
    from: [ 100, 500 ]
    to: [ 300, 500 ]
`,
      'flat',
    );
    assert.deepEqual(line?.points, [
      { x: 100, y: 500 },
      { x: 300, y: 500 },
    ]);
    assert.equal(extensions.length, 0);
  });

  it('**読めて、書き戻しても行が変わらない**', () => {
    assert.deepEqual(
      codes(`${BASE}dims:
  - id: flat
    from: [ 100, 500 ]
    to: [ 300, 500 ]
`),
      [],
    );
  });
});

describe('dims —— 文字（`text`）', () => {
  const dim = (extra: string) => `${BASE}dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 40
${extra}`;

  it('**`{}` に機械の数値が入る**', async () => {
    const { line } = await linesOf(dim('    text: "全長 {}"\n'), 'length');
    assert.equal(line?.label, '全長 14,000');
  });

  it('**`{}` が無ければ、人の文字だけ**（数値を人が上書きする）', async () => {
    const { line } = await linesOf(dim('    text: "14m"\n'), 'length');
    assert.equal(line?.label, '14m');
  });

  it('**人の数値が機械と 1 % 以上違えば知らせる**（単位を読む。書かなければ図の単位）', () => {
    assert.deepEqual(messagesOf(dim('    text: "14m"\n'), 'dim-text-differs'), []);
    assert.deepEqual(messagesOf(dim('    text: "1400cm"\n'), 'dim-text-differs'), []);
    assert.deepEqual(messagesOf(dim('    text: "14,000"\n'), 'dim-text-differs'), []);
    assert.equal(messagesOf(dim('    text: "15m"\n'), 'dim-text-differs').length, 1);
    assert.equal(messagesOf(dim('    text: "全長 13,500"\n'), 'dim-text-differs').length, 1);
    assert.ok(messagesOf(dim('    text: "15m"\n'), 'dim-text-differs')[0]!.includes('14,000'));
  });

  it('**数がどれか 1 つ合えば知らせない**（「1.5〜2m」のような幅）。数が無ければ見ない', () => {
    assert.deepEqual(messagesOf(dim('    text: "13〜14m"\n'), 'dim-text-differs'), []);
    assert.deepEqual(messagesOf(dim('    text: "全長"\n'), 'dim-text-differs'), []);
  });

  it('**図の単位が m なら、単位の無い数は m で読む。** フィートの図はフィートとインチを読む', () => {
    const metres = dim('    text: "全長 14"\n').replace('{ mm: 25 }', '{ mm: 25, unit: m }');
    assert.deepEqual(messagesOf(metres, 'dim-text-differs'), []);
    const feet = dim('    text: "{X}"\n').replace('{ mm: 25 }', '{ in: 1 }');
    // 560 px × 1 インチ ＝ 46 フィート 8 インチ
    assert.deepEqual(messagesOf(feet.replace('{X}', `46'-8\\"`), 'dim-text-differs'), []);
    assert.equal(messagesOf(feet.replace('{X}', `40'-0\\"`), 'dim-text-differs').length, 1);
    assert.deepEqual(messagesOf(feet.replace('{X}', '560'), 'dim-text-differs'), [], 'フィートの図で、単位の無い数は読まない');
  });

  it('**`exact: false` は略図。** ずれを知らせない', () => {
    assert.deepEqual(codes(dim('    text: "15m"\n    exact: false\n')), []);
  });

  it('**略図に `{}` を書くと、略図から測った数が出る**ので知らせる', () => {
    assert.ok(codes(dim('    text: "{}"\n    exact: false\n')).includes('dim-sketch-value'));
    assert.ok(codes(dim('    exact: false\n')).includes('dim-sketch-value'));
    assert.ok(codes(dim('    exact: maybe\n')).includes('dim-exact-invalid'));
  });

  it('**`scale` が無ければ数値を出さない。** 文字だけなら描き、知らせる', async () => {
    const bare = dim('    text: "全長 {}"\n').replace('scale: { mm: 25 }\n', '');
    const { line } = await linesOf(bare, 'length');
    assert.equal(line?.label, '全長');
    assert.ok(codes(bare).includes('dim-no-scale'));
    const { line: none } = await linesOf(dim('').replace('scale: { mm: 25 }\n', ''), 'length');
    assert.ok(none !== undefined, '線は引く');
    assert.equal(none.label, null);
  });
});

describe('dims —— 描き方は辺と同じ道', () => {
  const text = `${BASE}dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 40
`;

  it('**寸法線は `paths` で同じ点を書いた線と、同じ `<path>` と矢じりになる**', async () => {
    const asPath = `${BASE}paths:
  - id: length
    points: [ [ 200, 380 ], [ 760, 380 ] ]
    label: "14,000"
    weight: thin
    ends: { from: arrow, to: arrow }
`;
    const group = (svg: string) => {
      const start = svg.indexOf('<g data-edge="length"');
      return svg.slice(start, svg.indexOf('<rect data-edge-label', start));
    };
    const dims = render(await layout(text), 'light', 'safe', true);
    const paths = render(await layout(asPath), 'light', 'safe', true);
    assert.equal(group(dims), group(paths));
  });

  it('**数値は辺のラベルと同じ道で置く**（線の外側、地の色の板を敷いて）', async () => {
    const placed = await layout(text);
    const label = placeEdgeLabels(placed.edges, placed.boxes, placed.groups).find((one) => one.id === 'length');
    assert.ok(label !== undefined);
    assert.equal(label.text, '14,000');
    assert.equal(label.x, 480);
    assert.ok(label.y > 380, '外側（下）に置いていない');
    const svg = render(placed, 'light', 'safe', true);
    assert.ok(svg.includes('>14,000</text>'));
  });

  it('**縦の寸法の数値は、線の横に置く**（線の上に乗せない）', async () => {
    const placed = await layout(`${BASE}dims:
  - id: width
    from: { node: piste, side: top }
    to: { node: piste, side: bottom }
    offset: -30
`);
    const label = placeEdgeLabels(placed.edges, placed.boxes, placed.groups).find((one) => one.id === 'width');
    assert.ok(label !== undefined);
    assert.ok(label.x - label.w / 2 > 790, '寸法線の右に出ていない');
  });

  it('**`ends: tick` は斜線**（建築の寸法と同じ形）', async () => {
    const { line } = await linesOf(text.replace('offset: 40', 'offset: 40\n    ends: tick'), 'length');
    assert.deepEqual(line?.ends, { from: 'tick', to: 'tick' });
    const svg = render(await layout(text.replace('offset: 40', 'offset: 40\n    ends: tick')), 'light', 'safe', true);
    const start = svg.indexOf('<g data-edge="length"');
    const group = svg.slice(start, svg.indexOf('</g>', start));
    assert.ok(group.includes('<line x1="196" y1="384" x2="204" y2="376"'), '左端の斜線が無い');
    assert.ok(codes(text.replace('offset: 40', 'offset: 40\n    ends: bar')).includes('dim-ends-unknown'));
  });

  it('**検査は辺のラベルと同じに見る**（置けない数値は「隠れたラベル」に出る）', async () => {
    const crowded = `${BASE}  - id: wall
    label: ""
    at: { x: 150, y: 350 }
    size: { w: 660, h: 120 }
dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 60
`;
    const seen = await inspect(crowded);
    assert.ok(seen.hiddenLabels.includes('length'));
  });

  it('**節として数えない。** 寸法は別に数える', async () => {
    const seen = await inspect(text);
    assert.equal(seen.nodes, 1);
    assert.equal(seen.edges, 0);
    assert.equal(seen.paths, 0);
    assert.equal(seen.dims, 1);
  });
});

describe('dims —— 人の手直し（`pins.<id>.offset`）が勝つ', () => {
  const text = `${BASE}dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 40
pins:
  length:
    offset: 90
`;

  it('**両方あれば人が勝つ**', async () => {
    const { line } = await linesOf(text, 'length');
    assert.deepEqual(line?.points[0], { x: 200, y: 430 });
    assert.equal(line?.pinned, true);
  });

  it('**鍵は寸法の id。迷子にならない**', () => {
    assert.deepEqual(codes(text), []);
  });

  it('**読めない人の値は使わず、知らせる**', async () => {
    const broken = text.replace('offset: 90', 'offset: far');
    const { line } = await linesOf(broken, 'length');
    assert.deepEqual(line?.points[0], { x: 200, y: 380 });
    assert.ok(codes(broken).includes('pin-offset-invalid'));
  });

  it('**手直しとして数える**（寸法 1 本で 1 要素）', () => {
    const nine = measure(text);
    assert.equal(nine.elements, 2);
    assert.equal(nine.placed, 1);
  });
});

describe('dims —— `views` の中は、その図の縮尺で測る', () => {
  it('**図の中の寸法は、図の縮尺と単位を使う**', async () => {
    const text = `${BASE.replace('scale: { mm: 25 }', 'scale: { mm: 25, unit: m }')}views:
  - id: plan
    at: { x: 0, y: 0 }
    size: { w: 900, h: 500 }
    scale: { mm: 25, unit: m }
  - id: detail
    at: { x: 0, y: 600 }
    size: { w: 900, h: 300 }
    scale: { mm: 10 }
dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 40
  - id: height
    from: [ 100, 700 ]
    to: [ 100, 750 ]
    text: "高さ 50cm 以下"
`;
    assert.equal((await linesOf(text, 'length')).line?.label, '14 m');
    assert.equal((await linesOf(text, 'height')).line?.label, '高さ 50cm 以下');
    assert.deepEqual(codes(text), []);
    assert.ok(codes(text.replace('高さ 50cm', '高さ 60cm')).includes('dim-text-differs'));
  });
});

describe('dims —— 効かない所では描かず、知らせる', () => {
  it('**構成図では描かない**（`dims-ignored`）', async () => {
    const text = `version: 1
nodes:
  - id: a
dims:
  - id: x
    from: [ 0, 0 ]
    to: [ 100, 0 ]
`;
    assert.equal((await layout(text)).edges.length, 0);
    assert.ok(codes(text).includes('dims-ignored'));
  });
});

describe('dims —— 検査', () => {
  const one = (body: string) => `${BASE}dims:\n${body}`;

  it('一覧でなければ知らせる', () => {
    assert.ok(codes(`${BASE}dims: 3\n`).includes('dims-not-list'));
  });

  it('`id` が無い・重なる・節や線と同じ', () => {
    assert.ok(codes(one('  - from: [ 0, 0 ]\n    to: [ 10, 0 ]\n')).includes('dim-id-missing'));
    assert.ok(
      codes(one('  - id: a\n    from: [ 0, 0 ]\n    to: [ 10, 0 ]\n  - id: a\n    from: [ 0, 0 ]\n    to: [ 20, 0 ]\n')).includes(
        'dim-id-duplicated',
      ),
    );
    assert.ok(codes(one('  - id: piste\n    from: [ 0, 0 ]\n    to: [ 10, 0 ]\n')).includes('dim-id-shared'));
  });

  it('端が読めない（点でも辺でもない・知らない節・知らない辺）', () => {
    assert.ok(codes(one('  - id: a\n    from: [ 0 ]\n    to: [ 10, 0 ]\n')).includes('dim-end-invalid'));
    assert.ok(codes(one('  - id: a\n    to: [ 10, 0 ]\n')).includes('dim-end-invalid'));
    assert.ok(codes(one('  - id: a\n    from: { node: piste, side: middle }\n    to: [ 10, 0 ]\n')).includes('dim-end-invalid'));
    assert.ok(codes(one('  - id: a\n    from: { node: nowhere, side: left }\n    to: [ 10, 0 ]\n')).includes('dim-node-unknown'));
  });

  it('`along`・`offset`・長さ 0', () => {
    assert.ok(codes(one('  - id: a\n    from: [ 0, 0 ]\n    to: [ 10, 0 ]\n    along: z\n')).includes('dim-along-invalid'));
    assert.ok(codes(one('  - id: a\n    from: [ 0, 0 ]\n    to: [ 10, 0 ]\n    offset: far\n')).includes('dim-offset-invalid'));
    assert.ok(codes(one('  - id: a\n    from: [ 0, 0 ]\n    to: [ 0, 30 ]\n    along: x\n')).includes('dim-zero-length'));
  });

  it('**寸法に効かない語**を書いていないか（`label` は `text` に）', () => {
    const found = messagesOf(one('  - id: a\n    from: [ 0, 0 ]\n    to: [ 10, 0 ]\n    label: x\n'), 'dim-key-ignored');
    assert.equal(found.length, 1);
    assert.ok(found[0]!.includes('text'));
  });
});

describe('dims —— 書き出し', () => {
  const text = `${BASE}dims:
  - id: length
    from: { node: piste, side: left }
    to: { node: piste, side: right }
    offset: 40
`;

  it('**draw.io へは、端を点に留めた線として出す**（数値は寸法線の文字）', async () => {
    const xml = toDrawio(await layout(text));
    const cell = xml.slice(xml.indexOf('id="length"'), xml.indexOf('</mxCell>', xml.indexOf('id="length"')));
    assert.ok(cell.includes('value="14,000"'));
    assert.ok(cell.includes('as="sourcePoint"'));
    assert.ok(xml.includes('id="length/from"'));
  });

  it('**Mermaid には描く場所が無い。** 落としたことを先頭に書く', () => {
    const out = toMermaid(text);
    assert.ok(out.includes('dims'));
  });
});
