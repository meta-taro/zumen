/**
 * **お知らせ —— 足した見本・直した見本**（2026-09-28。更新された見本が分かるお知らせが欲しい、という要望）。
 *
 * 元は `examples/gallery/news.tsv`。LP の「作れる図」の頭と、`feed.xml`（Atom）へ出す。
 * **手で書く所は古くなる**（「下の 93 枚」が 355 枚になっても残っていた）ので、
 * いちばん新しい見本がお知らせに無ければ、ここで落とす。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

const ROWS = readFileSync(new URL('../examples/gallery/news.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  .map((line) => line.split('\t'));

const NUMBERS = readdirSync(new URL('../examples/gallery/', import.meta.url))
  .filter((file) => file.endsWith('.zumen.yaml'))
  .map((file) => Number(file.split('-')[0]));

const site = (path: string) => readFileSync(new URL(`../site/${path}`, import.meta.url), 'utf8');

describe('お知らせ', () => {
  it('どの行も「日付・new／fix／feat・見本の番号（feat は名前）」で、fix と feat には日英の一言がある', () => {
    for (const [date, kind, no, ja, en] of ROWS) {
      assert.match(date ?? '', /^\d{4}-\d{2}-\d{2}$/, `日付: ${date}`);
      assert.ok(kind === 'new' || kind === 'fix' || kind === 'feat', `種類: ${kind}`);
      if (kind === 'feat') assert.match(no ?? '', /^[a-z][a-z0-9-]*$/, `機能の名前: ${no}`);
      else assert.ok(NUMBERS.includes(Number(no)), `見本 ${no} が無い`);
      if (kind !== 'new') assert.ok((ja ?? '') !== '' && (en ?? '') !== '', `${no} に一言が無い`);
    }
  });

  it('**CHANGELOG の「未リリース」で増えた機能は、お知らせにも載っている**（目印 `<!-- news: 名前 -->`）', () => {
    const log = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
    const unreleased = log.slice(log.indexOf('## 未リリース'), log.indexOf('\n## ', log.indexOf('## 未リリース') + 1));
    const grown = unreleased.split('### ').find((part) => part.startsWith('できることが増えます')) ?? '';
    const bullets = grown.split('\n').filter((line) => line.startsWith('- '));
    for (const bullet of bullets) {
      const key = /<!-- news: ([a-z0-9-]+) -->/.exec(bullet)?.[1];
      assert.ok(key !== undefined, `目印の無い項目: ${bullet.slice(0, 40)}`);
      assert.ok(ROWS.some(([, kind, name]) => kind === 'feat' && name === key), `news.tsv に feat ${key} が無い`);
    }
  });

  it('**いちばん新しい見本が、お知らせに載っている**（書き忘れを落とす）', () => {
    const newest = Math.max(...NUMBERS);
    assert.ok(
      ROWS.some(([, kind, no]) => kind === 'new' && Number(no) === newest),
      `見本 ${newest} を examples/gallery/news.tsv に足してください`,
    );
  });

  it('新しい順に並んでいる', () => {
    const dates = ROWS.map(([date]) => date ?? '');
    assert.deepEqual(dates, [...dates].sort().reverse());
  });

  it('LP（日英）の頭に、いちばん上の行が見本へのリンクとして出ている', () => {
    const [, kind, no] = ROWS[0] ?? [];
    const href = kind === 'feat' ? 'https://github.com/meta-taro/zumen/blob/main/CHANGELOG.md' : `g/${no}/`;
    for (const page of ['index.html', 'en/index.html']) {
      const html = site(page);
      assert.match(html, /<ul class="near news">/, page);
      assert.ok(html.includes(`<a href="${href}">`), `${page} に ${href} が無い`);
    }
  });

  /**
   * **見本の行には、小さな絵を添える**（2026-09-28。トップのお知らせも同じ、という指摘）。
   * 「見本 358」の文字だけでは、どんな図か分からない。機能の行は絵が無いので空きで揃える。
   */
  it('LP のお知らせで、見本の行には小さなサムネイルが付き、その絵が実在する', () => {
    for (const [page, up] of [['index.html', ''], ['en/index.html', '../']] as const) {
      const block = site(page).split('<!-- news -->')[1]?.split('<!-- /news -->')[0] ?? '';
      const rows = block.split('<li').slice(1);
      assert.equal(rows.length, Math.min(ROWS.length, 8), page);
      rows.forEach((row, index) => {
        const kind = ROWS[index]?.[1];
        const src = /<img class="thumb" src="([^"]+)"/.exec(row)?.[1];
        if (kind === 'feat') {
          assert.equal(src, undefined, `${page} ${index}: 機能の行に絵がある`);
          return;
        }
        assert.ok(src !== undefined, `${page} ${index}: 見本の行に絵が無い`);
        const file = decodeURIComponent(src.replace(up, ''));
        assert.ok(existsSync(new URL(`../examples/${file}`, import.meta.url)), `${page}: ${src} が無い`);
      });
    }
  });

  it('Atom のフィードが日英で出ていて、LP から辿れる', () => {
    for (const [feed, page] of [['feed.xml', 'index.html'], ['en/feed.xml', 'en/index.html']] as const) {
      const xml = site(feed);
      assert.match(xml, /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom"/);
      assert.equal((xml.match(/<entry>/g) ?? []).length, Math.min(ROWS.length, 30));
      assert.match(site(page), /<link rel="alternate" type="application\/atom\+xml"/);
    }
  });
});
