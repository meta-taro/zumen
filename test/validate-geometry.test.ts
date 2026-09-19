/**
 * **AI が書く場所を、検証器が見ていなかった。**
 *
 * `at` / `size` / `openings` / `tag` / `kind` / `direction` / `wrap` は
 * どれも AI が書いてよいものだが、検証器は 1 つも見ていなかった。
 *
 * 読めない文書になるわけではない（描画側が黙って無視する）ので `error` にはしない。
 * **`warning` で知らせる。**
 *
 * 黙って無視すると、AI は「書いたのに効かない」理由が分からないまま、
 * 同じ間違いを書き続ける。**人も、図を見るまで気づけない。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { placedFindings } from '../src/cli.ts';
import { edgesUnderBoxes, layout } from '../src/layout.ts';
import { hasError, validate } from '../src/validate.ts';

/** 指摘の印だけを拾う。**文言が変わっても、これは変わらない。** */
function codes(text: string): string[] {
  return validate(text).map((finding) => finding.code);
}

const PLACEMENT = 'version: 1\nkind: placement\nnodes:\n';

describe('置き場所（at）を見る', () => {
  it('数で書いた at は通る', () => {
    assert.deepEqual(codes(`${PLACEMENT}  - id: a\n    at: { x: 10, y: 20 }\n`), []);
  });

  it('**数でない at を知らせる。** 黙って無視すると「書いたのに効かない」', () => {
    assert.ok(codes(`${PLACEMENT}  - id: a\n    at: { x: "ひだり", y: 20 }\n`).includes('node-at-invalid'));
  });

  it('x か y が欠けていたら知らせる', () => {
    assert.ok(codes(`${PLACEMENT}  - id: a\n    at: { x: 10 }\n`).includes('node-at-invalid'));
  });

  it('**構成図に at を書いても効かないことを知らせる**', () => {
    const out = codes('version: 1\nnodes:\n  - id: a\n    at: { x: 10, y: 20 }\n');
    assert.ok(out.includes('node-at-ignored'), '構成図の at が黙って無視されている');
  });

  it('at の指摘は warning。**読めない文書ではない**', () => {
    assert.equal(hasError(validate(`${PLACEMENT}  - id: a\n    at: { x: "あ", y: 1 }\n`)), false);
  });
});

describe('大きさ（size）を見る', () => {
  it('数で書いた size は通る', () => {
    assert.deepEqual(codes('version: 1\nnodes:\n  - id: a\n    size: { w: 200, h: 80 }\n'), []);
  });

  it('0 以下の大きさを知らせる（描くと潰れる）', () => {
    assert.ok(codes('version: 1\nnodes:\n  - id: a\n    size: { w: 0, h: 80 }\n').includes('node-size-invalid'));
  });

  it('数でない大きさを知らせる', () => {
    assert.ok(codes('version: 1\nnodes:\n  - id: a\n    size: { w: 大, h: 80 }\n').includes('node-size-invalid'));
  });
});

describe('建具（openings）を見る', () => {
  it('決まった語で書いた建具は通る', () => {
    assert.deepEqual(
      codes(`${PLACEMENT}  - id: a\n    openings:\n      - { kind: door, side: top }\n`),
      [],
    );
  });

  it('**知らない建具の種類を知らせる。** 描かれずに消える', () => {
    const out = codes(`${PLACEMENT}  - id: a\n    openings:\n      - { kind: toilet, side: top }\n`);
    assert.ok(out.includes('opening-kind-unknown'));
  });

  it('知らない辺を知らせる', () => {
    const out = codes(`${PLACEMENT}  - id: a\n    openings:\n      - { kind: door, side: naka }\n`);
    assert.ok(out.includes('opening-side-unknown'));
  });

  it('**構成図に建具を書いても効かないことを知らせる**', () => {
    const out = codes('version: 1\nnodes:\n  - id: a\n    openings:\n      - { kind: door, side: top }\n');
    assert.ok(out.includes('opening-ignored'));
  });
});

