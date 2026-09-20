/**
 * コマンドの口。検証（Issue 014）と Git のマージドライバ（Issue 011）。
 *
 * 表示だけを持ち、判断は持たない。**判断は `src/validate.ts` にある。**
 * ここを厚くすると、同じ検査を GUI から呼びたくなったときに動かせなくなる
 * （ベースルール §9）。
 *
 * 終了コードの約束。
 *
 * | | 意味 |
 * |---|---|
 * | 0 | 読める（`merge-driver` では解けた）。**警告だけなら 0** |
 * | 1 | 読めない図がある（`merge-driver` では解けなかった） |
 * | 2 | 使い方が違う（引数が無い等） |
 *
 * **`merge-driver` の 1 は失敗ではなく、Git への「人が見る必要がある」の合図。**
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { toDrawio } from './drawio.ts';
import { tooThinForPattern } from './hatch.ts';
import { patternPeriod } from './line.ts';
import { renderZumenBlocks, replaceZumenBlocks } from './embed.ts';
import { mergeThreeWay } from './git-merge.ts';
import { crossingPlaces, edgesUnderBoxes, layout, straddlePlaces, straddles } from './layout.ts';
import { PASS_LINE, measure, percent } from './measure.ts';
import { merge } from './merge.ts';
import type { Conflict } from './merge.ts';
import { toMermaid } from './mermaid.ts';
import { overlappingInk, render, viewTitleBox } from './render.ts';
import { timelapse } from './timelapse.ts';
import { inspect } from './tools.ts';
import { kindOf } from './kind.ts';
import { messages } from './messages.ts';
import { hasError, validate } from './validate.ts';
import { adriftDetails, crowdedNames, extentOf, hiddenTags, planNames } from './names.ts';
import { projection, smallestTextOf } from './projection.ts';
import type { Finding } from './validate.ts';
import { isEntry } from './entry.ts';

export interface RunResult {
  code: number;
  lines: string[];
}

/**
 * 検証を走らせて、出す行と終了コードを返す。
 *
 * **画面へは書かない。** 戻り値にしておくと、そのままテストで読める。
 */
export async function runValidate(paths: string[], read = readFileSync): Promise<RunResult> {
  const m = messages().cli;
  if (paths.length === 0) return { code: 2, lines: [m.usage] };

  const lines: string[] = [];
  let unreadable = 0;
  let warnings = 0;

  for (const path of paths) {
    let text: string;
    try {
      text = String(read(path, 'utf8'));
    } catch (error) {
      // 読めないファイルは、そこで止めずに次を見る。まとめて出したほうが直しやすい。
      unreadable += 1;
      lines.push(m.fileUnreadable(path, error instanceof Error ? error.message : String(error)));
      continue;
    }

    const findings = validate(text);
    // **置いたあとの形も見る**（配置図だけ。2026-09-14）。
    //
    // `validate` は正本だけを読むので、**「書いたのに読めない」状態が分からない。**
    // 文字どうしの重なりは置いてみるまで決まらず、
    // これまで `zumen_inspect` を叩けるエージェントにしか見えていなかった。
    // **人が CLI で確かめられないのは、片手落ちだった。**
    const laid = hasError(findings) ? [] : await placedFindings(text);
    const all = [...findings, ...laid];
    if (all.length === 0) continue;

    lines.push(m.fileHeading(path));
    for (const finding of all) lines.push(`  ${format(finding)}`);
    if (hasError(all)) unreadable += 1;
    warnings += all.filter((finding) => finding.severity === 'warning').length;
  }

  if (unreadable > 0) {
    lines.push(m.failed(unreadable));
    return { code: 1, lines };
  }
  lines.push(warnings > 0 ? m.warningsOnly(warnings) : m.allClear(paths.length));
  return { code: 0, lines };
}

/**
 * **長辺の両端にいる要素**（`too-small-to-print` に添える）。
 *
 * 「あと 89px 詰めてください」までは出ていたが、**どこを詰めるかは出ていなかった。**
 * 長辺が縦か横かも、その端に何がいるかも、図を目で探すしかない ——
 * PDCA の直近 5 周のうち 4 周で、ここに 3〜4 往復とられた（2026-09-19）。
 */
