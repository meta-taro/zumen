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
 * ## **長辺で測る**
 *
 * 図は画面に収めるとき `min(画面幅/図幅, 画面高/図高)` で縮む。
 * **縮小率を決めるのは長いほうの辺**なので、短辺で測ると**縦長の図が素通りする。**
 *
 * こちらは当初、短辺で測ろうとしていた。報告者の指摘で直した。
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

describe('**長辺で測る**（短辺だと縦長の図が素通りする）', () => {
  it('横長の図は幅で測る', () => {
    assert.equal(projection(1000, 200).longestSide, 1000);
  });

  it('**縦長の図は高さで測る**', () => {
    assert.equal(projection(200, 1000).longestSide, 1000);
  });

  it('短辺で測っていたら通っていた図を、落とす', () => {
    // 短辺 200 なら 11/200 = 5.5% で楽々通る。長辺 1000 では 1.1% で落ちる。
    const got = projection(200, 1000);
    assert.equal(got.tooSmallToProject, true);
    assert.ok((got.textRatio ?? 1) < PROJECTION_FLOOR);
  });
});

describe('報告された実測値（回帰）', () => {
  // **下限を後から甘くして通す、をやらないため**に、実物の値をそのまま置く。
  const REPORTED = [
    { name: 'ネットワーク構成', w: 730, h: 840, ratio: 0.0131 },
    { name: 'カムスタ・ローコード構成', w: 832, h: 496, ratio: 0.0132 },
    { name: '全部入り（囲み 3 つ）', w: 1048, h: 1052, ratio: 0.0105 },
  ];

  for (const { name, w, h, ratio } of REPORTED) {
    it(`${name} — 比が ${(ratio * 100).toFixed(2)}% で、下限を割る`, () => {
      const got = projection(w, h);
      // 小数第 4 位まで一致すること（報告と同じ数え方をしている確認）。
      assert.equal(Math.round((got.textRatio ?? 0) * 10000) / 10000, ratio);
      assert.equal(got.tooSmallToProject, true);
    });
  }

  it('**いちばん大きい図がいちばん読めない**（報告者の指摘そのもの）', () => {
    const ratios = REPORTED.map(({ w, h }) => projection(w, h).textRatio ?? 0);
    const longest = REPORTED.map(({ w, h }) => Math.max(w, h));
    const worst = ratios.indexOf(Math.min(...ratios));
    assert.equal(longest[worst], Math.max(...longest));
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
    assert.equal(projection(side, 10).tooSmallToProject, false);
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
    assert.equal(out.smallestText, SMALLEST_TEXT);
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
