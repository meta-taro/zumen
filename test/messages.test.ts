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
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

import { LOCALES, messages, resolveLocale } from '../src/messages.ts';
import type { Catalog, Locale } from '../src/messages.ts';

const ROOT = new URL('../', import.meta.url).pathname;
/** 走査する場所。**画面（`app/`）も見る。** 見ないと多言語化が画面で効かない。 */
const SCANNED = ['src', 'app'];
/** 文言そのものを置く場所。ここだけは日本語のリテラルを持ってよい。 */
const CATALOG = 'src/messages.ts';

/**
 * ファイル名は文言ではない。
 *
 * `'本番構成.zumen.yaml'` のような値は、訳す対象ではなく**実在するファイルの名前**。
 * 文言表へ入れると、ロケールごとに別のファイルを指すことになる。
 *
 * **除外の一覧ではなく規則にする。** 一覧は増えるが、規則は増えない。
 */
const FILE_NAME = /^['"`][^'"`\s]+\.(ya?ml|md|svg|drawio|json|ts|css|html|png)(\?\w+)?['"`]$/;

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
    if (!JAPANESE.test(match[0])) continue;
    if (FILE_NAME.test(match[0])) continue;
    found.push(match[0]);
  }
  return found;
}

/**
 * `src/` と `app/` を**階層ごと**たどる。
 *
 * 直下だけを見ていると、階層を切った瞬間に見張りが素通りする。
 * **`.svelte` も見る**（画面の文言を見張らないと、多言語化が画面で効かない）。
 */
function sourceFiles(dir?: string): string[] {
  if (dir === undefined) return SCANNED.flatMap((name) => sourceFiles(join(ROOT, name)));
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(ts|svelte)$/.test(entry.name)) return [];
    if (relative(ROOT, path) === CATALOG) return [];
    return [path];
  });
}

describe('文言の置き場所', () => {
  it('たどる先を間違えていない（src と app を実際に読めている）', () => {
    const files = sourceFiles();
    assert.ok(files.length >= 10, `見つかったのは ${files.length} 件`);
    assert.ok(files.some((path) => path.endsWith('.svelte')), '画面を見ていない');
  });

  it('ファイル名は文言として数えない（訳す対象ではない）', () => {
    assert.deepEqual(japaneseLiterals(`const a = '本番構成.zumen.yaml';`), []);
    // ただし、**文らしいものは見逃さない**。
    assert.deepEqual(japaneseLiterals(`const a = '図を開いてください。';`), [`'図を開いてください。'`]);
  });

  it('src の中に、文言表の外の日本語リテラルが無い', () => {
    const strays: string[] = [];
    for (const path of sourceFiles()) {
      const code = readFileSync(path, 'utf8');
      const name = relative(ROOT, path);
      for (const literal of japaneseLiterals(code)) strays.push(`${name}: ${literal}`);
    }
    assert.deepEqual(
      strays,
      [],
      `利用者に見える文字列は ${CATALOG} へ移すこと。見つかったもの:\n${strays.join('\n')}`,
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
        // 一覧で返す文言もある（エージェントへ渡す規則など）。
        if (Array.isArray(value)) {
          assert.notEqual(value.length, 0, `${locale} の ${key} が空の一覧`);
          for (const item of value) {
            assert.equal(typeof item, 'string', `${locale} の ${key} に文字列でないものがある`);
            assert.notEqual(item.trim(), '', `${locale} の ${key} に空の項目がある`);
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

  it('**`process` が無くても落ちない**（画面側で全体が止まった実例がある）', () => {
    // ブラウザには process が無い。既定引数でそれを触ると、
    // 文言を 1 つ使った瞬間に ReferenceError で全部止まる。
    //
    // **`navigator` も消す。** Node 22 には navigator があり、その language は
    // 動かす機械の設定で変わる。消さないと、**手元では通って CI で落ちる**
    // （実際にそうなった。2026-09-07）。
    const savedProcess = Reflect.get(globalThis, 'process');
    const savedNavigator = Reflect.get(globalThis, 'navigator');
    try {
      Reflect.deleteProperty(globalThis, 'process');
      Reflect.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
      assert.doesNotThrow(() => resolveLocale());
      assert.equal(resolveLocale(), 'ja');
    } finally {
      Reflect.set(globalThis, 'process', savedProcess);
      Reflect.defineProperty(globalThis, 'navigator', { value: savedNavigator, configurable: true });
    }
  });

  it('`process` が無ければ navigator.language を見る', () => {
    const saved = Reflect.get(globalThis, 'process');
    const savedNav = Reflect.get(globalThis, 'navigator');
    try {
      Reflect.deleteProperty(globalThis, 'process');
      Reflect.defineProperty(globalThis, 'navigator', { value: { language: 'en-US' }, configurable: true });
      assert.equal(resolveLocale(), 'en');
    } finally {
      Reflect.set(globalThis, 'process', saved);
      Reflect.defineProperty(globalThis, 'navigator', { value: savedNav, configurable: true });
    }
  });
});
