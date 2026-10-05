/**
 * **書いた面積と帖数を、箱の大きさと照らす**（`src/area.ts`）。
 *
 * 2026-10-04。手で書いた面積が図と食い違っていた（帖の四捨五入、別の部屋の値）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { areaIssues } from '../src/area.ts';
import { validate } from '../src/validate.ts';

// 1px = 20mm。200 × 220px ＝ 4.0m × 4.4m ＝ 17.60㎡
const room = (text: string, extra: object = {}) => ({ id: 'r', text, x: 0, y: 0, w: 200, h: 220, drawn: true, ...extra });

describe('書いた面積と帖数（areaIssues）', () => {
  it('**面積が箱の大きさと合っていなければ拾う**', () => {
    assert.equal(areaIssues([room('寝室 15.00㎡')], 20).length, 1);
    assert.equal(areaIssues([room('寝室 17.60㎡')], 20).length, 0);
  });

  it('**帖は 1.62㎡ で割って切り捨て。四捨五入した値は拾う**', () => {
    // 17.60 ÷ 1.62 ＝ 10.86… → 10.8 帖まで
    assert.equal(areaIssues([room('寝室 10.9帖')], 20).length, 1);
    assert.equal(areaIssues([room('寝室 10.8帖')], 20).length, 0);
  });

  it('**中に入れ子にした収納は引く**（寝室の中の WIC）', () => {
    const wic = { id: 'w', text: 'WIC', x: 10, y: 10, w: 60, h: 70, drawn: true };
    // 17.60 − 1.68 ＝ 15.92㎡
    assert.equal(areaIssues([room('寝室 15.92㎡'), wic], 20).length, 0);
  });

  it('**文字だけの節・「含む」「合計」の面積は見ない**', () => {
    assert.equal(areaIssues([room('寝室 15.00㎡', { drawn: false })], 20).length, 0);
    assert.equal(areaIssues([room('LDK 30.0㎡（K 含む）')], 20).length, 0);
  });

  it('**validate が area-text-mismatch として知らせる**', () => {
    const text =
      'version: 1\nkind: placement\nscale: { mm: 20 }\nnodes:\n' +
      '  - id: r\n    label: 寝室\n    technology: 10.9帖\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 220 }\n';
    assert.ok(validate(text).some((f) => f.code === 'area-text-mismatch'));
  });
});
