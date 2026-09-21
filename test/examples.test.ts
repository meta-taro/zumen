/**
 * **同梱の見本を、エージェントが引けるか**（`zumen_examples`）。
 *
 * D39 で測ったとおり、**リポジトリの中にしか無い決まりは、他の人には届かない。**
 * `zumen_spec` は「どう書くか」を渡すが、**「世の中にどんな図面があるか」は
 * どこからも渡っていなかった** —— zumen の値打ちは書き方ではなく、
 * 歯周チャート・木取り図・仕込図・査定図が**どう組まれているか**のほうにある。
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { catalogue, search, source } from '../src/examples.ts';

const dir = new URL('../examples/gallery/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'));

describe('同梱の見本の目次', () => {
  it('**目次が同梱されている**（無ければ、エージェントには見本が無いのと同じ）', () => {
    assert.notEqual(catalogue(), null, 'examples/gallery/index.json が読めない');
  });

  it('**枚数が実物と合っている**', () => {
    assert.equal(catalogue()!.count, files.length);
  });

  /**
   * **目次に名前があるのに正本が無い**、が起きると
   * エージェントは「読めるはず」で呼んで空振りする（ベースルール §23 と同じ壊れ方）。
   */
  it('**目次のすべての名前に、正本がある**', () => {
    const missing = catalogue()!
      .categories.flatMap((group) => group.items.map((item) => item.name))
      .filter((name) => source(name) === null);
    assert.deepEqual(missing, []);
  });

  it('**正本がすべて目次に載っている**（載せ忘れを通さない）', () => {
    const listed = new Set(
      catalogue()!.categories.flatMap((group) => group.items.map((item) => item.name)),
    );
    const adrift = files.map((f) => f.replace(/\.zumen\.yaml$/, '')).filter((n) => !listed.has(n));
    assert.deepEqual(adrift, []);
  });

  it('**一行が空でない**（題名だけでは、何の決まりごとか伝わらない）', () => {
    const empty = catalogue()!
      .categories.flatMap((group) => group.items)
      .filter((item) => item.caption.trim() === '')
      .map((item) => item.name);
    assert.deepEqual(empty, []);
  });

  it('分類に英語の名前が付いている', () => {
    for (const group of catalogue()!.categories) assert.notEqual(group.labelEn.trim(), '');
  });
});

/**
 * **「この機能を使っている見本」を引けるようにする**（2026-09-19）。
 *
 * 目次は題材でしか引けなかった。だが入れた人のエージェントがいちばん知りたいのは、
 * しばしば**「views を 2 つ使って縮尺を分けた見本はどれか」**のほうである ——
 * 書き方は `zumen_spec` に書いてあるが、**効いている実物**は見本の中にしかない。
 */
/**
 * **配置図か構成図かは、まねる前に知りたい**（2026-09-19）。
 *
 * `kind: placement` は**座標を自分で書く図**、`structure` は**機械が並べる図**。
 * まねる相手を選ぶとき、これは一行の題材より先に効く情報なのに、目次に無かった。
 */
describe('目次に、図の種類が載っている', () => {
  it('**見本ごとに kind がある**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.every((i) => i.kind === 'placement' || i.kind === 'structure'), 'kind が無い見本がある');
  });

  it('**両方の種類が揃っている**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.some((i) => i.kind === 'placement'));
    assert.ok(items.some((i) => i.kind === 'structure'));
  });

  it('**種類でも引ける**', () => {
    const found = search(catalogue()!, 'placement').flatMap((g) => g.items);
    assert.ok(found.length > 50, `placement で ${found.length} 件しか出ない`);
    assert.ok(found.every((i) => i.kind === 'placement'));
  });
});

