/**
 * 投影して読めるか（Issue #6）。
 *
 * ## 基準を投影に置いた理由（報告者の整理）
 *
 * | | 下限 | 短辺（A3=297mm / 1080p）に対する比 |
 * |---|---|---|
 * | A3 印刷 | 2.5mm（JIS Z 8313 の最小文字高） | 0.84% |
 * | 投影 | 16px 相当（1080p を後方から） | **1.5%** |
 *
 * **投影を通れば A3 も通る。逆は通らない。** 片方だけ選ぶなら投影。
 *
 * ## **縮小率を決めるのは「画面からはみ出すほうの辺」**
 *
 * 図は画面に収めるとき `min(画面幅/図幅, 画面高/図高)` で縮む。
 *
 * 当初こちらは**短辺**で測ろうとし、報告者の指摘で**長辺**に直した。
 * **縦長の図では長辺が正しい。** だが画面は正方形ではないので、
 * 横長の図では長辺が効かない（2026-09-11 に、向きを横にして気づいた）。
 *
 *     縦長 499x944  font 14 → 1920x1080 に収めると **16.0px**
 *     横長 1312x341 font 15 → 同じ画面で **22.0px**
 *
 *     長辺で測ると   1.48% → 1.14%（**悪くなったことになる**）
 *     実際に効く辺   1.48% → 2.03%（**良くなっている**）
 *
 * `W/H = 16/9` を入れると `縮小率 = 1 / max(高さ, 幅 × 9/16)`。
 *
 * ## **文字を大きくしない**
 *
 * > 1 だと、伸びた図をさらに伸ばす方向へ働くので。
 *
 * 文字を上げると図が伸び、比がさらに下がる。**収束しない直し方は入れない。**
 *
 * そして**図を分けるかどうかは意味の判断**で、機械が決めるものではない。
 * `pins` や競合と同じく、**機械は指摘し、人が決める**。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PROJECTION_FLOOR, SMALLEST_TEXT, projection } from '../src/projection.ts';
import { inspect } from '../src/tools.ts';

describe('下限の置き方', () => {
  it('**投影の 1.5%**（A3 の 0.84% より厳しいほうを採る）', () => {
    assert.equal(PROJECTION_FLOOR, 0.015);
  });

  it('いちばん小さい字は 11px（辺のラベルと副題）', () => {
    assert.equal(SMALLEST_TEXT, 11);
  });
});

describe('**効く辺で測る**（16:9 の画面に収める）', () => {
  it('**縦長の図は高さで測る**', () => {
    assert.equal(projection(200, 1000).longestSide, 1000);
  });

  it('短辺で測っていたら通っていた図を、落とす', () => {
    // 短辺 200 なら 11/200 = 5.5% で楽々通る。高さ 1000 では 1.1% で落ちる。
    const got = projection(200, 1000);
    assert.equal(got.tooSmallToProject, true);
    assert.ok((got.textRatio ?? 1) < PROJECTION_FLOOR);
  });

  it('**16:9 より横長の図は、幅 × 9/16 で測る**（長辺ではない）', () => {
    // 1000x200 は 16:9 より横長。長辺 1000 ではなく 1000×9/16 = 562.5 が効く。
    assert.equal(projection(1000, 200).longestSide, 562.5);
  });

  it('**横長にして実際に読みやすくなった図を、落とさない**', () => {
    // 同じ内容を縦横で組んだときの実測（font 14 / 15）。
    const tall = projection(499, 944);
    const wide = projection(1312, 341);
    assert.ok(
      (wide.textRatio ?? 0) > (tall.textRatio ?? 0),
      `縦 ${tall.textRatio} / 横 ${wide.textRatio}`,
    );
  });

  it('ちょうど 16:9 なら、高さと幅×9/16 が一致する', () => {
    assert.equal(projection(1600, 900).longestSide, 900);
  });
});

describe('報告された実測値（回帰）', () => {
  // **下限を後から甘くして通す、をやらないため**に、実物の値をそのまま置く。
  //
  // **比は、測り方を直したぶん変わっている**（2026-09-11）。
  // 縦長の 2 枚は高さが効くので変わらない。
  // 16:9 より横長の 1 枚（832x496）だけ、**長辺 832 ではなく 468 が効く**ので上がる。
  const REPORTED = [
    { name: 'ネットワーク構成', w: 730, h: 840, ratio: 0.0131 },
    { name: 'カムスタ・ローコード構成', w: 832, h: 496, ratio: 0.0222 },
    { name: '全部入り（囲み 3 つ）', w: 1048, h: 1052, ratio: 0.0105 },
  ];

  for (const { name, w, h, ratio } of REPORTED) {
    it(`${name} — 比が ${(ratio * 100).toFixed(2)}%`, () => {
      const got = projection(w, h);
      assert.equal(Math.round((got.textRatio ?? 0) * 10000) / 10000, ratio);
      // **横長の 1 枚は、測り方を直した結果 通るようになった。**
      assert.equal(got.tooSmallToProject, ratio < 0.015);
    });
  }

  it('**いちばん大きい図がいちばん読めない**（報告者の指摘そのもの）', () => {
    const ratios = REPORTED.map(({ w, h }) => projection(w, h).textRatio ?? 0);
    const binding = REPORTED.map(({ w, h }) => projection(w, h).longestSide);
    const worst = ratios.indexOf(Math.min(...ratios));
    assert.equal(binding[worst], Math.max(...binding));
  });
});

describe('通る図もある', () => {
  it('小さい図は通る', () => {
    const got = projection(600, 400);
    assert.equal(got.tooSmallToProject, false);
    assert.ok((got.textRatio ?? 0) >= PROJECTION_FLOOR);
  });

  it('ちょうど下限なら通す（境目で落とさない）', () => {
    const side = Math.round(SMALLEST_TEXT / PROJECTION_FLOOR); // 733
    assert.equal(projection(1, side).tooSmallToProject, false);
  });

  it('空の図では判定しない（割れない）', () => {
    const got = projection(0, 0);
    assert.equal(got.tooSmallToProject, false);
    assert.equal(got.textRatio, null);
  });
});

describe('検査から返る', () => {
  it('**比と下限の両方を返す**（どれくらい足りないかが分かる）', async () => {
    const source = 'version: 1\nnodes:\n  - id: a\n  - id: b\n';
    const out = await inspect(source);
    assert.equal(typeof out.textRatio, 'number');
    assert.equal(out.projectionFloor, PROJECTION_FLOOR);
    assert.equal(typeof out.tooSmallToProject, 'boolean');
    // **その図に出る字**を返す（名前しか無い図なので、名前の大きさ）。
    assert.equal(out.smallestText, 15);
    assert.ok(out.smallestText >= SMALLEST_TEXT, '副題より小さい字は出ていない');
  });

  it('大きい図では真になる', async () => {
    const ids = Array.from({ length: 24 }, (_, i) => `n${i}`);
    const nodes = ids.map((id) => `  - id: ${id}\n    label: ${id} のとても長い名前`).join('\n');
    const edges = ids
      .slice(1)
      .map((id, i) => `  - from: ${ids[i]}\n    to: ${id}`)
      .join('\n');
    const out = await inspect(`version: 1\nnodes:\n${nodes}\nedges:\n${edges}\n`);
    assert.equal(out.tooSmallToProject, true, `比 ${out.textRatio}`);
  });

  it('読めない図では判定しない', async () => {
    const out = await inspect('version: 2\nnodes: []\n');
    assert.equal(out.readable, false);
    assert.equal(out.tooSmallToProject, false);
    assert.equal(out.textRatio, null);
  });
});

/**
 * **いちばん小さい字は、その図に実際に出る字。**
 *
 * 2026-09-13。見本の SVG を数えたら、**10px の字が出ていた**（符号・寸法・方位）。
 * `projection` は 11 を決め打ちしていたので、**投影の比を 1 割ぶん甘く報告していた。**
 *
 * 測るものを間違えている門は、**通っていることの意味が無い。**
 */
