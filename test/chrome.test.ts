/**
 * Chrome 拡張（`packages/zumen-chrome`）のうち、ブラウザを立てずに確かめられる所。
 *
 * ページを触る入口（`content.ts`）は `chrome` と DOM を読むのでここでは呼ばない。
 * **入口を薄く保ち、判断はここで試せる側に置く。**
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { drawHtml } from '../packages/zumen-chrome/src/draw.ts';
import { FENCE_SELECTOR, escapeHtml, isZumenBlobPath, themeOf } from '../packages/zumen-chrome/src/github.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../packages/zumen-chrome/manifest.json', import.meta.url), 'utf8'));

describe('Chrome: どのページに正本があるか', () => {
  it('*.zumen.yaml のファイル表示だけを拾う（ref や階層は問わない）', () => {
    assert.equal(isZumenBlobPath('/meta-taro/zumen/blob/develop/test/fixtures/r0.zumen.yaml'), true);
    assert.equal(isZumenBlobPath('/a/b/blob/feature/x/y/z.zumen.yml'), true);
    assert.equal(isZumenBlobPath('/a/b/blob/main/README.md'), false);
    assert.equal(isZumenBlobPath('/a/b/tree/main/x.zumen.yaml'), false, 'フォルダの一覧は描かない');
    assert.equal(isZumenBlobPath('/a/b/blob/main/x.zumen.yaml.bak'), false);
  });

  it('Markdown の囲みは lang="zumen" の pre（GitHub の実物で確かめた形）', () => {
    assert.equal(FENCE_SELECTOR, 'pre[lang="zumen"]');
  });
});

describe('Chrome: 図の地', () => {
  it('GitHub の色の決まりに従い、auto は OS に従う', () => {
    assert.equal(themeOf('dark', false), 'dark');
    assert.equal(themeOf('light', true), 'light');
    assert.equal(themeOf('auto', true), 'dark');
    assert.equal(themeOf('auto', false), 'light');
    assert.equal(themeOf(undefined, false), 'light');
  });
});

describe('Chrome: 描く', () => {
  it('正本を SVG にする', async () => {
    assert.match(await drawHtml(R0, 'light'), /^<svg/);
  });

  it('描けなければ理由を出し、正本の文字はそのまま逃がす（HTML として読ませない）', async () => {
    const html = await drawHtml('nodes: [<script>', 'light');
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /<script>/);
    assert.match(await drawHtml('  ', 'dark'), /zumen: empty/);
  });

  it('escapeHtml は属性の引用符も逃がす', () => {
    assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
  });
});

describe('Chrome: manifest', () => {
  /** 権限を広げると、ストアの審査も使う人の信頼も重くなる。広げるなら、ここを直す理由を書くこと。 */
  it('動くのは github.com だけで、余計な権限を持たない', () => {
    assert.equal(manifest.manifest_version, 3);
    assert.deepEqual(manifest.content_scripts.map((c: { matches: string[] }) => c.matches).flat(), ['https://github.com/*']);
    assert.equal(manifest.permissions, undefined);
    assert.equal(manifest.host_permissions, undefined);
  });

  /**
   * **案内に置いた「試す」の先が、リポジトリに実在する。** 見本を改名するとリンクだけ切れる
   * （参照だけ残って中身が無い、と同じ壊れ方。ベースルール §23）。
   */
  it('ポップアップの「試す」のリンク先が、リポジトリにある', () => {
    const popup = readFileSync(new URL('../packages/zumen-chrome/popup.html', import.meta.url), 'utf8');
    const paths = [...popup.matchAll(/href="https:\/\/github\.com\/meta-taro\/zumen\/blob\/main\/([^"]+)"/g)].map((m) => decodeURIComponent(m[1]!));
    assert.ok(paths.length >= 3, '試せる実物を置く');
    for (const path of paths) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} が無い`);
    assert.equal(manifest.action.default_popup, 'popup.html');
  });

  it('版は package.json と揃っている', () => {
    const pkg = JSON.parse(readFileSync(new URL('../packages/zumen-chrome/package.json', import.meta.url), 'utf8'));
    assert.equal(manifest.version, pkg.version);
  });
});
