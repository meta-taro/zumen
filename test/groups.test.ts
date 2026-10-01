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
  // **向きは正本が決める**（既定は横。Issue #9 の続き）ので、
  // 流れる方向で並べる。縦の座標で見ると、横向きの図では意味が無い。
  const flow = (box: { x: number; y: number }): number =>
    placed.width >= placed.height ? box.x : box.y;
  return [...placed.boxes].sort((a, b) => flow(a) - flow(b)).map((box) => box.id);
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
    // 横向きなら x、縦向きなら y。**流れる方向で見る。**
    const along = (p: { x: number; y: number }): number =>
      placed.width >= placed.height ? p.x : p.y;
    assert.ok(
      along(last) > along(first),
      `終点 ${along(last)} が始点 ${along(first)} より手前にある`,
    );
  });

  it('囲みどうしも、辺の向きに沿って並ぶ', async () => {
    const placed = await layout(CHAIN);
    // **流れる方向で見る**（既定は横。Issue #9 の続き）。
    const at = (id: string): number => {
      const group = placed.groups.find((g) => g.id === id)!;
      return placed.width >= placed.height ? group.x : group.y;
    };
    assert.ok(at('soto') < at('honban'), '外部より本番が手前にある');
    assert.ok(at('honban') < at('hokan'), '本番より保管先が手前にある');
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
      assert.ok(box.x >= group.x, `${box.id} が ${group.id} の左へはみ出した`);
      assert.ok(box.y + box.h <= group.y + group.h, `${box.id} が ${group.id} の下へはみ出した`);
    }
  });
});