function endsOfLongSide(
  placed: { boxes: { id: string; x: number; y: number; w: number; h: number }[] },
  vertical: boolean,
): [string, string] {
  if (placed.boxes.length === 0) return ['', ''];
  const low = (b: { x: number; y: number }): number => (vertical ? b.y : b.x);
  const high = (b: { x: number; y: number; w: number; h: number }): number =>
    vertical ? b.y + b.h : b.x + b.w;
  let head = placed.boxes[0]!;
  let tail = placed.boxes[0]!;
  for (const box of placed.boxes) {
    if (low(box) < low(head)) head = box;
    if (high(box) > high(tail)) tail = box;
  }
  return [head.id, tail.id];
}

/**
 * **長辺の向きで、いちばん空いている帯**（2026-09-19）。
 *
 * 「あと N px 詰めてください」まで言えるようになったが、
 * **どこを詰めればよいかは、まだ当て推量だった** ——
 * 1 枚の見本で 3 往復したことが今日 4 回あった。
 * 中身が 1 つも無い帯を見つけて、その場所と幅を返す。
 * **節の間の空きは、たいてい意図ではなく余り。**
 */
/** 空いている帯を、文言へ渡す 4 つの文字にする（無ければ空文字 4 つ）。 */
function gapWords(
  gap: { at: number; to: number } | null,
  vertical: boolean,
): [string, string, string, string] {
  if (gap === null) return ['', '', '', ''];
  return [
    vertical ? 'y' : 'x',
    String(Math.round(gap.at)),
    String(Math.round(gap.to)),
    String(Math.round(gap.to - gap.at)),
  ];
}

function widestGap(
  placed: { boxes: { x: number; y: number; w: number; h: number }[] },
  vertical: boolean,
): { at: number; to: number } | null {
  if (placed.boxes.length < 2) return null;
  const span = placed.boxes
    .map((b) => (vertical ? { a: b.y, b: b.y + b.h } : { a: b.x, b: b.x + b.w }))
    .sort((x, y) => x.a - y.a);
  let edge = span[0]!.b;
  let best: { at: number; to: number } | null = null;
  for (const s of span) {
    if (s.a > edge && (best === null || s.a - edge > best.to - best.at)) best = { at: edge, to: s.a };
    edge = Math.max(edge, s.b);
  }
  // **20px 未満は、行と行のあいだ**。詰めても効かないし、詰めると読めなくなる。
  return best !== null && best.to - best.at >= 20 ? best : null;
}

/**
 * **置いてみないと分からない指摘**（配置図だけ）。
 *
 * 構成図では置き場所を機械が決めるので、重なりは起きない。
 * ここで見るのは**文字どうしの重なり**だけ —— 交差は合否ではなく観測値なので出さない
 * （`src/layout.ts`。AI にも人にも自己採点させない）。
 */
