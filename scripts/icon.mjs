/**
 * アプリのアイコンを作り直す。
 *
 * **正本は `app/icon.svg` の 1 つだけ。** ここから
 *
 * 1. 1024×1024 の PNG を起こし
 * 2. `tauri icon` で各プラットフォームぶんを `src-tauri/icons/` へ出す
 *
 * PNG を直接いじらないこと。**直したことが SVG に戻らず、次の生成で消える。**
 *
 * SVG から PNG に落とすのに Chrome を使っている（`scripts/gui-check.mjs` と同じ理由で、
 * 依存を増やさずに済むため）。**Chrome が無ければ、その旨を言って止まる。**
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SOURCE = join(ROOT, 'app/icon.svg');
const SIZE = 1024;

/** `scripts/gui-check.mjs` と同じ探し方。 */
const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter((path) => typeof path === 'string' && path.length > 0);

const chrome = CANDIDATES.find((path) => existsSync(path));
if (chrome === undefined) {
  console.error('Chrome が見つかりません。CHROME_PATH を渡すか、Chrome を入れてください。');
  process.exit(1);
}

if (!existsSync(SOURCE)) {
  console.error(`${SOURCE} がありません。`);
  process.exit(1);
}

const png = join(mkdtempSync(join(tmpdir(), 'zumen-icon-')), 'icon.png');

// 角の外を透かす。**塗ってしまうと macOS の角丸の外が白く出る。**
execFileSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--default-background-color=00000000',
  `--screenshot=${png}`,
  `--window-size=${SIZE},${SIZE}`,
  `file://${SOURCE}`,
], { stdio: 'ignore' });

console.log(`${SIZE}×${SIZE} を起こしました。`);

execFileSync('pnpm', ['exec', 'tauri', 'icon', png, '-o', join(ROOT, 'src-tauri/icons')], {
  cwd: ROOT,
  stdio: 'inherit',
});

// この製品はデスクトップだけ（D1 / PRD §4）。**要らないものを置いたままにしない。**
execFileSync('rm', ['-rf', join(ROOT, 'src-tauri/icons/android'), join(ROOT, 'src-tauri/icons/ios')]);

console.log('src-tauri/icons/ を作り直しました。');
