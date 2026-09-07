/**
 * 本物の AI に何度も提案させて、**手直しの保持がばらつかないか**を測る。
 * `pnpm s1:real` で走る。
 *
 * ## なぜ要るか
 *
 * **S1 はこの企画の Go / No-Go の関門**（Issue 001）。
 * だがその根拠は、既存の `pnpm s1` では**決め打ちの書き換え**で作った提案に依っている。
 * 「実 AI 役」の 2 回も、**このセッションのモデルが手で書いたもの**だった。
 *
 * 既知の問題としてこう書いてあった。
 *
 * > 実 AI 役の提案は、このセッションのモデルが書いたもの。
 * > **API 経由で多数の試行を回したばらつきは測っていない**
 *
 * ここを埋める。
 *
 * ## 既存の `pnpm s1` は触らない
 *
 * あちらは**外部へ繋がず、同じ結果が出る**ことに意味がある（ベースルール §4）。
 * 本物の AI を混ぜると再現しなくなる。**別の実験として置く。**
 *
 * ## 測るもの
 *
 * 毎回、
 *
 * 1. 人が 3 か所に手直しを入れた正本を用意する
 * 2. **AI には正本を丸ごと渡し、丸ごと書き直させる**（実運用でいちばん起きる形）
 * 3. 返ってきた提案を `merge()` で人の正本へ入れる
 * 4. **人の手直しが 1 つでも消えていないか**を数える
 *
 * 合格線は Tier A（位置・大きさ・ラベル）が **100%**。
 * **1 回でも割ったら、その回を残して報告する。** 平均で隠さない。
 *
 * ## AI に自己採点させない
 *
 * 数えるのは機械。AI は図を書くだけ。
 */
import { execFile } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { getPins, parse, serialize, setPin } from '../../src/format.ts';
import { merge } from '../../src/merge.ts';
import { hasError, validate } from '../../src/validate.ts';
import { measure } from '../s1/measure.ts';
import type { Expectation, Measurement } from '../s1/measure.ts';

const run = promisify(execFile);
const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUT = join(HERE, 'results');
const BASE = readFileSync(join(HERE, '../../test/fixtures/r0.zumen.yaml'), 'utf8');

/** 何回回すか。**多いほど良いが、毎回 AI を呼ぶので時間がかかる。** */
const TRIALS = Number(process.env['S1_REAL_TRIALS'] ?? 5);

/** 人が入れる手直し。**3 か所。毎回同じにする**（ばらつきの原因を AI 側だけにするため）。 */
function withHumanEdits(text: string): string {
  const doc = parse(text);
  setPin(doc, 'db', { position: { x: 620, y: 410 }, appearance: 'primary' });
  setPin(doc, 'monitor', { label: '監視（Zabbix）' });
  setPin(doc, 'web01', { position: { x: 120, y: 260 } });
  return serialize(doc);
}

/**
 * 指示の 2 種類。
 *
 * **`plain` だけでは、D5 の設計が試されない。**
 * 正本を丸ごと渡すと、AI は `pins` をそのまま写して返すことが多く、
 * 値が同じなら「提案の pins を読まない」という作りは効いても効かなくても同じに見える。
 *
 * **危ないのは AI が違う値の `pins` を書いてくる場合**なので、
 * `relayout` では配置の整理まで頼んで、そこを起こしにいく。
 */
type Kind = 'plain' | 'relayout';

const KINDS: Kind[] = ['plain', 'relayout'];

const WHAT: Record<Kind, string> = {
  plain: '構造だけを足させる',
  relayout: '**配置の整理も頼む**（AI が違う位置を書いてくる場面）',
};

/**
 * AI への指示。**正本を丸ごと渡す。**
 *
 * 実運用でいちばん起きるのは「丸ごと書き直して返す」形であって、
 * 綺麗な差分パッチではない（D5 の根拠になった REAL-1 がそれ）。
 */
function prompt(current: string, kind: Kind): string {
  const ask =
    kind === 'plain'
      ? [
          'この構成に Redis のキャッシュを 1 つ足して、Web サーバ 2 台の両方から',
          'キャッシュへ線を引いてください。',
        ]
      : [
          'この構成に Redis のキャッシュを 1 つ足して、Web サーバ 2 台の両方から',
          'キャッシュへ線を引いてください。',
          '',
          'あわせて、**図が見やすくなるように各要素の配置も整えてください。**',
          'pins の position を、あなたが良いと思う値に書き換えてかまいません。',
        ];

  return [
    '次は、いま使っている構成図です。',
    '',
    current,
    '',
    ...ask,
    '',
    '出力は同じ形式の YAML だけにしてください。前後に説明を書かないでください。',
    'コードブロックの記号も付けないでください。',
  ].join('\n');
}

