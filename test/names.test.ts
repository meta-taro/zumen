/**
 * **外へ出した名前が、他の箱に乗らないこと**（課題 5。2026-09-12）。
 *
 * 配置図の文字は 5 段で置き先を選ぶが、**最後の「外」だけ当たりを見ていなかった。**
 * 箱が図の真ん中にあって上下とも別の箱なら、どちらへ出しても他の箱に乗る。
 * 駐車場の出入口で実際に踏んだ。
 *
 * **消しはしない。** 辺のラベルは消してよいが（どこへ繋がるかは線で分かる）、
 * **名前は線では分からない。** 重なっても出し、混んでいることを人へ返す。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { crowdedNames, extentOf, joinedText, planNames } from '../src/names.ts';
import { inspect } from '../src/tools.ts';

async function plans(source: string) {
  const placed = await layout(source);
  return { placed, plans: planNames(placed.boxes, extentOf(placed.boxes)) };
}

describe('5 段のどれになるか', () => {
  const one = async (body: string) => {
    const { placed, plans: p } = await plans(`version: 1\nkind: placement\nnodes:\n${body}`);
    return p.get(placed.boxes[0]!.id)!;
  };

  it('入るなら中へ', async () => {
    assert.equal((await one('  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 120 }\n')).kind, 'inside');
  });

  it('背が低いだけなら、1 行に繋いで中へ', async () => {
    const plan = await one('  - id: a\n    label: 通路\n    technology: 有効 1,200\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 16 }\n');
    assert.equal(plan.kind, 'joined');
  });

  it('名前は入るが副題が入らないなら、副題だけ回す', async () => {
    assert.equal((await one('  - id: a\n    label: W1\n    technology: 車椅子 3,500\n    at: { x: 0, y: 0 }\n    size: { w: 70, h: 100 }\n')).kind, 'aside');
  });

  it('横に入らず縦になら入るなら、帯に沿って', async () => {
    assert.equal((await one('  - id: a\n    label: 用水路\n    at: { x: 0, y: 0 }\n    size: { w: 16, h: 500 }\n')).kind, 'along');
  });

  it('どれも駄目なら外へ', async () => {
    assert.equal((await one('  - id: a\n    label: とてもとても長い名前です\n    at: { x: 0, y: 0 }\n    size: { w: 30, h: 20 }\n')).kind, 'outside');
  });

  it('1 行に繋いだ文字は、名前と副題を全角空きで繋ぐ', async () => {
    const placed = await layout('version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 通路\n    technology: 有効 1,200\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 16 }\n');
    assert.equal(joinedText(placed.boxes[0]!), '通路　有効 1,200');
  });
});

describe('外へ出すとき、当たりを見る', () => {
  /** 上が空いていて、下に箱がある。**上へ出すはず。** */
  const ROOM_ABOVE = `version: 1
kind: placement
nodes:
  - id: pad
    label: 余白
    at: { x: 200, y: 0 }
    size: { w: 100, h: 120 }
  - id: thin
    label: とても長い名前の細い部屋
    at: { x: 0, y: 120 }
    size: { w: 40, h: 26 }
  - id: below
    label: 下の部屋
    at: { x: 0, y: 146 }
    size: { w: 300, h: 120 }
`;

  it('**下が塞がっていれば、上へ出す**', async () => {
    const { placed, plans: p } = await plans(ROOM_ABOVE);
    const plan = p.get('thin')!;
    assert.equal(plan.kind, 'outside');
    assert.equal(plan.kind === 'outside' && plan.above, true, '塞がっている下へ出した');
  });

  it('空いている所へ置けたなら、混んでいない', async () => {
    const { plans: p } = await plans(ROOM_ABOVE);
    assert.deepEqual(crowdedNames(p), [], '空いているのに混んでいると言っている');
  });

  it('**上下とも塞がっていたら、混んでいると記録する。消さない**', async () => {
    const { plans: p } = await plans(
      ROOM_ABOVE.replace(
        '    at: { x: 200, y: 0 }\n    size: { w: 100, h: 120 }',
        '    at: { x: 0, y: 96 }\n    size: { w: 300, h: 24 }',
      ),
    );
    const plan = p.get('thin')!;
    assert.equal(plan.kind, 'outside', '名前が消えた');
    assert.deepEqual(crowdedNames(p), ['thin']);
  });

  it('**図の外へは出さない**（上端の箱で上へ出すと消える）', async () => {
    const { plans: p } = await plans(`version: 1
kind: placement
nodes:
  - id: top
    label: とても長い名前の細い部屋
    at: { x: 0, y: 0 }
    size: { w: 40, h: 26 }
  - id: rest
    label: 下
    at: { x: 0, y: 26 }
    size: { w: 300, h: 200 }
`);
    const plan = p.get('top')!;
    assert.equal(plan.kind === 'outside' && plan.above, false, '図の外へ出した');
  });

  it('**先に置いた文字にも当たらない**（名前どうしが重ならない）', async () => {
    const { plans: p } = await plans(`version: 1
kind: placement
nodes:
  - id: a
    label: 長い名前の細い部屋 A
    at: { x: 0, y: 40 }
    size: { w: 40, h: 26 }
  - id: b
    label: 長い名前の細い部屋 B
    at: { x: 40, y: 40 }
    size: { w: 40, h: 26 }
  - id: big
    label: 広い部屋
    at: { x: 0, y: 66 }
    size: { w: 300, h: 200 }
`);
    const a = p.get('a')!;
    const b = p.get('b')!;
    assert.equal(a.kind, 'outside');
    assert.equal(b.kind, 'outside');
    // 同じ側の同じ高さに 2 つ並ぶと重なる。**どちらかは別の側へ行く。**
    const same = a.kind === 'outside' && b.kind === 'outside' && a.above === b.above;
    assert.ok(!same || crowdedNames(p).length > 0, '重なっているのに知らせていない');
  });
});

