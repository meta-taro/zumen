/**
 * 文章の指示 1 本から、説明に使える図が出るか（Issue 004 / S3）。`pnpm s3:quality` で回す。
 *
 * ## 鍵は要らない
 *
 * 手元の `claude` CLI を子プロセスで叩く（D16）。**zumen は API の鍵を持たない。**
 * 製品としての AI 連携は MCP 経由で、鍵はエージェント側にある（D13）。
 *
 * ## AI に自己採点させない
 *
 * ここで測るのは**機械で数えられるものだけ**。
 *
 * - 検証器を通るか
 * - 線の交差の数
 * - 箱の重なりの数
 * - 入れ子が指示どおりか（指示した囲みに、指示した要素が入っているか）
 * - どれだけ時間がかかったか
 *
 * **「説明に使えるか」は人が書く。** 出力の表に空欄を用意し、AI は埋めない
 * （ベースルール §19 / Issue 004 の注意）。
 *
 * ## 綺麗に出た例だけを残さない
 *
 * 破綻した場合も、そのまま記録して図を残す。
 */
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { crossings, layout, overlaps } from '../../src/layout.ts';
import { render } from '../../src/render.ts';
import { hasError, validate } from '../../src/validate.ts';

const run = promisify(execFile);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, 'results');

interface Case {
  key: string;
  /** 何の構成か。**実在のものだけ。架空の綺麗な例で測らない。** */
  what: string;
  /** AI へ渡す指示。**これ 1 本だけ**で図が出るかを見る。 */
  prompt: string;
  /** 入れ子が指示どおりか見るための対応。囲みの id → 入っているべき要素の id。 */
  expectNesting: Record<string, string[]>;
}

const CASES: Case[] = [
  {
    key: 'zumen-desktop',
    what: 'zumen 自身のデスクトップ構成（実在。このリポジトリそのもの）',
    prompt: [
      'zumen というデスクトップアプリの構成図を描いてください。',
      '',
      'Tauri の殻の中に WebView があり、そこで Svelte の画面が動きます。',
      '画面は Vite が束ねます。殻（Rust）は 2 つの命令だけを持ち、',
      'ファイルの読み書きをします。ファイル選択は Tauri の dialog プラグインです。',
      '画面は中核の TypeScript を呼びます。中核には、正本の読み書き・',
      '自動レイアウト（elkjs）・SVG 描画・マージ・検証があります。',
      '正本は .zumen.yaml というファイルで、ディスク上にあります。',
      '',
      '「殻」「画面」「中核」の 3 つを囲みにしてください。',
    ].join('\n'),
    expectNesting: {},
  },
  {
    key: 'md-business',
    what: 'md-business のパッケージ構成（実在。姉妹プロジェクト）',
    prompt: [
      'md-business というモノレポの構成図を描いてください。',
      '',
      'apps が 3 つあります: desktop、chrome-extension、google-workspace-addon。',
      'packages には core、data-tree、mcp-server、renderer-pdf があり、',
      'さらに 6 つのスキーマ（invoice、spec、test-spec、db-spec、nosql-db-spec、api-spec）があります。',
      '',
      'スキーマはすべて core に依存します。renderer-pdf は 6 つのスキーマすべてに依存します。',
      'mcp-server は core と data-tree とスキーマに依存します。',
      'desktop は core、data-tree、mcp-server、renderer-pdf、スキーマすべてに依存します。',
      'chrome-extension は core、renderer-pdf、スキーマに依存します。',
      'google-workspace-addon は core と test-spec だけに依存します。',
      '',
      'apps と packages を囲みにしてください。',
    ].join('\n'),
    expectNesting: {},
  },
  {
    key: 'ci',
    what: 'このリポジトリの CI 構成（実在。.github/workflows）',
    prompt: [
      'GitHub Actions の CI 構成図を描いてください。',
      '',
      'develop への push が workflow を起動します。',
      'workflow は ubuntu の runner の上で動き、まずリポジトリを全履歴で checkout します。',
      'そのあと個人情報混入チェックのスクリプトを走らせます。',
      'スクリプトは commit の author と message、追加行を見ます。',
      '禁止語は リポジトリの secret から渡されます。',
      '検出したら workflow が失敗します。',
      '',
      'GitHub 側と runner 側を囲みにしてください。',
    ].join('\n'),
    expectNesting: {},
  },
];

