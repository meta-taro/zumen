/**
 * 文言の置き場所を守らせるテスト。
 *
 * **これは機能のテストではなく、仕組みが崩れていないことのテスト。**
 * 利用者に見える文字列が `src/messages.ts` の外へ散らばると、
 *
 * - 多言語化のときに探して回ることになる
 * - 誰も全文を読まなくなり、**日本語の違和感が誰にも見つからないまま出荷される**
 * - 同じものの呼び方が揺れる（正本／元ファイル／ソース）
 *
 * 散らばった時点で red にする。**気をつけるという対策は必ず漏れる。**
 *
 * ここでは**文面そのものは検査しない。**
 * 人が日本語を書き換えてもテストは落ちない（落ちるようにすると、文言を直すのが億劫になる）。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { LOCALES, messages, resolveLocale } from '../src/messages.ts';
import type { Catalog, Locale } from '../src/messages.ts';

const SRC = new URL('../src/', import.meta.url).pathname;
/** 文言そのものを置く場所。ここだけは日本語のリテラルを持ってよい。 */
const CATALOG = 'messages.ts';

const JAPANESE = /[ぁ-んァ-ヶ一-龥]/;

/** コメントを落とす。**行の途中の `//` は URL を巻き込むので、行頭側だけを見る。** */
function withoutComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line))
    .join('\n');
}

/** 引用符で囲まれた区間のうち、日本語を含むものを拾う。 */
function japaneseLiterals(code: string): string[] {
  const found: string[] = [];
  for (const match of withoutComments(code).matchAll(/'[^']*'|"[^"]*"|`[^`]*`/g)) {
    if (JAPANESE.test(match[0])) found.push(match[0]);
  }
  return found;
}

function sourceFiles(): string[] {
  return readdirSync(SRC).filter((name) => name.endsWith('.ts') && name !== CATALOG);
}

describe('文言の置き場所', () => {
  it('src の中に、文言表の外の日本語リテラルが無い', () => {
    const strays: string[] = [];
    for (const name of sourceFiles()) {
      const code = readFileSync(join(SRC, name), 'utf8');
      for (const literal of japaneseLiterals(code)) strays.push(`${name}: ${literal}`);
    }
    assert.deepEqual(
      strays,
      [],
      `利用者に見える文字列は src/${CATALOG} へ移すこと。見つかったもの:\n${strays.join('\n')}`,
    );
  });

  it('検出そのものが働いている（見張りが空回りしていない）', () => {
    // この検査が壊れると、散らばりに気づけないまま緑になる。
    assert.deepEqual(japaneseLiterals(`const a = '構成図';`), [`'構成図'`]);
    assert.deepEqual(japaneseLiterals(`// 構成図のこと\nconst a = 'diagram';`), []);
    assert.deepEqual(japaneseLiterals(`/** 構成図のこと */\nconst a = 'diagram';`), []);
  });
});

/** 文言表を平らにして、鍵と値の組で返す。 */
function flatten(catalog: Catalog): [string, unknown][] {
  return Object.entries(catalog).flatMap(([group, entries]) =>
    Object.entries(entries as Record<string, unknown>).map(
      ([key, value]) => [`${group}.${key}`, value] as [string, unknown],
    ),
  );
}

describe('文言表', () => {
  it('すべてのロケールが同じ鍵を持つ', () => {
    const base = flatten(messages('ja')).map(([key]) => key);
    for (const locale of LOCALES) {
      assert.deepEqual(flatten(messages(locale)).map(([key]) => key), base, `${locale} の鍵が違う`);
    }
  });

  it('空の文言が無い。引数を取るものは、その引数が出力に現れる', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of flatten(messages(locale))) {
        if (typeof value === 'function') {
          // 引数を落としている文言は、行番号や理由が人へ届かない。
          // 受け取る個数だけ目印を渡し、**全部が出力に現れること**を見る。
          const fn = value as (...args: unknown[]) => string;
          const probes = Array.from({ length: fn.length }, (_, i) => `ZZ${i}TOP`);
          assert.notEqual(fn.length, 0, `${locale} の ${key} が引数を取らない関数になっている`);
          const out = fn(...probes);
          for (const probe of probes) {
            assert.ok(out.includes(probe), `${locale} の ${key} が引数 ${probe} を落としている`);
          }
          continue;
        }
        assert.equal(typeof value, 'string', `${locale} の ${key} が文字列でない`);
        assert.notEqual((value as string).trim(), '', `${locale} の ${key} が空`);
      }
    }
  });
});

describe('ロケールの決め方', () => {
  const cases: [Record<string, string | undefined>, Locale][] = [
    [{}, 'ja'],
    [{ LANG: 'ja_JP.UTF-8' }, 'ja'],
    [{ LANG: 'en_US.UTF-8' }, 'en'],
    [{ LANG: 'C' }, 'ja'],
    [{ LANG: 'fr_FR.UTF-8' }, 'ja'],
    // ZUMEN_LOCALE は LANG を上書きする。CI や SSH 越しで LANG が意図と食い違うため。
    [{ LANG: 'en_US.UTF-8', ZUMEN_LOCALE: 'ja' }, 'ja'],
    [{ LANG: 'ja_JP.UTF-8', ZUMEN_LOCALE: 'en' }, 'en'],
  ];

  for (const [env, expected] of cases) {
    it(`${JSON.stringify(env)} なら ${expected}`, () => {
      assert.equal(resolveLocale(env), expected);
    });
  }
});
