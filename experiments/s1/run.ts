/**
 * S1 の往復を実際に回して、記録を残す。
 *
 * `pnpm s1` で走る。外部サービスへは繋がない（ベースルール §4）。
 * AI の役は決め打ちの書き換えで演じる。**保持・反映・競合は機構の性質**であって、
 * 言語モデルの出力ゆらぎの性質ではないため（判定基準 §8）。
 * ただしそれだけでは「丸ごと書き直された場合」を測れないので、
 * 実在の AI が書き直したものを模した提案（fixtures/real-ai-*.yaml）でも 1 周回す。
 *
 * 残すもの（Issue 001 完了条件）— 指示の全文・前後の正本・差分・SVG・3 軸の測定値。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse, serialize, setPin } from './src/format.ts';
import { groupEscapes, layout, overlaps } from './src/layout.ts';
import { measure } from './src/measure.ts';
import type { Expectation, Measurement } from './src/measure.ts';
import { merge, resolve } from './src/merge.ts';
import type { Conflict } from './src/merge.ts';
import { render } from './src/render.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const RESULTS = `${HERE}results`;

function fixture(name: string): string {
  return readFileSync(`${HERE}fixtures/${name}`, 'utf8');
}

interface Round {
  id: string;
  /** 人が打った指示。全文をそのまま残す。 */
  instruction: string;
  /** 人が画面で手を入れた分。 */
  humanEdit?: (text: string) => string;
  /** AI が返した提案。 */
  proposal: (text: string) => string;
  /** 何が起きるはずかを、回す前に書き出したもの。 */
  expectations: Expectation[];
  /** 競合が出たときに人が選ぶ側。 */
  choice?: 'human' | 'ai';
}

const ROUNDS: Round[] = [
  {
    id: 'R1',
    instruction: 'Redis を足して、Web からキャッシュ経路も引いて。',
    humanEdit: (text) => withPin(text, 'db', { position: { x: 620, y: 410 } }),
    proposal: (text) =>
      edit(text, (doc) => {
        pushNode(doc, { id: 'redis', type: 'cache', label: 'Redis', group: 'vpc' });
        pushEdge(doc, { from: 'web01', to: 'redis' });
        pushEdge(doc, { from: 'web02', to: 'redis' });
      }),
    expectations: [
      { kind: 'node-added', id: 'redis' },
      { kind: 'edge-added', from: 'web01', to: 'redis' },
      { kind: 'edge-added', from: 'web02', to: 'redis' },
    ],
  },
  {
    id: 'R2',
    instruction: 'Web を 3 台にして。',
    humanEdit: (text) =>
      withPin(text, 'monitor', { size: { w: 220, h: 80 }, label: '監視（Zabbix）' }),
    proposal: (text) =>
      edit(text, (doc) => {
        pushNode(doc, {
          id: 'web03',
          type: 'server',
          label: 'Web 03',
          technology: 'Apache',
          group: 'vpc',
        });
        pushEdge(doc, { from: 'lb', to: 'web03' });
        pushEdge(doc, { from: 'web03', to: 'db' });
      }),
    expectations: [
      { kind: 'node-added', id: 'web03' },
      { kind: 'edge-added', from: 'lb', to: 'web03' },
      { kind: 'edge-added', from: 'web03', to: 'db' },
    ],
  },
  {
    id: 'R3',
    instruction: 'バックアップは別基盤へ移したので、この図からは外して。',
    humanEdit: (text) => withPin(text, 'web01>db', { waypoints: [{ x: 340, y: 300 }] }),
    proposal: (text) =>
      edit(text, (doc) => {
        dropNode(doc, 'backup');
      }),
    expectations: [
      { kind: 'node-removed', id: 'backup' },
      { kind: 'edge-removed', from: 'replica', to: 'backup' },
    ],
  },
  {
    id: 'R4',
    instruction: 'DB は一番下に置いて。',
    proposal: (text) =>
      edit(text, (doc) => {
        setNodeField(doc, 'db', 'position', { x: 100, y: 1200 });
      }),
    expectations: [],
    choice: 'human',
  },
  {
    id: 'R5',
    instruction: 'DB は一番下に置いて。（R4 と同じ指示をもう一度）',
    proposal: (text) =>
      edit(text, (doc) => {
        setNodeField(doc, 'db', 'position', { x: 100, y: 1200 });
      }),
    expectations: [],
  },
];

