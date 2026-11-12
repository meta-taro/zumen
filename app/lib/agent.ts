/**
 * **エージェント専用カーソル**（画面の側）。MCP の `zumen_screen` から線で降りてきた指示を、画面の中で演じる。
 *
 * 紫の矢印と名札「エージェント」が、画面に見えている言葉で指された所へ 0.65 秒で動き、
 * 指した所を約 2.6 秒囲み、黄色の吹き出しで一言いう。押すときは輪が広がる。
 * **人のマウスとキーボードは使わない** —— 押す・打つはページの中で起こす（`mousedown` ＋ `click`、`input` ＋ `change`）。
 *
 * ## 人の承認は押さない
 *
 * `data-human-only` の付いたボタン（正本へ入れる・やめる・食い違いの決着・見た・保存・開く・印刷）は、
 * 押そうとしても押さずに「人が押すボタンです」と言う。**承認の代わりをする流れを作らない。**
 * `pnpm gui:check` が、押されないことを見張る。
 *
 * 置き場所と表示時間の計算は `src/live/agent.ts`（node で試験できる側）。ここは DOM だけ。
 */
import { BUBBLE_MAX_W, bubblePlacement, showMs, type AgentAction } from '../../src/live/agent.ts';

export interface AgentWords {
  name: string;
  notFound: (target: string) => string;
  humanOnly: (target: string) => string;
  notField: (target: string) => string;
  close: string;
}

/** 試験と人のための、最後に何をしたか（`document.documentElement.dataset.agentLast`）。 */
export type AgentOutcome = 'pointed' | 'clicked' | 'typed' | 'went' | 'said' | 'not-found' | 'human-only' | 'not-field';

const MOVE_MS = 650;
const HIGHLIGHT_MS = 2600;
const HIDE_AFTER_MS = 6000;
/** モーダルやトーストより上（App の最前面は z-index 50）。 */
const Z = 2147483000;

/** 言葉で探す相手。**人が押せる・読めるもの**だけ。 */
const CANDIDATES =
  'button, a[href], [role="button"], input, textarea, select, label, summary, h1, h2, h3, h4, [aria-label], [title], [id], [data-act]';

const CSS = `
.agent-layer{position:fixed;inset:0;pointer-events:none;z-index:${Z}}
.agent-cursor{position:fixed;left:0;top:0;transition:transform ${MOVE_MS}ms cubic-bezier(.2,.7,.2,1),opacity .3s;opacity:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))}
.agent-cursor.on{opacity:1}
.agent-name{position:absolute;left:18px;top:20px;background:#5e6ad2;color:#fff;font:600 11px/1.6 system-ui,sans-serif;padding:0 6px;border-radius:4px;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}
.agent-ring{position:fixed;width:12px;height:12px;margin:-6px 0 0 -6px;border:2px solid #5e6ad2;border-radius:50%;animation:agent-ring .6s ease-out forwards}
@keyframes agent-ring{to{transform:scale(4);opacity:0}}
.agent-highlight{position:fixed;border:2px solid #5e6ad2;border-radius:4px;box-shadow:0 0 0 3px rgba(94,106,210,.25);transition:opacity .3s}
.agent-bubble{position:fixed;max-width:${BUBBLE_MAX_W}px;background:#ffd166;color:#1d1d1f;font:13px/1.5 system-ui,sans-serif;padding:8px 26px 8px 10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.25);pointer-events:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.agent-bubble .agent-x{position:absolute;right:4px;top:2px;border:0;background:none;font:16px/1 system-ui;cursor:pointer;color:#1d1d1f}
.agent-tail{position:fixed;width:10px;height:10px;margin:-5px 0 0 -5px;background:#ffd166;transform:rotate(45deg)}
`;

export class AgentCursor {
  #words: AgentWords;
  #layer: HTMLElement | null = null;
  #cursor: HTMLElement | null = null;
  #queue: Promise<void> = Promise.resolve();
  #hideTimer: ReturnType<typeof setTimeout> | null = null;
  #at = { x: 0, y: 0 };

