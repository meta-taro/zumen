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

import { about } from './about.ts';
import { catalogue, search, source } from './examples.ts';
import { isEntry } from './entry.ts';
import { messages } from './messages.ts';
import { mkdirSync, writeFileSync } from 'node:fs';

import {
  create,
  exportAs,
  filmOf,
  inspect,
  list,
  pinsOf,
  pngOf,
  propose,
  read,
  spec,
} from './tools.ts';
import { createHub, serve } from './live/server.ts';
import type { LiveServer } from './live/server.ts';
import { LIVE_PORT } from './live/protocol.ts';
import { MAX_WAIT_S, offer, point, read as liveRead, status as liveStatus } from './live/tools.ts';
import type { Hub } from './live/hub.ts';

/** 返り値はすべて JSON の文字列にする。**エージェントが読んで判断するため。** */
function json(value: unknown): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

/** そのまま返す（書き出した図など）。 */
function text(value: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text: value }] };
}

/**
 * **絵をそのまま返す**（2026-09-18）。
 *
 * 文字で SVG を返しても、**エージェントは自分の絵を見られない。**
 * MCP は画像を返せるので、png はここで画像として渡す
 * （Chrome が無ければ、無いと言う文字だけを返す）。
 */
function picture(made: { image: string | null; note: string }): {
  content: (
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
  )[];
} {
  if (made.image === null) return { content: [{ type: 'text', text: made.note }] };
  return {
    content: [
      { type: 'text', text: made.note },
      { type: 'image', data: made.image, mimeType: 'image/png' },
    ],
  };
}

