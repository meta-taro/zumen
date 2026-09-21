/**
 * 箱の幅をラベルから決める（Issue #3 の 2）。
 *
 * **報告された実害をそのまま置く。**
 *
 * > 幅が固定なので、日本語ラベルが箱をはみ出します。
 * > 左端のノードでは **x が負になり、文字が画面外へ切れました**。
 *
 * ```
 * /api/agent_optout（掲載停止）    → 左端で欠落（x < 0）
 * cron（doko001 / batch/twikit）  → 箱の外へはみ出し
 * /mnt/wasabi（doko001 / s3fs）   → 箱の外へはみ出し
 * ```
 *
 * ## 正確には測れない
 *
 * 字送りは書体で変わり、**書体は貼り先が決める**（Issue 007 §3.1）。
 * ここが狙うのは正確さではなく、**「入らないよりはまし」**。
 * だから余裕を持って測り、上限で止める（際限なく広げない）。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { labelWidth, layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';

/** 報告に出てきた実物。 */
const REPORTED = [
  '/api/agent_optout（掲載停止）',
  'cron（doko001 / batch/twikit）',
  '/mnt/wasabi（doko001 / s3fs）',
];

function diagram(labels: string[]): string {
  const nodes = labels.map((label, i) => `  - id: n${i}\n    label: ${JSON.stringify(label)}`);
  return `version: 1\nnodes:\n${nodes.join('\n')}\n`;
}

describe('ラベルの幅を測る', () => {
  it('全角は半角の 2 倍として数える', () => {
    assert.equal(labelWidth('ああ'), labelWidth('aaaa'));
  });

  it('半角カナは半角として数える', () => {
    assert.ok(labelWidth('ｱｲｳ') < labelWidth('アイウ'));
  });

  it('長いほど広い', () => {
    assert.ok(labelWidth('cli') < labelWidth('Load Balancer'));
  });

  it('空なら 0', () => {
    assert.equal(labelWidth(''), 0);
  });
});

describe('**報告されたラベルが箱に入る**（Issue #3 の 2）', () => {
  it('3 つとも、文字が箱に収まる', async () => {
    const placed = await layout(diagram(REPORTED));
    for (const box of placed.boxes) {
      const needed = labelWidth(box.label);
      assert.ok(needed <= box.w, `${box.label}: 文字 ${needed} > 箱 ${box.w}`);
    }
  });

  it('**x が負にならない**（画面外へ切れない）', async () => {
    const placed = await layout(diagram(REPORTED));
    for (const box of placed.boxes) {
      assert.ok(box.x >= 0, `${box.label} の x が ${box.x}`);
    }
  });

  it('図の幅が、いちばん広い箱を含む', async () => {
    const placed = await layout(diagram(REPORTED));
    for (const box of placed.boxes) {
      assert.ok(box.x + box.w <= placed.width, `${box.label} が図からはみ出した`);
    }
  });
});

describe('広げすぎない', () => {
  it('短いラベルでも、下限より狭くならない', async () => {
    const placed = await layout(diagram(['a']));
    assert.equal(placed.boxes[0]!.w, 160);
  });

  it('**際限なく広げない**（上限で止める）', async () => {
    const placed = await layout(diagram(['あ'.repeat(200)]));
    assert.ok(placed.boxes[0]!.w <= 320, `幅が ${placed.boxes[0]!.w}`);
  });

  it('人が大きさを決めていたら、そちらが勝つ', async () => {
    const text = `version: 1\npins:\n  n0:\n    size: { w: 500, h: 90 }\nnodes:\n  - id: n0\n    label: あ\n`;
    const placed = await layout(text);
    assert.equal(placed.boxes[0]!.w, 500);
  });

  it('人が書き換えたラベルの幅で測る', async () => {
    const text = `version: 1\npins:\n  n0:\n    label: とても長い名前に書き換えました\nnodes:\n  - id: n0\n    label: a\n`;
    const placed = await layout(text);
    assert.ok(placed.boxes[0]!.w > 160, `幅が ${placed.boxes[0]!.w}`);
  });
});

