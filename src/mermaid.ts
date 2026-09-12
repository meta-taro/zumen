/**
 * Mermaid へ書き出す。
 *
 * **これは「この製品が終わった翌日、何を使えば図が読めるか」への答え**（Issue 002）。
 * Mermaid なら GitHub・VS Code・md-business・その他多数がそのまま図として描く。
 * zumen が無くなっても、図は図のまま残る。
 *
 * Issue 002 は「あとで変換器を書けばいい」で先送りすることを禁じている。
 * 書かれないまま残るからで、実際そのとおりになる。だから形式を決めるのと同時に書く。
 *
 * **落ちるものは黙って落とさない。** Mermaid には人が置いた位置を書く場所が無い。
 * 落ちた指定を先頭のコメントに列挙して、何が失われたかを読める形にする。
 */
import { asText, getPins, parse } from './format.ts';
import { directionOf } from './direction.ts';
import type { Pin } from './format.ts';
import { messages } from './messages.ts';
import { APPEARANCE } from './tokens.ts';

interface NodeInfo {
  id: string;
  label: string;
  type: string;
  group: string | null;
  appearance: string | null;
  /** 版や役割（仕様 §3.1）。**Mermaid でも表せるので落とさない。** */
  technology: string | null;
  /** 符号（仕様 §3.1.3）。同上。 */
  tag: string | null;
}

/** 体裁の訳。**値は `src/tokens.ts` の 1 か所から取る**（3 か所に書くとズレる）。 */
const CLASS_DEFS: Record<string, string> = Object.fromEntries(
  Object.entries(APPEARANCE).map(([word, look]) => [word, `fill:${look.fill},stroke:${look.stroke}`]),
);

