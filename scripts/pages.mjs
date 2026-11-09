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
import { TITLES_EN } from './titles-en.mjs';
import { drawnText } from '../src/examples.ts';

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
      titleEn: TITLES_EN[item.name],
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
/**
 * **英語のページの題**（2026-10-15）。
 *
 * 英語のページで `<h1>`・`<title>`・`og:title`・構造化データの題が**日本語のまま**だった
 * （英語にしていたのはキャプションだけ）。題が日本語の見本は `titles-en.mjs` から引き、
 * 題がもともと英語の見本はそのまま使う。
 */
const titleOf = (s, lang) => (lang === 'ja' ? s.title : s.titleEn ?? s.title);
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
/**
 * **英語の見本の説明を、70 字に満たせる**（2026-11-08）。
 *
 * 英語は題の言い直し（`CAPTIONS_EN`）しか持っていないので、101 枚が 70 字未満だった
 * （"Cutting layout: the pattern may not be turned"）。
 * 題の `（）` に入っている具体（布幅・用尺・寸法）を足し、それでも短ければ分野を言う。
 */
function enSummary(s, head) {
  const detail = titleOf(s, 'en').match(/\(([^)]*)\)\s*$/)?.[1];
  const withDetail = detail !== undefined && !head.includes(detail) ? `${head} — ${detail}.` : head;
  if (withDetail.length >= 70) return withDetail;
  const field = GROUPS_EN[s.group.key] ?? s.group.label;
  return `${withDetail.replace(/\.?$/, '.')} An example from ${field}, drawn from one YAML file with zumen.`;
}

/**
 * **分野のページの説明に、そこにある図の名前を入れる**（2026-11-08）。
 *
 * 13 枚とも「○○の図面 N 枚。すべて YAML 1 枚から描いたもの。」だけで、
 * 検索結果を見た人に**何の図があるかが 1 語も届いていなかった。**
 * 題の `（）` の前（図の種類の名前）を、字数に収まるだけ並べる。
 */
