/**
 * **外へ出した名前が、他の箱に乗らないこと**（課題 5。2026-09-12）。
 *
 * 配置図の文字は 5 段で置き先を選ぶが、**最後の「外」だけ当たりを見ていなかった。**
 * 箱が図の真ん中にあって上下とも別の箱なら、どちらへ出しても他の箱に乗る。
 * 駐車場の出入口で実際に踏んだ。
 *
 * **消しはしない。** 辺のラベルは消してよいが（どこへ繋がるかは線で分かる）、
 * **名前は線では分からない。** 重なっても出し、混んでいることを人へ返す。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { layout, straddles } from '../src/layout.ts';
import { crowdedNames, extentOf, joinedText, planNames, textRectOf } from '../src/names.ts';
import { render } from '../src/render.ts';
import { inspect } from '../src/tools.ts';

async function plans(source: string) {
  const placed = await layout(source);
  return { placed, plans: planNames(placed.boxes, extentOf(placed.boxes)) };
}

describe('5 段のどれになるか', () => {
  const one = async (body: string) => {
    const { placed, plans: p } = await plans(`version: 1\nkind: placement\nnodes:\n${body}`);
    return p.get(placed.boxes[0]!.id)!;
  };

  it('入るなら中へ', async () => {
    assert.equal((await one('  - id: a\n    label: 居間\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 120 }\n')).kind, 'inside');
  });

  it('背が低いだけなら、1 行に繋いで中へ', async () => {
    const plan = await one('  - id: a\n    label: 通路\n    technology: 有効 1,200\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 16 }\n');
    assert.equal(plan.kind, 'joined');
  });

  it('名前は入るが副題が入らないなら、副題だけ回す', async () => {
    assert.equal((await one('  - id: a\n    label: W1\n    technology: 車椅子 3,500\n    at: { x: 0, y: 0 }\n    size: { w: 70, h: 100 }\n')).kind, 'aside');
  });

  it('横に入らず縦になら入るなら、帯に沿って', async () => {
    assert.equal((await one('  - id: a\n    label: 用水路\n    at: { x: 0, y: 0 }\n    size: { w: 16, h: 500 }\n')).kind, 'along');
  });

  it('どれも駄目なら外へ', async () => {
    assert.equal((await one('  - id: a\n    label: とてもとても長い名前です\n    at: { x: 0, y: 0 }\n    size: { w: 30, h: 20 }\n')).kind, 'outside');
  });

  it('1 行に繋いだ文字は、名前と副題を全角空きで繋ぐ', async () => {
    const placed = await layout('version: 1\nkind: placement\nnodes:\n  - id: a\n    label: 通路\n    technology: 有効 1,200\n    at: { x: 0, y: 0 }\n    size: { w: 200, h: 16 }\n');
    assert.equal(joinedText(placed.boxes[0]!), '通路　有効 1,200');
  });
});

describe('外へ出すとき、当たりを見る', () => {
  /** 上が空いていて、下に箱がある。**上へ出すはず。** */
  const ROOM_ABOVE = `version: 1
kind: placement
nodes:
  - id: pad
    label: 余白
    at: { x: 200, y: 0 }
    size: { w: 100, h: 120 }
  - id: thin
    label: とても長い名前の細い部屋
    at: { x: 80, y: 120 }
    size: { w: 40, h: 26 }
  - id: below
    label: 下の部屋
    at: { x: 0, y: 146 }
    size: { w: 300, h: 120 }
`;

  it('**下が塞がっていれば、上へ出す**', async () => {
    const { placed, plans: p } = await plans(ROOM_ABOVE);
    const plan = p.get('thin')!;
    assert.equal(plan.kind, 'outside');
    assert.equal(plan.kind === 'outside' && plan.above, true, '塞がっている下へ出した');
  });

  it('空いている所へ置けたなら、混んでいない', async () => {
    const { plans: p } = await plans(ROOM_ABOVE);
    assert.deepEqual(crowdedNames(p), [], '空いているのに混んでいると言っている');
  });

  it('**八方すべて塞がっていたら、混んでいると記録する。消さない**', async () => {
    // 上・下・右を箱で塞ぐ（左は図の外）。**斜めも、上下の箱に当たる。**
    const { plans: p } = await plans(
      ROOM_ABOVE.replace(
        '    at: { x: 200, y: 0 }\n    size: { w: 100, h: 120 }',
        '    at: { x: 0, y: 96 }\n    size: { w: 300, h: 24 }',
      ).concat(`  - id: right
    label: 右の部屋
    at: { x: 40, y: 120 }
    size: { w: 260, h: 26 }
`),
    );
    const plan = p.get('thin')!;
    assert.equal(plan.kind, 'outside', '名前が消えた');
    assert.deepEqual(crowdedNames(p), ['thin']);
  });

  it('**図の外へは出さない**（上端の箱で上へ出すと消える）', async () => {
    const { plans: p } = await plans(`version: 1
kind: placement
nodes:
  - id: top
    label: とても長い名前の細い部屋
    at: { x: 0, y: 0 }
    size: { w: 40, h: 26 }
  - id: rest
    label: 下
    at: { x: 0, y: 26 }
    size: { w: 300, h: 200 }
`);
    const plan = p.get('top')!;
    assert.equal(plan.kind === 'outside' && plan.above, false, '図の外へ出した');
  });

  it('**先に置いた文字にも当たらない**（名前どうしが重ならない）', async () => {
    const { plans: p } = await plans(`version: 1
kind: placement
nodes:
  - id: a
    label: 長い名前の細い部屋 A
    at: { x: 0, y: 40 }
    size: { w: 40, h: 26 }
  - id: b
    label: 長い名前の細い部屋 B
    at: { x: 40, y: 40 }
    size: { w: 40, h: 26 }
  - id: big
    label: 広い部屋
    at: { x: 0, y: 66 }
    size: { w: 300, h: 200 }
`);
    const a = p.get('a')!;
    const b = p.get('b')!;
    assert.equal(a.kind, 'outside');
    assert.equal(b.kind, 'outside');
    // 同じ側の同じ高さに 2 つ並ぶと重なる。**どちらかは別の側へ行く。**
    const same = a.kind === 'outside' && b.kind === 'outside' && a.above === b.above;
    assert.ok(!same || crowdedNames(p).length > 0, '重なっているのに知らせていない');
  });
});

describe('inspect が、混んでいる名前を返す', () => {
  it('配置図で、混んでいれば id が返る', async () => {
    const out = await inspect(`version: 1
kind: placement
nodes:
  - id: mid
    label: とても長い名前の細い部屋
    at: { x: 80, y: 100 }
    size: { w: 40, h: 26 }
  - id: up
    label: 上
    at: { x: 0, y: 80 }
    size: { w: 300, h: 20 }
  - id: down
    label: 下
    at: { x: 0, y: 126 }
    size: { w: 300, h: 120 }
  - id: right
    label: 右
    at: { x: 40, y: 100 }
    size: { w: 260, h: 26 }
`);
    assert.deepEqual(out.crowdedNames, ['mid']);
  });

  it('**構成図では空**（箱の大きさを文字から決めるので、必ず入る）', async () => {
    const out = await inspect('version: 1\nnodes:\n  - id: a\n    label: とても長い名前\n');
    assert.deepEqual(out.crowdedNames, []);
  });

  it('見本 34 件は、混んでいる名前が 0 件', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml'))) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      assert.deepEqual(out.crowdedNames, [], `${name} の名前が混んでいる`);
    }
  });
});

