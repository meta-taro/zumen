/**
 * **辺の端の記号**（`edges[].ends`）。
 *
 * ER 図で多重度を **「1 対 多」と文字で**書いていた。**実物は記号で書く** ——
 * 鳥の足（crow's foot）。データベースをやる人は**文字ではなく端の形で読む。**
 *
 * 文字で書くと、**辺が増えるほど置き場が無くなって消える**（`hiddenLabels`）。
 * 記号は辺の端に必ず置ける。
 *
 * 値は形の名前だけ（`marker` と `hatch` と同じ約束）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ENDS, drawEnd, endsOf, hasEnds } from '../src/ends.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { spec } from '../src/tools.ts';
import { validate } from '../src/validate.ts';

const ER = `version: 1
nodes:
  - id: kokyaku
    type: database
    label: 顧客
  - id: juchu
    type: database
    label: 受注
edges:
  - from: kokyaku
    to: juchu
    ends: { from: bar, to: crow }
`;

describe('端の記号を読む', () => {
  it('**形の名前だけで閉じる。意味の語は無い**', () => {
    assert.deepEqual(
      [...ENDS],
      ['none', 'arrow', 'bar', 'crow', 'dot', 'dot-bar', 'dot-crow', 'triangle', 'diamond', 'solid-diamond'],
    );
    // 意味の語は受けない（ER の `one-to-many`、UML の `generalization`）。
    assert.deepEqual(endsOf({ from: 'one-to-many' }), { from: 'none', to: 'none' });
    assert.deepEqual(endsOf({ to: 'generalization' }), { from: 'none', to: 'none' });
  });

  it('**書いていなければ null。** 書いたかどうかを区別する', () => {
    // `{ from: none, to: none }` と「書いていない」は別 ——
    // UML の関連線は `ends: { to: none }` と書いて**矢印を止める**。
    assert.equal(endsOf(undefined), null);
    assert.equal(hasEnds(null), false);
    assert.deepEqual(endsOf({ to: 'none' }), { from: 'none', to: 'none' });
    assert.equal(hasEnds({ from: 'none', to: 'none' }), true, '書いてあるのに矢印が出る');
  });

  it('片側だけでも読む', () => {
    assert.deepEqual(endsOf({ to: 'crow' }), { from: 'none', to: 'crow' });
  });
});

describe('端の記号を描く', () => {
  const tip = { x: 100, y: 100 };
  const back = { x: 0, y: 100 };

  it('無しは描かない。**矢印はここで描く**（2026-09-15 に変えた）', () => {
    assert.equal(drawEnd('none', tip, back, '#111'), '');
    // `marker-end` に任せていたが、**`ends` を書くとそれが外れる**ので
    // 矢印が 1 つも出なかった。そもそも `marker-end` は終わりにしか付かない。
    assert.notEqual(drawEnd('arrow', tip, back, '#111'), '');
  });

  it('棒は 1 本（ER の「1」）', () => {
    const out = drawEnd('bar', tip, back, '#111');
    assert.equal(out.match(/<line /g)!.length, 1);
  });

  it('鳥の足は 3 本（ER の「多」）', () => {
    assert.equal(drawEnd('crow', tip, back, '#111').match(/<line /g)!.length, 3);
  });

  it('**鳥の足は実体へ向かって開く。** 逆だと矢印に見えて、向きを言っていると読まれる', () => {
    const out = drawEnd('crow', tip, back, '#111');
    const lines = [...out.matchAll(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/g)].map((m) =>
      m.slice(1).map(Number),
    );
    // 3 本の始点は同じ（束ねた側）で、終点がばらける（広がった側）。
    const starts = new Set(lines.map((l) => `${l[0]},${l[1]}`));
    const endsAt = new Set(lines.map((l) => `${l[2]},${l[3]}`));
    assert.equal(starts.size, 1, '束ねた側が 1 点になっていない');
    assert.equal(endsAt.size, 3, '広がった側が 3 点になっていない');
    // 束ねた側は線の側（tip より内側）にある。
    assert.ok(lines[0]![0]! < tip.x, '束ねた側が実体の側にある（向きが逆）');
  });

  it('丸つきは、丸と本体の 2 つ（ER の「0 以上」）', () => {
    const out = drawEnd('dot-crow', tip, back, '#111');
    assert.equal(out.match(/<circle /g)!.length, 1);
    assert.equal(out.match(/<line /g)!.length, 3);
  });

  it('向きは線から決める（正本に角度を書かせない）', () => {
    const down = drawEnd('bar', { x: 100, y: 100 }, { x: 100, y: 0 }, '#111');
    const right = drawEnd('bar', { x: 100, y: 100 }, { x: 0, y: 100 }, '#111');
    assert.notEqual(down, right, '向きが線に追従していない');
  });

  it('線の長さが無ければ描かない', () => {
    assert.equal(drawEnd('crow', tip, tip, '#111'), '');
  });
});

describe('図に載せる', () => {
  it('記号が出る', async () => {
    const out = render(await layout(ER));
    assert.ok(out.includes('stroke-width="1.2"'), '端の記号が描かれていない');
  });

  it('**端の記号を書いた辺には、既定の矢印を付けない**（向きが二重になる）', async () => {
    const out = render(await layout(ER));
    assert.ok(!out.includes('marker-end'), '記号と矢印が両方出ている');
  });

  it('書かない辺は、これまでどおり矢印', async () => {
    const out = render(await layout(ER.replace('    ends: { from: bar, to: crow }\n', '')));
    assert.ok(out.includes('marker-end'));
  });

  it('知らない語を警告する', () => {
    const found = validate(ER.replace('to: crow', 'to: karasu'));
    assert.ok(found.some((f) => f.code === 'ends-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  it('spec が端の記号を返す', () => {
    // **リストを literal で書く。** `[...ENDS]` と比べると、
    // 同じ定数どうしの比較になって**何も守らない**（2026-09-13 の棚卸しで見つけた）。
    assert.deepEqual(spec().ends, [
      'none',
      'arrow',
      'bar',
      'crow',
      'dot',
      'dot-bar',
      'dot-crow',
      'triangle',
      'diamond',
      'solid-diamond',
    ]);
    assert.match(spec().shape, /ends:/);
  });
});

describe('UML の関係記号', () => {
  const tip = { x: 100, y: 100 };
  const back = { x: 0, y: 100 };

  it('**中抜きの三角は地の色で塗る。** 線が透けると汎化に見えない', () => {
    const out = drawEnd('triangle', tip, back, '#111', '#ffffff');
    assert.match(out, /<path [^>]*fill="#ffffff"/);
  });

  it('集約は中抜きの菱形、コンポジションは塗った菱形', () => {
    assert.match(drawEnd('diamond', tip, back, '#111', '#fff'), /fill="#fff"/);
    assert.match(drawEnd('solid-diamond', tip, back, '#111', '#fff'), /fill="#111"/);
  });

  it('三角も菱形も、閉じた形（1 つの path）', () => {
    for (const kind of ['triangle', 'diamond', 'solid-diamond'] as const) {
      const out = drawEnd(kind, tip, back, '#111', '#fff');
      assert.equal(out.match(/<path /g)!.length, 1, `${kind} が 1 つの path でない`);
      assert.ok(out.includes(' Z"'), `${kind} が閉じていない`);
    }
  });
});

describe('辺の線種', () => {
  const UML = `version: 1
nodes:
  - id: a
    label: SqlOrderRepository
  - id: b
    label: OrderRepository
edges:
  - from: a
    to: b
    line: dashed
    ends: { to: triangle }
`;

  it('**破線で描く。** 汎化と実現は線種でしか区別できない', async () => {
    const { lineOf, dashOf } = await import('../src/line.ts');
    assert.equal(lineOf('dashed'), 'dashed');
    assert.equal(dashOf('dashed'), '7 4');
    assert.equal(dashOf('solid'), null);
    const out = render(await layout(UML));
    assert.match(out, /<path d="[^"]*"[^>]*stroke-dasharray="7 4"/);
  });

  it('書かなければ実線（これまでの図の見え方を変えない）', async () => {
    const out = render(await layout(UML.replace('    line: dashed\n', '')));
    assert.ok(!out.includes('stroke-dasharray="7 4"'));
  });

  it('意味の語は受けない', async () => {
    const { lineOf } = await import('../src/line.ts');
    assert.equal(lineOf('dependency'), 'solid');
  });

  it('知らない語を警告する', () => {
    const found = validate(UML.replace('line: dashed', 'line: nami'));
    assert.ok(found.some((f) => f.code === 'line-unknown'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });

  /**
   * **二重線**（`line: double`）。
   *
   * 相続関係説明図・家系図で、**婚姻は二重線、親子は単線**と決まっている
   * （法務局の記載例。見本 90）。太さや破線では代わりにならない ——
   * **二重線であること自体が記法。**
   *
   * 描き方は「太い線の上に、地の色で細い線を重ねる」。
   * 折れ線でも曲線でも同じやり方で効く（平行線を計算し直さない）。
   */
  it('**二重線で描く**（婚姻は二重線、親子は単線）', async () => {
    const { lineOf, dashOf, doubled } = await import('../src/line.ts');
    assert.equal(lineOf('double'), 'double');
    assert.equal(dashOf('double'), null, '二重線は破線ではない');
    assert.equal(doubled('double'), true);
    assert.equal(doubled('solid'), false);
    const out = render(await layout(UML.replace('line: dashed', 'line: double')));
    const paths = out.match(/<path d="M [^"]*"/g) ?? [];
    assert.ok(paths.length >= 2, `同じ道を 2 回描いていない（${paths.length}）`);
  });

  it('**内側の線は地の色**（線が 2 本に見える）', async () => {
    const out = render(await layout(UML.replace('line: dashed', 'line: double')), 'light');
    assert.match(out, /<path d="M [^"]*"[^>]*stroke="#ffffff"/, '内側が地の色で抜かれていない');
  });

  it('意味の語は受けない（`marriage` のような語を足さない）', async () => {
    const { lineOf } = await import('../src/line.ts');
    assert.equal(lineOf('marriage'), 'solid');
  });

  it('spec が線種を返す', () => {
    assert.deepEqual(spec().lines, ['solid', 'dashed', 'dotted', 'double']);
    assert.match(spec().shape, /line:/);
  });
});

