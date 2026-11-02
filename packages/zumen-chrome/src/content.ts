/**
 * github.com の上で動く見張り役。**小さく保つ**（GitHub のすべてのページで読まれる）。
 *
 * zumen の正本を見つけたときだけ、描画の本体（`draw.js`）を読み込み、
 * 正本の上に図の欄を足す。**元の文字は消さない**（正本は文字のまま。図は読むための補助）。
 *
 * GitHub はページを入れ替えずに中身だけ差し替えるので、DOM の変化を見張って描き直す。
 * **通信しない。** 正本は拡張の中で描き、外へ送らない。
 */
import { BLOB_TEXT_SELECTOR, FENCE_SELECTOR, PANEL_CLASS, isZumenBlobPath, themeOf, type Theme } from './github.ts';

/** 使う分だけの形。`@types/chrome` を足さずに済ませる。 */
declare const chrome: { runtime: { getURL(path: string): string } };

type DrawHtml = (source: string, theme: Theme) => Promise<string>;

const SOURCE_ATTRIBUTE = 'data-zumen-source';
let drawer: Promise<DrawHtml> | undefined;

function loadDrawer(): Promise<DrawHtml> {
  drawer ??= import(/* @vite-ignore */ chrome.runtime.getURL('draw.js')).then((m: { drawHtml: DrawHtml }) => m.drawHtml);
  return drawer;
}

function currentTheme(): Theme {
  return themeOf(document.documentElement.dataset.colorMode, matchMedia('(prefers-color-scheme: dark)').matches);
}

/** 正本の前に置く欄。折りたためるようにして、文字を読みたい人の邪魔をしない。 */
function panelFor(source: string): HTMLDetailsElement {
  const panel = document.createElement('details');
  panel.open = true;
  panel.className = PANEL_CLASS;
  panel.setAttribute(SOURCE_ATTRIBUTE, source);
  panel.style.cssText = 'margin:0 0 16px;border:1px solid var(--borderColor-default,#d0d7de);border-radius:6px;padding:8px 12px';
  panel.innerHTML = '<summary style="cursor:pointer;font-weight:600">zumen</summary><div style="overflow:auto;margin-top:8px">…</div>';
  return panel;
}

async function fill(panel: HTMLElement, theme: Theme): Promise<void> {
  const body = panel.querySelector('div');
  if (body === null) return;
  const drawHtml = await loadDrawer();
  body.innerHTML = await drawHtml(panel.getAttribute(SOURCE_ATTRIBUTE) ?? '', theme);
  const svg = body.querySelector('svg');
  if (svg !== null) svg.style.cssText = 'max-width:100%;height:auto;display:block';
}

/** まだ欄の無い正本に、欄を足す。 */
function scan(): void {
  const theme = currentTheme();

  for (const pre of document.querySelectorAll<HTMLElement>(FENCE_SELECTOR)) {
    // GitHub は囲みを写しボタン用の入れ物で包む。欄はその外の前に置く。
    const host = pre.closest<HTMLElement>('.snippet-clipboard-content') ?? pre;
    if (host.previousElementSibling?.classList.contains(PANEL_CLASS)) continue;
    const panel = panelFor(pre.textContent ?? '');
    host.before(panel);
    void fill(panel, theme);
  }

  if (!isZumenBlobPath(location.pathname)) return;
  const text = document.querySelector<HTMLTextAreaElement>(BLOB_TEXT_SELECTOR);
  const section = text?.closest('section');
  if (text == null || section == null) return;
  const existing = section.querySelector<HTMLElement>(`:scope > .${PANEL_CLASS}`);
  // 別のファイルへ移ると、同じ section の中身だけが替わる。正本が違えば描き直す。
  if (existing?.getAttribute(SOURCE_ATTRIBUTE) === text.value) return;
  existing?.remove();
  const panel = panelFor(text.value);
  section.prepend(panel);
  void fill(panel, theme);
}

/** 色が変わったら、描いた欄を全部その色で描き直す。 */
function redrawAll(): void {
  const theme = currentTheme();
  for (const panel of document.querySelectorAll<HTMLElement>(`.${PANEL_CLASS}`)) void fill(panel, theme);
}

let pending: number | undefined;
function scheduleScan(): void {
  if (pending !== undefined) clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = undefined;
    scan();
  }, 300);
}

new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
scan();
