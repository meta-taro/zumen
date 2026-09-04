/**
 * S1 の中身。**AI の出力を新しい正本にしない**という一点を測る。
 *
 * AI が出すのは提案（semantics だけ）で、正本は人が持っているものを書き換える。
 * この向きにしないと、AI が丸ごと書き直した時点で人の手直しもコメントも消える。
 *
 * 判定基準（docs/specs/s1-判定基準-手直しの保持.md）の 3 軸に沿って並べる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { getPins, parse, serialize, setPin } from '../src/format.ts';
import { merge, resolve } from '../src/merge.ts';

const R0 = readFileSync(new URL('../fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

/** 人が db を手で動かした状態を作る。 */
function withHumanEdit(text: string): string {
  const doc = parse(text);
  setPin(doc, 'db', { position: { x: 620, y: 410 } });
  return serialize(doc);
}

/** AI の提案。semantics だけを書く（position は書かない）。 */
function proposalAdding(redis: boolean): string {
  const doc = parse(R0);
  const nodes = doc.doc.get('nodes', true) as { items: unknown[] };
  if (redis) {
    nodes.items.push(
      doc.doc.createNode({ id: 'redis', type: 'cache', label: 'Redis', group: 'vpc' }),
    );
    const edges = doc.doc.get('edges', true) as { items: unknown[] };
    edges.items.push(doc.doc.createNode({ from: 'web01', to: 'redis' }));
  }
  return serialize(doc);
}

describe('保持 — 人が直したものが残るか', () => {
  it('AI が構成を足しても pin が残る', () => {
    const current = withHumanEdit(R0);
    const result = merge(current, proposalAdding(true));
    assert.deepEqual(getPins(parse(result.text)), {
      db: { position: { x: 620, y: 410 } },
    });
  });

  it('AI が構成を足しても、人が書いたコメントが残る', () => {
    const result = merge(withHumanEdit(R0), proposalAdding(true));
    assert.match(result.text, /# 監視は本番と同じ VPC に置く。外へ出すと踏み台が要る。/);
  });

  it('触っていないノードの定義は 1 文字も変わらない', () => {
    const result = merge(withHumanEdit(R0), proposalAdding(true));
    assert.match(
      result.text,
      /- id: replica\n {4}type: database\n {4}label: MariaDB Replica\n {4}group: vpc/,
    );
  });

  it('提案は pin を持たない。AI が pin を書いても採らない', () => {
    // AI が勝手に pins を書いてきても、人の指定を上書きさせない。
    const rogue = parse(proposalAdding(false));
    setPin(rogue, 'db', { position: { x: 0, y: 0 } });
    const result = merge(withHumanEdit(R0), serialize(rogue));
    assert.deepEqual(getPins(parse(result.text)), {
      db: { position: { x: 620, y: 410 } },
    });
  });
});

describe('反映 — AI に頼んだ変更が入るか', () => {
  it('足したノードとエッジが入る', () => {
    const result = merge(withHumanEdit(R0), proposalAdding(true));
    const doc = parse(result.text);
    assert.ok(doc.nodeIds().includes('redis'));
    assert.ok(doc.edges().some((e) => e.from === 'web01' && e.to === 'redis'));
  });

  it('足したノードは末尾に付く（既存の並びを崩さない）', () => {
    const result = merge(withHumanEdit(R0), proposalAdding(true));
    assert.deepEqual(parse(result.text).nodeIds().at(-1), 'redis');
  });

  it('消したノードは消える。ぶら下がったエッジも消える', () => {
    const proposal = parse(R0);
    removeNode(proposal, 'backup');
    const result = merge(withHumanEdit(R0), serialize(proposal));
    const doc = parse(result.text);
    assert.ok(!doc.nodeIds().includes('backup'));
    assert.ok(!doc.edges().some((e) => e.to === 'backup'));
  });

  it('ラベルの変更が入る', () => {
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'label', 'PostgreSQL');
    const result = merge(withHumanEdit(R0), serialize(proposal));
    assert.match(result.text, /- id: db\n {4}type: database\n {4}label: PostgreSQL/);
  });
});

