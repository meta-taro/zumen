/**
 * 保存形式が Git の衝突をどこまで抑えられるかを、実際に merge して測る（原案 §26 の 10）。
 *
 * **形式の良し悪しを口で書かない。** 「YAML なら差分が読める」は、実際に 2 人が
 * 別々の場所を直して merge するまで確かめたことにならない。
 *
 * 使い捨ての git リポジトリを作り、branch を分けて merge し、
 * 衝突したかどうかと、衝突したときに何が起きるかを記録する。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, serialize, setPin } from '../../src/format.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const BASE = readFileSync(`${HERE}../../test/fixtures/r0.zumen.yaml`, 'utf8');
const FILE = 'diagram.zumen.yaml';

interface Scenario {
  name: string;
  /** 何を確かめたいか。 */
  intent: string;
  ours: (text: string) => string;
  theirs: (text: string) => string;
  /** 衝突してよいか。人が同じ場所を別の値へ直したなら、衝突するのが正しい。 */
  conflictIsCorrect: boolean;
}

const SCENARIOS: Scenario[] = [
  {
    name: '2 人が別々のノードを動かす',
    intent: 'いちばん普通に起きる形。ここで衝突するなら、複数人では使えない',
    ours: (text) => pin(text, 'db', { position: { x: 620, y: 410 } }),
    theirs: (text) => pin(text, 'lb', { position: { x: 100, y: 100 } }),
    conflictIsCorrect: false,
  },
  {
    name: '2 人が別々のノードを足す',
    intent: '末尾へ足す形式は、追加どうしがぶつかりやすい',
    ours: (text) => addNode(text, { id: 'redis', type: 'cache', label: 'Redis' }),
    theirs: (text) => addNode(text, { id: 'mq', type: 'queue', label: 'RabbitMQ' }),
    conflictIsCorrect: false,
  },
  {
    name: '2 人が別々のノードのラベルを直す',
    intent: '同じ nodes 節の中の、別の行を直した場合',
    ours: (text) => setLabel(text, 'db', 'MariaDB 10.11'),
    theirs: (text) => setLabel(text, 'replica', 'MariaDB Replica (RO)'),
    conflictIsCorrect: false,
  },
  {
    name: '一方がノードを足し、他方がラベルを直す',
    intent: '追加と変更の組み合わせ',
    ours: (text) => addNode(text, { id: 'redis', type: 'cache', label: 'Redis' }),
    theirs: (text) => setLabel(text, 'db', 'MariaDB 10.11'),
    conflictIsCorrect: false,
  },
  {
    name: '2 人が同じノードを別の場所へ動かす',
    intent: '本当にぶつかっている。衝突しないほうがおかしい',
    ours: (text) => pin(text, 'db', { position: { x: 620, y: 410 } }),
    theirs: (text) => pin(text, 'db', { position: { x: 100, y: 900 } }),
    conflictIsCorrect: true,
  },
  {
    name: '2 人が隣り合うノードのラベルを直す',
    intent: '行が近いと、3-way merge は諦めやすい。どこまで近づけると落ちるか',
    ours: (text) => setLabel(text, 'web01', 'Web 01 (nginx)'),
    theirs: (text) => setLabel(text, 'web02', 'Web 02 (nginx)'),
    conflictIsCorrect: false,
  },
];

interface Result {
  name: string;
  intent: string;
  conflicted: boolean;
  conflictIsCorrect: boolean;
  /** 期待どおりか。 */
  ok: boolean;
  /** 衝突したファイルの中身（先頭のみ）。 */
  sample: string;
}

function main(): void {
  const results = SCENARIOS.map(runScenario);
  const out = report(results);
  mkdirSync(`${HERE}results`, { recursive: true });
  writeFileSync(`${HERE}results/git-conflict.md`, out);
  process.stdout.write(out);
}

