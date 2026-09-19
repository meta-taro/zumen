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

/**
 * **塗り潰した箱では、符号も反転する。**
 *
 * UI 構造図の「fixed」で出た（2026-09-14）。`hatch: solid` の箱は
 * 本文を地の色へ反転しているのに、**符号（`tag`）だけ元の色のまま**で、
 * 塗りに沈んで読めなかった。
 *
 * 書いたのに読めないのは、書いていないのと同じ。
 */
describe('塗り潰した箱の符号', () => {
  const SRC = `version: 1
kind: placement
nodes:
  - id: b
    label: Add to Cart
    tag: fixed
    hatch: solid
    at: { x: 0, y: 0 }
    size: { w: 200, h: 40 }
`;

  it('**符号も地の色へ反転する**（塗りに沈まない）', async () => {
    const out = render(await layout(SRC), 'light', 'safe', true);
    assert.match(out, /<text [^>]*fill="#ffffff"[^>]*>fixed</, '符号が塗りに沈んでいる');
  });

  it('本文は、これまでどおり反転する', async () => {
    const out = render(await layout(SRC), 'light', 'safe', true);
    assert.match(out, /<text [^>]*fill="#ffffff"[^>]*>Add to Cart</);
  });

  it('塗っていない箱の符号は、これまでどおり', async () => {
    const out = render(await layout(SRC.replace('    hatch: solid\n', '')), 'light', 'safe', true);
    assert.ok(!/<text [^>]*fill="#ffffff"[^>]*>fixed</.test(out), '塗っていないのに反転した');
  });
});

/**
 * **外へ出した名前は、反転しない。**
 *
 * 配線略図の信号機で出た（2026-09-14）。`marker: circle` ＋ `hatch: solid` の丸に
 * 長い名前を付けると、名前は**丸の外**へ出る。ところが塗り潰し用の反転が
 * その名前にも効いて、**白い紙に白い字**で描かれていた。
 *
 * 反転してよいのは**塗った面の上に載る文字だけ。**
 */
describe('外へ出した名前は反転しない', () => {
  const DOT = `version: 1
kind: placement
nodes:
  - id: sig
    label: 場内 下 1L
    marker: circle
    hatch: solid
    at: { x: 100, y: 100 }
    size: { w: 26, h: 26 }
  - id: far
    label: 離れた箱
    at: { x: 400, y: 400 }
    size: { w: 80, h: 26 }
`;

  it('**丸の外の名前は、地の色で描かない**', async () => {
    const out = render(await layout(DOT), 'light', 'safe', true);
    assert.ok(
      !/<text [^>]*fill="#ffffff"[^>]*>場内 下 1L</.test(out),
      '白い紙に白い字で書いた',
    );
  });

  it('中に入る文字は、これまでどおり反転する', async () => {
    const out = render(await layout(DOT.replace('label: 場内 下 1L', 'label: "1"')), 'light', 'safe', true);
    assert.match(out, /<text [^>]*fill="#ffffff"[^>]*>1</, '塗りの上の文字が反転していない');
  });
});

/**
 * **閉じた輪の中を塗る**（`edges[].hatch`。2026-09-15）。
 *
 * README が長く「まだ無いもの」に挙げていた**面の塗り**がこれ ——
 * 「池の輪郭は描けるが、塗れない」。
 *
 * 閉じた形は `from` と `to` を同じ節にして `via` ＋ `close: true` で引ける
 * と分かったので（見本 97）、**そこへ模様を入れるだけで塗れるようになった。**
 *
 * **閉じていない辺では効かない**（面が無いので塗りようがない）。
 */
describe('閉じた輪の中を塗る', () => {
  const POND = `version: 1
kind: placement
arrows: false
nodes:
  - id: a
    label: ""
    marker: none
    at: { x: 100, y: 100 }
    size: { w: 8, h: 8 }
edges:
  - from: a
    to: a
    close: true
    hatch: solid
    ends: { from: none, to: none }
    via:
      - { x: 200, y: 60 }
      - { x: 260, y: 140 }
      - { x: 160, y: 200 }
`;

  it('**面が塗られる**', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(POND), 'light', 'safe', true);
    assert.match(out, /<path d="M [^"]*" fill="#[0-9a-f]{6}" fill-opacity/, '面が塗られていない');
  });

  it('**輪郭は残る**（塗りだけにしない）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(POND), 'light', 'safe', true);
    assert.match(out, /<path d="M [^"]*" fill="none" stroke="/, '輪郭が消えた');
  });

  it('模様も入る（`lines` は輪で切り抜く）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(POND.replace('hatch: solid', 'hatch: lines')), 'light', 'safe', true);
    assert.match(out, /<clipPath id="face-[^"]*"><path d="M /, '輪で切り抜いていない');
  });

  it('**閉じていない辺では効かない**（面が無い）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(POND.replace('    close: true\n', '')), 'light', 'safe', true);
    assert.ok(!out.includes('fill-opacity'), '閉じていないのに塗った');
  });

  it('書かなければ、これまでどおり塗らない', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(await layout(POND.replace('    hatch: solid\n', '')), 'light', 'safe', true);
    assert.ok(!out.includes('fill-opacity'));
  });
});

