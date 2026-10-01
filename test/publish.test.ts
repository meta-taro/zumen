/**
 * **配るものに、要らないものを混ぜない**（2026-09-24）。
 *
 * `@metataro/zumen` を初めて npm へ出す直前に、3 つ見つかった。
 *
 * | 出るところだった | 中身 |
 * |---|---|
 * | 要らない依存 4 つ | `@tauri-apps/api` `@tauri-apps/plugin-dialog` `@modelcontextprotocol/sdk` `zod`。**`toSvg` を 1 つ呼ぶために Tauri と MCP SDK まで入る** |
 * | 動かないファイル | `dist/mcp.*` と `dist/live/` —— 公開の入口に無く、依存も外したので **import できない** |
 * | 置き忘れの 1.9MB | `dist/posts/*.png`（X 投稿用の画像）。`dist/` は gitignore なので**誰にも見えない場所に溜まっていた** |
 *
 * **要らない依存は、そのままサプライチェーンの面積。**
 * pnpm を選んだ理由（`onlyBuiltDependencies` / `minimumReleaseAge`）と正面から矛盾する。
 *
 * ここは **`src/` を辿る**（`dist/` は組み立てないと無く、CI の `pnpm test` は組み立てない）。
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  exports: Record<string, { default: string }>;
  dependencies: Record<string, string>;
  files: string[];
};

/** `./dist/embed.js` → `src/embed.ts`。**配るのは組み立てたものだが、辿るのは正本。** */
const sourceOf = (out: string): string => out.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, '.ts');

/** その入口から辿れる、外のパッケージ。 */
function outsideOf(entry: string): Set<string> {
  const seen = new Set<string>();
  const outside = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    for (const found of readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)) {
      const spec = found[1] ?? '';
      if (spec.startsWith('.')) {
        queue.push(join(dirname(file), spec));
        continue;
      }
      if (spec.startsWith('node:')) continue;
      outside.add(spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/'));
    }
  }
  return outside;
}

describe('配るもの', () => {
  const used = new Set<string>();
  for (const entry of Object.values(pkg.exports)) {
    for (const one of outsideOf(sourceOf(entry.default))) used.add(one);
  }

  it('**入口をちゃんと辿れている**（1 つも読めていない、では検査にならない）', () => {
    assert.ok(Object.keys(pkg.exports).length >= 4);
    assert.ok(used.size >= 1, '外の依存が 1 つも見つからない。辿り方が壊れている');
  });

  it('**`dependencies` は、公開の入口が本当に読んでいるものだけ**', () => {
    assert.deepEqual([...Object.keys(pkg.dependencies)].sort(), [...used].sort());
  });

  it('**入口から辿れないものは配らない**（`dist/mcp` と `dist/live`）', () => {
    for (const path of ['!dist/mcp.*', '!dist/live']) {
      assert.ok(pkg.files.includes(path), `files から ${path} が消えている`);
    }
  });

  /**
   * **`rm -rf` は Windows で動かない。**
   * npm の 2FA がパスキーで Windows 機に紐づいており、**そちらから publish する目が
   * ある**（2026-09-24）。publish の直前に走る `build` が cmd.exe で落ちると、
   * **出せないか、古い `dist` のまま出る。**
   */
  it('**組み立ての前に `dist` を消す**（置き忘れが混ざらないように・Windows でも）', () => {
    const build = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> })
      .scripts.build;
    assert.match(build ?? '', /rmSync\('dist'/);
    assert.doesNotMatch(build ?? '', /\brm -rf\b/, 'rm -rf は Windows で動かない');
  });
});
