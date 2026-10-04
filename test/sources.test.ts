/**
 * **出典を図そのものに出す**（`src/sources.ts`）。
 *
 * 2026-10-04。出典を正本のコメントにしか書いておらず、SVG だけを貼ると出典が消えていた。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';

const doc = (sources: string): string =>
  `version: 1\nkind: placement\n${sources}nodes:\n  - id: a\n    label: 部屋\n    at: { x: 0, y: 0 }\n    size: { w: 300, h: 200 }\n`;

describe('出典（sources）', () => {
  it('**図の下端に 1 件 1 行で描き、URL があればリンクにする**', async () => {
    const svg = render(
      await layout(doc('sources:\n  - { name: 気象庁「テスト」, url: https://www.jma.go.jp/, retrieved: 2026-09-29 }\n')),
      'light',
      'safe',
      true,
    );
    assert.match(svg, /<a href="https:\/\/www\.jma\.go\.jp\/"><text[^>]*>出典：気象庁「テスト」（2026-09-29 取得）<\/text><\/a>/);
  });

  it('**出典の行のぶん、紙が下へ伸びる**（図の箱と重ならない）', async () => {
    const plain = render(await layout(doc('')), 'light', 'safe', true);
    const credited = render(await layout(doc('sources:\n  - { name: 内閣府, retrieved: 2026-09-29 }\n')), 'light', 'safe', true);
    const h = (svg: string): number => Number(svg.match(/height="([\d.]+)"/)![1]);
    assert.ok(h(credited) > h(plain));
  });

  it('**名前と取得日が無ければ知らせる**', () => {
    const codes = validate(doc('sources:\n  - { name: 気象庁 }\n  - { url: https://x.example }\n')).map((f) => f.code);
    assert.ok(codes.includes('source-date-missing'));
    assert.ok(codes.includes('source-name-missing'));
    assert.deepEqual(
      validate(doc('sources:\n  - { name: 気象庁, retrieved: 2026-09-29 }\n')).filter((f) => f.code.startsWith('source')),
      [],
    );
  });
});
