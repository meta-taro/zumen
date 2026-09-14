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
import { kindOf } from '../src/kind.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const DIR = 'examples/gallery';
const PAGE = 'site/index.html';
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
function pageParts() {
  const listed = new Set();
  const figures = [];
  const buttons = [
    `    <button type="button" data-pick="all" aria-pressed="true">すべて <span class="n">${
      CATEGORIES.reduce((sum, group) => sum + group.items.length, 0)
    }</span></button>`,
  ];

  for (const group of CATEGORIES) {
    buttons.push(
      `    <button type="button" data-pick="${group.key}" aria-pressed="false">${group.label} <span class="n">${group.items.length}</span></button>`,
    );
    figures.push(
      `    <h3 class="cat" data-cat="${group.key}">${group.label}<span class="n">${group.items.length}</span></h3>`,
    );
    for (const item of group.items) {
      listed.add(item.name);
      const svg = readFileSync(join(DIR, `${item.name}.svg`), 'utf8');
      const size = svg.match(/<svg[^>]*width="(\d+)" height="(\d+)"/);
      if (size === null) throw new Error(`${item.name}.svg に大きさがありません`);
      const [w, h] = [Number(size[1]), Number(size[2])];
      const wide = w / h >= WIDE ? ' data-wide' : '';
      figures.push(
        `    <figure${wide} data-cat="${group.key}"><picture>` +
          `<source srcset="gallery/${item.name}-dark.svg" media="(prefers-color-scheme: dark)">` +
          `<img loading="lazy" decoding="async" width="${w}" height="${h}" src="gallery/${item.name}.svg" alt="${item.alt}">` +
          `</picture><figcaption>${item.caption}</figcaption></figure>`,
      );
    }
  }

  const missing = readdirSync(DIR)
    .filter((f) => f.endsWith('.zumen.yaml'))
    .map((f) => f.replace('.zumen.yaml', ''))
    .filter((name) => !listed.has(name));

  return { filters: buttons.join('\n'), gallery: figures.join('\n'), missing };
}

const parts = pageParts();
const page = readFileSync(PAGE, 'utf8');
const rebuilt = page
  .replace(/(<div class="filters"[^>]*>\n)[\s\S]*?(\n  <\/div>)/, `$1${parts.filters}$2`)
  .replace(/(<div class="gallery">\n)[\s\S]*?(\n  <\/div>)/, `$1${parts.gallery}$2`);
if (!check) writeFileSync(PAGE, rebuilt);
else if (rebuilt !== page) stale.push(PAGE);

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
