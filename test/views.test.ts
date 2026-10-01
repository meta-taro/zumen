/**
 * **1 枚の紙に、図を 2 つ以上置く**（D35 / `src/views.ts`）。
 *
 * ## ここでいちばん見たいもの
 *
 * **通しで測らないこと。**
 *
 * 駅の構内図（見本 45）で 1F と B1F を並べたとき、`grid` と `scale` が
 * 図ぜんたいに 1 組しかないので **「2 階を合わせた全長 82,000」**という
 * 意味のない数字が出た。通り芯も 2 階分を貫いた。
 *
 * ここでは、**図ごとに測っていること**と、**芯が隣の図へ伸びないこと**を見る。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';
import { viewsOf } from '../src/views.ts';

/** 1F と B1F を横に並べた図。**各階平面図の形。** */
const TWO_FLOORS = `version: 1
kind: placement
title: 二階建て
views:
  - id: f1
    title: 1 階平面図
    at: { x: 40, y: 40 }
    size: { w: 300, h: 200 }
    scale: { mm: 20 }
    grid:
      x:
        - { id: X1, at: 40 }
        - { id: X2, at: 190 }
        - { id: X3, at: 340 }
  - id: b1
    title: B1 階平面図
    at: { x: 600, y: 40 }
    size: { w: 300, h: 200 }
    scale: { mm: 20 }
    grid:
      x:
        - { id: X1, at: 600 }
        - { id: X2, at: 750 }
        - { id: X3, at: 900 }
nodes:
  - id: a
    label: 改札
    at: { x: 40, y: 40 }
    size: { w: 300, h: 200 }
  - id: b
    label: ホーム
    at: { x: 600, y: 40 }
    size: { w: 300, h: 200 }
`;

const svgOf = async (source: string): Promise<string> => render(await layout(source), 'light', 'safe', true);

/** 寸法の数値だけを拾う。 */
function figures(svg: string): string[] {
  return [...svg.matchAll(/<text[^>]*>([\d,]+(?:\s*m)?)<\/text>/g)].map((m) => m[1]!);
}

describe('読む', () => {
  it('id と枠が揃っているものだけ通す', () => {
    const got = viewsOf([
      { id: 'a', at: { x: 0, y: 0 }, size: { w: 10, h: 10 } },
      { id: '', at: { x: 0, y: 0 }, size: { w: 10, h: 10 } },
      { id: 'c', size: { w: 10, h: 10 } },
      { id: 'd', at: { x: 0, y: 0 } },
      { id: 'e', at: { x: 0, y: 0 }, size: { w: 0, h: 10 } },
      'これは写像ではない',
    ]);
    assert.deepEqual(got.map((view) => view.id), ['a']);
  });

  it('**当て推量で枠を埋めない**（書かなければ描かない）', () => {
    assert.deepEqual(viewsOf([{ id: 'a' }]), []);
  });

  it('title と scale は書かなくてよい', () => {
    const [view] = viewsOf([{ id: 'a', at: { x: 1, y: 2 }, size: { w: 3, h: 4 } }]);
    assert.equal(view?.title, null);
    assert.equal(view?.mm, null);
  });

  it('並びでなければ空', () => {
    assert.deepEqual(viewsOf({ id: 'a' }), []);
    assert.deepEqual(viewsOf(undefined), []);
  });
});

