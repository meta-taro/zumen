/**
 * **証跡を読み返す関門が、通してはいけないものを通さないこと**（`scripts/qa-verify.mjs`）。
 *
 * ## なぜ要るか
 *
 * この関門自体が、**壊れても誰も気づかない種類の道具**である。
 * 証跡がまだ無い間、`pnpm qa:verify` はずっと 2 を返す。
 * その状態では「止める側の条件」が 1 度も走らないので、
 * **`FAIL` を見落とす実装でも、見た目は同じ**になる。
 *
 * だから条件ごとに証跡を作って、**止まることを先に見ておく。**
 *
 * ## ここで見ないもの
 *
 * 証跡の作り方（git-qa 側）。ここは**読み返す側**だけを見る。
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// @ts-expect-error --- 素の .mjs（型は無い）。読み返す側は TypeScript を通さない。
import { checkSheet, inspectRun, latestRun, main, render, sheetDigest } from '../scripts/qa-verify.mjs';

const SHEET = 'No.\t項目\n1\t窓が出る\n';
const digest = (text: string): string => createHash('sha256').update(text).digest('hex');

interface Case {
  no: number;
  title: string;
  result: string;
}

/** 証跡 1 本の最小形。**足りない所は各テストで足す。** */
function run(cases: Case[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 'git-qa/run/v1',
    runId: '20260915-100000',
    startedAt: '2026-09-15T10:00:00Z',
    finishedAt: '2026-09-15T10:12:00Z',
    operator: { handle: 'meta-taro' },
    mode: 'manual',
    sheet: { path: 'デスクトップ-検証シート.tsv', sha256: digest(SHEET) },
    target: { kind: 'desktop', build: {} },
    recording: { requested: false },
    cases: cases.map((one) => ({ ...one, startedAt: '2026-09-15T10:00:00Z', steps: [], recording: { state: 'not_requested' } })),
    findings: [],
    ...extra,
  };
}

const ok: Case = { no: 1, title: '窓が出る', result: 'VERIFIED' };

/** ワークスペースを 1 つ作って渡す。**後片付けまでここでやる。** */
function workspace(runs: Record<string, unknown>[] | null): string {
  const dir = mkdtempSync(join(tmpdir(), 'zumen-qa-'));
  writeFileSync(join(dir, 'git-qa.json'), '{"schemaVersion":"git-qa/workspace/v1","title":"t"}');
  writeFileSync(join(dir, 'デスクトップ-検証シート.tsv'), SHEET);
  for (const one of runs ?? []) {
    const at = join(dir, 'runs', String((one as { runId: string }).runId));
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, 'run.json'), JSON.stringify(one));
  }
  return dir;
}

/** 黙らせずに実行する。**何を言ったかも見たいので溜める。** */
function verify(dir: string): { code: number; said: string } {
  const lines: string[] = [];
  const code = main(dir, (line: string) => lines.push(line)) as number;
  return { code, said: lines.join('\n') };
}

describe('シートの突き合わせ', () => {
  it('判定を置いたときと同じなら same', () => {
    assert.equal(checkSheet({ path: 's.tsv', sha256: digest(SHEET) }, SHEET).kind, 'same');
  });

  it('1 文字でも変われば changed', () => {
    assert.equal(checkSheet({ path: 's.tsv', sha256: digest(SHEET) }, `${SHEET}2\t`).kind, 'changed');
  });

  it('シートが読めないのは changed ではなく missing', () => {
    assert.equal(checkSheet({ path: 's.tsv', sha256: digest(SHEET) }, null).kind, 'missing');
  });

  it('記録された値の形が違えば unreadable', () => {
    assert.equal(checkSheet({ path: 's.tsv', sha256: 'えいや' }, SHEET).kind, 'unreadable');
  });

  it('git-qa と同じ数え方をする', () => {
    assert.equal(sheetDigest(SHEET), digest(SHEET));
  });
});

