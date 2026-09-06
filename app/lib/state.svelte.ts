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
    this.text = resolve(this.text, conflict, choice);
    this.conflicts = this.conflicts.filter((item) => item !== conflict);
    this.dirty = true;
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
