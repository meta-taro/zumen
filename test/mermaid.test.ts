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

/** 手直しが落ちることの断り書き。**文面ではなく、出ているかどうかだけを見る。** */
const NOTE = messages().mermaid.geometryDroppedHeading;

const R0 = readFileSync(new URL('fixtures/r0.zumen.yaml', import.meta.url), 'utf8');

describe('toMermaid', () => {
  it('Mermaid として成立する形で始まる', () => {
    assert.match(toMermaid(R0), /^%% 本番構成\nflowchart TD\n/);
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
    const head = out.slice(0, out.indexOf('flowchart TD'));
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
    assert.match(out, /  classDef primary fill:#dbeafe,stroke:#1d4ed8/);
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
