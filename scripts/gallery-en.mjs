/**
 * **見本の英語の説明。** 名前で引く。
 *
 * ## なぜ別のファイルか
 *
 * 並びと分類の正本は `gallery-categories.mjs`。**そこに 2 言語を混ぜると、
 * どちらの言語を直しているのか読みながら分からなくなる。**
 * ここは「名前 → 英語の 1 行」だけを持つ。
 *
 * **足し忘れは検査が落とす**（`test/gallery-en.test.ts`）——
 * 見本を足して英語を書き忘れると、英語のページにその 1 枚だけ日本語が出る。
 *
 * 日本語の側と**同じことを言わなくてよい。** 読み手が違う ——
 * 「山手線」は向こうでは通じないので "Tokyo's loop line" と書く。
 */

/** 分類の見出し。 */
export const GROUPS_EN = {
  tetsudo: 'Transit and transport',
  kenchiku: 'Building and civil',
  setsubi: 'Services and electrical',
  iryo: 'Health, food and farming',
  tenpo: 'Retail and logistics',
  gyomu: 'Work and organisations',
  moyooshi: 'Events and games',
  ui: 'UI and screen design',
  it: 'IT and software',
};

/**
 * **英語のページだけの分類の順**（2026-09-16）。
 *
 * 並びの正本は `gallery-categories.mjs` だが、そのまま出すと
 * **英語のページが日本の路線図から始まる。** 図の中の文字が日本語のままなので、
 * 初めて見た人はそこで読むのをやめる。英語で書いた見本が多い建築から始め、
 * 日本の鉄道は最後に置く。**見本は 1 枚も落とさない**（数は両方のページで同じ）。
 */
export const ORDER_EN = [
  'kenchiku',
  'setsubi',
  'iryo',
  'tenpo',
  'moyooshi',
  'gyomu',
  'ui',
  'it',
  'tetsudo',
];

/**
 * **分類の中では、英字の名前の見本を先に。**
 *
 * 英字の名前は、**図の中も英語で書いた見本**（`140-Exterior-wall-platform-framing`）。
 * 並べ替えは安定 —— 同じ側どうしの順は正本のまま。
 */
export function englishFirst(items) {
  const latin = (item) => !/[\u3040-\u30ff\u4e00-\u9fff]/.test(item.name);
  return [...items.filter(latin), ...items.filter((item) => !latin(item))];
}