describe('**通しで測らない**', () => {
  it('図ごとに寸法が出る（総寸法が 2 つある）', async () => {
    const svg = await svgOf(TWO_FLOORS);
    // 芯は 150px 間隔・1px = 20mm → 芯どうし 3,000、総寸法 6,000。
    const found = figures(svg);
    assert.equal(found.filter((one) => one === '3,000').length, 4, `芯どうしが 4 本: ${found.join(' ')}`);
    assert.equal(found.filter((one) => one === '6,000').length, 2, `総寸法が図ごとに 1 本: ${found.join(' ')}`);
  });

  it('**2 つの図を貫く数字が出ない**（見本 45 で出た 82,000 の形）', async () => {
    const svg = await svgOf(TWO_FLOORS);
    // 端から端まで通しで測ると 860px → 17,200。**これが出たら通して測っている。**
    assert.equal(figures(svg).includes('17,200'), false);
  });

  it('図の名前が絵に出る（どちらが何階か読める）', async () => {
    const svg = await svgOf(TWO_FLOORS);
    assert.match(svg, /data-view="f1"[^>]*>1 階平面図</);
    assert.match(svg, /data-view="b1"[^>]*>B1 階平面図</);
  });

  it('**芯が無くても、図の名前は出る**（名前は寸法の付属品ではない）', async () => {
    // 目盛りを使わない図（コンパスの作図図・見本 127）。**芯も縮尺も無い。**
    const bare = [
      'version: 1',
      'kind: placement',
      'views:',
      '  - id: step',
      '    title: 手順',
      '    at: { x: 0, y: 0 }',
      '    size: { w: 200, h: 120 }',
      'nodes:',
      '  - id: a',
      '    label: あ',
      '    at: { x: 10, y: 10 }',
      '    size: { w: 100, h: 60 }',
      '',
    ].join('\n');
    assert.match(await svgOf(bare), /data-view="step"[^>]*>手順</);
  });

  it('名前を書かない図には、名前を描かない', async () => {
    const svg = await svgOf(TWO_FLOORS.replace('    title: 1 階平面図\n', ''));
    assert.equal(/data-view="f1"/.test(svg), false);
    assert.match(svg, /data-view="b1"/);
  });
});

