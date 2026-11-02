/**
 * プレビューから図を保存する（SVG と PNG）。
 *
 * **保存する図はライトの地で描く。** プレビューは VS Code の色に合わせて暗いこともあるが、
 * 保存した図は文書やスライドに貼られることが多く、そこはたいてい白い地だから。
 *
 * PNG は画面（Webview）の中で SVG を 2 倍の大きさで絵にして作る。
 * 拡張の本体は届いた中身をファイルに書くだけ。
 */

export type SaveFormat = 'svg' | 'png';

/** PNG は画面で見る大きさの 2 倍で作る（高精細の画面や資料で粗く見えないように）。 */
export const PNG_SCALE = 2;

/** `kitchen.zumen.yaml` → `kitchen.svg`。正本の名前を引き継ぐ。 */
export function saveName(sourceName: string, format: SaveFormat): string {
  const base = sourceName.replace(/\.zumen\.ya?ml$/i, '').replace(/\.ya?ml$/i, '');
  return `${base === '' ? 'diagram' : base}.${format}`;
}

/** 画面から届く PNG（`data:image/png;base64,…`）を中身にする。それ以外は受けない。 */
export function pngBytes(dataUrl: string): Uint8Array | null {
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) return null;
  return Uint8Array.from(Buffer.from(dataUrl.slice(prefix.length), 'base64'));
}

/** SVG の `viewBox` から、絵にするときの大きさを読む。読めなければ null。 */
export function svgSize(svg: string): { width: number; height: number } | null {
  const opening = /^<svg\b[^>]*>/.exec(svg.trim());
  const box = opening === null ? null : /viewBox\s*=\s*"([^"]+)"/.exec(opening[0]);
  if (box === null) return null;
  const parts = box[1]!.trim().split(/[\s,]+/).map(Number);
  const [, , width, height] = parts;
  if (parts.length !== 4 || !(width! > 0) || !(height! > 0)) return null;
  return { width: width!, height: height! };
}
