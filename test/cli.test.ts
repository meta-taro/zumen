/**
 * コマンドの口（`pnpm validate`）。
 *
 * **終了コードを間違えると、CI が黙って通る。**
 * 特に「警告だけなら 0」は意図した設計であって手抜きではないので、
 * 逆に倒れていないかをここで押さえる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run, runEmbed, runInspect, runMerge, runMergeDriver, runMermaid, runSvg, runValidate } from '../src/cli.ts';

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

  /**
   * **図の名前（`views[].title`）も、紙の上の文字。**
   *
   * 規則には「views を置いたら図の下に 130px 空ける。**数の検査は鳴らない**」と
   * 書いてあった（見本 129〜134 で 3 枚続けて踏んだときの記述）。
   * **いまは鳴る。** 2026-09-19 に見本 190 を描いていて、
   * 注記が図の名前に乗ったのを検証器が言った ——
   * **古い記述は、動いている検査を信じさせなくする**（ベースルール §10）。
   *
   * 鳴ることをここで留めておく。留めておかないと、また記述だけが古くなる。
   */
  it('**図の名前に注記が乗ったら、そう言う**（views[].title も紙の上の文字）', async () => {
    const VIEWED = `version: 1
kind: placement
arrows: true
views:
  - id: a
    title: 上の図
    at: { x: 40, y: 40 }
    size: { w: 200, h: 100 }
    grid:
      x:
        - { id: X1, at: 60 }
        - { id: X2, at: 220 }
nodes:
  - id: box
    label: "中身"
    at: { x: 60, y: 60 }
    size: { w: 160, h: 60 }
  - id: sita
    label: "すぐ下に置いた注記"
    marker: none
    at: { x: 40, y: 250 }
    size: { w: 220, h: 18 }
`;
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': VIEWED }) as never);
    const line = result.lines.find((text) => text.includes('すぐ下に置いた注記'));
    assert.ok(line !== undefined, `図の名前との重なりを言っていない: ${result.lines.join(' / ')}`);
    assert.match(line, /上の図/);
  });

  /**
   * **どれだけずらせば離れるかを、px で言う**（2026-09-19）。
   *
   * 「重なっています」までは言っていたが、**どれだけ動かせばよいかは言っていなかった。**
   * PDCA の 4 周で 8 回この指摘を受け、そのたびに座標を当て推量で動かした
   * （見本 190〜193）。`name-adrift` と A3 の警告に px を足したときと同じ話。
   *
   * **横と縦の両方**を出す —— どちらへ逃がすかは描く側が決める。
   */
  it('**どれだけずらせば離れるかを px で言う**', async () => {
    const result = await runValidate(['a.yaml'], reader({ 'a.yaml': PILED_TAG }) as never);
    const line = result.lines.find((text) => text.includes('AHU'))!;
    assert.match(line, /横に \d+px/, line);
    assert.match(line, /縦に \d+px/, line);
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
    assert.equal(result.lines.length, 10);
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

  it('出し先が旗に見えたら、その名前でファイルを作らない', async () => {
    const { read, write, written } = io({ 'z.zumen.yaml': DIAGRAM });
    const result = await runSvg(['z.zumen.yaml', '-o', 'z.svg'], read, write);
    assert.equal(result.code, 2);
    // **`-o` という名前のファイルが出来ていた**（2026-09-20 に踏んだ）。
    assert.equal(written['-o'], undefined);
    assert.equal(written['z.svg'], undefined);
    assert.match(result.lines[0] ?? '', /-o/);
  });

  it('--dark は出し先と読み違えない', async () => {
    const { read, write, written } = io({ 'z.zumen.yaml': DIAGRAM });
    assert.equal((await runSvg(['z.zumen.yaml', '--dark'], read, write)).code, 0);
    assert.match(written['z.svg'] ?? '', /^<svg/);
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

/**
 * **観測値を見せる口**（`pnpm inspect`。2026-09-20）。
 *
 * `crossings` と `straddles` は合否ではないので検査から出さないと決めてあるが、
 * **見る道具がどこにも無かった。** test/names.test.ts は両方を見ているのに、
 * 書いている最中は分からず、見本を足すたびに使い捨ての台本を書いていた。
 */
describe('観測値を見せる（inspect）', () => {
  const CROSS = [
    'version: 1',
    'kind: placement',
    'arrows: true',
    'nodes:',
    '  - id: a',
    '    label: ""',
    '    marker: none',
    '    at: { x: 0, y: 0 }',
    '    size: { w: 2, h: 2 }',
    '  - id: b',
    '    label: ""',
    '    marker: none',
    '    at: { x: 200, y: 200 }',
    '    size: { w: 2, h: 2 }',
    '  - id: c',
    '    label: ""',
    '    marker: none',
    '    at: { x: 200, y: 0 }',
    '    size: { w: 2, h: 2 }',
    '  - id: d',
    '    label: ""',
    '    marker: none',
    '    at: { x: 0, y: 200 }',
    '    size: { w: 2, h: 2 }',
    'edges:',
    '  - from: a',
    '    to: b',
    '    curve: none',
    '  - from: c',
    '    to: d',
    '    curve: none',
    '',
  ].join('\n');

  it('**交差を数えて、どれとどれかを言う**', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': CROSS }) as never);
    assert.equal(result.code, 0, '止めない');
    const said = result.lines.join('\n');
    assert.match(said, /交差 1/);
    assert.match(said, /↔/, `どの 2 本かを言っていない\n${said}`);
  });

  /**
   * **組だけでは探せない**（2026-09-20）。
   *
   * `path()` で引いた折れ線の id は `p16>p17` のように書き手が付けた名前ではない。
   * 「その 2 本です」と言われても、図の中で見つけられない。**紙の上の座標が要る。**
   */
  it('**交わっている場所（座標）まで言う**', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': CROSS }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /\(\d+, \d+\)/, `場所を言っていない\n${said}`);
    // 0,0 と 200,200 ／ 200,0 と 0,200 が交わるのは真ん中（錨は 2px の箱なので 1px ずれる）
    assert.match(said, /\(10[01], 10[01]\)/, said);
  });

  it('**止めない。** 観測値であって合否ではない', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': CROSS }) as never);
    assert.equal(result.code, 0);
    assert.ok(result.lines.some((line) => line.includes('観測値')), result.lines.join('\n'));
  });

  it('何も無ければ 0 と言う（黙らない）', async () => {
    const one = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 120 }\n';
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': one }) as never);
    assert.ok(result.lines.some((line) => line.includes('交差 0')), result.lines.join('\n'));
  });

  /**
   * **数と、並べた組がずれていた**（2026-09-20）。
   *
   * 「交差 942」と言いながら並ぶのは 703 組で、同じ 2 本が何か所で交わっても
   * 組は 1 つしか返さない。**見本 22 枚でずれる**（アイコンのキーライン図は 942 と 703）。
   * 数だけ出すと、読んだ人は「並べ切れていない」と思う。
   */
  it('**数と組をどちらも言う**（同じ 2 本が 2 か所で交わっても 1 組）', async () => {
    // 1 本の折れ線が、もう 1 本を 2 か所で横切る
    const zig = [
      'version: 1', 'kind: placement', 'arrows: true', 'nodes:',
      '  - id: a', '    label: ""', '    marker: none', '    at: { x: 0, y: 100 }', '    size: { w: 2, h: 2 }',
      '  - id: b', '    label: ""', '    marker: none', '    at: { x: 300, y: 100 }', '    size: { w: 2, h: 2 }',
      '  - id: c', '    label: ""', '    marker: none', '    at: { x: 0, y: 0 }', '    size: { w: 2, h: 2 }',
      '  - id: d', '    label: ""', '    marker: none', '    at: { x: 300, y: 0 }', '    size: { w: 2, h: 2 }',
      'edges:',
      '  - from: a', '    to: b', '    curve: none',
      '  - from: c', '    to: d', '    curve: none',
      '    via:', '      - { x: 100, y: 200 }', '      - { x: 200, y: 200 }',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': zig }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /交差 2/, said);
    assert.match(said, /1 組/, `組の数を言っていない\n${said}`);
  });

  it('ファイルを渡さなければ使い方を出す', async () => {
    const result = await runInspect([]);
    assert.equal(result.code, 2);
    assert.match(result.lines.join('\n'), /pnpm inspect/);
  });

  it('命令の一覧に出る', async () => {
    const result = await run([]);
    assert.match(result.lines.join('\n'), /pnpm inspect/);
  });
});

/**
 * **検査の網と、見る道具の網がそろっていなかった**（2026-09-20）。
 *
 * `test/names.test.ts` は `hiddenLabels`（絵に出ない辺のラベル）と
 * `crowdedNames`（外へ出す先も無い名前）も 0 だと決めているのに、
 * `pnpm inspect` は交差とまたぎしか出していなかった。
 * **閉じたはずの穴が、半分開いたままだった。**
 */
describe('inspect が、検査と同じものを見る', () => {
  /**
   * **観測値の口が、警告を見ていなかった**（2026-09-20）。
   *
   * 「登録の前に inspect で 0 にする」手順を作ったのに、`inspect` は
   * 検査の警告を 1 件も出していなかった —— 見本 268 を登録したあとで、
   * 描かれていない `hatch: dots` を `pnpm validate` が見つけた。
   */
  it('**警告があることを言う**（中身は validate の仕事）', async () => {
    const thin = [
      'version: 1', 'kind: placement', 'nodes:',
      '  - id: rule', '    label: ""', '    hatch: dots', '    at: { x: 0, y: 0 }', '    size: { w: 2, h: 90 }',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': thin }) as never);
    assert.match(result.lines.join('\n'), /警告 1 件/, result.lines.join('\n'));
  });

  it('**警告が無ければ、その行は出さない**', async () => {
    const clean = [
      'version: 1', 'kind: placement', 'nodes:',
      '  - id: a', '    label: あ', '    at: { x: 0, y: 0 }', '    size: { w: 120, h: 60 }',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': clean }) as never);
    assert.doesNotMatch(result.lines.join('\n'), /警告/);
  });

  /**
   * **どちらの図かを、最初に言う**（2026-09-20）。
   *
   * 配置図と構成図では直し方が違う —— またぎも交差も、配置図なら自分で動かして消すが、
   * **構成図では書き手に動かす手段が無い。** どちらなのかを `kind:` の grep で確かめていた。
   */
  it('**配置図か構成図かを言う**', async () => {
    const plan = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: あ\n    at: { x: 0, y: 0 }\n    size: { w: 80, h: 40 }\n';
    const built = 'version: 1\nnodes:\n  - id: a\n    label: あ\n  - id: b\n    label: い\nedges:\n  - from: a\n    to: b\n';
    const one = await runInspect(['a.yaml'], reader({ 'a.yaml': plan }) as never);
    assert.match(one.lines.join('\n'), /配置図/, one.lines.join('\n'));
    const two = await runInspect(['b.yaml'], reader({ 'b.yaml': built }) as never);
    assert.match(two.lines.join('\n'), /構成図/, two.lines.join('\n'));
  });

  it('**またぎは、どれだけ重なっているかまで言う**', async () => {
    const over = [
      'version: 1', 'kind: placement', 'nodes:',
      '  - id: a', '    label: あ', '    at: { x: 0, y: 0 }', '    size: { w: 100, h: 60 }',
      '  - id: b', '    label: い', '    at: { x: 92, y: 40 }', '    size: { w: 100, h: 60 }',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': over }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /a↔b（横 8px ／ 縦 20px 重なる）/, said);
  });

  /**
   * **どれだけ足りないかまで言う**（2026-09-20）。
   *
   * id だけを出していたので、**箱をいくつ広げればよいかが当て推量**だった。
   */
  it('**名前が箱から離れているとき、要る幅と今の幅を言う**', async () => {
    const wide = [
      'version: 1', 'kind: placement', 'nodes:',
      '  - id: cell', '    label: "これは欄の幅にまったく入りきらない長い値です"',
      '    at: { x: 0, y: 0 }', '    size: { w: 120, h: 24 }',
      '  - id: far', '    label: 遠く', '    at: { x: 0, y: 200 }', '    size: { w: 60, h: 24 }',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': wide }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /cell（要 \d+px ／ 今 120px）/, said);
  });

  it('**絵に出ていない辺のラベルを言う**', async () => {
    const hidden = [
      'version: 1', 'kind: placement', 'arrows: true', 'nodes:',
      '  - id: a', '    label: あ', '    at: { x: 0, y: 0 }', '    size: { w: 40, h: 40 }',
      '  - id: b', '    label: い', '    at: { x: 42, y: 0 }', '    size: { w: 40, h: 40 }',
      'edges:',
      '  - from: a', '    to: b', '    label: とても長いラベル', '    curve: none',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': hidden }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /絵に出ていない辺のラベル/, said);
    // **どの言葉が消えたかまで言う**（id だけでは、書いた文字を探しに戻ることになる）。
    assert.match(said, /「とても長いラベル」/, said);
    assert.equal(result.code, 0, '止めない');
  });

  /**
   * **止めないが、放っておくと落ちる**（2026-09-20）。
   *
   * `inspect` は観測値なので 0 を返す。ところが**見本として登録すると**、
   * `test/names.test.ts` が交差とまたぎを 0 だと決めているので落ちる。
   * 洗濯機（見本 250）で、**inspect が 8 件出したのを読んだまま登録して落とした。**
   */
  it('**交差やまたぎがあるときは、テストで落ちることを言う**', async () => {
    const CROSS2 = [
      'version: 1', 'kind: placement', 'arrows: true', 'nodes:',
      '  - id: a', '    label: ""', '    marker: none', '    at: { x: 0, y: 100 }', '    size: { w: 2, h: 2 }',
      '  - id: b', '    label: ""', '    marker: none', '    at: { x: 200, y: 100 }', '    size: { w: 2, h: 2 }',
      '  - id: c', '    label: ""', '    marker: none', '    at: { x: 100, y: 0 }', '    size: { w: 2, h: 2 }',
      '  - id: d', '    label: ""', '    marker: none', '    at: { x: 100, y: 200 }', '    size: { w: 2, h: 2 }',
      'edges:',
      '  - from: a', '    to: b', '    curve: none',
      '  - from: c', '    to: d', '    curve: none',
      '',
    ].join('\n');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': CROSS2 }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /テストが落ちます/, said);
    assert.equal(result.code, 0, 'それでも止めない');
  });

  it('何も無ければ、落ちる話はしない', async () => {
    const one = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 120 }\n';
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': one }) as never);
    assert.ok(!result.lines.some((line) => line.includes('テストが落ちます')), result.lines.join('\n'));
  });

  it('何も無ければ「全部出ています」と言う（黙らない）', async () => {
    const one = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 120 }\n';
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': one }) as never);
    assert.ok(result.lines.some((line) => line.includes('全部出ています')), result.lines.join('\n'));
  });
});

/**
 * **読めない図に、観測値は無い**（2026-09-20）。
 *
 * 前は指摘を並べたあと、最後に「これは合否ではなく観測値です」まで足していた ——
 * **観測値を 1 つも出していないのに。** 読めない図は、まず読めるようにする話。
 * あわせて、長辺が `1448.6107034668482px` と出ていたのを 1px きざみにした。
 */
describe('inspect が読めない図を渡されたとき', () => {
  const BAD = 'version: 1\nnodes:\n  - id: a\n  - id: a\n';

  it('**指摘だけ出して、締めの「合否ではなく観測値です」は出さない**', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': BAD }) as never);
    const said = result.lines.join('\n');
    assert.ok(!said.includes('合否ではなく'), said);
  });

  it('読めなかったことを言う（黙って空で返さない）', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': BAD }) as never);
    assert.match(result.lines.join('\n'), /読めませんでした/);
  });

  it('**それでも止めない**（inspect は合否ではない）', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': BAD }) as never);
    assert.equal(result.code, 0);
  });

  it('読める図が混ざっていれば、観測値の話はする', async () => {
    const ok = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 120 }\n';
    const result = await runInspect(['a.yaml', 'b.yaml'], reader({ 'a.yaml': BAD, 'b.yaml': ok }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /合否ではなく/);
    assert.match(said, /読めませんでした/);
  });

  it('**長辺は 1px きざみで出す**', async () => {
    const ok = 'version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200.4, h: 120.7 }\n';
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': ok }) as never);
    const said = result.lines.join('\n');
    assert.ok(!/長辺 \d+\.\d/.test(said), said);
  });
});

/**
 * **警告は、件数だけでなく種類まで出す**（2026-09-21）。
 *
 * 「警告 2 件」だけだと、`pnpm validate` をもう一度叩かないと種類が分からない ——
 * 見本 286・287 を描いていて、同じ往復を 2 回した。
 * **中身（どの節か・何 px か）は出さない。**それは `validate` の仕事のまま。
 */
describe('inspect が出す警告の種類', () => {
  // 8px しか離れていない 2 つの箱。既定の矢印（12px）のほうが長い。
  const NEAR = [
    'version: 1',
    'kind: placement',
    'nodes:',
    '  - id: a',
    '    label: あ',
    '    at: { x: 0, y: 0 }',
    '    size: { w: 60, h: 40 }',
    '  - id: b',
    '    label: い',
    '    at: { x: 68, y: 0 }',
    '    size: { w: 60, h: 40 }',
    'edges:',
    '  - from: a',
    '    to: b',
    '',
  ].join('\n');

  it('**どの検査が鳴っているかを言う**', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': NEAR }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /警告 1 件/, said);
    assert.match(said, /ends-too-long/, `種類を言っていない\n${said}`);
  });

  it('警告が無ければ、その行を出さない', async () => {
    const far = NEAR.replace('x: 68', 'x: 200');
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': far }) as never);
    assert.ok(!result.lines.some((line) => line.includes('警告')), result.lines.join('\n'));
  });
});

