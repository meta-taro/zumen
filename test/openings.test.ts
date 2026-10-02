/**
 * 建具（`openings`）が、実物の平面図と同じ記号で出ること。
 *
 * **人の指摘から始まっている**（2026-09-12）。
 * 「間取り図 モダン マンション」で実物を並べたところ、
 * zumen が出していたのは**角丸の箱に名前を書いて矢印で繋いだもの**で、
 * 平面図ではなかった。差が大きかったのは、壁・矢印・建具・文字の 4 点。
 *
 * ここで測るのは**建具**。
 * 「扉がある」ことを絵で言えないと、間取り図は間取り図にならない。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { drawOpenings, openingsOf, type Hole } from '../src/openings.ts';

const BOX = { x: 100, y: 100, w: 200, h: 120 };
const INK = '#111111';
const PAPER = '#ffffff';

function draw(holes: Hole[]): string {
  return drawOpenings(BOX, holes, INK, PAPER);
}

function one(kind: string, side = 'bottom'): Hole[] {
  return openingsOf([{ kind, side }]);
}

describe('建具を読む（openingsOf）', () => {
  it('種類と辺が揃っていれば読む', () => {
    assert.deepEqual(openingsOf([{ kind: 'door', side: 'left' }]), [
      { kind: 'door', side: 'left', at: 0.5, width: 36 },
    ]);
  });

  it('**知らない種類は黙って落とす。** 描けないものを描いたことにしない', () => {
    assert.deepEqual(openingsOf([{ kind: 'toilet', side: 'left' }]), []);
    assert.deepEqual(openingsOf([{ kind: 'door', side: 'naka' }]), []);
  });

  it('位置と幅は、書いてあれば使う', () => {
    const [hole] = openingsOf([{ kind: 'window', side: 'top', at: 0.2, width: 80 }]);
    assert.equal(hole!.at, 0.2);
    assert.equal(hole!.width, 80);
  });

  it('位置が 0〜1 の外なら、中央に戻す（図が壊れるより中央のほうがまし）', () => {
    assert.equal(openingsOf([{ kind: 'door', side: 'top', at: 9 }])[0]!.at, 0.5);
    assert.equal(openingsOf([{ kind: 'door', side: 'top', at: -1 }])[0]!.at, 0.5);
  });

  it('幅が 0 以下なら既定に戻す', () => {
    assert.equal(openingsOf([{ kind: 'door', side: 'top', width: 0 }])[0]!.width, 36);
  });

  it('配列でなければ、建具は無い', () => {
    assert.deepEqual(openingsOf(null), []);
    assert.deepEqual(openingsOf('door'), []);
    assert.deepEqual(openingsOf([null, 3, 'door']), []);
  });

  it('OPENINGS の 5 種すべてが読める', () => {
    for (const kind of ['door', 'slide', 'window', 'double', 'open']) {
      assert.equal(openingsOf([{ kind, side: 'top' }]).length, 1, `${kind} が落ちた`);
    }
  });
});

describe('建具を描く（drawOpenings）', () => {
  it('建具が無ければ、何も出さない', () => {
    assert.equal(draw([]), '');
  });

  it('**まず壁を消す。** 建具は穴なので、そこに壁があってはいけない', () => {
    for (const kind of ['door', 'slide', 'window', 'double', 'open']) {
      const svg = draw(one(kind));
      assert.ok(
        svg.includes(`stroke="${PAPER}"`),
        `${kind} が壁を消していない（壁の上に記号が重なって出る）`,
      );
    }
  });

  it('開口（open）は、壁を消すだけ。記号は描かない', () => {
    const svg = draw(one('open'));
    assert.ok(svg.includes(`stroke="${PAPER}"`));
    assert.ok(!svg.includes(`stroke="${INK}"`), '開口なのに記号が出ている');
  });

  it('**片開き戸は、戸と開き勝手の弧。** 弧が無いと引き戸と見分けがつかない', () => {
    const svg = draw(one('door'));
    assert.match(svg, /<path d="M [\d-]+ [\d-]+ A /, '開き勝手の弧が無い');
    assert.equal(svg.match(/<path /g)!.length, 1, '片開きなのに弧が 1 つでない');
  });

  /**
   * **開き勝手の弧は、蝶番を中心にふくらむ**（2026-09-29。扉は扇状に開くはず、という指摘）。
   *
   * 弧は戸の先が通る軌跡なので、中心は蝶番（戸の付け根）。SVG の sweep-flag を逆に書いていて、
   * **中心が蝶番の向かいの角に来て、弧が蝶番側へ凹んでいた。** 両開き戸は 2 つ並んで「U」字に見えていた。
   */
  it('**弧の中心は、蝶番（戸の付け根）**。片開き・両開き、どの辺でも', () => {
    for (const kind of ['door', 'double']) {
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const svg = draw(one(kind, side));
        const leaves = [...svg.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="[^"]*" stroke-width="2"\/><path d="M ([\d.-]+) ([\d.-]+) A ([\d.-]+) [\d.-]+ 0 0 ([01]) ([\d.-]+) ([\d.-]+)"/g)];
        assert.ok(leaves.length > 0, `${kind} ${side}: 戸と弧が見つからない`);
        for (const m of leaves) {
          const [hx, hy, , , sx, sy, r, sweep, ex, ey] = m.slice(1).map(Number) as number[];
          // 端点 2 つと半径から、sweep-flag が選ぶ中心を求める
          const mx = (sx! + ex!) / 2, my = (sy! + ey!) / 2;
          const dx = ex! - sx!, dy = ey! - sy!;
          const d = Math.hypot(dx, dy);
          const h = Math.sqrt(Math.max(r! * r! - (d / 2) ** 2, 0));
          const ux = -dy / d, uy = dx / d;
          const centers = [[mx + ux * h, my + uy * h], [mx - ux * h, my - uy * h]];
          // sweep=1 は角度が増える向き（画面では時計回り）。その向きになる中心を選ぶ
          const center = centers.find(([cx, cy]) => {
            const a0 = Math.atan2(sy! - cy!, sx! - cx!);
            const a1 = Math.atan2(ey! - cy!, ex! - cx!);
            let da = a1 - a0;
            while (da <= -Math.PI) da += 2 * Math.PI;
            while (da > Math.PI) da -= 2 * Math.PI;
            return sweep === 1 ? da > 0 : da < 0;
          })!;
          assert.ok(Math.hypot(center[0]! - hx!, center[1]! - hy!) < 1.5, `${kind} ${side}: 弧の中心が蝶番でない（凹んだ弧）`);
        }
      }
    }
  });

  /** 戸の付け根（蝶番）と、戸の先。戸は太さ 2 の線で描いている。 */
  function leafOf(svg: string): { hinge: number[]; tip: number[] } {
    const m = svg.match(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#111111" stroke-width="2"\/>/)!;
    const [x1, y1, x2, y2] = m.slice(1).map(Number) as number[];
    return { hinge: [x1!, y1!], tip: [x2!, y2!] };
  }

  it('**外開き（swing: out）は、壁の外へ開く。** 日本の玄関は外開き', () => {
    // BOX の下の辺は y = 220。内開きなら戸の先は上（y < 220）、外開きなら下（y > 220）
    const inside = leafOf(draw(openingsOf([{ kind: 'door', side: 'bottom' }])));
    const outside = leafOf(draw(openingsOf([{ kind: 'door', side: 'bottom', swing: 'out' }])));
    assert.ok(inside.tip[1]! < 220, '内開きの戸が部屋の中へ向いていない');
    assert.ok(outside.tip[1]! > 220, '外開きの戸が部屋の外へ向いていない');
  });

  it('**蝶番の側（hinge: end）を選べる。** 既定は辺の始まり（上・左）の側', () => {
    const start = leafOf(draw(openingsOf([{ kind: 'door', side: 'bottom' }])));
    const end = leafOf(draw(openingsOf([{ kind: 'door', side: 'bottom', hinge: 'end' }])));
    // 幅 36 の穴は x = 182〜218。始まり側の蝶番は 182、終わり側は 218
    assert.equal(start.hinge[0], 182);
    assert.equal(end.hinge[0], 218);
  });

  it('**外開き・蝶番の側を変えても、弧の中心は蝶番**', () => {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      for (const extra of [{ swing: 'out' }, { hinge: 'end' }, { swing: 'out', hinge: 'end' }]) {
        const svg = draw(openingsOf([{ kind: 'door', side, ...extra }]));
        const m = svg.match(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#111111" stroke-width="2"\/><path d="M ([\d.-]+) ([\d.-]+) A ([\d.-]+) [\d.-]+ 0 0 ([01]) ([\d.-]+) ([\d.-]+)"/)!;
        const [hx, hy, , , sx, sy, r, sweep, ex, ey] = m.slice(1).map(Number) as number[];
        // 弧の終わりは、蝶番から戸の幅だけ壁に沿った点
        assert.ok(Math.abs(Math.hypot(ex! - hx!, ey! - hy!) - r!) < 1.5, `${side} ${JSON.stringify(extra)}: 弧の終わりが蝶番から戸の幅にない`);
        assert.ok(Math.abs(Math.hypot(sx! - hx!, sy! - hy!) - r!) < 1.5, `${side} ${JSON.stringify(extra)}: 弧の始まりが戸の先にない`);
        // 凸であること：弦の中点より、弧の中点のほうが蝶番から遠い（外積の向きと sweep が合う）
        const cross = (sx! - hx!) * (ey! - hy!) - (sy! - hy!) * (ex! - hx!);
        assert.equal(sweep, cross > 0 ? 1 : 0, `${side} ${JSON.stringify(extra)}: 弧が凹んでいる`);
      }
    }
  });

  it('両開き戸は、弧が 2 つ', () => {
    assert.equal(draw(one('double')).match(/<path /g)!.length, 2);
  });

  it('**引き戸に弧は無い。** 引き戸は開き勝手を持たない', () => {
    const svg = draw(one('slide'));
    assert.ok(!svg.includes('<path '), '引き戸に開き勝手の弧が出ている');
    assert.equal(svg.match(/<line /g)!.length, 3, '壁消し 1 + 戸 2 になっていない');
  });

  it('窓は、細い 2 本線（弧なし）', () => {
    const svg = draw(one('window'));
    assert.ok(!svg.includes('<path '), '窓に弧が出ている');
    assert.equal(svg.match(/stroke-width="1"/g)!.length, 2, '窓が細い 2 本線になっていない');
  });

  it('4 辺それぞれに付き、その辺の上に乗る', () => {
    const on = {
      top: (a: number[]) => a[1] === BOX.y && a[3] === BOX.y,
      bottom: (a: number[]) => a[1] === BOX.y + BOX.h && a[3] === BOX.y + BOX.h,
      left: (a: number[]) => a[0] === BOX.x && a[2] === BOX.x,
      right: (a: number[]) => a[0] === BOX.x + BOX.w && a[2] === BOX.x + BOX.w,
    };
    for (const [side, sits] of Object.entries(on)) {
      const svg = draw(one('open', side));
      const m = svg.match(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/)!;
      assert.ok(sits(m.slice(1).map(Number)), `${side} の建具が、その辺の上に無い`);
    }
  });

  it('**辺からはみ出さない。** はみ出すと、隣の部屋の壁を消す', () => {
    for (const at of [0, 1]) {
      const svg = drawOpenings(BOX, openingsOf([{ kind: 'open', side: 'top', at, width: 60 }]), INK, PAPER);
      const m = svg.match(/x1="(-?\d+)" y1="(-?\d+)" x2="(-?\d+)" y2="(-?\d+)"/)!;
      const [x1, , x2] = m.slice(1).map(Number);
      assert.ok(x1! >= BOX.x && x2! <= BOX.x + BOX.w, `at=${at} で壁からはみ出した`);
    }
  });

  it('複数の建具が、すべて出る', () => {
    const holes = openingsOf([
      { kind: 'door', side: 'left' },
      { kind: 'window', side: 'top' },
      { kind: 'slide', side: 'bottom' },
    ]);
    const svg = drawOpenings(BOX, holes, INK, PAPER);
    assert.equal(svg.match(new RegExp(`stroke="${PAPER}"`, 'g'))!.length, 3);
  });
});

