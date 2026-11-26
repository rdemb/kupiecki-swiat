import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialKnightState } from './gameData.ts';
import {
  HERO_PATHS,
  HERO_PORTRAITS,
  RPG_ITEM_CATALOG,
  allocateHeroSkillPoint,
  computeDerivedHeroStats,
  equipHeroItem,
  rollLootDrop,
  unequipHeroSlot,
} from './heroProgression.ts';

test('Hero catalog provides 4 bespoke portraits, 4 development paths, and 12 RPG items (6 shop + 6 loot)', () => {
  assert.equal(HERO_PORTRAITS.length, 4);
  assert.equal(HERO_PATHS.length, 4);
  assert.equal(RPG_ITEM_CATALOG.length, 12);
  assert.equal(RPG_ITEM_CATALOG.filter((i) => i.source === 'shop').length, 6);
  assert.equal(RPG_ITEM_CATALOG.filter((i) => i.source === 'loot').length, 6);
  for (const p of HERO_PORTRAITS) {
    assert.ok(p.imageUrl.startsWith('/src/assets/images/'));
  }
  for (const item of RPG_ITEM_CATALOG) {
    assert.ok(item.imageUrl.startsWith('/src/assets/images/'));
  }
});

test('Equipping a new weapon replaces the old weapon slot cleanly without double-stacking stats', () => {
  let hero = createInitialKnightState('ludzie');
  const starterStats = computeDerivedHeroStats(hero);
  // Starter weapon item_sztylet_kupca gives +6 strength
  assert.equal(starterStats.effectiveStrength, hero.strength + 6);

  // Add a stronger weapon and equip it
  hero = {
    ...hero,
    ownedItemIds: [...hero.ownedItemIds, 'eq_ostrze_mithril'],
  };
  const upgraded = equipHeroItem(hero, 'eq_ostrze_mithril');
  const upgradedStats = computeDerivedHeroStats(upgraded);

  // Must equal base + 28 (NOT base + 6 + 28!)
  assert.equal(upgraded.equippedSlots.weapon, 'eq_ostrze_mithril');
  assert.equal(upgradedStats.effectiveStrength, hero.strength + 28);
  assert.equal(upgradedStats.arcaneBonusDmg, 10);

  // Unequipping restores pure base strength
  const barehanded = unequipHeroSlot(upgraded, 'weapon');
  const bareStats = computeDerivedHeroStats(barehanded);
  assert.equal(bareStats.effectiveStrength, hero.strength);
});

test('Multi-direction skill point allocation raises distinct combat, trade, arcane, and loot stats', () => {
  let hero = createInitialKnightState('ludzie');
  hero = { ...hero, skillPoints: 4 };

  hero = allocateHeroSkillPoint(hero, 'paladyn');
  hero = allocateHeroSkillPoint(hero, 'kupiec_magnat');
  hero = allocateHeroSkillPoint(hero, 'arcymag');
  hero = allocateHeroSkillPoint(hero, 'zwiadowca');

  assert.equal(hero.skillPoints, 0);
  const derived = computeDerivedHeroStats(hero);
  // Paladyn (+5 str, +4 def, +22 hp), Arcymag (+2 str, +8 arcane, +6 heal), Magnat (-4% fee, +12% gold, +2 tac), Zwiadowca (+5 tac, +10% loot, +0.06 speed)
  // Plus starter weapon (+6 str, +2 def, +3 tac)
  assert.equal(derived.effectiveStrength, hero.strength + 6 + 5 + 2);
  assert.equal(derived.effectiveDefense, hero.defense + 2 + 4);
  assert.equal(derived.effectiveTactics, hero.tactics + 3 + 2 + 5);
  assert.equal(derived.tradeFeeDiscountPct, 4);
  assert.equal(derived.goldLootBonusPct, 12);
  assert.equal(derived.arcaneBonusDmg, 8);
  assert.equal(derived.turnHealBonus, 6);
  assert.equal(derived.lootFindBonusPct, 10);
  assert.equal(derived.caravanSpeedBonus, 0.06);
});

test('Loot drop engine deterministically discovers unowned artifacts and converts duplicates into gold', () => {
  const firstDrop = rollLootDrop({
    source: 'scout',
    lootFindBonusPct: 40,
    ownedItemIds: ['item_sztylet_kupca'],
    seed: 12345,
  });

  assert.ok(firstDrop.foundItem !== null, 'Expected high-bonus scout roll to find a loot item');
  assert.equal(firstDrop.foundItem?.source, 'loot');
  assert.equal(firstDrop.isDuplicate, false);

  // When all 6 loot items are already owned, drop yields duplicate bonus gold
  const allLootIds = RPG_ITEM_CATALOG.filter((i) => i.source === 'loot').map((i) => i.id);
  const dupDrop = rollLootDrop({
    source: 'scout',
    lootFindBonusPct: 50,
    ownedItemIds: allLootIds,
    seed: 12345,
  });

  assert.equal(dupDrop.isDuplicate, true);
  assert.ok(dupDrop.duplicateBonusGold >= 480);
});
