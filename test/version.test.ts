/**
 * **版が 4 か所で揃っていること。**
 *
 * ## なぜ要るか
 *
 * 0.0.0 → 0.1.0 にしたとき、**3 か所しか直さなかった。**
 * `Cargo.lock` の中の自分自身の版が残り、CI の `--locked` で落ちた。
 *
 * ```
 * error: cannot update the lock file … because --locked was passed to prevent this
 * ```
 *
 * 手元の `pnpm test` は通っていた。**Rust を見ていないため。**
 * 気づくのは CI で、しかも「型と借用を見る」という名前の段で落ちるので、
 * **版の話だと分かりにくい。**
 *
 * ## ここで見るもの
 *
 * 直し方（手か `pnpm version:set` か）に関わらず、**結果が揃っているか**だけを見る。
 * 揃え方を見張ると、別のやり方で直したときに素通りする。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (name: string): string => readFileSync(join(ROOT, name), 'utf8');

/** 版が書いてある 4 か所。**1 つ増えたらここへ足すこと。** */
function versions(): Record<string, string | null> {
  const pkg = JSON.parse(read('package.json')) as { version: string };
  const tauri = JSON.parse(read('src-tauri/tauri.conf.json')) as { version: string };

  const cargo = /^version = "([^"]+)"/m.exec(read('src-tauri/Cargo.toml'));
  // lock の中の**自分自身**の項。ほかの依存の版と取り違えない。
  const lock = /^name = "zumen"\nversion = "([^"]+)"/m.exec(read('src-tauri/Cargo.lock'));

  return {
    'package.json': pkg.version,
    'src-tauri/tauri.conf.json': tauri.version,
    'src-tauri/Cargo.toml': cargo?.[1] ?? null,
    'src-tauri/Cargo.lock': lock?.[1] ?? null,
  };
}

describe('版', () => {
  const found = versions();

  it('4 か所すべてから読める', () => {
    for (const [where, value] of Object.entries(found)) {
      assert.notEqual(value, null, `${where} から版を読めない`);
    }
  });

  it('**4 か所が揃っている**（3 か所だけ直して CI で落ちた）', () => {
    const unique = [...new Set(Object.values(found))];
    assert.equal(unique.length, 1, JSON.stringify(found, null, 2));
  });

  it('形が `x.y.z`', () => {
    assert.match(found['package.json'] ?? '', /^\d+\.\d+\.\d+$/);
  });

  it('**0.0.0 ではない**（版の記録を返す以上、起点が要る）', () => {
    assert.notEqual(found['package.json'], '0.0.0');
  });
});

describe('版を上げる道具', () => {
  it('`pnpm version:set` がある', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    assert.match(pkg.scripts?.['version:set'] ?? '', /scripts\/version\.mjs/);
  });

  it('**4 か所すべてを触る**（1 つでも漏れたら、また CI で落ちる）', () => {
    const source = read('scripts/version.mjs');
    for (const where of Object.keys(versions())) {
      assert.ok(source.includes(where), `${where} を触っていない`);
    }
  });

  it('記録の「未リリース」を、その版へ移す', () => {
    assert.match(read('scripts/version.mjs'), /未リリース/);
  });
});

describe('記録と実体', () => {
  it('**いまの版が `CHANGELOG.md` に載っている**（記録の無い版を配らない）', () => {
    const now = versions()['package.json'];
    assert.match(read('CHANGELOG.md'), new RegExp(`^## ${now?.replace(/\./g, '\\.')} `, 'm'));
  });
});