function groupDesc(label, items, lang) {
  // **名前は題から取る。** カードの字（caption）は「フレット：…」のような言い切りが多く、頭だけでは図の種類にならない。
  // 日本語のページで題が英語のもの（米国の様式を写した見本）は、カードの字（日本語）から取る。
  const nameOf = (s) => (lang === 'ja' && !/[ぁ-んァ-ヶ一-龥]/.test(s.title) ? s.caption : titleOf(s, lang));
  const names = [...new Set(items.map((s) => nameOf(s).replace(/\s*[（(—].*$/, '').trim()))];
  const head = lang === 'ja' ? `${label}の図面 ${items.length} 枚 ── ` : `${items.length} drawings in ${label} — `;
  const tail = lang === 'ja' ? 'など。どれも YAML 1 枚から描いた図です。' : ', and more, each from one YAML file.';
  const limit = lang === 'ja' ? 120 : 200;
  const sep = lang === 'ja' ? '・' : ', ';
  const picked = [];
  for (const name of names) {
    if ((head + [...picked, name].join(sep) + tail).length > limit) break;
    picked.push(name);
  }
  return `${head}${picked.join(sep)}${tail}`;
}

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
    if (lang !== 'ja') return fit(enSummary(s, head), 150);
    // **note は 1 段落目とは限らない。** 題より長いものを、前のほうから探す。
    const best = [flat(s.alt), ...s.note.filter((p) => typeof p === 'string').map(flat)]
      .filter((one) => one.length > head.length)
      .sort((a, b) => b.length - a.length)[0];
    if (best === undefined) return fit(head, 150);
    return best.startsWith(head.replace(/[（(].*$/, '')) ? fit(best, 150) : fit(`${head}。${best}`, 150);
  })();

  const t = lang === 'ja'
    ? { title: `${s.title} — zumen の見本 ${s.no}`, desc: summary, note: '正本に書いてある決まりごと', src: '正本（YAML）', near: '同じ分野の見本', made: 'この図は、下の 1 枚の YAML から描かれています。手で図形を動かしてはいません。' }
    : { title: `${titleOf(s, lang)} — zumen example ${s.no}`, desc: summary, note: 'Notes in the source (in Japanese)', src: 'Source (YAML)', near: 'More in this field', made: 'This drawing comes from one YAML file. No shape was moved by hand.' };
  const near = (byGroup.get(s.group.key) ?? []).filter((x) => x.no !== s.no).slice(0, 8);
  /**
   * **前へ・次へ**（2026-09-24。見本から見本へ渡り歩く道が無いという指摘）。
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
  <h1>${esc(titleOf(s, lang))}</h1>
  <p class="lead">${strong(lang === 'ja' ? s.caption : s.en)}</p>
  <figure>
    <img src="../../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}" loading="lazy">
  </figure>
  <p class="made">${esc(t.made)}</p>
  ${s.note.length === 0 ? '' : `<h2>${esc(t.note)}</h2>\n  ${lang === 'ja' ? '' : '<div lang="ja">\n  '}${s.note.map((p) => (typeof p === 'string' ? `<p>${strong(p)}</p>` : tableOf(p.table))).join('\n  ')}${lang === 'ja' ? '' : '\n  </div>'}`}
  <h2>${esc(t.src)}</h2>
  <p><a href="https://github.com/meta-taro/zumen/blob/main/examples/gallery/${encodeURIComponent(s.name)}.zumen.yaml"><code>examples/gallery/${esc(s.name)}.zumen.yaml</code></a></p>
  ${near.length === 0 ? '' : `<h2>${esc(t.near)}</h2>
  <ul class="cards">
${near.map((x) => `    <li><a href="../${x.no}/"><img src="../../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(x.name)}.svg" alt="${esc(lang === 'ja' ? x.alt : x.en)}"${dims(x)} loading="lazy" decoding="async"><span>${esc(lang === 'ja' ? x.caption : x.en)}</span></a></li>`).join('\n')}
  </ul>`}
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
     * **無ければ指さない**（参照だけ足して中身が無い状態を作らない）。
     * カードは重いので、見本が増えた直後は追いついていないことがある。
     * そのときは全体のカード（`site/og.png`）に落ちる —— 空の枠よりまし。
     */
    // 英語のページには英語の帯のカード（`site/en/og/`）。無ければ日本語のカードへ落ちる。
    image: lang === 'en' && existsSync(`site/en/og/${s.no}.png`)
      ? `${SITE}/en/og/${s.no}.png`
      : existsSync(`site/og/${s.no}.png`) ? `${SITE}/og/${s.no}.png` : undefined,
    imageAlt: fit(lang === 'ja' ? s.alt : s.en, 140),
    /**
     * **パンくずは通しで出す**（2026-09-24。指摘）。
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
        name: titleOf(s, lang),
        headline: titleOf(s, lang),
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
          { '@type': 'ListItem', position: 4, name: titleOf(s, lang) },
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
 * 個別ページから次の見本へ渡り歩く道が無い、という指摘。
 * **意図していなかった。** 入口は分野ごとの入口で、
 * **344 枚が 1 枚に並んだページが無かった。**
 *
 * 検索から降りてきた人が「**どれだけあるのか**」を一目で掴める場所。
 * 分野で区切って並べ、**絞り込みはここに載せる**（`site/all.js`）。
 */
/**
 * **検索欄の候補**（`<datalist>`。2026-11-07）。
 *
 * 何があるかを知らない人は、何を打てばよいかも分からない。**分野と、見本の題**を候補に出す。
 * 候補は手がかりで、ここに無い語（図の中の字）を打っても当たる。
 */
function namesList(lang) {
  const fields = CATEGORIES.map((g) => (lang === 'ja' ? g.label : GROUPS_EN[g.key] ?? g.label));
  const titles = SAMPLES.map((s) => (lang === 'ja' ? s.caption : s.en));
  const options = [...new Set([...fields, ...titles])].map((v) => `<option value="${esc(v)}">`);
  return `<!-- names -->\n  <datalist id="names">\n${options.map((o) => `    ${o}`).join('\n')}\n  </datalist>\n  <!-- /names -->`;
}

