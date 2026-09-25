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
/**
 * **同じ規格を、同じ図の中で版つきと版なしで書かない**（2026-09-22。81 周目）。
 *
 * 見本 242 は題に `JIS Z 3021:2016` と書きながら、図の中の札は `JIS Z 3021` だった。
 * **読む側には「別のものを指しているのか」が分からない。**
 *
 * 版が確かめられないなら**書かない**のではなく、
 * `版は確かめていない` と書く（見本 97・195・239 がそうしている）。
 * ここが見るのは**揃っているか**だけで、版が正しいかは見ない。
 */
/**
 * **同じ題材の見本どうしは、互いを知っていること**（2026-09-22。84 周目）。
 *
 * 測ったら、**名前が同じ見本が 2 組**（ギターのフレット位置、オーケストラの配置）、
 * **片方が片方を丸ごと含むものが 3 組**あり、**8 方向すべてに参照が無かった。**
 * 読む人には「同じものが 2 枚あるのか、違うものなのか」が分からない。
 *
 * **消さない**（オーナーの指示）。代わりに**互いを指させる** ——
 * どちらが何を扱うかを、図の説明に書く。
 */
/**
 * **名前を被らせない**（2026-09-22。86 周目。オーナーの指示）。
 *
 * 84 周目に足したのは「被ったら互いを参照しろ」という**後始末**の検査だった。
 * オーナーから「**今後名前が被らないように**」と言われたので、**被らせない側**を足す。
 *
 * すでに被っている 2 組（ギターのフレット位置、オーケストラの配置）は**消さない** ——
 * 消すなと言われているし、公開ページの URL も配ってある。
 * **ここに書いてあるものだけを通し、新しい重複は通さない。**
 */
describe('見本の名前', () => {
  /**
   * **もう被っているもの。** 増やさないための記録で、消すための表ではない。
   *
   * **2026-09-22 に空になった。** 2 組あったのを改名したため
   * （`.claude/rules/専門図面の調査と実装方針.md` §5.6）——
   * `310-ギターのフレット位置` → `310-ギターのフレット位置は等比`、
   * `317-オーケストラの配置` → `317-オーケストラの配置と音量`。
   * **番号は変えていない**ので、ページ・共有カード・相互参照はどれも動いていない。
   */
  const ALREADY: Record<string, string> = {};

  const word = (file: string): string =>
    file.replace('.zumen.yaml', '').replace(/^[0-9]+-/, '').replace(/図$/, '');

  it('**新しく名前を被らせない**（すでに被っている 2 組だけを通す）', () => {
    const byWord = new Map<string, string[]>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      byWord.set(word(file), [...(byWord.get(word(file)) ?? []), file]);
    }
    const collided = [...byWord.entries()]
      .filter(([key, files]) => files.length > 1 && ALREADY[key] === undefined)
      .map(([key, files]) => `${key}: ${files.join(' / ')}`);
    assert.deepEqual(collided, [], '名前が被っている見本（別の題にするか、片方の名前を変える）');
  });

  it('**逃がした名前が、本当にまだ被っている**（消し忘れを残さない）', () => {
    const byWord = new Map<string, number>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      byWord.set(word(file), (byWord.get(word(file)) ?? 0) + 1);
    }
    const stale = Object.keys(ALREADY).filter((key) => (byWord.get(key) ?? 0) < 2);
    assert.deepEqual(stale, [], 'もう被っていないのに、逃がし表に残っている名前');
  });
});

describe('同じ題材の見本', () => {
  it('**名前が同じ／含む見本どうしは、互いを参照している**', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'));
    const items = files.map((file) => {
      const name = file.replace('.zumen.yaml', '');
      return {
        file,
        name,
        number: name.split('-')[0]!,
        word: name.replace(/^[0-9]+-/, '').replace(/図$/, ''),
        text: readFileSync(new URL(file, dir), 'utf8'),
      };
    });
    const lonely: string[] = [];
    for (const a of items) {
      for (const b of items) {
        if (a.file === b.file) continue;
        const same = a.word === b.word;
        const inside = a.word.length >= 4 && b.word.length > a.word.length && b.word.includes(a.word);
        if (!same && !inside) continue;
        if (!a.text.includes(`見本 ${b.number}`)) lonely.push(`${a.name} が 見本 ${b.number} を指していない`);
      }
    }
    assert.deepEqual(lonely, [], '同じ題材なのに、互いを指していない見本');
  });
});

