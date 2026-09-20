/**
 * **分野ごと・見本ごとのページを組み立てる**（2026-09-20）。
 *
 * 見本が 233 枚になったのに、**世に出ている入口は 2 つ**（`/` と `/en/`）だけだった。
 * 検索でも、言語モデルに読ませるときも、**1 枚ごとに URL が無いと引けない。**
 *
 * ## 何を出すか
 *
 * | | |
 * |---|---|
 * | `/c/<key>/` | 分野ごと（15 × 2 言語） |
 * | `/g/<番号>/` | 見本ごと（233 × 2 言語） |
 * | `/sitemap.xml` | 上のすべて |
 *
 * **URL は番号**（`/g/233/`）。日本語のファイル名を URL に出すと
 * パーセント符号化で読めなくなるうえ、名前を直した日に URL が変わる。
 * 番号は正本のファイル名の先頭にあり、**足すことはあっても付け替えない。**
 *
 * ## 正本そのものは貼らない
 *
 * YAML 全文は 2.5MB ある。2 言語ぶん貼ると、ページの中身より重くなる。
 * 代わりに**正本の見出しコメント（その図の決まりごとを書いた文章）**を載せる ——
 * **あれがその図の中でいちばん価値のある文章**で、ほかのどこにも無い。
 * 正本そのものは GitHub と npm にあるので、リンクで足りる。
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORIES } from './gallery-categories.mjs';
import { CAPTIONS_EN, GROUPS_EN } from './gallery-en.mjs';

const DIR = 'examples/gallery';
const SITE = 'https://meta-taro.github.io/zumen';
const check = process.argv.includes('--check');

/** 番号（正本のファイル名の先頭）。**URL はこれで作る。** */
const numberOf = (name) => name.match(/^(\d+)/)?.[1] ?? null;

/**
 * **正本の見出しコメント。**
 *
 * `# ` で始まる行を、`nodes:` の前まで。`**` は見出しの印なので `<strong>` にする。
 */
function noteOf(text) {
  const head = text.split(/^nodes:/m)[0] ?? '';
  const lines = head.split('\n').filter((l) => l.startsWith('#')).map((l) => l.replace(/^#\s?/, ''));
  const paras = [];
  let now = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (now.length > 0) paras.push(now.join(''));
      now = [];
      continue;
    }
    now.push(line.trim());
  }
  if (now.length > 0) paras.push(now.join(''));
  return paras.filter((p) => !p.startsWith('##'));
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** `**ここ**` を `<strong>` にする。**正本の書き方をそのまま活かす。** */
const strong = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const SAMPLES = [];
for (const group of CATEGORIES) {
  for (const item of group.items) {
    const no = numberOf(item.name);
    if (no === null) continue;
    const text = readFileSync(join(DIR, `${item.name}.zumen.yaml`), 'utf8');
    SAMPLES.push({
      no,
      name: item.name,
      title: text.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '') ?? item.name,
      caption: item.caption,
      alt: item.alt,
      en: CAPTIONS_EN[item.name] ?? item.caption,
      note: noteOf(text),
      group,
    });
  }
}
SAMPLES.sort((a, b) => Number(a.no) - Number(b.no));
const byGroup = new Map(CATEGORIES.map((g) => [g.key, SAMPLES.filter((s) => s.group.key === g.key)]));

