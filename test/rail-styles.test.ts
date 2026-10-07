/**
 * **鉄道の案内図の線**（`edges[].casing` ／ `hatch_color` ／ `edges[].offset`）。
 *
 * 路線図の線は、ただの色の線ではない。
 *
 * - **縁取り**：路線の縁に別の色の細い縁があり、**重なる所では上の線の縁が下の線を白く切る**
 *   （どちらが上を通っているかが読める）
 * - **模様の色**：同じ色の面に、別の色の縞を入れて見分ける（運賃表の、見分けにくい路線色）
 * - **並走のずらし**：同じ駅の間を 2 路線が並んで走る所は、線を少しずらして平行に描く
 *
 * **書かない図の出力は変えない。** 書いたときだけ効く。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { offsetLine } from '../src/offset.ts';
import { render } from '../src/render.ts';
import { paletteOf } from '../src/tokens.ts';
import { validate } from '../src/validate.ts';

const LINES = `version: 1
kind: placement
arrows: false
palette:
  G: "#f39700"
  M: "#e60012"
  Ink: "#111111"
nodes:
  - id: a
    label: あ
    marker: circle
    at: { x: 0, y: 100 }
    size: { w: 20, h: 20 }
  - id: b
    label: い
    marker: circle
    at: { x: 300, y: 100 }
    size: { w: 20, h: 20 }
  - id: c
    label: う
    marker: circle
    at: { x: 150, y: 0 }
    size: { w: 20, h: 20 }
  - id: d
    label: え
    marker: circle
    at: { x: 150, y: 200 }
    size: { w: 20, h: 20 }
edges:
  - from: a
    to: b
    color: G
    weight: thick
  - from: c
    to: d
    color: M
    weight: thick
`;

/** 辺 1 本ぶんの `<g>` を取り出す。 */
function edgeGroup(svg: string, id: string): string {
  const start = svg.indexOf(`<g data-edge="${id.replace('>', '&gt;')}"`);
  assert.ok(start >= 0, `辺 ${id} が描かれていない`);
  return svg.slice(start, svg.indexOf('</g>', start));
}

function pathsIn(group: string): string[] {
  return [...group.matchAll(/<path [^>]*\/>/g)].map((m) => m[0]);
}