function allPage(lang) {
  const desc = lang === 'ja'
    ? `zumen の見本 ${SAMPLES.length} 枚を、${CATEGORIES.length} の分野に分けて 1 ページに並べました。題・分野だけでなく、図の中に描いてある字でも絞り込めます。`
    : `All ${SAMPLES.length} zumen examples on one page, across ${CATEGORIES.length} fields. Filter by title, field, or any text drawn inside the diagrams.`;
  const body = `<article class="all">
  <h1>${lang === 'ja' ? `見本 ${SAMPLES.length} 枚` : `All ${SAMPLES.length} examples`}</h1>
  <p class="lead">${esc(desc)}</p>
  <div class="sift">
    <input id="q" name="q" list="names" type="search" autocomplete="off" data-index="../${lang === 'ja' ? '' : '../'}search.json"
      placeholder="${lang === 'ja' ? '題・分野・図の中の字で絞る（例: 電流計、受検番号、DMX）' : 'Filter by title, field or any text inside the drawings'}"
      aria-label="${lang === 'ja' ? '絞り込み' : 'Filter'}">
    <p id="hit" class="hit" role="status">${lang === 'ja' ? `${SAMPLES.length} 枚` : `${SAMPLES.length} shown`}</p>
  </div>
  ${namesList(lang)}
${CATEGORIES.map((g) => {
  const items = byGroup.get(g.key) ?? [];
  if (items.length === 0) return '';
  const label = lang === 'ja' ? g.label : GROUPS_EN[g.key] ?? g.label;
  return `  <section class="field" data-field="${esc(label)}">
    <h2><a href="../${lang === 'ja' ? '' : ''}c/${g.key}/">${esc(label)}</a> <small>${items.length}</small></h2>
    <ul class="cards">
${items.map((s) => `      <li data-no="${s.no}" data-name="${esc(`${s.no} ${s.caption} ${s.en} ${label}`)}"><a href="../${lang === 'ja' ? '' : ''}g/${s.no}/"><img src="../${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(s.name)}.svg" alt="${esc(lang === 'ja' ? s.alt : s.en)}"${dims(s)} loading="lazy" decoding="async"><span>${esc(lang === 'ja' ? s.caption : s.en)}</span></a></li>`).join('\n')}
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
  const desc = groupDesc(label, items, lang);
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
          name: titleOf(s, lang),
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
/**
 * **ダウンロード・過去の版・ロードマップ**（2026-11-09）。
 *
 * OSS の紹介ページの決まり（姉妹の tadori と揃える）から、zumen に足りなかった 3 枚。
 * - 版数をページに書かない。ボタンは `site/download.js` が GitHub のリリースから作る
 *   （JS が無くても、リリースのページへの道は残る）
 * - ロードマップは README に書いてあることだけで組む（非公開の記録から持ち出さない）
 */
const RELEASES_URL = 'https://github.com/meta-taro/zumen/releases';
const INSTALL_URL = 'https://github.com/meta-taro/zumen/blob/develop/docs/install.md';

const DL_WORD = {
  ja: {
    title: 'zumen をダウンロード — macOS・Windows',
    h1: 'zumen をダウンロード',
    desc: 'zumen のデスクトップアプリ。macOS と Windows（x64・ARM）向け。見ている PC に合うものに「この PC」と印を付けます。無料・MIT ライセンス。',
    lead: 'お使いの PC に合うものを選んでください。見ている PC が分かれば「この PC」と印を付けています。',
    loading: '最新の版を GitHub から読んでいます…',
    pick: 'リリースのページから選ぶ',
    cards: [
      ['mac-arm', 'macOS', 'Apple シリコン（M1・M2・M3・M4 など）'],
      ['mac-intel', 'macOS', 'Intel の CPU（次の版から。Apple シリコンと同じ 1 本に入ります）'],
      ['win-x64', 'Windows', 'x64（Intel・AMD の CPU。ふつうの Windows はこちら）'],
      ['win-arm', 'Windows', 'ARM（Snapdragon などの CPU）'],
    ],
    past: '過去の版はこちら →',
    before: '入れる前に',
    alpha: '<b>アルファ版です。</b>署名していないので、受け取った機械は警告を出します。<b>まだ日常の道具にしないでください。</b>',
    which: 'どちらの CPU か分からないとき',
    whichList: [
      '<b>macOS</b>：アップルメニュー ›「この Mac について」の「チップ」が Apple M… なら Apple シリコン、「プロセッサ」が Intel… なら Intel です。',
      '<b>Windows</b>：設定 › システム ›「バージョン情報」の「システムの種類」が「x64 ベース」なら x64、「ARM ベース」なら ARM です。',
    ],
    first: '初めて開くとき',
    firstList: [
      '<b>置いてそのまま起動できる物がおすすめです</b>（mac は <code>zumen-macos-app.tar.gz</code>、Windows は <code>zumen-windows-*.exe</code>）。インストーラより確実に開きます。',
      '<b>macOS</b>：「壊れているため開けません」と出たら、Finder で zumen を右クリック ›「開く」を選びます。',
      '<b>Windows</b>：「Windows によって PC が保護されました」と出たら、「詳細情報」›「実行」を選びます。',
    ],
    more: 'くわしい入れ方',
    mcp: '<b>AI エージェントから描かせるだけなら、アプリは要りません。</b>MCP サーバーは Node.js（22.18 以上）だけで動きます。',
    crumb: 'ダウンロード',
  },
  en: {
    title: 'Download zumen — macOS and Windows',
    h1: 'Download zumen',
    desc: 'The zumen desktop app for macOS and Windows (x64 and ARM). The build that fits the computer you are on is marked "This PC". Free, MIT licence.',
    lead: 'Pick the one that fits your computer. When we can tell which computer you are on, it is marked "This PC".',
    loading: 'Reading the latest release from GitHub…',
    pick: 'Pick from the releases page',
    cards: [
      ['mac-arm', 'macOS', 'Apple silicon (M1, M2, M3, M4 and so on)'],
      ['mac-intel', 'macOS', 'Intel (from the next release, in the same build as Apple silicon)'],
      ['win-x64', 'Windows', 'x64 (Intel or AMD — most Windows PCs)'],
      ['win-arm', 'Windows', 'ARM (Snapdragon and similar)'],
    ],
    past: 'Older releases →',
    before: 'Before you install',
    alpha: '<b>This is an alpha.</b> It is not code-signed, so your computer will warn you. <b>Please do not rely on it for daily work yet.</b>',
    which: 'Not sure which CPU you have?',
    whichList: [
      '<b>macOS</b>: Apple menu › About This Mac. "Chip: Apple M…" means Apple silicon; "Processor: Intel…" means Intel.',
      '<b>Windows</b>: Settings › System › About. "System type: x64-based" means x64; "ARM-based" means ARM.',
    ],
    first: 'Opening it for the first time',
    firstList: [
      '<b>The run-without-installing builds are the safest bet</b> (<code>zumen-macos-app.tar.gz</code> on a Mac, <code>zumen-windows-*.exe</code> on Windows). They open more reliably than the installers.',
      '<b>macOS</b>: if it says the app "is damaged and can’t be opened", right-click zumen in Finder and choose Open.',
      '<b>Windows</b>: if it says "Windows protected your PC", choose More info › Run anyway.',
    ],
    more: 'Full install guide (Japanese)',
    mcp: '<b>To let an AI agent draw, you do not need the app.</b> The MCP server runs on Node.js 22.18 or later alone.',
    crumb: 'Download',
  },
};

function downloadPage(lang) {
  const w = DL_WORD[lang];
  const base = lang === 'ja' ? '../' : '../../';
  const body = `<article class="dl-page">
  <h1>${w.h1}</h1>
  <p class="lead">${esc(w.lead)}</p>
  <div data-downloads>
    <p data-release-status class="note">${esc(w.loading)}</p>
    <div class="dl-grid">
${w.cards.map(([id, os, cpu]) => `      <div class="dl" data-kind="${id}">
        <h3>${os}</h3>
        <p class="cpu">${esc(cpu)}</p>
        <div class="files"><a class="btn" href="${RELEASES_URL}/latest">${esc(w.pick)}</a></div>
      </div>`).join('\n')}
    </div>
    <p><a href="../releases/">${esc(w.past)}</a></p>
  </div>
  <h2>${w.before}</h2>
  <div class="warn">${w.alpha}</div>
  <h3>${w.which}</h3>
  <ul>
${w.whichList.map((li) => `    <li>${li}</li>`).join('\n')}
  </ul>
  <h3>${w.first}</h3>
  <ul>
${w.firstList.map((li) => `    <li>${li}</li>`).join('\n')}
  </ul>
  <p>${w.mcp} <a href="${INSTALL_URL}">${esc(w.more)}</a></p>
</article>
<script src="${base}download.js" defer></script>`;
  return shell({
    lang,
    path: '/download/',
    title: w.title,
    desc: w.desc,
    up: [],
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'zumen',
        url: `${SITE}${lang === 'ja' ? '' : '/en'}/download/`,
        downloadUrl: `${RELEASES_URL}/latest`,
        applicationCategory: 'DesignApplication',
        operatingSystem: 'macOS, Windows',
        license: 'https://opensource.org/licenses/MIT',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: lang === 'ja' ? 'JPY' : 'USD' },
        inLanguage: lang,
      },
      crumbs(lang, [{ name: w.crumb }]),
    ],
    body,
  });
}

