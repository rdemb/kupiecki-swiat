import { CommodityId, CommodityMarketState } from './economyEngine';

export type PriceTickDirection = 'up' | 'down' | 'neutral';

export interface CommodityPriceTick {
  direction: PriceTickDirection;
  delta: number;
  deltaPct: number;
  tickId: number;
  previousPrice: number;
  currentPrice: number;
}

export type PriceTickMap = Partial<Record<CommodityId, CommodityPriceTick>>;

/**
 * Extracts a flat commodity -> city spot price snapshot for the currently selected city.
 */
export function extractCityPriceSnapshot(
  markets: Record<CommodityId, CommodityMarketState>,
  cityId: string,
): Record<CommodityId, number> {
  const snapshot = {} as Record<CommodityId, number>;
  for (const key of Object.keys(markets) as CommodityId[]) {
    const market = markets[key];
    snapshot[key] = market.cityPrices[cityId] ?? market.currentPrice;
  }
  return snapshot;
}

/**
 * Pure, deterministic price-tick diff engine for real-time exchange animations.
 * - Returns 'up' when price rises by >= threshold, 'down' when it drops by <= -threshold.
 * - Increments tickId strictly on actual price movement so Framer Motion flash animations
 *   re-trigger cleanly without firing false flashes when switching cities or on identical renders.
 */
export function computePriceTickMap(params: {
  prevPrices: Partial<Record<CommodityId, number>> | null;
  nextPrices: Record<CommodityId, number>;
  prevTicks: PriceTickMap;
  cityChanged: boolean;
  threshold?: number;
}): PriceTickMap {
  const { prevPrices, nextPrices, prevTicks, cityChanged, threshold = 0.005 } = params;
  const nextTicks: PriceTickMap = {};

  for (const id of Object.keys(nextPrices) as CommodityId[]) {
    const currentPrice = nextPrices[id];
    const priorTick = prevTicks[id];

    // Switching cities changes the price basis, not a real-time market tick:
    // reset cleanly to neutral without false green/red flash bursts.
    if (cityChanged || !prevPrices || prevPrices[id] === undefined) {
      nextTicks[id] = {
        direction: 'neutral',
        delta: 0,
        deltaPct: 0,
        tickId: priorTick?.tickId ?? 0,
        previousPrice: currentPrice,
        currentPrice,
      };
      continue;
    }

    const previousPrice = prevPrices[id]!;
    const rawDelta = Number((currentPrice - previousPrice).toFixed(4));

    if (Math.abs(rawDelta) >= threshold) {
      const direction: PriceTickDirection = rawDelta > 0 ? 'up' : 'down';
      const deltaPct =
        previousPrice > 0 ? Number(((rawDelta / previousPrice) * 100).toFixed(2)) : 0;
      nextTicks[id] = {
        direction,
        delta: Number(rawDelta.toFixed(2)),
        deltaPct,
        tickId: (priorTick?.tickId ?? 0) + 1,
        previousPrice,
        currentPrice,
      };
    } else if (priorTick) {
      // Price unchanged on this render: preserve prior tick metadata without bumping tickId
      nextTicks[id] = {
        ...priorTick,
        currentPrice,
      };
    } else {
      nextTicks[id] = {
        direction: 'neutral',
        delta: 0,
        deltaPct: 0,
        tickId: 0,
        previousPrice: currentPrice,
        currentPrice,
      };
    }
  }

  return nextTicks;
}

/**
 * Formats a signed live tick delta string (e.g. "+1.40 zł" or "-0.65 zł") with explicit
 * directional arrow for color-blind-safe semantic clarity alongside emerald/rose hues.
 */
export function formatLiveTickDelta(tick: CommodityPriceTick | undefined): {
  arrow: string;
  signedText: string;
  isActive: boolean;
} {
  if (!tick || tick.direction === 'neutral' || Math.abs(tick.delta) < 0.005) {
    return { arrow: '', signedText: '', isActive: false };
  }
  const arrow = tick.direction === 'up' ? '▲' : '▼';
  const sign = tick.delta > 0 ? '+' : '';
  return {
    arrow,
    signedText: `${sign}${tick.delta.toFixed(2)} zł`,
    isActive: true,
  };
}
