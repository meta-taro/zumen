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
  let table = [];
  const flush = () => {
    if (now.length > 0) paras.push(now.join(''));
    now = [];
    if (table.length > 0) paras.push({ table });
    table = [];
  };
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    // **表の行は繋がない。** 繋ぐと 1 行に潰れる。
    if (line.trim().startsWith('|')) {
      if (now.length > 0) { paras.push(now.join('')); now = []; }
      table.push(line);
      continue;
    }
    if (table.length > 0) { paras.push({ table }); table = []; }
    now.push(line.trim());
  }
  if (table.length > 0) { paras.push({ table }); table = []; }
  if (now.length > 0) paras.push(now.join(''));
  return paras.filter((p) => typeof p !== 'string' || !p.startsWith('##'));
}

/**
 * **正本の見出しに書いた表を、表として出す**（2026-09-24）。
 *
 * `noteOf` は空行までを 1 段落として繋ぐので、**表の行がぜんぶ 1 行に潰れていた** ——
 * 見本 128 のページには `| ||---|---|| a | 真円（半径 R）と、縦棒 1 本 || u | …` と出ていた。
 * **17 枚・100 行**が同じ崩れ方をしていた。
 *
 * 正本は Markdown の書き方で書いてあるので、そのまま `<table>` にする。
 * **区切りの行（`|---|---|`）は捨てる。**
 */
function tableOf(lines) {
  const rows = lines
    // **区切りの行だけを捨てる。** `-` を含むものが区切り ——
    // `| | |`（見出しの無い表）まで捨てると、1 行目のデータが見出しに化ける。
    .filter((l) => !/^\|[\s:|-]*-[\s:|-]*\|$/.test(l.trim()))
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  if (rows.length === 0) return '';
  const cells = (cols, tag) => cols.map((c) => `<${tag}>${strong(c)}</${tag}>`).join('');
  /**
   * **見出しの無い表がある**（`| | |` と書いてあるもの。17 枚中 12 枚）。
   *
   * そこを捨てて 1 行目を見出しにすると、**データが見出しに化ける** ——
   * 見本 128 で `a | 真円（半径 R）と、縦棒 1 本` が見出しになった。
   * **空なら見出しを出さない。**
   */
  const [head, ...rest] = rows;
  if (head.every((c) => c === '')) {
    return `<table class="note bare">
  <tbody>${rest.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody>
</table>`;
  }
  return `<table class="note">
  <thead><tr>${cells(head, 'th')}</tr></thead>
  <tbody>${rest.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody>
</table>`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/**
 * 正本の書き方を、そのままページへ持ってくる。
 *
 * - `**ここ**` → `<strong>`
 * - **バッククォート** → `<code>`（2026-09-24。生のまま出ていた ——
 *   見本 128 のページに `` `after` で繋ぐと `` と出ていたのがそれ）
 */
const strong = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

/**
 * **パンくずの構造化データ**（2026-09-24）。
 *
 * 見える形（`up`）と同じ並びを返す。**食い違わせない** ——
 * 検索結果に出るのはこちらで、人が見るのはあちら。
 */
const crumbs = (lang, steps) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'zumen', item: `${SITE}${lang === 'ja' ? '/' : '/en/'}` },
    ...steps.map((one, i) => ({
      '@type': 'ListItem',
      position: i + 2,
      name: one.name,
      ...(one.url === undefined ? {} : { item: one.url }),
    })),
  ],
});

/** `<img>` に付ける寸法。**無ければ付けない**（付けないほうが、嘘の寸法より良い）。 */
const dims = (s) => (s.size === null ? '' : ` width="${s.size.w}" height="${s.size.h}"`);

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
      /**
       * **図の寸法**（2026-09-24）。`<img>` に `width` / `height` を付けるため。
       *
       * 付いていなかったので、**読み込む前の高さが 0 になり、`loading=lazy` が
       * 発火せず、カードの図が 1 枚も出ていなかった**（分野ページ 13 枚と `/all/`）。
       * 入口のページ（`scripts/gallery.mjs`）は前から付けていた。
       *
       * 寸法があると**読み込む前に場所が決まる**ので、
       * 字が飛び跳ねない（CLS）。検索の評価にも効く。
       */
      size: (() => {
        const svg = readFileSync(join(DIR, `${item.name}.svg`), 'utf8').slice(0, 300);
        const found = /width="(\d+)" height="(\d+)"/.exec(svg);
        return found === null ? null : { w: found[1], h: found[2] };
      })(),
      group,
    });
  }
}
SAMPLES.sort((a, b) => Number(a.no) - Number(b.no));
const byGroup = new Map(CATEGORIES.map((g) => [g.key, SAMPLES.filter((s) => s.group.key === g.key)]));

