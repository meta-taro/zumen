/**
 * **路線の色**（`palette` と `color`）。
 *
 * ## なぜ DESIGN.md §7 の例外を作るのか
 *
 * `DESIGN.md` §7 は「**色ではなく形で意味を持たせる**」と決めている
 * （白黒で印刷しても、色覚特性でも、縮小しても失われないため）。
 *
 * オーナーの判断（2026-09-13）。
 *
 * > **色が文化であれば色のルールが優先されます。**
 *
 * 日本の路線図では**色が路線の名前**（銀座線はオレンジ、丸ノ内線は赤）。
 * 「オレンジの線」と言えば銀座線のことで、**色を落とすと名前が消える。**
 * ここは §7 が想定した「見た目の飾り」ではなく、**記法そのもの。**
 *
 * ## それでも、色だけに頼らせない
 *
 * 実物の東京メトロも**色と番号の両方**で読ませている（`G-09` の `G`）。
 * 色覚特性のある人と、白黒で刷った人が読めなくなるため。
 *
 * そこで **`palette` の鍵は路線記号そのもの**にし、
 * **その記号が図に文字として出ていること**（`tag` の頭）を検証器が見る。
 * 色を使っているのに記号が出ていなければ知らせる。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout } from '../src/layout.ts';
import { colorOf, contrastOn, paletteOf as routePalette } from '../src/palette.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';

const MAP = `version: 1
kind: placement
arrows: false
palette:
  G: "#f39700"
  M: "#e5171f"
nodes:
  - id: a
    label: 浅草
    tag: G-01
    color: G
    marker: circle
    at: { x: 0, y: 0 }
    size: { w: 34, h: 34 }
  - id: b
    label: 上野
    tag: G-16
    color: G
    marker: circle
    at: { x: 200, y: 0 }
    size: { w: 34, h: 34 }
edges:
  - from: a
    to: b
    color: G
    weight: thick
`;

describe('路線の色を読む', () => {
  it('**正本が色を決める。** こちらは色を持たない', () => {
    assert.deepEqual(routePalette({ G: '#f39700' }), { G: '#f39700' });
  });

  it('`#rrggbb` でないものは落とす', () => {
    assert.deepEqual(routePalette({ G: 'orange', M: '#e5171f' }), { M: '#e5171f' });
    assert.deepEqual(routePalette({ G: '#fff' }), {});
    assert.deepEqual(routePalette(undefined), {});
  });

  it('鍵に無い色は使わない', () => {
    assert.equal(colorOf('G', { G: '#f39700' }), '#f39700');
    assert.equal(colorOf('Z', { G: '#f39700' }), null);
    assert.equal(colorOf(undefined, { G: '#f39700' }), null);
  });

  it('**地とのコントラストを測れる**（薄い色は線が消える）', () => {
    assert.ok(contrastOn('#f39700', '#ffffff') > 1.5);
    assert.ok(contrastOn('#fefefe', '#ffffff') < 1.2);
  });
});

describe('路線の色を描く', () => {
  it('**線が路線の色になる**', async () => {
    const out = render(await layout(MAP), 'light', 'safe', true);
    assert.match(out, /<path d="[^"]*"[^>]*stroke="#f39700"/);
  });

  it('**駅の印も路線の色になる**（線と駅が同じ路線だと分かる）', async () => {
    const out = render(await layout(MAP), 'light', 'safe', true);
    assert.match(out, /data-node="a"[\s\S]*?<circle [^>]*stroke="#f39700"/);
  });

  it('**文字までは染めない。** 地の上で読めなくなる', async () => {
    const out = render(await layout(MAP), 'light', 'safe', true);
    assert.ok(!/<text[^>]*fill="#f39700"/.test(out), '文字まで色を付けた');
  });

  it('色を書かなければ、これまでどおり', async () => {
    const out = render(await layout(MAP.replace(/    color: G\n/g, '')), 'light', 'safe', true);
    assert.ok(!out.includes('#f39700'));
  });
});

/**
 * **色だけに頼らせない**（`color-without-code`）。
 *
 * 2026-09-14 に**見る場所を変えた。**
 *
 * 前は「その節の `tag` が鍵で始まっているか」を節ごとに見ていた。
 * これには穴が 2 つあった。
 *
 * 1. **`tag` が無い節では、一度も鳴らなかった。**
 *    符号がどこにも無いのがいちばん危ないのに、そこだけ素通りしていた
 * 2. **`tag` が別の意味を持つ図で、誤って鳴った。**
 *    積付図（見本 89）の `tag` はリーファーと危険物の印で、揚地の符号ではない。
 *    それでも「tag に符号が無い」と 6 件鳴った
 *
 * **見るべきは節ではなく図ぜんたい。** 色が意味を持つなら、
 * その符号が**図のどこかに文字として出ていればいい**（凡例でもよい）。
 * 実物の路線図も、駅ごとに色名を書いてはいない。**凡例に 1 回書いてある。**
 */