/**
 * **交差が図の中身である見本。**
 *
 * `crossings` は「**合否ではなく観測値**」と決めてある（`src/layout.ts`）。
 * 良し悪しは人が決めるもので、機械が 0 を要求してよい数ではない。
 *
 * それでもここで 0 を見張るのは、**意味の無い交差を見本に残さない**ため。
 * 意味のある交差を持つ図だけは、**理由を書いて外す。**
 * 理由が書けないものは外さない —— それが「自己採点させない」の線。
 */
const CROSSINGS_ARE_CONTENT: Record<string, string> = {
  '312-UIのComponent構造.zumen.yaml':
    '**共通の Component には、親が何本も刺さる。** 3 つの画面から同じ Header へ線が集まるので交わる —— 交わらない図は「画面ごとの木」で、そこでは共通かどうかが読めない',
  '309-電気の引き込み.zumen.yaml':
    '**柱上変圧器からもキュービクルからも、単相 3 線と三相 3 線の両方が出る。** 4 本の線が交わるのはそのためで、交わらない図では「どちらの変圧器からでも両方が取れる」ことを描けない',
  '305-階段の寸法.zumen.yaml':
    '**勾配の線は、段鼻を結んだ線そのもの。** 段を横切らずに引くことはできず、交わる所が段鼻 —— 57 度と 36 度の違いを見せるための線なので、交わらなければ勾配が描けない',
  '292-製麹の品温.zumen.yaml':
    '**目盛りの線は、縦横で必ず交わる。** 12 時間ごとの縦線と 4℃ ごとの横線が格子になって初めて「何時間で何度か」を読めるので、交わらない目盛りは目盛りではない',
  '290-ラマチャンドランプロット.zumen.yaml':
    '**目盛りの線は、縦横で必ず交わる。** −90 / 0 / +90 度の補助線が格子になって初めて φ と ψ を同時に読めるので、交わらない目盛りは目盛りではない',
  '289-自転車ホイールの組み方.zumen.yaml':
    '**交差の数が、そのまま組み方の名前。** 6 本組は 3 クロス、8 本組は 4 クロス —— 交わらないラジアル組と区別するために描いている図なので、交差を消したら何も残らない',
  '286-魚の三枚おろし.zumen.yaml':
    '**包丁を入れる線は、魚を横切る線そのもの。** 頭を落とす線は体を斜めに切り、腹側・背側から中骨に沿わせる線は外形の内側を通る —— 切り口の図でも、包丁は中骨の両脇を通って身の中を進む。交わらない線を外に並べても、どこへ刃を入れるのかを指せない',
  '283-中継の決まり.zumen.yaml':
    '**中継線とスタート地点は、コースを横切る線そのもの。** 走る道の上のどこかを指すための線なので、交わらない図では「どこで渡すのか」を指せない',
  '269-組子の割り付け.zumen.yaml':
    '**交わる所が、組む所そのもの。** 三ツ組手は 3 本が 1 点で交わる仕口で、麻の葉も重心から出た線が交わって 18 の三角形を作る —— 交わらない線を並べても、組子にはならない',
  '267-クモの円網.zumen.yaml':
    '**円網は、縦糸とらせんが交わってできている。** 交点の数だけ横糸が縦糸に留まっていて、そこが網の目になる —— 交わらない線を並べても網にならない',
  '266-足関節のテーピング.zumen.yaml':
    '**テープどうしが交わる所が、貼る順番の意味。** フィギュアエイトはスターアップとホースシューの上を横切って端を押さえる —— 交わらない図では、あとのテープが前のテープを押さえていることを描けない',
  '264-配光曲線と照度計算.zumen.yaml':
    '**極座標の図は、目盛りと曲線が交わってできている。** cd の同心円と角度の放射線が配光曲線を横切る所で、何度で何 cd かを読む —— 交わらない極座標は、目盛りが無いのと同じ',
  '258-液晶テレビの層.zumen.yaml':
    '**② の「通らない」印は、2 本の線が交わってできた×。** 交わらない 2 本は、ただの斜め線になる',
  '257-換気扇の風量と静圧.zumen.yaml':
    '**交点が答えそのもの。** ファンの曲線とダクトの抵抗曲線が交わる所が、実際に出る風量 —— 交わらない図では、何 m³/h 出るのかを描けない',
  '255-炊飯器の温度と圧力.zumen.yaml':
    '**工程の区切りは、温度の線を横切る所そのもの。** 浸水・昇温・沸騰維持・蒸らしの境目を示す縦線が折れ線と交わらなければ、どこで切り替わるかを指せない',
  '252-サイクロン掃除機の分け方.zumen.yaml':
    '**中心から抜く管は、上ぶたを貫いて外へ出る。** 貫いている所が交わりとして出る —— 交わらない図では、空気がどこから出るのかを描けない',
  '248-電子レンジの構造.zumen.yaml':
    '**節は、波が軸を横切る所そのもの。** 節と腹の位置を示す縦線が波の軸と交わらなければ、どこが節かを指せない',
  '245-エスカレーターの構造.zumen.yaml':
    '**引出線は、断面の中の部品を指す。** 駆動機も従動側もトラスの中にあるので、指すには外形線を横切るしかない。横切らない引出線は、外を指している',
  '240-地の目とバイアス.zumen.yaml':
    '**織り目は、糸が交わってできている。** たて糸とよこ糸が交わらなければ布にならない。② は正方形の格子が倒れる様子なので、交点の数だけ交わる。③ の 45° の帯も、裁ち線が布の縁を横切る',
  '227-三角定規と分度器.zumen.yaml':
    '**分度器は、目盛りが弧と底辺を横切ってできている。** 横切らない線はただの点で、角は読めない。滑らせた三角定規の斜辺も、押さえた 1 枚と交わる',
  '223-海図の読み方.zumen.yaml':
    '**基準面の線は、橋も灯台も岩も横切る。** どの面から測っているかを示す線なので、物と交わらなければ何も示せない',
  '220-防火区画と避難経路.zumen.yaml':
    '**ふだんの経路は、区画の線を横切っている。** 横切っているからシャッターで切られる —— 交わらない図では「閉まると通れない」が描けない',
  '219-算数数学の問題図.zumen.yaml':
    '**問題図は、交わる線でできている。** 円周角の 2 本の弦、立方体の稜と切り口、台形の対角線 —— どれも交わる所が答えの理由で、交わらない図では問題にならない',
  '218-窯詰めの棚組み.zumen.yaml':
    '**④ は温度の目盛り。** 目盛りの線が軸を横切るのが目盛りそのもので、横切らない線はただの点になる',
  '217-上部式フィルターの断面.zumen.yaml':
    '**水は水面を越えて出入りする。** 汲み上げる管と落水が水位線を横切るのが循環そのもので、横切らない図では水が回っていないことになる',
  '214-日影規制と等時間日影図.zumen.yaml':
    '**2 時間線が 10m ラインを超えている、が結論の図。** 等時間日影線と 5m・10m ラインが交わる所が「通らない」そのもので、交わらない図では規制を判定できない（②の日射も測定面の線を切る）',
  '213-血球計算盤の目盛り.zumen.yaml':
    '**目盛りそのものが格子。** 縦横の線が交わる所が区画の角で、交わらない目盛りは目盛りでない',
  '209-コンパスと定規の作図.zumen.yaml':
    '**弧が交わる点が、作図の答えそのもの。** 交差を消したら、どこで点が決まったのかが図から消える',
  '207-ウェハのダイ取り.zumen.yaml':
    '**円と枡目が交わる所が、捨てるダイそのもの。** 交わらない図では「端で欠ける」が描けない',
  '206-ピアノのアクション.zumen.yaml':
    '**てこが 3 つ、噛み合ってできている機構。** 部材どうしが交わる所が力の受け渡しで、離したら機構でなくなる',
  '205-ホールの初期反射.zumen.yaml':
    '**直接音と反射音は、同じ点へ届く。** 2 本の経路が交わるのが「遅れ」そのもので、交わらない図では反射を描けない',
  '202-斜線制限.zumen.yaml':
    '**斜線が建物を切る所が、この図の中身。** 斜めの線と建物の輪郭が交わらなければ、制限がかかっていないことになる',
  '201-椅子の製作図.zumen.yaml':
    '**椅子は、座面も背も傾いている。** 後傾した座面と後ろへ開いた後脚が交わるのが椅子の形で、直交させたら椅子でなくなる',
  '200-作業机の製作図.zumen.yaml':
    '**ほぞ先の留め（45°）は、2 本のほぞが脚の中でぶつかる所そのもの。** 交わる線を消したら、なぜ留めに切るのかが図から消える',
  '195-学校の机と椅子.zumen.yaml':
    '**② は折れ線グラフ。** 目盛りの線と折れ線が交わるのは、グラフの読み方そのもの —— 交わらない目盛りは目盛りでない',
  '191-凸レンズの作図.zumen.yaml':
    '**光線図は交わってできている。** 3 本の作図線が像の先端で交わる、その点が答え —— 交差を消したら作図でなくなる',
  '186-冷蔵庫の据付と搬入.zumen.yaml':
    '**角で本体が壁に当たる、が結論の図。** 傾けた本体（対角 979mm）が廊下の壁（785mm）をはみ出して交差するのが、曲がれないということそのもの',
  '71-列車運行図表.zumen.yaml':
    '上りと下りのすれ違い。**交差する点が「どこで行き違うか」そのもの**で、消したら図にならない',
  '79-梅田の乗換関係図.zumen.yaml':
    '地下通路が**実際に立体交差している**。梅田の乗換が分かりにくい理由そのもの',
  '81-東京の地下鉄13路線.zumen.yaml':
    '**地下鉄は立体交差する。** 13 路線が都心で重なるので、交差が無い図は実物と違う',
  '97-防犯カメラの視野図.zumen.yaml':
    '**視野は重ねて置く。** 重なりが無い置き方は、その隙間がそのまま死角になる',
  '109-ヤーデージブック.zumen.yaml':
    '**ハザードはフェアウェイの中と際にある。** 面の輪郭どうしが交わるのが実物',
  '101-PA配置図.zumen.yaml':
    '**スピーカーの届く範囲は重ねる。** 重ならない置き方は、その隙間で音が痩せる',
  '185-地上天気図の読み方.zumen.yaml':
    '**前線は等圧線を横切る。** 前線のところで気圧が折れるので、等圧線は前線で曲がって交わる —— 交わらない天気図は、前線が無いか等圧線が無いかのどちらか。記号（三角・半円）も前線の線の上に載る',
  '183-台風の進路予想図.zumen.yaml':
    '**円は重なって進む。** 予報円・暴風警戒域・強風域が時刻ごとに重なり、予想進路がその中心を貫く —— 重ならない置き方は、台風が動いていない図になる',
  '182-公園の遊具と安全領域.zumen.yaml':
    '**安全領域どうしは重なってよい。** すべり台とブランコの領域を重ねてあるので、破線の枠は交わる —— 交わらない置き方しかできないなら、規準より厳しい図になる（遊具とベンチが相手の領域の外にあることは、機械で確かめてある）',
  '181-伽藍配置の移り変わり.zumen.yaml':
    '**中軸線は 5 つの伽藍を貫く。** 同じ 1 本の南北線に 5 つをそろえたので、線は各伽藍の回廊を横切る —— そろえていることが、塔の移動を読ませている',
  '180-継手と仕口.zumen.yaml':
    '**栓は継手を貫く。** 込み栓も車知栓も、合わせ目を横切って初めて材を留める —— 横切っていない栓は効いていない。番付の格子も、縦と横の通りが交わる点が「ろ二」なので、交差が読み取り値そのもの',
  '179-革靴の型紙.zumen.yaml':
    '**木型に描いたデザイン線は、輪郭と底の線に交わる。** センター線はつま先で輪郭と、切り替えの線は吊り込み線と交わる —— そこまで引かないと、平面へ落としたときに端が決まらない（型紙の側＝②は交差 0）',
  '178-靴のサイズの図.zumen.yaml':
    '**ノモグラムは、交わるために引く。** 足長の行・足囲の縦線・ワイズの斜線が交わる点が読み取り値そのもので、交差の無い図は読めない',
  '177-帽子の型紙.zumen.yaml':
    '**作図線は弧を横切る。** コンパスの中心から引いた半径が内弧・外弧・縫い代線を貫き、ブリムの「2 枚はぎ」の線はドーナツを横断する —— どちらも、そう引くのが作図',
  '174-送電線路の縦断面図.zumen.yaml':
    '**電線は鉄塔に架かっている。** 取付点で塔体と腕金を横切るのが「架かっている」形。地上高の寸法補助線も、地盤線と最低地上高線を横切って測る',
  '117-カメラ配置図.zumen.yaml':
    '**カメラの向きは交差する。** 向かい合う二人を左右から撮るのだから、線は必ず交わる',
  '122-円だけで作る動物のマーク.zumen.yaml':
    '**円は交わる。交わりが耳になり、交点が輪郭を決める。** 交わらない作図図は、ただ円が並んでいるだけ',
  '123-アイコンのキーライン図.zumen.yaml':
    '**キーライン図形は重ねて比べるもの。** 円と正方形と矩形が交わって初めて「同じ大きさに見える」が読める',
  '160-Change-ringing-method.zumen.yaml':
    '**鐘の道は交わる。** 2 番とトレブルがすれ違うところが、方法の中身そのもの',
  '159-Fire-IAP-map.zumen.yaml':
    '**脱出路は火線を横切る。** 線から安全地帯へ抜ける道なので、横切らない脱出路は脱出路でない',
  '125-庭木の剪定指示図.zumen.yaml':
    '**枝は交わる。** 車枝・かんぬき枝・平行枝は、交わり方そのものが「切る理由」',
};