export async function placedFindings(text: string): Promise<Finding[]> {
  let placed;
  try {
    placed = await layout(text);
  } catch {
    // 置けない図は、正本の指摘だけで足りる（描くときに同じ所で落ちる）。
    return [];
  }
  const plan = kindOf(text) === 'placement';

  // **A3 に印刷しても読めない紙**（2026-09-16。見本 155 を描いていて当たった）。
  //
  // この下限は `zumen_inspect` からしか見えておらず、`pnpm validate` は
  // 同じ図に「直すところはありませんでした」と言っていた。
  // **数の検査だけが知っている指摘は、人には無いのと同じ。**
  //
  // 投影の下限（`tooSmallToProject`）は出さない。**路線図・仕込図・積付図は
  // 印刷して読む図**で、鳴りっぱなしの指摘は読まれなくなる（`src/projection.ts`）。
  const paper = projection(placed.width, placed.height, smallestTextOf(placed, plan));
  const size: Finding[] = paper.tooSmallToPrint
    ? [
        {
          severity: 'warning' as const,
          code: 'too-small-to-print',
          /**
           * **直せる形で言う**（2026-09-18）。
           *
           * 比だけを返していたので、**何を詰めればよいかが分からなかった** ——
           * いちばん小さい字が何 px なのかも、長辺が何 px なのかも図から読めず、
           * 直す側は当て推量で紙を縮めることになる（宮殿の続き間で 3 回やり直した）。
           * **収まる長辺（`need`）まで出す。**
           */
          message: messages().validate.tooSmallToPrint(
            (paper.textRatio ?? 0).toFixed(4),
            paper.printFloor.toFixed(4),
            paper.smallestText,
            Math.round(paper.longestSide),
            Math.floor(paper.smallestText / paper.printFloor),
            placed.height >= placed.width
              ? messages().validate.alongVertical
              : messages().validate.alongHorizontal,
            ...endsOfLongSide(placed, placed.height >= placed.width),
            ...gapWords(widestGap(placed, placed.height >= placed.width), placed.height >= placed.width),
          ),
        },
      ]
    : [];

  /**
   * **刻みが 1 回も出そろわない線**（2026-09-20）。
   *
   * 破線も一点鎖線も、**線種そのものが意味**を持つ（`src/line.ts`）。
   * 刻みが 1 周しない長さだと、描かれるのは 1 本の短い実線で、**意味が消える。**
   * 測ったら見本 2 枚が実際にそうだった —— どちらも中心線・見えない線のつもりで引いたもの。
   */
  const short: Finding[] = placed.edges.flatMap((edge) => {
    const need = patternPeriod(edge.line);
    if (need === 0) return [];
    let length = 0;
    for (let i = 1; i < edge.points.length; i += 1) {
      const a = edge.points[i - 1]!;
      const b = edge.points[i]!;
      length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    if (length === 0 || length >= need) return [];
    return [
      {
        severity: 'warning' as const,
        code: 'line-too-short',
        message: messages().validate.lineTooShort(
          `${edge.from} → ${edge.to}`,
          edge.line,
          String(Math.round(length)),
          String(need),
        ),
      },
    ];
  });

  if (!plan) return [...size, ...short];
  const plans = planNames(placed.boxes, extentOf(placed.boxes), placed.edges, placed.groups);
  /**
   * **紙の上で数える**（2026-09-17）。
   *
   * `overlappingText` は節の名前どうししか見ない。符号・寸法の数値・通り芯の符号・
   * 図の名前は描く側が置いているので、**そこで重なっても 0 のまま**だった。
   * 描いた結果を数える検査は**テストの中にだけ**あり、
   * 自分の図を描く人には無いのと同じだった（`test/paper.test.ts` と同じ関数を呼ぶ）。
   */
  const said = (word: { text: string; id: string | null }): string =>
    word.id === null ? JSON.stringify(word.text) : `${JSON.stringify(word.text)}（${word.id}）`;
  const ink = overlappingInk(render(placed, 'light', 'safe', true)).map(([a, b, by]) => ({
    severity: 'warning' as const,
    code: 'text-overlap',
    message: messages().validate.inkOverlap(said(a), said(b), by.x, by.y),
  }));
  return [
    ...size,
    ...short,
    ...ink,
    // **広い箱から出ていった名前。** 表の欄が空に見える。
    /**
     * **入りきらず、外にも空きが無かった名前**（`crowdedNames`）。
     *
     * 何かの上に重なって出ている。文字の上なら `overlappingInk` が拾うが、
     * **箱の塗りの上に乗っただけなら拾えない。**
     * これも `zumen_inspect` からしか見えていなかった（2026-09-18。3 回目の同じ穴）。
     */
    ...crowdedNames(plans).map((id) => ({
      severity: 'warning' as const,
      code: 'name-crowded',
      message: messages().validate.nameCrowded(id),
    })),
    ...adriftDetails(placed.boxes, plans).map((found) => ({
      severity: 'warning' as const,
      code: 'name-adrift',
      message: messages().validate.nameAdrift(found.id, found.needs, found.has),
    })),
    // **書いたのに出ない符号。** 印が小さいと入らないので落としている。
    // 落とすのは正しいが、**黙って落とすと書いた側が気づけない。**
    ...hiddenTags(placed.boxes).map((id) => ({
      severity: 'warning' as const,
      code: 'tag-hidden',
      message: messages().validate.tagHidden(id),
    })),
    // **箱の塗りに隠れて消える線。** `arrows: false` は線を箱より先に描く。
    ...edgesUnderBoxes(placed).map(([edge, box]) => ({
      severity: 'warning' as const,
      code: 'edge-under-box',
      message: messages().validate.edgeUnderBox(edge, box),
    })),
    /**
     * **図の名前が、中身の上に乗っている**（2026-09-19）。
     *
     * `views[].title` は**図の下辺のすぐ下**に描かれる。だから
     * `size` に書いた高さより中身が下へ出ていると、**名前がその上に乗る。**
     *
     * `overlappingInk` は文字どうししか見ないので、
     * **名前が箱の上に乗っただけでは拾えなかった** ——
     * 血球計算盤（見本 213）を描いていて、断面図の名前が計算盤の箱に
     * 重なっているのを**ブラウザで開いて初めて見つけた。**
     */
    ...viewTitlesCovered(placed),
    /**
     * **模様を頼んだのに、面が細すぎて 1 つも描かれない**（2026-09-20）。
     *
     * `hatch-unknown` は知らない語を拾い、`hatch-ignored` は配置図でない図を拾うが、
     * **正しい語を正しい図に書いて、それでも何も出ない**場合は誰も見ていなかった。
     * 測ったら**見本 4 枚・9 節**がそうで、どれも「線のつもりで細い箱に模様を書いた」もの。
     * 出てくる図は無地と区別がつかないので、**書いた人は気づけない。**
     */
    ...placed.boxes
      .filter((box) => box.hatch !== 'none' && tooThinForPattern(box.hatch, box))
      .map((box) => ({
        severity: 'warning' as const,
        code: 'hatch-too-thin',
        message: messages().validate.hatchTooThin(box.id, box.hatch, Math.round(Math.min(box.w, box.h))),
      })),
  ];
}

/** 図の名前が、描かれた箱の上に乗っている組。 */
function viewTitlesCovered(placed: Awaited<ReturnType<typeof layout>>): Finding[] {
  const found: Finding[] = [];
  for (const view of placed.views) {
    const band = viewTitleBox(view);
    if (band === null) continue;
    for (const box of placed.boxes) {
      // **何も描かない節は乗られても見えない**（`marker: none`）。
      // 名前のある節は文字なので、文字どうしの重なりとして `overlappingInk` が拾う。
      if (box.marker === 'none') continue;
      const hit =
        box.x < band.x + band.w &&
        band.x < box.x + box.w &&
        box.y < band.y + band.h &&
        band.y < box.y + box.h;
      if (!hit) continue;
      found.push({
        severity: 'warning',
        code: 'view-title-covered',
        message: messages().validate.viewTitleCovered(view.id, box.id, Math.ceil(box.y + box.h - band.y + 6)),
      });
      break;
    }
  }
  return found;
}

function format(finding: Finding): string {
  const m = messages().cli;
  const label = finding.severity === 'error' ? m.severityError : m.severityWarning;
  const where = finding.line === undefined ? '' : `${finding.line}: `;
  return `[${label}] ${where}${finding.message}`;
}

/**
 * Git のマージドライバ。`base` / `ours` / `theirs` を受け取り、**結果を `ours` の場所へ書く**
 * （Git の約束。`%A` が出力先を兼ねる）。
 *
 * 終了コード 1 は失敗ではなく、**「人が見る必要がある」という Git への合図**。
 */
export function runMergeDriver(
  paths: string[],
  read = readFileSync,
  write = writeFileSync,
): RunResult {
  const m = messages().cli;
  const [base, ours, theirs] = paths;
  if (base === undefined || ours === undefined || theirs === undefined) {
    return { code: 2, lines: [m.usageMergeDriver] };
  }

  let result;
  try {
    result = mergeThreeWay(String(read(base, 'utf8')), String(read(ours, 'utf8')), String(read(theirs, 'utf8')));
  } catch (error) {
    // 構造で解けない（YAML として読めない等）なら、**Git の既定のマージへ委ねる。**
    // ここで勝手に片方を書くと、人の直しが黙って消える。
    return { code: 1, lines: [m.fileUnreadable(ours, error instanceof Error ? error.message : String(error))] };
  }

  write(ours, result.text);
  if (result.conflicts.length === 0) return { code: 0, lines: [m.mergedClean(ours)] };
  return { code: 1, lines: [m.mergedWithConflicts(ours, result.conflicts.length)] };
}

/**
 * draw.io の XML へ書き出す。
 *
 * **圧縮しない。** 差分が読めなくなる（`src/drawio.ts` の冒頭）。
 */
export async function runDrawio(
  paths: string[],
  read = readFileSync,
  write = writeFileSync,
): Promise<RunResult> {
  const m = messages().cli;
  const [input, output] = paths;
  if (input === undefined) return { code: 2, lines: [m.usageDrawio] };
  const target = output ?? `${input.replace(/\.zumen\.yaml$|\.yaml$/, '')}.drawio`;

  let text: string;
  try {
    text = String(read(input, 'utf8'));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(input, error instanceof Error ? error.message : String(error))] };
  }

  const placed = await layout(text);
  write(target, toDrawio(placed, titleOf(text) ?? input));
  return { code: 0, lines: [m.wrote(target)] };
}