/** ページの殻。**どのページも同じ形**にして、差は中身だけにする。 */
function shell({ lang, path, title, desc, jsonld, body, up, image, imageAlt }) {
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
<meta property="og:image" content="${image ?? `${SITE}/og.png`}">
<meta property="og:image:alt" content="${esc(imageAlt ?? (lang === 'ja' ? '歯周チャートと路線図。どちらも zumen が YAML から描いたもの。' : 'A periodontal chart and a transit map, both drawn by zumen from YAML.'))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${image ?? `${SITE}/og.png`}">
<meta name="twitter:image:alt" content="${esc(imageAlt ?? (lang === 'ja' ? '歯周チャートと路線図。どちらも zumen が YAML から描いたもの。' : 'A periodontal chart and a transit map, both drawn by zumen from YAML.'))}">
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
  <!--
    パンくず（2026-09-24）。入口から現在地まで一本で出す。
    aria-label を付けて、読み上げでも「ここは道案内」と分かるようにする。
    区切りの記号は aria-hidden（読み上げると邪魔なだけ）。
  -->
  <nav class="crumbs" aria-label="${lang === 'ja' ? 'パンくず' : 'Breadcrumb'}">
    <a class="home" href="${root}">zumen</a>${up
      .map((u) => `<span aria-hidden="true">›</span><a href="${u.href}">${esc(u.text)}</a>`)
      .join('')}
  </nav>
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
  /**
   * **検索結果に出る文は、題の言い直しにしない**（2026-09-22。86 周目）。
   *
   * 測ったら **344 枚すべてが 70 字未満**で、**64 枚は題とまったく同じ**だった。
   * `alt`（図に何が描いてあるか）は 20 字の下限を通して書き直してあるので、
   * **そちらを使う。** 長すぎる分は文の切れ目で落とす。
   */
  const fit = (text, limit) => {
    const flat = String(text).replace(/\s+/g, ' ').trim();
    if (flat.length <= limit) return flat;
    const cut = flat.slice(0, limit);
    const stop = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('、'), cut.lastIndexOf(', '), cut.lastIndexOf('. '));
    return `${(stop > limit * 0.5 ? cut.slice(0, stop) : cut).trim()}…`;
  };
  /**
   * **繋げる前に、重なりを見る**（2026-09-22。88 周目）。
   *
   * 題と `alt` をそのまま繋げたら、**見本 7 が「稟議の流れ。稟議の流れ。…」**になった。
   * 題の言い直しが `alt` の先頭に来ている図が多い。
   *
   * 繋げるのは**中身が増えるときだけ**。増えないなら、
   * **正本の説明（`note` の 1 段落目 ＝ その図の見どころ）**を使う。そちらのほうが濃い。
   */
  /**
   * **検索結果に出る文からは、書き方の記号を落とす**（2026-09-24）。
   *
   * `**` は前から落としていたが、**バッククォートが残っていた** ——
   * `meta description` と構造化データに `` `after` で繋ぐと `` と出ていた。
   * ページの中では `<code>` になるが、**ここは地の文として読まれる。**
   */
  const flat = (text) => String(text).replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  /**
   * **繋げる前に、重なりを見る**（2026-09-22。88 周目）。
   *
   * 題と `alt` をそのまま繋げたら **見本 7 が「稟議の流れ。稟議の流れ。…」**になった
   * （題の言い直しが `alt` の先頭に来ている図が多い）。
   * 逆に「重なったら捨てる」にしたら、今度は**題だけ 6 字**になった（見本 2）。
   *
   * **いちばん中身のあるものを 1 つ選ぶ。**
   * それが題を含んでいるならそれだけを使い、含んでいないなら題に足す。
   */
  const summary = (() => {
    const head = flat(lang === 'ja' ? s.caption : s.en);
    if (lang !== 'ja') return fit(head, 150);
    // **note は 1 段落目とは限らない。** 題より長いものを、前のほうから探す。
    const best = [flat(s.alt), ...s.note.filter((p) => typeof p === 'string').map(flat)]
      .filter((one) => one.length > head.length)
      .sort((a, b) => b.length - a.length)[0];
    if (best === undefined) return fit(head, 150);
    return best.startsWith(head.replace(/[（(].*$/, '')) ? fit(best, 150) : fit(`${head}。${best}`, 150);
  })();

  const t = lang === 'ja'
    ? { title: `${s.title} — zumen の見本 ${s.no}`, desc: summary, note: '正本に書いてある決まりごと', src: '正本（YAML）', near: '同じ分野の見本', made: 'この図は、下の 1 枚の YAML から描かれています。手で図形を動かしてはいません。' }
    : { title: `${s.title} — zumen example ${s.no}`, desc: summary, note: 'What the source says', src: 'Source (YAML)', near: 'More in this field', made: 'This drawing comes from one YAML file. No shape was moved by hand.' };
  const near = (byGroup.get(s.group.key) ?? []).filter((x) => x.no !== s.no).slice(0, 8);
  /**
   * **前へ・次へ**（2026-09-24。オーナーの指摘「**徘徊機能がない**」）。
   *
   * ここまでの作りは、**検索や SNS から 1 枚に降りてくる人**のためのものだった
   * （見本ごとの `og:image`・パンくず・構造化データ）。
   * **降りてきた人が隣を見に行く道が無かった。**
   *
   * 番号順で、端は輪にする（最後の次は最初）。**344 枚を順に見ていける。**
   */
  const at = SAMPLES.findIndex((x) => x.no === s.no);
  const prev = SAMPLES[(at - 1 + SAMPLES.length) % SAMPLES.length];
  const next = SAMPLES[(at + 1) % SAMPLES.length];
  const stepText = (x) => fit(lang === 'ja' ? x.caption : x.en, 28);
  const steps = `<nav class="steps" aria-label="${lang === 'ja' ? '前後の見本' : 'Previous and next'}">
    <a class="step prev" href="../${prev.no}/" rel="prev"><span>←</span> ${esc(stepText(prev))}</a>
    <a class="step index" href="../../${lang === 'ja' ? '' : ''}all/">${lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length}`}</a>
    <a class="step next" href="../${next.no}/" rel="next">${esc(stepText(next))} <span>→</span></a>
  </nav>`;
  const body = `<article>
  <p class="crumb">${esc(lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label)}</p>
  <h1>${esc(s.title)}</h1>
  <p class="lead">${strong(lang === 'ja' ? s.caption : s.en)}</p>
  <figure>
    <img src="../../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}" loading="lazy">
  </figure>
  <p class="made">${esc(t.made)}</p>
  ${s.note.length === 0 ? '' : `<h2>${esc(t.note)}</h2>\n  ${s.note.map((p) => (typeof p === 'string' ? `<p>${strong(p)}</p>` : tableOf(p.table))).join('\n  ')}`}
  <h2>${esc(t.src)}</h2>
  <p><a href="https://github.com/meta-taro/zumen/blob/main/examples/gallery/${encodeURIComponent(s.name)}.zumen.yaml"><code>examples/gallery/${esc(s.name)}.zumen.yaml</code></a></p>
  ${near.length === 0 ? '' : `<h2>${esc(t.near)}</h2>
  <ul class="near">${near.map((x) => `<li><a href="../${x.no}/">${esc(lang === 'ja' ? x.caption : x.en)}</a></li>`).join('')}</ul>`}
  ${steps}
