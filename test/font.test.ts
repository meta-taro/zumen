/**
 * **書体を図に埋め込む**（2026-09-28。書き出すときだけ）。
 *
 * 図の字は、開いた端末の `sans-serif` で描かれていた。訓練で iPad、災害時に Android で開くと
 * 同じ図が違う字面で出る（地図ライブラリと組み合わせたときに見つけた）。書き出すときだけ、
 * **その図で使っている字だけを切り出した Noto Sans JP** を SVG の中へ入れる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { embedFont, EMBEDDED_FAMILY } from '../src/font.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { exportAs } from '../src/tools.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

async function svgOf(text: string): Promise<string> {
  return render(await layout(text), 'light', 'safe', false);
}

describe('書体を埋め込む', () => {
  it('**文字は文字のまま**で、書体だけが SVG の中に入る', async () => {
    const svg = await svgOf(R0);
    const out = await embedFont(svg);
    assert.match(out, /@font-face\{font-family:"zumen-embed";src:url\(data:font\/woff2;base64,/);
    // 選べる・探せる・読み上げられる —— 線の形に変えていない
    assert.equal((out.match(/<text\b/g) ?? []).length, (svg.match(/<text\b/g) ?? []).length);
  });

  it('字を描くところは、埋め込んだ書体を先に探す（無ければ今までどおり）', async () => {
    const out = await embedFont(await svgOf(R0));
    assert.doesNotMatch(out, /font-family="sans-serif"/);
    assert.match(out, new RegExp(`font-family="${EMBEDDED_FAMILY}, sans-serif"`));
  });

  it('**その図で使う字だけ**を入れる —— 書体まるごと（4MB）にはしない', async () => {
    const svg = await svgOf(R0);
    const out = await embedFont(svg);
    assert.ok(out.length - svg.length < 200_000, `増えた分 ${out.length - svg.length} 字`);
  });

  it('使う字が変われば、入る書体も変わる', async () => {
    const svgWith = (words: string) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="40"><text x="0" y="20" font-family="sans-serif">${words}</text></svg>`;
    const a = await embedFont(svgWith('受付'));
    const b = await embedFont(svgWith('避難場所と避難所・鬱'));
    assert.notEqual(a.match(/base64,([^)]+)\)/)?.[1], b.match(/base64,([^)]+)\)/)?.[1]);
  });

  it('字が 1 つも無い図には、何も入れない', async () => {
    const bare = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    assert.equal(await embedFont(bare), bare);
  });

  it('MCP の書き出し（`exportAs`）も、**`embedFont: true` のときだけ**入れる', async () => {
    assert.doesNotMatch(await exportAs(R0, 'svg'), /@font-face/);
    assert.match(await exportAs(R0, 'svg', { embedFont: true }), /@font-face\{font-family:"zumen-embed"/);
  });
});
