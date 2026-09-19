/**
 * **同梱の見本を、エージェントが引けるか**（`zumen_examples`）。
 *
 * D39 で測ったとおり、**リポジトリの中にしか無い決まりは、他の人には届かない。**
 * `zumen_spec` は「どう書くか」を渡すが、**「世の中にどんな図面があるか」は
 * どこからも渡っていなかった** —— zumen の値打ちは書き方ではなく、
 * 歯周チャート・木取り図・仕込図・査定図が**どう組まれているか**のほうにある。
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { catalogue, search, source } from '../src/examples.ts';

const dir = new URL('../examples/gallery/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'));

describe('同梱の見本の目次', () => {
  it('**目次が同梱されている**（無ければ、エージェントには見本が無いのと同じ）', () => {
    assert.notEqual(catalogue(), null, 'examples/gallery/index.json が読めない');
  });

  it('**枚数が実物と合っている**', () => {
    assert.equal(catalogue()!.count, files.length);
  });

  /**
   * **目次に名前があるのに正本が無い**、が起きると
   * エージェントは「読めるはず」で呼んで空振りする（ベースルール §23 と同じ壊れ方）。
   */
  it('**目次のすべての名前に、正本がある**', () => {
    const missing = catalogue()!
      .categories.flatMap((group) => group.items.map((item) => item.name))
      .filter((name) => source(name) === null);
    assert.deepEqual(missing, []);
  });

  it('**正本がすべて目次に載っている**（載せ忘れを通さない）', () => {
    const listed = new Set(
      catalogue()!.categories.flatMap((group) => group.items.map((item) => item.name)),
    );
    const adrift = files.map((f) => f.replace(/\.zumen\.yaml$/, '')).filter((n) => !listed.has(n));
    assert.deepEqual(adrift, []);
  });

  it('**一行が空でない**（題名だけでは、何の決まりごとか伝わらない）', () => {
    const empty = catalogue()!
      .categories.flatMap((group) => group.items)
      .filter((item) => item.caption.trim() === '')
      .map((item) => item.name);
    assert.deepEqual(empty, []);
  });

  it('分類に英語の名前が付いている', () => {
    for (const group of catalogue()!.categories) assert.notEqual(group.labelEn.trim(), '');
  });
});

/**
 * **「この機能を使っている見本」を引けるようにする**（2026-09-19）。
 *
 * 目次は題材でしか引けなかった。だが入れた人のエージェントがいちばん知りたいのは、
 * しばしば**「views を 2 つ使って縮尺を分けた見本はどれか」**のほうである ——
 * 書き方は `zumen_spec` に書いてあるが、**効いている実物**は見本の中にしかない。
 */
/**
 * **配置図か構成図かは、まねる前に知りたい**（2026-09-19）。
 *
 * `kind: placement` は**座標を自分で書く図**、`structure` は**機械が並べる図**。
 * まねる相手を選ぶとき、これは一行の題材より先に効く情報なのに、目次に無かった。
 */
describe('目次に、図の種類が載っている', () => {
  it('**見本ごとに kind がある**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.every((i) => i.kind === 'placement' || i.kind === 'structure'), 'kind が無い見本がある');
  });

  it('**両方の種類が揃っている**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.some((i) => i.kind === 'placement'));
    assert.ok(items.some((i) => i.kind === 'structure'));
  });

  it('**種類でも引ける**', () => {
    const found = search(catalogue()!, 'placement').flatMap((g) => g.items);
    assert.ok(found.length > 50, `placement で ${found.length} 件しか出ない`);
    assert.ok(found.every((i) => i.kind === 'placement'));
  });
});

describe('使っている道具で引く', () => {
  it('**見本ごとに、使っている道具が並んでいる**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.every((i) => Array.isArray(i.uses)), 'uses が無い見本がある');
    assert.ok(items.some((i) => i.uses.includes('views')), 'views を使った見本が拾えていない');
  });

  it('**道具の名前で引ける**（query が uses にも当たる）', () => {
    const found = search(catalogue()!, 'views').flatMap((g) => g.items.map((i) => i.name));
    assert.ok(found.length >= 5, `views で ${found.length} 件しか出ない`);
  });

  it('**縮尺を分けた見本が引ける**（1 枚に 2 つの scale）', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    const twoScales = items.filter((i) => i.uses.includes('views') && i.uses.includes('scale'));
    assert.ok(twoScales.length > 0, '縮尺を図ごとに分けた見本が拾えない');
  });

  it('使っていない道具は並べない', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.some((i) => !i.uses.includes('views')), 'ぜんぶの見本に views が付いている');
  });
});

describe('見本を絞る', () => {
  it('**和語で引ける**', () => {
    const found = search(catalogue()!, '型紙').flatMap((g) => g.items.map((i) => i.name));
    assert.ok(found.length >= 3, `型紙が ${found.length} 件しか出ない`);
  });

  it('**英語でも引ける**（一行の英訳にも当たる）', () => {
    const found = search(catalogue()!, 'plot').flatMap((g) => g.items.map((i) => i.name));
    assert.ok(found.length > 0, '英語で引けない');
  });

  it('空の語なら、そのまま全部', () => {
    assert.equal(search(catalogue()!, '  ').length, catalogue()!.categories.length);
  });
});

describe('正本を読む', () => {
  it('**名前を渡すと、その正本が返る**（真似て書けるように）', () => {
    const name = catalogue()!.categories[0]!.items[0]!.name;
    const yaml = source(name);
    assert.ok(yaml !== null && yaml.startsWith('version: 1'), `${name} の正本が読めない`);
  });

  it('**上へ抜けさせない**（名前はファイル名にそのまま使う）', () => {
    for (const bad of ['../package', 'a/b', '..\\\\x', '../../etc/passwd']) {
      assert.equal(source(bad), null, `${bad} が通った`);
    }
  });

  it('無い名前には null（黙って空を返さない）', () => {
    assert.equal(source('999-ありません'), null);
  });

  it('**同梱されていなければ null**（「無い」と言えるようにする）', () => {
    assert.equal(
      catalogue(() => {
        throw new Error('ない');
      }),
      null,
    );
  });
});

describe('目次は、正本と同じものを写している', () => {
  it('**一行は scripts/gallery-categories.mjs のまま**（二重管理にしない）', async () => {
    // scripts/ は素の JS（型宣言を持たない）。ここだけ素通しする。
    // @ts-expect-error -- 型宣言の無い .mjs を、テストのためだけに読む
    const { CATEGORIES } = (await import('../scripts/gallery-categories.mjs')) as {
      CATEGORIES: { key: string; label: string; items: { name: string; caption: string }[] }[];
    };
    const book = catalogue()!;
    assert.equal(book.categories.length, CATEGORIES.length);
    for (const [i, group] of CATEGORIES.entries()) {
      assert.equal(book.categories[i]!.key, group.key);
      assert.deepEqual(
        book.categories[i]!.items.map((x) => [x.name, x.caption]),
        group.items.map((x) => [x.name, x.caption]),
      );
    }
  });

  it('**目次に載っている YAML は、読める**（壊れた正本を勧めない）', () => {
    for (const name of catalogue()!.categories.flatMap((g) => g.items.map((i) => i.name))) {
      assert.ok(readFileSync(new URL(`${name}.zumen.yaml`, dir), 'utf8').includes('version: 1'));
    }
  });
});
