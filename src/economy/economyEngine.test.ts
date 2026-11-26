import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateInventoryEquilibriumPrice,
  stepDynamicCommodityPrice,
  calculateDynamicAntiInflationTax,
  calculateStorageDemurrageCost,
  calculateMacroIndicators,
  generateOrderBook,
  calculateRegionalCityPrices,
  calculateCaravanQuote,
  COMMODITIES,
} from './economyEngine';

test('Inventory bonding curve increases price when inventory drops below target and lowers when surplus exists', () => {
  const basePrice = 100;
  const targetInv = 1000;
  const gamma = 0.7;

  const eqPrice = calculateInventoryEquilibriumPrice(basePrice, 1000, targetInv, gamma);
  const scarcityPrice = calculateInventoryEquilibriumPrice(basePrice, 400, targetInv, gamma);
  const surplusPrice = calculateInventoryEquilibriumPrice(basePrice, 2000, targetInv, gamma);

  assert.equal(eqPrice, 100);
  assert.ok(scarcityPrice > eqPrice, `Expected scarcityPrice (${scarcityPrice}) > eqPrice (${eqPrice})`);
  assert.ok(surplusPrice < eqPrice, `Expected surplusPrice (${surplusPrice}) < eqPrice (${eqPrice})`);
});

test('Kyle lambda order-flow impact pushes price up on net buying and down on net selling', () => {
  const baseParams = {
    currentPrice: 200,
    basePrice: 200,
    currentInventory: 1000,
    targetInventory: 1000,
    gamma: 0.65,
    kyleLambda: 0.2,
    theta: 0.1,
    averageVolume: 500,
    noiseShock: 0,
  };

  const afterBuy = stepDynamicCommodityPrice({ ...baseParams, netOrderFlow: 250 });
  const afterSell = stepDynamicCommodityPrice({ ...baseParams, netOrderFlow: -250 });

  assert.ok(afterBuy > 200, `Expected net buy to raise price above 200, got ${afterBuy}`);
  assert.ok(afterSell < 200, `Expected net sell to lower price below 200, got ${afterSell}`);
});

test('Anti-inflation dynamic Tobin tax scales up when money supply M(t) exceeds target M*', () => {
  const normalTax = calculateDynamicAntiInflationTax(1_000_000, 1_000_000, 1.5, 8.0);
  const inflatedTax = calculateDynamicAntiInflationTax(1_500_000, 1_000_000, 1.5, 8.0);

  assert.equal(normalTax, 1.5);
  assert.equal(inflatedTax, 5.5); // 1.5 + 8.0 * 0.5 = 5.5%
  assert.ok(inflatedTax > normalTax);
});

test('Progressive storage demurrage charges zero below free capacity and scales super-linearly above', () => {
  assert.equal(calculateStorageDemurrageCost(120, 150, 0.2), 0);
  const cost250 = calculateStorageDemurrageCost(250, 150, 0.2); // 100 taxable
  const cost350 = calculateStorageDemurrageCost(350, 150, 0.2); // 200 taxable
  assert.ok(cost250 > 0);
  assert.ok(cost350 > cost250 * 2, 'Super-linear exponent 1.25 must more than double cost when taxable stockpile doubles');
});

test('Macro indicators compute Laspeyres CPI, inflation rate, and Royal Mint stabilization bond yield', () => {
  const baselinePrices = Object.fromEntries(COMMODITIES.map((c) => [c.id, c.basePrice])) as any;
  const baseMacro = calculateMacroIndicators(baselinePrices, 1_000_000, 1_000_000);
  assert.equal(baseMacro.cpiIndex, 100);
  assert.equal(baseMacro.inflationRatePct, 0);

  const boomPrices = Object.fromEntries(COMMODITIES.map((c) => [c.id, c.basePrice * 1.25])) as any;
  const boomMacro = calculateMacroIndicators(boomPrices, 1_400_000, 1_000_000);
  assert.equal(boomMacro.cpiIndex, 125);
  assert.equal(boomMacro.inflationRatePct, 25);
  assert.ok(boomMacro.royalMintBondYieldPct > baseMacro.royalMintBondYieldPct);
});