</article>`;
  return shell({
    lang,
    path: `/g/${s.no}/`,
    title: t.title,
    desc: t.desc,
    /**
     * **見本ごとの共有カード**（`scripts/og-samples.mjs` が描く。2026-09-22）。
     * X・Slack・Facebook は SVG を描画しないので、**PNG が要る**。
     *
     * **無ければ指さない**（ベースルール §23。参照だけ足して中身が無い状態を作らない）。
     * カードは重いので、見本が増えた直後は追いついていないことがある。
     * そのときは全体のカード（`site/og.png`）に落ちる —— 空の枠よりまし。
     */
    image: existsSync(`site/og/${s.no}.png`) ? `${SITE}/og/${s.no}.png` : undefined,
    imageAlt: fit(lang === 'ja' ? s.alt : s.en, 140),
    /**
     * **パンくずは通しで出す**（2026-09-24。オーナーの指摘）。
     *
     * 前は `zumen / 分野` の 2 段で、**間の「すべての見本」が抜けていた。**
     * `/all/` を作ったので、**入口 → すべての見本 → 分野 → この図**が一本に繋がる。
     * 構造化データ（`BreadcrumbList`）も同じ並びにする。**見える形と食い違わせない。**
     */
    up: [
      { href: `../../all/`, text: lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length}` },
      { href: `../../c/${s.group.key}/`, text: lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label },
    ],
    /**
     * **検索結果に出す構造化データ**（2026-09-22。86 周目）。
     *
     * 前は `CreativeWork` 1 つだけだった。足したのは 2 つ ——
     * **パンくず**（分野 → この図、が検索結果に出る）と、
     * **`ImageObject`**（図そのものに `caption` と `description` が付く。画像検索に効く）。
     */
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: s.title,
        headline: s.title,
        description: summary,
        url: `${SITE}${lang === 'ja' ? '' : '/en'}/g/${s.no}/`,
        image: {
          '@type': 'ImageObject',
          contentUrl: `${SITE}/gallery/${encodeURIComponent(s.name)}.svg`,
          caption: lang === 'ja' ? s.caption : s.en,
          description: lang === 'ja' ? s.alt : s.en,
          encodingFormat: 'image/svg+xml',
          license: 'https://opensource.org/licenses/MIT',
          acquireLicensePage: 'https://github.com/meta-taro/zumen/blob/main/LICENSE',
          creditText: 'zumen',
        },
        inLanguage: lang,
        license: 'https://opensource.org/licenses/MIT',
        isPartOf: { '@type': 'CollectionPage', name: lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label, url: `${SITE}${lang === 'ja' ? '' : '/en'}/c/${s.group.key}/` },
        encodingFormat: 'text/yaml',
        isAccessibleForFree: true,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'zumen', item: `${SITE}${lang === 'ja' ? '/' : '/en/'}` },
          {
            '@type': 'ListItem',
            position: 2,
            name: lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length} examples`,
            item: `${SITE}${lang === 'ja' ? '' : '/en'}/all/`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: lang === 'ja' ? s.group.label : GROUPS_EN[s.group.key] ?? s.group.label,
            item: `${SITE}${lang === 'ja' ? '' : '/en'}/c/${s.group.key}/`,
          },
          { '@type': 'ListItem', position: 4, name: s.title },
        ],
      },
    ],
    body,
  });
}

/** 分野 1 つのページ。 */
/**
 * **全部が 1 枚に並ぶページ**（`/all/`。2026-09-24）。
 *
 * オーナーの指摘 ——「個別ページはありますが、**徘徊機能がないのは意図していますか**」。
 * **意図していなかった。** 入口は分野ごとの入口で、
 * **344 枚が 1 枚に並んだページが無かった。**
 *
 * 検索から降りてきた人が「**どれだけあるのか**」を一目で掴める場所。
 * 分野で区切って並べ、**絞り込みはここに載せる**（`site/all.js`）。
 */
function allPage(lang) {
  const desc = lang === 'ja'
    ? `zumen の見本 ${SAMPLES.length} 枚を 1 枚に並べたページ。分野は ${CATEGORIES.length} つ。題・分野で絞り込めます。`
    : `All ${SAMPLES.length} zumen examples on one page, across ${CATEGORIES.length} fields. Filter by title or field.`;
  const body = `<article class="all">
  <h1>${lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length} examples`}</h1>
  <p class="lead">${esc(desc)}</p>
  <div class="sift">
    <input id="q" type="search" autocomplete="off"
      placeholder="${lang === 'ja' ? '題や分野で絞る（例: 避難、配線、halftone）' : 'Filter by title or field'}"
      aria-label="${lang === 'ja' ? '絞り込み' : 'Filter'}">
    <p id="hit" class="hit" role="status">${lang === 'ja' ? `${SAMPLES.length} 枚` : `${SAMPLES.length} shown`}</p>
  </div>
${CATEGORIES.map((g) => {
  const items = byGroup.get(g.key) ?? [];
  if (items.length === 0) return '';
  const label = lang === 'ja' ? g.label : GROUPS_EN[g.key] ?? g.label;
  return `  <section class="field" data-field="${esc(label)}">
    <h2><a href="../${lang === 'ja' ? '' : ''}c/${g.key}/">${esc(label)}</a> <small>${items.length}</small></h2>
    <ul class="cards">