const PAST_WORD = {
  ja: {
    title: 'zumen の過去の版 — ダウンロード',
    h1: '過去の版',
    desc: 'zumen のこれまでの版。版ごとに macOS と Windows（x64・ARM）の配布物を落とせます。一覧は GitHub のリリースから読んで作ります。',
    lead: '版ごとの配布物です。いちばん新しいものは<a href="../download/">ダウンロードのページ</a>から選べます。',
    loading: 'GitHub から読んでいます…',
    go: 'GitHub のリリースのページで見る',
    crumb: '過去の版',
  },
  en: {
    title: 'zumen — older releases',
    h1: 'Older releases',
    desc: 'Every zumen release, with the macOS and Windows (x64 and ARM) builds for each. The list is read from the GitHub releases.',
    lead: 'The builds for each release. For the newest one, use <a href="../download/">the download page</a>.',
    loading: 'Reading from GitHub…',
    go: 'See them on GitHub',
    crumb: 'Older releases',
  },
};

function releasesPage(lang) {
  const w = PAST_WORD[lang];
  const base = lang === 'ja' ? '../' : '../../';
  const body = `<article class="dl-page">
  <h1>${w.h1}</h1>
  <p class="lead">${w.lead}</p>
  <div data-archive>
    <p class="note">${esc(w.loading)} <a href="${RELEASES_URL}">${esc(w.go)}</a></p>
  </div>
</article>
<script src="${base}download.js" defer></script>`;
  return shell({
    lang,
    path: '/releases/',
    title: w.title,
    desc: w.desc,
    up: [{ href: '../download/', text: DL_WORD[lang].crumb }],
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: w.title,
        description: w.desc,
        url: `${SITE}${lang === 'ja' ? '' : '/en'}/releases/`,
        inLanguage: lang,
      },
      crumbs(lang, [{ name: DL_WORD[lang].crumb, url: `${SITE}${lang === 'ja' ? '' : '/en'}/download/` }, { name: w.crumb }]),
    ],
    body,
  });
}