describe('UML の関連線は無向', () => {
  it('**`ends: { to: none }` と書けば、矢印が止まる**', async () => {
    const out = render(
      await layout(`version: 1
nodes:
  - id: actor
    label: 会員
  - id: uc
    label: 注文する
edges:
  - from: actor
    to: uc
    ends: { to: none }
`),
    );
    assert.ok(!out.includes('marker-end'), 'UML の関連に矢印が出ている');
  });
});

/**
 * **自分自身への辺**（閉じた形を描くための書き方）。
 *
 * 2026-09-14。防犯カメラの視野（見本 97）を描くとき、
 * **扇形を描く手段がない**と思っていたが、
 * `from` と `to` を同じ節にして `via` を並べ、`close: true` にすると
 * **閉じた形が引ける**と分かった（道具を足さずに描けた）。
 *
 * ただし `via` を書かないと、**長さ 0 の線に矢印だけが付く。**
 * `M 130 120 L 130 120` —— 節の真ん中に黒い粒が出るだけで、
 * **それを知らせるものが無かった。**
 */
describe('自分自身への辺', () => {
  const SELF = `version: 1
kind: placement
nodes:
  - id: a
    label: あ
    at: { x: 100, y: 100 }
    size: { w: 60, h: 40 }
edges:
  - from: a
    to: a
`;

  it('**通り道が無ければ知らせる**（長さ 0 の線になる）', async () => {
    const { validate } = await import('../src/validate.ts');
    const found = validate(SELF);
    assert.ok(found.some((f) => f.code === 'edge-self-open'), found.map((f) => f.code).join(','));
    assert.ok(found.every((f) => f.severity === 'warning'), '描ける図なので止めない');
  });

  it('**通り道があれば、閉じた形として通す**', async () => {
    const { validate } = await import('../src/validate.ts');
    const withVia = SELF.replace(
      '    to: a\n',
      '    to: a\n    close: true\n    via:\n      - { x: 40, y: 40 }\n      - { x: 200, y: 40 }\n',
    );
    assert.ok(!validate(withVia).some((f) => f.code === 'edge-self-open'));
  });

  it('ふつうの辺には出ない', async () => {
    const { validate } = await import('../src/validate.ts');
    const two = SELF.replace('  - id: a\n    label: あ', '  - id: b\n    label: い\n    at: { x: 300, y: 100 }\n    size: { w: 60, h: 40 }\n  - id: a\n    label: あ').replace('    to: a\n', '    to: b\n');
    assert.ok(!validate(two).some((f) => f.code === 'edge-self-open'));
  });
});

