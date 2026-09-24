/**
 * **外から取り込んで、実際に動くか。**
 *
 * `pnpm test` は口の宣言が食い違っていないかしか見ない（`test/consumable.test.ts`）。
 * それでは足りない。実際に踏んだのはこれ。
 *
 * ```
 * ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING
 * ```
 *
 * **Node は `node_modules` の中の TypeScript を意図的に受け付けない。**
 * 手元では `node src/cli.ts` がそのまま動くので、**取り込む側で初めて壊れる。**
 * しかも `pnpm test` も `pnpm dev` も通ったままで、**気づくのは配った後**になる。
 *
 * ここでやること。
 *
 * 1. 組み立てる（`pnpm build`）
 * 2. `pnpm pack` で、**実際に配る形**にする（`files` の効き方まで含めて確かめる）
 * 3. 別のディレクトリへ入れて、**Node から import して呼ぶ**
 *
 * 姉妹アプリ（md-business）が囲みを図にする経路は、ここが通らないと丸ごと動かない。
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** **配る名前**。`package.json` から取る（手で書くと、改名したとき置き去りになる）。 */
const NAME = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).name;

/**
 * **Windows で `pnpm` を起動する道は、シェル経由しか無い。**
 *
 * この検査は `prepublishOnly` に入っているので、**落ちると publish そのものができない。**
 * npm の 2FA がパスキーで Windows 機に紐づいており、そこから出すしかないので致命的。
 *
 * 2026-09-24 に 2 回外した。姉妹セッションが実機で踏んだ順に書く。
 *
 * | 呼び方 | 結果 |
 * |---|---|
 * | `execFileSync('pnpm', args)` | **ENOENT**（-4058）。実体は `pnpm.cmd` |
 * | `execFileSync('pnpm.cmd', args)` | **EINVAL**（-4071）|
 *
 * 2 つ目は **Node の 2024 年のセキュリティ修正（CVE-2024-27980）**。
 * `.cmd` / `.bat` を `shell` 無しで起動することを拒否する。
 * **「`.cmd` にすればシェルが要らない」は誤り。**どのみちシェルが要る。
 *
 * `execFileSync(..., { shell: true })` でも通るが、Node が DEP0190 を出す。
 * **`execSync` にコマンド 1 本を渡す**ほうが、両方の OS で同じ形になって警告も出ない。
 *
 * **引用は自分で付ける。** シェルを通すので、`mkdtemp` の行き先に空白があると壊れる
 * （`C:\Users\First Last\AppData\...`）。`JSON.stringify` は使えない ——
 * **バックスラッシュを二重にする**ので、cmd がそのまま literal として読む。
 */
function quote(one) {
  if (one.includes('"')) throw new Error(`引数に " が入っています: ${one}`);
  return /[\s]/.test(one) ? `"${one}"` : one;
}

function run(command, args, cwd) {
  return execSync([command, ...args.map(quote)].join(' '), {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

console.log('組み立てる…');
run('pnpm', ['build'], ROOT);

const work = mkdtempSync(join(tmpdir(), 'zumen-consume-'));
console.log(`配る形にする（${work}）…`);
run('pnpm', ['pack', '--pack-destination', work], ROOT);
const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
if (tarball === undefined) throw new Error('pnpm pack が何も作りませんでした');

writeFileSync(
  join(work, 'package.json'),
  JSON.stringify(
    {
      name: 'zumen-consume-check',
      private: true,
      type: 'module',
      // **本当の名前で入れる**（2026-09-24。姉妹セッションの指摘）。
      // ここを `zumen` と書いていたので、`@metataro/zumen` へ改名したあとも
      // **偶然そのまま通っていた** —— 取り込む側の実際の書き方を検査していなかった。
      dependencies: { [NAME]: `file:./${tarball}` },
    },
    null,
    2,
  ),
);

// **取り込む側と同じ書き方で呼ぶ。** md-business が呼ぶのは toSvg 1 つ（#240）。
writeFileSync(
  join(work, 'check.mjs'),
  `import { toSvg } from '${NAME}';
import { about } from '${NAME}/about';
import { inspect } from '${NAME}/tools';

const source = [
  'version: 1',
  'pins:',
  '  lb:',
  '    appearance: primary',
  'nodes:',
  '  - id: lb',
  '    type: load-balancer',
  '    label: Load Balancer',
  '  - id: web',
  '    type: server',
  '    label: Web 01',
  'edges:',
  '  - from: lb',
  '    to: web',
  '    label: HTTPS',
  '',
].join('\\n');

const svg = await toSvg(source);
if (!svg.startsWith('<svg')) throw new Error('SVG が返っていません');

const dark = await toSvg(source, { theme: 'dark' });
if (dark === svg) throw new Error('theme が効いていません');

const vivid = await toSvg(source, { intent: 'vivid' });
if (vivid === svg) throw new Error('intent が効いていません');

const out = await inspect(source);
if (out.nodes !== 2 || out.edges !== 1) throw new Error('inspect の数が合いません');

// **CHANGELOG.md が配られているか。** files から漏れると、
// 取り込んだ側では版の記録が空で返る（気づくのは配った後）。
const meta = await about();
if (meta.releases.length === 0) throw new Error('CHANGELOG.md が配られていません');
if (meta.version === '0.0.0') throw new Error('版が入っていません');

console.log('  ok   toSvg / theme / intent / inspect / about（版の記録つき）');
`,
);

console.log(`入れて呼ぶ（${NAME}）…`);
run('pnpm', ['install', '--silent', '--ignore-workspace'], work);
process.stdout.write(run('node', ['check.mjs'], work));

console.log('\n外から取り込んで動きました。');
