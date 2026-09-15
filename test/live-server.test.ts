/**
 * **線を実際に立てて、外から繋いで確かめる**（D34 / `src/live/server.ts`）。
 *
 * `hub.test.ts` は判断だけを見ている。ここで見るのは出入口 ——
 * **どこから繋いでよいか**、**形の合わないものを通さないか**、
 * **切れたときに待っている人へ知らせるか**。
 *
 * 番号は 0 を渡して OS に選ばせる。**決め打ちにすると、2 つ走ったときに落ちる。**
 */
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createHub } from '../src/live/server.ts';
import { serve } from '../src/live/server.ts';
import type { LiveServer } from '../src/live/server.ts';
import { originAllowed } from '../src/live/protocol.ts';

const open: LiveServer[] = [];

after(async () => {
  for (const one of open) await one.close();
});

async function line(): Promise<LiveServer> {
  const server = await serve(0, createHub());
  open.push(server);
  return server;
}

const at = (server: LiveServer, path: string): string => `http://127.0.0.1:${server.port}${path}`;

/**
 * SSE に繋いで、名札と、降ってくるものを読む。
 *
 * **読み終わるまで待たない。** 繋ぎっぱなしの線なので、終わりが来ない。
 */
async function connect(server: LiveServer, origin?: string): Promise<{
  id: Promise<string>;
  events: string[];
  stop: () => void;
}> {
  const stopper = new AbortController();
  const response = await fetch(at(server, '/live/events'), {
    headers: origin === undefined ? {} : { Origin: origin },
    signal: stopper.signal,
  });
  const events: string[] = [];
  let nameIt: (id: string) => void = () => {};
  const id = new Promise<string>((done) => {
    nameIt = done;
  });
  void (async () => {
    const reader = response.body!.getReader();
    const decode = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        const chunk = decode.decode(value, { stream: true });
        events.push(chunk);
        const found = /event: id\ndata: (.*)\n/.exec(chunk);
        if (found !== null) nameIt(JSON.parse(found[1]!).id as string);
      }
    } catch {
      // 切ったときに来る。**握り潰してよい理由** — 切ったのはこちら。
    }
  })();
  return { id, events, stop: () => stopper.abort() };
}

/** 降ってくるのを待つ。**無限には待たない。** */
async function until(events: string[], word: string, ms = 2000): Promise<string> {
  const limit = Date.now() + ms;
  for (;;) {
    const found = events.find((one) => one.includes(word));
    if (found !== undefined) return found;
    if (Date.now() > limit) throw new Error(`${word} が降ってこない: ${events.join('|')}`);
    await new Promise((done) => setTimeout(done, 10));
  }
}

const say = (server: LiveServer, body: unknown, origin?: string): Promise<Response> =>
  fetch(at(server, '/live/say'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin === undefined ? {} : { Origin: origin }) },
    body: JSON.stringify(body),
  });

describe('繋いでよい相手', () => {
  it('殻とブラウザの出どころは通す', () => {
    assert.equal(originAllowed('tauri://localhost'), true);
    assert.equal(originAllowed('http://localhost:5173'), true);
  });

  it('**localhost なら番号は問わない**（5178 でも 5180 でも繋がる）', () => {
    assert.equal(originAllowed('http://localhost:5178'), true);
    assert.equal(originAllowed('http://127.0.0.1:5180'), true);
    assert.equal(originAllowed('http://localhost'), true);
  });

  it('localhost に似せた名前は通さない', () => {
    assert.equal(originAllowed('http://localhost.example.invalid'), false);
    assert.equal(originAllowed('http://notlocalhost'), false);
    assert.equal(originAllowed('http://127.0.0.1.example.invalid'), false);
  });

  it('**知らないページからは通さない**', () => {
    assert.equal(originAllowed('https://example.invalid'), false);
  });

  it('Origin が無い相手は通す（ブラウザは必ず付ける）', () => {
    assert.equal(originAllowed(undefined), true);
    assert.equal(originAllowed(''), true);
  });

  it('知らない出どころは 403 で断る', async () => {
    const server = await line();
    const response = await fetch(at(server, '/live/health'), {
      headers: { Origin: 'https://example.invalid' },
    });
    assert.equal(response.status, 403);
  });

  it('127.0.0.1 にしか開かない', async () => {
    const server = await line();
    const response = await fetch(at(server, '/live/health'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, screens: 0 });
  });
});