export function buildServer(hub: Hub = createHub()): McpServer {
  const server = new McpServer({ name: 'zumen', version: '0.0.0' });
  const m = messages().mcp;

  // --- この道具の説明 ------------------------------------------------------
  //
  // **はじめに 1 回叩くもの。** 何をする道具で、何をしないか、
  // どの口が開いていないか、版ごとに何が変わったかを返す。
  //
  // これが無いと、エージェントは**開いていない口を試して断られる往復**を毎回やる。
  server.registerTool(
    'zumen_about',
    {
      title: m.aboutTitle,
      description: m.aboutDesc,
      inputSchema: {},
    },
    async () => json(await about()),
  );

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

  /**
   * **同梱の見本を引く**（`src/examples.ts`）。
   *
   * `zumen_spec` は「どう書くか」しか渡していなかった。
   * **「世の中にどんな図面があるか」は、どこからも渡っていなかった**（D39 と同じ穴）。
   */
  server.registerTool(
    'zumen_examples',
    {
      title: m.examplesTitle,
      description: m.examplesDesc,
      inputSchema: {
        query: z.string().optional().describe(m.examplesQuery),
        name: z.string().optional().describe(m.examplesName),
      },
    },
    ({ query, name }) => {
      const book = catalogue();
      if (book === null) return text(m.examplesNone);
      if (name !== undefined && name !== '') {
        const yaml = source(name);
        return yaml === null ? text(m.examplesMissing(name)) : text(yaml);
      }
      if (query !== undefined && query !== '') {
        const found = search(book, query);
        return json({ count: found.reduce((n, g) => n + g.items.length, 0), categories: found });
      }
      // **引数なしは目次だけ**（189 枚をいちどに返すと、読む側が埋まる）。
      return json({
        count: book.count,
        categories: book.categories.map((g) => ({
          key: g.key,
          label: g.label,
          labelEn: g.labelEn,
          count: g.items.length,
          examples: g.items.slice(0, 3).map((i) => i.name),
        })),
      });
    },
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
        kind: z.enum(['svg', 'png', 'mermaid', 'drawio']),
        source: z.string().optional(),
        path: z.string().optional(),
        theme: z.enum(['light', 'dark']).optional().describe(m.exportTheme),
        intent: z.enum(['safe', 'vivid']).optional().describe(m.exportIntent),
      },
    },
    async ({ kind, source, path, theme, intent }) => {
      const body = bodyOf(source, path);
      // **png は絵で返す。** 文字で返しても、描いたものを見たことにならない。
      if (kind === 'png') return picture(await pngOf(body, { theme, intent }));
      return text(await exportAs(body, kind, { theme, intent }));
    },
  );

  /**
   * **図が育つところを 1 本にする**（2026-09-16）。
   *
   * これまでこの絵を作るには画面録画が要り、**画面の前に人が座っている**必要があった。
   * リモートでは作れない。ここを通すと、**段を渡すだけで作れる。**
   *
   * 書くのは、動く SVG 1 枚と、紙を揃えた連番の SVG。
   * **符号化器は同梱しない** —— mp4 が要るなら、その作り方を文字で返す。
   */
  server.registerTool(
    'zumen_timelapse',
    {
      title: m.timelapseTitle,
      description: m.timelapseDesc,
      inputSchema: {
        sources: z.array(z.string()).optional().describe(m.timelapseSources),
        paths: z.array(z.string()).optional().describe(m.timelapsePaths),
        out: z.string().describe(m.timelapseOut),
        hold: z.number().optional().describe(m.timelapseHold),
        theme: z.enum(['light', 'dark']).optional(),
      },
    },
    async ({ sources, paths, out, hold, theme }) => {
      const steps = sources ?? (paths ?? []).map((path) => read(path));
      const film = await filmOf(steps, { hold, theme, out });
      mkdirSync(out, { recursive: true });
      writeFileSync(`${out}/timelapse.svg`, film.svg, 'utf8');
      film.frames.forEach((frame, index) => {
        writeFileSync(`${out}/step-${String(index + 1).padStart(3, '0')}.svg`, frame, 'utf8');
      });
      return json({
        wrote: `${out}/timelapse.svg`,
        steps: film.frames.length,
        seconds: film.seconds,
        width: film.width,
        height: film.height,
        recipe: film.recipe,
      });
    },
  );

  // --- 画面と繋ぐ（D34）------------------------------------------------------
  //
  // **これまでは、エージェントが見ていたのはディスクだった。**
  // 人が画面で箱を動かしても、保存するまで見えない。提案を入れても、
  // 開いている画面は古い図を映したままだった。ここを通すと、**見るのは画面**になる。
  //
  // **承認の線は動かさない。** 提案は画面に出るだけで、正本には入らない。
  // 入れるのは人が押したとき。**ここに押す口は無い。**

  server.registerTool(
    'zumen_live_status',
    { title: m.liveStatusTitle, description: m.liveStatusDesc, inputSchema: {} },
    () => json(liveStatus(hub)),
  );

  server.registerTool(
    'zumen_live_read',
    { title: m.liveReadTitle, description: m.liveReadDesc, inputSchema: {} },
    () => json(liveRead(hub)),
  );

  server.registerTool(
    'zumen_live_propose',
    {
      title: m.liveProposeTitle,
      description: m.liveProposeDesc,
      inputSchema: {
        source: z.string().describe(m.liveProposeSource),
        path: z.string().optional().describe(m.liveProposePath),
        note: z.string().optional().describe(m.liveProposeNote),
        wait: z.number().min(1).max(MAX_WAIT_S).optional().describe(m.liveProposeWait),
      },
    },
    async ({ source, path, note, wait }) => json(await offer(hub, source, { path, note, wait })),
  );

  server.registerTool(
    'zumen_live_point',
    {
      title: m.livePointTitle,
      description: m.livePointDesc,
      inputSchema: {
        ids: z.array(z.string()).min(1).describe(m.livePointIds),
        note: z.string().optional().describe(m.livePointNote),
      },
    },
    ({ ids, note }) => json(point(hub, ids, note)),
  );

  return server;
}

/** 中身か道のどちらかを受ける。**どちらも無ければ、黙って空を返さない。** */
function bodyOf(source: string | undefined, path: string | undefined): string {
  if (source !== undefined) return source;
  if (path !== undefined) return read(path);
  throw new Error(messages().mcp.needSourceOrPath);
}

/**
 * 画面と繋ぐ線を開く。**開けなくても MCP は立てる。**
 *
 * 既に別の zumen MCP が立っていると番号が埋まっている。そこで落とすと、
 * **図を読む口まで一緒に死ぬ。** 線が無いことは `zumen_live_status` が
 * `screens: 0` で言うので、黙って進んでも取り違えは起きない。
 */
async function openLine(hub: Hub): Promise<LiveServer | null> {
  try {
    return await serve(LIVE_PORT, hub);
  } catch (error) {
    // 握り潰さない。stdout は MCP の通り道なので、**stderr へ出す。**
    process.stderr.write(`${messages().mcp.liveOffOn}: ${String(error)}\n`);
    return null;
  }
}

// 直接叩かれたときだけ立てる。import しても副作用が出ないようにしておく。
if (isEntry(import.meta.url, process.argv[1])) {
  const hub = createHub();
  await openLine(hub);
  await buildServer(hub).connect(new StdioServerTransport());
}
