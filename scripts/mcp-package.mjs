/**
 * **MCP だけの包み `@metataro/zumen-mcp` を組み立てる**（`pnpm mcp:package`。2026-10-10）。
 *
 * 本体の包み（`@metataro/zumen`）は依存を 3 つに絞ってあり、MCP SDK を入れない（`toSvg` を 1 つ呼ぶ人に
 * MCP の依存まで背負わせない —— 要らない依存はサプライチェーンの面積）。
 * **MCP が要る人だけが、こちらを入れる**：`claude mcp add zumen -- npx -y @metataro/zumen-mcp`。
 *
 * 中身は本体と同じ組み立て物（`dist/`）と、MCP が実行時に読むもの（仕様・見本・書体）。
 * ここで写すものは git に入れない（`packages/zumen-mcp/.gitignore`）—— 正本は `src/` と `examples/`。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PKG = join(ROOT, 'packages/zumen-mcp');

if (!existsSync(join(ROOT, 'dist/mcp.js'))) {
  console.error('dist/mcp.js がありません。先に pnpm build を走らせてください。');
  process.exit(1);
}
for (const name of ['dist', 'spec', 'fonts', 'examples', 'CHANGELOG.md', 'LICENSE', 'LICENSES.md']) {
  rmSync(join(PKG, name), { recursive: true, force: true });
}
cpSync(join(ROOT, 'dist'), join(PKG, 'dist'), { recursive: true });
for (const name of ['spec', 'fonts']) cpSync(join(ROOT, name), join(PKG, name), { recursive: true });
for (const name of ['CHANGELOG.md', 'LICENSE', 'LICENSES.md']) cpSync(join(ROOT, name), join(PKG, name));
mkdirSync(join(PKG, 'examples/gallery'), { recursive: true });
const gallery = join(ROOT, 'examples/gallery');
for (const name of readdirSync(gallery).filter((f) => f.endsWith('.zumen.yaml') || f === 'index.json')) {
  cpSync(join(gallery, name), join(PKG, 'examples/gallery', name));
}
console.log('packages/zumen-mcp を組み立てました。');
