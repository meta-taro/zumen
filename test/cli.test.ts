/**
 * コマンドの口（`pnpm validate`）。
 *
 * **終了コードを間違えると、CI が黙って通る。**
 * 特に「警告だけなら 0」は意図した設計であって手抜きではないので、
 * 逆に倒れていないかをここで押さえる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run, runEmbed, runMerge, runMergeDriver, runMermaid, runSvg, runValidate } from '../src/cli.ts';

/** ファイルを読みに行かせない。**テストが実物のファイル配置に縛られないため。** */
function reader(files: Record<string, string>) {
  return (path: string): string => {
    const text = files[path];
    if (text === undefined) throw new Error('ENOENT');
    return text;
  };
}

const GOOD = 'version: 1\nnodes:\n  - id: a\n';
const ORPHAN = 'version: 1\nnodes:\n  - id: a\npins:\n  zzz:\n    label: 手直し\n';
const BROKEN = 'version: 1\nnodes:\n  - id: a\n  - id: a\n';

/**
 * **重なった文字は、正本だけを読んでも分からない。**
 *
 * `validate` は置いたあとの形を見ないので、
 * 「書いたのに読めない」状態を**人が CLI で確かめられなかった**
 * （`zumen_inspect` を叩けるエージェントだけが見えていた。2026-09-14）。
 */
const PILE = `version: 1
kind: placement
nodes:
  - id: frame
    label: ""
    marker: box
    at: { x: 0, y: 0 }
    size: { w: 200, h: 100 }
  - id: inner
    label: 中の節
    at: { x: 10, y: 10 }
    size: { w: 180, h: 40 }
  - id: note
    label: 枠の上に乗ってしまった注記
    marker: none
    at: { x: 10, y: 10 }
    size: { w: 300, h: 26 }
`;

/**
 * **A3 に印刷しても字が読めない紙**（`tooSmallToPrint`）。
 *
 * 2026-09-16 に見本 155 を描いていて当たった。`pnpm validate` は
 * **「直すところはありませんでした」と言い**、`node --test` の側だけが
 * 「A3 の下限を割っている」と言った。**同じ図を、道具が別々に採点していた。**
 *
 * この下限だけは `zumen_inspect` からしか見えておらず、
 * **人が CLI で確かめられなかった**（`overlappingText` を足したときと同じ穴）。
 */
const TALL = `version: 1
kind: placement
grid:
  x:
    - { id: A, at: 0 }
    - { id: B, at: 100 }
nodes:
${Array.from({ length: 40 }, (_, i) => `  - id: n${i}\n    label: "節"\n    at: { x: 0, y: ${i * 40} }\n    size: { w: 100, h: 30 }\n`).join('')}`;

describe('終了コード', () => {
  it('引数が無ければ 2 で、使い方を出す', async () => {
    const result = await runValidate([]);
    assert.equal(result.code, 2);
    assert.equal(result.lines.length, 1);
  });

  it('読める図なら 0', async () => {
    assert.equal((await runValidate(['a.yaml'], reader({ 'a.yaml': GOOD }) as never)).code, 0);
  });

  it('**警告だけなら 0。** 迷子は人が解くもので、失敗ではない', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': ORPHAN }) as never);
    assert.equal(result.code, 0);
  });

  it('読めない図があれば 1', async () => {
    assert.equal((await runValidate(['a.yaml'], reader({ 'a.yaml': BROKEN }) as never)).code, 1);
  });

  it('読めないファイルがあれば 1（黙って 0 で終わらない）', async () => {
    assert.equal((await runValidate(['無い.yaml'], reader({}) as never)).code, 1);
  });
});

/**
 * **「箱を広げるか、文字を短くしてください」だけでは、何 px 足りないのか分からない。**
 *
 * 2026-09-16 に見本 161（織りの組織図）を描いていて、**同じ注記で 4 回直した** ——
 * 広げると隣の文字にぶつかり、縮めるとまた飛び出す。
 * **測った数字は道具の側が持っている**のに、人へ渡していなかった。
 */
