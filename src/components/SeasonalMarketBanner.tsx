import React from 'react';
import { motion } from 'motion/react';
import {
  COMMODITIES,
  MacroEconomyState,
  SEASONS,
  SeasonId,
} from '../economy/economyEngine';

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SEASON_SEQUENCE: SeasonId[] = ['wiosna', 'lato', 'jesien', 'zima'];

interface SeasonalMarketBannerProps {
  macro: MacroEconomyState;
  onAdvanceSeason?: (seasonId?: SeasonId) => void;
  onTriggerDisaster?: () => void;
  onOpenDisasterModal?: () => void;
}

export const SeasonalMarketBanner: React.FC<SeasonalMarketBannerProps> = ({
  macro,
  onAdvanceSeason,
  onTriggerDisaster,
  onOpenDisasterModal,
}) => {
  const activeSeasonSpec = SEASONS[macro.activeSeason] ?? SEASONS.lato;
  const nextSeasonSpec = SEASONS[macro.nextSeason ?? activeSeasonSpec.nextSeason] ?? SEASONS.jesien;
  const speedMult = macro.caravanSpeedMultiplier ?? activeSeasonSpec.caravanSpeedMultiplier;
  const availIdx = macro.seasonalAvailabilityIndex ?? Math.round(activeSeasonSpec.availabilityMultiplier * 100);
  const progressPct = Math.round(Math.max(0.06, Math.min(1, macro.seasonDayProgress ?? 0.35)) * 100);

  // Determine top seasonal movers (cheapest surplus vs most expensive shortage)
  const movers = COMMODITIES.map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    mult: activeSeasonSpec.priceMultipliers[c.id] ?? 1.0,
    avail: Math.round((activeSeasonSpec.availabilityByCommodity[c.id] ?? 1.0) * 100),
  })).sort((a, b) => b.mult - a.mult);

  const highestPriceMover = movers[0];
  const lowestPriceMover = movers[movers.length - 1];

  const speedToneClass =
    speedMult >= 1.05
      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30'
      : speedMult <= 0.78
        ? 'text-rose-300 border-rose-500/40 bg-rose-950/30'
        : 'text-amber-300 border-amber-500/40 bg-amber-950/30';

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
      className="bg-[#0c1118] border border-slate-800 rounded-lg p-3 space-y-2.5"
      aria-label="Dynamiczny cykl czterech pór roku i fizyka rynku"
    >
      {/* Top Row: 4-Season Selector Timeline + Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Pora Roku:
          </span>
          {SEASON_SEQUENCE.map((sid) => {
            const spec = SEASONS[sid];
            const isActive = sid === macro.activeSeason;
            return (
              <button
                key={sid}
                type="button"
                data-testid={`season-btn-${sid}`}
                onClick={() => onAdvanceSeason?.(sid)}
                className={`relative px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                  isActive
                    ? 'text-slate-950 font-bold border-white/60 shadow-sm'
                    : 'bg-[#111722] text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                }`}
                style={isActive ? { backgroundColor: spec.accentHex } : undefined}
              >
                {spec.shortName}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onAdvanceSeason && (
            <button
              type="button"
              data-testid="btn-advance-season"
              onClick={() => onAdvanceSeason()}
              className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer"
            >
              Następna Pora ({nextSeasonSpec.shortName})
            </button>
          )}
          {macro.activeDisaster ? (
            <button
              type="button"
              data-testid="btn-open-disaster-modal"
              onClick={() => onOpenDisasterModal?.()}
              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] border border-rose-300/60 transition-colors cursor-pointer"
            >
              Kryzys: {macro.activeDisaster.shortLabel} — Reaguj
            </button>
          ) : (
            onTriggerDisaster && (
              <button
                type="button"
                data-testid="btn-trigger-disaster"
                onClick={() => onTriggerDisaster()}
                className="px-2.5 py-1 rounded-md bg-[#111722] hover:bg-rose-950/60 border border-rose-500/40 text-rose-300 font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Wywołaj Katastrofę Świata
              </button>
            )
          )}
        </div>
      </div>

      {/* Middle Row: Season Description, Animated Cycle Progress & Real-World Physics Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
        <div className="md:col-span-5 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold" style={{ color: activeSeasonSpec.accentHex }}>
              {activeSeasonSpec.name}
            </span>
            <span className="font-mono-tabular text-[10px] text-slate-400">
              Do {nextSeasonSpec.shortName}: {macro.daysUntilNextSeason ?? 3} dni
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-snug">{activeSeasonSpec.description}</p>
          <div className="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
            <motion.div
              key={`${macro.activeSeason}-${progressPct}`}
              initial={{ scaleX: 0.2 }}
              animate={{ scaleX: progressPct / 100 }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
              style={{
                backgroundColor: activeSeasonSpec.accentHex,
                transformOrigin: 'left center',
              }}
              className="h-full w-full rounded-full"
            />
          </div>
        </div>

        {/* 3 Live Physics Telemetry Tiles */}
        <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div
            data-testid="season-caravan-speed-tile"
            className={`rounded-md border px-2.5 py-1.5 ${speedToneClass}`}
          >
            <div className="text-[10px] uppercase tracking-wide opacity-80">Prędkość Karawan 3D</div>
            <div className="font-mono-tabular text-sm font-bold leading-tight mt-0.5">
              {speedMult.toFixed(2)}x{' '}
              <span className="text-[10px] font-normal">
                ({speedMult >= 1 ? `+${Math.round((speedMult - 1) * 100)}%` : `${Math.round((speedMult - 1) * 100)}%`})
              </span>
            </div>
          </div>

          <div
            data-testid="season-availability-tile"
            className="rounded-md border border-slate-800 bg-[#080b10] px-2.5 py-1.5"
          >
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Dostępność Towarów</div>
            <div className="font-mono-tabular text-sm font-bold text-sky-300 leading-tight mt-0.5">
              {availIdx}%{' '}
              <span className="text-[10px] font-normal text-slate-400">podaży bazowej</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-[#080b10] px-2.5 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">Trend Cenowy Sezonu</div>
            <div className="font-mono-tabular text-[11px] mt-0.5 space-y-0.5">
              <div className="text-rose-300 truncate">
                ↑ {highestPriceMover.symbol}: +{Math.round((highestPriceMover.mult - 1) * 100)}%
              </div>
              <div className="text-emerald-300 truncate">
                ↓ {lowestPriceMover.symbol}: {Math.round((lowestPriceMover.mult - 1) * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Optional Active World Disaster Alert Bar */}
      {macro.activeDisaster && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
          className="rounded-md border border-rose-500/60 bg-rose-950/35 px-3 py-2 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <div className="text-xs font-bold text-rose-300">
              AKTYWNA KATASTROFA ({macro.activeDisaster.severityLabel}): {macro.activeDisaster.title}
            </div>
            <div className="text-[11px] text-slate-200 mt-0.5">
              {macro.activeDisaster.economicImpactSummary} · Pozostało cykli:{' '}
              <strong className="font-mono-tabular text-amber-300">
                {macro.activeDisaster.remainingTicks}
              </strong>
            </div>
          </div>
          {onOpenDisasterModal && (
            <button
              type="button"
              onClick={onOpenDisasterModal}
              className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 transition-colors cursor-pointer"
            >
              Otwórz Sztab Kryzysowy
            </button>
          )}
        </motion.div>
      )}
    </motion.section>
  );
};