/**
 * **ロードマップは README の写し**（2026-11-09）。
 * 済み・いま・次・止めどころ・作らないもの。**約束はしない** —— 次の欄には、もう手を付けたものだけを書く。
 */
const MAP_WORD = {
  ja: {
    title: 'zumen のロードマップ — 済んだこと・いま・次・作らないもの',
    h1: 'ロードマップ',
    desc: 'zumen がどこまで来て、次に何をして、何を作らないか。人の手直しが再生成で壊れないことを最初に測り、成り立ったので続けています。',
    lead: 'どこまで来て、次に何をして、何を作らないか。<b>約束ではなく、いまの見取り図です。</b>',
    gateH: '続けるかどうかの判断',
    gate: '最初に 1 本の線だけを測りました ── <b>文章で頼む → 図が出る → 人が 1 か所だけ直す → もう一度頼む → 直した分が壊れない。</b>ここが成り立たなければ、ほかが全部できても使う理由が無いので畳む、と決めて始めました。測って成り立ったので、続けています。',
    cols: [
      ['済んだこと', [
        '人が直した位置（pins）が、AI の描き直しで壊れない',
        '保存形式を決めた ── 正本は 1 枚の YAML。仕様は実装から分けて公開',
        'デスクトップアプリ（macOS・Windows の x64 と ARM）',
        'MCP サーバー ── AI エージェントが仕様と見本を読んで描ける',
        'SVG・Mermaid・draw.io・Markdown への書き出し',
        '専門図面の見本。分野ごとに一次資料で確かめ、分野の目で見直す',
        '図の中に描いた字で、見本を探せる',
      ]],
      ['いま', [
        '見本を増やす ── 世の中にある専門図面を先に調べ、決まりを対照表にしてから描く',
        '描いた見本を、その分野の目で 2〜3 回見直す',
      ]],
      ['次', [
        'macOS を 1 本で Apple シリコンと Intel の両方に（次の版から）',
      ]],
      ['分かっている限界', [
        '自動レイアウトは、節が 30 を超えると印刷でも字が読めない。図を分ける仕組みはまだ無い',
        '体に巻きつく帯（テーピング・ロープの結索）は描けない。線に幅を持たせる手段と、裏へ回る部分を表す手段が要る',
        '署名していない。受け取った機械が警告を出す',
      ]],
    ],
    notH: '作らないもの',
    not: [
      '<b>図形の網羅を追いません。</b>図形の種類は 11 語のまま。専門性は形ではなく符号（<code>tag</code>）で表します',
      '<b>業界ごとの専用の描き手を作りません。</b>同じ描画の仕組みと少しの部品で、どこまで違う図が描けるかを追います',
      '<b>全自動で終わらせません。</b>人が直す往復を残すこと自体が目的です',
      '<b>リアルタイムの共同編集・Web 版・他形式の取り込みを先に作りません。</b>',
      '<b>ベンダーのロゴを持ち込みません。</b>AWS のアイコンを使うと「AWS 上にある」と読まれます',
    ],
    src: 'もとの文書：<a href="https://github.com/meta-taro/zumen#readme">README</a>・<a href="https://github.com/meta-taro/zumen/blob/develop/CHANGELOG.md">変更の記録</a>',
    crumb: 'ロードマップ',
  },
  en: {
    title: 'zumen roadmap — done, now, next, and what we will not build',
    h1: 'Roadmap',
    desc: 'How far zumen has come, what comes next, and what it will not build. We first measured whether hand edits survive regeneration; they did, so the project continues.',
    lead: 'How far it has come, what comes next, and what it will not build. <b>This is a map of where things stand, not a promise.</b>',
    gateH: 'When we would stop',
    gate: 'We measured one line before anything else — <b>ask in words → a diagram appears → a person fixes one spot → ask again → the fix survives.</b> If that failed, nothing else would justify using it, so we agreed to stop. It held, so the project continues.',
    cols: [
      ['Done', [
        'Positions a person fixed (pins) survive when the AI redraws',
        'The file format is settled — one YAML file is the source, with the spec published separately from the code',
        'Desktop app (macOS, and Windows on x64 and ARM)',
        'An MCP server — AI agents read the spec and the examples, then draw',
        'Export to SVG, Mermaid, draw.io and Markdown',
        'Specialist examples, checked against primary sources for each field and reviewed through that field’s eyes',
        'Search the examples by any text drawn inside them',
      ]],
      ['Now', [
        'More examples — research the drawings a trade really uses first, tabulate their conventions, then draw',
        'Review each example two or three times through the eyes of its field',
      ]],
      ['Next', [
        'One macOS build for both Apple silicon and Intel (from the next release)',
      ]],
      ['Known limits', [
        'Automatic layout stops being legible, even in print, beyond about 30 nodes. There is no way to split a diagram yet',
        'Bands that wrap around a body (taping, rope knots) cannot be drawn. That needs lines with width and a way to show the part that goes behind',
        'Not code-signed, so your computer will warn you',
      ]],
    ],
    notH: 'What we will not build',
    not: [
      '<b>No race for shape coverage.</b> The shape vocabulary stays at 11 words. Expertise lives in labels (<code>tag</code>), not shapes',
      '<b>No special-purpose renderer per trade.</b> The question is how far one drawing engine and a few parts can go',
      '<b>No fully automatic output.</b> Keeping the round trip where a person corrects the drawing is the point',
      '<b>Not first: real-time co-editing, a web version, or importers from other formats.</b>',
      '<b>No vendor logos.</b> An AWS icon makes a diagram read as "this runs on AWS"',
    ],
    src: 'Sources: <a href="https://github.com/meta-taro/zumen#readme">README</a> and <a href="https://github.com/meta-taro/zumen/blob/develop/CHANGELOG.md">changelog</a>',
    crumb: 'Roadmap',
  },
};

