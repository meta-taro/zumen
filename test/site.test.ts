/**
 * **日本語と英語のページが、離れていかないこと**（2026-09-16）。
 *
 * OSS を世界へ出すので、入口を日本語だけにしない。
 * ただし **2 枚になった瞬間、片方だけ直った状態**が生まれる。
 * 見た目と動きは 1 か所（`site/style.css` / `site/page.js`）に寄せたので、
 * ここで見るのは**残りの食い違い** —— 行き先と、互いへの入口。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

  it('**絵が実際にある**（参照だけ足して置き忘れない）', () => {
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
 * 検索と AI からの読まれ方（SEO / AIEO）を意識する、という指示から。見たのは 4 つ。
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

/**
 * **指しているのに無い絵を止める**（2026-09-22）。
 *
 * この日、見本ごとの共有カード（`site/og/NN.png`）を足した。
 * **カードは重いので、見本が増えた直後は追いついていない**ことがある ——
 * そのとき `og:image` が 404 を指すと、**組み立てもテストも通ったまま、
 * 共有したときだけ壊れる。**人が気づくのは貼った後になる。
 *
 * 図（`gallery/*.svg`）は `site/` には置かない（`pnpm pages` と workflow が写す）ので、
 * **正本の `examples/gallery/` に在るか**で見る。
 */