describe('入りきらない名前は、どれだけ足りないかを言う', () => {
  const NARROW = `version: 1
kind: placement
nodes:
  - id: note
    label: "この注記は、箱の幅にまったく入りきらない長さです"
    marker: none
    align: left
    at: { x: 0, y: 0 }
    size: { w: 60, h: 18 }
`;

  it('**名前の幅と箱の幅を、両方とも数字で出す**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': NARROW }) as never);
    // **同じ節に複数の指摘が出る**（行き先が無い／外へ出ている）。px を言う行を見る。
    const line = result.lines.find((text) => text.includes('note') && text.includes('px'));
    assert.ok(line !== undefined, `指摘が出ていない: ${result.lines.join(' / ')}`);
    assert.match(line, /60/, `箱の幅（60px）が入っていない: ${line}`);
    assert.match(line, /\d{3}\s*px/, `名前の幅が入っていない: ${line}`);
  });
});

/**
 * **符号（`tag`）と名前が重なっても、検証は黙っていた**（2026-09-17）。
 *
 * 見本 163（ダクトの配置図）を描いていて、廊下の名前 `HALL` の上に
 * 機械の符号 `AHU` が乗り、**紙には「HAHLU」と出た。**
 * `overlappingText` は**節の名前どうし**しか見ていないので、0 のまま。
 *
 * 紙の上で数える検査は**テストの中にだけ**あり（`test/paper.test.ts`）、
 * **自分の図を描く人には無いのと同じだった。** 同じ関数を検証からも呼ぶ。
 */
describe('紙の上の文字の重なりを、検証が言う', () => {
  const PILED_TAG = `version: 1
kind: placement
nodes:
  - id: hall
    label: "HALL"
    at: { x: 0, y: 0 }
    size: { w: 200, h: 80 }
  - id: ahu
    label: ""
    tag: "AHU"
    at: { x: 70, y: 30 }
    size: { w: 60, h: 24 }
`;

  it('**符号と名前が重なっていたら、両方の文字を出す**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': PILED_TAG }) as never);
    const line = result.lines.find((text) => text.includes('AHU'));
    assert.ok(line !== undefined, `重なりを言っていない: ${result.lines.join(' / ')}`);
    assert.match(line, /HALL/);
  });

  it('**重なっていない図には、何も言わない**', async () => {
    const apart = PILED_TAG.replace('{ x: 70, y: 30 }', '{ x: 400, y: 300 }');
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': apart }) as never);
    assert.ok(!result.lines.some((text) => text.includes('AHU')), result.lines.join(' / '));
  });
});

/**
 * **名前が他の箱に重なって出ている**（`crowdedNames`。2026-09-18）。
 *
 * 箱に入りきらず、外へ出した先も空いていないと、名前は**何かの上に重なって**出る。
 * これも `zumen_inspect` からしか見えず、**`pnpm validate` は黙っていた** ——
 * A3 の下限・紙の上の文字の重なりと**同じ形の穴**（3 回目）。
 *
 * 文字の上に乗ったなら `overlappingInk` が拾うが、**箱の塗りの上に乗っただけなら拾えない。**
 */
describe('入りきらない名前の、行き先が無い', () => {
  // 紙の左上に置いた細い箱。名前は外へ出るが、**左と上へは紙を広げられない**ので切れる。
  const CROWDED = `version: 1
kind: placement
nodes:
  - id: pin
    label: "この名前は箱に入らず、外へ出した先も空いていない"
    marker: none
    at: { x: 0, y: 0 }
    size: { w: 30, h: 18 }
`;

  it('**行き先が無い名前を、検証も言う**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': CROWDED }) as never);
    assert.ok(
      result.lines.some((line) => line.includes('pin') && line.includes('切れ')),
      `言っていない: ${result.lines.join(' / ')}`,
    );
  });

  it('**入る図には言わない**', async () => {
    const roomy = CROWDED.replace('size: { w: 30, h: 18 }', 'size: { w: 420, h: 18 }');
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': roomy }) as never);
    assert.ok(!result.lines.some((line) => line.includes('pin')), result.lines.join(' / '));
  });
});

