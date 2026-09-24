/**
 * **見本 1 枚ごとの共有カード**（2026-09-22。オーナーの指示で作った）。
 *
 * ## なぜ要るか
 *
 * 344 枚の見本ページが、**どれも同じ `og.png`** を出していた。
 * X・Slack・Facebook は **SVG を描画しない**ので、共有すると全部同じ絵になる。
 *
 * 容量は問題にならない —— GitHub Pages の上限 1 GB に対し、
 * 公開しているのは約 37MB（3%）で、344 枚足しても約 70MB（6%）。
 *
 * ## やり方
 *
 * Chrome の `--screenshot` は 1 回ずつ起動する作りなので、**並べて走らせる。**
 * SVG より新しい PNG は飛ばすので、**2 回目からは足したぶんだけ**で済む。
 *
 * ```bash
 * pnpm og:samples            # 足りないものだけ
 * pnpm og:samples --all      # 全部描き直す
 * ```
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
// @ts-expect-error 組み立て用のスクリプトは型を持たない
import { CATEGORIES } from './gallery-categories.mjs';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const W = 1200;
const H = 630;
/** **同時に走らせる数。** 増やしすぎると 1 枚あたりが遅くなる。 */
const LANES = 5;

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

const all = process.argv.includes('--all');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const outDir = join(ROOT, 'site/og');
mkdirSync(outDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'zumen-ogs-'));

const jobs = [];
for (const group of CATEGORIES) {
  for (const item of group.items) {
    const no = item.name.split('-')[0];
    const svgPath = join(ROOT, 'examples/gallery', `${item.name}.svg`);
    const out = join(outDir, `${no}.png`);
    if (!existsSync(svgPath)) continue;
    // **SVG より新しければ飛ばす。** 2 回目からは足したぶんだけ。
    if (!all && existsSync(out) && statSync(out).mtimeMs >= statSync(svgPath).mtimeMs) continue;
    jobs.push({ no, name: item.name, svgPath, out, caption: item.caption, group: group.label });
  }
}

/**
 * **見本が無くなったら、札も片付ける。**
 *
 * 残すと、消したはずの見本の絵だけが配られ続ける
 * （`scripts/pages.mjs` が古いページを消すのと同じ理由）。
 */
const live = new Set(jobs.map((job) => `${job.no}.png`));
for (const group of CATEGORIES) {
  for (const item of group.items) live.add(`${item.name.split('-')[0]}.png`);
}
let dropped = 0;
for (const name of readdirSync(outDir)) {
  if (live.has(name)) continue;
  rmSync(join(outDir, name));
  dropped += 1;
}
if (dropped > 0) console.log(`見本の無い共有カードを ${dropped} 枚 片付けました。`);

if (jobs.length === 0) {
  console.log('共有カードは、どれも図より新しいので描き直していません。');
  process.exit(0);
}

/**
 * **札に載せる分だけ切り出す。**
 *
 * 図の置き場は **1140 × 530**（横長）。縦長の図をそのまま収めると、
 * 幅が余って**ただの灰色の染み**になる —— 見本 293（縦横 1 : 2.7）で
 * 図の幅は **195px** しか無く、中の字は読めなかった。
 * `scripts/og.mjs` が 2026-09-17 に学んだのと同じ失敗（**枚数より、1 枚が何か分かること**）。
 *
 * だから **`viewBox` の高さを詰めて、上だけを見せる。**
 * ただし **半分より先は切らない** —— 切りすぎると、何の図か分からなくなる。
 *
 * | 図の形 | どうするか |
 * |---|---|
 * | 置き場より横長 | そのまま全部（余るのは上下） |
 * | 少し縦長 | 幅いっぱいに合わせ、はみ出た下を切る |
 * | うんと縦長 | **上半分**まで。それ以上は切らない（横に余る） |
 *
 * **札は入口であって、図そのものではない。** 全部は、押した先にある。
 */
function crop(text) {
  const box = { w: 1140, h: 530 };
  const found = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(text);
  if (found === null) return text;
  const w = Number(found[1]);
  const h = Number(found[2]);
  const show = Math.min(h, Math.max((box.h * w) / box.w, h / 2));
  return text.replace(found[0], `viewBox="0 0 ${w} ${show.toFixed(2)}"`);
}

