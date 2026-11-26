import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CITIES,
  COMMODITIES,
  CommodityId,
  CommodityMarketState,
  MacroEconomyState,
  PlayerExchangeOffer,
  SEASONS,
  SeasonId,
  calculateCityMarketSentiment,
} from '../economy/economyEngine';
import {
  PriceTickMap,
  computePriceTickMap,
  extractCityPriceSnapshot,
  formatLiveTickDelta,
} from '../economy/priceTickTracker';
import { CityMarketMoodGauge } from './CityMarketMoodGauge';
import { SeasonalMarketBanner } from './SeasonalMarketBanner';

const TICK_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface DayTraderTerminalProps {
  markets: Record<CommodityId, CommodityMarketState>;
  macro: MacroEconomyState;
  exchangeOffers: PlayerExchangeOffer[];
  selectedCommodityId: CommodityId;
  onSelectCommodity: (id: CommodityId) => void;
  selectedCityId: string;
  onSelectCity: (cityId: string) => void;
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  techFeeRebate: number;
  onExecuteTrade: (params: {
    commodityId: CommodityId;
    side: 'buy' | 'sell';
    quantity: number;
    cityId: string;
  }) => void;
  onBuyExchangeOffer: (offer: PlayerExchangeOffer) => void;
  onCreateExchangeOffer: (params: {
    commodityId: CommodityId;
    quantity: number;
    pricePerUnit: number;
    cityId: string;
  }) => void;
  onAdvanceSeason?: (seasonId?: SeasonId) => void;
  onTriggerDisaster?: () => void;
  onOpenDisasterModal?: () => void;
}