describe('印刷して読めるか', () => {
  it('**A3 の下限を割る紙は、そう言う**（数の検査だけが知っている状態にしない）', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': TALL }) as never);
    assert.ok(
      result.lines.some((line) => line.includes('A3')),
      `A3 の下限を割っているのに何も言っていない: ${result.lines.join(' / ')}`,
    );
  });

  it('**警告であって失敗ではない**（印刷して読む図を止めない）', async () => {
    assert.equal((await runValidate(['a.yaml'], reader({ 'a.yaml': TALL }) as never)).code, 0);
  });

  /**
   * **直せる形で言う**（2026-09-18）。
   *
   * 比だけでは、**何を詰めればよいかが分からない。**
   * いちばん小さい字が何 px で、長辺が何 px で、**いくつ以下なら収まるのか** ——
   * そこまで出ていないと、直す側は当て推量で紙を縮めることになる
   * （宮殿の続き間の見本で、3 回やり直した）。
   * `name-adrift` に px を足したときと同じ話。
   */
  it('**いちばん小さい字・長辺・収まる長辺を、px で言う**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': TALL }) as never);
    const line = result.lines.find((l) => l.includes('A3')) ?? '';
    assert.match(line, /いちばん小さい字 \d+px/, line);
    assert.match(line, /長辺 \d+px/, line);
    assert.match(line, /長辺が \d+px 以下なら収まります/, line);
    assert.match(line, /あと \d+px 詰めてください/, line);
  });

  /**
   * **どこを詰めるかまで言う**（2026-09-19）。
   *
   * 「あと 89px 詰めてください」まで出るようになったが、**どこを詰めるかは分からない。**
   * 長辺が縦なのか横なのか、その端にいるのが何なのか —— 図を目で探すしかなかった。
   * PDCA の直近 5 周のうち **4 周**で、ここに 3〜4 往復とられた
   * （見本 186・187・189）。**端にいる 2 つを名指しする。**
   */
  it('**長辺がどちらの向きで、その端に何がいるかを言う**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': TALL }) as never);
    const line = result.lines.find((l) => l.includes('A3')) ?? '';
    assert.match(line, /長辺は(縦|横)で/, line);
    assert.match(line, /端は "[^"]+" と "[^"]+"/, line);
  });

  it('下限を通る図には、何も言わない', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': GOOD }) as never);
    assert.ok(!result.lines.some((line) => line.includes('A3')));
  });
});

describe('出す内容', () => {
  it('迷子は、通したうえで必ず出す（黙って捨てない）', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': ORPHAN }) as never);
    assert.ok(result.lines.some((line) => line.includes('zzz')));
  });

  it('指摘の無い図は、行を増やさない（読む量を増やさない）', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': GOOD }) as never);
    assert.equal(result.lines.length, 1);
  });

  it('複数を渡したら、まとめて見る（1 件目で止めない）', async () => {
    const files = { 'a.yaml': BROKEN, 'b.yaml': BROKEN };
    const result = await runValidate(['a.yaml', 'b.yaml'], reader(files) as never);
    assert.ok(result.lines.some((line) => line.includes('a.yaml')));
    assert.ok(result.lines.some((line) => line.includes('b.yaml')));
  });

  it('どこが悪いかに行番号が付く', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': BROKEN }) as never);
    assert.ok(result.lines.some((line) => /\b4: /.test(line)));
  });
});

