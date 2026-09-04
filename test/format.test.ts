/**
 * S1 暫定形式の読み書き。
 *
 * ここで測るのは「人が書いたものが、機械が触っても残るか」の下地。
 * コメントとキー順が保存で壊れると、判定基準の Tier B（原案 §26 の 9）が落ちる。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { DiagramSyntaxError, getPins, parse, serialize, setPin } from '../src/format.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

describe('parse', () => {
  it('ノード・エッジ・グループを読む', () => {
    const doc = parse(R0);
    assert.deepEqual(doc.nodeIds(), [
      'internet',
      'lb',
      'web01',
      'web02',
      'monitor',
      'db',
      'replica',
      'backup',
    ]);
    assert.equal(doc.edges().length, 8);
    assert.deepEqual(doc.groupIds(), ['vpc']);
  });

  it('pin が無い図では pin は空', () => {
    assert.deepEqual(getPins(parse(R0)), {});
  });
});

describe('壊れた正本', () => {
  it('読めない YAML は、その場で止める', () => {
    // 黙って受け取ると、あとで見当違いの理由（レイアウトエンジンの内部エラー）が
    // 人へ出る。書いた人が直せる形で止める。
    assert.throws(
      () => parse('version: 1\nnodes:\n  - id: a\n   bad indent'),
      DiagramSyntaxError,
    );
  });

  it('止めるときに行番号を出す', () => {
    try {
      parse('version: 1\nnodes:\n  - id: a\n   bad indent');
      assert.fail('例外が投げられなかった');
    } catch (error) {
      assert.ok(error instanceof DiagramSyntaxError);
      assert.equal(error.line, 4);
      assert.match(error.message, /^4 行目: /);
    }
  });

  it('空の文書は壊れていない', () => {
    // 打ち始めの状態。誤りではない。
    assert.doesNotThrow(() => parse(''));
  });
});

describe('serialize', () => {
  it('読んで書き戻すと 1 文字も変わらない', () => {
    // ここが崩れると、人が触っていない行にまで差分が出て git diff が読めなくなる。
    assert.equal(serialize(parse(R0)), R0);
  });
});

describe('setPin', () => {
  it('pin を足しても、人が書いたコメントが残る', () => {
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    const out = serialize(doc);
    assert.match(out, /# 監視は本番と同じ VPC に置く。外へ出すと踏み台が要る。/);
    assert.match(out, /# 人が直した分。AI はこの節を書かない。/);
  });

  it('pin を足しても、ノードの並び順が変わらない', () => {
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    assert.deepEqual(parse(serialize(doc)).nodeIds(), parse(R0).nodeIds());
  });

  it('足した pin は読み戻せる', () => {
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    assert.deepEqual(getPins(parse(serialize(doc))), {
      db: { position: { x: 620, y: 410 } },
    });
  });

  it('pin を足しても、ノード定義の本文はそのまま残る', () => {
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    assert.match(
      serialize(doc),
      /- id: replica\n {4}type: database\n {4}label: MariaDB Replica\n {4}group: vpc/,
    );
  });
});
