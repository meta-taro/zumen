/**
 * **辺の線種**（`edges[].line`）。
 *
 * 一点鎖線（`chain`）を足した理由（2026-09-19。見本 191 の光軸で当たった）。
 *
 * 製図では、**中心線・対称軸・光軸・基準線・切断線は一点鎖線**と決まっている。
 * 実線でも破線でもない —— **線種そのものが「これは実体ではなく基準だ」と言っている。**
 *
 * 描く側からはこれが引けなかった。**通り芯（`grid`）だけが一点鎖線を持っていて、
 * 人が引く線には無かった** —— 光軸を `dotted` で代用すると、
 * 点線は「見えない輪郭」の意味を持つので、読む側には別の意味に見える。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LINES, dashOf, lineOf, patternPeriod } from '../src/line.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';
import { placedFindings } from '../src/cli.ts';

const AXIS = `version: 1
kind: placement
arrows: true
nodes:
  - id: a
    label: ""
    marker: none
    at: { x: 40, y: 100 }
    size: { w: 2, h: 2 }
  - id: b
    label: ""
    marker: none
    at: { x: 400, y: 100 }
    size: { w: 2, h: 2 }
edges:
  - from: a
    to: b
    line: chain
    ends: { from: none, to: none }
`;

describe('線種を読む', () => {
  it('**一点鎖線がある**（中心線・光軸・基準線）', () => {
    assert.ok(LINES.includes('chain'), `線種が ${LINES.join(' / ')} しかない`);
  });

  it('知らない語は実線に倒す', () => {
    assert.equal(lineOf('dash-dot'), 'solid');
    assert.equal(lineOf(undefined), 'solid');
  });

  it('**一点鎖線は、破線とも点線とも違う刻み**', () => {
    const chain = dashOf('chain');
    assert.ok(chain !== null, '一点鎖線に刻みが無い');
    assert.notEqual(chain, dashOf('dashed'));
    assert.notEqual(chain, dashOf('dotted'));
    // 長い線と短い線が交互 —— これが「一点鎖線」の形。
    assert.match(chain, /^\d+ \d+ \d+ \d+$/);
  });

  it('実線には刻みが無い', () => {
    assert.equal(dashOf('solid'), null);
  });
});

describe('線種を描く', () => {
  it('**一点鎖線が絵に出る**', async () => {
    const out = render(await layout(AXIS), 'light', 'safe', true);
    assert.match(out, new RegExp(`stroke-dasharray="${dashOf('chain')}"`));
  });

  it('**通り芯と同じ刻み**（1 枚の紙で基準線の見た目が割れない）', async () => {
    const GRID = AXIS.replace(
      'edges:',
      `grid:
  x:
    - { id: X1, at: 40 }
    - { id: X2, at: 400 }
scale: { mm: 10 }
edges:`,
    );
    const out = render(await layout(GRID), 'light', 'safe', true);
    const found = [...out.matchAll(/stroke-dasharray="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(found.filter((d) => d === dashOf('chain')).length >= 2, `刻みが揃っていない: ${found.join(' / ')}`);
  });
});

describe('知らせる', () => {
  it('知らない線種を警告する', () => {
    const found = validate(AXIS.replace('line: chain', 'line: dash-dot'));
    assert.ok(found.some((f) => f.code === 'line-unknown'), JSON.stringify(found.map((f) => f.code)));
  });

  it('**警告の文に、使える線種がぜんぶ出る**（当てずっぽうを繰り返させない）', () => {
    const said = validate(AXIS.replace('line: chain', 'line: dash-dot')).find(
      (f) => f.code === 'line-unknown',
    )!.message;
    for (const word of LINES) assert.ok(said.includes(word), `${word} が出ていない: ${said}`);
  });
});

/**
 * **刻みが 1 回も出そろわない線**（2026-09-20）。
 *
 * 線種そのものが意味なので、**実線に見えた時点で意味が消える。**
 * 見本 262（木工の組み手）を描いたあとに測ったら、**見本 2 枚が実際にそうだった** ——
 * 見本 200 の 7px の破線と、見本 238 の 16px の一点鎖線。どちらも直した。
 */
describe('短すぎて刻みが出ない線', () => {
  const two = (line: string, x2: number): string =>
    'version: 1\nkind: placement\nnodes:\n' +
    '  - id: a\n    label: ""\n    marker: none\n    at: { x: 0, y: 0 }\n    size: { w: 2, h: 2 }\n' +
    `  - id: b\n    label: ""\n    marker: none\n    at: { x: ${x2}, y: 0 }\n    size: { w: 2, h: 2 }\n` +
    `edges:\n  - from: a\n    to: b\n    line: ${line}\n    ends: { from: none, to: none }\n`;

  it('刻みが 1 周する長さを数える', () => {
    assert.equal(patternPeriod('dashed'), 11);
    assert.equal(patternPeriod('dotted'), 5);
    assert.equal(patternPeriod('chain'), 23);
    assert.equal(patternPeriod('solid'), 0, '実線に刻みは無い');
    assert.equal(patternPeriod('double'), 0);
  });

  it('**一点鎖線が短すぎると名指しする**', async () => {
    const found = await placedFindings(two('chain', 16));
    const said = found.filter((f) => f.code === 'line-too-short');
    assert.equal(said.length, 1, found.map((f) => f.code).join(','));
    assert.match(said[0]!.message, /23px/);
  });

  it('1 周ぶん引いてあれば言わない', async () => {
    const found = await placedFindings(two('chain', 200));
    assert.ok(!found.some((f) => f.code === 'line-too-short'));
  });

  it('実線には言わない（刻みが無いので、短くても嘘にならない）', async () => {
    const found = await placedFindings(two('solid', 6));
    assert.ok(!found.some((f) => f.code === 'line-too-short'));
  });

  it('**破線のほうが早く出そろう**（7 4 なので 11px）', async () => {
    assert.ok((await placedFindings(two('dashed', 9))).some((f) => f.code === 'line-too-short'));
    assert.ok(!(await placedFindings(two('dashed', 60))).some((f) => f.code === 'line-too-short'));
  });
});
