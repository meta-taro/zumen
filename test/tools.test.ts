/**
 * エージェントへ開く口（D13 / D18）。
 *
 * ここでいちばん大事なのは、**開けていない口が本当に開いていないこと**。
 *
 * 「AI が中心、人は責任を負う」は、**人が承認しなくてよいという意味ではない。**
 * 見ずに責任は負えない。だから、
 *
 * - **競合の決着**は開けない（開けたら AI が自分の提案を自分で承認できる）
 * - **`pins` の書き換え**は開けない
 * - **既存ファイルの無条件な上書き**は開けない
 *
 * 実測でも、**AI は 10 回中 10 回 `pins` を書いてきた**（`pnpm s1:real`）。
 * **エージェントは規約を守らない。** だから道具の形で守る。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getPins, parse } from '../src/format.ts';
import {
  create,
  exportAs,
  inspect,
  propose,
  spec,
} from '../src/tools.ts';
import type { Io } from '../src/tools.ts';

const GOOD = [
  'version: 1',
  'title: 本番構成',
  'nodes:',
  '  - id: lb',
  '    type: load-balancer',
  '    label: Load Balancer',
  '  - id: web01',
  '    type: server',
  '    label: Web 01',
  'edges:',
  '  - from: lb',
  '    to: web01',
  '',
].join('\n');

/** 人が 1 か所に手直しを入れた正本。 */
const WITH_PIN = GOOD.replace(
  'nodes:',
  'pins:\n  web01:\n    position: { x: 600, y: 400 }\n\nnodes:',
);

/** 覚えているだけのファイル置き場。**本物のディスクを触らない。** */
function memory(files: Record<string, string> = {}): Io & { files: Record<string, string> } {
  return {
    files,
    read: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`ありません: ${path}`);
      return text;
    },
    write: (path, text) => {
      files[path] = text;
    },
    exists: (path) => files[path] !== undefined,
    list: () => Object.keys(files),
  };
}

describe('形式を教える（ゼロから描けるように）', () => {
  it('形と、書ける語を返す', () => {
    const s = spec();
    assert.equal(s.version, 1);
    assert.match(s.shape, /^version: 1/);
    assert.ok(s.nodeTypes.includes('server'));
    assert.ok(s.appearances.includes('primary'));
  });

  it('**pins を書かないことを伝える**（伝えないと書いてくる）', () => {
    assert.ok(spec().rules.some((rule) => rule.includes('pins')));
  });

  it('id を書き換えないことを伝える', () => {
    assert.ok(spec().rules.some((rule) => rule.includes('id')));
  });

  it('付ける名前を伝える（マージドライバが効く名前）', () => {
    assert.equal(spec().suffix, '.zumen.yaml');
  });
});

describe('新しい図を作る（D18）', () => {
  it('作れる', () => {
    const io = memory();
    const result = create('a.zumen.yaml', GOOD, io);
    assert.equal(result.ok, true);
    assert.equal(io.files['a.zumen.yaml'], GOOD);
  });

  it('**既にあれば失敗する。** 上書きの経路にしない', () => {
    const io = memory({ 'a.zumen.yaml': WITH_PIN });
    const result = create('a.zumen.yaml', GOOD, io);
    assert.equal(result.ok, false);
    // 人の手直しが残っていること。
    assert.equal(io.files['a.zumen.yaml'], WITH_PIN);
  });

  it('**形式に適合しないものは書かない**（壊れた図をディスクに残さない）', () => {
    const io = memory();
    const result = create('a.zumen.yaml', 'version: 2\nnodes: []\n', io);
    assert.equal(result.ok, false);
    assert.deepEqual(Object.keys(io.files), []);
    assert.ok((result.findings ?? []).length > 0);
  });

  it('名前が違えば断る（マージドライバが効かなくなるため）', () => {
    const io = memory();
    assert.equal(create('a.yaml', GOOD, io).ok, false);
    assert.deepEqual(Object.keys(io.files), []);
  });

  it('断るときは理由を返す（握り潰さない）', () => {
    const io = memory({ 'a.zumen.yaml': GOOD });
    assert.match(create('a.zumen.yaml', GOOD, io).reason ?? '', /propose/);
  });
});

