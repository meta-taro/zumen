/**
 * **英語のページに、日本語のキャプションが 1 枚だけ残らないこと**（2026-09-16）。
 *
 * 見本を足して英語を書き忘れると、**英語のギャラリーにその 1 枚だけ日本語が出る。**
 * 141 枚ぜんぶ英語で、1 枚だけ日本語 —— 気づくのはたいてい人に見せたあと。
 *
 * 並びと分類の正本は `scripts/gallery-categories.mjs`、
 * 英語は名前で引く辞書（`scripts/gallery-en.mjs`）。**混ぜない。**
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
// @ts-expect-error 組み立て用のスクリプトは型を持たない（下で形を言う）
import { CATEGORIES } from '../scripts/gallery-categories.mjs';
// @ts-expect-error 同上
import { CAPTIONS_EN, GROUPS_EN, ORDER_EN } from '../scripts/gallery-en.mjs';

/** `.mjs` は型を持たないので、ここで形だけ言う。 */
interface Item {
  name: string;
}
interface Group {
  key: string;
  items: Item[];
}
const groups = CATEGORIES as Group[];
const captions = CAPTIONS_EN as Record<string, string>;
const heads = GROUPS_EN as Record<string, string>;

const names: string[] = groups.flatMap((group) => group.items.map((item) => item.name));
const items = groups.flatMap((group) => group.items) as { name: string; alt?: string; caption?: string }[];

describe('見本の英語', () => {
  it('**どの見本にも英語がある**', () => {
    const missing = names.filter((name) => captions[name] === undefined);
    assert.deepEqual(missing, [], '英語のキャプションが無い見本');
  });

  it('**使われていない英語が残っていない**（見本を消したときの取り残し）', () => {
    const extra = Object.keys(captions).filter((name) => !names.includes(name));
    assert.deepEqual(extra, [], 'もう無い見本の英語が残っている');
  });

  it('**どの分類にも英語がある**', () => {
    const missing = groups.map((g) => g.key).filter((key) => heads[key] === undefined);
    assert.deepEqual(missing, []);
  });

  it('**英語のほうに日本語を書いていない**（貼り間違いの検出）', () => {
    const japanese = Object.entries(captions)
      .filter(([, text]) => /[ぁ-んァ-ヶ一-龠]/.test(text))
      .map(([name]) => name);
    assert.deepEqual(japanese, []);
  });

  it('**英語のページが、全部の見本を出している**', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('site/en/index.html', 'utf8');
    const figures = page.match(/<figure[^>]*data-cat=/g) ?? [];
    assert.equal(figures.length, names.length, '英語のページの枚数が合っていない');
  });
});

/**
 * **英語のページは、英語で書いた図から見せる**（2026-09-16）。
 *
 * 並びの正本は 1 つ（`gallery-categories.mjs`）だが、
 * **どちらの言語のページでも同じ順に出すと、英語のページは日本の路線図から始まる。**
 * 図の中の文字が日本語のままなので、初めて見た人はそこで読むのをやめる。
 *
 * 分類の順を英語だけ差し替え、分類の中では**名前が英字の見本を先に**出す
 * （英字の名前は、図の中も英語で書いたもの）。**見本は 1 枚も落とさない。**
 */
/**
 * **代替テキスト（alt）は、見出しの繰り返しにしない**（2026-09-20）。
 *
 * `alt` は目の見えない人に読み上げられ、検索にも使われる。
 * **`<figcaption>` と同じ文字を `alt` に入れると、同じ言葉が 2 回読まれるだけ**で、
 * 図の中身は何ひとつ伝わらない。測ったら **21 枚**がそうなっていた。
 *
 * `alt` は「その図に何が描いてあるか」、`caption` は「その図の見どころ」。**別のものを書く。**
 */