/**
 * **構成図には、別の言い方が要る**（2026-09-21）。
 *
 * `too-small-to-print` は「長辺の端の 2 つの間を詰めてください」と言っていたが、
 * **構成図では置き場所を機械が決める**ので、詰めようがない。
 * 動かせるのは**節の数と、鎖の深さ**だけ。
 * 見本 287（日本酒）を描くとき、この言い方が無くて 4 回やり直した ——
 * 20 節で 1928 × 2361 になり、`wrap` も `direction` も効かず、
 * **効いたのは節を減らすことだけ**だった。
 */
describe('構成図が紙に収まらないとき', () => {
  /** n 個の節を 1 本の鎖でつなぐ（＝鎖の深さが n）。 */
  const chain = (n: number): string => {
    const nodes = Array.from({ length: n }, (_, i) =>
      `  - id: n${i}\n    label: 工程 ${i}\n    technology: 短い副題をここへ\n`,
    ).join('');
    const edges = Array.from({ length: n - 1 }, (_, i) => `  - from: n${i}\n    to: n${i + 1}\n`).join('');
    return `version: 1\ndirection: down\nnodes:\n${nodes}edges:\n${edges}`;
  };

  it('**何段あって、何段まで減らせばよいかを言う**', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': chain(24) }) as never);
    const found = await (await import('../src/cli.ts')).placedFindings(chain(24));
    const said = found.find((f) => f.code === 'too-small-to-print');
    assert.ok(said !== undefined, found.map((f) => f.code).join(','));
    assert.match(said.message, /鎖がいちばん深い所は 24 段/, said.message);
    assert.match(said.message, /段まで減らしてください/, said.message);
    assert.equal(result.code, 0, '止めない');
  });

  it('**「端の 2 つを詰めろ」とは言わない**（構成図では動かせない）', async () => {
    const found = await (await import('../src/cli.ts')).placedFindings(chain(24));
    const said = found.find((f) => f.code === 'too-small-to-print');
    assert.ok(said !== undefined);
    assert.ok(!said.message.includes('この 2 つの間を詰めてください'), said.message);
  });

  it('短い鎖には言わない', async () => {
    const found = await (await import('../src/cli.ts')).placedFindings(chain(4));
    assert.ok(!found.some((f) => f.code === 'too-small-to-print'));
  });
});