describe('technology を描く（Issue #3 の 4）', () => {
  // 形式にあって検証も通るのに、絵に出ていなかった。
  // **手本の図（examples/本番構成）でも出ていなかった。**
  // 所属や版を書ける唯一の場所なので、描かれないとラベルへ畳むしかなくなる。

  const WITH_TECH = [
    'version: 1',
    'nodes:',
    '  - id: web',
    '    type: server',
    '    label: Web 01',
    '    technology: Apache 2.4',
    '  - id: db',
    '    type: database',
    '    label: DB',
    '',
  ].join('\n');

  it('レイアウトまで運ばれる', async () => {
    const placed = await layout(WITH_TECH);
    assert.equal(placed.boxes.find((b) => b.id === 'web')!.technology, 'Apache 2.4');
    assert.equal(placed.boxes.find((b) => b.id === 'db')!.technology, null);
  });

  it('**SVG に出る**', async () => {
    const { render } = await import('../src/render.ts');
    const svg = render(await layout(WITH_TECH));
    assert.match(svg, /Apache 2\.4/);
  });

  it('副題があるぶん、箱を高くする（文字が重ならない）', async () => {
    // **同じ `type` どうしで比べる。** 形によって高さが変わるようになったので
    // （Issue #9。円柱は上下に余分が要る）、違う型と比べると意味が無い。
    const withTech = (await layout(WITH_TECH)).boxes.find((b) => b.id === 'web')!;
    const stripped = WITH_TECH.replace(/^\s*technology:.*$/gm, '');
    const without = (await layout(stripped)).boxes.find((b) => b.id === 'web')!;
    assert.ok(withTech.h > without.h, `${withTech.h} <= ${without.h}`);
  });

  it('副題が長ければ、箱を広げる', async () => {
    const long = WITH_TECH.replace('Apache 2.4', 'Apache 2.4 / mod_php / doko001');
    const placed = await layout(long);
    assert.ok(placed.boxes.find((b) => b.id === 'web')!.w > 160);
  });

  it('**手本の図で出る**（出ていなかったのが報告の中身）', async () => {
    const { render } = await import('../src/render.ts');
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../examples/本番構成.zumen.yaml', import.meta.url), 'utf8');
    assert.match(render(await layout(source)), /Apache/);
  });
});

/**
 * **名前を 2 行で書く**（`label` の中の改行）。
 *
 * オーナーの指摘（2026-09-18）。
 *
 * > 販売図のグレースケールのかっこいいバージョン…
 * > **洗練さとかエレガント、品位。そう人は感じるのです。**
 *
 * 実物の高級版の図面は、**部屋の名前を 2 行に積む**。
 * `Shoes-in Closet` `Walk-in Closet` `Dressing Room` ——
 * 横に伸ばすと部屋からはみ出す名前を、**折って収める**。
 *
 * これまでは 1 行しか描けなかったので、
 * 小さい部屋の名前は**外へ飛ぶ**（`name-crowded`）か、略語に潰すしかなかった。
 */
describe('名前の改行', () => {
  const two = `version: 1
kind: placement
nodes:
  - id: sic
    label: "Shoes-in\\nCloset"
    at: { x: 0, y: 0 }
    size: { w: 80, h: 50 }
`;

  it('**幅は、いちばん長い行で測る**（つないだ長さではない）', () => {
    assert.equal(labelWidth('Shoes-in\nCloset', 12), labelWidth('Shoes-in', 12));
  });

  it('**行ごとに描く**（1 本の <text> に改行を入れても、SVG では折れない）', async () => {
    const out = render(await layout(two), 'light', 'safe', true);
    assert.match(out, /<text[^>]*>Shoes-in<\/text>/);
    assert.match(out, /<text[^>]*>Closet<\/text>/);
  });

  it('**箱の中に収まる**（外へ飛ばさない）', () => {
    assert.ok(!validate(two).some((f) => f.code === 'name-crowded'), validate(two).map((f) => f.code).join(','));
  });

  /**
   * **積めるのは、箱の中に収めた名前だけ。**
   *
   * 高さが足りなければ、これまでどおり**外へ出す** ——
   * 外へ出した名前は 1 行に戻す（外の置き場は `src/names.ts` が
   * 1〜2 行ぶんで計算しているので、勝手に積むと隣の箱へ食い込む）。
   */
  it('**高さが足りなければ、外へ出して 1 行に戻す**（枠を突き抜けさせない）', async () => {
    const low = two.replace('h: 50', 'h: 18');
    const out = render(await layout(low), 'light', 'safe', true);
    const hit = out.match(/<text [^>]*y="([\d.]+)"[^>]*>Shoes-in Closet</);
    assert.ok(hit, `1 行に戻していない: ${out}`);
    assert.ok(Number(hit[1]) > 18, `箱の中に押し込んでいる: ${hit[1]}`);
  });
});

