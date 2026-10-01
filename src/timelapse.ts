/**
 * **図が育つところを、1 本の絵にする**（2026-09-16）。
 *
 * ## なぜ要るか
 *
 * 「外形 → 部屋 → 建具 → 寸法」と積み上がる様子は、**出来上がった図より雄弁**で、
 * 人に渡すときにいちばん効く。ところがそれを作るのに**画面録画**が要った ——
 * 画面の前に人が座っていないと作れない。**リモートで作れない機能は、無いのと同じ。**
 *
 * ## 依存を増やさない（ベースルール §1・§12）
 *
 * 動画の符号化器は同梱しない。出すのは
 *
 * | | |
 * |---|---|
 * | `svg` | **1 枚で動く SVG。** 開けば再生される（CSS のキーフレーム） |
 * | `frames` | 同じ大きさに揃えた連番の SVG |
 * | `recipe` | mp4 / webm が要る人のための、手元の道具で作る手順 |
 *
 * **SMIL は使わない。** 実装が減らされる話が続いていて、
 * 静止画に落ちたときに「動かないけど何も言わない」形になる。
 * CSS のキーフレームなら、少なくとも最後の段が出る。
 *
 * ## 揃えるのが肝
 *
 * 段ごとに紙の大きさが変わる（注記が増えれば紙は伸びる）。
 * **いちばん大きい紙に全部を揃える** —— 揃えないと、段のたびに絵が跳ねる。
 * 手で作ったときに実際に踏んだ。
 */
import { kindOf } from './kind.ts';
import { layout } from './layout.ts';
import { messages } from './messages.ts';
import { render } from './render.ts';
import type { Intent, Theme } from './tokens.ts';

export interface TimelapseOptions {
  /** 1 段を映す秒数。 */
  hold?: number;
  theme?: Theme;
  intent?: Intent;
  /** 連番を置く場所。**手順の文字に出るだけで、ここでは書き込まない。** */
  out?: string;
}

export interface Timelapse {
  /** 1 枚で動く SVG。 */
  svg: string;
  /** 段ごとの SVG（紙の大きさは揃えてある）。 */
  frames: string[];
  /** 揃えた紙の大きさ。 */
  width: number;
  height: number;
  /** ぜんぶで何秒か。 */
  seconds: number;
  /** mp4 / webm の作り方。 */
  recipe: string;
}

const HOLD = 2;

/**
 * 段を並べて、動く 1 枚にする。
 *
 * **読めない段があれば、そこで止める。** 黙って飛ばすと、
 * 出来上がった動画から段が 1 つ消えていることに、誰も気づけない。
 */
export async function timelapse(
  steps: readonly string[],
  options: TimelapseOptions = {},
): Promise<Timelapse> {
  const m = messages().timelapse;
  if (steps.length < 2) throw new Error(m.needTwo);

  const drawn: { svg: string; w: number; h: number }[] = [];
  for (const [index, source] of steps.entries()) {
    try {
      const placed = await layout(source);
      const svg = render(placed, options.theme, options.intent, kindOf(source) === 'placement');
      const found = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
      if (found === null) throw new Error(m.noPaper);
      drawn.push({ svg, w: Number(found[1]), h: Number(found[2]) });
    } catch (error) {
      // **何段目で止まったかを言う。** 「読めません」だけでは直しようがない。
      throw new Error(m.stepBroken(index + 1, String(error)));
    }
  }

  const width = Math.max(...drawn.map((one) => one.w));
  const height = Math.max(...drawn.map((one) => one.h));
  const frames = drawn.map((one) => resize(one.svg, width, height));
  const hold = options.hold === undefined ? HOLD : Math.max(0.2, options.hold);
  const seconds = Math.round(hold * steps.length * 100) / 100;

  return {
    svg: weave(frames, width, height, seconds),
    frames,
    width,
    height,
    seconds,
    recipe: recipeFor(options.out ?? '.', hold, width),
  };
}

/**
 * 紙を揃える。
 *
 * **中身は動かさない。** 左上を基準に、右と下へ紙を伸ばすだけ ——
 * 図の原点は段をまたいで同じなので、こうすると絵が止まって見える。
 */
function resize(svg: string, width: number, height: number): string {
  return svg
    .replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${width} ${height}"`)
    .replace(/width="[\d.]+" height="[\d.]+"/, `width="${width}" height="${height}"`)
    .replace(/<rect data-paper="1"[^/]*\/>/, `<rect data-paper="1" x="0" y="0" width="${width}" height="${height}" fill="${paperOf(svg)}"/>`);
}

/** その絵の地の色。**取り出せなければ白**（紙の無い絵は無い）。 */
function paperOf(svg: string): string {
  return /<rect data-paper="1"[^>]*fill="([^"]+)"/.exec(svg)?.[1] ?? '#ffffff';
}

/**
 * 段を 1 枚へ編む。
 *
 * **段は重ねて置き、順番に見せる。** 消す側を先に消してから次を出すのではなく、
 * **次を上に出す** —— 間に地の色が覗く一瞬が無くなる。
 */
function weave(frames: readonly string[], width: number, height: number, seconds: number): string {
  const each = 100 / frames.length;
  const style = frames
    .map((_, index) => {
      const from = index * each;
      const to = (index + 1) * each;
      // 最後の段は出たままにする（終わったら消える動画は、止め絵が要るときに困る）。
      const last = index === frames.length - 1;
      const keys = last
        ? `0%,${pc(from)}{opacity:0}${pc(from)},100%{opacity:1}`
        : `0%,${pc(from)}{opacity:0}${pc(from)},${pc(to)}{opacity:1}${pc(to)},100%{opacity:0}`;
      return (
        `@keyframes zumen-step-${index + 1}{${keys}}` +
        `[data-step="${index + 1}"]{opacity:0;animation:zumen-step-${index + 1} ${seconds}s linear infinite}`
      );
    })
    .join('');
  const layers = frames
    .map((frame, index) => `<g data-step="${index + 1}">${inner(frame)}</g>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<style>${style}</style>${layers}</svg>`
  );
}

/** パーセントを短く書く（`33.333%` のような桁を残さない）。 */
function pc(value: number): string {
  return `${Math.round(value * 100) / 100}%`;
}

/** SVG の中身だけ取り出す（外側の `<svg>` を剥がす）。 */
function inner(svg: string): string {
  const open = svg.indexOf('>');
  const close = svg.lastIndexOf('</svg>');
  return open < 0 || close < 0 ? svg : svg.slice(open + 1, close);
}

/**
 * mp4 / webm の作り方。
 *
 * **同梱しない理由を、手順そのものが語る** —— どちらも手元にある道具で、
 * zumen は SVG までしか作らない。
 */
function recipeFor(out: string, hold: number, width: number): string {
  const m = messages().timelapse;
  return [
    m.recipeHead,
    `  cd ${out}`,
    `  for f in step-*.svg; do chrome --headless --disable-gpu --screenshot="\${f%.svg}.png" --window-size=${Math.round(width)},H "$f"; done`,
    `  ffmpeg -y -framerate ${Math.round((1 / hold) * 100) / 100} -pattern_type glob -i 'step-*.png' \\`,
    `    -vf "fps=30,format=yuv420p" -c:v libx264 -crf 22 -movflags +faststart timelapse.mp4`,
    m.recipeTail,
  ].join('\n');
}
