/**
 * 個人情報混入チェック（`.github/scripts/oss-privacy-check.sh`）の回帰テスト。
 *
 * この検査は**安全側の砦**で、緩めた瞬間に穴が空く。
 * 実際に 2026-09-04、AI の `Co-Authored-By:` に入る `noreply@anthropic.com` で
 * CI が落ち、許可リストに 1 アドレスだけ穴を開けた。
 * **その穴がドメイン全体へ広がっていないこと**をここで押さえる。
 *
 * 使い捨ての git リポジトリを作って、本物のスクリプトを本物の commit にかける。
 * 外部サービスへは繋がない。
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

const SCRIPT = new URL('../.github/scripts/oss-privacy-check.sh', import.meta.url).pathname;

/**
 * 検査対象のアドレスは**組み立てて作る。ファイルに literal で書かない。**
 * 書くと、この検査ファイル自身が検査に引っかかる。
 * 逃げ道として許可リストや除外パターンへ足すと、そのぶん穴が増える。
 */
const at = (local: string, domain: string): string => `${local}@${domain}`;

const NOREPLY = at('meta-taro', 'users.noreply.github.com');
/** AI の Co-Authored-By 用。許可リストに 1 個だけ入っている（D8） */
const BOT = at('noreply', 'anthropic.com');
/** BOT と同じドメインの別アドレス。**許可されていないこと**を確かめるために使う */
const SAME_DOMAIN = at('eve', 'anthropic.com');
/** 個人のメールのつもりの値。許可ドメインのどれにも当たらない */
const PERSONAL = at('someone', 'example.co.jp');

const workspaces: string[] = [];

after(() => {
  for (const dir of workspaces) rmSync(dir, { recursive: true, force: true });
});

/** commit を 2 つ持つ使い捨てリポジトリを作る。2 つ目の message は呼び出し側が決める。 */
function repoWith(message: string, addedLine = 'ふつうの行'): { dir: string; base: string } {
  const dir = mkdtempSync(join(tmpdir(), 'zumen-privacy-'));
  workspaces.push(dir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });

  git('init', '--quiet', '--initial-branch', 'develop');
  git('config', 'user.email', NOREPLY);
  git('config', 'user.name', 'meta-taro');

  writeFileSync(join(dir, 'a.txt'), '最初\n');
  git('add', '-A');
  git('commit', '--quiet', '-m', '最初の commit');
  const base = git('rev-parse', 'HEAD').trim();

  writeFileSync(join(dir, 'a.txt'), `最初\n${addedLine}\n`);
  git('add', '-A');
  git('commit', '--quiet', '-m', message);
  return { dir, base };
}

/** 検査を走らせて、合否と出力を返す。**中身は落ちたときしか見ない。** */
function check(dir: string, base: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync('bash', [SCRIPT, base, 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, OSS_DENY_WORDS: '', OSS_ALLOWED_EMAIL_DOMAINS: '' },
    });
    return { ok: true, out };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string };
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('commit message のメール', () => {
  it('AI の Co-Authored-By（noreply@anthropic.com）は通す', () => {
    const { dir, base } = repoWith(`feat: なにか\n\nCo-Authored-By: Claude Opus 5 <${BOT}>\n`);
    assert.equal(check(dir, base).ok, true);
  });

  it('同じドメインでも別のアドレスは止める（穴を 1 アドレスに閉じる）', () => {
    const { dir, base } = repoWith(`feat: なにか\n\n連絡先は ${SAME_DOMAIN}\n`);
    const { ok, out } = check(dir, base);
    assert.equal(ok, false);
    assert.match(out, /message-email/);
  });

  it('個人のメールは止める', () => {
    const { dir, base } = repoWith(`feat: なにか\n\n担当 ${PERSONAL}\n`);
    assert.equal(check(dir, base).ok, false);
  });

  it('検出しても原文をログへ出さない（マスクされている）', () => {
    const { dir, base } = repoWith(`feat: なにか\n\n担当 ${PERSONAL}\n`);
    const { out } = check(dir, base);
    assert.equal(out.includes(PERSONAL), false);
    assert.match(out, /s\*\*\*@\*\*\*\.jp/);
  });
});

describe('追加行のメール', () => {
  it('追加行に入った個人のメールは止める', () => {
    const { dir, base } = repoWith('feat: なにか', `問い合わせ ${PERSONAL}`);
    const { ok, out } = check(dir, base);
    assert.equal(ok, false);
    assert.match(out, /added-email/);
  });

  it('追加行の noreply@anthropic.com も通す', () => {
    const { dir, base } = repoWith('feat: なにか', `Co-Authored-By: <${BOT}>`);
    assert.equal(check(dir, base).ok, true);
  });
});
