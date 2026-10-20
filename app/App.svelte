<!--
  画面（承認のための最小 GUI）。**操作は 8 つに限ってある。**

  1 開く・保存する / 2 見る（拡大・移動）/ 3 選ぶ / 4 動かす /
  5 提案を受け取る / 6 適用前に差分を見る / 7 競合を選ぶ / 8 人の指定に印が出る

  承認の 3 つ（A 何が書き換わったか見える / B 戻されていないか見える /
  C 戻されていたら固定できる）に紐づかない操作は入れない。

  **見た目の完成度は完了条件に含めない。汚くてよい**。
-->
<script lang="ts">
  import sample from '../examples/本番構成.zumen.yaml?raw';
  import iconSvg from './icon.svg?raw';
  import { percent } from '../src/measure.ts';
  import { messages } from '../src/messages.ts';
  import { MARKUP_COLORS, MARKUP_WIDTHS } from '../src/markup.ts';
  import Canvas from './lib/Canvas.svelte';
  import Conflicts from './lib/Conflicts.svelte';
  import Diff from './lib/Diff.svelte';
  import { openDiagram, openProposal, saveDiagram } from './lib/files.ts';
  import { Live } from './lib/live.svelte.ts';
  import { Session } from './lib/state.svelte.ts';

  const m = messages().app;
  const session = new Session();
  /**
   * エージェントと繋がる線。
   *
   * **降りてくるのは提案であって、正本ではない。** 画面には差分が出るだけで、
   * 「正本へ入れる」を押すのは人。**線の向こうに、押す口は無い。**
   */
  const live = new Live(session);
  $effect(() => {
    live.start();
    return () => live.stop();
  });
  let handle = $state<unknown>(null);
  let trouble = $state<string | null>(null);
  let dropping = $state(false);
  /**
   * 図を描く箱の大きさ。**`bind:clientWidth` で測る。**
   *
   * `ResizeObserver` を `<svg>` に掛ける手は採らない —— **最初の 1 回が鳴らない**
   * （実測。箱は 640×534 あるのに 0 回）。`bind:this` を見る `$effect` も、
   * **束縛の代入では走り直さなかった**（同じく実測）。
   *
   * ここで測った大きさを渡すと、**開いた図が画面に収まる**（`Session.fit`）。
   */
  /** 赤入れの道具の板を開いているか。閉じたら道具も置く（箱を掴める状態へ戻す）。 */
  let markupOpen = $state(false);
  function toggleMarkup(): void {
    markupOpen = !markupOpen;
    session.markupTool = markupOpen ? 'pen' : 'none';
  }
  const MARKUP_COLOR_KEYS = ['red', 'blue', 'green', 'black', 'orange'] as const;
  const MARKUP_WIDTH_KEYS = ['thin', 'normal', 'thick'] as const;
  const colorName = { red: m.markupRed, blue: m.markupBlue, green: m.markupGreen, black: m.markupBlack, orange: m.markupOrange };
  const widthName = { thin: m.markupThin, normal: m.markupNormal, thick: m.markupThick };

  /** 修飾キーの書き方。Mac なら ⌘、ほかは Ctrl+。 */
  const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
  /** 保存の札の色。**保存したときだけ success**。未保存は中立のまま（赤くしない）。 */
  const saveTone = $derived(saveState === 'saved' && !session.dirty ? 'ok' : 'quiet');
  /** 下の帯の「選択中」。箱なら左上の座標まで出す。 */
  const selectedText = $derived.by(() => {
    const id = session.selected;
    if (id === null) return null;
    const box = session.placed?.boxes.find((b) => b.id === id);
    return box === undefined ? id : `${id} · (${Math.round(box.x)}, ${Math.round(box.y)})`;
  });

  let canvasW = $state(0);
  let canvasH = $state(0);
  $effect(() => {
    session.setView(canvasW, canvasH);
  });
  /** 自動保存の見え方。**黙って保存しない。** */
  let saveState = $state<'idle' | 'saving' | 'saved'>('idle');
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  // 開発中だけ、外から動かせる取っ手を出す。
  // **自動で 8 操作を通して確かめるため**（人に手作業を頼まないため）。
  if (import.meta.env.DEV) {
    (globalThis as unknown as { zumen?: unknown }).zumen = session;
    // **線の状態も出す。** 押した結果が線の向こうへ返ったかは、
    // 画面の見た目からは分からない（`scripts/gui-check.mjs`）。
    (globalThis as unknown as { zumenLive?: unknown }).zumenLive = live;
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
    session.path = null;
    await session.load(sample, '本番構成.zumen.yaml');
  }

  async function open(): Promise<void> {
    trouble = null;
    try {
      const opened = await openDiagram();
      if (opened === null) return;
      handle = opened.handle;
      // 殻の中では、道がそのまま手掛かりになる。**エージェントへ渡すのはこれ。**
      session.path = typeof opened.handle === 'string' ? opened.handle : null;
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
      session.path = typeof handle === 'string' ? handle : null;
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
   * 映しているものをエージェントへ伝える。
   *
   * **保存前の手直しごと渡す。** ディスクを読ませると、人がさっき動かした分が
   * 見えず、エージェントはそれを壊す提案を書く。
   */
  $effect(() => {
    void session.text;
    void session.name;
    void session.path;
    void session.selected;
    void session.dirty;
    void session.conflicts.length;
    void live.state;
    void live.tell();
  });

  /**
   * ショートカット。
   *
   * **戻る / 進む**（⌘Z / ⇧⌘Z、Ctrl+Z / Ctrl+Y）と、**保存**（⌘S / Ctrl+S）。
   * 自動保存があっても保存の鍵は残す — **人が「いま保存した」と分かる手段**が要る。
   */
  function onKey(event: KeyboardEvent): void {
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    /**
     * **見る操作は、修飾キー無しで効かせる**（8 操作の 2）。
     *
     * 図を見ているあいだは文字を打たないので、`f` / `0` / `+` / `-` を
     * そのまま使える。**編集（戻る・保存）だけが修飾キー付き。**
     * 文字を打つ所に居るときは何もしない。
     */
    if (!meta && !typing(event.target)) {
      if (key === 'f') {
        event.preventDefault();
        session.fit();
        return;
      }
      if (key === '0') {
        event.preventDefault();
        session.resetView();
        return;
      }
      if (key === '+' || key === ';' || key === '=') {
        event.preventDefault();
        session.zoomBy(1.2);
        return;
      }
      if (key === '-') {
        event.preventDefault();
        session.zoomBy(1 / 1.2);
        return;
      }
    }

    if (!meta) return;

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

  /** 文字を打つ所に居るか。**居るときは 1 文字のショートカットを効かせない。** */
  function typing(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
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
      session.path = null;
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
      <span class="logo" aria-hidden="true">{@html iconSvg}</span>
      <strong>zumen</strong>
      {#if session.name !== null}
        <span class="divider" aria-hidden="true"></span>
        <span class="name">{session.name}</span>
        <!-- **黙って保存しない。** 保存したことが見えないと不安になる。 -->
        <span class="state" class:ok={saveTone === 'ok'} class:quiet={saveTone === 'quiet'}>
          {#if saveState === 'saving'}{m.saving}
          {:else if session.dirty && handle === null}{m.autosaveOff}
          {:else if session.dirty}{m.unsaved}
          {:else if saveState === 'saved'}{m.saved}{/if}
        </span>
      {/if}
      <span class="history">
        <button class="icon" onclick={() => session.undo()} disabled={!session.canUndo || session.historyVersion < 0} title="{m.undo}（{mod}Z）" aria-label={m.undo}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M6 4L2.5 7.5 6 11M3 7.5h7.5a4 4 0 010 8H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
        <button class="icon" onclick={() => session.redo()} disabled={!session.canRedo || session.historyVersion < 0} title="{m.redo}（⇧{mod}Z）" aria-label={m.redo}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M12 4l3.5 3.5L12 11M15 7.5H7.5a4 4 0 000 8H10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </span>
    </div>

    <div class="actions">
      <!--
        **繋がっていないことを黙らない。**
        線が切れたまま話しかけられると、人はエージェントが無視していると思う。
      -->
      <span
        class="live"
        class:on={live.state === 'on'}
        title={live.state === 'on' ? m.liveOnHint : m.liveOffHint}
      >
        <span class="dot" aria-hidden="true"></span>
        {live.state === 'on' ? m.liveOn : live.state === 'connecting' ? m.liveConnecting : m.liveOff}
      </span>
      <button onclick={open}>{m.open}</button>
      <button onclick={save} disabled={session.text === ''}>{m.save}</button>
      <button onclick={propose} disabled={session.text === ''} class:on={session.pending !== null}>{m.readProposal}</button>
      <div class="zoom" role="group" aria-label={m.keyZoom}>
        <button onclick={() => session.zoomBy(1 / 1.2)} disabled={session.placed === null} title={m.zoomOut} aria-label={m.zoomOut}>−</button>
        <button class="pct" onclick={() => session.resetView()} disabled={session.placed === null} title={m.resetView}>
          {Math.round(session.zoom * 100)}%
        </button>
        <button onclick={() => session.zoomBy(1.2)} disabled={session.placed === null} title={m.zoomIn} aria-label={m.zoomIn}>＋</button>
        <!--
          **図ぜんぶを見せる。** 開いた直後は自動で収めているが、
          拡大して見たあと**元の全体へ戻る道**が要る（等倍に戻すのとは別）。
        -->
        <button class="fit" onclick={() => session.fit()} disabled={session.placed === null} title={m.fitHint}>
          {m.fit}<kbd>F</kbd>
        </button>
      </div>
      <!-- **赤入れ**（仕様 §3.7、D46）。図には効かない書き込み。板を開いている間だけ道具を持つ。 -->
      <button class="markup-toggle" class:on={markupOpen} onclick={toggleMarkup} disabled={session.placed === null} title={m.markupHint}>
        ✎ {m.markup}
      </button>
      <!--
        **人が「見た」と印を付ける。この口は画面にしか無い。**

        MCP にも `src/tools.ts` にも開けていない。開けた瞬間、
        AI が自分の絵を自分で承認できる（AI が採用する口を開けないのと同じ理由）。
        ここを押せるのは、**画面に図が出ている人だけ**。それが唯一の担保。
      -->
      <button
        class="review"
        class:done={session.review.reviewed}
        onclick={() => session.markReviewed()}
        disabled={session.placed === null || session.review.reviewed}
        title={session.review.stale ? m.reviewAgain : m.reviewHint}
      >
        {#if session.review.reviewed}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.4l3.2 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg>
        {/if}
        {session.review.reviewed ? m.reviewed : session.review.stale ? m.reviewStale : m.review}
      </button>
    </div>
  </header>

  <main>
    <div class="stage">
      {#if session.pending !== null}
        <!-- **図はまだ変わっていない**ことを、図の真上で言う。押すまで正本は動かない（8 操作の 6）。 -->
        <p class="banner" role="status">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l6.6 11.7H1.4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /><path d="M8 6.3v3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><circle cx="8" cy="11.6" r=".9" fill="currentColor" /></svg>
          {m.pendingBanner}
        </p>
      {/if}
      <div class="canvas" bind:clientWidth={canvasW} bind:clientHeight={canvasH}>
        {#if session.placed !== null}
          <Canvas {session} placed={session.placed} />
          {#if markupOpen}
            <div class="markup-tools" role="toolbar" aria-label={m.markup}>
              <div class="row">
                {#each [['pen', m.markupPen], ['note', m.markupNote], ['erase', m.markupErase]] as [tool, label] (tool)}
                  <button class:on={session.markupTool === tool} onclick={() => (session.markupTool = tool as 'pen' | 'note' | 'erase')}>{label}</button>
                {/each}
              </div>
              <div class="row" aria-label={m.markupColor}>
                {#each MARKUP_COLOR_KEYS as key (key)}
                  <button
                    class="swatch" class:on={session.markupColor === key}
                    style="--swatch: {MARKUP_COLORS[key]}" title={colorName[key]} aria-label={colorName[key]}
                    onclick={() => (session.markupColor = key)}
                  ></button>
                {/each}
              </div>
              <div class="row" aria-label={m.markupWidth}>
                {#each MARKUP_WIDTH_KEYS as key (key)}
                  <button class="width" class:on={session.markupWidth === key} title={widthName[key]} onclick={() => (session.markupWidth = key)}>
                    <svg width="28" height="12" aria-hidden="true"><line x1="3" y1="6" x2="25" y2="6" stroke="currentColor" stroke-width={MARKUP_WIDTHS[key]} stroke-linecap="round" /></svg>
                    <span class="sr">{widthName[key]}</span>
                  </button>
                {/each}
              </div>
              <label class="row show">
                <input type="checkbox" bind:checked={session.showMarkup} /> {m.markupShow}
              </label>
            </div>
          {/if}
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
            <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="8" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" /><rect x="13" y="14" width="8" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M7 10v7h6" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
            <p>{m.emptyHint}</p>
            <div class="choose">
              <button onclick={open}>{m.open}</button>
              <button class="primary" data-act="sample" onclick={openSample}>{m.openSample}</button>
            </div>
          </div>
        {/if}
      </div>
      {#if session.placed !== null}
        <!--
          **画面の下の帯。** 人が決めた数と AI が置いた数を、**枠の太さの凡例と一緒に**出す
          （DESIGN.md §2.3「太さで示し、色で示さない」）。凡例が無いと、2px が何の印か読めない。
        -->
        <footer class="status">
          {#if session.measurement !== null}
            <span class="legend"><span class="swatch human" aria-hidden="true"></span>{m.statusHuman(session.measurement.placed)}</span>
            <span class="legend"><span class="swatch auto" aria-hidden="true"></span>{m.statusAuto(session.measurement.elements - session.measurement.placed)}</span>
          {/if}
          <span class="fill"></span>
          {#if selectedText !== null}<span class="mono">{m.statusSelected(selectedText)}</span>{/if}
          <span class="mono">{Math.round(session.zoom * 100)}%</span>
        </footer>
      {/if}
    </div>

    <aside>
      {#if trouble !== null}
        <p class="trouble">{trouble}</p>
      {/if}

      {#if session.pending !== null}
        <!--
          **人が答えたことだけを、線の向こうへ返す。**
          ここを通らない限り、エージェントは `applied` を見ない。
        -->
        <Diff {session} note={live.note} onDecided={(choice) => live.answered(choice)} />
      {:else}
        {#if session.placed !== null}
          <!-- **見たかどうかを、いちばん上に。** 誰も見ていない図が 100% と出るのが、この製品の失敗そのもの。 -->
          <section class="seen" class:done={session.review.reviewed} class:stale={session.review.stale} aria-label={m.review}>
            <span class="badge" aria-hidden="true">
              {#if session.review.reviewed}
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.4l3.2 3.1L13 4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
              {:else}
                <svg width="16" height="16" viewBox="0 0 16 16"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.4" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg>
              {/if}
            </span>
            <div>
              <strong>{session.review.reviewed ? m.reviewed : session.review.stale ? m.reviewStaleTitle : m.reviewNone}</strong>
              <span>{session.review.reviewed ? m.reviewDoneHint : session.review.stale ? m.reviewAgain : m.reviewNoneHint}</span>
            </div>
          </section>
        {/if}

        <Conflicts {session} />

        {#if session.measurement !== null}
          <section aria-label={m.measureHeading}>
            <h2>{m.measureHeading}</h2>
            <div class="meters">
              {#each [[m.autonomy, session.measurement.autonomy], [m.layoutAutonomy, session.measurement.layoutAutonomy]] as [label, value] (label)}
                {@const v = value as number}
                <div class="meter" class:short={v < 0.9}>
                  <span class="label">{label}</span>
                  <span class="value">{Math.round(v * 100)}<small>%</small></span>
                  <span class="bar" aria-hidden="true"><span style="width: {Math.round(v * 100)}%"></span><i></i></span>
                  <span class="sr">{percent(v)}</span>
                </div>
              {/each}
            </div>
            <p class="quiet">
              {m.measureNote(session.measurement.placed, session.measurement.elements)}{m.autonomyMark}
            </p>
          </section>
        {/if}

        {#if session.findings.some((f) => f.severity === 'warning')}
          <section aria-label={m.warningsHeading}>
            <h2>{m.warningsHeading}</h2>
            <ul class="findings">
              {#each session.findings.filter((f) => f.severity === 'warning') as finding, index (index)}
                <li>{#if finding.line !== undefined}<span class="line">{m.atLine(finding.line).replace(/:\s*$/, '')}</span>{/if}{finding.message}</li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if session.placed !== null && session.placed.collisions.length > 0}
          <!--
            人どうしが重なった。**動かしていない。**
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

      <!-- **キーの凡例。** 修飾キー無しで効く見る操作は、書いておかないと見つからない。 -->
      <dl class="keys" aria-label={m.keysLabel}>
        <div><dt><kbd>F</kbd></dt><dd>{m.fit}</dd></div>
        <div><dt><kbd>0</kbd></dt><dd>{m.keyReset}</dd></div>
        <div><dt><kbd>＋</kbd><kbd>−</kbd></dt><dd>{m.keyZoom}</dd></div>
        <div><dt><kbd>{mod}Z</kbd></dt><dd>{m.undo}</dd></div>
        <div><dt><kbd>{mod}S</kbd></dt><dd>{m.save}</dd></div>
      </dl>
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
  /*
    上の帯。**折り返さない**（姉妹 DESIGN.md：タイトルバーを兼ねる帯は折り返し禁止）。
    狭いときは状態の文言だけが省略される。
  */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    height: 52px;
    padding: 0 var(--space-4);
    border-bottom: 1px solid var(--border);
    background: var(--bg-app);
  }
  .title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .logo {
    display: inline-flex;
    flex-shrink: 0;
  }
  .logo :global(svg) {
    width: 22px;
    height: 22px;
  }
  .divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 var(--space-1);
  }
  .name {
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
  .state {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .state:not(:empty) {
    padding: 2px var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
  }
  .state.ok {
    color: var(--success-fg);
    background: var(--success-bg);
    border-color: transparent;
  }
  .history {
    display: inline-flex;
    gap: 2px;
    margin-left: var(--space-2);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .actions button {
    white-space: nowrap;
  }
  /** 線の状態。**押せない**（見るだけ）ので、ボタンの形にしない。 */
  .live {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: 28px;
    padding: 0 var(--space-3);
    margin-right: var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
    white-space: nowrap;
  }
  .live.on {
    color: var(--text-secondary);
  }
  .live .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-tertiary);
    opacity: 0.45;
  }
  .live.on .dot {
    background: var(--success-fg);
    box-shadow: 0 0 0 3px var(--success-bg);
    opacity: 1;
  }
  /* ボタンは姉妹の md（32px）。 */
  button {
    font: inherit;
    font-size: var(--text-sm);
    height: 32px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
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
  button.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  button.icon {
    width: 32px;
    padding: 0;
    border-color: transparent;
    background: transparent;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  button.icon:disabled {
    color: var(--border-strong);
  }
  .zoom {
    display: flex;
    height: 32px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .zoom button {
    height: 100%;
    border: 0;
    border-radius: 0;
    min-width: 32px;
    padding: 0 var(--space-2);
    color: var(--text-secondary);
  }
  .zoom button + button {
    border-left: 1px solid var(--border);
  }
  .zoom .pct {
    min-width: 56px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-primary);
  }
  .zoom .fit {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    color: var(--text-primary);
  }
  .zoom button:disabled {
    color: var(--text-tertiary);
  }
  kbd {
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 15px;
    padding: 0 5px;
    color: var(--text-secondary);
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    background: var(--bg-elevated);
  }
  /*
    **見たかどうかは、この画面でいちばん見えるべき状態。**

    誰も見ていない図が 100% と出るのが、この製品の失敗そのもの
    （人が見たかどうかは、活動量からは分からない）。**押されていないことが目に入る**必要がある。
    だから押されていない間だけ、アクセントで塗る（アクセントは主役 1 点だけ）。
  */
  button.review {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--accent);
    border-color: transparent;
    color: var(--text-on-accent);
    font-weight: 600;
    padding: 0 var(--space-4) 0 var(--space-3);
  }
  button.review:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  button.review.done,
  button.review:disabled {
    background: var(--accent-subtle);
    border-color: var(--accent-border);
    color: var(--accent);
  }
  button.review:disabled:not(.done) {
    background: var(--bg-elevated);
    border-color: var(--border);
    color: var(--text-tertiary);
  }
  main {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 340px;
    min-height: 0;
  }
  .stage {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-2) var(--space-4);
    background: var(--warning-bg);
    color: var(--warning-fg);
    border-bottom: 1px solid var(--border);
    font-size: var(--text-sm);
  }
  .canvas {
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    height: 32px;
    padding: 0 var(--space-4);
    border-top: 1px solid var(--border);
    background: var(--bg-app);
    color: var(--text-secondary);
    font-size: var(--text-xs);
    white-space: nowrap;
  }
  .status .fill {
    flex: 1;
  }
  .mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }
  .legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend .swatch {
    width: 14px;
    height: 10px;
    border-radius: 3px;
  }
  .legend .human {
    border: 2px solid var(--text-primary);
  }
  .legend .auto {
    border: 1px solid var(--border-strong);
  }
  .markup-tools {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-2);
    background: var(--bg-app);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
  }
  .markup-tools .row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .markup-tools button {
    height: 28px;
  }
  .markup-tools .swatch {
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 50%;
    background: var(--swatch);
  }
  .markup-tools .swatch.on {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .markup-tools .show {
    color: var(--text-primary);
    font-size: 12px;
    gap: 6px;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  /* 右の欄。節ごとに罫線で分け、余白で階層を見せる（姉妹 §1）。 */
  aside {
    border-left: 1px solid var(--border);
    background: var(--bg-app);
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  aside > :global(section) {
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border);
  }
  aside > .trouble {
    margin: var(--space-4) var(--space-5) 0;
  }
  .seen {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .seen .badge {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-full);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--warning-bg);
    color: var(--warning-fg);
  }
  .seen.done .badge {
    background: var(--accent-subtle);
    color: var(--accent);
  }
  .seen div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .seen span:not(.badge) {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .meters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .meter {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .meter .label {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }
  .meter .value {
    font-family: var(--font-mono);
    font-size: 26px;
    font-weight: 500;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .meter .value small {
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
  /* 9 割に届いたらアクセント、届かなければ warning。縦の線が 9 割の目安。 */
  .meter .bar {
    position: relative;
    height: 4px;
    border-radius: var(--radius-full);
    background: var(--bg-sunken);
  }
  .meter .bar span {
    display: block;
    height: 100%;
    border-radius: var(--radius-full);
    background: var(--accent);
  }
  .meter.short .bar span {
    background: var(--warning-fg);
  }
  .meter .bar i {
    position: absolute;
    left: 90%;
    top: -3px;
    width: 1px;
    height: 10px;
    background: var(--text-secondary);
  }
  .empty {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-3);
    color: var(--text-secondary);
    background: var(--bg-subtle);
    padding: var(--space-5);
  }
  .empty svg {
    color: var(--text-tertiary);
  }
  .empty p {
    margin: 0;
  }
  .choose {
    display: flex;
    gap: var(--space-2);
  }
  button.primary {
    background: var(--accent);
    color: var(--text-on-accent);
    border-color: transparent;
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
    font-size: var(--text-xs);
    color: var(--text-secondary);
    font-weight: 500;
    letter-spacing: 0.04em;
    margin: 0 0 var(--space-3);
  }
  .quiet {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    line-height: 1.6;
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
    line-height: 1.6;
  }
  .findings .line {
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: var(--warning-fg);
    background: var(--warning-bg);
    padding: 1px 6px;
    border-radius: 4px;
    margin-right: var(--space-2);
    white-space: nowrap;
  }
  .keys {
    margin: auto 0 0;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    font-size: var(--text-2xs);
    color: var(--text-secondary);
  }
  .keys div {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .keys dt {
    display: inline-flex;
    gap: 2px;
  }
  .keys dd {
    margin: 0;
  }
  .keys kbd {
    color: var(--text-primary);
  }
</style>
