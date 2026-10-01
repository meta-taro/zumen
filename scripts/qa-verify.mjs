/**
 * **git-qa の証跡を、zumen 側で読み返す関門**（`pnpm qa:verify`）。
 *
 * ## 何をする道具で、何をしない道具か
 *
 * 証跡を**作る**のは git-qa。突き合わせる `compareSheet` も向こうにある。
 * ここがやるのは 1 つだけ —— **zumen のリリース手順の中で、証跡を読み返して止める。**
 *
 * `product-baseline.md` §29 がこう言っている。
 *
 * > commit・テスト通過・Issue クローズ・デプロイ成功は、**AI が無人で発生させられる。**
 * > 活動量を見ている限り、人が関与していないことは検出できない。
 *
 * 検証シート（`qa/デスクトップ-検証シート.tsv`）も同じで、**誰も走らせなくても、
 * 誰も見なくても、リポジトリは緑のまま**だった。ここはその穴を塞ぐ。
 *
 * ## 止める条件
 *
 * | 見るもの | どうするか |
 * |---|---|
 * | 証跡がまだ無い | **終了コード 2。**走らせていないことを「通った」と書かない |
 * | `FAIL` がある | **止める** |
 * | `VERIFIED` が 0 件 | **止める。**`AUTO_PASS` は「誰も見ていない」であって合格ではない |
 * | シートが判定のときから変わっている・消えた・記録が壊れている | **止める** |
 * | 相手が走行中に入れ替わった（`targetCheck.state === 'changed'`） | **止める** |
 * | 途中で止まった実行（`finishedAt` が無い） | **止める** |
 * | `AUTO_PASS` / `SKIP` / `BLOCKED` がある | 止めない。**件数を必ず出す** |
 *
 * `pnpm test` には入れない。**人が走らせるまで落ち続ける関門**なので、
 * 常時緑であるべき検査と混ぜると、どちらかを黙らせることになる。
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** 人が見て置いた値。**`AUTO_PASS` と `SKIP` は入らない。** */
const PLACED_BY_HUMAN = new Set(['VERIFIED', 'FAIL', 'BLOCKED']);
const RESULTS = ['VERIFIED', 'AUTO_PASS', 'FAIL', 'BLOCKED', 'SKIP'];
const DIGEST = /^[0-9a-f]{64}$/;

/** 証跡に書く側（git-qa の `sheetDigest`）と同じ数え方。 */
export function sheetDigest(text) {
  return createHash('sha256').update(text).digest('hex');
}

/** いちばん新しい実行の場所。**無ければ `null`。** */
export function latestRun(workspace) {
  const runs = join(workspace, 'runs');
  if (!existsSync(runs)) return null;
  const dirs = readdirSync(runs)
    .map((name) => join(runs, name))
    .filter((path) => statSync(path).isDirectory() && existsSync(join(path, 'run.json')))
    // 名前は `20260915-100000`。**辞書順が時刻順**になる形なので、そのまま並べる。
    .sort();
  return dirs.length === 0 ? null : dirs[dirs.length - 1];
}

/** シートを突き合わせる。**4 つを混ぜない**（人が次にやることが違う）。 */
export function checkSheet(recorded, current) {
  if (typeof recorded?.sha256 !== 'string' || !DIGEST.test(recorded.sha256)) {
    return {
      kind: 'unreadable',
      reason: `証跡のシートの値が、形からして読めない: ${String(recorded?.sha256)}`,
    };
  }
  if (current === null) {
    return { kind: 'missing', reason: `突き合わせる相手のシートが読めない: ${recorded.path}` };
  }
  const now = sheetDigest(current);
  if (now === recorded.sha256) {
    return { kind: 'same', reason: `判定を置いたときと同じ（${now.slice(0, 12)}）` };
  }
  return {
    kind: 'changed',
    reason:
      `変わっている。判定を置いたとき ${recorded.sha256.slice(0, 12)} / いま ${now.slice(0, 12)}。` +
      'この判定は、いまの文面に対して置かれたものではない',
  };
}