describe('芯が隣の図へ伸びない', () => {
  it('それぞれの図の中だけを走る', async () => {
    const placed = await layout(TWO_FLOORS);
    const svg = await svgOf(TWO_FLOORS);
    const f1 = placed.views.find((view) => view.id === 'f1')!;
    const b1 = placed.views.find((view) => view.id === 'b1')!;
    // 縦の芯は、その図の上下いっぱい（＋符号の分）だけ。**隣の図の高さまで伸びない。**
    const lines = [...svg.matchAll(/<line x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"/g)].map((m) =>
      m.slice(1).map(Number),
    );
    const vertical = lines.filter(([x1, , x2]) => x1 === x2);
    assert.ok(vertical.length >= 6, '縦の芯が 6 本以上');
    for (const [x, y1, , y2] of vertical) {
      const view = x! < 500 ? f1 : b1;
      const top = Math.min(y1!, y2!);
      const bottom = Math.max(y1!, y2!);
      assert.ok(top >= view.y - 80, `芯が図より上へ伸びすぎ: ${top} < ${view.y - 80}`);
      assert.ok(bottom <= view.y + view.h + 120, `芯が図より下へ伸びすぎ: ${bottom}`);
    }
  });

  it('紙からはみ出さない', async () => {
    const placed = await layout(TWO_FLOORS);
    for (const view of placed.views) {
      assert.ok(view.x >= 0 && view.y >= 0, '図が紙の外にある');
      assert.ok(view.x + view.w <= placed.width, '図が紙の右からはみ出している');
      assert.ok(view.y + view.h <= placed.height, '図が紙の下からはみ出している');
    }
  });
});

describe('図ごとの縮尺', () => {
  it('**全体図と詳細図を 1 枚に置ける**', async () => {
    // **2 つ目の図だけ**縮尺を変える（全体図の横に詳細図を置く形）。
    const detailed = TWO_FLOORS.slice(0, TWO_FLOORS.indexOf('  - id: b1')) +
      TWO_FLOORS.slice(TWO_FLOORS.indexOf('  - id: b1')).replace('scale: { mm: 20 }', 'scale: { mm: 2 }');
    const svg = await svgOf(detailed);
    const found = figures(svg);
    assert.ok(found.includes('300'), `詳細図の側が 1px=2mm で測られている: ${found.join(' ')}`);
    assert.ok(found.includes('3,000'), '全体図の側は 1px=20mm のまま');
  });

  it('図に scale が無ければ、紙ぜんたいの scale を使う', async () => {
    const svg = await svgOf(
      TWO_FLOORS.replace('kind: placement', 'kind: placement\nscale: { mm: 20 }').replaceAll('    scale: { mm: 20 }\n', ''),
    );
    assert.ok(figures(svg).includes('3,000'));
  });
});

describe('黙らない', () => {
  it('枠が無い図は、書いたのに出ないので知らせる', () => {
    const findings = validate(TWO_FLOORS.replace('    at: { x: 40, y: 40 }\n    size: { w: 300, h: 200 }\n    scale', '    scale'));
    assert.ok(findings.some((f) => f.code === 'view-frame-missing'), findings.map((f) => f.code).join(' '));
  });

  it('id が重なっていれば知らせる', () => {
    const findings = validate(TWO_FLOORS.replace('  - id: b1\n', '  - id: f1\n'));
    assert.ok(findings.some((f) => f.code === 'view-id-duplicate'));
  });

  it('構成図では効かないと知らせる', () => {
    const findings = validate(TWO_FLOORS.replace('kind: placement', 'kind: structure'));
    assert.ok(findings.some((f) => f.code === 'views-ignored'));
  });

  it('**目盛りを使わない図では、芯が無くても言わない**（コンパスの作図図）', () => {
    const noScale = TWO_FLOORS.replace(/    scale: \{ mm: 20 \}\n/g, '').replace(
      /    grid:\n      x:\n(?:        - .*\n)+/g,
      '',
    );
    assert.equal(
      validate(noScale).some((f) => f.code === 'views-no-grid'),
      false,
      validate(noScale).map((f) => f.code).join(' '),
    );
  });

  it('**1 つの図に芯が無いのは、間違いではない**（実物の一般配置図がそう）', () => {
    // 上の図に芯があれば、下の図は縦に揃えるだけでよい。**そこを言わない。**
    const one = TWO_FLOORS.replace(/  - id: b1\n(?:.*\n)*?      x:\n(?:        - .*\n)+/, '  - id: b1\n    title: B1 階平面図\n    at: { x: 600, y: 40 }\n    size: { w: 300, h: 200 }\n');
    assert.equal(validate(one).some((f) => f.code.startsWith('view')), false, validate(one).map((f) => f.code).join(' '));
  });

  it('**どの図にも芯が無ければ知らせる**（寸法系を書き忘れた形）', () => {
    // **縮尺は残す。** 縮尺があるのに芯が無い ＝ 書き忘れ。
    const none = TWO_FLOORS.replace(/    grid:\n      x:\n(?:        - .*\n)+/g, '');
    assert.ok(
      validate(none).some((f) => f.code === 'views-no-grid'),
      validate(none).map((f) => f.code).join(' '),
    );
  });

  it('**書かなければ、これまでと何も変わらない**', async () => {
    const plain = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: あ\n    at: { x: 10, y: 10 }\n    size: { w: 100, h: 60 }\n';
    const placed = await layout(plain);
    assert.deepEqual(placed.views, []);
    assert.equal(validate(plain).some((f) => f.code.startsWith('view')), false);
  });
});

/**
 * **縮尺を図ごとに宣言した views には、鳴らさない**（2026-09-19）。
 *
 * `views-no-grid` は「寸法も通り芯も描かれません」と言う。事実ではあるが、
 * **views が無駄だ、と読める** —— 実際それで見本 189 に要らない通り芯を足しかけた。
 *
 * `views[].scale` は**絵に出なくても正本に残る**（読む側と別の実装へ
 * 「この範囲は 1px が何 mm か」を伝える）。1 枚に縮尺が 2 つある図では、それ自体が中身。
 * **grid が無いことを責めるのは、grid も scale も無いときだけ。**
 */
describe('views の警告は、縮尺だけの図を責めない', () => {
  const VIEWS = `version: 1
kind: placement
arrows: true
views:
  - id: a
    title: 詳細
    at: { x: 40, y: 40 }
    size: { w: 200, h: 120 }
SCALE
nodes:
  - id: n
    label: "中身"
    at: { x: 60, y: 60 }
    size: { w: 120, h: 60 }
`;

  it('**縮尺が 1 つしか無ければ、これまでどおり知らせる**（書き忘れ）', () => {
    const found = validate(`scale: { mm: 10 }\n${VIEWS.replace('SCALE\n', '')}`);
    assert.ok(found.some((f) => f.code === 'views-no-grid'), JSON.stringify(found.map((f) => f.code)));
  });

  it('**縮尺が図ごとに違えば、鳴らさない**', () => {
    const TWO = `scale: { mm: 10 }\n${VIEWS.replace('SCALE', '    scale: { mm: 0.5 }')}`.replace(
      'nodes:',
      `  - id: b
    title: 全体
    at: { x: 300, y: 40 }
    size: { w: 200, h: 120 }
    scale: { mm: 10 }
nodes:`,
    );
    const found = validate(TWO);
    assert.ok(
      !found.some((f) => f.code === 'views-no-grid'),
      `縮尺を宣言しているのに責めている: ${JSON.stringify(found.map((f) => f.code))}`,
    );
  });
});
