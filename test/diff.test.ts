/**
 * 行の差分（D11 の操作 6）。
 *
 * **適用前に見せるためのもの。** 事後報告にしないための道具なので、
 * 「何が変わったか」を取りこぼさないことがすべて。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { condense, diffLines, hasChange } from '../src/diff.ts';

const kinds = (before: string, after: string): string =>
  diffLines(before, after)
    .map((line) => ({ same: '=', added: '+', removed: '-' })[line.kind])
    .join('');

describe('何が変わったかを取りこぼさない', () => {
  it('同じなら全部 same', () => {
    assert.equal(kinds('a\nb', 'a\nb'), '==');
    assert.equal(hasChange(diffLines('a\nb', 'a\nb')), false);
  });

  it('足した行が出る', () => {
    assert.equal(kinds('a\nb', 'a\nx\nb'), '=+=');
  });

  it('消した行が出る', () => {
    assert.equal(kinds('a\nx\nb', 'a\nb'), '=-=');
  });

  it('直した行は、消して足したものとして出る（git と同じ並び）', () => {
    assert.equal(kinds('a\nb', 'a\nc'), '=-+');
  });

  it('全部入れ替わっても取りこぼさない', () => {
    assert.equal(kinds('a\nb', 'x\ny'), '--++');
  });

  it('空との差分', () => {
    assert.equal(hasChange(diffLines('', 'a')), true);
    assert.equal(hasChange(diffLines('a', '')), true);
  });
});

describe('行番号が付く（どこの話かが分かる）', () => {
  it('残った行は前後どちらの番号も持つ', () => {
    const lines = diffLines('a\nb', 'a\nx\nb');
    const last = lines[lines.length - 1]!;
    assert.equal(last.before, 2);
    assert.equal(last.after, 3);
  });

  it('足した行は「後」の番号だけ', () => {
    const added = diffLines('a\nb', 'a\nx\nb').find((line) => line.kind === 'added')!;
    assert.equal(added.before, undefined);
    assert.equal(added.after, 2);
  });

  it('消した行は「前」の番号だけ', () => {
    const removed = diffLines('a\nx\nb', 'a\nb').find((line) => line.kind === 'removed')!;
    assert.equal(removed.before, 2);
    assert.equal(removed.after, undefined);
  });
});

describe('変わったところの周りだけ残す', () => {
  const before = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
  const after = before.replace('line 20', 'line 20 直した');

  it('全文より短くなる', () => {
    const all = diffLines(before, after);
    assert.ok(condense(all).length < all.length);
  });

  it('**変わった行は必ず残る**', () => {
    const kept = condense(diffLines(before, after));
    assert.ok(kept.some((line) => line.kind === 'removed' && line.text === 'line 20'));
    assert.ok(kept.some((line) => line.kind === 'added' && line.text === 'line 20 直した'));
  });

  it('前後の行も残る（どこの話か分かるように）', () => {
    const kept = condense(diffLines(before, after), 2);
    assert.ok(kept.some((line) => line.text === 'line 18'));
    assert.ok(kept.some((line) => line.text === 'line 22'));
  });

  it('変わっていなければ何も残さない（読む量を増やさない）', () => {
    assert.deepEqual(condense(diffLines(before, before)), []);
  });
});

describe('正本の差分として使える', () => {
  it('pins の 1 行追加が、その行だけの差分になる', () => {
    const before = 'version: 1\npins: {}\nnodes:\n  - id: a\n';
    const after = 'version: 1\npins:\n  a:\n    position: { x: 1, y: 2 }\nnodes:\n  - id: a\n';
    const changed = diffLines(before, after).filter((line) => line.kind !== 'same');
    // nodes の行は触っていないので、差分に出ない。
    assert.equal(changed.some((line) => line.text.includes('- id: a')), false);
  });
});