describe('見本 44 件は、どれも読める状態', () => {
  /**
   * **3 つの観測値を、見本すべてで見張る。**
   *
   * | | 何が起きているか | 0 を要求するか |
   * |---|---|---|
   * | `hiddenLabels` | **正本に書いたのに絵に出ていない**辺のラベル | する |
   * | `crowdedNames` | 名前が他の箱に重なって出ている | する |
   * | `crossings` | **線どうしが交差している数** | **理由を書いた図だけ外す** |
   *
   * とくに `hiddenLabels` は、**書いたのに出ない**状態。
   * 見本は「こう書けばこう出る」を見せるものなので、ここがずれていると
   * **真似た人の図もずれる。**
   *
   * `crossings` の欄は、以前ここに「矢印が箱を突き抜けている」と書いてあった。
   * **実装と違う**（数えているのは線どうしの交差）。2026-09-14 に直した。
   */
  it('交差・隠れたラベル・混んだ名前がすべて 0', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const files = readdirSync(dir).filter((name) => name.endsWith('.zumen.yaml'));
    assert.ok(files.length >= 44, `見本が ${files.length} 件しかない`);
    for (const name of files) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      const why = CROSSINGS_ARE_CONTENT[name];
      if (why === undefined) {
        assert.equal(out.crossings, 0, `${name} で線が交差している`);
      } else {
        assert.ok(out.crossings > 0, `${name} は交差が中身のはずなのに 0（${why}）`);
      }
      assert.deepEqual(out.hiddenLabels, [], `${name} で辺のラベルが絵に出ていない`);
      assert.deepEqual(out.crowdedNames, [], `${name} で名前が重なっている`);
    }
  });
});