describe('規格番号の書き方', () => {
  const STANDARD = /(JIS|ISO|IEC|IEEE|ANSI|EN|JAS)\s+([A-Z]{0,2}\s?[0-9]{3,5})(:[0-9]{4})?/g;

  it('**同じ図の中で、版の有無が混ざっていない**', () => {
    const dir = new URL('../examples/gallery/', import.meta.url);
    const mixed: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const text = readFileSync(new URL(file, dir), 'utf8');
      const seen = new Map<string, Set<string>>();
      for (const found of text.matchAll(STANDARD)) {
        const key = `${found[1]} ${found[2]!.replace(/\s+/g, ' ').trim()}`;
        seen.set(key, (seen.get(key) ?? new Set()).add(found[3] ?? ''));
      }
      for (const [key, versions] of seen) {
        if (versions.size > 1 && versions.has('')) {
          mixed.push(`${file}: ${key} が ${[...versions].map((v) => v || '（版なし）').join(' と ')}`);
        }
      }
    }
    assert.deepEqual(mixed, [], '同じ規格を、版つきと版なしで書いている');
  });
});

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

  /**
   * **年は「どこかにある」では足りない。番号に付いていること**（2026-09-22。82 周目）。
   *
   * 上の検査は**コメントのどこかに 4 桁の年**があれば通していた。
   * だから `JIS B 0401 ＝ ISO 286` のように**版の無い引用**が、
   * 別の年（改正の年や調べた年）に紛れて通っていた ——
   * 測ったら **8 枚**にそういう引用があり、**5 枚は断りも無かった。**
   *
   * ここは **`番号:年` が付いているか、`版は確かめていない` と書いてあるか**だけを見る。
   * **部の番号（`-2`）は版ではない。**
   */
  it('**版の無い引用があるなら、確かめていないと書いてある**', () => {
    const CITE =
      /(JIS|ISO|IEC|IEEE|ANSI|EN|JAS|DIN|ASTM|JEM)(\/[A-Z]+)?\s+([A-Z]{0,2}\s?[0-9]{3,5})(-[0-9]+)?(:[0-9]{4}(-[0-9]+)?)?/g;
    const silent: string[] = [];
    for (const file of files) {
      const text = readFileSync(new URL(file, dir), 'utf8');
      const bare = [...text.matchAll(CITE)].filter((found) => found[5] === undefined);
      if (bare.length === 0) continue;
      if (/版は確かめていない/.test(text)) continue;
      silent.push(`${file}: ${[...new Set(bare.map((f) => f[0].trim()))].join(' / ')}`);
    }
    assert.deepEqual(silent, [], '版の無い引用があるのに、確かめていないと書いていない見本');
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

/**
 * **矢じりが向きを持っていること**（2026-09-24。`qa/品質100周` 第 18 周）。
 *
 * 見本 45（駅の構内図）を実物で見て見つけた。
 * 隣り合う部屋を結ぶと、**両端を縁で切った結果が同じ点になる。**
 * 長さゼロの線に `marker-end` を付けても SVG の `orient="auto"` は向きを決められず、
 * **矢印が全部右を向く** —— 南口 → 改札（左向き）も、改札 → コンコース（下向き）も
 * 見た目が同じ「▶」になっていた。
 *
 * 見つけた時点で **603 本中 18 本 ／ 8 枚**（40・45 が各 4 本、116 が 3 本）。
 * `src/layout.ts` の `nudge()` で直した。**ここは戻らないことだけを見る。**
 */
describe('矢じりの向き', () => {
  it('**矢印つきの線が、長さゼロになっていない**', () => {
    const short: string[] = [];
    let total = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.svg') && !f.endsWith('-dark.svg'))) {
      const svg = readFileSync(new URL(file, dir), 'utf8');
      for (const found of svg.matchAll(/<path d="M ([\d.-]+) ([\d.-]+)((?: L [\d.-]+ [\d.-]+)+)"[^>]*marker-end/g)) {
        total += 1;
        const tail = [...(found[3] ?? '').matchAll(/L ([\d.-]+) ([\d.-]+)/g)].at(-1);
        if (tail === undefined) continue;
        const dx = Number(tail[1]) - Number(found[1]);
        const dy = Number(tail[2]) - Number(found[2]);
        if (dx * dx + dy * dy < 4) short.push(`${file}: (${found[1]}, ${found[2]})`);
      }
    }
    assert.ok(total > 400, `矢印つきの線が少なすぎる: ${total}`);
    assert.deepEqual(short, [], '長さゼロの矢印（向きを持てないので、全部右を向く）');
  });
});

/**
 * **同じ 2 つの箱を結ぶ線が、重ならずに分かれていること**
 * （2026-09-25。`qa/品質100周` 第 51 周）。
 *
 * 見本 86（CRUD 管理画面の画面遷移）を実物で見て見つけた。
 * 正本には `一覧 → 削除確認（削除）` と `削除確認 → 一覧（削除して戻る）` の
 * **2 本**が書いてあるのに、2 つの箱が縦に並んでいるせいで
 * **両方が同じ直線の上に出ていた。**
 *
 * 絵としては「**両端に矢じりがある 1 本の線**」になり、ラベルが 2 つ積まれる ——
 * **どちらの言葉がどちらの向きか、読んだ人には決められない。**
 * `src/layout.ts` の `fanOut()` で直した。**ここは戻らないことだけを見る。**
 */
describe('往復する線', () => {
  it('**同じ 2 点を結ぶ線が、同じ道の上に重なっていない**', () => {
    const stacked: string[] = [];
    let pairs = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      const [, body = ''] = source.split('\nedges:\n');
      const seen = new Map<string, number>();
      for (const block of body.split('  - from:').slice(1)) {
        const ends = /^\s*(\S+)\s*\n\s*to:\s*(\S+)/.exec(block);
        if (ends === null || ends[1] === ends[2]) continue;
        if (/^\s+via:/m.test(block)) continue;
        const key = [ends[1], ends[2]].sort().join('\u0000');
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      if (![...seen.values()].some((count) => count > 1)) continue;
      pairs += 1;
      const svg = readFileSync(new URL(file.replace('.zumen.yaml', '.svg'), dir), 'utf8');
      // **向きを外して比べる。** 往復する 2 本は `A→B` と `B→A` で、
      // 文字列としては別物だが、**紙の上では同じ 1 本**になる。
      const once = new Set<string>();
      for (const found of svg.matchAll(/<path d="(M [^"]+)"/g)) {
        const d = found[1];
        if (d === undefined) continue;
        const points = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((p) => `${p[1]},${p[2]}`);
        if (points.length !== 2) continue;
        const key = [...points].sort().join(' ');
        if (once.has(key)) stacked.push(`${file}: ${d}`);
        once.add(key);
      }
    }
    assert.ok(pairs > 0, '往復する線を持つ見本が 1 枚も無い —— 検査が空回りしている');
    assert.deepEqual(stacked, [], '同じ道の上に 2 本以上（どちらの向きか読めない）');
  });
});

