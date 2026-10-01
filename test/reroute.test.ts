/**
 * **人が動かした要素へ、辺が繋がること**（Issue #8）。
 *
 * ## 報告された壊れ方
 *
 * > 矢印が空白へ向かって伸び、そこで切れます。`MariaDB` の箱には
 * > **線が 1 本も繋がっていません。**
 *
 * ```
 * db の箱   x 620..780  y 410..470     ← pins のとおり
 * web01>db  M 336 409 L 336 473        ← 箱から 300px 以上離れて切れる
 * ```
 *
 * **同梱の例で出る。** GUI を開いた人が最初に見る図。
 *
 * ## なぜ起きたか
 *
 * `layout()` は「ELK に組ませる → pins で箱だけ上書き → 重なりを解く」の順。
 * **箱しか動かしていない。** 辺は ELK が pins 前の位置で計算した通り道のまま残る。
 *
 * ## S1 で測っていなかったところ
 *
 * S1 が測ったのは「**手直しが消えないこと**」。
 * 「**手直しした結果の絵が読めること**」は測っていなかった。
 * この製品の芯は「2 枚目以降」なので、**1 か所直した瞬間に絵が壊れる**のは重い。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import type { Box, Placed, PlacedEdge } from '../src/layout.ts';

const ROOT = new URL('../', import.meta.url).pathname;

/** 点が箱の縁に載っているか（`clip` の丸め分だけ許す）。 */
function touches(point: { x: number; y: number }, box: Box, slack = 2): boolean {
  return (
    point.x >= box.x - slack &&
    point.x <= box.x + box.w + slack &&
    point.y >= box.y - slack &&
    point.y <= box.y + box.h + slack
  );
}

/** 繋がっていない辺を数える。**両端とも、それぞれの箱に触れていること。** */
function disconnected(placed: Placed): string[] {
  const byId = new Map(placed.boxes.map((box) => [box.id, box]));
  const out: string[] = [];
  for (const edge of placed.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined || edge.points.length < 2) continue;
    const head = edge.points[0]!;
    const tail = edge.points[edge.points.length - 1]!;
    if (!touches(head, from) || !touches(tail, to)) {
      out.push(`${edge.id} 始 (${Math.round(head.x)},${Math.round(head.y)}) 終 (${Math.round(tail.x)},${Math.round(tail.y)})`);
    }
  }
  return out;
}

describe('**同梱の例**（最初に見る図）', () => {
  it('辺がすべて箱に繋がっている', async () => {
    const source = readFileSync(join(ROOT, 'examples/本番構成.zumen.yaml'), 'utf8');
    const placed = await layout(source);
    assert.deepEqual(disconnected(placed), []);
  });

  it('人が動かした `db` に、辺が 3 本とも届いている', async () => {
    const source = readFileSync(join(ROOT, 'examples/本番構成.zumen.yaml'), 'utf8');
    const placed = await layout(source);
    const db = placed.boxes.find((box) => box.id === 'db')!;
    const touching = placed.edges.filter(
      (edge) =>
        (edge.from === 'db' && touches(edge.points[0]!, db)) ||
        (edge.to === 'db' && touches(edge.points[edge.points.length - 1]!, db)),
    );
    assert.equal(touching.length, 3, `${touching.length} 本しか繋がっていない`);
  });
});

describe('人が置いた位置へ、辺が付いてくる', () => {
  const SOURCE = [
    'version: 1',
    'nodes:',
    '  - id: a',
    '  - id: b',
    '  - id: c',
    'edges:',
    '  - from: a',
    '    to: b',
    '  - from: b',
    '    to: c',
    '',
  ].join('\n');

  const moved = (x: number, y: number) =>
    SOURCE.replace('nodes:', `pins:\n  b:\n    position: { x: ${x}, y: ${y} }\n\nnodes:`);

  it('動かす前は繋がっている', async () => {
    assert.deepEqual(disconnected(await layout(SOURCE)), []);
  });

  it('**遠くへ動かしても繋がっている**', async () => {
    assert.deepEqual(disconnected(await layout(moved(900, 700))), []);
  });

  it('近くへ動かしても繋がっている', async () => {
    assert.deepEqual(disconnected(await layout(moved(40, 260))), []);
  });

  it('動かした要素の位置は 1 px も変わらない（手直しを壊さない）', async () => {
    const placed = await layout(moved(900, 700));
    const b = placed.boxes.find((box) => box.id === 'b')!;
    assert.equal(b.x, 900);
    assert.equal(b.y, 700);
    assert.equal(b.pinned, true);
  });
});

describe('**動いていない辺は、引き直さない**', () => {
  it('関係のない辺の通り道は、pins の有無で変わらない', async () => {
    const base = [
      'version: 1',
      'nodes:',
      '  - id: a',
      '  - id: b',
      '  - id: x',
      '  - id: y',
      'edges:',
      '  - from: a',
      '    to: b',
      '  - from: x',
      '    to: y',
      '',
    ].join('\n');
    const pinned = base.replace('nodes:', 'pins:\n  b:\n    position: { x: 900, y: 700 }\n\nnodes:');

    const before = await layout(base);
    const after = await layout(pinned);
    const route = (placed: Placed, id: string): PlacedEdge['points'] =>
      placed.edges.find((edge) => edge.id === id)!.points;

    // `x>y` は動かした要素に触れていない。**ELK の経路のまま。**
    assert.deepEqual(route(after, 'x>y'), route(before, 'x>y'));
  });
});

describe('人が曲げた線は、引き直さない（仕様 §3.4）', () => {
  it('`waypoints` はそのまま通る', async () => {
    const source = [
      'version: 1',
      'pins:',
      '  a>b:',
      '    waypoints:',
      '      - { x: 300, y: 300 }',
      '  b:',
      '    position: { x: 700, y: 600 }',
      'nodes:',
      '  - id: a',
      '  - id: b',
      'edges:',
      '  - from: a',
      '    to: b',
      '',
    ].join('\n');
    const placed = await layout(source);
    const edge = placed.edges.find((e) => e.id === 'a>b')!;
    assert.equal(edge.pinned, true);
    assert.ok(
      edge.points.some((p) => p.x === 300 && p.y === 300),
      '人が曲げた点が消えている',
    );
    // 端は箱に届いていること（曲げても浮かせない）。
    assert.deepEqual(disconnected(placed), []);
  });
});

describe('**重なりを解いて退いた箱にも、辺が付いてくる**', () => {
  // `separate()` は機械が置いた箱を退かす。**同じ穴を持っていた。**
  it('人の箱と重なった機械の箱が退いても、繋がっている', async () => {
    const source = [
      'version: 1',
      'pins:',
      '  moved:',
      '    position: { x: 24, y: 24 }',
      'nodes:',
      '  - id: moved',
      '  - id: other',
      '  - id: third',
      'edges:',
      '  - from: moved',
      '    to: other',
      '  - from: other',
      '    to: third',
      '',
    ].join('\n');
    const placed = await layout(source);
    assert.deepEqual(disconnected(placed), []);
  });
});