interface RoundRecord {
  id: string;
  instruction: string;
  before: string;
  after: string;
  diff: string;
  measurement: Measurement;
  conflicts: Conflict[];
  resolvedAs: 'human' | 'ai' | null;
  overlaps: [string, string][];
  /** 枠からはみ出した子。原案 §26 の 2（pin と自動レイアウトの共存）の観測値。 */
  escapes: string[];
}

async function main(): Promise<void> {
  mkdirSync(RESULTS, { recursive: true });
  const records: RoundRecord[] = [];

  let text = fixture('r0.zumen.yaml');
  writeFileSync(`${RESULTS}/R0.yaml`, text);
  writeFileSync(`${RESULTS}/R0.svg`, render(await layout(text)));

  for (const round of ROUNDS) {
    records.push(await run(round, text, (next) => (text = next)));
  }

  // 実 AI が丸ごと書き直した場合（判定基準 §8）。
  const realBase = withPin(fixture('r0.zumen.yaml'), 'db', { position: { x: 620, y: 410 } });
  for (const [id, name] of [
    ['REAL-1', 'real-ai-r1-proposal.yaml'],
    ['REAL-2', 'real-ai-r1-proposal-renamed.yaml'],
  ] as const) {
    records.push(
      await run(
        {
          id,
          instruction: `Redis を足して、Web からキャッシュ経路も引いて。（実 AI 役 / ${name}）`,
          proposal: () => fixture(name),
          expectations: [
            { kind: 'node-added', id: 'redis' },
            { kind: 'edge-added', from: 'web01', to: 'redis' },
          ],
        },
        realBase,
        () => {},
      ),
    );
  }

  writeFileSync(`${RESULTS}/report.md`, report(records));
  for (const record of records) {
    writeFileSync(`${RESULTS}/${record.id}.yaml`, record.after);
    writeFileSync(`${RESULTS}/${record.id}.diff`, record.diff);
    writeFileSync(`${RESULTS}/${record.id}.svg`, render(await layout(record.after)));
  }
  process.stdout.write(`${records.length} 往復を ${RESULTS} へ書いた\n`);
}

async function run(
  round: Round,
  input: string,
  commit: (text: string) => void,
): Promise<RoundRecord> {
  const before = round.humanEdit === undefined ? input : round.humanEdit(input);
  const result = merge(before, round.proposal(before));

  let after = result.text;
  let resolvedAs: 'human' | 'ai' | null = null;
  if (result.conflicts.length > 0 && round.choice !== undefined) {
    resolvedAs = round.choice;
    for (const conflict of result.conflicts) after = resolve(after, conflict, round.choice);
  }

  commit(after);
  const placed = await layout(after);
  return {
    id: round.id,
    instruction: round.instruction,
    before,
    after,
    diff: unifiedDiff(before, after),
    measurement: measure(before, after, round.expectations),
    conflicts: result.conflicts,
    resolvedAs,
    overlaps: overlaps(placed),
    escapes: groupEscapes(placed),
  };
}

// --- 正本をいじる小道具 ----------------------------------------------------

function edit(text: string, change: (doc: ReturnType<typeof parse>) => void): string {
  const doc = parse(text);
  change(doc);
  return serialize(doc);
}

function withPin(text: string, id: string, pin: Parameters<typeof setPin>[2]): string {
  const doc = parse(text);
  setPin(doc, id, pin);
  return serialize(doc);
}

type Seq = { items: { get(k: string): unknown; set(k: string, v: unknown): void }[] };

