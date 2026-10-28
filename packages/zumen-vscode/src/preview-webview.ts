/**
 * `.zumen.yaml` のプレビューの中で動く台本。
 *
 * 拡張から正本の文字が届くたびに描き直す。**描けなかったら、前の図を薄くして理由を上に出す。**
 * 図ごと消すと、書きかけの 1 文字ごとに画面が白く点滅して読めない。
 *
 * 保存（SVG・PNG）はライトの地で描き直して、中身を拡張へ渡す（`save.ts`）。
 */
import { draw, failure, themeOf } from './draw.ts';
import { PNG_SCALE, svgSize, type SaveFormat } from './save.ts';

declare function acquireVsCodeApi(): { postMessage: (message: unknown) => void };
const vscode = acquireVsCodeApi();

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

async function save(format: SaveFormat): Promise<void> {
  const drawn = await draw(current, 'light');
  // 描けない正本は保存しない。理由はもう画面に出ている。
  if (!drawn.ok) return;
  if (format === 'svg') {
    vscode.postMessage({ type: 'save', format, data: drawn.svg });
    return;
  }
  vscode.postMessage({ type: 'save', format, data: await toPng(drawn.svg) });
}

/** SVG を絵にする。地は白で塗る（透明のまま貼ると、暗い地で線が消える）。 */
function toPng(svg: string): Promise<string> {
  const size = svgSize(svg) ?? { width: 800, height: 600 };
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(size.width * PNG_SCALE);
      canvas.height = Math.round(size.height * PNG_SCALE);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('png'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

document.getElementById('save-svg')!.addEventListener('click', () => void save('svg'));
document.getElementById('save-png')!.addEventListener('click', () => void save('png'));

vscode.postMessage({ type: 'ready' });
