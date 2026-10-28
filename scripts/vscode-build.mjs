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
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
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
