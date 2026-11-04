/**
 * エクスプローラーの「zumen」の欄の中で動く台本。
 *
 * 拡張から届いたファイルの一覧を、検索欄で絞ってカードに並べる。
 * **サムネイルは見えているカードから 1 枚ずつ描く**（描画は ELK を回すので重い。全部を一度に描かない）。
 * 押すと、拡張にそのファイルを開いてもらう。
 */
import { draw, failure, themeOf } from './draw.ts';
import { escapeHtml } from './fence.ts';
import { search, type GalleryFile } from './gallery.ts';

declare function acquireVsCodeApi(): { postMessage: (message: unknown) => void };
const vscode = acquireVsCodeApi();

const query = document.getElementById('query') as HTMLInputElement;
const count = document.getElementById('count')!;
const list = document.getElementById('list')!;
const empty = document.getElementById('empty')!;

let files: GalleryFile[] = [];
let more = 0;
/** 描いたサムネイル。鍵は「ファイル・色・中身」—— 中身か色が変われば描き直す。 */
const drawn = new Map<string, string>();

function cacheKey(file: GalleryFile): string {
  return `${file.key}\n${themeOf(document.body.classList)}\n${file.source}`;
}

function render(): void {
  const shown = search(files, query.value);
  empty.hidden = files.length > 0;
  count.textContent = files.length === 0 ? '' : `${shown.length} / ${files.length}${more > 0 ? ` (+${more} not loaded)` : ''}`;
  list.innerHTML = shown
    .map(
      (file) =>
        `<button class="card" type="button" data-key="${escapeHtml(file.key)}" title="${escapeHtml(file.path)}">` +
        `<div class="thumb">${drawn.get(cacheKey(file)) ?? '<span class="wait">…</span>'}</div>` +
        `<div class="title">${escapeHtml(file.title)}</div><div class="path">${escapeHtml(file.path)}</div></button>`,
    )
    .join('');
  for (const card of list.querySelectorAll<HTMLElement>('.card')) watcher.observe(card);
}

/** 見えたカードを、1 枚ずつ順に描く。 */
const queue: HTMLElement[] = [];
let drawing = false;
const watcher = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    watcher.unobserve(entry.target);
    queue.push(entry.target as HTMLElement);
  }
  void drain();
});

async function drain(): Promise<void> {
  if (drawing) return;
  drawing = true;
  while (queue.length > 0) {
    const card = queue.shift()!;
    const file = files.find((f) => f.key === card.dataset.key);
    if (file === undefined || !card.isConnected) continue;
    const key = cacheKey(file);
    if (!drawn.has(key)) {
      const result = await draw(file.source, themeOf(document.body.classList));
      // 描けない図も一覧には残す。理由を小さく出す（黙って空にすると、壊れていることに気づけない）。
      drawn.set(key, result.ok ? result.svg : `<div class="error">${failure(result.message)}</div>`);
    }
    const thumb = card.querySelector('.thumb');
    if (thumb !== null) thumb.innerHTML = drawn.get(key)!;
  }
  drawing = false;
}

list.addEventListener('click', (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>('.card');
  if (card?.dataset.key) vscode.postMessage({ type: 'open', key: card.dataset.key });
});
query.addEventListener('input', render);

window.addEventListener('message', (event: MessageEvent<{ type: string; files?: GalleryFile[]; more?: number }>) => {
  if (event.data.type !== 'files' || !Array.isArray(event.data.files)) return;
  files = event.data.files;
  more = event.data.more ?? 0;
  render();
});

// 色の決まりが変わったら（ライト ⇄ ダーク）、描き直す。
new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ['class'] });
vscode.postMessage({ type: 'ready' });
