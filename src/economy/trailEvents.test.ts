import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAIL_EVENT_TEMPLATES,
  generateTrailEventsForWorld,
  resolveTrailEventChoice,
} from './trailEvents';
import {
  PBR_WEATHER_LIST,
  getPbrWeatherParams,
  getRecommendedWeatherForSeasonAndContinent,
  getWeatherTradeModifiers,
} from '../world3d/pbrWeather';

test('generateTrailEventsForWorld spawns 4 diverse continental events weighted by time of day & weather', () => {
  const dayEvents = generateTrailEventsForWorld({
    lightingMood: 'midday',
    pbrWeather: 'clear',
    season: 'lato',
    seed: 1,
    count: 4,
  });

  assert.equal(dayEvents.length, 4);
  const uniqueContinents = new Set(dayEvents.map((e) => e.continentId));
  assert.ok(uniqueContinents.size >= 3, 'Should cover at least 3 distinct continents');
  assert.ok(
    dayEvents.some((e) => e.category === 'caravan_meeting'),
    'Daytime clear weather should spawn at least one caravan meeting',
  );

  const nightStormEvents = generateTrailEventsForWorld({
    lightingMood: 'night',
    pbrWeather: 'storm',
    season: 'jesien',
    seed: 2,
    count: 4,
  });

  assert.equal(nightStormEvents.length, 4);
  assert.ok(
    nightStormEvents.some((e) => e.category === 'monster_blockade'),
    'Nighttime storm should spawn monster blockades on trails',
  );
  for (const ev of nightStormEvents) {
    assert.equal(ev.spawnedAtTime, 'night');
    assert.equal(ev.spawnedAtWeather, 'storm');
    assert.ok(ev.choices.some((c) => c.kind === 'bypass'), 'Every trail event must allow bypassing');
  }
});

test('resolveTrailEventChoice resolves trade interaction, insufficient gold guard, monster combat, and bypass', () => {
  const caravanTpl = TRAIL_EVENT_TEMPLATES.find((t) => t.templateId === 'evt_karawana_przystan')!;
  const caravanEvent = {
    ...caravanTpl,
    id: 'test_caravan_1',
    spawnedAtTime: 'midday' as const,
    spawnedAtWeather: 'clear' as const,
  };

  // Insufficient gold guard
  const poorOutcome = resolveTrailEventChoice(caravanEvent, 'trade_caravan', {
    playerGold: 100,
    knightStrength: 20,
    knightDefense: 15,
  });
  assert.equal(poorOutcome.success, false);
  assert.equal(poorOutcome.goldDelta, 0);

  // Successful interaction
  const tradeOutcome = resolveTrailEventChoice(caravanEvent, 'trade_caravan', {
    playerGold: 2000,
    knightStrength: 20,
    knightDefense: 15,
  });
  assert.equal(tradeOutcome.success, true);
  assert.equal(tradeOutcome.bypassed, false);
  assert.equal(tradeOutcome.goldDelta, -450);
  assert.equal(tradeOutcome.commodityDelta?.id, 'drewno_elfickie');
  assert.equal(tradeOutcome.commodityDelta?.qty, 8);

  // Bypass choice
  const bypassOutcome = resolveTrailEventChoice(caravanEvent, 'bypass', {
    playerGold: 2000,
    knightStrength: 20,
    knightDefense: 15,
  });
  assert.equal(bypassOutcome.success, true);
  assert.equal(bypassOutcome.bypassed, true);
  assert.equal(bypassOutcome.knightHpDelta, 0);

  // Monster blockade combat
  const blockadeTpl = TRAIL_EVENT_TEMPLATES.find((t) => t.category === 'monster_blockade')!;
  const blockadeEvent = {
    ...blockadeTpl,
    id: 'test_blockade_1',
    spawnedAtTime: 'night' as const,
    spawnedAtWeather: 'storm' as const,
  };
  const fightOutcome = resolveTrailEventChoice(blockadeEvent, 'fight_blockade', {
    playerGold: 2000,
    knightStrength: 60,
    knightDefense: 40,
  });
  assert.equal(fightOutcome.success, true);
  assert.equal(fightOutcome.monstersDefeatedDelta, 1);
  assert.ok(fightOutcome.goldDelta > 0);
  assert.ok(fightOutcome.knightHpDelta < 0);
});

test('PBR Weather presets expose physically coherent wetness, snow, dust, fog, and trade modifiers', () => {
  assert.equal(PBR_WEATHER_LIST.length, 6);

  const storm = getPbrWeatherParams('storm');
  assert.equal(storm.wetness, 1.0);
  assert.ok(storm.lightningChance > 0);
  assert.ok(storm.waveChoppiness > 2.0);
  assert.equal(storm.particleType, 'rain');

  const blizzard = getPbrWeatherParams('blizzard');
  assert.ok(blizzard.snowAccumulation > 0.8);
  assert.equal(blizzard.particleType, 'snow');

  const sandstorm = getPbrWeatherParams('sandstorm');
  assert.ok(sandstorm.dustCoat > 0.7);
  assert.equal(sandstorm.particleType, 'sand');

  assert.equal(getRecommendedWeatherForSeasonAndContinent('zima', 'stary_kontynent'), 'blizzard');
  assert.equal(getRecommendedWeatherForSeasonAndContinent('lato', 'solaria_poludnie'), 'sandstorm');
  assert.equal(getRecommendedWeatherForSeasonAndContinent('lato', 'aetheris_wschod'), 'fog');

  const stormTrade = getWeatherTradeModifiers('storm');
  assert.ok(stormTrade.speedMultiplier < 1.0);
  assert.ok(stormTrade.ambushRiskDeltaPct > 0);
});
