/**
 * **この道具の説明を、エージェントへ返す**（`zumen_about`）。
 *
 * ## なぜ要るか
 *
 * エージェントは、繋いだ道具が何をするものかを知らないまま叩き始める。
 * **開いていない口を試して断られる往復**が毎回起きる（実際に起きた）。
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
 * ## 書くのは「振る舞いが変わること」だけ
 *
 * commit の一覧は git にある。**ここがその代わりになってはいけない。**
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { about, releases } from '../src/about.ts';

const ROOT = new URL('../', import.meta.url).pathname;

describe('版ごとの変更を読む', () => {
  const parsed = releases(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'));

  it('少なくとも 1 つある', () => {
    assert.ok(parsed.length > 0);
  });

  /**
   * **新しいものが先**（エージェントは上から読む）。
   *
   * 以前は「先頭は必ず未リリース」と書いていたが、**版を切った直後は空**なので
   * 先頭に来ない（空の欄は数えない）。見るべきは**並び**のほう。
   */
  it('**新しいものが先**（エージェントは上から読む）', () => {
    const shipped = parsed.filter((release) => !release.unreleased);
    const numbers = shipped.map((release) => release.version.split('.').map(Number));
    for (let i = 1; i < numbers.length; i += 1) {
      const [a, b] = [numbers[i - 1]!, numbers[i]!];
      assert.ok(
        a[0]! > b[0]! || (a[0] === b[0] && (a[1]! > b[1]! || (a[1] === b[1] && a[2]! > b[2]!))),
        `${shipped[i - 1]!.version} より ${shipped[i]!.version} が先に来ている`,
      );
    }
    // 未リリースに中身があるときは、それがいちばん上。
    if (parsed.some((release) => release.unreleased)) assert.equal(parsed[0]?.unreleased, true);
  });

  it('版と日付が取れる', () => {
    const shipped = parsed.find((r) => !r.unreleased)!;
    assert.match(shipped.version, /^\d+\.\d+\.\d+$/);
    assert.match(shipped.date ?? '', /^\d{4}-\d{2}-\d{2}$/);
  });

  it('中身が空でない', () => {
    for (const release of parsed) {
      assert.ok(release.notes.length > 0, `${release.version} が空`);
    }
  });

  /**
   * **版を切った直後の「未リリース」は空**（2026-09-17。0.2.0 のとき）。
   *
   * 欄そのものは残す（次に何が来るかを書く場所）が、
   * **空の欄を「版」として返すと、読んだエージェントには
   * 「いちばん新しい版には何も無い」と映る。**
   */
  it('**空の欄は版として数えない**（切った直後の「未リリース」）', () => {
    const empty = releases('## 未リリース\n\n## 0.2.0 — 2026-09-17\n\n### 直しました\n\n- 直した\n');
    assert.deepEqual(empty.map((r) => r.version), ['0.2.0']);
  });

  it('見出しごとにまとまっている', () => {
    const shipped = parsed.find((r) => !r.unreleased)!;
    // `### 直しました` の下の 1 件なら `直しました: …` として返る。
    assert.ok(shipped.notes.some((note) => /^[^:]+: /.test(note)), shipped.notes[0]);
  });

  it('**囲みや余談を拾わない**（記録の前置きを版の中身にしない）', () => {
    for (const release of parsed) {
      for (const note of release.notes) {
        assert.equal(note.includes('commit の一覧'), false, note);
      }
    }
  });
});

describe('道具の説明', () => {
  /**
   * **名前をベタ書きしない**（2026-09-21）。
   *
   * 版は `package.json` と突き合わせていたのに、**名前だけ `'zumen'` と書いてあった。**
   * npm の名前を `@metataro/zumen` へ変えた日（Issue #14）に、ここだけが落ちた ——
   * 実体が変わったのに、テストが古い名前を守っていた。
   * **数と同じで、名前も正本から読む。**
   */
  it('名前と版を返す（どちらも package.json と一致する）', async () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { name: string };
    const out = await about();
    assert.equal(out.name, pkg.name);
    assert.match(out.version, /^\d+\.\d+\.\d+$/);
  });

  it('**package.json の版と一致する**（記録と実体がずれない）', async () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { version: string };
    assert.equal((await about()).version, pkg.version);
  });

  it('何をするものかが 1 行で分かる', async () => {
    const out = await about();
    assert.ok(out.oneLine.length > 0);
  });

  it('**開いていない口を、理由つきで返す**（試して断られる往復を減らす）', async () => {
    const out = await about();
    assert.ok(out.closed.length > 0);
    for (const entry of out.closed) {
      assert.ok(entry.what.length > 0);
      assert.ok(entry.why.length > 0, `${entry.what} に理由が無い`);
    }
  });

  it('**やらないと決めたことを返す**（頼まれても作らないもの）', async () => {
    assert.ok((await about()).notDoing.length > 0);
  });

  it('版ごとの変更が入っている', async () => {
    const out = await about();
    assert.ok(out.releases.length > 0);
    assert.ok(out.releases[0]!.notes.length > 0);
  });

  it('開いている口の名前が入っている', async () => {
    const out = await about();
    for (const name of ['zumen_spec', 'zumen_inspect', 'zumen_propose']) {
      assert.ok(out.doors.includes(name), `${name} が無い`);
    }
  });

  it('**`zumen_about` 自身も口の一覧に出る**', async () => {
    assert.ok((await about()).doors.includes('zumen_about'));
  });
});

describe('記録そのものの決まり', () => {
  const text = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');

  it('**版の付け方が書いてある**（読む側が数字の意味を推測しない）', () => {
    assert.match(text, /やり方が変わった/);
  });

  it('**「未リリース」の欄がある**（次に何が来るかが見える）', () => {
    assert.match(text, /^## 未リリース$/m);
  });
});
