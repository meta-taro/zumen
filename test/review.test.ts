/**
 * **人が見たという記録**（`review`）。
 *
 * ## なぜ要るか
 *
 * いまの zumen は、この 2 つを区別できなかった。
 *
 * | 実際に起きたこと | `pnpm measure` |
 * |---|---|
 * | AI が描いて、**人が見て、直す必要が無かった** | 自力率 100% |
 * | AI が描いて、**誰も見ていない** | 自力率 100% |
 *
 * **これはこの製品がいちばん恐れている失敗そのもの。**
 * CLAUDE.md の禁止事項 4 は「往復を残すこと自体が目的」、
 * ベースルール §29 は「**commit・テスト通過・デプロイ成功は AI が無人で発生させられる。
 * 活動量を見ている限り、人が関与していないことは検出できない**」と書いている。
 *
 * `pins` は「人が**直した**」記録であって、
 * 「人が**見て、直す必要が無いと判断した**」記録ではない。
 *
 * ## 開けない口
 *
 * **`review` を書く口は MCP に開けない。** 開けた瞬間、
 * **AI が自分の絵を自分で承認できる**（D18 で閉じたのと同じ穴が裏から開く）。
 * 書くのは GUI だけ。
 *
 * ## 意味が変わったら無効
 *
 * 見たのは**そのときの意味**であって、ファイルではない。
 * `nodes` / `edges` / `groups` が変われば、また見てもらう必要がある。
 * `pins` は人が自分で動かしたものなので、**変わっても無効にしない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { meaningOf, reviewOf, setReviewed } from '../src/review.ts';
import { parse, serialize, setPin } from '../src/format.ts';

const BASE = [
  'version: 1',
  'title: 本番構成',
  'nodes:',
  '  - id: lb',
  '    type: load-balancer',
  '    label: Load Balancer',
  '  - id: web',
  '    type: server',
  '    label: Web 01',
  'edges:',
  '  - from: lb',
  '    to: web',
  '',
].join('\n');

describe('見たかどうか', () => {
  it('**何も書いていなければ「誰も見ていない」**', () => {
    const got = reviewOf(BASE);
    assert.equal(got.reviewed, false);
    assert.equal(got.at, null);
    assert.equal(got.stale, false);
  });

  it('印を付ければ「見た」になる', () => {
    const marked = setReviewed(BASE, new Date('2026-09-08T04:00:00Z'));
    const got = reviewOf(marked);
    assert.equal(got.reviewed, true);
    assert.equal(got.at, '2026-09-08T04:00:00Z');
  });

  it('印を付けても、図の中身は 1 文字も変わらない', () => {
    const marked = setReviewed(BASE, new Date());
    assert.equal(meaningOf(marked), meaningOf(BASE));
  });

  it('**個人を書かない**（public リポジトリに置かれる。ベースルール §25）', () => {
    const marked = setReviewed(BASE, new Date());
    // 記録するのは時刻と、見た内容の指紋だけ。
    const review = (parse(marked).doc.toJS() as { review?: Record<string, unknown> }).review ?? {};
    assert.deepEqual(Object.keys(review).sort(), ['at', 'of']);
  });
});

describe('**意味が変われば無効になる**', () => {
  const marked = setReviewed(BASE, new Date('2026-09-08T04:00:00Z'));

  it('ノードが足されたら、また見てもらう', () => {
    const grown = marked.replace(
      '    label: Web 01',
      '    label: Web 01\n  - id: db\n    type: database\n    label: MariaDB',
    );
    const got = reviewOf(grown);
    assert.equal(got.reviewed, false, 'まだ見たことになっている');
    assert.equal(got.stale, true, '古い印であることが分からない');
    // **いつ見たかは残す。** 消すと「一度も見ていない」と区別が付かない。
    assert.equal(got.at, '2026-09-08T04:00:00Z');
  });

  it('辺が変わっても無効になる', () => {
    const changed = marked.replace('    to: web', '    to: web\n    label: HTTPS');
    assert.equal(reviewOf(changed).reviewed, false);
  });

  it('ラベルが変わっても無効になる（意味が変わっている）', () => {
    assert.equal(reviewOf(marked.replace('Web 01', 'Web 02')).reviewed, false);
  });

  it('**人が箱を動かしただけなら、無効にしない**（`pins` は人自身の手）', () => {
    const diagram = parse(marked);
    setPin(diagram, 'web', { position: { x: 600, y: 400 } });
    const moved = serialize(diagram);
    const got = reviewOf(moved);
    assert.equal(got.reviewed, true, `人が自分で動かしたのに無効になった`);
    assert.equal(got.stale, false);
  });

  it('題を変えたら無効になる（人へ見せる文字なので意味の一部）', () => {
    assert.equal(reviewOf(marked.replace('title: 本番構成', 'title: 検証構成')).reviewed, false);
  });

  it('註釈や並べ方の違いでは無効にならない（意味は同じ）', () => {
    const commented = marked.replace('nodes:', '# 2026-09 時点\nnodes:');
    assert.equal(reviewOf(commented).reviewed, true);
  });

  it('見直せば、また有効になる', () => {
    const grown = marked.replace('    label: Web 01', '    label: Web 01\n  - id: db\n');
    assert.equal(reviewOf(grown).reviewed, false);
    assert.equal(reviewOf(setReviewed(grown, new Date())).reviewed, true);
  });
});

describe('**書く口を開けていない**', () => {
  it('エージェント向けの口に、印を書くものが無い', async () => {
    const tools = await import('../src/tools.ts');
    const names = Object.keys(tools);
    for (const forbidden of ['setReviewed', 'review', 'approve', 'accept', 'sign']) {
      assert.equal(names.includes(forbidden), false, `${forbidden} が開いている`);
    }
  });

  it('MCP の口の名前にも無い', async () => {
    const text = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../src/mcp.ts', import.meta.url), 'utf8'),
    );
    assert.equal(/zumen_(review|approve|accept|sign)/.test(text), false);
  });

  it('**提案を入れても、勝手に「見た」ことにならない**', async () => {
    const { propose } = await import('../src/tools.ts');
    const files: Record<string, string> = { 'a.zumen.yaml': BASE };
    const io = {
      read: (p: string) => files[p]!,
      write: (p: string, t: string) => {
        files[p] = t;
      },
      exists: (p: string) => files[p] !== undefined,
      list: () => Object.keys(files),
    };
    const proposal = BASE.replace('    label: Web 01', '    label: Web 01\n  - id: db\n');
    propose('a.zumen.yaml', proposal, io);
    assert.equal(reviewOf(files['a.zumen.yaml']!).reviewed, false);
  });

  it('**正本の印は、意味を変えない提案では残る**', async () => {
    const { propose } = await import('../src/tools.ts');
    const marked = setReviewed(BASE, new Date('2026-09-08T04:00:00Z'));
    const files: Record<string, string> = { 'a.zumen.yaml': marked };
    const io = {
      read: (p: string) => files[p]!,
      write: (p: string, t: string) => {
        files[p] = t;
      },
      exists: (p: string) => files[p] !== undefined,
      list: () => Object.keys(files),
    };
    // 註釈を足しただけの提案。意味は変わっていない。
    propose('a.zumen.yaml', BASE.replace('nodes:', '# 2026-09 時点\nnodes:'), io);
    assert.equal(reviewOf(files['a.zumen.yaml']!).reviewed, true);
  });

  it('**意味を変える提案が入ったら、印が古くなる**（黙って有効のままにしない）', async () => {
    const { propose } = await import('../src/tools.ts');
    const marked = setReviewed(BASE, new Date('2026-09-08T04:00:00Z'));
    const files: Record<string, string> = { 'a.zumen.yaml': marked };
    const io = {
      read: (p: string) => files[p]!,
      write: (p: string, t: string) => {
        files[p] = t;
      },
      exists: (p: string) => files[p] !== undefined,
      list: () => Object.keys(files),
    };
    propose('a.zumen.yaml', BASE.replace('    label: Web 01', '    label: Web 01\n  - id: db\n    label: MariaDB'), io);
    const got = reviewOf(files['a.zumen.yaml']!);
    assert.equal(got.reviewed, false);
    assert.equal(got.stale, true, '「一度も見ていない」と区別が付かない');
  });

  it('**印は提案から持ち込めない**（AI が書いた review を採らない）', async () => {
    const { propose } = await import('../src/tools.ts');
    const marked = setReviewed(BASE, new Date('2026-09-08T04:00:00Z'));
    const files: Record<string, string> = { 'a.zumen.yaml': BASE };
    const io = {
      read: (p: string) => files[p]!,
      write: (p: string, t: string) => {
        files[p] = t;
      },
      exists: (p: string) => files[p] !== undefined,
      list: () => Object.keys(files),
    };
    propose('a.zumen.yaml', marked, io);
    assert.equal(reviewOf(files['a.zumen.yaml']!).reviewed, false, 'AI の印が採られた');
  });
});
