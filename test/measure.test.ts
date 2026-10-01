/**
 * 「9 割」の測り方（Issue 003 / D3）。
 *
 * **悪化しない指標は、この企画では役に立たない。**
 * ここでいちばん大事なのは「人が図形を手で並べ直し始めたら数字が下がる」ことで、
 * それが確かめられなければ、この指標は飾りになる。
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { runMeasure } from '../src/cli.ts';
import { parse, serialize, setPin } from '../src/format.ts';
import { PASS_LINE, measure, percent } from '../src/measure.ts';

const ROOT = new URL('../', import.meta.url).pathname;
const FIXTURES = join(ROOT, 'experiments/s3/fixtures');

function base(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

const ZUMEN = base('zumen-modules.zumen.yaml');

/** ノードを n 個だけ手で置く。 */
function place(text: string, count: number): string {
  const doc = parse(text);
  for (const id of doc.nodeIds().slice(0, count)) {
    setPin(doc, id, { position: { x: 10, y: 10 } });
  }
  return serialize(doc);
}

describe('基準の図が揃っている', () => {
  it('実在の構成から起こした図が 2 枚ある', () => {
    const files = readdirSync(FIXTURES).filter((name) => name.endsWith('.yaml'));
    assert.ok(files.length >= 2, `見つかったのは ${files.length} 件`);
  });

  it('手直し前は 100%（出発点であって成績ではない）', () => {
    const result = measure(ZUMEN);
    assert.equal(result.touched, 0);
    assert.equal(result.autonomy, 1);
  });
});

describe('**人が並べ直し始めたら悪化する**', () => {
  it('置くほど下がる（単調）', () => {
    const values = [0, 1, 3, 6].map((n) => measure(place(ZUMEN, n)).layoutAutonomy);
    for (let i = 1; i < values.length; i += 1) {
      assert.ok(values[i]! < values[i - 1]!, `${i} 番目で下がっていない`);
    }
  });

  it('全部を手で置いたら、合格ラインを割る', () => {
    const all = measure(place(ZUMEN, 99));
    assert.equal(all.pass, false);
    assert.ok(all.layoutAutonomy < PASS_LINE);
  });

  it('1 か所だけの手直しでは落ちない（1 割は許されている）', () => {
    assert.equal(measure(place(ZUMEN, 1)).pass, true);
  });
});

describe('配置の手直しと、中身の手直しを分ける', () => {
  it('ラベルの直しは「手直し」に入るが「配置の手直し」には入らない', () => {
    const doc = parse(ZUMEN);
    setPin(doc, 'format', { label: '書式' });
    const result = measure(serialize(doc));
    assert.equal(result.touched, 1);
    assert.equal(result.placed, 0);
    assert.equal(result.layoutAutonomy, 1);
  });

  it('位置の指定は両方に入る', () => {
    const result = measure(place(ZUMEN, 1));
    assert.equal(result.touched, 1);
    assert.equal(result.placed, 1);
  });

  it('線の曲げ方も「配置の手直し」', () => {
    const doc = parse(ZUMEN);
    setPin(doc, 'cli>layout', { waypoints: [{ x: 1, y: 2 }] });
    assert.equal(measure(serialize(doc)).placed, 1);
  });
});

describe('数え方の落とし穴', () => {
  it('迷子の pin は数えない（居ない要素の手直しで率を歪めない）', () => {
    const doc = parse(ZUMEN);
    setPin(doc, 'いない要素', { position: { x: 1, y: 1 } });
    assert.equal(measure(serialize(doc)).touched, 0);
  });

  it('locked だけの pin は手直しに数えない（競合を解いた記録であって、直しではない）', () => {
    const doc = parse(ZUMEN);
    setPin(doc, 'format', { locked: true });
    assert.equal(measure(serialize(doc)).touched, 0);
  });

  it('要素が無い図を不合格にしない（割れないので数字を作らない）', () => {
    const result = measure('version: 1\nnodes: []\n');
    assert.equal(result.elements, 0);
    assert.equal(result.pass, true);
  });

  it('エッジも要素として数える（図は箱だけではない）', () => {
    assert.equal(measure(ZUMEN).elements, 11 + 18);
  });
});

describe('記録のための丸め方が固定されている', () => {
  it('小数 1 桁', () => {
    assert.equal(percent(0.85), '85.0%');
    assert.equal(percent(1), '100.0%');
    assert.equal(percent(0.6206896551724138), '62.1%');
  });
});

/**
 * 100% の意味を言う（Issue #3 の「良かったところ」より）。
 *
 * > `measure` の自力率が「人が触った量」を測っているのは素直だと思います。
 * > ただ **1枚目は `pins` がゼロなので必ず 100%** になります。
 * > 「まだ人の手直しがありません」と出したほうが、指標の意味が伝わるかもしれません。
 *
 * そのとおりで、**1 枚目の 100% は「AI が上手い」ではなく「まだ誰も直していない」。**
 * 数字だけ出すと、良い成績として読まれる。
 */
/** 読み手を差し替える。**本物のディスクを触らない。** */
function reader(text: string): typeof readFileSync {
  return (() => text) as unknown as typeof readFileSync;
}

describe('まだ手直しが無いことを言う', () => {
  const FRESH = 'version: 1\nnodes:\n  - id: a\n  - id: b\nedges:\n  - from: a\n    to: b\n';
  const TOUCHED = FRESH.replace(
    'nodes:',
    'pins:\n  a:\n    position: { x: 10, y: 10 }\n\nnodes:',
  );

  it('**pins がゼロなら、その旨が出る**（100% を成績として読ませない）', () => {
    const out = runMeasure(['a.zumen.yaml'], reader(FRESH)).lines.join('\n');
    assert.match(out, /100\.0%/);
    assert.match(out, /まだ|not yet|no hand/i);
  });

  it('手直しが 1 つでもあれば、その断りは出ない', () => {
    const out = runMeasure(['a.zumen.yaml'], reader(TOUCHED)).lines.join('\n');
    assert.doesNotMatch(out, /まだ人の手直し|no hand edits yet/i);
  });

  it('空の図でも 100% だが、断りは同じく出る', () => {
    const out = runMeasure(['a.zumen.yaml'], reader('version: 1\nnodes: []\n')).lines.join('\n');
    assert.match(out, /まだ|not yet|no hand/i);
  });
});
