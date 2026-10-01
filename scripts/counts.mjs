/**
 * **書いてある数を、実物に合わせる。**
 *
 * `pnpm gallery` から呼ばれる。**人が数えない。**
 * どこに書いてあるかは `scripts/quoted-numbers.mjs` の 1 つの表が持っている。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { QUOTES, truth } from './quoted-numbers.mjs';

const root = new URL('../', import.meta.url);
const real = await truth(root);
const changed = [];

for (const [file, pattern, what] of QUOTES) {
  const url = new URL(file, root);
  const text = readFileSync(url, 'utf8');
  const found = pattern.exec(text);
  if (found === null) {
    console.error(`  ${file} に「${what}」の数が見つかりません（${pattern}）`);
    process.exitCode = 1;
    continue;
  }
  const want = String(real[what]);
  if (found[1] === want) continue;
  // **捕捉した 1 か所だけを書き換える。** 同じ数字が近くにあっても巻き込まない。
  const at = found.index + found[0].indexOf(found[1]);
  writeFileSync(url, text.slice(0, at) + want + text.slice(at + found[1].length));
  changed.push(`${file}: ${what} ${found[1]} → ${want}`);
}

console.log(
  changed.length === 0
    ? `書いてある数は、どこも実物と合っています（見本 ${real.samples} 枚／検査 ${real.checks} 項目／口 ${real.doors} 個）。`
    : `書いてある数を ${changed.length} か所、実物に合わせました。\n  ${changed.join('\n  ')}`,
);
