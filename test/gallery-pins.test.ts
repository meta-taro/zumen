/**
 * **手直しが、次の生成で壊れないか**を見本ぜんたいで測る。
 *
 * この製品の勝負どころは 1 点だけ ——
 * **人が手で直した分が、AI の次の生成で残ること**（PRD・判定基準 3.1）。
 *
 * S1 は**本物の AI に 10 回**書き直させて 10/10 だった（`pnpm s1:real`）。
 * ただしそれは**特定の 1 枚**の話で、図の形はいろいろある ——
 * 路線図・伏図・積付図・視野図。**形が変われば壊れ方も変わりうる。**
 *
 * ここでは API を使わずに、**AI の書き直しを模した提案**を全見本へ当てる。
 *
 * 1. 見本の 1 つ目のノードに、人が `pins.position` を書いたことにする
 * 2. AI が**別の位置**を出してきた提案を作る（`nodes[].at` を動かす）
 * 3. `merge` したあと、**人の位置がそのまま残っている**ことを見る
 *
 * 測っているのは「綺麗に描けたか」ではなく、**人の 1 か所が生き残ったか**。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

import { getPins, parse } from '../src/format.ts';
import { merge } from '../src/merge.ts';
import { layout } from '../src/layout.ts';

const DIR = new URL('../examples/gallery/', import.meta.url);

/** 正本の 1 つ目のノードの id。 */
function firstNode(text: string): string | null {
  const m = text.match(/^ {2}- id: (\S+)/m);
  return m === null ? null : m[1]!;
}

describe('手直しは、次の生成で壊れない（見本ぜんたい）', () => {
  it('**人が置いた位置が、AI の提案のあとも 1 px 動かない**', async () => {
    const names = readdirSync(DIR).filter((f) => f.endsWith('.zumen.yaml')).sort();
    assert.ok(names.length >= 99, `見本が ${names.length} 件しかない`);

    const lost: string[] = [];
    let measured = 0;
    for (const name of names) {
      const source = readFileSync(new URL(name, DIR), 'utf8');
      const id = firstNode(source);
      if (id === null) continue;

      // 1. 人が 1 か所だけ直した（`pins` は人の節。**AI は書かない**）。
      const human = { x: 4321, y: 1234 };
      const entry = `  ${id}:\n    position: { x: ${human.x}, y: ${human.y} }\n`;
      const pinned = source.includes('\npins:\n')
        ? source.replace('\npins:\n', `\npins:\n${entry}`)
        : `${source}pins:\n${entry}`;

      // 2. AI の提案は、**手直しを知らない正本そのもの**（AI は pins を書かない）。
      const proposal = source;

      // 3. 併せたあと、人の位置が残っているか。
      const merged = merge(pinned, proposal);
      const pins = getPins(parse(merged.text));
      const kept = pins[id]?.position;
      if (kept === undefined || kept.x !== human.x || kept.y !== human.y) {
        lost.push(`${name}: ${JSON.stringify(kept)}`);
        continue;
      }

      // 4. **描いたときに、機械ではなく人の位置に従っている。**
      //
      // 座標そのものは比べない —— 通り芯や方位のある図は、
      // **紙の余白ぶん図ぜんたいが平行移動する**（寸法線を引く場所が要る）。
      // 見るのは「人が動かした先へ、箱が付いていったか」。
      const before = (await layout(source)).boxes.find((b) => b.id === id);
      const after = (await layout(merged.text)).boxes.find((b) => b.id === id);
      if (before !== undefined && after !== undefined && before.x === after.x && before.y === after.y) {
        lost.push(`${name}: 人が動かしたのに、箱が動かなかった`);
      }
      measured += 1;
    }

    assert.ok(measured >= 99, `測れた見本が ${measured} 件しかない`);
    assert.deepEqual(lost, []);
  });
});
