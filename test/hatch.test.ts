/**
 * **ハッチング（材料・区域の模様）**。
 *
 * オーナーの指摘から（2026-09-12）。
 *
 * > 路面図と弁当なんですが、**専門的な図面になれてない**と思うんです。
 * > **今の既存でできる範囲でやっている。** そこはブラッシュアップして、
 * > **その業界専用の表示**を実現してほしい。
 *
 * そのとおりだった。舗装構成の断面図を「層の名前を書いた箱の積み重ね」で描いたが、
 * **実物は材料を模様で描き分けている。**
 *
 * 模様は飾りではない —— **縮小すると文字は消えるが、模様は残る。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HATCHES, drawHatch, hatchOf } from '../src/hatch.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const BOX = { x: 100, y: 100, w: 400, h: 200 };

describe('模様を読む', () => {
  it('5 つで閉じる。**材料の語は無い**', () => {
    assert.deepEqual([...HATCHES], ['none', 'solid', 'dots', 'lines', 'cross']);
    assert.equal(hatchOf('asphalt'), 'none', '材料の語を受けてはいけない');
  });

  it('書かなければ無地', () => {
    assert.equal(hatchOf(undefined), 'none');
    assert.equal(hatchOf('dots'), 'dots');
  });
});

describe('模様を描く', () => {
  it('無地は何も描かない', () => {
    assert.equal(drawHatch('none', BOX, '#111'), '');
  });

  it('塗り潰しは 1 枚の面', () => {
    const out = drawHatch('solid', BOX, '#111');
    assert.equal(out.match(/<rect /g)!.length, 1);
  });

  it('点は並べて置く', () => {
    assert.ok(drawHatch('dots', BOX, '#111').match(/<circle /g)!.length > 40);
  });

  it('**斜線が箱の全体を埋める。** 左辺からだけ引くと右上が空く', () => {
    const out = drawHatch('lines', BOX, '#111');
    const xs = [...out.matchAll(/x1="(-?\d+)"/g)].map((m) => Number(m[1]));
    const ys = [...out.matchAll(/y1="(-?\d+)"/g)].map((m) => Number(m[1]));
    // 右上の隅の近くを通る線があること。
    assert.ok(Math.max(...xs) >= BOX.x + BOX.w - 20, '右端まで斜線が届いていない');
    assert.ok(Math.min(...ys) <= BOX.y + 20, '上端まで斜線が届いていない');
  });

  it('格子は斜線の 2 倍', () => {
    const one = drawHatch('lines', BOX, '#111').match(/<line /g)!.length;
    const two = drawHatch('cross', BOX, '#111').match(/<line /g)!.length;
    assert.ok(two > one * 1.6, `格子 ${two} が斜線 ${one} の 2 倍になっていない`);
  });

  it('**箱の外へはみ出さない。** はみ出すと隣の材料と混ざる', () => {
    const out = drawHatch('cross', BOX, '#111');
    for (const m of out.matchAll(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/g)) {
      const [x1, y1, x2, y2] = m.slice(1).map(Number);
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        assert.ok(x! >= BOX.x - 1 && x! <= BOX.x + BOX.w + 1, `x=${x} が箱の外`);
        assert.ok(y! >= BOX.y - 1 && y! <= BOX.y + BOX.h + 1, `y=${y} が箱の外`);
      }
    }
  });

  it('小さすぎる箱には描かない', () => {
    assert.equal(drawHatch('lines', { x: 0, y: 0, w: 1, h: 1 }, '#111'), '');
  });
});

describe('図に載せる', () => {
  const PLAN = `version: 1
kind: placement
nodes:
  - id: a
    label: 路床
    technology: CBR 6
    hatch: lines
    at: { x: 0, y: 0 }
    size: { w: 400, h: 200 }
`;

  it('配置図で模様が出る', async () => {
    const out = render(await layout(PLAN), 'light', 'safe', true);
    assert.ok(out.includes('stroke-width="0.7"'), '模様が描かれていない');
  });

  it('**模様の上の文字は、下地を抜く**（実物も文字で模様を切る）', async () => {
    const out = render(await layout(PLAN), 'light', 'safe', true);
    assert.match(out, /<rect [^>]*fill="#ffffff"[^>]*\/><text[^>]*>路床</, '文字の下地が抜けていない');
  });

  it('**塗り潰しの上では、文字を地の色にする**（黒地に黒い文字は読めない）', async () => {
    const out = render(await layout(PLAN.replace('hatch: lines', 'hatch: solid')), 'light', 'safe', true);
    assert.match(out, /<text[^>]*fill="#ffffff"[^>]*>路床</);
  });

  it('**構成図には描かない**', async () => {
    const out = render(await layout(PLAN.replace('kind: placement', '')), 'light', 'safe', false);
    assert.ok(!out.includes('stroke-width="0.7"'));
  });

  it('知らない模様を警告する（無地で描く）', () => {
    const found = validate(PLAN.replace('hatch: lines', 'hatch: asphalt'));
    assert.ok(found.some((f) => f.code === 'hatch-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('構成図に書いても効かないことを知らせる', () => {
    const found = validate(PLAN.replace('kind: placement\n', ''));
    assert.ok(found.some((f) => f.code === 'hatch-ignored'));
  });

  it('spec が模様の語を返す', () => {
    assert.deepEqual(spec().hatches, ['none', 'solid', 'dots', 'lines', 'cross']);
    assert.match(spec().shape, /hatch:/);
  });
});

/**
 * **塗りは、印の形に従う。**
 *
 * 停車駅案内図（ホームに貼ってある、どの種別がどこに停まるかの表）で出た
 * （2026-09-13）。停車を示す ● を丸＋塗りで描いたら、
 * **丸の上に四角が乗った。** 印の形を無視して箱を塗っていた。
 */
