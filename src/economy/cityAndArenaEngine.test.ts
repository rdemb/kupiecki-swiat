import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CITIES } from './economyEngine';
import type { LeaderboardEntry } from './gameData';
import {
  ARENA_MOVES,
  CITY_ARENA_CHAMPIONS,
  CITY_INTERIOR_SPECS,
  buildArenaOpponentsForCity,
  getCityInteriorSpec,
  initArenaDuel,
  resolveArenaTurn,
  type ArenaCombatantStats,
} from './cityAndArenaEngine';

const SAMPLE_PLAYER: ArenaCombatantStats = {
  name: 'Sir Roland Kupiecki',
  title: 'Paladyn Hanzy',
  level: 3,
  portraitUrl: '/src/assets/images/hero_paladin_portrait_1795671865906.jpg',
  bannerHex: '#D4AF37',
  maxHp: 180,
  strength: 30,
  defense: 18,
  tactics: 20,
  arcaneBonusDmg: 10,
};

const SAMPLE_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    name: 'Wielki Syndyk Vonelor',
    race: 'Ludzie',
    guildTag: '[ZŁOTO]',
    netWorth: 94200,
    knightLevel: 7,
    monstersDefeated: 19,
    winRatePct: 86,
    specialty: 'Magnat Mithrilu',
  },
  {
    rank: 2,
    name: 'Lord Kupiecki',
    race: 'Ludzie',
    guildTag: '[ZŁOTO]',
    netWorth: 26500,
    knightLevel: 3,
    monstersDefeated: 4,
    winRatePct: 75,
    specialty: 'Kupiec',
    isPlayer: true,
  },
  {
    rank: 3,
    name: 'Arcymag Elandor',
    race: 'Elfy',
    guildTag: '[RUNA]',
    netWorth: 76450,
    knightLevel: 6,
    monstersDefeated: 14,
    winRatePct: 82,
    specialty: 'Kupiec Kryształów',
  },
];

describe('City Interiors catalog for every trade capital', () => {
  it('defines a bespoke interior spec, 5 hotspots, and a unique Arena Champion for every city', () => {
    assert.equal(CITIES.length, 18);
    for (const city of CITIES) {
      const spec = CITY_INTERIOR_SPECS[city.id];
      assert.ok(spec, `Missing city interior spec for ${city.id}`);
      const artRoot = spec.backdropUrl.startsWith('/cinema/') ? 'public' : '.';
      assert.ok(existsSync(artRoot + spec.backdropUrl), `Missing backdrop for ${city.id}`);
      assert.equal(spec.hotspots.length, 5, `Expected 5 hotspots in ${city.id}`);
      assert.ok(spec.hotspots.some((h) => h.id === 'arena'), `Missing arena hotspot in ${city.id}`);
      assert.ok(spec.hotspots.some((h) => h.id === 'market'), `Missing market hotspot in ${city.id}`);

      const champ = CITY_ARENA_CHAMPIONS.find((c) => c.cityId === city.id);
      assert.ok(champ, `Missing arena champion for ${city.id}`);
    }
    assert.equal(getCityInteriorSpec('nonexistent_city').cityId, 'krolewska_przystan');
  });
});

describe('Knight Arena roster & deterministic turn-based combat', () => {
  it('builds city roster with local champion first and excludes player from rivals', () => {
    const opponents = buildArenaOpponentsForCity('zelazna_kuznia', SAMPLE_LEADERBOARD, 3);
    assert.equal(opponents[0].cityId, 'zelazna_kuznia');
    assert.equal(opponents[0].isCityChampion, true);
    assert.ok(opponents.length === 3); // 1 local champion + 2 non-player rivals
    assert.ok(opponents.every((o) => o.name !== 'Lord Kupiecki'));
    assert.ok(opponents.slice(1).every((o) => o.isPlayerRival === true));
  });

  it('resolves strike, shield_riposte, heavy_cleave, and arcane_surge moves cleanly to victory', () => {
    assert.equal(ARENA_MOVES.length, 4);
    const champ = CITY_ARENA_CHAMPIONS[0]; // Lv 1 Sir Aldric
    let duel = initArenaDuel(SAMPLE_PLAYER, champ);

    assert.equal(duel.status, 'fighting');
    assert.equal(duel.playerHp, 180);
    assert.equal(duel.enemyHp, champ.maxHp);

    // Round 1: shield_riposte heals/blocks and builds stamina
    const r1 = resolveArenaTurn(duel, 'shield_riposte', 101);
    assert.equal(r1.round, 2);
    assert.equal(r1.lastExchange?.playerBlocked, true);
    assert.ok(r1.lastExchange && r1.lastExchange.playerDmgDealt > 0);
    assert.ok(r1.playerStamina > duel.playerStamina);

    // Round 2: arcane_surge spends 40 stamina and staggers enemy
    const r2 = resolveArenaTurn(r1, 'arcane_surge', 202);
    assert.equal(r2.lastExchange?.enemyStaggered, true);
    assert.ok(r2.playerStamina < r1.playerStamina);

    // Fight until duel concludes
    duel = r2;
    let safety = 0;
    while (duel.status === 'fighting' && safety < 25) {
      const nextMove = duel.playerStamina >= 25 ? 'heavy_cleave' : 'strike';
      duel = resolveArenaTurn(duel, nextMove, 300 + safety * 19);
      safety++;
    }

    assert.equal(duel.status, 'victory');
    assert.equal(duel.enemyHp, 0);

    // Subsequent turns after victory are no-ops
    const frozen = resolveArenaTurn(duel, 'strike', 999);
    assert.equal(frozen.round, duel.round);
  });
});