describe('図ぜんたいの宣言を見る', () => {
  it('決まった語なら通る', () => {
    assert.deepEqual(codes('version: 1\nkind: placement\ndirection: down\nwrap: true\nnodes:\n  - id: a\n'), []);
  });

  it('知らない kind を知らせる（構成図として描かれる）', () => {
    assert.ok(codes('version: 1\nkind: madori\nnodes:\n  - id: a\n').includes('kind-unknown'));
  });

  it('知らない direction を知らせる', () => {
    assert.ok(codes('version: 1\ndirection: naname\nnodes:\n  - id: a\n').includes('direction-unknown'));
  });

  it('**真偽でない wrap を知らせる。** `wrap: "true"` は折り返さない', () => {
    assert.ok(codes('version: 1\nwrap: "true"\nnodes:\n  - id: a\n').includes('wrap-not-boolean'));
  });
});

/**
 * **警告が出るのが正しい見本。**
 *
 * 見本は原則 0 件。**理由を書いたものだけ外す。**
 *
 * ここに並ぶのは「実在の色を使ったら、こちらの下限を割った」図。
 * **警告は正しい** —— 実物もその色だけでは白黒や暗い地で読めず、
 * だから駅ナンバリングと駅名を併記している。
 * 色を作り変えて警告を消すと、**路線の名前が別のものになる**（D24）。
 */
const EXPECTED: Record<string, { codes: string[]; why: string }> = {
  '78-山手線の路線図.zumen.yaml': {
    codes: ['color-faint'],
    why: 'うぐいす色 #9ACD32 は白地に 1.88:1。**実在の色**なので変えない',
  },
  '79-梅田の乗換関係図.zumen.yaml': {
    codes: ['color-faint'],
    why: '阪急マルーン・阪神の黄・谷町線の紫。**どれも実在の事業者の色**',
  },
  '81-東京の地下鉄13路線.zumen.yaml': {
    codes: ['color-faint'],
    why: '日比谷線のシルバー・有楽町線のゴールド・都営新宿線のリーフほか。**実在の案内色**',
  },
};

describe('見本 23 件は、指摘 0 件のまま', () => {
  it('既にある図を、新しい検査が落とさない', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith('.zumen.yaml'));
    assert.ok(files.length >= 23, `見本が ${files.length} 件しかない`);
    for (const name of files) {
      const found = validate(readFileSync(new URL(name, dir), 'utf8'));
      const allow = EXPECTED[name];
      if (allow === undefined) {
        assert.deepEqual(found, [], `${name}: ${found.map((f) => f.code + ' ' + f.message).join(' / ')}`);
        continue;
      }
      // **外した図は、本当にその指摘が出ていること。** 出ていないなら記述が古い。
      assert.ok(found.length > 0, `${name} は指摘が出るはずなのに 0 件（${allow.why}）`);
      for (const one of found) {
        assert.ok(allow.codes.includes(one.code), `${name} に想定外の指摘: ${one.code} ${one.message}`);
        assert.equal(one.severity, 'warning', `${name} の ${one.code} が警告ではない`);
      }
    }
  });
});

