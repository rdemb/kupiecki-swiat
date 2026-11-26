import test from 'node:test';
import assert from 'node:assert/strict';
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
