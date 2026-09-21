/**
 * **回した周を、戻ってきた人へ 1 枚で渡す。**
 *
 * ## なぜ要るか
 *
 * 時間で区切って無人で回すと、**戻ったときに 100 も 300 も commit が積んである。**
 * `git log` を読ませるのは渡し方として雑なので、**何が起きたかを数えて出す。**
 *
 * 比（見本 1 : 手入れ N）も出すが、**これは報告であって門番ではない。**
 * 2026-09-21 に「そんなに問題にならない」と言われたので、落とす作りにはしていない。
 * 時刻は誤魔化せないが、比は図の中身しだいで動く。
 */
import { readFileSync } from 'node:fs';

const WINDOW = 20;
const YIELD = ['check', 'rule', 'tool'];
const LABEL = {
  check: '検査を足した',
  rule: '決まりを足した',
  tool: '道具を足した',
  word: '言葉の誤りを直した',
  craft: '作図の作法が分かった',
  none: '',
};

const rows = readFileSync(new URL('../.claude/laps.tsv', import.meta.url), 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '' && !line.startsWith('#'))
  .slice(1)
  .map((line) => {
    const [lap, date, kind, sample, field, harvest, note] = line.split('\t');
    return { lap: Number(lap), date, kind, sample, field, harvest, note };
  });

if (rows.length === 0) {
  console.log('まだ 1 周も記録がありません（.claude/laps.tsv）。');
  process.exit(0);
}

const digest = process.argv.includes('--digest');
const scope = digest ? rows : rows.slice(-WINDOW);
const samples = scope.filter((r) => r.kind === 'sample');
const brushes = scope.filter((r) => r.kind === 'brush');
const blocked = scope.filter((r) => r.kind === 'block');
const harvest = samples.filter((r) => YIELD.includes(r.harvest)).length;

console.log(`第 ${scope[0].lap} 〜 ${scope.at(-1).lap} 周（${scope[0].date} 〜 ${scope.at(-1).date}）`);
console.log(`  見本 ${samples.length} ／ 手入れ ${brushes.length} ／ 人待ち ${blocked.length}`);
console.log(`  新しい見本から出た収穫（検査・決まり・道具）… ${harvest} 件`);
console.log(`  いまの目安 …… 見本 1 : 手入れ ${harvest >= 3 ? 1 : harvest >= 1 ? 2 : 3}`);

if (digest) {
  const by = new Map();
  for (const r of scope) by.set(r.harvest, (by.get(r.harvest) ?? 0) + 1);
  console.log('');
  console.log('何が出たか');
  for (const key of ['check', 'rule', 'tool', 'word', 'craft']) {
    if (!by.get(key)) continue;
    console.log(`  ${LABEL[key]} … ${by.get(key)} 件`);
    for (const r of scope.filter((x) => x.harvest === key)) console.log(`    第 ${r.lap} 周  ${r.note}`);
  }
  if (samples.length > 0) {
    console.log('');
    console.log(`足した見本 ${samples.length} 枚`);
    for (const r of samples) console.log(`  ${r.sample}（${r.field}）`);
  }
  if (blocked.length > 0) {
    console.log('');
    console.log('**人待ちで止めたもの**');
    for (const r of blocked) console.log(`  第 ${r.lap} 周  ${r.note}`);
  }
}

if (process.argv.includes('--fields')) {
  const { CATEGORIES } = await import('./gallery-categories.mjs');
  const thin = CATEGORIES.map((g) => [g.label, g.items.length]).sort((a, b) => a[1] - b[1]);
  console.log('');
  console.log('薄い分野（描くならここから）');
  for (const [label, n] of thin.slice(0, 4)) console.log(`  ${String(n).padStart(3)}  ${label}`);
  console.log('濃い分野');
  for (const [label, n] of thin.slice(-3).reverse()) console.log(`  ${String(n).padStart(3)}  ${label}`);
}
