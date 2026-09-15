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
      /**
       * **作図の跡（`data-trace`）だけは、紙から出てよい**（D36。2026-09-15）。
       *
       * 分廻しを回した跡や、半径 1,794 の大円は**字や紋の何倍もある。**
       * 紙に入れると主役が豆粒になるので、実物の作図プレートも跡は紙から出ている。
       * **「描いたのに切れた」ではなく、「切れることを決めてある」もの。**
       */
      const body = sheet.body.replace(/<g data-trace="1"[\s\S]*?<\/g>/g, '');
      for (const m of body.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g)) {
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

  /**
   * **紙の上で、文字どうしが重なっていない**（2026-09-15）。
   *
   * ## なぜ SVG を見るのか
   *
   * `overlappingText`（`src/names.ts`）は**節の文字どうし**しか見ていない。
   * 通り芯の符号・レベル名・寸法の数値・範囲の注記・図の名前は、
   * どれも描く側（`src/dimensions.ts` / `src/render.ts`）が置いているので、
   * **観測値からは丸ごと抜けている。**
   *
   * 課題 14 に「毎回手で避けるようになったら検査を足す」と書いてあり、
   * **2 周続けて手で避けた**ので足した（見本 129〜131 の組み直し）。
   *
   * **同じ幾何を 2 か所に書かない。** 描いた結果を数えれば、
   * どこが置いたかに関わらず全部入る —— 実装がずれようがない。
   *
   * ## 出てきたもの（131 枚で 4 組）
   *
   * | 見本 | 何が重なっていたか |
   * |---|---|
   * | 21 テーブルの関係 | **囲みと節が同じ id** で、囲みの名前が同じ場所に 2 回（`id-shared-with-group` を足した） |
   * | 31 座席図 | 囲みの名前が長く、**通り芯の符号 Y1** に届いていた |
   * | 39 経絡と経穴 | **囲みの名前 2 つ**が横に並んでぶつかっていた |
   * | 93 花火大会の保安距離図 | 中州の名前が、**範囲の円の注記 `R=120 m`** にぶつかっていた |
   *
   * **どれも数の検査は 0 のままだった。**
   */
  it('**文字どうしが重なっていない**（符号・寸法・図の名前も含めて）', () => {
    const over: string[] = [];
    for (const sheet of sheets()) {
      const rects: { x: number; y: number; w: number; h: number; t: string }[] = [];
      for (const m of sheet.body.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"([^>]*)>([^<]*)<\/text>/g)) {
        // 回した文字は、この当たり判定では測れない（`src/write.ts`）。
        if (m[3]!.includes('rotate') || m[4]!.trim() === '') continue;
        const font = Number(/font-size="([\d.]+)"/.exec(m[3]!)?.[1] ?? 12);
        const anchor = /text-anchor="(\w+)"/.exec(m[3]!)?.[1] ?? 'start';
        const w = widthOf(m[4]!, font);
        const x = Number(m[1]);
        const y = Number(m[2]);
        rects.push({
          x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x,
          y: y - font,
          w,
          h: font,
          t: m[4]!,
        });
      }
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i]!;
          const b = rects[j]!;
          // **2px 触れているだけは見ない。** 下地の板が抜いてあるので読める。
          const gap = 2;
          const apart =
            a.x + a.w <= b.x + gap ||
            b.x + b.w <= a.x + gap ||
            a.y + a.h <= b.y + gap ||
            b.y + b.h <= a.y + gap;
          if (!apart) over.push(`${sheet.name}: ${JSON.stringify(a.t)} × ${JSON.stringify(b.t)}`);
        }
      }
    }
    assert.deepEqual(over, [], '文字どうしが重なっている');
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
