/**
 * 建具（`openings`）が、実物の平面図と同じ記号で出ること。
 *
 * **人の指摘から始まっている**（2026-09-12）。
 * 「間取り図 モダン マンション」で実物を並べたところ、
 * zumen が出していたのは**角丸の箱に名前を書いて矢印で繋いだもの**で、
 * 平面図ではなかった。差が大きかったのは、壁・矢印・建具・文字の 4 点。
 *
 * ここで測るのは**建具**。
 * 「扉がある」ことを絵で言えないと、間取り図は間取り図にならない。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { drawOpenings, openingsOf, type Hole } from '../src/openings.ts';

const BOX = { x: 100, y: 100, w: 200, h: 120 };
const INK = '#111111';
const PAPER = '#ffffff';

function draw(holes: Hole[]): string {
  return drawOpenings(BOX, holes, INK, PAPER);
}

function one(kind: string, side = 'bottom'): Hole[] {
  return openingsOf([{ kind, side }]);
}

describe('建具を読む（openingsOf）', () => {
  it('種類と辺が揃っていれば読む', () => {
    assert.deepEqual(openingsOf([{ kind: 'door', side: 'left' }]), [
      { kind: 'door', side: 'left', at: 0.5, width: 36 },
    ]);
  });

  it('**知らない種類は黙って落とす。** 描けないものを描いたことにしない', () => {
    assert.deepEqual(openingsOf([{ kind: 'toilet', side: 'left' }]), []);
    assert.deepEqual(openingsOf([{ kind: 'door', side: 'naka' }]), []);
  });

  it('位置と幅は、書いてあれば使う', () => {
    const [hole] = openingsOf([{ kind: 'window', side: 'top', at: 0.2, width: 80 }]);
    assert.equal(hole!.at, 0.2);
    assert.equal(hole!.width, 80);
  });

  it('位置が 0〜1 の外なら、中央に戻す（図が壊れるより中央のほうがまし）', () => {
    assert.equal(openingsOf([{ kind: 'door', side: 'top', at: 9 }])[0]!.at, 0.5);
    assert.equal(openingsOf([{ kind: 'door', side: 'top', at: -1 }])[0]!.at, 0.5);
  });

  it('幅が 0 以下なら既定に戻す', () => {
    assert.equal(openingsOf([{ kind: 'door', side: 'top', width: 0 }])[0]!.width, 36);
  });

  it('配列でなければ、建具は無い', () => {
    assert.deepEqual(openingsOf(null), []);
    assert.deepEqual(openingsOf('door'), []);
    assert.deepEqual(openingsOf([null, 3, 'door']), []);
  });

  it('OPENINGS の 5 種すべてが読める', () => {
    for (const kind of ['door', 'slide', 'window', 'double', 'open']) {
      assert.equal(openingsOf([{ kind, side: 'top' }]).length, 1, `${kind} が落ちた`);
    }
  });
});

describe('建具を描く（drawOpenings）', () => {
  it('建具が無ければ、何も出さない', () => {
    assert.equal(draw([]), '');
  });

  it('**まず壁を消す。** 建具は穴なので、そこに壁があってはいけない', () => {
    for (const kind of ['door', 'slide', 'window', 'double', 'open']) {
      const svg = draw(one(kind));
      assert.ok(
        svg.includes(`stroke="${PAPER}"`),
        `${kind} が壁を消していない（壁の上に記号が重なって出る）`,
      );
    }
  });

  it('開口（open）は、壁を消すだけ。記号は描かない', () => {
    const svg = draw(one('open'));
    assert.ok(svg.includes(`stroke="${PAPER}"`));
    assert.ok(!svg.includes(`stroke="${INK}"`), '開口なのに記号が出ている');
  });

  it('**片開き戸は、戸と開き勝手の弧。** 弧が無いと引き戸と見分けがつかない', () => {
    const svg = draw(one('door'));
    assert.match(svg, /<path d="M [\d-]+ [\d-]+ A /, '開き勝手の弧が無い');
    assert.equal(svg.match(/<path /g)!.length, 1, '片開きなのに弧が 1 つでない');
  });

  it('両開き戸は、弧が 2 つ', () => {
    assert.equal(draw(one('double')).match(/<path /g)!.length, 2);
  });

  it('**引き戸に弧は無い。** 引き戸は開き勝手を持たない', () => {
    const svg = draw(one('slide'));
    assert.ok(!svg.includes('<path '), '引き戸に開き勝手の弧が出ている');
    assert.equal(svg.match(/<line /g)!.length, 3, '壁消し 1 + 戸 2 になっていない');
  });

  it('窓は、細い 2 本線（弧なし）', () => {
    const svg = draw(one('window'));
    assert.ok(!svg.includes('<path '), '窓に弧が出ている');
    assert.equal(svg.match(/stroke-width="1"/g)!.length, 2, '窓が細い 2 本線になっていない');
  });

  it('4 辺それぞれに付き、その辺の上に乗る', () => {
    const on = {
      top: (a: number[]) => a[1] === BOX.y && a[3] === BOX.y,
      bottom: (a: number[]) => a[1] === BOX.y + BOX.h && a[3] === BOX.y + BOX.h,
      left: (a: number[]) => a[0] === BOX.x && a[2] === BOX.x,
      right: (a: number[]) => a[0] === BOX.x + BOX.w && a[2] === BOX.x + BOX.w,
    };
    for (const [side, sits] of Object.entries(on)) {
      const svg = draw(one('open', side));
      const m = svg.match(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/)!;
      assert.ok(sits(m.slice(1).map(Number)), `${side} の建具が、その辺の上に無い`);
    }
  });

  it('**辺からはみ出さない。** はみ出すと、隣の部屋の壁を消す', () => {
    for (const at of [0, 1]) {
      const svg = drawOpenings(BOX, openingsOf([{ kind: 'open', side: 'top', at, width: 60 }]), INK, PAPER);
      const m = svg.match(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/)!;
      const [x1, , x2] = m.slice(1).map(Number);
      assert.ok(x1! >= BOX.x && x2! <= BOX.x + BOX.w, `at=${at} で壁からはみ出した`);
    }
  });

  it('複数の建具が、すべて出る', () => {
    const holes = openingsOf([
      { kind: 'door', side: 'left' },
      { kind: 'window', side: 'top' },
      { kind: 'slide', side: 'bottom' },
    ]);
    const svg = drawOpenings(BOX, holes, INK, PAPER);
    assert.equal(svg.match(new RegExp(`stroke="${PAPER}"`, 'g'))!.length, 3);
  });
});

describe('平面図でも、正本が書いた辺は描く', () => {
  it('**矢印を落とさない。** 売場の補充動線・避難経路は平面図の上に引く', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const source = `version: 1
kind: placement
nodes:
  - id: a
    label: 入口
    at: { x: 0, y: 0 }
    size: { w: 120, h: 80 }
  - id: b
    label: レジ
    at: { x: 200, y: 0 }
    size: { w: 120, h: 80 }
edges:
  - from: a
    to: b
    label: 動線
`;
    const out = render(await layout(source), 'light', 'safe', true);
    assert.ok(out.includes('data-edge='), '平面図で辺が消えた');
    assert.ok(out.includes('>動線<'), '辺のラベルが消えた');
  });

  it('辺を書かなければ、矢印は出ない（間取りはこちら）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(
      await layout('version: 1\nkind: placement\nnodes:\n  - id: a\n    at: { x: 0, y: 0 }\n'),
      'light',
      'safe',
      true,
    );
    assert.ok(!out.includes('data-edge='), '辺が無いのに矢印が出た');
  });
});