/**
 * **名前の中の `**` は、そのまま絵に出る**（2026-09-19）。
 *
 * zumen の名前は**素のテキスト**で、Markdown ではない。
 * ところが正本のコメントや CHANGELOG は Markdown で書くので、
 * **強調の印をそのまま名前へ持ち込んでしまう** ——
 * 見本 193 と 200 で 2 回やった（どちらも表のセル）。
 *
 * 絵を見れば気づくが、**表のセルは 1 行が短いので見落とす。**
 * 黙って `**` の付いた図を出さない。
 */
describe('名前に Markdown の印を残さない', () => {
  const STARS = `version: 1
kind: placement
nodes:
  - id: a
    label: "**留め**に切る"
    at: { x: 0, y: 0 }
    size: { w: 200, h: 40 }
`;

  it('**名前に ** があれば知らせる**', () => {
    const found = validate(STARS);
    assert.ok(
      found.some((f) => f.code === 'label-markdown'),
      `何も言っていない: ${JSON.stringify(found.map((f) => f.code))}`,
    );
  });

  it('**どう直すかを言う**（素のテキストであること）', () => {
    const said = validate(STARS).find((f) => f.code === 'label-markdown')!.message;
    assert.match(said, /そのまま|素のテキスト/);
  });

  it('warning であって、図は出る', () => {
    assert.ok(validate(STARS).every((f) => f.severity === 'warning'));
  });

  it('印が無ければ、何も言わない', () => {
    assert.ok(!validate(STARS.replace('**留め**', '留め')).some((f) => f.code === 'label-markdown'));
  });

  it('**符号（tag）と版（technology）も見る**', () => {
    const TAG = STARS.replace('label: "**留め**に切る"', 'label: "節"\n    tag: "**A**-1"');
    assert.ok(validate(TAG).some((f) => f.code === 'label-markdown'), JSON.stringify(validate(TAG).map((f) => f.code)));
    const TECH = STARS.replace('label: "**留め**に切る"', 'label: "節"\n    technology: "**PostgreSQL**"');
    assert.ok(validate(TECH).some((f) => f.code === 'label-markdown'));
  });

  it('**掛け算の * ひとつでは鳴らない**（寸法に使う）', () => {
    assert.ok(!validate(STARS.replace('"**留め**に切る"', '"300 * 2"')).some((f) => f.code === 'label-markdown'));
  });
});

/**
 * **折り返した名前が、箱からはみ出す**（2026-09-21）。
 *
 * 名前は箱の**上下の真ん中**から積むので（`src/render.ts`）、
 * 行が増えると上下へはみ出す。
 * **幅は `name-adrift` が見ていたが、高さは誰も見ていなかった。**
 * 見本 297（郵便物の規格）を描いていて自分で踏んだ ——
 * 2 行の名前を高さ 18px の箱に入れ、2 行目が下の図にかぶった。
 */
describe('折り返した名前の高さ', () => {
  const box = (label: string, h: number): string =>
    [
      'version: 1', 'kind: placement', 'nodes:',
      '  - id: a', `    label: ${JSON.stringify(label)}`, '    marker: none',
      '    at: { x: 0, y: 0 }', `    size: { w: 200, h: ${h} }`, '',
    ].join('\n');

  it('**2 行を 18px の箱に入れたら名指しする**', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(box('上の行\n下の行', 18));
    const said = found.filter((f) => f.code === 'label-too-tall');
    assert.equal(said.length, 1, found.map((f) => f.code).join(','));
    assert.match(said[0]!.message, /2 行/, said[0]!.message);
    assert.match(said[0]!.message, /28px/, '要る高さを言っていない');
  });

  it('高さが足りていれば言わない', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(box('上の行\n下の行', 36));
    assert.ok(!found.some((f) => f.code === 'label-too-tall'));
  });

  it('1 行には言わない（折り返していないので積まない）', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(box('1 行だけ', 8));
    assert.ok(!found.some((f) => f.code === 'label-too-tall'));
  });

  it('警告であって、図は出る', async () => {
    const { placedFindings } = await import('../src/cli.ts');
    const found = await placedFindings(box('上の行\n下の行', 18));
    assert.ok(found.every((f) => f.severity === 'warning'));
  });
});
