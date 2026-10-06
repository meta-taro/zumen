/**
 * **正本が敷く画像を読む**（`nodes[].image`。`src/image.ts` の、ファイルを読む側）。
 *
 * 読んだ画像は **data URI で図へ埋める。** パスのまま出すと、
 * SVG を別の所（Markdown の本文・紹介ページ）へ貼った途端に画像が消える。
 *
 * ## 読まないもの
 *
 * - **正本のフォルダの外**（絶対パス・`..`）。正本は人から AI へ渡る。
 *   書いたパスで手元の別のファイルを図へ埋め込めてしまうと、図と一緒に外へ出る
 * - **png / jpg / webp でないもの**（中身の頭で見る。拡張子は信じない）
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join, normalize, sep } from 'node:path';
import { parse } from './format.ts';
import { imageSize } from './image.ts';
import type { Images } from './image.ts';

/** 1 枚の上限（バイト）。画面のキャプチャはこれで足りる。図が重くなりすぎないように。 */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const;

/** 正本に書いてある画像のパス（重複なし）。 */
export function imagePaths(text: string): string[] {
  let raw: { nodes?: { image?: unknown }[] };
  try {
    raw = parse(text).doc.toJS() as typeof raw;
  } catch {
    // 読めない正本は、図を組む側（`layout`）が理由つきで止める。ここで二重に言わない。
    return [];
  }
  const paths = (raw.nodes ?? [])
    .map((node) => node.image)
    .filter((value): value is string => typeof value === 'string' && value !== '');
  return [...new Set(paths)];
}

/** 正本のフォルダの中を指しているか。 */
export function insideDir(path: string): boolean {
  if (isAbsolute(path) || /^[a-zA-Z]:/.test(path)) return false;
  const tidy = normalize(path);
  return tidy !== '..' && !tidy.startsWith(`..${sep}`) && !tidy.startsWith('../');
}

/**
 * **画像を読んで、パス → 中身と大きさ の表にする。**
 *
 * 読めなかったものは表に入れない —— 図はパスのまま敷き、`validate` が理由を言う。
 */
export function loadImages(text: string, dir: string): Images {
  const out: Images = new Map();
  for (const path of imagePaths(text)) {
    const read = readImage(path, dir);
    if (typeof read !== 'string') out.set(path, read);
  }
  return out;
}

/** 1 枚を読む。読めなければ理由の鍵（`outside` / `missing` / `too-large` / `not-image`）。 */
export function readImage(
  path: string,
  dir: string,
): { href: string; w: number; h: number } | 'outside' | 'missing' | 'too-large' | 'not-image' {
  if (!insideDir(path)) return 'outside';
  let bytes: Uint8Array;
  try {
    bytes = readFileSync(join(dir, path));
  } catch {
    return 'missing';
  }
  if (bytes.length > IMAGE_MAX_BYTES) return 'too-large';
  const size = imageSize(bytes);
  if (size === null) return 'not-image';
  const href = `data:${MIME[size.type]};base64,${Buffer.from(bytes).toString('base64')}`;
  return { href, w: size.w, h: size.h };
}
