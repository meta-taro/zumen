/**
 * **MCP サーバ**（`src/mcp.ts`）。**エージェントの入口。**
 *
 * ## なぜ要るか
 *
 * 2026-09-14 に気づいた —— **`src/mcp.ts` はどのテストからも読まれておらず、
 * カバレッジの表にすら載っていなかった。**
 * `pnpm coverage` が 98.6% と言っている横で、
 * **エージェントが実際に叩く口だけが、一度も動かされていなかった。**
 *
 * 中身の判断は `src/tools.ts` にあり、そちらは測れている。
 * ここで見たいのは**口の形** —— 道具が登録されているか、
 * 呼んだら結果が返るか、開けていない口が開いていないか。
 *
 * ## やり方
 *
 * サーバを実際に立てて、**メモリ上の経路で**話す（外部プロセスもポートも使わない）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { DOORS } from '../src/about.ts';
import { buildServer } from '../src/mcp.ts';

async function connect(): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([buildServer().connect(serverSide), client.connect(clientSide)]);
  return client;
}

/** 返ってきた本文（道具はすべて文字列で返す）。 */
function body(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  assert.ok(Array.isArray(content) && content.length > 0, '中身が空');
  return content.map((part) => part.text).join('\n');
}

/**
 * **`zumen_about` の口の一覧は、実際に開いている口と同じか**（2026-09-19）。
 *
 * `src/about.ts` の `DOORS` には「ここを増やしたら、あちらも増やすこと
 * （`test/about.test.ts` が見張る）」と書いてあった。**その検査は無かった。**
 * だから一覧は **9 個のまま**古くなり、`zumen_examples` も live 系も出ていなかった。
 *
 * README は「**まず `zumen_about` を 1 回**」と書いている ——
 * **最初に読む所が古いと、あとの全部がずれる。**
 * 見張る、と書いたなら見張る（ベースルール §10）。
 */
describe('about の口の一覧', () => {
  it('**実際に開いている口と、ひとつ残らず同じ**', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    assert.deepEqual([...DOORS].sort(), tools.map((tool) => tool.name).sort());
  });
});

describe('MCP の口', () => {
  it('**道具が並んでいる**（エージェントが最初に見るもの）', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'zumen_about',
      'zumen_create',
      'zumen_examples',
      'zumen_export',
      'zumen_inspect',
      'zumen_list',
      // 画面と繋ぐ線（D34）。**提案を採用する口は、ここに無い。**
      'zumen_live_point',
      'zumen_live_propose',
      'zumen_live_read',
      'zumen_live_status',
      'zumen_pins',
      'zumen_propose',
      'zumen_read',
      'zumen_spec',
      // **図が育つところを 1 本にする**（2026-09-16）。画面録画が要らないので、
      // 画面の前に人が居ないときでも作れる。
      'zumen_timelapse',
    ]);
    await client.close();
  });

  it('**どの道具にも説明がある**（名前だけでは使えない）', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.ok((tool.description ?? '').length > 40, `${tool.name} の説明が短い`);
    }
    await client.close();
  });

  it('`zumen_spec` が書き方を返す', async () => {
    const client = await connect();
    const out = JSON.parse(body(await client.callTool({ name: 'zumen_spec', arguments: {} })));
    assert.equal(out.version, 1);
    assert.match(out.shape, /nodes:/);
    assert.ok(out.rules.length > 10);
    await client.close();
  });

  it('**`zumen_inspect` が、実物の見本を測れる**', async () => {
    const client = await connect();
    const source = readFileSync(new URL('../examples/gallery/25-路線図.zumen.yaml', import.meta.url), 'utf8');
    const out = JSON.parse(body(await client.callTool({ name: 'zumen_inspect', arguments: { source } })));
    assert.equal(out.readable, true);
    assert.equal(out.kind, 'placement');
    assert.ok(out.nodes > 0);
    assert.deepEqual(out.overlappingText, []);
    await client.close();
  });

  it('`zumen_export` が SVG を返す', async () => {
    const client = await connect();
    const out = body(
      await client.callTool({
        name: 'zumen_export',
        arguments: { kind: 'svg', source: 'version: 1\nnodes:\n  - id: a\n    label: あ\n' },
      }),
    );
    assert.match(out, /^<svg /);
    await client.close();
  });

  it('**中身も道も無ければ、黙って空を返さない**', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'zumen_inspect', arguments: {} });
    assert.equal((result as { isError?: boolean }).isError, true, 'エラーにせず通してしまった');
    await client.close();
  });

  it('**開けていない口は、無い**（競合の決着・pins の書き換え）', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    for (const forbidden of ['zumen_resolve', 'zumen_pin', 'zumen_write', 'zumen_review']) {
      assert.ok(!names.includes(forbidden), `${forbidden} が開いている`);
    }
    // 線を引いたときが、いちばんこの穴が開きやすい（D34）。
    for (const forbidden of ['zumen_live_apply', 'zumen_live_accept', 'zumen_live_write', 'zumen_live_review']) {
      assert.ok(!names.includes(forbidden), `${forbidden} が開いている`);
    }
    await client.close();
  });

  it('**線が繋がっていなければ、黙って別のことをしない**（D34）', async () => {
    const client = await connect();
    const out = JSON.parse(body(await client.callTool({ name: 'zumen_live_status', arguments: {} })));
    assert.equal(out.screens, 0, '誰も繋いでいないのに繋がっていると言った');

    // 画面が無いのに提案を出したら、**ファイルへ書きに行かず断る。**
    const put = JSON.parse(
      body(
        await client.callTool({
          name: 'zumen_live_propose',
          arguments: { source: 'version: 1\nnodes:\n  - id: a\n    label: あ\n' },
        }),
      ),
    );
    assert.equal(put.ok, false);
    assert.match(put.reason, /繋がっていません/);
    await client.close();
  });

  it('`zumen_about` が、この道具の説明を返す', async () => {
    const client = await connect();
    const out = JSON.parse(body(await client.callTool({ name: 'zumen_about', arguments: {} })));
    assert.ok(typeof out === 'object' && out !== null);
    await client.close();
  });
});
