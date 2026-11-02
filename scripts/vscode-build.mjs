/**
 * VS Code の拡張（`packages/zumen-vscode`）を 1 本ずつ束ねる。
 *
 * 束ねるのは 3 本。**行き先が違うので、束ね方も違う。**
 *
 * | 出力 | どこで動くか | 形 |
 * |---|---|---|
 * | `dist/extension.js` | 拡張の本体（Node） | CommonJS（Node 向けに束ねると名前は `.js` に決まる）。`vscode` は外に出す |
 * | `dist/preview.js` | `.zumen.yaml` の横の画面 | ブラウザ向けの 1 本 |
 * | `dist/markdown.js` | Markdown プレビューの中 | ブラウザ向けの 1 本 |
 *
 * 道具は画面（`app/`）と同じ vite。**束ねるためだけに道具を足さない。**
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../packages/zumen-vscode');
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });

const bundles = [
  { entry: 'src/extension.ts', name: 'extension', format: 'cjs', fileName: 'extension.js', node: true },
  { entry: 'src/preview-webview.ts', name: 'preview', format: 'iife', fileName: 'preview.js', node: false },
  { entry: 'src/markdown-preview.ts', name: 'markdown', format: 'iife', fileName: 'markdown.js', node: false },
];

for (const bundle of bundles) {
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    build: {
      outDir: dist,
      emptyOutDir: false,
      target: bundle.node ? 'node20' : 'es2022',
      minify: true,
      ssr: bundle.node ? resolve(root, bundle.entry) : undefined,
      lib: {
        entry: resolve(root, bundle.entry),
        name: bundle.name,
        formats: [bundle.format],
        fileName: () => bundle.fileName,
      },
      rollupOptions: { external: bundle.node ? ['vscode'] : [] },
    },
    ssr: bundle.node ? { noExternal: true, external: ['vscode'] } : undefined,
  });
  console.log(`zumen-vscode: ${bundle.fileName}`);
}

/**
 * **MCP サーバを同梱する**（D47 の 2 段目）。拡張を入れるだけで、Copilot や端末のエージェントが図を作れるように。
 *
 * 動かすのは VS Code が持っている実行環境（`ELECTRON_RUN_AS_NODE`）。**使う人に Node を入れてもらわない。**
 * 置き方は npm の `@metataro/zumen-mcp` と同じで、`server/dist/mcp.js` から見て `../spec` などを読む。
 *
 * 書体を切り出す `subset-font` だけは束ねない。中で wasm を `require.resolve` で探すので、
 * 束ねると見つからなくなる。依存ごと `server/node_modules` へ写す。
 */
const server = resolve(root, 'server');
const repo = resolve(import.meta.dirname, '..');
rmSync(server, { recursive: true, force: true });

await build({
  configFile: false,
  root: repo,
  logLevel: 'warn',
  build: {
    outDir: resolve(server, 'dist'),
    emptyOutDir: false,
    target: 'node20',
    minify: false,
    ssr: resolve(repo, 'src/mcp.ts'),
    rollupOptions: { external: ['subset-font'], output: { format: 'es', entryFileNames: 'mcp.js' } },
  },
  ssr: { noExternal: true, external: ['subset-font'] },
});

for (const name of ['spec', 'fonts']) cpSync(resolve(repo, name), resolve(server, name), { recursive: true });
for (const name of ['package.json', 'CHANGELOG.md', 'LICENSE', 'LICENSES.md']) cpSync(resolve(repo, name), resolve(server, name));
mkdirSync(resolve(server, 'examples/gallery'), { recursive: true });
const gallery = resolve(repo, 'examples/gallery');
for (const name of readdirSync(gallery).filter((f) => f.endsWith('.zumen.yaml') || f === 'index.json')) {
  cpSync(resolve(gallery, name), resolve(server, 'examples/gallery', name));
}

/** `subset-font` と、その依存を平たく写す（pnpm の入れ子は辿って実体を取る）。 */
function copyWithDependencies(name, from, seen = new Set()) {
  if (seen.has(name)) return;
  seen.add(name);
  const dir = packageDir(name, from);
  cpSync(dir, resolve(server, 'node_modules', name), { recursive: true, dereference: true });
  const deps = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')).dependencies ?? {};
  for (const dep of Object.keys(deps)) copyWithDependencies(dep, dir, seen);
}
/** `package.json` を exports で閉じている包みもあるので、入口から上へ辿って探す。 */
function packageDir(name, from) {
  let dir = dirname(realpathSync(createRequire(resolve(from, 'package.json')).resolve(name)));
  while (!existsSync(resolve(dir, 'package.json')) || JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')).name !== name) {
    dir = dirname(dir);
  }
  return dir;
}
copyWithDependencies('subset-font', repo);
console.log('zumen-vscode: server/dist/mcp.js');
