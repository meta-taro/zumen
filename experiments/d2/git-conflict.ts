/**
 * 保存形式が Git の衝突をどこまで抑えられるかを、実際に merge して測る（原案 §26 の 10）。
 *
 * **形式の良し悪しを口で書かない。** 「YAML なら差分が読める」は、実際に 2 人が
 * 別々の場所を直して merge するまで確かめたことにならない。
 *
 * 使い捨ての git リポジトリを作り、branch を分けて merge し、
 * 衝突したかどうかと、衝突したときに何が起きるかを記録する。
 *
 * **同じ 6 場面を 2 通りで回す**（Issue 011）。
 *
 * - **ドライバ無し** — Git の既定の行単位マージ。clone しただけの人が見る挙動
 * - **ドライバ有り** — `merge.zumen.driver` を設定した人が見る挙動
 *
 * 2 通りとも記録するのは、**ドライバの設定を利用の前提にしない**ため。
 * 設定していない人が壊れるなら、そのドライバは配れない。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, serialize, setPin } from '../../src/format.ts';
import { hasError, validate } from '../../src/validate.ts';

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

interface Outcome {
  conflicted: boolean;
  /** 期待どおりか。 */
  ok: boolean;
  /** 衝突した箇所（先頭のみ）。 */
  sample: string;
  /** merge 後の図が、形式として読めるか。**壊れていないことの確認。** */
  readable: boolean;
}

interface Result {
  name: string;
  intent: string;
  conflictIsCorrect: boolean;
  plain: Outcome;
  driver: Outcome;
}

function main(): void {
  const results = SCENARIOS.map(
    (scenario): Result => ({
      name: scenario.name,
      intent: scenario.intent,
      conflictIsCorrect: scenario.conflictIsCorrect,
      plain: runScenario(scenario, false),
      driver: runScenario(scenario, true),
    }),
  );
  const out = report(results);
  mkdirSync(`${HERE}results`, { recursive: true });
  writeFileSync(`${HERE}results/git-conflict.md`, out);
  process.stdout.write(out);
}

/** マージドライバの入口。**利用者の手元でも同じものを設定する。** */
const DRIVER = `node ${HERE}../../src/cli.ts merge-driver %O %A %B`;

function runScenario(scenario: Scenario, useDriver: boolean): Outcome {
  const dir = mkdtempSync(join(tmpdir(), 'zumen-d2-'));
  try {
    const git = (...args: string[]): string =>
      execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' });

    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');

    // .gitattributes はリポジトリに置く。**ドライバの設定は各自の手元**（config）で、
    // 設定していない人は既定の行単位マージへ落ちるだけ。
    writeFileSync(join(dir, '.gitattributes'), '*.zumen.yaml merge=zumen\n');
    if (useDriver) {
      git('config', 'merge.zumen.name', 'zumen structural merge');
      git('config', 'merge.zumen.driver', DRIVER);
    }

    writeFileSync(join(dir, FILE), BASE);
    git('add', FILE, '.gitattributes');
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
      conflicted,
      ok: conflicted === scenario.conflictIsCorrect,
      sample: conflicted ? conflictHunk(merged) : '',
      readable: conflicted ? true : isReadable(merged),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 衝突しなかった結果が、形式として読めるか。
 *
 * **衝突しなければ良い、ではない。** 黙って通したうえで壊れている状態が、
 * いちばん見つかりにくい。
 */
function isReadable(text: string): boolean {
  return !hasError(validate(text));
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
    '同じ 6 場面を 2 通りで回す（Issue 011）。',
    '',
    '- **既定** — Git の行単位マージ。**clone しただけの人が見る挙動**',
    '- **ドライバ** — `merge.zumen.driver` を設定した人が見る挙動',
    '',
    '| 場面 | 期待 | 既定 | 判定 | ドライバ | 判定 |',
    '|---|---|---|---|---|---|',
  ];
  const yes = (o: Outcome): string => (o.conflicted ? 'した' : 'しない');
  const mark = (o: Outcome): string => (o.ok ? 'OK' : '**NG**');

  for (const r of results) {
    const want = r.conflictIsCorrect ? 'するのが正しい' : 'しないのが正しい';
    lines.push(
      `| ${r.name} | ${want} | ${yes(r.plain)} | ${mark(r.plain)} | ${yes(r.driver)} | ${mark(r.driver)} |`,
    );
  }

  const plainNg = results.filter((r) => !r.plain.ok);
  const driverNg = results.filter((r) => !r.driver.ok);
  const broken = results.filter((r) => !r.plain.readable || !r.driver.readable);

  lines.push(
    '',
    `**既定: ${results.length} 場面中 ${results.length - plainNg.length} 場面が期待どおり。**`,
    ...(plainNg.length === 0 ? [] : [`期待と違ったもの: ${plainNg.map((r) => r.name).join(', ')}`]),
    '',
    `**ドライバ有り: ${results.length} 場面中 ${results.length - driverNg.length} 場面が期待どおり。**`,
    ...(driverNg.length === 0 ? [] : [`期待と違ったもの: ${driverNg.map((r) => r.name).join(', ')}`]),
    '',
    broken.length === 0
      ? '**衝突せずに通った結果は、いずれも形式として読める**（黙って壊していない）。'
      : `**読めない結果が出た: ${broken.map((r) => r.name).join(', ')}**`,
  );

  for (const r of results) {
    lines.push('', `## ${r.name}`, '', `**何を確かめたいか**: ${r.intent}`, '');
    const want = r.conflictIsCorrect ? 'するのが正しい' : 'しないのが正しい';
    lines.push(
      `- 既定: 衝突${yes(r.plain)}（${want} → ${r.plain.ok ? 'OK' : 'NG'}）`,
      `- ドライバ: 衝突${yes(r.driver)}（${want} → ${r.driver.ok ? 'OK' : 'NG'}）`,
    );
    if (r.plain.sample !== '') {
      lines.push('', '既定で衝突した箇所:', '', '```yaml', r.plain.sample, '```');
    }
    if (r.driver.sample !== '') {
      lines.push('', 'ドライバで衝突した箇所:', '', '```yaml', r.driver.sample, '```');
    }
  }
  return `${lines.join('\n')}\n`;
}

main();
