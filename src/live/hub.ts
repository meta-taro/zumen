/**
 * 線の真ん中（D34）。**誰が何をしてよいかは、ここだけが知っている。**
 *
 * ソケットも HTTP も知らない。**立てずにテストできる**（ベースルール §9）。
 *
 * ## 開けているもの / 開けていないもの
 *
 * | | |
 * |---|---|
 * | ○ 画面がいま映しているものを読む | 保存前の手直しも読める |
 * | ○ 提案を**画面へ出す** | 正本には入らない。人が押すまで待つ |
 * | ○ 「この箱のことです」と指す | 選ぶだけ |
 * | ○ 人が出した答えを**知る** | 知るだけ。**代わりに答える口は無い** |
 * | ✗ 正本を書く | 線の向こうに書く口を作らない |
 * | ✗ 提案を自分で採用する | 開けた瞬間、**AI が自分の提案を自分で承認できる**（D11 / D13 / D18） |
 *
 * `applied` が返るのは、**人が画面の「正本へ入れる」を押したとき**だけ。
 * ここには、その値を自分で立てる道が無い。
 */
import { EMPTY_SCREEN } from './protocol.ts';
import type { Decision, Screen, ToScreen } from './protocol.ts';

/** 画面 1 つ分。 */
interface Client {
  id: string;
  send: (message: ToScreen) => void;
  screen: Screen;
}

/** 出したまま、人の答えを待っている提案。 */
interface Offer {
  id: string;
  path: string | null;
  source: string;
  note: string | null;
  /** 出した先の画面。**居なくなったら `gone`。** */
  to: string;
  settle: (decision: Decision) => void;
  decided: Promise<Decision>;
}

export interface Status {
  /** 繋がっている画面の数。**0 なら、線の向こうに誰も居ない。** */
  screens: number;
  /** いま映っているもの。繋がっていなければ null。 */
  screen: Screen | null;
  /** 人の答えを待っている提案の id。 */
  waiting: string[];
}

export type Offered =
  | { ok: true; id: string; screens: number }
  | { ok: false; reason: string };

export class Hub {
  readonly #clients = new Map<string, Client>();
  readonly #offers = new Map<string, Offer>();
  #serial = 0;

  /** 断り文句は呼ぶ側から渡す（D9。文字列を散らかさない）。 */
  readonly #words: HubWords;

  constructor(words: HubWords) {
    this.#words = words;
  }

  /** 画面が繋がった。 */
  join(id: string, send: (message: ToScreen) => void): void {
    this.#clients.set(id, { id, send, screen: EMPTY_SCREEN });
    send({ kind: 'hello', server: id });
  }