test('Order book generator maintains bid < currentPrice < ask and respects tech spread reduction', () => {
  const obStandard = generateOrderBook(500, 500, 500, 0.03, 0);
  const obMerchantTech = generateOrderBook(500, 500, 500, 0.03, 0.4);

  assert.ok(obStandard.bidPrice < 500);
  assert.ok(obStandard.askPrice > 500);
  assert.equal(obStandard.bids.length, 6);
  assert.equal(obStandard.asks.length, 6);
  assert.ok(obMerchantTech.spreadPct < obStandard.spreadPct, 'Tech tree rebate must narrow bid-ask spread');
});

test('Caravan arbitrage quote rewards specialty-to-demand city routes and reduces ambush risk with escorts', () => {
  const cityPrices = calculateRegionalCityPrices('mithril', 600, 1);
  // Mithril is specialty of zelazna_kuznia (cheaper) and demanded by krolewska_przystan (dearer)
  const unescorted = calculateCaravanQuote({
    originCityId: 'zelazna_kuznia',
    destinationCityId: 'krolewska_przystan',
    commodityId: 'mithril',
    quantity: 20,
    escortLevel: 0,
    cityPrices,
  });
  const escorted = calculateCaravanQuote({
    originCityId: 'zelazna_kuznia',
    destinationCityId: 'krolewska_przystan',
    commodityId: 'mithril',
    quantity: 20,
    escortLevel: 3,
    cityPrices,
  });

  assert.ok(unescorted.sellUnit > unescorted.buyUnit);
  assert.ok(unescorted.expectedNetProfit > 0);
  assert.ok(escorted.effectiveAmbushRiskPct < unescorted.effectiveAmbushRiskPct);
});

test('Seasonal & world physics pricing raises mountain food prices in winter and increases transport cost uphill', () => {
  const summerPrices = calculateRegionalCityPrices('zboze', 24, 1, 'lato');
  const winterPrices = calculateRegionalCityPrices('zboze', 24, 1, 'zima');

  // Żelazna Kuźnia is at 1150m altitude; winter mountain pass friction raises grain price there
  assert.ok(
    winterPrices.zelazna_kuznia > summerPrices.zelazna_kuznia,
    `Expected winter grain in mountain city (${winterPrices.zelazna_kuznia}) > summer (${summerPrices.zelazna_kuznia})`,
  );

  const summerCaravan = calculateCaravanQuote({
    originCityId: 'krolewska_przystan',
    destinationCityId: 'zelazna_kuznia',
    commodityId: 'zboze',
    quantity: 30,
    escortLevel: 1,
    cityPrices: summerPrices,
    season: 'lato',
  });

  const winterCaravan = calculateCaravanQuote({
    originCityId: 'krolewska_przystan',
    destinationCityId: 'zelazna_kuznia',
    commodityId: 'zboze',
    quantity: 30,
    escortLevel: 1,
    cityPrices: winterPrices,
    season: 'zima',
  });

  assert.ok(summerCaravan.altitudeClimb > 1000, 'Expected uphill altitude climb > 1000m');
  assert.ok(winterCaravan.transportFee > summerCaravan.transportFee, 'Winter friction must increase transport fee');
  assert.ok(winterCaravan.durationSeconds > summerCaravan.durationSeconds, 'Winter snow must increase travel duration');
});

import { CITIES, SEASONS } from './economyEngine';
import { WORLD_CONTINENTS, WORLD_REGIONS, getTerrainHeight } from './worldMapData.ts';
import { pickRandomDisaster } from './worldDisasters';
import {
  ROYAL_SUPPLY_CONTRACTS,
  WORLD_ACHIEVEMENTS,
  calculateNobleRank,
  evaluateAchievementProgress,
} from './achievementsAndQuests.ts';

