/**
 * 画面の 8 操作を、実際に動かして確かめる（`pnpm gui:check`）。
 *
 * ## なぜ要るか
 *
 * `node --test` は `.svelte` を扱えないので、**画面のテストが 0 件**だった。
 * 実際、`process is not defined`（ブラウザに `process` は無い）で
 * **画面が丸ごと動かない状態のまま「ビルドは通る」と報告した。**
 * ビルドが通ることと動くことは別。
 *
 * ## 何をするか
 *
 * dev サーバと headless Chrome を**自分で立てて**、CDP で 8 操作を通す。
 * 人に手作業を頼まない（ベースルール §29 の裏返し。
 * **AI ができることを人へ渡さない**）。
 *
 * Chrome が無い環境では**確認できなかったと言って終わる**（黙って通さない）。
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5178;
const CDP = 9223;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '  ok  ' : '**NG**'} ${label}${detail === '' ? '' : `  — ${detail}`}`);
};

if (!existsSync(CHROME)) {
  console.log('Chrome が見つからないので確認できませんでした。**通ったことにしない。**');
  process.exitCode = 2;
} else {
  await run();
}

async function run() {
  const vite = spawn('node', ['./node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const profile = `${ROOT}app-dist/.gui-check-profile`;
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      `--remote-debugging-port=${CDP}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1400,900',
      `http://localhost:${PORT}`,
    ],
    { stdio: 'ignore' },
  );

  try {
    await waitFor(`http://localhost:${PORT}/`);
    await waitFor(`http://localhost:${CDP}/json/version`);
    await walk();
  } finally {
    chrome.kill();
    vite.kill();
  }

  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length} / ${results.length} 通過。`);
  if (bad.length > 0) process.exitCode = 1;
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

async function walk() {
  const { evaluate, errors, close } = await connect();

  /**
   * 条件が満たされるまで待つ。
   *
   * **固定の待ち時間にしない。** 機械の速さで結果が変わるテストは、
   * 落ちても本当かどうか分からず、そのうち誰も見なくなる。
   */
  const until = async (expression, limit = 10000) => {
    const deadline = Date.now() + limit;
    for (;;) {
      if ((await evaluate(expression)) === true) return true;
      if (Date.now() > deadline) return false;
      await sleep(100);
    }
  };
  const read = (p) => readFileSync(ROOT + p, 'utf8');
  const q = (value) => JSON.stringify(value);

  // 1 開く
  await evaluate(`document.querySelector('.empty button').click()`);
  await until(`document.querySelectorAll('g.node').length === 8`);
  check('1 開く — ノードが描かれる', (await evaluate(`document.querySelectorAll('g.node').length`)) === 8);
  check('1 開く — 囲みが描かれる', (await evaluate(`document.querySelectorAll('rect[stroke-dasharray]').length`)) === 1);
  check('1 開く — 線が描かれる', (await evaluate(`document.querySelectorAll('path[marker-end]').length`)) === 8);

  // 8 印
  const pinned = await evaluate(`getComputedStyle(document.querySelector('g.node[aria-label="MariaDB"] rect')).strokeWidth`);
  const auto = await evaluate(`getComputedStyle(document.querySelector('g.node[aria-label="Web 01"] rect')).strokeWidth`);
  check('8 印 — 人の指定は太い', pinned === '2px' && auto === '1px', `${pinned} / ${auto}`);

  // 2 見る
  await evaluate(`window.zumen.zoomBy(1.2)`);
  check('2 見る — 拡大できる', Math.abs((await evaluate(`window.zumen.zoom`)) - 1.2) < 0.001);
  await evaluate(`window.zumen.panBy(10, 20); window.zumen.resetView()`);
  check('2 見る — 戻せる', (await evaluate(`window.zumen.zoom === 1 && window.zumen.panX === 0`)) === true);

  // 3 選ぶ
  await evaluate(`window.zumen.select('web01')`);
  check('3 選ぶ', (await evaluate(`window.zumen.selected`)) === 'web01');

  // 4 動かす
  const before = await evaluate(`window.zumen.measurement.placed`);
  await evaluate(`window.zumen.place('web01', 700, 500)`);
  await until(`window.zumen.measurement.placed === ` + (before + 1));
  check('4 動かす — 人が置いた数が増える', (await evaluate(`window.zumen.measurement.placed`)) === before + 1);
  check('4 動かす — 正本へ書かれる', (await evaluate(`/web01:\\s*\\n\\s*position/.test(window.zumen.text)`)) === true);
  check('4 動かす — 自力率が下がる', (await evaluate(`window.zumen.measurement.autonomy`)) < 0.9);

  // 5 提案 + 6 差分
  await evaluate(`window.zumen.propose(${q(read('experiments/s1/fixtures/real-ai-r1-proposal.yaml'))})`);
  await until(`window.zumen.pending !== null`);
  check('5 提案 — 受け取れる', (await evaluate(`window.zumen.pending !== null`)) === true);
  check('6 差分 — 変わるところが出る', (await evaluate(`window.zumen.diff.length`)) > 0);
  check(
    '6 差分 — **人の位置指定が差分に出ない**',
    (await evaluate(`!window.zumen.diff.some((l) => l.kind !== 'same' && l.text.includes('position'))`)) === true,
  );
  check(
    '6 差分 — 入れる前は正本が変わらない',
    (await evaluate(`!window.zumen.text.includes('redis')`)) === true,
  );
  await evaluate(`window.zumen.applyPending()`);
  await until(`window.zumen.text.includes('redis')`);
  check('6 差分 — 入れたら反映される', (await evaluate(`window.zumen.text.includes('redis')`)) === true);
  check(
    '6 差分 — **入れても人の指定が消えない**',
    (await evaluate(`window.zumen.measurement.placed`)) === before + 1,
  );

  // 7 競合
  await evaluate(`window.zumen.propose(${q(read('experiments/s1/fixtures/real-ai-r1-proposal-renamed.yaml'))})`);
  await until(`window.zumen.pending !== null`);
  await evaluate(`window.zumen.applyPending()`);
  await until(`window.zumen.conflicts.length > 0`);
  check('7 競合 — 検出される', (await evaluate(`window.zumen.conflicts.length`)) > 0);
  check(
    '7 競合 — 選択肢が画面に出る',
    (await evaluate(`document.querySelectorAll('.choose button').length`)) >= 2,
  );
  await evaluate(`document.querySelector('.choose button').click()`);
  await until(`window.zumen.conflicts.length === 0`);
  check('7 競合 — 選ぶと消える', (await evaluate(`window.zumen.conflicts.length`)) === 0);
  check(
    '7 競合 — **決めた結果が正本へ書かれる**',
    (await evaluate(`window.zumen.text.includes('locked: true')`)) === true,
  );

  check('例外が出ていない', errors.length === 0, errors.join(' | '));
  close();
}

/** CDP を素の WebSocket で叩く。**依存を足さない。** */
async function connect() {
  const list = await (await fetch(`http://localhost:${CDP}/json/list`)).json();
  const page = list.find((tab) => tab.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ok) => socket.addEventListener('open', ok, { once: true }));

  let id = 0;
  const waiting = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && waiting.has(message.id)) {
      waiting.get(message.id)(message);
      waiting.delete(message.id);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
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
    errors,
    close: () => socket.close(),
    evaluate: async (expression) => {
      const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (out.result?.exceptionDetails !== undefined) {
        throw new Error(out.result.exceptionDetails.exception?.description ?? 'evaluate に失敗');
      }
      return out.result?.result?.value;
    },
  };
}