describe('見本の代替テキスト', () => {
  it('**alt が空でない**', () => {
    const empty = items.filter((item) => (item.alt ?? '').trim() === '').map((item) => item.name);
    assert.deepEqual(empty, []);
  });

  /**
   * **20 字未満の alt は、題名を言い直しているだけ**（2026-09-20）。
   *
   * 「クラス図（UML）」の alt が「UML クラス図」では、**見えない人には何も増えない。**
   * alt には「何が描いてあるか」—— 要素と、その関係を書く。
   * 測ったら 94 枚が 20 字未満だったので、3 周かけて全部書き直した。
   */
  it('**alt が 20 字以上ある**（題名の言い直しにしない）', () => {
    const thin = items
      .filter((item) => (item.alt ?? '').length < 20)
      .map((item) => `${item.name}: ${item.alt}`);
    assert.deepEqual(thin, [], 'alt が短すぎる（図の中身を書く）');
  });

  it('**alt が caption の繰り返しになっていない**', () => {
    const same = items
      .filter((item) => (item.alt ?? '').trim() === (item.caption ?? '').trim())
      .map((item) => item.name);
    assert.deepEqual(same, [], 'alt が caption と同じ（読み上げると同じ言葉が 2 回出る）');
  });
});

/**
 * **英語のページに、日本語の代替テキストが残っていた**（2026-09-20）。
 *
 * 見本ごとのページは、**言語にかかわらず日本語の `alt`** を書き出していた ——
 * 英語圏の読み上げ環境では、**英語のページで日本語が読み上げられる。**
 * 272 枚すべてがそうだった。図の説明は、そのページの言語で書く。
 */
describe('英語のページの代替テキスト', () => {
  it('**英語のページの alt に、日本語が混ざっていない**', async () => {
    const { readFileSync } = await import('node:fs');
    for (const path of ['site/en/index.html', 'site/en/g/01/index.html', 'site/en/g/271/index.html']) {
      const page = readFileSync(path, 'utf8');
      const alts = page.match(/alt="[^"]*"/g) ?? [];
      const japanese = alts.filter((text) => /[ぁ-んァ-ヶ一-龠]/.test(text));
      assert.deepEqual(japanese, [], `${path} の alt に日本語が残っている`);
    }
  });
});

describe('英語のページの並び', () => {
  it('**分類の順が、英語だけ違う**（建築から始まり、日本の鉄道は最後）', () => {
    const order = ORDER_EN as string[];
    assert.equal(order[0], 'kenchiku');
    assert.equal(order[order.length - 1], 'tetsudo');
  });

  it('**分類を 1 つも落としていない**', () => {
    const order = [...(ORDER_EN as string[])].sort();
    assert.deepEqual(order, groups.map((g) => g.key).sort());
  });

  it('**英語のページは、英字の名前の見本から始まる**', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('site/en/index.html', 'utf8');
    const first = /<img loading="lazy"[^>]*src="\.\.\/gallery\/([^"]+)\.svg"/.exec(page);
    assert.ok(first !== null, '英語のページに見本が 1 枚も無い');
    assert.ok(
      !/[ぁ-んァ-ヶ一-龠]/.test(first[1]!),
      `英語のページが日本語の見本から始まっている: ${first[1]}`,
    );
  });

  it('**日本語のページの並びは変わっていない**（路線図から始まる）', async () => {
    const { readFileSync } = await import('node:fs');
    const page = readFileSync('site/index.html', 'utf8');
    const first = /<img loading="lazy"[^>]*src="gallery\/([^"]+)\.svg"/.exec(page);
    assert.equal(first?.[1], '25-路線図');
  });
});

/**
 * **「ほとんどは日本語です」を、数字で言う**（2026-09-16）。
 *
 * 英語のページには「Most of the drawings are lettered in Japanese」と書いてあった。
 * **書いた日は正しかった。** その後で英語の見本が 23 枚まで増え、
 * 並びも英語の図から始まるようになったのに、**文はそのままだった。**
 *
 * 数えられるものを手で書くと必ずずれるので、`scripts/gallery.mjs` が数えて入れる。
 * ここはその数字が正本（`examples/gallery/`）と合っているかだけを見る。
 */
