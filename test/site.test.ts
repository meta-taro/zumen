/**
 * **日本語と英語のページが、離れていかないこと**（2026-09-16）。
 *
 * OSS を世界へ出すので、入口を日本語だけにしない。
 * ただし **2 枚になった瞬間、片方だけ直った状態**が生まれる。
 * 見た目と動きは 1 か所（`site/style.css` / `site/page.js`）に寄せたので、
 * ここで見るのは**残りの食い違い** —— 行き先と、互いへの入口。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

/**
 * **SNS に貼ったときに出るカード**（OGP / Twitter card。2026-09-17）。
 *
 * X へ出す直前に見たら、**どちらのページにも 1 つも入っていなかった。**
 * リンクだけが貼られ、**何の道具かは誰にも分からない**まま流れる。
 *
 * 絵は `pnpm og` が作る（`site/og.png` / `site/en/og.png`）。
 * ここで見るのは**書いてあるか**と、**絶対 URL になっているか** ——
 * 相対のままだと、取りに来た機械が絵を見つけられない。
 */
describe('SNS のカード', () => {
  const SITE = 'https://meta-taro.github.io/zumen/';

  it('**どちらのページにも入っている**', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      assert.match(page, /property="og:title"/, `${name} に og:title が無い`);
      assert.match(page, /property="og:description"/, `${name} に og:description が無い`);
      assert.match(page, /property="og:image"/, `${name} に og:image が無い`);
      assert.match(page, /property="og:url"/, `${name} に og:url が無い`);
      assert.match(page, /name="twitter:card" content="summary_large_image"/, `${name} に大きいカードの指定が無い`);
    }
  });

  it('**絵と行き先は絶対 URL**（相対だと機械が取りに来られない）', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      for (const key of ['og:image', 'og:url'] as const) {
        const said = new RegExp(`property="${key}" content="([^"]+)"`).exec(page);
        assert.ok(said !== null, `${name} に ${key} が無い`);
        assert.ok(said[1]!.startsWith(SITE), `${name} の ${key} が絶対 URL でない: ${said[1]}`);
      }
    }
  });

  it('**英語のページは英語のカードを出す**（言語も宣言する）', () => {
    assert.match(en, /og:image" content="[^"]*\/en\/og\.png"/);
    assert.match(ja, /og:image" content="[^"]*zumen\/og\.png"/);
    assert.match(ja, /property="og:locale" content="ja_JP"/);
    assert.match(en, /property="og:locale" content="en_US"/);
  });

  it('**絵が実際にある**（参照だけ足して置き忘れない。ベースルール §23）', () => {
    for (const path of ['site/og.png', 'site/en/og.png']) {
      const png = readFileSync(path);
      assert.equal(png.subarray(1, 4).toString(), 'PNG', `${path} が PNG でない`);
      // 1,200×630 を 2 倍で描く（`scripts/og.mjs`）。
      assert.equal(png.readUInt32BE(16), 2400, `${path} の幅が違う`);
      assert.equal(png.readUInt32BE(20), 1260, `${path} の高さが違う`);
    }
  });
});

/**
 * **探して見つかること、AI に読まれたときに正しく答えられること**（2026-09-17）。
 *
 * オーナーの「SEO / AIEO も意識して」から。見たのは 4 つ。
 *
 * | | |
 * |---|---|
 * | `canonical` | 同じ内容が 2 つの URL に見えないようにする |
 * | 構造化データ（JSON-LD）| 機械が「これは何か」を推測しないで済む |
 * | `llms.txt` | **AI 向けの短い正本**（できること・できないこと・行き先）|
 * | `sitemap.xml` | 2 枚しか無いが、言語の対応も併せて言う |
 *
 * **robots.txt は置けない。** GitHub Pages のプロジェクトページなので、
 * 読まれるのは `meta-taro.github.io/robots.txt`（別のリポジトリのもの）。
 * だからページ側に `<meta name="robots">` を書く。
 *
 * **数字はここで突き合わせる。** 枚数はカードの説明・JSON-LD・`llms.txt` の
 * 3 か所に出るので、`pnpm gallery` が全部を書き換える。
 */