describe('競合 — 人の指定と AI の変更がぶつかったとき', () => {
  it('検出 — pin を持つノードを AI が消したら、黙って消さずに競合として出す', () => {
    const proposal = parse(R0);
    removeNode(proposal, 'db');
    const result = merge(withHumanEdit(R0), serialize(proposal));
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', nodeId: 'db', reason: 'removed' }]);
  });

  it('検出 — AI が pin 付きノードに位置を書いてきたら競合として出す', () => {
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'position', { x: 100, y: 900 });
    const result = merge(withHumanEdit(R0), serialize(proposal));
    assert.deepEqual(result.conflicts, [
      {
        kind: 'position-proposed',
        nodeId: 'db',
        human: { x: 620, y: 410 },
        ai: { x: 100, y: 900 },
      },
    ]);
  });

  it('黙って上書きしない — 競合が解かれるまで人の値のまま', () => {
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'position', { x: 100, y: 900 });
    const result = merge(withHumanEdit(R0), serialize(proposal));
    assert.deepEqual(getPins(parse(result.text)).db?.position, { x: 620, y: 410 });
  });

  it('選択 — AI を採ると、AI の位置が新しい pin になる', () => {
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'position', { x: 100, y: 900 });
    const result = merge(withHumanEdit(R0), serialize(proposal));
    const after = resolve(result.text, result.conflicts[0]!, 'ai');
    assert.deepEqual(getPins(parse(after)).db?.position, { x: 100, y: 900 });
  });

  it('選択 — 人を採ると、人の位置が残る', () => {
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'position', { x: 100, y: 900 });
    const result = merge(withHumanEdit(R0), serialize(proposal));
    const after = resolve(result.text, result.conflicts[0]!, 'human');
    assert.deepEqual(getPins(parse(after)).db?.position, { x: 620, y: 410 });
  });

  it('持続 — 人を採った後は、同じ提案が来ても二度と聞かれない', () => {
    // 毎回聞かれるのは「選べた」ことにならない（判定基準 3.3 の 3）。
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'position', { x: 100, y: 900 });
    const first = merge(withHumanEdit(R0), serialize(proposal));
    const decided = resolve(first.text, first.conflicts[0]!, 'human');

    const second = merge(decided, serialize(proposal));
    assert.deepEqual(second.conflicts, [
      { kind: 'position-suppressed', nodeId: 'db', ai: { x: 100, y: 900 } },
    ]);
    assert.deepEqual(getPins(parse(second.text)).db?.position, { x: 620, y: 410 });
  });

  it('持続 — 人を採った決定は正本に書かれている（次のセッションでも残る）', () => {
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'position', { x: 100, y: 900 });
    const first = merge(withHumanEdit(R0), serialize(proposal));
    const decided = resolve(first.text, first.conflicts[0]!, 'human');
    assert.equal(getPins(parse(decided)).db?.locked, true);
  });

  it('検出 — AI がノード id を書き換えたら、pin の迷子を競合として出す', () => {
    // ここが最大の弱点。id が変わると人の指定は誰にも紐づかなくなる。
    const proposal = parse(R0);
    setNodeField(proposal, 'db', 'id', 'maindb');
    const result = merge(withHumanEdit(R0), serialize(proposal));
    assert.deepEqual(result.conflicts, [{ kind: 'pin-orphaned', nodeId: 'db', reason: 'removed' }]);
  });
});

// --- テスト用の小道具 ------------------------------------------------------

function removeNode(diagram: ReturnType<typeof parse>, id: string): void {
  const nodes = diagram.doc.get('nodes', true) as { items: { get(k: string): unknown }[] };
  nodes.items = nodes.items.filter((item) => item.get('id') !== id);
  const edges = diagram.doc.get('edges', true) as { items: { get(k: string): unknown }[] };
  edges.items = edges.items.filter((item) => item.get('from') !== id && item.get('to') !== id);
}

function setNodeField(
  diagram: ReturnType<typeof parse>,
  id: string,
  key: string,
  value: unknown,
): void {
  const nodes = diagram.doc.get('nodes', true) as {
    items: { get(k: string): unknown; set(k: string, v: unknown): void }[];
  };
  const target = nodes.items.find((item) => item.get('id') === id);
  if (target === undefined) throw new Error(`node not found: ${id}`);
  target.set(key, diagram.doc.createNode(value));
}