describe('提案を入れる（D5 の向き）', () => {
  it('構造は入る', () => {
    const io = memory({ 'a.zumen.yaml': WITH_PIN });
    const proposal = GOOD.replace(
      '    label: Web 01',
      '    label: Web 01\n  - id: redis\n    type: cache\n    label: Redis',
    );
    const result = propose('a.zumen.yaml', proposal, io);
    assert.equal(result.ok, true);
    assert.match(io.files['a.zumen.yaml']!, /id: redis/);
  });

  it('**提案が pins を書いてきても採らない**（実測で 10 回中 10 回書いてきた）', () => {
    const io = memory({ 'a.zumen.yaml': WITH_PIN });
    const proposal = GOOD.replace(
      'nodes:',
      'pins:\n  web01:\n    position: { x: 1, y: 1 }\n\nnodes:',
    );
    propose('a.zumen.yaml', proposal, io);
    const pins = getPins(parse(io.files['a.zumen.yaml']!));
    assert.deepEqual(pins['web01']?.position, { x: 600, y: 400 });
  });

  it('無いファイルには入れない（create を使わせる）', () => {
    const io = memory();
    const result = propose('a.zumen.yaml', GOOD, io);
    assert.equal(result.ok, false);
    assert.match(result.reason ?? '', /create/);
  });

  it('形式に適合しない提案は入れない', () => {
    const io = memory({ 'a.zumen.yaml': WITH_PIN });
    propose('a.zumen.yaml', 'version: 1\n', io);
    assert.equal(io.files['a.zumen.yaml'], WITH_PIN);
  });

  it('**競合は返すが、適用しない**', () => {
    const io = memory({ 'a.zumen.yaml': WITH_PIN });
    // web01 を消してくる提案。人が置いた要素なので、消さずに残して聞く。
    const proposal = 'version: 1\nnodes:\n  - id: lb\n    label: Load Balancer\n';
    const result = propose('a.zumen.yaml', proposal, io);
    assert.equal(result.ok, true);
    assert.ok((result.conflicts ?? []).length > 0);
    assert.match(io.files['a.zumen.yaml']!, /id: web01/);
  });
});

describe('**開けていない口**', () => {
  it('競合を決着させる口が無い', async () => {
    const tools = await import('../src/tools.ts');
    const names = Object.keys(tools);
    for (const forbidden of ['resolve', 'decide', 'accept', 'setPin', 'deletePin']) {
      assert.equal(names.includes(forbidden), false, `${forbidden} が開いている`);
    }
  });

  it('pins は読めるが、書く口が無い', async () => {
    const tools = await import('../src/tools.ts');
    assert.ok(Object.keys(tools).includes('pinsOf'));
    assert.equal(Object.keys(tools).some((n) => /writePin|savePin|updatePin/i.test(n)), false);
  });

  it('無条件に書く口が無い（create と propose だけ）', async () => {
    const tools = await import('../src/tools.ts');
    const writers = Object.keys(tools).filter((n) => /write|save|overwrite|put/i.test(n));
    assert.deepEqual(writers, []);
  });
});

describe('自分で直せるだけの情報を返す', () => {
  it('読めない図では、行番号つきの指摘が返る', async () => {
    const out = await inspect('version: 1\nnodes:\n  - id: a\n  - id: a\n');
    assert.equal(out.readable, false);
    assert.ok(out.findings.some((f) => f.severity === 'error' && f.line !== undefined));
  });

  it('数と、読みにくさの目安が返る', async () => {
    const out = await inspect(GOOD);
    assert.equal(out.readable, true);
    assert.equal(out.nodes, 2);
    assert.equal(out.edges, 1);
    assert.equal(typeof out.crossings, 'number');
    assert.equal(out.tooTangled, false);
  });

  it('**「9 割」を返す**（AI ドリブンが崩れていないかを、AI 自身が見られる）', async () => {
    const out = await inspect(WITH_PIN);
    assert.equal(typeof out.autonomy, 'number');
    assert.equal(out.passLine, 0.9);
  });

  it('絡まりすぎを知らせる（交差がエッジ数を超えたら）', async () => {
    // 少ないノードに多くの線を張ると絡む。
    // **直交ルーティング（Issue #3 の 1）で交差が減ったので、より密にした。**
    // 6 ノード総当たり 30 辺では交差 16 で、もう「絡まりすぎ」ではない。
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const nodes = ids.map((id) => `  - id: ${id}`).join('\n');
    const edges = ids
      .flatMap((from) => ids.filter((to) => to !== from).map((to) => `  - from: ${from}\n    to: ${to}`))
      .join('\n');
    const out = await inspect(`version: 1\nnodes:\n${nodes}\nedges:\n${edges}\n`);
    assert.equal(out.readable, true);
    assert.equal(out.tooTangled, true, `交差 ${out.crossings} / エッジ ${out.edges}`);
  });
});

describe('書き出す', () => {
  it('SVG', async () => {
    assert.match(await exportAs(GOOD, 'svg'), /^<svg/);
  });

  it('Mermaid', async () => {
    assert.match(await exportAs(GOOD, 'mermaid'), /flowchart/);
  });

  it('draw.io', async () => {
    assert.match(await exportAs(GOOD, 'drawio'), /<mxfile/);
  });
});