  constructor(words: AgentWords) {
    this.#words = words;
  }

  /** **届いた順に 1 つずつ**演じる（前の動きが終わってから次へ）。 */
  run(action: AgentAction): Promise<void> {
    this.#queue = this.#queue.then(() => this.#play(action)).catch(() => {});
    return this.#queue;
  }

  async #play(action: AgentAction): Promise<void> {
    this.#mount();
    if (action.action === 'say') {
      this.#bubble(action.message ?? '', this.#cursorRect(), action.seconds);
      return this.#done('said');
    }
    if (action.action === 'go') {
      // **画面の中だけ。** `#` で始まらないものは MCP が通さない
      if (action.target !== null && action.target.startsWith('#')) location.hash = action.target;
      if (action.message) this.#bubble(action.message, this.#cursorRect(), action.seconds);
      return this.#done('went');
    }
    const target = action.target ?? '';
    const el = findTarget(target, this.#layer);
    if (el === null) {
      this.#bubble(this.#words.notFound(target), centerRect(), action.seconds);
      return this.#done('not-found');
    }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const rect = el.getBoundingClientRect();
    await this.#moveTo(rect);
    this.#highlight(rect);

    if (action.action === 'click' || action.action === 'type') {
      if (el.closest('[data-human-only]') !== null) {
        this.#bubble(this.#words.humanOnly(target), rect, action.seconds);
        return this.#done('human-only');
      }
    }
    if (action.action === 'click') {
      this.#ring();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
      (el as HTMLElement).click();
      if (action.message) this.#bubble(action.message, rect, action.seconds);
      return this.#done('clicked');
    }
    if (action.action === 'type') {
      const field = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el : null;
      if (field === null) {
        this.#bubble(this.#words.notField(target), rect, action.seconds);
        return this.#done('not-field');
      }
      field.focus();
      // Svelte の bind が拾えるよう、値はプロトタイプの setter で入れる
      const proto = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(field, action.text ?? '');
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      if (action.message) this.#bubble(action.message, rect, action.seconds);
      return this.#done('typed');
    }
    // point
    if (action.message) this.#bubble(action.message, rect, action.seconds);
    return this.#done('pointed');
  }

