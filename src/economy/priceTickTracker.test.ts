import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CommodityPriceTick,
  computePriceTickMap,
  formatLiveTickDelta,
} from './priceTickTracker';
import { CommodityId } from './economyEngine';

const basePrices: Record<CommodityId, number> = {
  zboze: 24.0,
  zelazo: 56.0,
  drewno_elfickie: 82.0,
  mithril: 320.0,
  przyprawy: 145.0,
  runiczny_pergamin: 112.0,
  krysztaly_many: 260.0,
  smocza_luska: 540.0,
};

test('computePriceTickMap initializes neutral baseline and detects up/down ticks accurately', () => {
  const initTicks = computePriceTickMap({
    prevPrices: null,
    nextPrices: basePrices,
    prevTicks: {},
    cityChanged: false,
  });

  assert.equal(initTicks.zboze?.direction, 'neutral');
  assert.equal(initTicks.zboze?.tickId, 0);

  const nextPrices: Record<CommodityId, number> = {
    ...basePrices,
    zboze: 25.5,
    mithril: 312.25,
    zelazo: 56.001, // below threshold -> unchanged
  };

  const updated = computePriceTickMap({
    prevPrices: basePrices,
    nextPrices,
    prevTicks: initTicks,
    cityChanged: false,
  });

  assert.equal(updated.zboze?.direction, 'up');
  assert.equal(updated.zboze?.delta, 1.5);
  assert.equal(updated.zboze?.tickId, 1);
  assert.ok((updated.zboze?.deltaPct ?? 0) > 6.0);

  assert.equal(updated.mithril?.direction, 'down');
  assert.equal(updated.mithril?.delta, -7.75);
  assert.equal(updated.mithril?.tickId, 1);
  assert.ok((updated.mithril?.deltaPct ?? 0) < -2.0);

  assert.equal(updated.zelazo?.direction, 'neutral');
  assert.equal(updated.zelazo?.tickId, 0);
});

test('computePriceTickMap resets direction to neutral on city switch without false tick bursts', () => {
  const prevTicks: Partial<Record<CommodityId, CommodityPriceTick>> = {
    zboze: {
      direction: 'up',
      delta: 2.0,
      deltaPct: 8.33,
      tickId: 3,
      previousPrice: 24,
      currentPrice: 26,
    },
  };

  const switched = computePriceTickMap({
    prevPrices: basePrices,
    nextPrices: { ...basePrices, zboze: 31.4 },
    prevTicks,
    cityChanged: true,
  });

  assert.equal(switched.zboze?.direction, 'neutral');
  assert.equal(switched.zboze?.delta, 0);
  assert.equal(switched.zboze?.tickId, 3, 'Should not bump tickId when switching cities');
});

test('formatLiveTickDelta pairs explicit directional arrows with signed values for accessible feedback', () => {
  const upFmt = formatLiveTickDelta({
    direction: 'up',
    delta: 1.45,
    deltaPct: 2.1,
    tickId: 2,
    previousPrice: 68.55,
    currentPrice: 70.0,
  });
  assert.equal(upFmt.isActive, true);
  assert.equal(upFmt.arrow, '▲');
  assert.equal(upFmt.signedText, '+1.45 zł');

  const downFmt = formatLiveTickDelta({
    direction: 'down',
    delta: -3.2,
    deltaPct: -1.5,
    tickId: 4,
    previousPrice: 213.2,
    currentPrice: 210.0,
  });
  assert.equal(downFmt.isActive, true);
  assert.equal(downFmt.arrow, '▼');
  assert.equal(downFmt.signedText, '-3.20 zł');

  const neutralFmt = formatLiveTickDelta({
    direction: 'neutral',
    delta: 0,
    deltaPct: 0,
    tickId: 0,
    previousPrice: 50,
    currentPrice: 50,
  });
  assert.equal(neutralFmt.isActive, false);
  assert.equal(neutralFmt.arrow, '');
});
