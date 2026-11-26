import type { GuildInfo } from './gameData';

export type GuildRankingMetric = 'treasury' | 'perMember';

export interface RankedGuildDatum extends GuildInfo {
  rank: number;
  metricValue: number;
  sharePct: number;
  gapToLeaderGold: number;
  goldPerMember: number;
  isPlayerGuild: boolean;
}

export interface GuildRankingSummary {
  metric: GuildRankingMetric;
  ranked: RankedGuildDatum[];
  totalTreasuryGold: number;
  maxMetricValue: number;
  leader: RankedGuildDatum | null;
  playerGuild: RankedGuildDatum | null;
  playerGuildRank: number | null;
}

/**
 * Pure ranking computation for merchant guilds, supporting both total treasury
 * gold and treasury-per-member views. Sorts deterministically and computes
 * treasury share percentages and gap-to-leader values for D3 visualization.
 */
export function computeGuildRankings(
  guilds: GuildInfo[],
  playerGuildId: string,
  metric: GuildRankingMetric = 'treasury',
): GuildRankingSummary {
  if (!guilds || guilds.length === 0) {
    return {
      metric,
      ranked: [],
      totalTreasuryGold: 0,
      maxMetricValue: 0,
      leader: null,
      playerGuild: null,
      playerGuildRank: null,
    };
  }

  const totalTreasuryGold = guilds.reduce(
    (sum, g) => sum + Math.max(0, Number.isFinite(g.treasuryGold) ? g.treasuryGold : 0),
    0,
  );

  const enriched = guilds.map((g) => {
    const safeTreasury = Math.max(0, Number.isFinite(g.treasuryGold) ? g.treasuryGold : 0);
    const safeMembers = Math.max(1, Number.isFinite(g.membersCount) ? g.membersCount : 1);
    const goldPerMember = Math.round(safeTreasury / safeMembers);
    const metricValue = metric === 'perMember' ? goldPerMember : safeTreasury;
    const sharePct =
      totalTreasuryGold > 0
        ? Math.round((safeTreasury / totalTreasuryGold) * 1000) / 10
        : 0;

    return {
      ...g,
      treasuryGold: safeTreasury,
      membersCount: safeMembers,
      goldPerMember,
      metricValue,
      sharePct,
      isPlayerGuild: g.id === playerGuildId,
    };
  });

  enriched.sort((a, b) => {
    if (b.metricValue !== a.metricValue) return b.metricValue - a.metricValue;
    if (b.treasuryGold !== a.treasuryGold) return b.treasuryGold - a.treasuryGold;
    if (b.level !== a.level) return b.level - a.level;
    return a.name.localeCompare(b.name, 'pl');
  });

  const leaderMetricValue = enriched[0]?.metricValue ?? 0;
  const leaderTreasury = enriched[0]?.treasuryGold ?? 0;

  const ranked: RankedGuildDatum[] = enriched.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    gapToLeaderGold:
      idx === 0
        ? 0
        : Math.max(
            0,
            metric === 'perMember'
              ? leaderMetricValue - item.goldPerMember
              : leaderTreasury - item.treasuryGold,
          ),
  }));

  const leader = ranked[0] ?? null;
  const playerGuild = ranked.find((g) => g.isPlayerGuild) ?? null;

  return {
    metric,
    ranked,
    totalTreasuryGold,
    maxMetricValue: leaderMetricValue,
    leader,
    playerGuild,
    playerGuildRank: playerGuild ? playerGuild.rank : null,
  };
}

/**
 * Compact Polish axis tick formatter for D3 linear gold scales.
 */
export function formatGuildGoldAxis(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000) {
    const mln = value / 1_000_000;
    return `${mln.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} mln`;
  }
  if (value >= 1_000) {
    const tys = value / 1_000;
    return `${tys.toLocaleString('pl-PL', { maximumFractionDigits: tys >= 100 ? 0 : 1 })} tys.`;
  }
  return `${Math.round(value)}`;
}

/**
 * Full tabular Polish gold formatter.
 */
export function formatGuildGoldFull(value: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
  return `${safe.toLocaleString('pl-PL')} zł`;
}
