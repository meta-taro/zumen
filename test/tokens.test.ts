/**
 * 図の色が 1 か所から出ていること（`DESIGN.md` §3 / §5）。
 *
 * 以前は `render.ts` / `mermaid.ts` / `drawio.ts` の 3 か所に同じ色が書いてあり、
 * 「同じ値にしておく」というコメントが添えてあった。**それはズレる。**
 *
 * ここで見張るのは 2 つ。
 *
 * 1. **書き出しに色が直書きされていない**こと
 * 2. **3 つの書き出しが同じ色を出している**こと
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { toDrawio } from '../src/drawio.ts';
import { parse, serialize, setPin } from '../src/format.ts';
import { layout } from '../src/layout.ts';
import { toMermaid } from '../src/mermaid.ts';
import { render } from '../src/render.ts';
import { APPEARANCE, GROUP, NODE, TOKEN } from '../src/tokens.ts';

const SRC = new URL('../src/', import.meta.url).pathname;
const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

/** `primary` を付けた版。3 つの書き出しに同じ色が出るはず。 */
function withPrimary(): string {
  const doc = parse(R0);
  setPin(doc, 'db', { appearance: 'primary' });
  return serialize(doc);
}

describe('色が直書きされていない', () => {
  for (const name of ['render.ts', 'mermaid.ts', 'drawio.ts']) {
    it(`${name} に 16 進の色が無い`, () => {
      const code = readFileSync(`${SRC}${name}`, 'utf8');
      const found = code.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
      assert.deepEqual(found, [], `src/tokens.ts へ移すこと: ${found.join(', ')}`);
    });
  }

  it('tokens.ts にはある（見張りが空回りしていない）', () => {
    const code = readFileSync(`${SRC}tokens.ts`, 'utf8');
    assert.ok((code.match(/#[0-9a-fA-F]{6}\b/g) ?? []).length >= 5);
  });
});

describe('3 つの書き出しが同じ色を出す', () => {
  it('primary の地と枠が一致する', async () => {
    const text = withPrimary();
    const look = APPEARANCE['primary']!;
    const svg = render(await layout(text));
    const mermaid = toMermaid(text);
    const drawio = toDrawio(await layout(text));

    for (const [name, out] of [['svg', svg], ['mermaid', mermaid], ['drawio', drawio]] as const) {
      assert.ok(out.includes(look.fill), `${name} に地の色が無い`);
      assert.ok(out.includes(look.stroke), `${name} に枠の色が無い`);
    }
  });

  it('囲みの色が svg と drawio で一致する', async () => {
    const placed = await layout(R0);
    for (const out of [render(placed), toDrawio(placed)]) {
      assert.ok(out.includes(GROUP.fill));
      assert.ok(out.includes(GROUP.stroke));
    }
  });
});

describe('姉妹アプリのトークンへ揃っている（DESIGN.md）', () => {
  it('アクセントが姉妹の値', () => {
    // md-business/apps/desktop/src/lib/styles/tokens.css の --accent（ライト）。
    assert.equal(TOKEN.accent, '#5b5bd6');
    assert.equal(TOKEN.accentSubtle, '#eeeefb');
  });

  it('既定のノードは地が bg-app、枠は**地から最も遠いインク**', () => {
    assert.equal(NODE.fill, TOKEN.bgApp);
    // **`border-strong` ではない**（`DESIGN.md` §8）。
    // あれはヘアライン用で、地に対して 1.47:1 しかなく、箱が見えなかった。
    assert.equal(NODE.stroke, TOKEN.textPrimary);
    assert.notEqual(NODE.stroke, TOKEN.borderStrong);
  });

  it('知らない体裁の語は既定へ落ちる（捨てずに保つ。仕様 §9）', async () => {
    const doc = parse(R0);
    setPin(doc, 'db', { appearance: '派手' });
    const svg = render(await layout(serialize(doc)));
    assert.ok(svg.includes(NODE.fill));
  });
});
