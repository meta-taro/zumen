/**
 * 画面と繋ぐ口の中身（D34 / `src/live/tools.ts`）。
 *
 * **読めない提案を人の画面に出さない**ことと、
 * **`timeout` を「断られた」と読ませない**ことを見る。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hub } from '../src/live/hub.ts';
import { EMPTY_SCREEN } from '../src/live/protocol.ts';
import { MAX_WAIT_S, offer, point, read, status, withdraw } from '../src/live/tools.ts';
import { messages } from '../src/messages.ts';

const m = messages().mcp;
const WORDS = { noScreen: m.liveNoScreen, nothingOpen: m.liveNothingOpen, otherDiagram: m.liveOtherDiagram };

const GOOD = `version: 1
title: 例
nodes:
  - id: a
    label: A
  - id: b
    label: B
edges:
  - from: a
    to: b
`;

function hubWithScreen(source = GOOD): { hub: Hub; got: unknown[] } {
  const hub = new Hub(WORDS);
  const got: unknown[] = [];
  hub.join('s', (message) => got.push(message));
  hub.report('s', { ...EMPTY_SCREEN, path: '/w/a.zumen.yaml', name: 'a.zumen.yaml', source });
  return { hub, got };
}

describe('繋がっているか', () => {
  it('繋がっていないことを、0 件として言う', () => {
    assert.deepEqual(status(new Hub(WORDS)).screens, 0);
  });

  it('人が選んでいる要素を返す（「どれの話か」の手掛かり）', () => {
    const hub = new Hub(WORDS);
    hub.join('s', () => {});
    hub.report('s', { ...EMPTY_SCREEN, source: GOOD, selected: 'db' });
    assert.equal(status(hub).selected, 'db');
  });
});

describe('画面を読む', () => {
  it('**ディスクではなく画面の中身**を返す', () => {
    const { hub } = hubWithScreen('version: 1\n# 人がさっき動かした\n');
    const got = read(hub);
    assert.equal(got.ok, true);
    assert.match(got.ok ? got.source : '', /人がさっき動かした/);
  });
});

describe('提案を出す', () => {
  it('**読めない提案は画面に出さない**', async () => {
    const { hub, got } = hubWithScreen();
    const before = got.length;
    const put = await offer(hub, 'version: 1\nnodes:\n  - label: id が無い\n');
    assert.equal(put.ok, false);
    assert.equal(got.length, before, '画面へ何も降ろしていない');
  });

  it('読めない理由を findings で返す（当て推量させない）', async () => {
    const put = await offer(hubWithScreen().hub, 'これは YAML ではない: [');
    assert.equal(put.ok, false);
    assert.equal(Array.isArray(put.ok === false ? put.findings : null), true);
  });

  it('待たないときは「人が押すまで正本は変わらない」と言う', async () => {
    const put = await offer(hubWithScreen().hub, GOOD);
    assert.equal(put.ok, true);
    assert.equal(put.ok && put.waited, false);
    assert.match(put.ok ? put.note : '', /人が押すまで/);
  });

  it('**答えが無いのは timeout。断られたとは言わない**', async () => {
    const put = await offer(hubWithScreen().hub, GOOD, { wait: 1 });
    assert.equal(put.ok && put.waited === true && put.decision, 'timeout');
    assert.match(put.ok ? put.note : '', /断られたわけではありません/);
  });

  it('人が入れたら applied', async () => {
    const { hub } = hubWithScreen();
    const waiting = offer(hub, GOOD, { wait: 5 });
    // **人が画面で押した**（この道を通るのは画面だけ）。
    await new Promise((done) => setTimeout(done, 20));
    hub.decided('s', hub.status.waiting[0]!, 'applied');
    const put = await waiting;
    assert.equal(put.ok && put.waited === true && put.decision, 'applied');
  });

  it('人がやめたら discarded。**次の手を促す**', async () => {
    const { hub } = hubWithScreen();
    const waiting = offer(hub, GOOD, { wait: 5 });
    await new Promise((done) => setTimeout(done, 20));
    hub.decided('s', hub.status.waiting[0]!, 'discarded');
    const put = await waiting;
    assert.equal(put.ok && put.waited === true && put.decision, 'discarded');
    assert.match(put.ok ? put.note : '', /別の案/);
  });

  it('待つ秒数は上限で頭打ち（無限に待たない）', () => {
    assert.equal(MAX_WAIT_S, 300);
  });

  it('**画面が消えたら gone。人は見ていない**', async () => {
    const { hub } = hubWithScreen();
    const waiting = offer(hub, GOOD, { wait: 5 });
    await new Promise((done) => setTimeout(done, 20));
    hub.leave('s');
    const put = await waiting;
    assert.equal(put.ok && put.waited === true && put.decision, 'gone');
    assert.match(put.ok ? put.note : '', /人はこの提案を見ていません/);
  });

  it('言い直したら引っ込められる', async () => {
    const { hub } = hubWithScreen();
    await offer(hub, GOOD);
    const id = hub.status.waiting[0]!;
    assert.deepEqual(withdraw(hub, id), { ok: true });
    assert.deepEqual(hub.status.waiting, []);
    assert.deepEqual(withdraw(hub, id), { ok: false }, '二度は引っ込められない');
  });
});

describe('指す', () => {
  it('選ぶだけで、待ちを作らない', () => {
    const { hub } = hubWithScreen();
    assert.equal(point(hub, ['a'], 'これです').ok, true);
    assert.deepEqual(hub.status.waiting, []);
  });
});
