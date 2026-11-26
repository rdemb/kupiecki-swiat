import React from 'react';
import { motion } from 'motion/react';
import { COMMODITIES, CommodityId } from '../economy/economyEngine';
import {
  DRAGON_MISSIONS,
  DRAGON_SPECIES,
  DRAGON_STAGE_LABELS,
  DragonMissionType,
  DragonSanctuaryState,
  DragonSpeciesId,
  computeDragonGlobalBonuses,
} from '../economy/dragonBreeding';

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];
const ALL_SPECIES_IDS: DragonSpeciesId[] = Object.keys(DRAGON_SPECIES) as DragonSpeciesId[];

interface DragonSanctuaryPanelProps {
  sanctuary: DragonSanctuaryState;
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  feedbackMessage: string;
  onSelectCompanion: (dragonId: string) => void;
  onFeedDragon: (dragonId: string, feedMode: 'grain' | 'favorite_commodity') => void;
  onIncubateEgg: (eggId: string) => void;
  onBuyOrBreedEgg: (speciesId: DragonSpeciesId, isCrossBreed: boolean) => void;
  onDispatchMission: (dragonId: string, missionId: DragonMissionType) => void;
}

export const DragonSanctuaryPanel: React.FC<DragonSanctuaryPanelProps> = ({
  sanctuary,
  playerGold,
  playerInventory,
  feedbackMessage,
  onSelectCompanion,
  onFeedDragon,
  onIncubateEgg,
  onBuyOrBreedEgg,
  onDispatchMission,
}) => {
  const bonuses = computeDragonGlobalBonuses(sanctuary);
  const activeDragon =
    sanctuary.dragons.find((d) => d.id === sanctuary.activeCompanionId) ?? sanctuary.dragons[0];
  const activeSpec = activeDragon ? DRAGON_SPECIES[activeDragon.speciesId] : DRAGON_SPECIES.ogien;
  const stageMeta = activeDragon ? DRAGON_STAGE_LABELS[activeDragon.stage] : DRAGON_STAGE_LABELS[1];
  const nextStageThreshold =
    activeDragon && activeDragon.stage < 5
      ? DRAGON_STAGE_LABELS[(activeDragon.stage + 1) as 2 | 3 | 4 | 5].xpThreshold
      : DRAGON_STAGE_LABELS[5].xpThreshold;
  const xpProgressPct = activeDragon
    ? Math.min(100, Math.round((activeDragon.xp / Math.max(1, nextStageThreshold)) * 100))
    : 0;

  const favQtyRequired = activeSpec.favoriteCommodity === 'smocza_luska' ? 1 : 3;
  const heldFavQty = playerInventory[activeSpec.favoriteCommodity] ?? 0;
  const heldGrainQty = playerInventory.zboze ?? 0;

  return (
    <div className="space-y-3 text-slate-100">
      {/* Feedback Toast Strip */}
      {feedbackMessage && (
        <motion.div
          key={feedbackMessage}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
          className="bg-amber-950/50 border border-amber-500/60 text-amber-200 px-3 py-2 rounded-lg text-xs font-semibold"
        >
          {feedbackMessage}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left 5 Cols: Active 3D Companion Dragon Showcase + Feeding/Training */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
          className="lg:col-span-5 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3"
        >
          {activeDragon && (
            <>
              <div className="flex gap-3">
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-amber-500/50 shrink-0 bg-[#070a10]">
                  <img
                    src={activeSpec.artworkUrl}
                    alt={activeSpec.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div
                    className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-bold px-1 py-0.5 rounded bg-black/80"
                    style={{ color: activeSpec.accentHex }}
                  >
                    Stadium {activeDragon.stage}/5
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: activeSpec.accentHex }}>
                        {activeSpec.elementLabel} · Pok. {activeDragon.generation}
                      </div>
                      <h3 className="text-base font-bold text-white truncate">{activeDragon.name}</h3>
                      <div className="text-[11px] text-slate-400">{stageMeta.label}</div>
                    </div>
                  </div>

                  {/* XP & Energy Bars */}
                  <div className="space-y-1 pt-0.5">
                    <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400">
                      <span>Doświadczenie (XP)</span>
                      <span className="text-amber-300">
                        {activeDragon.xp} / {nextStageThreshold}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded bg-amber-400"
                        style={{ width: `${xpProgressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono-tabular text-slate-400">
                      <span>Energia Lotu</span>
                      <span className="text-sky-300">
                        {activeDragon.energy}/{activeDragon.maxEnergy}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded bg-sky-400"
                        style={{ width: `${Math.round((activeDragon.energy / activeDragon.maxEnergy) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dragon Core Attributes */}
              <div className="grid grid-cols-4 gap-1.5 font-mono-tabular text-center">
                <div className="bg-[#080b10] border border-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-slate-400">OGIEŃ</div>
                  <div className="text-xs font-bold text-orange-400">{activeDragon.firePower}</div>
                </div>
                <div className="bg-[#080b10] border border-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-slate-400">LOT</div>
                  <div className="text-xs font-bold text-emerald-400">{activeDragon.flightSpeed}</div>
                </div>
                <div className="bg-[#080b10] border border-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-slate-400">SKARBIEC</div>
                  <div className="text-xs font-bold text-amber-400">{activeDragon.hoardGreed}</div>
                </div>
                <div className="bg-[#080b10] border border-slate-800 rounded p-1.5">
                  <div className="text-[9px] text-slate-400">WIĘŹ</div>
                  <div className="text-xs font-bold text-sky-300">{activeDragon.bondPct}%</div>
                </div>
              </div>

              {/* Active Global Aura Bonuses */}
              <div className="bg-[#080b10] border border-amber-500/30 rounded-lg p-2.5 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Aktywna Aura Towarzysza 3D (Lata nad Mapą Świata)
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-mono-tabular">
                  <span className="text-rose-300">+{bonuses.knightAttackBonus} Ataku Rycerza</span>
                  <span className="text-emerald-300">+{bonuses.caravanSpeedBonusPct}% Prędkości Karawan</span>
                  <span className="text-amber-300">+{bonuses.duchyIncomeBonusPct}% Daniny Księstwa</span>
                  <span className="text-sky-300">+{bonuses.disasterResistancePct}% Odporności Kryzys.</span>
                </div>
              </div>

              {/* Feed & Train Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="btn-feed-dragon-grain"
                  disabled={playerGold < 420 || heldGrainQty < 12}
                  onClick={() => onFeedDragon(activeDragon.id, 'grain')}
                  className="min-h-[42px] px-2.5 py-1.5 rounded-lg bg-[#121a27] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[11px] font-bold text-white">Karm Zbożem (+48 XP)</div>
                  <div className="text-[10px] font-mono-tabular text-slate-400">
                    420 zł + 12x ZBO ({heldGrainQty})
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="btn-feed-dragon-favorite"
                  disabled={playerGold < 650 || heldFavQty < favQtyRequired}
                  onClick={() => onFeedDragon(activeDragon.id, 'favorite_commodity')}
                  className="min-h-[42px] px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[11px] font-bold">Przysmak (+95 XP)</div>
                  <div className="text-[10px] font-mono-tabular">
                    650 zł + {favQtyRequired}x {COMMODITIES.find((c) => c.id === activeSpec.favoriteCommodity)?.symbol} ({heldFavQty})
                  </div>
                </button>
              </div>
            </>
          )}
        </motion.div>

        {/* Middle 4 Cols: Egg Incubator, 4 Species Catalog & Cross-Breeding */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.04, ease: EASE_OUT_EXPO }}
          className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <h4 className="text-xs font-bold text-amber-400">
                Inkubator Jaj ({sanctuary.eggs.length}/4) & Hodowla 4 Ras
              </h4>
              {sanctuary.dragons.length >= 2 && (
                <button
                  type="button"
                  data-testid="btn-crossbreed-dragon"
                  disabled={playerGold < 1400 || sanctuary.eggs.length >= 4}
                  onClick={() => onBuyOrBreedEgg(activeDragon?.speciesId ?? 'zloto', true)}
                  className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-[10px] cursor-pointer"
                >
                  Krzyżuj Smoki (1400 zł)
                </button>
              )}
            </div>

            {/* Active Eggs */}
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
              {sanctuary.eggs.length === 0 ? (
                <div className="text-[11px] text-slate-400 bg-[#080b10] border border-slate-800 rounded p-2">
                  Brak jaj w inkubatorze. Kup jajo poniżej lub skrzyżuj dwa smoki!
                </div>
              ) : (
                sanctuary.eggs.map((egg) => {
                  const spec = DRAGON_SPECIES[egg.speciesId];
                  const ready = egg.incubationProgress >= 100;
                  return (
                    <div
                      key={egg.id}
                      className="bg-[#080b10] border border-slate-800 rounded p-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-white truncate">
                          {spec.name} ({egg.rarityLabel} · Pok.{egg.generation})
                        </div>
                        <div className="w-full h-1.5 rounded bg-slate-800 mt-1 overflow-hidden">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${egg.incubationProgress}%`,
                              backgroundColor: spec.accentHex,
                            }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`btn-incubate-egg-${egg.id}`}
                        disabled={!ready && playerGold < 450}
                        onClick={() => onIncubateEgg(egg.id)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                      >
                        {ready ? 'Wykluj!' : `Ogrzej (${egg.incubationProgress}%) · 450 zł`}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* 4 Elemental Dragon Species Egg Market (All 4 Bespoke Artworks) */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Jaja z hodowli kupieckich
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_SPECIES_IDS.map((sid) => {
                  const spec = DRAGON_SPECIES[sid];
                  return (
                    <div
                      key={sid}
                      className="bg-[#080b10] border border-slate-800 rounded-md p-1.5 flex items-center gap-2"
                    >
                      <img
                        src={spec.artworkUrl}
                        alt={spec.name}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded object-cover border border-slate-700 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-bold text-white truncate">
                          {spec.name.replace('Smok ', '')}
                        </div>
                        <button
                          type="button"
                          data-testid={`btn-buy-egg-${sid}`}
                          disabled={playerGold < spec.eggCostGold || sanctuary.eggs.length >= 4}
                          onClick={() => onBuyOrBreedEgg(sid, false)}
                          className="mt-0.5 w-full py-0.5 px-1.5 rounded bg-[#141d2b] hover:bg-amber-500 hover:text-slate-950 disabled:opacity-40 text-amber-300 font-mono-tabular font-bold text-[10px] transition-colors cursor-pointer"
                        >
                          {spec.eggCostGold} zł
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right 3 Cols: Aerial Dragon Expeditions & Roster Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, delay: 0.08, ease: EASE_OUT_EXPO }}
          className="lg:col-span-3 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5"
        >
          <div className="space-y-2">
            <div className="pb-1.5 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-xs font-bold text-sky-400">Wyprawy Powietrzne</h4>
              <span className="text-[10px] font-mono-tabular text-amber-300">
                Łup: {sanctuary.totalAerialGoldEarned} zł
              </span>
            </div>

            <div className="space-y-1.5">
              {DRAGON_MISSIONS.map((m) => {
                const locked = !activeDragon || activeDragon.stage < m.minStage;
                const lowEnergy = !activeDragon || activeDragon.energy < m.energyCost;
                const comm = COMMODITIES.find((c) => c.id === m.commodityReward.id);

                return (
                  <div
                    key={m.id}
                    className="bg-[#080b10] border border-slate-800 rounded p-2 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-white truncate">{m.name}</span>
                      <span className="text-[10px] font-mono-tabular text-sky-300 shrink-0">
                        -{m.energyCost} EN
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-mono-tabular">
                      ~{m.baseGoldReward} zł · +{m.xpReward} XP · +{m.commodityReward.qty}x {comm?.symbol}
                    </div>
                    <button
                      type="button"
                      data-testid={`btn-dragon-mission-${m.id}`}
                      disabled={locked || lowEnergy}
                      onClick={() => activeDragon && onDispatchMission(activeDragon.id, m.id)}
                      className="w-full py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                    >
                      {locked
                        ? `Wymaga Stadium ${m.minStage}`
                        : lowEnergy
                          ? 'Nakarm Smoka (Brak Energii)'
                          : 'Wyślij Smoka w Lot'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dragon Flock Roster Switcher */}
          <div className="pt-2 border-t border-slate-800 space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Twoje Smoki ({sanctuary.dragons.length}) — Wybierz Towarzysza 3D:
            </div>
            <div className="space-y-1 max-h-[82px] overflow-y-auto pr-0.5">
              {sanctuary.dragons.map((d) => {
                const isSelected = d.id === sanctuary.activeCompanionId;
                const sp = DRAGON_SPECIES[d.speciesId];
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSelectCompanion(d.id)}
                    className={`w-full px-2 py-1 rounded border text-left text-[11px] flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white font-bold'
                        : 'bg-[#080b10] border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">{d.name}</span>
                    <span className="font-mono-tabular text-[10px]" style={{ color: sp.accentHex }}>
                      St.{d.stage} · {d.energy}EN
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