/** 図の題。無ければ `undefined`。**無いものを埋めない。** */
function titleOf(text: string): string | undefined {
  const found = /^title:\s*(.+)$/m.exec(text);
  return found?.[1]?.trim();
}

/**
 * **観測値を見せる**（2026-09-20）。
 *
 * `crossings` と `straddles` は「**合否ではなく観測値**」と決めてあるので
 * 検査（`validate`）からは出さない。ところが**見る道具がどこにも無かった** ——
 * test/names.test.ts は両方を見ているのに、書いている最中は分からない。
 * 見本を 1 枚足すたびに使い捨ての台本を書いていた（このセッションだけで 5 回）。
 *
 * **止めない。数えて見せるだけ。**
 */
export async function runInspect(paths: string[], read = readFileSync): Promise<RunResult> {
  const m = messages().cli;
  if (paths.length === 0) return { code: 2, lines: [m.usageInspect] };

  const lines: string[] = [];
  let gated = false;
  let unreadable = 0;
  for (const path of paths) {
    let text: string;
    try {
      text = String(read(path, 'utf8'));
    } catch (error) {
      return { code: 1, lines: [m.fileUnreadable(path, error instanceof Error ? error.message : String(error))] };
    }
    const seen = await inspect(text);
    lines.push(m.inspected(path));
    if (!seen.readable) {
      /**
       * **読めない図に、観測値は無い**（2026-09-20）。
       *
       * 前は指摘を並べたあと、最後に「これは合否ではなく観測値です」まで足していた ——
       * **観測値を 1 つも出していないのに。** 読めない図は、まず読めるようにする話。
       */
      lines.push(...seen.findings.map(format));
      unreadable += 1;
      continue;
    }
    lines.push(m.inspectCounts(seen.nodes, seen.edges));

    /**
     * **警告の件数も出す**（2026-09-20）。
     *
     * 「登録の前に `pnpm inspect` で 0 にする」手順を作ったのに、
     * **この口は検査の警告を 1 件も出していなかった** —— 見本 268 を登録したあとで、
     * 描かれていない `hatch: dots` を `pnpm validate` が見つけた。
     * 中身までは出さない（`validate` の仕事）。**在ることだけを知らせる。**
     */
    const warnings = [...validate(text), ...(await placedFindings(text))].filter(
      (finding) => finding.severity === 'warning',
    );
    if (warnings.length > 0) lines.push(m.inspectWarnings(String(warnings.length)));

    const placed = await layout(text);
    const crossed = crossingPlaces(placed);
    const over = straddles(placed);
    const quiet =
      crossed.length === 0 && over.length === 0 &&
      seen.overlappingText.length === 0 && seen.edgesUnderBoxes.length === 0 &&
      seen.hiddenLabels.length === 0 && seen.crowdedNames.length === 0 &&
      seen.adriftNames.length === 0 && seen.hiddenTags.length === 0;
    if (quiet) lines.push(m.inspectClean);
    if (crossed.length > 0 || over.length > 0) gated = true;
    if (crossed.length > 0) lines.push(m.inspectCrossings(seen.crossings, crossed.length, spots(crossed)));
    if (over.length > 0) {
      // **どれだけ重なっているかまで出す。** 組だけでは、何 px 動かすかが分からない。
      const said = straddlePlaces(placed).map((found) =>
        m.straddleBy(found.a, found.b, String(Math.ceil(found.by.x)), String(Math.ceil(found.by.y))),
      );
      lines.push(m.inspectStraddles(over.length, names(said, 6)));
    }
    if (seen.overlappingText.length > 0) {
      lines.push(m.inspectOverlaps(seen.overlappingText.length, pairs(seen.overlappingText)));
    }
    if (seen.edgesUnderBoxes.length > 0) {
      lines.push(m.inspectUnderBoxes(seen.edgesUnderBoxes.length, pairs(seen.edgesUnderBoxes)));
    }

    /**
     * **検査の網と、見る道具の網をそろえる**（2026-09-20）。
     * `test/names.test.ts` は `hiddenLabels` と `crowdedNames` も 0 だと決めているのに、
     * この口は交差とまたぎしか出していなかった。**閉じたはずの穴が半分開いていた。**
     */
    if (seen.hiddenLabels.length > 0) {
      lines.push(m.inspectHiddenLabels(seen.hiddenLabels.length, names(seen.hiddenLabels)));
    }
    if (seen.crowdedNames.length > 0) {
      lines.push(m.inspectCrowded(seen.crowdedNames.length, names(seen.crowdedNames)));
    }
    if (seen.adriftNames.length > 0) {
      // **どれだけ足りないかまで出す。** id だけでは、箱をいくつ広げるかが分からない。
      const detail =
        kindOf(text) === 'placement'
          ? adriftDetails(placed.boxes, planNames(placed.boxes, extentOf(placed.boxes), placed.edges, placed.groups)).map(
              (found) => m.adriftWidth(found.id, String(Math.ceil(found.needs)), String(Math.round(found.has))),
            )
          : seen.adriftNames;
      lines.push(m.inspectAdrift(seen.adriftNames.length, names(detail)));
    }
    if (seen.hiddenTags.length > 0) {
      lines.push(m.inspectHiddenTags(seen.hiddenTags.length, names(seen.hiddenTags)));
    }

    // **長さは 1px きざみで足りる。** 1448.6107034668482 は読む人を困らせるだけ。
    const ratio = seen.textRatio === null ? '—' : seen.textRatio.toFixed(4);
    lines.push(m.inspectPaper(seen.smallestText, Math.round(seen.longestSide), ratio));
    if (seen.tooSmallToPrint) lines.push(m.inspectPrint);
    else if (seen.tooSmallToProject) lines.push(m.inspectProject);
  }
  // **読めなかった図しか無いなら、観測値の話はしない。**
  if (unreadable < paths.length) lines.push(m.inspectNote);
  // **止めないが、放っておくとテストが落ちる**ことだけは言う。
  if (gated) lines.push(m.inspectGate);
  if (unreadable > 0) lines.push(m.inspectUnreadable(unreadable));
  return { code: 0, lines };
}

