/**
 * 白黒でも読めること（Issue #6）。
 *
 * > **彩度を 0 にしても同じ判定を通るか** ── 色に意味を載せていないことの検査になります
 *
 * 測るのは彩度ではなく**相対輝度のコントラスト比**にした。
 * 白黒印刷と色覚特性の両方に同時に効くのはこちらで、しきい値も既にある。
 *
 * ## 見つかっていた実害
 *
 * `appearance: primary` と `appearance: muted` は、**地が 1.01:1**（ほぼ同じ色）、
 * **枠が 1.95:1** で、**白黒にすると見分けられなかった。**
 * 意味の語を 2 つ持っているのに、絵の上で区別が付いていない。
 *
 * `pinned`（人が置いた印）は `DESIGN.md` §2.3 で
 * 「**太さで示し、色で示さない**」と決めてあり、白黒でも残る。
 * **同じ考えを `appearance` に適用していなかった**のが穴だった。
 *
 * ## 見た目の選択に関わらず、下限は守る（`DESIGN.md` §7）
 *
 * 映えと安全は呼ぶ側が選べる（人の指示でも、エージェントへの指示でも）。
 * **ただし「読めなくてよい」は選べない。** 色を濃くするか淡くするかは選択だが、
 * **白黒で区別が消えるのは、どちらを選んでも起きてはならない。**
 * 別の道（形・太さ・文字の濃さ）を必ず 1 つ持たせる。**色を足しても何も失われない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { paletteOf } from '../src/tokens.ts';
import type { Look, Theme } from '../src/tokens.ts';

/** 非文字要素の下限としてよく使われる比。 */
const FLOOR = 3;

/** 文字の下限（大きめの文字向けの比）。 */
const TEXT_FLOOR = 4.5;

function luminance(hex: string): number {
  const parts = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * parts[0]! + 0.7152 * parts[1]! + 0.0722 * parts[2]!;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * 2 つの見た目が、**どれか 1 つの経路で**見分けられるか。
 *
 * 破線の違いは色を捨てても残るので、**そこが違えば合格**とする
 * （`DESIGN.md` §2.3 の「太さで示し、色で示さない」と同じ扱い）。
 */
function separation(a: Look, b: Look): number {
  if (a.dash !== b.dash) return Infinity;
  return Math.max(contrast(a.fill, b.fill), contrast(a.stroke, b.stroke), contrast(a.text, b.text));
}

const THEMES: Theme[] = ['light', 'dark'];
const INTENTS = ['safe', 'vivid'] as const;

describe('**箱と囲みが、地から見えること**', () => {
  // ここを見ていなかった。**体裁どうしの区別しか測っていなかった**ので、
  // 箱の枠が地に対して 1.47:1 でも通っていた。
  //
  //     箱の枠 vs 地     1.47:1   ← 枠がほぼ見えない
  //     囲みの枠 vs 地   1.18:1
  //     囲みの地 vs 地   1.03:1   ← 囲みが事実上ない
  //
  // 「きれいだが、見えていない」図になっていた（2026-09-11。人の指摘）。
  for (const theme of THEMES) {
    it(`${theme} — 箱の枠が地から見える`, () => {
      const p = paletteOf(theme);
      const got = contrast(p.node.stroke, p.node.fill);
      assert.ok(got >= FLOOR, `${got.toFixed(2)}:1`);
    });

    it(`${theme} — **囲みが、外の地と見分けられる**`, () => {
      const p = paletteOf(theme);
      // 面か枠か、どちらかで分かればよい。**両方とも薄いのが駄目。**
      const byFill = contrast(p.group.fill, p.node.fill);
      const byStroke = contrast(p.group.stroke, p.node.fill);
      assert.ok(
        Math.max(byFill, byStroke) >= FLOOR,
        `地 ${byFill.toFixed(2)}:1 / 枠 ${byStroke.toFixed(2)}:1`,
      );
    });
  }
});

describe('文字と線が地から見えること', () => {
  for (const theme of THEMES) {
    for (const intent of INTENTS) {
      it(`${theme} / ${intent}`, () => {
        const p = paletteOf(theme, intent);
        assert.ok(
          contrast(p.text.node, p.node.fill) >= TEXT_FLOOR,
          `箱の文字 ${contrast(p.text.node, p.node.fill).toFixed(2)}:1`,
        );
        assert.ok(
          contrast(p.edge.stroke, p.node.fill) >= FLOOR,
          `線 ${contrast(p.edge.stroke, p.node.fill).toFixed(2)}:1`,
        );
      });
    }
  }
});

describe('**体裁の語どうしが、白黒でも見分けられること**', () => {
  for (const theme of THEMES) {
    for (const intent of INTENTS) {
      it(`${theme} / ${intent} — どの組も ${FLOOR}:1 以上離れている`, () => {
        const p = paletteOf(theme, intent);
        const looks: Record<string, Look> = {
          既定: p.node,
          primary: p.appearance['primary']!,
          muted: p.appearance['muted']!,
        };
        const names = Object.keys(looks);
        for (let i = 0; i < names.length; i += 1) {
          for (let j = i + 1; j < names.length; j += 1) {
            const [a, b] = [names[i]!, names[j]!];
            const got = separation(looks[a]!, looks[b]!);
            assert.ok(got >= FLOOR, `${a} vs ${b} が ${got.toFixed(2)}:1 しか離れていない`);
          }
        }
      });
    }
  }

  it('体裁の語の文字も、それぞれの地から読めること', () => {
    for (const theme of THEMES) {
      for (const intent of INTENTS) {
        const p = paletteOf(theme, intent);
        for (const [word, look] of Object.entries(p.appearance)) {
          const got = contrast(look.text, look.fill);
          assert.ok(got >= TEXT_FLOOR, `${theme}/${intent} の ${word} が ${got.toFixed(2)}:1`);
        }
      }
    }
  });
});

describe('見た目を選んでも、下限は選べない（`DESIGN.md` §7）', () => {
  it('**vivid のほうが色が濃い**（選択に意味がある）', () => {
    const safe = paletteOf('light', 'safe').appearance['primary']!;
    const vivid = paletteOf('light', 'vivid').appearance['primary']!;
    assert.notEqual(safe.fill, vivid.fill);
    // 濃い＝地との差が大きい。
    const base = paletteOf('light').node.fill;
    assert.ok(contrast(vivid.fill, base) > contrast(safe.fill, base));
  });

  it('**それでも白黒の下限は同じ**（上の describe が両方を通している）', () => {
    for (const intent of INTENTS) {
      const p = paletteOf('light', intent);
      assert.ok(separation(p.appearance['primary']!, p.appearance['muted']!) >= FLOOR);
    }
  });

  it('既定は safe（何も言わなければ安全側）', () => {
    assert.deepEqual(paletteOf('light'), paletteOf('light', 'safe'));
  });
});
