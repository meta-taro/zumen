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
