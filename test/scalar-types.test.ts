/**
 * 数字で書かれた値（Issue #5）。
 *
 * **報告された壊れ方をそのまま置く。**
 *
 * > `technology` に引用符なしの数字を書くと、
 * > **`validate` は通るのに `svg` の書き出しが例外で止まります。**
 * >
 * > TypeError: label is not iterable
 *
 * ## 弾かずに受ける
 *
 * > 数字は数字として書けるのが自然なので、弾くより受けるほうがよい
 *
 * 構成図にポート番号や台数を書くのは自然。**そこで落ちるのは道具側の落ち度。**
 *
 * ## 本体は「検証を通ったのに描画で落ちる」ほう
 *
 * > **`validate` がこれを通したことのほうが気になります。**
 * > 「検証を通ったのに描画で落ちる」は、検証への信頼が下がる形です。
 *
 * そのとおりで、値を受けるだけにすると**同じ形が別の型でまた出る。**
 * だから、**検証を通った図は必ず描ける**ことを機械で確かめる（下の最後の describe）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { toSvg } from '../src/embed.ts';
import { exportAs, inspect } from '../src/tools.ts';
import { hasError, validate } from '../src/validate.ts';

/** 報告された再現、そのまま。 */
const REPORTED = [
  'version: 1',
  'title: 検証',
  '',
  'nodes:',
  '  - id: sshd',
  '    type: server',
  '    label: sshd',
  '    technology: 22',
  '  - id: httpd',
  '    type: server',
  '    label: Apache httpd',
  '    technology: "80 / 443"',
  '',
  'edges:',
  '  - from: httpd',
  '    to: sshd',
  '',
].join('\n');

describe('数字で書かれた technology', () => {
  it('検証は通る（いままでどおり）', () => {
    assert.equal(hasError(validate(REPORTED)), false);
  });

  it('**描画も通る**（報告では例外で止まっていた）', async () => {
    const svg = await toSvg(REPORTED);
    assert.match(svg, /^<svg/);
  });

  it('数字がそのまま絵に出る（黙って消さない）', async () => {
    const svg = await toSvg(REPORTED);
    assert.ok(svg.includes('>22</text>'), '22 が描かれていない');
    assert.ok(svg.includes('>80 / 443</text>'), '引用符付きのほうも描かれていない');
  });

  it('引用符の有無で見た目が変わらない', async () => {
    const quoted = REPORTED.replace('technology: 22', 'technology: "22"');
    assert.equal(await toSvg(REPORTED), await toSvg(quoted));
  });
});

describe('label / title / group も同じ', () => {
  it('数字の label で落ちない', async () => {
    const svg = await toSvg('version: 1\nnodes:\n  - id: year\n    label: 2026\n');
    assert.match(svg, /^<svg/);
    assert.ok(svg.includes('>2026</text>'));
  });

  it('真偽値の label でも落ちない（YAML は `on` を真として読む）', async () => {
    const svg = await toSvg('version: 1\nnodes:\n  - id: flag\n    label: true\n');
    assert.match(svg, /^<svg/);
  });

  it('数字の囲みのラベルで落ちない', async () => {
    const source =
      'version: 1\ngroups:\n  - id: g\n    label: 2026\nnodes:\n  - id: a\n    group: g\n';
    assert.ok((await toSvg(source)).includes('>2026</text>'));
  });

  it('数字の辺のラベルで落ちない', async () => {
    const source =
      'version: 1\nnodes:\n  - id: a\n  - id: b\nedges:\n  - from: a\n    to: b\n    label: 443\n';
    assert.ok((await toSvg(source)).includes('>443</text>'));
  });

  it('数字の id でも落ちない', async () => {
    const source = 'version: 1\nnodes:\n  - id: 22\n  - id: 80\nedges:\n  - from: 22\n    to: 80\n';
    assert.match(await toSvg(source), /^<svg/);
  });
});

