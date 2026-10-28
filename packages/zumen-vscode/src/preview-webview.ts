/**
 * `.zumen.yaml` のプレビューの中で動く台本。
 *
 * 拡張から正本の文字が届くたびに描き直す。**描けなかったら、前の図を薄くして理由を上に出す。**
 * 図ごと消すと、書きかけの 1 文字ごとに画面が白く点滅して読めない。
 */
import { draw, failure, themeOf } from './draw.ts';

const status = document.getElementById('status')!;
const diagram = document.getElementById('diagram')!;

let latest = 0;

async function show(source: string): Promise<void> {
  const turn = ++latest;
  const drawn = await draw(source, themeOf(document.body.classList));
  // 描いている間に次の文字が届いていたら、古いほうは捨てる。
  if (turn !== latest) return;

  if (drawn.ok) {
    status.innerHTML = '';
    diagram.innerHTML = drawn.svg;
    diagram.classList.remove('stale');
    return;
  }
  status.innerHTML = failure(drawn.message);
  diagram.classList.add('stale');
}

let current = '';

window.addEventListener('message', (event: MessageEvent<{ type: string; source?: string }>) => {
  if (event.data.type !== 'source' || typeof event.data.source !== 'string') return;
  current = event.data.source;
  void show(current);
});

// 色の決まりが変わったら（ライト ⇄ ダーク）、同じ正本を描き直す。
new MutationObserver(() => void show(current)).observe(document.body, { attributes: true, attributeFilter: ['class'] });

declare function acquireVsCodeApi(): { postMessage: (message: unknown) => void };
acquireVsCodeApi().postMessage({ type: 'ready' });
