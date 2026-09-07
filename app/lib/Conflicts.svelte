<!--
  競合を見て、片方を選ぶ（D11 の操作 7）。**ここが承認そのもの。**

  **競合は赤で埋めない**（`DESIGN.md` §2.4）。
  大半は「どちらも正しいが、どちらかを選ぶ」だけで、
  危険なのは「人が置いた要素が消える」1 つだけ。
-->
<script lang="ts">
  import { messages } from '../../src/messages.ts';
import type { Conflict } from '../../src/merge.ts';
  import type { Session } from './state.svelte.ts';

  interface Props {
    session: Session;
  }
  const { session }: Props = $props();
  const m = messages().app;

  function tone(conflict: Conflict): string {
    if (conflict.kind === 'pin-orphaned') return 'danger';
    if (conflict.kind === 'position-suppressed') return 'neutral';
    return 'warning';
  }

  function detail(conflict: Conflict): string {
    if (conflict.kind === 'pin-orphaned') {
      return m.conflictRemoved;
    }
    if (conflict.kind === 'position-suppressed') {
      return m.conflictSuppressed(conflict.ai.x, conflict.ai.y);
    }
    return m.conflictPosition(conflict.human.x, conflict.human.y, conflict.ai.x, conflict.ai.y);
  }
</script>

<section aria-label={m.conflictsHeading}>
  <h2>{m.conflictsHeading} <span class="count">{session.conflicts.length}</span></h2>

  {#if session.conflicts.length === 0}
    <p class="quiet">{m.noConflicts}</p>
  {:else}
    <ul>
      {#each session.conflicts as conflict (conflict.kind + conflict.elementId)}
        <li class={tone(conflict)} class:aimed={session.selected === conflict.elementId}>
          <!--
            押すと、図の中のその要素を指す。
            **「どれの話をしているか」を人と機械で一致させる**（D11 の操作 3）。
          -->
          <button
            class="id"
            onclick={() => session.select(conflict.elementId)}
          >{conflict.elementId}</button>
          <p>{detail(conflict)}</p>
          {#if conflict.kind !== 'position-suppressed'}
            <div class="choose">
              <button onclick={() => session.decide(conflict, 'human')}>{m.takeMine}</button>
              <button onclick={() => session.decide(conflict, 'ai')}>{m.takeProposal}</button>
            </div>
          {:else}
            <div class="choose">
              <button onclick={() => session.decide(conflict, 'ai')}>{m.takeProposalAnyway}</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  h2 {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: 500;
    margin: 0 0 var(--space-3);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .count {
    background: var(--neutral-bg);
    color: var(--neutral-fg);
    border-radius: var(--radius-full);
    padding: 0 var(--space-2);
    font-size: var(--text-2xs);
  }
  .quiet {
    color: var(--text-tertiary);
    font-size: var(--text-sm);
    margin: 0;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  li {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    background: var(--bg-elevated);
  }
  li.warning {
    background: var(--warning-bg);
    border-color: transparent;
  }
  li.danger {
    background: var(--danger-bg);
    border-color: transparent;
  }
  li.neutral {
    background: var(--neutral-bg);
    border-color: transparent;
  }
  button.id {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-secondary);
    background: none;
    border: none;
    padding: 0;
    height: auto;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  li.aimed {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  p {
    margin: var(--space-1) 0 var(--space-3);
    font-size: var(--text-sm);
  }
  .choose {
    display: flex;
    gap: var(--space-2);
  }
  button {
    font: inherit;
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-3);
    height: 28px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-strong);
    background: var(--bg-elevated);
    color: var(--text-primary);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease);
  }
  button:hover {
    background: var(--bg-hover);
  }
</style>