describe('マージドライバ（Git の口）', () => {
  const BASE = 'version: 1\npins: {}\nnodes:\n  - id: a\n    label: A\n';
  const OURS = BASE.replace('pins: {}', 'pins:\n  a:\n    position: { x: 1, y: 1 }');
  const THEIRS = BASE.replace('    label: A\n', '    label: A\n\n  - id: b\n    label: B\n');

  /** 書き込み先を掴まえる。**ours の場所へ書く**のが Git との約束。 */
  function driver(files: Record<string, string>) {
    const written: Record<string, string> = {};
    const result = runMergeDriver(
      ['base', 'ours', 'theirs'],
      ((path: string) => {
        const text = files[path];
        if (text === undefined) throw new Error('ENOENT');
        return text;
      }) as never,
      ((path: string, text: string) => {
        written[path] = text;
      }) as never,
    );
    return { result, written };
  }

  it('引数が 3 つ無ければ 2', () => {
    assert.equal(runMergeDriver(['base']).code, 2);
  });

  it('解けたら 0 で、結果を ours の場所へ書く', () => {
    const { result, written } = driver({ base: BASE, ours: OURS, theirs: THEIRS });
    assert.equal(result.code, 0);
    assert.ok(written['ours']?.includes('id: b'));
    assert.ok(written['ours']?.includes('x: 1'));
  });

  it('**解けなければ 1。** 失敗ではなく、Git への「人が見る」合図', () => {
    const theirs = BASE.replace('pins: {}', 'pins:\n  a:\n    position: { x: 9, y: 9 }');
    const { result, written } = driver({ base: BASE, ours: OURS, theirs });
    assert.equal(result.code, 1);
    // 印を付けたうえで書く。**書かずに終えると、Git は ours のままだと思い込む。**
    assert.match(written['ours'] ?? '', /<<<<<<< ours/);
  });

  it('読めないファイルなら 1 で、**書き換えない**（黙って壊さない）', () => {
    const { result, written } = driver({ base: BASE, ours: OURS });
    assert.equal(result.code, 1);
    assert.equal(written['ours'], undefined);
  });
});

describe('命令の振り分け', () => {
  it('知らない命令なら 2 で、使い方を出す', async () => {
    const result = await run(['zzz']);
    assert.equal(result.code, 2);
    assert.ok(result.lines.length >= 2);
  });

  it('命令が無ければ 2 で、使い方を全部出す', async () => {
    const result = await run([]);
    assert.equal(result.code, 2);
    // **口が増えたら 1 行増える**（2026-09-16 に timelapse を足した）。
    assert.equal(result.lines.length, 9);
  });
});

describe('変換の口', () => {
  const DIAGRAM = 'version: 1\nnodes:\n  - id: a\n    label: A\n  - id: b\n    label: B\nedges:\n  - from: a\n    to: b\n';

  function io(files: Record<string, string>) {
    const written: Record<string, string> = {};
    const read = ((path: string) => {
      const text = files[path];
      if (text === undefined) throw new Error('ENOENT');
      return text;
    }) as never;
    const write = ((path: string, text: string) => {
      written[path] = text;
    }) as never;
    return { read, write, written };
  }

  it('svg は書き出し先を省くと拡張子を差し替える', async () => {
    const { read, write, written } = io({ 'z.zumen.yaml': DIAGRAM });
    const result = await runSvg(['z.zumen.yaml'], read, write);
    assert.equal(result.code, 0);
    assert.match(written['z.svg'] ?? '', /^<svg/);
  });

  it('mermaid が図として出る', async () => {
    const { read, write, written } = io({ 'z.zumen.yaml': DIAGRAM });
    await runMermaid(['z.zumen.yaml'], read, write);
    assert.match(written['z.mmd'] ?? '', /flowchart/);
  });

  it('引数が無ければ 2', async () => {
    assert.equal((await runSvg([])).code, 2);
    assert.equal((await runMermaid([])).code, 2);
    assert.equal((await runEmbed([])).code, 2);
    assert.equal(runMerge([]).code, 2);
  });

  it('読めないファイルは 1（黙って 0 で終わらない）', async () => {
    const { read, write } = io({});
    assert.equal((await runSvg(['無い.yaml'], read, write)).code, 1);
  });
});

