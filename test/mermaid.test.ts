/**
 * Mermaid 書き出し。**「翌日読める」を約束ではなく実物にする**ためのもの。
 *
 * ここで大事なのは、綺麗に出ることではなく **落ちたものが読める形で残ること**。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parse, serialize, setPin } from '../src/format.ts';
import { toMermaid } from '../src/mermaid.ts';
import { messages } from '../src/messages.ts';
import { APPEARANCE } from '../src/tokens.ts';

/** 手直しが落ちることの断り書き。**文面ではなく、出ているかどうかだけを見る。** */
const NOTE = messages().mermaid.geometryDroppedHeading;

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

describe('toMermaid', () => {
  it('Mermaid として成立する形で始まる', () => {
    // **向きは正本が決める**（既定は横）。ここで見たいのは
    // 「題のコメントの次に図の宣言が来る」ことで、向きの値ではない。
    assert.match(toMermaid(R0), /^%% 本番構成\nflowchart (LR|TD)\n/);
  });

  it('グループが subgraph になり、中身が入る', () => {
    const out = toMermaid(R0);
    assert.match(out, /  subgraph vpc\["Production VPC"\]\n(?:.*\n)*?  end\n/);
    assert.match(out, /    lb\["Load Balancer"\]/);
  });

  it('グループに属さないノードは subgraph の外に出る', () => {
    const out = toMermaid(R0);
    const end = out.indexOf('  end');
    assert.equal(out.indexOf('  internet(("Internet"))') > end, true);
  });

  it('型ごとに形が変わる', () => {
    const out = toMermaid(R0);
    assert.match(out, /db\[\("MariaDB"\)\]/);
    assert.match(out, /backup\[\["Backup Storage"\]\]/);
    assert.match(out, /internet\(\("Internet"\)\)/);
  });

  it('エッジと、その札が出る', () => {
    const out = toMermaid(R0);
    assert.match(out, /\n  lb --> web01\n/);
    assert.match(out, /\n  internet -->\|"HTTPS"\| lb\n/);
    assert.match(out, /\n  db -->\|"replication"\| replica\n/);
  });

  it('ノード数とエッジ数が落ちていない', () => {
    const out = toMermaid(R0);
    assert.equal((out.match(/^ {2,4}\w+[[({]/gm) ?? []).length, 8);
    assert.equal((out.match(/-->/g) ?? []).length, 8);
  });
});

describe('Mermaid のパーサが通る形か', () => {
  // mermaid 本体は重いので依存には入れていない。実物のパーサでの確認は
  // experiments/d2/results/mermaid-validation.md に記録してある（mermaid 11.17.2）。
  // ここに置くのは、そこで実際に落ちた形の再発防止。

  it('中身の無い %% 行を書かない', () => {
    // 中身の無い `%%` は Mermaid でコメントと見なされず、次の行と繋がって
    // `%%%%flowchart TD` になり、構文エラーになる。実物のパーサで踏んだ。
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    for (const line of toMermaid(serialize(doc)).split('\n')) {
      assert.notEqual(line.trim(), '%%', '中身の無い %% 行がある');
    }
  });

  it('図の宣言より前にあるのはコメントだけ', () => {
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    const out = toMermaid(serialize(doc)).split('\n');
    const head = out.slice(0, out.findIndex((line) => line.startsWith('flowchart ')));
    for (const line of head) assert.match(line, /^%% /, `コメントでない行: ${line}`);
  });
});

describe('落ちるものの扱い', () => {
  it('人の手直しがあると、失われる指定を先頭で名指しする', () => {
    // 黙って落とすと、書き出した図を見た人は「元からこうだった」と思う。
    const doc = parse(R0);
    setPin(doc, 'db', { position: { x: 620, y: 410 } });
    setPin(doc, 'monitor', { size: { w: 220, h: 80 } });
    const out = toMermaid(serialize(doc));
    assert.match(out, /Mermaid には位置・大きさ・線の曲げ方を書く場所が無い/);
    assert.match(out, /%% {3}- db: position/);
    assert.match(out, /%% {3}- monitor: size/);
    // ラベルは Mermaid で表せる。落ちた扱いにしない。
    assert.doesNotMatch(out, /- monitor: [^\n]*label/);
    assert.match(out, /正本は \.zumen\.yaml の側/);
  });

  it('人が直したラベルは、書き出しにも反映される', () => {
    // 表せるものを落とすのは、ただの手抜き。
    const doc = parse(R0);
    setPin(doc, 'monitor', { label: '監視（Zabbix）', size: { w: 220, h: 80 } });
    const out = toMermaid(serialize(doc));
    assert.match(out, /monitor\["監視（Zabbix）"\]/);
    assert.doesNotMatch(out, /"Monitoring"/);
  });

  it('人が指定した体裁は classDef として出る', () => {
    const doc = parse(R0);
    setPin(doc, 'db', { appearance: 'primary' });
    const out = toMermaid(serialize(doc));
    // 色の値そのものは見ない。**人が配色を変えてもここは落ちない。**
    const look = APPEARANCE['primary']!;
    assert.ok(out.includes(`  classDef primary fill:${look.fill},stroke:${look.stroke}`));
    assert.match(out, /  class db primary/);
    // 体裁だけなら失われるものは無い。
    assert.ok(!out.includes(NOTE));
  });

  it('手直しが無ければ、注意書きは出さない', () => {
    assert.ok(!toMermaid(R0).includes(NOTE));
  });

  it('ラベルの二重引用符で記法が壊れない', () => {
    const doc = parse(R0);
    const nodes = doc.doc.get('nodes', true) as {
      items: { get(k: string): unknown; set(k: string, v: unknown): void }[];
    };
    nodes.items.find((n) => n.get('id') === 'db')!.set('label', doc.doc.createNode('DB "本番"'));
    const out = toMermaid(serialize(doc));
    assert.match(out, /db\[\("DB &quot;本番&quot;"\)\]/);
  });
});

describe('書き出し先で、同じ正本から同じ図が出る', () => {
  it('**向きが正本どおりに出る。** 既定は横なので `flowchart LR`', () => {
    const out = toMermaid('version: 1\nnodes:\n  - id: a\n  - id: b\nedges:\n  - from: a\n    to: b\n');
    assert.match(out, /flowchart LR/, 'SVG は横なのに Mermaid が縦になっている');
  });

  it('`direction: down` なら `flowchart TD`', () => {
    const out = toMermaid('version: 1\ndirection: down\nnodes:\n  - id: a\n');
    assert.match(out, /flowchart TD/);
  });

  it('**副題（technology）が落ちない**', () => {
    const out = toMermaid('version: 1\nnodes:\n  - id: a\n    label: DB\n    technology: PostgreSQL 16\n');
    assert.ok(out.includes('PostgreSQL 16'), '副題が黙って落ちた');
  });

  it('**符号（tag）が落ちない**', () => {
    const out = toMermaid('version: 1\nnodes:\n  - id: c1\n    label: 柱\n    tag: C1\n');
    assert.ok(out.includes('C1'), '符号が黙って落ちた');
  });

  it('符号と副題は、ラベルと別の行になる（1 つの名前に潰さない）', () => {
    const out = toMermaid('version: 1\nnodes:\n  - id: c1\n    label: 柱\n    tag: C1\n    technology: 700×700\n');
    const m = out.match(/c1\["([^"]*)"\]/)!;
    assert.equal(m[1], 'C1<br>柱<br>700×700');
  });

  it('符号も副題も無ければ、ラベルだけのまま', () => {
    const out = toMermaid('version: 1\nnodes:\n  - id: a\n    label: あ\n');
    assert.match(out, /a\["あ"\]/);
  });
});
