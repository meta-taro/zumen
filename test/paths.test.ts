/**
 * **節に属さない線と形**（`paths`。仕様 §3.0.26）。
 *
 * 線は辺でしか描けず、辺は節から節へしか引けなかった。
 * だから見本は、**線を引くためだけに見えない点（名前も枠も無い 2×2 の節）を置いていた**
 * —— 8,044 個・218 枚（`.claude/primitives-audit.md` §3-A）。
 *
 * ここで確かめること。
 *
 * - **描き方は辺と同じ道を通る**（描き分けを 2 本にしない）。同じ点を通る辺と、同じ `<path>` が出る
 * - 端は**点のまま**（箱の縁で切らない）
 * - 弧（`arc`）は点に刻む。扇形は中心へ戻る
 * - **人の `pins.<id>.points` が勝つ**
 * - 構成図・作図では描かず、知らせる（`paths-ignored`）
 * - 節として数えない（重なり・書き出し）
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toDrawio } from '../src/drawio.ts';
import { layout, overlaps } from '../src/layout.ts';
import { measure } from '../src/measure.ts';
import { toMermaid } from '../src/mermaid.ts';
import { render } from '../src/render.ts';
import { inspect } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const BASE = `version: 1
kind: placement
arrows: false
nodes:
  - id: room
    label: 部屋
    at: { x: 0, y: 0 }
    size: { w: 400, h: 300 }
`;

function codes(text: string): string[] {
  return validate(text).map((finding) => finding.code);
}

/** 線 1 本ぶんの `<g>` を取り出す。 */
function lineGroup(svg: string, id: string): string {
  const start = svg.indexOf(`<g data-edge="${id.replace('>', '&gt;')}"`);
  assert.ok(start >= 0, `線 ${id} が描かれていない`);
  return svg.slice(start, svg.indexOf('</g>', start));
}

function strokesIn(group: string): string[] {
  return [...group.matchAll(/<path [^>]*\/>/g)].map((m) => m[0]);
}

describe('paths —— 書いた点を、そのまま通る', () => {
  const text = `${BASE}paths:
  - id: tape
    points: [ [ 40, 60 ], [ 200, 60 ], [ 200, 120 ] ]
    weight: thick
    ends: { from: none, to: none }
`;

  it('**端を箱の縁で切らない。** 書いた点がそのまま線の点になる', async () => {
    const placed = await layout(text);
    const line = placed.edges.find((edge) => edge.id === 'tape');
    assert.ok(line !== undefined);
    assert.deepEqual(line.points, [
      { x: 40, y: 60 },
      { x: 200, y: 60 },
      { x: 200, y: 120 },
    ]);
    assert.equal(line.pinned, false);
  });

  it('`{ x, y }` でも書ける（`via` と同じ書き方）', async () => {
    const placed = await layout(`${BASE}paths:
  - id: tape
    points:
      - { x: 40, y: 60 }
      - { x: 200, y: 60 }
`);
    assert.deepEqual(placed.edges.find((edge) => edge.id === 'tape')?.points, [
      { x: 40, y: 60 },
      { x: 200, y: 60 },
    ]);
  });

  it('**節として数えない**（箱にも、重なりにも出てこない）', async () => {
    const placed = await layout(text);
    assert.deepEqual(placed.boxes.map((box) => box.id), ['room']);
    assert.deepEqual(overlaps(placed), []);
    const seen = await inspect(text);
    assert.equal(seen.nodes, 1);
    assert.equal(seen.edges, 0);
    assert.equal(seen.paths, 1);
  });

  it('**読めて、書き戻しても行が変わらない**（`[ x, y ]` は括弧の内側に空白を入れて書く）', () => {
    assert.deepEqual(codes(text), []);
  });
});

