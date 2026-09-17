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

import { createHub, serve } from '../src/live/server.ts';
import { LIVE_PORT } from '../src/live/protocol.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 5178;
const CDP = 9223;
/**
 * Chrome の在処。**環境で違うので、順に探す。**
 *
 * CI（ubuntu）には `chrome` か `chromium` が入っている。
 * 見つからなければ**「確認できなかった」と言って終わる**（黙って通さない）。
 */
const CHROME_CANDIDATES = [
  process.env['CHROME_PATH'],
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
];
const CHROME = CHROME_CANDIDATES.find((path) => path !== undefined && existsSync(path));

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '  ok  ' : '**NG**'} ${label}${detail === '' ? '' : `  — ${detail}`}`);
};

if (CHROME === undefined) {
  console.log('Chrome が見つからないので確認できませんでした。**通ったことにしない。**');
  console.log(`探した場所: ${CHROME_CANDIDATES.filter((path) => path !== undefined).join(', ')}`);
  console.log('CHROME_PATH に道を渡せば、そこを使います。');
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
      // CI のコンテナでは sandbox を張れないことがある。**手元では効いたままにしたいので、
      // 環境変数で明示されたときだけ外す。**
      ...(process.env['CHROME_NO_SANDBOX'] === '1' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
      `--remote-debugging-port=${CDP}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1400,900',
      `http://localhost:${PORT}`,
    ],
    { stdio: 'ignore' },
  );

  // **線も自分で立てる**（D34）。画面が繋ぎにいく先が無いと、9 が試せない。
  let line = null;
  try {
    line = await serve(LIVE_PORT, createHub());
  } catch (error) {
    check('9 線 — 立てられる', false, `${LIVE_PORT} 番が空いていない: ${error}`);
  }

  try {
    await waitFor(`http://localhost:${PORT}/`);
    await waitFor(`http://localhost:${CDP}/json/version`);
    await walk(line);
  } finally {
    chrome.kill();
    vite.kill();
    if (line !== null) await line.close();
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

async function walk(line) {
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

  // **画面が出るまで待つ。** 固定の待ち時間にしない（機械の速さで結果が変わる）。
  // CI は手元より遅く、待たずに押すと `null.click()` になる（実際にそうなった）。
  if (!(await until(`document.querySelector('.empty button') !== null`))) {
    check('画面が出る', false, '空の画面の入口が現れなかった');
    close();
    return;
  }

  // 1 開く
  await evaluate(`document.querySelector('.empty button').click()`);
  await until(`document.querySelectorAll('g.node').length === 8`);
  check('1 開く — ノードが描かれる', (await evaluate(`document.querySelectorAll('g.node').length`)) === 8);
  check('1 開く — 囲みが描かれる', (await evaluate(`document.querySelectorAll('rect[stroke-dasharray]').length`)) === 1);
  check('1 開く — 線が描かれる', (await evaluate(`document.querySelectorAll('path[marker-end]').length`)) === 8);

  // 1 開く — **画面に収まっているか**
  //
  // 開いた直後に等倍・原点のままだと、少し大きい図は**切れたまま出る**。
  // 最初に見る画面がそれになるので、**開いたら収める**（2026-09-15）。
  const fits = await evaluate(`(() => {
    const s = window.zumen;
    if (s.placed === null || s.view.w === 0) return 'view が測れていない';
    const w = s.placed.width * s.zoom, h = s.placed.height * s.zoom;
    if (s.panX < -0.5 || s.panY < -0.5) return '左か上へはみ出している';
    if (s.panX + w > s.view.w + 0.5) return '右へはみ出している';
    if (s.panY + h > s.view.h + 0.5) return '下へはみ出している';
    return 'ok';
  })()`);
  check('1 開く — **図ぜんぶが画面に入っている**', fits === 'ok', fits);
  check('1 開く — 引き伸ばさない（等倍を超えない）', (await evaluate(`window.zumen.zoom <= 1`)) === true);

  // 2 見る — 全体へ戻せる
  await evaluate(`window.zumen.zoomBy(2); window.zumen.panBy(400, 300)`);
  const lost = await evaluate(`window.zumen.panX > 100`);
  await evaluate(`window.zumen.fit()`);
  const back = await evaluate(`(() => {
    const s = window.zumen;
    const w = s.placed.width * s.zoom, h = s.placed.height * s.zoom;
    return s.panX >= -0.5 && s.panY >= -0.5 && s.panX + w <= s.view.w + 0.5 && s.panY + h <= s.view.h + 0.5;
  })()`);
  check('2 見る — 拡大して動かしたあと、全体へ戻せる', lost === true && back === true);

  // 2 見る — **鍵で見る操作ができる**
  const press = (key) =>
    evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ${q(key)}, bubbles: true, cancelable: true }))`);
  await evaluate(`window.zumen.resetView()`);
  await press('+');
  check('2 見る — ＋ で広がる', Math.abs((await evaluate(`window.zumen.zoom`)) - 1.2) < 0.001);
  await press('-');
  check('2 見る — − で縮む', Math.abs((await evaluate(`window.zumen.zoom`)) - 1) < 0.001);
  await press('f');
  check('2 見る — F で全体', (await evaluate(`window.zumen.zoom < 1`)) === true);
  await press('0');
  check('2 見る — 0 で等倍', (await evaluate(`window.zumen.zoom === 1`)) === true);

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
  // id が改名された場面では、同じラベルの箱が 2 つ並ぶ（db と maindb）。
  // **印が無いと、一覧の「db」が図のどちらか判別できない。**
  check(
    '7 競合 — **図のどれの話か分かる**',
    (await evaluate(`document.querySelectorAll('rect[stroke-dasharray="4 3"]').length`)) === 1,
  );
  await evaluate(`document.querySelector('button.id').click()`);
  await until(`window.zumen.selected === 'db'`);
  check('7 競合 — 一覧から図の要素を指せる', (await evaluate(`window.zumen.selected`)) === 'db');
  await evaluate(`document.querySelector('.choose button').click()`);
  await until(`window.zumen.conflicts.length === 0`);
  check('7 競合 — 選ぶと消える', (await evaluate(`window.zumen.conflicts.length`)) === 0);
  check(
    '7 競合 — **決めた結果が正本へ書かれる**',
    (await evaluate(`window.zumen.text.includes('locked: true')`)) === true,
  );

  // 8-2. 重なりを解く（Issue 015）
  // 図の左上（他のノードが並んでいるあたり）へわざと置く。
  await evaluate("window.zumen.place('backup', 24, 24)");
  await until("window.zumen.placed.boxes.some((b) => b.id === 'backup' && b.x === 24)");
  check(
    '重なりを解く — **人が置いたノードは動かない**',
    (await evaluate(`
      (() => {
        const b = window.zumen.placed.boxes.find((x) => x.id === 'backup');
        return b !== undefined && b.x === 24 && b.y === 24 && b.pinned === true;
      })()
    `)) === true,
  );
  check(
    '重なりを解く — 機械が置いたほうが退く',
    (await evaluate(`
      (() => {
        const boxes = window.zumen.placed.boxes;
        const b = boxes.find((x) => x.id === 'backup');
        return boxes.every((o) => o.id === 'backup' ||
          o.x + o.w <= b.x || b.x + b.w <= o.x || o.y + o.h <= b.y || b.y + b.h <= o.y);
      })()
    `)) === true,
  );

  // --- 戻る / 進む（D19） ---
  const textBefore = await evaluate('window.zumen.text');
  await evaluate("window.zumen.place('lb', 111, 222)");
  await until("window.zumen.text.includes('x: 111')");
  check('戻る — 押せるようになる', (await evaluate('window.zumen.canUndo')) === true);

  await evaluate('window.zumen.undo()');
  await until('window.zumen.canRedo === true');
  check(
    '戻る — **正本が 1 つ前へ戻る**',
    (await evaluate('window.zumen.text')) === textBefore,
  );
  check('戻る — 図も描き直される', (await evaluate('window.zumen.placed !== null')) === true);

  await evaluate('window.zumen.redo()');
  await until("window.zumen.text.includes('x: 111')");
  check('進む — やり直せる', (await evaluate("window.zumen.text.includes('x: 111')")) === true);

  // 新しく変えたら、進む先は消える（分岐を作らない）。
  await evaluate('window.zumen.undo()');
  await until('window.zumen.canRedo === true');
  await evaluate("window.zumen.place('lb', 333, 444)");
  await until("window.zumen.text.includes('x: 333')");
  check('進む — 新しく変えたら消える（分岐を作らない）', (await evaluate('window.zumen.canRedo')) === false);

  // --- 自動保存（D19） ---
  //
  // **保存先が決まっていないときは自動保存しない。** 決まっていないと
  // 保存のたびにダイアログが出て作業が止まる。ここでは決まっていない状態なので、
  // 「保存されない」ことと「印が出る」ことを見る。
  await until('window.zumen.dirty === true');
  await sleep(1200);
  check(
    '自動保存 — 保存先が無ければ書かない（ダイアログを出さない）',
    (await evaluate('window.zumen.dirty')) === true,
  );
  check(
    '自動保存 — **黙っていない**（保存先が無いことを画面に出す）',
    (await evaluate(`document.querySelector('.state')?.textContent.trim() !== ''`)) === true,
  );

  // --- 「見た」の印（仕様 §3.5） ---
  //
  // **この口は画面にしか無い。** MCP に開けると AI が自分の絵を自分で承認できる。
  // ここが押されないまま自力率 100% が出るのが、この製品の失敗そのもの
  // （PRD §4 / ベースルール §29）。**押せること**と**意味が変われば外れること**を見る。
  check('見た — 最初は誰も見ていない', (await evaluate('window.zumen.review.reviewed')) === false);

  const reviewButton = `[...document.querySelectorAll('button')].find((b) => b.className.includes('review'))`;
  check('見た — 画面にボタンがある', (await evaluate(`${reviewButton} !== undefined`)) === true);
  check('見た — 最初は押せる', (await evaluate(`${reviewButton}?.disabled`)) === false);

  await evaluate(`${reviewButton}.click()`);
  await until('window.zumen.review.reviewed === true');
  check('見た — **押すと正本へ書かれる**', (await evaluate(`window.zumen.text.includes('review:')`)) === true);
  check('見た — 二度押しできない', (await evaluate(`${reviewButton}?.disabled`)) === true);

  // 意味を変える（ノードを 1 つ足す）。**印は外れなければならない。**
  await evaluate(`
    window.zumen.propose(window.zumen.text.replace('nodes:', 'nodes:\\n  - id: zzz\\n    label: 追加'))
  `);
  await evaluate('window.zumen.applyPending()');
  await until('window.zumen.review.reviewed === false');
  check('見た — **意味が変われば外れる**', (await evaluate('window.zumen.review.reviewed')) === false);
  check(
    '見た — 「一度も見ていない」と区別が付く（いつ見たかは残る）',
    (await evaluate('window.zumen.review.stale')) === true,
  );

  // 9 線 —— エージェントと繋がる（D34）
  //
  // **ここがこの版の勝負どころ。** 提案が画面に降りて、差分が出て、
  // 人が押したことだけが線の向こうへ返ること。
  // **押す口が線の向こうに無いこと**は `test/live-hub.test.ts` が形で見ている。
  if (line !== null) {
    const hub = line.hub;

    // **画面側では測れない。** 繋がったかどうかを知っているのは線のほう。
    const connected = await untilHere(() => hub.status.screens === 1, 15000);
    // **他の画面が繋がっていると、提案はそちらへ行く**（新しいほうへ出す）。
    // 人がアプリを開いたまま回すと、**ここから先が理由の分からない形で落ちる**
    // （2026-09-17。実演のときに開いたままだった殻へ、提案が渡っていた）。
    if (hub.status.screens > 1) {
      console.log(`  ！ 画面が ${hub.status.screens} 件繋がっています。zumen のアプリを閉じてから回してください。`);
    }
    check('9 線 — 画面が繋ぎにいっている', connected, `${hub.status.screens} 件`);
    // 画面が「いま何を映しているか」を伝えているか。**ディスクではなく画面。**
    const seen = hub.status.screen;
    check(
      '9 線 — **保存前の手直しごと伝わっている**',
      seen !== null && seen.source.includes('web01:') && seen.source.includes('position'),
      seen === null ? '何も伝わっていない' : `${seen.source.length} 文字`,
    );
    check('9 線 — 画面に「繋がっています」と出る', (await evaluate(`document.querySelector('.live.on') !== null`)) === true);

    // **指す** —— 選ぶだけで、図は変わらない。
    const textBefore = await evaluate('window.zumen.text');
    hub.point(['mariadb'], 'これのことです');
    check('9 線 — 指すと画面で選ばれる', await until(`window.zumen.selected === 'mariadb'`), '');
    check('9 線 — **指しても図は変わらない**', (await evaluate('window.zumen.text')) === textBefore);

    // **提案** —— 画面に出るだけ。正本は変わらない。
    const proposal = (await evaluate('window.zumen.text')).replace('nodes:', 'nodes:\n  - id: cache\n    label: キャッシュ');
    const put = hub.offer(proposal, { note: 'キャッシュを足しました' });
    check('9 線 — 提案が画面へ降りる', await until('window.zumen.pending !== null'), put.ok ? '' : put.reason);
    check('9 線 — **降りても正本は変わらない**', (await evaluate('window.zumen.text')) === textBefore);
    check('9 線 — 誰が何のために出したかが読める', (await evaluate(`document.body.innerText.includes('キャッシュを足しました')`)) === true);
    check('9 線 — 差分が出る', (await evaluate('window.zumen.diff.length')) > 0);

    // **人が押すまで、線の向こうは何も知らない。**
    const before = await hub.decision(put.ok ? put.id : '', 900);
    check('9 線 — **押すまで applied にならない**', before === 'timeout', String(before));

    // 人が押した。
    const waiting = hub.decision(put.ok ? put.id : '', 8000);
    // **文言で押さない。** 画面の言語は `navigator.language` で変わり、
    // CI の機械は英語で出る —— 日本語の文言を探して**押す物が無い**と落ちていた
    // （2026-09-15 から 5 回。2026-09-17 に直した）。
    await evaluate(`document.querySelector('[data-act="apply"]').click()`);
    check('9 線 — 人が押したことが線の向こうへ返る', (await waiting) === 'applied');
    check('9 線 — 押したら正本が変わる', await until(`window.zumen.text.includes('cache')`), '');

    // やめたときも、黙らずに返る。
    const put2 = hub.offer(proposal.replace('キャッシュ', 'ふたつめ'), { note: 'もう 1 つ' });
    await until('window.zumen.pending !== null');
    const waiting2 = hub.decision(put2.ok ? put2.id : '', 8000);
    await evaluate(`document.querySelector('[data-act="discard"]').click()`);
    check('9 線 — **やめたことも返る**（黙って待たせない）', (await waiting2) === 'discarded');
  }

  check('例外が出ていない', errors.length === 0, errors.join(' | '));
  close();
}

/** こちら側（node）で条件が満たされるまで待つ。**固定の待ち時間にしない。** */
async function untilHere(ready, limit = 10000) {
  const deadline = Date.now() + limit;
  for (;;) {
    if (ready()) return true;
    if (Date.now() > deadline) return false;
    await sleep(100);
  }
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
