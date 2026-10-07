/**
 * **README の画面の絵を撮る**（`pnpm readme:shots`。2026-10-07）。
 *
 * README は「何ができるか」を、文より先に画面で見せる。画面は変わるので、
 * **手で撮らずに撮り直せるようにしておく** —— 手で撮った絵は、画面を直した日から嘘になる。
 *
 * 撮るのは、架空のデータ（`docs/readme/steps-*`）を開いた画面だけ。
 * 人の環境（ファイルの置き場・接続名・ホスト名）が写らないよう、
 * **ファイルを開かずに `load(text, 名前)` で渡す**（名前も架空）。
 *
 * やり方は `scripts/gui-check.mjs` と同じ（dev サーバと headless Chrome を自分で立て、CDP で動かす）。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { timelapse } from '../src/timelapse.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5181;
const CDP = 9231;
const OUT = `${ROOT}docs/readme`;
const SHOTS = `${ROOT}site/readme`;
const CHROME = [
  process.env['CHROME_PATH'],
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => path !== undefined && existsSync(path));

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

if (CHROME === undefined) {
  console.log('Chrome が見つからないので撮れませんでした。CHROME_PATH に道を渡してください。');
  process.exitCode = 2;
} else {
  mkdirSync(SHOTS, { recursive: true });
  // **冒頭の動く絵**：AI が描く → 人が 1 つ動かす → もう一度頼む → 人の直しが残る。
  for (const lang of ['ja', 'en']) {
    const steps = [1, 2, 3, 4].map((n) => readFileSync(`${OUT}/steps-${lang}/${n}.zumen.yaml`, 'utf8'));
    writeFileSync(`${SHOTS}/hero-${lang}.svg`, (await timelapse(steps, { hold: 2.5 })).svg);
  }
  const vite = spawn('node', ['./node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  try {
    await waitFor(`http://localhost:${PORT}/`);
    for (const lang of ['ja', 'en']) await shoot(lang);
  } finally {
    vite.kill();
  }
}

/** 1 つの言語で、開いた画面と、提案の差分の画面を撮る。 */
async function shoot(lang) {
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${CDP}`,
      `--user-data-dir=${ROOT}app-dist/.readme-shots-${lang}`,
      `--lang=${lang}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--window-size=1280,560',
      `http://localhost:${PORT}`,
    ],
    { stdio: 'ignore' },
  );
  try {
    await waitFor(`http://localhost:${CDP}/json/version`);
    const { evaluate, capture, close, addScript, reload } = await connect();
    const until = async (expression, limit = 15000) => {
      const deadline = Date.now() + limit;
      while (Date.now() < deadline) {
        if ((await evaluate(expression)) === true) return true;
        await sleep(100);
      }
      throw new Error(`待ちきれませんでした: ${expression}`);
    };
    // **段の見出し（note）は画面では外す。** 差分が見出しの書き換えで始まると、AI の提案の中身が埋もれる。
    const read = (step) =>
      readFileSync(`${OUT}/steps-${lang}/${step}.zumen.yaml`, 'utf8').replace(/  - id: note\n(    .*\n)+/, '');
    const name = lang === 'ja' ? '注文の流れ.zumen.yaml' : 'order-flow.zumen.yaml';

    // **画面の言葉は navigator.language で決まる**（`src/messages.ts`）。Chrome の --lang は
    // 手元の OS の設定に負けることがあるので、ページが読まれる前に言語を差し替えて読み直す。
    await addScript(`Object.defineProperty(navigator, 'language', { get: () => ${JSON.stringify(lang === 'ja' ? 'ja-JP' : 'en-US')} })`);
    await reload();
    await sleep(800);
    await until(`globalThis.zumen !== undefined`);
    // ② の段（人が 1 つ動かしたあと）を開く。太い枠が人の印。
    await evaluate(`globalThis.zumen.load(${JSON.stringify(read(2))}, ${JSON.stringify(name)})`);
    await until(`document.querySelectorAll('g.node').length >= 4`);
    await evaluate(`globalThis.zumen.fit()`);
    await sleep(400);
    writeFileSync(`${SHOTS}/gui-open-${lang}.png`, await capture());

    // AI の提案（④ の段）を読み込む —— 差分が出て、人が適用するまで正本は変わらない。
    await evaluate(`globalThis.zumen.propose(${JSON.stringify(read(4))})`);
    await until(`globalThis.zumen.diff.length > 0`);
    await sleep(400);
    writeFileSync(`${SHOTS}/gui-diff-${lang}.png`, await capture());
    close();
    console.log(`${lang}: gui-open-${lang}.png / gui-diff-${lang}.png`);
  } finally {
    chrome.kill();
    await sleep(300);
  }
}

async function waitFor(url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`起動しませんでした: ${url}`);
}

async function connect() {
  const list = await (await fetch(`http://localhost:${CDP}/json/list`)).json();
  const page = list.find((tab) => tab.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok) => socket.addEventListener('open', ok, { once: true }));
  let id = 0;
  const waiting = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
    }
  });
  const send = (method, params = {}) => {
    const mine = (id += 1);
    return new Promise((ok) => {
      waiting.set(mine, ok);
      socket.send(JSON.stringify({ id: mine, method, params }));
    });
  };
  await send('Runtime.enable');
  await send('Page.enable');
  return {
    close: () => socket.close(),
    evaluate: async (expression) => {
      const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (out.result?.exceptionDetails !== undefined) {
        throw new Error(out.result.exceptionDetails.exception?.description ?? 'evaluate に失敗');
      }
      return out.result?.result?.value;
    },
    addScript: (source) => send('Page.addScriptToEvaluateOnNewDocument', { source }),
    reload: () => send('Page.reload', { ignoreCache: true }),
    capture: async () => {
      const out = await send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(out.result.data, 'base64');
    },
  };
}