describe('平面図でも、正本が書いた辺は描く', () => {
  it('**矢印を落とさない。** 売場の補充動線・避難経路は平面図の上に引く', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const source = `version: 1
kind: placement
nodes:
  - id: a
    label: 入口
    at: { x: 0, y: 0 }
    size: { w: 120, h: 80 }
  - id: b
    label: レジ
    at: { x: 200, y: 0 }
    size: { w: 120, h: 80 }
edges:
  - from: a
    to: b
    label: 動線
`;
    const out = render(await layout(source), 'light', 'safe', true);
    assert.ok(out.includes('data-edge='), '平面図で辺が消えた');
    assert.ok(out.includes('>動線<'), '辺のラベルが消えた');
  });

  it('辺を書かなければ、矢印は出ない（間取りはこちら）', async () => {
    const { layout } = await import('../src/layout.ts');
    const { render } = await import('../src/render.ts');
    const out = render(
      await layout('version: 1\nkind: placement\nnodes:\n  - id: a\n    at: { x: 0, y: 0 }\n'),
      'light',
      'safe',
      true,
    );
    assert.ok(!out.includes('data-edge='), '辺が無いのに矢印が出た');
  });
});

describe('開き戸の扇（swingsOf / swingHits）', () => {
  it('**扇に入った箱を拾い、扇の外の箱は拾わない**', async () => {
    const { swingsOf, swingHits } = await import('../src/openings.ts');
    // 下の辺（y = 220）の中央、幅 36（x = 182〜218）。内開きなら扇は上へ
    const [s] = swingsOf(BOX, openingsOf([{ kind: 'door', side: 'bottom' }]));
    assert.ok(swingHits(s!, { x: 186, y: 200, w: 10, h: 10 }), '扇の中の箱を拾っていない');
    assert.ok(!swingHits(s!, { x: 186, y: 230, w: 10, h: 10 }), '壁の外の箱を拾った');
    assert.ok(!swingHits(s!, { x: 260, y: 200, w: 10, h: 10 }), '扇の横の箱を拾った');
    // 外開きなら、扇は壁の外
    const [o] = swingsOf(BOX, openingsOf([{ kind: 'door', side: 'bottom', swing: 'out' }]));
    assert.ok(swingHits(o!, { x: 186, y: 225, w: 10, h: 10 }), '外開きの扇が壁の外に無い');
  });
});