/**
 * 交差を「a↔b (x, y)」の形にする。**場所まで言う**（2026-09-20）。
 *
 * `path()` で引いた折れ線の id は書き手が付けた名前ではないので、
 * 組だけ言われても図の中で探せない。**紙の上の座標が要る。**
 */
function spots(list: { a: string; b: string; at: { x: number; y: number } }[], limit = 6): string {
  const head = list.slice(0, limit).map((c) => `${c.a}↔${c.b} (${c.at.x}, ${c.at.y})`).join(', ');
  return list.length <= limit ? head : `${head}, …`;
}

/** id を並べる。**多いときは先頭だけ。** */
function names(list: string[], limit = 8): string {
  const head = list.slice(0, limit).join(', ');
  return list.length <= limit ? head : `${head}, …`;
}

/** 組を「a↔b, c↔d」の形にする。**多いときは先頭だけ**（探すのに要るのは相手）。 */
function pairs(list: [string, string][], limit = 6): string {
  const head = list.slice(0, limit).map(([a, b]) => `${a}↔${b}`).join(', ');
  return list.length <= limit ? head : `${head}, …`;
}

/**
 * 「9 割」を測る（Issue 003 / D3）。
 *
 * **合格しなくても 1 は返さない。** これは検査ではなく物差しで、
 * ここで CI を落とすと、**数字を良くするために指標のほうを歪める**動機が生まれる。
 */
