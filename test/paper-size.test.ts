/**
 * **刷る紙の大きさ**（`src/paper.ts`。2026-11-10）。
 *
 * 解答用紙（見本 411〜415）は刷って配る図。px の幅しか言わない SVG では、
 * B4 の様式が A4 に縮んで出ても誰も気づけない。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { MM_PER_PX, pageBox, paperOf, paperTroubles, printScale, printableArea, shrinkOf, svgPixels } from '../src/paper.ts';
import { render } from '../src/render.ts';
import { exportAs, inspect, pdfOf, spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const SHEET = (paper: string): string => `version: 1
kind: placement
title: 解答用紙
${paper}
nodes:
  - { id: a, label: 氏名, at: { x: 20, y: 20 }, size: { w: 400, h: 40 } }
  - { id: b, label: 答, at: { x: 20, y: 80 }, size: { w: 400, h: 200 } }
`;

describe('紙を読む', () => {
  it('**語だけでも、表でも書ける。大文字・小文字を問わない**', () => {
    assert.deepEqual(paperOf('B4'), { size: 'B4', orient: 'portrait', w: 257, h: 364, margin: 10 });
    assert.deepEqual(paperOf({ size: 'a3', orient: 'landscape', margin: 15 }), { size: 'A3', orient: 'landscape', w: 420, h: 297, margin: 15 });
  });

  it('**郵便はがき（100×148mm）も選べる**（内国郵便約款 第 21 条）', () => {
    assert.deepEqual(paperOf({ size: 'hagaki', margin: 0 }), { size: 'Hagaki', orient: 'portrait', w: 100, h: 148, margin: 0 });
  });

  it('読めない紙は null（紙を決めない＝これまでどおり）。検証器は何が読めないかを言う', () => {
    assert.equal(paperOf('B9'), null);
    assert.equal(paperOf(undefined), null);
    assert.deepEqual(paperTroubles('B9'), ['size']);
    assert.deepEqual(paperTroubles({ size: 'A4', orient: 'sideways', margin: -1 }), ['orient', 'margin']);
    assert.deepEqual(paperTroubles(undefined), []);
  });

  it('**余白が紙の半分を超えるなら既定の 10 mm に戻す**（図の置き場所が無くなる）', () => {
    assert.equal(paperOf({ size: 'A5', margin: 80 })?.margin, 10);
  });
});

describe('紙から逆算する', () => {
  it('**はみ出さなければ 96 dpi のまま刷る**（画面で見た大きさ）。余白の内側が何 px かが先に分かる', () => {
    const b4 = paperOf('B4')!;
    assert.equal(printScale(b4, 400, 300), MM_PER_PX);
    assert.equal(shrinkOf(b4, 400, 300), 1);
    const area = printableArea(b4);
    assert.equal(Math.floor(area.w), 895);
    assert.equal(Math.floor(area.h), 1300);
  });

  it('**はみ出したら、比を保って縮める**（効くのは足りないほうの辺）。拡げはしない', () => {
    const a4 = paperOf('A4')!;
    assert.equal(printScale(a4, 950, 400), 0.2, '幅 190mm ÷ 950px');
    assert.equal(printScale(a4, 100, 2770), 0.1, '高さ 277mm ÷ 2770px');
    assert.ok(shrinkOf(a4, 950, 400) < 1);
  });

  it('**図の (0, 0) は、紙の余白の左上**（正本の座標が紙のどこかが動かない）', () => {
    const a4 = paperOf('A4')!;
    const box = pageBox(a4, 400, 300);
    assert.ok(Math.abs(box.x - -10 / MM_PER_PX) < 1e-9);
    assert.ok(Math.abs(box.y - -10 / MM_PER_PX) < 1e-9);
    assert.ok(Math.abs(box.w - 210 / MM_PER_PX) < 1e-9);
    assert.ok(Math.abs(box.h - 297 / MM_PER_PX) < 1e-9);
  });
});

describe('SVG を mm で出す', () => {
  it('**紙を決めた図は、幅と高さを mm で書き、地を紙いっぱいに敷く**', async () => {
    const svg = render(await layout(SHEET('paper: { size: B4, orient: landscape }')), 'light', 'safe', true);
    const head = /<svg\b[^>]*>/.exec(svg)![0];
    assert.match(head, /width="364mm" height="257mm"/);
    assert.match(head, /data-paper-size="B4" data-paper-orient="landscape"/);
    const view = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(head)!.slice(1).map(Number);
    const rect = /<rect data-paper="1" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(svg)!.slice(1).map(Number);
    assert.deepEqual(rect, view, '地が紙の一部にしか敷かれていない');
    // 紙の縦横比のまま
    assert.ok(Math.abs(view[2]! / view[3]! - 364 / 257) < 0.01);
  });

  it('**紙を決めていない図の出力は 1 字も変えない**', async () => {
    const svg = render(await layout(SHEET('')), 'light', 'safe', true);
    assert.match(svg, /<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+"/);
    assert.match(svg, /<rect data-paper="1" x="0" y="0" width="\d+" height="\d+"/);
  });

  it('**px の大きさは、mm の図なら viewBox から読む**（png に撮る・ページに寸法を書く側）', () => {
    assert.deepEqual(svgPixels('<svg width="120" height="80" viewBox="0 0 120 80">'), { w: 120, h: 80 });
    assert.deepEqual(svgPixels('<svg width="257mm" height="364mm" viewBox="-10 -10 1000.4 1416.2">'), { w: 1001, h: 1417 });
    assert.equal(svgPixels('<p>'), null);
  });
});

describe('検査と書き出し', () => {
  it('**紙が決まっていれば、字を紙の上の mm で測る**', async () => {
    const seen = await inspect(SHEET('paper: A4'));
    assert.equal(seen.paper, 'A4 portrait');
    assert.ok(seen.printedText !== null && seen.printedText > 2.5, `${seen.printedText}`);
    assert.equal(seen.tooSmallToPrint, false);
    assert.deepEqual(seen.printable, { w: 718, h: 1046 });
    assert.equal(seen.paperShrink, 1);
    const none = await inspect(SHEET(''));
    assert.equal(none.paper, null);
    assert.equal(none.printedText, null);
  });

  it('**紙に対して図が大きすぎれば、刷ると読めないと言う**', async () => {
    const wide = SHEET('paper: A5').replace('size: { w: 400, h: 200 }', 'size: { w: 2400, h: 200 }');
    const seen = await inspect(wide);
    assert.ok(seen.printedText !== null && seen.printedText < 2.5);
    assert.equal(seen.tooSmallToPrint, true);
    assert.ok(seen.paperShrink !== null && seen.paperShrink < 1, '縮めて刷ることを言っていない');
  });

  it('読めない紙は、検証器が警告で言う（止めない）', () => {
    const found = validate(SHEET('paper: B9'));
    assert.ok(found.some((f) => f.code === 'paper-size-invalid' && f.severity === 'warning'));
  });

  it('**pdf を書き出せる**（Chrome が無ければ、無いと言う）。刷る物なので明るい紙で', async () => {
    let seenSvg = '';
    const made = await pdfOf(SHEET('paper: B4'), { theme: 'dark' }, () => '/chrome', (_c, svg) => {
      seenSvg = svg;
      return Buffer.from('%PDF-1.4');
    });
    assert.equal(made.pdf?.toString(), '%PDF-1.4');
    assert.match(seenSvg, /width="257mm"/);
    const none = await pdfOf(SHEET('paper: B4'), {}, () => null);
    assert.equal(none.pdf, null);
    assert.ok(none.note.length > 0);
    assert.ok(spec().exports.includes('pdf'));
    assert.equal(typeof (await exportAs(SHEET(''), 'svg')), 'string');
  });

  it('**仕様（zumen_spec）に paper の書き方が載っている**（載っていない鍵は、エージェントには無いのと同じ）', () => {
    assert.ok(spec().shape.includes('paper:'));
  });
});

describe('刷る紙を決めた図は、紙に数えないものを足さない（2026-11-10。見本 416 で踏んだ）', () => {
  const EXACT = (extra: string): string => `version: 1
kind: placement
title: 余白の内側にぴったり
paper: { size: A4, orient: portrait, margin: 10 }
${extra}
nodes:
  - { id: a, label: 枠, at: { x: 0, y: 0 }, size: { w: 718, h: 1046 } }
`;

  it('**余白の内側にぴったり描いた図は、縮めずに刷る**（右と下の息継ぎ 24px を足さない）', async () => {
    const seen = await inspect(EXACT(''));
    assert.equal(seen.paperShrink, 1);
  });

  it('**出典は紙の下の余白に刷り、図の大きさに数えない**', async () => {
    const source = EXACT('sources:\n  - name: "出典の名前"\n    url: https://example.com/\n    retrieved: 2026-11-10');
    assert.equal((await inspect(source)).paperShrink, 1);
    const svg = render(await layout(source), 'light', 'safe', true);
    const y = Number(/<g data-name="sources"><a [^>]*><text x="[-\d.]+" y="([-\d.]+)"/.exec(svg)![1]);
    assert.ok(y > 1046 && y < 1046 + 10 / MM_PER_PX, `出典が下の余白に無い（y=${y}）`);
  });

  it('**縮尺の物差しは出さない**（縮んで刷られた物差しは嘘になる。縮尺は表題欄、縮みは比較目盛で）', async () => {
    const source = EXACT('scale: { mm: 0.264583, unit: mm }');
    assert.equal((await inspect(source)).paperShrink, 1);
    const svg = render(await layout(source), 'light', 'safe', true);
    assert.doesNotMatch(svg, /scalebar/);
  });

  it('紙を決めていない図は、これまでどおり息継ぎと物差しを足す', async () => {
    const plain = EXACT('scale: { mm: 0.264583, unit: mm }').replace(/paper:.*\n/, '');
    const placed = await layout(plain);
    assert.equal(placed.width, 718 + 24);
    assert.match(render(placed, 'light', 'safe', true), /scalebar/);
  });
});