function runScenario(scenario: Scenario): Result {
  const dir = mkdtempSync(join(tmpdir(), 'zumen-d2-'));
  try {
    const git = (...args: string[]): string =>
      execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    writeFileSync(join(dir, FILE), BASE);
    git('add', FILE);
    git('commit', '-q', '-m', 'base');

    git('checkout', '-q', '-b', 'theirs');
    writeFileSync(join(dir, FILE), scenario.theirs(BASE));
    git('commit', '-q', '-am', 'theirs');

    git('checkout', '-q', 'main');
    writeFileSync(join(dir, FILE), scenario.ours(BASE));
    git('commit', '-q', '-am', 'ours');

    let conflicted = false;
    try {
      git('merge', '--no-edit', 'theirs');
    } catch {
      conflicted = true;
    }

    const merged = readFileSync(join(dir, FILE), 'utf8');
    return {
      name: scenario.name,
      intent: scenario.intent,
      conflicted,
      conflictIsCorrect: scenario.conflictIsCorrect,
      ok: conflicted === scenario.conflictIsCorrect,
      sample: conflicted ? conflictHunk(merged) : '',
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 衝突した箇所だけを取り出す。全文を載せても読めない。 */
function conflictHunk(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith('<<<<<<<'));
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && line.startsWith('>>>>>>>'));
  return lines.slice(start, end + 1).join('\n');
}

// --- 正本をいじる小道具 ----------------------------------------------------

function pin(text: string, id: string, value: Parameters<typeof setPin>[2]): string {
  const doc = parse(text);
  setPin(doc, id, value);
  return serialize(doc);
}

type Seq = { items: { get(k: string): unknown; set(k: string, v: unknown): void }[] };

function addNode(text: string, node: Record<string, unknown>): string {
  const doc = parse(text);
  const added = doc.doc.createNode(node) as { spaceBefore: boolean };
  added.spaceBefore = true;
  (doc.doc.get('nodes', true) as Seq).items.push(added as never);
  return serialize(doc);
}

function setLabel(text: string, id: string, label: string): string {
  const doc = parse(text);
  const nodes = doc.doc.get('nodes', true) as Seq;
  const target = nodes.items.find((item) => item.get('id') === id);
  if (target === undefined) throw new Error(`node not found: ${id}`);
  target.set('label', doc.doc.createNode(label));
  return serialize(doc);
}

// --- 記録 ------------------------------------------------------------------

function report(results: Result[]): string {
  const lines = [
    '# Git の衝突（自動生成 — `pnpm d2:conflict`）',
    '',
    '原案 §26 の 10。**形式の良し悪しを口で書かず、実際に merge して測る。**',
    '',
    '使い捨ての git リポジトリで branch を 2 本作り、それぞれが別の直し方をしてから',
    'merge する。「衝突しないのが正しい」場合と「衝突するのが正しい」場合の両方を置く。',
    '**衝突しなければ良い形式、ではない。** 本当にぶつかっているのに黙って通す形式は、',
    '人の直しを片方だけ消す。',
    '',
    '| 場面 | 衝突 | 期待 | 判定 |',
    '|---|---|---|---|',
  ];
  for (const r of results) {
    lines.push(
      `| ${r.name} | ${r.conflicted ? 'した' : 'しない'} | ${r.conflictIsCorrect ? 'するのが正しい' : 'しないのが正しい'} | ${r.ok ? 'OK' : '**NG**'} |`,
    );
  }
  const ng = results.filter((r) => !r.ok);
  lines.push(
    '',
    `**${results.length} 場面中 ${results.length - ng.length} 場面が期待どおり。**`,
    ...(ng.length === 0 ? [] : [`期待と違ったもの: ${ng.map((r) => r.name).join(', ')}`]),
  );

  for (const r of results) {
    lines.push('', `## ${r.name}`, '', `**何を確かめたいか**: ${r.intent}`, '');
    lines.push(
      `- 衝突: ${r.conflicted ? 'した' : 'しない'}（${r.conflictIsCorrect ? 'するのが正しい' : 'しないのが正しい'} → ${r.ok ? 'OK' : 'NG'}）`,
    );
    if (r.sample !== '') {
      lines.push('', '衝突した箇所:', '', '```yaml', r.sample, '```');
    }
  }
  return `${lines.join('\n')}\n`;
}

main();
