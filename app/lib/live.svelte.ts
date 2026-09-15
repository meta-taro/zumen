/**
 * 画面側の線（D34）。**エージェントと繋がる。**
 *
 * ## これが要る理由
 *
 * これまで、エージェントが図を直すと**ファイルだけが変わり**、
 * 開いている画面は古い図を映したままだった。人は開き直すしかない。
 * それでは「あー、そうじゃなくてこう」という往復ができない。
 *
 * ## 承認の線は動かさない（D5 / D11 / D18）
 *
 * 降りてくるのは**提案**であって、正本ではない。
 * `session.propose()` に渡すので、画面には**差分が出るだけ**。
 * 「正本へ入れる」を押すのは人。**線の向こうに、押す口は無い。**
 *
 * ## 繋がっていないことを黙らない
 *
 * 線が切れていることに気づかないまま話しかけられると、
 * **人はエージェントが無視していると思う。** 状態は必ず画面に出す。
 */
import { LIVE_HOST, LIVE_PORT } from '../../src/live/protocol.ts';
import type { Session } from './state.svelte.ts';

const BASE = `http://${LIVE_HOST}:${LIVE_PORT}`;

/** 切れたときに繋ぎ直す間隔。**詰めすぎない** —— 立っていないだけのことが多い。 */
const RETRY_MS = 3000;

export type Link = 'off' | 'connecting' | 'on';

export class Live {
  /** 線の状態。**画面に出す。** */
  state = $state<Link>('off');
  /** エージェントが添えた一言。 */
  note = $state<string | null>(null);
  /** いま画面に出ている提案の id。**人が答えるときに返す。** */
  offerId = $state<string | null>(null);

  #session: Session;
  #source: EventSource | null = null;
  #id: string | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;
  /** 最後に伝えた内容。**同じものを送り返さない**（送ると、また送りたくなる）。 */
  #last = '';

  constructor(session: Session) {
    this.#session = session;
  }

  /** 繋ぎにいく。**立っていなくても、諦めずに待つ。** */
  start(): void {
    this.#stopped = false;
    this.#connect();
  }

  stop(): void {
    this.#stopped = true;
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#source?.close();
    this.#source = null;
    this.#id = null;
    this.state = 'off';
  }

  #connect(): void {
    if (this.#stopped) return;
    this.state = 'connecting';
    const source = new EventSource(`${BASE}/live/events`);
    this.#source = source;

    source.addEventListener('id', (event) => {
      this.#id = JSON.parse((event as MessageEvent<string>).data).id as string;
      this.state = 'on';
      // 繋がった直後に、いま映しているものを伝える。**向こうは何も知らない。**
      this.#last = '';
      void this.tell();
    });

    source.addEventListener('offer', (event) => {
      const body = JSON.parse((event as MessageEvent<string>).data) as {
        id: string;
        source: string;
        note: string | null;
      };
      this.offerId = body.id;
      this.note = body.note;
      // **正本には入れない。** 当てた結果を作って、差分として見せるだけ。
      this.#session.propose(body.source);
    });

    source.addEventListener('point', (event) => {
      const body = JSON.parse((event as MessageEvent<string>).data) as {
        ids: string[];
        note: string | null;
      };
      this.note = body.note;
      // **選ぶだけ。** 図は何も変わらない。
      this.#session.selected = body.ids[0] ?? null;
    });

    source.addEventListener('withdraw', () => {
      this.offerId = null;
      this.note = null;
      this.#session.discardPending();
    });

    source.addEventListener('error', () => {
      // EventSource は自分でも繋ぎ直すが、**状態を画面に出したい**ので自分で持つ。
      source.close();
      this.#source = null;
      this.#id = null;
      this.state = 'off';
      if (this.#stopped) return;
      this.#timer = setTimeout(() => this.#connect(), RETRY_MS);
    });
  }

  /**
   * いま映しているものを伝える。
   *
   * **保存前の手直しごと渡す。** ディスクを読ませると、人がさっき動かした分が
   * 見えず、エージェントはそれを壊す提案を書く。
   */
  async tell(): Promise<void> {
    if (this.#id === null) return;
    const session = this.#session;
    const screen = {
      path: session.path,
      name: session.name,
      source: session.text,
      selected: session.selected,
      dirty: session.dirty,
      conflicts: session.conflicts.length,
      reviewed: session.review.reviewed,
    };
    const body = JSON.stringify({ from: this.#id, kind: 'showing', screen });
    if (body === this.#last) return;
    this.#last = body;
    await this.#post(body);
  }

  /**
   * 人が答えた。**この道を通れるのは、画面で押した人だけ。**
   *
   * ここを `applied` で呼ぶのは `App.svelte` の「正本へ入れる」だけにする。
   */
  async answered(choice: 'applied' | 'discarded'): Promise<void> {
    const id = this.offerId;
    this.offerId = null;
    this.note = null;
    if (id === null || this.#id === null) return;
    await this.#post(JSON.stringify({ from: this.#id, kind: 'decided', id, choice }));
  }

  async #post(body: string): Promise<void> {
    try {
      await fetch(`${BASE}/live/say`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });
    } catch {
      // 送れないのは、線が切れたとき。**`error` が来て繋ぎ直す**ので、ここでは何もしない。
    }
  }
}