describe('英語のページの「何枚が英語か」', () => {
  it('**ページに書いてある数が、実際の枚数と合っている**', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const files = readdirSync('examples/gallery')
      .filter((name) => name.endsWith('.zumen.yaml'))
      .map((name) => name.replace('.zumen.yaml', ''));
    const english = files.filter((name) => !/[ぁ-んァ-ヶ一-龠]/.test(name)).length;

    const page = readFileSync('site/en/index.html', 'utf8');
    const said = /<span data-count="english">(\d+)<\/span>/.exec(page);
    const total = /<span data-count="total">(\d+)<\/span>/.exec(page);
    assert.ok(said !== null, '英語の枚数が書かれていない');
    assert.ok(total !== null, '全体の枚数が書かれていない');
    assert.equal(Number(said[1]), english);
    assert.equal(Number(total[1]), files.length);
  });
});

/**
 * **一覧に載せ忘れた見本は、黙って消える**（2026-09-21）。
 *
 * 紹介ページは `scripts/gallery-categories.mjs` の一覧から組み立てる。
 * **そこへ足し忘れると、`pnpm gallery` は何も言わずにその 1 枚を飛ばす** ——
 * 正本もテストも通るのに、**世に出るページにだけ載っていない**状態になる。
 *
 * ベースルール §23（参照とアップロードを分離させない）と同じ形なので、
 * **CI に見させる。**
 */
describe('一覧と実物', () => {
  const dir = new URL('../examples/gallery/', import.meta.url);
  const samples = (): string[] =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.zumen.yaml'))
      .map((f) => f.replace('.zumen.yaml', ''));

  it('**どの見本も、分野の一覧に載っている**', () => {
    const cats = readFileSync(new URL('../scripts/gallery-categories.mjs', import.meta.url), 'utf8');
    const listed = new Set([...cats.matchAll(/\{ name: '([^']+)'/g)].map((m) => m[1]!));
    assert.deepEqual(samples().filter((s) => !listed.has(s)), [], '一覧に載っていない見本');
  });

  it('**一覧にあって、実物が無いものは無い**', () => {
    const cats = readFileSync(new URL('../scripts/gallery-categories.mjs', import.meta.url), 'utf8');
    const listed = [...cats.matchAll(/\{ name: '([^']+)'/g)].map((m) => m[1]!);
    const have = new Set(samples());
    assert.deepEqual(listed.filter((n) => !have.has(n)), [], '実物の無い見出し');
  });

  it('**同じ見本が 2 つの分野に出ていない**', () => {
    const cats = readFileSync(new URL('../scripts/gallery-categories.mjs', import.meta.url), 'utf8');
    const listed = [...cats.matchAll(/\{ name: '([^']+)'/g)].map((m) => m[1]!);
    const twice = listed.filter((n, i) => listed.indexOf(n) !== i);
    assert.deepEqual(twice, []);
  });
});

/**
 * **英語ページの説明にも、同じ下限を当てる**（2026-09-21）。
 *
 * 日本語の alt は 20 字の下限を入れて全部書き直したのに、
 * **英語側は「Data flow」「Transit map」のまま**だった ——
 * 測ったら **9 字から 350 字まで**ばらつき、**19 件が 20 字未満。**
 * 英語ページでは、この文が alt にも説明にも使われる。
 */
describe('英語の説明の長さ', () => {
  it('**どれも 40 字以上ある**（題名の言い直しにしない）', () => {
    const thin = Object.entries(CAPTIONS_EN)
      .filter(([, text]) => text.length < 40)
      .map(([name, text]) => `${name}: ${text}`);
    assert.deepEqual(thin, [], '英語の説明が短すぎる');
  });

  it('**長すぎもしない**（400 字を超えない）', () => {
    const fat = Object.entries(CAPTIONS_EN)
      .filter(([, text]) => text.length > 400)
      .map(([name, text]) => `${name}: ${text.length}`);
    assert.deepEqual(fat, []);
  });
});
