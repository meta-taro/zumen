/**
 * VS Code の拡張の入口。**ここは薄く保つ。**
 *
 * やることは 2 つだけ。
 *
 * 1. `.zumen.yaml` を開いているとき、横に図を出す（`zumen.openPreview`）
 * 2. Markdown プレビューの ```` ```zumen ```` を図の置き場にする（`extendMarkdownIt`）
 *
 * **正本を書き換える口は作らない。** 直すのは人がエディタで行う。
 * 拡張から書けるようにすると、AI の書き換えを人が承認する往復を飛ばす道になる。
 */
import * as vscode from 'vscode';
import { zumenFence, type MarkdownItLike } from './fence.ts';
import { nonce, page } from './page.ts';

const VIEW_TYPE = 'zumen.preview';

export function activate(context: vscode.ExtensionContext): { extendMarkdownIt: <T extends MarkdownItLike>(md: T) => T } {
  context.subscriptions.push(
    vscode.commands.registerCommand('zumen.openPreview', (uri?: vscode.Uri) => openPreview(context, uri)),
  );
  return { extendMarkdownIt: zumenFence };
}

export function deactivate(): void {}

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
    panel.webview.onDidReceiveMessage((message: { type?: string }) => {
      if (message.type === 'ready') send();
    }),
    // 保存を待たず、打つたびに描き直す。描くのは画面側なので、ここは文字を渡すだけ。
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) send();
    }),
  ];
  panel.onDidDispose(() => listeners.forEach((listener) => listener.dispose()));
}

function basename(uri: vscode.Uri): string {
  return uri.path.slice(uri.path.lastIndexOf('/') + 1);
}
