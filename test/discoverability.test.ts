/**
 * **見つけてもらうための名乗り**（AEO / GEO。`docs/aeo/README.md`。2026-10-10）。
 *
 * 製品名を知らない人が「AI が直せる構成図」「diagram as code」「Claude Code で使える作図」と聞いたとき、
 * 検索エンジンと AI が最初に読む短い欄に、その語が入っているか。
 * 2026-10-10 に見たら、npm の説明は日本語だけで「Phase 0」のまま、keywords は無かった。
 *
 * **ここで見るのは、置き場所ごとに同じことを同じ語で言っているか**（語を盛らない）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  description: string;
  keywords?: string[];
  homepage?: string;
};

/** どの名乗りにも入れる語（英語）。 */
const CORE = [/diagrams? as code/i, /\bMCP\b/, /Claude Code/, /\bYAML\b/, /Mermaid/, /draw\.io/];

describe('npm の名乗り', () => {
  it('**説明は英語で、核の語が入っている**（古い「Phase 0」を残さない）', () => {
    assert.ok(!/Phase 0|計測段階/.test(pkg.description), pkg.description);
    for (const word of CORE) assert.match(pkg.description, word);
  });

  it('**keywords がある**（diagram-as-code・mcp・claude-code を含む）', () => {
    for (const word of ['diagram-as-code', 'mcp', 'claude-code']) assert.ok(pkg.keywords?.includes(word), word);
  });

  it('**homepage は紹介ページ**', () => {
    assert.equal(pkg.homepage, 'https://meta-taro.github.io/zumen/');
  });
});

describe('紹介ページと llms.txt の名乗り', () => {
  const descOf = (file: string) => /<meta name="description" content="([^"]*)"/.exec(readFileSync(file, 'utf8'))?.[1] ?? '';

  it('**英語の紹介ページの description に核の語**', () => {
    const desc = descOf('site/en/index.html');
    for (const word of CORE) assert.match(desc, word);
  });

  it('**日本語の紹介ページの description にも、検索される英語の語**（diagram as code・MCP・Claude Code）', () => {
    const desc = descOf('site/index.html');
    for (const word of [/diagram as code/, /\bMCP\b/, /Claude Code/]) assert.match(desc, word);
  });

  it('**構造化データに keywords がある**（日英）', () => {
    for (const file of ['site/index.html', 'site/en/index.html']) {
      assert.match(readFileSync(file, 'utf8'), /"keywords": "diagram as code,/, file);
    }
  });

  it('**llms.txt の最初の段落に核の語**', () => {
    const lead = readFileSync('site/llms.txt', 'utf8').split('\n').filter((l) => l.startsWith('>')).join(' ');
    for (const word of CORE) assert.match(lead, word);
  });
});
