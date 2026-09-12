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

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

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
  it('重なりを組で返す（観測できること自体を確かめる）', () => {
    const placed = {
      boxes: [
        { id: 'a', x: 0, y: 0, w: 100, h: 50, group: null, label: 'a', type: '', appearance: null, technology: null, openings: [], tag: null, radius: null, marker: 'box' as const, hatch: 'none' as const, pinned: false },
        { id: 'b', x: 10, y: 10, w: 100, h: 50, group: null, label: 'b', type: '', appearance: null, technology: null, openings: [], tag: null, radius: null, marker: 'box' as const, hatch: 'none' as const, pinned: false },
      ],
      groups: [],
      edges: [],
      width: 0,
      height: 0,
      collisions: [],
      grid: { x: [], y: [] },
      mm: null,
      north: null,
      wall: null,
      arrows: true,
    };
    assert.deepEqual(overlaps(placed), [['a', 'b']]);
  });
});

describe('重なりを解く（Issue 015）', () => {
  /** 人が `to` の真上へ `id` を動かした状況。 */
  async function stackOn(id: string, to: string): Promise<Awaited<ReturnType<typeof layout>>> {
    const first = await layout(R0);
    const target = first.boxes.find((b) => b.id === to)!;
    return layout(withPin(id, target.x, target.y));
  }

  it('人が別のノードの真上へ置いても、重ならない', async () => {
    const placed = await stackOn('backup', 'lb');
    assert.deepEqual(overlaps(placed), []);
  });

  it('**人が置いたノードは 1 px も動かない**', async () => {
    const first = await layout(R0);
    const target = first.boxes.find((b) => b.id === 'lb')!;
    const placed = await layout(withPin('backup', target.x, target.y));
    const backup = placed.boxes.find((b) => b.id === 'backup')!;
    assert.deepEqual({ x: backup.x, y: backup.y }, { x: target.x, y: target.y });
    assert.equal(backup.pinned, true);
  });

  it('退けるのは機械が置いたほう', async () => {
    const first = await layout(R0);
    const target = first.boxes.find((b) => b.id === 'lb')!;
    const placed = await layout(withPin('backup', target.x, target.y));
    const lb = placed.boxes.find((b) => b.id === 'lb')!;
    assert.notDeepEqual({ x: lb.x, y: lb.y }, { x: target.x, y: target.y });
  });

  it('人どうしが重なったら、**動かさずに知らせる**', async () => {
    const first = await layout(R0);
    const target = first.boxes.find((b) => b.id === 'lb')!;
    const doc = parse(R0);
    setPin(doc, 'lb', { position: { x: target.x, y: target.y } });
    setPin(doc, 'backup', { position: { x: target.x, y: target.y } });
    const placed = await layout(serialize(doc));

    // 動かしていない。
    for (const id of ['lb', 'backup']) {
      const box = placed.boxes.find((b) => b.id === id)!;
      assert.deepEqual({ x: box.x, y: box.y }, { x: target.x, y: target.y }, id);
    }
    // 黙っていない。
    assert.equal(placed.collisions.length, 1);
    assert.deepEqual([...placed.collisions[0]!].sort(), ['backup', 'lb']);
  });

  it('重なりが無ければ、何も動かさない（同じ入力から同じ結果）', async () => {
    const a = await layout(R0);
    const b = await layout(R0);
    assert.deepEqual(
      a.boxes.map((x) => [x.id, x.x, x.y]),
      b.boxes.map((x) => [x.id, x.x, x.y]),
    );
    assert.deepEqual(a.collisions, []);
  });

  it('図が不必要に広がらない', async () => {
    const before = await layout(R0);
    const placed = await stackOn('backup', 'lb');
    // 退けるぶんは広がるが、**桁が変わるほど広がらない**。
    assert.ok(placed.width < before.width * 2, `${before.width} → ${placed.width}`);
    assert.ok(placed.height < before.height * 2, `${before.height} → ${placed.height}`);
  });
});

async function overlapPairs(text: string): Promise<[string, string][]> {
  return overlaps(await layout(text));
}