test('Expanded map retains old ports and adds six workshops across the eastern strait', () => {
  assert.equal(WORLD_CONTINENTS.length, 12);
  assert.equal(CITIES.length, 12, 'Expected 12 trade capitals across the 6 continents');
  assert.equal(WORLD_REGIONS.length, 78);
  const workshops=WORLD_REGIONS.filter(r=>r.continentId==='nowa_nadzieja');
  assert.equal(workshops.length,6);
  for(const {position2D:[x,z]} of workshops) assert.ok(x>310 && x<930 && getTerrainHeight(x,z)>1);

  const uplands=WORLD_REGIONS.filter(r=>r.continentId==='wzgorza_jarmarczne');
  assert.equal(uplands.length,12);
  for(const r of uplands){assert.ok(getTerrainHeight(...r.position2D)>1,r.name);assert.ok(r.atlasPercent.every(v=>v>0 && v<100));}
  const west=WORLD_REGIONS.filter(r=>r.continentId==='zachodnie_rozlewiska');
  assert.equal(west.length,10);
  for(const r of west){
    const [x,z]=r.position2D;
    assert.ok(x> -2790 && x < -310 && z> -930 && z<1550 && getTerrainHeight(x,z)>1,r.name);
    assert.deepEqual(r.atlasPercent,[(x+2790)/24.8,(z+930)/24.8]);
  }
  assert.ok(getTerrainHeight(-1395,325)<0,'Woda pomiędzy dwoma promowiskami');
  const south=WORLD_REGIONS.filter(r=>r.continentId==='poludniowe_trakty');
  assert.equal(south.length,9);
  for (const r of south) {
    const [x,z]=r.position2D;
    assert.ok(z>310 && z<1550 && getTerrainHeight(x,z)>1,r.name);
    assert.ok(Math.abs(r.atlasPercent[0]-(x+310)/24.8)<1e-9 && Math.abs(r.atlasPercent[1]-(z-310)/12.4)<1e-9);
  }
  const north=WORLD_REGIONS.filter(r=>r.continentId==='morze_wylin');
  assert.equal(north.length,8);
  for(const r of north) {
    const [x,z]=r.position2D;
    assert.ok(z < -310 && z > -930 && getTerrainHeight(x,z)>1,r.name);
    assert.deepEqual(r.atlasPercent,[(x+310)/24.8,(z+930)/6.2]);
  }
  const coast=WORLD_REGIONS.filter(r=>r.continentId==='kresy_nadziei');
  assert.equal(coast.length,7);
  for(const r of coast) {
    const [x,z]=r.position2D;
    assert.ok(x>930 && x<2170 && getTerrainHeight(x,z)>1,r.name);
    assert.deepEqual(r.atlasPercent,[(x-930)/12.4,(z+310)/6.2]);
  }

  const harborY = getTerrainHeight(4, 2); // Stary Kontynent — Królewska Przystań
  const mountainY = getTerrainHeight(-6, -56); // Stary Kontynent — Żelazna Kuźnia
  const solariaOasisY = getTerrainHeight(-64, 118); // Solaria — Oaza Al-Kharim
  const frostgardY = getTerrainHeight(-128, -118); // Frostheim — Frostgard
  const aetherisHarborY = getTerrainHeight(158, 18); // Aetheris — Jadeitowa Przystań
  const valgardY = getTerrainHeight(-168, 8); // Valoria — Valgard
  const obsidianY = getTerrainHeight(156, 148); // Archipelag Obsydianowy — Obsydianowa Cytadela
  const easternOceanStraitY = getTerrainHeight(115, 0); // Ocean between Stary Kontynent & Aetheris
  const westernOceanStraitY = getTerrainHeight(-124, 18); // Ocean between Stary Kontynent & Valoria
  const obsidianSeaChannelY = getTerrainHeight(156, 108); // Ocean channel before Obsidian Archipelago

  assert.ok(harborY > 1.0 && harborY < 6.5, `Expected Królewska Przystań on coastal plain, got ${harborY}`);
  assert.ok(mountainY > 10.0, `Expected Żelazna Kuźnia high in alpine mountains, got ${mountainY}`);
  assert.ok(solariaOasisY > 1.5, `Expected Oaza Al-Kharim above sea level, got ${solariaOasisY}`);
  assert.ok(frostgardY > 1.5, `Expected Frostgard above sea level, got ${frostgardY}`);
  assert.ok(aetherisHarborY > 1.5, `Expected Jadeitowa Przystań above sea level, got ${aetherisHarborY}`);
  assert.ok(valgardY > 1.5, `Expected Valgard above sea level, got ${valgardY}`);
  assert.ok(obsidianY > 1.5, `Expected Obsydianowa Cytadela above sea level, got ${obsidianY}`);
  assert.ok(easternOceanStraitY < -1.0, `Expected Eastern Ocean Strait underwater, got ${easternOceanStraitY}`);
  assert.ok(westernOceanStraitY < -0.5, `Expected Western Ocean Strait underwater, got ${westernOceanStraitY}`);
  assert.ok(obsidianSeaChannelY < -0.5, `Expected Obsidian Sea Channel underwater, got ${obsidianSeaChannelY}`);
});

