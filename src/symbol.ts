/**
 * **電気・電子の図記号**（`nodes[].symbol`）。
 *
 * ## オーナーの指摘で、前言を訂正する
 *
 * 電子回路図について「いまの道具では作れない」と言い、理由を 2 つ挙げた。
 * オーナーからこう返った（2026-09-13）。
 *
 * > 端子や記号はイメージとしては **svg とか一度作れば位置も大きさも自由**では
 * > とおもいますが。
 *
 * **そのとおりで、私の 1 つ目の理由は間違っていた。**
 * 記号を描くこと自体は、建具の弧（`src/openings.ts`）や鳥の足（`src/ends.ts`）や
 * 高さ記号（`src/dimensions.ts`）と同じ —— **正規化した箱の中に線を引くだけ。**
 * 位置も大きさも `at` と `size` に従う。
 *
 * ## 「語彙が増える」という反論も、半分だけ正しかった
 *
 * D22 で断ったのは **`type` を業界ごとに増やすこと**で、理由は
 * 「語彙が増えるほど、同じものを違う語で書く人が増え、**差分が読めなくなる**」。
 *
 * **その心配は、自分で語を決めるときにだけ当てはまる。**
 *
 * | | `type` を増やす | `symbol` |
 * |---|---|---|
 * | 語を決めるのは | **こちら**（勝手に足せる） | **規格**（JIS C 0617 / IEC 60617） |
 * | 同じものを違う語で書けるか | 書ける（`server` と `host`） | **書けない**（規格の語しかない） |
 * | `type` の 11 語 | 増える | **増えない** |
 *
 * ISA のタグ（`TIC-101`）や WHO の経穴番号（`LU-1`）を `tag` に受け入れたのと
 * 同じ筋 —— **外の規格の名前は、こちらが決めた語彙ではない。**
 *
 * ## ただし、止める条件を置く
 *
 * 記号は**際限なく増やせる**（JIS C 0617 は 1,900 記号ある）。
 * 次のどれかに当たったら、**そこで止めて人へ返す。**
 *
 * 1. **1 つの図で 20 記号を超えて要求されたとき。**
 *    それは「回路図を描く道具」を作り始めている（専用ソフトの領域）
 * 2. **記号の中に文字を入れろと言われたとき**（IC のピン番号表など）。
 *    それは図ではなく表で、`rows` のような別の話になる
 * 3. **同じ記号を業界ごとに違う形で描けと言われたとき。**
 *    ANSI（ジグザグの抵抗）と IEC（長方形の抵抗）の混在がそれ。
 *    **どちらか一方に決める**（ここは IEC／JIS。長方形）
 *
 * ## 足（端子）
 *
 * 記号は**足の位置を自分で知っている。** 2 本足の部品（抵抗・コンデンサ・
 * ダイオード）は、**辺が近いほうの足へ自動で繋がる**ので、正本に何も書かなくてよい。
 *
 * **3 本以上の部品（トランジスタ・オペアンプ）は、足に名前が要る。**
 * それはまだ入れていない（`from: q1.b` のような書き方になる）。
 */
import type { Rect } from './openings.ts';

/**
 * 描ける記号。**IEC／JIS の形**（抵抗は長方形。ジグザグの ANSI 形は採らない）。
 *
 * **13 で止めている。** 増やすときは、上の「止める条件」を読むこと。
 */
export const SYMBOLS = [
  'resistor',
  'variable-resistor',
  'capacitor',
  'polarized-capacitor',
  'inductor',
  'diode',
  'led',
  'battery',
  'source',
  'ground',
  'switch',
  'fuse',
  'lamp',
] as const;
export type Symbol = (typeof SYMBOLS)[number];

export function symbolOf(raw: unknown): Symbol | null {
  return SYMBOLS.includes(raw as Symbol) ? (raw as Symbol) : null;
}

export interface Paint {
  stroke: string;
  paper: string;
}

function n(value: number): number {
  return Math.round(value);
}

/**
 * 足（端子）の位置。
 *
 * 横長の箱なら左右、縦長なら上下に出る。**接地だけは 1 本**（上）。
 * 辺はここへ繋がる（`src/layout.ts` の `clip`）。
 */
export function legsOf(symbol: Symbol, box: Rect): { x: number; y: number }[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  if (symbol === 'ground') return [{ x: cx, y: box.y }];
  if (box.w >= box.h) {
    return [
      { x: box.x, y: cy },
      { x: box.x + box.w, y: cy },
    ];
  }
  return [
    { x: cx, y: box.y },
    { x: cx, y: box.y + box.h },
  ];
}

/**
 * 記号を描く。
 *
 * **足まで線を引く。** 記号の本体は箱の中ほどにあり、
 * 両端の足へ向かって引き出し線が出る（実物の回路図と同じ）。
 */
