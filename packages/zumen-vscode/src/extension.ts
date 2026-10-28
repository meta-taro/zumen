/**
 * VS Code の拡張の入口。**ここは薄く保つ。**
 *
 * やることは 4 つだけ。
 *
 * 1. `.zumen.yaml` を開いているとき、横に図を出す（`zumen.openPreview`）。SVG・PNG で保存できる
 * 2. Markdown プレビューの ```` ```zumen ```` を図の置き場にする（`extendMarkdownIt`）
 * 3. 同梱した MCP サーバを、Copilot に名乗る（VS Code 1.101 以降。それより前は黙って飛ばす）
 * 4. 端末のエージェントへつなぐ 1 行を、端末に置く（`zumen.connectTerminalAgents`。Enter は人が押す）
 *
 * **正本を書き換える口は作らない。** 直すのは人がエディタで行う。
 * エージェントも MCP の `zumen_propose` で差分を出すだけで、入れるのは人。
 */
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { claudeCodeCommand, launcher, RUN_AS_NODE } from './agents.ts';
import { zumenFence, type MarkdownItLike } from './fence.ts';
import { nonce, page } from './page.ts';
import { pngBytes, saveName, type SaveFormat } from './save.ts';

const VIEW_TYPE = 'zumen.preview';
const MCP_PROVIDER = 'zumen.mcp';

export function activate(context: vscode.ExtensionContext): { extendMarkdownIt: <T extends MarkdownItLike>(md: T) => T } {
  const server = vscode.Uri.joinPath(context.extensionUri, 'server', 'dist', 'mcp.js').fsPath;
  const version = String((context.extension.packageJSON as { version?: string }).version ?? '');

  context.subscriptions.push(
    vscode.commands.registerCommand('zumen.openPreview', (uri?: vscode.Uri) => openPreview(context, uri)),
    vscode.commands.registerCommand('zumen.connectTerminalAgents', () => connectTerminalAgents(context, server)),
  );
  registerMcp(context, server, version);
  // 拡張の場所は版ごとに変わる。起動用のファイルは毎回書き直す。
  writeLauncher(context, server);
  return { extendMarkdownIt: zumenFence };
}

export function deactivate(): void {}

/**
 * Copilot へ名乗る。**型は 1.95 に無いので、使う分だけをここで書く。**
 * 古い VS Code では口が無いので、何もしない（プレビューは動く）。
 */
interface McpApi {
  registerMcpServerDefinitionProvider?: (id: string, provider: { provideMcpServerDefinitions: () => unknown[] }) => vscode.Disposable;
}
type StdioDefinition = new (label: string, command: string, args: string[], env: Record<string, string>, version?: string) => unknown;

function registerMcp(context: vscode.ExtensionContext, server: string, version: string): void {
  const lm = (vscode as unknown as { lm?: McpApi }).lm;
  const Definition = (vscode as unknown as { McpStdioServerDefinition?: StdioDefinition }).McpStdioServerDefinition;
  if (lm?.registerMcpServerDefinitionProvider === undefined || Definition === undefined) return;

  context.subscriptions.push(
    lm.registerMcpServerDefinitionProvider(MCP_PROVIDER, {
      provideMcpServerDefinitions: () => [new Definition('zumen', process.execPath, [server], { ...RUN_AS_NODE }, version)],
    }),
  );
}

function writeLauncher(context: vscode.ExtensionContext, server: string): string {
  const made = launcher(process.execPath, server, process.platform);
  const file = vscode.Uri.joinPath(context.globalStorageUri, made.name).fsPath;
  mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
  writeFileSync(file, made.body);
  if (process.platform !== 'win32') chmodSync(file, 0o755);
  return file;
}

async function connectTerminalAgents(context: vscode.ExtensionContext, server: string): Promise<void> {
  const file = writeLauncher(context, server);
  const terminal = vscode.window.createTerminal({ name: 'zumen' });
  terminal.show();
  // **Enter は押さない。** 人の設定を書き換える 1 行なので、打つかどうかは人が決める。
  terminal.sendText(claudeCodeCommand(file, process.platform), false);

  const copy = 'Copy path';
  const picked = await vscode.window.showInformationMessage(
    `zumen: press Enter in the terminal to add zumen to Claude Code. Other agents: register this as an MCP server (stdio): ${file}`,
    copy,
  );
  if (picked === copy) await vscode.env.clipboard.writeText(file);
}

async function openPreview(context: vscode.ExtensionContext, uri?: vscode.Uri): Promise<void> {
  const document = uri ? await vscode.workspace.openTextDocument(uri) : vscode.window.activeTextEditor?.document;
  if (document === undefined) return;

  const dist = vscode.Uri.joinPath(context.extensionUri, 'dist');
  const panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    `zumen: ${basename(document.uri)}`,
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, localResourceRoots: [dist] },
  );
  panel.webview.html = page({
    script: panel.webview.asWebviewUri(vscode.Uri.joinPath(dist, 'preview.js')).toString(),
    cspSource: panel.webview.cspSource,
    nonce: nonce(),
  });

  const send = (): void => void panel.webview.postMessage({ type: 'source', source: document.getText() });

  const listeners = [
    panel.webview.onDidReceiveMessage((message: { type?: string; format?: SaveFormat; data?: string }) => {
      if (message.type === 'ready') send();
      if (message.type === 'save' && typeof message.data === 'string') void saveDiagram(document.uri, message.format, message.data);
    }),
    // 保存を待たず、打つたびに描き直す。描くのは画面側なので、ここは文字を渡すだけ。
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) send();
    }),
  ];
  panel.onDidDispose(() => listeners.forEach((listener) => listener.dispose()));
}

/** 保存先は人が選ぶ。既定は正本の隣・同じ名前。 */
async function saveDiagram(source: vscode.Uri, format: SaveFormat | undefined, data: string): Promise<void> {
  if (format !== 'svg' && format !== 'png') return;
  const bytes = format === 'svg' ? new TextEncoder().encode(data) : pngBytes(data);
  if (bytes === null) return;

  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(source, '..', saveName(basename(source), format)),
    filters: format === 'svg' ? { SVG: ['svg'] } : { PNG: ['png'] },
  });
  if (target === undefined) return;
  await vscode.workspace.fs.writeFile(target, bytes);
  void vscode.window.showInformationMessage(`zumen: saved ${basename(target)}`);
}

function basename(uri: vscode.Uri): string {
  return uri.path.slice(uri.path.lastIndexOf('/') + 1);
}