describe('いちばん小さい字は、図ごとに違う', () => {
  it('**符号（tag）があれば 10**（構成図でも符号は 10px で描かれる）', async () => {
    const out = await inspect(`version: 1
nodes:
  - id: a
    label: 機器
    tag: FW-01
  - id: b
    label: 相手
`);
    assert.equal(out.smallestText, 10, '符号の 10px を数えていない');
  });

  it('**符号も副題も辺のラベルも無ければ、名前の大きさ**', async () => {
    const out = await inspect('version: 1\nnodes:\n  - id: a\n    label: 甲\n  - id: b\n    label: 乙\n');
    assert.equal(out.smallestText, 15);
  });

  it('副題があれば、構成図は 11', async () => {
    const out = await inspect(`version: 1
nodes:
  - id: a
    label: 機器
    technology: 1Gbps
  - id: b
    label: 相手
`);
    assert.equal(out.smallestText, 11);
  });

  it('**配置図の副題は 10**（名前より小さい）', async () => {
    const out = await inspect(`version: 1
kind: placement
nodes:
  - id: a
    label: 事務室
    technology: 12 席
    at: { x: 0, y: 0 }
    size: { w: 200, h: 120 }
`);
    assert.equal(out.smallestText, 10);
  });

  it('**寸法を引いた図は 10**（寸法値と通り芯の符号）', async () => {
    const out = await inspect(`version: 1
kind: placement
scale: { mm: 25 }
grid:
  x:
    - { id: X1, at: 0 }
    - { id: X2, at: 300 }
nodes:
  - id: a
    label: 部屋
    at: { x: 0, y: 0 }
    size: { w: 300, h: 200 }
`);
    assert.equal(out.smallestText, 10);
  });

  it('比は、その図の字で割る', async () => {
    const out = await inspect(`version: 1
nodes:
  - id: a
    label: 機器
    tag: FW-01
  - id: b
    label: 相手
`);
    assert.equal(out.textRatio, out.smallestText / out.longestSide);
  });
});