describe('**`arrow` を書いたら、矢印が出る**（2026-09-15）', () => {
  /**
   * もとは SVG の `marker-end` に任せていたが、**`ends` を書くと
   * その `marker-end` が外れる**ので、`ends: { to: arrow }` と書くと
   * **矢印が 1 つも出なかった。** 書いたのに出ない、いちばん悪い形。
   *
   * そもそも `marker-end` は終わりにしか付かないので、
   * `from: arrow`（型紙の地の目線のように両端へ付ける）は表せない。
   */
  const tip = { x: 100, y: 100 };
  const back = { x: 100, y: 0 };

  it('片側に書けば、そちらへ出る', () => {
    const got = drawEnd('arrow', tip, back, '#000');
    assert.notEqual(got, '', '矢印が出ていない');
    assert.match(got, /fill="#000"/);
  });

  it('**両端へ書ける**（marker-end では表せない）', () => {
    const to = drawEnd('arrow', tip, back, '#000');
    const from = drawEnd('arrow', back, tip, '#000');
    assert.notEqual(to, '');
    assert.notEqual(from, '');
    assert.notEqual(to, from, '向きが同じになっている');
  });

  it('`none` は何も出さない', () => {
    assert.equal(drawEnd('none', tip, back, '#000'), '');
  });
});
