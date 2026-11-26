import React, { useState } from 'react';
import { COMMODITIES, CommodityId } from '../economy/economyEngine';
import {
  DUCHY_BUILDINGS,
  DuchyBuildingSpec,
  DuchyState,
  KnightState,
  MAGE_SPELLS,
  MageSpellSpec,
  STORY_CAMPAIGN_CHAPTERS,
  StoryChapterSpec,
} from '../economy/gameData';
import {
  AchievementSpec,
  ROYAL_SUPPLY_CONTRACTS,
  RoyalSupplyContract,
  WORLD_ACHIEVEMENTS,
  calculateNobleRank,
  evaluateAchievementProgress,
} from '../economy/achievementsAndQuests';
import { WORLD_CONTINENTS } from '../economy/worldMapData';
import {
  DragonMissionType,
  DragonSanctuaryState,
  DragonSpeciesId,
} from '../economy/dragonBreeding';
import { DragonSanctuaryPanel } from './DragonSanctuaryPanel';

import { InnGuide } from './InnGuide';
interface DuchyAndStoryCampaignPanelProps {
  duchy: DuchyState;
  knight: KnightState;
  playerGold: number;
  netWorth: number;
  tradesExecutedCount: number;
  unlockedTechCount: number;
  prestigePoints: number;
  completedContractIds: string[];
  claimedAchievementIds: string[];
  playerInventory: Record<CommodityId, number>;
  onClaimStoryChapter: (chapter: StoryChapterSpec) => void;
  onUpgradeDuchyBuilding: (building: DuchyBuildingSpec, costGold: number, reqQty: number) => void;
  onCastMageSpell: (spell: MageSpellSpec) => void;
  onRecruitForces: (unitType: 'guards' | 'galleons' | 'dragon_feed', costGold: number) => void;
  weatherLabel:string; grain:number; baseGrain:number; muted:boolean;
  onCollectDuchyTribute: () => void;
  onCompleteRoyalContract: (contract: RoyalSupplyContract) => void;
  onClaimAchievement: (achievement: AchievementSpec) => void;
  dragonSanctuary?: DragonSanctuaryState;
  dragonFeedback?: string;
  onSelectCompanionDragon?: (dragonId: string) => void;
  onFeedDragon?: (dragonId: string, feedMode: 'grain' | 'favorite_commodity') => void;
  onIncubateEgg?: (eggId: string) => void;
  onBuyOrBreedEgg?: (speciesId: DragonSpeciesId, isCrossBreed: boolean) => void;
  onDispatchDragonMission?: (dragonId: string, missionId: DragonMissionType) => void;
}

