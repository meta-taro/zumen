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

/**
 * **数を書いてある場所は、README だけではなかった**（2026-09-19）。
 *
 * 見本の枚数は 13 か所に書いてあるのに、**守られていたのは README.md の 2 行だけ**だった。
 * 残り 11 か所は手で直していて、実際に古くなっていた ——
 * README.ja.md の「開いている口は 14 個」は、口が 15 個になってからしばらくそのままだった。
 *
 * **手で直す場所は、いつか必ずずれる。** 書いてある場所を全部、機械に数えさせる。
 */
const QUOTES = [
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
] as const;

describe('数を書いてある場所は、どこも実物と合っている', () => {
  it('**13 か所以上ある。README だけ見ていると、残りが古くなる**', async () => {
    const { DOORS } = await import('../src/about.ts');
    const truth: Record<string, number> = {
      samples: samples().length,
      checks: checkCodes().size,
      doors: DOORS.length,
    };
    const wrong: string[] = [];
    for (const [file, re, what] of QUOTES) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      const said = re.exec(text);
      if (said === null) {
        wrong.push(`${file}: 「${what}」を書いた場所が見つからない（${re}）`);
        continue;
      }
      if (Number(said[1]) !== truth[what]) {
        wrong.push(`${file}: ${what} が ${said[1]}、実物は ${truth[what]}`);
      }
    }
    assert.deepEqual(wrong, []);
  });
});

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