describe('使っている道具で引く', () => {
  it('**見本ごとに、使っている道具が並んでいる**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.every((i) => Array.isArray(i.uses)), 'uses が無い見本がある');
    assert.ok(items.some((i) => i.uses.includes('views')), 'views を使った見本が拾えていない');
  });

  it('**道具の名前で引ける**（query が uses にも当たる）', () => {
    const found = search(catalogue()!, 'views').flatMap((g) => g.items.map((i) => i.name));
    assert.ok(found.length >= 5, `views で ${found.length} 件しか出ない`);
  });

  /**
   * **「1 枚に 2 つの縮尺」を、目次から本当に引けるか**（2026-09-19）。
   *
   * `uses` に views と scale があるだけでは、**同じ縮尺の views** と区別がつかない。
   * 口上に「views を 2 つ使って縮尺を分けた見本はどれか、が引ける」と書いた以上、
   * **引けるようにしておく。**
   */
  it('**縮尺を分けた見本が引ける**（1 枚に 2 つの scale）', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    const twoScales = items.filter((i) => i.scales >= 2);
    assert.ok(twoScales.length >= 5, `2 縮尺の見本が ${twoScales.length} 件しか拾えない`);
    assert.ok(twoScales.every((i) => i.uses.includes('views')), '縮尺が 2 つあるのに views を使っていない見本がある');
  });

  it('**縮尺が 1 つの見本は 1、無い見本は 0**', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.some((i) => i.scales === 1));
    assert.ok(items.some((i) => i.scales === 0));
  });

  it('使っていない道具は並べない', () => {
    const items = catalogue()!.categories.flatMap((g) => g.items);
    assert.ok(items.some((i) => !i.uses.includes('views')), 'ぜんぶの見本に views が付いている');
  });
});

describe('見本を絞る', () => {
  it('**和語で引ける**', () => {
    const found = search(catalogue()!, '型紙').flatMap((g) => g.items.map((i) => i.name));
    assert.ok(found.length >= 3, `型紙が ${found.length} 件しか出ない`);
  });

  it('**英語でも引ける**（一行の英訳にも当たる）', () => {
    const found = search(catalogue()!, 'plot').flatMap((g) => g.items.map((i) => i.name));
    assert.ok(found.length > 0, '英語で引けない');
  });

  it('空の語なら、そのまま全部', () => {
    assert.equal(search(catalogue()!, '  ').length, catalogue()!.categories.length);
  });
});

describe('正本を読む', () => {
  it('**名前を渡すと、その正本が返る**（真似て書けるように）', () => {
    const name = catalogue()!.categories[0]!.items[0]!.name;
    const yaml = source(name);
    assert.ok(yaml !== null && yaml.startsWith('version: 1'), `${name} の正本が読めない`);
  });

  it('**上へ抜けさせない**（名前はファイル名にそのまま使う）', () => {
    for (const bad of ['../package', 'a/b', '..\\\\x', '../../etc/passwd']) {
      assert.equal(source(bad), null, `${bad} が通った`);
    }
  });

  it('無い名前には null（黙って空を返さない）', () => {
    assert.equal(source('999-ありません'), null);
  });

  it('**同梱されていなければ null**（「無い」と言えるようにする）', () => {
    assert.equal(
      catalogue(() => {
        throw new Error('ない');
      }),
      null,
    );
  });
});

describe('目次は、正本と同じものを写している', () => {
  it('**一行は scripts/gallery-categories.mjs のまま**（二重管理にしない）', async () => {
    // scripts/ は素の JS（型宣言を持たない）。ここだけ素通しする。
    // @ts-expect-error -- 型宣言の無い .mjs を、テストのためだけに読む
    const { CATEGORIES } = (await import('../scripts/gallery-categories.mjs')) as {
      CATEGORIES: { key: string; label: string; items: { name: string; caption: string }[] }[];
    };
    const book = catalogue()!;
    assert.equal(book.categories.length, CATEGORIES.length);
    for (const [i, group] of CATEGORIES.entries()) {
      assert.equal(book.categories[i]!.key, group.key);
      assert.deepEqual(
        book.categories[i]!.items.map((x) => [x.name, x.caption]),
        group.items.map((x) => [x.name, x.caption]),
      );
    }
  });

  it('**目次に載っている YAML は、読める**（壊れた正本を勧めない）', () => {
    for (const name of catalogue()!.categories.flatMap((g) => g.items.map((i) => i.name))) {
      assert.ok(readFileSync(new URL(`${name}.zumen.yaml`, dir), 'utf8').includes('version: 1'));
    }
  });
});