describe('探して見つかること（SEO / AIEO）', () => {
  it('**canonical があり、og:url と同じ**', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      const canon = /<link rel="canonical" href="([^"]+)">/.exec(page);
      const url = /property="og:url" content="([^"]+)"/.exec(page);
      assert.ok(canon !== null, `${name} に canonical が無い`);
      assert.equal(canon[1], url?.[1], `${name} の canonical と og:url が食い違っている`);
    }
  });

  it('**機械に読ませてよいと書いてある**（robots.txt が置けないため）', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      assert.match(page, /<meta name="robots" content="index,follow/, `${name} に robots の指定が無い`);
    }
  });

  it('**構造化データが JSON として読め、ページと食い違っていない**', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page);
      assert.ok(block !== null, `${name} に JSON-LD が無い`);
      const data = JSON.parse(block[1]!) as { '@graph': { '@type': string; url: string; image?: string }[] };
      const app = data['@graph'].find((item) => item['@type'] === 'SoftwareApplication');
      assert.ok(app !== undefined, `${name} に SoftwareApplication が無い`);
      const canon = /<link rel="canonical" href="([^"]+)">/.exec(page)?.[1];
      assert.equal(app.url, canon, `${name} の JSON-LD の url が canonical と違う`);
      const image = /property="og:image" content="([^"]+)"/.exec(page)?.[1];
      assert.equal(app.image, image, `${name} の JSON-LD の絵が og:image と違う`);
    }
  });

  it('**llms.txt がある**（AI 向けの短い正本。行き先が揃っている）', () => {
    const llms = readFileSync('site/llms.txt', 'utf8');
    for (const must of [
      'https://github.com/meta-taro/zumen',
      'https://meta-taro.github.io/zumen/en/',
      'spec/zumen-format-v1.md',
      'Example drawings:',
    ]) {
      assert.ok(llms.includes(must), `llms.txt に ${must} が無い`);
    }
    // **できないことも書く。** できることだけ書いた紹介は、読んだ側が確かめに来たときに崩れる。
    assert.match(llms, /## What it is not/);
  });

  it('**ページから llms.txt と sitemap へ行ける**', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      assert.match(page, /llms\.txt/, `${name} から llms.txt へ行けない`);
      assert.match(page, /sitemap\.xml/, `${name} から sitemap へ行けない`);
    }
  });

  it('**sitemap に 2 枚とも載っていて、言語の対応も言っている**', () => {
    const map = readFileSync('site/sitemap.xml', 'utf8');
    assert.match(map, /<loc>https:\/\/meta-taro\.github\.io\/zumen\/<\/loc>/);
    assert.match(map, /<loc>https:\/\/meta-taro\.github\.io\/zumen\/en\/<\/loc>/);
    assert.match(map, /hreflang="x-default"/);
  });

  it('**枚数が、書いてあるところ全部で合っている**', async () => {
    const { readdirSync } = await import('node:fs');
    const total = readdirSync('examples/gallery').filter((name) => name.endsWith('.zumen.yaml')).length;
    const llms = readFileSync('site/llms.txt', 'utf8');
    for (const [name, text] of [['ja', ja], ['en', en], ['llms.txt', llms]] as const) {
      for (const found of text.matchAll(/見本 (\d+) 枚/g)) {
        assert.equal(Number(found[1]), total, `${name} の「見本 N 枚」が古い`);
      }
      for (const found of text.matchAll(/(\d+) example drawings/g)) {
        assert.equal(Number(found[1]), total, `${name} の「N example drawings」が古い`);
      }
    }
    assert.match(llms, new RegExp(`Example drawings: ${total}`));
  });
});

/**
 * **見本のページを、検査が 1 枚も見ていなかった**（2026-09-22。88 周目）。
 *
 * SEO の検査はトップと DL ページだけを見ていて、**688 枚の見本ページは素通り**だった。
 * 測ったら **344 枚すべての説明が 70 字未満**、**64 枚は題とまったく同じ**だった。
 *
 * ここが見るのは**形**だけ —— 文の善し悪しは人が読む。
 */
describe('見本のページ', () => {
  const pages = (base: string): { no: string; html: string }[] => {
    const dir = new URL(`../${base}/`, import.meta.url);
    return readdirSync(dir)
      .filter((name) => /^[0-9]+$/.test(name))
      .map((no) => ({ no, html: readFileSync(new URL(`${no}/index.html`, dir), 'utf8') }));
  };
  const meta = (html: string, name: string): string =>
    new RegExp(`name="${name}" content="([^"]*)"`).exec(html)?.[1] ?? '';
  const ja = pages('site/g');
  const en = pages('site/en/g');

  it('**1 枚も欠けていない**（日本語と英語で同じ数）', () => {
    assert.ok(ja.length > 300, `見本のページが少なすぎる: ${ja.length}`);
    assert.equal(en.length, ja.length);
  });

  it('**説明が、題の言い直しになっていない**', () => {
    const same = [...ja, ...en]
      .filter((page) => {
        const title = /<title>([^<]*)<\/title>/.exec(page.html)?.[1] ?? '';
        return title.replace(/ — zumen.*$/, '') === meta(page.html, 'description');
      })
      .map((page) => page.no);
    assert.deepEqual(same, [], '説明が題と同じ見本のページ');
  });

  it('**説明が、同じ文を繰り返していない**', () => {
    const repeated = [...ja]
      .filter((page) => {
        const desc = meta(page.html, 'description');
        const head = desc.split('。')[0] ?? '';
        return head.length >= 6 && desc.slice(head.length + 1).startsWith(head);
      })
      .map((page) => page.no);
    assert.deepEqual(repeated, [], '説明の中で同じ文が 2 回出ている見本のページ');
  });

  it('**パンくずと図の構造化データがある**（検索結果に出る）', () => {
    const missing = [...ja, ...en]
      .filter((page) => !page.html.includes('BreadcrumbList') || !page.html.includes('ImageObject'))
      .map((page) => page.no);
    assert.deepEqual(missing, []);
  });

  it('**共有したときの絵に、説明が添えてある**（og:image:alt）', () => {
    const missing = [...ja, ...en]
      .filter((page) => !/og:image:alt" content="[^"]{10,}"/.test(page.html))
      .map((page) => page.no);
    assert.deepEqual(missing, []);
  });
});
