/**
 * コマンドの口。いまは検証だけ（Issue 014）。
 *
 * 表示だけを持ち、判断は持たない。**判断は `src/validate.ts` にある。**
 * ここを厚くすると、同じ検査を GUI から呼びたくなったときに動かせなくなる
 * （ベースルール §9）。
 *
 * 終了コードの約束。
 *
 * | | 意味 |
 * |---|---|
 * | 0 | 読める。**警告だけなら 0**（迷子は人が解くもので、失敗ではない） |
 * | 1 | 読めない図がある |
 * | 2 | 使い方が違う（引数が無い等） |
 */
import { readFileSync } from 'node:fs';

import { messages } from './messages.ts';
import { hasError, validate } from './validate.ts';
import type { Finding } from './validate.ts';

export interface RunResult {
  code: number;
  lines: string[];
}

/**
 * 検証を走らせて、出す行と終了コードを返す。
 *
 * **画面へは書かない。** 戻り値にしておくと、そのままテストで読める。
 */
export function runValidate(paths: string[], read = readFileSync): RunResult {
  const m = messages().cli;
  if (paths.length === 0) return { code: 2, lines: [m.usage] };

  const lines: string[] = [];
  let unreadable = 0;
  let warnings = 0;

  for (const path of paths) {
    let text: string;
    try {
      text = String(read(path, 'utf8'));
    } catch (error) {
      // 読めないファイルは、そこで止めずに次を見る。まとめて出したほうが直しやすい。
      unreadable += 1;
      lines.push(m.fileUnreadable(path, error instanceof Error ? error.message : String(error)));
      continue;
    }

    const findings = validate(text);
    if (findings.length === 0) continue;

    lines.push(m.fileHeading(path));
    for (const finding of findings) lines.push(`  ${format(finding)}`);
    if (hasError(findings)) unreadable += 1;
    warnings += findings.filter((finding) => finding.severity === 'warning').length;
  }

  if (unreadable > 0) {
    lines.push(m.failed(unreadable));
    return { code: 1, lines };
  }
  lines.push(warnings > 0 ? m.warningsOnly(warnings) : m.allClear(paths.length));
  return { code: 0, lines };
}

function format(finding: Finding): string {
  const m = messages().cli;
  const label = finding.severity === 'error' ? m.severityError : m.severityWarning;
  const where = finding.line === undefined ? '' : `${finding.line}: `;
  return `[${label}] ${where}${finding.message}`;
}

// 直接叩かれたときだけ走る。import しても副作用が出ないようにしておく。
if (process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')) {
  const result = runValidate(process.argv.slice(2));
  for (const line of result.lines) console.log(line);
  process.exitCode = result.code;
}