describe('inspect が、混んでいる名前を返す', () => {
  it('配置図で、混んでいれば id が返る', async () => {
    const out = await inspect(`version: 1
kind: placement
nodes:
  - id: mid
    label: とても長い名前の細い部屋
    at: { x: 0, y: 100 }
    size: { w: 40, h: 26 }
  - id: up
    label: 上
    at: { x: 0, y: 80 }
    size: { w: 300, h: 20 }
  - id: down
    label: 下
    at: { x: 0, y: 126 }
    size: { w: 300, h: 120 }
`);
    assert.deepEqual(out.crowdedNames, ['mid']);
  });

  it('**構成図では空**（箱の大きさを文字から決めるので、必ず入る）', async () => {
    const out = await inspect('version: 1\nnodes:\n  - id: a\n    label: とても長い名前\n');
    assert.deepEqual(out.crowdedNames, []);
  });

  it('見本 34 件は、混んでいる名前が 0 件', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      assert.deepEqual(out.crowdedNames, [], `${name} の名前が混んでいる`);
    }
  });
});

describe('見本 44 件は、どれも読める状態', () => {
  /**
   * **3 つの観測値を、見本すべてで 0 に保つ。**
   *
   * | | 何が起きているか |
   * |---|---|
   * | `crossings` | 矢印が箱を突き抜けている |
   * | `hiddenLabels` | **正本に書いたのに絵に出ていない**辺のラベル |
   * | `crowdedNames` | 名前が他の箱に重なって出ている |
   *
   * とくに `hiddenLabels` は、**書いたのに出ない**状態。
   * 見本は「こう書けばこう出る」を見せるものなので、ここがずれていると
   * **真似た人の図もずれる。**
   */
  it('交差・隠れたラベル・混んだ名前がすべて 0', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith('.zumen.yaml'));
    assert.ok(files.length >= 44, `見本が ${files.length} 件しかない`);
    for (const name of files) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      assert.equal(out.crossings, 0, `${name} で矢印が箱を突き抜けている`);
      assert.deepEqual(out.hiddenLabels, [], `${name} で辺のラベルが絵に出ていない`);
      assert.deepEqual(out.crowdedNames, [], `${name} で名前が重なっている`);
    }
  });
});