describe('閉じていない辺の hatch を知らせる', () => {
  it('**面が無いので、塗りようがない**', async () => {
    const { validate } = await import('../src/validate.ts');
    const found = validate(`version: 1
kind: placement
nodes:
  - id: a
    label: あ
    at: { x: 0, y: 0 }
    size: { w: 40, h: 20 }
  - id: b
    label: い
    at: { x: 200, y: 0 }
    size: { w: 40, h: 20 }
edges:
  - from: a
    to: b
    hatch: solid
`);
    assert.ok(found.some((f) => f.code === 'edge-hatch-ignored'), found.map((f) => f.code).join(','));
  });
});

/**
 * **辺に `fill` は無い。** 黙って落とさない（2026-09-19。見本 192 で踏んだ）。
 *
 * 面の色は `nodes[].fill`、線の色は `color`。
 * **閉じた輪（`close: true`）の中を塗るのは `hatch` で、その色は `color`。**
 * ところが「面を塗るのだから fill だろう」と辺へ書くと、
 * **何も言われないまま、塗られない図が出る** —— zumen がいちばん嫌う壊れ方
 * （描かれないものを名指しする、という約束の反対）。
 */
describe('辺に fill は効かない', () => {
  const RING = `version: 1
kind: placement
arrows: true
palette:
  面: "#3f6f8f"
nodes:
  - id: a
    label: ""
    marker: none
    at: { x: 40, y: 40 }
    size: { w: 2, h: 2 }
edges:
  - from: a
    to: a
    close: true
    hatch: solid
    fill: 面
    ends: { from: none, to: none }
    via:
      - { x: 60, y: 60 }
      - { x: 200, y: 60 }
      - { x: 200, y: 200 }
`;

  it('**辺の fill を知らせる**（黙って落とさない）', () => {
    const found = validate(RING);
    assert.ok(
      found.some((f) => f.code === 'edge-fill-ignored'),
      `何も言っていない: ${JSON.stringify(found.map((f) => f.code))}`,
    );
  });

  it('**どう書けばよいかを言う**（color と hatch）', () => {
    const said = validate(RING).find((f) => f.code === 'edge-fill-ignored')!.message;
    assert.match(said, /color/);
    assert.match(said, /hatch/);
  });

  it('warning であって、図は出る', () => {
    assert.ok(validate(RING).every((f) => f.severity === 'warning'));
  });

  it('color で書いてあれば、何も言わない', () => {
    assert.ok(!validate(RING.replace('fill: 面', 'color: 面')).some((f) => f.code === 'edge-fill-ignored'));
  });
});

/**
 * **模様が、面の途中で切れていた**（2026-09-19）。
 *
 * 要素数の上限に当たったとき `break` が**内側のくり返ししか抜けていなかった**ので、
 * 残りの行は 1 つも描かれず、**箱の上だけが埋まった面**が出ていた。
 * 測ったら**見本 9 枚**がそうなっており、
 * **ビリヤード台の羅紗（見本 168）は 20% しか点がなかった** ——
 * 上と左の縁だけに点が入り、下と右の縁は無地だった。誰も気づいていなかった。
 *
 * **半分だけ模様が入った面は、無地より悪い** —— 材料が途中で変わって見える。
 */
describe('広い面でも、模様は端まで届く', () => {
  /** 描かれた点の y の最大。**下の縁まで届いているか。** */
  const lowest = (svg: string): number =>
    Math.max(...[...svg.matchAll(/<circle cx="\d+" cy="(\d+)"/g)].map((m) => Number(m[1])));
  const drawn = (svg: string): number => (svg.match(/<circle /g) ?? []).length;

  const WIDE = { x: 0, y: 0, w: 600, h: 600 };

  it('**上限を超える広さでも、下の縁まで点が届く**', () => {
    const svg = drawHatch('dots', WIDE, '#000', 'box', 'a');
    assert.ok(lowest(svg) > WIDE.h * 0.9, `いちばん下の点が ${lowest(svg)}（下の縁は ${WIDE.h}）`);
  });

  it('要素数の上限は守る（間隔のほうを広げる）', () => {
    assert.ok(drawn(drawHatch('dots', WIDE, '#000', 'box', 'a')) <= 480);
  });

  it('狭い面は、これまでどおりの細かさ', () => {
    const small = { x: 0, y: 0, w: 90, h: 90 };
    assert.equal(drawn(drawHatch('dots', small, '#000', 'box', 'a')), 100);
  });

  it('**斜線も端まで届く**（同じ形の穴）', () => {
    const svg = drawHatch('lines', { x: 0, y: 0, w: 2000, h: 2000 }, '#000', 'box', 'a');
    const ys = [...svg.matchAll(/y2="(-?\d+)"/g)].map((m) => Number(m[1]));
    assert.ok(Math.max(...ys) > 1800, `いちばん下の斜線が ${Math.max(...ys)}`);
  });
});
