/**
 * コマンドの口（`pnpm validate`）。
 *
 * **終了コードを間違えると、CI が黙って通る。**
 * 特に「警告だけなら 0」は意図した設計であって手抜きではないので、
 * 逆に倒れていないかをここで押さえる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run, runMergeDriver, runValidate } from '../src/cli.ts';

/** ファイルを読みに行かせない。**テストが実物のファイル配置に縛られないため。** */
function reader(files: Record<string, string>) {
  return (path: string): string => {
    const text = files[path];
    if (text === undefined) throw new Error('ENOENT');
    return text;
  };
}

const GOOD = 'version: 1\nnodes:\n  - id: a\n';
const ORPHAN = 'version: 1\nnodes:\n  - id: a\npins:\n  zzz:\n    label: 手直し\n';
const BROKEN = 'version: 1\nnodes:\n  - id: a\n  - id: a\n';

describe('終了コード', () => {
  it('引数が無ければ 2 で、使い方を出す', () => {
    const result = runValidate([]);
    assert.equal(result.code, 2);
    assert.equal(result.lines.length, 1);
  });

  it('読める図なら 0', () => {
    assert.equal(runValidate(['a.yaml'], reader({ 'a.yaml': GOOD }) as never).code, 0);
  });

  it('**警告だけなら 0。** 迷子は人が解くもので、失敗ではない', () => {
    const result = runValidate(['a.yaml'], reader({ 'a.yaml': ORPHAN }) as never);
    assert.equal(result.code, 0);
  });

  it('読めない図があれば 1', () => {
    assert.equal(runValidate(['a.yaml'], reader({ 'a.yaml': BROKEN }) as never).code, 1);
  });

  it('読めないファイルがあれば 1（黙って 0 で終わらない）', () => {
    assert.equal(runValidate(['無い.yaml'], reader({}) as never).code, 1);
  });
});

describe('出す内容', () => {
  it('迷子は、通したうえで必ず出す（黙って捨てない）', () => {
    const result = runValidate(['a.yaml'], reader({ 'a.yaml': ORPHAN }) as never);
    assert.ok(result.lines.some((line) => line.includes('zzz')));
  });

  it('指摘の無い図は、行を増やさない（読む量を増やさない）', () => {
    const result = runValidate(['a.yaml'], reader({ 'a.yaml': GOOD }) as never);
    assert.equal(result.lines.length, 1);
  });

  it('複数を渡したら、まとめて見る（1 件目で止めない）', () => {
    const files = { 'a.yaml': BROKEN, 'b.yaml': BROKEN };
    const result = runValidate(['a.yaml', 'b.yaml'], reader(files) as never);
    assert.ok(result.lines.some((line) => line.includes('a.yaml')));
    assert.ok(result.lines.some((line) => line.includes('b.yaml')));
  });

  it('どこが悪いかに行番号が付く', () => {
    const result = runValidate(['a.yaml'], reader({ 'a.yaml': BROKEN }) as never);
    assert.ok(result.lines.some((line) => /\b4: /.test(line)));
  });
});

describe('マージドライバ（Git の口）', () => {
  const BASE = 'version: 1\npins: {}\nnodes:\n  - id: a\n    label: A\n';
  const OURS = BASE.replace('pins: {}', 'pins:\n  a:\n    position: { x: 1, y: 1 }');
  const THEIRS = BASE.replace('    label: A\n', '    label: A\n\n  - id: b\n    label: B\n');

  /** 書き込み先を掴まえる。**ours の場所へ書く**のが Git との約束。 */
  function driver(files: Record<string, string>) {
    const written: Record<string, string> = {};
    const result = runMergeDriver(
      ['base', 'ours', 'theirs'],
      ((path: string) => {
        const text = files[path];
        if (text === undefined) throw new Error('ENOENT');
        return text;
      }) as never,
      ((path: string, text: string) => {
        written[path] = text;
      }) as never,
    );
    return { result, written };
  }

  it('引数が 3 つ無ければ 2', () => {
    assert.equal(runMergeDriver(['base']).code, 2);
  });

  it('解けたら 0 で、結果を ours の場所へ書く', () => {
    const { result, written } = driver({ base: BASE, ours: OURS, theirs: THEIRS });
    assert.equal(result.code, 0);
    assert.ok(written['ours']?.includes('id: b'));
    assert.ok(written['ours']?.includes('x: 1'));
  });

  it('**解けなければ 1。** 失敗ではなく、Git への「人が見る」合図', () => {
    const theirs = BASE.replace('pins: {}', 'pins:\n  a:\n    position: { x: 9, y: 9 }');
    const { result, written } = driver({ base: BASE, ours: OURS, theirs });
    assert.equal(result.code, 1);
    // 印を付けたうえで書く。**書かずに終えると、Git は ours のままだと思い込む。**
    assert.match(written['ours'] ?? '', /<<<<<<< ours/);
  });

  it('読めないファイルなら 1 で、**書き換えない**（黙って壊さない）', () => {
    const { result, written } = driver({ base: BASE, ours: OURS });
    assert.equal(result.code, 1);
    assert.equal(written['ours'], undefined);
  });
});

describe('命令の振り分け', () => {
  it('知らない命令なら 2 で、使い方を出す', async () => {
    const result = await run(['zzz']);
    assert.equal(result.code, 2);
    assert.ok(result.lines.length >= 2);
  });

  it('命令が無ければ 2 で、使い方を全部出す', async () => {
    const result = await run([]);
    assert.equal(result.code, 2);
    assert.equal(result.lines.length, 3);
  });
});
