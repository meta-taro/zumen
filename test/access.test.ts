/**
 * **部屋へ、通り道から入れるか**（`src/access.ts`）。
 *
 * 2026-10-04。見本の見直しで、間取り 8 枚の動線が壊れていた
 * （便所へ居間を横切る、寝室へ浴室や収納を通る）。どの検査も 0 のままだった。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { inspect } from '../src/tools.ts';

const plan = (wcSide: string): string =>
  `version: 1\nkind: placement\nnodes:\n` +
  `  - id: hall\n    label: 廊下\n    at: { x: 0, y: 0 }\n    size: { w: 300, h: 60 }\n` +
  `  - id: ldk\n    label: LDK\n    at: { x: 0, y: 60 }\n    size: { w: 200, h: 160 }\n    openings:\n      - { kind: door, side: top, at: 0.5, width: 40 }\n` +
  `  - id: wc\n    label: WC\n    at: { x: 200, y: 60 }\n    size: { w: 100, h: 80 }\n    openings:\n      - { kind: door, side: ${wcSide}, at: 0.5, width: 30 }\n`;

describe('部屋へ、通り道から入れるか（roomAccess）', () => {
  it('**便所の扉が居間に開いていたら拾う**', async () => {
    const seen = await inspect(plan('left'));
    assert.deepEqual(seen.roomAccess.map(([id]) => id), ['wc']);
  });

  it('**便所の扉が廊下に開いていれば拾わない**', async () => {
    const seen = await inspect(plan('top'));
    assert.deepEqual(seen.roomAccess, []);
  });

  it('**見本の間取りは、どの部屋にも通り道から入れる**', async () => {
    const dir = new URL('../examples/gallery/', import.meta.url);
    const broken: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const seen = await inspect(readFileSync(new URL(file, dir), 'utf8'));
      for (const [id, why] of seen.roomAccess) broken.push(`${file}: ${id}（${why}）`);
    }
    assert.deepEqual(broken, [], '通り道から入れない部屋がある');
  });
});
