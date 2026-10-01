/**
 * **この道具の説明を、エージェントへ返す**（`zumen_about`）。
 *
 * ## 埋めている穴
 *
 * エージェントは、繋いだ道具が何をするものかを知らないまま叩き始める。
 * **開いていない口を試して断られる往復**が毎回起きる。
 *
 * `zumen_spec` は「**図の書き方**」を返すが、
 * 「**この道具は何で、何をしないか**」は返していなかった。
 *
 * ## 版ごとの変更も返す
 *
 * 繋いだ先の版で、できることが違う。
 * **`hiddenLabels` があるかどうか**で、エージェントの動き方は変わる。
 * 「無いものを探して諦める」より「**あるものを知って使う**」ほうが速い。
 *
 * 中身は `CHANGELOG.md` から読む。**書き写さない** —
 * 2 か所に置くと、片方だけ古くなる。
 *
 * ## 版は `package.json` から取る
 *
 * ここに数字を書かない。**記録と実体がずれる**（テストで見張る）。
 */
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

import { messages } from './messages.ts';

export interface Release {
  /** `0.1.0`。まだ出していないものは `未リリース`。 */
  version: string;
  /** `2026-09-08`。まだ出していなければ null。 */
  date: string | null;
  unreleased: boolean;
  /** 変わったこと。**見出しがあれば `見出し: 中身` の形。** */
  notes: string[];
}

/** 口を 1 つ閉じている理由。**理由なしで断らない。** */
export interface Closed {
  what: string;
  why: string;
}

export interface About {
  name: string;
  version: string;
  /** 何をするものか。1 行。 */
  oneLine: string;
  /** 何のためにあるか。 */
  purpose: string[];
  /** 開いている口の名前。 */
  doors: string[];
  /** **開けていない口と、その理由。** */
  closed: Closed[];
  /** **頼まれても作らないもの**（PRD §4）。 */
  notDoing: string[];
  /** 版ごとに変わったこと。**新しいものが先。** */
  releases: Release[];
}

/** 版の見出し。`## 0.1.0 — 2026-09-08` か `## 未リリース`。 */
const HEADING = /^## +(.+?)(?: +[—–-] +(\d{4}-\d{2}-\d{2}))? *$/;
/** 中の見出し。`### 検査する` */
const GROUP = /^### +(.+?) *$/;
/** 変わったことの 1 件。`- **…** — …` */
const NOTE = /^- +(.+)$/;

/**
 * 記録を読む。
 *
 * **最初の `##` より前は前置きなので捨てる。**
 * ここを拾うと「commit の一覧が欲しいなら git を見てください」が
 * 版の中身として返ってしまう。
 */
export function releases(markdown: string): Release[] {
  const out: Release[] = [];
  let current: Release | null = null;
  let group = '';

  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();

    const heading = HEADING.exec(line);
    if (heading !== null) {
      const name = heading[1]!.trim();
      const unreleased = /未リリース|unreleased/i.test(name);
      current = { version: name, date: heading[2] ?? null, unreleased, notes: [] };
      group = '';
      out.push(current);
      continue;
    }

    if (current === null) continue; // 前置き。

    const inner = GROUP.exec(line);
    if (inner !== null) {
      group = inner[1]!.trim();
      continue;
    }

    const note = NOTE.exec(line);
    if (note !== null) {
      current.notes.push(group === '' ? note[1]!.trim() : `${group}: ${note[1]!.trim()}`);
      continue;
    }

    // 続きの行（字下げされた説明）は、直前の 1 件へ足す。
    if (/^ {2,}\S/.test(raw) && current.notes.length > 0) {
      current.notes[current.notes.length - 1] += ` ${line.trim()}`;
    }
  }

  /**
   * **中身の無い欄は、版ではない**（2026-09-17）。
   *
   * 版を切った直後の「未リリース」は**空なのが正しい状態**。
   * それを 1 件として返すと、`zumen_about` を読んだエージェントの目に
   * **「いちばん新しい版には何も無い」**と映る。空の欄は数えない。
   */
  return out.filter((release) => release.notes.length > 0);
}

/**
 * package.json の在り処。`src/` からも `dist/` からも 1 つ上。
 *
 * **`.pathname` ではなく `fileURLToPath`。** 入れた場所の名前に日本語や空白が
 * 入っていると、URL のままでは開けない（2026-09-19。`src/examples.ts` で踏んだ）。
 */
function root(name: string): string {
  return fileURLToPath(new URL(`../${name}`, import.meta.url));
}

export async function about(): Promise<About> {
  const m = messages().about;
  const pkg = JSON.parse(readFileSync(root('package.json'), 'utf8')) as {
    name: string;
    version: string;
  };

  let log = '';
  try {
    log = readFileSync(root('CHANGELOG.md'), 'utf8');
  } catch {
    // 記録が無くても、道具の説明は返す。**黙って全部やめない。**
    log = '';
  }

  const { spec } = await import('./tools.ts');
  return {
    name: pkg.name,
    version: pkg.version,
    oneLine: m.oneLine,
    purpose: m.purpose,
    doors: DOORS,
    closed: m.closed,
    notDoing: m.notDoing,
    releases: releases(log),
  };
}

/**
 * 開いている口。**`src/mcp.ts` が登録しているものと、ひとつ残らず同じ。**
 *
 * ここは `zumen_about` が返す一覧で、README は「**まず zumen_about を 1 回**」と
 * 案内している —— **最初に読む所が古いと、あとの全部がずれる。**
 *
 * 前は「ここを増やしたら、あちらも増やすこと（`test/about.test.ts` が見張る）」と
 * 書いてあったが、**その検査は無かった。** だから 9 個のまま古くなり、
 * `zumen_examples` も画面と繋ぐ口も出ていなかった（2026-09-19）。
 * いまは `test/mcp.test.ts` が、実際に登録された口と突き合わせている。
 */
export const DOORS = [
  'zumen_about',
  'zumen_spec',
  'zumen_examples',
  'zumen_list',
  'zumen_read',
  'zumen_pins',
  'zumen_inspect',
  'zumen_create',
  'zumen_propose',
  'zumen_export',
  'zumen_timelapse',
  // 画面と繋ぐ線（D34）。**提案を採用する口は、ここに無い。**
  'zumen_live_status',
  'zumen_live_read',
  'zumen_live_point',
  'zumen_live_propose',
];
