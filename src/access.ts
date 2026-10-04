/**
 * **部屋へ、通り道から入れるか**（配置図だけ。合否ではなく観測値）。
 *
 * 2026-10-04。見本の見直しで、間取り 8 枚の動線が壊れていた ——
 * 便所へ居間を横切らないと入れない、寝室へ浴室や収納を通らないと入れない。
 * 扉の扇も交差も重なりも 0 のまま、**どの検査も「どこから入るか」を見ていなかった。**
 *
 * 見るのは、建具（`openings` の door / double / slide / open）が**どの部屋とどの部屋をつなぐか**だけ。
 * 部屋の種類は名前で読む（便所・浴室・寝室・廊下…）。名前で読めない部屋は数えない。
 *
 * | 部屋 | 入ってよい先 |
 * |---|---|
 * | 便所 | 廊下・ホール・玄関、洗面・脱衣 |
 * | 浴室 | 洗面・脱衣・更衣、廊下、寝室（寝室付きの浴室） |
 * | 寝室・個室 | 廊下・ホール、居間・台所（LDK・茶の間・1K の K）、和室どうし（続き間） |
 *
 * 通り道（廊下・ホール・玄関・階段）が 1 つも無い図は、間取りではないとみなして見ない。
 */
import type { Box } from './layout.ts';

const CIRCULATION = /廊下|ホール|Hall|Corridor|玄関|Entrance|Entry|階段|Stair|ポーチ|Lobby|ロビー|アルコーブ|Alcove|EV|Foyer|Mudroom|Bridge|Landing|踊り場/i;
const TOILET = /(^|[^A-Za-z])WC|便所|トイレ|Toilet|Powder/i;
const BATH = /浴室|風呂|(^|[^A-Za-z])UB|Bath/i;
const DRESS = /洗面|脱衣|Wash|Lav|Dressing|更衣|Locker/i;
const LIVING = /LDK|(^|[^A-Za-z])LD|(^|[^A-Za-z])K$|リビング|居間|茶の間|台所|キッチン|Living|Dining|Kitchen/i;
const BEDROOM = /寝室|洋室|和室|Bedroom|子ども部屋|客間|応接間|書斎|Master|Primary|Suite|(^|[^A-Za-z])BR([^A-Za-z]|$)/i;
const TATAMI = /和室|茶の間|客間/;

type Kind = 'circulation' | 'toilet' | 'bath' | 'dress' | 'living' | 'bedroom' | 'other';

function kindOf(box: Box): Kind {
  // **名前の無い部屋は、通り道とみなす**（廊下は名前を書かないことが多い。間取り図の慣行）
  if (box.label.trim() === '') return 'circulation';
  const name = `${box.label} ${box.technology ?? ''}`.trim();
  if (CIRCULATION.test(name)) return 'circulation';
  if (TOILET.test(name)) return 'toilet';
  if (BATH.test(name)) return 'bath';
  if (DRESS.test(name)) return 'dress';
  if (LIVING.test(name)) return 'living';
  if (BEDROOM.test(name)) return 'bedroom';
  return 'other';
}

/** 建具の中点から、壁の外へ 4px 出た点を含む、いちばん小さい部屋。 */
function across(box: Box, hole: Box['openings'][number], rooms: readonly Box[]): Box | null {
  const along = hole.side === 'top' || hole.side === 'bottom' ? box.w : box.h;
  const offset = Math.max(0, Math.min(along - hole.width, along * hole.at - hole.width / 2)) + hole.width / 2;
  const p =
    hole.side === 'top'
      ? { x: box.x + offset, y: box.y - 4 }
      : hole.side === 'bottom'
        ? { x: box.x + offset, y: box.y + box.h + 4 }
        : hole.side === 'left'
          ? { x: box.x - 4, y: box.y + offset }
          : { x: box.x + box.w + 4, y: box.y + offset };
  const hits = rooms.filter(
    (r) => r !== box && p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h,
  );
  hits.sort((a, b) => a.w * a.h - b.w * b.h);
  return hits[0] ?? null;
}

/** 入れる先が無い部屋の種類（文言は `src/messages.ts` の `roomAccessWhy`）。 */
export type AccessIssue = 'toilet' | 'bath' | 'bedroom';

/** `[部屋, 種類]`。 */
export function roomAccess(boxes: readonly Box[]): [string, AccessIssue][] {
  // 文字だけの節（`marker: none`）は部屋ではない（凡例・注記・表の欄）
  // 名前の無い箱も入れる（名前を書かない廊下が多い）。文字だけの節（`marker: none`）は部屋ではない
  const rooms = boxes.filter((b) => b.marker !== 'none' && b.w > 20 && b.h > 20);
  const kinds = new Map(rooms.map((r) => [r.id, kindOf(r)] as const));
  if (![...kinds.values()].includes('circulation')) return [];

  // 建具でつながる部屋どうし（向きは問わない）
  const links = new Map<string, Set<string>>(rooms.map((r) => [r.id, new Set<string>()]));
  const outside = new Set<string>();
  for (const room of rooms) {
    for (const hole of room.openings) {
      if (hole.kind === 'window') continue;
      const other = across(room, hole, rooms);
      // **外へ開く建具は、外（通り道）へ出られる**（仮設便所・勝手口・ポーチへの玄関）
      if (other === null) {
        outside.add(room.id);
        continue;
      }
      links.get(room.id)!.add(other.id);
      links.get(other.id)!.add(room.id);
    }
  }

  const found: [string, AccessIssue][] = [];
  for (const room of rooms) {
    // 建具が 1 つも無く、どこからもつながっていない箱は、部屋ではなく表や凡例の欄とみなす
    if (room.openings.length === 0 && links.get(room.id)!.size === 0) continue;
    const kind = kinds.get(room.id)!;
    const next = [...links.get(room.id)!].map((id) => ({ id, kind: kinds.get(id)!, box: rooms.find((r) => r.id === id)! }));
    const ok = (allowed: Kind[]): boolean => outside.has(room.id) || next.some((n) => allowed.includes(n.kind));
    if (kind === 'toilet' && !ok(['circulation', 'dress'])) {
      found.push([room.id, 'toilet']);
    } else if (kind === 'bath' && !ok(['dress', 'circulation', 'bedroom'])) {
      found.push([room.id, 'bath']);
    } else if (kind === 'bedroom') {
      const tatami = TATAMI.test(room.label);
      const reach = next.some(
        (n) => n.kind === 'circulation' || n.kind === 'living' || (tatami && n.kind === 'bedroom' && TATAMI.test(n.box.label)),
      ) || outside.has(room.id);
      if (!reach) found.push([room.id, 'bedroom']);
    }
  }
  return found;
}
