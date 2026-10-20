<!--
  適用前の差分（8 操作の 6）。

  **図の上に重ねない**（`DESIGN.md` §2.5）。
  重ねると変わった部分の境目が読めないうえ、
  正本が `git diff` で読める形と見え方が食い違う。
-->
<script lang="ts">
  import { messages } from '../../src/messages.ts';
import type { Session } from './state.svelte.ts';

  interface Props {
    session: Session;
    /** エージェントが添えた一言。人の提案には無い。 */
    note?: string | null;
    /**
     * 人が答えたことを、線の向こうへ返す。
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
    <!--
      **入れる前に、どこが食い違うかを並べて見せる。** 選ぶのは入れたあと（競合の欄）。
      入れても人の指定は残る —— 提案が人の手直しを黙って上書きすることはない。
    -->
    <div class="conflicts">
      <h3>{m.pendingConflicts(session.pending.conflicts.length)}</h3>
      <p class="quiet">{m.pendingConflictsNote}</p>
      {#each session.pending.conflicts as conflict (conflict.kind + conflict.elementId)}
        <div class="pair">
          <span class="id">{conflict.elementId}</span>
          {#if conflict.kind === 'position-proposed'}
            <div class="sides">
              <span class="side human"><small>{m.humanSide}</small>({conflict.human.x}, {conflict.human.y})</span>
              <span class="side ai"><small>{m.proposalSide}</small>({conflict.ai.x}, {conflict.ai.y})</span>
            </div>
          {:else if conflict.kind === 'position-suppressed'}
            <p>{m.conflictSuppressed(conflict.ai.x, conflict.ai.y)}</p>
          {:else}
            <p class="danger">{m.conflictRemoved}</p>
          {/if}
        </div>
      {/each}
    </div>
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
  section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  h2 {
    font-size: var(--text-md);
    color: var(--text-primary);
    font-weight: 700;
    margin: 0;
  }
  h3 {
    font-size: var(--text-xs);
    color: var(--warning-fg);
    font-weight: 500;
    letter-spacing: 0.04em;
    margin: 0;
  }
  .from {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    margin: 0;
  }
  .from strong {
    display: block;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    font-weight: 500;
  }
  .quiet {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: 1.6;
    margin: 0;
  }
  pre {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    line-height: 1.75;
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3) 0;
    margin: 0;
    overflow: auto;
    max-height: 40vh;
  }
  pre span {
    display: block;
    padding: 0 var(--space-3);
  }
  .added {
    background: var(--success-bg);
    color: var(--success-fg);
  }
  .removed {
    background: var(--danger-bg);
    color: var(--danger-fg);
  }
  .same {
    color: var(--text-secondary);
  }
  .conflicts {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--warning-bg);
  }
  .pair {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .pair .id {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .pair p {
    margin: 0;
    font-size: var(--text-sm);
  }
  .pair p.danger {
    color: var(--danger-fg);
  }
  .sides {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  /* 人の指定は 2px の実線、提案は 1px の破線（DESIGN.md §2.3 と同じ「太さで示す」）。 */
  .side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    font-weight: 500;
  }
  .side small {
    font-family: var(--font);
    font-size: var(--text-2xs);
    font-weight: 400;
    color: var(--text-secondary);
  }
  .side.human {
    border: 2px solid var(--text-primary);
  }
  .side.ai {
    border: 1px dashed var(--text-secondary);
  }
  .note {
    font-size: var(--text-xs);
    color: var(--warning-fg);
    background: var(--warning-bg);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    margin: 0;
  }
  .choose {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }
  button {
    font: inherit;
    font-size: var(--text-sm);
    height: 40px;
    padding: 0 var(--space-5);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text-primary);
    cursor: pointer;
  }
  button:hover {
    background: var(--bg-hover);
  }
  button.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: transparent;
    font-weight: 600;
  }
  button.primary:hover {
    background: var(--accent-hover);
  }
</style>
