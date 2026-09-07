/**
 * 囲みを付けても、層の順序が壊れないこと（Issue #1）。
 *
 * **報告された最小の再現を、そのままここへ置く。**
 * 4 ノード・3 辺の一方向の鎖に囲みを付けると、
 * **終点が最上段に来て、図の全高を逆流する矢印が生まれていた。**
 * その矢印は途中のノードの箱を突き抜けた。
 *
 * 原因は、囲みを入れ子にしながら**辺を根に置いていた**こと。
 * ELK は囲みをまたぐ辺を層の計算に使えず、囲みどうしの順序が辺から決まらなかった。
 * `elk.hierarchyHandling: INCLUDE_CHILDREN` で解いた。
 *
 * ## なぜ回避ではなく直すのか
 *
 * 所属（どのホストの上か）を描く手段は囲みしかない。
 * **囲みを避けると、図から情報が落ちる。**
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { crossings, layout, overlaps } from '../src/layout.ts';

const CHAIN = readFileSync(new URL('fixtures/groups-chain.zumen.yaml', import.meta.url), 'utf8');
/** 囲みだけを外したもの。**同じ並びになるはず。** */
const FLAT = CHAIN.replace(/\n    group: \w+/g, '');

/** 上から順に並んでいるか。 */
async function order(text: string): Promise<string[]> {
  const placed = await layout(text);
  return [...placed.boxes].sort((a, b) => a.y - b.y).map((box) => box.id);
}

const EXPECTED = ['internet', 'httpd', 'wasabimount', 'wasabi'];

describe('囲みを付けても層が壊れない（Issue #1）', () => {
  it('囲みが無ければ、辺の向きどおりに並ぶ', async () => {
    assert.deepEqual(await order(FLAT), EXPECTED);
  });

  it('**囲みを付けても、同じ並びになる**', async () => {
    assert.deepEqual(await order(CHAIN), EXPECTED);
  });

  it('**終点が最上段に来ない**（これが報告された壊れ方）', async () => {
    const placed = await layout(CHAIN);
    const first = placed.boxes.find((box) => box.id === 'internet')!;
    const last = placed.boxes.find((box) => box.id === 'wasabi')!;
    assert.ok(last.y > first.y, `終点 y=${last.y} が始点 y=${first.y} より上にある`);
  });

  it('囲みどうしも、辺の向きに沿って並ぶ', async () => {
    const placed = await layout(CHAIN);
    const y = (id: string) => placed.groups.find((g) => g.id === id)!.y;
    assert.ok(y('soto') < y('honban'), '外部より本番が上にある');
    assert.ok(y('honban') < y('hokan'), '本番より保管先が上にある');
  });

  it('矢印が箱を突き抜けない（交差も重なりも 0）', async () => {
    const placed = await layout(CHAIN);
    assert.equal(crossings(placed), 0);
    assert.deepEqual(overlaps(placed), []);
  });

  it('囲みの矩形は、中身をすべて含む', async () => {
    const placed = await layout(CHAIN);
    for (const box of placed.boxes) {
      if (box.group === null) continue;
      const group = placed.groups.find((g) => g.id === box.group)!;
      assert.ok(box.y >= group.y, `${box.id} が ${group.id} の上へはみ出した`);
      assert.ok(box.y + box.h <= group.y + group.h, `${box.id} が ${group.id} の下へはみ出した`);
    }
  });
});
