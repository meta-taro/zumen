/**
 * **文書に載せた正本が、zumen 自身の検証を通ること。**
 *
 * 2026-09-12、紹介のページ・README・仕様・MCP の雛形の 4 か所へ
 * **zumen が `error` で撥ねる YAML** を載せていた。
 *
 * ```yaml
 * grid:
 *   x: [{ id: X1, at: 40 }, { id: X2, at: 240 }]   # 流れ形式
 *   at:   { x: 40, y: 40 }                          # 桁を揃える空白
 * ```
 *
 * どちらも**読んで書き戻すと詰められる**ので §6.1 に反し、
 * `round-trip-changed` で落ちる。
 *
 * **人は、載っている書き方をそのまま真似る。** 手本が落ちる図なら、
 * 真似た人の図も落ちる。しかも「自分が間違えた」と思う。
 *
 * 目で見ても分からなかった。**書き戻しの差は、目で追う種類のものではない。**
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { parse, serialize } from '../src/format.ts';
import { hasError, validate } from '../src/validate.ts';

const ROOT = new URL('../', import.meta.url);

/**
 * その文書の中の、zumen の正本の断片を取り出す。
 *
 * **`version: 1` で始まるものだけ、では足りなかった。**
 * 先頭にコメント行を置いた見本が拾われず、
 * **壊した見本を入れてもテストが赤くならなかった**（2026-09-12。実地で確認した）。
 *
 * zumen の語が 1 つでも出てくる YAML は、正本として検査する。
 */
const ZUMEN_KEYS = /^(version|kind|nodes|groups|edges|pins|grid|scale|wall|north|wrap|direction):/m;

function samplesIn(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/```yaml\n([\s\S]*?)```/g)) {
    const body = match[1]!;
    if (ZUMEN_KEYS.test(body)) out.push(body);
  }
  return out;
}

/** 紹介のページは HTML なので、`<pre><code>` から取り出す。 */
function samplesInHtml(text: string): string[] {
  const out: string[] = [];
  for (const match of text.matchAll(/<pre><code>([\s\S]*?)<\/code><\/pre>/g)) {
    const body = match[1]!
      .replace(/<span class="c">(.*?)<\/span>/g, '$1')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&');
    if (ZUMEN_KEYS.test(body)) out.push(`${body}\n`);
  }
  return out;
}

/**
 * 文書には**節だけを見せる切れ端**も載る（`wrap: true` だけ、等）。
 * 切れ端に `version` や `nodes` が無いのは当たり前なので、そこだけは数えない。
 *
 * **書き戻しの検査（§6.1）は切れ端でも効く。** 今回踏んだのはそれで、
 * 桁を揃える空白と流れ形式は、切れ端かどうかに関係なく落ちる。
 */
function check(name: string, samples: string[]): void {
  assert.ok(samples.length > 0, `${name} から正本が 1 つも取れていない（取り出し方が壊れた）`);
  for (const [index, sample] of samples.entries()) {
    // 節だけを見せる切れ端では、必須キーが無いのは当たり前。そこは数えない。
    const missing = new Set<string>();
    if (!sample.includes('nodes:')) missing.add('nodes-missing');
    if (!sample.startsWith('version:')) missing.add('version-missing');
    const found = validate(sample).filter((finding) => !missing.has(finding.code));
    assert.equal(
      hasError(found),
      false,
      `${name} の ${index + 1} 件目が落ちる: ${found.map((f) => `${f.code} ${f.message}`).join(' / ')}`,
    );

    // **書き戻しは、ここで直接比べる。**
    //
    // `validate` は `nodes` が無いとそこで返すので、切れ端では
    // 書き戻しの検査（§6.1）まで進まない。今回踏んだのはまさにそこで、
    // **壊した見本を入れてもテストが赤くならなかった**（実地で確認した）。
    assert.equal(
      serialize(parse(sample)),
      sample,
      `${name} の ${index + 1} 件目は、読んで書き戻すと変わる（§6.1）`,
    );
  }
}

describe('文書に載せた正本は、検証を通る', () => {
  it('README', () => {
    check('README.md', samplesIn(readFileSync(new URL('README.md', ROOT), 'utf8')));
  });

  it('仕様', () => {
    const dir = new URL('spec/', ROOT);
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      check(`spec/${name}`, samplesIn(readFileSync(new URL(name, dir), 'utf8')));
    }
  });

  it('紹介のページ', () => {
    check('site/index.html', samplesInHtml(readFileSync(new URL('site/index.html', ROOT), 'utf8')));
  });
});
