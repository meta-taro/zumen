/**
 * **見本の SVG を描き直す**（`examples/gallery/`）。
 *
 * 正本（`*.zumen.yaml`）を直したのに SVG を描き直し忘れると、
 * 紹介のページ（`site/`）には**古い図**が出る。ビルドもテストも通ったまま壊れる
 * ——「参照だけ足してアップロードを忘れる」のと同じ壊れ方（ベースルール §23）。
 *
 * `--check` を付けると、書かずに**食い違いだけを出す**（CI 用）。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { kindOf } from '../src/kind.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const DIR = 'examples/gallery';
const check = process.argv.includes('--check');

const stale = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const placed = await layout(text);
  const plan = kindOf(text) === 'placement';
  for (const theme of ['light', 'dark']) {
    const out = join(DIR, `${file.replace('.zumen.yaml', '')}${theme === 'dark' ? '-dark' : ''}.svg`);
    const svg = render(placed, theme, 'safe', plan);
    if (!check) {
      writeFileSync(out, svg);
      continue;
    }
    let was = null;
    try {
      was = readFileSync(out, 'utf8');
    } catch {
      // 無いものは「古い」に数える（下で名前を出す）。
    }
    if (was !== svg) stale.push(out);
  }
}

if (!check) {
  console.log(`${readdirSync(DIR).filter((f) => f.endsWith('.zumen.yaml')).length} 枚を描き直しました。`);
} else if (stale.length > 0) {
  console.log(`正本と食い違う SVG が ${stale.length} 枚あります（pnpm gallery で描き直してください）。`);
  for (const path of stale) console.log(`  ${path}`);
  process.exitCode = 1;
} else {
  console.log('SVG は正本と一致しています。');
}
