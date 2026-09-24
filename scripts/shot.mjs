/**
 * **見本を 1 枚、実物として画面に出す**（`pnpm shot <番号>`）。
 *
 * `.claude/rules/周の回し方.md` と `qa/品質100周.md` が要求している
 * 「**描いた図を 1 枚は実物で見る**」を、毎回 Chrome の引数を思い出さずに済ませるためだけの道具。
 *
 * **数の検査（`pnpm inspect` の 93 項目）は「読めるか」しか見ていない。**
 * 重なり・はみ出し・細すぎ —— どれも壊れているかどうかの話で、
 * **「読めるが、変」を 1 つも拾わない。** それは出して見るしかない。
 *
 * PNG は `qa/shots/` に出す（`.gitignore`。見るためだけのもので、正本ではない）。
 * 幅は既定 1400px。`--width` で変えられる。
 *
 * ```
 * pnpm shot 310            # 見本 310 を出す
 * pnpm shot 310 --dark     # 暗い側
 * pnpm shot 310 --width 2000
 * ```
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIR = join(ROOT, 'examples/gallery');
const OUT = join(ROOT, 'qa/shots');

const args = process.argv.slice(2);
const no = args.find((a) => /^\d+$/.test(a));
const dark = args.includes('--dark');
// `indexOf` は無いとき -1 を返すので、そのまま +1 すると **番号そのもの**を幅に読む
// （`pnpm shot 310` が 310px で出た）。
const at = args.indexOf('--width');
const width = at === -1 ? 1400 : Number(args[at + 1]) || 1400;

if (no === undefined) {
  console.error('見本の番号を渡してください。例: pnpm shot 310');
  process.exit(1);
}

const name = readdirSync(DIR).find((f) => f.startsWith(`${no}-`) && f.endsWith(dark ? '-dark.svg' : '.svg') && (dark || !f.endsWith('-dark.svg')));
if (name === undefined) {
  console.error(`見本 ${no} の SVG が見つかりません。`);
  process.exit(1);
}

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((path) => typeof path === 'string' && path.length > 0);
const chrome = CANDIDATES.find((path) => existsSync(path));
if (chrome === undefined) {
  console.error('Chrome が見つかりません。CHROME_PATH を渡すか、Chrome を入れてください。');
  process.exit(1);
}

const svg = readFileSync(join(DIR, name), 'utf8');
const found = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
const ratio = found === null ? 1 : Number(found[2]) / Number(found[1]);
const height = Math.max(200, Math.round(width * ratio));

mkdirSync(OUT, { recursive: true });
const page = join(tmpdir(), `zumen-shot-${no}.html`);
writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: ${dark ? '#16161a' : '#fff'}; }
  svg { width: 100vw; height: 100vh; display: block; }
</style></head><body>${svg.replace(/<svg /, '<svg preserveAspectRatio="xMidYMid meet" ')}</body></html>`);

const out = join(OUT, `${no}${dark ? '-dark' : ''}.png`);
const before = existsSync(out) ? statSync(out).mtimeMs : 0;
// **Chrome は `--user-data-dir` を渡すと PNG を書いたあと終了しない**（`og-samples.mjs` 参照）。
// ここは 1 枚だけなので控え場を渡さず、素直に終了を待つ。
const child = spawn(chrome, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--disable-background-networking',
  '--virtual-time-budget=2000',
  `--default-background-color=${dark ? '16161A' : 'FFFFFF'}`,
  `--screenshot=${out}`,
  `--window-size=${width},${height}`,
  `file://${page}`,
], { stdio: 'ignore' });

child.on('exit', () => {
  if (!existsSync(out) || statSync(out).mtimeMs <= before) {
    console.error(`見本 ${no} を撮れませんでした。`);
    process.exit(1);
  }
  console.log(`${name}`);
  console.log(`qa/shots/${no}${dark ? '-dark' : ''}.png（${width}×${height}）`);
});
