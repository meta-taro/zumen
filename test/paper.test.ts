/**
 * **描いてあるのに、画用紙の外にあるもの。**
 *
 * 2026-09-15。テーピングの図で足の輪郭を閉じた曲線で描こうとして、
 * **画用紙がその輪郭を無視して小さいまま**になっているのに気づいた。
 * そこから見本ぜんぶを数えたら、**同じ形の落ち方が 5 種類**出てきた。
 *
 * | 何が | どこで見つかったか |
 * |---|---|
 * | 辺の通り道 | 見本 07（稟議の流れ）—— 差し戻しの線が **52px 手前で切れて**いた |
 * | 範囲の円 | 見本 30 —— 紹介文が「クレーンの作業半径つき」なのに**円が切れて**いた |
 * | レベルの名前 | 見本 42・43 —— 断面図の「GL±0」が**矢印の先だけ**残っていた |
 * | 通り芯の符号 | 見本 27・28・31 —— **上の X1〜X6 が 1 つも描かれていなかった** |
 * | 通り芯の位置 | 見本 71 —— 右端の時刻「9:00」が紙の **43px 外**にあった |
 * | 囲みの名前 | 見本 39 —— 経絡の名前が紙の **110px 外**まで伸びていた |
 *
 * **数の検査はどれも 0 のままだった。** 交差も、重なりも、隠れたラベルも鳴らない。
 * **「紙の外にある」を誰も見ていなかった。**
 *
 * だからここで見る。**個別に直すだけでは、次に別の形で戻ってくる。**
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const DIR = 'examples/gallery';

/** `src/layout.ts` の `labelWidth` と同じ物差し。 */
function widthOf(text: string, font: number): number {
  let units = 0;
  for (const ch of text) units += /[ -~｡-ﾟ]/.test(ch) ? 1 : 2;
  return units * font * 0.55;
}

interface Sheet {
  name: string;
  body: string;
  w: number;
  h: number;
}

function sheets(): Sheet[] {
  const out: Sheet[] = [];
  for (const name of readdirSync(DIR).filter((f) => f.endsWith('.svg'))) {
    const body = readFileSync(`${DIR}/${name}`, 'utf8');
    const found = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(body);
    if (found === null) continue;
    out.push({ name, body, w: Number(found[1]), h: Number(found[2]) });
  }
  return out;
}

describe('見本の中身が、画用紙の中に収まっている', () => {
  it('**文字が紙からはみ出していない**', () => {
    const over: string[] = [];
    for (const sheet of sheets()) {
      for (const m of sheet.body.matchAll(
        /<text x="(-?[\d.]+)" y="(-?[\d.]+)"([^>]*)>([^<]*)<\/text>/g,
      )) {
        // 回した文字は、この当たり判定では測れない（`src/write.ts`）。
        if (m[3]!.includes('rotate')) continue;
        const x = Number(m[1]);
        const y = Number(m[2]);
        const font = Number(/font-size="([\d.]+)"/.exec(m[3]!)?.[1] ?? 12);
        const anchor = /text-anchor="(\w+)"/.exec(m[3]!)?.[1] ?? 'start';
        const w = widthOf(m[4]!, font);
        const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
        if (left < -1 || left + w > sheet.w + 1 || y > sheet.h + 1 || y - font < -1) {
          over.push(`${sheet.name}: ${JSON.stringify(m[4]).slice(0, 34)}`);
        }
      }
    }
    assert.deepEqual(over, [], '紙の外に文字がある');
  });

  it('**符号の丸が紙からはみ出していない**', () => {
    const over: string[] = [];
    for (const sheet of sheets()) {
      for (const m of sheet.body.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)) {
        const cx = Number(m[1]);
        const cy = Number(m[2]);
        const r = Number(m[3]);
        if (cx - r < -1 || cy - r < -1 || cx + r > sheet.w + 1 || cy + r > sheet.h + 1) {
          over.push(`${sheet.name}: 丸 ${cx},${cy} r=${r} / ${sheet.w}x${sheet.h}`);
        }
      }
    }
    assert.deepEqual(over, [], '紙の外に符号の丸がある');
  });

  it('**線が紙からはみ出していない**', () => {
    const over: string[] = [];
    for (const sheet of sheets()) {
      for (const m of sheet.body.matchAll(
        /<line x1="(-?[\d.]+)" y1="(-?[\d.]+)" x2="(-?[\d.]+)" y2="(-?[\d.]+)"/g,
      )) {
        const xs = [Number(m[1]), Number(m[3])];
        const ys = [Number(m[2]), Number(m[4])];
        if (Math.min(...xs) < -1 || Math.max(...xs) > sheet.w + 1) {
          over.push(`${sheet.name}: 線 x ${xs.join('→')} / ${sheet.w}`);
        }
        if (Math.min(...ys) < -1 || Math.max(...ys) > sheet.h + 1) {
          over.push(`${sheet.name}: 線 y ${ys.join('→')} / ${sheet.h}`);
        }
      }
    }
    assert.deepEqual(over, [], '紙の外に線がある');
  });
});
