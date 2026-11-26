import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_DISASTERS,
  getDisasterCaravanSpeedMultiplier,
  getDisasterPriceMultiplier,
  getDisasterTemplateById,
  pickRandomDisaster,
  resolveDisasterMitigation,
} from './worldDisasters';
import type { CommodityId } from './economyEngine';

const BASE_INVENTORY: Record<CommodityId, number> = {
  zboze: 50,
  zelazo: 40,
  drewno_elfickie: 30,
  przyprawy: 20,
  runiczny_pergamin: 15,
  krysztaly_many: 15,
  mithril: 10,
  smocza_luska: 5,
};

test('WORLD_DISASTERS defines 6 seasonal catastrophes with price shocks and caravan speed penalties', () => {
  assert.equal(WORLD_DISASTERS.length, 6);
  const winterDisaster = pickRandomDisaster('zima', 30, 7);
  assert.ok(
    getDisasterTemplateById(winterDisaster.templateId).preferredSeasons.includes('zima'),
    'Picked winter disaster must prefer zima season',
  );
  assert.ok(winterDisaster.caravanSpeedMultiplier < 1.0);
  assert.ok(winterDisaster.supplyShockMultiplier < 1.0);
});

test('Disaster price and caravan speed multipliers respond accurately to active catastrophe', () => {
  const eruption = pickRandomDisaster('lato', 20, 0);
  // Explicitly build an eruption instance for deterministic checks
  const tpl = getDisasterTemplateById('erupcja_wulkanu');
  const active = {
    ...eruption,
    templateId: tpl.id,
    continentId: tpl.continentId,
    caravanSpeedMultiplier: tpl.caravanSpeedMultiplier,
    priceMultipliers: { ...tpl.priceMultipliers },
  };

  assert.equal(getDisasterPriceMultiplier(active, 'smocza_luska'), 1.38);
  assert.equal(getDisasterPriceMultiplier(active, 'zboze'), 1.0);
  assert.equal(getDisasterPriceMultiplier(null, 'smocza_luska'), 1.0);

  const localSpeed = getDisasterCaravanSpeedMultiplier(active, ['obsydian_wulkan']);
  const distantSpeed = getDisasterCaravanSpeedMultiplier(active, ['frostheim_polnoc']);
  assert.ok(localSpeed < distantSpeed, 'Local continent must suffer sharper speed penalty than distant continent');
  assert.ok(distantSpeed < 1.0, 'Global ripple still mildly slows distant caravans');
});

test('Disaster mitigation validates resources, grants dragon bonus, and clears catastrophe immediately', () => {
  const tpl = getDisasterTemplateById('erupcja_wulkanu');
  const disaster = {
    instanceId: 'dis_test_1',
    templateId: tpl.id,
    title: tpl.title,
    shortLabel: tpl.shortLabel,
    continentId: tpl.continentId,
    atmosphereMode: tpl.atmosphereMode,
    severityLabel: tpl.severityLabel,
    accentHex: tpl.accentHex,
    description: tpl.description,
    economicImpactSummary: tpl.economicImpactSummary,
    caravanSpeedMultiplier: tpl.caravanSpeedMultiplier,
    supplyShockMultiplier: tpl.supplyShockMultiplier,
    priceMultipliers: { ...tpl.priceMultipliers },
    remainingTicks: 10,
    totalTicks: 10,
    startedAtDay: 14,
    mitigatedByPlayer: false,
  };

  const poorAttempt = resolveDisasterMitigation({
    disaster,
    optionId: 'dragon_caldera_tame',
    playerGold: 100,
    playerInventory: BASE_INVENTORY,
    hasDragonBonus: true,
  });
  assert.equal(poorAttempt.success, false);
  assert.ok(poorAttempt.errorMessage);

  const withoutDragon = resolveDisasterMitigation({
    disaster,
    optionId: 'dragon_caldera_tame',
    playerGold: 5000,
    playerInventory: BASE_INVENTORY,
    hasDragonBonus: false,
  });
  const withDragon = resolveDisasterMitigation({
    disaster,
    optionId: 'dragon_caldera_tame',
    playerGold: 5000,
    playerInventory: BASE_INVENTORY,
    hasDragonBonus: true,
  });

  assert.equal(withDragon.success, true);
  assert.equal(withDragon.nextDisaster, null, 'Immediate clearing option must remove active disaster');
  assert.ok(withDragon.goldDelta > withoutDragon.goldDelta, 'Dragon companion must boost gold reward');
  assert.ok(withDragon.prestigeDelta > withoutDragon.prestigeDelta);
  assert.equal(withDragon.rewardCommodity?.id, 'mithril');
});
