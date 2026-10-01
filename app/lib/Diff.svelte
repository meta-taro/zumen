<!--
  適用前の差分（D11 の操作 6）。

  **図の上に重ねない**（`DESIGN.md` §2.5）。
  重ねると変わった部分の境目が読めないうえ、
  正本が `git diff` で読める形（D2）と見え方が食い違う。
-->
<script lang="ts">
  import { messages } from '../../src/messages.ts';
import type { Session } from './state.svelte.ts';

  interface Props {
    session: Session;
    /** エージェントが添えた一言（D34）。人の提案には無い。 */
    note?: string | null;
    /**
     * 人が答えたことを、線の向こうへ返す（D34）。
     *
     * **ここを通らない限り、エージェントは `applied` を見ない。**
     * エージェント側に、この呼び出しへ届く道は無い。
     */
    onDecided?: (choice: 'applied' | 'discarded') => void;
  }
  const { session, note = null, onDecided }: Props = $props();
  const m = messages().app;
  /**
   * **答えを返す口は、最初に手元へ取っておく**（2026-09-17）。
   *
   * 「正本へ入れる」は `applyPending` を待つが、**その await の間にこの節が消える**
   * （`pending` が null になった時点で画面から外れる）。
   * 外れたあとに props を読むと `undefined` で、**黙って何も返らなかった** ——
   * エージェント側は人が押したことを知らないまま待ち続ける。
   * 「やめる」は同期なので外れる前に返っており、**片方だけ壊れていた。**
   */
  const decided = onDecided;

  async function apply(): Promise<void> {
    await session.applyPending();
    decided?.('applied');
  }

  function discard(): void {
    session.discardPending();
    decided?.('discarded');
  }

  const sign = { same: ' ', added: '+', removed: '-' } as const;
</script>

<section aria-label={m.diffHeading}>
  <h2>{m.diffHeading}</h2>

  <!-- **誰が何のために出した提案か。** 差分だけでは、何を直したのかが読めない。 -->
  {#if note !== null && note !== ''}
    <p class="from"><strong>{m.liveFrom}</strong>{note}</p>
  {/if}

  {#if session.diff.length === 0}
    <p class="quiet">{m.noChange}</p>
  {:else}
    <pre>{#each session.diff as line, index (index)}<span class={line.kind}>{sign[line.kind]}{line.text}
</span>{/each}</pre>
  {/if}

  {#if session.pending !== null && session.pending.conflicts.length > 0}
    <p class="note">
      {m.notApplied(session.pending.conflicts.length)}
    </p>
  {/if}

  <!--
    **`data-act` は検査の取っ手**（2026-09-17）。
    `scripts/gui-check.mjs` は文言で押していたので、
    **画面が英語で出た CI では押す物が見つからず落ちていた。**
    文言は言語で変わる。取っ手は変わらない。
  -->
  <div class="choose">
    <button class="primary" data-act="apply" onclick={apply}>{m.apply}</button>
    <button data-act="discard" onclick={discard}>{m.discard}</button>
  </div>
</section>

<style>
  h2 {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: 500;
    margin: 0 0 var(--space-3);
  }
  .from {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0 0 var(--space-3);
  }
  .from strong {
    display: block;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    font-weight: 500;
  }
  .quiet {
    color: var(--text-tertiary);
    font-size: var(--text-sm);
  }
  pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.6;
    background: var(--bg-sunken);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    margin: 0 0 var(--space-3);
    overflow: auto;
    max-height: 40vh;
  }
  .added {
    background: var(--success-bg);
    color: var(--success-fg);
    display: block;
  }
  .removed {
    background: var(--danger-bg);
    color: var(--danger-fg);
    display: block;
  }
  .same {
    display: block;
    color: var(--text-secondary);
  }
  .note {
    font-size: var(--text-xs);
    color: var(--warning-fg);
    background: var(--warning-bg);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
  }
  .choose {
    display: flex;
    gap: var(--space-2);
  }
  button {
    font: inherit;
    font-size: var(--text-sm);
    height: 32px;
    padding: 0 var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-strong);
    background: var(--bg-elevated);
    color: var(--text-primary);
    cursor: pointer;
  }
  button.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: transparent;
  }
  button.primary:hover {
    background: var(--accent-hover);
  }
</style>
