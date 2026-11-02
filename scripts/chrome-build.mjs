/**
 * Chrome 拡張（`packages/zumen-chrome`）を束ねる。
 *
 * | 出力 | どこで動くか | 形 |
 * |---|---|---|
 * | `dist/content.js` | github.com のすべてのページ | 小さな見張り役。ブラウザ向けの 1 本 |
 * | `dist/draw.js` | zumen が見つかったページだけ | 描画の本体（ELK を抱えて重い）。`import()` で読む ES モジュール |
 *
 * 道具は VS Code 拡張と同じ vite。`--zip` を付けると、ストアへ上げる zip も作る。
 */
import { cpSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../packages/zumen-chrome');
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });

const bundles = [
  { entry: 'src/content.ts', name: 'content', format: 'iife', fileName: 'content.js' },
  { entry: 'src/draw.ts', name: 'draw', format: 'es', fileName: 'draw.js' },
];

for (const bundle of bundles) {
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    build: {
      outDir: dist,
      emptyOutDir: false,
      target: 'es2022',
      minify: true,
      lib: { entry: resolve(root, bundle.entry), name: bundle.name, formats: [bundle.format], fileName: () => bundle.fileName },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });
  console.log(`zumen-chrome: ${bundle.fileName}`);
}

cpSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'));
for (const size of [16, 48, 128]) cpSync(resolve(root, `media/icon-${size}.png`), resolve(dist, `icon-${size}.png`));
cpSync(resolve(root, 'LICENSE'), resolve(dist, 'LICENSE'));

if (process.argv.includes('--zip')) {
  const { version } = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  const zip = resolve(root, `zumen-chrome-${version}.zip`);
  rmSync(zip, { force: true });
  execFileSync('zip', ['-qr', zip, '.'], { cwd: dist });
  console.log(`zumen-chrome: ${zip}`);
}