/**
 * **名前は、線を避ける。**
 *
 * 日本式の路線図で出た（2026-09-13）。**駅名の上を路線が走っていた** ——
 * 中央駅は上下に路線が抜けるので、真上・真下は空いていない。
 * 実物の路線図は、こういう駅の名前を**横へ逃がしてある。**
 *
 * この文書は最初から「上下左右の 4 方向を順に試す」と書いてあったが、
 * **実装は上下しか試していなかった**（文書が先に走っていた）。
 */
describe('名前は、線を避ける', () => {
  const CROSS = `version: 1
kind: placement
arrows: false
nodes:
  - id: n
    label: 北町
    marker: circle
    at: { x: 100, y: 0 }
    size: { w: 34, h: 34 }
  - id: c
    label: 中央
    tag: H03
    marker: double
    at: { x: 95, y: 200 }
    size: { w: 44, h: 44 }
  - id: s
    label: 南口
    marker: circle
    at: { x: 100, y: 400 }
    size: { w: 34, h: 34 }
edges:
  - from: n
    to: c
  - from: c
    to: s
`;

  it('**縦に線が抜ける駅の名前は、横へ出す**', async () => {
    const placed = await layout(CROSS);
    const box = placed.boxes.find((b) => b.id === 'c')!;
    const out = render(placed, 'light', 'safe', true);
    const x = Number(out.match(/<text x="(\d+)"[^>]*>中央</)![1]);
    const half = 14 * 2; // 「中央」の半分 ＋ 余裕
    const line = box.x + box.w / 2;
    assert.ok(Math.abs(x - line) > half, `名前が線の上にある（x=${x} 線=${line}）`);
  });

  it('線が無ければ、これまでどおり上下へ出す', async () => {
    const placed = await layout(CROSS.replace(/edges:[\s\S]*$/, ''));
    const box = placed.boxes.find((b) => b.id === 'c')!;
    const out = render(placed, 'light', 'safe', true);
    const x = Number(out.match(/<text x="(\d+)"[^>]*>中央</)![1]);
    assert.equal(x, Math.round(box.x + box.w / 2), '線が無いのに横へ逃げた');
  });

  it('横へ出しても、丸には重ねない', async () => {
    const placed = await layout(CROSS);
    const box = placed.boxes.find((b) => b.id === 'c')!;
    const out = render(placed, 'light', 'safe', true);
    const x = Number(out.match(/<text x="(\d+)"[^>]*>中央</)![1]);
    // 文字の中心から半分寄っても、丸の縁には入らない。
    const near = x < box.x ? x + 14 : x - 14;
    assert.ok(near < box.x || near > box.x + box.w, '名前が丸に重なった');
  });
});

/**
 * **印の中の符号は、印の真ん中。**
 *
 * 二重丸（乗換駅）で出た（2026-09-13）。符号を左上に寄せていたので、
 * **内側の丸の弧が駅番号を横切っていた。**
 * 実物の路線図の駅番号は、丸の中央にある。
 */
describe('印の中の符号', () => {
  const STATION = `version: 1
kind: placement
nodes:
  - id: c
    label: 中央
    tag: H03
    marker: double
    at: { x: 0, y: 0 }
    size: { w: 44, h: 44 }
`;

  it('**丸の中央に置く**（内側の丸に食われない）', async () => {
    const placed = await layout(STATION);
    const box = placed.boxes.find((b) => b.id === 'c')!;
    const out = render(placed, 'light', 'safe', true);
    const found = out.match(/<text x="(\d+)" y="(\d+)"[^>]*>H03</)!;
    assert.equal(found[1], String(Math.round(box.x + box.w / 2)), '符号が横にずれている');
    assert.ok(Math.abs(Number(found[2]) - 4 - (box.y + box.h / 2)) <= 2, '符号が縦にずれている');
    assert.match(out, /<text x="\d+" y="\d+" text-anchor="middle"[^>]*>H03</, '中央寄せになっていない');
  });

  it('印が無い箱の符号は、これまでどおり左上', async () => {
    const placed = await layout(STATION.replace('    marker: double\n', ''));
    const box = placed.boxes.find((b) => b.id === 'c')!;
    const out = render(placed, 'light', 'safe', true);
    const x = Number(out.match(/<text x="(\d+)"[^>]*>H03</)![1]);
    assert.ok(x < box.x + box.w / 2, '左上に置かれていない');
  });
});

/**
 * **紙の外へ出た名前も「混んでいる」に数える。**
 *
 * 舞台照明仕込図で出た（2026-09-14）。左端の「シーリング」が箱に入らず、
 * 外へ出した先が**紙の左**だったので、文字が切れていた。
 * それでも `crowdedNames` は空 —— **切れている文字を、検査が拾えていなかった。**
 *
 * 紙は右と下へなら広げられるが、**左と上へは広げられない**
 * （人が書いた座標をそのまま出す保証があるので、全体をずらせない）。
 * だから**知らせる**しかない。
 */
describe('紙の外へ出た名前', () => {
  /** 左上の角にある細い箱。**ぶつかる相手はいないが、名前が紙の外へ出る。** */
  const EDGE = `version: 1
kind: placement
nodes:
  - id: a
    label: とても長い名前
    at: { x: 0, y: 0 }
    size: { w: 40, h: 26 }
  - id: b
    label: 離れた箱
    at: { x: 400, y: 400 }
    size: { w: 60, h: 26 }
`;

  it('**左へはみ出した名前を知らせる**（重なる相手はいなくても）', async () => {
    const out = await inspect(EDGE);
    assert.deepEqual(out.crowdedNames, ['a'], '切れている名前を拾っていない');
  });

  it('紙に収まっていれば、これまでどおり何も言わない', async () => {
    const out = await inspect(EDGE.replace('at: { x: 0, y: 0 }', 'at: { x: 200, y: 200 }'));
    assert.deepEqual(out.crowdedNames, []);
  });
});

