/**
 * **作図**（`kind: construction`。D36 / 仕様 `docs/specs/011-作図の骨格.md`）。
 *
 * ## ここがこの版の芯
 *
 * **ソルバではない。前から順に評価するだけ。**
 *
 * 依頼された骨格案は `tangent-to`（接する）を中心に据えていたが、
 * **接する円は一般に一意でない**ので、それは拘束（constraint）であり、
 * 解くには順序の決定・過剰／不足拘束の判定・解の選択・収束の扱いが要る。**それは CAD。**
 *
 * コンパスの作図はそうなっていない。
 *
 * > 円を描く。別の円を描く。**その 2 円の交点**を次の点にする。
 *
 * **各手順は、前の手順の結果だけから決まる。** 表計算と同じで、循環参照だけが禁じられる。
 * だから「解けなかったとき」が起きない —— 起きるのは**交点が無い**ことだけ。
 *
 * ## ここに描画を持ち込まない
 *
 * 出すのは**円と弧の座標**まで。SVG は `src/render.ts` が書く。
 * そうしておくと、**立てずに測れる**（ベースルール §9）。
 */
import { messages } from './messages.ts';

/** 語で書ける定数。**`1.6180339887` と書かせない**（φ は作図で出る値であって近似ではない）。 */
export const NAMED: Readonly<Record<string, number>> = {
  golden: (1 + Math.sqrt(5)) / 2,
  sqrt2: Math.SQRT2,
  sqrt3: Math.sqrt(3),
  pi: Math.PI,
};

export interface Point {
  x: number;
  y: number;
}

export type Cap = 'round' | 'butt';

/**
 * 描くもの。**円・弧・線分。**
 *
 * 線分を足したのは、**「定規とコンパス」の定規のほう**が無かったため
 * （2026-09-15。家紋の割り出し図で当たった —— 六つ割で出した 6 点を
 * 結べないと、亀甲にならない）。`lines` は交点を出すためのもので、描かない。
 */
export type Stroke =
  | { shape: 'circle'; cx: number; cy: number; r: number; weight: number; trace: boolean }
  | {
      shape: 'segment';
      x0: number;
      y0: number;
      x1: number;
      y1: number;
      weight: number;
      cap: Cap;
      trace: boolean;
    }
  | {
      shape: 'arc';
      cx: number;
      cy: number;
      r: number;
      /** 度。0 が右、時計回り（SVG と同じ向き）。 */
      a0: number;
      a1: number;
      weight: number;
      cap: Cap;
      /** 端の玉の半径。**無ければ null**。 */
      terminal: number | null;
      trace: boolean;
    };

export interface Built {
  /** 名前 → 値（定数と長さ）。**人が pin できるのはここ**（D36）。 */
  lengths: Map<string, number>;
  points: Map<string, Point>;
  circles: Map<string, { cx: number; cy: number; r: number }>;
  strokes: Stroke[];
  /** **解けなかったところ。** 黙って落とさない。 */
  troubles: string[];
}

// --- 式 --------------------------------------------------------------------

/**
 * 式を読む。**`+ - * / ^` と括弧、名前、数、`distance(A, B)` だけ。**
 *
 * 再帰下降で書く。**前の行で決まった名前しか引けない**ので、循環参照を作れない。
 */
class Reader {
  #text: string;
  #at = 0;

  constructor(text: string) {
    this.#text = text;
  }

