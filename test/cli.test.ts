/**
 * コマンドの口（`pnpm validate`）。
 *
 * **終了コードを間違えると、CI が黙って通る。**
 * 特に「警告だけなら 0」は意図した設計であって手抜きではないので、
 * 逆に倒れていないかをここで押さえる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { runValidate } from '../src/cli.ts';

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