  /**
   * 画面が消えた。**待っている提案には `gone` を返す。**
   *
   * 黙って待たせ続けない —— エージェントが「人が考えている」と思ったまま止まる。
   */
  leave(id: string): void {
    this.#clients.delete(id);
    for (const offer of [...this.#offers.values()]) {
      if (offer.to !== id) continue;
      this.#offers.delete(offer.id);
      offer.settle('gone');
    }
  }

  /** 画面が「いまこれを映しています」と言ってきた。 */
  report(id: string, screen: Screen): void {
    const client = this.#clients.get(id);
    if (client === undefined) return;
    client.screen = screen;
  }

  /**
   * 人が答えを出した。**この口を通れるのは画面だけ。**
   *
   * 知らない id は黙って捨てる（引っ込めたあとに答えが届くことがある）。
   */
  decided(id: string, offerId: string, choice: 'applied' | 'discarded'): void {
    const offer = this.#offers.get(offerId);
    if (offer === undefined || offer.to !== id) return;
    this.#offers.delete(offerId);
    offer.settle(choice);
  }

  get status(): Status {
    const client = this.#newest();
    return {
      screens: this.#clients.size,
      screen: client?.screen ?? null,
      waiting: [...this.#offers.keys()],
    };
  }

  /**
   * 画面がいま持っている正本。**ディスクではなく画面を読む。**
   *
   * 人が動かしたばかりで、まだ保存していない手直しがここに入っている。
   * ディスクを読むと、**人がさっきやったことが見えない。**
   */
  source(): { ok: true; source: string; path: string | null; name: string | null } | { ok: false; reason: string } {
    const client = this.#newest();
    if (client === undefined) return { ok: false, reason: this.#words.noScreen };
    if (client.screen.source === '') return { ok: false, reason: this.#words.nothingOpen };
    return {
      ok: true,
      source: client.screen.source,
      path: client.screen.path,
      name: client.screen.name,
    };
  }

  /**
   * 提案を画面へ出す。**正本は変えない。**
   *
   * 道を指定したときは、**その図を開いている画面にだけ**出す。
   * 別の図を開いている画面へ黙って出すと、人は何の話か分からない。
   */
  offer(source: string, options: { path?: string; note?: string } = {}): Offered {
    const targets = [...this.#clients.values()].filter((client) =>
      options.path === undefined ? client.screen.source !== '' : client.screen.path === options.path,
    );
    if (targets.length === 0) {
      const reason =
        this.#clients.size === 0
          ? this.#words.noScreen
          : options.path === undefined
            ? this.#words.nothingOpen
            : this.#words.otherDiagram(options.path, this.#newest()?.screen.path ?? null);
      return { ok: false, reason };
    }

    this.#serial += 1;
    const id = `offer-${this.#serial}`;
    // **待つ側が居なくても、待てる形で持っておく。** 後から待ちに来ることがある。
    let settle: (decision: Decision) => void = () => {};
    const decided = new Promise<Decision>((done) => {
      settle = done;
    });
    const to = targets[0]!.id;
    this.#offers.set(id, {
      id,
      path: options.path ?? null,
      source,
      note: options.note ?? null,
      to,
      settle,
      decided,
    });

    for (const client of targets) {
      client.send({ kind: 'offer', id, path: options.path ?? null, source, note: options.note ?? null });
    }
    return { ok: true, id, screens: targets.length };
  }

  /**
   * 人の答えを待つ。**待つだけで、催促はしない。**
   *
   * `timeout` は「まだ見ていない」であって「断られた」ではない。
   * **答えが無いことを、答えの代わりにしない。**
   */
  async decision(id: string, ms: number): Promise<Decision> {
    const offer = this.#offers.get(id);
    if (offer === undefined) return 'gone';
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<Decision>((done) => {
      timer = setTimeout(() => done('timeout'), ms);
    });
    try {
      return await Promise.race([offer.decided, late]);
    } finally {
      // **待つのをやめても、提案は画面に残す。** 人はまだ見ていないかもしれない。
      clearTimeout(timer);
    }
  }

  /** 出した提案を引っ込める（言い直した）。 */
  withdraw(id: string): boolean {
    const offer = this.#offers.get(id);
    if (offer === undefined) return false;
    this.#offers.delete(id);
    this.#clients.get(offer.to)?.send({ kind: 'withdraw', id });
    offer.settle('gone');
    return true;
  }

  /** 「この箱のことです」と指す。**選ぶだけで、何も変えない。** */
  point(ids: string[], note?: string): { ok: true; screens: number } | { ok: false; reason: string } {
    const targets = [...this.#clients.values()];
    if (targets.length === 0) return { ok: false, reason: this.#words.noScreen };
    for (const client of targets) client.send({ kind: 'point', ids, note: note ?? null });
    return { ok: true, screens: targets.length };
  }

  /** いちばん後に繋がった画面。**2 つ以上あるときは、新しいほうを見る。** */
  #newest(): Client | undefined {
    let last: Client | undefined;
    for (const client of this.#clients.values()) last = client;
    return last;
  }
}

/** 断り文句（D9）。 */
export interface HubWords {
  noScreen: string;
  nothingOpen: string;
  otherDiagram: (asked: string, showing: string | null) => string;
}
