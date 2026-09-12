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

  it('**背が低いだけなら、中に書く。** 外へ出すのは最後の手段', async () => {
    // 高さ 30px でも、12px の文字は入る。
    // 以前は「高さ 34px 未満は外」としていたが、**行き過ぎだった** ——
    // 映画館の横通路（高さ 12px）の名前が、隣のブロックの上に落ちた。
    const placed = await layout(LINE);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>西ヶ丘</)![1]);
    assert.ok(y > box.y && y < box.y + box.h, '入るのに外へ出た');
  });

  it('横にも縦にも入らなければ、外へ出す', async () => {
    const narrow = LINE.replace('size: { w: 96, h: 30 }', 'size: { w: 30, h: 20 }');
    const placed = await layout(narrow);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>西ヶ丘</)![1]);
    assert.ok(y > box.y + box.h || y < box.y, '文字が箱の外へ出ていない');
  });

  it('**符号は箱の中に残る。** 拾い読みするものなので', async () => {
    const placed = await layout(LINE);
    const box = placed.boxes.find((b) => b.id === 'a')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>H01</)![1]);
    assert.ok(y < box.y + box.h, '符号まで外へ出た');
  });

  it('**背が低い箱では、名前と副題を 1 行に繋ぐ**（通路・農道はこれ）', async () => {
    const out = await svg(
      LINE.replace('    tag: H01\n', '    tag: H01\n    technology: 3 線乗換\n').replace(
        'size: { w: 96, h: 30 }',
        'size: { w: 160, h: 24 }',
      ),
    );
    assert.ok(out.includes('西ヶ丘　3 線乗換'), '1 行に繋がっていない');
  });

  it('1 行に繋いでも入らなければ、外へ出す（両方出す）', async () => {
    const out = await svg(
      LINE.replace('    tag: H01\n', '    tag: H01\n    technology: 特急・急行・準急がとまる\n'),
    );
    assert.ok(out.includes('>西ヶ丘<'));
    assert.ok(out.includes('>特急・急行・準急がとまる<'));
  });

  it('大きい箱では、これまでどおり中に書く', async () => {
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

describe('細い帯の名前は、帯に沿って縦に書く', () => {
  /**
   * 圃場整備の図で出た（2026-09-12）。
   * 用水路（幅 4m）・排水路・廊下は、名前が横には入らないが**縦には入る。**
   * 外へ出すと、隣の帯の名前と図の外で団子になる。
   */
  const STRIP = `version: 1
kind: placement
nodes:
  - id: u
    label: 用水路
    at: { x: 0, y: 0 }
    size: { w: 16, h: 500 }
  - id: f
    label: 1-1
    technology: 30a
    at: { x: 16, y: 0 }
    size: { w: 96, h: 500 }
`;

  it('**横に入らない細い帯は、回して中に書く**', async () => {
    const out = render(await layout(STRIP), 'light', 'safe', true);
    assert.match(out, /transform="rotate\(-90 [^)]*\)">用水路</, '用水路が縦書きになっていない');
  });

  it('**横に入るなら回さない。** 縦長でも幅が足りていれば横書き', async () => {
    const out = render(await layout(STRIP), 'light', 'safe', true);
    assert.ok(out.includes('>1-1<'), '区画名が消えた');
    assert.ok(!/transform="rotate\(-90 [^)]*\)">1-1</.test(out), '横に入るのに回した');
  });

  it('縦にも入らなければ、外へ出す（回して切れた文字を出さない）', async () => {
    const out = render(
      await layout(STRIP.replace('size: { w: 16, h: 500 }', 'size: { w: 16, h: 24 }')),
      'light',
      'safe',
      true,
    );
    assert.ok(out.includes('>用水路<'));
    assert.ok(!out.includes('rotate(-90'), '入らないのに回した');
  });

  it('**構成図では回さない**（箱は文字から決まるので必ず横に入る）', async () => {
    const out = render(await layout(STRIP.replace('kind: placement', '')), 'light', 'safe', false);
    assert.ok(!out.includes('rotate(-90'));
  });
});

describe('名前は入るが、副題が入らないとき', () => {
  /**
   * 駐車場の区画割で出た（2026-09-12）。
   * `W1` は 70px の区画に横で入るが、`車椅子 3,500` は入らない。
   * 以前は**名前まで縦書きになった。**
   * 実物の区画割図も、名前は横・幅の数値は区画に沿って縦に書いてある。
   */
  const STALL = `version: 1
kind: placement
nodes:
  - id: w1
    label: W1
    technology: 車椅子 3,500
    at: { x: 0, y: 0 }
    size: { w: 70, h: 100 }
`;

  it('**名前は横のまま**', async () => {
    const out = render(await layout(STALL), 'light', 'safe', true);
    assert.ok(!/rotate\(-90 [^)]*\)">W1</.test(out), '名前まで回した');
    assert.ok(out.includes('>W1<'));
  });

  it('**副題だけ回して添える**', async () => {
    const out = render(await layout(STALL), 'light', 'safe', true);
    assert.match(out, /rotate\(-90 [^)]*\)">車椅子 3,500</, '副題が回っていない');
  });

  it('副題が縦にも入らなければ、外へ出す', async () => {
    const out = render(
      await layout(STALL.replace('size: { w: 70, h: 100 }', 'size: { w: 70, h: 30 }')),
      'light',
      'safe',
      true,
    );
    assert.ok(out.includes('車椅子 3,500'), '副題が落ちた');
  });
});

describe('符号のある箱', () => {
  it('**符号と名前が重ならない**（車両編成図で重なった）', async () => {
    const src = `version: 1
kind: placement
nodes:
  - id: c
    label: モハ 100-1
    tag: 2 号車
    at: { x: 0, y: 0 }
    size: { w: 84, h: 58 }
`;
    const placed = await layout(src);
    const out = render(placed, 'light', 'safe', true);
    const tagY = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>2 号車</)![1]);
    const nameY = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>モハ 100-1</)![1]);
    assert.ok(nameY - tagY >= 10, `符号 ${tagY} と名前 ${nameY} が近すぎる`);
  });
});
