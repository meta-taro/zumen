/**
 * **VS Code の拡張に同梱した MCP サーバが、その OS で立つか**（`pnpm vscode:check`。2026-10-30）。
 *
 * `scripts/mcp-package-check.mjs` と同じ考え：**配る形にして、実際に起動して話す。**
 * Mac では VS Code の実行環境で確かめたが、Windows の実機が手元に無い。CI の Windows 機で同じことをする。
 *
 * 確かめること：
 * 1. 束ねた `server/dist/mcp.js` が立ち、`initialize` に名前を返す
 * 2. `tools/list` に `zumen_spec` ・ `zumen_examples` ・ `zumen_create` がある
 * 3. `zumen_examples` が見本の中身を返す（見本を包みに入れ忘れていない）
 * 4. 書体を埋めた SVG を書き出せる（`subset-font` の wasm を包みに写し忘れていない）
 *
 * 起動は `process.execPath` から直接。VS Code の Copilot も、拡張の本体の実行環境を同じ形で起動する
 * （`ELECTRON_RUN_AS_NODE=1` は Node では効かないだけで、害は無い）。
 */
import { execSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVER = join(ROOT, 'packages/zumen-vscode/server/dist/mcp.js');
const SAMPLE = join(ROOT, 'examples/gallery/25-路線図.zumen.yaml');

console.log('束ねる…');
execSync('node scripts/vscode-build.mjs', { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

console.log('起動して話す…');
const child = spawn(process.execPath, [SERVER], {
  cwd: ROOT,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  stdio: ['pipe', 'pipe', 'pipe'],
});
// **何があっても 2 分で終わる**（`scripts/mcp-package-check.mjs` と同じ。止まったままにしない）。
const watchdog = setTimeout(() => {
  console.error('**2 分たっても終わらないので止めました。**');
  child.kill('SIGKILL');
  process.exit(1);
}, 120000);
let buffer = '';
const replies = new Map();
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let at;
  while ((at = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, at).trim();
    buffer = buffer.slice(at + 1);
    if (line === '') continue;
    const message = JSON.parse(line);
    if (message.id !== undefined) replies.set(message.id, message);
  }
});
const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
const reply = async (id, limit = 30000) => {
  const deadline = Date.now() + limit;
  while (!replies.has(id)) {
    if (Date.now() > deadline) throw new Error(`返事がありません（id ${id}）`);
    await new Promise((ok) => setTimeout(ok, 50));
  }
  return replies.get(id);
};
const text = (message) => JSON.stringify(message.result ?? message.error ?? {});

const failures = [];
try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'vscode-check', version: '0' } } });
  const init = await reply(1);
  if (init.result?.serverInfo?.name !== 'zumen') failures.push('initialize に名前が無い');
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = ((await reply(2)).result?.tools ?? []).map((tool) => tool.name);
  for (const want of ['zumen_spec', 'zumen_examples', 'zumen_create']) {
    if (!names.includes(want)) failures.push(`道具が無い: ${want}`);
  }
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'zumen_examples', arguments: { name: '25-路線図' } } });
  const example = text(await reply(3));
  if (!example.includes('version: 1')) failures.push(`zumen_examples が見本の中身を返さない: ${example.slice(0, 200)}`);
  send({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'zumen_export', arguments: { kind: 'svg', source: readFileSync(SAMPLE, 'utf8'), embedFont: true } },
  });
  const svg = text(await reply(4, 60000));
  if (!svg.includes('@font-face')) failures.push(`書体を埋めた SVG が出ない（subset-font を写し忘れた？）: ${svg.slice(0, 200)}`);
} finally {
  clearTimeout(watchdog);
  child.kill('SIGKILL');
}

if (failures.length > 0) {
  console.error(`**通りませんでした**:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`VS Code の拡張に同梱した MCP サーバが ${process.platform} で立ち、話せました（initialize ・ tools/list ・ zumen_examples ・ 書体を埋めた SVG）。`);
process.exit(0);