  #done(outcome: AgentOutcome): void {
    document.documentElement.dataset.agentLast = outcome;
  }

  #mount(): void {
    if (this.#layer !== null && this.#layer.isConnected) return;
    if (document.getElementById('agent-style') === null) {
      const style = document.createElement('style');
      style.id = 'agent-style';
      style.textContent = CSS;
      document.head.append(style);
    }
    const layer = document.createElement('div');
    layer.className = 'agent-layer';
    layer.dataset.agentLayer = '1';
    const cursor = document.createElement('div');
    cursor.className = 'agent-cursor';
    cursor.innerHTML =
      '<svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true"><path d="M2 2 L2 21 L7.5 16 L11 24 L14.5 22.5 L11 14.8 L18.5 14.8 Z" fill="#5e6ad2" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    const name = document.createElement('span');
    name.className = 'agent-name';
    name.textContent = this.#words.name;
    cursor.append(name);
    layer.append(cursor);
    document.body.append(layer);
    this.#layer = layer;
    this.#cursor = cursor;
  }

  async #moveTo(rect: DOMRect): Promise<void> {
    const cursor = this.#cursor!;
    this.#at = { x: rect.left + Math.min(rect.width / 2, 24), y: rect.top + rect.height / 2 };
    cursor.classList.add('on');
    cursor.style.transform = `translate(${this.#at.x}px, ${this.#at.y}px)`;
    if (this.#hideTimer !== null) clearTimeout(this.#hideTimer);
    this.#hideTimer = setTimeout(() => cursor.classList.remove('on'), HIDE_AFTER_MS);
    await new Promise((done) => setTimeout(done, MOVE_MS));
  }

  #cursorRect(): DOMRect {
    return this.#cursor?.classList.contains('on') ? new DOMRect(this.#at.x, this.#at.y, 1, 1) : centerRect();
  }

  #highlight(rect: DOMRect): void {
    const box = document.createElement('div');
    box.className = 'agent-highlight';
    Object.assign(box.style, { left: `${rect.left - 3}px`, top: `${rect.top - 3}px`, width: `${rect.width + 6}px`, height: `${rect.height + 6}px` });
    this.#layer!.append(box);
    setTimeout(() => box.remove(), HIGHLIGHT_MS);
  }

  #ring(): void {
    const ring = document.createElement('div');
    ring.className = 'agent-ring';
    Object.assign(ring.style, { left: `${this.#at.x}px`, top: `${this.#at.y}px` });
    this.#layer!.append(ring);
    setTimeout(() => ring.remove(), 700);
  }

  /** 吹き出し。**窓の内側 8px に収め、しっぽは指した所へ。** マウスを乗せている間は消えない。 */
  #bubble(message: string, near: DOMRect, seconds: number | null): void {
    for (const old of this.#layer!.querySelectorAll('.agent-bubble, .agent-tail')) old.remove();
    const bubble = document.createElement('div');
    bubble.className = 'agent-bubble';
    bubble.setAttribute('role', 'status');
    bubble.textContent = message;
    const x = document.createElement('button');
    x.className = 'agent-x';
    x.textContent = '×';
    x.setAttribute('aria-label', this.#words.close);
    bubble.append(x);
    const tail = document.createElement('div');
    tail.className = 'agent-tail';
    this.#layer!.append(tail, bubble);

    const size = bubble.getBoundingClientRect();
    const at = bubblePlacement(
      { x: near.left, y: near.top, w: near.width, h: near.height },
      { w: size.width, h: size.height },
      { w: window.innerWidth, h: window.innerHeight },
    );
    Object.assign(bubble.style, { left: `${at.x}px`, top: `${at.y}px` });
    Object.assign(tail.style, { left: `${at.tail.x}px`, top: `${at.tail.y}px` });
    bubble.dataset.side = at.side;

    let hovered = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const remove = (): void => {
      bubble.remove();
      tail.remove();
    };
    const arm = (): void => {
      timer = setTimeout(() => (hovered ? arm() : remove()), showMs(message, seconds));
    };
    bubble.addEventListener('mouseenter', () => (hovered = true));
    bubble.addEventListener('mouseleave', () => (hovered = false));
    bubble.addEventListener('click', () => {
      if (timer !== null) clearTimeout(timer);
      remove();
    });
    arm();
  }
}

function centerRect(): DOMRect {
  return new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 1, 1);
}

/** 要素が持つ「見えている言葉」。 */
function wordsOf(el: Element): string[] {
  const out = [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('placeholder'),
    el.id || null,
    (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  ];
  return out.filter((w): w is string => w !== null && w !== '');
}

function visible(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/**
 * **画面に見えている言葉で探す。** 同じ言葉 → 含む言葉の順に、画面の上から。
 * 見つからなければ null（**近いものを当て推量で押さない**）。
 */
export function findTarget(target: string, layer: Element | null): Element | null {
  const want = target.replace(/\s+/g, ' ').trim();
  if (want === '') return null;
  const all = [...document.querySelectorAll(CANDIDATES)].filter((el) => (layer === null || !layer.contains(el)) && visible(el));
  const byTop = (a: Element, b: Element): number => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return ra.top - rb.top || ra.left - rb.left || ra.width * ra.height - rb.width * rb.height;
  };
  const exact = all.filter((el) => wordsOf(el).includes(want)).sort(byTop);
  if (exact.length > 0) return exact[0]!;
  const lower = want.toLowerCase();
  const partial = all.filter((el) => wordsOf(el).some((w) => w.toLowerCase().includes(lower))).sort(byTop);
  return partial[0] ?? null;
}
