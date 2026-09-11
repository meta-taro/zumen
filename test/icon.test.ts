/**
 * アプリのアイコン（DESIGN.md §6）。
 *
 * ここが見張るのは絵の良し悪しではなく、**壊れ方が静かな 2 つ**。
 *
 * 1. **参照されているのに存在しないアセット**（ベースルール §23）。
 *    `tauri.conf.json` が指すファイルが無くても、`pnpm test` も
 *    `pnpm dev` も通る。**壊れるのは配布物を作ったときだけ**で、気づくのが遅い
 * 2. **正本が 2 つに増えること。** SVG と PNG の両方を人が直すようになると、
 *    片方だけ直った状態が生まれ、どちらが正しいか誰も言えなくなる
 *
 * 配色は**人が決めたもの**（2026-09-07）。AI が変えない（ベースルール §11 / §15）。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = new URL('../', import.meta.url).pathname;

/** アイコンの正本。**ここ 1 つだけ。** */
const SOURCE = join(ROOT, 'app/icon.svg');

/** DESIGN.md §6 の表。 */
const DECIDED = {
  ground: '#23232b',
  wine: '#a32b48',
  pale: '#d8d8e0',
};

describe('アイコンの正本', () => {
  it('ある', () => {
    assert.ok(existsSync(SOURCE), `${SOURCE} が無い`);
  });

  it('**人が決めた配色のまま**（AI が変えない）', () => {
    const svg = readFileSync(SOURCE, 'utf8');
    for (const [name, value] of Object.entries(DECIDED)) {
      assert.ok(svg.includes(value), `${name}（${value}）が入っていない`);
    }
  });

  it('DESIGN.md と食い違っていない', () => {
    const design = readFileSync(join(ROOT, 'DESIGN.md'), 'utf8');
    for (const value of Object.values(DECIDED)) {
      assert.ok(design.includes(value), `DESIGN.md に ${value} が書かれていない`);
    }
  });

  it('ワインは 1 か所だけ（アイコンの中で主役を 2 つ作らない）', () => {
    const svg = readFileSync(SOURCE, 'utf8');
    assert.equal((svg.match(new RegExp(DECIDED.wine, 'g')) ?? []).length, 1);
  });

  it('**PNG を 2 つ目の正本にしない**（app 側に PNG を置かない）', () => {
    assert.equal(existsSync(join(ROOT, 'app/icon.png')), false);
  });
});

describe('**参照されているのに存在しないアセット**（ベースルール §23）', () => {
  const conf = JSON.parse(readFileSync(join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8')) as {
    bundle?: { icon?: string[] };
  };

  it('`bundle.icon` が空でない', () => {
    assert.ok((conf.bundle?.icon ?? []).length > 0);
  });

  it('指しているファイルが全部ある', () => {
    for (const path of conf.bundle?.icon ?? []) {
      assert.ok(existsSync(join(ROOT, 'src-tauri', path)), `${path} が無い`);
    }
  });

  it('Windows と macOS の両方ぶんを指している（配布先は mac / win）', () => {
    const icons = (conf.bundle?.icon ?? []).join(' ');
    assert.match(icons, /\.ico/, 'Windows の .ico を指していない');
    assert.match(icons, /\.icns/, 'macOS の .icns を指していない');
  });

  it('画面の入口がアイコンを指している', () => {
    const html = readFileSync(join(ROOT, 'app/index.html'), 'utf8');
    assert.match(html, /rel="icon"/);
    assert.match(html, /icon\.svg/);
  });

  it('**紹介のページもアイコンを指している**（タブで見分けが付く）', () => {
    const html = readFileSync(join(ROOT, 'site/index.html'), 'utf8');
    assert.match(html, /rel="icon"/);
    assert.match(html, /icon\.svg/);
  });

  it('紹介のページのアイコンが実在する', () => {
    assert.ok(existsSync(join(ROOT, 'site/icon.svg')));
    assert.ok(existsSync(join(ROOT, 'site/icon-180.png')));
  });

  it('**紹介のページのアイコンが、正本と同じ**（片方だけ古くならない）', () => {
    assert.equal(
      readFileSync(join(ROOT, 'site/icon.svg'), 'utf8'),
      readFileSync(join(ROOT, 'app/icon.svg'), 'utf8'),
    );
  });

  it('デスクトップだけなので、iOS / Android は置かない（D1 / PRD §4）', () => {
    for (const dir of ['android', 'ios']) {
      assert.equal(existsSync(join(ROOT, 'src-tauri/icons', dir)), false, `${dir} が残っている`);
    }
  });
});
