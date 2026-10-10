/**
 * **節のリンク**（`nodes[].link`。`src/link.ts`）。
 *
 * 図を Markdown に埋めたとき、箱から本文の節・別の図・外の文書へ飛ぶ。
 * **開いた人の手元で何かを実行させる口にしない**（javascript: ・ data: は通さない）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { linkOf } from '../src/link.ts';
import { toMermaid } from '../src/mermaid.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';

const SRC = (link: string) => `version: 1
nodes:
  - id: db
    label: 注文 DB
    link: "${link}"
  - id: api
    label: 注文 API
edges:
  - from: api
    to: db
`;

describe('通すリンク', () => {
  it('**http(s)・mailto・相対パス・見出しは通す**', () => {
    for (const ok of ['https://example.com/a', 'http://x.test', 'mailto:a@example.com', './db.zumen.yaml', '#在庫', 'docs/x.md']) {
      assert.equal(linkOf(ok), ok, ok);
    }
  });

  it('**javascript: ・ data: ・ file: は通さない**', () => {
    for (const bad of ['javascript:alert(1)', 'JavaScript:void(0)', 'data:text/html,x', 'file:///etc/passwd', '']) {
      assert.equal(linkOf(bad), null, bad);
    }
  });
});

describe('描く', () => {
  it('**SVG で、箱と名前が <a href> に包まれる**', async () => {
    const svg = render(await layout(SRC('./db.zumen.yaml')), 'light', 'safe', false);
    const anchors = svg.match(/<a href="\.\/db\.zumen\.yaml">/g) ?? [];
    assert.ok(anchors.length >= 2, `形と名前の両方: ${anchors.length}`);
    assert.ok(/<a href="\.\/db\.zumen\.yaml"><g data-node="db"/.test(svg));
  });

  it('**通さないリンクは描かず、validate が知らせる**', async () => {
    const svg = render(await layout(SRC('javascript:alert(1)')), 'light', 'safe', false);
    assert.ok(!svg.includes('<a '));
    assert.ok(validate(SRC('javascript:alert(1)')).some((f) => f.code === 'node-link-invalid'));
  });

  it('**効くリンクには何も言わない**', () => {
    assert.ok(!validate(SRC('https://example.com')).some((f) => f.code === 'node-link-invalid'));
  });

  it('**Mermaid には click で写す**', () => {
    assert.match(toMermaid(SRC('https://example.com/db')), /click db href "https:\/\/example\.com\/db"/);
  });

  it('**URL の記号は逃がす**（図が壊れない）', async () => {
    const svg = render(await layout(SRC('https://example.com/?a=1&b=2')), 'light', 'safe', false);
    assert.ok(svg.includes('href="https://example.com/?a=1&amp;b=2"'));
  });
});
