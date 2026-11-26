import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { COMMODITIES, CommodityId } from '../economy/economyEngine';
import { WORLD_CONTINENTS } from '../economy/worldMapData';
import {
  ActiveWorldDisaster,
  DisasterMitigationResult,
  getDisasterTemplateById,
} from '../economy/worldDisasters';

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface DisasterEventModalProps {
  disaster: ActiveWorldDisaster | null;
  lastResult: DisasterMitigationResult | null;
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  hasDragonCompanion: boolean;
  onSelectMitigation: (optionId: string) => void;
  onClose: () => void;
}

export const DisasterEventModal: React.FC<DisasterEventModalProps> = ({
  disaster,
  lastResult,
  playerGold,
  playerInventory,
  hasDragonCompanion,
  onSelectMitigation,
  onClose,
}) => {
  if (!disaster && !lastResult) return null;

  const template = disaster ? getDisasterTemplateById(disaster.templateId) : null;
  const continent = disaster
    ? WORLD_CONTINENTS.find((c) => c.id === disaster.continentId)
    : null;

  const priceImpactEntries = disaster
    ? (Object.entries(disaster.priceMultipliers) as Array<[CommodityId, number]>)
    : [];

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Sztab Kryzysowy Katastrofy Świata"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
          className="max-w-2xl w-full bg-[#0b1018] border border-rose-500/60 rounded-xl overflow-hidden shadow-2xl text-slate-100"
        >
          {/* Header */}
          <div
            className="px-5 py-3.5 border-b border-slate-800 flex items-start justify-between gap-3"
            style={{
              background: disaster
                ? `linear-gradient(90deg, ${disaster.accentHex}24 0%, #0b1018 75%)`
                : '#0b1018',
            }}
          >
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                {disaster
                  ? `${disaster.severityLabel} · ${continent?.name ?? 'Świat'}`
                  : 'Raport Sztabu Kryzysowego'}
              </div>
              <h2 className="font-display text-xl font-bold text-white mt-0.5">
                {disaster ? disaster.title : 'Katastrofa Opanowana'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              Zamknij
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
            {disaster && (
              <>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {disaster.description}
                </p>

                {/* Economic & Physics Shock Telemetry */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="bg-[#080b10] border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase">Prędkość Karawan 3D</div>
                    <div className="font-mono-tabular text-base font-bold text-rose-400 mt-0.5">
                      {Math.round(disaster.caravanSpeedMultiplier * 100)}% normy
                    </div>
                  </div>
                  <div className="bg-[#080b10] border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase">Szok Podaży Rynku</div>
                    <div className="font-mono-tabular text-base font-bold text-amber-400 mt-0.5">
                      {Math.round(disaster.supplyShockMultiplier * 100)}% zapasów
                    </div>
                  </div>
                  <div className="bg-[#080b10] border border-slate-800 rounded-lg p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase">Czas Trwania</div>
                    <div className="font-mono-tabular text-base font-bold text-sky-300 mt-0.5">
                      {disaster.remainingTicks} / {disaster.totalTicks} cykli
                    </div>
                  </div>
                </div>

                {/* Price Shock Breakdown */}
                {priceImpactEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-[#080b10] border border-slate-800 rounded-lg px-3 py-2 text-xs">
                    <span className="text-slate-400 font-semibold">Skok cen na giełdzie:</span>
                    {priceImpactEntries.map(([cid, mult]) => {
                      const comm = COMMODITIES.find((c) => c.id === cid);
                      return (
                        <span
                          key={cid}
                          className="font-mono-tabular px-2 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold"
                        >
                          {comm?.name ?? cid} +{Math.round((mult - 1) * 100)}%
                        </span>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Resolution Feedback Banner */}
            {lastResult && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className={`p-3 rounded-lg border text-xs font-semibold ${
                  lastResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                    : 'bg-rose-950/50 border-rose-500/60 text-rose-200'
                }`}
              >
                {lastResult.success ? lastResult.logMessage : lastResult.errorMessage}
              </motion.div>
            )}

            {/* Mitigation Action Cards */}
            {disaster && template && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-400">
                    Wybierz Reakcję Księstwa i Gildii:
                  </span>
                  <span className="font-mono-tabular text-slate-400">
                    Twoje złoto: <strong className="text-amber-300">{Math.round(playerGold)} zł</strong>
                  </span>
                </div>

                <div className="space-y-2">
                  {template.mitigationOptions.map((opt, idx) => {
                    const reqComm = opt.requiredCommodity
                      ? COMMODITIES.find((c) => c.id === opt.requiredCommodity!.id)
                      : null;
                    const rewComm = opt.rewardCommodity
                      ? COMMODITIES.find((c) => c.id === opt.rewardCommodity!.id)
                      : null;
                    const heldQty = opt.requiredCommodity
                      ? playerInventory[opt.requiredCommodity.id] ?? 0
                      : 0;
                    const hasGold = playerGold >= opt.costGold;
                    const hasComm = !opt.requiredCommodity || heldQty >= opt.requiredCommodity.qty;
                    const canExecute = hasGold && hasComm;

                    return (
                      <motion.div
                        key={opt.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: idx * 0.04, ease: EASE_OUT_EXPO }}
                        className="bg-[#0e1520] border border-slate-800 hover:border-amber-500/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-white">{opt.label}</span>
                            {opt.requiresDragonOrKnight && hasDragonCompanion && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Bonus Smoka (+450 zł)
                              </span>
                            )}
                            {opt.clearsDisasterImmediately && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                Usuwa Katastrofę
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-300">{opt.description}</p>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono-tabular pt-0.5">
                            <span className={hasGold ? 'text-slate-300' : 'text-rose-400'}>
                              Koszt: <strong>{opt.costGold} zł</strong>
                              {opt.requiredCommodity && (
                                <>
                                  {' '}
                                  +{' '}
                                  <strong className={hasComm ? 'text-emerald-300' : 'text-rose-400'}>
                                    {opt.requiredCommodity.qty}x {reqComm?.symbol} ({heldQty})
                                  </strong>
                                </>
                              )}
                            </span>
                            <span className="text-emerald-400">
                              Nagroda: +{opt.rewardGold} zł · +{opt.rewardPrestige} Prestiżu
                              {rewComm && opt.rewardCommodity
                                ? ` · +${opt.rewardCommodity.qty}x ${rewComm.symbol}`
                                : ''}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          data-testid={`disaster-option-${opt.id}`}
                          disabled={!canExecute}
                          onClick={() => onSelectMitigation(opt.id)}
                          className="min-h-[38px] px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs shrink-0 transition-colors cursor-pointer"
                        >
                          Wykonaj Akcję
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {!disaster && lastResult && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  Powrót do Świata 3D
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
