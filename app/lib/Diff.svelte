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
  }
  const { session }: Props = $props();
  const m = messages().app;

  const sign = { same: ' ', added: '+', removed: '-' } as const;
</script>

<section aria-label={m.diffHeading}>
  <h2>{m.diffHeading}</h2>

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

  <div class="choose">
    <button class="primary" onclick={() => session.applyPending()}>{m.apply}</button>
    <button onclick={() => session.discardPending()}>{m.discard}</button>
  </div>
</section>

<style>
  h2 {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: 500;
    margin: 0 0 var(--space-3);
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