export function runMeasure(paths: string[], read = readFileSync): RunResult {
  const m = messages().cli;
  if (paths.length === 0) return { code: 2, lines: [m.usageMeasure] };

  const lines: string[] = [];
  let short = 0;
  let unseen = 0;
  let stale = 0;
  let approved = 0;
  let placed = 0;
  for (const path of paths) {
    let text: string;
    try {
      text = String(read(path, 'utf8'));
    } catch (error) {
      return { code: 1, lines: [m.fileUnreadable(path, error instanceof Error ? error.message : String(error))] };
    }
    const result = measure(text);
    lines.push(m.measured(path, percent(result.autonomy), percent(result.layoutAutonomy)));
    if (!result.pass) short += 1;
    if (result.kind === 'placement') placed += 1;
    if (result.reviewStale) stale += 1;
    else if (!result.reviewed) unseen += 1;
    else if (result.touched === 0) approved += 1;
  }

  const line = percent(PASS_LINE);
  lines.push(short === 0 ? m.measurePassed(paths.length, line) : m.measureFailed(short, line));
  // **物差しは同じ向き**（2026-09-11 に考え直した）。種類は、置き場所の出どころだけ言う。
  if (placed > 0) lines.push(m.measurePlacement(placed));
  // **誰も見ていない図があることを黙らない**（ベースルール §29）。
  // AI は活動量なら無人で出せる。人が関与していないことは、言わないと気づかれない。
  //
  // **自力率 100% には 2 通りある。** 誰も見ていない 100% と、
  // 人が見て直すところが無かった 100%。**分けて言う。**
  if (unseen > 0) lines.push(m.measureUnseen(unseen));
  if (stale > 0) lines.push(m.measureStale(stale));
  if (approved > 0) lines.push(m.measureApproved(approved));
  return { code: 0, lines };
}

