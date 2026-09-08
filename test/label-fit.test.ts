/**
 * 箱の幅をラベルから決める（Issue #3 の 2）。
 *
 * **報告された実害をそのまま置く。**
 *
 * > 幅が固定なので、日本語ラベルが箱をはみ出します。
 * > 左端のノードでは **x が負になり、文字が画面外へ切れました**。
 *
 * ```
 * /api/agent_optout（掲載停止）    → 左端で欠落（x < 0）
 * cron（doko001 / batch/twikit）  → 箱の外へはみ出し
 * /mnt/wasabi（doko001 / s3fs）   → 箱の外へはみ出し
 * ```
 *
 * ## 正確には測れない
 *
 * 字送りは書体で変わり、**書体は貼り先が決める**（Issue 007 §3.1）。
 * ここが狙うのは正確さではなく、**「入らないよりはまし」**。
 * だから余裕を持って測り、上限で止める（際限なく広げない）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { labelWidth, layout } from '../src/layout.ts';

/** 報告に出てきた実物。 */
const REPORTED = [
  '/api/agent_optout（掲載停止）',
  'cron（doko001 / batch/twikit）',
  '/mnt/wasabi（doko001 / s3fs）',
];

function diagram(labels: string[]): string {
  const nodes = labels.map((label, i) => `  - id: n${i}\n    label: ${JSON.stringify(label)}`);
  return `version: 1\nnodes:\n${nodes.join('\n')}\n`;
}

describe('ラベルの幅を測る', () => {
  it('全角は半角の 2 倍として数える', () => {
    assert.equal(labelWidth('ああ'), labelWidth('aaaa'));
  });

  it('半角カナは半角として数える', () => {
    assert.ok(labelWidth('ｱｲｳ') < labelWidth('アイウ'));
  });

  it('長いほど広い', () => {
    assert.ok(labelWidth('cli') < labelWidth('Load Balancer'));
  });

  it('空なら 0', () => {
    assert.equal(labelWidth(''), 0);
  });
});

describe('**報告されたラベルが箱に入る**（Issue #3 の 2）', () => {
  it('3 つとも、文字が箱に収まる', async () => {
    const placed = await layout(diagram(REPORTED));
    for (const box of placed.boxes) {
      const needed = labelWidth(box.label);
      assert.ok(needed <= box.w, `${box.label}: 文字 ${needed} > 箱 ${box.w}`);
    }
  });

  it('**x が負にならない**（画面外へ切れない）', async () => {
    const placed = await layout(diagram(REPORTED));
    for (const box of placed.boxes) {
      assert.ok(box.x >= 0, `${box.label} の x が ${box.x}`);
    }
  });

  it('図の幅が、いちばん広い箱を含む', async () => {
    const placed = await layout(diagram(REPORTED));
    for (const box of placed.boxes) {
      assert.ok(box.x + box.w <= placed.width, `${box.label} が図からはみ出した`);
    }
  });
});

describe('広げすぎない', () => {
  it('短いラベルでも、下限より狭くならない', async () => {
    const placed = await layout(diagram(['a']));
    assert.equal(placed.boxes[0]!.w, 160);
  });

  it('**際限なく広げない**（上限で止める）', async () => {
    const placed = await layout(diagram(['あ'.repeat(200)]));
    assert.ok(placed.boxes[0]!.w <= 320, `幅が ${placed.boxes[0]!.w}`);
  });

  it('人が大きさを決めていたら、そちらが勝つ', async () => {
    const text = `version: 1\npins:\n  n0:\n    size: { w: 500, h: 90 }\nnodes:\n  - id: n0\n    label: あ\n`;
    const placed = await layout(text);
    assert.equal(placed.boxes[0]!.w, 500);
  });

  it('人が書き換えたラベルの幅で測る', async () => {
    const text = `version: 1\npins:\n  n0:\n    label: とても長い名前に書き換えました\nnodes:\n  - id: n0\n    label: a\n`;
    const placed = await layout(text);
    assert.ok(placed.boxes[0]!.w > 160, `幅が ${placed.boxes[0]!.w}`);
  });
});

describe('technology を描く（Issue #3 の 4）', () => {
  // 形式にあって検証も通るのに、絵に出ていなかった。
  // **手本の図（examples/本番構成）でも出ていなかった。**
  // 所属や版を書ける唯一の場所なので、描かれないとラベルへ畳むしかなくなる。

  const WITH_TECH = [
    'version: 1',
    'nodes:',
    '  - id: web',
    '    type: server',
    '    label: Web 01',
    '    technology: Apache 2.4',
    '  - id: db',
    '    type: database',
    '    label: DB',
    '',
  ].join('\n');

  it('レイアウトまで運ばれる', async () => {
    const placed = await layout(WITH_TECH);
    assert.equal(placed.boxes.find((b) => b.id === 'web')!.technology, 'Apache 2.4');
    assert.equal(placed.boxes.find((b) => b.id === 'db')!.technology, null);
  });

  it('**SVG に出る**', async () => {
    const { render } = await import('../src/render.ts');
    const svg = render(await layout(WITH_TECH));
    assert.match(svg, /Apache 2\.4/);
  });

  it('副題があるぶん、箱を高くする（文字が重ならない）', async () => {
    // **同じ `type` どうしで比べる。** 形によって高さが変わるようになったので
    // （Issue #9。円柱は上下に余分が要る）、違う型と比べると意味が無い。
    const withTech = (await layout(WITH_TECH)).boxes.find((b) => b.id === 'web')!;
    const stripped = WITH_TECH.replace(/^\s*technology:.*$/gm, '');
    const without = (await layout(stripped)).boxes.find((b) => b.id === 'web')!;
    assert.ok(withTech.h > without.h, `${withTech.h} <= ${without.h}`);
  });

  it('副題が長ければ、箱を広げる', async () => {
    const long = WITH_TECH.replace('Apache 2.4', 'Apache 2.4 / mod_php / doko001');
    const placed = await layout(long);
    assert.ok(placed.boxes.find((b) => b.id === 'web')!.w > 160);
  });

  it('**手本の図で出る**（出ていなかったのが報告の中身）', async () => {
    const { render } = await import('../src/render.ts');
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../examples/本番構成.zumen.yaml', import.meta.url), 'utf8');
    assert.match(render(await layout(source)), /Apache/);
  });
});
