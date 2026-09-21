/**
 * **台帳が壊れても、誰も気づかない**（2026-09-21）。
 *
 * `.claude/laps.tsv` は**無人で回したあと、人へ 1 枚にして渡す**ための材料
 * （`.claude/rules/周の回し方.md`）。300 周ぶん積んでから
 * **列がずれていたと分かっても、もう直せない。**
 *
 * 見るのは形だけ。**中身の良し悪しは見ない**（それは人が読む）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const KINDS = ['sample', 'brush', 'block'];
const HARVESTS = ['check', 'rule', 'tool', 'word', 'craft', 'none', ''];

const lines = readFileSync(new URL('../.claude/laps.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('#'));
const header = lines[0]!.split('\t');
const rows = lines.slice(1).map((line) => line.split('\t'));

describe('周の台帳', () => {
  it('**見出しの列が 7 つある**', () => {
    assert.deepEqual(header, ['周', '日付', '種別', '見本', '分野', '収穫', '一行']);
  });

  it('**どの行も列の数が同じ**（ずれたまま積むと、あとから直せない）', () => {
    const wrong = rows
      .map((row, i) => [i, row.length] as const)
      .filter(([, n]) => n !== header.length)
      .map(([i, n]) => `${i + 2} 行目: ${n} 列`);
    assert.deepEqual(wrong, []);
  });

  it('**周は 1 ずつ増える**（飛ばすと digest の期間が嘘になる）', () => {
    const laps = rows.map((row) => Number(row[0]));
    const wrong = laps.filter((lap, i) => i > 0 && lap !== laps[i - 1]! + 1);
    assert.deepEqual(wrong, [], '番号が飛んでいる');
  });

  it('**種別と収穫が、決めた語のどれか**', () => {
    const bad: string[] = [];
    for (const row of rows) {
      if (!KINDS.includes(row[2]!)) bad.push(`第 ${row[0]} 周の種別 "${row[2]}"`);
      if (!HARVESTS.includes(row[5]!)) bad.push(`第 ${row[0]} 周の収穫 "${row[5]}"`);
    }
    assert.deepEqual(bad, []);
  });

  it('**sample の行には、見本の名前と分野がある**', () => {
    const bad = rows
      .filter((row) => row[2] === 'sample' && (row[3]!.trim() === '' || row[4]!.trim() === ''))
      .map((row) => `第 ${row[0]} 周`);
    assert.deepEqual(bad, []);
  });

  it('**どの行にも一行の説明がある**（あとで読むのは人）', () => {
    const bad = rows.filter((row) => (row[6] ?? '').trim() === '').map((row) => `第 ${row[0]} 周`);
    assert.deepEqual(bad, []);
  });
});
