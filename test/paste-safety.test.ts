/**
 * 出した図が、貼り先で崩れないか（Issue 007）。
 *
 * 図は単体で見るものではなく、**資料に貼るもの**。
 * 貼り先で崩れると、人はそこで手作業に戻り、**そして図はまた腐る。**
 *
 * **実際に貼って確かめるのは人**（`docs/specs/007-貼り先で崩れないか.md`）。
 * ここで守るのは、**貼り先ごとに解釈が割れる機能を使っていないこと**。
 * 一度そろえても、後から足されたら意味が無いので、テストで固定する。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parse, serialize, setPin } from '../src/format.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

async function svg(text = R0): Promise<string> {
  return render(await layout(text));
}

/** 日本語のラベルと体裁を入れた版。**豆腐（□）になる経路を踏む。** */
function japanese(): string {
  const doc = parse(R0);
  setPin(doc, 'db', { label: '本番データベース（MariaDB）', appearance: 'primary' });
  return serialize(doc);
}

describe('貼り先ごとに解釈が割れる機能を使っていない', () => {
  const forbidden: [string, string][] = [
    ['<style', 'CSS の解釈は貼り先ごとに違う'],
    ['foreignObject', '対応していない貼り先が多い'],
    ['linearGradient', 'グラデーションは貼り先で落ちる'],
    ['radialGradient', '同上'],
    ['filter=', 'フィルタは貼り先で落ちる'],
    ['dominant-baseline', '効かない貼り先があり、効かないと**文字だけがずれる**'],
    ['xlink:', '古い名前空間。要らない'],
    ['<image', '外部の絵に依存しない'],
    ['auto-start-reverse', 'SVG 2 の値。marker-end しか使わないので auto で足りる'],
  ];

  for (const [needle, why] of forbidden) {
    it(`${needle} を使わない（${why}）`, async () => {
      assert.equal((await svg()).includes(needle), false);
    });
  }
});

describe('貼り先が困らないだけの情報を必ず書く', () => {
  it('width / height と viewBox の両方がある', async () => {
    const out = await svg();
    assert.match(out, /<svg[^>]*width="\d+"/);
    assert.match(out, /<svg[^>]*height="\d+"/);
    assert.match(out, /<svg[^>]*viewBox="0 0 \d+ \d+"/);
  });

  it('名前空間がある（これが無いと画像として扱われない）', async () => {
    assert.match(await svg(), /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('**すべての文字に font-family がある**（無いと日本語が豆腐になり得る）', async () => {
    const out = await svg(japanese());
    const texts = out.match(/<text\b[^>]*>/g) ?? [];
    assert.ok(texts.length > 0, '文字が 1 つも出ていない');
    for (const tag of texts) {
      assert.match(tag, /font-family=/, `font-family が無い: ${tag}`);
    }
  });

  it('書体は総称ファミリだけ（**見た目は人が決める領域**。ベースルール §11）', async () => {
    const out = await svg();
    for (const family of out.match(/font-family="([^"]+)"/g) ?? []) {
      assert.match(family, /"(sans-serif|serif|monospace)"/, `具体的な書体名が入っている: ${family}`);
    }
  });
});

describe('ラベルの文字が図を壊さない', () => {
  it('& < > " が実体参照になる', async () => {
    const doc = parse(R0);
    setPin(doc, 'db', { label: 'A & B <c> "d"' });
    const out = await svg(serialize(doc));
    assert.match(out, /A &amp; B &lt;c&gt; &quot;d&quot;/);
  });

  it('生の & が残らない', async () => {
    const doc = parse(R0);
    setPin(doc, 'db', { label: 'A & B' });
    const out = await svg(serialize(doc));
    assert.equal(/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(out), false);
  });
});

describe('文字の縦位置は座標で決める', () => {
  it('箱の中の文字が、箱の縦の範囲に入っている', async () => {
    const out = await svg();
    // 属性からではなく出力そのものから読む。**実際に出ている値**を見る。
    const box = /<rect x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)" width="(\d+)" height="(\d+)"[^>]*rx="6"/.exec(out);
    assert.ok(box !== null, '箱が出ていない');
    const y = Number(box![2]);
    const h = Number(box![4]);
    const text = new RegExp(`<text x="[^"]+" y="(\\d+(?:\\.\\d+)?)"`).exec(out.slice(out.indexOf(box![0])));
    assert.ok(text !== null);
    const ty = Number(text![1]);
    assert.ok(ty > y && ty < y + h, `文字の y=${ty} が箱 ${y}..${y + h} の外`);
  });
});
