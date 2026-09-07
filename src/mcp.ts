/**
 * MCP サーバ（D13 / D18）。**これが第一の口。**
 *
 * サーバ構成を把握しているエージェントに、直接図を描かせるためのもの。
 * GUI は承認のための窓であって、入口ではない。
 *
 * ## ここに判断を置かない
 *
 * 中身はすべて `src/tools.ts` にある。ここがやるのは、
 * **口の形を決めて、結果を文字列にする**ことだけ。
 * そうしておくと、MCP を立てずにテストできる（ベースルール §9）。
 *
 * ## 開けていない口
 *
 * | 開けない | なぜ |
 * |---|---|
 * | **競合の決着** | 開けた瞬間、**AI が自分の提案を自分で承認できる** |
 * | **`pins` の書き換え** | 人の指定は人のもの（仕様 §3.4 の規則 1） |
 * | **既存ファイルの無条件な上書き** | `zumen_propose` を通せば人の指定は壊れない |
 *
 * 「AI が中心、人は責任を負う」は、**人が承認しなくてよいという意味ではない。**
 * 見ずに責任は負えない。人がやらなくなるのは労働であって、承認ではない（D18）。
 *
 * ## 立て方
 *
 * ```json
 * { "mcpServers": { "zumen": { "command": "node",
 *   "args": ["<zumen への道>/src/mcp.ts"] } } }
 * ```
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { isEntry } from './entry.ts';
import { messages } from './messages.ts';
import {
  create,
  exportAs,
  inspect,
  list,
  pinsOf,
  propose,
  read,
  spec,
} from './tools.ts';

/** 返り値はすべて JSON の文字列にする。**エージェントが読んで判断するため。** */
function json(value: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/** そのまま返す（書き出した図など）。 */
function text(value: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: value }] };
}

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'zumen', version: '0.0.0' });
  const m = messages().mcp;

  // --- 形式を教える --------------------------------------------------------

  server.registerTool(
    'zumen_spec',
    {
      title: m.specTitle,
      description:
        m.specDesc,
      inputSchema: {},
    },
    () => json(spec()),
  );

  // --- 読む ----------------------------------------------------------------

  server.registerTool(
    'zumen_list',
    {
      title: m.listTitle,
      description: m.listDesc,
      inputSchema: { dir: z.string().describe(m.listDir) },
    },
    ({ dir }) => json({ dir, diagrams: list(dir) }),
  );

  server.registerTool(
    'zumen_read',
    {
      title: m.readTitle,
      description: m.readDesc,
      inputSchema: { path: z.string().describe(m.readPath) },
    },
    ({ path }) => text(read(path)),
  );

  server.registerTool(
    'zumen_pins',
    {
      title: m.pinsTitle,
      description:
        m.pinsDesc,
      inputSchema: { path: z.string() },
    },
    ({ path }) => json(pinsOf(read(path))),
  );

  // --- 検査する・測る ------------------------------------------------------

  server.registerTool(
    'zumen_inspect',
    {
      title: m.inspectTitle,
      description:
        m.inspectDesc,
      inputSchema: {
        source: z.string().optional().describe(m.inspectSource),
        path: z.string().optional().describe(m.inspectPath),
      },
    },
    async ({ source, path }) => json(await inspect(bodyOf(source, path))),
  );

  // --- 書く ----------------------------------------------------------------

  server.registerTool(
    'zumen_create',
    {
      title: m.createTitle,
      description:
        m.createDesc,
      inputSchema: {
        path: z.string().describe(m.createPath),
        source: z.string().describe(m.createSource),
      },
    },
    ({ path, source }) => json(create(path, source)),
  );

  server.registerTool(
    'zumen_propose',
    {
      title: m.proposeTitle,
      description:
        m.proposeDesc,
      inputSchema: {
        path: z.string().describe(m.proposePath),
        source: z.string().describe(m.proposeSource),
      },
    },
    ({ path, source }) => json(propose(path, source)),
  );

  // --- 書き出す ------------------------------------------------------------

  server.registerTool(
    'zumen_export',
    {
      title: m.exportTitle,
      description:
        m.exportDesc,
      inputSchema: {
        kind: z.enum(['svg', 'mermaid', 'drawio']),
        source: z.string().optional(),
        path: z.string().optional(),
      },
    },
    async ({ kind, source, path }) => text(await exportAs(bodyOf(source, path), kind)),
  );

  return server;
}

/** 中身か道のどちらかを受ける。**どちらも無ければ、黙って空を返さない。** */
function bodyOf(source: string | undefined, path: string | undefined): string {
  if (source !== undefined) return source;
  if (path !== undefined) return read(path);
  throw new Error(messages().mcp.needSourceOrPath);
}

// 直接叩かれたときだけ立てる。import しても副作用が出ないようにしておく。
if (isEntry(import.meta.url, process.argv[1])) {
  await buildServer().connect(new StdioServerTransport());
}
