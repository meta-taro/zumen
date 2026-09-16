/**
 * **見本の SVG と、紹介ページの見本一覧を組み立て直す**
 * （`examples/gallery/` と `site/index.html`）。
 *
 * 正本（`*.zumen.yaml`）を直したのに SVG を描き直し忘れると、
 * 紹介のページ（`site/`）には**古い図**が出る。ビルドもテストも通ったまま壊れる
 * ——「参照だけ足してアップロードを忘れる」のと同じ壊れ方（ベースルール §23）。
 *
 * `--check` を付けると、書かずに**食い違いだけを出す**（CI 用）。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORIES } from './gallery-categories.mjs';
import { CAPTIONS_EN, GROUPS_EN, ORDER_EN, englishFirst } from './gallery-en.mjs';
import { kindOf } from '../src/kind.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const DIR = 'examples/gallery';
/**
 * **同じ一覧を、2 つの言語のページへ組み立てる**（2026-09-16）。
 *
 * 並びと分類は 1 つ（`gallery-categories.mjs`）。**英語はそこへ混ぜず**、
 * 名前で引く辞書（`gallery-en.mjs`）に分けてある —— 混ぜると、
 * どちらの言語を直しているのか読みながら分からなくなる。
 */
const PAGES = [
  { path: 'site/index.html', locale: 'ja', prefix: 'gallery/', all: 'すべて' },
  { path: 'site/en/index.html', locale: 'en', prefix: '../gallery/', all: 'All' },
];
/** **横長の図は 2 列ぶち抜き。** 縦横比がこれ以上なら幅を倍もらう。 */
const WIDE = 1.9;
const check = process.argv.includes('--check');

const stale = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const placed = await layout(text);
  const plan = kindOf(text) === 'placement';
  for (const theme of ['light', 'dark']) {
    const out = join(DIR, `${file.replace('.zumen.yaml', '')}${theme === 'dark' ? '-dark' : ''}.svg`);
    const svg = render(placed, theme, 'safe', plan);
    if (!check) {
      writeFileSync(out, svg);
      continue;
    }
    let was = null;
    try {
      was = readFileSync(out, 'utf8');
    } catch {
      // 無いものは「古い」に数える（下で名前を出す）。
    }
    if (was !== svg) stale.push(out);
  }
}

/**
 * **紹介ページの見本一覧を組み立てる。**
 *
 * 手で書いていたときは、**見本を足してページに足し忘れる**のが毎回起きた。
 * 絵の大きさも手で書けないので `loading="lazy"` で場所が空かず、
 * 読み込むたびに下の図が飛んだ（2026-09-14。実機で出た）。
 *
 * **並びと分類は `scripts/gallery-categories.mjs` が正本。**
 * 大きさは SVG から読む。
 */
function pageParts(page) {
  const en = page.locale === 'en';
  const listed = new Set();
  const figures = [];
  const buttons = [
    `    <button type="button" data-pick="all" aria-pressed="true">${page.all} <span class="n">${
      CATEGORIES.reduce((sum, group) => sum + group.items.length, 0)
    }</span></button>`,
  ];

  // **英語のページだけ、分類の順を差し替える**（`gallery-en.mjs` の `ORDER_EN`）。
  const order = en
    ? ORDER_EN.map((key) => CATEGORIES.find((group) => group.key === key))
    : CATEGORIES;
  if (order.some((group) => group === undefined)) throw new Error('ORDER_EN に無い分類があります');

  for (const group of order) {
    buttons.push(
      `    <button type="button" data-pick="${group.key}" aria-pressed="false">${
        en ? GROUPS_EN[group.key] : group.label
      } <span class="n">${group.items.length}</span></button>`,
    );
    figures.push(
      `    <h3 class="cat" data-cat="${group.key}">${
        en ? GROUPS_EN[group.key] : group.label
      }<span class="n">${group.items.length}</span></h3>`,
    );
    for (const item of en ? englishFirst(group.items) : group.items) {
      listed.add(item.name);
      const svg = readFileSync(join(DIR, `${item.name}.svg`), 'utf8');
      const size = svg.match(/<svg[^>]*width="(\d+)" height="(\d+)"/);
      if (size === null) throw new Error(`${item.name}.svg に大きさがありません`);
      const [w, h] = [Number(size[1]), Number(size[2])];
      const wide = w / h >= WIDE ? ' data-wide' : '';
      // **英語のページには英語の説明。** 足し忘れは `test/gallery-en.test.ts` が落とす。
      const words = en ? CAPTIONS_EN[item.name] : null;
      if (en && words === undefined) throw new Error(`${item.name} の英語がありません`);
      figures.push(
        `    <figure${wide} data-cat="${group.key}"><picture>` +
          `<source srcset="${page.prefix}${item.name}-dark.svg" media="(prefers-color-scheme: dark)">` +
          `<img loading="lazy" decoding="async" width="${w}" height="${h}" src="${page.prefix}${item.name}.svg" alt="${
            en ? words : item.alt
          }">` +
          `</picture><figcaption>${en ? words : item.caption}</figcaption></figure>`,
      );
    }
  }

  const missing = readdirSync(DIR)
    .filter((f) => f.endsWith('.zumen.yaml'))
    .map((f) => f.replace('.zumen.yaml', ''))
    .filter((name) => !listed.has(name));

  return { filters: buttons.join('\n'), gallery: figures.join('\n'), missing };
}

/** **英字の名前の見本＝図の中も英語で書いたもの**（`gallery-en.mjs` の `englishFirst` と同じ見方）。 */
const sources = readdirSync(DIR)
  .filter((f) => f.endsWith('.zumen.yaml'))
  .map((f) => f.replace('.zumen.yaml', ''));
const counted = {
  total: sources.length,
  english: sources.filter((name) => !/[\u3040-\u30ff\u4e00-\u9fff]/.test(name)).length,
};

let parts;
for (const target of PAGES) {
  parts = pageParts(target);
  const page = readFileSync(target.path, 'utf8');
  const rebuilt = page
    .replace(/(<div class="filters"[^>]*>\n)[\s\S]*?(\n  <\/div>)/, `$1${parts.filters}$2`)
    .replace(/(<div class="gallery">\n)[\s\S]*?(\n  <\/div>)/, `$1${parts.gallery}$2`)
    // **「何枚が英語か」は数えて入れる。** 手で書いた数は、見本が増えた日にずれる。
    .replace(/(<span data-count="english">)\d*(<\/span>)/, `$1${counted.english}$2`)
    .replace(/(<span data-count="total">)\d*(<\/span>)/, `$1${counted.total}$2`);
  if (!check) writeFileSync(target.path, rebuilt);
  else if (rebuilt !== page) stale.push(target.path);
}

if (parts.missing.length > 0) {
  console.log(`紹介ページに出していない見本が ${parts.missing.length} 件あります（scripts/gallery-categories.mjs に足してください）。`);
  for (const name of parts.missing) console.log(`  ${name}`);
  process.exitCode = 1;
}

if (!check) {
  console.log(`${readdirSync(DIR).filter((f) => f.endsWith('.zumen.yaml')).length} 枚を描き直し、紹介ページを組み立て直しました。`);
} else if (stale.length > 0) {
  console.log(`正本と食い違うものが ${stale.length} 件あります（pnpm gallery で組み立て直してください）。`);
  for (const path of stale) console.log(`  ${path}`);
  process.exitCode = 1;
} else {
  console.log('SVG と紹介ページは正本と一致しています。');
}