  read(look: (name: string) => number | null, dist: (a: string, b: string) => number | null): number {
    const value = this.#sum(look, dist);
    this.#skip();
    if (this.#at < this.#text.length) throw new Error(messages().construct.exprLeftover(this.#text.slice(this.#at)));
    return value;
  }

  #skip(): void {
    while (this.#at < this.#text.length && /\s/.test(this.#text[this.#at]!)) this.#at += 1;
  }

  #eat(ch: string): boolean {
    this.#skip();
    if (this.#text[this.#at] !== ch) return false;
    this.#at += 1;
    return true;
  }

  #sum(look: Look, dist: Dist): number {
    let value = this.#term(look, dist);
    for (;;) {
      if (this.#eat('+')) value += this.#term(look, dist);
      else if (this.#eat('-')) value -= this.#term(look, dist);
      else return value;
    }
  }

  #term(look: Look, dist: Dist): number {
    let value = this.#power(look, dist);
    for (;;) {
      if (this.#eat('*')) value *= this.#power(look, dist);
      else if (this.#eat('/')) {
        const by = this.#power(look, dist);
        if (by === 0) throw new Error(messages().construct.dividedByZero);
        value /= by;
      } else return value;
    }
  }

  /** **`^` は右から結合する**（`a^b^c` は `a^(b^c)`）。数学の書き方に合わせる。 */
  #power(look: Look, dist: Dist): number {
    const base = this.#unary(look, dist);
    if (!this.#eat('^')) return base;
    return base ** this.#power(look, dist);
  }

  #unary(look: Look, dist: Dist): number {
    if (this.#eat('-')) return -this.#unary(look, dist);
    if (this.#eat('+')) return this.#unary(look, dist);
    return this.#atom(look, dist);
  }

  #atom(look: Look, dist: Dist): number {
    this.#skip();
    if (this.#eat('(')) {
      const value = this.#sum(look, dist);
      if (!this.#eat(')')) throw new Error(messages().construct.parenMissing);
      return value;
    }
    const number = /^\d+(?:\.\d+)?/.exec(this.#text.slice(this.#at));
    if (number !== null) {
      this.#at += number[0].length;
      return Number(number[0]);
    }
    const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.#text.slice(this.#at));
    if (name === null) throw new Error(messages().construct.exprUnreadable(this.#text.slice(this.#at)));
    this.#at += name[0].length;
    if (name[0] === 'distance') {
      if (!this.#eat('(')) throw new Error(messages().construct.parenMissing);
      const a = this.#name();
      if (!this.#eat(',')) throw new Error(messages().construct.distanceNeedsTwo);
      const b = this.#name();
      if (!this.#eat(')')) throw new Error(messages().construct.parenMissing);
      const got = dist(a, b);
      if (got === null) throw new Error(messages().construct.unknownPoint(`${a} / ${b}`));
      return got;
    }
    const value = look(name[0]);
    if (value === null) throw new Error(messages().construct.unknownName(name[0]));
    return value;
  }

  #name(): string {
    this.#skip();
    const found = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.#text.slice(this.#at));
    if (found === null) throw new Error(messages().construct.exprUnreadable(this.#text.slice(this.#at)));
    this.#at += found[0].length;
    return found[0];
  }
}

type Look = (name: string) => number | null;
type Dist = (a: string, b: string) => number | null;

/** 式 1 本を値にする。**数がそのまま来たら、そのまま返す。** */
export function evaluate(raw: unknown, look: Look, dist: Dist): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string') throw new Error(messages().construct.exprUnreadable(String(raw)));
  const value = new Reader(raw).read(look, dist);
  if (!Number.isFinite(value)) throw new Error(messages().construct.exprUnreadable(raw));
  return value;
}

// --- 幾何 ------------------------------------------------------------------

/** どちらの交点を採るか。**書かなければ断る**（次の生成で反対を採らないため）。 */
export const TAKES = ['upper', 'lower', 'left', 'right', 'first', 'second'] as const;
export type Take = (typeof TAKES)[number];

/**
 * **2 円の交点。** コンパス作図の中心の操作。
 *
 * 返すのは 0 / 1 / 2 個。**離れていれば 0、接していれば 1。**
 */
export function meet(
  a: { cx: number; cy: number; r: number },
  b: { cx: number; cy: number; r: number },
): Point[] {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const d = Math.hypot(dx, dy);
  // **同心は交点を持たない**（同じ円でも「どこでも交わる」は点ではない）。
  if (d === 0) return [];
  if (d > a.r + b.r || d < Math.abs(a.r - b.r)) return [];
  const t = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h2 = a.r * a.r - t * t;
  const h = h2 <= 0 ? 0 : Math.sqrt(h2);
  const mx = a.cx + (t * dx) / d;
  const my = a.cy + (t * dy) / d;
  if (h === 0) return [{ x: mx, y: my }];
  const ox = (h * -dy) / d;
  const oy = (h * dx) / d;
  return [
    { x: mx + ox, y: my + oy },
    { x: mx - ox, y: my - oy },
  ];
}

/** **円と直線の交点。** 直線は 2 点で与える。 */
export function meetLine(
  c: { cx: number; cy: number; r: number },
  p: Point,
  q: Point,
): Point[] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [];
  const ux = dx / len;
  const uy = dy / len;
  const t = (c.cx - p.x) * ux + (c.cy - p.y) * uy;
  const foot = { x: p.x + t * ux, y: p.y + t * uy };
  const gap = Math.hypot(foot.x - c.cx, foot.y - c.cy);
  if (gap > c.r) return [];
  const half = Math.sqrt(Math.max(0, c.r * c.r - gap * gap));
  if (half === 0) return [foot];
  return [
    { x: foot.x + half * ux, y: foot.y + half * uy },
    { x: foot.x - half * ux, y: foot.y - half * uy },
  ];
}

/**
 * 交点のどれを採るか。
 *
 * **`upper` は y が小さいほう**（画面の上）。`first` / `second` は書いた順。
 */
export function pick(points: readonly Point[], take: Take): Point | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0]!;
  const [a, b] = points as [Point, Point];
  if (take === 'first') return a;
  if (take === 'second') return b;
  if (take === 'upper') return a.y <= b.y ? a : b;
  if (take === 'lower') return a.y >= b.y ? a : b;
  if (take === 'left') return a.x <= b.x ? a : b;
  return a.x >= b.x ? a : b;
}

/** 円上の点の角（度）。**SVG と同じ向き**（0 が右、下へ回る）。 */
export function angleOf(c: { cx: number; cy: number }, p: Point): number {
  const deg = (Math.atan2(p.y - c.cy, p.x - c.cx) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

// --- 組み立て --------------------------------------------------------------

/** 正本の `construction` の節（読めた分だけ）。 */
export interface Source {
  let?: unknown;
  lengths?: unknown;
  /**
   * **名前を付けた手順のかたまり**（字・部品）。
   *
   * 同じ形を何度も置く図（語・並び・繰り返し模様）で要る。
   * 中の名前はそのかたまりの中だけのもので、置くときに `as` が前に付く。
   *
   * **送り幅は書かない。** `after` で繋ぐと、**置いたものの外接から機械が出す** ——
   * 書かせると、形を直したときに数字が置き去りになる。
   */
  define?: unknown;
  /**
   * **書いた順に評価する列。** 点と円と線を混ぜて書ける。
   *
   * YAML の写像は順を持たないので、**点・円・線を節ごとに分けると
   * 「前のものしか引けない」が守れない**（点が円を要り、円が点を要る）。
   * `steps` があればそちらが正。
   */
  steps?: unknown;
  points?: unknown;
  circles?: unknown;
  lines?: unknown;
  arcs?: unknown;
  /** 描く線分（2 点を結ぶ）。 */
  segments?: unknown;
}

const asList = (raw: unknown): Record<string, unknown>[] =>
  Array.isArray(raw) ? raw.filter((one): one is Record<string, unknown> => one !== null && typeof one === 'object') : [];

const asMap = (raw: unknown): [string, unknown][] =>
  raw === null || typeof raw !== 'object' || Array.isArray(raw) ? [] : Object.entries(raw as Record<string, unknown>);

/**
 * **前から順に評価する。** ここにソルバは無い。
 *
 * 落ちたところは `troubles` に積んで、**残りは描く** ——
 * 1 か所つまずいて図が丸ごと消えるほうが分かりにくい。
 */
export function build(
  raw: Source,
  pinned: ReadonlyMap<string, number> = new Map(),
  /** 外から渡す長さ（かたまりを置くときに、図ぜんたいの比を共有する）。 */
  shared: ReadonlyMap<string, number> = new Map(),
): Built {
  const lengths = new Map<string, number>(shared);
  const points = new Map<string, Point>();
  const circles = new Map<string, { cx: number; cy: number; r: number }>();
  const lines = new Map<string, [Point, Point]>();
  const strokes: Stroke[] = [];
  const troubles: string[] = [];
  const m = messages().construct;

  const look = (name: string): number | null => lengths.get(name) ?? null;
  const dist = (a: string, b: string): number | null => {
    const p = points.get(a);
    const q = points.get(b);
    return p === undefined || q === undefined ? null : Math.hypot(q.x - p.x, q.y - p.y);
  };
  const num = (value: unknown): number => evaluate(value, look, dist);
  const note = (error: unknown): void => {
    troubles.push(error instanceof Error ? error.message : String(error));
  };

  // 1. 定数。**語で書ける値はここで解く。** 人が pin していればそちらが勝つ（D36）。
  for (const [name, value] of [...asMap(raw.let), ...asMap(raw.lengths)]) {
    if (lengths.has(name)) {
      troubles.push(m.duplicate(name));
      continue;
    }
    const byHuman = pinned.get(name);
    if (byHuman !== undefined) {
      lengths.set(name, byHuman);
      continue;
    }
    if (typeof value === 'string' && value in NAMED) {
      lengths.set(name, NAMED[value]!);
      continue;
    }
    try {
      lengths.set(name, num(value));
    } catch (error) {
      note(error);
    }
  }

  // 2. かたまりの定義。**まだ描かない**（`place` で置いたときに描く）。
  const shapes = new Map<string, Source>();
  for (const [name, body] of asMap(raw.define)) {
    if (body !== null && typeof body === 'object') shapes.set(name, body as Source);
  }
  /** 置いたかたまりの右端（`after` で次を繋ぐのに使う）。 */
  const rightOf = new Map<string, number>();

  // 3. 点・円・線。**書いた順に評価する**（前のものしか引けない）。
  const steps = [
    ...asList(raw.points).map((one) => ['point', one] as const),
    ...asList(raw.circles).map((one) => ['circle', one] as const),
    ...asList(raw.lines).map((one) => ['line', one] as const),
  ];
  // **円と点は混ざる**（点が円を要り、円が点を要る）ので、書かれた順に 1 本の列にする。
  const ordered = orderOf(raw);
  for (const [kind, item] of ordered.length > 0 ? ordered : steps) {
    // **かたまりを置く。** ここだけが入れ子になる。
    if (item.place !== undefined) {
      try {
        placeShape(item);
      } catch (error) {
        note(error);
      }
      continue;
    }
    const id = item.id === undefined || item.id === null ? '' : String(item.id);
    if (id === '') continue;
    try {
      if (kind === 'point') addPoint(id, item);
      else if (kind === 'circle') addCircle(id, item);
      else addLine(id, item);
    } catch (error) {
      note(error);
    }
  }

  // 3. 弧。**描くものはここだけ。**
  for (const item of asList(raw.arcs)) {
    try {
      strokes.push(arcOf(item));
    } catch (error) {
      note(error);
    }
  }
  // 4. 線分。**定規で引く分。**（`lines` は交点を出すためのもので、描かない）
  for (const item of asList(raw.segments)) {
    try {
      const a = pointOf(item.from);
      const b = pointOf(item.to);
      strokes.push({
        shape: 'segment',
        x0: a.x,
        y0: a.y,
        x1: b.x,
        y1: b.y,
        weight: item.weight === undefined ? 1 : num(item.weight),
        cap: item.cap === 'butt' ? 'butt' : 'round',
        trace: item.trace === true,
      });
    } catch (error) {
      note(error);
    }
  }

  /**
   * 5. 円をそのまま描く指定（`draw: true`）。
   *
   * **`steps` の中の円も見る。** 点と円は混ぜて書けるようにしてあるので、
   * `circles` の節しか見ないと、**書いたのに描かれない**
   * （2026-09-15。`a` の真円が丸ごと消えて `ı` になった）。
   */
  for (const item of [...ordered.filter(([kind]) => kind === 'circle').map(([, one]) => one), ...asList(raw.circles)]) {
    if (item.draw !== true) continue;
    const found = circles.get(String(item.id));
    if (found === undefined) continue;
    strokes.push({
      shape: 'circle',
      ...found,
      weight: item.weight === undefined ? 1 : safe(() => num(item.weight), 1),
      trace: item.trace === true,
    });
  }

  return { lengths, points, circles, strokes, troubles };

  /**
   * かたまりを 1 つ置く。
   *
   * **中身は自分の名前空間で組む**（点も円もそのかたまりの中だけ）。
   * 組んだあと**ずらして**、外からは `as.名前` で引けるようにする。
   *
   * 長さ（`lengths`）だけは共有する —— 比は図ぜんたいで 1 つ。
   */
  function placeShape(item: Record<string, unknown>): void {
    const name = String(item.place);
    const body = shapes.get(name);
    if (body === undefined) throw new Error(m.unknownShape(name));
    const as = item.as === undefined || item.as === null ? name : String(item.as);

    // **原点で 1 度組む。** 送り幅は、組んでみないと分からない。
    const inner = build({ ...body, let: undefined, lengths: undefined }, new Map(), lengths);
    for (const trouble of inner.troubles) troubles.push(`${as}: ${trouble}`);

    const ink = inkBounds(inner.strokes);
    let dx = 0;
    let dy = 0;
    if (item.after !== undefined) {
      const right = rightOf.get(String(item.after));
      if (right === undefined) throw new Error(m.unknownShape(String(item.after)));
      const gap = item.gap === undefined ? 0 : num(item.gap);
      dx = right + gap - (ink?.left ?? 0);
      dy = item.at !== undefined && item.at !== null ? num((item.at as Record<string, unknown>).y ?? 0) : 0;
    } else if (item.at !== undefined && item.at !== null) {
      const box = item.at as Record<string, unknown>;
      dx = num(box.x ?? 0);
      dy = num(box.y ?? 0);
    }

    for (const [key, point] of inner.points) points.set(`${as}.${key}`, { x: point.x + dx, y: point.y + dy });
    for (const [key, circle] of inner.circles) {
      circles.set(`${as}.${key}`, { ...circle, cx: circle.cx + dx, cy: circle.cy + dy });
    }
    for (const one of inner.strokes) {
      strokes.push(
        one.shape === 'segment'
          ? { ...one, x0: one.x0 + dx, y0: one.y0 + dy, x1: one.x1 + dx, y1: one.y1 + dy }
          : { ...one, cx: one.cx + dx, cy: one.cy + dy },
      );
    }
    rightOf.set(as, (ink?.right ?? 0) + dx);
  }

  function safe(run: () => number, fallback: number): number {
    try {
      return run();
    } catch (error) {
      note(error);
      return fallback;
    }
  }

  function pointOf(name: unknown): Point {
    const found = points.get(String(name));
    if (found === undefined) throw new Error(m.unknownPoint(String(name)));
    return found;
  }

  function circleOf(name: unknown): { cx: number; cy: number; r: number } {
    const found = circles.get(String(name));
    if (found === undefined) throw new Error(m.unknownCircle(String(name)));
    return found;
  }

  function addPoint(id: string, item: Record<string, unknown>): void {
    if (points.has(id)) throw new Error(m.duplicate(id));
    // 与える点。**ここだけ座標を書く。**
    const at = item.at;
    if (at !== undefined && at !== null && typeof at === 'object') {
      const box = at as Record<string, unknown>;
      points.set(id, { x: num(box.x ?? 0), y: num(box.y ?? 0) });
      return;
    }
    const where = item.intersect;
    if (!Array.isArray(where) || where.length !== 2) throw new Error(m.unknownPoint(id));
    const take = item.take;
    const first = String(where[0]);
    const second = String(where[1]);
    const found = lines.has(second)
      ? meetLine(circleOf(first), ...lines.get(second)!)
      : lines.has(first)
        ? meetLine(circleOf(second), ...lines.get(first)!)
        : meet(circleOf(first), circleOf(second));
    if (found.length === 0) throw new Error(m.noMeeting(first, second));
    if (found.length > 1) {
      if (take === undefined || take === null) throw new Error(m.takeMissing(id));
      if (!TAKES.includes(String(take) as Take)) throw new Error(m.takeUnknown(id, String(take)));
    }
    points.set(id, pick(found, (take ?? 'first') as Take)!);
  }

  function addCircle(id: string, item: Record<string, unknown>): void {
    if (circles.has(id)) throw new Error(m.duplicate(id));
    const center = item.center;
    if (center === undefined || center === null) throw new Error(m.circleNeedsCenter(id));
    const at = pointOf(center);
    circles.set(id, { cx: at.x, cy: at.y, r: num(item.r) });
  }

  function addLine(id: string, item: Record<string, unknown>): void {
    // **水平線**（`y:`）と**垂直線**（`x:`）は、2 点を書かずに済む。
    if (item.y !== undefined) {
      const y = num(item.y);
      lines.set(id, [{ x: 0, y }, { x: 1, y }]);
      return;
    }
    if (item.x !== undefined) {
      const x = num(item.x);
      lines.set(id, [{ x, y: 0 }, { x, y: 1 }]);
      return;
    }
    const through = item.through;
    if (!Array.isArray(through) || through.length !== 2) throw new Error(m.unknownPoint(id));
    lines.set(id, [pointOf(through[0]), pointOf(through[1])]);
  }

  function arcOf(item: Record<string, unknown>): Stroke {
    const circle = circleOf(item.of);
    // 端は**点で指す**のが作図の書き方。角でも書ける。
    const a0 = item.from === undefined ? 0 : angle(item.from);
    let a1 = item.to === undefined ? 360 : angle(item.to);
    /**
     * **両端を点で指したときは、短いほうの弧を採る。**
     *
     * 角は 0〜360 に丸めてあるので、そのままだと
     * **`356.8°` から `0°` へ「長いほうを回る」**ことになる。
     * 縦棒（半径 1,794 の円の 3.2° だけを使う）でこれが起きて、
     * **紙が 7,473 × 3,685 になった**（2026-09-15）。
     *
     * 長いほうを回りたいときは**角を数で書く** —— そちらは丸めない。
     */
    if (byPoint(item.from) && byPoint(item.to)) {
      if (a1 - a0 > 180) a1 -= 360;
      else if (a1 - a0 < -180) a1 += 360;
    }
    return {
      shape: 'arc',
      ...circle,
      a0,
      a1,
      weight: item.weight === undefined ? 1 : num(item.weight),
      cap: item.cap === 'butt' ? 'butt' : 'round',
      terminal: item.terminal === undefined ? null : num(item.terminal),
      trace: item.trace === true,
    };

    function angle(raw: unknown): number {
      if (typeof raw === 'number') return raw;
      const named = points.get(String(raw));
      if (named !== undefined) return angleOf(circle, named);
      return num(raw);
    }

    /** 点で指したか（数で書いたか）。 */
    function byPoint(raw: unknown): boolean {
      return typeof raw === 'string' && points.has(raw);
    }
  }
}

/**
 * 書かれた順に 1 本の列へ並べ直す。
 *
 * **点と円は混ざる**（点が円を要り、円が点を要る）ので、
 * 節ごとに分けて評価すると「前のものしか引けない」が守れない。
 * YAML は節の順を持たないため、**`steps` に書いてあればそちらを正とする。**
 */
function orderOf(raw: Source): (readonly ['point' | 'circle' | 'line', Record<string, unknown>])[] {
  const { steps } = raw;
  if (!Array.isArray(steps)) return [];
  const out: (readonly ['point' | 'circle' | 'line', Record<string, unknown>])[] = [];
  for (const one of steps) {
    if (one === null || typeof one !== 'object') continue;
    const item = one as Record<string, unknown>;
    // **かたまりを置く手順**は、点でも円でも線でもない（`build` が拾う）。
    if (item.place !== undefined) out.push(['point', item] as const);
    else if (item.center !== undefined) out.push(['circle', item] as const);
    else if (item.through !== undefined || item.y !== undefined || item.x !== undefined) out.push(['line', item] as const);
    else out.push(['point', item] as const);
  }
  return out;
}

/**
 * 描いたものの左右の端（**端の玉は数えない**）。
 *
 * **送り幅はここから出す。** 公表されている確定値も玉を含まない外接なので、
 * ここを合わせておくと、実物の数字とそのまま突き合わせられる。
 */
export function inkBounds(strokes: readonly Stroke[]): { left: number; right: number } | null {
  if (strokes.length === 0) return null;
  let left = Infinity;
  let right = -Infinity;
  for (const one of strokes) {
    const pad = one.weight / 2;
    const add = (x: number): void => {
      left = Math.min(left, x - pad);
      right = Math.max(right, x + pad);
    };
    if (one.shape === 'segment') {
      add(one.x0);
      add(one.x1);
      continue;
    }
    if (one.shape === 'circle' || Math.abs(one.a1 - one.a0) >= 360) {
      add(one.cx - one.r);
      add(one.cx + one.r);
      continue;
    }
    const at = (deg: number): void => add(one.cx + one.r * Math.cos((deg * Math.PI) / 180));
    at(one.a0);
    at(one.a1);
    const lo = Math.min(one.a0, one.a1);
    const hi = Math.max(one.a0, one.a1);
    for (const axis of [-360, -180, 0, 180, 360, 540]) if (axis > lo && axis < hi) at(axis);
  }
  return { left, right };
}
