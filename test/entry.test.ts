/**
 * 入口の判定（Windows でも動くこと）。
 *
 * 以前は `import.meta.url.endsWith(argv[1].split('/').pop())` と書いていた。
 * **Windows では `process.argv[1]` が逆斜線で来るので、判定が常に偽になる。**
 * その結果、`pnpm mcp` も `pnpm validate` も**何もせずに終わる**。
 *
 * 配布して別の機械で試してもらう以上、ここは当てずっぽうにしない。
 */
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { isEntry } from '../src/entry.ts';

const HERE = new URL(import.meta.url).pathname;

describe('入口の判定', () => {
  it('同じファイルなら真', () => {
    assert.equal(isEntry(pathToFileURL(HERE).href, HERE), true);
  });

  it('別のファイルなら偽', () => {
    assert.equal(isEntry(pathToFileURL(HERE).href, `${HERE}.other.ts`), false);
  });

  it('**名前だけ同じで場所が違うものを、真にしない**', () => {
    // 末尾一致で済ませていた頃は、これを取り違えた。
    assert.equal(isEntry(pathToFileURL('/a/b/mcp.ts').href, '/x/y/mcp.ts'), false);
  });

  it('入口が無ければ偽（import されただけ）', () => {
    assert.equal(isEntry(pathToFileURL(HERE).href, undefined), false);
    assert.equal(isEntry(pathToFileURL(HERE).href, ''), false);
  });

  it('**つないだ道（シンボリックリンク）から叩かれても真**', () => {
    // Node は入口の道をたどって実体の url にするが、`argv[1]` はつないだ道のまま来る。
    // VS Code の拡張をつないで入れたとき、MCP サーバが黙って終わった（2026-10-28）。
    const dir = mkdtempSync(join(tmpdir(), 'zumen-entry-'));
    const real = join(dir, 'real.js');
    const link = join(dir, 'link.js');
    writeFileSync(real, '');
    symlinkSync(real, link);
    try {
      assert.equal(isEntry(pathToFileURL(realpathSync(real)).href, link), true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('file: でない url でも落ちない', () => {
    assert.equal(isEntry('data:text/javascript,1', HERE), false);
    assert.equal(isEntry('https://example.com/a.js', HERE), false);
  });
});