export function toMermaid(text: string): string {
  const diagram = parse(text);
  const raw = diagram.doc.toJS() as {
    title?: string;
    groups?: { id: string; label?: unknown }[];
    direction?: unknown;
    nodes?: {
      id: string;
      label?: unknown;
      type?: string;
      group?: string;
      technology?: unknown;
      tag?: unknown;
    }[];
  };
  // 人が直したラベルと体裁は Mermaid でも表せる。**表せるものは落とさない。**
  // 落とすのは、Mermaid に書く場所が無いもの（位置・大きさ・線の曲げ方）だけ。
  const pins = getPins(diagram);
  const nodes: NodeInfo[] = (raw.nodes ?? []).map((node) => ({
    id: node.id,
    label: asText(pins[node.id]?.label) ?? asText(node.label) ?? node.id,
    type: node.type ?? 'generic',
    group: node.group ?? null,
    appearance: pins[node.id]?.appearance ?? null,
    technology: asText(node.technology),
    tag: asText(node.tag),
  }));

  const lines: string[] = [];
  if (raw.title !== undefined) lines.push(`%% ${raw.title}`);
  lines.push(...droppedNotes(pins));
  // **向きは正本が決める**（`src/direction.ts`。既定は横）。
  // ここを `TD` で固定していたので、**同じ正本から SVG は横、Mermaid は縦**が出ていた。
  // Issue #9 で直したのと同じ壊れ方（書き出し先ごとに違う絵）。
  lines.push(`flowchart ${directionOf(raw.direction) === 'down' ? 'TD' : 'LR'}`);

  for (const group of raw.groups ?? []) {
    const members = nodes.filter((node) => node.group === group.id);
    if (members.length === 0) continue;
    lines.push(`  subgraph ${group.id}[${quote(group.label ?? group.id)}]`);
    for (const node of members) lines.push(`    ${shape(node)}`);
    lines.push('  end');
  }
  for (const node of nodes.filter((n) => n.group === null)) lines.push(`  ${shape(node)}`);

  const styled = nodes.filter((node) => node.appearance !== null);
  if (styled.length > 0) {
    lines.push('');
    for (const name of new Set(styled.map((node) => node.appearance!))) {
      const def = CLASS_DEFS[name];
      if (def !== undefined) lines.push(`  classDef ${name} ${def}`);
    }
    for (const node of styled) lines.push(`  class ${node.id} ${node.appearance}`);
  }

  lines.push('');
  for (const edge of diagram.edges()) {
    const label = edge.label ?? edge.protocol;
    lines.push(
      label === undefined
        ? `  ${edge.from} --> ${edge.to}`
        : `  ${edge.from} -->|${quote(label)}| ${edge.to}`,
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Mermaid で表せない指定を書き出す。
 *
 * ここを黙って落とすと、書き出した図を見た人は「元からこうだった」と思う。
 * 人が手で直した分が消えたことに、誰も気づけなくなる。
 */
function droppedNotes(pins: Record<string, Pin>): string[] {
  const dropped = Object.entries(pins).filter(([, pin]) => hasLayout(pin));
  if (dropped.length === 0) return [];
  // 中身の無い `%%` 行を書かない。Mermaid のパーサはそれをコメントと見なさず、
  // 次の行と繋げてしまう（`%%%%flowchart TD` になって構文エラーになる）。
  return [
    '%% ---',
    `%% ${messages().mermaid.geometryDroppedHeading}`,
    `%% ${messages().mermaid.geometryDroppedDetail}`,
    ...dropped.map(
      ([id, pin]) =>
        `%%   - ${id}: ${LAYOUT_FIELDS.filter((f) => pin[f] !== undefined).join(', ')}`,
    ),
    '%% ---',
  ];
}

/** Mermaid に書く場所が無いもの。ラベルと体裁は表せるのでここに入れない。 */
const LAYOUT_FIELDS = ['position', 'size', 'waypoints'] as const;

function hasLayout(pin: Pin): boolean {
  return LAYOUT_FIELDS.some((field) => pin[field] !== undefined);
}

/**
 * 型ごとの形。語彙は多くない（PRD §4 — 図形の網羅を追わない）。
 *
 * **`src/shapes.ts` と同じ 6 種に形を付ける**（Issue #9）。
 * 以前はこちらだけが形を出していて、**同じ正本から書き出し先ごとに違う絵**が出ていた。
 * ここを増やすときは、あちらも一緒に増やすこと（`test/shapes.test.ts` が見張る）。
 *
 * `cloud` の分岐があったが、**`type` の一覧に無い語**だった。取り残しなので消した。
 */
function shape(node: NodeInfo): string {
  const label = quote(labelOf(node));
  switch (node.type) {
    case 'database':
      return `${node.id}[(${label})]`;
    case 'storage':
      return `${node.id}[[${label}]]`;
    case 'internet':
      return `${node.id}((${label}))`;
    case 'cache':
      return `${node.id}{{${label}}}`;
    case 'queue':
      // 平行四辺形。**流れていくもの**を表す（Mermaid の既定の語彙）。
      return `${node.id}[/${label}/]`;
    case 'container':
      // 角丸。**中に何かを入れる器**。二重枠（SVG 側）に近い含みを持たせる。
      return `${node.id}(${label})`;
    default:
      return `${node.id}[${label}]`;
  }
}

/**
 * 箱に出す文字。**符号・名前・副題の 3 行。**
 *
 * SVG は 3 つを別々の位置に描く（符号は左上、名前は中央、副題はその下）。
 * Mermaid に位置を書く場所は無いが、**行は分けられる**（`<br>`）。
 * 1 つの名前に潰すと、`C1 柱 700×700` という**存在しない名前**ができてしまう。
 *
 * ここを落としていたので、符号と副題が**書き出した時点で消えて**いた。
 */
function labelOf(node: NodeInfo): string {
  return [node.tag, asText(node.label) ?? node.id, node.technology]
    .filter((part) => part !== null && part !== '')
    .join('<br>');
}

/**
 * ラベルを Mermaid の記法に載せる。
 *
 * 二重引用符で囲めば括弧や記号を含められる。中の二重引用符は実体参照にする
 * （Mermaid 側にエスケープ記法が無いため、これが唯一の手段）。
 */
function quote(value: unknown): string {
  // **数字で書かれた値がここへ来る**（`label: 8080`）。Issue #5 と同じ理由。
  return `"${(asText(value) ?? '').replace(/"/g, '&quot;')}"`;
}