/**
 * **文字どうしが重なっていないか**（`overlappingText`）。
 *
 * 2026-09-14。見本 86（CRUD 管理画面）で、注記の箱を動かし忘れて
 * **画面の枠の上に文が乗ったまま**出ていた。`crowdedNames` も `hiddenLabels` も
 * `crossings` も 0 のまま —— **どれも見ていない所だった。**
 *
 * | 既にある観測値 | 見ているもの |
 * |---|---|
 * | `crowdedNames` | **外へ出した**名前の置き場所 |
 * | `hiddenLabels` | **辺**のラベル |
 * | `overlaps` | **箱**どうし（入れ子も数えるので、配置図では鳴りっぱなし） |
 *
 * 中に収まった文字どうしは、**誰も見ていなかった。**
 * 箱の重なりは意図のことがある（枠の中に節を入れる）が、
 * **文字の重なりは、ほぼ必ず間違い**なので、そこだけを数える。
 */
describe('文字どうしの重なり', () => {
  const PILE = `version: 1
kind: placement
nodes:
  - id: frame
    label: ""
    marker: box
    at: { x: 0, y: 0 }
    size: { w: 200, h: 100 }
  - id: inner
    label: 中の節
    at: { x: 10, y: 10 }
    size: { w: 180, h: 40 }
  - id: note
    label: 枠の上に乗ってしまった注記
    marker: none
    at: { x: 10, y: 10 }
    size: { w: 300, h: 26 }
`;

  it('**重なった組を返す**（見本 86 で実際に起きた形）', async () => {
    const out = await inspect(PILE);
    assert.deepEqual(out.overlappingText, [['inner', 'note']]);
  });

  it('**箱が入れ子でも、文字が離れていれば何も言わない**', async () => {
    const out = await inspect(PILE.replace('at: { x: 10, y: 10 }\n    size: { w: 300, h: 26 }', 'at: { x: 10, y: 60 }\n    size: { w: 300, h: 26 }'));
    assert.deepEqual(out.overlappingText, [], '入れ子そのものを間違いと言ってはいけない');
  });

  it('文字の無い箱は数えない', async () => {
    const out = await inspect(PILE.replace('label: 枠の上に乗ってしまった注記', 'label: ""'));
    assert.deepEqual(out.overlappingText, []);
  });

  it('構成図では見ない（置き場所を機械が決めるので、必ず離れる）', async () => {
    const out = await inspect(PILE.replace('kind: placement\n', ''));
    assert.deepEqual(out.overlappingText, []);
  });
});

describe('見本は、文字が重なっていない', () => {
  it('**見本すべてで 0**', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const piles: string[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      for (const pair of out.overlappingText) piles.push(`${name}: ${pair[0]} × ${pair[1]}`);
    }
    assert.deepEqual(piles, []);
  });
});

/**
 * **入らない符号を、黙って落とさない**（`hiddenTags`）。
 *
 * 2026-09-14。防虫モニタリングの定点配置図（見本 92）で、
 * 22px の印に `tag: LT-1` を書いたのに**番号が 1 つも出ていなかった。**
 * 図としては「番号の無い丸が 14 個」で、**定点配置図として成立していない。**
 *
 * 落とすこと自体は正しい（伏図の小梁は幅 20px しかない）。
 * **黙って落とすのが問題**で、`hiddenLabels` と同じ扱いにする ——
 * 書いた側が気づけば、印を大きくするか符号を短くできる。
 */
describe('入らない符号', () => {
  const DOTS = `version: 1
kind: placement
nodes:
  - id: small
    label: ""
    marker: circle
    tag: LT-1
    at: { x: 40, y: 40 }
    size: { w: 22, h: 22 }
  - id: big
    label: ""
    marker: circle
    tag: LT-2
    at: { x: 140, y: 40 }
    size: { w: 48, h: 48 }
`;

  it('**出ていない符号の id を返す**', async () => {
    const out = await inspect(DOTS);
    assert.deepEqual(out.hiddenTags, ['small']);
  });

  it('入る符号は返さない', async () => {
    const out = await inspect(DOTS.replace('size: { w: 22, h: 22 }', 'size: { w: 34, h: 34 }'));
    assert.deepEqual(out.hiddenTags, []);
  });

  it('構成図では見ない（符号は箱の大きさに合わせて置かれる）', async () => {
    const out = await inspect(DOTS.replace('kind: placement\n', ''));
    assert.deepEqual(out.hiddenTags, []);
  });

  it('**見本すべてで 0**', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const gone: string[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      for (const id of out.hiddenTags) gone.push(`${name}: ${id}`);
    }
    assert.deepEqual(gone, []);
  });
});

/**
 * **はみ出して重なっている箱**（`straddles`）。
 *
 * `overlaps` は**入れ子も数える**ので、配置図では鳴りっぱなしで誰も見なかった
 * （見本ぜんたいで 400 組を超える）。**入れ子は意図であることがほとんど。**
 *
 * **直すところがあるのは、どちらも相手を含んでいない重なり。**
 * 入れて回したら、**見本 10 枚に本物の間違いが埋まっていた**（2026-09-14）。
 *
 * | 図 | 何が起きていたか |
 * |---|---|
 * | 15 店舗 | **冷蔵ケースと弁当什器が、床の同じ場所を取っていた** |
 * | 30 仮設 | 出入口が建物へ食い込み、**クレーンが車輌通路を塞いでいた** |
 * | 93 花火 | **消防車が立入禁止区域へはみ出していた** |
 * | 81 地下鉄 | 終点の行き先が 2 つ重なっていた |
 * | 91・92・94・95 | 見出し・注記・定点が、他のものの上に乗っていた |
 *
 * `crossings` と同じ扱いにする —— **合否ではなく観測値**で、
 * わざと重ねている図は理由を書いて外す。
 */
