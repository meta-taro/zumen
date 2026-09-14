/**
 * **文字の寄せ**（`nodes[].align`）。
 *
 * 2026-09-15、見本 111（閉塞と信号現示）を**ブラウザで見て**出た。
 * 注記を 8 行並べたら、**1 行ごとに左端がずれて**、箇条書きに見えなかった。
 * zumen の文字は**すべて中央寄せ**（`text-anchor="middle"`）で、
 * 行の長さが違えば左端も右端も揃わない。
 *
 * 見本を数えたら、**25 枚・158 行**が同じ形だった。
 * 1 枚の事故ではなく、注記を書くたびに起きていた。
 *
 * ## 値は位置の名前だけ
 *
 * `align: note`（注記）のような**役割の語は足さない**（D22）。
 * 寄せ先は left / center / right の 3 つで閉じる。
 *
 * ## 効く所を広げない
 *
 * 効くのは**横組みで箱の中に収まった名前**だけ。
 * 縦組み（`stack`）・回した字（`along`）・外へ出した名前（`outside`）では、
 * 「左」が指すものが変わる。**分からない所では既定のまま**にする。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ALIGNS, alignOf } from '../src/align.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const NOTE = `version: 1
kind: placement
nodes:
  - id: a
    label: 短い注記
    marker: none
    align: left
    at: { x: 100, y: 100 }
    size: { w: 400, h: 24 }
  - id: b
    label: こちらはずっと長いほうの注記
    marker: none
    align: left
    at: { x: 100, y: 130 }
    size: { w: 400, h: 24 }
`;

async function svg(text: string, plan = true): Promise<string> {
  return render(await layout(text), 'light', 'safe', plan);
}

function texts(out: string): { x: number; anchor: string; body: string }[] {
  return [...out.matchAll(/<text x="(-?\d+)" y="-?\d+"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    anchor: /text-anchor="(\w+)"/.exec(m[2]!)?.[1] ?? 'start',
    body: m[3]!,
  }));
}

describe('寄せを読む', () => {
  it('**位置の名前だけで閉じる。役割の語は無い**', () => {
    assert.deepEqual([...ALIGNS], ['left', 'center', 'right']);
    assert.equal(alignOf('note'), 'center', '役割の語を受けてはいけない');
    assert.equal(alignOf('start'), 'center', '別名も受けない');
  });

  it('書かなければ中央', () => {
    assert.equal(alignOf(undefined), 'center');
    assert.equal(alignOf('right'), 'right');
  });
});

describe('寄せて描く', () => {
  it('**長さの違う行の左端が揃う**（これが無くて箇条書きが崩れていた）', async () => {
    const found = texts(await svg(NOTE)).filter((t) => t.body.includes('注記'));
    assert.equal(found.length, 2);
    assert.equal(found[0]!.x, found[1]!.x, '左端が揃っていない');
    assert.ok(
      found.every((t) => t.anchor === 'start'),
      '左寄せなのに中央から描いている',
    );
  });

  it('**印のある箱では、枠から少し入れる**（線に文字がぶつかる）', async () => {
    const bordered = NOTE.replaceAll('    marker: none\n', '');
    const found = texts(await svg(bordered)).filter((t) => t.body.includes('注記'));
    assert.ok(found[0]!.x > 100, '枠の真上から書き始めた');
    assert.ok(found[0]!.x < 116, '枠から離れすぎている');
  });

  it('右寄せは右端が揃う', async () => {
    const found = texts(await svg(NOTE.replaceAll('align: left', 'align: right'))).filter((t) =>
      t.body.includes('注記'),
    );
    assert.equal(found[0]!.x, found[1]!.x, '右端が揃っていない');
    assert.ok(
      found.every((t) => t.anchor === 'end'),
      '右寄せになっていない',
    );
  });

  it('既定は今までどおり中央（**158 行の見本を動かさない**）', async () => {
    const found = texts(await svg(NOTE.replaceAll('    align: left\n', ''))).filter((t) =>
      t.body.includes('注記'),
    );
    assert.ok(
      found.every((t) => t.anchor === 'middle'),
      '既定が変わった',
    );
    assert.equal(found[0]!.x, found[1]!.x, '中央は揃ったままのはず');
  });

  it('**縦組みでは効かない**（「左」の指すものが変わる）', async () => {
    const down = NOTE.replaceAll('align: left', 'align: left\n    write: down').replaceAll(
      'size: { w: 400, h: 24 }',
      'size: { w: 40, h: 200 }',
    );
    const found = texts(await svg(down)).filter((t) => t.body === '短');
    assert.ok(
      found.every((t) => t.anchor === 'middle'),
      '縦組みの字を寄せた',
    );
  });
});

describe('知らせる', () => {
  it('知らない寄せを警告する（中央で描く）', () => {
    const found = validate(NOTE.replace('align: left', 'align: middle'));
    assert.ok(found.some((f) => f.code === 'align-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('構成図では効かないことを知らせる', () => {
    const found = validate(NOTE.replace('kind: placement', 'kind: structure'));
    assert.ok(found.some((f) => f.code === 'align-ignored'));
  });

  it('仕様の語彙に載っている（AI が読めないと使われない）', () => {
    assert.ok(spec().shape.includes('align'), 'zumen_spec に align が無い');
  });
});
