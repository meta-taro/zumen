/**
 * **数を書いてある場所の、ただ 1 つの表。**
 *
 * `test/docs-numbers.test.ts` が「合っているか」を見て、
 * `scripts/counts.mjs` が「合わせる」。**同じ表を 2 か所に書かない。**
 *
 * 2026-09-21 に書き出した。それまでは、見本を 1 枚足すたびに
 * **5 ファイル 8 か所を手で書き換えていた**（1 晩で 10 回以上）。
 * テストが落ちて気づくので事故にはならなかったが、
 * **落ちて気づくのは、直す手間を人が払っているのと同じ。**
 */
import { readFileSync, readdirSync } from 'node:fs';

/** 数を書いてある場所。**捕捉するのは数字だけ**（その 1 か所を書き換える）。 */
export const QUOTES = [
  ['README.ja.md', /\*\*(\d+) 枚を \[`examples\/gallery\/`\]/, 'samples'],
  ['README.ja.md', /同梱の見本 (\d+) 枚の目次と正本を返す/, 'samples'],
  ['README.ja.md', /開いている口は (\d+) 個/, 'doors'],
  ['README.md', /(\d+) example drawings, all generated/, 'samples'],
  ['README.md', /A validator \((\d+) checks\)/, 'checks'],
  ['scripts/og.mjs', /見本 (\d+) 枚 ／ テキスト正本/, 'samples'],
  ['scripts/og.mjs', /(\d+) example drawings &middot; diagrams as text/, 'samples'],
  ['site/index.html', /テキスト正本の作図ツール。見本 (\d+) 枚・MIT。/, 'samples'],
  ['site/index.html', /見本 (\d+) 枚、検査 \d+ 項目/, 'samples'],
  ['site/index.html', /見本 \d+ 枚、検査 (\d+) 項目/, 'checks'],
  ['site/index.html', /描かれないものを名指しする検査 (\d+) 項目/, 'checks'],
  ['site/index.html', /その直しが次の生成で壊れない図。見本 (\d+) 枚。/, 'samples'],
  ['site/en/index.html', /(\d+) example drawings, \d+ checks, MCP server included/, 'samples'],
  ['site/en/index.html', /\d+ example drawings, (\d+) checks, MCP server included/, 'checks'],
  ['site/en/index.html', /(\d+) checks that name what will not be drawn/, 'checks'],
  ['site/en/index.html', /your fix survives\. (\d+) example drawings\./, 'samples'],
];

/** 検査の種類。**`validate` と、置いたあとに出すもの（`cli`）の両方。** */
function checkCodes(root) {
  const found = new Set();
  for (const file of ['src/validate.ts', 'src/cli.ts']) {
    const text = readFileSync(new URL(file, root), 'utf8');
    for (const m of text.matchAll(/add\(\s*'(?:warning|error)',\s*'([a-z-]+)'/g)) found.add(m[1]);
    for (const m of text.matchAll(/code: '([a-z-]+)'/g)) found.add(m[1]);
  }
  return found;
}

/** 実物の数。`root` はリポジトリの根（`new URL('../', import.meta.url)`）。 */
export async function truth(root) {
  const { DOORS } = await import(new URL('src/about.ts', root).href);
  return {
    samples: readdirSync(new URL('examples/gallery/', root)).filter((f) => f.endsWith('.zumen.yaml')).length,
    checks: checkCodes(root).size,
    doors: DOORS.length,
  };
}