const LAYERED_ON_PURPOSE: Record<string, string> = {
  '311-ピアノの鍵盤.zumen.yaml':
    '**黒鍵は、白鍵のあいだにまたいで載っている。** 白鍵 2 枚に半分ずつかかるのが実物で、離して置いたら「どの 2 つのあいだの黒鍵か」が描けない —— 2 つの組と 3 つの組に分かれて見えるのも、この重なりのおかげ',
  '295-土俵.zumen.yaml':
    '**徳俵は、勝負俵の輪から外へ出っ張っている俵。** 俵 1 本ぶん外へずらしてあることがこの図の中身なので、輪と重なっていなければ徳俵ではない',
  '294-能舞台.zumen.yaml':
    '**四本柱は、舞台の四隅そのものに立っている。** 柱の太さのぶんだけ舞台・後座・地謡座と重なるのが実物で、離して置いたら「どの隅の柱か」が描けない —— 面をかけたシテはその柱で立ち位置を知る',
  '288-茶室の四畳半と八炉.zumen.yaml':
    '**炉は、畳に切る穴。** 四畳半切は半畳の隅を 1 尺 4 寸角に切って据えるので、炉は半畳の中にある —— 離して置いたら、どの畳のどこを切るのかが描けない',
  '253-引き出しのスライドレール.zumen.yaml':
    '**2 段引きは、奥の 1/4 が家具の中に残る。** 残っていることがこの図の中身なので、引き出しの箱と家具は重なる（3 段引きのほうは離してある）',
  '244-エレベーターの構造.zumen.yaml':
    '**断面図は入れ子。** 機械室に綱車と調速機が入り、昇降路にかごと釣合おもりと緩衝器が入り、乗場の戸は壁の中にある。離したら断面でなくなる',
  '240-地の目とバイアス.zumen.yaml':
    '**継ぎ方は、2 本の帯を 90° ずらして重ねる手順。** 重ねた所を角から角へ縫うので、重なっていないと継ぎ目が描けない',
  '220-防火区画と避難経路.zumen.yaml':
    '**× は閉まったシャッターの上に置く**（そこが通れないという印）。**排煙口は煙が溜まる所に開ける** —— どちらも、重ねていることが図の中身',
  '213-血球計算盤の目盛り.zumen.yaml':
    '**境界線に触れた細胞をどう数えるかが、この図の中身**（③）。線に乗っていなければ、規則を示せない',
  '210-楽譜の寸法.zumen.yaml':
    '**符頭は五線の「線の上」にも置く。** 線に重なるのが音の高さの示し方で、離したら楽譜でなくなる（碁石を盤の交点に置くのと同じ）',
  '182-公園の遊具と安全領域.zumen.yaml':
    '**安全領域どうしは重なってよい**（遊具そのものが相手の領域に入らなければよい）。重なりを消すと、規準と違う図になる —— この図では、遊具とベンチが領域の外にあることを機械で確かめてある',
  '17-躯体の伏図.zumen.yaml': '**柱はスラブの上に立つ。** 伏図は重ねて描くもので、離したら嘘になる',
  '42-擁壁の標準断面図.zumen.yaml': '**水抜管は竪壁と裏込を貫く。** 貫いていることが図の中身',
  '54-のりかえ案内図.zumen.yaml': '目盛は帯の上に置く。**帯のどこかを指すための印**',
  '66-囲碁の棋譜.zumen.yaml': '**碁石は盤の線の交点に置く。** 升の中ではない',
  '70-リバーシの局面図.zumen.yaml': '目印（星）は升の角に置く。**4 つの升にまたがるのが正しい**',
  '77-舞台照明仕込図.zumen.yaml': '**バトンは舞台の上を横切っている。** 吊ってあるので重なる',
  '83-駅の配線略図.zumen.yaml': '停止位置の印は線の上に置く。**その線のどこで止まるか**を指す',
  '91-リンゴ高密植栽培の樹形図.zumen.yaml':
    '**ワイヤーは支柱・主幹・枝を横切って張る。** 横切っていることが棚の構造',
  '92-防虫モニタリングの定点配置図.zumen.yaml':
    '**粘着トラップは壁沿いに置く。** 区画の境の上に来るのが正しい置き方',
  '106-雑踏警備計画図.zumen.yaml':
    '**警備員は境目に立つ。** 狭くなる所・流れが分かれる所に立つので、区画の境に重なるのが正しい',
  '111-閉塞と信号現示.zumen.yaml':
    '**閉塞の境目は線路の上にある。** 列車も線路の上に乗る。離したら位置の図でなくなる',
  '112-交通事故の現場見取図.zumen.yaml':
    '**道路は交わる。** 中央線・スリップ痕・地点の印は、どれも路面の上に描くもの',
  '117-カメラ配置図.zumen.yaml':
    '**180 度の半円は、被写体とカメラの両方を含む範囲。** 中の物と重なるのが当たり前',
  '118-特許図面の書き方.zumen.yaml':
    '**断面図は部品どうしが接して重なる。** 蓋・パッキン・ヒンジ・係合爪は、触れているから機能する',
  '119-消火器と消火栓の配置図.zumen.yaml':
    '**消火器と消火栓は廊下の上に置く。** 扉も壁の上にある。置く場所がそのまま図の中身',
  '120-トラックの積載計画図.zumen.yaml':
    '**荷は荷台に載り、キャブは荷台と繋がっている。** 接しているから重さが軸へ伝わる',
  '131-刺網の網図.zumen.yaml':
    '**浮子は浮子綱の上、沈子は沈子綱の上に付く。** 網地の縁に半分かかるのが、付いている形',
  '135-工業用パターン.zumen.yaml':
    '**合印は型紙の縁に入れる切り込み。** 縁に半分かかるのが、入っている形',
  '169-麻雀の配牌.zumen.yaml':
    '**山も注記も、卓の上にある。** 席の名前は卓の縁にかかるのが、座っている位置の示し方',
  '168-ダイヤモンドシステム.zumen.yaml':
    '**ダイヤは台のふちに埋まっている。** クッションに重ねて描くのが、ダイヤの在り方',
  '167-ダーツボードの割り付け.zumen.yaml':
    '**数字は環の上に並ぶ。** 盤の環と数字が重なるのが、ダーツボードの形そのもの',
  '165-地図記号の絵地図.zumen.yaml':
    '**道は川を渡り、田畑を横切る。** 地図の線どうしは交わるもので、離したら地図でなくなる',
  '162-Cabin-LOPA.zumen.yaml':
    '**非常口は胴体の壁にある。** 壁にまたがって描くのが、扉の在り方',
  '161-Weaving-draft.zumen.yaml':
    '**方眼は、縦線と横線が交わってできている。** 交わらない方眼は方眼でない',
  '158-Cattle-handling-facility.zumen.yaml':
    '**単列の柵は追い込みの壁から始まり、扉は追い込みの中にある。** 離したら牛の通り道でなくなる',
  '157-Drill-chart.zumen.yaml':
    '**ヤード線とハッシュは交わる。** 競技場の線どうしなので、重なるのが線の引き方',
  '153-Parking-striping.zumen.yaml':
    '**寸法の注記は、測った枡の上に置く。** 区画の上に「9\'-0\" x 18\'-0\"」と書くのがその形',
  '152-Septic-site-plan.zumen.yaml':
    '**敷地の上に、みんな乗る。** タンクもトレンチも予備地も井戸の離隔も、敷地に重ねて描くもの',
  '151-Deck-framing-plan.zumen.yaml':
    '**力の通り道は、接している所を通る。** 根太は梁に載り、梁は束に載る。離したら伏図でなくなる',
  '149-Pallet-rack-layout.zumen.yaml':
    '**寸法の注記は、測った物の上に置く。** ベイの上に「8 ft」、通路の上に「12 ft」と書くのがその形',
  '148-Egress-plan.zumen.yaml':
    '**距離の注記は、その経路の上に置く。** 部屋や廊下の上に乗るのが、どこを測ったかを言う形',
  '147-Site-plan-setbacks.zumen.yaml':
    '**建物は敷地の中に建つ。** 建てられる範囲・家・車庫・通路は、どれも敷地の上に重ねて描くもの',
  '145-Sprinkler-layout.zumen.yaml':
    '**ヘッドは枝管に付き、枝管はクロスメインに付く。** 繋がっている所が重なるのが、配管の図',
  '144-Accessible-toilet-room.zumen.yaml':
    '**有効床面どうしは重なってよい**（ADA）。便器の前の 60x56 と洗面の 30x48 は、重なったまま両方成り立つ',
  '143-Roof-framing-plan.zumen.yaml':
    '**垂木は棟木に取り付く。** 平面では線どうしが交わるのが、取り付いている形',
  '139-矩計図.zumen.yaml':
    '**矩計図は接している所を描く図。** 基礎は土に埋まり、土台は基礎に載り、外壁は土台を包む。離したら納まりでなくなる',
  '140-Exterior-wall-platform-framing.zumen.yaml':
    '**アンカーボルトは土台を貫き、面材は軸組を覆う。** 覆っていることが、その層の仕事',
  '138-ロープ高所作業の作業計画図.zumen.yaml':
    '**ライフラインの支持物は、架台に取る。** 丸が架台の縁に半分かかるのが、そこへ取ってある形',
  '134-梁の配筋図.zumen.yaml':
    '**鉄筋はコンクリートの中にある。** 主筋はあばら筋の内側、あばら筋は梁の断面の中。接していないと配筋図でなくなる',
};