/**
 * **説明が無い見本は、絵しか渡していない**（2026-09-20）。
 *
 * 見本の値打ちは絵ではなく、**「なぜその形なのか」**のほうにある
 * （`.claude/rules/専門図面の調査と実装方針.md` §2）。
 * `#` のコメントは見本ページの本文にそのまま出るので、
 * **短い説明は、そのまま短いページになる。**
 *
 * 測ったら 120 字未満が **35 枚**あり、いちばん短いのは 12 字
 * （`# 1 px = 25 mm` だけ）だった。7 周かけて 0 にしたので、**下限を決めて戻さない。**
 */
describe('見本の説明', () => {
  /** `#` で始まる行（`# ` の後ろ）を、強調記号を外してつないだもの。 */
  const body = (file: string): string =>
    readFileSync(new URL(file, dir), 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('# '))
      .map((line) => line.slice(2))
      .join('')
      .replace(/\*\*/g, '');

  it('**どの見本にも、120 字以上の説明がある**', () => {
    const thin = files
      .filter((file) => body(file).length < 120)
      .map((file) => `${file}（${body(file).length} 字）`);
    assert.deepEqual(thin, [], '説明が短い見本（絵だけでは、なぜその形かが渡らない）');
  });

  /**
   * **規格は改正される**（2026-09-20）。
   *
   * 洗濯表示のアイロン温度を 110/150/200℃ と書いたあとで、
   * **2024 年 8 月の改正で 120/160/210℃ になっていた**と気づいた。
   * 同じ日に照度基準も JIS Z 9110 → Z 9125:2023 へ移っていた。
   * **記号は同じ形のまま意味だけ変わる**ので、絵を見ても気づけない ——
   * 規格番号を書くなら、**どの版を見たのか**まで書く。
   */
  it('**規格番号を書いた見本は、版（年）も書いている**', () => {
    /**
     * **見る規格の名前を広げた**（2026-09-21）。
     *
     * `EN` と `ISO/IEC` が漏れていて、見本 97（防犯カメラの視野図）の
     * **IEC/EN 62676-4 が版なしのまま通っていた。**
     */
    const STANDARD =
      /JIS\s*[A-Z]\s*\d+|ISO\/IEC\s*\d+|ISO\s*\d+|IEC\/EN\s*\d+|IEC\s*\d+|EN\s*\d+|DIN\s*\d+|ASTM\s*[A-Z]?\d+|IEEE\s*\d+|JEM\s*\d+|JASO|JEITA|WDF|ANSI|NFPA/;
    /**
     * **版を確かめられないなら、確かめていないと書く。**
     *
     * 年を書かせるのは、**古い版の数をそのまま載せない**ため。
     * 調べがつかないときに年をでっち上げるほうが悪いので、
     * **そう書いてあるなら通す**（そのかわり、図を読む人にも伝わる）。
     */
    const ADMITS = /版は確かめていない/;
    const comments = (file: string): string =>
      readFileSync(new URL(file, dir), 'utf8')
        .split('\n')
        .filter((line) => line.startsWith('#'))
        .join('\n');
    const undated = files.filter(
      (file) =>
        STANDARD.test(comments(file)) &&
        !/(19|20)\d\d/.test(comments(file)) &&
        !ADMITS.test(comments(file)),
    );
    assert.deepEqual(undated, [], '規格番号はあるのに、いつの版か書いていない見本');
  });
});

/**
 * **「見本 NNN と対」が、切れていないか**（2026-09-21）。
 *
 * 説明の中で別の見本を指すことがよくある（いま 47 か所）。
 * **番号を間違えても、誰も気づかない** —— 絵は出るし、テストも通る。
 * 番号だけは機械に見させる。
 *
 * 名前まで見ようとすると誤検出になる。
 * 「見本 95（1 人 3.5m² のスフィア基準）」のように、
 * **括弧の中は名前ではなく中身の説明**であることが多い（測って 13 件中 2 件）。
 */
