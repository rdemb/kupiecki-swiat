import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAGON_SPECIES,
  computeDragonGlobalBonuses,
  createInitialDragonSanctuary,
  dispatchDragonMission,
  feedAndTrainDragon,
  incubateOrHatchEgg,
  purchaseOrBreedDragonEgg,
  stageForDragonXp,
} from './dragonBreeding';
import type { CommodityId } from './economyEngine';

const TEST_INVENTORY: Record<CommodityId, number> = {
  zboze: 80,
  zelazo: 40,
  drewno_elfickie: 30,
  przyprawy: 25,
  runiczny_pergamin: 15,
  krysztaly_many: 15,
  mithril: 12,
  smocza_luska: 6,
};

test('Dragon Sanctuary initializes with starter Fire Dragon, incubating Frost Egg, and positive global bonuses', () => {
  const s = createInitialDragonSanctuary();
  assert.equal(s.dragons.length, 1);
  assert.equal(s.eggs.length, 1);
  assert.equal(Object.keys(DRAGON_SPECIES).length, 14);

  const bonuses = computeDragonGlobalBonuses(s);
  assert.ok(bonuses.knightAttackBonus > 0);
  assert.ok(bonuses.caravanSpeedBonusPct > 0);
  assert.ok(bonuses.duchyIncomeBonusPct > 0);
  assert.ok(bonuses.disasterResistancePct > 0);
  assert.equal(bonuses.activeSpecies, 'ogien');
});

test('Incubating starter egg hatches a second dragon and enables cross-breeding Generation 2 eggs', () => {
  const s0 = createInitialDragonSanctuary();
  const starterEggId = s0.eggs[0].id;
  // Starter egg starts at 60%, +40% reaches 100% and hatches immediately
  const hatchRes = incubateOrHatchEgg({
    sanctuary: s0,
    eggId: starterEggId,
    playerGold: 5000,
  });

  assert.equal(hatchRes.success, true);
  assert.ok(hatchRes.hatchedDragon, 'Expected starter egg to hatch into a Frost Dragon');
  assert.equal(hatchRes.nextSanctuary.dragons.length, 2);
  assert.equal(hatchRes.nextSanctuary.eggs.length, 0);

  // Now cross-breeding should succeed and produce Generation 2 egg
  const breedRes = purchaseOrBreedDragonEgg({
    sanctuary: hatchRes.nextSanctuary,
    speciesId: 'zloto',
    playerGold: 5000,
    isCrossBreed: true,
  });

  assert.equal(breedRes.success, true);
  assert.equal(breedRes.nextSanctuary.eggs.length, 1);
  assert.equal(breedRes.nextSanctuary.eggs[0].generation, 2);
  assert.equal(breedRes.nextSanctuary.eggs[0].rarityLabel, 'Królewska Hybryda');
});

test('Feeding dragon grants XP, evolves stage across thresholds, and aerial missions award gold & commodities', () => {
  let sanctuary = createInitialDragonSanctuary();
  const dragonId = sanctuary.dragons[0].id;

  assert.equal(stageForDragonXp(0), 1);
  assert.equal(stageForDragonXp(260), 3);
  assert.equal(stageForDragonXp(820), 5);

  // Feed twice with favorite commodity (+95 XP each: 120 -> 215 -> 310 => evolves to Stage 3!)
  const feed1 = feedAndTrainDragon({
    sanctuary,
    dragonId,
    feedMode: 'favorite_commodity',
    playerGold: 5000,
    playerInventory: TEST_INVENTORY,
  });
  assert.equal(feed1.success, true);
  sanctuary = feed1.nextSanctuary;

  const feed2 = feedAndTrainDragon({
    sanctuary,
    dragonId,
    feedMode: 'favorite_commodity',
    playerGold: 5000,
    playerInventory: TEST_INVENTORY,
  });
  assert.equal(feed2.success, true);
  assert.equal(feed2.evolvedToStage, 3);
  sanctuary = feed2.nextSanctuary;

  // Dispatch elite Stage 3 aerial mission
  const missionRes = dispatchDragonMission({
    sanctuary,
    dragonId,
    missionId: 'polowanie_lusek',
  });
  assert.equal(missionRes.success, true);
  assert.ok(missionRes.rewardGold >= 2600);
  assert.equal(missionRes.rewardCommodity?.id, 'smocza_luska');
  assert.ok(missionRes.nextSanctuary.dragons[0].energy < 100);
});

