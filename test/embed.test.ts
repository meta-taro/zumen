/**
 * Markdown への埋め込み（Issue 012 / D4 の着地点）。
 *
 * md-business を触る前に、**こちら側だけで囲み → 描画を通す**。
 * 囲みの拾い方は md-business の `fencedBlocks.ts` と同じ規則にしてあるので、
 * そこで守られている場面をこちらでも同じように試す。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  collectZumenBlocks,
  renderZumenBlocks,
  replaceZumenBlocks,
  toSvg,
  withExplicitSize,
} from '../src/embed.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

function doc(body: string, lang = 'zumen'): string {
  return ['# 設計書', '', '本文です。', '', '```' + lang, body, '```', '', 'あとがき。'].join('\n');
}

describe('囲みを拾う', () => {
  it('zumen の囲みだけを拾う', () => {
    const source = [doc('version: 1'), doc('flowchart TD', 'mermaid')].join('\n\n');
    const blocks = collectZumenBlocks(source);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.body, 'version: 1');
  });

  it('囲みの中の囲みは中身ではなく見本として扱う', () => {
    // 書き方の説明として ```zumen を載せた文書で、説明文が図として描かれては困る。
    const source = ['````markdown', '```zumen', 'version: 1', '```', '````'].join('\n');
    assert.deepEqual(collectZumenBlocks(source), []);
  });

  it('同じ囲みが 2 か所にあっても 1 回だけ拾う', () => {
    const source = [doc('version: 1'), doc('version: 1')].join('\n\n');
    assert.equal(collectZumenBlocks(source).length, 1);
  });

  it('~ の囲みも拾う', () => {
    assert.equal(collectZumenBlocks('~~~zumen\nversion: 1\n~~~').length, 1);
  });

  it('言語名の後ろに空白があっても拾う', () => {
    assert.equal(collectZumenBlocks('```zumen  \nversion: 1\n```').length, 1);
  });

  it('閉じられていない囲みでも、そこまでを中身として拾う', () => {
    // 打っている途中の本文で、拾えずに消えるより中途半端でも拾うほうがよい。
    const blocks = collectZumenBlocks('```zumen\nversion: 1');
    assert.equal(blocks.length, 1);
  });
});

describe('差し替え', () => {
  it('渡した囲みだけを置き換え、他の本文は動かさない', () => {
    const source = doc('version: 1');
    const out = replaceZumenBlocks(source, new Map([['```zumen\nversion: 1\n```', 'X']]));
    assert.match(out, /本文です。\n\nX\n\nあとがき。/);
  });

  it('渡されなかった囲みはそのまま残す', () => {
    const source = doc('version: 1');
    assert.equal(replaceZumenBlocks(source, new Map()), source);
  });
});

describe('描いて差し替える', () => {
  it('図が画像の記法になる', async () => {
    const rendered = await renderZumenBlocks(doc(R0));
    const replacement = [...rendered.values()][0] ?? '';
    assert.match(replacement, /^!\[本番構成\]\(data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+\)$/);
  });

  it('差し替えた本文に、囲みが残らない', async () => {
    const source = doc(R0);
    const out = replaceZumenBlocks(source, await renderZumenBlocks(source));
    assert.doesNotMatch(out, /```zumen/);
    assert.match(out, /^# 設計書/);
    assert.match(out, /あとがき。$/);
  });

  it('中身が空の囲みは触らない', async () => {
    assert.equal((await renderZumenBlocks(doc('   '))).size, 0);
  });

  it('描けなかったときは、理由をその位置に出し、書いた指定も残す', async () => {
    // 黙って空にすると、書いた人は「描けている」と思ったまま気づかない。
    const broken = 'version: 1\nnodes:\n  - id: a\n   bad indent';
    const rendered = await renderZumenBlocks(doc(broken), {
      describe: (message) => `図を描けませんでした（${message}）`,
    });
    const replacement = [...rendered.values()][0] ?? '';
    assert.match(replacement, /^> 図を描けませんでした（/);
    assert.match(replacement, /```zumen\n[\s\S]*bad indent/);
  });
});

describe('toSvg', () => {
  it('図 1 枚を SVG にする', async () => {
    const svg = await toSvg(R0);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /data-node="db"/);
  });
});

describe('withExplicitSize', () => {
  it('viewBox の値を実寸として書き入れる', () => {
    const out = withExplicitSize('<svg viewBox="0 0 800 600" width="100%"><g/></svg>');
    assert.match(out, /^<svg width="800" height="600" viewBox="0 0 800 600"/);
    assert.doesNotMatch(out, /width="100%"/);
  });

  it('viewBox が無ければそのまま返す', () => {
    const svg = '<svg><g/></svg>';
    assert.equal(withExplicitSize(svg), svg);
  });
});

describe('examples/ の文書', () => {
  it('実物の設計書サンプルが、そのまま図に差し替わる', async () => {
    // 例が腐らないように、テストから実物を通す。
    const source = readFileSync(
      new URL('../examples/設計書サンプル.md', import.meta.url),
      'utf8',
    );
    const rendered = await renderZumenBlocks(source);
    assert.equal(rendered.size, 1);

    const out = replaceZumenBlocks(source, rendered);
    assert.doesNotMatch(out, /```zumen/);
    assert.match(out, /!\[本番構成\]\(data:image\/svg\+xml;base64,/);
    // 本文は動かない。
    assert.match(out, /^---\ntitle: 本番環境 構成図つき設計書\n---/);
    assert.match(out, /## この図の直し方/);
  });

  it('人が置いた位置が、埋め込んだ図にも効いている', async () => {
    const source = readFileSync(
      new URL('../examples/設計書サンプル.md', import.meta.url),
      'utf8',
    );
    const block = collectZumenBlocks(source)[0]!;
    const svg = await toSvg(block.body);
    assert.match(svg, /data-node="db"[^>]*data-pinned="true"/);
    assert.match(svg, /<rect x="620" y="410"/);
  });
});