/** 1 つ読んで 1 つ書く形の変換。**口の作りを揃える。** */
async function convert(
  paths: string[],
  usage: string,
  extension: string,
  transform: (text: string) => string | Promise<string>,
  read: typeof readFileSync,
  write: typeof writeFileSync,
): Promise<RunResult> {
  const m = messages().cli;
  const [input, output] = paths;
  if (input === undefined) return { code: 2, lines: [usage] };
  // **旗と読み違えた出し先で、ファイルを作らない。** `-o 出力.svg` と書くと
  // `-o` という名前のファイルが出来て、本当の出し先は黙って捨てられていた。
  if (output !== undefined && output.startsWith('-')) {
    return { code: 2, lines: [m.outputLooksLikeFlag(output), usage] };
  }
  const target = output ?? `${input.replace(/\.zumen\.yaml$|\.ya?ml$|\.md$/, '')}${extension}`;

  let text: string;
  try {
    text = String(read(input, 'utf8'));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(input, error instanceof Error ? error.message : String(error))] };
  }
  write(target, await transform(text));
  return { code: 0, lines: [m.wrote(target)] };
}

/**
 * SVG を書き出す。
 *
 * `--dark` を付けると、暗い地へ貼る用の色になる（`DESIGN.md` §3）。
 * **付けなければライト。** 貼り先の地の色が分からないときの既定は変えない。
 */
export async function runSvg(paths: string[], read = readFileSync, write = writeFileSync): Promise<RunResult> {
  const theme = paths.includes('--dark') ? 'dark' : 'light';
  const intent = paths.includes('--vivid') ? 'vivid' : 'safe';
  const files = paths.filter((part) => !part.startsWith('--'));
  return convert(
    files,
    messages().cli.usageSvg,
    '.svg',
    async (text) => render(await layout(text), theme, intent, kindOf(text) === 'placement'),
    read,
    write,
  );
}

/**
 * **図が育つところを 1 本にする**（`pnpm timelapse <段のファイル…> [--out 置き場] [--hold 秒]`）。
 *
 * 出すのは動く SVG 1 枚と、紙を揃えた連番の SVG。
 * **mp4 は作らない** —— 符号化器は同梱しないので、作り方を文字で返す。
 */
export async function runTimelapse(
  paths: string[],
  read = readFileSync,
  write = writeFileSync,
): Promise<RunResult> {
  const m = messages().cli;
  const out = valueOf(paths, '--out') ?? '.';
  const hold = Number(valueOf(paths, '--hold') ?? '2');
  const files = paths.filter((part) => !part.startsWith('--')).filter((part) => part !== String(hold) && part !== out);
  if (files.length < 2) return { lines: [m.usageTimelapse], code: 1 };
  const steps = files.map((file) => String(read(file, 'utf8')));
  const film = await timelapse(steps, { hold, out });
  write(`${out}/timelapse.svg`, film.svg);
  film.frames.forEach((frame, index) => {
    write(`${out}/step-${String(index + 1).padStart(3, '0')}.svg`, frame);
  });
  return {
    lines: [m.timelapseWrote(files.length, film.seconds, `${out}/timelapse.svg`), film.recipe],
    code: 0,
  };
}

/** `--out dir` のような、旗のうしろの値。 */
function valueOf(parts: string[], flag: string): string | null {
  const at = parts.indexOf(flag);
  return at < 0 || at + 1 >= parts.length ? null : (parts[at + 1] ?? null);
}