test('4-Season physics orders caravan speed Lato > Jesien > Wiosna > Zima and disasters further slow travel', () => {
  assert.ok(SEASONS.lato.caravanSpeedMultiplier > SEASONS.jesien.caravanSpeedMultiplier);
  assert.ok(SEASONS.jesien.caravanSpeedMultiplier > SEASONS.wiosna.caravanSpeedMultiplier);
  assert.ok(SEASONS.wiosna.caravanSpeedMultiplier > SEASONS.zima.caravanSpeedMultiplier);
  assert.ok(SEASONS.jesien.availabilityMultiplier > SEASONS.zima.availabilityMultiplier);

  const cityPrices = calculateRegionalCityPrices('mithril', 560, 1, 'lato');
  const normalSummer = calculateCaravanQuote({
    originCityId: 'zelazna_kuznia',
    destinationCityId: 'valgard',
    commodityId: 'mithril',
    quantity: 10,
    escortLevel: 1,
    cityPrices,
    season: 'lato',
  });
  const disaster = pickRandomDisaster('lato', 15, 2);
  const disasterSummer = calculateCaravanQuote({
    originCityId: 'zelazna_kuznia',
    destinationCityId: 'valgard',
    commodityId: 'mithril',
    quantity: 10,
    escortLevel: 1,
    cityPrices,
    season: 'lato',
    activeDisaster: disaster,
  });

  assert.ok(
    disasterSummer.caravanSpeedMultiplier < normalSummer.caravanSpeedMultiplier,
    'Active disaster must reduce caravan speed multiplier',
  );
  assert.ok(
    disasterSummer.durationSeconds > normalSummer.durationSeconds,
    'Active disaster must extend caravan travel duration',
  );
});

test('Royal Supply Contracts, Achievements progress evaluation, and Noble Rank ladder scale monotonically', () => {
  assert.equal(ROYAL_SUPPLY_CONTRACTS.length, 5);
  assert.equal(WORLD_ACHIEVEMENTS.length, 8);

  const firstTradeAch = WORLD_ACHIEVEMENTS.find((a) => a.id === 'ach_first_trade')!;
  const locked = evaluateAchievementProgress(firstTradeAch, {
    tradesExecuted: 1,
    netWorth: 15000,
    monstersDefeated: 0,
    buildingLevels: 4,
    contractsCompleted: 0,
    unlockedTechs: 1,
    fleetGalleons: 1,
    chaptersCompleted: 0,
  });
  const unlocked = evaluateAchievementProgress(firstTradeAch, {
    tradesExecuted: 5,
    netWorth: 15000,
    monstersDefeated: 0,
    buildingLevels: 4,
    contractsCompleted: 0,
    unlockedTechs: 1,
    fleetGalleons: 1,
    chaptersCompleted: 0,
  });

  assert.equal(locked.unlocked, false);
  assert.equal(unlocked.unlocked, true);
  assert.equal(unlocked.pct, 100);

  const starterRank = calculateNobleRank({
    netWorth: 12000,
    prestigePoints: 50,
    monstersDefeated: 0,
    contractsCompleted: 0,
  });
  const emperorRank = calculateNobleRank({
    netWorth: 250000,
    prestigePoints: 1200,
    monstersDefeated: 10,
    contractsCompleted: 5,
  });

  assert.ok(emperorRank.tier > starterRank.tier, 'Higher prestige and wealth must advance Noble Rank tier');
  assert.equal(emperorRank.tier, 6);
  assert.equal(emperorRank.nextRankTitle, null);
});

