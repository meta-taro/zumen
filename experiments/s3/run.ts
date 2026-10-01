/**
 * 「9 割」の基準線を取る（Issue 003 / D3）。`pnpm s3` で再生成できる。
 *
 * **この時点で数字が良いことに意味は無い。** 意味があるのは、
 * **後から下がっていないことを確かめられる**ことのほう。
 *
 * 3 種類を測る。
 *
 * 1. **基準の図**（`fixtures/`）— 実在の構成から起こした 2 枚。手直し前の姿
 * 2. **S1 の往復の結果**（`experiments/s1/results/`）— **人が実際に手を入れた後**の姿。
 *    基準線として意味を持つのはこちら
 * 3. **わざと並べ直した図** — **指標が悪化することの確認**（Issue 003 の完了条件）
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, serialize, setPin } from '../../src/format.ts';
import { PASS_LINE, measure, percent } from '../../src/measure.ts';
import type { Measurement } from '../../src/measure.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const S1 = join(HERE, '../s1/results');

interface Row {
  name: string;
  measurement: Measurement;
}

function main(): void {
  const base = files(join(HERE, 'fixtures')).map(row);
  const rounds = files(S1).map(row);
  const wrecked = base.map((entry) => ({
    name: `${entry.name}（全部を手で並べ直した場合）`,
    measurement: measure(placeEverything(readAll(join(HERE, 'fixtures'), entry.name))),
  }));

  mkdirSync(join(HERE, 'results'), { recursive: true });
  const out = report(base, rounds, wrecked);
  writeFileSync(join(HERE, 'results/baseline.md'), out);
  process.stdout.write(out);
}

function files(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.yaml'))
    .sort();
}

function readAll(dir: string, name: string): string {
  return readFileSync(join(dir, name), 'utf8');
}

function row(name: string): Row {
  const dir = name.endsWith('.zumen.yaml') ? join(HERE, 'fixtures') : S1;
  return { name, measurement: measure(readAll(dir, name)) };
}

/** 全ノードに位置を書く。**指標が悪化することを確かめるための、わざとの壊し方。** */
function placeEverything(text: string): string {
  const doc = parse(text);
  let x = 0;
  for (const id of doc.nodeIds()) {
    x += 200;
    setPin(doc, id, { position: { x, y: 100 } });
  }
  return serialize(doc);
}

function table(rows: Row[]): string[] {
  const lines = ['| 図 | 要素 | 手直し | 配置の手直し | 自力率 | 配置の自力率 | 判定 |', '|---|---|---|---|---|---|---|'];
  for (const { name, measurement: m } of rows) {
    lines.push(
      `| ${name} | ${m.elements} | ${m.touched} | ${m.placed} | ${percent(m.autonomy)} | ${percent(m.layoutAutonomy)} | ${m.pass ? 'OK' : '**NG**'} |`,
    );
  }
  return lines;
}

function report(base: Row[], rounds: Row[], wrecked: Row[]): string {
  const lines = [
    '# 「9 割」の基準線（自動生成 — `pnpm s3`）',
    '',
    '**この時点で数字が良いことに意味は無い。**',
    '意味があるのは、**後から下がっていないことを確かめられる**ことのほう。',
    '',
    `合格ライン: **自力率・配置の自力率とも ${percent(PASS_LINE)} 以上**。`,
    '定義は `docs/specs/003-9割の定義.md`、実装は `src/measure.ts`。',
    '',
    '## 1. 基準の図（手直し前）',
    '',
    '**実在の構成から起こした 2 枚**（架空の綺麗な例で測らない）。',
    'まだ誰も手を入れていないので 100% になる。**ここは出発点であって成績ではない。**',
    '',
    ...table(base),
    '',
    '## 2. S1 の往復の結果（人が実際に手を入れた後）',
    '',
    '**基準線として意味を持つのはこちら。**',
    '人が手直しを入れたうえで、どこまで自動のままでいられたか。',
    '',
    ...table(rounds),
    '',
    '## 3. わざと全部を並べ直した場合',
    '',
    '**指標が悪化することの確認**（Issue 003 の完了条件）。',
    '悪化しない指標は、この企画では役に立たない。',
    '',
    ...table(wrecked),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

main();