function roadmapPage(lang) {
  const w = MAP_WORD[lang];
  const body = `<article class="roadmap">
  <h1>${w.h1}</h1>
  <p class="lead">${w.lead}</p>
  <h2>${w.gateH}</h2>
  <p>${w.gate}</p>
  <div class="map">
${w.cols.map(([head, items]) => `    <div>
      <h2>${head}</h2>
      <ul>
${items.map((li) => `        <li>${esc(li)}</li>`).join('\n')}
      </ul>
    </div>`).join('\n')}
  </div>
  <h2>${w.notH}</h2>
  <ul>
${w.not.map((li) => `    <li>${li}</li>`).join('\n')}
  </ul>
  <p class="note">${w.src}</p>
</article>`;
  return shell({
    lang,
    path: '/roadmap/',
    title: w.title,
    desc: w.desc,
    up: [],
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: w.title,
        description: w.desc,
        url: `${SITE}${lang === 'ja' ? '' : '/en'}/roadmap/`,
        inLanguage: lang,
      },
      crumbs(lang, [{ name: w.crumb }]),
    ],
    body,
  });
}

for (const lang of ['ja', 'en']) {
  const at = lang === 'ja' ? 'site' : 'site/en';
  want.set(`${at}/download/index.html`, downloadPage(lang));
  want.set(`${at}/releases/index.html`, releasesPage(lang));
  want.set(`${at}/roadmap/index.html`, roadmapPage(lang));
}
want.set('site/all/index.html', allPage('ja'));
want.set('site/en/all/index.html', allPage('en'));

