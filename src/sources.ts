/**
 * **出典**（`sources`）。図の下端に 1 行ずつ描く。
 *
 * 2026-10-04。実在のデータ（災害・施設・規格の数）を描いた図は、**出典と日付を図そのものに出す**と決めている。
 * それまでは正本のコメントにしか書いておらず、**図だけを見た人には出典が届かなかった**
 * （SVG を 1 枚だけ貼る使い方では、コメントは消える）。
 *
 * 施設データの API が 1 件ごとに license と attribution を返し、表示するときは出典の表示を必須にしているのを見て、
 * 同じことを図でもできるようにした。
 *
 * ```yaml
 * sources:
 *   - { name: 気象庁「津波警報・注意報の発表状況」, url: https://www.jma.go.jp/…, retrieved: 2026-09-29 }
 *   - { name: 国土地理院 地理院地図, license: 出典表示で利用可 }
 * ```
 */

export interface Source {
  name: string;
  url: string | null;
  /** 取得日（`YYYY-MM-DD`）。 */
  retrieved: string | null;
  license: string | null;
}

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : v instanceof Date ? v.toISOString().slice(0, 10) : null;

/** 読めない項目は落とす（`name` の無いものは描かない。`validate` が知らせる）。 */
export function sourcesOf(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];
  const out: Source[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const name = text(r.name);
    if (name === null) continue;
    out.push({ name, url: text(r.url), retrieved: text(r.retrieved), license: text(r.license) });
  }
  return out;
}

/** 1 行の高さ（px）と字の大きさ。 */
export const SOURCE_LINE = 14;
export const SOURCE_FONT = 10;
