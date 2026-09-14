/**
 * **README に書いた数が、実物と合っているか。**
 *
 * 2026-09-14 の一晩で、見本の枚数を **3 回**手で直した（93 → 94 → 95 → 96 → 97）。
 * 検査の件数は **1 件ずれたまま**だった（57 と書いてあって、実際は 58）。
 *
 * **古い文書は、無い文書より悪い**（ベースルール §10）。
 * 手で数える限り、また必ずずれるので、**数だけは機械に数えさせる。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

/** 検査の種類。**`validate` と、置いたあとに出すもの（`cli`）の両方。** */
function checkCodes(): Set<string> {
  const found = new Set<string>();
  for (const file of ['src/validate.ts', 'src/cli.ts']) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const m of text.matchAll(/add\('(?:warning|error)', '([a-z-]+)'/g)) found.add(m[1]!);
    for (const m of text.matchAll(/code: '([a-z-]+)'/g)) found.add(m[1]!);
  }
  return found;
}

function samples(): string[] {
  const dir = new URL('../examples/gallery/', import.meta.url);
  return readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'));
}

describe('README の数', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

  it('**見本の枚数が合っている**', () => {
    const said = readme.match(/(\d+) example drawings/);
    assert.ok(said !== null, 'README に見本の枚数が書かれていない');
    assert.equal(Number(said[1]), samples().length);
  });

  it('**検査の件数が合っている**', () => {
    const said = readme.match(/A validator \((\d+) checks\)/);
    assert.ok(said !== null, 'README に検査の件数が書かれていない');
    assert.equal(Number(said[1]), checkCodes().size);
  });
});

/**
 * **仕様に書いていない検査は、別の実装から見えない。**
 *
 * 仕様（`spec/zumen-format-v1.md`）は
 * **別の実装が同じファイルを読み書きできる**ように書いてある文書。
 * 検査の一覧に抜けがあると、その実装は同じ指摘を出せない。
 *
 * 2026-09-14 に測ったら、**58 件のうち 22 件が仕様に載っていなかった。**
 */
describe('仕様に、検査がぜんぶ載っている', () => {
  it('**検査の印が、仕様の表に書いてある**', () => {
    const spec = readFileSync(new URL('../spec/zumen-format-v1.md', import.meta.url), 'utf8');
    const missing = [...checkCodes()].filter((code) => !spec.includes(`\`${code}\``)).sort();
    assert.deepEqual(missing, []);
  });
});

/**
 * **日本語版の README の数も、実物と合っているか。**
 *
 * 英語版だけ直して日本語版を忘れる、が実際に起きた ——
 * 2026-09-15 に測ったら、日本語版は**まだ「23 枚」**と書いてあった（実際は 107 枚）。
 */
describe('README.ja の数', () => {
  it('**見本の枚数が合っている**', () => {
    const readme = readFileSync(new URL('../README.ja.md', import.meta.url), 'utf8');
    const said = readme.match(/\*\*(\d+) 枚を \[`examples\/gallery\/`\]/);
    assert.ok(said !== null, 'README.ja に見本の枚数が書かれていない');
    assert.equal(Number(said[1]), samples().length);
  });
});