describe('通り芯・縮尺・方位を見る', () => {
  const PLAN = 'version: 1\nkind: placement\n';

  it('正しく書いた通り芯は通る', () => {
    assert.deepEqual(
      codes(`${PLAN}scale: { mm: 20 }\ngrid:\n  x:\n    - { id: X1, at: 40 }\n    - { id: X2, at: 400 }\nnodes:\n  - id: a\n`),
      [],
    );
  });

  it('**符号の無い芯を知らせる。** 名前の無い基準線は使えない', () => {
    assert.ok(codes(`${PLAN}grid:\n  x:\n    - { at: 40 }\nnodes:\n  - id: a\n`).includes('grid-axis-invalid'));
  });

  it('位置が数でない芯を知らせる', () => {
    assert.ok(
      codes(`${PLAN}grid:\n  x:\n    - { id: X1, at: ひだり }\nnodes:\n  - id: a\n`).includes('grid-axis-invalid'),
    );
  });

  it('**構成図に通り芯を書いても効かないことを知らせる**', () => {
    assert.ok(
      codes('version: 1\ngrid:\n  x:\n    - { id: X1, at: 40 }\nnodes:\n  - id: a\n').includes('grid-ignored'),
    );
  });

  it('**通り芯があるのに縮尺が無いことを知らせる。** 寸法が出ない', () => {
    const out = codes(`${PLAN}grid:\n  x:\n    - { id: X1, at: 40 }\n    - { id: X2, at: 400 }\nnodes:\n  - id: a\n`);
    assert.ok(out.includes('scale-missing'), '寸法が出ないことを知らせていない');
  });

  it('縮尺が 0 以下・数でないことを知らせる', () => {
    assert.ok(codes(`${PLAN}scale: { mm: 0 }\nnodes:\n  - id: a\n`).includes('scale-invalid'));
    assert.ok(codes(`${PLAN}scale: { mm: おおきい }\nnodes:\n  - id: a\n`).includes('scale-invalid'));
  });

  it('知らない方位を知らせる', () => {
    assert.ok(codes(`${PLAN}north: naname\nnodes:\n  - id: a\n`).includes('north-unknown'));
  });

  it('どれも warning。**読めない文書ではない**', () => {
    assert.equal(
      hasError(validate(`${PLAN}north: naname\nscale: { mm: 0 }\ngrid:\n  x:\n    - { at: 1 }\nnodes:\n  - id: a\n`)),
      false,
    );
  });
});

describe('壁の厚みを見る', () => {
  it('正しく書いた壁は通る', () => {
    assert.deepEqual(
      codes('version: 1\nkind: placement\nscale: { mm: 20 }\nwall: { mm: 120 }\nnodes:\n  - id: a\n'),
      [],
    );
  });

  it('**縮尺が無ければ、壁の太さが変わらないことを知らせる**', () => {
    const out = codes('version: 1\nkind: placement\nwall: { mm: 120 }\nnodes:\n  - id: a\n');
    assert.ok(out.includes('wall-needs-scale'));
  });

  it('厚みが数でない・0 以下なら知らせる', () => {
    assert.ok(
      codes('version: 1\nkind: placement\nscale: { mm: 20 }\nwall: { mm: あつい }\nnodes:\n  - id: a\n').includes(
        'wall-invalid',
      ),
    );
  });
});

describe('範囲の円を見る', () => {
  it('正しく書いた範囲は通る', () => {
    assert.deepEqual(
      codes('version: 1\nkind: placement\nnodes:\n  - id: a\n    radius: 100\n'),
      [],
    );
  });

  it('数でない・0 以下の半径を知らせる', () => {
    assert.ok(codes('version: 1\nkind: placement\nnodes:\n  - id: a\n    radius: とおく\n').includes('radius-invalid'));
    assert.ok(codes('version: 1\nkind: placement\nnodes:\n  - id: a\n    radius: 0\n').includes('radius-invalid'));
  });

  it('**構成図に書いても効かないことを知らせる**', () => {
    assert.ok(codes('version: 1\nnodes:\n  - id: a\n    radius: 100\n').includes('radius-ignored'));
  });
});

/**
 * **箱の下へ潜った線**（`edge-under-box`）。
 *
 * `arrows: false` のとき、辺は**箱より先に**描かれる。
 * 停車駅案内図の「線の上に駅の印を置く」がそれで成り立っている。
 *
 * その代わり、**枠の中へ引いた線は、枠の塗りに隠れて消える。**
 * 2026-09-14〜15 に 3 回踏んだ（見本 97 のカメラの視野、
 * 見本 101 のスピーカーの指向、見本 111 の速度照査パターン）。
 * **数の検査はどれも 0 のまま**で、ブラウザで開くまで気づかなかった。
 */