describe('paths —— 描き方は辺と同じ道', () => {
  /** 見えない 2×2 の節を 2 つ置いて、辺で結ぶ（いままでの書き方）。 */
  const OLD = `version: 1
kind: placement
arrows: true
nodes:
  - id: p4
    label: ""
    marker: none
    at: { x: 321, y: 597 }
    size: { w: 2, h: 2 }
  - id: p5
    label: ""
    marker: none
    at: { x: 427, y: 597 }
    size: { w: 2, h: 2 }
edges:
  - from: p4
    to: p5
    curve: none
    weight: thick
    ends: { from: none, to: arrow }
`;
  /** 辺が実際に引かれた点（箱の縁で切ったあと）を、そのまま書く。 */
  const NEW = `version: 1
kind: placement
arrows: true
nodes:
  - id: note
    label: ""
    marker: none
    at: { x: 600, y: 600 }
    size: { w: 2, h: 2 }
paths:
  - id: anchor-1
    points: [ [ 323, 598 ], [ 427, 598 ] ]
    curve: none
    weight: thick
    ends: { from: none, to: arrow }
`;

  it('**同じ点を通る辺と、まったく同じ線・同じ端の記号が出る**', async () => {
    const old = lineGroup(render(await layout(OLD), 'light', 'safe', true), 'p4>p5');
    const now = lineGroup(render(await layout(NEW), 'light', 'safe', true), 'anchor-1');
    assert.deepEqual(strokesIn(now), strokesIn(old));
    assert.equal(now.replace('data-edge="anchor-1"', ''), old.replace('data-edge="p4&gt;p5"', ''));
  });

  it('**描く層も辺と同じ**（`arrows: false` なら箱の下、`true` なら箱の上）', async () => {
    const text = `${BASE}paths:
  - id: tape
    points: [ [ 40, 60 ], [ 200, 60 ] ]
`;
    const under = render(await layout(text), 'light', 'safe', true);
    assert.ok(under.indexOf('data-edge="tape"') < under.indexOf('data-node="room"'));
    const over = render(await layout(text.replace('arrows: false', 'arrows: true')), 'light', 'safe', true);
    assert.ok(over.indexOf('data-edge="tape"') > over.indexOf('data-node="room"'));
  });

  it('**閉じた形の中を塗る。** 塗りは線より先（辺の `close` ＋ `hatch` と同じ）', async () => {
    const text = `${BASE}paths:
  - id: pond
    points: [ [ 60, 60 ], [ 200, 40 ], [ 240, 160 ], [ 80, 180 ] ]
    curve: smooth
    close: true
    hatch: dots
`;
    const placed = await layout(text);
    const pond = placed.edges.find((edge) => edge.id === 'pond')!;
    assert.equal(pond.close, true);
    assert.deepEqual(pond.points.at(-1), pond.points[0]);
    const svg = render(placed, 'light', 'safe', true);
    // 模様は線の `<g>` の中に、もう 1 段の `<g>` で入る。閉じ括弧で切らずに、線 1 本ぶんを先まで見る。
    const start = svg.indexOf('<g data-edge="pond"');
    const next = svg.indexOf('<g data-', start + 1);
    const group = svg.slice(start, next === -1 ? undefined : next);
    assert.ok(group.includes('clip-path="url(#face-'), '模様が描かれていない');
    assert.ok(group.indexOf('fill="none"') > group.indexOf('clip-path'), '塗りが線より後に描かれている');
    assert.deepEqual(codes(text), []);
  });

  it('色・縁取りは辺と同じ鍵で引く', async () => {
    const text = `version: 1
kind: placement
palette:
  R: "#d0021b"
nodes:
  - id: legend
    label: R
    marker: none
    at: { x: 0, y: 0 }
    size: { w: 40, h: 20 }
paths:
  - id: route
    points: [ [ 40, 60 ], [ 200, 60 ] ]
    color: R
    casing: paper
`;
    const placed = await layout(text);
    const route = placed.edges.find((edge) => edge.id === 'route')!;
    assert.equal(route.color, '#d0021b');
    assert.equal(route.casing, 'paper');
    assert.deepEqual(codes(text), []);
  });
});

describe('paths —— 弧（`arc`）', () => {
  const arcText = (close = '') => `${BASE}paths:
  - id: fov
    arc: { center: [ 100, 100 ], r: 50, from: 0, to: 90 }
${close}`;

  it('**0 度が右、時計回り。** 始まりは右、終わりは真下', async () => {
    const placed = await layout(arcText());
    const fov = placed.edges.find((edge) => edge.id === 'fov')!;
    assert.deepEqual(fov.points[0], { x: 150, y: 100 });
    assert.deepEqual(fov.points.at(-1), { x: 100, y: 150 });
  });

  it('**刻みは円から 0.25px より離れない**（点は円の上、弦の中点も円の近く）', async () => {
    const fov = (await layout(arcText())).edges.find((edge) => edge.id === 'fov')!;
    assert.ok(fov.points.length >= 8);
    for (const point of fov.points) {
      assert.ok(Math.abs(Math.hypot(point.x - 100, point.y - 100) - 50) < 0.02);
    }
    for (let i = 1; i < fov.points.length; i += 1) {
      const a = fov.points[i - 1]!;
      const b = fov.points[i]!;
      const mid = Math.hypot((a.x + b.x) / 2 - 100, (a.y + b.y) / 2 - 100);
      assert.ok(50 - mid <= 0.25, `弦が円から ${50 - mid}px 離れている`);
    }
  });

  it('`to` が `from` より小さければ、反時計回りに描く', async () => {
    const placed = await layout(`${BASE}paths:
  - id: back
    arc: { center: [ 100, 100 ], r: 50, from: 90, to: 0 }
`);
    const back = placed.edges.find((edge) => edge.id === 'back')!;
    assert.deepEqual(back.points[0], { x: 100, y: 150 });
    assert.deepEqual(back.points.at(-1), { x: 150, y: 100 });
  });

  it('`close: sector` は**扇形**（中心から出て、弧を通り、中心へ戻る）', async () => {
    const fov = (await layout(arcText('    close: sector\n'))).edges.find((edge) => edge.id === 'fov')!;
    assert.equal(fov.close, true);
    assert.deepEqual(fov.points[0], { x: 100, y: 100 });
    assert.deepEqual(fov.points[1], { x: 150, y: 100 });
    assert.deepEqual(fov.points.at(-1), { x: 100, y: 100 });
    assert.deepEqual(codes(arcText('    close: sector\n    hatch: dots\n')), []);
  });

  it('`close: true` は**弦で閉じる**（中心を通らない）', async () => {
    const fov = (await layout(arcText('    close: true\n'))).edges.find((edge) => edge.id === 'fov')!;
    assert.deepEqual(fov.points[0], { x: 150, y: 100 });
    assert.deepEqual(fov.points.at(-1), { x: 150, y: 100 });
    assert.ok(!fov.points.some((p) => p.x === 100 && p.y === 100));
  });
});

