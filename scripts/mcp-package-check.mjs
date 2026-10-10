/**
 * **`@metataro/zumen-mcp` を外から入れて、MCP として話せるか**（`pnpm mcp:check`。2026-10-10）。
 *
 * `scripts/consume-check.mjs`（本体の包み）と同じ考え：**配る形（`pnpm pack`）にして、別の場所へ入れて、
 * 実際に起動する。** コマンドは `node_modules/.bin` から起動されるので、手元で `node src/mcp.ts` が
 * 動いても、入れた先で立つとは限らない（「いま走っているのがこのファイルか」の判定が外れる）。
 *
 * 確かめること：
 * 1. `initialize` に名前を返す
 * 2. `tools/list` に `zumen_spec` ・ `zumen_examples` ・ `zumen_propose` がある
 * 3. `zumen_examples` が見本を読める（見本を包みに入れ忘れていない）
 */
import { execSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PKG = join(ROOT, 'packages/zumen-mcp');
const NAME = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).name;

/** Windows では pnpm をシェル経由でしか起動できない（`scripts/consume-check.mjs` と同じ）。 */
const run = (command, cwd) => execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

console.log('組み立てる…');
run('pnpm build', ROOT);
run('node scripts/mcp-package.mjs', ROOT);

const work = mkdtempSync(join(tmpdir(), 'zumen-mcp-check-'));
console.log(`配る形にする（${work}）…`);
run(`pnpm pack --pack-destination "${work}"`, PKG);
const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'));
if (tarball === undefined) throw new Error('pnpm pack が何も作りませんでした');
writeFileSync(
  join(work, 'package.json'),
  JSON.stringify({ name: 'zumen-mcp-check', private: true, type: 'module', dependencies: { [NAME]: `file:./${tarball}` } }, null, 2),
);
console.log('入れる…');
run('pnpm install --silent --ignore-workspace', work);

console.log('起動して話す…');
// **入れた包みの bin を、Node で直接起動する。** Windows の `.bin/zumen-mcp.cmd` はシェル経由でしか起動できず、
// 終わるときに止まるのがシェルだけで中の Node が残り、**検査が終わらなくなった**（2026-10-10、CI で 1 時間半）。
// 確かめたいのは「.bin の置き場から起動されても立つか」なので、bin のファイルを外から起動すれば足りる。
const bin = join(work, 'node_modules', ...NAME.split('/'), 'bin', 'zumen-mcp.js');
const child = spawn(process.execPath, [bin], { cwd: work, stdio: ['pipe', 'pipe', 'pipe'] });
// **何があっても 2 分で終わる。** 返事を待つ所で止まっても、検査は落ちて終わる（止まったままにしない）。
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
const reply = async (id, limit = 20000) => {
  const deadline = Date.now() + limit;
  while (!replies.has(id)) {
    if (Date.now() > deadline) throw new Error(`返事がありません（id ${id}）`);
    await new Promise((ok) => setTimeout(ok, 50));
  }
  return replies.get(id);
};

const failures = [];
try {
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mcp-check', version: '0' } } });
  const init = await reply(1);
  if (init.result?.serverInfo?.name === undefined) failures.push('initialize に名前が無い');
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = ((await reply(2)).result?.tools ?? []).map((tool) => tool.name);
  for (const want of ['zumen_spec', 'zumen_examples', 'zumen_propose']) {
    if (!names.includes(want)) failures.push(`道具が無い: ${want}`);
  }
  // **見本の中身まで読めるか**（一覧だけでは、見本を包みに入れ忘れても通る）。
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'zumen_examples', arguments: { name: '25-路線図' } } });
  const body = JSON.stringify((await reply(3)).result ?? {});
  if (!body.includes('version: 1')) failures.push(`zumen_examples が見本の中身を返さない（包みに見本が入っていない）: ${body.slice(0, 200)}`);
} finally {
  clearTimeout(watchdog);
  child.kill('SIGKILL');
}

if (failures.length > 0) {
  console.error(`**通りませんでした**:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
// **ここで終わる。** 子の入出力が開いたままだと、Node が終わらずに待ち続ける。
process.exitCode = 0;
console.log(`${NAME} を入れて起動し、MCP として話せました（initialize ・ tools/list ・ zumen_examples）。`);
process.exit(0);