describe('箱の下へ潜った線', () => {
  const UNDER = `version: 1
kind: placement
arrows: false
nodes:
  - id: room
    label: 部屋
    at: { x: 0, y: 0 }
    size: { w: 400, h: 300 }
  - id: a
    label: ""
    marker: none
    at: { x: 60, y: 60 }
    size: { w: 2, h: 2 }
  - id: b
    label: ""
    marker: none
    at: { x: 320, y: 240 }
    size: { w: 2, h: 2 }
edges:
  - from: a
    to: b
`;

  const under = async (text: string): Promise<string[]> =>
    edgesUnderBoxes(await layout(text)).map(([edge]) => edge);

  it('**塗った箱の中で閉じた線は、消えることを知らせる**', async () => {
    assert.deepEqual(await under(UNDER), ['a>b'], '隠れる線を見逃した');
  });

  it('`arrows: true` なら線は箱の上に出るので、知らせない', async () => {
    assert.deepEqual(await under(UNDER.replace('arrows: false', 'arrows: true')), []);
  });

  it('**印の無い箱は塗らない**ので、知らせない', async () => {
    assert.deepEqual(
      await under(UNDER.replace('    label: 部屋\n', '    label: 部屋\n    marker: none\n')),
      [],
    );
  });

  it('箱から出ている線は、隠れないので知らせない', async () => {
    assert.deepEqual(await under(UNDER.replace('{ x: 320, y: 240 }', '{ x: 520, y: 240 }')), []);
  });

  it('検証器がその印を出す', async () => {
    const found = await placedFindings(UNDER);
    assert.ok(found.some((f) => f.code === 'edge-under-box'));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });
});

/**
 * **図の名前が、中身の上に乗る**（2026-09-19）。
 *
 * `views[].title` は図の**下辺のすぐ下**に描かれる。だから `size` に書いた高さより
 * 中身が下へ出ていると、名前がその上に乗る。
 *
 * `overlappingInk` は**文字どうし**しか見ないので、
 * 名前が箱の上に乗っただけでは拾えなかった ——
 * 血球計算盤（見本 213）の断面図で踏み、**ブラウザで開いて初めて見つけた。**
 */