/** 提案の `pins` が、人の指定と**違う値**になっているか。ここが本番。 */
function pinsDiffer(current: string, proposal: string): boolean {
  const mine = getPins(parse(current));
  const theirs = getPins(parse(proposal));
  return Object.entries(mine).some(
    ([id, pin]) => JSON.stringify(theirs[id]) !== JSON.stringify(pin),
  );
}

interface Trial {
  n: number;
  kind: Kind;
  /** 提案が形式に適合したか。 */
  parsed: boolean;
  /** **AI が pins を書いてきたか。** 書いてきても採らないが、頻度は知りたい。 */
  proposalHadPins: boolean;
  /** **提案の pins が人の指定と違う値だったか。** ここが D5 の本番。 */
  proposalChangedPins: boolean;
  measurement: Measurement | null;
  conflicts: number;
  seconds: number;
  errors: string[];
}

async function ask(text: string): Promise<{ text: string; seconds: number }> {
  const started = Date.now();
  const { stdout } = await run('claude', ['-p', text], {
    maxBuffer: 4 * 1024 * 1024,
    timeout: 240_000,
  });
  return { text: clean(stdout), seconds: Math.round((Date.now() - started) / 100) / 10 };
}

function clean(raw: string): string {
  const fenced = /```(?:ya?ml)?\n([\s\S]*?)```/.exec(raw);
  const body = fenced === null ? raw : fenced[1]!;
  const lines = body.split('\n');
  const start = lines.findIndex((line) => line.startsWith('version:'));
  return `${(start === -1 ? lines : lines.slice(start)).join('\n').trimEnd()}\n`;
}

/**
 * AI が付けた「Redis らしい」ノードの id を探す。
 *
 * **id は AI が決める**（`redis` / `cache` / `redis-cache` など）ので、決め打ちにしない。
 * 見つからなければ、期待は満たされなかったということ。
 */
function findRedis(text: string): string | undefined {
  return parse(text)
    .nodeIds()
    .find((id) => /redis|cache/i.test(id));
}

async function trial(n: number, kind: Kind): Promise<Trial> {
  const current = withHumanEdits(BASE);
  const { text: proposal, seconds } = await ask(prompt(current, kind));

  const findings = validate(proposal);
  const errors = findings
    .filter((finding) => finding.severity === 'error')
    .map((finding) => `${finding.code}: ${finding.message}`);

  writeFileSync(join(OUT, `${kind}-${n}-proposal.yaml`), proposal);

  if (hasError(findings)) {
    return {
      n,
      kind,
      parsed: false,
      proposalHadPins: false,
      proposalChangedPins: false,
      measurement: null,
      conflicts: 0,
      seconds,
      errors,
    };
  }

  const hadPins = Object.keys(getPins(parse(proposal))).length > 0;
  const changedPins = pinsDiffer(current, proposal);
  const merged = merge(current, proposal);
  writeFileSync(join(OUT, `${kind}-${n}-merged.yaml`), merged.text);

  // 期待は「Redis が足され、Web 2 台から線が引かれること」。**回す前に書き出しておく。**
  // id は AI が決めるので、`redis` を含む id を探して照合する。
  const redis = findRedis(merged.text);
  const expectations: Expectation[] =
    redis === undefined
      ? [{ kind: 'node-added', id: 'redis' }]
      : [
          { kind: 'node-added', id: redis },
          { kind: 'edge-added', from: 'web01', to: redis },
          { kind: 'edge-added', from: 'web02', to: redis },
        ];

  return {
    n,
    kind,
    parsed: true,
    proposalHadPins: hadPins,
    proposalChangedPins: changedPins,
    measurement: measure(current, merged.text, expectations),
    conflicts: merged.conflicts.length,
    seconds,
    errors: [],
  };
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'base-with-edits.yaml'), withHumanEdits(BASE));

  const trials: Trial[] = [];
  for (const kind of KINDS) {
    for (let n = 1; n <= TRIALS; n += 1) {
      process.stderr.write(`${kind} ${n} / ${TRIALS} …\n`);
      trials.push(await trial(n, kind));
    }
  }

  const out = report(trials);
  writeFileSync(join(OUT, 'variance.md'), out);
  process.stdout.write(out);
}

function pct(value: { kept: number; total: number }): string {
  if (value.total === 0) return '—';
  return `${Math.round((value.kept / value.total) * 1000) / 10}%`;
}

