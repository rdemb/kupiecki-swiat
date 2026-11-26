import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { GuildInfo } from './gameData';
import {
  computeGuildRankings,
  formatGuildGoldAxis,
  formatGuildGoldFull,
} from './guildRankings';

const SAMPLE_GUILDS: GuildInfo[] = [
  {
    id: 'g_smok',
    name: 'Zakon Pogromców z Kuźni',
    tag: 'SMOK',
    level: 11,
    membersCount: 34,
    treasuryGold: 289_000,
    specialty: 'Wyprawy Rycerskie',
    taxRebatePct: 12,
    leader: 'Wódz Garrok',
  },
  {
    id: 'g_zloto',
    name: 'Hanza Złotego Gryfa',
    tag: 'ZŁOTO',
    level: 14,
    membersCount: 48,
    treasuryGold: 428_500,
    specialty: 'Handel Giełdowy',
    taxRebatePct: 18,
    leader: 'Mistrz_Kildor',
  },
  {
    id: 'g_runa',
    name: 'Syndykat Srebrnej Runy',
    tag: 'RUNA',
    level: 12,
    membersCount: 39,
    treasuryGold: 315_200,
    specialty: 'Kryształy Many',
    taxRebatePct: 15,
    leader: 'Arcymag Elandor',
  },
];

describe('computeGuildRankings', () => {
  it('sorts guilds descending by treasury gold and computes shares and gaps', () => {
    const result = computeGuildRankings(SAMPLE_GUILDS, 'g_runa', 'treasury');

    assert.deepEqual(
      result.ranked.map((g) => g.id),
      ['g_zloto', 'g_runa', 'g_smok'],
    );
    assert.deepEqual(
      result.ranked.map((g) => g.rank),
      [1, 2, 3],
    );
    assert.equal(result.totalTreasuryGold, 1_032_700);
    assert.equal(result.maxMetricValue, 428_500);
    assert.equal(result.leader?.id, 'g_zloto');
    assert.equal(result.playerGuildRank, 2);
    assert.equal(result.playerGuild?.isPlayerGuild, true);
    assert.equal(result.ranked[0].gapToLeaderGold, 0);
    assert.equal(result.ranked[1].gapToLeaderGold, 428_500 - 315_200);
    assert.equal(result.ranked[2].gapToLeaderGold, 428_500 - 289_000);

    const shareSum = result.ranked.reduce((acc, g) => acc + g.sharePct, 0);
    assert.ok(Math.abs(shareSum - 100) <= 0.2, `Expected sharePct sum ~100, got ${shareSum}`);
  });

  it('dynamically re-ranks guilds when treasury contributions overtake the leader', () => {
    const updated = SAMPLE_GUILDS.map((g) =>
      g.id === 'g_smok' ? { ...g, treasuryGold: g.treasuryGold + 200_000 } : g,
    );

    const result = computeGuildRankings(updated, 'g_smok', 'treasury');

    assert.equal(result.leader?.id, 'g_smok');
    assert.equal(result.playerGuildRank, 1);
    assert.equal(result.ranked[0].treasuryGold, 489_000);
    assert.equal(result.ranked[0].gapToLeaderGold, 0);
    assert.equal(result.ranked[1].id, 'g_zloto');
    assert.equal(result.ranked[1].gapToLeaderGold, 60_500);
  });

  it('supports perMember ranking metric', () => {
    const uneven: GuildInfo[] = [
      { ...SAMPLE_GUILDS[1], membersCount: 100, treasuryGold: 400_000 }, // 4 000 / member
      { ...SAMPLE_GUILDS[2], membersCount: 20, treasuryGold: 300_000 }, // 15 000 / member
    ];

    const result = computeGuildRankings(uneven, 'g_runa', 'perMember');
    assert.equal(result.ranked[0].id, 'g_runa');
    assert.equal(result.ranked[0].goldPerMember, 15_000);
    assert.equal(result.ranked[1].goldPerMember, 4_000);
    assert.equal(result.ranked[1].gapToLeaderGold, 11_000);
  });

  it('handles empty guild list gracefully', () => {
    const result = computeGuildRankings([], 'g_zloto');
    assert.deepEqual(result.ranked, []);
    assert.equal(result.totalTreasuryGold, 0);
    assert.equal(result.maxMetricValue, 0);
    assert.equal(result.leader, null);
    assert.equal(result.playerGuildRank, null);
  });
});

describe('guild gold formatters', () => {
  it('formats compact axis labels cleanly', () => {
    assert.equal(formatGuildGoldAxis(0), '0');
    assert.equal(formatGuildGoldAxis(500), '500');
    assert.ok(formatGuildGoldAxis(250_000).includes('250'));
    assert.ok(formatGuildGoldAxis(250_000).includes('tys.'));
    assert.ok(formatGuildGoldAxis(1_500_000).includes('mln'));
  });

  it('formats full gold values with zł suffix', () => {
    const formatted = formatGuildGoldFull(428_500);
    assert.ok(formatted.endsWith(' zł'));
    assert.ok(formatted.includes('428'));
    assert.ok(formatted.includes('500'));
  });
});
