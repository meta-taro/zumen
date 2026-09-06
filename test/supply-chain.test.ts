/**
 * 依存の防御が**実際に効いているか**（ベースルール §1）。
 *
 * ## なぜ設定ファイルの中身ではなく、効き目を見るのか
 *
 * 2026-09-06 まで、この設定は `package.json` の `"pnpm"` に書いてあった。
 * **pnpm 11 はそこを見ない。** 書いてあるのに黙って無視され、
 * `pnpm config get minimumReleaseAge` は `undefined` を返していた。
 *
 * つまり**「書いてあること」を検査しても、効いていないことは見つからない。**
 * だからここでは pnpm 自身に聞く。
 *
 * これが落ちたら、防御が外れている。**設定を消す前に、なぜ要らないのかを書くこと。**
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { describe, it } from 'node:test';

const ROOT = new URL('../', import.meta.url).pathname;

/** pnpm に「いま効いている値」を聞く。**ファイルの中身ではない。** */
function config(key: string): string {
  return execFileSync('pnpm', ['config', 'get', key], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

describe('依存の防御が効いている', () => {
  it('minimumReleaseAge が 24 時間以上（公開直後のパッケージを隔離する）', () => {
    const value = config('minimumReleaseAge');
    assert.notEqual(value, 'undefined', 'pnpm が読んでいない。置き場所を確かめること');
    assert.ok(Number(value) >= 1440, `いまの値: ${value}`);
  });

  it('**install script の許可リストが空**（どの依存もスクリプトを走らせない）', () => {
    const value = config('onlyBuiltDependencies');
    assert.notEqual(value, 'undefined', 'pnpm が読んでいない。置き場所を確かめること');
    // 空配列は "[]"。中身が入ったら、なぜ要るのかを decisions.md へ書くこと。
    assert.equal(value.replace(/\s/g, ''), '[]', `許可されているものがある: ${value}`);
  });

  it('全部のビルドを許す設定が入っていない', () => {
    assert.notEqual(config('dangerouslyAllowAllBuilds'), 'true');
  });
});