describe('線の縁取り（edges[].casing）', () => {
  it('**書かなければ線は 1 本だけ**（いまの出力のまま）', async () => {
    const svg = render(await layout(LINES), 'light', 'safe', true);
    assert.equal(pathsIn(edgeGroup(svg, 'c>d')).length, 1);
  });

  it('`paper` は地の色の縁。**線より左右 1.5px ずつ太く、同じ道を、線より先に**描く', async () => {
    const text = LINES.replace('    color: M\n', '    color: M\n    casing: paper\n');
    const svg = render(await layout(text), 'light', 'safe', true);
    const [casing, line] = pathsIn(edgeGroup(svg, 'c>d'));
    assert.ok(casing !== undefined && line !== undefined, '縁と線の 2 本が要る');
    const width = (p: string) => Number(/stroke-width="([\d.]+)"/.exec(p)![1]);
    const d = (p: string) => /d="([^"]+)"/.exec(p)![1];
    assert.equal(width(casing), width(line) + 3);
    assert.equal(d(casing), d(line));
    assert.match(casing, new RegExp(`stroke="${paletteOf('light').paper}"`));
    assert.match(line, /stroke="#e60012"/);
  });

  it('**ダークでは、地の色もダークのもの**', async () => {
    const text = LINES.replace('    color: M\n', '    color: M\n    casing: paper\n');
    const svg = render(await layout(text), 'dark', 'safe', true);
    const [casing] = pathsIn(edgeGroup(svg, 'c>d'));
    assert.match(casing!, new RegExp(`stroke="${paletteOf('dark').paper}"`));
  });

  it('palette の鍵なら、その色の縁', async () => {
    const text = LINES.replace('    color: M\n', '    color: M\n    casing: Ink\n');
    const svg = render(await layout(text), 'light', 'safe', true);
    const [casing] = pathsIn(edgeGroup(svg, 'c>d'));
    assert.match(casing!, /stroke="#111111"/);
  });

  it('**後の辺の縁が、先の辺の線の上に乗る**（交わる所で下の線が切れて見える）', async () => {
    const text = LINES.replace('    color: M\n', '    color: M\n    casing: paper\n');
    const svg = render(await layout(text), 'light', 'safe', true);
    const under = svg.indexOf('stroke="#f39700"');
    const cut = svg.indexOf(`stroke="${paletteOf('light').paper}" stroke-width="8"`);
    assert.ok(under >= 0 && cut > under, '縁が下の線より後に描かれていない');
  });

  it('**縁は破線にしない**（破線の線の下でも、縁は続いて見える）', async () => {
    const text = LINES.replace('    color: M\n', '    color: M\n    casing: Ink\n    line: dashed\n');
    const svg = render(await layout(text), 'light', 'safe', true);
    const [casing, line] = pathsIn(edgeGroup(svg, 'c>d'));
    assert.doesNotMatch(casing!, /stroke-dasharray/);
    assert.match(line!, /stroke-dasharray/);
  });

  it('**縁に矢じりは付けない**', async () => {
    const text = LINES.replace('arrows: false\n', '').replace('    color: M\n', '    color: M\n    casing: paper\n');
    const svg = render(await layout(text), 'light', 'safe', true);
    const [casing, line] = pathsIn(edgeGroup(svg, 'c>d'));
    assert.doesNotMatch(casing!, /marker-end/);
    assert.match(line!, /marker-end/);
  });

  it('**縁と模様にだけ使う色には、線の薄さの下限を当てない**（地ではなく、線と面の上に乗る）', () => {
    const found = validate(LINES.replace('    color: M\n', '    color: M\n    casing: Ink\n'));
    assert.ok(!found.some((f) => f.code === 'color-faint' && f.message.includes('"Ink"')), found.map((f) => f.message).join('\n'));
  });

  it('読めない縁の色を知らせる。`paper` と palette の鍵は黙る', () => {
    const bad = validate(LINES.replace('    color: M\n', '    color: M\n    casing: shiro\n'));
    assert.ok(bad.some((f) => f.code === 'casing-unknown'), bad.map((f) => f.code).join(','));
    for (const value of ['paper', 'Ink']) {
      const ok = validate(LINES.replace('    color: M\n', `    color: M\n    casing: ${value}\n`));
      assert.ok(!ok.some((f) => f.code === 'casing-unknown'), value);
    }
  });
});

const SHELL = `version: 1
kind: placement
palette:
  Line: "#8f76d6"
  Pat: "#ffffff"
nodes:
  - id: a
    label: あ
    at: { x: 0, y: 0 }
    size: { w: 120, h: 60 }
    color: Line
    hatch: lines
`;

