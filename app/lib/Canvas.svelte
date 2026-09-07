<!--
  図を見る・選ぶ・動かす（D11 の操作 2・3・4・8）。

  **人の指定であることは、太さで示し、色で示さない**（`DESIGN.md` §2.3）。
  色で示すと `appearance` と混ざり、
  「人が青くした」のか「人が置いた」のかが区別できなくなる。

  描くのは中核の `Placed` から。**色は `src/tokens.ts` の 1 か所から取る。**
-->
<script lang="ts">
  import type { Box, Placed } from '../../src/layout.ts';
  import { messages } from '../../src/messages.ts';
  import { EDGE, GROUP, STROKE_WIDTH, TEXT, lookOf } from '../../src/tokens.ts';
  import type { Session } from './state.svelte.ts';

  interface Props {
    session: Session;
    placed: Placed;
  }
  const { session, placed }: Props = $props();

  /**
   * 競合している要素の id。
   *
   * **印が無いと、どの箱の話か分からない。** id が改名された場面では
   * 同じラベルの箱が 2 つ並ぶことがあり（`db` と `maindb`）、
   * 一覧に「db」と書いてあっても図のどちらか判別できない。
   */
  const inConflict = $derived(new Set(session.conflicts.map((c) => c.elementId)));

  /** 掴んでいるもの。掴んでいる間だけ座標を持つ。 */
  let dragging = $state<{ id: string; dx: number; dy: number } | null>(null);
  let panning = $state<{ x: number; y: number } | null>(null);
  let surface = $state<SVGSVGElement | null>(null);

  /** 画面の座標を図の座標へ。**拡大と移動を戻す。** */
  function toDiagram(event: PointerEvent): { x: number; y: number } {
    const rect = surface?.getBoundingClientRect();
    if (rect === undefined) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left - session.panX) / session.zoom,
      y: (event.clientY - rect.top - session.panY) / session.zoom,
    };
  }

  function grab(event: PointerEvent, box: Box): void {
    event.stopPropagation();
    session.select(box.id);
    const point = toDiagram(event);
    dragging = { id: box.id, dx: point.x - box.x, dy: point.y - box.y };
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    if (panning !== null) {
      session.panBy(event.clientX - panning.x, event.clientY - panning.y);
      panning = { x: event.clientX, y: event.clientY };
      return;
    }
    if (dragging === null) return;
    const point = toDiagram(event);
    // 動かしている間は描き直さない。**離した時点で正本へ書く。**
    preview = { id: dragging.id, x: point.x - dragging.dx, y: point.y - dragging.dy };
  }

  let preview = $state<{ id: string; x: number; y: number } | null>(null);

  async function release(): Promise<void> {
    panning = null;
    if (dragging === null || preview === null) {
      dragging = null;
      preview = null;
      return;
    }
    const { id, x, y } = preview;
    dragging = null;
    preview = null;
    await session.place(id, x, y);
  }

  function startPan(event: PointerEvent): void {
    session.select(null);
    panning = { x: event.clientX, y: event.clientY };
  }

  function wheel(event: WheelEvent): void {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    session.zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  /** 掴んでいる最中は、その箱だけ仮の位置で描く。 */
  function at(box: Box): { x: number; y: number } {
    if (preview !== null && preview.id === box.id) return { x: preview.x, y: preview.y };
    return { x: box.x, y: box.y };
  }
</script>

<svg
  bind:this={surface}
  class="surface"
  role="application"
  aria-label={messages().app.canvasLabel}
  onpointerdown={startPan}
  onpointermove={move}
  onpointerup={release}
  onpointercancel={release}
  onwheel={wheel}
>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE.stroke} />
    </marker>
  </defs>

  <g transform="translate({session.panX} {session.panY}) scale({session.zoom})">
    {#each placed.groups as group (group.id)}
      <g>
        <rect
          x={group.x} y={group.y} width={group.w} height={group.h}
          rx="8" fill={GROUP.fill} stroke={GROUP.stroke} stroke-dasharray="6 4"
        />
        <text x={group.x + 12} y={group.y + 22} font-size="13" fill={TEXT.group}>{group.label}</text>
      </g>
    {/each}

    {#each placed.edges as edge (edge.id)}
      <g>
        <path
          d={'M ' + edge.points.map((p) => `${p.x} ${p.y}`).join(' L ')}
          fill="none"
          stroke={EDGE.stroke}
          stroke-width={edge.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto}
          marker-end="url(#arrow)"
        />
        {#if edge.label !== null}
          <text
            x={(edge.points[0].x + edge.points[edge.points.length - 1].x) / 2}
            y={(edge.points[0].y + edge.points[edge.points.length - 1].y) / 2 - 6}
            text-anchor="middle" font-size="11" fill={TEXT.edge}
          >{edge.label}</text>
        {/if}
      </g>
    {/each}

    {#each placed.boxes as box (box.id)}
      {@const look = lookOf(box.appearance)}
      {@const pos = at(box)}
      <g
        class="node"
        class:selected={session.selected === box.id}
        onpointerdown={(event) => grab(event, box)}
        role="button"
        tabindex="0"
        aria-label={box.label}
      >
        <rect
          x={pos.x} y={pos.y} width={box.w} height={box.h}
          rx="6" fill={look.fill} stroke={look.stroke}
          stroke-width={box.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto}
        />
        <text
          x={pos.x + box.w / 2} y={pos.y + box.h / 2 + 5}
          text-anchor="middle" font-size="14" fill={TEXT.node}
        >{box.label}</text>
        {#if inConflict.has(box.id)}
          <!--
            競合の印（`DESIGN.md` §2.4）。**枠の外に添える。**
            箱そのものの色を変えると `appearance` と混ざる。
          -->
          <rect
            x={pos.x - 5} y={pos.y - 5} width={box.w + 10} height={box.h + 10}
            rx="9" fill="none" stroke="var(--warning-fg)" stroke-width="2" stroke-dasharray="4 3"
          />
        {/if}
        {#if session.selected === box.id}
          <!-- 選択の印は左端の 2px バー（姉妹アプリ §5.7 と同じ作法） -->
          <rect x={pos.x} y={pos.y} width="2" height={box.h} fill="var(--accent)" />
        {/if}
      </g>
    {/each}
  </g>
</svg>

<style>
  .surface {
    width: 100%;
    height: 100%;
    display: block;
    background: var(--canvas);
    touch-action: none;
    cursor: grab;
  }
  .node {
    cursor: move;
  }
  .node:hover rect {
    filter: brightness(0.98);
  }
  .node text {
    user-select: none;
    pointer-events: none;
  }
</style>
