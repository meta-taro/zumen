/**
 * **同梱の見本を、エージェントが引けるようにする**（`zumen_examples`）。
 *
 * ## なぜ要るか
 *
 * 測ってみたとおり、**リポジトリの中にしか無い決まりは、他の人には届かない。**
 * `zumen_spec` は「どう書くか」を渡す。`zumen_about` は「何の道具か」を渡す。
 * **「世の中にどんな図面があるか」は、どこからも渡っていなかった。**
 *
 * zumen の値打ちは書き方ではなく、**歯周チャート・木取り図・仕込図・査定図が
 * 実際にどう組まれているか**のほうにある。
 * 入れた人のエージェントがそれを引けなければ、**汎用ダイアグラムを量産する道具**に戻る。
 *
 * ## 何を返すか
 *
 * 目次（分類と一行）と、**正本そのもの**（`*.zumen.yaml`）。
 * 一行は「その図の決まりごと」を書いてある —— 「販売図面（作るための図ではなく、
 * 決めるための図）」のように、**題名ではなく中身**。
 *
 * 目次は `pnpm gallery` が `examples/gallery/index.json` へ書き出す
 * （正本は `scripts/gallery-categories.mjs`）。**同梱されていなければ、無いと言う。**
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 見本 1 枚。 */
export interface Example {
  /** ファイル名から拡張子を取ったもの（`189-点字ブロック`）。 */
  name: string;
  /** その図の決まりごとを一行で。**題名ではない。** */
  caption: string;
  captionEn: string;
  /** **配置図（座標を自分で書く）か、構成図（機械が並べる）か。** まねる前に知りたい。 */
  kind: 'placement' | 'structure';
  /** **1 枚にいくつ違う縮尺があるか。** 2 以上なら「詳細図と全体図」を分けた見本。 */
  scales: number;
  /** **その見本が使っている道具**（`views` `scale` `hatch` など）。機能から実物を引くため。 */
  uses: string[];
}

export interface Category {
  key: string;
  label: string;
  labelEn: string;
  items: Example[];
}

export interface Catalogue {
  count: number;
  categories: Category[];
}

/**
 * `src/` からも `dist/` からも 1 つ上。`src/about.ts` と同じ筋。
 *
 * **`.pathname` ではなく `fileURLToPath`。** 見本の名前は日本語なので、
 * URL のままだと `%E7%82%B9%E5%AD%97` に化けて開けない（2026-09-19）。
 */
function root(name: string): string {
  return fileURLToPath(new URL(`../${name}`, import.meta.url));
}

const INDEX = 'examples/gallery/index.json';

/** 目次。**同梱されていなければ null**（「無い」と言えるようにする）。 */
export function catalogue(readFile: (path: string) => string = (p) => readFileSync(p, 'utf8')): Catalogue | null {
  try {
    return JSON.parse(readFile(root(INDEX))) as Catalogue;
  } catch {
    // 見本を同梱しない配り方もありうる。**黙って空を返さない**（口が null で答える）。
    return null;
  }
}

/** 見本 1 枚の正本。**無ければ null。** */
export function source(
  name: string,
  readFile: (path: string) => string = (p) => readFileSync(p, 'utf8'),
): string | null {
  // 名前はファイル名にそのまま使う。**上へ抜けさせない。**
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  try {
    return readFile(root(`examples/gallery/${name}.zumen.yaml`));
  } catch {
    return null;
  }
}

/**
 * 目次を絞る。名前・一行（和英）・道具に当たる語で。
 *
 * **語を並べてもよい**（空白・読点・中黒で区切る）。どれかに当たれば出し、
 * 当たった語の多い順に並べる。丸ごと一致だけを見ていた頃は、
 * エージェントが「劇場 照明 仕込」と並べると 0 件になり、見本を読まずに描いた（2026-10-28）。
 */
export function search(book: Catalogue, query: string): Category[] {
  const terms = query
    .toLowerCase()
    .split(/[\s、，,・／/]+/)
    .filter((term) => term !== '');
  if (terms.length === 0) return book.categories;

  const score = (item: Example): number => {
    const hay = `${item.name} ${item.caption} ${item.captionEn} ${item.kind} ${item.uses.join(' ')}`.toLowerCase();
    return terms.filter((term) => hay.includes(term)).length;
  };
  return book.categories
    .map((group) => {
      const items = group.items
        .map((item) => ({ item, hits: score(item) }))
        .filter((found) => found.hits > 0)
        .sort((a, b) => b.hits - a.hits);
      return { group: { ...group, items: items.map((found) => found.item) }, best: items[0]?.hits ?? 0 };
    })
    .filter((found) => found.group.items.length > 0)
    .sort((a, b) => b.best - a.best)
    .map((found) => found.group);
}

/** 近いと見なす下限（見本の名前の 2 文字の並びのうち、題に入っている割合）。 */
const NEAR = 0.3;

/**
 * **図の題から、近い見本を 3 枚まで出す**（`zumen_create` が作った直後に返す）。
 *
 * 見本を読むかどうかを、頼む人の書き方に任せない。題に「照明仕込図」とあれば、
 * 一次資料で確かめた仕込図の見本が、作った時点で必ず目に入るようにする。
 *
 * 比べるのは見本の名前（番号を除く）の 2 文字の並び。日本語は語の切れ目が無いので、
 * 語ではなく 2 文字ずつで見る。似ていなければ何も出さない。
 */
export function nearby(book: Catalogue, title: string, limit = 3): Example[] {
  const have = pairs(title);
  if (have.size === 0) return [];
  return book.categories
    .flatMap((group) => group.items)
    .map((item) => {
      const want = pairs(item.name.replace(/^\d+-/, ''));
      let common = 0;
      for (const pair of want) if (have.has(pair)) common += 1;
      return { item, ratio: want.size === 0 ? 0 : common / want.size };
    })
    .filter((found) => found.ratio >= NEAR)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit)
    .map((found) => found.item);
}

/** 2 文字ずつの並び。空白と記号は外す（「照明 仕込図」と「照明仕込図」を同じに見る）。 */
function pairs(text: string): Set<string> {
  const letters = [...text.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '')];
  const out = new Set<string>();
  for (let i = 0; i + 1 < letters.length; i += 1) out.add(letters[i]! + letters[i + 1]!);
  return out;
}
