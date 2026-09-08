<!--
  画面（B3 / D11）。**操作は 8 つに限ってある。**

  1 開く・保存する / 2 見る（拡大・移動）/ 3 選ぶ / 4 動かす /
  5 提案を受け取る / 6 適用前に差分を見る / 7 競合を選ぶ / 8 人の指定に印が出る

  **足す前に `docs/specs/005-承認のための最小GUI.md` を読む。**
  承認の 3 つ（A 何が書き換わったか見える / B 戻されていないか見える /
  C 戻されていたら固定できる）に紐づかない操作は入れない。

  **見た目の完成度は完了条件に含めない。汚くてよい**（PRD §3）。
-->
<script lang="ts">
  import sample from '../examples/本番構成.zumen.yaml?raw';
  import { percent } from '../src/measure.ts';
  import { messages } from '../src/messages.ts';
  import Canvas from './lib/Canvas.svelte';
  import Conflicts from './lib/Conflicts.svelte';
  import Diff from './lib/Diff.svelte';
  import { openDiagram, openProposal, saveDiagram } from './lib/files.ts';
  import { Session } from './lib/state.svelte.ts';

  const m = messages().app;
  const session = new Session();
  let handle = $state<unknown>(null);
  let trouble = $state<string | null>(null);
  let dropping = $state(false);
  /** 自動保存の見え方。**黙って保存しない。** */
  let saveState = $state<'idle' | 'saving' | 'saved'>('idle');
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  // 開発中だけ、外から動かせる取っ手を出す。
  // **自動で 8 操作を通して確かめるため**（人に手作業を頼まないため）。
  if (import.meta.env.DEV) {
    (globalThis as unknown as { zumen?: unknown }).zumen = session;
  }

  /**
   * 同梱の例を開く。
   *
   * **空の画面からの入口が、ネイティブのファイルダイアログしか無いのは行き止まり。**
   * 初めて触る人も、動作を確かめたい人も、まずこれで先へ進める。
   */
  async function openSample(): Promise<void> {
    trouble = null;
    handle = null;
    await session.load(sample, '本番構成.zumen.yaml');
  }

  async function open(): Promise<void> {
    trouble = null;
    try {
      const opened = await openDiagram();
      if (opened === null) return;
      handle = opened.handle;
      await session.load(opened.text, opened.name);
    } catch (error) {
      trouble = describe(error);
    }
  }

  async function save(): Promise<void> {
    trouble = null;
    try {
      saveState = 'saving';
      handle = await saveDiagram(session.text, session.name ?? 'diagram.zumen.yaml', handle);
      session.dirty = false;
      saveState = 'saved';
    } catch (error) {
      saveState = 'idle';
      trouble = describe(error);
    }
  }

  /**
   * 自動保存。
   *
   * **保存先が決まっているときだけ。** 決まっていないと保存のたびに
   * ダイアログが出て、作業が止まる。そのときは印だけ出して、人が保存する。
   *
   * 少し待ってから書くのは、ドラッグの途中で何度も書かないため。
   * 書き込み自体は不可分（殻が一時ファイルへ書いて置き換える）なので、
   * 途中で落ちても正本は壊れない。
   */
  function scheduleSave(): void {
    if (!session.dirty || handle === null) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void save(), 800);
  }

  // 正本が変わったら、少し待って保存する。
  $effect(() => {
    void session.text;
    scheduleSave();
  });

  /**
   * ショートカット。
   *
   * **戻る / 進む**（⌘Z / ⇧⌘Z、Ctrl+Z / Ctrl+Y）と、**保存**（⌘S / Ctrl+S）。
   * 自動保存があっても保存の鍵は残す — **人が「いま保存した」と分かる手段**が要る。
   */
  function onKey(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey;
    if (!meta) return;
    const key = event.key.toLowerCase();

    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      void session.undo();
      return;
    }
    if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      void session.redo();
      return;
    }
    if (key === 's') {
      event.preventDefault();
      void save();
    }
  }

  async function propose(): Promise<void> {
    trouble = null;
    try {
      const text = await openProposal();
      if (text === null) return;
      session.propose(text);
    } catch (error) {
      trouble = describe(error);
    }
  }

  /**
   * ファイルを落として開く。
   *
   * **ファイルダイアログしか入口が無いのは、行き止まりになりやすい。**
   * エディタから図を放り込む動きが、いちばん自然。
   */
  async function drop(event: DragEvent): Promise<void> {
    event.preventDefault();
    dropping = false;
    const file = event.dataTransfer?.files?.[0];
    if (file === undefined) return;
    trouble = null;
    try {
      handle = null;
      await session.load(await file.text(), file.name);
    } catch (error) {
      trouble = describe(error);
    }
  }

  /** 握り潰さない。**画面に出ないと、書いた人は気づかない。** */
  function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