describe('塗りは、印の形に従う', () => {
  const DOT = `version: 1
kind: placement
nodes:
  - id: stop
    label: ""
    marker: circle
    hatch: solid
    at: { x: 0, y: 0 }
    size: { w: 20, h: 20 }
`;

  it('**丸の塗りは丸**（四角が乗らない）', async () => {
    const out = render(await layout(DOT), 'light', 'safe', true);
    const part = out.slice(out.indexOf('data-node="stop"'));
    const body = part.slice(0, part.indexOf('</g>'));
    assert.ok(!body.includes('<rect'), '丸の上に四角を乗せた');
    assert.match(body, /<circle [^>]*fill-opacity="0.82"/, '丸が塗られていない');
  });

  it('楕円の塗りは楕円', async () => {
    const out = render(await layout(DOT.replace('marker: circle', 'marker: ellipse')), 'light', 'safe', true);
    const part = out.slice(out.indexOf('data-node="stop"'));
    const body = part.slice(0, part.indexOf('</g>'));
    assert.ok(!body.includes('<rect'), '楕円の上に四角を乗せた');
    assert.match(body, /<ellipse [^>]*fill-opacity="0.82"/);
  });

  it('矩形は、これまでどおり四角で塗る', async () => {
    const out = render(await layout(DOT.replace('    marker: circle\n', '')), 'light', 'safe', true);
    assert.match(out, /data-node="stop"[\s\S]*?<rect [^>]*fill-opacity="0.82"/);
  });

  it('**模様も印からはみ出さない**（丸の外に点が散らない）', async () => {
    const out = render(await layout(DOT.replace('hatch: solid', 'hatch: dots')), 'light', 'safe', true);
    const part = out.slice(out.indexOf('data-node="stop"'));
    const body = part.slice(0, part.indexOf('</g>'));
    assert.match(body, /clip-path="url\(#/, '丸で切り抜いていない');
  });
});

/**
 * **名前が空なら、何も書かない。**
 *
 * 停車駅案内図の ● には名前が無い（駅名は上の行にある）。
 * 名前を書かないと **id がそのまま図に出ていた**（`stop1` のような内部の名前）。
 */
describe('名前が空の印', () => {
  it('`label: ""` は文字を出さない', async () => {
    const out = render(
      await layout(`version: 1
kind: placement
nodes:
  - id: stop1
    label: ""
    marker: circle
    at: { x: 0, y: 0 }
    size: { w: 20, h: 20 }
`),
      'light',
      'safe',
      true,
    );
    assert.ok(!out.includes('stop1<'), 'id が図に出た');
    assert.ok(!out.includes('<text'), '空の名前で文字を出した');
  });

  it('名前を書かなければ、これまでどおり id が出る（書き忘れに気づける）', async () => {
    const out = render(
      await layout(`version: 1
kind: placement
nodes:
  - id: stop1
    marker: circle
    at: { x: 0, y: 0 }
    size: { w: 20, h: 20 }
`),
      'light',
      'safe',
      true,
    );
    assert.ok(out.includes('>stop1<'), 'id も出なくなった');
  });
});