describe('画面が繋ぐ', () => {
  it('繋ぐと名札と hello が降りてくる', async () => {
    const server = await line();
    const screen = await connect(server, 'tauri://localhost');
    assert.match(await screen.id, /^screen-/);
    await until(screen.events, 'event: hello');
    assert.equal(server.hub.status.screens, 1);
    screen.stop();
  });

  it('**切れたら 0 件へ戻る**', async () => {
    const server = await line();
    const screen = await connect(server);
    await screen.id;
    screen.stop();
    const limit = Date.now() + 2000;
    while (server.hub.status.screens !== 0 && Date.now() < limit) {
      await new Promise((done) => setTimeout(done, 10));
    }
    assert.equal(server.hub.status.screens, 0);
  });
});

describe('画面が言う', () => {
  it('映しているものが Hub に入る', async () => {
    const server = await line();
    const screen = await connect(server);
    const id = await screen.id;
    const response = await say(server, {
      from: id,
      kind: 'showing',
      screen: { path: '/w/a.zumen.yaml', name: 'a.zumen.yaml', source: 'version: 1\n', dirty: true },
    });
    assert.equal(response.status, 200);
    assert.equal(server.hub.status.screen?.path, '/w/a.zumen.yaml');
    assert.equal(server.hub.status.screen?.dirty, true);
    screen.stop();
  });

  it('**形の合わないものは通さない**（当て推量で埋めない）', async () => {
    const server = await line();
    const screen = await connect(server);
    const id = await screen.id;
    assert.equal((await say(server, { from: id, kind: 'showing', screen: {} })).status, 400);
    assert.equal((await say(server, { from: id, kind: 'なんとか' })).status, 400);
    assert.equal((await say(server, { kind: 'showing', screen: { source: '' } })).status, 400);
    screen.stop();
  });

  it('壊れた JSON は 400', async () => {
    const server = await line();
    const response = await fetch(at(server, '/live/say'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{壊れている',
    });
    assert.equal(response.status, 400);
  });
});

describe('提案が画面へ降りる', () => {
  it('出すと offer が降り、人が答えると待ちが解ける', async () => {
    const server = await line();
    const screen = await connect(server);
    const id = await screen.id;
    await say(server, {
      from: id,
      kind: 'showing',
      screen: { path: '/w/a.zumen.yaml', source: 'version: 1\n' },
    });

    const put = server.hub.offer('version: 1\nnodes: []\n', { path: '/w/a.zumen.yaml', note: 'こう' });
    assert.equal(put.ok, true);
    const offerId = put.ok ? put.id : '';
    const text = await until(screen.events, 'event: offer');
    assert.match(text, /こう/);

    const waiting = server.hub.decision(offerId, 2000);
    await say(server, { from: id, kind: 'decided', id: offerId, choice: 'applied' });
    assert.equal(await waiting, 'applied');
    screen.stop();
  });

  it('**画面を閉じたら、待っている側へ gone が返る**', async () => {
    const server = await line();
    const screen = await connect(server);
    const id = await screen.id;
    await say(server, { from: id, kind: 'showing', screen: { source: 'version: 1\n' } });
    const put = server.hub.offer('version: 1\n');
    const waiting = server.hub.decision(put.ok ? put.id : '', 3000);
    screen.stop();
    assert.equal(await waiting, 'gone');
  });
});

describe('知らない口', () => {
  it('404 を返す（黙って 200 にしない）', async () => {
    const server = await line();
    assert.equal((await fetch(at(server, '/live/なにか'))).status, 404);
  });
});