/** 名前 → 英語の 1 行。**alt にもこれを使う**（飾りを入れない）。 */
export const CAPTIONS_EN = {
  // 鉄道・交通
  '25-路線図': 'Transit map',
  '78-山手線の路線図': "Tokyo's loop line (30 stations)",
  '81-東京の地下鉄13路線': 'Tokyo subway, 13 lines on one map',
  '79-梅田の乗換関係図': 'Seven stations all called Umeda, and the walk between them',
  '80-中央線快速の停車駅一覧': 'Which trains stop where, weekday and weekend',
  '52-停車駅案内図': 'Stopping pattern chart: a band per service, a circle per stop',
  '54-のりかえ案内図': 'Interchange guide with station names set vertically',
  '53-駅時刻表': 'Station timetable (weekday / weekend)',
  '45-駅の構内図': 'Station plan, two levels',
  '82-多層ターミナルの乗換案内図': 'Interchange across three levels, with the vertical moves',
  '83-駅の配線略図': 'Track layout: two islands, four roads, passing possible',
  '71-列車運行図表': 'Train graph: time against distance',
  '111-閉塞と信号現示': 'Block sections and signal aspects, counted back from the train ahead',
  '29-車両の編成図': 'Train formation, ten cars',
  '56-バスの時刻表': 'Bus stop timetable',
  '63-フェリーの発着表': 'Ferry sailings, with the routes',
  '57-登山のコースタイム図': 'Hiking times against elevation',
  '102-ドローンの飛行計画図': 'Drone flight plan and the area kept clear of people',
  '61-道路の平面線形図': 'Road alignment with curves',
  '37-配送ルート': 'Delivery rounds for three vans',

  // 建築・土木
  '14-間取り': 'Apartment plan',
  '24-校舎の平面図': 'School floor plan (walls, door swings, grid lines, dimensions)',
  '32-ホテルの基準階': 'Hotel typical floor, twelve rooms',
  '134-梁の配筋図': 'Beam reinforcement: the last moment it can be changed is before the pour',
  '17-躯体の伏図': 'Concrete framing plan',
  '136-天井伏図': 'Reflected ceiling plan: you look up by drawing it looking down',
  '139-矩計図': 'Japanese wall section, where seven heights are fixed at once',
  '140-Exterior-wall-platform-framing': 'Exterior wall framing, in the order a framer builds it',
  '143-Roof-framing-plan': 'Roof framing: in plan a rafter is a line',
  '151-Deck-framing-plan': 'Deck framing: a load path in seven parts',
  '144-Accessible-toilet-room': 'Accessible toilet room: the drawing is made of clearances',
  '141-Two-story-house-plan': 'Two-story house plan in feet and inches, with OPEN TO BELOW',
  '95-避難所レイアウト': 'Shelter layout: 3.5 sq m a person, and how many toilets',
  '22-避難経路図': 'Escape routes, third floor',
  '148-Egress-plan': 'Egress plan: three lengths answering three questions',
  '119-消火器と消火栓の配置図': 'Extinguishers and hose reels, measured two different ways',
  '158-Cattle-handling-facility': 'Every dimension comes from what cattle will not do',
  '172-宮殿の儀礼動線図': 'A palace enfilade: how far down the rooms you are taken IS your rank',
  '171-クロスワードの盤面図': 'A crossword is a grid before it is words: the black squares decide the lengths',
  '170-レゴのモザイク割り付け図': 'A brick mosaic chart: the colour IS the instruction, so every cell also carries a code',
  '169-麻雀の配牌': 'Mahjong: the dice decide where the wall is opened, not luck',
  '168-ダイヤモンドシステム': 'Billiards: the diamonds on the rails are a ruler, not decoration',
  '167-ダーツボードの割り付け': 'A dartboard: the numbers are arranged to punish a miss',
  '218-窯詰めの棚組み': 'Kiln loading: three posts per shelf, because three points always lie in one plane — and bisque and glaze firings are packed in opposite ways',
  '217-上部式フィルターの断面': 'Aquarium filter in section: it does not remove the poison, it turns it into a weaker one — and the water must meet the mechanical media before the biological',
  '216-日本の硬貨6種': 'Japanese coins: the order by size is not the order by value, so the hand reads the hole first, then the reeding, and only then the size',
  '215-NANDフラッシュの階層': 'NAND flash: reads and writes go by the page, erases only by the block — every other property of an SSD follows from that mismatch',
  '214-日影規制と等時間日影図': 'Shadow-hour zoning: the iso-shadow lines here were computed, not sketched — the inner line clears its limit but the outer one does not',
  '213-血球計算盤の目盛り': 'Haemocytometer grid: the 0.100mm depth is what turns an area into a volume, so one 1mm square holds exactly 0.1 microlitres',
  '212-割物花火の断面': 'Aerial shell in section: the stars keep their relative positions as they fly, so how they are packed is the shape you see',
  '211-N値計算と接合金物': 'Hold-down selection (N-value method): the stronger a shear wall is, the harder it pulls its end post out of the ground',
  '210-楽譜の寸法': 'Music engraving: the staff space is the unit for every measurement, and the stem is 3.5 of them',
  '209-コンパスと定規の作図': 'Ruler-and-compass constructions: no scale is used, because equal compass openings make equal lengths',
  '208-建蔽率と容積率': 'Floor-area ratio in Japan: a narrow street caps it below the zoned figure, so the road sizes the building',
  '207-ウェハのダイ取り': 'Die-per-wafer: squares in a circle, so the bigger the die the larger the share thrown away',
  '206-ピアノのアクション': 'A piano action: the jack lets go just before the string, so nothing is pushing the hammer at impact',
  '205-ホールの初期反射': 'Hall acoustics: delay is nothing but a difference in path length \u2014 one millisecond is 0.34 m',
  '204-ギターのフレット位置': 'Guitar frets are a geometric series, and the saddle must still be moved back to play in tune',
  '203-壁量計算と4分割法': 'Japanese timber wall-quantity check: enough shear wall still fails if it sits on one side',
  '202-斜線制限': 'Japanese setback planes: the shape of a house is decided by slanting lines, not by the plot',
  '201-椅子の製作図': 'A chair drawn for making: four tenons meet in the back leg, and they must be set at different heights',
  '200-作業机の製作図': 'A bench built for making: tenons mitred where they meet, and a top that is never screwed down',
  '199-日本銀行券の識別マーク': 'Banknote tactile marks: the shape is identical, and only its position tells the denomination',
  '198-ミツバチの巣房': 'Honeycomb cells: for a given area the hexagon has the shortest wall of any shape that tiles',
  '197-等角図と三面図': 'Isometric, third-angle and oblique: one scale serves all three axes, but circles become ellipses',
  '196-勾配の書き方': 'Slope notation: roofs in sun, ramps in fractions, roads in percent, railways in per mille \u2014 degrees are the minority',
  '195-学校の机と椅子': 'School desks and chairs are sized by height, not by year, and the pair must match',
  '194-点字の6点': 'Braille has only six dots, so \u201ca\u201d and \u201c1\u201d are the same shape until a number sign says otherwise',
  '193-カードの版面': 'A trading card layout: the back must look the same upside down, or the face is readable from the table',
  '192-サッカーボールの形': 'A football is a truncated icosahedron: the 12 degrees missing at every vertex are what make it a sphere',
  '191-凸レンズの作図': 'Ray tracing through a convex lens: there are only three lines to draw, and two of them fix the image',
  '190-中綴じの面付け': 'Saddle-stitch imposition: facing page numbers always add up to the page count plus one',
  '189-点字ブロック': 'Tactile paving: only two kinds, and one line tells you which side the platform is on',
  '188-裁判員裁判の法廷': 'A lay-judge courtroom: the prosecution sits on the bench\u2019s right, so on the plan it is on the left',
  '187-合板の木取り図': 'A plywood cutting diagram: enough area is not the same as a way to cut it',
  '186-冷蔵庫の据付と搬入': 'Fitting a refrigerator: clearances differ by model, and a corner turns on the diagonal',
  '185-地上天気図の読み方': 'A surface chart: the barbs tell you which way the front is moving',
  '184-本会議場の議席配置': 'A debating chamber: the seating order itself states how large each bloc is',
  '183-台風の進路予想図': 'A typhoon forecast: the circle is where the centre lands 70% of the time',
  '182-公園の遊具と安全領域': 'Playground clearances: the fall height decides how much space to keep',
  '181-伽藍配置の移り変わり': 'Temple layouts through time: the pagoda drifts away from the centre',
  '180-継手と仕口': 'Japanese timber joints: pulled harder, they tighten; each post has a name',
  '179-革靴の型紙': 'A shoe pattern comes off the last: tape it, draw on it, peel it flat',
  '178-靴のサイズの図': 'Shoe sizing as a nomogram: 25.0 EE and 26.0 E are the same girth',
  '177-帽子の型紙': 'A hat pattern: a 12cm side wall unrolls into a fan of 50cm radius',
  '176-トートバッグの型紙と裁ち方図': 'A bag pattern: half of it is drawn, and the yardage falls out of the layout',
  '175-ペルシャ絨毯の意匠図': 'A Persian rug cartoon: one square is one knot, and only a quarter is drawn',
  '174-送電線路の縦断面図': 'A transmission line profile: the wire sags, and the towers are sized so it still clears',
  '173-販売図面-英語表記': 'The greyscale version of the same trade: walls as mass, no loose furniture',
  '166-マンションの販売図面': 'An estate agent floor plan: made to decide with, not to build from',
  '165-地図記号の絵地図': 'Japanese map symbols: a circle around a sign makes it the senior one',
  '164-小学校の回路図': 'The circuit diagram taught at primary school: series and parallel',
  '163-Residential-duct-layout': 'Ducts are sized by a pressure budget, not by the room',
  '162-Cabin-LOPA': 'The seat count is not what fits - it is what the exits allow',
  '161-Weaving-draft': 'Three small grids decide the fourth - the cloth is computed',
  '160-Change-ringing-method': 'A method is not a tune - it is a path through a grid',
  '159-Fire-IAP-map': 'Not a picture of the fire - the way out is written on it',
  '157-Drill-chart': 'No dimensions on it - the field is the ruler',
  '156-Metes-and-bounds-plat': 'A deed describes land as a walk, not a picture',
  '155-Lane-closure-plan': 'A lane closure is mostly road, not work',
  '154-Fire-alarm-plan': 'Fire alarm devices: spacing is a circle, not a square',
  '145-Sprinkler-layout': 'Sprinkler layout: area per head and spacing, decided together',
  '33-駐車場の区画割': 'Parking layout, fourteen bays',
  '152-Septic-site-plan': 'Septic site plan: a plan decided by how fast water leaves the soil',
  '147-Site-plan-setbacks': 'Site plan: the envelope is the lot with the yards taken out',
  '30-総合仮設計画図': 'Site logistics plan with the crane radius',
  '138-ロープ高所作業の作業計画図': 'Rope access work plan — the law says what the drawing must carry',
  '51-工事工程表': 'Construction bar chart',
  '42-擁壁の標準断面図': 'Retaining wall section',
  '43-舗装構成の断面図': 'Pavement build-up',
  '114-点字ブロックの敷設図': 'Tactile paving: bars mean go, dots mean stop',
  '28-ダムの平面図': 'Gravity dam plan',
  '27-圃場整備の平面図': 'Farmland consolidation plan',
  '62-寺院庭園の平面図': 'Temple garden plan, drawn with closed curves',
  '41-露地の平面図': 'Tea garden path and planting',

  // 設備・電気
  '18-配管の系統': 'Piping and instrumentation diagram',
  '38-計装ループ図': 'Instrument loop diagram (ISA tags)',
  '19-受変電の結線': 'Substation single-line diagram',
  '142-Panel-schedule': 'Panel schedule: the table is shaped like the panel',
  '50-電子回路図': 'Electronic circuit (IEC symbols)',
  '06-家の電気系統': 'House electrical layout',
  '10-給排水の系統': 'House water and drainage',
  '103-陸上養殖の循環系統図': 'Land-based aquaculture: the water is cleaned, not replaced',
  '35-配水系統図': 'Water distribution network',
  '44-人工衛星の系統図': 'Satellite subsystems',

  // 医療・食品・農
  '72-歯周チャート': 'Periodontal chart, six points a tooth',
  '146-Restorative-chart': 'Restorative chart: one number fixes a tooth',
  '39-経絡と経穴': 'Meridians and points (WHO standard)',
  '36-手術室の機器配置': 'Operating room equipment layout',
  '09-患者の動線': 'Outpatient flow',
  '108-おせち重箱の詰め方': 'New year box: odd numbers, and no gaps',
  '104-牛枝肉の部分肉分割図': 'Beef cutting chart: the bones decide the lines',
  '23-厨房の動線': 'Kitchen zones and one-way flow (HACCP)',
  '115-食品工場のアレルゲン動線図': 'Allergen flow: never let the path double back',
  '135-工業用パターン': 'Industrial pattern: cloth cannot be uncut',
  '100-裁ち合わせ図': 'Cutting layout: the pattern may not be turned',
  '40-弁当の盛付図': 'Bento packing instructions',
  '94-ヘアカラーのブロッキング図': 'Hair colour sectioning: the order is the content',
  '92-防虫モニタリングの定点配置図': 'Pest monitoring: the stations never move',
  '91-リンゴ高密植栽培の樹形図': 'High-density apple training, with tree and row spacing',
  '125-庭木の剪定指示図': 'Pruning instructions: not which branch, but where to cut it',
  '131-刺網の網図': 'Gill net: the mesh opens because the net is hung short',
  '105-養蜂の巣枠配置図': 'Hive frames: reorder them and the brood goes cold',
  '73-サビキ仕掛け図': 'Fishing rig, six hooks',

  // 店舗・物流
  '15-店舗のレイアウト': 'Shop layout',
  '58-商店街の店舗案内図': 'Shopping street directory, trade by hatch',
  '59-フードコートの配置図': 'Food court layout',
  '109-ヤーデージブック': 'Yardage book: shade the surfaces, write the distances',
  '60-ドームの座席等級図': 'Stadium seating by price band',
  '150-Baseball-infield': 'Baseball infield: every distance starts at the apex of home plate',
  '97-防犯カメラの視野図': 'Camera coverage, out to the distance a face still reads',
  '153-Parking-striping': 'Parking striping: the access aisle is not spare tarmac',
  '34-倉庫のロケーション': 'Warehouse location addressing',
  '149-Pallet-rack-layout': 'Pallet rack: the truck decides the aisle',
  '116-引越しの搬入経路図': 'Moving route: the drawing that says whether it fits',
  '98-パレット積付図': 'Pallet patterns, and what they do to stability',
  '132-クレーン揚重計画図': 'Crane lift plan: the further out, the less it lifts',
  '120-トラックの積載計画図': 'Truck loading: weight times distance from the axle',
  '89-コンテナ船の積付図': 'Container stowage: bay, row and tier are the address',
  '126-船の一般配置図': 'General arrangement: four drawings, each with its own scale',
  '12-在庫と発注': 'Stock and reordering',
  '08-工場のライン': 'Assembly line and inspection',

  // 業務・組織
  '20-組織図': 'Organisation chart',
  '07-承認の流れ': 'Approval routing',
  '05-業務の流れ': 'Order to shipment',
  '11-取材から公開まで': 'From interview to publication',
  '13-学校の年間': 'Admission process',
  '55-学校の時間割': 'School timetable',
  '31-座席図': 'Seating plan, sixty seats and two wheelchair spaces',
  '107-葬儀式場の配置図': 'Funeral hall: the seating is the order of offering',
  '113-墓石の彫刻指示図': 'Gravestone engraving: the living are cut in red',
  '16-会場の配置': 'Exhibition hall layout',
  '130-法定相続情報一覧図': 'Statutory heir chart: the bottom 5 cm is left for the registry stamp',
  '133-投票所の配置図': 'Polling station: three ballots, so nobody may double back',
  '99-法廷の配置図': 'Courtroom: where you sit is what you are',
  '64-施設の開館表': 'Facility opening hours, by the week',
  '65-ビンゴ大会の進行表': 'Bingo night running order',
  '84-中古車の査定図': 'Used car appraisal: a body map and the deduction codes',
  '112-交通事故の現場見取図': 'Collision scene: every dimension from one datum',
  '90-相続関係説明図': 'Family tree for probate: marriage doubled, descent single',
  '118-特許図面の書き方': 'Patent drawings have rules of their own',
  '122-円だけで作る動物のマーク': 'An animal mark from circles alone',
  '123-アイコンのキーライン図': 'Icon keylines: what is matched is the size the eye sees',
  '129-家紋の割り出し': 'Laying out a family crest with compass divisions',
  '128-ロゴの作図': 'A real logo with no coordinates in the source (5.4 KB)',
  '127-ロゴのコンストラクション図': 'Logo construction from compass and straightedge',
  '124-和欧混植の寸法図': 'Mixing scripts: two typographies with different baselines',

  // 催し・遊び
  '96-オーケストラの配置図': 'Orchestra seating, two traditions side by side',
  '110-ダンスのフォーメーション図': 'Dance formations: the diagonal reads strongest',
  '77-舞台照明仕込図': 'Theatrical lighting plot, with the channel schedule',
  '137-舞台転換図': 'Scene change plot: what happens between the pictures',
  '117-カメラ配置図': 'Camera plan: cross the line and left becomes right',
  '101-PA配置図': 'PA layout, where distance turns into delay',
  '106-雑踏警備計画図': 'Crowd plan: how many can flow out against how many come in',
  '93-花火大会の保安距離図': 'Fireworks safety distances, a circle per shell size',
  '121-生け花の構成図': 'Ikebana proportions, set by ratio',
  '66-囲碁の棋譜': 'Go game record, opening moves',
  '67-将棋の局面図': 'Shogi starting position',
  '68-チェスの局面図': 'Chess starting position',
  '70-リバーシの局面図': 'Reversi opening position',
  '69-ビンゴカード': 'Bingo card',

  // UI・画面設計
  '74-EC商品ページのUI構造': 'Product page structure, desktop against mobile',
  '76-管理画面のレスポンシブ構造': 'Admin screen: sidebar becomes a drawer',
  '88-レスポンシブLPのUI構造': 'Landing page where sections appear and disappear',
  '87-モバイルアプリのUI構造': 'Mobile app with a bottom navigation',
  '75-画面遷移とワイヤーフレーム': 'Screen flow with the wireframes drawn in',
  '85-Checkoutの画面遷移': 'Checkout flow, five steps and where errors return to',
  '86-CRUD管理画面の画面遷移': 'CRUD admin flow: delete goes through a confirmation',

  // IT・ソフトウェア
  '26-データセンターのラック': 'Data centre rack elevation',
  '21-テーブルの関係': 'Entity relationships',
  '46-クラス図': 'Class diagram (UML)',
  '47-状態遷移図': 'State machine (UML)',
  '48-ユースケース図': 'Use case diagram (UML)',
  '49-アクティビティ図': 'Activity diagram (UML)',
  '02-クラウド構成': 'Cloud architecture',
  '01-オンプレのサーバ構成': 'On-premise server layout',
  '03-データの流れ': 'Data flow',
  '04-ネットワーク構成': 'Network layout',
};
