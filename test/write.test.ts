/**
 * **縦組み**（`nodes[].write`）。
 *
 * 大阪メトロの「1 路線を直線に伸ばした案内図」を実物と並べて出た（2026-09-13）。
 * 駅名が**縦**に組んである —— 駅の間隔は狭く、横書きでは隣の駅名にぶつかるため。
 *
 * ## 回すのと、積むのは別
 *
 * zumen には既に「箱に沿って**回す**」（`along`）がある。用水路や廊下の名前で使う。
 * **回した日本語は、実物の路線図とは別の見え方になる** ——
 * 実物は字を 1 つずつ**上から積んで**いて、寝かせていない。
 *
 * ## ラテン文字は回す
 *
 * 日本語の縦組みでは、**ラテン文字だけは 90 度回す**（JIS X 4051 の縦中横／横倒し）。
 * 実物の路線図も、駅名は積んであってローマ字は寝ている。
 * **文字列ぜんたいで決める** —— 1 文字ずつ見分けるのは、やり過ぎて読めなくなる。
 *
 * ## 値は形の名前だけ
 *
 * `write: station`（駅名）のような**意味の語は足さない**。D22 で断った語彙の増殖が、
 * そこから始まる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';
import { WRITES, writeOf } from '../src/write.ts';

const STATION = `version: 1
kind: placement
nodes:
  - id: s
    label: 西中島南方
    technology: にしなかじまみなみがた
    write: down
    at: { x: 0, y: 0 }
    size: { w: 40, h: 120 }
`;

async function svg(text: string, plan = true): Promise<string> {
  return render(await layout(text), 'light', 'safe', plan);
}

/** その図の `<text>` を、中身つきで拾う。 */
function texts(out: string): { x: number; y: number; body: string; turned: boolean }[] {
  return [...out.matchAll(/<text x="(-?\d+)" y="(-?\d+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    turned: m[3]!.includes('rotate'),
    body: m[4]!,
  }));
}

describe('書き方を読む', () => {
  it('**形の名前だけで閉じる。意味の語は無い**', () => {
    assert.deepEqual([...WRITES], ['across', 'down']);
    assert.equal(writeOf('station'), 'across', '意味の語を受けてはいけない');
    assert.equal(writeOf('vertical'), 'across', '綴り違いも受けない');
  });

  it('書かなければ横組み', () => {
    assert.equal(writeOf(undefined), 'across');
    assert.equal(writeOf('down'), 'down');
  });
});

describe('縦組みで描く', () => {
  it('**字を 1 つずつ積む**（寝かせない）', async () => {
    const out = await svg(STATION);
    const found = texts(out).filter((t) => '西中島南方'.includes(t.body));
    assert.equal(found.length, 5, `1 文字ずつになっていない（${found.length} 個）`);
    assert.ok(
      found.every((t) => !t.turned),
      '日本語を寝かせた（実物の路線図は積んである）',
    );
  });

  it('**上から順に並ぶ**', async () => {
    const out = await svg(STATION);
    const found = texts(out).filter((t) => '西中島南方'.includes(t.body));
    assert.deepEqual(
      found.map((t) => t.body),
      ['西', '中', '島', '南', '方'],
      '順番が入れ替わった',
    );
    for (let i = 1; i < found.length; i += 1) {
      assert.ok(found[i]!.y > found[i - 1]!.y, `${found[i]!.body} が上へ行った`);
    }
  });

  it('**副題は右へ、小さく積む**（ふりがなの定位置）', async () => {
    const out = await svg(STATION);
    const all = texts(out);
    const name = all.find((t) => t.body === '西')!;
    const kana = all.find((t) => t.body === 'に')!;
    assert.ok(kana.x > name.x, '副題が右に無い');
    const size = (body: string): number =>
      Number(out.match(new RegExp(`<text [^>]*font-size="(\\d+)"[^>]*>${body}</`))![1]);
    assert.ok(size('に') < size('西'), '副題が小さくない');
  });

  it('**ラテン文字は回す**（積むと読めない）', async () => {
    const out = await svg(STATION.replace('にしなかじまみなみがた', 'Nishinakajima'));
    const found = texts(out).filter((t) => t.body === 'Nishinakajima');
    assert.equal(found.length, 1, 'ローマ字を 1 文字ずつ積んだ');
    assert.ok(found[0]!.turned, 'ローマ字を回していない');
  });

  it('**入らなくても消さない。** 箱の大きさは正本が決める', async () => {
    const out = await svg(STATION.replace('{ w: 40, h: 120 }', '{ w: 40, h: 30 }'));
    assert.equal(texts(out).filter((t) => '西中島南方'.includes(t.body)).length, 5, '名前が消えた');
  });

  it('**構成図では効かない**（箱の大きさを文字から決めているため）', async () => {
    const out = await svg(STATION.replace('kind: placement', ''), false);
    assert.ok(out.includes('>西中島南方<'), '構成図で縦組みが効いた');
  });
});

describe('知らせる', () => {
  it('知らない書き方を警告する（横組みで描く）', () => {
    const found = validate(STATION.replace('write: down', 'write: yoko'));
    assert.ok(found.some((f) => f.code === 'write-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('構成図に書いても効かないことを知らせる', () => {
    const found = validate(STATION.replace('kind: placement\n', ''));
    assert.ok(found.some((f) => f.code === 'write-ignored'));
  });

  it('spec が書き方の語を返す', () => {
    assert.deepEqual(spec().writes, ['across', 'down']);
    assert.match(spec().shape, /write:/);
  });
});
