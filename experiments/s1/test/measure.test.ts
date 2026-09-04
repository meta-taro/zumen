/**
 * 測り方そのものを測る。
 *
 * ここが甘いと、壊れているのに「保持された」と出る。**測定器を先に固定する。**
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { deletePin, parse, serialize, setPin } from '../src/format.ts';
import { measure } from '../src/measure.ts';

const R0 = readFileSync(new URL('../fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

function pinned(): string {
  const doc = parse(R0);
  setPin(doc, 'db', { position: { x: 620, y: 410 }, size: { w: 240, h: 96 } });
  setPin(doc, 'web01>db', { waypoints: [{ x: 10, y: 20 }] });
  return serialize(doc);
}

describe('保持の数え方', () => {
  it('同じものが残っていれば分子と分母が一致する', () => {
    const before = pinned();
    const result = measure(before, before, []);
    assert.deepEqual(result.tierA, { kept: 2, total: 2, lost: [] });
    assert.equal(result.tierB.lost, result.tierB.lost); // 参照を固定するだけ
    assert.deepEqual(result.tierB.lost, []);
  });

  it('pin が消えたら失われたと数え、どれが失われたかを名指しする', () => {
    const before = pinned();
    const doc = parse(before);
    deletePin(doc, 'db');
    const result = measure(before, serialize(doc), []);
    assert.deepEqual(result.tierA, { kept: 0, total: 2, lost: ['db.position', 'db.size'] });
  });

  it('近い値は「残っている」と数えない', () => {
    // 620 が 619.7 で返るのは、人が置いた場所ではない（判定基準 3.1）。
    const before = pinned();
    const doc = parse(before);
    setPin(doc, 'db', { position: { x: 619.7, y: 410 }, size: { w: 240, h: 96 } });
    const result = measure(before, serialize(doc), []);
    assert.deepEqual(result.tierA.lost, ['db.position']);
  });

  it('コメントが消えたら Tier B の欠落として名指しする', () => {
    const before = pinned();
    const after = before.replace('# 監視は本番と同じ VPC に置く。外へ出すと踏み台が要る。\n', '');
    const result = measure(before, after, []);
    assert.equal(
      result.tierB.lost.some((l) => l.includes('監視は本番と同じ VPC')),
      true,
    );
  });

  it('ノードの並びが入れ替わったら Tier B の欠落として出す', () => {
    const before = pinned();
    const doc = parse(before);
    const nodes = doc.doc.get('nodes', true) as { items: unknown[] };
    nodes.items.reverse();
    const result = measure(before, serialize(doc), []);
    assert.equal(result.tierB.lost.includes('node order'), true);
  });

  it('グループから出されたら Tier B の欠落として出す', () => {
    const before = pinned();
    const doc = parse(before);
    const nodes = doc.doc.get('nodes', true) as {
      items: { get(k: string): unknown; delete(k: string): void }[];
    };
    nodes.items.find((n) => n.get('id') === 'db')!.delete('group');
    const result = measure(before, serialize(doc), []);
    assert.equal(result.tierB.lost.includes('db.group'), true);
  });
});

describe('反映の数え方', () => {
  it('起きるはずのことが起きていれば applied に入る', () => {
    const before = pinned();
    const doc = parse(before);
    const nodes = doc.doc.get('nodes', true) as { items: unknown[] };
    nodes.items.push(doc.doc.createNode({ id: 'redis', type: 'cache', label: 'Redis' }));
    const result = measure(before, serialize(doc), [{ kind: 'node-added', id: 'redis' }]);
    assert.deepEqual(result.reflection, { expected: 1, applied: 1, missing: [] });
  });

  it('起きていなければ、何が起きていないかを日本語で出す', () => {
    const before = pinned();
    const result = measure(before, before, [
      { kind: 'node-added', id: 'redis' },
      { kind: 'edge-added', from: 'web01', to: 'redis' },
    ]);
    assert.deepEqual(result.reflection, {
      expected: 2,
      applied: 0,
      missing: ['ノード redis が増える', '線 web01>redis が増える'],
    });
  });

  it('保持と反映は必ず両方返る', () => {
    // 片方だけ見ると、全部固定して保持 100%・反映 0% が「成功」に見える。
    const result = measure(pinned(), pinned(), [{ kind: 'node-added', id: 'redis' }]);
    assert.equal(result.tierA.total > 0, true);
    assert.equal(result.reflection.expected > 0, true);
  });
});
