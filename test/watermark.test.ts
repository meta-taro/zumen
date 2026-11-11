/**
 * **透かし**（`src/watermark.ts`）。
 *
 * 2026-11-11。公的な様式を写した見本は、罫線が原本と重ねてぴったり合う。刷ればそのまま出せてしまうので、
 * 「見本 SAMPLE」と、いつ時点の写しかを図そのものに入れる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parse } from 'yaml';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';
import { watermarkOf } from '../src/watermark.ts';

const doc = (mark: string, paper = ''): string =>
  `version: 1\nkind: placement\n${paper}${mark}nodes:\n  - id: a\n    label: 部屋\n    at: { x: 0, y: 0 }\n    size: { w: 300, h: 200 }\n`;

const NOTE = '2026-11-10 時点の様式を写したもの。公式の様式ではありません';

describe('透かし（watermark）', () => {
  it('**字だけでも、{ text, note } でも読める。** 読めなければ null', () => {
    assert.deepEqual(watermarkOf('見本 SAMPLE'), { text: '見本 SAMPLE', note: null });
    assert.deepEqual(watermarkOf({ text: '見本', note: NOTE }), { text: '見本', note: NOTE });
    assert.equal(watermarkOf({ note: NOTE }), null);
    assert.equal(watermarkOf(['見本']), null);
    assert.equal(watermarkOf(''), null);
  });

  it('**図の上に、斜めに重ねて描く**（下に敷くと箱の塗りで消える）。時点の 1 行も添える', async () => {
    const svg = render(await layout(doc(`watermark: { text: 見本 SAMPLE, note: "${NOTE}" }\n`)), 'light', 'safe', true);
    const at = svg.indexOf('data-name="watermark"');
    assert.ok(at > 0);
    assert.ok(at > svg.indexOf('>部屋<'), '透かしは箱より後（上）に描く');
    assert.match(svg, /<g data-name="watermark"[^>]*transform="rotate\(-[\d.]+ /);
    assert.match(svg, />見本 SAMPLE<\/text>/);
    assert.ok(svg.includes(`>${NOTE}</text>`));
  });

  it('**紙を決めた図は、紙の真ん中を対角に沿って横切る**', async () => {
    const svg = render(await layout(doc('watermark: 見本 SAMPLE\n', 'paper: { size: A4, orient: landscape, margin: 0 }\n')), 'light', 'safe', true);
    const view = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg)!.slice(1).map(Number);
    const [, angle, cx, cy] = /data-name="watermark"[^>]*rotate\(([-\d.]+) ([\d.]+) ([\d.]+)\)/.exec(svg)!.map(Number);
    assert.ok(Math.abs(cx! - (view[0]! + view[2]! / 2)) < 1);
    assert.ok(Math.abs(cy! - (view[1]! + view[3]! / 2)) < 1);
    // A4 横の対角（210 / 297）
    assert.ok(Math.abs(angle! + Math.atan2(210, 297) * 180 / Math.PI) < 0.2);
  });

  it('**書かなければ出力は 1 字も変わらない**', async () => {
    const svg = render(await layout(doc('')), 'light', 'safe', true);
    assert.ok(!svg.includes('watermark'));
  });

  it('**読めなければ、また時点の 1 行が無ければ知らせる**', () => {
    const codes = (mark: string): string[] => validate(doc(mark)).map((f) => f.code).filter((c) => c.startsWith('watermark'));
    assert.deepEqual(codes('watermark: [見本]\n'), ['watermark-invalid']);
    assert.deepEqual(codes('watermark: 見本 SAMPLE\n'), ['watermark-note-missing']);
    assert.deepEqual(codes(`watermark: { text: 見本 SAMPLE, note: "${NOTE}" }\n`), []);
  });

  it('**公的な様式を写した見本には、「見本 SAMPLE」と時点の 1 行がある**', () => {
    for (const name of ['418-履歴書', '421-婚姻届', '422-出生届']) {
      const mark = watermarkOf((validateDoc(name)));
      assert.ok(mark !== null, `${name} に透かしが無い`);
      assert.equal(mark.text, '見本 SAMPLE', name);
      assert.match(mark.note ?? '', /\d{4}-\d{2}-\d{2} 時点/, `${name} の note に時点が無い`);
      assert.match(mark.note ?? '', /公式の様式ではありません/, name);
    }
  });
});

/** 見本の正本から `watermark` の値だけを読む。 */
function validateDoc(name: string): unknown {
  const text = readFileSync(new URL(`../examples/gallery/${name}.zumen.yaml`, import.meta.url), 'utf8');
  return (parse(text) as { watermark?: unknown }).watermark ?? null;
}