/** 1 枚ぶんの札。**図を大きく、言葉は下に 1 行。** */
function card(job) {
  const svg = crop(readFileSync(job.svgPath, 'utf8')).replace(/<svg /, '<svg preserveAspectRatio="xMidYMin meet" ');
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${W}px; height: ${H}px; background: #fff; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", sans-serif;
    color: #23232b; display: flex; flex-direction: column;
  }
  .shot { flex: 1; overflow: hidden; padding: 26px 30px 14px; }
  .shot svg { width: 100%; height: 100%; display: block; }
  .band {
    flex: none; height: 96px; border-top: 3px solid #23232b;
    padding: 0 30px; display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .cap { font-size: 26px; font-weight: 700; line-height: 1.25; overflow: hidden; max-height: 66px; }
  .who { flex: none; text-align: right; color: #6b6b76; font-size: 18px; line-height: 1.5; }
  .who b { display: block; color: #23232b; font-size: 22px; letter-spacing: 0.02em; }
</style></head><body>
<div class="shot">${svg}</div>
<div class="band">
  <div class="cap">${esc(job.caption)}</div>
  <div class="who"><b>zumen</b>${esc(job.group)} ／ 見本 ${esc(job.no)}</div>
</div>
</body></html>`;
}

/**
 * **Chrome に 1 枚撮らせて、書けたら帰る。**
 *
 * ここで 1 回転んだ（2026-09-22）。気をつける所が 3 つある。
 *
 * 1. **`file://` を付ける。** 生のパスを渡すと Chrome は検索語だと思って外へ出ていく。
 * 2. **人別の控え場（`--user-data-dir`）を渡すと、PNG を書いたあと終了しない。**
 *    `execFile` で待つと 1 枚ごとに時間切れ（120 秒）まで待つことになる ——
 *    344 枚のうち 30 枚しか出なかったのは、これが理由だった。
 *    **だから終了を待たず、出来た PNG を見つけて自分で止める。**
 * 3. それでも控え場は**要る**。既定の控え場は 1 つしかないので、
 *    横に並べても順番待ちになる（5 本並べて 51 秒＝速くならなかった）。
 *    **走る本数ぶんだけ**作って使い回す。
 */
function shoot(job, lane) {
  const page = join(tmp, `${job.no}.html`);
  writeFileSync(page, card(job));
  const child = spawn(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-background-networking',
    '--force-device-scale-factor=1',
    '--default-background-color=FFFFFF',
    // **待つのをやめる時刻。** 外へ出る用事は無いので、2 秒で切り上げてよい。
    '--virtual-time-budget=2000',
    `--screenshot=${job.out}`,
    `--window-size=${W},${H}`,
    `--user-data-dir=${join(tmp, `lane${lane}`)}`,
    `file://${page}`,
  ], { stdio: 'ignore' });

  return new Promise((resolve, reject) => {
    const before = existsSync(job.out) ? statSync(job.out).mtimeMs : 0;
    // **PNG が新しくなったら、そこで止める。**
    const watch = setInterval(() => {
      if (!existsSync(job.out) || statSync(job.out).mtimeMs <= before) return;
      finish(null);
    }, 200);
    const limit = setTimeout(() => finish(new Error(`見本 ${job.no} の共有カードが 60 秒で出来ませんでした。`)), 60_000);
    child.on('exit', () => {
      // 自分から終わったなら、書けたかどうかで決める。
      if (existsSync(job.out) && statSync(job.out).mtimeMs > before) finish(null);
    });
    function finish(err) {
      clearInterval(watch);
      clearTimeout(limit);
      child.kill('SIGKILL');
      if (err === null) resolve();
      else reject(err);
    }
  });
}

const started = Date.now();
let done = 0;
/**
 * **1 枚の失敗で、全部を捨てない**（2026-09-22。ここで 1 回転んだ）。
 *
 * `Promise.all` は 1 本が転ぶとその場で投げるので、
 * **300 枚描けていても「失敗」として終わる**（実際 344 枚中 182 枚で止まった）。
 * 描けたものは残し、**転んだ見本の番号だけを最後に言う。**
 * 一度だけ描き直す —— Chrome が偶に立ち上がり損ねるのを見たため。
 */
const failed = [];
const queue = [...jobs];
await Promise.all(
  Array.from({ length: LANES }, async (_unused, lane) => {
    for (;;) {
      const job = queue.shift();
      if (job === undefined) return;
      try {
        await shoot(job, lane);
      } catch {
        try {
          await shoot(job, lane);
        } catch (again) {
          failed.push(job.no);
          console.error(`  ${again instanceof Error ? again.message : String(again)}`);
          continue;
        }
      }
      done += 1;
      if (done % 25 === 0) console.log(`  ${done} / ${jobs.length} 枚`);
    }
  }),
);
console.log(`共有カードを ${done} 枚 描きました（${Math.round((Date.now() - started) / 1000)} 秒）。`);
if (failed.length > 0) {
  console.error(`描けなかった見本が ${failed.length} 枚あります: ${failed.join(' ')}`);
  console.error('もう一度 `pnpm og:samples` を走らせてください（描けた分は飛ばします）。');
  process.exit(1);
}
