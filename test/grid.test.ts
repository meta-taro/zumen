/**
 * **通り芯と寸法線**（2026-09-12）。
 *
 * オーナーの指摘から始まっている。
 *
 * > 建築設備は、これ工事現場では使えないかと。**不動産の間取り図レベル**です。
 *
 * そのとおりだった。部屋の形は合っていても、**現場が必要とする情報が無い。**
 * 寸法が無い図では、何も建てられない。
 *
 * 前に「通り芯・寸法線は入れない」と書いたが、**取り消した**（`src/grid.ts`）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gridOf, hasGrid, northOf, scaleOf } from '../src/grid.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const PLAN = `version: 1
kind: placement
scale: { mm: 20 }
north: up
grid:
  x:
    - { id: X1, at: 40 }
    - { id: X2, at: 220 }
    - { id: X3, at: 400 }
  y:
    - { id: Y1, at: 40 }
    - { id: Y2, at: 340 }
nodes:
  - id: a
    label: 部屋
    at: { x: 40, y: 40 }
    size: { w: 360, h: 300 }
`;

async function svg(text: string): Promise<string> {
  return render(await layout(text), 'light', 'safe', true);
}

describe('通り芯を読む', () => {
  it('書いた芯が、位置の順に並ぶ（書いた順に依らない）', () => {
    const grid = gridOf({ x: [{ id: 'X2', at: 220 }, { id: 'X1', at: 40 }], y: [] });
    assert.deepEqual(grid.x.map((a) => a.id), ['X1', 'X2']);
  });

  it('**符号か位置が欠けた芯は落とす。** 名前の無い基準線は使えない', () => {
    const grid = gridOf({ x: [{ at: 40 }, { id: 'X1' }, { id: 'X2', at: 'ひだり' }], y: [] });
    assert.deepEqual(grid.x, []);
  });

  it('書かなければ、通り芯は無い', () => {
    assert.equal(hasGrid(gridOf(undefined)), false);
    assert.equal(hasGrid(gridOf('X1')), false);
  });
});

describe('縮尺を読む', () => {
  it('`scale: { mm: 20 }` で 1px が 20mm', () => {
    assert.equal(scaleOf({ mm: 20 }), 20);
  });

  it('**書かなければ null。** 知らない縮尺で数値を出さない', () => {
    assert.equal(scaleOf(undefined), null);
    assert.equal(scaleOf({ mm: 0 }), null);
    assert.equal(scaleOf({ mm: -5 }), null);
    assert.equal(scaleOf({ mm: '20' }), null);
  });

  it('方位は決まった 4 語だけ', () => {
    assert.equal(northOf('up'), 'up');
    assert.equal(northOf('naname'), null);
    assert.equal(northOf(undefined), null);
  });
});

describe('通り芯を描く', () => {
  it('芯ごとに符号が出る（両端に 1 つずつ）', async () => {
    const out = await svg(PLAN);
    assert.equal(out.match(/>X1</g)!.length, 2, 'X1 が両端に出ていない');
    assert.equal(out.match(/>Y2</g)!.length, 2);
  });

  it('**一点鎖線で描く。** 実線でも破線でもない（図面の決まり）', async () => {
    const out = await svg(PLAN);
    assert.ok(out.includes('stroke-dasharray="14 3 3 3"'), '通り芯が一点鎖線でない');
  });

  it('**建物を貫く。** 下敷きにすると中で消える（箱の塗りは透けない）', async () => {
    const placed = await layout(PLAN);
    const out = render(placed, 'light', 'safe', true);
    const grid = out.indexOf('data-grid=');
    const lastBox = out.lastIndexOf('data-node=');
    assert.ok(grid > lastBox, '通り芯が箱より先に描かれている（中で消える）');
  });

  it('符号は丸で囲む', async () => {
    assert.match(await svg(PLAN), /<circle [^>]*r="12"/);
  });

  it('**構成図には描かない**', async () => {
    const out = render(await layout(PLAN.replace('kind: placement', '')), 'light', 'safe', false);
    assert.ok(!out.includes('data-grid='));
  });
});

describe('寸法線を描く', () => {
  it('**芯どうしの寸法が、mm で出る**（180px × 20 = 3600）', async () => {
    const out = await svg(PLAN);
    assert.equal(out.match(/>3600</g)!.length, 2, '3600 が 2 つ出ていない');
  });

  it('**総寸法も出る**（360px × 20 = 7200）', async () => {
    assert.ok((await svg(PLAN)).includes('>7200<'));
  });

  it('芯が 2 本なら、総寸法を重ねて書かない（同じ数字になる）', async () => {
    const out = await svg(PLAN);
    assert.equal(out.match(/>6000</g)!.length, 1, '縦の 6000 が 2 段出ている');
  });

  it('**縮尺が無ければ、寸法を出さない。** 知らない数値を書かない', async () => {
    const out = await svg(PLAN.replace('scale: { mm: 20 }\n', ''));
    assert.ok(out.includes('data-grid='), '通り芯まで消えた');
    assert.ok(!out.includes('>3600<'), '縮尺が無いのに寸法が出た');
  });

  it('方位記号が出る', async () => {
    assert.ok((await svg(PLAN)).includes('>N<'));
    assert.ok(!(await svg(PLAN.replace('north: up\n', ''))).includes('>N<'));
  });
});

describe('通り芯の分だけ、外側へ余白を取る', () => {
  it('**符号が図の外へはみ出さない**', async () => {
    const placed = await layout(PLAN);
    const box = placed.boxes[0]!;
    assert.ok(box.x >= 90, `左の余白が ${box.x} しかなく、符号が切れる`);
    assert.ok(box.y >= 40, `上の余白が ${box.y} しかない`);
    assert.ok(placed.width >= box.x + box.w + 40, '右の余白が足りない');
    assert.ok(placed.height >= box.y + box.h + 90, '下の余白が足りない');
  });

  it('**通り芯を書かなければ、余白は増えない**（構成図の見え方を変えない）', async () => {
    const plain = await layout('version: 1\nnodes:\n  - id: a\n    label: あ\n');
    assert.ok(plain.boxes[0]!.x < 40, '通り芯が無いのに余白が増えた');
  });

  it('正本に書いた座標と、通り芯の位置がずれない', async () => {
    const placed = await layout(PLAN);
    const box = placed.boxes[0]!;
    // 部屋の左端（at.x = 40）と、芯 X1（at = 40）は同じ位置に来る。
    assert.equal(placed.grid.x[0]!.at, box.x, '芯と箱で余白の足し方が違う');
  });
});

describe('壁の厚み（wall）', () => {
  const WALLED = `version: 1
kind: placement
scale: { mm: 20 }
wall: { mm: 120, outer: 200 }
groups:
  - id: f
    label: 1 階
nodes:
  - id: a
    label: 部屋
    at: { x: 40, y: 40 }
    size: { w: 200, h: 160 }
    group: f
`;

  it('**壁が厚く描かれる**（120mm ÷ 20 = 6px）', async () => {
    const out = render(await layout(WALLED), 'light', 'safe', true);
    assert.match(out, /data-node="a"[\s\S]*?stroke-width="6"/, '間仕切の厚みが効いていない');
  });

  it('**外壁のほうが厚い**（200mm ÷ 20 = 10px）', async () => {
    const out = render(await layout(WALLED), 'light', 'safe', true);
    assert.match(out, /data-group="f"[\s\S]*?stroke-width="10"/, '外壁が内壁と同じ太さ');
  });

  it('**縮尺が無ければ、太さを変えない。** mm を px にできない', async () => {
    const out = render(
      await layout(WALLED.replace('scale: { mm: 20 }\n', '')),
      'light',
      'safe',
      true,
    );
    assert.ok(!out.includes('stroke-width="6"'), '縮尺が無いのに壁が太くなった');
  });

  it('外壁を書かなければ、間仕切の 1.5 倍', async () => {
    const out = render(
      await layout(WALLED.replace('wall: { mm: 120, outer: 200 }', 'wall: { mm: 120 }')),
      'light',
      'safe',
      true,
    );
    assert.match(out, /data-group="f"[\s\S]*?stroke-width="9"/);
  });

  it('**壁が厚くなっても、建具はきちんと穴になる**', async () => {
    const source = WALLED.replace(
      '    group: f\n',
      '    group: f\n    openings:\n      - { kind: door, side: top }\n',
    );
    const out = render(await layout(source), 'light', 'safe', true);
    // 壁を消す線は、壁より太くないと縁が残る。
    assert.match(out, /stroke-width="8"/, '建具が壁を消しきれていない');
  });

  it('**構成図では太さを変えない**', async () => {
    const out = render(await layout(WALLED.replace('kind: placement', '')), 'light', 'safe', false);
    assert.ok(!out.includes('stroke-width="6"'));
  });
});

describe('配置図では、動線を箱の上に描く', () => {
  const ROUTE = `version: 1
kind: placement
scale: { mm: 20 }
wall: { mm: 120 }
nodes:
  - id: a
    label: 廊下
    at: { x: 0, y: 0 }
    size: { w: 300, h: 60 }
  - id: b
    label: 階段
    at: { x: 0, y: 60 }
    size: { w: 120, h: 100 }
edges:
  - from: a
    to: b
    label: 避難
`;

  it('**壁の下に隠れない。** 部屋の塗りは透けない', async () => {
    const out = render(await layout(ROUTE), 'light', 'safe', true);
    assert.ok(out.lastIndexOf('data-edge=') > out.lastIndexOf('data-node='), '動線が箱より先に描かれている');
  });

  it('構成図では、これまでどおり箱の下', async () => {
    const out = render(await layout(ROUTE.replace('kind: placement', '')), 'light', 'safe', false);
    assert.ok(out.indexOf('data-edge=') < out.indexOf('data-node='));
  });

  it('**動線は太く描く。** 細いと壁の黒に負ける', async () => {
    const out = render(await layout(ROUTE), 'light', 'safe', true);
    assert.match(out, /data-edge=[\s\S]*?stroke-width="2"/);
  });
});

describe('高さの基準線（mark: level）', () => {
  /**
   * 断面図を 1 枚描いて確かめた（2026-09-12）。**8 割はそのまま描けた。**
   * 違ったのは 3 点で、うち 2 点は正本の書き方で済んだ（方位を書かない／
   * 重なりは観測値）。残った 1 点が、**横の基準線の記号**。
   *
   * **`kind: section` は足さなかった。** 測り方が配置図と同じなので、
   * `src/kind.ts` に自分で書いた歯止め（3 つ目の kind は測り方が 3 つ目に
   * なるときだけ）に当たった。
   */
  const SECTION = `version: 1
kind: placement
scale: { mm: 10 }
grid:
  x:
    - { id: X1, at: 200 }
    - { id: X2, at: 400 }
  y:
    - { id: "天端 +3,000", at: 0, mark: level }
    - { id: GL±0, at: 300, mark: level }
nodes:
  - id: a
    label: 竪壁
    at: { x: 200, y: 0 }
    size: { w: 50, h: 300 }
`;

  it('**三角の高さ記号で描く。** 丸は平面の通り芯の記号', async () => {
    const out = render(await layout(SECTION), 'light', 'safe', true);
    assert.match(out, /<path d="M [^"]*" fill="[^"]*"\/>/, '高さ記号が描かれていない');
    assert.ok(out.includes('>GL±0<'), 'レベルの値が出ていない');
  });

  it('値は両端に出る', async () => {
    const out = render(await layout(SECTION), 'light', 'safe', true);
    assert.equal(out.match(/>GL±0</g)!.length, 2);
  });

  it('**縦の基準線は丸のまま**（断面でも通り芯は通り芯）', async () => {
    const out = render(await layout(SECTION), 'light', 'safe', true);
    assert.match(out, /<circle [^>]*r="12"[^>]*\/><text[^>]*>X1</);
  });

  it('書かなければ丸（これまでの図の見え方を変えない）', async () => {
    const out = render(
      await layout(SECTION.replace(/, mark: level/g, '')),
      'light',
      'safe',
      true,
    );
    assert.equal(out.match(/<circle [^>]*r="12"/g)!.length, 8, '丸が 4 本 × 両端で 8 個出ていない');
  });

  it('**値の分だけ余白を取る。** 図の外へ切れない', async () => {
    const placed = await layout(SECTION);
    const box = placed.boxes[0]!;
    assert.ok(box.x >= 60, `左の余白が ${box.x} しかなく、レベルの値が切れる`);
    assert.ok(placed.width - (box.x + box.w) >= 60, '右の余白が足りない');
  });

  it('知らない mark は丸で描き、警告を出す', async () => {
    const { validate } = await import('../src/validate.ts');
    const found = validate(SECTION.replace('mark: level', 'mark: sankaku'));
    assert.ok(found.some((f) => f.code === 'grid-mark-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });
});