/**
 * **実寸で描いた図には、縮尺の物差しがある**（2026-09-25）。
 *
 * オーナーが X で見せてくれた平面図（`A-01 平面計画`）と見比べて見つけた ——
 * **`scale` を書いている見本が 122 枚あるのに、物差しは 0 枚だった。**
 *
 * `scale: { mm: 20 }` は正本にはあるが、**SVG を web へ貼った時点で縮尺は失われる**
 * （ブラウザが伸び縮みさせる。md-business に埋め込むときも同じ）。
 * **物差しだけは図と一緒に伸び縮みするので、そこだけ生き残る。**
 */
describe('縮尺の物差し', () => {
  it('**`scale` のある見本には、物差しが付いている**', () => {
    const missing: string[] = [];
    let withScale = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      if (!/^scale:/m.test(source)) continue;
      withScale += 1;
      const svg = readFileSync(new URL(file.replace('.zumen.yaml', '.svg'), dir), 'utf8');
      if (!svg.includes('data-name="scalebar"')) missing.push(file);
    }
    assert.ok(withScale > 100, `実寸の見本が少なすぎる: ${withScale}`);
    assert.deepEqual(missing.slice(0, 5), []);
  });

  it('**物差しの無い図に、物差しが出ていない**（`scale` を書いていない図）', () => {
    const stray: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const source = readFileSync(new URL(file, dir), 'utf8');
      if (/^scale:/m.test(source)) continue;
      const svg = readFileSync(new URL(file.replace('.zumen.yaml', '.svg'), dir), 'utf8');
      if (svg.includes('data-name="scalebar"')) stray.push(file);
    }
    assert.deepEqual(stray.slice(0, 5), []);
  });
});
