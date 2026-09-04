/**
 * Markdown 本文の ```` ```zumen ```` の囲みを、描いた図へ差し替える。
 *
 * **差し替えは本文の段階で行う。** 出来上がった画面へ後から挿す形にすると、
 * 画面には出るのに書き出すと消える、が起きる。プレビューも PDF も書き出しも
 * 同じ本文を通るようにしておけば、描画の経路が 1 本で済む。
 * この作法は md-business の `apps/desktop/src/lib/markdown/fencedBlocks.ts` に合わせた。
 * **こちらの都合で別の作法を持ち込まない**（Issue 012）。
 *
 * 囲みの拾い方も同じ規則にしてある（囲みの中の囲みは中身ではなく見本、
 * 同じ囲みは 1 回だけ、3 個以上の記号と `~` も囲みとして扱う）。
 * **同じ規則を 2 か所に持つことになるので、片方だけ直さない。**
 * ここを md-business 側から呼ぶ形にできるなら、そちらのほうがよい。
 */
import { layout } from './layout.ts';
import { parse } from './format.ts';
import { render } from './render.ts';

export interface ZumenBlock {
  /** 囲みごとの元の文字列。差し替えのときの目印になる。 */
  raw: string;
  /** 囲みの中身。 */
  body: string;
}

const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/** 囲みの中の囲みは中身ではなく見本。外側の囲みを閉じるまで中は読まない。 */
export function collectBlocks(source: string, lang: string): ZumenBlock[] {
  const lines = source.split('\n');
  const blocks: ZumenBlock[] = [];
  const seen = new Set<string>();

  let index = 0;
  while (index < lines.length) {
    const opening = FENCE.exec(lines[index] ?? '');
    if (opening === null) {
      index += 1;
      continue;
    }

    const marker = opening[1]!;
    const wanted = opening[2]!.trim() === lang;
    const start = index;
    index += 1;

    while (index < lines.length) {
      const closing = FENCE.exec(lines[index] ?? '');
      if (
        closing !== null &&
        closing[1]![0] === marker[0] &&
        closing[1]!.length >= marker.length &&
        closing[2]!.trim() === ''
      ) {
        break;
      }
      index += 1;
    }

    if (wanted) {
      const end = Math.min(index, lines.length - 1);
      const raw = lines.slice(start, end + 1).join('\n');
      if (!seen.has(raw)) {
        seen.add(raw);
        blocks.push({ raw, body: lines.slice(start + 1, index).join('\n') });
      }
    }

    index += 1;
  }

  return blocks;
}

export function collectZumenBlocks(source: string): ZumenBlock[] {
  return collectBlocks(source, 'zumen');
}

/** 渡されなかった囲みはそのまま残す（読み込みがまだ終わっていないだけかもしれない）。 */
export function replaceZumenBlocks(source: string, rendered: ReadonlyMap<string, string>): string {
  let out = source;
  for (const [raw, replacement] of rendered) out = out.split(raw).join(replacement);
  return out;
}

/** 図 1 枚を SVG にする。md-business 側から呼ぶのはここ 1 つで足りる。 */
export async function toSvg(zumenSource: string): Promise<string> {
  return render(await layout(zumenSource));
}

export interface RenderBlocksOptions {
  /** 描けなかった理由を 1 文にする。文言はここで決めず、呼ぶ側の訳語に任せる。 */
  describe?: (message: string) => string;
}

/**
 * 本文の中の囲みを、すべて描いて差し替え表を返す。
 *
 * **描けなかったものを黙って空にしない。** 理由をその位置に出し、書いた指定も
 * そのまま残す（md-business の `loadData.ts` と同じ作法）。
 * 黙って消すと、書いた人は「描けている」と思ったまま気づかない。
 *
 * 書きかけの囲みでも理由が出ることになるが、**消えるよりはよい。**
 */
export async function renderZumenBlocks(
  source: string,
  options: RenderBlocksOptions = {},
): Promise<Map<string, string>> {
  const describe = options.describe ?? ((message: string) => `図を描けませんでした: ${message}`);
  const out = new Map<string, string>();

  for (const block of collectZumenBlocks(source)) {
    if (block.body.trim() === '') continue;
    try {
      const svg = withExplicitSize(await toSvg(block.body));
      out.set(block.raw, `![${altOf(block.body)}](${toDataUri(svg)})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      out.set(block.raw, `> ${describe(message)}\n\n${block.raw}`);
    }
  }
  return out;
}

/**
 * 大きさを実寸で書き入れる。
 *
 * 画像として貼ると外側の幅が伝わらないので、割合指定では大きさが決まらない。
 * `viewBox` の値をそのまま実寸として入れる（縦横比は保たれ、表示側の
 * `max-width` で縮む）。md-business の Mermaid 側と同じ扱い。
 */
export function withExplicitSize(svg: string): string {
  const opening = /^<svg\b[^>]*>/.exec(svg.trim());
  if (opening === null) return svg;
  const box = /viewBox\s*=\s*"([^"]+)"/.exec(opening[0]);
  if (box === null) return svg;
  const parts = box[1]!.trim().split(/[\s,]+/);
  if (parts.length !== 4) return svg;
  const attributes = opening[0]
    .replace(/\s(?:width|height)\s*=\s*"[^"]*"/g, '')
    .replace(/^<svg/, `<svg width="${parts[2]}" height="${parts[3]}"`);
  return svg.trim().replace(opening[0], attributes);
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/** 図の題を説明に使う。括弧が入ると記法が閉じてしまうので落とす。 */
function altOf(body: string): string {
  let title = '';
  try {
    title = String((parse(body).doc.toJS() as { title?: string }).title ?? '');
  } catch {
    title = '';
  }
  const source = title === '' ? '構成図' : title;
  return source.replace(/[[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}
