/**
 * **線が繋がっても、承認の線は動かないこと**（D34 / `src/live/hub.ts`）。
 *
 * ## ここでいちばん見たいもの
 *
 * `applied` が返るのは、**人が画面で押したときだけ**。
 * エージェント側から `applied` を立てる道が無いことを、形で確かめる。
 *
 * D18 が閉じたのと同じ穴 —— 開けた瞬間、AI が自分の提案を自分で承認できる。
 * **線を引いたときが、いちばんその穴が開きやすい。**
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hub } from '../src/live/hub.ts';
import { EMPTY_SCREEN } from '../src/live/protocol.ts';
import type { Screen, ToScreen } from '../src/live/protocol.ts';

const WORDS = {
  noScreen: '画面が繋がっていません',
  nothingOpen: '図を開いていません',
  otherDiagram: (asked: string, showing: string | null) => `別の図（${showing} / ${asked}）`,
};

const showing = (over: Partial<Screen> = {}): Screen => ({
  ...EMPTY_SCREEN,
  path: '/w/a.zumen.yaml',
  name: 'a.zumen.yaml',
  source: 'version: 1\nnodes: []\n',
  ...over,
});

/** 画面 1 つを繋いで、受け取ったものを溜める。 */
function screen(hub: Hub, id: string, at: Partial<Screen> = {}): ToScreen[] {
  const got: ToScreen[] = [];
  hub.join(id, (message) => got.push(message));
  hub.report(id, showing(at));
  return got;
}

describe('繋がっているか', () => {
  it('誰も居なければ 0 件で、画面は null', () => {
    const hub = new Hub(WORDS);
    assert.deepEqual(hub.status, { screens: 0, screen: null, waiting: [] });
  });

  it('繋いだ画面には、まず hello が行く', () => {
    const hub = new Hub(WORDS);
    const got = screen(hub, 'a');
    assert.equal(got[0]?.kind, 'hello');
  });

  it('消えたら 0 件へ戻る', () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    hub.leave('a');
    assert.equal(hub.status.screens, 0);
  });
});

describe('画面を読む', () => {
  it('**保存前の手直しが読める**（ディスクではなく画面）', () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a', { source: 'pins:\n  db:\n    position: { x: 10, y: 20 }\n', dirty: true });
    const got = hub.source();
    assert.equal(got.ok, true);
    assert.match(got.ok ? got.source : '', /position/);
  });

  it('繋がっていなければ、空文字ではなく理由を返す', () => {
    const hub = new Hub(WORDS);
    const got = hub.source();
    assert.equal(got.ok, false);
    assert.equal(got.ok === false && got.reason, WORDS.noScreen);
  });

  it('繋がっているが何も開いていない、は別の理由', () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a', { source: '', path: null });
    const got = hub.source();
    assert.equal(got.ok === false && got.reason, WORDS.nothingOpen);
  });
});

describe('提案を出す', () => {
  it('画面へ降りる', () => {
    const hub = new Hub(WORDS);
    const got = screen(hub, 'a');
    const put = hub.offer('version: 1\n', { note: '幅を揃えました' });
    assert.equal(put.ok, true);
    const last = got.at(-1);
    assert.equal(last?.kind, 'offer');
    assert.equal(last?.kind === 'offer' && last.note, '幅を揃えました');
  });

  it('**道を指定したら、その図を開いている画面にだけ出す**', () => {
    const hub = new Hub(WORDS);
    const a = screen(hub, 'a', { path: '/w/a.zumen.yaml' });
    const b = screen(hub, 'b', { path: '/w/b.zumen.yaml' });
    hub.offer('version: 1\n', { path: '/w/a.zumen.yaml' });
    assert.equal(a.at(-1)?.kind, 'offer');
    assert.equal(b.at(-1)?.kind, 'hello'); // b には降りていない
  });

  it('その図を誰も開いていなければ、黙って別の画面へ出さない', () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a', { path: '/w/a.zumen.yaml' });
    const put = hub.offer('version: 1\n', { path: '/w/b.zumen.yaml' });
    assert.equal(put.ok, false);
    assert.match(put.ok === false ? put.reason : '', /別の図/);
  });

  it('繋がっていなければ断る', () => {
    const hub = new Hub(WORDS);
    assert.equal(hub.offer('version: 1\n').ok, false);
  });

  it('待っている提案は status に出る', () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    assert.deepEqual(hub.status.waiting, [put.ok ? put.id : '']);
  });
});

describe('**人だけが答えを出せる**', () => {
  it('人が入れたときだけ applied', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    const id = put.ok ? put.id : '';
    const waiting = hub.decision(id, 1000);
    hub.decided('a', id, 'applied');
    assert.equal(await waiting, 'applied');
  });

  it('人がやめたら discarded', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    const id = put.ok ? put.id : '';
    const waiting = hub.decision(id, 1000);
    hub.decided('a', id, 'discarded');
    assert.equal(await waiting, 'discarded');
  });

  it('**答えが無いのは timeout であって、断られたではない**', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    assert.equal(await hub.decision(put.ok ? put.id : '', 10), 'timeout');
  });

  it('待つのをやめても、提案は画面に残る（人はまだ見ていない）', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    const id = put.ok ? put.id : '';
    await hub.decision(id, 10);
    assert.deepEqual(hub.status.waiting, [id]);
  });

  it('画面が消えたら gone。**待たせ続けない**', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    const waiting = hub.decision(put.ok ? put.id : '', 1000);
    hub.leave('a');
    assert.equal(await waiting, 'gone');
  });

  it('**別の画面が代わりに答えることはできない**', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a', { path: '/w/a.zumen.yaml' });
    screen(hub, 'b', { path: '/w/a.zumen.yaml' });
    const put = hub.offer('version: 1\n', { path: '/w/a.zumen.yaml' });
    const id = put.ok ? put.id : '';
    const waiting = hub.decision(id, 60);
    hub.decided('b', id, 'applied'); // 出した先は a
    assert.equal(await waiting, 'timeout');
  });

  it('知らない id の答えは捨てる（落ちない）', () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    assert.doesNotThrow(() => hub.decided('a', 'offer-999', 'applied'));
  });

  it('引っ込めた提案は待ちが gone になる', async () => {
    const hub = new Hub(WORDS);
    screen(hub, 'a');
    const put = hub.offer('version: 1\n');
    const id = put.ok ? put.id : '';
    const waiting = hub.decision(id, 1000);
    assert.equal(hub.withdraw(id), true);
    assert.equal(await waiting, 'gone');
    assert.deepEqual(hub.status.waiting, []);
  });
});

describe('指す', () => {
  it('選ぶだけで、提案は出さない', () => {
    const hub = new Hub(WORDS);
    const got = screen(hub, 'a');
    hub.point(['db'], 'これのことです');
    const last = got.at(-1);
    assert.equal(last?.kind, 'point');
    assert.deepEqual(last?.kind === 'point' ? last.ids : [], ['db']);
    assert.deepEqual(hub.status.waiting, []); // 待ちを作らない
  });

  it('繋がっていなければ断る', () => {
    const hub = new Hub(WORDS);
    assert.equal(hub.point(['db']).ok, false);
  });
});

describe('**承認する口が無いこと**', () => {
  it('Hub には、提案を採用する呼び出しが 1 つも無い', () => {
    const names = Object.getOwnPropertyNames(Hub.prototype);
    for (const banned of ['apply', 'accept', 'approve', 'resolve', 'write']) {
      assert.equal(names.includes(banned), false, `Hub.${banned} を生やさない`);
    }
  });
});
