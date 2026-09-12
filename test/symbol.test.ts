/**
 * **電気・電子の図記号**（`nodes[].symbol`）。
 *
 * ## 前言を訂正して入れた
 *
 * 「電子回路図はいまの道具では作れない」と言い、理由を 2 つ挙げた。
 * オーナーからこう返った（2026-09-13）。
 *
 * > 端子や記号はイメージとしては **svg とか一度作れば位置も大きさも自由**では
 * > とおもいますが。
 *
 * **1 つ目（記号が描けない）は間違いだった。** 建具の弧・鳥の足・高さ記号と同じで、
 * 正規化した箱の中に線を引くだけ。
 *
 * **2 つ目（語彙が増える）も半分だけ正しかった。**
 * D22 が心配したのは「同じものを違う語で書く人が増えて差分が読めなくなる」ことで、
 * それは**自分で語を決めるときにだけ**当てはまる。
 * `symbol` の語は IEC／JIS が決めており、`type` の 11 語は増えない。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { SYMBOLS, drawSymbol, legsOf, symbolOf } from '../src/symbol.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const BOX = { x: 100, y: 100, w: 80, h: 40 };
const PAINT = { stroke: '#111111', paper: '#ffffff' };

const CIRCUIT = `version: 1
kind: placement
arrows: false
nodes:
  - id: r1
    label: R1
    technology: 330Ω
    symbol: resistor
    at: { x: 100, y: 0 }
    size: { w: 80, h: 40 }
  - id: gnd
    label: GND
    symbol: ground
    at: { x: 100, y: 120 }
    size: { w: 40, h: 44 }
edges:
  - from: r1
    to: gnd
`;

describe('記号を読む', () => {
  it('**13 で止めている**（際限なく増やさない）', () => {
    assert.equal(SYMBOLS.length, 13);
    assert.ok(SYMBOLS.includes('resistor'));
  });

  it('知らない語は null（矩形へ落ちる）', () => {
    assert.equal(symbolOf('transistor'), null, 'まだ描けない部品を受けてはいけない');
    assert.equal(symbolOf(undefined), null);
    assert.equal(symbolOf('resistor'), 'resistor');
  });
});

describe('足（端子）', () => {
  it('横長なら左右、縦長なら上下に出る', () => {
    assert.deepEqual(legsOf('resistor', BOX), [
      { x: 100, y: 120 },
      { x: 180, y: 120 },
    ]);
    assert.deepEqual(legsOf('resistor', { x: 0, y: 0, w: 40, h: 80 }), [
      { x: 20, y: 0 },
      { x: 20, y: 80 },
    ]);
  });

  it('**接地の足は 1 本だけ**（上）', () => {
    assert.deepEqual(legsOf('ground', BOX), [{ x: 140, y: 100 }]);
  });

  it('**配線は足へ繋がる。** 胴体の真横から線が出たら回路図に見えない', async () => {
    const placed = await layout(CIRCUIT);
    const edge = placed.edges[0]!;
    const r1 = placed.boxes.find((b) => b.id === 'r1')!;
    const legs = legsOf('resistor', r1);
    const start = edge.points[0]!;
    assert.ok(
      legs.some((leg) => Math.abs(leg.x - start.x) < 1 && Math.abs(leg.y - start.y) < 1),
      '線の端が足に無い',
    );
  });
});

describe('記号を描く', () => {
  it('13 種すべてが何かを描く', () => {
    for (const kind of SYMBOLS) {
      assert.ok(drawSymbol(kind, BOX, PAINT).length > 0, `${kind} が描かれていない`);
    }
  });

  it('**抵抗は長方形**（IEC／JIS）。ジグザグの ANSI 形は採らない', () => {
    const out = drawSymbol('resistor', BOX, PAINT);
    assert.match(out, /<rect /);
    // ジグザグなら線が 6 本以上になる。引き出し線 2 本だけのはず。
    assert.equal(out.match(/<line /g)!.length, 2);
  });

  it('コンデンサは 2 本の平行線、有極は片側が弧', () => {
    assert.ok(!drawSymbol('capacitor', BOX, PAINT).includes('<path'));
    assert.match(drawSymbol('polarized-capacitor', BOX, PAINT), /<path d="M [^"]*Q /);
  });

  it('ダイオードは塗った三角と線', () => {
    const out = drawSymbol('diode', BOX, PAINT);
    assert.match(out, /<path [^>]*fill="#111111"/);
  });

  it('**接地は箱が横長でも縦向き。** 横向きの接地記号は無い', () => {
    const flat = drawSymbol('ground', { x: 0, y: 0, w: 80, h: 40 }, PAINT);
    const lines = [...flat.matchAll(/y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/g)];
    // 横棒が 3 本（y1 === y2 のもの）。
    const bars = lines.filter((m) => m[1] === m[3]);
    assert.equal(bars.length, 3, '接地の横棒が 3 本になっていない');
  });
});

describe('図に載せる', () => {
  it('**枠を描かず、記号だけを描く**（抵抗に枠は無い）', async () => {
    const out = render(await layout(CIRCUIT), 'light', 'safe', true);
    const part = out.slice(out.indexOf('data-node="r1"'));
    const body = part.slice(0, part.indexOf('</g>'));
    assert.ok(!/<rect [^>]*stroke-width="1"/.test(body), '記号の外に枠が出ている');
    assert.match(body, /<rect /, '抵抗の長方形が無い');
  });

  it('**部品名と値は記号の脇へ出る**（実物の回路図もそう）', async () => {
    const placed = await layout(CIRCUIT);
    const box = placed.boxes.find((b) => b.id === 'r1')!;
    const out = render(placed, 'light', 'safe', true);
    const y = Number(out.match(/<text x="\d+" y="(\d+)"[^>]*>R1</)![1]);
    assert.ok(y < box.y || y > box.y + box.h, '部品名が記号に重なっている');
  });

  it('**配線は直角に曲がる。** 斜めの線は配線に見えない', async () => {
    const placed = await layout(CIRCUIT);
    const points = placed.edges[0]!.points;
    for (let i = 0; i + 1 < points.length; i += 1) {
      const a = points[i]!;
      const b = points[i + 1]!;
      assert.ok(
        Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1,
        `(${a.x},${a.y})→(${b.x},${b.y}) が斜め`,
      );
    }
  });

  it('知らない記号を警告する', () => {
    const found = validate(CIRCUIT.replace('symbol: resistor', 'symbol: transistor'));
    assert.ok(found.some((f) => f.code === 'symbol-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('spec が記号の語を返す', () => {
    assert.deepEqual(spec().symbols, [
      'resistor',
      'variable-resistor',
      'capacitor',
      'polarized-capacitor',
      'inductor',
      'diode',
      'led',
      'battery',
      'source',
      'ground',
      'switch',
      'fuse',
      'lamp',
    ]);
    assert.match(spec().shape, /symbol:/);
  });
});
