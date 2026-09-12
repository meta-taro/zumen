/**
 * **AI が書く場所を、検証器が見ていなかった。**
 *
 * `at` / `size` / `openings` / `tag` / `kind` / `direction` / `wrap` は
 * どれも AI が書いてよいものだが、検証器は 1 つも見ていなかった。
 *
 * 読めない文書になるわけではない（描画側が黙って無視する）ので `error` にはしない。
 * **`warning` で知らせる。**
 *
 * 黙って無視すると、AI は「書いたのに効かない」理由が分からないまま、
 * 同じ間違いを書き続ける。**人も、図を見るまで気づけない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { hasError, validate } from '../src/validate.ts';

/** 指摘の印だけを拾う。**文言が変わっても、これは変わらない。** */
function codes(text: string): string[] {
  return validate(text).map((finding) => finding.code);
}

const PLACEMENT = 'version: 1\nkind: placement\nnodes:\n';

describe('置き場所（at）を見る', () => {
  it('数で書いた at は通る', () => {
    assert.deepEqual(codes(`${PLACEMENT}  - id: a\n    at: { x: 10, y: 20 }\n`), []);
  });

  it('**数でない at を知らせる。** 黙って無視すると「書いたのに効かない」', () => {
    assert.ok(codes(`${PLACEMENT}  - id: a\n    at: { x: "ひだり", y: 20 }\n`).includes('node-at-invalid'));
  });

  it('x か y が欠けていたら知らせる', () => {
    assert.ok(codes(`${PLACEMENT}  - id: a\n    at: { x: 10 }\n`).includes('node-at-invalid'));
  });

  it('**構成図に at を書いても効かないことを知らせる**', () => {
    const out = codes('version: 1\nnodes:\n  - id: a\n    at: { x: 10, y: 20 }\n');
    assert.ok(out.includes('node-at-ignored'), '構成図の at が黙って無視されている');
  });

  it('at の指摘は warning。**読めない文書ではない**', () => {
    assert.equal(hasError(validate(`${PLACEMENT}  - id: a\n    at: { x: "あ", y: 1 }\n`)), false);
  });
});

describe('大きさ（size）を見る', () => {
  it('数で書いた size は通る', () => {
    assert.deepEqual(codes('version: 1\nnodes:\n  - id: a\n    size: { w: 200, h: 80 }\n'), []);
  });

  it('0 以下の大きさを知らせる（描くと潰れる）', () => {
    assert.ok(codes('version: 1\nnodes:\n  - id: a\n    size: { w: 0, h: 80 }\n').includes('node-size-invalid'));
  });

  it('数でない大きさを知らせる', () => {
    assert.ok(codes('version: 1\nnodes:\n  - id: a\n    size: { w: 大, h: 80 }\n').includes('node-size-invalid'));
  });
});

describe('建具（openings）を見る', () => {
  it('決まった語で書いた建具は通る', () => {
    assert.deepEqual(
      codes(`${PLACEMENT}  - id: a\n    openings:\n      - { kind: door, side: top }\n`),
      [],
    );
  });

  it('**知らない建具の種類を知らせる。** 描かれずに消える', () => {
    const out = codes(`${PLACEMENT}  - id: a\n    openings:\n      - { kind: toilet, side: top }\n`);
    assert.ok(out.includes('opening-kind-unknown'));
  });

  it('知らない辺を知らせる', () => {
    const out = codes(`${PLACEMENT}  - id: a\n    openings:\n      - { kind: door, side: naka }\n`);
    assert.ok(out.includes('opening-side-unknown'));
  });

  it('**構成図に建具を書いても効かないことを知らせる**', () => {
    const out = codes('version: 1\nnodes:\n  - id: a\n    openings:\n      - { kind: door, side: top }\n');
    assert.ok(out.includes('opening-ignored'));
  });
});

describe('図ぜんたいの宣言を見る', () => {
  it('決まった語なら通る', () => {
    assert.deepEqual(codes('version: 1\nkind: placement\ndirection: down\nwrap: true\nnodes:\n  - id: a\n'), []);
  });

  it('知らない kind を知らせる（構成図として描かれる）', () => {
    assert.ok(codes('version: 1\nkind: madori\nnodes:\n  - id: a\n').includes('kind-unknown'));
  });

  it('知らない direction を知らせる', () => {
    assert.ok(codes('version: 1\ndirection: naname\nnodes:\n  - id: a\n').includes('direction-unknown'));
  });

  it('**真偽でない wrap を知らせる。** `wrap: "true"` は折り返さない', () => {
    assert.ok(codes('version: 1\nwrap: "true"\nnodes:\n  - id: a\n').includes('wrap-not-boolean'));
  });
});

describe('見本 23 件は、指摘 0 件のまま', () => {
  it('既にある図を、新しい検査が落とさない', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith('.zumen.yaml'));
    assert.ok(files.length >= 23, `見本が ${files.length} 件しかない`);
    for (const name of files) {
      const found = validate(readFileSync(new URL(name, dir), 'utf8'));
      assert.deepEqual(found, [], `${name}: ${found.map((f) => f.code + ' ' + f.message).join(' / ')}`);
    }
  });
});
