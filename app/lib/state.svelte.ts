/**
 * 画面の状態。**中核（`src/`）を呼ぶ向きだけにする**（D12 / ベースルール §9）。
 *
 * ここに置くのは「いま何を見ているか」だけで、
 * **判断は中核が持つ**（マージ・競合・検証・計測）。
 *
 * 操作は 8 つに限ってある（D11）。**増やす前に `docs/specs/005-承認のための最小GUI.md` を読む。**
 */
import { diffLines, condense, hasChange } from '../../src/diff.ts';
import type { DiffLine } from '../../src/diff.ts';
import { getPins, parse, serialize, setPin } from '../../src/format.ts';
import { layout } from '../../src/layout.ts';
import type { Placed } from '../../src/layout.ts';
import { measure } from '../../src/measure.ts';
import type { Measurement } from '../../src/measure.ts';
import { merge, resolve } from '../../src/merge.ts';
import type { Conflict } from '../../src/merge.ts';
import { hasError, validate } from '../../src/validate.ts';
import type { Finding } from '../../src/validate.ts';

export class Session {
  /** 正本。**書き換わるのは常にこちら**（D5）。 */
  text = $state('');
  /** 開いているファイルの名前。保存先が分からないときは null。 */
  name = $state<string | null>(null);
  /** 保存していない変更があるか。 */
  dirty = $state(false);

  placed = $state<Placed | null>(null);
  findings = $state<Finding[]>([]);
  conflicts = $state<Conflict[]>([]);
  selected = $state<string | null>(null);

  /**
   * 提案を当てた結果。**まだ正本に入れていない。**
   * 適用してから見せるのでは、承認ではなく事後報告になる（D11 の操作 6）。
   */
  pending = $state<{ text: string; conflicts: Conflict[] } | null>(null);

  zoom = $state(1);
  panX = $state(0);
  panY = $state(0);

  /**
   * 戻る／進むのための控え。**正本のテキストをそのまま積む。**
   *
   * D11 では「Undo は作らない。正本が Git にあるので二重管理になる」と決めていた。
   * **自動保存を入れると判断が変わる** — 保存しないという逃げ道が消えるので、
   * 取り消しが要る（D19）。
   *
   * 二重管理にならないのは、**積むのが正本そのもの**だから。
   * 作図操作の履歴ではないので、正本と食い違いようがない。
   * 持続もしない（開き直せば消える）。**残る記録は Git のほう。**
   */
  #past: string[] = [];
  #future: string[] = [];

  /** 控えの上限。**無限に持たない。** 古いものは落とす。 */
  static readonly HISTORY = 100;

  get canUndo(): boolean {
    return this.#past.length > 0;
  }

  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  /** 戻る／進むが押せるかを画面へ出すための印。 */
  historyVersion = $state(0);

  /** これから正本を変える、という記録。**変える直前に呼ぶ。** */
  #remember(): void {
    this.#past.push(this.text);
    if (this.#past.length > Session.HISTORY) this.#past.shift();
    // 新しく変えたら、進む先は消える（分岐を作らない）。
    this.#future = [];
    this.historyVersion += 1;
  }

  /** 検証で読めないと出たか。 */
  get broken(): boolean {
    return hasError(this.findings);
  }

  /** 「9 割」の数字（D3）。読めない図では出さない。 */
  get measurement(): Measurement | null {
    if (this.text === '' || this.broken) return null;
    try {
      return measure(this.text);
    } catch {
      return null;
    }
  }

  /** 適用前の差分。変わっていなければ空。 */
  get diff(): DiffLine[] {
    if (this.pending === null) return [];
    const lines = diffLines(this.text, this.pending.text);
    return hasChange(lines) ? condense(lines) : [];
  }

  async load(text: string, name: string | null): Promise<void> {
    // 別の図を開いたら、控えは持ち越さない。**別の図の履歴は別。**
    this.#past = [];
    this.#future = [];
    this.historyVersion += 1;
    this.text = text;
    this.name = name;
    this.dirty = false;
    this.pending = null;
    this.conflicts = [];
    this.selected = null;
    await this.refresh();
  }

  /** 正本から、描くものと指摘を作り直す。 */
  async refresh(): Promise<void> {
    this.findings = this.text === '' ? [] : validate(this.text);
    if (this.text === '' || this.broken) {
      this.placed = null;
      return;
    }
    this.placed = await layout(this.text);
  }

  /**
   * 人が要素を動かした（D11 の操作 4）。
   *
   * **これが人の手直しの最小形。** 結果は `pins.position` に入り、
   * 次の提案でも壊れない（D5）。
   */
  async place(id: string, x: number, y: number): Promise<void> {
    this.#remember();
    const doc = parse(this.text);
    const pin = getPins(doc)[id] ?? {};
    setPin(doc, id, { ...pin, position: { x: Math.round(x), y: Math.round(y) } });
    this.text = serialize(doc);
    this.dirty = true;
    await this.refresh();
  }

  /**
   * 提案を受け取る（D11 の操作 5）。**当てた結果を作るだけで、正本は変えない。**
   *
   * v0 では AI の API を呼ばない。**鍵の投入は人の作業**（ベースルール §14）。
   */
  propose(proposalText: string): void {
    this.pending = merge(this.text, proposalText);
  }

  /** 差分を見たうえで、人が入れると決めた。 */
  async applyPending(): Promise<void> {
    if (this.pending === null) return;
    this.#remember();
    this.text = this.pending.text;
    this.conflicts = this.pending.conflicts;
    this.pending = null;
    this.dirty = true;
    await this.refresh();
  }

  discardPending(): void {
    this.pending = null;
  }

  /**
   * 競合を決着させる（D11 の操作 7）。
   *
   * **決めた結果は正本へ書く。** 実行中の変数に持つと、
   * 次に開いたときに同じことを聞き直す（S1 の判定基準 3.3）。
   */
  async decide(conflict: Conflict, choice: 'human' | 'ai'): Promise<void> {
    this.#remember();
    this.text = resolve(this.text, conflict, choice);
    this.conflicts = this.conflicts.filter((item) => item !== conflict);
    this.dirty = true;
    await this.refresh();
  }

  /**
   * 1 つ戻る。**正本を 1 つ前のテキストへ差し替えるだけ。**
   *
   * 競合の一覧は作り直さない（戻した先の正本に対する競合は、
   * その時点で分かっているものと違うため）。**分からないものを作らない。**
   */
  async undo(): Promise<void> {
    const previous = this.#past.pop();
    if (previous === undefined) return;
    this.#future.push(this.text);
    this.text = previous;
    this.dirty = true;
    this.historyVersion += 1;
    await this.refresh();
  }

  /** 1 つ進む。 */
  async redo(): Promise<void> {
    const next = this.#future.pop();
    if (next === undefined) return;
    this.#past.push(this.text);
    this.text = next;
    this.dirty = true;
    this.historyVersion += 1;
    await this.refresh();
  }

  /** 選ぶ（D11 の操作 3）。同じものを押したら外す。 */
  select(id: string | null): void {
    this.selected = this.selected === id ? null : id;
  }

  /** 見る（D11 の操作 2）。**編集ではなく閲覧。** */
  zoomBy(factor: number): void {
    this.zoom = Math.min(4, Math.max(0.2, this.zoom * factor));
  }

  panBy(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }
}
