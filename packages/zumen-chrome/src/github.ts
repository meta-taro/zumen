/**
 * GitHub のページから、zumen の正本を見つける決まり。
 *
 * **ブラウザを立てずに確かめられる所だけを置く**（`test/chrome.test.ts`）。
 * DOM を触る入口（`content.ts`）は薄く保つ。
 *
 * どこに正本があるか（2026-11-02 に github.com の実物で確かめた）：
 *
 * | 画面 | 正本の置き場 |
 * |---|---|
 * | Markdown の表示（README・Issue・PR 本文）| ```` ```zumen ```` の囲みが `pre[lang="zumen"] > code` になる |
 * | `*.zumen.yaml` のファイル表示 | 全文が `#read-only-cursor-text-area`（読み取り専用の textarea）に入る |
 */

export type Theme = 'light' | 'dark';

/** Markdown の中の zumen の囲み。 */
export const FENCE_SELECTOR = 'pre[lang="zumen"]';
/** ファイル表示で、全文を持っている欄。 */
export const BLOB_TEXT_SELECTOR = '#read-only-cursor-text-area';
/** 描いた欄に付ける印。同じものを 2 度描かない。 */
export const PANEL_CLASS = 'zumen-chrome-panel';

/** `*.zumen.yaml`（`.yml` も）か。 */
export function isZumenFile(path: string): boolean {
  return /\.zumen\.ya?ml$/.test(path);
}

/** PR の差分の画面（`/pull/<番号>/changes`、古い `/files` も）なら、持ち主・リポ・番号。 */
export function pullOf(pathname: string): { owner: string; repo: string; number: number } | null {
  const m = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/(?:changes|files)\/?$/.exec(pathname);
  return m ? { owner: m[1]!, repo: m[2]!, number: Number(m[3]) } : null;
}

export interface Revisions {
  base: string;
  head: string;
}

/**
 * PR の画面に埋め込まれた JSON（`script[data-target="react-app.embeddedData"]`）から、
 * **いま差分に出ている** 2 つの commit を読む。
 *
 * commit を絞って見ているとき（`selectedRange`）はそちら、そうでなければ PR 全体（`fullDiff`）。
 * 形が変わって読めなければ null —— **違う commit で描くより、描かないほうがよい。**
 * （2026-11-02 に github.com の実物で確かめた形。`payload.pullRequestsChangesRoute.comparison`）
 */
export function revisionsOf(embedded: string): Revisions | null {
  try {
    const comparison = JSON.parse(embedded)?.payload?.pullRequestsChangesRoute?.comparison;
    const pick = (range: unknown): Revisions | null => {
      const r = range as { baseOid?: unknown; headOid?: unknown } | null | undefined;
      const sha = /^[0-9a-f]{40}$/;
      return typeof r?.baseOid === 'string' && typeof r.headOid === 'string' && sha.test(r.baseOid) && sha.test(r.headOid)
        ? { base: r.baseOid, head: r.headOid }
        : null;
    };
    return pick(comparison?.selectedRange) ?? pick(comparison?.fullDiff);
  } catch {
    // 埋め込みの形が変わった。描かない（上の理由）。
    return null;
  }
}

/**
 * 差分の見出しのファイル名から、変更前と変更後の場所。
 * GitHub は名前の前後に向きの印（U+200E）を付け、改名は `古い → 新しい` と書く。
 */
export function pathsOf(heading: string): { before: string; after: string } {
  const text = heading.replace(/[‎‏]/g, '').trim();
  const [before, after] = text.split(' → ');
  return { before: before!.trim(), after: (after ?? before!).trim() };
}

/** その commit の正本を読む URL（github.com の raw。非公開のリポもログインのまま読める）。 */
export function rawUrl(owner: string, repo: string, sha: string, path: string): string {
  return `/${owner}/${repo}/raw/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** `/<owner>/<repo>/blob/<ref>/…/<名前>.zumen.yaml` か。ref や途中の階層は問わない。 */
export function isZumenBlobPath(pathname: string): boolean {
  return /^\/[^/]+\/[^/]+\/blob\/.+\.zumen\.ya?ml$/.test(pathname);
}

/**
 * GitHub の色の決まり（`<html data-color-mode>`）から、図の地を選ぶ。
 * `auto` は OS の設定に従う（GitHub 自身と同じ）。
 */
export function themeOf(colorMode: string | undefined, prefersDark: boolean): Theme {
  if (colorMode === 'dark') return 'dark';
  if (colorMode === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