/**
 * **線の錨は、箱ではない。**
 *
 * 自分自身への辺や折れ線の端に置く **2px・`marker: none`・名前なし**の節は、
 * 何も描かない。**通り道の足場**であって、床の場所を取る物ではない。
 *
 * それを `straddles` が「はみ出して重なっている」と数えていた。
 * 測ったら **27 組・8 枚**（2026-09-19）。しかも見本 61（道路の平面線形図）は
 * **その組しか無いのに**「わざと重ねている」へ登録されていて、
 * 書いてある理由（終点の印が路肩線に乗る）は**実物と違っていた。**
 *
 * **嘘の観測値は、嘘の理由を生む。**
 */
describe('線の錨は、箱として数えない', () => {
  const ANCHORED = `version: 1
kind: placement
arrows: true
nodes:
  - id: room
    label: "部屋"
    at: { x: 100, y: 100 }
    size: { w: 200, h: 200 }
  - id: a
    label: ""
    marker: none
    at: { x: 99, y: 150 }
    size: { w: 2, h: 2 }
  - id: b
    label: ""
    marker: none
    at: { x: 399, y: 150 }
    size: { w: 2, h: 2 }
edges:
  - from: a
    to: b
    curve: none
    ends: { from: none, to: none }
`;

  it('**何も描かない 2px の節は、はみ出しの相手にしない**', async () => {
    const out = straddles(await layout(ANCHORED));
    assert.deepEqual(out, [], `錨をはみ出しに数えている（${JSON.stringify(out)}）`);
  });

  it('**名前のある小さい箱は、これまでどおり数える**（印そのものを隠さない）', async () => {
    const out = straddles(await layout(ANCHORED.replace('  - id: a\n    label: ""', '  - id: a\n    label: "杭"')));
    assert.ok(out.length > 0, '名前のある箱まで見逃している');
  });
});

/**
 * **見本に Markdown の印を残さない**（2026-09-19）。
 *
 * 名前は素のテキストなので、`**` はそのまま絵に出る。
 * 見本 193・200 で 2 回やり、**既にあった見本 88 にも残っていた**。
 * 検査（`label-markdown`）を足したので、見本ぜんぶでも留めておく。
 */
describe('見本の名前に、Markdown の印が無い', () => {
  it('**`**` の付いた名前が 1 つも無い**', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const found: string[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
      for (const line of readFileSync(new URL(name, dir), 'utf8').split('\n')) {
        if (/^\s*label: ".*\*\*/.test(line)) found.push(`${name}: ${line.trim()}`);
      }
    }
    assert.deepEqual(found, []);
  });
});

describe('箱が、はみ出して重なっていない', () => {
  it('**わざと重ねている図のほかは 0**', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const found: string[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      const why = LAYERED_ON_PURPOSE[name];
      if (why === undefined) {
        for (const pair of out.straddles) found.push(`${name}: ${pair[0]} × ${pair[1]}`);
      } else {
        assert.ok(out.straddles.length > 0, `${name} は重なりが中身のはずなのに 0（${why}）`);
      }
    }
    assert.deepEqual(found, []);
  });
});

/**
 * **広い箱から出ていった名前**（`adriftNames`）。
 *
 * 名前が入らなければ外へ出す —— 小さい印ではそれが正しい
 * （駅の丸・回路の記号・伏図の小梁）。
 *
 * **広い箱では話が違う。** 表の欄が 330px あって名前が入らないなら、
 * 文字は欄の外へ飛び、**行が空に見える。**
 * `crowdedNames` は当たらなければ何も言わない ——
 * 当たっていないことが問題ではなく、**欄と値が離れたこと**が問題。
 *
 * 2026-09-15。**実物をブラウザで見て見つけた**（数の検査はすべて 0 だった）。
 */
describe('広い箱から出ていった名前', () => {
  const CELL = `version: 1
kind: placement
nodes:
  - id: wide
    label: とても長い値がここに入っていて欄の幅にはどうしても収まらないので外へ出ていく
    at: { x: 0, y: 0 }
    size: { w: 330, h: 28 }
  - id: mark
    label: 名前が外に出る小さな印
    marker: circle
    at: { x: 0, y: 200 }
    size: { w: 34, h: 34 }
`;

  it('**幅のある箱から出たら知らせる**', async () => {
    const out = await inspect(CELL);
    assert.deepEqual(out.adriftNames, ['wide']);
  });

  /**
   * **枠の無い注記でも同じ**（2026-09-15 に広げた）。
   *
   * 舞台転換図（見本 137）を書いていて出た。500px の欄へ 548px の文を入れたら、
   * **文字が 500px 右へ飛んで紙が 550px 広がった。**
   * 検証器は「直すところはありませんでした」と言った。
   *
   * **枠が無いぶん、こちらのほうが悪い。** 枠があれば空の欄が見えるが、
   * 枠が無ければ**どこにあるはずだったのかも分からない。**
   * 広げたら**見本 11 枚**が同じ形で埋まっていた（どれも偶然、無害な所へ落ちていた）。
   */
  /**
   * **枠が無ければ、細くても見る**（2026-09-16 に 200px → 40px へ下げた）。
   *
   * 200px のままで**2 回続けて取り逃がした** —— 外壁の軸組（見本 140）の
   * 152px の欄と、分電盤の回路表（見本 142）の見出し。どちらも文字が外へ飛んでいた。
   * **枠の無い箱は、箱そのものが文字の置き場所**なので、
   * 「小さい印だから外へ出す」という言い分が立たない。
   */
  it('**枠が無ければ、細い箱でも知らせる**', async () => {
    const narrow = `version: 1
kind: placement
nodes:
  - id: note
    label: この文は 60px の箱には入りません
    marker: none
    at: { x: 0, y: 0 }
    size: { w: 60, h: 20 }
`;
    assert.deepEqual((await inspect(narrow)).adriftNames, ['note']);
  });

  it('**場所を指すだけの点は、細ければ知らせない**（測点の印は 8px）', async () => {
    const dot = `version: 1
kind: placement
nodes:
  - id: sta
    label: No.1
    marker: none
    at: { x: 0, y: 0 }
    size: { w: 8, h: 8 }
`;
    assert.deepEqual((await inspect(dot)).adriftNames, []);
  });

  it('**枠の無い注記でも知らせる**', async () => {
    const out = await inspect(CELL.replace('    at: { x: 0, y: 0 }', '    marker: none\n    at: { x: 0, y: 0 }'));
    assert.deepEqual(out.adriftNames, ['wide']);
  });

  it('**小さい印は知らせない**（外へ出すのが正しい）', async () => {
    const out = await inspect(CELL.replace(/  - id: wide\n(?:.*\n){3}/, ''));
    assert.deepEqual(out.adriftNames, []);
  });

  it('入る値なら何も言わない', async () => {
    const out = await inspect(CELL.replace('とても長い値がここに入っていて欄の幅にはどうしても収まらないので外へ出ていく', '短い値'));
    assert.deepEqual(out.adriftNames, []);
  });

  it('**見本すべてで 0**', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const dir = new URL('../examples/gallery/', import.meta.url);
    const adrift: string[] = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.zumen.yaml')).sort()) {
      const out = await inspect(readFileSync(new URL(name, dir), 'utf8'));
      for (const id of out.adriftNames) adrift.push(`${name}: ${id}`);
    }
    assert.deepEqual(adrift, []);
  });
});


