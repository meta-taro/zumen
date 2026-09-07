/**
 * コマンドの口。検証（Issue 014）と Git のマージドライバ（Issue 011）。
 *
 * 表示だけを持ち、判断は持たない。**判断は `src/validate.ts` にある。**
 * ここを厚くすると、同じ検査を GUI から呼びたくなったときに動かせなくなる
 * （ベースルール §9）。
 *
 * 終了コードの約束。
 *
 * | | 意味 |
 * |---|---|
 * | 0 | 読める（`merge-driver` では解けた）。**警告だけなら 0** |
 * | 1 | 読めない図がある（`merge-driver` では解けなかった） |
 * | 2 | 使い方が違う（引数が無い等） |
 *
 * **`merge-driver` の 1 は失敗ではなく、Git への「人が見る必要がある」の合図。**
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { toDrawio } from './drawio.ts';
import { renderZumenBlocks, replaceZumenBlocks } from './embed.ts';
import { mergeThreeWay } from './git-merge.ts';
import { layout } from './layout.ts';
import { PASS_LINE, measure, percent } from './measure.ts';
import { merge } from './merge.ts';
import type { Conflict } from './merge.ts';
import { toMermaid } from './mermaid.ts';
import { render } from './render.ts';
import { messages } from './messages.ts';
import { hasError, validate } from './validate.ts';
import type { Finding } from './validate.ts';
import { isEntry } from './entry.ts';

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

/**
 * Git のマージドライバ。`base` / `ours` / `theirs` を受け取り、**結果を `ours` の場所へ書く**
 * （Git の約束。`%A` が出力先を兼ねる）。
 *
 * 終了コード 1 は失敗ではなく、**「人が見る必要がある」という Git への合図**。
 */
export function runMergeDriver(
  paths: string[],
  read = readFileSync,
  write = writeFileSync,
): RunResult {
  const m = messages().cli;
  const [base, ours, theirs] = paths;
  if (base === undefined || ours === undefined || theirs === undefined) {
    return { code: 2, lines: [m.usageMergeDriver] };
  }

  let result;
  try {
    result = mergeThreeWay(String(read(base, 'utf8')), String(read(ours, 'utf8')), String(read(theirs, 'utf8')));
  } catch (error) {
    // 構造で解けない（YAML として読めない等）なら、**Git の既定のマージへ委ねる。**
    // ここで勝手に片方を書くと、人の直しが黙って消える。
    return { code: 1, lines: [m.fileUnreadable(ours, error instanceof Error ? error.message : String(error))] };
  }

  write(ours, result.text);
  if (result.conflicts.length === 0) return { code: 0, lines: [m.mergedClean(ours)] };
  return { code: 1, lines: [m.mergedWithConflicts(ours, result.conflicts.length)] };
}

/**
 * draw.io の XML へ書き出す。
 *
 * **圧縮しない。** 差分が読めなくなる（`src/drawio.ts` の冒頭）。
 */
export async function runDrawio(
  paths: string[],
  read = readFileSync,
  write = writeFileSync,
): Promise<RunResult> {
  const m = messages().cli;
  const [input, output] = paths;
  if (input === undefined) return { code: 2, lines: [m.usageDrawio] };
  const target = output ?? `${input.replace(/\.zumen\.yaml$|\.yaml$/, '')}.drawio`;

  let text: string;
  try {
    text = String(read(input, 'utf8'));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(input, error instanceof Error ? error.message : String(error))] };
  }

  const placed = await layout(text);
  write(target, toDrawio(placed, titleOf(text) ?? input));
  return { code: 0, lines: [m.wrote(target)] };
}

/** 図の題。無ければ `undefined`。**無いものを埋めない。** */
function titleOf(text: string): string | undefined {
  const found = /^title:\s*(.+)$/m.exec(text);
  return found?.[1]?.trim();
}

/**
 * 「9 割」を測る（Issue 003 / D3）。
 *
 * **合格しなくても 1 は返さない。** これは検査ではなく物差しで、
 * ここで CI を落とすと、**数字を良くするために指標のほうを歪める**動機が生まれる。
 */
export function runMeasure(paths: string[], read = readFileSync): RunResult {
  const m = messages().cli;
  if (paths.length === 0) return { code: 2, lines: [m.usageMeasure] };

  const lines: string[] = [];
  let short = 0;
  let untouched = 0;
  for (const path of paths) {
    let text: string;
    try {
      text = String(read(path, 'utf8'));
    } catch (error) {
      return { code: 1, lines: [m.fileUnreadable(path, error instanceof Error ? error.message : String(error))] };
    }
    const result = measure(text);
    lines.push(m.measured(path, percent(result.autonomy), percent(result.layoutAutonomy)));
    if (!result.pass) short += 1;
    if (result.touched === 0) untouched += 1;
  }

  const line = percent(PASS_LINE);
  lines.push(short === 0 ? m.measurePassed(paths.length, line) : m.measureFailed(short, line));
  // **手直しが 1 つも無い図の 100% は、成績ではない。**黙って出すと成績として読まれる。
  if (untouched > 0) lines.push(m.measureUntouched(untouched));
  return { code: 0, lines };
}