/** sitemap。**ページだけ出す**（図の SVG は図であってページではない）。 */
const urls = [
  { ja: `${SITE}/`, en: `${SITE}/en/` },
  { ja: `${SITE}/all/`, en: `${SITE}/en/all/` },
  { ja: `${SITE}/download/`, en: `${SITE}/en/download/` },
  { ja: `${SITE}/releases/`, en: `${SITE}/en/releases/` },
  { ja: `${SITE}/roadmap/`, en: `${SITE}/en/roadmap/` },
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

/**
 * **お知らせ —— 足した見本・直した見本**（2026-09-28。更新された見本が分かるお知らせが欲しい、という要望）。
 *
 * 元は `examples/gallery/news.tsv`。LP の「作れる図」の頭に新しい 8 件、`feed.xml`（Atom）に 30 件。
 * **手で書く所は古くなる**ので、いちばん新しい見本が載っていなければ `test/news.test.ts` が落ちる。
 */
const NEWS = readFileSync(join(DIR, 'news.tsv'), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  .map((line) => {
    const [date = '', kind = '', no = '', ja = '', en = ''] = line.split('\t');
    return { date, kind, no, ja, en };
  });
const plainOf = (text) => String(text).replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
const clip = (text, limit) => (text.length <= limit ? text : `${text.slice(0, limit - 1)}…`);
function newsLine(n, lang) {
  const s = SAMPLES.find((x) => String(x.no) === String(n.no));
  const own = lang === 'ja' ? n.ja : n.en;
  if (own !== '') return own;
  return clip(plainOf(lang === 'ja' ? s?.caption ?? '' : s?.en ?? ''), lang === 'ja' ? 60 : 110);
}
const NEWS_WORD = {
  ja: { head: 'お知らせ', feed: 'フィード', new: '追加', fix: '更新', feat: '機能追加', log: '変更の記録', title: 'zumen —— お知らせ', no: (no) => `見本 ${no}` },
  en: { head: 'News', feed: 'feed', new: 'New', fix: 'Fixed', feat: 'Feature', log: 'Changelog', title: 'zumen — news', no: (no) => `Example ${no}` },
};
/** 機能の行は、見本ではなく変更の記録へ飛ばす（公開しているのは main）。 */
const CHANGELOG_URL = 'https://github.com/meta-taro/zumen/blob/main/CHANGELOG.md';
const newsHref = (n, lang, base) => (n.kind === 'feat' ? CHANGELOG_URL : `${base}g/${n.no}/`);
const newsName = (n, lang) => (n.kind === 'feat' ? NEWS_WORD[lang].log : NEWS_WORD[lang].no(n.no));
function newsBlock(lang) {
  const w = NEWS_WORD[lang];
  const items = NEWS.slice(0, 8).map((n) => {
    const [, m, d] = n.date.split('-');
    // **見本の行には小さな絵を添える**（2026-09-28）。文字だけでは、どんな図か分からない。
    // 絵は飾り（隣に同じリンクがある）なので、読み上げとタブ移動からは外す。機能の行は空きで揃える。
    const sample = n.kind === 'feat' ? undefined : SAMPLES.find((x) => String(x.no) === String(n.no));
    const thumb = sample === undefined
      ? '<span class="thumb" aria-hidden="true"></span>'
      : `<a href="${newsHref(n, lang, '')}" tabindex="-1" aria-hidden="true"><img class="thumb" src="${lang === 'ja' ? '' : '../'}gallery/${encodeURIComponent(sample.name)}.svg" alt="" width="72" height="48" loading="lazy" decoding="async"></a>`;
    return `    <li>${thumb}<time datetime="${n.date}">${Number(m)}/${Number(d)}</time>${w[n.kind]} <a href="${newsHref(n, lang, '')}">${esc(newsName(n, lang))}</a> ${esc(newsLine(n, lang))}</li>`;
  });
  return `<!-- news -->\n  <p class="news-h">${w.head}（<a href="feed.xml">${w.feed}</a>）</p>\n  <ul class="near news">\n${items.join('\n')}\n  </ul>\n  <!-- /news -->`;
}
function feedOf(lang) {
  const w = NEWS_WORD[lang];
  const base = lang === 'ja' ? SITE : `${SITE}/en`;
  const stamp = (date) => `${date}T00:00:00+09:00`;
  const entries = NEWS.slice(0, 30).map((n) => `  <entry>
    <title>${esc(n.kind === 'feat' ? `${w.feat} —— ${newsLine(n, lang)}` : `${w.no(n.no)} —— ${w[n.kind]}`)}</title>
    <link href="${newsHref(n, lang, `${base}/`)}"/>
    <id>${base}/feed.xml#${n.date}-${n.kind}-${n.no}</id>
    <updated>${stamp(n.date)}</updated>
    <summary>${esc(newsLine(n, lang))}</summary>
  </entry>`);
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">
  <title>${esc(w.title)}</title>
  <link href="${base}/"/>
  <link rel="self" href="${base}/feed.xml"/>
  <id>${base}/feed.xml</id>
  <updated>${stamp(NEWS[0]?.date ?? '2026-01-01')}</updated>
  <author><name>zumen</name></author>
${entries.join('\n')}
</feed>
`;
}
/**
 * **図の中の字の索引**（`site/search.json`。2026-11-06）。
 *
 * 一覧の絞り込みは、番号・題・英題・分野にしか当たっていなかった。
 * **正本がテキストなので、図の中に描いた字（ラベル・注記・出典）でも引ける** ——
 * 「電流計」で理科の解答用紙が、「受検番号」でマークシートが出る。絵や PowerPoint ではできない。
 *
 * ページに埋めると 1 枚が重くなるので、**別のファイルにして、打ち始めたときだけ読む**（`site/all.js`）。
 */
want.set('site/search.json', `${JSON.stringify(Object.fromEntries(SAMPLES.map((s) => [s.no, drawnText(readFileSync(join(DIR, `${s.name}.zumen.yaml`), 'utf8'))])))}\n`);
want.set('site/feed.xml', feedOf('ja'));
want.set('site/en/feed.xml', feedOf('en'));
for (const [path, lang] of [['site/index.html', 'ja'], ['site/en/index.html', 'en']]) {
  let page = readFileSync(path, 'utf8');
  const block = newsBlock(lang);
  page = /<!-- news -->[\s\S]*?<!-- \/news -->/.test(page)
    ? page.replace(/<!-- news -->[\s\S]*?<!-- \/news -->/, block)
    : page.replace('  <div class="filters"', `  ${block}\n  <div class="filters"`);
  page = page.replace(/<!-- names -->[\s\S]*?<!-- \/names -->/, namesList(lang));
  if (!page.includes('type="application/atom+xml"')) {
    page = page.replace('<link rel="stylesheet" href="', `<link rel="alternate" type="application/atom+xml" href="feed.xml" title="${esc(NEWS_WORD[lang].title)}">\n<link rel="stylesheet" href="`);
  }
  want.set(path, page);
}

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
