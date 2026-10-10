/**
 * **変更前と変更後を並べる**（`pnpm compare`。`src/compare.ts`）。
 *
 * 足された節に「新」、消えた節に「消」、人が置いた節に「人」。
 * **人の直しが AI の描き直しのあとも残っている**ことが、YAML を読まずに見える。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compare } from '../src/compare.ts';

const base = (extra = '', pins = '') => `version: 1
kind: placement
nodes:
  - id: web
    label: Web
    at: { x: 0, y: 0 }
    size: { w: 80, h: 40 }
  - id: db
    label: DB
    at: { x: 0, y: 100 }
    size: { w: 80, h: 40 }
${extra}edges:
  - from: web
    to: db
${pins}`;
const PIN = 'pins:\n  db:\n    position: { x: 120, y: 100 }\n';
const CACHE = '  - id: cache\n    label: Cache\n    at: { x: 200, y: 0 }\n    size: { w: 80, h: 40 }\n';

describe('変更前と変更後', () => {
  it('**足された・消えた・人の直しが残った節を数える**', async () => {
    const result = await compare(base('', PIN), base(CACHE, PIN));
    assert.deepEqual(result.added, ['cache']);
    assert.deepEqual(result.removed, []);
    assert.deepEqual(result.kept, ['db']);
  });

  it('**消えた節は変更前の側に出る**', async () => {
    const result = await compare(base(CACHE), base());
    assert.deepEqual(result.removed, ['cache']);
  });

  it('**印は「新」1 つ・「人」2 つ（両側）**', async () => {
    const { svg } = await compare(base('', PIN), base(CACHE, PIN));
    assert.equal(svg.match(/>新</g)?.length, 1);
    assert.equal(svg.match(/>人</g)?.length, 2);
  });

  it('**2 枚を横に並べる**（重ねない）', async () => {
    const { svg } = await compare(base(), base(CACHE));
    const xs = [...svg.matchAll(/<svg x="([\d.]+)" y="/g)].map((m) => Number(m[1]));
    assert.equal(xs.length, 2);
    assert.ok(xs[1]! > xs[0]!);
  });

  it('**人が置いていない節に「人」は付かない**', async () => {
    const { svg, kept } = await compare(base(), base(CACHE));
    assert.deepEqual(kept, []);
    assert.ok(!svg.includes('>人<'));
  });
});
