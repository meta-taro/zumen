/**
 * **画像を敷いて、引き出し線で仕様を書き込む**（`nodes[].image` ／ `to: { node, at }` ／ `edges[].callout`）。
 *
 * 画面仕様書は、キャプチャの部品から番号つきの線を出し、横の注記に仕様を書く。
 *
 * - **点は元の画像の px。** 敷く大きさを変えても、同じ部品を指したまま
 * - **番号は両端に。** 画面の側と注記の側を番号で突き合わせて読む
 * - **正本のフォルダの外は読まない。** 画像でないものは埋めない
 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { deflateSync } from 'node:zlib';

import { imageSize, ownerOf, pointEnd, pointRef } from '../src/image.ts';
import { insideDir, loadImages, readImage } from '../src/image-files.ts';
import { layout } from '../src/layout.ts';
import { render } from '../src/render.ts';
import { validate } from '../src/validate.ts';

/** 単色の PNG を作る（CRC は読む側が見ないので 0 で足りる）。 */
function png(w: number, h: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 200);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'zumen-image-'));
  mkdirSync(join(dir, 'shots'));
  writeFileSync(join(dir, 'shots', 'sp.png'), png(390, 844));
  return dir;
}

const SPEC = `version: 1
kind: placement
nodes:
  - id: sp
    label: ホーム
    image: ./shots/sp.png
    at: { x: 40, y: 40 }
    size: { w: 195, h: 422 }
  - id: n1
    label: ヘッダー
    at: { x: 300, y: 40 }
    size: { w: 160, h: 40 }
edges:
  - from: n1
    to: { node: sp, at: { x: 195, y: 28 } }
    callout: 1
`;

describe('画像の大きさを読む', () => {
  it('**PNG の幅と高さ**', () => {
    assert.deepEqual(imageSize(png(390, 844)), { type: 'png', w: 390, h: 844 });
  });

  it('**JPEG は SOF から**（間に APP の区切りがあっても）', () => {
    const app = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
    const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0x4c, 0x05, 0x00];
    const bytes = Uint8Array.from([0xff, 0xd8, ...app, ...sof, ...new Array(12).fill(0)]);
    assert.deepEqual(imageSize(bytes), { type: 'jpeg', w: 1280, h: 844 });
  });

  it('**WebP（VP8X）**', () => {
    const b = new Uint8Array(30);
    b.set(Buffer.from('RIFF'), 0);
    b.set(Buffer.from('WEBP'), 8);
    b.set(Buffer.from('VP8X'), 12);
    // 幅 − 1 と 高さ − 1 を 3 バイトずつ（little endian）。
    b.set([0xff, 0x04, 0x00], 24);
    b.set([0x1f, 0x03, 0x00], 27);
    assert.deepEqual(imageSize(b), { type: 'webp', w: 1280, h: 800 });
  });

  it('**画像でないものは null**（拡張子は信じない）', () => {
    assert.equal(imageSize(Buffer.from('not an image at all, just text....')), null);
  });
});

describe('画像の中の点の書き方', () => {
  it('**`{ node, at: { x, y } }` を 1 語へ寄せる**', () => {
    assert.equal(pointEnd({ node: 'sp', at: { x: 195, y: 28 } }), 'sp@195,28');
    assert.equal(pointEnd({ node: 'sp', at: [195, 28] }), 'sp@195,28');
    assert.equal(pointEnd('sp'), null);
  });

  it('**点が属する節を引ける**', () => {
    assert.deepEqual(pointRef('sp@195,28'), { node: 'sp', x: 195, y: 28 });
    assert.equal(ownerOf('sp@195,28'), 'sp');
    assert.equal(ownerOf('sp'), 'sp');
  });
});

describe('画像を読む', () => {
  it('**正本のフォルダの外は読まない**', () => {
    assert.equal(insideDir('./shots/sp.png'), true);
    assert.equal(insideDir('../secret.png'), false);
    assert.equal(insideDir('/etc/passwd'), false);
    assert.equal(readImage('../x.png', folder()), 'outside');
  });

  it('**無いもの・画像でないものは埋めない**', () => {
    const dir = folder();
    writeFileSync(join(dir, 'notes.png'), 'plain text');
    assert.equal(readImage('nothing.png', dir), 'missing');
    assert.equal(readImage('notes.png', dir), 'not-image');
  });

  it('**data URI にして埋める**（SVG を貼った先でも消えない）', () => {
    const got = loadImages(SPEC, folder()).get('./shots/sp.png');
    assert.ok(got !== undefined);
    assert.equal(got.w, 390);
    assert.ok(got.href.startsWith('data:image/png;base64,'));
  });
});

describe('画像を敷いて、点を指す', () => {
  it('**正本として読める**（書き戻しで行が変わらない・点の節を知っている）', () => {
    assert.deepEqual(validate(SPEC).filter((f) => f.severity === 'error'), []);
  });

  it('**点は元の画像の px で、敷いた大きさに合わせて拡げる**', async () => {
    const placed = await layout(SPEC, loadImages(SPEC, folder()));
    const edge = placed.edges[0]!;
    const tip = edge.points[edge.points.length - 1]!;
    const sp = placed.boxes.find((box) => box.id === 'sp')!;
    // 390px の画像を 195px で敷いたので、(195, 28) は箱の中の (97.5, 14)。
    assert.equal(tip.x - sp.x, 97.5);
    assert.equal(tip.y - sp.y, 14);
  });

  it('**大きさを書かなければ、元の大きさで敷く**', async () => {
    const text = SPEC.replace('    size: { w: 195, h: 422 }\n', '');
    const placed = await layout(text, loadImages(text, folder()));
    const sp = placed.boxes.find((box) => box.id === 'sp')!;
    assert.deepEqual([sp.w, sp.h], [390, 844]);
  });

  it('**注記の縁から横へ出して、点へ向かう**', async () => {
    const placed = await layout(SPEC, loadImages(SPEC, folder()));
    const [a, b] = placed.edges[0]!.points;
    assert.equal(a!.y, b!.y, '注記から出るところは水平');
    assert.ok(a!.x > b!.x, '点のある左へ出る');
  });

  it('**画像を描き、線と番号の丸は画像の上に載る**', async () => {
    const svg = render(await layout(SPEC, loadImages(SPEC, folder())), 'light', 'safe', true);
    const image = svg.indexOf('<image ');
    const edge = svg.indexOf('data-edge="n1&gt;sp@195,28"');
    assert.ok(image >= 0 && edge > image, '画像のあとに線');
    assert.equal(svg.match(/data-callout="1"/g)?.length, 2, '番号は両端に');
    assert.ok(!svg.slice(edge).split('</g>')[0]!.includes('marker-end'), '引き出し線に矢じりは付けない');
  });

  it('**画像の名前は画像の上に出し、画像の中には書かない**', async () => {
    const svg = render(await layout(SPEC, loadImages(SPEC, folder())), 'light', 'safe', true);
    const name = /<g data-name="sp"><text x="([\d.]+)" y="([\d.]+)"/.exec(svg);
    assert.ok(name !== null);
    assert.ok(Number(name[2]) < 40 + 1, '画像の上の縁より上');
  });

  it('**画像を読めなければ、書いたパスのまま敷く**', async () => {
    const svg = render(await layout(SPEC), 'light', 'safe', true);
    assert.ok(svg.includes('href="./shots/sp.png"'));
  });
});
