import test from 'node:test';
import assert from 'node:assert/strict';
import { riverAfter } from './river';
import { grainHarvest, convoyReduction } from './merchantInn';

test('plon z tej samej faktorii reaguje na porę roku, ulewę, mróz i zarazę', () => {
  assert.equal(grainHarvest(100, 'lato', 'sloneczna_pogoda', null), 120);
  assert.equal(grainHarvest(100, 'lato', 'ulewne_deszcze', null), 90);
  assert.equal(grainHarvest(100, 'zima', 'zamiec_i_mroz', null), 28);
  assert.equal(grainHarvest(100, 'lato', 'ulewne_deszcze', { templateId: 'zaraza_zbozowa' }), 45);
  assert.equal(grainHarvest(0, 'wiosna', 'wiatr_handlowy', null), 0);
});
test('samotny kupiec jedzie normalnie, dodatkowi członkowie skracają przewóz do limitu', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 7].map(convoyReduction), [0, 0, 5, 15, 20, 20]);
});

test('wezbranie zależy od czasu i opadu, niezależnie od liczby wizyt przy filarze', () => {
  const start = 100_000;
  const wet = 'ulewne_deszcze';
  const warning = riverAfter(start,0,wet,10_000);
  assert.deepEqual(warning,{level:140_000,crossedAt:null});
  const crest = riverAfter(start,0,wet,20_000);
  assert.deepEqual(crest,{level:180_000,crossedAt:17_500});
  assert.deepEqual(riverAfter(warning.level,10_000,wet,20_000),crest);
  assert.deepEqual(riverAfter(start,50,wet,49),{level:start,crossedAt:null});
  assert.equal(riverAfter(200_000,0,'sloneczna_pogoda',100_000).level,74_000);
  assert.equal(riverAfter(start,0,'sztorm_na_zatoce',100_000).crossedAt,null);
  assert.equal(riverAfter(180_000,0,wet,2000).crossedAt,null);
});
