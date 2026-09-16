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
    // **2026-09-16 に形が変わった** —— 縮尺が単位も決めるようになったため
    // （`scale: { in: … }` でフィート表記。`test/imperial.test.ts`）。
    assert.deepEqual(scaleOf({ mm: 20 }), { mm: 20, feet: false });
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
  it('**芯どうしの寸法が、mm で出る**（180px × 20 = 3,600）', async () => {
    const out = await svg(PLAN);
    assert.equal(out.match(/>3,600</g)!.length, 2, '3,600 が 2 つ出ていない');
  });

  it('**総寸法も出る**（360px × 20 = 7,200）', async () => {
    assert.ok((await svg(PLAN)).includes('>7,200<'));
  });

  it('芯が 2 本なら、総寸法を重ねて書かない（同じ数字になる）', async () => {
    const out = await svg(PLAN);
    assert.equal(out.match(/>6,000</g)!.length, 1, '縦の 6,000 が 2 段出ている');
  });

  /**
   * **土木の図はメートルで書く**（`src/units.ts`）。
   * ダムの平面図に `200000`、保安距離の円に `R=200,000` と出ていた（2026-09-14）。
   */
  it('**1 px が 100 mm 以上の図は m で書く**（土木・造成・保安距離）', async () => {
    const out = await svg(PLAN.replace('scale: { mm: 20 }', 'scale: { mm: 250 }'));
    assert.ok(out.includes('>45 m<'), '180px × 250 = 45 m が出ていない');
    assert.ok(!out.includes('>45,000<'), 'ミリのまま書いている');
  });

  it('**縮尺が無ければ、寸法を出さない。** 知らない数値を書かない', async () => {
    const out = await svg(PLAN.replace('scale: { mm: 20 }\n', ''));
    assert.ok(out.includes('data-grid='), '通り芯まで消えた');
    assert.ok(!out.includes('>3,600<'), '縮尺が無いのに寸法が出た');
  });

  /**
   * **通り芯の無い配置図にも、方位は要る。**
   *
   * 2026-09-16 に見本 156（境界の図）を描いていて当たった。
   * `north: up` と書いたのに何も出ず、**理由は「通り芯が無いから」だった** ——
   * 方位記号は寸法と同じ層に乗っていて、その層ごと描いていなかった。
   * 敷地の見取図・避難経路図・現場の見取図は、**通り芯を引かずに方位だけ要る。**
   * 書いたのに出ないのは、`hiddenTags` と同じ種類の黙った取りこぼし。
   */
  it('**通り芯が無くても、方位は出る**（書いたのに出ない状態を作らない）', async () => {
    const bare = `version: 1
kind: placement
north: up
nodes:
  - id: a
    label: 敷地
    at: { x: 40, y: 40 }
    size: { w: 120, h: 80 }
`;
    assert.ok((await svg(bare)).includes('>N<'), '通り芯が無いと方位が消える');
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

describe('時間軸（mark: tick）', () => {
  /**
   * 工程表を 1 枚描いて分かった（2026-09-13）。**道具は 1 つ足りなかった。**
   *
   * 通り芯の丸で囲むと「通り芯」に見え、寸法を引くと
   * `60 / 60 / 60 / 総 240` という**意味のない数字**が並ぶ
   * （名前が既に月を言っている）。
   */
  const GANTT = `version: 1
kind: placement
arrows: false
grid:
  x:
    - { id: 4月, at: 0, mark: tick }
    - { id: 5月, at: 30, mark: tick }
    - { id: 6月, at: 60, mark: tick }
nodes:
  - id: a
    label: 基礎
    at: { x: 0, y: 0 }
    size: { w: 35, h: 22 }
`;

  it('**丸で囲まない。** 名前だけを目盛りの上に書く', async () => {
    const out = render(await layout(GANTT), 'light', 'safe', true);
    assert.ok(out.includes('>4月<'), '目盛りの名前が出ていない');
    assert.ok(!out.includes('r="12"'), '時間軸に丸が出ている');
  });

  it('**寸法を引かない。** 名前が既に時刻を言っている', async () => {
    const out = render(await layout(GANTT.replace('arrows: false', 'arrows: false\nscale: { mm: 1 }')), 'light', 'safe', true);
    assert.ok(!out.includes('>30<'), '時間軸に寸法が出ている');
  });

  it('目盛りの線は図の中を通る', async () => {
    const out = render(await layout(GANTT), 'light', 'safe', true);
    assert.ok(out.includes('stroke-dasharray="14 3 3 3"'), '目盛りの線が無い');
  });

  it('**縮尺が無くても警告しない**（時間軸に縮尺は要らない）', async () => {
    const { validate } = await import('../src/validate.ts');
    assert.ok(!validate(GANTT).some((f) => f.code === 'scale-missing'));
  });

  it('通り芯（code）と混ぜても、寸法は通り芯だけに引く', async () => {
    const mixed = GANTT.replace('- { id: 6月, at: 60, mark: tick }', '- { id: X1, at: 60 }\n    - { id: X2, at: 120 }');
    const { validate } = await import('../src/validate.ts');
    assert.ok(validate(mixed).some((f) => f.code === 'scale-missing'), '通り芯があるのに縮尺を求めていない');
  });
});

describe('負の座標', () => {
  /**
   * 工程表の行見出しを `x: -120` に置いて踏んだ（2026-09-13）。
   * **画用紙の外へ落ちて消えていた** —— 以前は右下の端だけを測っていた。
   *
   * 負の座標は間違いではない。**本体より左に見出しの列を置く**のは、
   * 工程表・座席図・表のある図でふつうの書き方。
   */
  const LEFT = `version: 1
kind: placement
nodes:
  - id: head
    label: 準備・仮設
    marker: none
    at: { x: -120, y: 0 }
    size: { w: 110, h: 22 }
  - id: bar
    label: 14
    at: { x: 0, y: 0 }
    size: { w: 14, h: 22 }
`;

  it('**画用紙の中へ入る。** 消えない', async () => {
    const placed = await layout(LEFT);
    for (const box of placed.boxes) {
      assert.ok(box.x >= 0, `${box.id} が画用紙の外（x=${box.x}）`);
      assert.ok(box.x + box.w <= placed.width, `${box.id} が右へはみ出した`);
    }
  });

  it('相対の位置関係は変わらない', async () => {
    const placed = await layout(LEFT);
    const head = placed.boxes.find((b) => b.id === 'head')!;
    const bar = placed.boxes.find((b) => b.id === 'bar')!;
    assert.equal(bar.x - head.x, 120, '見出しと帯の間が変わった');
  });

  it('**負が無ければ 1 px も動かさない**（人が書いた座標がそのまま出る）', async () => {
    const placed = await layout(`version: 1
kind: placement
nodes:
  - id: a
    label: あ
    at: { x: 3, y: 5 }
    size: { w: 40, h: 20 }
`);
    assert.equal(placed.boxes[0]!.x, 3, '近いだけで動かした');
    assert.equal(placed.boxes[0]!.y, 5);
  });
});

/**
 * **縦の目盛り**（`grid.y` の `mark: tick`）。
 *
 * 登山のコースタイム図（縦が標高、横が累積時間）で出た（2026-09-13）。
 * **標高の数字を、目盛りの線が横切っていた。**
 *
 * 原因は線を 2 本引いていたこと —— 通り芯の長い線（余白まで伸びる）を引いてから、
 * 目盛りの短い線を重ねていた。**長いほうが文字の上を通っていた。**
 * 横の目盛り（`grid.x`）は 1 本だけで、そちらは正しかった。
 */
describe('縦の目盛り（mark: tick）', () => {
  const PROFILE = `version: 1
kind: placement
arrows: false
grid:
  y:
    - { id: 2000 m, at: 40, mark: tick }
    - { id: 1000 m, at: 240, mark: tick }
nodes:
  - id: a
    label: 登山口
    marker: circle
    at: { x: 60, y: 230 }
    size: { w: 26, h: 26 }
  - id: b
    label: 山頂
    marker: circle
    at: { x: 300, y: 30 }
    size: { w: 26, h: 26 }
`;

  /** その図の一点鎖線（横方向のものだけ）。 */
  function rules(out: string): { x1: number; x2: number; y: number }[] {
    return [...out.matchAll(/<line x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"[^>]*stroke-dasharray="14 3 3 3"/g)]
      .filter((m) => m[2] === m[4])
      .map((m) => ({ x1: Number(m[1]), x2: Number(m[3]), y: Number(m[2]) }));
  }

  it('**線は 1 本**（同じ高さに 2 本引かない）', async () => {
    const out = render(await layout(PROFILE), 'light', 'safe', true);
    const ys = rules(out).map((r) => r.y);
    assert.equal(new Set(ys).size, ys.length, `同じ高さに 2 本引いた（${ys.join(', ')}）`);
    assert.equal(ys.length, 2, '目盛りの本数が合わない');
  });

  it('**文字を線が横切らない**（線は文字より右から始まる）', async () => {
    const out = render(await layout(PROFILE), 'light', 'safe', true);
    const label = out.match(/<text x="(\d+)" y="(\d+)"[^>]*text-anchor="end"[^>]*>2000 m</)!;
    const right = Number(label[1]);
    const rule = rules(out).find((r) => Math.abs(r.y - Number(label[2])) < 12)!;
    assert.ok(rule.x1 > right, `線が文字の上を通っている（文字の右端 ${right}・線の左端 ${rule.x1}）`);
  });

  it('横の目盛り（grid.x）は、これまでどおり 1 本', async () => {
    const out = render(
      await layout(PROFILE.replace('  y:', '  x:').replace('at: 40, mark', 'at: 60, mark').replace('at: 240, mark', 'at: 300, mark')),
      'light',
      'safe',
      true,
    );
    const vertical = [...out.matchAll(/<line x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"[^>]*stroke-dasharray="14 3 3 3"/g)]
      .filter((m) => m[1] === m[3])
      .map((m) => Number(m[1]));
    assert.equal(new Set(vertical).size, vertical.length, '同じ位置に 2 本引いた');
  });
});

/**
 * **レベルの名前が、画用紙の左で切れていた。**
 *
 * 2026-09-15。見本 42（擁壁の標準断面図）を開いたら、
 * 左に並ぶ「天端 +3,000」「GL±0」「底版下 -350」が**ほとんど見えず、
 * 矢印の先だけが画用紙の縁に残っていた。** 見本 43（舗装構成）も同じ。
 *
 * 余白の見積もりが `名前の字数 × 9 + 24` で、
 * **矢印の位置（`MARGIN.code` ＋ 19）が入っていなかった。**
 * 字幅も、全角を 9px として見ていた（実際は 10px）。
 *
 * **断面図でレベルが読めないなら、断面図ではない。**
 */
describe('レベルの名前が、画用紙に入る', () => {
  const SECTION = `version: 1
kind: placement
scale: { mm: 10 }
grid:
  y:
    - { id: "天端 +3,000", at: 0, mark: level }
    - { id: GL±0, at: 300, mark: level }
    - { id: "底版下 -350", at: 350, mark: level }
nodes:
  - id: w
    label: 竪壁
    at: { x: 0, y: 0 }
    size: { w: 60, h: 300 }
`;

  it('**いちばん長いレベル名が、左の余白に収まる**', async () => {
    const out = await render(await layout(SECTION), 'light', 'safe', true);
    const width = Number(/viewBox="0 0 ([\d.]+) /.exec(out)![1]);
    for (const m of out.matchAll(/<text x="(-?[\d.]+)"[^>]*text-anchor="end"[^>]*>([^<]*)<\/text>/g)) {
      const right = Number(m[1]);
      const text = m[2]!;
      const size = [...text].reduce((a, c) => a + (c.charCodeAt(0) > 0x2000 ? 10 : 5.5), 0);
      assert.ok(right - size >= 0, `${text} が左へはみ出している（${Math.round(right - size)}）`);
      assert.ok(right <= width, `${text} が右へはみ出している`);
    }
  });
});

/**
 * **囲みがあると、上の通り芯符号が画用紙の外へ落ちていた。**
 *
 * 2026-09-15。見本 27（圃場整備）・28（ダム）・31（座席図）を数えたら、
 * **上に並ぶはずの X1〜X6 の丸が 1 つも描かれていなかった**（cy = −24、r = 12）。
 * 左の Y1・Y2 も半分外に出ていた。
 *
 * 余白の分だけ「決まった量」ずらしていたが、
 * **囲み（`groups`）は中の箱より上と左へ張り出す**（名前を書く分）。
 * その張り出しが余白を食って、符号が紙の外へ出ていた。
 *
 * **通り芯の符号は上下・左右の両方に出るのが図面の作法。** 片方が消えていた。
 */
describe('囲みがあっても、通り芯の符号が紙に入る', () => {
  const PLAN = `version: 1
kind: placement
scale: { mm: 50 }
grid:
  x:
    - { id: X1, at: 0 }
    - { id: X2, at: 200 }
  y:
    - { id: Y1, at: 0 }
    - { id: Y2, at: 160 }
groups:
  - id: block
    label: 第 1 工区
nodes:
  - id: a
    label: 区画
    group: block
    at: { x: 0, y: 0 }
    size: { w: 200, h: 160 }
`;

  it('**上と左の符号が、画用紙の中にある**', async () => {
    const out = await render(await layout(PLAN), 'light', 'safe', true);
    const found = [...out.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)];
    assert.ok(found.length >= 4, `符号の丸が足りない（${found.length}）`);
    for (const m of found) {
      const [cx, cy, r] = [Number(m[1]), Number(m[2]), Number(m[3])];
      assert.ok(cx - r >= 0, `符号が左へ出ている（${cx - r}）`);
      assert.ok(cy - r >= 0, `符号が上へ出ている（${cy - r}）`);
    }
  });
});

/**
 * **時間の目盛りは、帯の下に敷く。**
 *
 * 2026-09-15、見本 64（施設の開館表）を**ブラウザで開いて**出た。
 * **9:00 / 10:00 … の一点鎖線が「一般開放」「教室」の文字を串刺しにしていた。**
 *
 * 通り芯（`mark: code`）とレベル（`mark: level`）は**最前面**でよい ——
 * 実物の図面でも一点鎖線は**建物を貫いて**見える。基準線だから、隠れたら使えない。
 *
 * **時間の目盛り（`mark: tick`）は別物。** 通り芯ではなく**目盛り**で、
 * 実物の工程表・開放表でも**帯の下**にある。
 */
describe('目盛りと通り芯で、重ねる順が違う', () => {
  const BASE = `version: 1
kind: placement
grid:
  x:
    - { id: "9:00", at: 100, mark: MARK }
    - { id: "10:00", at: 300, mark: MARK }
nodes:
  - id: a
    label: 一般開放
    at: { x: 100, y: 60 }
    size: { w: 200, h: 40 }
`;

  it('**時間の目盛りは、箱より先に描く**（文字を串刺しにしない）', async () => {
    const out = await render(await layout(BASE.replaceAll('MARK', 'tick')), 'light', 'safe', true);
    assert.ok(out.indexOf('data-grid="tick"') < out.indexOf('data-node'), '目盛りが箱の上に載っている');
    assert.ok(!out.includes('data-grid="true"'), '目盛りだけの図に、空の通り芯の層が出ている');
  });

  it('通り芯は、いままでどおり最前面（建物を貫く）', async () => {
    const out = await render(await layout(BASE.replaceAll('MARK', 'code')), 'light', 'safe', true);
    assert.ok(out.indexOf('data-grid="true"') > out.indexOf('data-node'), '通り芯が箱の下へ潜った');
    assert.ok(!out.includes('data-grid="tick"'), '通り芯だけの図に、空の目盛りの層が出ている');
  });
});
