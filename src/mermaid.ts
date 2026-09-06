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
import { getPins, parse } from './format.ts';
import type { Pin } from './format.ts';
import { messages } from './messages.ts';

interface NodeInfo {
  id: string;
  label: string;
  type: string;
  group: string | null;
  appearance: string | null;
}

/** 体裁の訳。renderer 側の APPEARANCE と同じ値にしておく。 */
const CLASS_DEFS: Record<string, string> = {
  primary: 'fill:#dbeafe,stroke:#1d4ed8',
  muted: 'fill:#f1f5f9,stroke:#94a3b8',
};

export function toMermaid(text: string): string {
  const diagram = parse(text);
  const raw = diagram.doc.toJS() as {
    title?: string;
    groups?: { id: string; label?: string }[];
    nodes?: { id: string; label?: string; type?: string; group?: string }[];
  };
  // 人が直したラベルと体裁は Mermaid でも表せる。**表せるものは落とさない。**
  // 落とすのは、Mermaid に書く場所が無いもの（位置・大きさ・線の曲げ方）だけ。
  const pins = getPins(diagram);
  const nodes: NodeInfo[] = (raw.nodes ?? []).map((node) => ({
    id: node.id,
    label: pins[node.id]?.label ?? node.label ?? node.id,
    type: node.type ?? 'generic',
    group: node.group ?? null,
    appearance: pins[node.id]?.appearance ?? null,
  }));

  const lines: string[] = [];
  if (raw.title !== undefined) lines.push(`%% ${raw.title}`);
  lines.push(...droppedNotes(pins));
  lines.push('flowchart TD');

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

/** 型ごとの形。語彙は多くない（PRD §4 — 図形の網羅を追わない）。 */
function shape(node: NodeInfo): string {
  const label = quote(node.label);
  switch (node.type) {
    case 'database':
      return `${node.id}[(${label})]`;
    case 'storage':
      return `${node.id}[[${label}]]`;
    case 'internet':
    case 'cloud':
      return `${node.id}((${label}))`;
    case 'cache':
      return `${node.id}{{${label}}}`;
    default:
      return `${node.id}[${label}]`;
  }
}

/**
 * ラベルを Mermaid の記法に載せる。
 *
 * 二重引用符で囲めば括弧や記号を含められる。中の二重引用符は実体参照にする
 * （Mermaid 側にエスケープ記法が無いため、これが唯一の手段）。
 */
function quote(value: string): string {
  return `"${value.replace(/"/g, '&quot;')}"`;
}
