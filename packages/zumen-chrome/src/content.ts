/**
 * github.com の上で動く見張り役。**小さく保つ**（GitHub のすべてのページで読まれる）。
 *
 * zumen の正本を見つけたときだけ、描画の本体（`draw.js`）を読み込み、
 * 正本の上に図の欄を足す。**元の文字は消さない**（正本は文字のまま。図は読むための補助）。
 *
 * PR の差分の画面では、変わった `*.zumen.yaml` ごとに、変更前と変更後の図を並べる。
 *
 * GitHub はページを入れ替えずに中身だけ差し替えるので、DOM の変化を見張って描き直す。
 * **GitHub の外へは何も送らない。** 正本は拡張の中で描く。読むのは PR の変更前・変更後の正本だけで、
 * それも github.com から（いまのログインのまま）。
 */
import {
  BLOB_TEXT_SELECTOR,
  FENCE_SELECTOR,
  PANEL_CLASS,
  isZumenBlobPath,
  isZumenFile,
  pathsOf,
  pullOf,
  rawUrl,
  revisionsOf,
  themeOf,
  type Theme,
} from './github.ts';

/** 使う分だけの形。`@types/chrome` を足さずに済ませる。 */
declare const chrome: { runtime: { getURL(path: string): string } };

interface Drawer {
  drawHtml(source: string, theme: Theme): Promise<string>;
  compareHtml(before: string | null, after: string | null, theme: Theme): Promise<string>;
}

const SOURCE_ATTRIBUTE = 'data-zumen-source';
/** 図を欄の幅に収める。 */
const FIT = 'max-width:100%;height:auto;display:block';
/** 差分の欄の鍵（commit 2 つとファイル）。GitHub は差分の入れ物を別のファイルに使い回すので、鍵で見分ける。 */
const COMPARE_ATTRIBUTE = 'data-zumen-compare';
/** 差分の欄が持つ、変更前と変更後の正本。 */
const pairs = new WeakMap<HTMLElement, { before: string | null; after: string | null }>();
let drawer: Promise<Drawer> | undefined;

function loadDrawer(): Promise<Drawer> {
  drawer ??= import(/* @vite-ignore */ chrome.runtime.getURL('draw.js')) as Promise<Drawer>;
  return drawer;
}

function currentTheme(): Theme {
  return themeOf(document.documentElement.dataset.colorMode, matchMedia('(prefers-color-scheme: dark)').matches);
}

/** 正本の前に置く欄。折りたためるようにして、文字を読みたい人の邪魔をしない。 */
function panelFor(source: string, title = 'zumen'): HTMLDetailsElement {
  const panel = document.createElement('details');
  panel.open = true;
  // **ページの自動翻訳に、図の文字と見出しを訳させない**（GitHub の囲みと同じ notranslate）。
  // 訳すと、図の名前が正本とずれる（2026-11-02、実物で「zumen」が「ズメン」になった）。
  panel.className = `${PANEL_CLASS} notranslate`;
  panel.translate = false;
  panel.setAttribute(SOURCE_ATTRIBUTE, source);
  panel.style.cssText = 'margin:0 0 16px;border:1px solid var(--borderColor-default,#d0d7de);border-radius:6px;padding:8px 12px';
  panel.innerHTML = `<summary style="cursor:pointer;font-weight:600">${title}</summary><div style="overflow:auto;margin-top:8px">…</div>`;
  return panel;
}

async function fill(panel: HTMLElement, theme: Theme): Promise<void> {
  const body = panel.querySelector('div');
  if (body === null) return;
  const draw = await loadDrawer();
  const pair = pairs.get(panel);
  if (panel.hasAttribute(COMPARE_ATTRIBUTE) && pair === undefined) return; // 正本をまだ読んでいる
  body.innerHTML = pair
    ? await draw.compareHtml(pair.before, pair.after, theme)
    : await draw.drawHtml(panel.getAttribute(SOURCE_ATTRIBUTE) ?? '', theme);
  const svg = body.querySelector('svg');
  if (svg === null) return;
  svg.style.cssText = FIT;
  // 前後の比較は 2 枚並ぶので、欄の幅に収めると「新」「人」の印が読めない。元の大きさでは 1 画面に入らない
  // （2026-11-02、PR の実物で 3188 px）。**収めて全体を見せ、押すと元の大きさ**にする。印の中身は上の行に字で出す。
  if (pair) {
    svg.style.cursor = 'zoom-in';
    svg.addEventListener('click', () => {
      const zoomed = svg.style.maxWidth === 'none';
      svg.style.cssText = zoomed ? FIT : 'display:block;max-width:none';
      svg.style.cursor = zoomed ? 'zoom-in' : 'zoom-out';
    });
  }
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

  scanPull(theme);

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

/** PR の差分の画面で、変わった `*.zumen.yaml` ごとに、変更前と変更後を並べる欄を足す。 */
function scanPull(theme: Theme): void {
  const pull = pullOf(location.pathname);
  if (pull === null) return;
  const embedded = document.querySelector('script[data-target="react-app.embeddedData"]')?.textContent;
  const revisions = embedded ? revisionsOf(embedded) : null;
  if (revisions === null) return;

  // ファイルごとの入れ物は `diff-<場所の SHA-256>`。見えている分だけが DOM にある（残りは流すと現れる）。
  for (const file of document.querySelectorAll<HTMLElement>('div[id^="diff-"]')) {
    if (!/^diff-[0-9a-f]{64}$/.test(file.id)) continue;
    const heading = file.querySelector('h3 code')?.textContent;
    if (!heading) continue;
    const paths = pathsOf(heading);
    if (!isZumenFile(paths.after) && !isZumenFile(paths.before)) continue;

    const key = `${revisions.base}..${revisions.head}:${paths.before}:${paths.after}`;
    const existing = file.querySelector<HTMLElement>(`:scope > .${PANEL_CLASS}`);
    if (existing?.getAttribute(COMPARE_ATTRIBUTE) === key) continue;
    existing?.remove();

    const panel = panelFor('', 'zumen —— 変更前 → 変更後');
    panel.setAttribute(COMPARE_ATTRIBUTE, key);
    panel.style.margin = '8px';
    (file.firstElementChild ?? file).after(panel);
    void Promise.all([
      readRaw(rawUrl(pull.owner, pull.repo, revisions.base, paths.before)),
      readRaw(rawUrl(pull.owner, pull.repo, revisions.head, paths.after)),
    ]).then(([before, after]) => {
      pairs.set(panel, { before, after });
      return fill(panel, theme);
    });
  }
}

/**
 * その commit に無ければ（足した・消したファイル）null。
 * 鍵は github.com の分だけ送る（既定の same-origin）。raw は raw.githubusercontent.com へ転送され、
 * そこへ鍵を送ると「誰でも可」の許可と噛み合わず読めなくなる（非公開のリポは転送先の URL が鍵を持つ）。
 */
async function readRaw(url: string): Promise<string | null> {
  const response = await fetch(url);
  return response.ok ? response.text() : null;
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