describe('指している絵が、ちゃんと在る', () => {
  const SITE = 'https://meta-taro.github.io/zumen';
  const walk = (dir: URL): URL[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? walk(new URL(`${entry.name}/`, dir))
        : entry.name.endsWith('.html')
          ? [new URL(entry.name, dir)]
          : [],
    );
  const site = new URL('../site/', import.meta.url);
  const htmls = walk(site);

  it('**ページが 700 枚以上ある**（歩き方が合っている）', () => {
    assert.ok(htmls.length > 700, `ページが少なすぎる: ${htmls.length}`);
  });

  it('**共有カード（og:image）が、すべて在る**', () => {
    const missing: string[] = [];
    for (const html of htmls) {
      const text = readFileSync(html, 'utf8');
      for (const found of text.matchAll(/(?:og:image|twitter:image)" content="([^"]+)"/g)) {
        const url = found[1] ?? '';
        if (!url.startsWith(SITE)) continue;
        const path = decodeURIComponent(url.slice(SITE.length + 1));
        if (existsSync(new URL(path, site))) continue;
        missing.push(`${html.pathname.split('/site/')[1]} → ${path}`);
      }
    }
    assert.deepEqual([...new Set(missing)], []);
  });

  /**
   * **見本のページは、その見本のカードを指す**（2026-10-20）。
   *
   * カードが無いと全体のカード（`og.png`）へ黙って落ちる。**404 にはならないので、上の検査は通る。**
   * 見本 369〜403 の 35 枚がそうなっていて、X に貼るとどれも同じカードに見えた。
   * 英語のページは英語の帯のカード（`en/og/`）を指す —— 日本語の帯だと英語で貼ったときに題が日本語で出る。
   */
  it('**見本のページは、全体のカードに落ちていない**（英語は英語のカード）', () => {
    const wrong: string[] = [];
    for (const html of htmls) {
      const page = /site\/(en\/)?g\/(\d+)\/index\.html$/.exec(html.pathname);
      if (page === null) continue;
      const want = `${SITE}/${page[1] ?? ''}og/${page[2]}.png`;
      const got = /og:image" content="([^"]+)"/.exec(readFileSync(html, 'utf8'))?.[1];
      if (got !== want) wrong.push(`${html.pathname.split('/site/')[1]} → ${got}`);
    }
    assert.deepEqual(wrong, []);
  });

  it('**貼ってある図が、すべて正本に在る**', () => {
    const gallery = new URL('../examples/gallery/', import.meta.url);
    const missing: string[] = [];
    for (const html of htmls) {
      for (const found of readFileSync(html, 'utf8').matchAll(/<img [^>]*src="([^"]+)"/g)) {
        const name = /\/gallery\/([^/]+\.svg)$/.exec(found[1] ?? '')?.[1];
        if (name === undefined) continue;
        if (existsSync(new URL(decodeURIComponent(name), gallery))) continue;
        missing.push(`${html.pathname.split('/site/')[1]} → ${name}`);
      }
    }
    assert.deepEqual([...new Set(missing)], []);
  });
});

/**
 * **徘徊の道**（2026-09-24。指摘）。
 *
 * 個別ページから次の見本へ渡り歩く道が無い、という指摘。
 *
 * **意図していなかった。** 見本ごとの `og:image`・構造化データ・パンくずと、
 * 「**検索や SNS から 1 枚に降りてくる人**」の作りは揃えてあったのに、
 * **降りてきた人が隣を見に行く道が無かった。**
 *
 * ここで見張るのは 3 つ —— 前後の道、全部の一覧、パンくずの通し。
 */
describe('徘徊の道', () => {
  const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const numbers = readdirSync(new URL('../site/g/', import.meta.url)).filter((n) => /^[0-9]+$/.test(n));

  /**
   * **同じ分野の見本は、絵で選べる**（2026-09-28。同じ分野の見本にサムネイルが欲しい、という要望）。
   * 題の文字だけでは、どんな図かが分からない。分野ページと同じカードにする。
   */
  it('**同じ分野の見本が、サムネイルつきのカード**で並び、どの絵も実在する', () => {
    const missing: string[] = [];
    for (const [dir, up] of [['site/g', '../../'], ['site/en/g', '../../../']] as const) {
      for (const no of numbers) {
        const html = read(`${dir}/${no}/index.html`);
        const near = html.split(/<h2>(?:同じ分野の見本|More in this field)<\/h2>/)[1];
        if (near === undefined) continue;
        assert.match(near, /^\s*<ul class="cards">/, `${dir}/${no} の同じ分野がカードでない`);
        for (const [, src] of near.matchAll(/<img src="([^"]+)"/g)) {
          const file = decodeURIComponent((src ?? '').replace(up, ''));
          if (!existsSync(new URL(`../examples/${file}`, import.meta.url))) missing.push(`${dir}/${no}: ${src}`);
        }
      }
    }
    assert.deepEqual(missing, []);
  });

  it('**どの見本からも、前と次へ行ける**', () => {
    const broken = numbers.filter((no) => {
      const html = read(`site/g/${no}/index.html`);
      return !/rel="prev"/.test(html) || !/rel="next"/.test(html);
    });
    assert.deepEqual(broken, []);
  });

  /**
   * **入口のページからも、図の中の字で探せる**（2026-11-07）。
   * 一覧まで降りてきた人しか検索欄に気づかなかった。入口で打った字は `?q=` で一覧へ渡す
   * （JS が無くても一覧は開く。絞れないだけ）。
   */
  it('**入口の検索欄が、一覧へ字を渡す**', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      const form = page.match(/<form class="find"[^>]*>[\s\S]*?<\/form>/)?.[0];
      assert.ok(form, `${name} の入口に検索欄が無い`);
      assert.match(form, /action="all\/"/, `${name} の検索欄が一覧へ行かない`);
      assert.match(form, /method="get"/, `${name} の検索欄が字を URL で渡さない`);
      assert.match(form, /<input[^>]*name="q"/, `${name} の検索欄の名前が q でない`);
    }
    assert.match(read('site/all.js'), /URLSearchParams\(location\.search\)\.get\('q'\)/, '一覧が ?q= を受けない');
    for (const path of ['site/all/index.html', 'site/en/all/index.html']) {
      assert.match(read(path), /<input id="q"[^>]*name="q"/, `${path} の欄の名前が q でない`);
    }
  });

  /**
   * **打ち始めると候補が出る**（`<datalist>`。2026-11-07）。
   * 何があるかを知らない人は、何を打てばよいかも分からない。分野と、見本の題を候補にする。
   */
  it('**検索欄に、分野と見本の題の候補が付いている**', () => {
    for (const path of ['site/index.html', 'site/en/index.html', 'site/all/index.html', 'site/en/all/index.html']) {
      const html = read(path);
      const id = html.match(/<input[^>]*name="q"[^>]*list="([^"]+)"/)?.[1];
      assert.ok(id, `${path} の検索欄に候補が付いていない`);
      const list = html.match(new RegExp(`<datalist id="${id}">([\\s\\S]*?)</datalist>`))?.[1];
      assert.ok(list, `${path} に候補の一覧が無い`);
      const options = [...list.matchAll(/<option value="[^"]+">/g)].length;
      assert.ok(options > numbers.length, `${path} の候補が ${options} 件しかない（見本 ${numbers.length} 枚＋分野）`);
    }
  });

  /**
   * **数が増えても、日本語が崩れない**（2026-11-07）。
   * 「分野は ${n} つ」と書いていて、13 になった時点で「13 つ」になっていた。
   * 「つ」で数えられるのは 9 まで。数が動く文に「つ」を付けない。
   */
  /**
   * **検索結果に出る文で、中身が分かる**（2026-11-08）。
   * 分野のページは 13 枚とも「○○の図面 N 枚。すべて YAML 1 枚から描いたもの。」だけで、
   * 何の図があるかが 1 語も無かった。英語の見本は 101 枚が 70 字未満だった。
   */
  it('**分野のページの説明に、そこにある図の名前が入っている**', () => {
    const desc = (path: string): string => read(path).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
    for (const key of readdirSync(new URL('../site/c/', import.meta.url))) {
      for (const path of [`site/c/${key}/index.html`, `site/en/c/${key}/index.html`]) {
        const html = read(path);
        const g = path.startsWith('site/en/') ? 'site/en/g' : 'site/g';
        const names = [...html.matchAll(/<li><a href="[./]*g\/(\d+)\/"/g)]
          .map((m) => read(`${g}/${m[1]}/index.html`).match(/<h1[^>]*>([^<]+)/)?.[1] ?? '')
          .map((n) => n.replace(/\s*[（(].*$/, '').trim());
        const hits = names.filter((n) => desc(path).includes(n.replace(/&amp;/g, '&')));
        assert.ok(hits.length >= 3, `${path} の説明に図の名前が ${hits.length} 件しかない: ${desc(path)}`);
      }
    }
  });

  /**
   * **日本語のページに、英語の題を混ぜない**（2026-11-09）。
   * 米国の様式を写した見本 24 枚は、正本の題が英語。分野の説明に「Sprinkler layout」がそのまま出ていた。
   */
  it('**日本語の分野の説明に並ぶ名前は、どれも日本語**', () => {
    const english: string[] = [];
    for (const key of readdirSync(new URL('../site/c/', import.meta.url))) {
      const desc = read(`site/c/${key}/index.html`).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
      const list = desc.split(' ── ')[1]?.replace(/など。.*$/, '') ?? '';
      for (const name of list.split('・')) if (!/[ぁ-んァ-ヶ一-龥]/.test(name)) english.push(`${key}: ${name}`);
    }
    assert.deepEqual(english, []);
  });

  it('**英語の見本の説明が、70 字以上ある**', () => {
    const short = numbers.filter((no) => {
      const d = read(`site/en/g/${no}/index.html`).match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
      return d.length < 70;
    });
    assert.deepEqual(short, []);
  });

  it('**10 以上の数に「つ」を付けていない**', () => {
    const pages = ['site/index.html', 'site/all/index.html', ...numbers.map((no) => `site/g/${no}/index.html`)];
    const bad = pages.filter((path) => /(?<![0-9０-９])[1-9][0-9]+ ?つ(?![ぎづ])/.test(read(path)));
    assert.deepEqual(bad, []);
  });

  it('**344 枚が 1 ページに並ぶ**（JS が無くても読める）', () => {
    for (const path of ['site/all/index.html', 'site/en/all/index.html']) {
      const html = read(path);
      const cards = [...html.matchAll(/<li data-no="\d+" data-name="/g)].length;
      assert.equal(cards, numbers.length, `${path} の枚数が見本の数と違う`);
    }
  });

  /**
   * **見える形と構造化データを食い違わせない。**
   * 検索結果に出るのは後者で、人が見るのは前者。
   */
  it('**パンくずが、入口から現在地まで通っている**', () => {
    const thin: string[] = [];
    for (const no of numbers) {
      const html = read(`site/g/${no}/index.html`);
      const crumbs = /<nav class="crumbs"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
      // 見える側は 入口 / すべての見本 / 分野 の 3 つ
      if ([...crumbs.matchAll(/<a /g)].length !== 3) thin.push(`${no}: 見える側`);
      /**
       * **JSON は JSON として読む。**
       * 最初はここを正規表現で切り出していて、閉じ括弧のインデントを決め打ちしたせいで
       * 実物が正しいのに 344 枚すべてを落とした（2026-09-24）。
       */
      const script = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html)?.[1] ?? 'null';
      const data = JSON.parse(script) as unknown;
      const all = Array.isArray(data) ? data : [data];
      const crumb = all.find((one) => (one as { '@type'?: string })['@type'] === 'BreadcrumbList') as
        | { itemListElement: unknown[] }
        | undefined;
      // 構造化データは、見える 3 つに現在地を足した 4 つ
      if (crumb === undefined || crumb.itemListElement.length !== 4) thin.push(`${no}: 構造化データ`);
    }
    assert.deepEqual(thin.slice(0, 5), []);
  });

  it('**分野のページと一覧にも、パンくずがある**', () => {
    for (const path of ['site/c/gyomu/index.html', 'site/all/index.html', 'site/en/all/index.html']) {
      assert.match(read(path), /BreadcrumbList/, `${path} にパンくずが無い`);
    }
  });

  /**
   * **カードの図が 1 枚も出ていなかった**（2026-09-24）。
   *
   * `<img>` に `width` / `height` が無く、読み込む前の高さが 0 になり、
   * `loading="lazy"` が発火しないままだった。**分野ページ 13 枚すべて。**
   * 寸法があると場所が先に決まるので、字も飛び跳ねない（CLS）。
   */
  it('**カードの図に寸法が付いている**', () => {
    const naked: string[] = [];
    for (const path of ['site/c/gyomu/index.html', 'site/all/index.html']) {
      for (const [tag] of read(path).matchAll(/<img [^>]*gallery\/[^>]*>/g)) {
        if (!/ width="\d+" height="\d+"/.test(tag)) naked.push(`${path}: ${tag.slice(0, 60)}`);
      }
    }
    assert.deepEqual(naked.slice(0, 3), []);
  });

  /**
   * **正本の書き方が、生のまま出ていた**（2026-09-24）。
   *
   * 表は 1 行に潰れ（17 枚・100 行）、`**` とバッククォートはそのまま文字として出ていた。
   * **とくに `meta description` は検索結果にそのまま出る。**
   */
  it('**検索結果に出る文に、書き方の記号が残っていない**', () => {
    const dirty: string[] = [];
    for (const no of numbers) {
      const html = read(`site/g/${no}/index.html`);
      for (const found of html.matchAll(/name="description" content="([^"]*)"/g)) {
        if (/\*\*|`/.test(found[1] ?? '')) dirty.push(no);
      }
    }
    assert.deepEqual(dirty.slice(0, 5), []);
  });
});

/**
 * **ダウンロード・過去の版・ロードマップ・よくある質問**（2026-11-09）。
 * OSS の紹介ページの決まり（姉妹の tadori と揃える）から、zumen に足りなかった分。
 */
describe('入口から辿れるもの', () => {
  const read = (path: string): string => readFileSync(path, 'utf8');

  it('**3 枚が日英とも在り、sitemap に載っている**', () => {
    const sitemap = read('site/sitemap.xml');
    for (const page of ['download', 'releases', 'roadmap']) {
      for (const [dir, url] of [['site', `https://meta-taro.github.io/zumen/${page}/`], ['site/en', `https://meta-taro.github.io/zumen/en/${page}/`]] as const) {
        assert.ok(existsSync(`${dir}/${page}/index.html`), `${dir}/${page} が無い`);
        assert.ok(sitemap.includes(`<loc>${url}</loc>`), `sitemap に ${url} が無い`);
      }
    }
  });

  it('**入口のダウンロードは、この PC 向けのページへ行く**', () => {
    for (const [name, page, js] of [['ja', ja, 'download.js'], ['en', en, '../download.js']] as const) {
      assert.match(page, /<a class="btn primary" href="download\/" data-hero-download>/, `${name} のボタンがダウンロードのページへ行かない`);
      assert.ok(page.includes(`<script src="${js}" defer></script>`), `${name} が download.js を読んでいない`);
    }
    for (const path of ['site/download/index.html', 'site/en/download/index.html']) {
      const html = read(path);
      const kinds = [...html.matchAll(/data-kind="([a-z0-9-]+)"/g)].map((m) => m[1]);
      assert.deepEqual(kinds, ['mac-arm', 'mac-intel', 'win-x64', 'win-arm'], `${path} の欄が OS と CPU で揃っていない`);
      // **JS が無くても、リリースのページへは行ける。**
      assert.ok(html.includes('https://github.com/meta-taro/zumen/releases/latest'), `${path} に JS 無しの道が無い`);
      // **版数を書かない**（書いた翌日に古くなる）。
      assert.doesNotMatch(html, /v?\d+\.\d+\.\d+/, `${path} に版数が書いてある`);
    }
  });

  /**
   * **配布物の名前の読み方が、実際の名前に合っている。**
   * v0.7.0 の名前と、次の版（universal）の名前で確かめる。
   */
  it('**download.js が、OS と CPU ごとに配布物を振り分ける**', () => {
    const src = read('site/download.js');
    const body = src.match(/const KINDS = (\[[\s\S]*?\n {2}\]);/)?.[1];
    assert.ok(body, 'download.js に KINDS が無い');
    const kinds = new Function('ja', `return ${body}`)(true) as { id: string; test: (n: string, uni: boolean) => boolean }[];
    const pick = (names: string[]) => {
      const uni = names.some((n) => /universal\.dmg$/i.test(n));
      return Object.fromEntries(kinds.map((k) => [k.id, names.filter((n) => k.test(n, uni))]));
    };
    const now = pick(['zumen-macos-app.tar.gz', 'zumen-windows-arm64.exe', 'zumen-windows-x64.exe', 'zumen_0.7.0_aarch64.dmg', 'zumen_0.7.0_arm64-setup.exe', 'zumen_0.7.0_arm64_en-US.msi', 'zumen_0.7.0_x64-setup.exe', 'zumen_0.7.0_x64_en-US.msi']);
    assert.deepEqual(now['mac-arm'], ['zumen-macos-app.tar.gz', 'zumen_0.7.0_aarch64.dmg']);
    assert.deepEqual(now['mac-intel'], [], 'Apple シリコン用だけの版で、Intel の欄に出している');
    assert.deepEqual(now['win-x64'], ['zumen-windows-x64.exe', 'zumen_0.7.0_x64-setup.exe', 'zumen_0.7.0_x64_en-US.msi']);
    assert.deepEqual(now['win-arm'], ['zumen-windows-arm64.exe', 'zumen_0.7.0_arm64-setup.exe', 'zumen_0.7.0_arm64_en-US.msi']);
    const next = pick(['zumen-macos-app.tar.gz', 'zumen_0.8.0_universal.dmg']);
    assert.deepEqual(next['mac-arm'], next['mac-intel'], 'universal の版で、Apple シリコンと Intel の欄が違う');
    assert.equal(next['mac-intel']?.length, 2);
  });

  it('**「zumen とは」を言い切る段落が、冒頭にある**', () => {
    for (const [name, page, head] of [['ja', ja, 'zumen とは'], ['en', en, 'What is zumen?']] as const) {
      const what = page.indexOf(`<h2>${head}</h2>`);
      assert.ok(what > 0, `${name} に「${head}」が無い`);
      assert.ok(what < page.indexOf('<h2>', page.indexOf('<section') + 1) + 1, `${name} の「${head}」が最初の節でない`);
    }
  });

  it('**「画面で見る」に、アプリの窓のキャプチャが言語ごとにある**', () => {
    for (const [name, page, prefix] of [['ja', ja, 'readme/'], ['en', en, '../readme/']] as const) {
      const at = page.indexOf('<section id="screens">');
      assert.ok(at > 0, `${name} に「画面で見る」が無い`);
      const block = page.slice(at, page.indexOf('</section>', at));
      const shots = [...block.matchAll(/<img src="([^"]+)"[^>]*alt="([^"]+)"/g)];
      assert.equal(shots.length, 2, `${name} のキャプチャが 2 枚でない`);
      for (const [, src, alt] of shots) {
        assert.ok(src!.startsWith(prefix) && src!.endsWith(`-${name}.png`), `${name} が別の言語の画面を使っている: ${src}`);
        assert.ok(existsSync(new URL(`../site/${src!.replace(prefix, 'readme/')}`, import.meta.url)), `${src} が無い`);
        assert.ok(alt!.length >= 30, `${src} の alt が短い`);
      }
    }
  });

  it('**よくある質問は、構造化データと見える文が同じ**', () => {
    for (const [name, page] of [['ja', ja], ['en', en]] as const) {
      const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page)?.[1] ?? '{}';
      const faq = (JSON.parse(block) as { '@graph': { '@type': string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] }[] })['@graph'].find((g) => g['@type'] === 'FAQPage');
      assert.ok(faq?.mainEntity?.length, `${name} に FAQPage が無い`);
      const seen = [...page.matchAll(/<dt>([^<]+)<\/dt>\s*<dd>([^<]+)<\/dd>/g)].map((m) => [m[1], m[2]]);
      assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), seen, `${name} の FAQPage と見える質問が食い違う`);
    }
  });

  /** **古い「しないこと」を残さない。** 平面図は寸法つきで描いているのに「縮尺のある図をやりません」と書いてあった。 */
  it('**しないことに、もう描いているものを書いていない**', () => {
    assert.doesNotMatch(ja, /縮尺のある図をやりません/);
    assert.doesNotMatch(en, /does not place things for you in scaled drawings/);
  });
});