/** ページの殻。**どのページも同じ形**にして、差は中身だけにする。 */
function shell({ lang, path, title, desc, jsonld, body, up }) {
  const other = lang === 'ja' ? `${SITE}/en${path}` : `${SITE}${path}`;
  const self = lang === 'ja' ? `${SITE}${path}` : `${SITE}/en${path}`;
  const depth = path.split('/').filter(Boolean).length + (lang === 'ja' ? 0 : 1);
  const root = '../'.repeat(depth);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" type="image/svg+xml" href="${root}icon.svg">
<meta name="theme-color" content="#23232b">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="zumen">
<meta property="og:locale" content="${lang === 'ja' ? 'ja_JP' : 'en_US'}">
<meta property="og:url" content="${self}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og.png">
<link rel="stylesheet" href="${root}style.css">
<link rel="canonical" href="${self}">
<link rel="alternate" hreflang="${lang}" href="${self}">
<link rel="alternate" hreflang="${lang === 'ja' ? 'en' : 'ja'}" href="${other}">
<link rel="alternate" hreflang="x-default" href="${lang === 'ja' ? self : other}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="alternate" type="text/markdown" href="${SITE}/llms.txt" title="llms.txt">
<link rel="sitemap" type="application/xml" href="${SITE}/sitemap.xml">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body class="sub">
<header class="bar">
  <a class="home" href="${root}">zumen</a>
  <nav>${up.map((u) => `<a href="${u.href}">${esc(u.text)}</a>`).join(' / ')}</nav>
</header>
<main>
${body}
</main>
<footer class="foot">
  <p><a href="https://github.com/meta-taro/zumen">GitHub</a> · MIT · <a href="${lang === 'ja' ? `${SITE}/en${path}` : `${SITE}${path}`}">${lang === 'ja' ? 'English' : '日本語'}</a></p>
</footer>
</body>
</html>
`;
}

/** 見本 1 枚のページ。 */
function samplePage(s, lang) {
  const t = lang === 'ja'
    ? { title: `${s.title} — zumen の見本 ${s.no}`, desc: s.caption, note: '正本に書いてある決まりごと', src: '正本（YAML）', near: '同じ分野の見本', made: 'この図は、下の 1 枚の YAML から描かれています。手で図形を動かしてはいません。' }
    : { title: `${s.title} — zumen example ${s.no}`, desc: s.en, note: 'What the source says', src: 'Source (YAML)', near: 'More in this field', made: 'This drawing comes from one YAML file. No shape was moved by hand.' };
  const near = (byGroup.get(s.group.key) ?? []).filter((x) => x.no !== s.no).slice(0, 8);
  const body = `<article>
  <p class="crumb">${esc(lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label)}</p>
  <h1>${esc(s.title)}</h1>
  <p class="lead">${esc(lang === 'ja' ? s.caption : s.en)}</p>
  <figure>
    <img src="../../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}" loading="lazy">
  </figure>
  <p class="made">${esc(t.made)}</p>
  ${s.note.length === 0 ? '' : `<h2>${esc(t.note)}</h2>\n  ${s.note.map((p) => `<p>${strong(p)}</p>`).join('\n  ')}`}
  <h2>${esc(t.src)}</h2>
  <p><a href="https://github.com/meta-taro/zumen/blob/main/examples/gallery/${encodeURIComponent(s.name)}.zumen.yaml"><code>examples/gallery/${esc(s.name)}.zumen.yaml</code></a></p>
  ${near.length === 0 ? '' : `<h2>${esc(t.near)}</h2>
  <ul class="near">${near.map((x) => `<li><a href="../${x.no}/">${esc(lang === 'ja' ? x.caption : x.en)}</a></li>`).join('')}</ul>`}
</article>`;
  return shell({
    lang,
    path: `/g/${s.no}/`,
    title: t.title,
    desc: t.desc,
    up: [{ href: `../../${lang === 'ja' ? '' : ''}c/${s.group.key}/`, text: lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label }],
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: s.title,
      description: lang === 'ja' ? s.caption : s.en,
      url: `${SITE}${lang === 'ja' ? '' : '/en'}/g/${s.no}/`,
      image: `${SITE}/gallery/${encodeURIComponent(s.name)}.svg`,
      inLanguage: lang,
      license: 'https://opensource.org/licenses/MIT',
      isPartOf: { '@type': 'CollectionPage', name: lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label, url: `${SITE}${lang === 'ja' ? '' : '/en'}/c/${s.group.key}/` },
      encodingFormat: 'text/yaml',
      isAccessibleForFree: true,
    },
    body,
  });
}

/** 分野 1 つのページ。 */
function groupPage(group, lang) {
  const items = byGroup.get(group.key) ?? [];
  const label = lang === 'ja' ? group.label : GROUPS_EN[group.key] ?? group.label;
  const desc = lang === 'ja'
    ? `${label}の図面 ${items.length} 枚。すべて YAML 1 枚から描いたもの。`
    : `${items.length} drawings in ${label}, each generated from a single YAML file.`;
  const body = `<article>
  <h1>${esc(label)}</h1>
  <p class="lead">${esc(desc)}</p>
  <ul class="cards">
${items.map((s) => `    <li><a href="../../${lang === 'ja' ? '' : '../'}g/${s.no}/"><img src="../../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}" loading="lazy"><span>${esc(lang === 'ja' ? s.caption : s.en)}</span></a></li>`).join('\n')}
  </ul>
</article>`;
  return shell({
    lang,
    path: `/c/${group.key}/`,
    title: lang === 'ja' ? `${label}の図面 ${items.length} 枚 — zumen` : `${label} — ${items.length} drawings — zumen`,
    desc,
    up: [{ href: `../../${lang === 'ja' ? '' : ''}`, text: lang === 'ja' ? 'すべての見本' : 'All examples' }],
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: label,
      description: desc,
      url: `${SITE}${lang === 'ja' ? '' : '/en'}/c/${group.key}/`,
      inLanguage: lang,
      hasPart: items.map((s) => ({
        '@type': 'CreativeWork',
        name: s.title,
        url: `${SITE}${lang === 'ja' ? '' : '/en'}/g/${s.no}/`,
        image: `${SITE}/gallery/${encodeURIComponent(s.name)}.svg`,
      })),
    },
    body,
  });
}

// ═════ 書き出し
const want = new Map();
for (const s of SAMPLES) {
  want.set(`site/g/${s.no}/index.html`, samplePage(s, 'ja'));
  want.set(`site/en/g/${s.no}/index.html`, samplePage(s, 'en'));
}
for (const g of CATEGORIES) {
  want.set(`site/c/${g.key}/index.html`, groupPage(g, 'ja'));
  want.set(`site/en/c/${g.key}/index.html`, groupPage(g, 'en'));
}

/** sitemap。**ページだけ出す**（図の SVG は図であってページではない）。 */
const urls = [
  { ja: `${SITE}/`, en: `${SITE}/en/` },
  ...CATEGORIES.map((g) => ({ ja: `${SITE}/c/${g.key}/`, en: `${SITE}/en/c/${g.key}/` })),
  ...SAMPLES.map((s) => ({ ja: `${SITE}/g/${s.no}/`, en: `${SITE}/en/g/${s.no}/` })),
];
want.set('site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<!--
  **組み立てもの。** \`pnpm pages\` が書く（\`scripts/pages.mjs\`）。手で直さない。
  見本の SVG は図であってページではないので出さない。
  GitHub Pages のプロジェクトページなので robots.txt は置けない
  （読まれるのは meta-taro.github.io/robots.txt で、あれは別のリポジトリのもの）。
  その代わり、ページ側に <meta name="robots"> を書いてある。
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(({ ja, en }) => [ja, en].map((loc) => `  <url>
    <loc>${loc}</loc>
    <xhtml:link rel="alternate" hreflang="ja" href="${ja}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${ja}"/>
  </url>`).join('\n')).join('\n')}
</urlset>
`);

if (check) {
  const stale = [...want].filter(([path, text]) => {
    try {
      return readFileSync(path, 'utf8') !== text;
    } catch {
      return true;
    }
  }).map(([path]) => path);
  if (stale.length > 0) {
    console.error(`古いページが ${stale.length} 件あります。\`pnpm pages\` で組み立て直してください。`);
    console.error(stale.slice(0, 10).join('\n'));
    process.exit(1);
  }
  console.log(`ページ ${want.size} 件は、すべて最新です。`);
} else {
  // **消えた見本のページは消す。** 残すと、404 にならない古い URL が出続ける。
  for (const dir of ['site/g', 'site/en/g', 'site/c', 'site/en/c']) {
    if (existsSync(dir)) rmSync(dir, { recursive: true });
  }
  for (const [path, text] of want) {
    mkdirSync(path.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(path, text);
  }
  console.log(`ページを ${want.size} 件、組み立て直しました（分野 ${CATEGORIES.length * 2} ／ 見本 ${SAMPLES.length * 2}）。`);
}
