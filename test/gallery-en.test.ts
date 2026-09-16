/**
 * **英語のページに、日本語のキャプションが 1 枚だけ残らないこと**（2026-09-16）。
 *
 * 見本を足して英語を書き忘れると、**英語のギャラリーにその 1 枚だけ日本語が出る。**
 * 141 枚ぜんぶ英語で、1 枚だけ日本語 —— 気づくのはたいてい人に見せたあと。
 *
 * 並びと分類の正本は `scripts/gallery-categories.mjs`、
 * 英語は名前で引く辞書（`scripts/gallery-en.mjs`）。**混ぜない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// @ts-expect-error 組み立て用のスクリプトは型を持たない（下で形を言う）
import { CATEGORIES } from '../scripts/gallery-categories.mjs';
// @ts-expect-error 同上
import { CAPTIONS_EN, GROUPS_EN } from '../scripts/gallery-en.mjs';

/** `.mjs` は型を持たないので、ここで形だけ言う。 */
interface Item {
  name: string;
}
interface Group {
  key: string;
  items: Item[];
}
const groups = CATEGORIES as Group[];
const captions = CAPTIONS_EN as Record<string, string>;
const heads = GROUPS_EN as Record<string, string>;

const names: string[] = groups.flatMap((group) => group.items.map((item) => item.name));

describe('見本の英語', () => {
  it('**どの見本にも英語がある**', () => {
    const missing = names.filter((name) => captions[name] === undefined);
    assert.deepEqual(missing, [], '英語のキャプションが無い見本');
  });

  it('**使われていない英語が残っていない**（見本を消したときの取り残し）', () => {
    const extra = Object.keys(captions).filter((name) => !names.includes(name));
    assert.deepEqual(extra, [], 'もう無い見本の英語が残っている');
  });

  it('**どの分類にも英語がある**', () => {
    const missing = groups.map((g) => g.key).filter((key) => heads[key] === undefined);
    assert.deepEqual(missing, []);
  });

  it('**英語のほうに日本語を書いていない**（貼り間違いの検出）', () => {
    const japanese = Object.entries(captions)
      .filter(([, text]) => /[ぁ-んァ-ヶ一-龠]/.test(text))
      .map(([name]) => name);
    assert.deepEqual(japanese, []);
  });

  it('**英語のページが、全部の見本を出している**', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('site/en/index.html', 'utf8');
    const figures = page.match(/<figure[^>]*data-cat=/g) ?? [];
    assert.equal(figures.length, names.length, '英語のページの枚数が合っていない');
  });
});
