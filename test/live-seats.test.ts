/**
 * **1 台の PC で、何人もの席が同時に zumen の MCP を立てる**（2026-11-11）。
 *
 * 席ごとに `zumen mcp` が 1 つずつ走る。画面との線（`LIVE_PORT`）を開けるのは最初の 1 つだけで、
 * 2 つ目以降は開けない。これまで 2 つ目の席は `screens: 0`（＝画面が無い）と答えていて、
 * **「別の席が線を持っている」と言えなかった** —— 人は画面を開いているのに、エージェントは開いていないと読む。
 *
 * 決め：
 * - 線を開けなかった席は、画面の口（status / read / propose / point）を**すぐ**、理由つきで断る
 * - ある席が人の答えを長く待っていても、ほかの席の呼びは**待たされない**
 * - 線を持っていた席が閉じたら、残った席は**次の呼びで線を開き直す**
 */
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createHub, serve } from '../src/live/server.ts';
import type { LiveServer } from '../src/live/server.ts';
import { offer, point, read, status } from '../src/live/tools.ts';
import { openLine } from '../src/mcp.ts';

const open: LiveServer[] = [];
after(async () => {
  for (const one of open) await one.close();
});

const DOC = 'version: 1\nnodes:\n  - id: a\n    label: A\n';

/** 呼んでから返るまでの ms。 */
async function timed<T>(call: () => T | Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await call();
  return { value, ms: performance.now() - start };
}

describe('席が何人も居るとき（画面との線）', () => {
  it('**線を開けなかった席は、画面の口をすぐ、「別の席が線を持っている」と断る**', async () => {
    const first = await serve(0, createHub());
    open.push(first);
    const second = createHub();
    assert.equal(await openLine(second, first.port), null);

    const s = status(second);
    assert.equal(s.screens, 0);
    assert.match(s.elsewhere ?? '', /別の席/);
    const calls: (() => unknown)[] = [() => read(second), () => point(second, ['a']), () => offer(second, DOC)];
    for (const call of calls) {
      const { value, ms } = await timed(call);
      assert.equal((value as { ok: boolean }).ok, false);
      assert.match((value as { reason: string }).reason, /別の席/);
      assert.ok(ms < 200, `${ms}ms かかった`);
    }
  });

  it('**ある席が人の答えを待っている間も、ほかの席の呼びはすぐ返る**', async () => {
    const first = await serve(0, createHub());
    open.push(first);
    // 画面を 1 つ繋いだことにして、席 A が提案を出して 5 秒待つ
    first.hub.join('screen-1', () => {});
    first.hub.report('screen-1', { path: null, name: null, source: DOC, selected: null, dirty: false, conflicts: 0, reviewed: false });
    const waiting = offer(first.hub, DOC, { wait: 5 });

    const second = createHub();
    await openLine(second, first.port);
    const { ms } = await timed(() => status(second));
    assert.ok(ms < 200, `${ms}ms かかった`);
    const own = await timed(() => status(first.hub));
    assert.ok(own.ms < 200, `席 A 自身の status も ${own.ms}ms かかった`);
    assert.deepEqual(own.value.waiting.length, 1);

    first.hub.leave('screen-1');
    assert.equal((await waiting).ok, true);
  });

  it('**線を持っていた席が閉じたら、残った席は開き直せる**（別の席の印は消える）', async () => {
    const first = await serve(0, createHub());
    const port = first.port;
    const second = createHub();
    assert.equal(await openLine(second, port), null);
    await first.close();

    const reopened = await openLine(second, port);
    assert.ok(reopened !== null);
    open.push(reopened);
    assert.equal(status(second).elsewhere, null);
  });
});
