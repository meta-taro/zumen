/**
 * 自動レイアウトと人の pin の共存（原案 §26 の 2）。
 *
 * 正本に pin が残っていても、描くときに無視されるなら保持したことにならない。
 * ここでは「pin の座標がそのまま出るか」と「自動配置と重なっていないか」を見る。
 * **重なりは合否ではなく観測値**として数える（判定基準 §0 — 綺麗さで判定しない）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parse, serialize, setPin } from '../src/format.ts';
import { groupEscapes, layout, overlaps } from '../src/layout.ts';

const R0 = readFileSync(new URL('../fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

function withPin(id: string, x: number, y: number): string {
  const doc = parse(R0);
  setPin(doc, id, { position: { x, y } });
  return serialize(doc);
}

describe('layout', () => {
  it('すべてのノードに位置が付く', async () => {
    const placed = await layout(R0);
    assert.equal(placed.boxes.length, 8);
    for (const box of placed.boxes) {
      assert.equal(Number.isFinite(box.x), true, `${box.id} に x が無い`);
      assert.equal(Number.isFinite(box.y), true, `${box.id} に y が無い`);
    }
  });

  it('pin を持つノードは pin の座標そのものに置かれる', async () => {
    const placed = await layout(withPin('db', 620, 410));
    const db = placed.boxes.find((b) => b.id === 'db');
    assert.deepEqual({ x: db?.x, y: db?.y }, { x: 620, y: 410 });
  });

  it('pin が丸められない（1 の位まで一致する）', async () => {
    const placed = await layout(withPin('db', 623, 417));
    const db = placed.boxes.find((b) => b.id === 'db');
    assert.deepEqual({ x: db?.x, y: db?.y }, { x: 623, y: 417 });
  });

  it('グループの矩形は子をすべて含む', async () => {
    const placed = await layout(R0);
    const vpc = placed.groups.find((g) => g.id === 'vpc');
    assert.notEqual(vpc, undefined);
    const children = placed.boxes.filter((b) => b.group === 'vpc');
    assert.equal(children.length > 0, true);
    for (const child of children) {
      assert.equal(child.x >= vpc!.x, true, `${child.id} が vpc の左へはみ出した`);
      assert.equal(child.y >= vpc!.y, true, `${child.id} が vpc の上へはみ出した`);
      assert.equal(child.x + child.w <= vpc!.x + vpc!.w, true, `${child.id} が右へはみ出した`);
      assert.equal(child.y + child.h <= vpc!.y + vpc!.h, true, `${child.id} が下へはみ出した`);
    }
  });

  it('人が枠の外へ動かしたら、枠のほうが広がる', async () => {
    // 人の位置を枠の中へ押し戻すのは、手直しを壊したことになる（判定基準 3.1）。
    // 枠は「この範囲が VPC」という意味なので、中身に合わせて動くほうが正しい。
    const placed = await layout(withPin('db', 1400, 900));
    const db = placed.boxes.find((b) => b.id === 'db');
    assert.deepEqual({ x: db?.x, y: db?.y }, { x: 1400, y: 900 });
    assert.deepEqual(groupEscapes(placed), []);
  });

  it('枠の外の無所属ノードのために枠を広げない', async () => {
    // backup は vpc に属していない。これで枠が広がると、所属の意味が消える。
    const placed = await layout(withPin('backup', 1400, 900));
    const vpc = placed.groups.find((g) => g.id === 'vpc')!;
    assert.equal(vpc.x + vpc.w < 1400, true);
  });

  it('自動配置だけなら重ならない', async () => {
    // ここが重なるならレイアウトエンジン側の問題で、pin の話ではない。
    assert.deepEqual(await overlapPairs(R0), []);
  });
});

describe('overlaps', () => {
  it('重なりを組で返す', async () => {
    // 人が別のノードの真上へ動かした状況を作る。
    const placed = await layout(R0);
    const target = placed.boxes.find((b) => b.id === 'lb')!;
    const moved = withPin('backup', target.x, target.y);
    const pairs = await overlapPairs(moved);
    assert.equal(pairs.some(([a, b]) => a === 'backup' || b === 'backup'), true);
  });
});

async function overlapPairs(text: string): Promise<[string, string][]> {
  return overlaps(await layout(text));
}
