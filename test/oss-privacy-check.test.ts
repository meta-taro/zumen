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
import { execFileSync, spawnSync } from 'node:child_process';
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

/**
 * 検査を走らせて、合否と出力を返す。
 *
 * **stdout と stderr を両方見る。** 指摘も INFO も stderr へ出るので、
 * 片方だけ見ていると「言っているのに見えない」ことになる。
 */
function check(
  dir: string,
  base: string,
  denyWords = '',
  extra: Record<string, string> = {},
): { ok: boolean; out: string } {
  const result = spawnSync('bash', [SCRIPT, base, 'HEAD'], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, OSS_DENY_WORDS: denyWords, OSS_ALLOWED_EMAIL_DOMAINS: '', ...extra },
  });
  return { ok: result.status === 0, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
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

describe('走査で取りこぼさない', () => {
  // 1 行ずつ grep を起こす作りをやめ、awk 1 本の走査に変えた（2026-09-06）。
  // **速くなった代わりに取りこぼしていないか**を、ここで押さえる。

  it('1 行に 2 つあっても、両方見つける', () => {
    const a = at('one', 'example.co.jp');
    const b = at('two', 'example.ne.jp');
    const { dir, base } = repoWith('feat: なにか', `連絡先 ${a} と ${b}`);
    const { ok, out } = check(dir, base);
    assert.equal(ok, false);
    assert.match(out, /o\*\*\*@\*\*\*\.jp/);
    assert.match(out, /t\*\*\*@\*\*\*\.jp/);
  });

  it('同じ行の同じアドレスは 1 回だけ言う（同じ話を繰り返さない）', () => {
    const a = at('one', 'example.co.jp');
    const { dir, base } = repoWith('feat: なにか', `${a} と ${a}`);
    const { out } = check(dir, base);
    assert.equal((out.match(/added-email/g) ?? []).length, 1);
  });

  it('検査スクリプト自身は対象にしない（自分の正規表現で落ちない）', () => {
    const { dir, base } = repoWith('feat: なにか', 'ふつうの行');
    assert.equal(check(dir, base).ok, true);
  });

  it('禁止語を見つける（大文字小文字を区別しない）', () => {
    const { dir, base } = repoWith('feat: なにか', '担当は YAMADA です');
    const { ok, out } = check(dir, base, 'yamada');
    assert.equal(ok, false);
    assert.match(out, /added-denyword/);
    // **原文をログへ出さない。** 何番目の語かだけ言う。
    assert.equal(out.includes('YAMADA'), false);
  });

  it('禁止語に当たらない行は通す', () => {
    const { dir, base } = repoWith('feat: なにか', 'ふつうの行');
    assert.equal(check(dir, base, 'yamada').ok, true);
  });

  it('禁止語が複数あれば、当たったものを全部言う', () => {
    const { dir, base } = repoWith('feat: なにか', 'alpha と bravo');
    const { out } = check(dir, base, 'alpha\nbravo');
    assert.equal((out.match(/added-denyword/g) ?? []).length, 2);
  });
});

describe('公開の前に、中身そのものを見る', () => {
  // 差分の検査は**最初の commit の中身を含まない**。
  // 公開へ切り替える前に見たいのは「いま公開されるファイルの中身」なので、
  // 差分ではなく全ファイルを走査する口を持つ（OSS_SCAN_ALL_FILES=1）。

  it('**最初の commit にしか無いメールを見つける**（差分では見つからない）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zumen-privacy-'));
    workspaces.push(dir);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '--quiet', '--initial-branch', 'develop');
    git('config', 'user.email', NOREPLY);
    git('config', 'user.name', 'meta-taro');

    // 最初の commit にだけ入れる。以後は触らない。
    writeFileSync(join(dir, 'a.txt'), `連絡先 ${at('someone', 'example.co.jp')}\n`);
    git('add', '-A');
    git('commit', '--quiet', '-m', '最初の commit');
    const base = git('rev-parse', 'HEAD').trim();

    writeFileSync(join(dir, 'b.txt'), 'あとから足した行\n');
    git('add', '-A');
    git('commit', '--quiet', '-m', '2 つ目');

    // 差分だけを見ると素通りする。
    assert.equal(check(dir, base).ok, true, '差分検査で見つかってしまった（前提が違う）');

    // 中身を見れば見つかる。
    const whole = check(dir, base, '', { OSS_SCAN_ALL_FILES: '1' });
    assert.equal(whole.ok, false);
    assert.match(whole.out, /added-email/);
  });

  it('走査していることを言う（黙って何もしない、をしない）', () => {
    const { dir, base } = repoWith('feat: なにか', 'ふつうの行');
    const out = check(dir, base, '', { OSS_SCAN_ALL_FILES: '1' }).out;
    assert.match(out, /全ファイル/);
  });
});

