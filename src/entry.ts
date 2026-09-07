/**
 * 「このファイルが直接叩かれたか」を見る。
 *
 * ## なぜ専用に置くか
 *
 * 以前はこう書いていた。
 *
 * ```ts
 * import.meta.url.endsWith(process.argv[1].split('/').pop())
 * ```
 *
 * **Windows では動かない。** `process.argv[1]` は `C:\...\mcp.ts` のように
 * 逆斜線で来るので `split('/')` が効かず、判定が常に偽になる。
 * その結果、**`pnpm mcp` も `pnpm validate` も、Windows では何もせずに終わる。**
 *
 * 配布して別の機械で試してもらう以上、ここは当てずっぽうにしない。
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `url`（`import.meta.url`）が、いま走らせている入口そのものか。
 *
 * **道を正規化してから比べる。** 文字列の末尾一致で済ませない。
 *
 * `argv1` に既定値を置かない。置くと、**「入口が無い」場面をテストで作れなくなる**
 * （`undefined` を渡した瞬間に既定が効いてしまう）。呼ぶ側が `process.argv[1]` を渡す。
 */
export function isEntry(url: string, argv1: string | undefined): boolean {
  if (argv1 === undefined || argv1 === '') return false;
  try {
    return resolve(fileURLToPath(url)) === resolve(argv1);
  } catch {
    // file: 以外の url（試験や束ねた後）では、入口ではないものとして扱う。
    return false;
  }
}
