/**
 * **書いた面積と、図の大きさが合っているか**（配置図・縮尺つきの図だけ）。
 *
 * 2026-10-04。見本の見直しで、手で書いた面積が図と食い違っていた例がいくつも出た
 * （専有面積が箱の大きさと合わない、帖を四捨五入して 1.62㎡ を割る、LDK の帖数が別の部屋の値）。
 * 図形から計算できる数を、人も AI も手で書いて間違える。
 *
 * 見るのは、箱の名前（`label`）と添え書き（`technology`）にある 2 つの書き方だけ。
 *
 * | 書き方 | 照らす値 |
 * |---|---|
 * | `13.20㎡`・`13.2 m²` | 箱の幅 × 高さ（縮尺で m に直した値）から、中に入れ子にした部屋を引いた値。3% より離れていたら知らせる |
 * | `8.1帖`・`8.1J`・`8.1畳` | 面積 ÷ 1.62 を小数 1 桁で切り捨てた値（表示規約の 1 帖 1.62㎡ 以上）。それより大きい帖数は知らせる |
 *
 * 「K 含む」「合計」「＋」のように、**箱 1 つでない面積**を書いた所は見ない。
 */

export interface AreaIssue {
  id: string;
  /** `sqm` ＝ 平方メートル、`mat` ＝ 帖（文言は `src/messages.ts`）。 */
  unit: 'sqm' | 'mat';
  /** 書いてあった値。 */
  written: number;
  /** 図から出る値（帖は、書いてよい上限）。 */
  expected: number;
}

const SQM = /([0-9]+(?:\.[0-9]+)?)\s*(?:㎡|m²|m2)/;
const MAT = /([0-9]+(?:\.[0-9]+)?)\s*(?:帖|畳|J)(?![a-zA-Z])/;
const NOT_ONE_BOX = /含|合計|＋|\+|込|計|延床|専有|敷地|バルコニー|Balcony/;

export function areaIssues(
  nodes: readonly { id: string; text: string; x: number; y: number; w: number; h: number; drawn: boolean }[],
  /** 1px が何 mm か（`scale: { mm }`）。 */
  mm: number,
): AreaIssue[] {
  const found: AreaIssue[] = [];
  for (const node of nodes) {
    // 文字だけの節（凡例・注記・表の欄）は部屋ではない。部屋は線で囲んで描く
    if (!node.drawn || node.w < 30 || node.h < 30) continue;
    if (NOT_ONE_BOX.test(node.text)) continue;
    // **中に入れ子にした部屋（収納など）は引く** —— 寝室の中の WIC は、寝室の面積に入れない書き方が普通
    const inner = nodes
      .filter((o) => o !== node && o.drawn && o.w > 20 && o.h > 20 && o.x >= node.x && o.y >= node.y && o.x + o.w <= node.x + node.w && o.y + o.h <= node.y + node.h)
      .reduce((sum, o) => sum + o.w * o.h, 0);
    const area = ((node.w * node.h - inner) * mm * mm) / 1e6;
    if (area < 1) continue;
    const sqm = node.text.match(SQM);
    if (sqm !== null) {
      const written = Number(sqm[1]);
      // 半分〜2 倍の外は、別のもの（表の値・注記の例）を指した数とみなして見ない
      const near = written > area / 2 && written < area * 2;
      if (near && Math.abs(written - area) / area > 0.03) {
        found.push({ id: node.id, unit: 'sqm', written, expected: Math.round(area * 100) / 100 });
      }
    }
    const mat = node.text.match(MAT);
    if (mat !== null) {
      const written = Number(mat[1]);
      const most = Math.floor((area / 1.62) * 10 + 1e-9) / 10;
      if (written > most + 1e-9 && written < most * 2) {
        found.push({ id: node.id, unit: 'mat', written, expected: most });
      }
    }
  }
  return found;
}
