/**
 * Chrome 拡張（`packages/zumen-chrome`）のうち、ブラウザを立てずに確かめられる所。
 *
 * ページを触る入口（`content.ts`）は `chrome` と DOM を読むのでここでは呼ばない。
 * **入口を薄く保ち、判断はここで試せる側に置く。**
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { compareHtml, countsOf, drawHtml } from '../packages/zumen-chrome/src/draw.ts';
import {
  FENCE_SELECTOR,
  escapeHtml,
  isZumenBlobPath,
  isZumenFile,
  pathsOf,
  pullOf,
  rawUrl,
  revisionsOf,
  themeOf,
} from '../packages/zumen-chrome/src/github.ts';

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

describe('Chrome: PR の差分', () => {
  const A = 'a'.repeat(40);
  const B = 'b'.repeat(40);
  const C = 'c'.repeat(40);
  const embedded = (comparison: unknown) => JSON.stringify({ payload: { pullRequestsChangesRoute: { comparison } } });

  it('PR の差分の画面だけを拾う（/changes も古い /files も）', () => {
    assert.deepEqual(pullOf('/meta-taro/zumen/pull/22/changes'), { owner: 'meta-taro', repo: 'zumen', number: 22 });
    assert.deepEqual(pullOf('/a/b/pull/3/files'), { owner: 'a', repo: 'b', number: 3 });
    assert.equal(pullOf('/a/b/pull/3'), null, '会話の画面は描かない');
    assert.equal(pullOf('/a/b/pull/3/commits'), null);
  });

  it('いま出ている差分の 2 つの commit を読む（絞っていればそちら）', () => {
    assert.deepEqual(revisionsOf(embedded({ fullDiff: { baseOid: A, headOid: B }, selectedRange: null })), { base: A, head: B });
    assert.deepEqual(
      revisionsOf(embedded({ fullDiff: { baseOid: A, headOid: B }, selectedRange: { baseOid: C, headOid: B } })),
      { base: C, head: B },
    );
  });

  it('形が読めなければ描かない（違う commit で描くより、描かないほうがよい）', () => {
    assert.equal(revisionsOf('not json'), null);
    assert.equal(revisionsOf(embedded({ fullDiff: { baseOid: 'main', headOid: B } })), null);
    assert.equal(revisionsOf(JSON.stringify({ payload: {} })), null);
  });

  it('見出しの向きの印を外し、改名は前と後に分ける', () => {
    assert.deepEqual(pathsOf('\u200eexamples/a.zumen.yaml\u200e'), { before: 'examples/a.zumen.yaml', after: 'examples/a.zumen.yaml' });
    assert.deepEqual(pathsOf('\u200eold.zumen.yaml → new.zumen.yaml\u200e'), { before: 'old.zumen.yaml', after: 'new.zumen.yaml' });
    assert.equal(isZumenFile('x/y.zumen.yml'), true);
    assert.equal(isZumenFile('x/y.yaml'), false);
  });

  it('印の中身を字でも言う（多ければ頭の 5 つ）', () => {
    assert.equal(countsOf({ added: ['cdn', 'cache'], removed: [], kept: ['db'] }), '新 2（cdn, cache） ／ 消 0 ／ 人の直しが残った 1（db）');
    assert.match(countsOf({ added: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], removed: [], kept: [] }), /新 7（a, b, c, d, e ほか 2）/);
  });

  it('raw の URL は、日本語の名前を区切りごとに逃がす（/ は残す）', () => {
    assert.equal(rawUrl('o', 'r', A, 'examples/間取り.zumen.yaml'), `/o/r/raw/${A}/examples/%E9%96%93%E5%8F%96%E3%82%8A.zumen.yaml`);
  });

  it('変更前と変更後を並べ、数を添える。片方が無ければある方だけ', async () => {
    const after = R0.replace(/^nodes:\n/m, 'nodes:\n  - id: cdn\n    label: CDN\n');
    const both = await compareHtml(R0, after, 'light');
    assert.match(both, /新 1（cdn） ／ 消 0 ／/);
    assert.match(both, /<svg/);
    assert.match(await compareHtml(null, R0, 'light'), /新しく足された/);
    assert.match(await compareHtml(R0, null, 'dark'), /消された/);
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

  /** ウェブストアは 132 字を超える説明を受け付けない（2026-11-02、上げたときに断られた）。 */
  it('説明は 132 字まで', () => {
    assert.ok(manifest.description.length <= 132, `${manifest.description.length} 字`);
  });

  it('版は package.json と揃っている', () => {
    const pkg = JSON.parse(readFileSync(new URL('../packages/zumen-chrome/package.json', import.meta.url), 'utf8'));
    assert.equal(manifest.version, pkg.version);
  });
});