export function drawSymbol(symbol: Symbol, box: Rect, paint: Paint): string {
  // **接地は必ず縦向き**（足が上、横棒が下）。
  // 横向きの接地記号は無い —— 箱が横長でも向きを変えない。
  const flat = symbol === 'ground' ? false : box.w >= box.h;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // 本体の長さ（足の向きに沿う）と、太さ（直交する向き）。
  const span = (flat ? box.w : box.h) * 0.44;
  const half = (flat ? box.h : box.w) / 2;
  const ink = `stroke="${paint.stroke}" stroke-width="1.4" fill="none"`;

  /** 足の向きに `a`、直交する向きに `b` 進んだ点。 */
  const at = (a: number, b: number): { x: number; y: number } =>
    flat ? { x: cx + a, y: cy + b } : { x: cx + b, y: cy + a };
  const line = (a1: number, b1: number, a2: number, b2: number, extra = ''): string => {
    const p = at(a1, b1);
    const q = at(a2, b2);
    return `<line x1="${n(p.x)}" y1="${n(p.y)}" x2="${n(q.x)}" y2="${n(q.y)}" stroke="${paint.stroke}" stroke-width="1.4"${extra}/>`;
  };

  const parts: string[] = [];

  if (symbol === 'ground') {
    // 接地。**3 本の横線が短くなる**（JIS）。足は上に 1 本だけ。
    parts.push(line(-half, 0, 0, 0));
    for (const [i, w] of [9, 6, 3].entries()) {
      const y = i * 4;
      const p = at(y, -w);
      const q = at(y, w);
      parts.push(
        `<line x1="${n(p.x)}" y1="${n(p.y)}" x2="${n(q.x)}" y2="${n(q.y)}" stroke="${paint.stroke}" stroke-width="1.4"/>`,
      );
    }
    return parts.join('');
  }

  // 引き出し線（両端の足へ）。
  parts.push(line(-half, 0, -span, 0), line(span, 0, half, 0));

  if (symbol === 'resistor' || symbol === 'variable-resistor') {
    // 抵抗。**長方形**（IEC／JIS）。ジグザグの ANSI 形は採らない。
    const p = at(-span, -6);
    parts.push(
      flat
        ? `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(span * 2)}" height="12" ${ink}/>`
        : `<rect x="${n(at(-span, -6).x)}" y="${n(at(-span, -6).y)}" width="12" height="${n(span * 2)}" ${ink}/>`,
    );
    if (symbol === 'variable-resistor') {
      // 可変。**斜めの矢印が本体を横切る。**
      const a = at(-span - 4, 10);
      const b = at(span + 4, -10);
      parts.push(
        `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${paint.stroke}" stroke-width="1.4" marker-end="url(#arrow)"/>`,
      );
    }
    return parts.join('');
  }

  if (symbol === 'capacitor' || symbol === 'polarized-capacitor') {
    // コンデンサ。**2 本の平行線。** 足の間を空ける。
    parts.length = 0;
    parts.push(line(-half, 0, -3, 0), line(3, 0, half, 0));
    parts.push(line(-3, -9, -3, 9));
    if (symbol === 'capacitor') {
      parts.push(line(3, -9, 3, 9));
      return parts.join('');
    }
    // 有極。**片側が弧**（電解コンデンサ）。
    const a = at(3, -9);
    const b = at(3, 9);
    parts.push(
      `<path d="M ${n(a.x)} ${n(a.y)} Q ${n(at(9, 0).x)} ${n(at(9, 0).y)} ${n(b.x)} ${n(b.y)}" ${ink}/>`,
    );
    return parts.join('');
  }

  if (symbol === 'inductor') {
    // コイル。**半円を 4 つ並べる。**
    const r = span / 2;
    let d = `M ${n(at(-span, 0).x)} ${n(at(-span, 0).y)}`;
    for (let i = 0; i < 4; i += 1) {
      const to = at(-span + (i + 1) * (r), 0);
      d += ` A ${n(r / 2)} ${n(r / 2)} 0 0 1 ${n(to.x)} ${n(to.y)}`;
    }
    parts.push(`<path d="${d}" ${ink}/>`);
    return parts.join('');
  }

  if (symbol === 'diode' || symbol === 'led') {
    // ダイオード。**三角と、それに接する線**（陰極側）。
    const tip = at(span * 0.5, 0);
    const b1 = at(-span * 0.5, -8);
    const b2 = at(-span * 0.5, 8);
    parts.push(
      `<path d="M ${n(b1.x)} ${n(b1.y)} L ${n(b2.x)} ${n(b2.y)} L ${n(tip.x)} ${n(tip.y)} Z" fill="${paint.stroke}" stroke="${paint.stroke}"/>`,
      line(span * 0.5, -8, span * 0.5, 8),
    );
    if (symbol === 'led') {
      // 発光。**外向きの矢印 2 本。**
      for (const off of [-3, 3]) {
        const a = at(off, -10);
        const b = at(off + 4, -17);
        parts.push(
          `<line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${paint.stroke}" stroke-width="1.2" marker-end="url(#arrow)"/>`,
        );
      }
    }
    return parts.join('');
  }

  if (symbol === 'battery') {
    // 電池。**長い線と短い線の組を 2 つ。**
    parts.push(line(-6, -10, -6, 10), line(-2, -5, -2, 5), line(2, -10, 2, 10), line(6, -5, 6, 5));
    return parts.join('');
  }

  if (symbol === 'source') {
    // 電源。**丸**（中に何を書くかは `label` と `technology` に任せる）。
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(Math.min(span, half))}" ${ink}/>`);
    return parts.join('');
  }

  if (symbol === 'switch') {
    // スイッチ。**片方の足から斜めに離れた線**（開いた状態）。
    parts.push(line(-span, 0, span * 0.6, -9));
    parts.push(`<circle cx="${n(at(-span, 0).x)}" cy="${n(at(-span, 0).y)}" r="2" fill="${paint.stroke}"/>`);
    parts.push(`<circle cx="${n(at(span, 0).x)}" cy="${n(at(span, 0).y)}" r="2" fill="${paint.stroke}"/>`);
    return parts.join('');
  }

  if (symbol === 'fuse') {
    // ヒューズ。**長方形の中を線が貫く**（JIS）。
    const p = at(-span, -6);
    parts.push(
      `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(flat ? span * 2 : 12)}" height="${n(flat ? 12 : span * 2)}" ${ink}/>`,
      line(-span, 0, span, 0),
    );
    return parts.join('');
  }

  // ランプ。**丸の中に斜め十字。**
  const r = Math.min(span, half);
  parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${ink}/>`);
  const d = r * 0.7;
  parts.push(line(-d, -d, d, d), line(-d, d, d, -d));
  return parts.join('');
}
