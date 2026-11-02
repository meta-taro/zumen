/**
 * VS Code の拡張（`packages/zumen-vscode`）のうち、VS Code を立てずに確かめられる所。
 *
 * 拡張の入口（`extension.ts`）は `vscode` を読むのでここでは呼ばない。
 * **入口を薄く保ち、判断はここで試せる側に置く。**
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { claudeCodeCommand, launcher, shellQuote } from '../packages/zumen-vscode/src/agents.ts';
import { draw, failure, themeOf } from '../packages/zumen-vscode/src/draw.ts';
import { escapeHtml, isZumenFence, placeholder, zumenFence, type FenceRule, type FenceToken } from '../packages/zumen-vscode/src/fence.ts';
import { nonce, page } from '../packages/zumen-vscode/src/page.ts';
import { collectZumenBlocks } from '../src/embed.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

function fakeMarkdownIt(): { renderer: { rules: { fence?: FenceRule } } } {
  return { renderer: { rules: { fence: (tokens, index) => `<pre>${tokens[index]!.content}</pre>` } } };
}

function renderFence(token: FenceToken): string {
  const md = zumenFence(fakeMarkdownIt());
  return md.renderer.rules.fence!([token], 0, {}, {}, { renderToken: () => '' });
}

describe('VS Code: Markdown の囲み', () => {
  it('zumen の囲みだけを置き場にし、ほかの囲みは元の描き方に任せる', () => {
    assert.match(renderFence({ info: 'zumen', content: 'title: a\n' }), /class="zumen-block"/);
    assert.equal(renderFence({ info: 'yaml', content: 'a: 1\n' }), '<pre>a: 1\n</pre>');
  });

  it('囲みの言語は src/embed.ts と同じ規則（ちょうど zumen のときだけ）', () => {
    for (const info of ['zumen', ' zumen ', 'zumen title', 'Zumen', 'zumen-x', '']) {
      const embed = collectZumenBlocks('```' + info + '\nx: 1\n```\n').length === 1;
      assert.equal(isZumenFence(info), embed, `info=${JSON.stringify(info)}`);
    }
  });

  it('元の描き方が無くても落ちない（renderToken に任せる）', () => {
    const md = zumenFence<{ renderer: { rules: { fence?: FenceRule } } }>({ renderer: { rules: {} } });
    const out = md.renderer.rules.fence!([{ info: 'js', content: '' }], 0, {}, {}, { renderToken: () => 'TOKEN' });
    assert.equal(out, 'TOKEN');
  });

  it('置き場は、描けるまで指定をそのまま見せる。指定の文字は HTML として読ませない', () => {
    const html = placeholder('title: "<script>alert(1)</script>"\n');
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /<pre><code>title: &quot;&lt;script&gt;/);
    assert.match(html, /data-zumen="title: &quot;&lt;script&gt;/);
  });

  it('escapeHtml は 5 文字を替える', () => {
    assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('VS Code: 描く', () => {
  it('正本 1 枚を SVG にする', async () => {
    const drawn = await draw(R0, 'light');
    assert.equal(drawn.ok, true);
    if (drawn.ok) assert.match(drawn.svg, /^<svg\b/);
  });

  it('描けなければ、理由を返す（黙って空にしない）', async () => {
    const drawn = await draw('nodes: [', 'light');
    assert.equal(drawn.ok, false);
    if (!drawn.ok) assert.notEqual(drawn.message, '');
  });

  it('理由の欄は、理由の文字を HTML として読ませない', () => {
    assert.equal(failure('<b>x</b>'), '<div class="zumen-error" role="alert">zumen: &lt;b&gt;x&lt;/b&gt;</div>');
  });

  it('VS Code の暗い色の決まり（ハイコントラストも）は暗い地で描く', () => {
    assert.equal(themeOf(['vscode-light']), 'light');
    assert.equal(themeOf(['vscode-dark']), 'dark');
    assert.equal(themeOf(['vscode-high-contrast']), 'dark');
    assert.equal(themeOf(['vscode-high-contrast-light']), 'light');
    assert.equal(themeOf([]), 'light');
  });
});

describe('VS Code: プレビューの枠', () => {
  it('台本は nonce の付いた 1 本だけを許し、外からは何も読まない', () => {
    const html = page({ script: 'vscode-resource:/dist/preview.js', cspSource: 'vscode-resource:', nonce: 'N0NCE' });
    assert.match(html, /default-src 'none'/);
    assert.match(html, /script-src 'nonce-N0NCE'/);
    assert.doesNotMatch(html, /script-src[^;"]*unsafe/);
    assert.equal(html.match(/<script\b/g)?.length, 1);
    assert.match(html, /<script nonce="N0NCE" src="vscode-resource:\/dist\/preview.js">/);
  });

  it('nonce は 32 文字の英数字', () => {
    assert.match(nonce(), /^[A-Za-z0-9]{32}$/);
    assert.notEqual(nonce(), nonce());
  });
});

describe('VS Code: 拡張の名乗り', () => {
  const manifest = JSON.parse(readFileSync(new URL('../packages/zumen-vscode/package.json', import.meta.url), 'utf8'));

  it('Markdown プレビューへの差し込みと、束ねた台本の置き場が揃っている', () => {
    assert.equal(manifest.contributes['markdown.markdownItPlugins'], true);
    assert.deepEqual(manifest.contributes['markdown.previewScripts'], ['./dist/markdown.js']);
    assert.equal(manifest.main, './dist/extension.js');
    const build = readFileSync(new URL('../scripts/vscode-build.mjs', import.meta.url), 'utf8');
    for (const file of ['extension.js', 'preview.js', 'markdown.js']) assert.match(build, new RegExp(`'${file}'`));
  });

  it('Copilot へ名乗る口が、名乗りと入口で同じ名前', () => {
    assert.deepEqual(manifest.contributes.mcpServerDefinitionProviders, [{ id: 'zumen.mcp', label: 'zumen' }]);
    const entry = readFileSync(new URL('../packages/zumen-vscode/src/extension.ts', import.meta.url), 'utf8');
    assert.match(entry, /const MCP_PROVIDER = 'zumen\.mcp';/);
  });

  it('Marketplace に出す形がそろっている（アイコン・権利・変更の記録）', () => {
    const dir = new URL('../packages/zumen-vscode/', import.meta.url);
    for (const file of [manifest.icon, 'LICENSE', 'README.md', 'CHANGELOG.md']) {
      assert.ok(existsSync(new URL(file, dir)), `${file} が無い`);
    }
    assert.equal(manifest.license, 'MIT');
  });

  it('配る包みに元のコードを入れない', () => {
    const ignore = readFileSync(new URL('../packages/zumen-vscode/.vscodeignore', import.meta.url), 'utf8');
    assert.match(ignore, /^src\/\*\*$/m);
    assert.match(ignore, /^\*\*\/\*\.ts$/m);
  });
});

describe('VS Code: エージェントへつなぐ', () => {
  it('起動用のファイルは、VS Code の実行環境を Node として動かす（使う人に Node を入れてもらわない）', () => {
    const made = launcher('/Applications/Visual Studio Code.app/Contents/MacOS/Code Helper', '/ext/server/dist/mcp.js', 'darwin');
    assert.equal(made.name, 'zumen-mcp');
    assert.match(made.body, /^#!\/bin\/sh\n/);
    assert.match(made.body, /ELECTRON_RUN_AS_NODE=1 exec '\/Applications\/Visual Studio Code\.app\/Contents\/MacOS\/Code Helper' '\/ext\/server\/dist\/mcp\.js' "\$@"/);
  });

  it('Windows では .cmd にする', () => {
    const made = launcher('C:\\VS Code\\Code.exe', 'C:\\ext\\mcp.js', 'win32');
    assert.equal(made.name, 'zumen-mcp.cmd');
    assert.equal(made.body, '@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"C:\\VS Code\\Code.exe" "C:\\ext\\mcp.js" %*\r\n');
  });

  it('Claude Code へ登録する 1 行は、利用者の範囲（user）で、道を引用符で包む', () => {
    assert.equal(claudeCodeCommand("/home/a b/zumen-mcp", 'linux'), "claude mcp add --scope user zumen -- '/home/a b/zumen-mcp'");
    assert.equal(claudeCodeCommand('C:\\x\\zumen-mcp.cmd', 'win32'), 'claude mcp add --scope user zumen -- "C:\\x\\zumen-mcp.cmd"');
  });

  it('単一引用符を含む道でも、シェルに割られない', () => {
    assert.equal(shellQuote("it's"), "'it'\\''s'");
  });

  it('拡張は Enter を押さない（人の設定を書き換える 1 行は、人が打つ）', () => {
    const entry = readFileSync(new URL('../packages/zumen-vscode/src/extension.ts', import.meta.url), 'utf8');
    assert.match(entry, /terminal\.sendText\(claudeCodeCommand\([^)]*\), false\)/);
  });
});

describe('VS Code: 保存', async () => {
  const { PNG_SCALE, pngBytes, saveName, svgSize } = await import('../packages/zumen-vscode/src/save.ts');

  it('保存の名前は正本の名前を引き継ぐ', () => {
    assert.equal(saveName('bunden.zumen.yaml', 'svg'), 'bunden.svg');
    assert.equal(saveName('plot.zumen.yml', 'png'), 'plot.png');
    assert.equal(saveName('note.yaml', 'svg'), 'note.svg');
    assert.equal(saveName('.zumen.yaml', 'png'), 'diagram.png');
  });

  it('PNG は data URL の中身だけを受ける', () => {
    assert.deepEqual(Array.from(pngBytes('data:image/png;base64,AQID')!), [1, 2, 3]);
    assert.equal(pngBytes('data:text/html;base64,AQID'), null);
    assert.equal(pngBytes('AQID'), null);
  });

  it('PNG の大きさは viewBox から読み、2 倍で作る', async () => {
    assert.deepEqual(svgSize('<svg viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg"></svg>'), { width: 640, height: 480 });
    assert.equal(svgSize('<svg width="10"></svg>'), null);
    assert.equal(svgSize('<svg viewBox="0 0 0 10"></svg>'), null);
    assert.equal(PNG_SCALE, 2);
    const drawn = await draw(R0, 'light');
    assert.ok(drawn.ok && svgSize(drawn.svg) !== null, '実際に描いた図から大きさが読める');
  });

  it('保存のボタンが枠にある', () => {
    const html = page({ script: 's', cspSource: 'c', nonce: 'n' });
    assert.match(html, /id="save-svg"/);
    assert.match(html, /id="save-png"/);
  });
});