export async function runMermaid(paths: string[], read = readFileSync, write = writeFileSync): Promise<RunResult> {
  return convert(paths, messages().cli.usageMermaid, '.mmd', (text) => toMermaid(text), read, write);
}

/**
 * Markdown の囲みを図へ差し替える（D4 の着地点）。
 *
 * **描けない囲みは、理由をその位置に出して指定を残す**（`src/embed.ts` の作法）。
 * 黙って空にすると、書いた人は「描けている」と思ったまま気づかない。
 */
export async function runEmbed(paths: string[], read = readFileSync, write = writeFileSync): Promise<RunResult> {
  const m = messages().cli;
  const [input] = paths;
  if (input === undefined) return { code: 2, lines: [m.usageEmbed] };

  let source: string;
  try {
    source = String(read(input, 'utf8'));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(input, error instanceof Error ? error.message : String(error))] };
  }

  const rendered = await renderZumenBlocks(source);
  if (rendered.size === 0) return { code: 0, lines: [m.embedNoBlocks(input)] };

  const target = paths[1] ?? input.replace(/\.md$/, '.zumen.md');
  write(target, replaceZumenBlocks(source, rendered));
  return { code: 0, lines: [m.wrote(target)] };
}

/**
 * AI の提案を人の正本へ入れる（D5）。
 *
 * **競合は適用しない。** 決めるのは人であって、ここではない。
 * 決着（`resolve`）を CLI に置かないのも同じ理由で、
 * **承認は画面と人の仕事**（D11）。
 */
export function runMerge(paths: string[], read = readFileSync, write = writeFileSync): RunResult {
  const m = messages().cli;
  const [current, proposal] = paths;
  if (current === undefined || proposal === undefined) return { code: 2, lines: [m.usageMerge] };

  let result;
  try {
    result = merge(String(read(current, 'utf8')), String(read(proposal, 'utf8')));
  } catch (error) {
    return { code: 1, lines: [m.fileUnreadable(current, error instanceof Error ? error.message : String(error))] };
  }

  write(current, result.text);
  const lines = [m.wrote(current)];
  if (result.conflicts.length === 0) {
    lines.push(m.mergedClean2);
    return { code: 0, lines };
  }
  lines.push(m.mergedConflicts(result.conflicts.length));
  for (const conflict of result.conflicts) lines.push(m.conflictLine(conflict.elementId, describe(conflict)));
  // 競合が残っていても失敗ではない。**人が見て決める、というだけ。**
  return { code: 0, lines };
}

function describe(conflict: Conflict): string {
  const m = messages().cli;
  const point = (value: { x: number; y: number }): string => `(${value.x}, ${value.y})`;
  if (conflict.kind === 'pin-orphaned') return m.conflictRemoved;
  if (conflict.kind === 'position-suppressed') return m.conflictSuppressed(point(conflict.ai));
  return m.conflictPosition(point(conflict.human), point(conflict.ai));
}

/** 命令を振り分ける。**判断は持たない。** */
export async function run(argv: string[]): Promise<RunResult> {
  const [command, ...rest] = argv;
  if (command === 'validate') return runValidate(rest);
  if (command === 'merge-driver') return runMergeDriver(rest);
  if (command === 'drawio') return runDrawio(rest);
  if (command === 'measure') return runMeasure(rest);
  if (command === 'inspect') return runInspect(rest);
  if (command === 'svg') return runSvg(rest);
  if (command === 'mermaid') return runMermaid(rest);
  if (command === 'timelapse') return runTimelapse(rest);
  if (command === 'embed') return runEmbed(rest);
  if (command === 'merge') return runMerge(rest);
  const m = messages().cli;
  const usage = [
    m.usage,
    m.usageMeasure,
    m.usageInspect,
    m.usageSvg,
    m.usageTimelapse,
    m.usageMermaid,
    m.usageDrawio,
    m.usageEmbed,
    m.usageMerge,
    m.usageMergeDriver,
  ];
  if (command === undefined) return { code: 2, lines: usage };
  return { code: 2, lines: [m.unknownCommand(command), ...usage] };
}

// 直接叩かれたときだけ走る。import しても副作用が出ないようにしておく。
if (isEntry(import.meta.url, process.argv[1])) {
  const result = await run(process.argv.slice(2));
  for (const line of result.lines) console.log(line);
  process.exitCode = result.code;
}
