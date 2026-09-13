/**
 * **路線の色**（`palette` と `nodes[].color` / `edges[].color`）。
 *
 * ## DESIGN.md §7 の例外
 *
 * `DESIGN.md` §7 は「**色ではなく形で意味を持たせる**」と決めている。
 * 白黒で印刷しても、色覚特性でも、縮小しても失われないため。
 *
 * オーナーの判断（2026-09-13）。
 *
 * > **色が文化であれば色のルールが優先されます。**
 *
 * 日本の路線図では**色が路線の名前**（銀座線はオレンジ、丸ノ内線は赤）。
 * 「オレンジの線」と言えば銀座線のことで、**色を落とすと名前が消える。**
 * §7 が想定した「見た目の飾り」ではなく、**記法そのもの。**
 *
 * 同じことが他にもある —— 配管の識別色（JIS Z 9102）、電線の相色、
 * 危険物の標識、HACCP の器具の色分け。**どれも規格や慣習が色を決めている。**
 *
 * ## こちらは色を持たない
 *
 * **正本が色を決める。** 銀座線のオレンジを zumen が知っている必要は無いし、
 * 知っていると事業者が色を変えたときに嘘になる。
 * `palette` に書いてあるものだけを使う（`symbol` の語を規格に委ねたのと同じ筋）。
 *
 * ## それでも、色だけに頼らせない
 *
 * 実物の東京メトロも**色と番号の両方**で読ませている（`G-09` の `G`）。
 * 色覚特性のある人と、白黒で刷った人が読めなくなるため。
 *
 * **`palette` の鍵は路線記号そのもの**にし、
 * **その記号が図に文字として出ていること**を検証器が見る（`color-without-code`）。
 * 薄すぎる色も知らせる（`color-faint`）。
 */

/** `#rrggbb` だけ受ける。**3 桁も色名も受けない**（貼り先で解釈が割れる）。 */
const HEX = /^#[0-9a-fA-F]{6}$/;

export type Palette = Record<string, string>;

export function paletteOf(raw: unknown): Palette {
  if (raw === null || typeof raw !== 'object') return {};
  const out: Palette = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && HEX.test(value)) out[key] = value.toLowerCase();
  }
  return out;
}

/** 鍵から色を引く。**鍵に無ければ使わない**（勝手な色を作らない）。 */
export function colorOf(key: unknown, palette: Palette): string | null {
  if (typeof key !== 'string') return null;
  return palette[key] ?? null;
}

/** 相対輝度（WCAG）。`src/tokens.ts` と同じ式。 */
function luminance(hex: string): number {
  const parts = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
}

/** 地に対するコントラスト比。**非文字の下限は 3:1**（`DESIGN.md` §7）。 */
export function contrastOn(color: string, ground: string): number {
  const [a, b] = [luminance(color), luminance(ground)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** 非文字の下限。これを割ると、線が地に沈んで見えない。 */
export const FAINT = 3;

/**
 * **両方の地**（`src/tokens.ts` の `paper`）。
 *
 * zumen は同じ正本から**ライトとダークの両方**を書き出す。
 * 片方の地だけで見ていると、もう片方で線が沈んでいることに気づけない
 * （2026-09-13。のりかえ案内図の JR の灰色が、ダークで見えていなかった）。
 */
export const GROUNDS = ['#ffffff', '#0f0f13'] as const;

/** どちらかの地で沈むか。 */
export function faintOn(color: string): boolean {
  return GROUNDS.some((ground) => contrastOn(color, ground) < FAINT);
}
