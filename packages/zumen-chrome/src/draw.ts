/**
 * 正本 1 枚を、GitHub の上に出す HTML にする。
 *
 * **重いので、zumen が見つかったページでだけ読む**（`content.ts` が import する）。
 * 描画は ELK を抱えて 1.8 MB ある。GitHub のすべてのページで読ませない。
 *
 * **描けなかったら、理由を出す。** 黙って何も出さないと、書いた人は気づかない。
 */
import { kindOf } from '../../../src/kind.ts';
import { layout } from '../../../src/layout.ts';
import { render } from '../../../src/render.ts';
import { escapeHtml, type Theme } from './github.ts';

export async function drawHtml(source: string, theme: Theme): Promise<string> {
  if (source.trim() === '') return failure('empty');
  try {
    return render(await layout(source), theme, 'safe', kindOf(source) === 'placement');
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

function failure(message: string): string {
  return `<div role="alert" style="padding:6px 10px;border-left:3px solid #cf222e;white-space:pre-wrap">zumen: ${escapeHtml(message)}</div>`;
}
