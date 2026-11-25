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
 * `write: station`（駅名）のような**意味の語は足さない**。断っている「業界ごとの語彙の増殖」が、
 * そこから始まる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { labelWidth, layout } from '../src/layout.ts';
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

  it('**回したラテン文字は、箱の上へはみ出さない**（積んだ字と同じく上から始まる）', async () => {
    // 見本 425（W-9）で見つかった。回した文字の中心を「上端＋字の高さの半分」に置いていたので、
    // 長い英語は半分が箱の上へ出ていた。回した文字の長さは字の高さではなく、横書きの幅
    const long = 'Before you begin. For guidance';
    const out = await svg(STATION.replace('にしなかじまみなみがた', long).replace('{ w: 40, h: 120 }', '{ w: 40, h: 300 }'));
    const m = out.match(new RegExp(`<text [^>]*y="(-?[\\d.]+)"[^>]*font-size="(\\d+)"[^>]*rotate\\(90[^>]*>${long}<`))!;
    assert.ok(m, '回した文字が見つからない');
    const top = Number(m[1]) - labelWidth(long, Number(m[2])) / 2;
    const name = texts(out).find((t) => t.body === '西')!;
    // 積んだ字の 1 つ目は「上端＋字の大きさ」に置かれる。回した文字の上端もそれより上へ出ない
    assert.ok(top >= name.y - 16, `回した文字の上端（${top}）が、積んだ字の 1 つ目（${name.y}）より上へ出た`);
  });

  /**
   * **縦組みの約物と小書きの仮名**（Issue 016・JIS X 4051）。
   *
   * 横組みの字形をそのまま積むと、「、」「。」はますの左下に、「ー」は横棒のまま出る。
   * 縦組みでは句読点はますの右上、小書きの仮名は少し右上、長音記号・波ダッシュ・三点リーダーは縦にする。
   * **正本の文字は変えない**（縦組み用の別の字に置き換えない）。描くときに位置と向きだけを変える。
   */
  const glyphs = (out: string): { x: number; y: number; body: string; turn: string }[] =>
    [...out.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"([^>]*)>([^<]*)<\/text>/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
      turn: m[3]!.match(/rotate\((-?\d+)/)?.[1] ?? '',
      body: m[4]!,
    }));

  it('**句読点は、ますの右上へ寄せる**（字は変えない）', async () => {
    const out = await svg(STATION.replace('西中島南方', '東京、大阪。').replace(/    technology: .*\n/, ''));
    const all = glyphs(out);
    const kyo = all.find((g) => g.body === '京')!;
    const ten = all.find((g) => g.body === '、')!;
    const han = all.find((g) => g.body === '阪')!;
    const maru = all.find((g) => g.body === '。')!;
    assert.ok(ten && maru, '句読点が別の字に置き換わった');
    assert.ok(ten.x > kyo.x, `「、」が右へ寄っていない（${ten.x} ≦ ${kyo.x}）`);
    assert.ok(maru.x > han.x, '「。」が右へ寄っていない');
    // 寄せなければ、次のますの基準線は前の字から 1 字ぶん（約 16px）下。上へ寄せたなら半分より近い
    assert.ok(ten.y - kyo.y < 8, `「、」が上へ寄っていない（前の字から ${ten.y - kyo.y}px 下）`);
  });

  it('**小書きの仮名は、少し右へ寄せる**', async () => {
    const out = await svg(STATION.replace('西中島南方', 'きゃく').replace(/    technology: .*\n/, ''));
    const all = glyphs(out);
    const ki = all.find((g) => g.body === 'き')!;
    const ya = all.find((g) => g.body === 'ゃ')!;
    assert.ok(ya.x > ki.x, '「ゃ」が右へ寄っていない');
    assert.ok(ya.x - ki.x < 4, '「ゃ」を寄せすぎた（句読点ほどは寄せない）');
  });

  it('**長音記号・波ダッシュ・三点リーダーは縦にする**', async () => {
    const out = await svg(STATION.replace('西中島南方', 'ルーム〜…').replace(/    technology: .*\n/, ''));
    const all = glyphs(out);
    for (const body of ['ー', '〜', '…']) {
      const g = all.find((x) => x.body === body);
      assert.ok(g, `${body} が見つからない`);
      assert.equal(g!.turn, '90', `${body} が縦になっていない`);
    }
    assert.equal(all.find((g) => g.body === 'ル')!.turn, '', '仮名まで回した');
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