describe('いちばん新しい実行', () => {
  it('名前の順で新しいほうを採る', () => {
    const dir = workspace([run([ok], { runId: '20260914-090000' }), run([ok], { runId: '20260915-100000' })]);
    assert.equal(latestRun(dir)?.endsWith('20260915-100000'), true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('1 本も無ければ null', () => {
    const dir = workspace([]);
    assert.equal(latestRun(dir), null);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('通す / 止める', () => {
  const run1 = (cases: Case[], extra?: Record<string, unknown>) => {
    const dir = workspace([run(cases, extra)]);
    const got = verify(dir);
    rmSync(dir, { recursive: true, force: true });
    return got;
  };

  it('人が見て置いた合格だけなら通す', () => {
    const got = run1([ok, { no: 2, title: '図が開ける', result: 'VERIFIED' }]);
    assert.equal(got.code, 0);
    assert.match(got.said, /人の署名として読める/);
  });

  it('FAIL が 1 件でもあれば止める', () => {
    const got = run1([ok, { no: 2, title: '図が開ける', result: 'FAIL' }]);
    assert.equal(got.code, 1);
    assert.match(got.said, /落ちているケースが 1 件/);
  });

  it('**AUTO_PASS だけの実行は通さない**（誰も見ていない）', () => {
    const got = run1([{ no: 1, title: '窓が出る', result: 'AUTO_PASS' }], { mode: 'auto' });
    assert.equal(got.code, 1);
    assert.match(got.said, /人が見て置いた合格が 1 件も無い/);
  });

  it('AUTO_PASS の件数は、通るときでも必ず出す', () => {
    const got = run1([ok, { no: 2, title: '図が開ける', result: 'AUTO_PASS' }]);
    assert.equal(got.code, 0);
    assert.match(got.said, /AUTO_PASS 1 件/);
  });

  it('シートが後から変わっていれば止める', () => {
    const dir = workspace([run([ok])]);
    writeFileSync(join(dir, 'デスクトップ-検証シート.tsv'), `${SHEET}2\t足した\n`);
    const got = verify(dir);
    rmSync(dir, { recursive: true, force: true });
    assert.equal(got.code, 1);
    assert.match(got.said, /いまの文面に対して置かれたものではない/);
  });

  it('相手が走行中に入れ替わっていれば止める', () => {
    const got = run1([ok], { targetCheck: { state: 'changed', before: 'a1', after: 'b2' } });
    assert.equal(got.code, 1);
    assert.match(got.said, /入れ替わっている/);
  });

  it('測れない相手は、止めないが黙らない', () => {
    const got = run1([ok], { targetCheck: { state: 'unmeasurable', reason: '口が無い' } });
    assert.equal(got.code, 0);
    assert.match(got.said, /測れていない/);
  });

  it('途中で止まった実行は通さない', () => {
    const dir = workspace([{ ...run([ok]), finishedAt: undefined }]);
    const got = verify(dir);
    rmSync(dir, { recursive: true, force: true });
    assert.equal(got.code, 1);
    assert.match(got.said, /途中で止まった実行/);
  });
});

describe('走らせていないとき', () => {
  it('**証跡が無いのは 2**（0 でも 1 でもない）', () => {
    const dir = workspace([]);
    const got = verify(dir);
    rmSync(dir, { recursive: true, force: true });
    assert.equal(got.code, 2);
    assert.match(got.said, /一度も走らせていない/);
  });

  it('ワークスペースでない場所も 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zumen-noqa-'));
    const got = verify(dir);
    rmSync(dir, { recursive: true, force: true });
    assert.equal(got.code, 2);
    assert.match(got.said, /ワークスペースがありません/);
  });

  it('証跡が壊れていれば 1（黙って通さない）', () => {
    const dir = workspace([]);
    mkdirSync(join(dir, 'runs', '20260915-100000'), { recursive: true });
    writeFileSync(join(dir, 'runs', '20260915-100000', 'run.json'), '{壊れている');
    const got = verify(dir);
    rmSync(dir, { recursive: true, force: true });
    assert.equal(got.code, 1);
    assert.match(got.said, /証跡が読めません/);
  });
});

describe('数え方', () => {
  it('AUTO_PASS と SKIP を「人が置いた」に混ぜない', () => {
    const found = inspectRun(
      run([ok, { no: 2, title: 'a', result: 'AUTO_PASS' }, { no: 3, title: 'b', result: 'SKIP' }, { no: 4, title: 'c', result: 'BLOCKED' }]),
      SHEET,
    );
    assert.equal(found.placed, 2); // VERIFIED と BLOCKED
    assert.equal(found.counts.AUTO_PASS, 1);
    assert.equal(found.counts.SKIP, 1);
    assert.equal(found.total, 4);
  });

  it('止める理由は、1 件目で打ち切らずに全部出す', () => {
    const found = inspectRun(run([{ no: 1, title: 'a', result: 'FAIL' }], { finishedAt: undefined }), null);
    assert.equal(found.troubles.length, 4); // FAIL・シート・VERIFIED 0・途中で止まった
    const said = render(found);
    for (const word of ['落ちているケース', 'シート', '1 件も無い', '途中で止まった']) {
      assert.match(said, new RegExp(word));
    }
  });
});