test('Coastal eggs hatch into companions with distinct travel and weather bonuses', () => {
  for (const speciesId of ['pseudosmok', 'blekit','dwuglowy','brazowy','dwuglowy_czerwony','dwuglowy_brazowy'] as const) {
    const bought = purchaseOrBreedDragonEgg({
      sanctuary: createInitialDragonSanctuary(), speciesId, playerGold: 100000, isCrossBreed: false,
    });
    assert.ok(bought.success);
    const egg = bought.nextSanctuary.eggs.find(e => e.speciesId === speciesId)!;
    const warm = incubateOrHatchEgg({ sanctuary: bought.nextSanctuary, eggId: egg.id, playerGold: 5000 });
    const hatch = incubateOrHatchEgg({ sanctuary: warm.nextSanctuary, eggId: egg.id, playerGold: 5000 });
    assert.equal(hatch.hatchedDragon?.speciesId, speciesId);
    const dragon = hatch.hatchedDragon!;
    const party = { ...hatch.nextSanctuary, activeCompanionId: dragon.id };
    const bonus = computeDragonGlobalBonuses(party);
    const neutral = computeDragonGlobalBonuses({
      ...party, dragons: party.dragons.map(d => d.id === dragon.id ? { ...d, speciesId: 'ogien' } : d),
    });
    assert.equal(bonus.knightAttackBonus-neutral.knightAttackBonus,speciesId==='dwuglowy_czerwony'?7:0);
    assert.equal(bonus.duchyIncomeBonusPct-neutral.duchyIncomeBonusPct,speciesId==='dwuglowy_brazowy'?6:0);
    assert.equal(bonus.caravanSpeedBonusPct - neutral.caravanSpeedBonusPct, speciesId === 'pseudosmok' ? 4 : speciesId === 'dwuglowy' ? 5 : 0);
    assert.equal(bonus.disasterResistancePct - neutral.disasterResistancePct, speciesId === 'blekit' ? 8 : speciesId === 'brazowy' ? 5 : 0);
  }
});

test('Smoki z rozlewisk wykluwają się i korzystają z własnych zdolności na misjach',()=>{
  for(const speciesId of ['trzcinowy','krzemienny'] as const){
    const bought=purchaseOrBreedDragonEgg({sanctuary:createInitialDragonSanctuary(),speciesId,playerGold:100000});
    assert.ok(bought.success);
    const egg=bought.nextSanctuary.eggs.at(-1)!;
    const warm=incubateOrHatchEgg({sanctuary:bought.nextSanctuary,eggId:egg.id,playerGold:5000});
    const hatch=incubateOrHatchEgg({sanctuary:warm.nextSanctuary,eggId:egg.id,playerGold:5000});
    const dragon=hatch.hatchedDragon!;
    assert.equal(dragon.speciesId,speciesId);
    const fly=(energy:number)=>dispatchDragonMission({
      sanctuary:{...hatch.nextSanctuary,dragons:[{...dragon,stage:3,energy}]},dragonId:dragon.id,
      missionId:speciesId==='trzcinowy'?'zwiad_skarbca':'polowanie_lusek',
    });
    if(speciesId==='trzcinowy'){
      assert.equal(fly(16).success,false);
      assert.equal(fly(17).nextSanctuary.dragons[0].energy,0);
    }else assert.deepEqual(fly(100).rewardCommodity,{id:'smocza_luska',qty:3});
  }
});

test('Legendarne linie wymagają dorosłego przodka i mają odrębne skutki na wyprawie',()=>{
  for(const speciesId of ['blekitny_legendarny','zloty_legendarny'] as const){
    const base=createInitialDragonSanctuary();
    const parent=speciesId==='blekitny_legendarny'?'blekit':'zloto';
    const buy=()=>purchaseOrBreedDragonEgg({sanctuary:base,speciesId,playerGold:9000});
    assert.equal(buy().success,false);
    base.dragons[0]={...base.dragons[0],speciesId:parent,stage:3};
    const bought=buy();assert.ok(bought.success);
    const egg=bought.nextSanctuary.eggs.at(-1)!;
    const warm=incubateOrHatchEgg({sanctuary:bought.nextSanctuary,eggId:egg.id,playerGold:1000});
    const hatch=incubateOrHatchEgg({sanctuary:warm.nextSanctuary,eggId:egg.id,playerGold:1000});
    const dragon=hatch.hatchedDragon!;assert.equal(dragon.speciesId,speciesId);
    const fly=(energy:number)=>dispatchDragonMission({sanctuary:{...base,dragons:[{...dragon,stage:2,energy}]},dragonId:dragon.id,
      missionId:speciesId==='blekitny_legendarny'?'eskorta_powietrzna':'zwiad_skarbca'});
    if(speciesId==='blekitny_legendarny'){
      assert.equal(fly(22).success,false);assert.equal(fly(23).nextSanctuary.dragons[0].energy,0);
    } else assert.deepEqual(fly(100).rewardCommodity,{id:'runiczny_pergamin',qty:5});
  }
});
