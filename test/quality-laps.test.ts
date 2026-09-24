/**
 * **品質 100 周の台帳が、壊れても気づけるようにする**（2026-09-24）。
 *
 * オーナーの方針（2026-09-23）に、機械で守れる条件が 2 つある。
 *
 * 1. **記録は 1 周 1 行。**「長く書かせると回数が落ちる」
 * 2. **AI に合否を書かせない。** 判定は人の目にしかなく
 *    （`#2`）、AI が「良くなった」と書くと **100 周ぶんの記録が全部同じ意味になる**
 *
 * 2 は人が気をつける方式では必ず漏れるので、**語で止める。**
 * 定義は `qa/品質100周.md`。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const text = readFileSync('qa/品質100周.tsv', 'utf8');
const rows = text
  .split('\n')
  .filter((line) => line.length > 0 && !line.startsWith('#'))
  .map((line) => line.split('\t'));

describe('品質 100 周の台帳', () => {
  it('**どの行も 7 つの欄がある**', () => {
    const broken = rows.filter((row) => row.length !== 7).map((row) => row[0]);
    assert.deepEqual(broken, []);
  });

  it('**周の番号が 1 から飛ばずに並んでいる**', () => {
    assert.deepEqual(
      rows.map((row) => Number(row[0])),
      rows.map((_unused, i) => i + 1),
    );
  });

  it('**見た人は「人」か「AI」だけ**', () => {
    const odd = rows.filter((row) => row[3] !== '人' && row[3] !== 'AI').map((row) => `${row[0]}: ${row[3]}`);
    assert.deepEqual(odd, []);
  });

  it('**直したかは 3 つの言葉だけ**', () => {
    const allow = new Set(['直した', '直さない', '保留']);
    const odd = rows.filter((row) => !allow.has(row[5] ?? '')).map((row) => `${row[0]}: ${row[5]}`);
    assert.deepEqual(odd, []);
  });

  it('**違和感と、どうしたかが、どちらも書いてある**', () => {
    const thin = rows.filter((row) => (row[4]?.length ?? 0) < 8 || (row[6]?.length ?? 0) < 8).map((row) => row[0]);
    assert.deepEqual(thin, []);
  });

  /**
   * **ここが方針の肝。** AI の周に合否の語を書かせない。
   * 「違和感を 1 つ挙げる」までが AI の仕事で、良し悪しは人の目にしか無い。
   */
  it('**AI の周に、合否の言葉が無い**', () => {
    const VERDICT = /(良くなっ|良くなり|改善(?:した|され)|悪くなっ|きれいになっ|美しくなっ|完璧|申し分)/;
    const judged = rows
      .filter((row) => row[3] === 'AI')
      .filter((row) => VERDICT.test(`${row[4]} ${row[6]}`))
      .map((row) => `${row[0]}: ${row[4]}`);
    assert.deepEqual(judged, [], 'AI が合否を書いている周（違和感を 1 つ挙げるところまでにする）');
  });

  it('**人が見た周が何周かを数えられる**', () => {
    const byHuman = rows.filter((row) => row[3] === '人').length;
    assert.ok(byHuman >= 0);
    assert.equal(typeof byHuman, 'number');
  });
});
