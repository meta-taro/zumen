/**
 * **README のリンクと画像は、絶対 URL で書く**（2026-10-07）。
 *
 * npm の頁は README を tarball から描くので、**相対リンクは npm の頁で全部 404 になる**
 * （0.3.3・0.4.0 で 20 本が死んでいた）。GitHub では相対でも動くので、書いた人は気づけない。
 * 文書は `https://github.com/meta-taro/zumen/blob/develop/…`、
 * 画像は紹介ページ（`https://meta-taro.github.io/zumen/gallery/…`。SVG を画像の型で返す）を指す。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const FILES = ['README.md', 'README.ja.md'];
const ABSOLUTE = /^(https?:|#|mailto:)/;

describe('README のリンク', () => {
  for (const file of FILES) {
    it(`**${file} に相対リンクが無い**（npm の頁で死ぬ）`, () => {
      const text = readFileSync(file, 'utf8');
      const links = [...text.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]!);
      const sources = [...text.matchAll(/\bsrc="([^"]+)"/g)].map((m) => m[1]!);
      assert.deepEqual([...links, ...sources].filter((t) => !ABSOLUTE.test(t)), []);
    });
  }
});
