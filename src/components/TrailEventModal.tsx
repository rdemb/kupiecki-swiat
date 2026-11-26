import React from 'react';
import { COMMODITIES } from '../economy/economyEngine';
import { WORLD_CONTINENTS } from '../economy/worldMapData';
import { ActiveTrailEvent, TrailEventOutcome } from '../economy/trailEvents';
import { getPbrWeatherParams } from '../world3d/pbrWeather';

interface TrailEventModalProps {
  event: ActiveTrailEvent;
  outcome: TrailEventOutcome | null;
  playerGold: number;
  knightStrength: number;
  knightHp: number;
  knightMaxHp: number;
  onSelectChoice: (choiceId: string) => void;
  onClose: () => void;
}

const TIME_LABELS: Record<string, string> = {
  golden_hour: 'Złota Godzina',
  midday: 'Południe',
  dusk: 'Zmierzch',
  night: 'Noc',
};

export const TrailEventModal: React.FC<TrailEventModalProps> = ({
  event,
  outcome,
  playerGold,
  knightStrength,
  knightHp,
  knightMaxHp,
  onSelectChoice,
  onClose,
}) => {
  const continent = WORLD_CONTINENTS.find((c) => c.id === event.continentId);
  const weather = getPbrWeatherParams(event.spawnedAtWeather);
  const comm = COMMODITIES.find((c) => c.id === event.commodityId);

  const accentBorder =
    event.severity === 'danger'
      ? 'border-rose-500/70'
      : event.severity === 'mystery'
        ? 'border-purple-400/70'
        : 'border-amber-400/70';

  const badgeClass =
    event.severity === 'danger'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : event.severity === 'mystery'
        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
        : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Zdarzenie na szlaku: ${event.title}`}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <div
        className={`w-full max-w-xl bg-[#0b1018] border ${accentBorder} rounded-xl shadow-2xl overflow-hidden text-slate-100`}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#101724] border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded border font-bold ${badgeClass}`}>
                {event.categoryLabel}
              </span>
              <span className="text-slate-400 font-medium">
                {continent?.name} · {TIME_LABELS[event.spawnedAtTime] ?? event.spawnedAtTime} · {weather.shortLabel}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white leading-snug">{event.title}</h2>
            <div className="text-xs text-amber-300/90 font-medium">{event.regionName}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij okno zdarzenia"
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
          >
            Zamknij
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-200 leading-relaxed">{event.loreText}</p>

          {/* Compact Player Readiness Telemetry */}
          <div className="grid grid-cols-3 gap-2 bg-[#070a10] border border-slate-800 rounded-lg p-2.5 text-xs">
            <div>
              <div className="text-[10px] text-slate-400">TWOJE ZŁOTO</div>
              <div className="font-mono-tabular font-bold text-amber-400">
                {Math.round(playerGold).toLocaleString('pl-PL')} zł
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">RYCERZ (SIŁA / HP)</div>
              <div className="font-mono-tabular font-bold text-rose-400">
                Siła {knightStrength} · {knightHp}/{knightMaxHp} HP
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">SUROWIEC ZDARZENIA</div>
              <div className="font-bold text-emerald-400 truncate">
                {comm?.name ?? event.commodityId}
              </div>
            </div>
          </div>

          {outcome ? (
            <div
              className={`p-4 rounded-lg border space-y-2 ${
                outcome.success
                  ? outcome.bypassed
                    ? 'bg-slate-900/90 border-slate-600'
                    : 'bg-emerald-950/35 border-emerald-500/60'
                  : 'bg-rose-950/35 border-rose-500/60'
              }`}
            >
              <div className="text-sm font-bold text-white">{outcome.headline}</div>
              <p className="text-xs text-slate-200 leading-relaxed">{outcome.narrative}</p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono-tabular">
                {outcome.goldDelta !== 0 && (
                  <span className={outcome.goldDelta > 0 ? 'text-amber-400 font-bold' : 'text-rose-300 font-bold'}>
                    {outcome.goldDelta > 0 ? `+${outcome.goldDelta}` : outcome.goldDelta} zł
                  </span>
                )}
                {outcome.commodityDelta && (
                  <span className="text-emerald-400 font-bold">
                    +{outcome.commodityDelta.qty}x {COMMODITIES.find((c) => c.id === outcome.commodityDelta?.id)?.name}
                  </span>
                )}
                {outcome.prestigeDelta > 0 && (
                  <span className="text-sky-400 font-bold">+{outcome.prestigeDelta} Prestiżu</span>
                )}
                {outcome.knightHpDelta < 0 && (
                  <span className="text-rose-400 font-bold">{outcome.knightHpDelta} HP Rycerza</span>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full min-h-[40px] rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Kontynuuj Podróż po Świecie
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400">
                Wybierz reakcję na zdarzenie (Interakcja lub Ominięcie):
              </div>
              {event.choices.map((ch) => {
                const lacksGold = Boolean(ch.costGold && playerGold < ch.costGold);
                const btnStyle =
                  ch.kind === 'interact'
                    ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/70'
                    : ch.kind === 'tactical'
                      ? 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/50'
                      : 'bg-[#080b10] hover:bg-slate-800/80 border-slate-700';

                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={lacksGold}
                    onClick={() => onSelectChoice(ch.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${btnStyle}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{ch.label}</span>
                      <span className="text-[11px] font-mono-tabular text-emerald-300 shrink-0">
                        {ch.rewardHint}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">{ch.subtitle}</div>
                    {lacksGold && (
                      <div className="text-[10px] text-rose-400 font-semibold mt-0.5">
                        Wymagane {ch.costGold} zł (brak środków)
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
