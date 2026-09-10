/**
 * **版を 4 か所いっぺんに上げる。**
 *
 *     pnpm version:set 0.2.0
 *
 * ## なぜ道具にするか
 *
 * 版は 4 か所に書いてある。0.0.0 → 0.1.0 のとき、**3 か所しか直さなかった。**
 * `Cargo.lock` の中の自分自身の版が残り、CI が `--locked` で落ちた。
 *
 * 手元の `pnpm test` は通っていた（Rust を見ていないため）。
 * **気づくのは CI で、しかも「型と借用を見る」という名前の段**なので、
 * 版の話だと分かりにくい。
 *
 * `test/version.test.ts` が**結果の一致**を見張るので、
 * 手で直しても構わない。この道具は手間を減らすだけ。
 *
 * ## 記録も一緒に動かす
 *
 * `CHANGELOG.md` の「未リリース」を、その版の欄へ移す。
 * **記録の無い版を配らない**ため（`zumen_about` が返すのはこの記録）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

const next = process.argv[2];
if (next === undefined || !/^\d+\.\d+\.\d+$/.test(next)) {
  console.error('使い方: pnpm version:set <x.y.z>');
  console.error('  例) pnpm version:set 0.2.0');
  process.exit(2);
}

function edit(name, change) {
  const path = join(ROOT, name);
  const before = readFileSync(path, 'utf8');
  const after = change(before);
  if (after === before) {
    console.error(`${name} を書き換えられませんでした。手で直してください。`);
    process.exit(1);
  }
  writeFileSync(path, after);
  console.log(`  ${name}`);
}

console.log(`版を ${next} にします。`);

// 1. package.json — 先頭の "version" だけ。依存の版を触らない。
edit('package.json', (text) => text.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${next}$2`));

// 2. src-tauri/tauri.conf.json
edit('src-tauri/tauri.conf.json', (text) =>
  text.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${next}$2`),
);

// 3. src-tauri/Cargo.toml — [package] の version。依存の版を触らない。
edit('src-tauri/Cargo.toml', (text) => text.replace(/^version = "[^"]+"/m, `version = "${next}"`));

// 4. src-tauri/Cargo.lock — cargo に書かせる。**手で書くと形が崩れる。**
console.log('  src-tauri/Cargo.lock');
execFileSync('cargo', ['update', '-p', 'zumen', '--offline'], {
  cwd: join(ROOT, 'src-tauri'),
  stdio: 'inherit',
});

// 5. CHANGELOG.md — 「未リリース」をこの版へ移し、空の「未リリース」を上に置く。
// **その機械の日付**で書く。`toISOString()` は UTC なので、
// 日本時間の朝に叩くと前日になる（実際になった）。
const today = new Intl.DateTimeFormat('sv-SE').format(new Date());
edit('CHANGELOG.md', (text) => {
  const heading = /^## 未リリース$/m;
  if (!heading.test(text)) return text;
  return text.replace(heading, `## 未リリース\n\n## ${next} — ${today}`);
});

console.log(`\n版を ${next} にしました。**CHANGELOG.md の中身を確かめてください** —`);
console.log('「未リリース」に何も無かった場合、空の欄ができています。');
console.log('確かめ方: pnpm test（4 か所の一致と、記録に載っているかを見ます）');