describe('見本どうしの参照', () => {
  it('**指している見本が実在する**', () => {
    const dir = new URL('../examples/gallery/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'));
    const have = new Set(files.map((f) => f.split('-')[0]!));
    const broken: string[] = [];
    let refs = 0;
    for (const file of files) {
      const text = readFileSync(new URL(file, dir), 'utf8');
      for (const found of text.matchAll(/見本\s?(\d{1,3})/g)) {
        refs += 1;
        const num = found[1]!;
        if (!have.has(num) && !have.has(num.padStart(2, '0'))) broken.push(`${file} → 見本 ${num}`);
      }
    }
    assert.ok(refs >= 40, `参照が ${refs} 件しか見つからない（数え方が壊れた？）`);
    assert.deepEqual(broken, []);
  });
});

/**
 * **道具を足したら、それを使った見本も足す**（2026-09-21）。
 *
 * `spec().rules` は「その書き方が効いている実物を先に見られる」と言っているが、
 * **実物が 1 枚も無い語**があった。数えたら `ends` の
 * `dot` / `dot-bar` / `dot-crow` が **0 枚**（見本 304 枚のうち）。
 *
 * 道具だけあって実物が無い語は、**書いてもよいのか分からない語**になる。
 */
describe('閉じた語彙と、それを使った見本', () => {
  /** **まだ実物が無い語と、その理由。** 空にするのが目標。 */
  const NO_SAMPLE_YET: Record<string, string> = {
    'ends: dot':
      '**丸 1 つは、鳥の足記法では単独で使わない**（0 以上は dot-crow、0 または 1 は dot-bar）。かつてここには「接続点としての使い道（単線結線図のバスの分岐）はまだ描いていない」と書いてあったが、**2026-09-21 に試して、その道が無いことが分かった** —— `dot` は `fill="none"` の白丸で、電気の接続点は黒丸。見本 19（受変電の結線）の分岐に付けてみたら、記法として誤りだったので戻した。**使い道が無いのではなく、提案されていた使い道のほうが間違っていた**',
  };

  it('**どの値も、どこかの見本で使われている**', async () => {
    const { MARKERS } = await import('../src/marker.ts');
    const { HATCHES } = await import('../src/hatch.ts');
    const { LINES } = await import('../src/line.ts');
    const { ENDS } = await import('../src/ends.ts');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const texts = readdirSync(dir)
      .filter((f) => f.endsWith('.zumen.yaml'))
      .map((f) => readFileSync(new URL(f, dir), 'utf8'));
    const unused: string[] = [];
    const census = (key: string, words: readonly string[], pattern: (w: string) => RegExp): void => {
      for (const word of words) {
        if (texts.some((t) => pattern(word).test(t))) continue;
        unused.push(`${key}: ${word}`);
      }
    };
    // **`\b` では足りない** —— `to: dot` の正規表現が `to: dot-crow` にも当たる。
    const only = (w: string): string => `${w}(?![\\w-])`;
    census('marker', MARKERS, (w) => new RegExp(`marker:\\s*${only(w)}`));
    census('hatch', HATCHES, (w) => new RegExp(`hatch:\\s*${only(w)}`));
    census('line', LINES, (w) => new RegExp(`line:\\s*${only(w)}`));
    census('ends', ENDS, (w) => new RegExp(`(?:from|to):\\s*${only(w)}`));
    assert.deepEqual(unused.filter((u) => NO_SAMPLE_YET[u] === undefined), []);
  });

  it('**理由を書いた語は、本当にまだ使われていない**（消し忘れを残さない）', async () => {
    const dir = new URL('../examples/gallery/', import.meta.url);
    const texts = readdirSync(dir)
      .filter((f) => f.endsWith('.zumen.yaml'))
      .map((f) => readFileSync(new URL(f, dir), 'utf8'));
    for (const key of Object.keys(NO_SAMPLE_YET)) {
      const word = key.split(': ')[1]!;
      const used = texts.some((t) => new RegExp(`(?:from|to):\\s*${word}(?![\\w-])`).test(t));
      assert.ok(!used, `${key} は使われている —— 表から消すこと`);
    }
  });
});