function pushNode(doc: ReturnType<typeof parse>, node: Record<string, unknown>): void {
  (doc.doc.get('nodes', true) as Seq).items.push(doc.doc.createNode(node) as never);
}

function pushEdge(doc: ReturnType<typeof parse>, edge: Record<string, unknown>): void {
  (doc.doc.get('edges', true) as Seq).items.push(doc.doc.createNode(edge) as never);
}

function dropNode(doc: ReturnType<typeof parse>, id: string): void {
  const nodes = doc.doc.get('nodes', true) as Seq;
  nodes.items = nodes.items.filter((item) => item.get('id') !== id);
  const edges = doc.doc.get('edges', true) as Seq;
  edges.items = edges.items.filter((item) => item.get('from') !== id && item.get('to') !== id);
}

function setNodeField(
  doc: ReturnType<typeof parse>,
  id: string,
  key: string,
  value: unknown,
): void {
  const nodes = doc.doc.get('nodes', true) as Seq;
  const target = nodes.items.find((item) => item.get('id') === id);
  if (target === undefined) throw new Error(`node not found: ${id}`);
  target.set(key, doc.doc.createNode(value));
}

// --- 差分 ------------------------------------------------------------------

/** 記録用の差分。外部のコマンドに頼らず、どこでも同じものが出るようにする。 */
function unifiedDiff(before: string, after: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      out.push(`- ${a[i]}`);
      i += 1;
    } else {
      out.push(`+ ${b[j]}`);
      j += 1;
    }
  }
  while (i < a.length) out.push(`- ${a[i++]}`);
  while (j < b.length) out.push(`+ ${b[j++]}`);
  return out.join('\n');
}

// --- 記録 ------------------------------------------------------------------

function report(records: RoundRecord[]): string {
  const lines = [
    '# S1 往復ログ（自動生成 — `pnpm s1`）',
    '',
    '判定基準: `docs/specs/s1-判定基準-手直しの保持.md`',
    '',
    '**この表は測定値であって判定ではない。** 判定は `.claude/issues/001-*.md` の結果欄に書く。',
    '',
    '| 往復 | 保持 Tier A | 保持 Tier B | 反映 | 競合 | 重なり | 枠外 |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const r of records) {
    const a = r.measurement.tierA;
    const b = r.measurement.tierB;
    const f = r.measurement.reflection;
    lines.push(
      `| ${r.id} | ${a.kept}/${a.total} | ${b.kept}/${b.total} | ${f.applied}/${f.expected} | ${r.conflicts.length} | ${r.overlaps.length} | ${r.escapes.length} |`,
    );
  }

  for (const r of records) {
    const a = r.measurement.tierA;
    const b = r.measurement.tierB;
    const f = r.measurement.reflection;
    lines.push(
      '',
      `## ${r.id}`,
      '',
      `**指示**: ${r.instruction}`,
      '',
      `- 保持 Tier A: **${a.kept}/${a.total}**${a.lost.length === 0 ? '' : ` — 失われた: ${a.lost.join(', ')}`}`,
      `- 保持 Tier B: **${b.kept}/${b.total}**${b.lost.length === 0 ? '' : ` — 失われた: ${b.lost.join(', ')}`}`,
      `- 反映: **${f.applied}/${f.expected}**${f.missing.length === 0 ? '' : ` — 入らなかった: ${f.missing.join(', ')}`}`,
      `- 競合: ${r.conflicts.length === 0 ? 'なし' : JSON.stringify(r.conflicts)}`,
      `- 人が選んだ側: ${r.resolvedAs ?? '（選択なし）'}`,
      `- 重なり: ${r.overlaps.length === 0 ? 'なし' : r.overlaps.map((p) => p.join(' × ')).join(', ')}`,
      `- 枠外へ出た子: ${r.escapes.length === 0 ? 'なし' : r.escapes.join(', ')}`,
      '',
      '```diff',
      r.diff.split('\n').filter((line) => !line.startsWith('  ')).join('\n'),
      '```',
    );
  }
  return `${lines.join('\n')}\n`;
}

await main();
