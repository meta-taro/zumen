/**
 * **色の違う線が、同じ道を重なって走らない**（`stackedEdges`。2026-10-07）。
 *
 * 交差は 1 点なので両方の線を追える。**重なって走ると、下の線の色が消える** ——
 * 見本 81（東京の地下鉄）で、渋谷〜表参道の銀座線が半蔵門線の下に隠れ、浅草まで追えなかった。
 *
 * 同じ色どうしは数えない（家系図の幹・配管の本管と枝。道を共有するのが作法）。
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { layout, stackedEdges } from '../src/layout.ts';

const line = (from: string, to: string, color: string, via: string, offset = 0) =>
  `  - from: ${from}\n    to: ${to}\n    color: ${color}\n    via: [${via}]\n${offset === 0 ? '' : `    offset: ${offset}\n`}`;

const SRC = (offset: number, colorB = 'b') => `version: 1
kind: placement
palette:
  a: "#e24340"
  b: "#2e6ab1"
nodes:
  - id: p
    at: { x: 0, y: 100 }
    size: { w: 10, h: 10 }
  - id: q
    at: { x: 300, y: 100 }
    size: { w: 10, h: 10 }
edges:
${line('p', 'q', 'a', '{ x: 50, y: 105 }, { x: 250, y: 105 }')}${line('q', 'p', colorB, '{ x: 250, y: 105 }, { x: 50, y: 105 }', offset)}`;

describe('重なって走る線', () => {
  it('**色の違う 2 本が同じ道を走ると、組で出る**', async () => {
    const found = stackedEdges(await layout(SRC(0)));
    assert.equal(found.length, 1);
    assert.ok(found[0]!.px >= 200);
  });

  it('**offset でずらせば出ない**', async () => {
    assert.deepEqual(stackedEdges(await layout(SRC(5))), []);
  });

  it('**同じ色どうしは数えない**（共有する幹）', async () => {
    assert.deepEqual(stackedEdges(await layout(SRC(0, 'a'))), []);
  });
});

/**
 * **見本では、出たら中身の理由が要る。** 理由の無いものは直す。
 */
const STACKED_IS_CONTENT: Record<string, string> = {
  '336-航海灯.zumen.yaml': '**色の違う光の扇が、境の線を共有する。** 舷灯と船尾灯の境は 1 本の方位で、隙間を空けると見えない向きができたように読める',
  '373-昆虫の複眼-連立像眼と重複像眼.zumen.yaml': '**光の通り道が、円錐晶体の縁を沿って進む。** 縁で屈折して感桿へ導かれるのが図の主題',
  '374-昆虫の翅脈-コムストック・ニーダム式.zumen.yaml': '**C 脈（前縁脈）は翅の前の縁そのもの。** 輪郭と同じ線の上に色を付けて示すのが正しい',
  '384-競泳の50mプール-5mと15mの印.zumen.yaml': '**両端 5m の赤い浮きは、コースロープの上に重ねる。** 実物も 5m だけロープの色が赤に替わる',
};

describe('見本で、色の違う線が重なって走っていない', () => {
  const dir = join(import.meta.dirname, '..', 'examples', 'gallery');
  const files = readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort();

  it('**理由の無い重なりが無い**', async () => {
    const bad: string[] = [];
    for (const file of files) {
      if (STACKED_IS_CONTENT[file] !== undefined) continue;
      const found = stackedEdges(await layout(readFileSync(join(dir, file), 'utf8')));
      if (found.length > 0) bad.push(`${file}: ${found.map((s) => `${s.a} | ${s.b}`).join(' ; ')}`);
    }
    assert.deepEqual(bad, []);
  });

  it('**逃がした見本は、まだ重なっている**（直ったら表から外す）', async () => {
    const stale: string[] = [];
    for (const file of Object.keys(STACKED_IS_CONTENT)) {
      const found = stackedEdges(await layout(readFileSync(join(dir, file), 'utf8')));
      if (found.length === 0) stale.push(file);
    }
    assert.deepEqual(stale, []);
  });
});

/**
 * **構成図では、1 つの箱から出る線が出口を共有しない**（2026-10-07 に測って 0）。
 *
 * 同じ点から何本も出ると、どれがどこへ行くか追えない。いまは ELK が線ごとに出口を分けている。
 * **自動で置く図だけを見る** —— 配置図では、光源から出る光・1 点へ集まる力のように、
 * 1 点から出ること自体が中身の図がある。
 */
describe('構成図の線の出口', () => {
  it('**別々の線が、同じ箱の同じ点から出ない**', async () => {
    const { kindOf } = await import('../src/kind.ts');
    const dir = join(import.meta.dirname, '..', 'examples', 'gallery');
    const shared: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
      const text = readFileSync(join(dir, file), 'utf8');
      if (kindOf(text) === 'placement') continue;
      const ends = (await layout(text)).edges
        .filter((e) => e.points.length >= 2)
        .flatMap((e) => [
          { id: e.id, box: e.from, at: e.points[0]! },
          { id: e.id, box: e.to, at: e.points[e.points.length - 1]! },
        ]);
      for (let i = 0; i < ends.length; i += 1) {
        for (let j = i + 1; j < ends.length; j += 1) {
          const a = ends[i]!;
          const b = ends[j]!;
          if (a.id === b.id || a.box !== b.box) continue;
          if (Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) < 4) shared.push(`${file}: ${a.id} / ${b.id}`);
        }
      }
    }
    assert.deepEqual(shared, []);
  });
});
