/**
 * 行の差分。**適用前に人へ見せるため**（D11 の操作 6）。
 *
 * 適用してから見せるのでは、承認ではなく事後報告になる。
 *
 * ## なぜ図の上に重ねないか
 *
 * 図に重ねると、変わっていない部分と変わった部分の境目が読めない。
 * それに**正本はテキストで、`git diff` が読める形にしてある**（D2）。
 * 同じ見え方にすれば、画面で見たものと Git で見るものが一致する（`DESIGN.md` §2.5）。
 *
 * ## 何を使うか
 *
 * 依存を増やさずに済む範囲で足りる。最長共通部分列（LCS）を素直に取る。
 * 図の正本はせいぜい数百行なので、これで十分。
 */

export type Kind = 'same' | 'added' | 'removed';

export interface DiffLine {
  kind: Kind;
  text: string;
  /** 変更前の行番号（1 起点）。足された行には無い。 */
  before: number | undefined;
  /** 変更後の行番号（1 起点）。消された行には無い。 */
  after: number | undefined;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const table = lcsTable(a, b);

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i]!, before: i + 1, after: j + 1 });
      i += 1;
      j += 1;
      continue;
    }
    // 残りの共通部分が長いほうへ進む。**消した側を先に出す**（git と同じ並び）。
    if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      out.push({ kind: 'removed', text: a[i]!, before: i + 1, after: undefined });
      i += 1;
      continue;
    }
    out.push({ kind: 'added', text: b[j]!, before: undefined, after: j + 1 });
    j += 1;
  }
  for (; i < a.length; i += 1) {
    out.push({ kind: 'removed', text: a[i]!, before: i + 1, after: undefined });
  }
  for (; j < b.length; j += 1) {
    out.push({ kind: 'added', text: b[j]!, before: undefined, after: j + 1 });
  }
  return out;
}

/** 変わった行が 1 つでもあるか。 */
export function hasChange(lines: DiffLine[]): boolean {
  return lines.some((line) => line.kind !== 'same');
}

/**
 * 変わったところの周りだけを残す。
 *
 * **全文を出すと、変わった 3 行が 200 行の中に埋もれる。**
 * 前後 `context` 行を残し、離れたところは落とす。
 */
export function condense(lines: DiffLine[], context = 3): DiffLine[] {
  const keep = new Set<number>();
  lines.forEach((line, index) => {
    if (line.kind === 'same') return;
    for (let k = index - context; k <= index + context; k += 1) {
      if (k >= 0 && k < lines.length) keep.add(k);
    }
  });
  return lines.filter((_, index) => keep.has(index));
}

/** `table[i][j]` = `a[i..]` と `b[j..]` の共通部分列の長さ。 */
function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  return table;
}