/**
 * **囲みの名前の場所へ、節の名前を置かない。**
 *
 * 2026-09-15、見本 49（アクティビティ図）を**ブラウザで開いて**出た。
 * レーンの名前「受付（レーン）」に、開始の印の名前「開始」が乗り、
 * **どちらも読めなくなっていた。** 「倉庫（レーン）」と「分岐」も同じ。
 *
 * 外へ出した名前は箱と辺を避けるようにしてあるが、
 * **囲みの名前が占めている帯は、避ける相手に入っていなかった。**
 */
describe('囲みの名前を避ける', () => {
  it('**囲みの見出しの帯に、節の名前を置かない**', async () => {
    const source = `version: 1
kind: placement
groups:
  - id: lane
    label: 受付（レーン）
nodes:
  - id: s
    label: 開始
    marker: circle
    group: lane
    at: { x: 60, y: 0 }
    size: { w: 26, h: 26 }
  - id: t
    label: 注文を受ける
    group: lane
    at: { x: 0, y: 60 }
    size: { w: 150, h: 50 }
`;
    const placed = await layout(source);
    const plans = planNames(placed.boxes, extentOf(placed.boxes), placed.edges, placed.groups);
    const plan = plans.get('s')!;
    assert.equal(plan.kind, 'outside', '前提が変わった（名前が外へ出ていない）');
    const rect = textRectOf(placed.boxes.find((b) => b.id === 's')!, plan)!;
    const group = placed.groups[0]!;
    const band = { x: group.x, y: group.y, w: 160, h: 26 };
    const hit =
      rect.x < band.x + band.w &&
      band.x < rect.x + rect.w &&
      rect.y < band.y + band.h &&
      band.y < rect.y + rect.h;
    assert.ok(!hit, '囲みの名前の帯に、節の名前が乗っている');
  });
});

/**
 * **細い箱で、回した副題が名前を横切っていた。**
 *
 * 2026-09-15、見本 26（データセンターのラック）を**ブラウザで開いて**出た。
 * 「A 列」「B 列」の上を、回した副題「42Ux6・6.0kW/ラック」が**串刺しにしていた。**
 *
 * 副題は箱の左端から 12px の所に立てていたが、
 * **名前は箱の中央**にあるので、幅 50px の箱では**両方が同じ場所を取る。**
 *
 * 左に副題の帯を確保し、**名前は残りの幅の中央**へ置く。
 */
describe('回した副題と、名前の場所', () => {
  const RACK = `version: 1
kind: placement
nodes:
  - id: a
    label: A 列
    technology: 42Ux6・6.0kW/ラック
    at: { x: 0, y: 0 }
    size: { w: 50, h: 280 }
`;

  it('**副題の帯と、名前が重ならない**', async () => {
    const placed = await layout(RACK);
    const out = await render(placed, 'light', 'safe', true);
    const sub = /<text x="([\d.]+)"[^>]*font-size="10"[^>]*transform="rotate/.exec(out);
    const name = /<text x="([\d.]+)"[^>]*font-size="12"[^>]*>A 列</.exec(out);
    assert.ok(sub !== null && name !== null, '前提が変わった（aside になっていない）');
    const subRight = Number(sub[1]) + 5; // 回した文字の太さの半分
    const nameLeft = Number(name[1]) - 36 / 2; // 「A 列」の見た目の幅の半分
    assert.ok(subRight <= nameLeft, `副題が名前へ食い込んでいる（${subRight} > ${nameLeft}）`);
  });
});

/**
 * **注記には、表の話をしない**（2026-09-21）。
 *
 * 「表の欄なら、値が欄から離れて行が空に見えます」は枠のある箱の話で、
 * **`marker: none` の注記には当たらない** —— そちらは**まわりの図に重なる。**
 * この夜だけで 10 回以上この指摘を受け、そのたびに表ではなく注記だった。
 */
describe('名前が箱から離れているときの言い方', () => {
  const one = (marker: string): string =>
    [
      'version: 1', 'kind: placement', 'nodes:',
      '  - id: a', '    label: "とても長い文字列がここに入ります"', `    marker: ${marker}`,
      '    at: { x: 0, y: 0 }', '    size: { w: 100, h: 24 }', '',
    ].join('\n');

  it('**注記なら、まわりの図に重なると言う**', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(one('none'));
    const said = found.find((f) => f.code === 'name-adrift');
    assert.ok(said !== undefined, found.map((f) => f.code).join(','));
    assert.match(said.message, /まわりの図に重なります/, said.message);
    assert.ok(!said.message.includes('表の欄なら'), said.message);
  });

  it('枠のある箱なら、これまでどおり表の話をする', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(one('box'));
    const said = found.find((f) => f.code === 'name-adrift')!;
    assert.match(said.message, /表の欄なら/, said.message);
  });

  it('どちらでも、足りない px は言う', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    for (const marker of ['none', 'box']) {
      const found = await placedFindings(one(marker));
      const said = found.find((f) => f.code === 'name-adrift')!;
      assert.match(said.message, /px 足りません/, said.message);
    }
  });
});

/**
 * **足りない px が負になっていた**（2026-09-21）。
 *
 * 幅は足りているのに名前が外へ出ることがある（行が増えて**高さ**が足りないとき）。
 * そのとき「**-88px 足りません**」と出ていた ——
 * 数として意味がないうえ、**直す場所（幅）を間違って指している。**
 */
describe('幅は足りているのに外へ出たとき', () => {
  const two = [
    'version: 1', 'kind: placement', 'nodes:',
    '  - id: a', '    label: "2 行の\\n名前"',
    '    at: { x: 0, y: 0 }', '    size: { w: 280, h: 24 }', '',
  ].join('\n');

  it('**「幅は足りています」と言い、高さを指す**', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(two);
    const said = found.find((f) => f.code === 'name-adrift');
    assert.ok(said !== undefined, found.map((f) => f.code).join(','));
    assert.match(said.message, /幅は足りています/, said.message);
    assert.match(said.message, /高さ/, said.message);
  });

  it('**負の px を出さない**', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(two);
    const said = found.find((f) => f.code === 'name-adrift')!;
    assert.ok(!/-\d+px 足りません/.test(said.message), said.message);
  });

  it('高さも同時に名指しする（label-too-tall）', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(two);
    assert.ok(found.some((f) => f.code === 'label-too-tall'), found.map((f) => f.code).join(','));
  });
});