describe('扉の扇を inspect が見る（doorSwings）', () => {
  const plan = (door: string, extra = ''): string =>
    `version: 1\nkind: placement\nnodes:\n` +
    `  - id: wc\n    label: WC\n    at: { x: 0, y: 0 }\n    size: { w: 60, h: 60 }\n    openings:\n      - ${door}\n` +
    `  - id: hall\n    label: ""\n    at: { x: 0, y: 60 }\n    size: { w: 200, h: 100 }\n` + extra;

  it('**部屋の名前が扇に乗っていれば拾う**（戸が名前の下に隠れる）', async () => {
    const { inspect } = await import('../src/tools.ts');
    const seen = await inspect(plan('{ kind: door, side: bottom, at: 0.5, width: 56 }'));
    assert.deepEqual(seen.doorSwings, [['wc', 'wc']]);
  });

  it('**外開きなら、部屋の名前には乗らない。** 開いた先（廊下）そのものは数えない', async () => {
    const { inspect } = await import('../src/tools.ts');
    const seen = await inspect(plan('{ kind: door, side: bottom, at: 0.5, width: 56, swing: out }'));
    assert.deepEqual(seen.doorSwings, []);
  });

  it('**線で描いた設備（閉じた折れ線）も拾う。** 箱だけ見ていると、流し台の上に扉を開けても通る', async () => {
    const { inspect } = await import('../src/tools.ts');
    const sink =
      `  - id: s\n    label: ""\n    marker: none\n    at: { x: 10, y: 70 }\n    size: { w: 2, h: 2 }\n` +
      `edges:\n  - from: s\n    to: s\n    close: true\n    curve: none\n    via:\n` +
      `      - { x: 10, y: 70 }\n      - { x: 40, y: 70 }\n      - { x: 40, y: 85 }\n      - { x: 10, y: 85 }\n`;
    const seen = await inspect(plan('{ kind: door, side: bottom, at: 0.5, width: 56, swing: out }', sink));
    assert.ok(seen.doorSwings.some(([door]) => door === 'wc'), '外開きの扇にある流し台を拾っていない');
  });
});