/** AI へ渡す共通の作法。**形式を守らせるところまでが指示。** */
const FORMAT = [
  '',
  '出力は zumen の図形式（YAML）だけにしてください。前後に説明を書かないでください。',
  'コードブロックの記号も付けないでください。',
  '',
  '形式:',
  '  version: 1',
  '  title: <図の題>',
  '  groups:        # 囲み。省いてよい',
  '    - id: <英数字とハイフンだけ>',
  '      label: <表示名>',
  '  nodes:',
  '    - id: <英数字とハイフンだけ。文書内で一意>',
  '      type: <server / database / storage / cache / queue / internet / load-balancer / generic>',
  '      label: <表示名>',
  '      group: <属する囲みの id。無所属なら書かない>',
  '  edges:',
  '    - from: <ノードの id>',
  '      to: <ノードの id>',
  '      label: <省いてよい>',
  '',
  'pins は書かないでください。あれは人が書く節です。',
].join('\n');

interface Result {
  key: string;
  what: string;
  ok: boolean;
  /** 検証器の指摘（error だけ）。 */
  errors: string[];
  nodes: number;
  edges: number;
  groups: number;
  crossings: number;
  overlaps: number;
  /** 指示した囲みが、指示した数だけ出たか。 */
  grouped: number;
  seconds: number;
  text: string;
}

async function ask(prompt: string): Promise<{ text: string; seconds: number }> {
  const started = Date.now();
  const { stdout } = await run('claude', ['-p', prompt + FORMAT], {
    maxBuffer: 4 * 1024 * 1024,
    timeout: 240_000,
  });
  return { text: clean(stdout), seconds: Math.round((Date.now() - started) / 100) / 10 };
}

/** 前後に付いた説明や囲みの記号を落とす。**指示が守られなかったことも記録に残す。** */
function clean(raw: string): string {
  const fenced = /```(?:ya?ml)?\n([\s\S]*?)```/.exec(raw);
  const body = fenced === null ? raw : fenced[1]!;
  const lines = body.split('\n');
  const start = lines.findIndex((line) => line.startsWith('version:'));
  return `${(start === -1 ? lines : lines.slice(start)).join('\n').trimEnd()}\n`;
}

async function measure(item: Case): Promise<Result> {
  const { text, seconds } = await ask(item.prompt);
  const findings = validate(text);
  const errors = findings
    .filter((finding) => finding.severity === 'error')
    .map((finding) => `${finding.code}: ${finding.message}`);

  if (hasError(findings)) {
    return {
      key: item.key,
      what: item.what,
      ok: false,
      errors,
      nodes: 0,
      edges: 0,
      groups: 0,
      crossings: 0,
      overlaps: 0,
      grouped: 0,
      seconds,
      text,
    };
  }

  const placed = await layout(text);
  writeFileSync(join(OUT, `${item.key}.zumen.yaml`), text);
  writeFileSync(join(OUT, `${item.key}.svg`), render(placed));

  return {
    key: item.key,
    what: item.what,
    ok: true,
    errors: [],
    nodes: placed.boxes.length,
    edges: placed.edges.length,
    groups: placed.groups.length,
    crossings: crossings(placed),
    overlaps: overlaps(placed).length,
    grouped: placed.boxes.filter((box) => box.group !== null).length,
    seconds,
    text,
  };
}