describe('`pins` の中でも同じ（人が数字を書く場所）', () => {
  it('数字の `pins.label` で落ちない', async () => {
    const svg = await toSvg('version: 1\npins:\n  a:\n    label: 8080\nnodes:\n  - id: a\n');
    assert.ok(svg.includes('>8080</text>'));
  });

  it('数字の `pins.appearance` で落ちない（知らない語として既定へ落ちる）', async () => {
    const svg = await toSvg('version: 1\npins:\n  a:\n    appearance: 1\nnodes:\n  - id: a\n');
    assert.match(svg, /^<svg/);
  });

  it('数字の `pins` の鍵（要素の id）で落ちない', async () => {
    const source = 'version: 1\npins:\n  22:\n    label: sshd\nnodes:\n  - id: 22\n';
    assert.ok((await toSvg(source)).includes('>sshd</text>'));
  });
});

/**
 * **検証と描画が同じ判断をしていること。**
 *
 * ここが本体。値を 1 種類ずつ受けて回っても、**別の型でまた同じ形が出る。**
 * 「検証を通った図は必ず描ける」を機械で確かめれば、次の型は増えない。
 */
describe('**検証を通った図は、必ず描ける**', () => {
  /** 図として意味のある場所すべてに、素の値を差し込んだもの。 */
  const ODD_VALUES = ['22', '3.14', 'true', 'false', 'null', '2026-09-07', '0o17', '.inf'];

  for (const value of ODD_VALUES) {
    it(`\`${value}\` を label / technology / 囲み / 辺 に書いても、判断が割れない`, async () => {
      const source = [
        'version: 1',
        `title: ${value}`,
        'groups:',
        '  - id: g',
        `    label: ${value}`,
        'nodes:',
        '  - id: a',
        `    label: ${value}`,
        `    technology: ${value}`,
        '    group: g',
        '  - id: b',
        `    label: ${value}`,
        'edges:',
        '  - from: a',
        '    to: b',
        `    label: ${value}`,
        '',
      ].join('\n');

      const readable = !hasError(validate(source));
      let drawn = true;
      try {
        await layout(source);
      } catch {
        drawn = false;
      }
      // **「検証は通るのに描けない」を許さない。** 逆（描けるが検証は落とす）は許す
      // ＝ 検証のほうが厳しいのは構わない。
      assert.equal(readable && !drawn, false, `検証は通るのに描けない: ${value}`);
    });
  }

  for (const value of ODD_VALUES) {
    it(`\`${value}\` を pins に書いても、判断が割れない`, async () => {
      const source = [
        'version: 1',
        'pins:',
        '  a:',
        `    label: ${value}`,
        `    appearance: ${value}`,
        'nodes:',
        '  - id: a',
        '',
      ].join('\n');

      const readable = !hasError(validate(source));
      let drawn = true;
      try {
        await layout(source);
      } catch {
        drawn = false;
      }
      assert.equal(readable && !drawn, false, `検証は通るのに描けない: ${value}`);
    });
  }

  it('`zumen_inspect` も同じ図で落ちない（エージェントの口）', async () => {
    const out = await inspect(REPORTED);
    assert.equal(out.readable, true);
    assert.equal(out.nodes, 2);
  });

  /**
   * **書き出しは 3 つとも同じ判断をする。**
   *
   * SVG だけ直したら mermaid が落ちていた（実際にそうなった）。
   * **1 つずつ直して回ると、必ずどれかが取り残される。**
   */
  it('svg / mermaid / drawio のどれも、同じ図で落ちない', async () => {
    const source = [
      'version: 1',
      'title: 2026',
      'groups:',
      '  - id: g',
      '    label: 22',
      'nodes:',
      '  - id: 80',
      '    label: 8080',
      '    technology: 443',
      '    group: g',
      '  - id: b',
      '    label: true',
      'edges:',
      '  - from: 80',
      '    to: b',
      '    label: 3.14',
      '',
    ].join('\n');

    assert.equal(hasError(validate(source)), false, '検証が落ちている');
    for (const kind of ['svg', 'mermaid', 'drawio'] as const) {
      const out = await exportAs(source, kind);
      assert.ok(out.length > 0, `${kind} が空`);
    }
  });
});