function report(trials: Trial[]): string {
  const lines = [
    '# 本物の AI で回した往復のばらつき（自動生成 — `pnpm s1:real`）',
    '',
    '**S1 はこの企画の Go / No-Go の関門**（Issue 001）。',
    'だがその根拠は、決め打ちの書き換えで作った提案に依っていた。ここを埋める。',
    '',
    '毎回、**人が 3 か所に手直しを入れた正本を丸ごと AI へ渡し、丸ごと書き直させる**。',
    '返ってきた提案を `merge()` で人の正本へ入れ、**手直しが消えていないか**を数える。',
    '',
    '合格線は Tier A（位置・大きさ・ラベル）が **100%**。',
    '**1 回でも割ったら、その回を残して報告する。平均で隠さない。**',
    '',
    '生成は手元の `claude` CLI（D16）。**zumen は API の鍵を持たない。**',
    '',
    '## 2 種類の指示で回す',
    '',
    '**構造を足させるだけでは、D5 の設計が試されない。**',
    '正本を丸ごと渡すと、AI は `pins` をそのまま写して返すことが多く、',
    '値が同じなら「提案の `pins` を読まない」という作りは効いても効かなくても同じに見える。',
    '',
    '**危ないのは AI が違う値の `pins` を書いてくる場合**なので、',
    'そこを起こしにいく指示も回す。',
    '',
  ];

  for (const kind of KINDS) {
    const group = trials.filter((t) => t.kind === kind);
    const parsed = group.filter((t) => t.parsed);
    const perfect = parsed.filter((t) => t.measurement!.tierA.kept === t.measurement!.tierA.total);
    const lost = parsed.filter((t) => t.measurement!.tierA.kept < t.measurement!.tierA.total);
    const changed = parsed.filter((t) => t.proposalChangedPins);

    lines.push(
      `## ${kind} — ${WHAT[kind]}`,
      '',
      '| # | 形式に適合 | Tier A（位置・大きさ・ラベル） | Tier B | 反映 | 競合 | 提案に pins | **人と違う値** | 生成 |',
      '|---|---|---|---|---|---|---|---|---|',
    );

    for (const t of group) {
      if (!t.parsed) {
        lines.push(`| ${t.n} | **していない** | — | — | — | — | — | — | ${t.seconds} 秒 |`);
        continue;
      }
      const m = t.measurement!;
      lines.push(
        `| ${t.n} | した | **${pct(m.tierA)}**（${m.tierA.kept}/${m.tierA.total}） | ${pct(m.tierB)} | ${m.reflection.applied}/${m.reflection.expected} | ${t.conflicts} | ${t.proposalHadPins ? '書いてきた' : '書かない'} | ${t.proposalChangedPins ? '**違う値**' : '同じ値'} | ${t.seconds} 秒 |`,
      );
    }

    lines.push(
      '',
      `- 形式に適合: **${parsed.length} / ${group.length}**`,
      `- **Tier A を 100% 保った回: ${perfect.length} / ${parsed.length}**`,
      `- **AI が人と違う値の pins を書いてきた回: ${changed.length} / ${parsed.length}**`,
      lost.length === 0
        ? '- **手直しが消えた回は無い。**'
        : `- **手直しが消えた回: ${lost.map((t) => `#${t.n}`).join(', ')}** ← ここを読むこと`,
      '',
    );

    for (const t of lost) {
      lines.push(
        `  - **${kind} #${t.n}** — Tier A ${pct(t.measurement!.tierA)}。`,
        `    提案は \`${kind}-${t.n}-proposal.yaml\`、結果は \`${kind}-${t.n}-merged.yaml\``,
      );
    }
    for (const t of group.filter((x) => !x.parsed)) {
      lines.push(`  - **${kind} #${t.n}** は形式に適合しなかった — ${t.errors.join(' / ')}`);
    }
    lines.push('');
  }

  const changedAny = trials.filter((t) => t.parsed && t.proposalChangedPins);
  const lostAny = trials.filter(
    (t) => t.parsed && t.measurement!.tierA.kept < t.measurement!.tierA.total,
  );

  lines.push(
    '## まとめ',
    '',
    changedAny.length === 0
      ? '**AI が人と違う値の `pins` を書いてきた回は 1 度も無かった。**' +
        'つまり、この実験は「提案の `pins` を読まない」という設計を**まだ試せていない**。' +
        '指示を変えて起こしにいく必要がある。'
      : `**AI が人と違う値の \`pins\` を書いてきたのは ${changedAny.length} 回。** ` +
        'そのすべてで、`merge()` は提案の `pins` を読まずに人の指定を残した。' +
        '**ここが D5 の効き目そのもの。**',
    '',
    lostAny.length === 0
      ? '**全試行を通じて、人の手直しが消えた回は無い。**'
      : `**人の手直しが消えた回がある: ${lostAny.length} 回。** 設計の誤りとして扱うこと。`,
    '',
    '## 読み方',
    '',
    '**Tier A が 100% でない回が 1 つでもあれば、それは機構の穴。**',
    'AI の出来不出来ではない。`merge()` は提案から `pins` を読まない作りなので、',
    '**提案が何を書いてきても人の指定は残るはず**であり、残らなければ設計の誤り。',
    '',
  );

  return `${lines.join('\n')}\n`;
}

await main();