describe('Markdown への埋め込み', () => {
  const MD = ['# 設計書', '', '```zumen', 'version: 1', 'nodes:', '  - id: a', '```', ''].join('\n');

  function io(files: Record<string, string>) {
    const written: Record<string, string> = {};
    const read = ((path: string) => {
      const text = files[path];
      if (text === undefined) throw new Error('ENOENT');
      return text;
    }) as never;
    const write = ((path: string, text: string) => {
      written[path] = text;
    }) as never;
    return { read, write, written };
  }

  it('囲みが図に差し替わる', async () => {
    const { read, write, written } = io({ 'doc.md': MD });
    await runEmbed(['doc.md'], read, write);
    assert.match(written['doc.zumen.md'] ?? '', /!\[.*\]\(data:image\/svg\+xml/);
  });

  it('**囲みが無ければ書き出さない**（黙って空のファイルを作らない）', async () => {
    const { read, write, written } = io({ 'doc.md': '# ただの文書\n' });
    const result = await runEmbed(['doc.md'], read, write);
    assert.equal(result.code, 0);
    assert.deepEqual(Object.keys(written), []);
  });
});

describe('提案を正本へ入れる（merge）', () => {
  const CURRENT = 'version: 1\npins:\n  a:\n    position: { x: 10, y: 10 }\nnodes:\n  - id: a\n    label: A\n';
  const PROPOSAL = 'version: 1\nnodes:\n  - id: a\n    label: A\n  - id: b\n    label: B\n';

  function io(files: Record<string, string>) {
    const written: Record<string, string> = {};
    const read = ((path: string) => {
      const text = files[path];
      if (text === undefined) throw new Error('ENOENT');
      return text;
    }) as never;
    const write = ((path: string, text: string) => {
      written[path] = text;
    }) as never;
    return { read, write, written };
  }

  it('提案の構造が入り、**人の指定は残る**', () => {
    const { read, write, written } = io({ 'cur.yaml': CURRENT, 'pro.yaml': PROPOSAL });
    const result = runMerge(['cur.yaml', 'pro.yaml'], read, write);
    assert.equal(result.code, 0);
    assert.match(written['cur.yaml'] ?? '', /id: b/);
    assert.match(written['cur.yaml'] ?? '', /x: 10/);
  });

  it('**書き換わるのは正本の側**（提案のファイルは触らない）', () => {
    const { read, write, written } = io({ 'cur.yaml': CURRENT, 'pro.yaml': PROPOSAL });
    runMerge(['cur.yaml', 'pro.yaml'], read, write);
    assert.equal(written['pro.yaml'], undefined);
  });

  it('競合が出ても失敗にしない（人が見て決めるだけ）', () => {
    const removed = 'version: 1\nnodes:\n  - id: z\n';
    const { read, write } = io({ 'cur.yaml': CURRENT, 'pro.yaml': removed });
    const result = runMerge(['cur.yaml', 'pro.yaml'], read, write);
    assert.equal(result.code, 0);
    assert.ok(result.lines.some((line) => line.includes('a')));
  });
});

describe('置いたあとの形も見る（配置図）', () => {
  it('**文字どうしの重なりを、CLI でも知らせる**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': PILE }) as never);
    assert.equal(result.code, 0, '読める図なので止めない');
    assert.ok(
      result.lines.some((line) => line.includes('inner') && line.includes('note')),
      result.lines.join('\n'),
    );
  });

  it('重なっていなければ、これまでどおり何も言わない', async () => {
    const clean = PILE.replace('at: { x: 10, y: 10 }\n    size: { w: 300, h: 26 }', 'at: { x: 10, y: 60 }\n    size: { w: 300, h: 26 }');
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': clean }) as never);
    assert.ok(result.lines.some((line) => line.includes('直すところはありませんでした')), result.lines.join('\n'));
  });

  it('構成図では見ない（置き場所を機械が決めるので、文字は重ならない）', async () => {
    // 構成図に `at` や `marker` を書けば、それはそれで警告が出る。
    // ここで見たいのは**重なりの指摘が出ないこと**だけ。
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': PILE.replace('kind: placement\n', '') }) as never);
    assert.ok(!result.lines.some((line) => line.includes('重なって')), result.lines.join('\n'));
  });
});
