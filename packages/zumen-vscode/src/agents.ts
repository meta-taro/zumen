/**
 * 同梱した MCP サーバを、エージェントから呼べる形にする（D47 の 2 段目）。
 *
 * **使う人に Node を入れてもらわない。** VS Code が持っている実行環境を
 * `ELECTRON_RUN_AS_NODE=1` で Node として動かす。
 *
 * | 誰から | どうつなぐか |
 * |---|---|
 * | VS Code の Copilot | 拡張が MCP サーバとして名乗る（`mcpServerDefinitionProviders`）。人の手は要らない |
 * | 端末のエージェント（Claude Code など）| 決まった場所に起動用の小さなファイルを置き、そこを登録してもらう |
 *
 * 起動用のファイルを挟むのは、**拡張の場所が版ごとに変わる**から。
 * 拡張の中の道を直接登録すると、更新した日に黙って繋がらなくなる。
 * 起動用のファイルは拡張が立ち上がるたびに書き直す。
 */

export const RUN_AS_NODE = { ELECTRON_RUN_AS_NODE: '1' } as const;

export interface Launcher {
  /** 置くファイルの名前。 */
  name: string;
  /** 中身。 */
  body: string;
}

/** 起動用のファイル。`runtime` は VS Code の実行環境、`server` は同梱した `mcp.js`。 */
export function launcher(runtime: string, server: string, platform: NodeJS.Platform): Launcher {
  if (platform === 'win32') {
    return {
      name: 'zumen-mcp.cmd',
      body: ['@echo off', 'set ELECTRON_RUN_AS_NODE=1', `"${runtime}" "${server}" %*`, ''].join('\r\n'),
    };
  }
  return {
    name: 'zumen-mcp',
    body: ['#!/bin/sh', '# zumen の MCP サーバ（VS Code の拡張に同梱したもの）。拡張が立ち上がるたびに書き直す。', `ELECTRON_RUN_AS_NODE=1 exec ${shellQuote(runtime)} ${shellQuote(server)} "$@"`, ''].join('\n'),
  };
}

/**
 * Claude Code へ登録する 1 行。**打つのは人。** 拡張は端末に置くだけで、Enter は押さない。
 * 人の設定（`~/.claude.json`）を拡張が黙って書き換えないため。
 */
export function claudeCodeCommand(launcherPath: string, platform: NodeJS.Platform): string {
  const path = platform === 'win32' ? `"${launcherPath}"` : shellQuote(launcherPath);
  return `claude mcp add --scope user zumen -- ${path}`;
}

/** 単一引用符で包む。中の単一引用符は閉じて、逃がして、開き直す。 */
export function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}