describe('図の名前が、中身の上に乗っていないか', () => {
  /** 図の高さは 100 だが、中身は 200 まで伸びている。 */
  const OVER = (h: number): string => `version: 1
kind: placement
arrows: true
views:
  - id: dan
    title: ② 断面
    at: { x: 100, y: 100 }
    size: { w: 300, h: ${h} }
nodes:
  - id: base
    label: ""
    at: { x: 110, y: 110 }
    size: { w: 280, h: 190 }
`;

  it('**中身が下辺から出ていたら知らせる**', async () => {
    const found = await placedFindings(OVER(100));
    assert.ok(
      found.some((f) => f.code === 'view-title-covered'),
      found.map((f) => f.code).join(','),
    );
  });

  it('何 px 増やせばよいかまで言う', async () => {
    const found = await placedFindings(OVER(100));
    const said = found.find((f) => f.code === 'view-title-covered')!;
    assert.match(said.message, /size\.h` を \d+px 増やす/);
  });

  it('中身が収まっていれば、何も言わない', async () => {
    const found = await placedFindings(OVER(220));
    assert.ok(!found.some((f) => f.code === 'view-title-covered'));
  });

  it('名前を書いていない図は、そもそも乗るものが無い', async () => {
    const found = await placedFindings(OVER(100).replace('    title: ② 断面\n', ''));
    assert.ok(!found.some((f) => f.code === 'view-title-covered'));
  });

  it('**何も描かない節（marker: none）には乗られても見えない**ので、知らせない', async () => {
    const found = await placedFindings(OVER(100).replace('    label: ""\n', '    label: ""\n    marker: none\n'));
    assert.ok(!found.some((f) => f.code === 'view-title-covered'));
  });
});

/**
 * **語を、置ける側へ置く**（2026-09-19）。
 *
 * `edges[].fill` の穴と同じ形が、ほかにもあった。
 * 辺だけの語（`weight` ほか）を節に書いても、
 * 節だけの語（`at` ほか）を辺に書いても、**黙って落ちていた。**
 * 測ったら、前者は**見本 3 枚で 59 個**あった（`line` を足す前）。
 */
describe('置けない側へ書いた語を、名指しする', () => {
  const FLOW = `version: 1
kind: placement
nodes:
  - id: a
    label: "A"
    at: { x: 10, y: 10 }
    size: { w: 60, h: 30 }
  - id: b
    label: "B"
    at: { x: 150, y: 10 }
    size: { w: 60, h: 30 }
edges:
  - from: a
    to: b
`;

  it('**節に `weight` を書いたら知らせる**（枠の太さの語は無い）', () => {
    const out = validate(FLOW.replace('    label: "A"\n', '    label: "A"\n    weight: thick\n'));
    assert.ok(out.some((f) => f.code === 'node-edge-key-ignored'), out.map((f) => f.code).join(','));
  });

  it('節に `line` を書くのは**効く**ので、何も言わない', () => {
    const out = validate(FLOW.replace('    label: "A"\n', '    label: "A"\n    line: chain\n'));
    assert.ok(!out.some((f) => f.code === 'node-edge-key-ignored'));
    assert.ok(!out.some((f) => f.code === 'line-unknown'));
  });

  it('節の `line` が知らない語なら、これまでどおり知らせる', () => {
    const out = validate(FLOW.replace('    label: "A"\n', '    label: "A"\n    line: もやもや\n'));
    assert.ok(out.some((f) => f.code === 'line-unknown'), out.map((f) => f.code).join(','));
  });

  it('**辺に `at` を書いたら知らせる**（辺は場所を持たない）', () => {
    const out = validate(`${FLOW}    at: { x: 1, y: 2 }\n`);
    assert.ok(out.some((f) => f.code === 'edge-node-key-ignored'), out.map((f) => f.code).join(','));
  });

  it('辺に `via` を書くのは**効く**ので、何も言わない', () => {
    const out = validate(`${FLOW}    via:\n      - { x: 100, y: 80 }\n`);
    assert.ok(!out.some((f) => f.code === 'edge-node-key-ignored'));
  });

  it('どちらも warning。**読めない文書ではない**', () => {
    assert.equal(hasError(validate(`${FLOW}    at: { x: 1, y: 2 }\n`)), false);
  });
});

/**
 * **どこを詰めればよいかまで言う**（2026-09-19）。
 *
 * 「あと N px 詰めてください」までは言えていたが、
 * **どこを詰めるかは当て推量**だった —— 1 枚の見本で 3 往復したことが今日 4 回あった。
 * 長辺の向きで**中身が 1 つも無い帯**を見つけて、その場所と幅を返す。
 */
describe('印刷で読めない紙に、空いている帯を教える', () => {
  const FAR = (y: number): string => `version: 1
kind: placement
nodes:
  - id: a
    label: "上"
    at: { x: 10, y: 10 }
    size: { w: 200, h: 40 }
  - id: b
    label: "下"
    at: { x: 10, y: ${y} }
    size: { w: 200, h: 40 }
`;

  it('**空いている帯の場所と幅を言う**', async () => {
    const found = await placedFindings(FAR(1500));
    const said = found.find((f) => f.code === 'too-small-to-print')!;
    assert.match(said.message, /いちばん空いているのは y 50〜1500 の 1450px/);
  });

  it('収まっている紙には、何も言わない', async () => {
    const found = await placedFindings(FAR(80));
    assert.ok(!found.some((f) => f.code === 'too-small-to-print'));
  });
});
