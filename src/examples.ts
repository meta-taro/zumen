/**
 * **同梱の見本を、エージェントが引けるようにする**（`zumen_examples`）。
 *
 * ## なぜ要るか
 *
 * D39 で測ったとおり、**リポジトリの中にしか無い決まりは、他の人には届かない。**
 * `zumen_spec` は「どう書くか」を渡す。`zumen_about` は「何の道具か」を渡す。
 * **「世の中にどんな図面があるか」は、どこからも渡っていなかった。**
 *
 * zumen の値打ちは書き方ではなく、**歯周チャート・木取り図・仕込図・査定図が
 * 実際にどう組まれているか**のほうにある（`.claude/rules/専門図面の調査と実装方針.md`）。
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

/** 目次を絞る。名前・一行（和英）に当たる語で。 */
export function search(book: Catalogue, query: string): Category[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return book.categories;
  return book.categories
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.name} ${item.caption} ${item.captionEn}`.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);
}
