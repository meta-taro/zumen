/**
 * 改行コード（Issue #5 のコメント）。
 *
 * **報告された壊れ方をそのまま置く。**
 *
 * > $ pnpm validate examples/本番構成.zumen.yaml
 * >   [エラー] 1: 読んで書き戻すと行が変わります。
 * > 439a32b でも 7132cc5 でも同じでした。`svg` の書き出しは通ります。
 *
 * Windows の Git が `core.autocrlf` で CRLF に展開し、**往復検査が LF で書き戻す**ため、
 * 図の中身が 1 文字も違わないのに全行が「変わった」と判定されていた。
 *
 * ## なぜ重いか
 *
 * `pnpm validate` は README がいちばん最初に叩かせるコマンドで、
 * **同梱の手本が落ちる。** 試す人は「自分の環境が壊れている」と読む。
 *
 * ## 直し方を 2 つとも入れる
 *
 * 1. `.gitattributes` で正本を LF に固定する（**そもそも CRLF にしない**）
 * 2. 検査が改行の違いを差分として数えない（**既に CRLF になっている手元を救う**）
 *
 * 1 だけだと、既に clone 済みの人が救われない。
 * 2 だけだと、**書き戻すたびに全行が差分になる**（Git の履歴が汚れる）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { hasError, validate } from '../src/validate.ts';

const ROOT = new URL('../', import.meta.url).pathname;
const SAMPLE = readFileSync(join(ROOT, 'examples/本番構成.zumen.yaml'), 'utf8');

describe('CRLF の正本を読む', () => {
  it('**同梱の手本は、LF なら通る**（いままでどおり）', () => {
    assert.equal(hasError(validate(SAMPLE)), false);
  });

  it('**CRLF でも通る**（Windows の Git が展開した状態）', () => {
    const crlf = SAMPLE.replace(/\n/g, '\r\n');
    const findings = validate(crlf);
    assert.equal(
      hasError(findings),
      false,
      findings.map((f) => `${f.line}: ${f.message}`).join(' / '),
    );
  });

  it('**CR 単独は通さない**（読めていないことを黙らない）', () => {
    // 旧 Mac の改行。`yaml` はこれを改行と見なさず、全体が 1 行になる。
    // Git はこれを作らないので直しに行かない。**構文エラーとして正直に落ちるほうがよい。**
    const findings = validate(SAMPLE.replace(/\n/g, '\r'));
    assert.equal(hasError(findings), true);
    assert.equal(findings.some((f) => f.code === 'syntax'), true);
    // 改行のせいで往復検査が誤って鳴る、という形にはしない。
    assert.equal(findings.some((f) => f.code === 'round-trip-changed'), false);
  });

  it('**本当に中身が違えば、これまでどおり止める**（改行だけを見逃す）', () => {
    // 往復で必ず変わる書き方（引用符の付け方を変える）。
    const broken = 'version: 1\nnodes:\n  - id: a\n    label: "a"\n\n\n\n';
    assert.equal(validate(broken).some((f) => f.code === 'round-trip-changed'), true);
  });
});

describe('正本の改行を Git で固定する', () => {
  const attributes = readFileSync(join(ROOT, '.gitattributes'), 'utf8');

  it('`*.zumen.yaml` を LF に固定している', () => {
    assert.match(attributes, /\*\.zumen\.yaml[^\n]*\btext\b/);
    assert.match(attributes, /\*\.zumen\.yaml[^\n]*eol=lf/);
  });

  it('マージドライバの指定は残っている（消していない）', () => {
    assert.match(attributes, /merge=zumen/);
  });
});