/** 相手が走行中に入れ替わっていないか。**持っていない証跡には何も足さない。** */
function checkTarget(check) {
  if (check === undefined) return { line: null, stops: false };
  if (check.state === 'changed') {
    return {
      line: `相手が走行中に入れ替わっている（${check.before} → ${check.after}）`,
      stops: true,
    };
  }
  if (check.state === 'same') return { line: '相手は、走っている間ずっと同じ', stops: false };
  return { line: `相手が入れ替わっていないかは測れていない（${check.reason}）`, stops: false };
}

/** 証跡 1 本を読み返す。**判定はここに集める**（書き出しと分ける）。 */
export function inspectRun(run, sheetText) {
  const cases = run.cases ?? [];
  const counts = Object.fromEntries(RESULTS.map((name) => [name, 0]));
  for (const one of cases) {
    if (one.result in counts) counts[one.result] += 1;
  }
  const placed = cases.filter((one) => PLACED_BY_HUMAN.has(one.result)).length;
  const sheet = checkSheet(run.sheet, sheetText);
  const target = checkTarget(run.targetCheck);

  const troubles = [];
  if (counts.FAIL > 0) troubles.push(`落ちているケースが ${counts.FAIL} 件ある`);
  if (sheet.kind !== 'same') troubles.push(`シート: ${sheet.reason}`);
  if (counts.VERIFIED === 0) {
    troubles.push('人が見て置いた合格が 1 件も無い（AUTO_PASS は「誰も見ていない」）');
  }
  if (target.stops) troubles.push(target.line);
  if (run.finishedAt === undefined) {
    troubles.push('途中で止まった実行（終わりの時刻が無い）。残りのケースは誰も見ていない');
  }

  return { counts, placed, sheet, target, troubles, total: cases.length, mode: run.mode };
}

/** 読み返した結果を、人が読める形にする。**「誰も見ていない」を必ず出す。** */
export function render(found) {
  const { counts, placed, sheet, target, troubles, total, mode } = found;
  const human = RESULTS.filter((name) => PLACED_BY_HUMAN.has(name))
    .map((name) => `${name} ${counts[name]}`)
    .join(' / ');
  const lines = [
    `やり方: ${mode ?? '(不明)'}`,
    `ケース ${total} 件`,
    `  人が見て置いた: ${placed} 件（${human}）`,
    `  誰も見ていない: AUTO_PASS ${counts.AUTO_PASS} 件 / SKIP ${counts.SKIP} 件`,
    `  シート: ${sheet.reason}`,
  ];
  if (target.line !== null) lines.push(`  ${target.line}`);
  lines.push('');
  if (troubles.length === 0) {
    lines.push('**この証跡は、いまのシートに対する人の署名として読める。**');
  } else {
    lines.push('**通ったことにしない。**');
    for (const trouble of troubles) lines.push(`  - ${trouble}`);
  }
  return lines.join('\n');
}

/** 実行。**読めない・走っていないは、通さない。** */
export function main(workspace = join(ROOT, 'qa'), out = console.log) {
  if (!existsSync(join(workspace, 'git-qa.json'))) {
    out(`git-qa のワークスペースがありません: ${workspace}`);
    out('`git-qa.json` がある場所を渡してください。');
    return 2;
  }
  const dir = latestRun(workspace);
  if (dir === null) {
    out('証跡がまだありません（一度も走らせていない）。');
    out('走らせ方は qa/README.md にあります。**走らせていないことを「通った」と書かない。**');
    return 2;
  }

  let run;
  try {
    run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'));
  } catch (error) {
    out(`証跡が読めません: ${join(dir, 'run.json')}`);
    out(String(error instanceof Error ? error.message : error));
    return 1;
  }

  // シートの場所は証跡が持っている（ワークスペースからの相対）。
  const sheetPath = typeof run.sheet?.path === 'string' ? join(workspace, run.sheet.path) : null;
  const sheetText =
    sheetPath !== null && existsSync(sheetPath) ? readFileSync(sheetPath, 'utf8') : null;

  const found = inspectRun(run, sheetText);
  out(`証跡: ${relative(ROOT, dir)}`);
  out(render(found));
  return found.troubles.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv[2] ?? undefined);
}
