/**
 * 線の出入口（D34）。**`node:http` だけで立てる。**
 *
 * ## なぜ WebSocket にしないか
 *
 * 要るのは「サーバから画面へ押す」と「画面からサーバへ送る」の 2 方向だけで、
 * どちらも **SSE（`text/event-stream`）と POST** で足りる。
 * WebSocket にすると `ws` を入れることになる。**依存は少ないほうがよい**
 * （ベースルール §1・§12）。ブラウザにも殻にも `EventSource` と `fetch` がある。
 *
 * ## 口
 *
 * | | |
 * |---|---|
 * | `GET /live/events` | 画面が繋ぐ（SSE）。ここから提案と「指す」が降りてくる |
 * | `POST /live/say` | 画面が言う（いま映しているもの・人が出した答え） |
 * | `GET /live/health` | 立っているかを見るだけ |
 *
 * ## 開ける範囲
 *
 * **127.0.0.1 にしか bind しない。** 加えて `Origin` を見る（`protocol.ts`）。
 * これは鍵ではない。**同じ機械の別プログラムは詐称できる**ので、
 * 秘密を載せる線にはしない。止めるべき条件は D34 に書いた。
 */
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import { messages } from '../messages.ts';
import { Hub } from './hub.ts';
import { LIVE_HOST, LIVE_PORT, originAllowed, readFromScreen } from './protocol.ts';
import type { ToScreen } from './protocol.ts';

/** 繋いだままの線が死んでいないかを見せる間隔。**代理サーバに切られないため。** */
const KEEPALIVE_MS = 25_000;

export interface LiveServer {
  hub: Hub;
  /** 実際に開いた番号。**0 を渡したときに要る**（テスト）。 */
  port: number;
  close: () => Promise<void>;
}

/** 断り文句を `messages()` から引く Hub を作る。 */
export function createHub(): Hub {
  const m = messages().mcp;
  return new Hub({
    noScreen: m.liveNoScreen,
    nothingOpen: m.liveNothingOpen,
    otherDiagram: m.liveOtherDiagram,
  });
}

/**
 * 線を開く。**開けなければ、黙らずに理由ごと投げる。**
 *
 * 既に別の zumen が立っていると `EADDRINUSE` になる。
 * そこを握り潰すと、エージェントは**繋がっているつもりで**提案を投げ続ける。
 */
export function serve(port: number = LIVE_PORT, hub: Hub = createHub()): Promise<LiveServer> {
  const server = createServer((request, response) => {
    void route(request, response, hub);
  });

  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, LIVE_HOST, () => {
      server.removeListener('error', fail);
      const address = server.address();
      done({
        hub,
        port: typeof address === 'object' && address !== null ? address.port : port,
        close: () => shut(server),
      });
    });
  });
}

/** 繋がったままの線があると `close` は返らない。**先に切ってから閉じる。** */
function shut(server: Server): Promise<void> {
  return new Promise((done) => {
    server.closeAllConnections();
    server.close(() => done());
  });
}

async function route(request: IncomingMessage, response: ServerResponse, hub: Hub): Promise<void> {
  const origin = request.headers.origin;
  if (!originAllowed(origin)) {
    // **どこから断られたかは言う。**黙って 404 にすると、繋がらない理由を探せない。
    plain(response, 403, 'origin not allowed');
    return;
  }
  cors(response, origin);

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const path = (request.url ?? '').split('?')[0];
  if (path === '/live/health') {
    json(response, 200, { ok: true, screens: hub.status.screens });
    return;
  }
  if (path === '/live/events' && request.method === 'GET') {
    stream(request, response, hub);
    return;
  }
  if (path === '/live/say' && request.method === 'POST') {
    await say(request, response, hub);
    return;
  }
  plain(response, 404, 'not found');
}

/** 画面が繋ぐ。**切れたら `leave` する** —— 待っている提案に `gone` を返すため。 */
function stream(request: IncomingMessage, response: ServerResponse, hub: Hub): void {
  const id = `screen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  // **繋いだ画面に、自分の名札を渡す。** 以後の POST はこれを名乗る。
  response.write(`event: id\ndata: ${JSON.stringify({ id })}\n\n`);

  const send = (message: ToScreen): void => {
    response.write(`event: ${message.kind}\ndata: ${JSON.stringify(message)}\n\n`);
  };
  hub.join(id, send);

  const beat = setInterval(() => response.write(': .\n\n'), KEEPALIVE_MS);
  const done = (): void => {
    clearInterval(beat);
    hub.leave(id);
  };
  request.on('close', done);
  response.on('close', done);
}

/** 画面が言う。**形が合わないものは通さない。** */
async function say(request: IncomingMessage, response: ServerResponse, hub: Hub): Promise<void> {
  let body: unknown;
  try {
    body = JSON.parse(await text(request));
  } catch {
    plain(response, 400, 'bad json');
    return;
  }
  const from = (body as { from?: unknown }).from;
  const message = readFromScreen(body);
  if (typeof from !== 'string' || message === null) {
    plain(response, 400, 'bad message');
    return;
  }
  if (message.kind === 'showing') hub.report(from, message.screen);
  else hub.decided(from, message.id, message.choice);
  json(response, 200, { ok: true });
}

function text(request: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
      // **際限なく受けない。** 図は大きくても数十 KB。
      if (body.length > 4_000_000) fail(new Error('too large'));
    });
    request.on('end', () => done(body));
    request.on('error', fail);
  });
}

function cors(response: ServerResponse, origin: string | undefined): void {
  // **`*` にしない。** 通した相手の名前だけを返す。
  if (origin !== undefined && origin !== '') response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'content-type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Vary', 'Origin');
}

function json(response: ServerResponse, code: number, value: unknown): void {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function plain(response: ServerResponse, code: number, body: string): void {
  response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(body);
}
