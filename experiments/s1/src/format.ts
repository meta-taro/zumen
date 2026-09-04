/**
 * S1 暫定形式の読み書き。
 *
 * **これは保存形式（D2 / Issue 002）ではない。** S1 で保持を測るための実験用であり、
 * ここで通ったことを理由に D2 を既成事実にしない。
 *
 * 設計上ゆずらない点が 1 つある。**人が触っていない行に差分を出さない**こと。
 * 出すと `git diff` が「人が何を直したか」を映さなくなり、この製品の前提が崩れる。
 * そのため素の JavaScript オブジェクトへ落として書き戻す形は採らず、
 * YAML の文書構造（コメント・空行・並び順を保つ）へ直接触る。
 */
import { isMap, isSeq, parseDocument } from 'yaml';
import type { Document, YAMLMap } from 'yaml';

/** 人が与えた指定。AI はこの節を書かない。 */
export interface Pin {
  position?: { x: number; y: number };
  size?: { w: number; h: number };
  label?: string;
  /**
   * 人が「AI の再配置より自分の位置を採る」と決めた印。
   * 決定を正本へ書いておかないと、次に開いたときに同じことを聞き直すことになる。
   */
  locked?: boolean;
}

export type Pins = Record<string, Pin>;

export interface Edge {
  from: string;
  to: string;
  label?: string;
  protocol?: string;
}

/** 折り返しでの改行を止める。人が書いた行の形を機械が変えないため。 */
const TO_STRING_OPTIONS = { lineWidth: 0 } as const;

export class Diagram {
  readonly doc: Document;

  constructor(doc: Document) {
    this.doc = doc;
  }

  private seq(key: string): YAMLMap[] {
    const node = this.doc.get(key, true);
    if (!isSeq(node)) return [];
    return node.items.filter((item): item is YAMLMap => isMap(item));
  }

  nodeIds(): string[] {
    return this.seq('nodes').map((item) => String(item.get('id')));
  }

  groupIds(): string[] {
    return this.seq('groups').map((item) => String(item.get('id')));
  }

  edges(): Edge[] {
    return this.seq('edges').map((item) => {
      const edge: Edge = { from: String(item.get('from')), to: String(item.get('to')) };
      const label = item.get('label');
      if (label !== undefined && label !== null) edge.label = String(label);
      const protocol = item.get('protocol');
      if (protocol !== undefined && protocol !== null) edge.protocol = String(protocol);
      return edge;
    });
  }
}

export function parse(text: string): Diagram {
  return new Diagram(parseDocument(text));
}

export function serialize(diagram: Diagram): string {
  return diagram.doc.toString(TO_STRING_OPTIONS);
}

export function getPins(diagram: Diagram): Pins {
  const pins = diagram.doc.get('pins', true);
  // `get` は入れ子を YAML の節のまま返す。比較・計測に使うので素の値へ落とす。
  if (!isMap(pins)) return {};
  return pins.toJSON() as Pins;
}

/**
 * pin を書き込む。
 *
 * `position` と `size` は 1 行（flow）で書く。片方だけ変わることは無く、
 * 2 つ合わせて「人がここへ置いた」という 1 つの意思だからである。
 * 逆に pin そのものはノードごとに行を分ける（block）。
 * 1 行にまとめると、別々のノードの手直しが同じ行の差分として出てしまう。
 */
export function setPin(diagram: Diagram, id: string, pin: Pin): void {
  const doc = diagram.doc;
  let pins = doc.get('pins', true);
  if (!isMap(pins)) {
    pins = doc.createNode({}) as YAMLMap;
    doc.set('pins', pins);
  }
  const map = pins as YAMLMap;
  map.flow = false;

  const clean = Object.fromEntries(Object.entries(pin).filter(([, v]) => v !== undefined));
  const value = doc.createNode(clean) as YAMLMap;
  value.flow = false;
  for (const key of ['position', 'size'] as const) {
    const inner = value.get(key, true);
    if (isMap(inner)) inner.flow = true;
  }
  map.set(doc.createNode(id), value);
}

/** pin を消す。競合で「AI を採る」を選んだときに使う。 */
export function deletePin(diagram: Diagram, id: string): void {
  const pins = diagram.doc.get('pins', true);
  if (isMap(pins)) pins.delete(id);
}
