/**
 * VS Code の Markdown プレビューの中で動く台本。
 *
 * `fence.ts` が置いた置き場を探して、図に差し替える。
 * プレビューは本文が変わるたびに中身を入れ替え、そのとき `vscode.markdown.updateContent` を出す。
 * 置き場は指定（`data-zumen`）を持ったまま残るので、色が変わったときも同じ指定から描き直せる。
 */
import { draw, failure, themeOf } from './draw.ts';
import { BLOCK_CLASS, SOURCE_ATTRIBUTE, escapeHtml } from './fence.ts';

async function drawAll(): Promise<void> {
  const theme = themeOf(document.body.classList);
  const blocks = document.querySelectorAll<HTMLElement>(`.${BLOCK_CLASS}`);
  for (const block of blocks) {
    const source = block.getAttribute(SOURCE_ATTRIBUTE) ?? '';
    const drawn = await draw(source, theme);
    // 描けなかったら、理由の下に指定をそのまま残す（消すと、書いた人が気づかない）。
    block.innerHTML = drawn.ok ? drawn.svg : failure(drawn.message) + `<pre><code>${escapeHtml(source)}</code></pre>`;
  }
}

window.addEventListener('vscode.markdown.updateContent', () => void drawAll());
new MutationObserver(() => void drawAll()).observe(document.body, { attributes: true, attributeFilter: ['class'] });
void drawAll();