import { calculateCityMarketSentiment } from './economyEngine';

test('City market sentiment mood gauge reflects anti-inflation macro pressure and city price premiums', () => {
  const makeMarkets = (priceMult: number, change24h: number) => {
    const out: any = {};
    for (const c of COMMODITIES) {
      const p = c.basePrice * priceMult;
      out[c.id] = {
        id: c.id,
        currentPrice: p,
        previousPrice: p,
        change24hPct: change24h,
        inventory: c.targetInventory,
        targetInventory: c.targetInventory,
        volume24h: 1000,
        netOrderFlow: 0,
        vwap: p,
        rsi14: 50,
        bollingerUpper: p * 1.05,
        bollingerLower: p * 0.95,
        bidPrice: p * 0.99,
        askPrice: p * 1.01,
        spreadPct: 2,
        seasonalTrendLabel: 'Test',
        cityPrices: calculateRegionalCityPrices(c.id, p, 1, 'lato'),
        citySurplusStock: { krolewska_przystan: 200, krwawy_szczyt: 40 },
        history: [],
        orderBook: { bids: [], asks: [] },
      };
    }
    return out;
  };

  const coolMacro: any = {
    moneySupplyM: 920_000,
    targetMoneySupplyMStar: 1_200_000,
    velocityV: 1.1,
    cpiIndex: 88,
    inflationRatePct: -12,
    dynamicTaxRatePct: 1.5,
    royalMintBondYieldPct: 4.0,
    totalGoldBurned: 95_000,
    totalGoldMinted: 100_000,
    storageDemurrageRate: 0.18,
    activeSeason: 'jesien',
    activeSeasonName: 'Jesień',
    activeSeasonDesc: '',
    activeWeather: 'sloneczna_pogoda',
    activeWeatherName: 'Słonecznie',
    activeWeatherEffect: '',
    worldDayNumber: 10,
    activeEventTitle: '',
    activeEventEffect: '',
    activeEventMultiplier: {},
  };

  const hotMacro: any = {
    ...coolMacro,
    moneySupplyM: 1_850_000,
    cpiIndex: 132,
    inflationRatePct: 32,
    dynamicTaxRatePct: 6.2,
    royalMintBondYieldPct: 19.5,
    totalGoldBurned: 12_000,
    totalGoldMinted: 180_000,
  };

  const coolReport = calculateCityMarketSentiment(
    'krolewska_przystan',
    makeMarkets(0.84, -4.5),
    coolMacro,
  );
  const hotReport = calculateCityMarketSentiment(
    'krwawy_szczyt',
    makeMarkets(1.32, 6.2),
    hotMacro,
  );

  assert.ok(coolReport.score < 42, `Expected cool deflationary score < 42, got ${coolReport.score}`);
  assert.ok(hotReport.score >= 80, `Expected overheated score >= 80, got ${hotReport.score}`);
  assert.equal(hotReport.moodId, 'overheated');
  assert.ok(hotReport.inflationPressure > coolReport.inflationPressure);
  assert.ok(hotReport.moneySupplyRatio > 1.5);
});



