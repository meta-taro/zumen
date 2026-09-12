/**
 * **向きの無い線**（`arrows: false`）と、**箱に入らない文字**。
 *
 * どちらも路線図を描こうとして出てきた（2026-09-12。人の発案）。
 *
 * ## 線に向きが無い図がある
 *
 * | 図 | 線の意味 | 向き |
 * |---|---|---|
 * | 構成図・業務フロー | 流れ・依存 | ある |
 * | 避難経路・補充動線 | 人や物の動き | ある |
 * | **路線図** | **繋がっていること** | **無い** |
 *
 * 路線図に矢印を付けると「西ヶ丘から桜台へ行く線」という片道の意味が出る。
 * 実際は両方向に走っていて、図が言いたいのは「繋がっている」だけ。
 *
 * ## 入らない文字は、落とさずに外へ出す
 *
 * 以前はここで**落としていた**（伏図の小梁に文字がはみ出したのを止めるため）。
 * **落とすのは行き過ぎだった** —— 駅の印は小さいので、駅名が 1 つ残らず消えた。
 * 実物の図面も、狭い部屋の名前は箱の外に書く。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arrowsOf } from '../src/arrows.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const LINE = `version: 1
kind: placement
arrows: false
nodes:
  - id: a
    label: 西ヶ丘
    tag: H01
    at: { x: 0, y: 100 }
    size: { w: 96, h: 30 }
  - id: b
    label: 桜台
    tag: H02
    at: { x: 200, y: 100 }
    size: { w: 96, h: 30 }
edges:
  - from: a
    to: b
`;

async function svg(text: string): Promise<string> {
  return render(await layout(text), 'light', 'safe', true);
}

describe('向きの無い線', () => {
  it('書かなければ矢印は出る（これまでどおり）', () => {
    assert.equal(arrowsOf(undefined), true);
    assert.equal(arrowsOf(true), true);
  });

  it('`arrows: false` のときだけ消す', () => {
    assert.equal(arrowsOf(false), false);
    assert.equal(arrowsOf('false'), true, '文字列で消えてはいけない');
  });

  it('**矢印の頭が出ない**', async () => {
    assert.ok(!(await svg(LINE)).includes('marker-end'), '向きが無いのに矢印が出ている');
  });

  it('線そのものは出る（繋がっていることが図の内容）', async () => {
    assert.match(await svg(LINE), /data-edge=/);
  });

  it('**向きの無い線は箱の下に敷く。** 上に描くと駅の印を串刺しにする', async () => {
    const out = await svg(LINE);
    assert.ok(out.indexOf('data-edge=') < out.indexOf('data-node='), '線が駅の上に出ている');
  });

  it('向きがあるときは、これまでどおり箱の上（避難経路）', async () => {
    const out = await svg(LINE.replace('arrows: false\n', ''));
    assert.ok(out.lastIndexOf('data-edge=') > out.lastIndexOf('data-node='));
    assert.ok(out.includes('marker-end'));
  });
});

describe('箱に入らない文字は、外へ出す', () => {
  it('**駅名が消えない**（高さ 30px の印でも出る）', async () => {
    const out = await svg(LINE);
    assert.ok(out.includes('>西ヶ丘<'), '駅名が落ちた');
    assert.ok(out.includes('>桜台<'));
  });

  it('外へ出すのは箱の下', async () => {
    const placed = await layout(LINE);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>西ヶ丘</)![1]);
    assert.ok(y > box.y + box.h, '文字が箱の外へ出ていない');
  });

  it('**符号は箱の中に残る。** 拾い読みするものなので', async () => {
    const placed = await layout(LINE);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>H01</)![1]);
    assert.ok(y < box.y + box.h, '符号まで外へ出た');
  });

  it('副題も一緒に外へ出る（名前だけ外、副題は中、にしない）', async () => {
    const out = await svg(LINE.replace('    tag: H01\n', '    tag: H01\n    technology: 3 線乗換\n'));
    assert.ok(out.includes('>3 線乗換<'));
  });

  it('入る箱では、これまでどおり中に書く', async () => {
    const placed = await layout(LINE.replace('size: { w: 96, h: 30 }', 'size: { w: 200, h: 80 }'));
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>西ヶ丘</)![1]);
    assert.ok(y < box.y + box.h, '入るのに外へ出た');
  });

  it('**構成図では、これまでどおり中に書く**（箱は文字から決まるので必ず入る）', async () => {
    const out = render(
      await layout('version: 1\nnodes:\n  - id: a\n    label: あ\n'),
      'light',
      'safe',
      false,
    );
    assert.equal(out.match(/<text /g)!.length, 1);
  });
});