</script>

<!-- ショートカットは窓ぜんぶで効かせる。**要素の中に置けない。** -->
<svelte:window onkeydown={onKey} />

<div
  class="shell"
  class:dropping
  ondragover={(event) => {
    event.preventDefault();
    dropping = true;
  }}
  ondragleave={() => (dropping = false)}
  ondrop={drop}
  role="application"
  aria-label="zumen"
>
  <header>
    <div class="title">
      <strong>zumen</strong>
      {#if session.name !== null}
        <span class="name">{session.name}</span>
        <!-- **黙って保存しない。** 保存したことが見えないと不安になる。 -->
        <span class="state">
          {#if saveState === 'saving'}{m.saving}
          {:else if session.dirty && handle === null}{m.autosaveOff}
          {:else if session.dirty}{m.unsaved}
          {:else if saveState === 'saved'}{m.saved}{/if}
        </span>
      {/if}
    </div>

    <div class="actions">
      <button onclick={() => session.undo()} disabled={!session.canUndo || session.historyVersion < 0} title={m.undo}>
        ↶
      </button>
      <button onclick={() => session.redo()} disabled={!session.canRedo || session.historyVersion < 0} title={m.redo}>
        ↷
      </button>
      <span class="gap"></span>
      <!--
        **人が「見た」と印を付ける。この口は画面にしか無い。**

        MCP にも `src/tools.ts` にも開けていない。開けた瞬間、
        AI が自分の絵を自分で承認できる（D18 で閉じたのと同じ穴）。
        ここを押せるのは、**画面に図が出ている人だけ**。それが唯一の担保。
      -->
      <button
        class="review"
        class:done={session.review.reviewed}
        onclick={() => session.markReviewed()}
        disabled={session.placed === null || session.review.reviewed}
        title={session.review.stale ? m.reviewAgain : m.reviewHint}
      >
        {session.review.reviewed ? m.reviewed : session.review.stale ? m.reviewStale : m.review}
      </button>
      <span class="gap"></span>
      <button onclick={open}>{m.open}</button>
      <button onclick={save} disabled={session.text === ''}>{m.save}</button>
      <button onclick={propose} disabled={session.text === ''}>{m.readProposal}</button>
      <span class="gap"></span>
      <button onclick={() => session.zoomBy(1 / 1.2)} disabled={session.placed === null} title={m.zoomOut}>
        −
      </button>
      <button onclick={() => session.resetView()} disabled={session.placed === null} title={m.resetView}>
        {Math.round(session.zoom * 100)}%
      </button>
      <button onclick={() => session.zoomBy(1.2)} disabled={session.placed === null} title={m.zoomIn}>
        ＋
      </button>
    </div>
  </header>

  <main>
    <div class="canvas">
      {#if session.placed !== null}
        <Canvas {session} placed={session.placed} />
      {:else if session.broken}
        <div class="empty">
          <p><strong>{m.unreadable}</strong></p>
          <ul class="findings">
            {#each session.findings.filter((f) => f.severity === 'error') as finding, index (index)}
              <li>{finding.line === undefined ? '' : m.atLine(finding.line)}{finding.message}</li>
            {/each}
          </ul>
        </div>
      {:else}
        <div class="empty">
          <p>{m.emptyHint}</p>
          <button class="primary" onclick={openSample}>{m.openSample}</button>
        </div>
      {/if}
    </div>

    <aside>
      {#if trouble !== null}
        <p class="trouble">{trouble}</p>
      {/if}

      {#if session.pending !== null}
        <Diff {session} />
      {:else}
        <Conflicts {session} />

        {#if session.measurement !== null}
          <section aria-label={m.measureHeading}>
            <h2>{m.measureHeading}</h2>
            <dl>
              <dt>{m.autonomy}</dt>
              <dd class:short={session.measurement.autonomy < 0.9}>
                {percent(session.measurement.autonomy)}
              </dd>
              <dt>{m.layoutAutonomy}</dt>
              <dd class:short={session.measurement.layoutAutonomy < 0.9}>
                {percent(session.measurement.layoutAutonomy)}
              </dd>
            </dl>
            <p class="quiet">
              {m.measureNote(session.measurement.placed, session.measurement.elements)}
            </p>
          </section>
        {/if}

        {#if session.findings.some((f) => f.severity === 'warning')}
          <section aria-label={m.warningsHeading}>
            <h2>{m.warningsHeading}</h2>
            <ul class="findings">
              {#each session.findings.filter((f) => f.severity === 'warning') as finding, index (index)}
                <li>{finding.line === undefined ? '' : m.atLine(finding.line)}{finding.message}</li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if session.placed !== null && session.placed.collisions.length > 0}
          <!--
            人どうしが重なった（Issue 015）。**動かしていない。**
            人の位置を動かして解いたら、手直しを壊したことになる。
          -->
          <section aria-label={m.collisionsHeading}>
            <h2>{m.collisionsHeading}</h2>
            <ul class="findings">
              {#each session.placed.collisions as pair, index (index)}
                <li>{m.collision(pair[0], pair[1])}</li>
              {/each}
            </ul>
          </section>
        {/if}
      {/if}
    </aside>
  </main>
</div>

<style>
  .shell {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .shell.dropping {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--border);
    background: var(--bg-app);
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }
  .name {
    color: var(--text-secondary);
    font-size: var(--text-sm);
  }
  .state {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .gap {
    width: var(--space-4);
  }
  button {
    font: inherit;
    font-size: var(--text-sm);
    height: 28px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-strong);
    background: var(--bg-elevated);
    color: var(--text-primary);
    cursor: pointer;
    transition: background var(--dur-fast) var(--ease);
  }
  button:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  button:disabled {
    color: var(--text-tertiary);
    cursor: default;
  }
  /*
    **見たかどうかは、この画面でいちばん見えるべき状態。**

    誰も見ていない図が 100% と出るのが、この製品の失敗そのもの
    （PRD §4 / ベースルール §29）。**押されていないことが目に入る**必要がある。
  */
  button.review {
    border-color: var(--accent);
    color: var(--accent);
  }
  button.review.done,
  button.review:disabled {
    border-color: var(--border-strong);
    color: var(--text-tertiary);
  }
  main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 320px;
    min-height: 0;
  }
  .canvas {
    min-width: 0;
    position: relative;
  }
  aside {
    border-left: 1px solid var(--border);
    background: var(--bg-subtle);
    padding: var(--space-4);
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .empty {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-3);
    color: var(--text-tertiary);
    background: var(--bg-subtle);
    padding: var(--space-5);
  }
  button.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: transparent;
    height: 32px;
  }
  button.primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .trouble {
    background: var(--danger-bg);
    color: var(--danger-fg);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    margin: 0;
  }
  h2 {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: 500;
    margin: 0 0 var(--space-3);
  }
  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-1) var(--space-3);
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
  }
  dt {
    color: var(--text-secondary);
  }
  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  dd.short {
    color: var(--warning-fg);
  }
  .quiet {
    color: var(--text-tertiary);
    font-size: var(--text-xs);
    margin: 0;
  }
  .findings {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    font-size: var(--text-sm);
  }
  .findings li {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
  }
</style>