describe('色だけに頼らせない', () => {
  it('**鍵が図のどこにも文字として出ていないと知らせる**', () => {
    const found = validate(MAP.replace('tag: G-01', 'tag: A-01').replace('tag: G-16', 'tag: A-16'));
    assert.ok(
      found.some((f) => f.code === 'color-without-code'),
      '色だけで路線を示しているのに、知らせていない',
    );
  });

  it('記号が出ていれば、何も言わない', () => {
    assert.ok(!validate(MAP).some((f) => f.code === 'color-without-code'));
  });

  it('**凡例に 1 回出ていれば足りる**（節ごとに書かせない）', () => {
    const legend = MAP.replace('tag: G-01', 'tag: A-01').replace('tag: G-16', 'tag: A-16').replace(
      'nodes:\n',
      'nodes:\n  - id: legend\n    label: "G 銀座線"\n    marker: none\n',
    );
    assert.ok(!validate(legend).some((f) => f.code === 'color-without-code'), legend);
  });

  it('**`tag` が別の意味を持つ図で、誤って鳴らない**（積付図のリーファー印）', () => {
    const stow = MAP.replace('tag: G-01', 'tag: R').replace('tag: G-16', 'tag: R');
    const found = validate(stow.replace('  - id: a\n', '  - id: legend\n    label: "G 銀座線"\n    marker: none\n  - id: a\n'));
    assert.ok(!found.some((f) => f.code === 'color-without-code'), found.map((f) => f.code).join(','));
  });

  it('使っていない色は問わない（palette に書いてあるだけ）', () => {
    const spare = MAP.replace('palette:\n', 'palette:\n  Z: "#1f8ad0"\n');
    assert.ok(!validate(spare).some((f) => f.code === 'color-without-code'));
  });

  it('**薄すぎる色を知らせる**（白黒に落とすと消える）', () => {
    const found = validate(MAP.replace('#f39700', '#fdfdfd'));
    assert.ok(found.some((f) => f.code === 'color-faint'));
  });

  it('鍵に無い色を知らせる', () => {
    assert.ok(validate(MAP.replace('color: G\n    marker', 'color: Z\n    marker')).some((f) => f.code === 'color-unknown'));
  });

  it('どれも warning（読めない図ではない）', () => {
    const found = validate(MAP.replace('tag: G-01', 'tag: A-01').replace('#f39700', '#fdfdfd'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });
});

/**
 * **塗りにも色が乗る。**
 *
 * 停車駅案内図の ●（停車）で出た（2026-09-13）。枠だけ色を付けて中を
 * 既定の墨で塗ったので、**どの種別の ● なのか、色で読めなかった。**
 * 実物の案内も、●そのものが種別の色をしている。
 */
describe('塗りにも色が乗る', () => {
  const DOT = `version: 1
kind: placement
palette:
  kyuko: "#d95f02"
nodes:
  - id: stop
    label: ""
    marker: circle
    hatch: solid
    color: kyuko
    at: { x: 0, y: 0 }
    size: { w: 20, h: 20 }
`;

  it('**塗りは、その色**（既定の墨で塗らない）', async () => {
    const out = render(await layout(DOT), 'light', 'safe', true);
    assert.match(out, /<circle [^>]*fill="#d95f02" fill-opacity="0.82"/);
  });

  it('色を書かなければ、これまでどおり墨で塗る', async () => {
    const out = render(await layout(DOT.replace('    color: kyuko\n', '')), 'light', 'safe', true);
    assert.match(out, /<circle [^>]*fill="#1c1c22" fill-opacity="0.82"/);
  });
});

/**
 * **薄いかどうかは、両方の地で見る。**
 *
 * のりかえ案内図の JR の灰色で出た（2026-09-13）。白地では 7:1 あったが、
 * **暗い地では 2:1 で、ダークの図では見えていなかった。**
 * zumen は同じ正本から**ライトとダークの両方**を書き出すので、
 * 片方の地だけで見ていると、もう片方が抜ける。
 */
describe('薄い色は、両方の地で見る', () => {
  const one = (hex: string): string[] =>
    validate(`version: 1
kind: placement
palette:
  X: "${hex}"
nodes:
  - id: a
    label: あ
    tag: X
    color: X
    at: { x: 0, y: 0 }
    size: { w: 40, h: 20 }
`).map((f) => f.code);

  it('**暗い地で沈む色を知らせる**（白地では足りていても）', () => {
    // 白地に 7.4:1、暗い地に 1.9:1。
    assert.ok(one('#4a4a52').includes('color-faint'), '暗い地で沈む色を通した');
  });

  it('白地で沈む色も、これまでどおり知らせる', () => {
    assert.ok(one('#fdfdfd').includes('color-faint'));
  });

  it('**両方で読める色は通す**', () => {
    assert.deepEqual(one('#808080'), [], '両方で読める色を止めた');
  });
});

/**
 * **面の色**（`fill`）。
 *
 * オーナーの指摘（2026-09-18）。
 *
 * > **色味もそうです。ダークライトだけしかできないと思われると損です。**
 *
 * ここまでの色は**線の色**だった（路線・系統）。実物の販売図面・工程表・
 * 区画図は、**面を淡く染め分ける** —— 線の色とは別のものが要る。
 *
 * ## なぜ `color` を流用しないか
 *
 * `color` は枠の線に乗る。淡い色を `color` に書くと、
 * **枠（＝壁）まで淡くなって消える。** 壁が消えた間取り図は間取り図ではない。
 *
 * ## なぜ淡く敷くのか（`TINT`）
 *
 * 面は**地を置き換えない。地の上へ薄く敷く。**
 * こうすると、同じ正本から出るライトでは淡い色、ダークでは沈んだ色になり、
 * **どちらでも上の文字が読める**（色を不透明で塗ると、片方で必ず潰れる）。
 * だから `color-faint`（非文字の下限 3:1）は、**面だけに使う鍵には当てない。**
 */
describe('面の色（fill）', () => {
  const ROOM = `version: 1
kind: placement
palette:
  LDK: "#e8a33d"
nodes:
  - id: legend
    label: "LDK は暖色"
    marker: none
    at: { x: 0, y: 200 }
    size: { w: 120, h: 20 }
  - id: ldk
    label: LDK
    fill: LDK
    at: { x: 0, y: 0 }
    size: { w: 120, h: 80 }
`;

  it('**面がその色になる**（淡く敷く）', async () => {
    const out = render(await layout(ROOM), 'light', 'safe', true);
    assert.match(out, /fill="#e8a33d" fill-opacity="0\.1[0-9]"/);
  });

  it('**枠の線は染めない**（壁まで淡くすると、壁が消える）', async () => {
    const out = render(await layout(ROOM), 'light', 'safe', true);
    assert.ok(!/stroke="#e8a33d"/.test(out), '枠まで面の色にした');
  });

  it('**文字も染めない**', async () => {
    const out = render(await layout(ROOM), 'light', 'safe', true);
    assert.ok(!/<text[^>]*fill="#e8a33d"/.test(out));
  });

  it('鍵に無ければ、色を付けない（知らせる）', () => {
    assert.ok(validate(ROOM.replace('fill: LDK', 'fill: Z')).some((f) => f.code === 'color-unknown'));
  });

  it('**面の色も、鍵が文字として出ていること**（色だけに頼らせない）', () => {
    const found = validate(ROOM.replace('    label: "LDK は暖色"', '    label: "凡例"').replace('    label: LDK\n', '    label: 居間\n'));
    assert.ok(found.some((f) => f.code === 'color-without-code'), found.map((f) => f.code).join(','));
  });

  it('**面だけに使う鍵は、3:1 を割っても知らせない**（線ではないので沈まない）', () => {
    const pale = ROOM.replace('#e8a33d', '#fbe6c8');
    assert.ok(!validate(pale).some((f) => f.code === 'color-faint'), '面の色に線の下限を当てた');
  });

  it('同じ鍵を線にも使っていれば、これまでどおり知らせる', () => {
    const pale = ROOM.replace('#e8a33d', '#fbe6c8').replace('    fill: LDK\n', '    fill: LDK\n    color: LDK\n');
    assert.ok(validate(pale).some((f) => f.code === 'color-faint'));
  });

  it('ダークでも、面の上の文字は地の色にならない（淡い面に白文字を書かない）', async () => {
    const out = render(await layout(ROOM), 'dark', 'safe', true);
    assert.match(out, /fill="#e8a33d" fill-opacity="0\.1[0-9]"/);
    assert.ok(!/<text[^>]*fill="#0f0f13"/.test(out), 'ダークで文字を地の色にした');
  });
});
