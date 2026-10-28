/**
 * 正本 1 枚を、プレビューに出す HTML にする。
 *
 * **画面（Webview）の中で動く。** 中核（`src/`）は画面を知らないので、
 * ブラウザでもそのまま動く（GUI の `app/` と同じ呼び方）。
 *
 * **描けなかったら、理由を出す。** 前の図を黙って残すと、
 * 書いた人は直せたと思ったまま気づかない。
 */
import { kindOf } from '../../../src/kind.ts';
import { layout } from '../../../src/layout.ts';
import { render } from '../../../src/render.ts';
import type { Theme } from '../../../src/tokens.ts';
import { escapeHtml } from './fence.ts';

export type Drawn = { ok: true; svg: string } | { ok: false; message: string };

export async function draw(source: string, theme: Theme): Promise<Drawn> {
  if (source.trim() === '') return { ok: false, message: 'empty' };
  try {
    const svg = render(await layout(source), theme, 'safe', kindOf(source) === 'placement');
    return { ok: true, svg };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** 描けなかったときの欄。文言は短く、理由は中核の言い分をそのまま見せる。 */
export function failure(message: string): string {
  return `<div class="zumen-error" role="alert">zumen: ${escapeHtml(message)}</div>`;
}

/**
 * VS Code の色の決まり（`body` の class）から、図の地を選ぶ。
 * ハイコントラストの暗いほうも暗い地に寄せる。
 */
export function themeOf(bodyClasses: Iterable<string>): Theme {
  for (const name of bodyClasses) {
    if (name === 'vscode-dark' || name === 'vscode-high-contrast') return 'dark';
  }
  return 'light';
}