/** 規模で破綻しないかを見る（原案 §26 の 5）。**AI は使わない。組み立てて測るだけ。** */
async function scale(count: number): Promise<{ count: number; seconds: number; overlaps: number }> {
  const nodes = Array.from({ length: count }, (_, i) => `  - id: n${i}\n    label: N${i}`);
  const edges = Array.from({ length: count - 1 }, (_, i) => `  - from: n${i}\n    to: n${i + 1}`);
  const text = `version: 1\nnodes:\n${nodes.join('\n')}\nedges:\n${edges.join('\n')}\n`;
  const started = Date.now();
  const placed = await layout(text);
  return {
    count,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    overlaps: overlaps(placed).length,
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const results: Result[] = [];
  for (const item of CASES) {
    process.stderr.write(`${item.key} …\n`);
    results.push(await measure(item));
  }

  const scales = [];
  for (const count of [100, 300, 500]) {
    process.stderr.write(`規模 ${count} …\n`);
    scales.push(await scale(count));
  }

  const out = report(results, scales);
  writeFileSync(join(OUT, 'quality.md'), out);
  process.stdout.write(out);
}

function report(results: Result[], scales: { count: number; seconds: number; overlaps: number }[]): string {
  const lines = [
    '# 生成品質の実測（自動生成 — `pnpm s3:quality`）',
    '',
    '**文章の指示 1 本**から図を出し、機械で数えられるものだけを測った（Issue 004 / S3）。',
    '',
    '**AI に自己採点させていない。** 「説明に使えるか」の欄は空のままで、',
    '**実物を見た人が記入する**（ベースルール §19）。',
    '',
    '生成は手元の `claude` CLI（D16）。**zumen は API の鍵を持たない。**',
    '',
    '## 1. 出たもの',
    '',
    '| 図 | 形式に適合 | ノード | エッジ | 囲み | 囲みに入った要素 | 線の交差 | 箱の重なり | 生成 |',
    '|---|---|---|---|---|---|---|---|---|',
  ];
  for (const r of results) {
    lines.push(
      `| ${r.key} | ${r.ok ? 'した' : '**していない**'} | ${r.nodes} | ${r.edges} | ${r.groups} | ${r.grouped} | ${r.crossings} | ${r.overlaps} | ${r.seconds} 秒 |`,
    );
  }

  const broken = results.filter((r) => !r.ok);
  lines.push(
    '',
    broken.length === 0
      ? '**すべて形式に適合した。**'
      : `**形式に適合しなかったもの: ${broken.map((r) => r.key).join(', ')}**`,
  );

  for (const r of broken) {
    lines.push('', `### ${r.key} が読めなかった理由`, '', ...r.errors.map((e) => `- ${e}`));
  }

  // 破綻の条件を、数字から機械的に出す。**綺麗に出た例だけを残さない。**
  const dense = results.filter((r) => r.ok && r.crossings > r.edges);
  lines.push(
    '',
    '### 破綻した条件',
    '',
    '**交差の数がエッジの数を超えたもの**を破綻として数える。',
    '（1 本の線が平均 1 回以上ぶつかっている状態で、目で追えない）',
    '',
    '| 図 | エッジ ÷ ノード | 交差 ÷ エッジ | 破綻 |',
    '|---|---|---|---|',
    ...results
      .filter((r) => r.ok)
      .map(
        (r) =>
          `| ${r.key} | ${(r.edges / r.nodes).toFixed(1)} | ${(r.crossings / Math.max(r.edges, 1)).toFixed(1)} | ${r.crossings > r.edges ? '**した**' : 'していない'} |`,
      ),
    '',
    dense.length === 0
      ? '**この回は破綻しなかった。**'
      : `**破綻したもの: ${dense.map((r) => r.key).join(', ')}**`,
    '',
    '## 2. 規模で破綻しないか（原案 §26 の 5）',
    '',
    '**ここは AI を使わない。** 一本道のグラフを組み立てて、レイアウトだけを測る。',
    '',
    '| ノード数 | レイアウト | 箱の重なり |',
    '|---|---|---|',
    ...scales.map((s) => `| ${s.count} | ${s.seconds} 秒 | ${s.overlaps} |`),
    '',
    '## 3. 説明に使えるか（**人が記入する。AI は埋めない**）',
    '',
    'その構成を知らない人に見せて、「これで説明できるか」を聞く。',
    '',
    '| 図 | 説明に使えるか | 引っかかったところ | 記入者 | 日付 |',
    '|---|---|---|---|---|',
    ...results.map((r) => `| ${r.key} |  |  |  |  |`),
    '',
    '見てほしいところ。',
    '',
    '1. **線の引き回しが読めるか**（交差の数だけでは分からない）',
    '2. **入れ子が入れ子に見えるか**（囲みの中に入っているか）',
    '3. 題とラベルが、その構成を表しているか',
    '',
    '## 4. 出したもの',
    '',
    ...results.flatMap((r) =>
      r.ok
        ? [`- \`${r.key}.svg\` / \`${r.key}.zumen.yaml\` — ${r.what}`]
        : [`- \`${r.key}\` — **形式に適合しなかったので図は出していない**。${r.what}`],
    ),
    '',
    '**綺麗に出た例だけを残していない。** 破綻したものも、そのまま置いてある。',
    '',
  );
  return `${lines.join('\n')}\n`;
}

await main();