describe('模様の色（hatch_color）', () => {
  it('**書かなければ、模様は枠と同じ色**（いまの出力のまま）', async () => {
    const svg = render(await layout(SHELL), 'light', 'safe', true);
    assert.ok([...svg.matchAll(/<line [^>]*stroke="([^"]+)"/g)].every((m) => m[1] === '#8f76d6'));
  });

  it('節に書くと、**模様だけ**その色。枠の色は変えない', async () => {
    const svg = render(await layout(`${SHELL}    hatch_color: Pat\n`), 'light', 'safe', true);
    const strokes = [...svg.matchAll(/<line [^>]*stroke="([^"]+)" stroke-width="0.7"/g)].map((m) => m[1]);
    assert.ok(strokes.length > 0, '模様が描かれていない');
    assert.ok(strokes.every((s) => s === '#ffffff'), strokes.join(','));
    assert.match(svg, /stroke="#8f76d6"/, '枠の色が消えた');
  });

  it('閉じた辺の模様にも効く', async () => {
    const text = `version: 1
kind: placement
arrows: false
palette:
  Line: "#8f76d6"
  Pat: "#00a0de"
nodes:
  - id: p
    label: 池
    marker: none
    at: { x: 0, y: 0 }
    size: { w: 10, h: 10 }
edges:
  - from: p
    to: p
    close: true
    color: Line
    hatch: lines
    hatch_color: Pat
    via:
      - { x: 100, y: 0 }
      - { x: 100, y: 100 }
      - { x: 0, y: 100 }
`;
    const svg = render(await layout(text), 'light', 'safe', true);
    const strokes = [...svg.matchAll(/<line [^>]*stroke="([^"]+)" stroke-width="0.7"/g)].map((m) => m[1]);
    assert.ok(strokes.length > 0, '模様が描かれていない');
    assert.ok(strokes.every((s) => s === '#00a0de'), strokes.join(','));
    assert.match(svg, /<path [^>]*fill="none" stroke="#8f76d6"/, '輪郭は線の色のまま');
  });

  it('読めない色と、模様の無い所に書いた色を知らせる', () => {
    const bad = validate(`${SHELL}    hatch_color: nosuch\n`);
    assert.ok(bad.some((f) => f.code === 'hatch-color-unknown'), bad.map((f) => f.code).join(','));
    const idle = validate(`${SHELL.replace('    hatch: lines\n', '')}    hatch_color: Pat\n`);
    assert.ok(idle.some((f) => f.code === 'hatch-color-ignored'), idle.map((f) => f.code).join(','));
    const ok = validate(`${SHELL}    hatch_color: Pat\n`);
    assert.ok(!ok.some((f) => f.code.startsWith('hatch-color')), ok.map((f) => f.code).join(','));
  });
});

describe('並走する線のずらし（offset の計算）', () => {
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;

  it('**正は進む向きの右、負は左**（紙の座標は y が下向き）', () => {
    const east = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    assert.ok(near(offsetLine(east, 4)[0]!, { x: 0, y: 4 }));
    assert.ok(near(offsetLine(east, -4)[1]!, { x: 100, y: -4 }));
  });

  it('**折れ点でも平行を保つ** —— 折れ点は、ずらした線分どうしの交点', () => {
    const bend = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
    const out = offsetLine(bend, 4);
    assert.equal(out.length, 3);
    assert.ok(near(out[0]!, { x: 0, y: 4 }));
    assert.ok(near(out[1]!, { x: 96, y: 4 }), JSON.stringify(out[1]));
    assert.ok(near(out[2]!, { x: 96, y: 100 }));
  });

  it('斜めの折れ（45°）でも、各線分との距離はずらした量のまま', () => {
    const bend = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 100 }];
    const out = offsetLine(bend, 5);
    // 2 本目の線分（向き (1,1)/√2）からの距離
    const p = out[1]!;
    const dist = Math.abs((p.x - 100) * 1 - (p.y - 0) * 1) / Math.SQRT2;
    assert.ok(Math.abs(dist - 5) < 1e-6, String(dist));
    assert.ok(Math.abs(p.y - 5) < 1e-6);
  });

  it('一直線に並んだ点・重なった点でも崩れない', () => {
    const out = offsetLine([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], 3);
    assert.ok(out.every((p) => Math.abs(p.y - 3) < 1e-6), JSON.stringify(out));
  });

  it('0 なら点はそのまま', () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 5 }];
    assert.deepEqual(offsetLine(line, 0), line);
  });
});

describe('並走する線のずらし（edges[].offset）', () => {
  it('**書かなければ通り道は変わらない**、書けばその分だけ横へ', async () => {
    const plain = await layout(LINES);
    const moved = await layout(LINES.replace('    color: G\n', '    color: G\n    offset: 6\n'));
    const before = plain.edges.find((e) => e.id === 'a>b')!.points;
    const after = moved.edges.find((e) => e.id === 'a>b')!.points;
    assert.equal(after.length, before.length);
    // a>b は東へ進むので、右（y が大きい側）へ 6px
    after.forEach((p, i) => {
      assert.equal(p.x, before[i]!.x);
      assert.equal(p.y, before[i]!.y + 6);
    });
    assert.deepEqual(moved.edges.find((e) => e.id === 'c>d')!.points, plain.edges.find((e) => e.id === 'c>d')!.points);
  });

  it('数でない offset を知らせる。数なら黙る', () => {
    const bad = validate(LINES.replace('    color: G\n', '    color: G\n    offset: migi\n'));
    assert.ok(bad.some((f) => f.code === 'offset-not-number'), bad.map((f) => f.code).join(','));
    const ok = validate(LINES.replace('    color: G\n', '    color: G\n    offset: -4.5\n'));
    assert.ok(!ok.some((f) => f.code === 'offset-not-number'));
  });

  it('**3 つとも書いた図で、新しい鍵そのものへの警告は出ない**', () => {
    const text = LINES.replace('    color: G\n', '    color: G\n    casing: paper\n    offset: 4\n');
    const found = validate(text);
    const ours = ['casing-unknown', 'offset-not-number', 'hatch-color-unknown', 'hatch-color-ignored'];
    assert.deepEqual(found.filter((f) => ours.includes(f.code)), []);
  });
});
