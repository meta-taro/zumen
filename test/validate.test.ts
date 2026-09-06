/**
 * 形式の検証器（Issue 014 / 仕様 §8）。
 *
 * ここで守りたいのは 2 つ。
 *
 * 1. **正しい図を誤って弾かない。** リポジトリにある図すべてを通す。
 *    ここが壊れると、検証器を入れたせいで作業が止まる
 * 2. **迷子の pin を失敗にしない。** 迷子は人が競合として解くものであって、
 *    文書の壊れではない（仕様 §3.4 の規則 3）。
 *    ここを error にすると、id が改名された図が CI で落ちるだけになり、
 *    **人が解く経路を潰す**
 *
 * 文面は見ない（`code` で判定する）。**人が文言を直してもここは落ちない。**
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { parseDocument } from 'yaml';

import { hasError, validate } from '../src/validate.ts';
import type { Finding } from '../src/validate.ts';

const ROOT = new URL('../', import.meta.url).pathname;
const R0 = readFileSync(join(ROOT, 'test/fixtures/r0.zumen.yaml'), 'utf8');

/** 出た指摘の `code` だけを見る。 */
const codes = (findings: Finding[]): string[] => findings.map((finding) => finding.code);

/** リポジトリにある図をすべて集める。**増えたら自動で対象に入る。** */
function everyDocument(): string[] {
  const dirs = [
    'test/fixtures',
    'experiments/s1/results',
    'experiments/s1/fixtures',
    'experiments/d2/fixtures',
  ];
  return dirs.flatMap((dir) =>
    readdirSync(join(ROOT, dir))
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => join(dir, name)),
  );
}

describe('正しい図を弾かない', () => {
  const documents = everyDocument();

  it('対象の図が集まっている（探し先を間違えていない）', () => {
    assert.ok(documents.length >= 10, `見つかったのは ${documents.length} 件`);
  });

  for (const path of documents) {
    it(`${path} は error なしで通る`, () => {
      const findings = validate(readFileSync(join(ROOT, path), 'utf8'));
      assert.deepEqual(
        findings.filter((finding) => finding.severity === 'error'),
        [],
      );
    });
  }
});

describe('読めない文書は止める', () => {
  it('version が無い', () => {
    assert.ok(codes(validate('nodes:\n  - id: a\n')).includes('version-missing'));
  });

  it('version が 1 でない', () => {
    const findings = validate('version: 2\nnodes:\n  - id: a\n');
    assert.ok(codes(findings).includes('version-unsupported'));
    assert.ok(hasError(findings));
  });

  it('nodes が無い', () => {
    assert.ok(codes(validate('version: 1\ntitle: 図\n')).includes('nodes-missing'));
  });

  it('nodes が並びになっていない', () => {
    assert.ok(codes(validate('version: 1\nnodes:\n  a: b\n')).includes('nodes-not-sequence'));
  });

  it('id が無いノードがある', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n  - label: 名前だけ\n');
    assert.ok(codes(findings).includes('node-id-missing'));
  });

  it('id が重複している', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n  - id: a\n');
    assert.ok(codes(findings).includes('node-id-duplicated'));
  });

  it('エッジが実在しないノードを指している', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\nedges:\n  - from: a\n    to: zzz\n');
    assert.ok(codes(findings).includes('edge-endpoint-unknown'));
    assert.ok(hasError(findings));
  });

  it('エッジに from か to が無い', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\nedges:\n  - from: a\n');
    assert.ok(codes(findings).includes('edge-endpoint-missing'));
  });

  it('構文が壊れていれば、そこで止める（見当違いの指摘を並べない）', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n   bad indent\n');
    assert.deepEqual(codes(findings), ['syntax']);
  });

  it('最上位が写像でない', () => {
    assert.ok(codes(validate('- a\n- b\n')).includes('not-mapping'));
  });
});

describe('行番号が出る（「不正です」で終わらせない）', () => {
  it('重複した id の行を指す', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n  - id: b\n  - id: a\n');
    const duplicated = findings.find((finding) => finding.code === 'node-id-duplicated');
    assert.equal(duplicated?.line, 5);
  });

  it('構文誤りの行を指す', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n   bad indent\n');
    assert.equal(findings[0]?.line, 4);
  });
});

describe('迷子の pin は警告であって失敗ではない（仕様 §3.4 の規則 3）', () => {
  const orphan = 'version: 1\nnodes:\n  - id: a\npins:\n  zzz:\n    label: 手直し\n';

  it('迷子として見つかる', () => {
    assert.ok(codes(validate(orphan)).includes('pin-orphan'));
  });

  it('**失敗にしない。** 人が競合として解くもので、文書の壊れではない', () => {
    assert.equal(hasError(validate(orphan)), false);
  });

  it('黙って捨てない（指摘として必ず出る）', () => {
    const findings = validate(orphan);
    assert.equal(findings.filter((finding) => finding.code === 'pin-orphan').length, 1);
  });

  it('エッジの pin も、その組が無ければ迷子になる', () => {
    const text = 'version: 1\nnodes:\n  - id: a\n  - id: b\npins:\n  a>b:\n    waypoints: []\n';
    assert.ok(codes(validate(text)).includes('pin-orphan'));
  });

  it('実在するエッジの pin は迷子にしない', () => {
    const text =
      'version: 1\nnodes:\n  - id: a\n  - id: b\nedges:\n  - from: a\n    to: b\npins:\n  a>b:\n    waypoints: []\n';
    assert.equal(codes(validate(text)).includes('pin-orphan'), false);
  });
});

describe('知らないものを弾かない（v1 の規則。仕様 §9）', () => {
  it('知らないキーは通す', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n    未知のキー: 値\n');
    assert.deepEqual(findings, []);
  });

  it('知らない体裁の語は、通したうえで知らせる', () => {
    const text = 'version: 1\nnodes:\n  - id: a\npins:\n  a:\n    appearance: 派手\n';
    const findings = validate(text);
    assert.ok(codes(findings).includes('appearance-unknown'));
    assert.equal(hasError(findings), false);
  });

  it('v1 が定めた体裁の語では何も出ない', () => {
    const text = 'version: 1\nnodes:\n  - id: a\npins:\n  a:\n    appearance: primary\n';
    assert.deepEqual(validate(text), []);
  });

  it('実在しない group を指していても、描けるので警告に留める', () => {
    const findings = validate('version: 1\nnodes:\n  - id: a\n    group: zzz\n');
    assert.ok(codes(findings).includes('node-group-unknown'));
    assert.equal(hasError(findings), false);
  });
});

describe('書き戻しで行が変わらない（仕様 §6.1）', () => {
  it('コメントと空行を持つ図が、そのまま書き戻る', () => {
    assert.equal(codes(validate(R0)).includes('round-trip-changed'), false);
  });

  it('検査そのものが働いている（空回りしていない）', () => {
    // 折り返しが起きる長い行。**行が変わったら検出できなければならない。**
    const long = `version: 1\nnodes:\n  - id: a\n    label: ${'あ'.repeat(200)}\n`;
    const findings = validate(long);
    const changed = codes(findings).includes('round-trip-changed');
    // 変わらないならそれでよい。変わったなら必ず指摘に出ていること。
    assert.equal(changed, long !== rewrite(long));
  });
});

/** 検証器と同じ手順で書き戻す。**検査が本当に差を見ているか**を確かめるために使う。 */
function rewrite(text: string): string {
  return parseDocument(text).toString({ lineWidth: 0 });
}
