import type { KnightState, MonsterQuestSpec } from './gameData';
import { computeDerivedHeroStats, rollLootDrop } from './heroProgression';
export type Stance = 'aggressive' | 'balanced' | 'defensive';
export function resolveQuestTurn(
  currentKnight: KnightState,
  questSpec: MonsterQuestSpec,
  tactic: Stance,
  isFirstTurn: boolean,
  escortBonus: number,
  dragonAttack: number,
  now: number,
): {
  outcome: 'march' | 'victory' | 'retreat';
  gold: number;
  goods: MonsterQuestSpec['rewardCommodities'];
  notice: readonly [string, string] | null;
  knight: KnightState;
} {
  const derived = computeDerivedHeroStats(currentKnight);
  const activeQ = isFirstTurn
    ? {
        questId: questSpec.id,
        currentStep: 1,
        totalSteps: questSpec.turnsRequired,
        monsterCurrentHp: questSpec.monsterMaxHp,
        monsterMaxHp: questSpec.monsterMaxHp,
        combatLogs: [`[Wyprawa rozpoczęta] ${currentKnight.name} wkracza do: ${questSpec.name}!`],
        status: 'in_progress' as const,
      }
    : currentKnight.activeQuest!;

  const stanceAtkMult = tactic === 'aggressive' ? 1.3 : tactic === 'defensive' ? 0.85 : 1.05;
  const stanceDefMult = tactic === 'defensive' ? 1.35 : tactic === 'aggressive' ? 0.8 : 1.0;

  const critBonus = 1 + derived.effectiveTactics * 0.008 + escortBonus * 0.35;
  const rawPlayerDmg =
    derived.effectiveStrength * 1.45 * stanceAtkMult * critBonus +
    derived.arcaneBonusDmg +
    dragonAttack -
    questSpec.monsterDefense * 0.35;
  const playerDmg = Math.max(12, Math.round(rawPlayerDmg));

  const nextMonsterHp = Math.max(0, activeQ.monsterCurrentHp - playerDmg);

  const rawMonsterDmg =
    questSpec.monsterAttack * 0.75 - derived.effectiveDefense * 0.55 * stanceDefMult;
  const monsterDmg = nextMonsterHp === 0 ? 0 : Math.max(6, Math.round(rawMonsterDmg));

  const healAfterTurn = 6 + derived.turnHealBonus;
  const nextKnightHp = Math.max(
    15,
    Math.min(derived.effectiveMaxHp, currentKnight.hp - monsterDmg + healAfterTurn),
  );

  const turnLog = `Tura ${activeQ.currentStep}/${activeQ.totalSteps}: ${currentKnight.name} zadaje ${playerDmg} obr.${
    derived.arcaneBonusDmg > 0 ? ` (w tym +${derived.arcaneBonusDmg} runicznych)` : ''
  }! ${
    monsterDmg > 0 ? `${questSpec.monsterName} kontratakuje za ${monsterDmg} HP.` : 'Wróg powalony!'
  }`;

  const isVictory = nextMonsterHp <= 0;
  const isOutOfTurnsRetreat = !isVictory && activeQ.currentStep >= activeQ.totalSteps;

  if (isVictory) {
    const goldReward = Math.round(questSpec.rewardGold * (1 + derived.goldLootBonusPct / 100));
    const drop = rollLootDrop({
      source: 'quest',
      lootFindBonusPct: derived.lootFindBonusPct,
      ownedItemIds: currentKnight.ownedItemIds ?? [],
      seed: now + currentKnight.monstersDefeated * 53,
    });
    const totalXp = currentKnight.xp + questSpec.rewardXp;
    const leveledUp = totalXp >= currentKnight.xpToNextLevel;
    const nextLvl = leveledUp ? currentKnight.level + 1 : currentKnight.level;
    const nextBaseMaxHp = leveledUp ? currentKnight.maxHp + 30 : currentKnight.maxHp;

    const notice = [
      `Zwycięstwo: ${questSpec.name}!`,
      `Pokonano ${questSpec.monsterName}! +${goldReward} zł, surowce${
        drop.foundItem && !drop.isDuplicate ? ` oraz artefakt ${drop.foundItem.name}!` : '.'
      }`,
    ] as const;

    const nextOwned =
      drop.foundItem && !drop.isDuplicate
        ? [...(currentKnight.ownedItemIds ?? []), drop.foundItem.id]
        : (currentKnight.ownedItemIds ?? []);

    const updatedWinner: KnightState = {
      ...currentKnight,
      level: nextLvl,
      xp: leveledUp ? totalXp - currentKnight.xpToNextLevel : totalXp,
      xpToNextLevel: leveledUp
        ? Math.round(currentKnight.xpToNextLevel * 1.35)
        : currentKnight.xpToNextLevel,
      maxHp: nextBaseMaxHp,
      strength: leveledUp ? currentKnight.strength + 4 : currentKnight.strength,
      defense: leveledUp ? currentKnight.defense + 3 : currentKnight.defense,
      tactics: leveledUp ? currentKnight.tactics + 3 : currentKnight.tactics,
      skillPoints: (currentKnight.skillPoints ?? 0) + (leveledUp ? 1 : 0),
      availableTurns: Math.max(0, currentKnight.availableTurns - 1),
      monstersDefeated: currentKnight.monstersDefeated + 1,
      totalLootGold: currentKnight.totalLootGold + goldReward,
      ownedItemIds: nextOwned,
      recentLootLog: [
        `Pokonano ${questSpec.monsterName}: +${goldReward} zł. ${drop.narrative}`,
        ...(currentKnight.recentLootLog ?? []).slice(0, 14),
      ],
      activeQuest: null,
    };
    const winnerDerived = computeDerivedHeroStats(updatedWinner);
    return {
      outcome: 'victory',
      gold: goldReward + drop.duplicateBonusGold,
      goods: questSpec.rewardCommodities,
      notice,
      knight: {
        ...updatedWinner,
        hp: leveledUp ? winnerDerived.effectiveMaxHp : nextKnightHp,
      },
    };
  }

  if (isOutOfTurnsRetreat) {
    const partialXp = Math.round(questSpec.rewardXp * 0.3);
    const notice = [
      `Taktyczny Odwrót: ${questSpec.name}`,
      `${questSpec.monsterName} przetrwał z ${nextMonsterHp} HP! Zdobyto +${partialXp} XP — wzmocnij ekwipunek lub ścieżkę rozwoju i wróć.`,
    ] as const;
    return {
      outcome: 'retreat',
      gold: 0,
      goods: [],
      notice,
      knight: {
        ...currentKnight,
        xp: currentKnight.xp + partialXp,
        hp: nextKnightHp,
        availableTurns: Math.max(0, currentKnight.availableTurns - 1),
        recentLootLog: [
          `Taktyczny odwrót z ${questSpec.name} (wróg miał ${nextMonsterHp} HP, +${partialXp} XP).`,
          ...(currentKnight.recentLootLog ?? []).slice(0, 14),
        ],
        activeQuest: null,
      },
    };
  }

  return {
    outcome: 'march',
    gold: 0,
    goods: [],
    notice: null,
    knight: {
      ...currentKnight,
      hp: nextKnightHp,
      availableTurns: Math.max(0, currentKnight.availableTurns - 1),
      activeQuest: {
        ...activeQ,
        currentStep: activeQ.currentStep + 1,
        monsterCurrentHp: nextMonsterHp,
        combatLogs: [turnLog, ...activeQ.combatLogs],
      },
    },
  };
}