/** 1 つ読んで 1 つ書く形の変換。**口の作りを揃える。** */
async function convert(
  paths: string[],
  usage: string,
  extension: string,
  transform: (text: string) => string | Promise<string>,
  read: typeof readFileSync,
  write: typeof writeFileSync,
): Promise<RunResult> {
  const m = messages().cli;
  const [input, output] = paths;
  if (input === undefined) return { code: 2, lines: [usage] };
  const target = output ?? `${input.replace(/\.zumen\.yaml$|\.ya?ml$|\.md$/, '')}${extension}`;

  let text: string;
  try {
    text = String(read(input, 'utf8'));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(input, error instanceof Error ? error.message : String(error))] };
  }
  write(target, await transform(text));
  return { code: 0, lines: [m.wrote(target)] };
}

/**
 * SVG を書き出す。
 *
 * `--dark` を付けると、暗い地へ貼る用の色になる（`DESIGN.md` §3）。
 * **付けなければライト。** 貼り先の地の色が分からないときの既定は変えない。
 */
export async function runSvg(paths: string[], read = readFileSync, write = writeFileSync): Promise<RunResult> {
  const theme = paths.includes('--dark') ? 'dark' : 'light';
  const files = paths.filter((part) => part !== '--dark');
  return convert(
    files,
    messages().cli.usageSvg,
    '.svg',
    async (text) => render(await layout(text), theme),
    read,
    write,
  );
}

export async function runMermaid(paths: string[], read = readFileSync, write = writeFileSync): Promise<RunResult> {
  return convert(paths, messages().cli.usageMermaid, '.mmd', (text) => toMermaid(text), read, write);
}

/**
 * Markdown の囲みを図へ差し替える（D4 の着地点）。
 *
 * **描けない囲みは、理由をその位置に出して指定を残す**（`src/embed.ts` の作法）。
 * 黙って空にすると、書いた人は「描けている」と思ったまま気づかない。
 */
export async function runEmbed(paths: string[], read = readFileSync, write = writeFileSync): Promise<RunResult> {
  const m = messages().cli;
  const [input] = paths;
  if (input === undefined) return { code: 2, lines: [m.usageEmbed] };

  let source: string;
  try {
    source = String(read(input, 'utf8'));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(input, error instanceof Error ? error.message : String(error))] };
  }

  const rendered = await renderZumenBlocks(source);
  if (rendered.size === 0) return { code: 0, lines: [m.embedNoBlocks(input)] };

  const target = paths[1] ?? input.replace(/\.md$/, '.zumen.md');
  write(target, replaceZumenBlocks(source, rendered));
  return { code: 0, lines: [m.wrote(target)] };
}

/**
 * AI の提案を人の正本へ入れる（D5）。
 *
 * **競合は適用しない。** 決めるのは人であって、ここではない。
 * 決着（`resolve`）を CLI に置かないのも同じ理由で、
 * **承認は画面と人の仕事**（D11）。
 */
export function runMerge(paths: string[], read = readFileSync, write = writeFileSync): RunResult {
  const m = messages().cli;
  const [current, proposal] = paths;
  if (current === undefined || proposal === undefined) return { code: 2, lines: [m.usageMerge] };

  let result;
  try {
    result = merge(String(read(current, 'utf8')), String(read(proposal, 'utf8')));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(current, error instanceof Error ? error.message : String(error))] };
  }

  write(current, result.text);
  const lines = [m.wrote(current)];
  if (result.conflicts.length === 0) {
    lines.push(m.mergedClean2);
    return { code: 0, lines };
  }
  lines.push(m.mergedConflicts(result.conflicts.length));
  for (const conflict of result.conflicts) lines.push(m.conflictLine(conflict.elementId, describe(conflict)));
  // 競合が残っていても失敗ではない。**人が見て決める、というだけ。**
  return { code: 0, lines };
}

function describe(conflict: Conflict): string {
  const m = messages().cli;
  const point = (value: { x: number; y: number }): string => `(${value.x}, ${value.y})`;
  if (conflict.kind === 'pin-orphaned') return m.conflictRemoved;
  if (conflict.kind === 'position-suppressed') return m.conflictSuppressed(point(conflict.ai));
  return m.conflictPosition(point(conflict.human), point(conflict.ai));
}

/** 命令を振り分ける。**判断は持たない。** */
export async function run(argv: string[]): Promise<RunResult> {
  const [command, ...rest] = argv;
  if (command === 'validate') return runValidate(rest);
  if (command === 'merge-driver') return runMergeDriver(rest);
  if (command === 'drawio') return runDrawio(rest);
  if (command === 'measure') return runMeasure(rest);
  if (command === 'svg') return runSvg(rest);
  if (command === 'mermaid') return runMermaid(rest);
  if (command === 'embed') return runEmbed(rest);
  if (command === 'merge') return runMerge(rest);
  const m = messages().cli;
  const usage = [
    m.usage,
    m.usageMeasure,
    m.usageSvg,
    m.usageMermaid,
    m.usageDrawio,
    m.usageEmbed,
    m.usageMerge,
    m.usageMergeDriver,
  ];
  if (command === undefined) return { code: 2, lines: usage };
  return { code: 2, lines: [m.unknownCommand(command), ...usage] };
}

// 直接叩かれたときだけ走る。import しても副作用が出ないようにしておく。
if (isEntry(import.meta.url, process.argv[1])) {
  const result = await run(process.argv.slice(2));
  for (const line of result.lines) console.log(line);
  process.exitCode = result.code;
}