describe('禁止語の語境界（2026-09-07）', () => {
  // lock ファイルの `cpu: [ppc64]` が禁止語に当たった。**部分一致だったため。**
  // 英数字の語だけ語境界を求めるようにしたので、**緩めすぎていないか**を押さえる。

  it('**単語として出ていれば見つける**', () => {
    const { dir, base } = repoWith('feat: なにか', '担当は yamada です');
    assert.equal(check(dir, base, 'yamada').ok, false);
  });

  it('記号で区切られていても見つける', () => {
    // **アドレスは組み立てて作る。** literal で書くと、この検査ファイル自身が引っかかる。
    const { dir, base } = repoWith('feat: なにか', `author: ${at('yamada', 'example.co.jp')}`);
    assert.equal(check(dir, base, 'yamada').ok, false);
  });

  it('行頭・行末でも見つける', () => {
    const { dir, base } = repoWith('feat: なにか', 'yamada');
    assert.equal(check(dir, base, 'yamada').ok, false);
  });

  it('**英数字の中に埋もれた偶然の一致は拾わない**', () => {
    const { dir, base } = repoWith('feat: なにか', 'cpu: [ppc64]');
    assert.equal(check(dir, base, 'ppc').ok, true);
  });

  it('長い識別子の一部に含まれていても拾わない', () => {
    const { dir, base } = repoWith('feat: なにか', 'sha512-hlxxXdyamada1mWiAcaFR7Sv9ZQT6m6UfI8');
    assert.equal(check(dir, base, 'yamada').ok, true);
  });

  it('**日本語の語は部分一致のまま**（語の区切りが無いため）', () => {
    const { dir, base } = repoWith('feat: なにか', '担当は山田太郎さんです');
    assert.equal(check(dir, base, '山田太郎').ok, false);
  });

  it('日本語の語が文の途中にあっても見つける', () => {
    const { dir, base } = repoWith('feat: なにか', 'これは山田太郎の担当分です');
    assert.equal(check(dir, base, '山田太郎').ok, false);
  });

  it('同じ行に複数回あっても、1 回だけ言う', () => {
    const { dir, base } = repoWith('feat: なにか', 'yamada と yamada');
    const out = check(dir, base, 'yamada').out;
    assert.equal((out.match(/added-denyword/g) ?? []).length, 1);
  });
});

describe('ファイル名をメールと読み違えない（2026-09-07）', () => {
  // `128x128@2x.png` が住所の形にそのまま当てはまり、アイコンを足した commit が
  // 検査で止まった。**誤検出が続くと、検査そのものが信用されなくなる。**
  // 拡張子で終わるものは落とすようにしたので、**緩めすぎていないか**を押さえる。

  it('**画像のファイル名は住所ではない**', () => {
    const { dir, base } = repoWith('feat: なにか', '      "icons/128x128@2x.png"');
    assert.equal(check(dir, base).ok, true);
  });

  it('ほかの拡張子でも同じ', () => {
    for (const name of ['sprite@2x.svg', 'font@1x.woff2', 'bundle@3.min.js']) {
      const { dir, base } = repoWith('feat: なにか', `参照 ${name}`);
      assert.equal(check(dir, base).ok, true, name);
    }
  });

  it('**本物の TLD と重なる拡張子では、落とさない**（`.md` `.sh` `.rs` `.py`）', () => {
    // これらは実在の TLD なので、そこで終わる住所があり得る。
    // **見逃すより、誤って引っかけるほうが安全。**
    for (const tld of ['md', 'sh', 'rs', 'py']) {
      const { dir, base } = repoWith('feat: なにか', `連絡先 ${at('yamada', `example.${tld}`)}`);
      assert.equal(check(dir, base).ok, false, tld);
    }
  });

  it('ふつうの住所は、これまでどおり止める', () => {
    const { dir, base } = repoWith('feat: なにか', `連絡先 ${PERSONAL}`);
    assert.equal(check(dir, base).ok, false);
  });

  it('**commit message でも同じ**（追加行だけ直して片手落ちにしない）', () => {
    // 追加行の除外だけ入れて message 側を忘れ、アイコンの commit が
    // 2 度目に止まった（2026-09-07）。**同じ規則を 2 か所で使う。**
    const { dir, base } = repoWith('feat: icons/128x128@2x.png を足した');
    assert.equal(check(dir, base).ok, true);
  });

  it('commit message の本物の住所は、これまでどおり止める', () => {
    const { dir, base } = repoWith(`feat: なにか\n\n担当 ${PERSONAL}\n`);
    assert.equal(check(dir, base).ok, false);
  });
});