/**
 * **隠した分の数を言う**（2026-09-21）。
 *
 * 先頭だけ並べて「…」で切っていたので、**あと何組あるのかが分からなかった。**
 * 見本 48 枚にまたぎがあり、そのうち **27 枚が 6 組を超える** ——
 * 半分以上で「全部見たのかどうか」が判断できなかった。
 * 能舞台（見本 294）を描いたとき、22 組のまたぎのうち 6 組しか見えず、
 * 全部を見るのに自分で数える道具を書く羽目になった。
 */
describe('並べきれない分の数', () => {
  const many = (n: number): string => {
    const nodes = Array.from({ length: n }, (_, i) =>
      `  - id: a${i}\n    label: 部屋 ${i}\n    at: { x: ${i * 40}, y: 0 }\n    size: { w: 60, h: 60 }\n`,
    ).join('');
    return `version: 1\nkind: placement\nnodes:\n${nodes}`;
  };

  it('**「ほか N 組」と言う**（「…」で切らない）', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': many(30) }) as never);
    const said = result.lines.join('\n');
    assert.match(said, /またぎ/, said);
    assert.match(said, /ほか \d+ 組/, `隠した分の数を言っていない\n${said}`);
  });

  it('**またぎは 20 組まで並べる**（交差と違って、1 つずつ決める相手）', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': many(30) }) as never);
    const row = result.lines.find((line) => line.includes('またぎ'))!;
    assert.equal(row.split('↔').length - 1, 20, row);
  });

  it('全部並べきれるときは、何も足さない', async () => {
    const result = await runInspect(['a.yaml'], reader({ 'a.yaml': many(3) }) as never);
    const row = result.lines.find((line) => line.includes('またぎ'))!;
    assert.ok(!row.includes('ほか'), row);
  });
});
