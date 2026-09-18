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