${items.map((s) => `      <li data-name="${esc(`${s.no} ${s.caption} ${s.en} ${label}`)}"><a href="../${lang === 'ja' ? '' : ''}g/${s.no}/"><img src="../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}"${dims(s)} loading="lazy" decoding="async"><span>${esc(lang === 'ja' ? s.caption : s.en)}</span></a></li>`).join('\n')}
    </ul>
  </section>`;
}).filter(Boolean).join('\n')}
</article>
<script src="../${lang === 'ja' ? '' : '../'}all.js" defer></script>`;
  return shell({
    lang,
    path: '/all/',
    title: lang === 'ja' ? `見本 ${SAMPLES.length} 枚をすべて — zumen` : `All ${SAMPLES.length} examples — zumen`,
    desc,
    // 入口は `zumen` のほうが出しているので、ここは現在地だけ。
    up: [],
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: lang === 'ja' ? `zumen の見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length} zumen examples`,
        description: desc,
        url: `${SITE}${lang === 'ja' ? '' : '/en'}/all/`,
        numberOfItems: SAMPLES.length,
        inLanguage: lang,
      },
      crumbs(lang, [{ name: lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length} examples` }]),
    ],
    body,
  });
}

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
${items.map((s) => `    <li><a href="../../${lang === 'ja' ? '' : '../'}g/${s.no}/"><img src="../../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}"${dims(s)} loading="lazy" decoding="async"><span>${esc(lang === 'ja' ? s.caption : s.en)}</span></a></li>`).join('\n')}
  </ul>
</article>`;
  return shell({
    lang,
    path: `/c/${group.key}/`,
    title: lang === 'ja' ? `${label}の図面 ${items.length} 枚 — zumen` : `${label} — ${items.length} drawings — zumen`,
    desc,
    up: [{ href: `../../all/`, text: lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length}` }],
    jsonld: [
      {
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
      crumbs(lang, [
        { name: lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length} examples`, url: `${SITE}${lang === 'ja' ? '' : '/en'}/all/` },
        { name: label },
      ]),
    ],
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
want.set('site/all/index.html', allPage('ja'));
want.set('site/en/all/index.html', allPage('en'));

/** sitemap。**ページだけ出す**（図の SVG は図であってページではない）。 */
const urls = [
  { ja: `${SITE}/`, en: `${SITE}/en/` },
  { ja: `${SITE}/all/`, en: `${SITE}/en/all/` },
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
  /**
   * **図は毎回ぜんぶ写す**（2026-09-22。89 周目）。
   *
   * 前は `site/gallery/` に **102 枚だけが commit されていた**（見本 01〜51 の頃の残り）。
   * 配るときは workflow が `examples/gallery/` から写し直すので**本番は正しかった**が、
   * 手元で開くと 688 枚のうち 15% しか出ず、**壊れているように見えた**（実際に一度そう誤読した）。
   *
   * 中途半端に置くのをやめて、**写す係をここに一本化した**。
   * `site/gallery/` は追跡しない（`.gitignore`）。正本は `examples/gallery/` の 1 つだけ。
   */
  mkdirSync('site/gallery', { recursive: true });
  let copied = 0;
  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.svg'))) {
    const from = join(DIR, name);
    const to = join('site/gallery', name);
    const text = readFileSync(from, 'utf8');
    if (existsSync(to) && readFileSync(to, 'utf8') === text) continue;
    writeFileSync(to, text);
    copied += 1;
  }
  // **要らなくなった図は消す。** 残すと、消したはずの見本が手元でだけ開ける。
  let dropped = 0;
  for (const name of readdirSync('site/gallery')) {
    if (existsSync(join(DIR, name))) continue;
    rmSync(join('site/gallery', name));
    dropped += 1;
  }
  console.log(`ページを ${want.size} 件、組み立て直しました（分野 ${CATEGORIES.length * 2} ／ 見本 ${SAMPLES.length * 2}）。`);
  console.log(`図を site/gallery/ へ写しました（新しく ${copied} 枚／古いのを ${dropped} 枚 外した）。`);
}
