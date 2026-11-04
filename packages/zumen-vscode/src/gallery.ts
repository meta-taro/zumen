/**
 * ワークスペースの図の一覧（エクスプローラーの「zumen」の欄）で、探す・並べる決まり。
 *
 * **VS Code も画面も知らない。** 拡張の本体（`extension.ts`）と画面（`gallery-webview.ts`）の両方から使い、
 * テスト（`test/vscode.test.ts`）からも呼べる。
 *
 * 探すのは、ファイルの場所・題・**正本の中身ぜんぶ**（節の名前・ラベル・id・使っている節）。
 * 「pins を使っている図」「MariaDB が出てくる図」が、ファイル名を覚えていなくても引ける。
 */

export interface GalleryFile {
  /** 拡張と画面の間で、どのファイルかを指す鍵（URI の文字列）。 */
  key: string;
  /** ワークスペースからの場所（見出しと検索に使う）。 */
  path: string;
  title: string;
  source: string;
}

/** 正本の `title:`。無ければファイル名から `.zumen.yaml` を外したもの。 */
export function titleOf(source: string, path: string): string {
  const m = /^title:[ \t]*(.+?)[ \t]*$/m.exec(source);
  const raw = m?.[1]?.replace(/^(['"])(.*)\1$/, '$2').trim();
  if (raw) return raw;
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name.replace(/\.zumen\.ya?ml$/, '');
}

/**
 * 語を空白で区切り、**全部を含むもの**だけを残す（大文字小文字は見ない）。
 * 題か場所に当たったものを先に、それから場所の順に並べる。
 */
export function search(files: GalleryFile[], query: string): GalleryFile[] {
  const terms = query.toLowerCase().split(/[\s　]+/).filter((term) => term !== '');
  const hits = files.filter((file) => {
    const hay = `${file.path}\n${file.title}\n${file.source}`.toLowerCase();
    return terms.every((term) => hay.includes(term));
  });
  const head = (file: GalleryFile) => {
    const name = `${file.path}\n${file.title}`.toLowerCase();
    return terms.length > 0 && terms.every((term) => name.includes(term)) ? 0 : 1;
  };
  return hits.sort((a, b) => head(a) - head(b) || a.path.localeCompare(b.path));
}

/** 一度に読む上限。大きなリポで欄が固まらないように。超えたら、画面に「ほかに N 件」と出す。 */
export const MAX_FILES = 500;
/** 1 枚の上限（バイト）。これより大きい正本は一覧に載せるが、中身では探さない。 */
export const MAX_BYTES = 512 * 1024;
