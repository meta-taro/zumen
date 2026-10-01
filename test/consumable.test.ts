/**
 * 外から取り込めること（md-business#240）。
 *
 * ## なぜ要るか
 *
 * 手元では `node src/cli.ts` がそのまま動く。**外から import すると動かない。**
 *
 * ```
 * ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
 * ```
 *
 * **Node は `node_modules` の中の TypeScript を意図的に受け付けない。**
 * 実際に別のパッケージを作って確かめた（2026-09-08）。
 *
 * ここが壊れると、**姉妹アプリの囲みの経路が丸ごと動かない。**
 * しかも `pnpm test` も `pnpm dev` も通ったままなので、**気づくのが配った後**になる
 * （ベースルール §23 と同じ形の壊れ方）。
 *
 * ## ここで見るもの
 *
 * 実際にビルドして走らせるところまではやらない（`pnpm test` が遅くなる）。
 * **口の宣言が食い違っていないこと**だけを見る。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = new URL('../', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
  exports?: Record<string, { types?: string; default?: string }>;
  files?: string[];
  scripts?: Record<string, string>;
};

describe('外から呼ぶ口', () => {
  it('宣言されている', () => {
    assert.ok(Object.keys(pkg.exports ?? {}).length > 0);
  });

  it('**`src` ではなく `dist` を指す**（Node が node_modules の .ts を受け付けない）', () => {
    for (const [name, entry] of Object.entries(pkg.exports ?? {})) {
      assert.match(entry.default ?? '', /^\.\/dist\//, `${name} の実体が dist を指していない`);
      assert.match(entry.types ?? '', /^\.\/dist\//, `${name} の型が dist を指していない`);
    }
  });

  it('**指す先の元ファイルが実在する**（参照だけ足して実体を忘れない。§23）', () => {
    for (const [name, entry] of Object.entries(pkg.exports ?? {})) {
      const source = (entry.default ?? '').replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts');
      assert.ok(existsSync(join(ROOT, source)), `${name} → ${source} が無い`);
    }
  });

  it('組み立てる手順がある', () => {
    assert.match(pkg.scripts?.['build'] ?? '', /tsconfig\.build\.json/);
    assert.ok(existsSync(join(ROOT, 'tsconfig.build.json')));
  });
});

describe('配るもの', () => {
  it('`dist` を配る', () => {
    assert.ok((pkg.files ?? []).includes('dist'));
  });

  it('**仕様も配る。** 取り込んだ側が形式を読めるように', () => {
    assert.ok((pkg.files ?? []).includes('spec'));
  });

  it('**実験と殻とテストは配らない**', () => {
    for (const unwanted of ['experiments', 'test', 'src-tauri', 'app', 'scripts']) {
      assert.equal((pkg.files ?? []).includes(unwanted), false, `${unwanted} を配ろうとしている`);
    }
  });

  it('ライセンスを添える（MIT は著作権表示が要る）', () => {
    assert.ok((pkg.files ?? []).includes('LICENSE'));
    assert.ok((pkg.files ?? []).includes('LICENSES.md'));
  });
});

describe('組み立ての設定', () => {
  // tsconfig は註釈を書ける（このリポジトリは理由を残す方針）。JSON.parse は読めないので落とす。
  const build = JSON.parse(
    readFileSync(join(ROOT, 'tsconfig.build.json'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''),
  ) as {
    compilerOptions?: Record<string, unknown>;
    exclude?: string[];
  };

  it('**`./layout.ts` を `./layout.js` に書き換える**（手元の書き方を変えずに済ませる）', () => {
    assert.equal(build.compilerOptions?.['rewriteRelativeImportExtensions'], true);
  });

  it('型も出す（取り込んだ側で補完が効く）', () => {
    assert.equal(build.compilerOptions?.['declaration'], true);
  });

  it('テストは配るものに混ぜない', () => {
    assert.ok((build.exclude ?? []).some((pattern) => pattern.includes('test')));
  });
});