export const DuchyAndStoryCampaignPanel: React.FC<DuchyAndStoryCampaignPanelProps> = ({
  duchy,
  knight,
  playerGold,
  netWorth,
  tradesExecutedCount,
  unlockedTechCount,
  prestigePoints,
  completedContractIds,
  claimedAchievementIds,
  playerInventory,
  onClaimStoryChapter,
  onUpgradeDuchyBuilding,
  onCastMageSpell,
  onRecruitForces,
  weatherLabel,grain,baseGrain,muted,onCollectDuchyTribute,
  onCompleteRoyalContract,
  onClaimAchievement,
  dragonSanctuary,
  dragonFeedback = '',
  onSelectCompanionDragon,
  onFeedDragon,
  onIncubateEgg,
  onBuyOrBreedEgg,
  onDispatchDragonMission,
}) => {
  const [subView, setSubView] = useState<'campaign_duchy' | 'dragon_sanctuary' | 'contracts_achievements'>('campaign_duchy');
  const [spellPulse, setSpellPulse] = useState<string>('');

  const totalBuildingLevels =
    duchy.buildings.faktoria +
    duchy.buildings.koszary +
    duchy.buildings.wieza_magow +
    duchy.buildings.stocznia;

  const totalCycleGoldIncome =
    duchy.buildings.faktoria * 420 +
    duchy.buildings.koszary * 260 +
    duchy.buildings.wieza_magow * 340 +
    duchy.buildings.stocznia * 520 +
    duchy.fleetGalleonsCount * 160;

  const currentChapter =
    STORY_CAMPAIGN_CHAPTERS.find((ch) => !duchy.completedChapterIds.includes(ch.id)) ??
    STORY_CAMPAIGN_CHAPTERS[STORY_CAMPAIGN_CHAPTERS.length - 1];

  const dragonStageLabel =
    duchy.dragonCompanionStage === 1
      ? 'Młode Pisklę Strażnicze (+10% Siły i Łupów)'
      : duchy.dragonCompanionStage === 2
        ? 'Skrzydlaty Smok Bojowy (+25% Siły i Łupów)'
        : 'Pradawny Smok Władcy Księstwa (+45% Siły i Łupów)';

  const nobleRank = calculateNobleRank({
    netWorth,
    prestigePoints,
    monstersDefeated: knight.monstersDefeated,
    contractsCompleted: completedContractIds.length,
  });

  const metrics = {
    tradesExecuted: tradesExecutedCount,
    netWorth,
    monstersDefeated: knight.monstersDefeated,
    buildingLevels: totalBuildingLevels,
    contractsCompleted: completedContractIds.length,
    unlockedTechs: unlockedTechCount,
    fleetGalleons: duchy.fleetGalleonsCount,
    chaptersCompleted: duchy.completedChapterIds.length,
  };

  const readyToClaimCount = WORLD_ACHIEVEMENTS.filter(
    (ach) =>
      !claimedAchievementIds.includes(ach.id) &&
      evaluateAchievementProgress(ach, metrics).unlocked,
  ).length;

  return (
    <div className="space-y-3 text-slate-100">
      {/* Sub-View Switcher + Noble Rank Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0c1118] border border-slate-800 rounded-lg px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubView('campaign_duchy')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
              subView === 'campaign_duchy'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#111722] text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            Kampania, Księstwo i Magia
          </button>
          {dragonSanctuary && (
            <button
              type="button"
              data-testid="subtab-dragon-sanctuary"
              onClick={() => setSubView('dragon_sanctuary')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                subView === 'dragon_sanctuary'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-[#111722] text-amber-300 hover:bg-slate-800 border border-amber-500/40'
              }`}
            >
              Hodowla Smoków ({dragonSanctuary.dragons.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setSubView('contracts_achievements')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
              subView === 'contracts_achievements'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#111722] text-slate-300 hover:bg-slate-800 border border-slate-700'
            }`}
          >
            Kontrakty Królewskie i Osiągnięcia
            {readyToClaimCount > 0 ? ` (${readyToClaimCount} do odbioru)` : ''}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div>
            <span className="text-slate-400">Ranga Szlachecka: </span>
            <strong className="text-amber-400">
              {nobleRank.rankTitle} (Poz. {nobleRank.tier}/6)
            </strong>
          </div>
          <div className="font-mono-tabular text-slate-300">
            Prestiż: <strong className="text-sky-400">{prestigePoints} pkt</strong>
            {nobleRank.nextRankTitle && (
              <span className="text-slate-400">
                {' '}· Następna ({nobleRank.nextRankTitle}): -{nobleRank.pointsToNext} pkt
              </span>
            )}
          </div>
        </div>
      </div>

      {subView === 'dragon_sanctuary' && dragonSanctuary ? (
        <DragonSanctuaryPanel
          sanctuary={dragonSanctuary}
          playerGold={playerGold}
          playerInventory={playerInventory}
          feedbackMessage={dragonFeedback}
          onSelectCompanion={(id) => onSelectCompanionDragon?.(id)}
          onFeedDragon={(id, mode) => onFeedDragon?.(id, mode)}
          onIncubateEgg={(id) => onIncubateEgg?.(id)}
          onBuyOrBreedEgg={(sp, cross) => onBuyOrBreedEgg?.(sp, cross)}
          onDispatchMission={(id, mid) => onDispatchDragonMission?.(id, mid)}
        />
      ) : subView === 'campaign_duchy' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 4 Cols: Original Kupiecki Świat Story Campaign */}
          <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-amber-400">
                    Kampania Fabularna: Od Kupca do Władcy Księstwa
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Ukończono Aktów: {duchy.completedChapterIds.length} / {STORY_CAMPAIGN_CHAPTERS.length}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs text-amber-100">{weatherLabel} · Zbiór zboża {grain} szt. (bazowo {baseGrain})</p>
              <InnGuide cue="pola" muted={muted}/>
              <div className="space-y-2 mt-2.5 max-h-[285px] overflow-y-auto pr-1">
                {STORY_CAMPAIGN_CHAPTERS.map((ch) => {
                  const isDone = duchy.completedChapterIds.includes(ch.id);
                  const isCurrent = ch.id === currentChapter.id && !isDone;
                  const meetsReqs =
                    !isDone &&
                    netWorth >= ch.reqNetWorth &&
                    tradesExecutedCount >= ch.reqTradesCount &&
                    knight.monstersDefeated >= ch.reqMonstersDefeated &&
                    totalBuildingLevels >= ch.reqDuchyTotalBuildingLevels;

                  const rewComm = COMMODITIES.find((c) => c.id === ch.rewardCommodity.id);

                  return (
                    <div
                      key={ch.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isDone
                          ? 'bg-emerald-950/25 border-emerald-500/50'
                          : isCurrent
                            ? 'bg-amber-500/15 border-amber-400'
                            : 'bg-[#080b10] border-slate-800 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{ch.title}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isDone ? 'UKOŃCZONO' : `Tytuł: ${ch.rankTitleEarned}`}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        {ch.loreNarrative}
                      </p>

                      <div className="text-[10px] font-mono-tabular text-slate-400 mt-1.5 pt-1 border-t border-slate-800/80 space-y-0.5">
                        <div>Cel: {ch.requirementSummary}</div>
                        <div className="text-emerald-400">
                          Nagroda: +{ch.rewardGold} zł · +{ch.rewardCommodity.qty}x {rewComm?.name}
                        </div>
                      </div>

                      {!isDone && (
                        <button
                          type="button"
                          disabled={!meetsReqs}
                          onClick={() => onClaimStoryChapter(ch)}
                          className="mt-2 min-h-[36px] w-full py-1.5 px-3 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                        >
                          {meetsReqs
                            ? `Odbierz Koronę Aktu ${ch.chapterNumber} (+${ch.rewardGold} zł)`
                            : `Postęp: Majątek ${Math.min(netWorth, ch.reqNetWorth)}/${ch.reqNetWorth} zł · Bestie ${knight.monstersDefeated}/${ch.reqMonstersDefeated}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center 4 Cols: Duchy & City Infrastructure Management */}
          <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-white">{duchy.duchyName}</h3>
                  <p className="text-[11px] text-amber-400">
                    Infrastruktura Miejska · Dochód: +{totalCycleGoldIncome} zł/cykl
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCollectDuchyTribute}
                  className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
                >
                  Zbierz Daninę (+{Math.round(totalCycleGoldIncome * 0.5)} zł)
                </button>
              </div>

              <p className="mt-2 text-xs text-amber-100">{weatherLabel} · Zbiór zboża {grain} szt. (bazowo {baseGrain})</p>
              <InnGuide cue="pola" muted={muted}/>
              <div className="space-y-2 mt-2.5 max-h-[285px] overflow-y-auto pr-1">
                {DUCHY_BUILDINGS.map((b) => {
                  const currentLvl = duchy.buildings[b.id] ?? 1;
                  const costGold = Math.round(b.baseCostGold * Math.pow(1.45, currentLvl - 1));
                  const reqQty = Math.round(b.requiredCommodity.baseQty * currentLvl);
                  const reqComm = COMMODITIES.find((c) => c.id === b.requiredCommodity.id);
                  const heldComm = playerInventory[b.requiredCommodity.id] ?? 0;
                  const canUpgrade = playerGold >= costGold && heldComm >= reqQty;

                  return (
                    <div
                      key={b.id}
                      className="bg-[#080b10] border border-slate-800 rounded-lg p-2.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {b.name} (Poz. {currentLvl})
                        </span>
                        <span className="text-[11px] font-mono-tabular text-amber-400">
                          +{b.incomeGoldPerLevel * currentLvl} zł
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{b.loreDesc}</p>
                      <div className="text-[10px] text-emerald-400 font-medium">
                        {b.specialEffectText}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
                        <span className="font-mono-tabular text-slate-400">
                          Koszt: <strong className="text-white">{costGold} zł</strong> +{' '}
                          <strong className={heldComm >= reqQty ? 'text-emerald-400' : 'text-rose-400'}>
                            {reqQty}x {reqComm?.symbol}
                          </strong>
                        </span>
                        <button
                          type="button"
                          disabled={!canUpgrade}
                          onClick={() => onUpgradeDuchyBuilding(b, costGold, reqQty)}
                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] cursor-pointer"
                        >
                          Rozbuduj na Poz. {currentLvl + 1}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 4 Cols: Mage Tower Spells, Naval Fleet, Army & Dragon Guardian */}
          <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-sky-400">
                    {duchy.mageName} (Kolegium Magii Poz. {duchy.buildings.wieza_magow})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Zwoje Pergaminu:{' '}
                    <strong className="text-white">{playerInventory.runiczny_pergamin ?? 0} szt.</strong>
                  </p>
                </div>
                <div className="text-right font-mono-tabular">
                  <div className="text-xs font-bold text-sky-400">
                    Mana: {duchy.mageMana}/{duchy.mageMaxMana}
                  </div>
                  <div className="text-[10px] text-slate-400">Odnawiana co cykl</div>
                </div>
              </div>

              {spellPulse && (
                <div className="bg-sky-950/70 border border-sky-400 text-sky-200 text-xs font-bold px-2.5 py-1.5 rounded">
                  {spellPulse}
                </div>
              )}

              <div className="space-y-1.5">
                {MAGE_SPELLS.map((sp) => {
                  const hasMana = duchy.mageMana >= sp.manaCost;
                  const hasScroll = (playerInventory.runiczny_pergamin ?? 0) >= sp.scrollCost;
                  const canCast = hasMana && hasScroll;

                  return (
                    <div
                      key={sp.id}
                      className="bg-[#080b10] border border-slate-800 rounded p-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate">{sp.name}</div>
                        <div className="text-[10px] text-sky-300">{sp.effectLabel}</div>
                        <div className="text-[10px] text-slate-400 font-mono-tabular">
                          Wymaga: {sp.manaCost} Many + {sp.scrollCost}x Pergamin
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!canCast}
                        onClick={() => {
                          setSpellPulse(`Rzucono zaklęcie: ${sp.name}!`);
                          window.setTimeout(() => setSpellPulse(''), 2200);
                          onCastMageSpell(sp);
                        }}
                        className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        Rzuć Czar
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[#080b10] border border-slate-800 rounded-lg p-2.5 space-y-2 text-xs">
                <div className="font-bold text-amber-400 border-b border-slate-800 pb-1">
                  Siły Zbrojne Księstwa, Flota i Smoczy Strażnik
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      Gwardia Rycerska: {duchy.armyGuardsCount} zbrojnych
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Wzmacnia obronę karawan i ataki Rycerza
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={playerGold < 900}
                    onClick={() => onRecruitForces('guards', 900)}
                    className="px-2 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 disabled:opacity-40 text-amber-300 font-semibold text-[11px] cursor-pointer"
                  >
                    +15 Gwardii (900 zł)
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-white">
                      Flota Morska: {duchy.fleetGalleonsCount} galeonów
                    </div>
                    <div className="text-[10px] text-slate-400">
                      +{duchy.fleetGalleonsCount * 160} zł z handlu transoceanicznego
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={playerGold < 1600}
                    onClick={() => onRecruitForces('galleons', 1600)}
                    className="px-2 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 disabled:opacity-40 text-sky-300 font-semibold text-[11px] cursor-pointer"
                  >
                    +1 Galeon (1600 zł)
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <div>
                    <div className="font-semibold text-rose-400">{duchy.dragonCompanionName}</div>
                    <div className="text-[10px] text-slate-300">{dragonStageLabel}</div>
                  </div>
                  {duchy.dragonCompanionStage < 3 ? (
                    <button
                      type="button"
                      disabled={playerGold < 2800}
                      onClick={() => onRecruitForces('dragon_feed', 2800)}
                      className="px-2 py-1 rounded bg-rose-600/90 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Rozwiń Smoka (2800 zł)
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-400">Maks. Forma</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 6 Cols: Intercontinental Royal Supply Contracts */}
          <div className="lg:col-span-6 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  Kontrakty Królewskie Czterech Kontynentów
                </h3>
                <p className="text-[11px] text-slate-400">
                  Dostarczaj towary ze spichlerza do stolic świata, zdobywając Złoto i Prestiż Szlachecki.
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-emerald-400">
                {completedContractIds.length} / {ROYAL_SUPPLY_CONTRACTS.length}
              </span>
            </div>

            <div className="space-y-2 max-h-[295px] overflow-y-auto pr-1">
              {ROYAL_SUPPLY_CONTRACTS.map((contract) => {
                const isDone = completedContractIds.includes(contract.id);
                const comm = COMMODITIES.find((c) => c.id === contract.commodityId);
                const continent = WORLD_CONTINENTS.find((c) => c.id === contract.issuingContinent);
                const held = playerInventory[contract.commodityId] ?? 0;
                const canFulfill = !isDone && held >= contract.requiredQty;

                return (
                  <div
                    key={contract.id}
                    className={`p-3 rounded-lg border ${
                      isDone
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : 'bg-[#080b10] border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{contract.title}</span>
                      <span className="text-[10px] font-semibold text-amber-300 shrink-0">
                        {contract.issuingCityName} · {continent?.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{contract.loreText}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1.5 border-t border-slate-800/80 text-[11px]">
                      <div className="font-mono-tabular space-x-2">
                        <span className="text-slate-400">
                          Wymagane:{' '}
                          <strong className={held >= contract.requiredQty ? 'text-emerald-400' : 'text-rose-400'}>
                            {held}/{contract.requiredQty}x {comm?.name}
                          </strong>
                        </span>
                        <span className="text-amber-400">
                          +{contract.rewardGold} zł · +{contract.rewardPrestige} Prestiżu
                        </span>
                      </div>

                      {isDone ? (
                        <span className="text-[10px] font-bold text-emerald-400">ZREALIZOWANO</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canFulfill}
                          onClick={() => onCompleteRoyalContract(contract)}
                          className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                        >
                          Dostarcz Kontrakt
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 6 Cols: World Achievements & Noble Rank Ladder */}
          <div className="lg:col-span-6 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-sky-400">
                  Osiągnięcia Świata i Drabina Rangi Szlacheckiej
                </h3>
                <p className="text-[11px] text-slate-400">
                  Odbieraj nagrody za handel, walki z bossami, flotę i rozwój Księstwa.
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-bold text-sky-400">
                {claimedAchievementIds.length} / {WORLD_ACHIEVEMENTS.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[295px] overflow-y-auto pr-1">
              {WORLD_ACHIEVEMENTS.map((ach) => {
                const isClaimed = claimedAchievementIds.includes(ach.id);
                const prog = evaluateAchievementProgress(ach, metrics);

                return (
                  <div
                    key={ach.id}
                    className={`p-2.5 rounded-lg border flex flex-col justify-between gap-2 ${
                      isClaimed
                        ? 'bg-emerald-950/20 border-emerald-500/40'
                        : prog.unlocked
                          ? 'bg-amber-500/10 border-amber-400/70'
                          : 'bg-[#080b10] border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white">{ach.title}</span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {ach.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                        {ach.description}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <div className="w-full h-1.5 rounded bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isClaimed ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                        <span className="text-slate-300">
                          {prog.current.toLocaleString('pl-PL')} / {prog.target.toLocaleString('pl-PL')}
                        </span>
                        <span className="text-emerald-400">
                          +{ach.rewardGold} zł · +{ach.rewardPrestige} pkt
                        </span>
                      </div>

                      {isClaimed ? (
                        <div className="text-center text-[10px] font-bold text-emerald-400 py-1">
                          ODEBRANO NAGRODĘ
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!prog.unlocked}
                          onClick={() => onClaimAchievement(ach)}
                          className="w-full py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                        >
                          {prog.unlocked ? 'Odbierz Nagrodę' : `Postęp ${prog.pct}%`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
