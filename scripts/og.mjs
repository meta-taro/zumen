/**
 * **SNS に貼ったときに出るカードの絵**（OGP / Twitter card）を作り直す。
 *
 * リンクを貼っただけで出るのは、**題・説明・この 1 枚**だけ。
 * 「何をする道具か」は、文より絵のほうが速い —— だから
 * **中身は見本そのもの**にしてある（別に作った宣伝画ではない）。
 *
 * 1,200×630 を 2 倍で描き、`site/og.png`（日本語）と `site/en/og.png`（英語）へ出す。
 * **英語のカードには英語の見本だけ**を並べる（図の中が日本語だと、そこで読むのをやめる）。
 *
 * PNG にするのに Chrome を使う（`scripts/icon.mjs` と同じ理由。依存を増やさない）。
 * **Chrome が無ければ、その旨を言って止まる。**
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const W = 1200;
const H = 630;

/** `scripts/icon.mjs` と同じ探し方。 */
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

/**
 * カードに並べる見本。**2 枚。**
 *
 * 3 枚並べたら、1 枚あたり 400px で**タイムラインの縮小表示ではただの灰色**になった
 * （2026-09-17。実物を見て気づいた）。**枚数より、1 枚が何か分かること。**
 */
const CARDS = [
  {
    out: 'site/og.png',
    lang: 'ja',
    title: 'zumen',
    line: 'AI が描き、人が直し、<br><b>その直しが次の生成で壊れない。</b>',
    foot: '見本 229 枚 ／ テキスト正本 ／ MIT',
    samples: ['72-歯周チャート', '25-路線図'],
  },
  {
    out: 'site/en/og.png',
    lang: 'en',
    title: 'zumen',
    line: 'The AI draws it,<br>you fix one thing,<br><b>and your fix survives.</b>',
    foot: '229 example drawings &middot; diagrams as text &middot; MIT',
    samples: ['140-Exterior-wall-platform-framing', '159-Fire-IAP-map'],
  },
];

const dir = mkdtempSync(join(tmpdir(), 'zumen-og-'));

for (const card of CARDS) {
  // **見本は埋め込む。** 外から読ませると、撮るときに間に合わないことがある。
  const drawings = card.samples.map((name) => {
    const svg = readFileSync(join(ROOT, 'examples/gallery', `${name}.svg`), 'utf8');
    return `<div class="shot">${svg.replace(/<svg /, '<svg preserveAspectRatio="xMidYMid meet" ')}</div>`;
  });

  const html = `<!doctype html>
<html lang="${card.lang}"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${W}px; height: ${H}px; background: #ffffff; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans", sans-serif;
    color: #23232b; display: flex;
  }
  .shots {
    width: 700px; height: ${H}px; flex: none;
    display: flex; flex-direction: column; gap: 1px;
    background: #d8d8de; border-right: 3px solid #23232b;
  }
  .shot { background: #fff; overflow: hidden; height: ${(H - 1) / 2}px; padding: 20px 24px; }
  .shot svg { width: 100%; height: 100%; display: block; }
  .band { flex: 1; height: ${H}px; padding: 0 46px; display: flex; flex-direction: column; justify-content: center; }
  h1 { font-size: 64px; letter-spacing: 0.02em; font-weight: 700; }
  p { font-size: 30px; margin-top: 18px; line-height: 1.4; color: #3a3a44; }
  p b { color: #23232b; }
  .foot { font-size: 20px; margin-top: 22px; color: #6b6b76; }
</style></head><body>
<div class="shots">${drawings.join('')}</div>
<div class="band">
  <h1>${card.title}</h1>
  <p>${card.line}</p>
  <p class="foot">${card.foot}</p>
</div>
</body></html>`;

  const page = join(dir, `${card.lang}.html`);
  writeFileSync(page, html);
  const out = join(ROOT, card.out);
  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    '--default-background-color=FFFFFF',
    `--screenshot=${out}`,
    `--window-size=${W},${H}`,
    `file://${page}`,
  ], { stdio: 'ignore' });
  console.log(`${card.out} を作り直しました（${W * 2}×${H * 2}）。`);
}