describe('辺が、関係の無い箱を突き抜けている（edgesThroughBoxes）', () => {
  const plan = (via = ''): string =>
    `version: 1\nkind: placement\narrows: true\nnodes:\n` +
    `  - { id: a, label: A, at: { x: 0, y: 0 }, size: { w: 60, h: 40 } }\n` +
    `  - { id: b, label: B, at: { x: 300, y: 0 }, size: { w: 60, h: 40 } }\n` +
    `  - { id: m, label: M, at: { x: 150, y: 0 }, size: { w: 60, h: 40 } }\n` +
    `edges:\n  - from: a\n    to: b\n` + via;

  it('**両端でない箱の上を通れば拾う**（A → B の線が M を突き抜ける）', async () => {
    const { inspect } = await import('../src/tools.ts');
    const seen = await inspect(plan());
    assert.deepEqual(seen.edgesThroughBoxes, [['a>b', 'm']]);
  });

  it('**折れ点を中に置いた箱は、わざと通しているので数えない**（路線図の停車駅）', async () => {
    const { inspect } = await import('../src/tools.ts');
    const seen = await inspect(plan('    via:\n      - { x: 180, y: 20 }\n'));
    assert.deepEqual(seen.edgesThroughBoxes, []);
  });
});

describe('建具は、すべての壁の後に描く', () => {
  it('**後から描く小さい箱の壁が、先の部屋の扉を消さない**', async () => {
    const { render } = await import('../src/render.ts');
    const { layout } = await import('../src/layout.ts');
    // 大きい部屋の右の壁に扉。右隣に小さい収納（後から描かれる）
    const text =
      `version: 1\nkind: placement\nnodes:\n` +
      `  - id: room\n    label: 洋室\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 160 }\n    openings:\n      - { kind: door, side: right, at: 0.5, width: 40 }\n` +
      `  - id: cl\n    label: CL\n    at: { x: 200, y: 40 }\n    size: { w: 60, h: 80 }\n`;
    const svg = render(await layout(text), 'light', 'safe', true);
    const door = svg.indexOf('data-holes="room"');
    const closet = svg.indexOf('data-node="cl"');
    assert.ok(door > 0 && closet > 0, '扉か収納が描かれていない');
    assert.ok(door > closet, '扉が収納の壁より先に描かれている（収納の壁が扉を消す）');
  });
});