export const DayTraderTerminal: React.FC<DayTraderTerminalProps> = ({
  markets,
  macro,
  exchangeOffers,
  selectedCommodityId,
  onSelectCommodity,
  selectedCityId,
  onSelectCity,
  playerGold,
  playerInventory,
  techFeeRebate,
  onExecuteTrade,
  onBuyExchangeOffer,
  onCreateExchangeOffer,
  onAdvanceSeason,
  onTriggerDisaster,
  onOpenDisasterModal,
}) => {
  const [tradeQty, setTradeQty] = useState<number>(10);
  const [customOfferPrice, setCustomOfferPrice] = useState<number>(0);
  const [orderError, setOrderError] = useState<string>('');
  const [exchangeMode, setExchangeMode] = useState<'spot' | 'p2p_offer'>('spot');
  const [priceTicks, setPriceTicks] = useState<PriceTickMap>({});
  const prefersReducedMotion = useReducedMotion();

  const prevPricesRef = useRef<Partial<Record<CommodityId, number>> | null>(null);
  const prevCityIdRef = useRef<string>(selectedCityId);

  useEffect(() => {
    const nextSnapshot = extractCityPriceSnapshot(markets, selectedCityId);
    const cityChanged = prevCityIdRef.current !== selectedCityId;
    setPriceTicks((prevTicks) =>
      computePriceTickMap({
        prevPrices: prevPricesRef.current,
        nextPrices: nextSnapshot,
        prevTicks,
        cityChanged,
      }),
    );
    prevPricesRef.current = nextSnapshot;
    prevCityIdRef.current = selectedCityId;
  }, [markets, selectedCityId]);

  const spec = COMMODITIES.find((c) => c.id === selectedCommodityId) ?? COMMODITIES[0];
  const market = markets[selectedCommodityId];
  const activeTick = priceTicks[selectedCommodityId];
  const activeTickFmt = formatLiveTickDelta(activeTick);

  const sentimentReport = useMemo(
    () => calculateCityMarketSentiment(selectedCityId, markets, macro),
    [selectedCityId, markets, macro],
  );

  if (!market) return null;

  const activeCity = CITIES.find((c) => c.id === selectedCityId) ?? CITIES[0];
  const citySpotPrice = market.cityPrices[selectedCityId] ?? market.currentPrice;
  const effectiveTaxPct = Number((macro.dynamicTaxRatePct * (1 - Math.min(0.6, techFeeRebate))).toFixed(2));

  const buyUnitCost = Number((citySpotPrice * (1 + market.spreadPct / 200)).toFixed(2));
  const sellUnitPrice = Number((citySpotPrice * (1 - market.spreadPct / 200)).toFixed(2));

  const grossBuyTotal = Number((buyUnitCost * tradeQty).toFixed(2));
  const buyTaxGold = Number((grossBuyTotal * (effectiveTaxPct / 100)).toFixed(2));
  const finalBuyTotal = Number((grossBuyTotal + buyTaxGold).toFixed(2));

  const grossSellTotal = Number((sellUnitPrice * tradeQty).toFixed(2));
  const sellTaxGold = Number((grossSellTotal * (effectiveTaxPct / 100)).toFixed(2));
  const finalSellNet = Number((grossSellTotal - sellTaxGold).toFixed(2));

  const heldQty = playerInventory[selectedCommodityId] ?? 0;
  const effectiveOfferPrice = customOfferPrice > 0 ? customOfferPrice : Number((citySpotPrice * 0.98).toFixed(1));

  const handleTrade = (side: 'buy' | 'sell') => {
    setOrderError('');
    if (!Number.isFinite(tradeQty) || tradeQty <= 0) {
      setOrderError('Podaj dodatni wolumen towaru.');
      return;
    }
    if (side === 'buy' && finalBuyTotal > playerGold) {
      setOrderError(`Brak pokrycia w złocie (wymagane ${Math.round(finalBuyTotal)} zł).`);
      return;
    }
    if (side === 'sell' && tradeQty > heldQty) {
      setOrderError(`Brak towaru w spichlerzu (posiadasz ${heldQty} szt.).`);
      return;
    }
    onExecuteTrade({
      commodityId: selectedCommodityId,
      side,
      quantity: tradeQty,
      cityId: selectedCityId,
    });
  };

  const handlePostP2POffer = () => {
    setOrderError('');
    if (tradeQty <= 0 || tradeQty > heldQty) {
      setOrderError(`Nie masz tylu jednostek towaru w spichlerzu (posiadasz ${heldQty} szt.).`);
      return;
    }
    if (effectiveOfferPrice <= 0) {
      setOrderError('Podaj prawidłową cenę za sztukę.');
      return;
    }
    onCreateExchangeOffer({
      commodityId: selectedCommodityId,
      quantity: tradeQty,
      pricePerUnit: effectiveOfferPrice,
      cityId: selectedCityId,
    });
  };

  // SVG OHLC Candlestick Chart Dimensions
  const bars = market.history.slice(-28);
  const prices = bars.flatMap((b) => [b.high, b.low]);
  const minPrice = Math.min(...prices, market.bollingerLower) * 0.985;
  const maxPrice = Math.max(...prices, market.bollingerUpper) * 1.015;
  const priceRange = Math.max(1, maxPrice - minPrice);
  const maxVol = Math.max(1, ...bars.map((b) => b.volume));

  const chartW = 540;
  const chartH = 175;

  const yForPrice = (p: number) => {
    const ratio = (p - minPrice) / priceRange;
    return chartH - 32 - ratio * (chartH - 46);
  };

  return (
    <div className="space-y-3 text-slate-100">
      {/* Dynamic 4-Season Market Physics, Caravan Speed & World Disaster Alert Banner */}
      <SeasonalMarketBanner
        macro={macro}
        onAdvanceSeason={onAdvanceSeason}
        onTriggerDisaster={onTriggerDisaster}
        onOpenDisasterModal={onOpenDisasterModal}
      />

      {/* Graphical City Market Mood & Anti-Inflation Gauge */}
      <CityMarketMoodGauge report={sentimentReport} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Column 1: Commodity Exchange Watchlist with Season, Sparkline Trends & Availability (3 cols) */}
      <div className="lg:col-span-3 bg-[#0c1118] border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-amber-400">Kursy, Trendy & Podaż</span>
          <span className="text-[11px] font-semibold" style={{ color: SEASONS[macro.activeSeason]?.accentHex ?? '#fbbf24' }}>
            {SEASONS[macro.activeSeason]?.shortName ?? macro.activeSeasonName.split(' ')[0]}
          </span>
        </div>
        <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
          {COMMODITIES.map((item) => {
            const st = markets[item.id];
            if (!st) return null;
            const isSelected = item.id === selectedCommodityId;
            const isUp = st.change24hPct >= 0;
            const localCityPrice = st.cityPrices[selectedCityId] ?? st.currentPrice;
            const seasonSpec = SEASONS[macro.activeSeason] ?? SEASONS.lato;
            const availPct = Math.round(
              (seasonSpec.availabilityByCommodity[item.id] ?? seasonSpec.availabilityMultiplier) *
                (macro.activeDisaster ? macro.activeDisaster.supplyShockMultiplier : 1) *
                100,
            );
            const sparkBars = st.history.slice(-12);
            const sparkCloses = sparkBars.map((b) => b.close);
            const sMin = Math.min(...sparkCloses, localCityPrice);
            const sMax = Math.max(...sparkCloses, localCityPrice);
            const sSpan = Math.max(0.1, sMax - sMin);
            const sparkPoints = sparkCloses
              .map((val, idx) => {
                const sx = (idx / Math.max(1, sparkCloses.length - 1)) * 42;
                const sy = 15 - ((val - sMin) / sSpan) * 13;
                return `${sx.toFixed(1)},${sy.toFixed(1)}`;
              })
              .join(' ');

            const tick = priceTicks[item.id];
            const tickDir = tick?.direction ?? 'neutral';
            const tickId = tick?.tickId ?? 0;
            const hasLiveTick = tickId > 0 && tickDir !== 'neutral';
            const lastSparkX = 42;
            const lastSparkVal = sparkCloses[sparkCloses.length - 1] ?? localCityPrice;
            const lastSparkY = 15 - ((lastSparkVal - sMin) / sSpan) * 13;

            return (
              <button
                key={item.id}
                type="button"
                data-testid={`watchlist-item-${item.id}`}
                data-price-direction={tickDir}
                data-tick-id={tickId}
                onClick={() => {
                  onSelectCommodity(item.id);
                  setCustomOfferPrice(0);
                }}
                className={`relative overflow-hidden w-full text-left p-2 rounded-md border transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/60 text-white'
                    : 'bg-[#111722] border-slate-800/80 hover:border-slate-700 text-slate-200'
                }`}
              >
                {/* Subtle GPU-composited real-time price rise/drop row flash */}
                {hasLiveTick && (
                  <motion.span
                    key={`${item.id}-flash-${tickId}`}
                    aria-hidden="true"
                    initial={{ opacity: prefersReducedMotion ? 0.16 : 0.34 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.85, ease: TICK_EASE }}
                    className={`pointer-events-none absolute inset-0 rounded-md ${
                      tickDir === 'up'
                        ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500/20 to-emerald-400/35'
                        : 'bg-gradient-to-r from-rose-500/0 via-rose-500/20 to-rose-400/35'
                    }`}
                  />
                )}

                <div className="relative z-10 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-tabular text-xs font-bold text-amber-400">
                      {item.symbol}
                    </span>
                    <span className="text-xs font-medium truncate max-w-[105px]">{item.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono-tabular mt-0.5">
                    Podaż: <strong className={availPct < 80 ? 'text-rose-300' : availPct > 110 ? 'text-emerald-300' : 'text-sky-300'}>{availPct}%</strong> · Masz: <strong className="text-white">{playerInventory[item.id] ?? 0}</strong>
                  </div>
                </div>
                <div className="relative z-10 flex items-center gap-2 shrink-0">
                  <svg viewBox="0 0 42 16" className="w-10 h-4 overflow-visible" aria-hidden="true">
                    <polyline
                      fill="none"
                      stroke={isUp ? '#10b981' : '#f43f5e'}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparkPoints}
                    />
                    <motion.circle
                      key={`${item.id}-dot-${tickId}`}
                      cx={lastSparkX}
                      cy={lastSparkY}
                      r={2.1}
                      fill={
                        tickDir === 'up'
                          ? '#34d399'
                          : tickDir === 'down'
                            ? '#fb7185'
                            : isUp
                              ? '#10b981'
                              : '#f43f5e'
                      }
                      initial={
                        hasLiveTick && !prefersReducedMotion
                          ? { scale: 1.85, opacity: 1 }
                          : false
                      }
                      animate={{ scale: 1, opacity: 0.92 }}
                      transition={{ duration: 0.45, ease: TICK_EASE }}
                    />
                  </svg>
                  <div className="text-right font-mono-tabular min-w-[62px]">
                    <motion.div
                      key={`${item.id}-price-${tickId}`}
                      initial={
                        hasLiveTick && !prefersReducedMotion
                          ? { y: tickDir === 'up' ? 3 : -3, opacity: 0.6 }
                          : false
                      }
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.22, ease: TICK_EASE }}
                      className={`text-xs font-semibold flex items-center justify-end gap-0.5 ${
                        tickDir === 'up'
                          ? 'text-emerald-300'
                          : tickDir === 'down'
                            ? 'text-rose-300'
                            : 'text-white'
                      }`}
                    >
                      {hasLiveTick && (
                        <span className="text-[9px] leading-none" aria-hidden="true">
                          {tickDir === 'up' ? '▲' : '▼'}
                        </span>
                      )}
                      <span>{localCityPrice.toFixed(1)} zł</span>
                    </motion.div>
                    <div className={`text-[10px] ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? '+' : ''}
                      {st.change24hPct.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Column 2: Real-World Price Chart + Live P2P Player & City Surplus Offers Board (5 cols) */}
      <div className="lg:col-span-5 bg-[#0c1118] border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-2.5">
        <div>
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="truncate">{spec.name} ({spec.symbol})</span>
                <span className="text-xs font-normal text-amber-300 whitespace-nowrap">
                  · {market.seasonalTrendLabel || 'Kurs Rynkowy'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Miasto: <strong className="text-white">{activeCity.name}</strong> ({activeCity.altitudeMeters} m n.p.m.) · Pogoda: <span className="text-sky-300">{macro.activeWeatherName}</span>
              </p>
            </div>
            <div
              data-testid="terminal-spot-price"
              data-price-direction={activeTick?.direction ?? 'neutral'}
              data-tick-id={activeTick?.tickId ?? 0}
              className="relative shrink-0 text-right font-mono-tabular px-2 py-0.5 rounded-md"
            >
              {activeTick && activeTick.tickId > 0 && activeTick.direction !== 'neutral' && (
                <motion.span
                  key={`hero-flash-${selectedCommodityId}-${activeTick.tickId}`}
                  aria-hidden="true"
                  initial={{
                    opacity: prefersReducedMotion ? 0.2 : 0.42,
                    scale: prefersReducedMotion ? 1 : 0.96,
                  }}
                  animate={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.03 }}
                  transition={{ duration: 0.9, ease: TICK_EASE }}
                  className={`pointer-events-none absolute inset-0 rounded-md ${
                    activeTick.direction === 'up'
                      ? 'bg-emerald-500/25 ring-1 ring-emerald-400/50'
                      : 'bg-rose-500/25 ring-1 ring-rose-400/50'
                  }`}
                />
              )}
              <motion.div
                key={`hero-price-${selectedCommodityId}-${activeTick?.tickId ?? 0}`}
                initial={
                  activeTick && activeTick.tickId > 0 && activeTick.direction !== 'neutral' && !prefersReducedMotion
                    ? {
                        y: activeTick.direction === 'up' ? 5 : -5,
                        scale: 1.03,
                        opacity: 0.6,
                      }
                    : false
                }
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ duration: 0.24, ease: TICK_EASE }}
                className={`relative z-10 text-base font-bold flex items-center justify-end gap-1 whitespace-nowrap ${
                  activeTick?.direction === 'up'
                    ? 'text-emerald-300'
                    : activeTick?.direction === 'down'
                      ? 'text-rose-300'
                      : 'text-amber-400'
                }`}
              >
                {activeTickFmt.isActive && (
                  <span className="text-xs leading-none" aria-hidden="true">
                    {activeTickFmt.arrow}
                  </span>
                )}
                <span>{citySpotPrice.toFixed(2)} zł</span>
              </motion.div>
              <div className="relative z-10 text-[10px] text-slate-400 flex items-center justify-end gap-1.5 whitespace-nowrap">
                <AnimatePresence initial={false}>
                  {activeTickFmt.isActive && (
                    <motion.span
                      key={`delta-${selectedCommodityId}-${activeTick?.tickId ?? 0}`}
                      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: activeTick?.direction === 'up' ? 3 : -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      transition={{ duration: 0.18, ease: TICK_EASE }}
                      className={`font-semibold ${
                        activeTick?.direction === 'up' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {activeTickFmt.signedText}
                    </motion.span>
                  )}
                </AnimatePresence>
                {activeTickFmt.isActive && <span aria-hidden="true">·</span>}
                <span>Podaż: {market.inventory} szt.</span>
              </div>
            </div>
          </div>

          {/* OHLC Candlestick Price History Chart */}
          <div className="mt-2 bg-[#080b10] border border-slate-800/80 rounded p-2">
            <svg
              viewBox={`0 0 ${chartW} ${chartH}`}
              className="w-full h-36 overflow-visible"
              role="img"
              aria-label={`Wykres kursu surowca ${spec.name}`}
            >
              {[0.2, 0.5, 0.8].map((ratio, idx) => {
                const y = 14 + ratio * (chartH - 46);
                const labelPrice = (maxPrice - ratio * priceRange).toFixed(0);
                return (
                  <g key={idx}>
                    <line
                      x1={0}
                      y1={y}
                      x2={chartW - 42}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={chartW - 36}
                      y={y + 4}
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {labelPrice}
                    </text>
                  </g>
                );
              })}

              {bars.map((bar, i) => {
                const stepX = (chartW - 48) / Math.max(1, bars.length);
                const cx = i * stepX + stepX * 0.5;
                const candleW = Math.max(4, stepX * 0.58);
                const bullish = bar.close >= bar.open;
                const color = bullish ? '#10b981' : '#f43f5e';

                const yHigh = yForPrice(bar.high);
                const yLow = yForPrice(bar.low);
                const yOpen = yForPrice(bar.open);
                const yClose = yForPrice(bar.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyH = Math.max(2, Math.abs(yClose - yOpen));
                const volH = (bar.volume / maxVol) * 22;

                return (
                  <g key={bar.time + i}>
                    <rect
                      x={cx - candleW / 2}
                      y={chartH - volH}
                      width={candleW}
                      height={volH}
                      fill={color}
                      fillOpacity="0.22"
                    />
                    <line x1={cx} y1={yHigh} x2={cx} y2={yLow} stroke={color} strokeWidth="1.3" />
                    <rect
                      x={cx - candleW / 2}
                      y={bodyTop}
                      width={candleW}
                      height={bodyH}
                      fill={color}
                      rx="1"
                    />
                  </g>
                );
              })}

              {/* Smoothly gliding GPU-composited live spot price reference line reacting to upticks & downticks */}
              {(() => {
                const liveY = Math.max(12, Math.min(chartH - 28, yForPrice(citySpotPrice)));
                const liveColor =
                  activeTick?.direction === 'up'
                    ? '#34d399'
                    : activeTick?.direction === 'down'
                      ? '#fb7185'
                      : '#f59e0b';
                return (
                  <motion.g
                    initial={{ y: liveY }}
                    animate={{ y: liveY }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: TICK_EASE }}
                  >
                    <line
                      x1={0}
                      y1={0}
                      x2={chartW - 42}
                      y2={0}
                      stroke={liveColor}
                      strokeWidth="1"
                      strokeDasharray="4 3"
                      strokeOpacity="0.82"
                    />
                    <motion.circle
                      key={`chart-beacon-${selectedCommodityId}-${activeTick?.tickId ?? 0}`}
                      cx={chartW - 44}
                      cy={0}
                      initial={
                        activeTick && activeTick.tickId > 0 && !prefersReducedMotion
                          ? { scale: 1.85, opacity: 1 }
                          : false
                      }
                      animate={{ scale: 1, opacity: 0.95 }}
                      transition={{ duration: 0.36, ease: TICK_EASE }}
                      r="3"
                      fill={liveColor}
                    />
                  </motion.g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* Tablica Ofert Giełdowych: Nadwyżki Miast & Oferty Innych Graczy */}
        <div className="bg-[#080b10] border border-slate-800/90 rounded p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
            <span className="text-xs font-bold text-amber-400">
              Oferty Sprzedaży Graczy i Nadwyżki Miast ({exchangeOffers.length})
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {CITIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCity(c.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    c.id === selectedCityId
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#111722] text-slate-400 hover:text-white'
                  }`}
                >
                  {c.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
            {exchangeOffers.map((off) => {
              const comm = COMMODITIES.find((c) => c.id === off.commodityId);
              const totalCost = Math.round(off.quantity * off.pricePerUnit);
              const canAfford = playerGold >= totalCost;
              return (
                <div
                  key={off.id}
                  className={`p-2 rounded border flex items-center justify-between text-xs ${
                    off.isCitySurplus
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#111722] border-slate-800'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          off.isCitySurplus
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {off.isCitySurplus ? 'NADWYŻKA MIASTA' : 'OFERTA GRACZA'}
                      </span>
                      <span className="font-bold text-white truncate">
                        {off.quantity}x {comm?.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Wystawił: <strong className="text-slate-200">{off.sellerName}</strong> · Miasto: {off.cityName}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right font-mono-tabular">
                      <div className="text-xs font-bold text-amber-400">{off.pricePerUnit} zł/szt.</div>
                      <div className="text-[10px] text-slate-400">Razem: {totalCost} zł</div>
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyExchangeOffer(off)}
                      className="min-h-[34px] px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Kup
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Column 3: Order Book Depth & Spot / Player Listing Ticket (4 cols) */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-2.5">
        {/* Order Book (Popyt i Podaż w Mieście) */}
        <div>
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-xs font-semibold text-amber-400">Księga Popytu i Podaży ({activeCity.name})</span>
            <span className="text-[11px] font-mono-tabular text-slate-400">
              Nadwyżka miasta: {market.citySurplusStock?.[selectedCityId] ?? 50} szt.
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-2 font-mono-tabular text-[11px]">
            {(() => {
              const bids = market.orderBook.bids.slice(0, 4);
              const asks = market.orderBook.asks.slice(0, 4);
              const maxBookQty = Math.max(
                1,
                ...bids.map((l) => l.quantity),
                ...asks.map((l) => l.quantity),
              );
              const isUpTick = activeTick?.direction === 'up' && (activeTick?.tickId ?? 0) > 0;
              const isDownTick = activeTick?.direction === 'down' && (activeTick?.tickId ?? 0) > 0;

              return (
                <>
                  <div>
                    <div className="flex justify-between text-slate-400 pb-1 border-b border-slate-800/70">
                      <span>Ilość</span>
                      <span>Kupujący (BID)</span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {bids.map((lvl, idx) => (
                        <div
                          key={idx}
                          className="relative overflow-hidden flex justify-between px-1 py-0.5 rounded text-emerald-400/95"
                        >
                          <motion.span
                            aria-hidden="true"
                            animate={{ scaleX: Math.max(0.08, lvl.quantity / maxBookQty) }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: TICK_EASE }}
                            className="pointer-events-none absolute inset-y-0 right-0 w-full origin-right bg-emerald-500/12"
                          />
                          {idx === 0 && isUpTick && (
                            <motion.span
                              key={`bid-flash-${activeTick?.tickId}`}
                              aria-hidden="true"
                              initial={{ opacity: 0.35 }}
                              animate={{ opacity: 0 }}
                              transition={{ duration: 0.7, ease: TICK_EASE }}
                              className="pointer-events-none absolute inset-0 bg-emerald-400/25"
                            />
                          )}
                          <span className="relative z-10">{lvl.quantity}</span>
                          <span className="relative z-10">{lvl.price.toFixed(1)} zł</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-slate-400 pb-1 border-b border-slate-800/70">
                      <span>Sprzedający (ASK)</span>
                      <span>Ilość</span>
                    </div>
                    <div className="space-y-0.5 mt-1">
                      {asks.map((lvl, idx) => (
                        <div
                          key={idx}
                          className="relative overflow-hidden flex justify-between px-1 py-0.5 rounded text-rose-400/95"
                        >
                          <motion.span
                            aria-hidden="true"
                            animate={{ scaleX: Math.max(0.08, lvl.quantity / maxBookQty) }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: TICK_EASE }}
                            className="pointer-events-none absolute inset-y-0 left-0 w-full origin-left bg-rose-500/12"
                          />
                          {idx === 0 && isDownTick && (
                            <motion.span
                              key={`ask-flash-${activeTick?.tickId}`}
                              aria-hidden="true"
                              initial={{ opacity: 0.35 }}
                              animate={{ opacity: 0 }}
                              transition={{ duration: 0.7, ease: TICK_EASE }}
                              className="pointer-events-none absolute inset-0 bg-rose-400/25"
                            />
                          )}
                          <span className="relative z-10">{lvl.price.toFixed(1)} zł</span>
                          <span className="relative z-10">{lvl.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Mode Switcher: Immediate Trade vs Post Player Offer */}
        <div className="bg-[#080b10] border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="grid grid-cols-2 gap-1.5 bg-[#111722] p-1 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => setExchangeMode('spot')}
              className={`py-1 px-2 rounded text-xs font-semibold transition-colors ${
                exchangeMode === 'spot'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Handel Natychmiastowy
            </button>
            <button
              type="button"
              onClick={() => setExchangeMode('p2p_offer')}
              className={`py-1 px-2 rounded text-xs font-semibold transition-colors ${
                exchangeMode === 'p2p_offer'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Wystaw Ofertę dla Graczy
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="trade-qty-input" className="text-xs font-semibold text-slate-200">
              Ilość Towaru ({spec.symbol})
            </label>
            <span className="text-xs font-mono-tabular text-slate-400">
              W spichlerzu: <strong className="text-white">{heldQty} szt.</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              id="trade-qty-input"
              type="number"
              min={1}
              max={1000}
              value={tradeQty}
              onChange={(e) => setTradeQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-20 bg-[#111722] border border-slate-700 rounded px-2 py-1.5 text-sm font-mono-tabular text-white focus:outline-none focus:border-amber-400"
            />
            {[5, 15, 30, 50].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTradeQty(preset)}
                className="px-2 py-1.5 text-xs font-mono-tabular bg-[#111722] hover:bg-slate-800 border border-slate-700 rounded text-slate-200 transition-colors"
              >
                {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTradeQty(Math.max(1, heldQty))}
              className="px-2 py-1.5 text-xs font-mono-tabular bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded text-amber-300 transition-colors"
            >
              MAX
            </button>
          </div>

          {exchangeMode === 'spot' ? (
            <>
              <div className="text-[11px] font-mono-tabular text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                <div className="flex justify-between">
                  <span>Ciężar partii towaru:</span>
                  <span className="text-slate-200">{tradeQty * spec.unitWeightKg} kg</span>
                </div>
                <div className="flex justify-between">
                  <span>Opłata Targowa Gildii ({effectiveTaxPct}%):</span>
                  <span className="text-slate-200">{buyTaxGold.toFixed(0)} zł</span>
                </div>
                <div className="flex justify-between text-slate-200 font-semibold">
                  <span>Kupno / Sprzedaż:</span>
                  <span>{Math.round(finalBuyTotal)} zł / {Math.round(finalSellNet)} zł</span>
                </div>
              </div>

              {orderError && (
                <div role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded px-2.5 py-1.5">
                  {orderError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <motion.button
                  type="button"
                  data-testid="terminal-buy-button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  onClick={() => handleTrade('buy')}
                  className="min-h-[44px] py-2 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex flex-col items-center justify-center cursor-pointer"
                >
                  <span>KUP NA GIEŁDZIE</span>
                  <motion.span
                    key={`buy-quote-${selectedCommodityId}-${activeTick?.tickId ?? 0}`}
                    initial={
                      activeTick && activeTick.tickId > 0 && activeTick.direction !== 'neutral' && !prefersReducedMotion
                        ? { y: activeTick.direction === 'up' ? 3 : -3, opacity: 0.65 }
                        : false
                    }
                    animate={{ y: 0, opacity: 0.92 }}
                    transition={{ duration: 0.2, ease: TICK_EASE }}
                    className="text-[10px] font-mono-tabular"
                  >
                    @{buyUnitCost.toFixed(1)} zł/szt.
                  </motion.span>
                </motion.button>
                <motion.button
                  type="button"
                  data-testid="terminal-sell-button"
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                  onClick={() => handleTrade('sell')}
                  className="min-h-[44px] py-2 px-3 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex flex-col items-center justify-center cursor-pointer"
                >
                  <span>SPRZEDAJ</span>
                  <motion.span
                    key={`sell-quote-${selectedCommodityId}-${activeTick?.tickId ?? 0}`}
                    initial={
                      activeTick && activeTick.tickId > 0 && activeTick.direction !== 'neutral' && !prefersReducedMotion
                        ? { y: activeTick.direction === 'up' ? 3 : -3, opacity: 0.65 }
                        : false
                    }
                    animate={{ y: 0, opacity: 0.92 }}
                    transition={{ duration: 0.2, ease: TICK_EASE }}
                    className="text-[10px] font-mono-tabular"
                  >
                    @{sellUnitPrice.toFixed(1)} zł/szt.
                  </motion.span>
                </motion.button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="p2p-price-input" className="text-slate-300">
                    Twoja Cena za 1 szt. (zł):
                  </label>
                  <input
                    id="p2p-price-input"
                    type="number"
                    min={1}
                    step={0.5}
                    value={effectiveOfferPrice}
                    onChange={(e) => setCustomOfferPrice(Math.max(1, Number(e.target.value) || 1))}
                    className="w-24 bg-[#111722] border border-slate-700 rounded px-2 py-1 text-xs font-mono-tabular text-amber-300"
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono-tabular text-slate-400">
                  <span>Wartość całej oferty dla graczy:</span>
                  <span className="text-amber-400 font-bold">
                    {Math.round(tradeQty * effectiveOfferPrice)} zł
                  </span>
                </div>
              </div>

              {orderError && (
                <div role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded px-2.5 py-1.5">
                  {orderError}
                </div>
              )}

              <button
                type="button"
                onClick={handlePostP2POffer}
                className="min-h-[44px] w-full py-2 px-3 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Wystaw Ofertę Sprzedaży na Tablicy ({tradeQty} szt. @ {effectiveOfferPrice} zł)
              </button>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
