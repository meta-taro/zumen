/**
 * **日本語と英語のページが、離れていかないこと**（2026-09-16）。
 *
 * OSS を世界へ出すので、入口を日本語だけにしない。
 * ただし **2 枚になった瞬間、片方だけ直った状態**が生まれる。
 * 見た目と動きは 1 か所（`site/style.css` / `site/page.js`）に寄せたので、
 * ここで見るのは**残りの食い違い** —— 行き先と、互いへの入口。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ja = readFileSync('site/index.html', 'utf8');
const en = readFileSync('site/en/index.html', 'utf8');

describe('DL ページ', () => {
  it('**互いへの入口がある**（片道にしない）', () => {
    assert.match(ja, /href="en\/"/, '日本語から英語へ行けない');
    assert.match(en, /href="\.\.\/"/, '英語から日本語へ戻れない');
  });

  it('**検索する機械にも言う**（hreflang）', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      assert.match(page, /hreflang="ja"/, `${name} に ja の宣言が無い`);
      assert.match(page, /hreflang="en"/, `${name} に en の宣言が無い`);
      assert.match(page, /hreflang="x-default"/, `${name} に既定の宣言が無い`);
    }
  });

  it('**見た目と動きは 1 か所**（2 枚に書かない）', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      assert.ok(!/<style>/.test(page), `${name} にページ専用の見た目がある`);
      assert.ok(!/<script>[\s\S]*\S/.test(page), `${name} にページ専用の動きがある`);
      assert.match(page, /style\.css/, `${name} が共通の見た目を読んでいない`);
      assert.match(page, /page\.js/, `${name} が共通の動きを読んでいない`);
    }
  });

  it('**行き先が揃っている**（配布物・入れ方・GitHub）', () => {
    for (const link of [
      'https://github.com/meta-taro/zumen/releases',
      'https://github.com/meta-taro/zumen/blob/develop/docs/install.md',
      'https://github.com/meta-taro/zumen',
    ]) {
      assert.ok(ja.includes(link), `日本語のページに ${link} が無い`);
      assert.ok(en.includes(link), `英語のページに ${link} が無い`);
    }
  });

  it('**育っていくところを、どちらにも置く**', () => {
    assert.match(ja, /timelapse-ja\.svg/);
    assert.match(en, /timelapse-en\.svg/);
  });

  /**
   * **英語のページに、日本語ラベルの図を出さない**（2026-09-16）。
   *
   * 見出しの図は「この道具が何を作るか」を最初に答えるもの。
   * そこに読めない言語の語が並ぶと、**答えていないのと同じ**。
   */
  it('**見出しの図が、そのページの言語で書かれている**', async () => {
    const { existsSync } = await import('node:fs');
    assert.match(en, /hero-en\.svg/, '英語のページが英語の図を出していない');
    for (const file of ['site/hero-en.svg', 'site/hero-en-dark.svg']) {
      assert.ok(existsSync(file), `${file} が無い（参照だけ足してある）`);
    }
    // **見るのは見出しの図だけ。** 一覧には日本語の図が 151 枚並ぶ（それは中身）。
    const hero = /<figure class="hero">[\s\S]*?<\/figure>/.exec(en)?.[0] ?? '';
    assert.ok(hero.includes('hero-en.svg'), '見出しが英語の図になっていない');
    assert.ok(!/gallery\//.test(hero), '見出しに一覧の図を使っている');
  });

  it('言語の宣言が正しい', () => {
    assert.match(ja, /<html lang="ja">/);
    assert.match(en, /<html lang="en">/);
  });
});
