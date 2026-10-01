/**
 * **カバレッジの門が、実際に置いてあること。**
 *
 * 2026-09-13 の棚卸しで分かったこと ——
 * **`src/` のカバレッジは 98.4% あったが、測る仕組みが無かった。**
 * 良い数字だったのは結果論で、下がっても誰も気づけない状態だった。
 *
 * ベースルール §4 は「テストを後回しにしない」と言うが、
 * **後回しにしていないことを、何で確かめるか**が書いていなかった。
 *
 * ここで見るのは**門があるか**だけ。数字そのものは CI が見る。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const ROOT = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8')) as {
  scripts: Record<string, string>;
};
const ci = readFileSync(new URL('.github/workflows/checks.yml', ROOT), 'utf8');

describe('カバレッジの門', () => {
  it('`pnpm coverage` がある', () => {
    assert.ok(pkg.scripts.coverage, 'coverage スクリプトが無い');
  });

  it('**しきい値が指定してある**（測るだけで止めないなら門ではない）', () => {
    const script = pkg.scripts.coverage!;
    for (const flag of ['--test-coverage-lines=', '--test-coverage-branches=', '--test-coverage-functions=']) {
      assert.ok(script.includes(flag), `${flag} が無い`);
    }
  });

  it('**見るのは `src/` だけ。** experiments と scripts は使い捨て', () => {
    assert.match(pkg.scripts.coverage!, /--test-coverage-include=src/);
  });

  it('**CI で回る。** 手元だけで回しても、忘れれば同じこと', () => {
    assert.match(ci, /pnpm coverage/);
  });

  it('しきい値が 80 を下回っていない（ベースルール §4 の目安）', () => {
    for (const m of pkg.scripts.coverage!.matchAll(/--test-coverage-\w+=(\d+)/g)) {
      assert.ok(Number(m[1]) >= 80, `しきい値 ${m[1]} が目安の 80 を下回っている`);
    }
  });
});
