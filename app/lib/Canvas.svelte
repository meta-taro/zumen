<!--
  図を見る・選ぶ・動かす（8 操作の 2・3・4・8）。

  **人の指定であることは、太さで示し、色で示さない**（`DESIGN.md` §2.3）。
  色で示すと `appearance` と混ざり、
  「人が青くした」のか「人が置いた」のかが区別できなくなる。

  描くのは中核の `Placed` から。**色は `src/tokens.ts` の 1 か所から取る。**
-->
<script lang="ts">
  import { drawHatch } from '../../src/hatch.ts';
  import { drawOpenings } from '../../src/openings.ts';
  import { wallWidth } from '../../src/wall.ts';
  import type { Box, Placed } from '../../src/layout.ts';
  import { messages } from '../../src/messages.ts';
  import { EDGE, GROUP, STROKE_WIDTH, TEXT, lookOf } from '../../src/tokens.ts';
  import { MARKUP_COLORS, MARKUP_WIDTHS, placeMarkup } from '../../src/markup.ts';
  import type { Point } from '../../src/markup.ts';
  import type { Session } from './state.svelte.ts';

  interface Props {
    session: Session;
    placed: Placed;
  }
  const { session, placed }: Props = $props();

  /**
   * **平面図として描くか。**
   *
   * 2026-09-16。画面と書き出しで**別の絵**が出ていた ——
   * 模様（`hatch`）も副題（`technology`）も壁の厚みも建具も、画面には無かった。
   * **人が承認するのは画面のほう**なので、見ていないものを承認させていた。
   *
   * 描き方は `src/hatch.ts` / `src/openings.ts` / `src/wall.ts` を**そのまま呼ぶ**。
   * ここで描き直すと、また 2 つの絵に分かれる。
   */
  const plan = $derived(session.plan);
  const wall = $derived(plan ? wallWidth(placed.wall, placed.mm) : null);
  const outerWall = $derived(plan ? wallWidth(placed.wall, placed.mm, true) : null);

  /** その箱の枠の太さ。**壁の厚みは「人が置いた印」より優先する。** */
  function edge(box: Box): number {
    const thick = box.marker === 'box' && box.w > 34 && box.h > 34 ? wall : null;
    return thick ?? (box.pinned ? STROKE_WIDTH.pinned : STROKE_WIDTH.auto);
  }

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
    // 赤入れの道具を持っている間は箱を掴まない。紙の側（`press`）へ渡す。
    if (session.markupTool !== 'none') {
      // 箱へフォーカスも移さない（枠に印が出て、掴んだように見える）。
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    session.select(box.id);
    const point = toDiagram(event);
    dragging = { id: box.id, dx: point.x - box.x, dy: point.y - box.y };
    (event.target as Element).setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent): void {
    if (drawing !== null) {
      drawing = [...drawing, toDiagram(event)];
      return;
    }
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
    if (drawing !== null) {
      const stroke = drawing;
      drawing = null;
      await session.addInk(stroke);
      return;
    }
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

  /**
   * **赤入れ**（仕様 §3.7）。描いている途中の線と、打っている途中の付箋。
   * 離した・確定した時点で正本へ書く（箱を動かすのと同じ）。
   */
  let drawing = $state<Point[] | null>(null);
  let draft = $state<{ at: Point; left: number; top: number } | null>(null);
  let draftText = $state('');

  /** 紙を押した。赤入れの道具を持っていればそちらへ、無ければ紙を動かす。 */
  function press(event: PointerEvent): void {
    const tool = session.markupTool;
    if (tool === 'pen') {
      drawing = [toDiagram(event)];
      surface?.setPointerCapture(event.pointerId);
      return;
    }
    if (tool === 'note') {
      const rect = surface?.getBoundingClientRect();
      if (rect === undefined) return;
      event.preventDefault();
      draftText = '';
      draft = { at: toDiagram(event), left: event.clientX - rect.left, top: event.clientY - rect.top };
      return;
    }
    if (tool === 'erase') return;
    startPan(event);
  }

  /** 出した付箋の欄へ、押した指が離れてから文字の入る先を移す（押した直後だと紙に取られる）。 */
  function focusNow(node: HTMLInputElement): void {
    setTimeout(() => node.focus(), 0);
  }

  async function commitNote(): Promise<void> {
    if (draft === null) return;
    const { at } = draft;
    const text = draftText;
    draft = null;
    await session.addNote(text, at);
  }

  function noteKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      void commitNote();
    } else if (event.key === 'Escape') {
      draft = null;
    }
  }

  function erase(event: PointerEvent, index: number): void {
    if (session.markupTool !== 'erase') return;
    event.stopPropagation();
    void session.eraseMarkup(index);
  }

  /** 付箋の幅のめやす（全角 13px・半角 7.5px）。 */
  const noteWidth = (text: string): number => [...text].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xff ? 13 : 7.5), 12);

  /** 紙の上の赤入れ。**掴んでいる箱に結んだものは、仮の位置についていく。** */
  const marks = $derived(
    session.showMarkup ? placeMarkup(session.markup.map((m) => m.item), placed.boxes.map((b) => ({ id: b.id, ...at(b) }))) : [],
  );
  const path = (points: Point[]): string => 'M ' + points.map((p) => `${p.x} ${p.y}`).join(' L ');

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
  class:inking={session.markupTool !== 'none'}
  onpointerdown={press}
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
          rx={plan ? 0 : 8}
          fill={GROUP.fill}
          stroke={GROUP.stroke}
          stroke-width={plan ? (outerWall ?? 1) : 1}
          stroke-dasharray={plan ? 'none' : '6 4'}
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
          rx={plan ? 0 : 6} fill={look.fill} stroke={look.stroke}
          stroke-width={edge(box)}
        />
        {#if plan && box.hatch !== 'none'}
          <!-- **材料と区域の模様**（`src/hatch.ts`）。書き出しと同じものを呼ぶ。 -->
          {@html drawHatch(box.hatch, { ...box, x: pos.x, y: pos.y }, look.stroke, box.marker, box.id)}
        {/if}
        {#if plan && box.openings.length > 0}
          <!-- **建具は壁に開く穴**（`src/openings.ts`）。開き勝手まで出る。 -->
          {@html drawOpenings(
            { ...box, x: pos.x, y: pos.y },
            box.openings,
            look.stroke,
            look.fill,
            edge(box),
          )}
        {/if}
        <text
          x={pos.x + box.w / 2}
          y={pos.y + box.h / 2 + (box.technology === null ? 5 : -1)}
          text-anchor="middle" font-size="14" fill={TEXT.node}
        >{box.label}</text>
        {#if box.technology !== null}
          <!-- **副題**（`technology`）。書き出しには出ていて、画面には無かった。 -->
          <text
            x={pos.x + box.w / 2} y={pos.y + box.h / 2 + 13}
            text-anchor="middle" font-size="11" fill={TEXT.edge}
          >{box.technology}</text>
        {/if}
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
        <!--
          **掴めることの印**（2026-09-24。人が触って出た不満）。

          動かせるのは四角だけで、矢印・背景の点線の囲み・文字をどう直すのかが分からなかった。

          **掴めるのは節だけ**なのに、見て分からなかった。
          矢印の上でもカーソルは `grab` のままで、押すと紙が動く。

          印は**角の 4 点**。ホバーしている間だけ出る。

          - **枠を太くしない。** 2px は「人が置いた」の意味（`DESIGN.md` §2.3）。混ぜられない
          - **塗りを触らない。** 前の `brightness(0.98)` は `vivid` の塗りと混ざるうえ、ほぼ見えなかった
          - **静止しているときは何も出ない。** 図そのものを汚さない

          **掴めないもの（辺・囲み・文字）には何も出ない。それ自体が印。**
        -->
        <g class="grips" aria-hidden="true">
          {#each [[pos.x, pos.y], [pos.x + box.w, pos.y], [pos.x, pos.y + box.h], [pos.x + box.w, pos.y + box.h]] as [gx, gy] (`${gx},${gy}`)}
            <rect x={gx - 3} y={gy - 3} width="6" height="6" fill="var(--accent)" />
          {/each}
        </g>
      </g>
    {/each}

    <!--
      **赤入れ**（仕様 §3.7、D46）。図の上に 1 枚かぶせる面。**図には効かない** —— 書き出しにも出ない。
      行き先の無い赤入れ（結んだ箱が消えた）は、薄く・破線で出す。黙って消さない。
    -->
    {#if session.showMarkup}
      <g class="markup" class:erasing={session.markupTool === 'erase'}>
        {#each marks as mk (mk.index)}
          {@const color = MARKUP_COLORS[mk.item.color]}
          {#if mk.item.kind === 'ink' && 'points' in mk}
            <g class="mark" class:orphaned={mk.orphaned} onpointerdown={(event) => erase(event, mk.index)} role="presentation">
              <path class="hit" d={path(mk.points)} />
              <path
                d={path(mk.points)} fill="none" stroke={color} stroke-width={MARKUP_WIDTHS[mk.item.width]}
                stroke-linecap="round" stroke-linejoin="round" stroke-dasharray={mk.orphaned ? '6 4' : 'none'}
              />
            </g>
          {:else if mk.item.kind === 'note' && 'at' in mk}
            {@const w = noteWidth(mk.item.text)}
            <g class="mark" class:orphaned={mk.orphaned} onpointerdown={(event) => erase(event, mk.index)} role="presentation">
              <rect
                x={mk.at.x} y={mk.at.y} width={w} height="24" rx="3"
                fill="var(--canvas)" stroke={color} stroke-width="1.5" stroke-dasharray={mk.orphaned ? '4 3' : 'none'}
              />
              <text x={mk.at.x + 6} y={mk.at.y + 17} font-size="13" fill={color}>{mk.item.text}</text>
            </g>
          {/if}
        {/each}
        {#if drawing !== null && drawing.length > 1}
          <path
            d={path(drawing)} fill="none" stroke={MARKUP_COLORS[session.markupColor]}
            stroke-width={MARKUP_WIDTHS[session.markupWidth]} stroke-linecap="round" stroke-linejoin="round"
          />
        {/if}
      </g>
    {/if}
  </g>
</svg>

{#if draft !== null}
  <!-- 付箋の文字。Enter で貼る、Esc でやめる。外を押しても貼る。 -->
  <input
    use:focusNow
    class="note-draft"
    style="left: {draft.left}px; top: {draft.top}px; color: {MARKUP_COLORS[session.markupColor]}"
    bind:value={draftText}
    onkeydown={noteKey}
    onblur={() => void commitNote()}
    placeholder={messages().app.markupNotePlaceholder}
  />
{/if}

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
  .surface.inking,
  .surface.inking .node {
    cursor: crosshair;
  }
  .markup .mark {
    pointer-events: none;
  }
  .markup .mark.orphaned {
    opacity: 0.55;
  }
  .markup .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 12;
  }
  .markup.erasing .mark {
    pointer-events: all;
    cursor: pointer;
  }
  .markup .mark text {
    user-select: none;
  }
  .note-draft {
    position: absolute;
    min-width: 12em;
    font-size: 13px;
    padding: 3px 6px;
    border: 1.5px solid currentColor;
    border-radius: 3px;
    background: var(--canvas);
  }
  /** 掴めることの印。**ホバーしている間だけ。** 静止時は図を汚さない。 */
  .grips {
    opacity: 0;
    pointer-events: none;
  }
  .node:hover .grips,
  .node:focus-visible .grips {
    opacity: 1;
  }
  .node text {
    user-select: none;
    pointer-events: none;
  }
</style>