describe('paths —— 人の手直し（`pins.<id>.points`）が勝つ', () => {
  const text = `${BASE}paths:
  - id: tape
    points: [ [ 40, 60 ], [ 200, 60 ] ]
pins:
  tape:
    points:
      - { x: 40, y: 80 }
      - { x: 120, y: 90 }
      - { x: 200, y: 80 }
`;

  it('**両方あれば人が勝つ**（`pins.waypoints` と同じ筋）', async () => {
    const tape = (await layout(text)).edges.find((edge) => edge.id === 'tape')!;
    assert.deepEqual(tape.points, [
      { x: 40, y: 80 },
      { x: 120, y: 90 },
      { x: 200, y: 80 },
    ]);
    assert.equal(tape.pinned, true);
  });

  it('**鍵は path の id。迷子にならない**', () => {
    assert.deepEqual(codes(text), []);
  });

  it('弧も人の点で置き換わる', async () => {
    const fov = (
      await layout(`${BASE}paths:
  - id: fov
    arc: { center: [ 100, 100 ], r: 50, from: 0, to: 90 }
pins:
  fov:
    points: [ [ 0, 0 ], [ 10, 10 ] ]
`)
    ).edges.find((edge) => edge.id === 'fov')!;
    assert.deepEqual(fov.points, [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it('**読めない人の点は使わず、知らせる**（正本の点で描く）', async () => {
    const broken = text.replace(/points:\n {6}- \{ x: 40, y: 80 \}\n {6}- \{ x: 120, y: 90 \}\n {6}- \{ x: 200, y: 80 \}\n/, 'points: [ [ 1, 2 ] ]\n');
    const tape = (await layout(broken)).edges.find((edge) => edge.id === 'tape')!;
    assert.deepEqual(tape.points, [
      { x: 40, y: 60 },
      { x: 200, y: 60 },
    ]);
    assert.ok(codes(broken).includes('pin-points-invalid'));
  });

  it('**手直しとして数える**（`points` は幾何の手直し）', () => {
    const nine = measure(text);
    assert.equal(nine.elements, 2);
    assert.equal(nine.placed, 1);
  });
});

describe('paths —— 効かない所では描かず、知らせる', () => {
  it('**構成図では描かない**（`paths-ignored`）', async () => {
    const text = `version: 1
nodes:
  - id: a
paths:
  - id: tape
    points: [ [ 40, 60 ], [ 200, 60 ] ]
`;
    assert.equal((await layout(text)).edges.length, 0);
    assert.ok(codes(text).includes('paths-ignored'));
  });

  it('**作図でも描かない**（座標を書かない図）', () => {
    const text = `version: 1
kind: construction
nodes: []
let:
  R: 100
circles:
  - { id: c0, center: [ 0, 0 ], r: R, draw: true }
paths:
  - id: tape
    points: [ [ 40, 60 ], [ 200, 60 ] ]
`;
    assert.ok(codes(text).includes('paths-ignored'));
  });
});

describe('paths —— 検査', () => {
  const one = (body: string) => `${BASE}paths:\n${body}`;

  it('一覧でなければ知らせる', () => {
    assert.ok(codes(`${BASE}paths: { id: a }\n`).includes('paths-not-list'));
  });

  it('`id` が無い・重なる・節と同じ', () => {
    assert.ok(codes(one('  - points: [ [ 0, 0 ], [ 1, 1 ] ]\n')).includes('path-id-missing'));
    assert.ok(
      codes(one('  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ] ]\n  - id: a\n    points: [ [ 0, 0 ], [ 2, 2 ] ]\n')).includes(
        'path-id-duplicated',
      ),
    );
    assert.ok(codes(one('  - id: room\n    points: [ [ 0, 0 ], [ 1, 1 ] ]\n')).includes('path-id-shared-with-node'));
  });

  it('`points` と `arc` は、どちらか 1 つ', () => {
    assert.ok(codes(one('  - id: a\n')).includes('path-shape-missing'));
    assert.ok(
      codes(one('  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ] ]\n    arc: { center: [ 0, 0 ], r: 5, from: 0, to: 90 }\n')).includes(
        'path-shape-both',
      ),
    );
  });

  it('点が 2 つ未満・点として読めない', () => {
    assert.ok(codes(one('  - id: a\n    points: [ [ 0, 0 ] ]\n')).includes('path-points-short'));
    assert.ok(codes(one('  - id: a\n    points: [ [ 0, 0 ], [ x, 1 ] ]\n')).includes('path-points-invalid'));
  });

  it('弧の数が読めない（半径が正でない・角が同じ・1 周を超える）', () => {
    for (const arc of [
      '{ center: [ 0, 0 ], r: 0, from: 0, to: 90 }',
      '{ center: [ 0, 0 ], r: 5, from: 30, to: 30 }',
      '{ center: [ 0, 0 ], r: 5, from: 0, to: 400 }',
      '{ center: 0, r: 5, from: 0, to: 90 }',
      '{ r: 5, from: 0, to: 90 }',
    ]) {
      assert.ok(codes(one(`  - id: a\n    arc: ${arc}\n`)).includes('path-arc-invalid'), arc);
    }
  });

  it('`close` は真偽値か、弧の `sector`', () => {
    assert.ok(codes(one('  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ], [ 2, 0 ] ]\n    close: sector\n')).includes('path-close-invalid'));
    assert.ok(codes(one('  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ], [ 2, 0 ] ]\n    close: "yes"\n')).includes('path-close-invalid'));
  });

  it('**閉じていない線に `hatch` を書いても効かない**（`edge-hatch-ignored` と同じ）', () => {
    assert.ok(codes(one('  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ] ]\n    hatch: dots\n')).includes('path-hatch-ignored'));
  });

  it('**辺だけ・節だけの語は効かない**（`from` / `via` / `at` …）', () => {
    const found = validate(one('  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ] ]\n    from: room\n    via:\n      - { x: 1, y: 2 }\n    at: { x: 0, y: 0 }\n'));
    assert.equal(found.filter((f) => f.code === 'path-key-ignored').length, 3);
  });

  it('辺と同じ語の検査を受ける（線種・太さ・端・丸め方・模様・色）', () => {
    const found = codes(
      one(
        '  - id: a\n    points: [ [ 0, 0 ], [ 1, 1 ], [ 2, 0 ] ]\n    line: wavy\n    weight: huge\n    ends: { to: spear }\n    curve: bezier\n    close: true\n    hatch: stars\n    color: Q\n',
      ),
    );
    for (const code of ['line-unknown', 'weight-unknown', 'ends-unknown', 'curve-unknown', 'hatch-unknown', 'color-unknown']) {
      assert.ok(found.includes(code), code);
    }
  });
});

describe('paths —— 書き出し', () => {
  const text = `${BASE}paths:
  - id: tape
    points: [ [ 40, 60 ], [ 120, 90 ], [ 200, 60 ] ]
    line: dashed
`;

  it('**draw.io へは、端を点に留めた線として出す**（節に繋がない）', async () => {
    const xml = toDrawio(await layout(text));
    const cell = xml.slice(xml.indexOf('id="tape"'), xml.indexOf('</mxCell>', xml.indexOf('id="tape"')));
    assert.ok(!cell.includes('source='), 'source を持っている');
    assert.ok(!cell.includes('target='), 'target を持っている');
    assert.ok(cell.includes('<mxPoint x="40" y="60" as="sourcePoint" />'));
    assert.ok(cell.includes('<mxPoint x="200" y="60" as="targetPoint" />'));
    assert.ok(cell.includes('<mxPoint x="120" y="90" />'));
    assert.ok(cell.includes('dashed=1;'));
  });

  it('**Mermaid には描く場所が無い。** 落としたことを先頭に書く', () => {
    const out = toMermaid(text);
    assert.ok(out.includes('paths'));
    assert.ok(!out.includes('tape -->'));
  });
});
