/**
 * **寸法の単位**（`src/units.ts`）。
 *
 * 花火大会の保安距離図（見本 93）で、200 m の円に `R=200,000` と出た。
 * **桁を数えないと読めない数字**は、図面としては書いていないのと同じ。
 *
 * 決めるのは**縮尺 1 つ**。数値の大きさで決めると、
 * 同じ図に `45.0 m` と `5,000` が並ぶ。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inMetres, lengthText } from '../src/units.ts';

describe('単位は縮尺が決める', () => {
  it('**1 px が 100 mm 以上なら m**（1:100 より小さい縮尺）', () => {
    assert.equal(inMetres(100), true);
    assert.equal(inMetres(2000), true);
    assert.equal(inMetres(50), false, '駐車場の区画（2,500）はミリのまま');
    assert.equal(inMetres(25), false, '伏図・間取りはミリのまま');
  });

  it('m のときは小数 1 桁まで。整数なら小数点を書かない', () => {
    assert.equal(lengthText(100, 2000), '200 m');
    assert.equal(lengthText(250, 500), '125 m');
    assert.equal(lengthText(25, 100), '2.5 m');
    assert.equal(lengthText(1, 2000), '2 m');
  });

  it('mm のときは 3 桁ごとに区切る', () => {
    assert.equal(lengthText(280, 25), '7,000');
    assert.equal(lengthText(50, 50), '2,500');
    assert.equal(lengthText(20, 0.5), '10');
  });

  it('向きは問わない（引き算の向きで符号が付かない）', () => {
    assert.equal(lengthText(-100, 2000), '200 m');
  });
});

/**
 * **1px が 1mm 未満の図では、小数が意味を持つ**（2026-09-19。見本 194 の点字で当たった）。
 *
 * ミリの整数に丸めると、点字の点間隔 **2.6mm が「3」**になる。
 * 2.6 も 3.4 も同じ「3」になってしまい、**規格の図面としては書いていないのと同じ。**
 *
 * どちらで書くかは、ここでも**縮尺が言う** ——
 * 1px が 1mm 以上の図（間取り・伏図）は、これまでどおりミリの整数。
 * 1px が 1mm 未満の図（1:1 より拡大した詳細図）は、**小数 1 桁まで**。
 */
describe('拡大した図は、小数まで書く', () => {
  it('**点字の 2.6mm が「3」にならない**', () => {
    // 1px = 0.05mm の詳細図で、52px は 2.6mm
    assert.equal(lengthText(52, 0.05), '2.6');
  });

  it('**割り切れる値に小数点は書かない**（7.0 とは書かない）', () => {
    assert.equal(lengthText(140, 0.05), '7');
  });

  it('1px が 1mm 以上の図は、これまでどおり整数', () => {
    assert.equal(lengthText(70, 100), '7 m');
    assert.equal(lengthText(700, 10), '7,000');
  });

  it('**ちょうど 1mm/px は整数のまま**（境目を動かさない）', () => {
    assert.equal(lengthText(2600, 1), '2,600');
  });
});
