/**
 * **図が育つところを、1 本の絵にする**（2026-09-16）。
 *
 * ## なぜ足すか
 *
 * 「外形 → 部屋 → 建具 → 寸法」と積み上がる様子は、**図そのものより雄弁**で、
 * 人に渡すときにいちばん効く。ところがそれを作るのに、
 * **画面録画が要った** —— 画面の前に人が座っていないと作れない。
 * リモートのときに作れない機能は、無いのと同じ。
 *
 * ## 依存を増やさない
 *
 * 動画の符号化器は入れない（ベースルール §1・§12）。
 * 出すのは **1 枚の動く SVG** と、**同じ大きさに揃えた連番の SVG**。
 * mp4 が要る人には、**手元の道具で作る手順を文字で返す。**
 *
 * ## 揃えるのが肝
 *
 * 段ごとに紙の大きさが変わるので、**いちばん大きい紙に全部を揃える。**
 * 揃えないと、絵が段のたびに跳ねる（手で作ったときに踏んだ）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { timelapse } from '../src/timelapse.ts';

const SMALL = `version: 1
kind: placement
nodes:
  - id: a
    label: 外形
    at: { x: 0, y: 0 }
    size: { w: 100, h: 60 }
`;
const BIG = `version: 1
kind: placement
nodes:
  - id: a
    label: 外形
    at: { x: 0, y: 0 }
    size: { w: 100, h: 60 }
  - id: b
    label: 増えた部屋
    at: { x: 0, y: 80 }
    size: { w: 300, h: 60 }
`;

describe('タイムラプス', () => {
  it('**段の数だけ絵を返す**', async () => {
    const out = await timelapse([SMALL, BIG]);
    assert.equal(out.frames.length, 2);
  });

  it('**紙の大きさを揃える**（揃えないと段のたびに絵が跳ねる）', async () => {
    const out = await timelapse([SMALL, BIG]);
    const sizes = out.frames.map((f) => /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(f)?.[0]);
    assert.equal(sizes[0], sizes[1], '1 段目と 2 段目で紙が違う');
    assert.equal(out.width > 300, true);
  });

  it('**動く SVG を 1 枚返す**（依存を増やさずに配れる形）', async () => {
    const out = await timelapse([SMALL, BIG]);
    assert.match(out.svg, /<svg/);
    assert.match(out.svg, /@keyframes/, '動かす仕掛けが無い');
    assert.match(out.svg, /data-step="1"/);
    assert.match(out.svg, /data-step="2"/);
  });

  it('段ごとの長さを言える', async () => {
    const out = await timelapse([SMALL, BIG], { hold: 3 });
    assert.equal(out.seconds, 6);
    assert.match(out.svg, /6s/);
  });

  it('**読めない段があれば、そこで止めて言う**（黙って飛ばさない）', async () => {
    // **読めない**＝ YAML として壊れている段（`kind` の綴り違いは zumen が寛容に読む）。
    await assert.rejects(() => timelapse([SMALL, 'version: 1\nnodes: [\n']), /2/);
  });

  it('1 段では作らない（それは図であってタイムラプスではない）', async () => {
    await assert.rejects(() => timelapse([SMALL]));
  });

  it('**mp4 の作り方を文字で返す**（符号化器は同梱しない）', async () => {
    const out = await timelapse([SMALL, BIG], { out: '/tmp/zl' });
    assert.match(out.recipe, /ffmpeg/);
    assert.match(out.recipe, /\/tmp\/zl/);
  });
});
