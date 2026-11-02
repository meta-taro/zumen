/**
 * 正本 1 枚を、GitHub の上に出す HTML にする。
 *
 * **重いので、zumen が見つかったページでだけ読む**（`content.ts` が import する）。
 * 描画は ELK を抱えて 1.8 MB ある。GitHub のすべてのページで読ませない。
 *
 * **描けなかったら、理由を出す。** 黙って何も出さないと、書いた人は気づかない。
 */
import { compare } from '../../../src/compare.ts';
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

/**
 * 変更前と変更後を並べる（`src/compare.ts`。足した節に「新」、消えた節に「消」、人が置いた節に「人」）。
 * 片方が無い（足したファイル・消したファイル）ときは、ある方だけを描く。
 */
export async function compareHtml(before: string | null, after: string | null, theme: Theme): Promise<string> {
  if (before === null || before.trim() === '') return after === null ? failure('empty') : summary('added') + (await drawHtml(after, theme));
  if (after === null || after.trim() === '') return summary('removed') + (await drawHtml(before, theme));
  try {
    const result = await compare(before, after, { theme });
    return `<p style="margin:0 0 8px;font-size:12px">${escapeHtml(countsOf(result))}</p>${result.svg}`;
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 印の数と、どの節か。**図を欄に収めると印が読めない**ので、字でも言う（`content.ts`）。
 * 名前は正本の id（YAML の差分と突き合わせられる）。多いときは頭の 5 つまで。
 */
export function countsOf(result: { added: string[]; removed: string[]; kept: string[] }): string {
  const names = (ids: string[]) => (ids.length === 0 ? '' : `（${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ` ほか ${ids.length - 5}` : ''}）`);
  return [
    `新 ${result.added.length}${names(result.added)}`,
    `消 ${result.removed.length}${names(result.removed)}`,
    `人の直しが残った ${result.kept.length}${names(result.kept)}`,
  ].join(' ／ ');
}

function summary(kind: 'added' | 'removed'): string {
  const text = kind === 'added' ? 'このファイルは新しく足された（変更前は無い）' : 'このファイルは消された（変更後は無い）';
  return `<p style="margin:0 0 8px;font-size:12px">${text}</p>`;
}

function failure(message: string): string {
  return `<div role="alert" style="padding:6px 10px;border-left:3px solid #cf222e;white-space:pre-wrap">zumen: ${escapeHtml(message)}</div>`;
}
