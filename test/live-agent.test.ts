/**
 * **エージェント専用カーソル**の指示（`src/live/agent.ts`）と、線（`Hub.agent`）。
 *
 * 画面の中の動き（指す・押す・人だけが押すボタンを押さない）は `pnpm gui:check` が Chrome で見る。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BUBBLE_INSET, bubblePlacement, parseAgentAction, showMs } from '../src/live/agent.ts';
import { Hub } from '../src/live/hub.ts';
import type { ToScreen } from '../src/live/protocol.ts';

const WORDS = { noScreen: '画面を開いてから', nothingOpen: '何も開いていない', otherDiagram: () => '別の図' };

describe('screen の指示の形', () => {
  it('**6 つの動きだけを通す**（point / click / type / go / say / filter）', () => {
    for (const action of ['point', 'click', 'filter']) assert.equal(parseAgentAction({ action, target: '保存' }).ok, true);
    assert.equal(parseAgentAction({ action: 'type', target: '検索', text: 'web01' }).ok, true);
    assert.equal(parseAgentAction({ action: 'go', target: '#top' }).ok, true);
    assert.equal(parseAgentAction({ action: 'say', message: 'ここを見てください' }).ok, true);
    assert.deepEqual(parseAgentAction({ action: 'drag', target: 'a' }), { ok: false, reason: 'action-unknown' });
    assert.deepEqual(parseAgentAction('point'), { ok: false, reason: 'not-object' });
  });

  it('**座標ではなく画面の言葉で指す。** 指す相手の無い point / click は断る', () => {
    assert.deepEqual(parseAgentAction({ action: 'click' }), { ok: false, reason: 'target-missing' });
    assert.deepEqual(parseAgentAction({ action: 'point', target: '  ' }), { ok: false, reason: 'target-missing' });
  });

  it('**go は画面の中（# で始まる所）だけ。** 外のページへは移らない', () => {
    assert.deepEqual(parseAgentAction({ action: 'go', target: 'https://example.com/' }), { ok: false, reason: 'go-not-hash' });
  });

  it('打つ文字・一言・秒数の範囲を守る', () => {
    assert.deepEqual(parseAgentAction({ action: 'type', target: '欄' }), { ok: false, reason: 'text-missing' });
    assert.deepEqual(parseAgentAction({ action: 'say' }), { ok: false, reason: 'message-missing' });
    assert.deepEqual(parseAgentAction({ action: 'say', message: 'あ'.repeat(501) }), { ok: false, reason: 'message-too-long' });
    assert.deepEqual(parseAgentAction({ action: 'say', message: 'a', seconds: 61 }), { ok: false, reason: 'seconds-out-of-range' });
    assert.equal(parseAgentAction({ action: 'say', message: 'あ'.repeat(500), seconds: 60 }).ok, true);
  });
});

describe('吹き出し', () => {
  it('**出しておく時間は 5 秒＋1 文字 0.1 秒、上限 20 秒。** 秒数を書けばそれ', () => {
    assert.equal(showMs('あいう'), 5300);
    assert.equal(showMs('あ'.repeat(400)), 20000);
    assert.equal(showMs('長い文'.repeat(100), 3), 3000);
  });

  it('**上 → 下 → 右 → 左の順で、窓に収まる向きに置く**', () => {
    const view = { w: 1000, h: 800 };
    const bubble = { w: 200, h: 60 };
    assert.equal(bubblePlacement({ x: 400, y: 400, w: 80, h: 30 }, bubble, view).side, 'top');
    assert.equal(bubblePlacement({ x: 400, y: 10, w: 80, h: 30 }, bubble, view).side, 'bottom');
  });

  it('**窓の四隅・四辺のどこを指しても、吹き出しは窓の内側 8px に収まり、しっぽは指した所を向く**', () => {
    const view = { w: 800, h: 600 };
    const bubble = { w: 280, h: 90 };
    const spots = [
      { x: 0, y: 0 }, { x: 770, y: 0 }, { x: 0, y: 575 }, { x: 770, y: 575 },
      { x: 390, y: 0 }, { x: 390, y: 575 }, { x: 0, y: 290 }, { x: 770, y: 290 },
    ];
    for (const spot of spots) {
      const target = { ...spot, w: 30, h: 25 };
      const at = bubblePlacement(target, bubble, view);
      assert.ok(at.x >= BUBBLE_INSET && at.x + bubble.w <= view.w - BUBBLE_INSET, `横に収まらない ${JSON.stringify(spot)}`);
      assert.ok(at.y >= BUBBLE_INSET && at.y + bubble.h <= view.h - BUBBLE_INSET, `縦に収まらない ${JSON.stringify(spot)}`);
      // しっぽの先は吹き出しの縁の上で、指した所の真ん中にいちばん近い点
      const cx = target.x + target.w / 2;
      const cy = target.y + target.h / 2;
      const near = Math.hypot(at.tail.x - cx, at.tail.y - cy);
      const corners = [[at.x, at.y], [at.x + bubble.w, at.y], [at.x, at.y + bubble.h], [at.x + bubble.w, at.y + bubble.h]];
      assert.ok(corners.every(([x, y]) => Math.hypot(x! - cx, y! - cy) >= near - 0.001), `しっぽが向いていない ${JSON.stringify(spot)}`);
    }
  });
});

describe('線（Hub.agent）', () => {
  it('**画面が無ければ「画面を開いてから」と断る**', () => {
    const hub = new Hub(WORDS);
    assert.deepEqual(hub.agent({ action: 'say', target: null, text: null, message: 'やあ', seconds: null }), { ok: false, reason: '画面を開いてから' });
  });

  it('繋がっている画面すべてへ、agent として降りる', () => {
    const hub = new Hub(WORDS);
    const got: ToScreen[] = [];
    hub.join('s1', (m) => got.push(m));
    const action = { action: 'point' as const, target: '保存', text: null, message: 'ここです', seconds: null };
    assert.deepEqual(hub.agent(action), { ok: true, screens: 1 });
    assert.deepEqual(got.at(-1), { kind: 'agent', action });
  });

  it('**別の席が線を持っていれば、すぐ断る**', () => {
    const hub = new Hub({ ...WORDS, elsewhere: '別の席が線を持っています' });
    hub.held(false);
    assert.deepEqual(hub.agent({ action: 'say', target: null, text: null, message: 'a', seconds: null }), { ok: false, reason: '別の席が線を持っています' });
  });
});

describe('MCP の zumen_screen', () => {
  it('**画面が無ければ理由を返す**（黙って成功にしない）', async () => {
    const { screen } = await import('../src/mcp.ts');
    const { createHub } = await import('../src/live/server.ts');
    const out = screen(createHub(), { action: 'point', target: '保存' });
    assert.equal(out.ok, false);
    assert.ok((out as { reason: string }).reason.length > 0);
  });

  it('形のおかしい指示と、zumen の画面に無い filter は、理由つきで断る', async () => {
    const { screen } = await import('../src/mcp.ts');
    const hub = new Hub(WORDS);
    hub.join('s1', () => {});
    assert.equal(screen(hub, { action: 'go', target: 'https://example.com' }).ok, false);
    assert.equal(screen(hub, { action: 'filter', target: '見本' }).ok, false);
    assert.equal(screen(hub, { action: 'click', target: 'キャッシュ' }).ok, true);
  });
});
