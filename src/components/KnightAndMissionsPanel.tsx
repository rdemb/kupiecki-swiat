import React, { useMemo, useState } from 'react';
import {
  CITIES,
  COMMODITIES,
  CommodityId,
} from '../economy/economyEngine';
import {
  KnightState,
  MONSTER_QUESTS,
  MonsterQuestSpec,
} from '../economy/gameData';
import {
  EquipmentSlot,
  HERO_BANNER_COLORS,
  HERO_PATHS,
  HERO_PORTRAITS,
  HeroPathId,
  RPG_ITEM_CATALOG,
  RpgEquipmentItem,
  computeDerivedHeroStats,
  getHeroItemById,
  getRarityStyles,
} from '../economy/heroProgression';

interface KnightAndMissionsPanelProps {
  knight: KnightState;
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  combatTechBonus: number;
  onTrainKnightStat: (stat: 'strength' | 'defense' | 'tactics' | 'heal', costGold: number) => void;
  onBuyHeroItem: (item: RpgEquipmentItem) => void;
  onEquipHeroItem: (itemId: string) => void;
  onUnequipHeroSlot: (slot: EquipmentSlot) => void;
  onCustomizeHero: (updates: {
    name?: string;
    title?: string;
    portraitId?: string;
    bannerColorHex?: string;
    activePath?: HeroPathId;
  }) => void;
  onAllocateSkillPoint: (pathId: HeroPathId) => void;
  onScoutForLoot: () => void;
  onStartKnightQuest: (quest: MonsterQuestSpec) => void;
  onExecuteKnightTurn: (tactic: 'aggressive' | 'balanced' | 'defensive') => void;
  onRestockKnightTurnsWithGrain: (grainCost: number, goldCost: number) => void;
  onOpenGarrison?: () => void;
  onOpenKnightArena?: () => void;
}

const SLOT_ORDER: Array<{ slot: EquipmentSlot; label: string }> = [
  { slot: 'weapon', label: 'Broń' },
  { slot: 'armor', label: 'Pancerz' },
  { slot: 'mount', label: 'Wierzchowiec' },
  { slot: 'relic', label: 'Relikt' },
];

export const KnightAndMissionsPanel: React.FC<KnightAndMissionsPanelProps> = ({
  knight,
  playerGold,
  playerInventory,
  combatTechBonus,
  onTrainKnightStat,
  onBuyHeroItem,
  onEquipHeroItem,
  onUnequipHeroSlot,
  onCustomizeHero,
  onAllocateSkillPoint,
  onScoutForLoot,
  onStartKnightQuest,
  onExecuteKnightTurn,
  onRestockKnightTurnsWithGrain,
  onOpenKnightArena,
  onOpenGarrison,
}) => {
  const [subView, setSubView] = useState<'expeditions' | 'personalization' | 'armory'>('expeditions');
  const [selectedQuestId, setSelectedQuestId] = useState<string>(MONSTER_QUESTS[0].id);
  const [selectedTactic, setSelectedTactic] = useState<'aggressive' | 'balanced' | 'defensive'>('balanced');
  const [combatPulse, setCombatPulse] = useState<boolean>(false);
  const [floatingHitText, setFloatingHitText] = useState<string>('');
  const [nameDraft, setNameDraft] = useState<string>(knight.name);
  const [titleDraft, setTitleDraft] = useState<string>(knight.title);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const derived = useMemo(() => computeDerivedHeroStats(knight), [knight]);

  const activePortrait =
    HERO_PORTRAITS.find((p) => p.id === knight.portraitId) ?? HERO_PORTRAITS[0];
  const activePathSpec =
    HERO_PATHS.find((p) => p.id === knight.activePath) ?? HERO_PATHS[0];

  const selectedQuest =
    MONSTER_QUESTS.find((q) => q.id === (knight.activeQuest?.questId ?? selectedQuestId)) ??
    MONSTER_QUESTS[0];

  const triggerGameFeelHit = (label: string) => {
    setCombatPulse(true);
    setFloatingHitText(label);
    window.setTimeout(() => setCombatPulse(false), 260);
    window.setTimeout(() => setFloatingHitText(''), 1100);
  };

  const trainCost = Math.round(450 + knight.level * 180);
  const healCost = 250;
  const scoutCostGold = 180;
  const xpPct = Math.min(100, Math.round((knight.xp / Math.max(1, knight.xpToNextLevel)) * 100));
  const hpPct = Math.min(100, Math.round((knight.hp / Math.max(1, derived.effectiveMaxHp)) * 100));

  const activeQ = knight.activeQuest;
  const monsterHpPct = activeQ
    ? Math.max(0, Math.min(100, Math.round((activeQ.monsterCurrentHp / Math.max(1, activeQ.monsterMaxHp)) * 100)))
    : 100;

  const shopItems = useMemo(() => RPG_ITEM_CATALOG.filter((i) => i.source === 'shop'), []);
  const lootCatalogItems = useMemo(() => RPG_ITEM_CATALOG.filter((i) => i.source === 'loot'), []);
  const ownedItems = useMemo(
    () =>
      (knight.ownedItemIds ?? [])
        .map((id) => getHeroItemById(id))
        .filter((i): i is RpgEquipmentItem => Boolean(i)),
    [knight.ownedItemIds],
  );

  const renderArtwork = (url: string, alt: string, className: string) => {
    if (brokenImages[url]) {
      return (
        <div
          className={`${className} bg-[#111722] flex items-center justify-center text-amber-400 font-bold text-xs`}
        >
          {alt.slice(0, 2).toUpperCase()}
        </div>
      );
    }
    return (
      <img
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setBrokenImages((prev) => ({ ...prev, [url]: true }))}
        className={className}
      />
    );
  };

  return (
    <div className="space-y-3 text-slate-100">
      {/* Persistent Hero Identity, Derived Combat/Economy Stats & Sub-View Switcher */}
      <div className="bg-[#0c1118] border border-slate-800 rounded-lg p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="relative w-14 h-14 rounded-lg overflow-hidden border-2 bg-[#111722] shrink-0"
            style={{ borderColor: knight.bannerColorHex || '#D4AF37' }}
          >
            {renderArtwork(activePortrait.imageUrl, activePortrait.name, 'w-full h-full object-cover')}
            <span className="absolute bottom-0 right-0 bg-amber-500 text-slate-950 font-mono-tabular font-bold text-[10px] px-1.5 py-0.5 rounded-tl">
              Poz. {knight.level}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate">{knight.name}</h3>
              <span className="text-[11px] font-semibold text-amber-300">
                {activePathSpec.shortTitle} · {knight.title}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] font-mono-tabular text-slate-300">
              <span>
                HP:{' '}
                <strong className="text-emerald-400">
                  {knight.hp}/{derived.effectiveMaxHp}
                </strong>
              </span>
              <span>
                Siła: <strong className="text-rose-400">{derived.effectiveStrength}</strong>
              </span>
              <span>
                Pancerz: <strong className="text-sky-400">{derived.effectiveDefense}</strong>
              </span>
              <span>
                Taktyka: <strong className="text-amber-400">{derived.effectiveTactics}</strong>
              </span>
              <span>
                Tury:{' '}
                <strong className="text-white">
                  {knight.availableTurns}/{derived.effectiveMaxTurns}
                </strong>
              </span>
              {derived.tradeFeeDiscountPct > 0 && (
                <span>
                  Zniżka Giełd.:{' '}
                  <strong className="text-emerald-400">-{derived.tradeFeeDiscountPct}%</strong>
                </span>
              )}
              {derived.lootFindBonusPct > 0 && (
                <span>
                  Szansa Łupu:{' '}
                  <strong className="text-purple-300">+{derived.lootFindBonusPct}%</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sub-View Switcher (3 Clean RPG Views) */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSubView('expeditions')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              subView === 'expeditions'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#111722] hover:bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            1. Wyprawy Turowe
          </button>
          <button
            type="button"
            onClick={() => setSubView('personalization')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
              subView === 'personalization'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#111722] hover:bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            <span>2. Personalizacja i Rozwój</span>
            {(knight.skillPoints ?? 0) > 0 && (
              <span
                className={`font-mono-tabular text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  subView === 'personalization'
                    ? 'bg-slate-950 text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                +{knight.skillPoints} PKT
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSubView('armory')}
            className={`min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
              subView === 'armory'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-[#111722] hover:bg-slate-800 text-slate-200 border border-slate-700'
            }`}
          >
            3. Zbrojownia i Łupy ({ownedItems.length})
          </button>
          {onOpenGarrison && <button type="button" className="min-h-[36px] rounded-md border border-amber-700 px-3 text-xs text-amber-200" onClick={onOpenGarrison}>Koszary i służba rycerza</button>}
          {onOpenKnightArena && (
            <button
              type="button"
              data-testid="knight-open-arena-btn"
              onClick={onOpenKnightArena}
              className="min-h-[36px] px-3 py-1.5 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
            >
              4. Arena Rycerska
            </button>
          )}
        </div>
      </div>

      {/* ==================== SUB-VIEW 1: TURN-BASED EXPEDITIONS & COMBAT ==================== */}
      {subView === 'expeditions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 4 Cols: Compact Hero Status, Equipped Gear Preview & Supplies */}
          <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-2.5">
              {/* HP & XP Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                  <span className="text-emerald-400">
                    Zdrowie: {knight.hp}/{derived.effectiveMaxHp}
                  </span>
                  <span className="text-sky-400">
                    XP: {knight.xp}/{knight.xpToNextLevel} ({xpPct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-transform origin-left"
                    style={{ transform: `scaleX(${hpPct / 100})` }}
                  />
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-500 h-full transition-transform origin-left"
                    style={{ transform: `scaleX(${xpPct / 100})` }}
                  />
                </div>
              </div>

              {/* 4 Active Equipment Slots Mini-Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-amber-400">Założony Ekwipunek</span>
                  <button
                    type="button"
                    onClick={() => setSubView('armory')}
                    className="text-[11px] text-sky-400 hover:text-sky-300 cursor-pointer"
                  >
                    Zmień / Zbrojownia →
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {SLOT_ORDER.map(({ slot, label }) => {
                    const itemId = knight.equippedSlots?.[slot];
                    const item = itemId ? getHeroItemById(itemId) : null;
                    const styles = item ? getRarityStyles(item.rarity) : null;
                    return (
                      <div
                        key={slot}
                        className={`p-1.5 rounded border bg-[#080b10] flex items-center gap-2 ${
                          styles ? styles.borderClass : 'border-slate-800'
                        }`}
                      >
                        {item ? (
                          renderArtwork(
                            item.imageUrl,
                            item.name,
                            'w-8 h-8 rounded object-cover shrink-0 border border-slate-700',
                          )
                        ) : (
                          <div className="w-8 h-8 rounded bg-[#111722] border border-dashed border-slate-700 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                            —
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-[10px] text-slate-400">{label}</div>
                          <div
                            className={`text-[11px] font-semibold truncate ${
                              styles ? styles.textClass : 'text-slate-500'
                            }`}
                          >
                            {item ? item.name : 'Pusty slot'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rest & Turn Replenishment */}
              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    Pula Tur ({knight.availableTurns}/{derived.effectiveMaxTurns})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Pokonane bestie: <strong className="text-white">{knight.monstersDefeated}</strong>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {knight.hp < derived.effectiveMaxHp && (
                    <button
                      type="button"
                      disabled={playerGold < healCost}
                      onClick={() => onTrainKnightStat('heal', healCost)}
                      className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Ulecz ({healCost} zł)
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      knight.availableTurns >= derived.effectiveMaxTurns ||
                      (playerInventory.zboze ?? 0) < 8 ||
                      playerGold < 200
                    }
                    onClick={() => onRestockKnightTurnsWithGrain(8, 200)}
                    className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] cursor-pointer"
                  >
                    +4 Tury (8 Zboża + 200 zł)
                  </button>
                </div>
              </div>

              {/* Recent Loot Log */}
              <div className="bg-[#080b10] border border-slate-800 rounded p-2 space-y-1">
                <div className="text-[11px] font-semibold text-amber-400">Kronika Łupów</div>
                <div className="max-h-20 overflow-y-auto space-y-1 text-[11px] text-slate-300">
                  {(knight.recentLootLog ?? []).slice(0, 4).map((entry, idx) => (
                    <div key={idx} className="border-b border-slate-800/60 pb-0.5 last:border-0">
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center 4 Cols: Expedition Selection */}
          <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5">
            <div>
              <div className="pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-amber-400">
                  Kronika Wypraw: Rebelianci i Miejsca Strachu
                </h3>
                <p className="text-[11px] text-slate-400">
                  Zwycięstwo daje złoto, surowce, XP oraz szansę na znalezienie unikalnych przedmiotów
                </p>
              </div>

              <div className="space-y-2 mt-2.5 max-h-[260px] overflow-y-auto pr-1">
                {MONSTER_QUESTS.map((quest) => {
                  const isSelected = quest.id === selectedQuest.id;
                  const isActive = knight.activeQuest?.questId === quest.id;
                  const cityObj = CITIES.find((c) => c.id === quest.nearCityId);

                  return (
                    <button
                      key={quest.id}
                      type="button"
                      onClick={() => setSelectedQuestId(quest.id)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-rose-950/35 border-rose-500 text-white'
                          : isSelected
                            ? 'bg-amber-500/15 border-amber-400 text-white'
                            : 'bg-[#080b10] border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${
                            quest.category === 'smocze_legowisko'
                              ? 'bg-rose-500/20 text-rose-300'
                              : quest.category === 'miejsca_strachu'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {quest.categoryLabel.toUpperCase()}
                        </span>
                        <span className="font-mono-tabular text-slate-400">
                          Poz. {quest.recommendedLevel} · {quest.turnsRequired} Tury
                        </span>
                      </div>

                      <div className="text-xs font-bold text-white mt-1">{quest.name}</div>
                      <div className="text-[11px] text-rose-300 font-medium">
                        Wróg: {quest.monsterName} ({quest.monsterMaxHp} HP)
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono-tabular text-emerald-400 mt-1.5 pt-1 border-t border-slate-800/80">
                        <span>Region: {cityObj?.name}</span>
                        <span>
                          +{quest.rewardGold} zł · +{quest.rewardXp} XP · Szansa Łupu
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {!activeQ && (
              <button
                type="button"
                disabled={knight.availableTurns <= 0 || knight.hp <= 15}
                onClick={() => onStartKnightQuest(selectedQuest)}
                className="min-h-[42px] w-full py-2 px-4 rounded-md bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Rozpocznij Wyprawę: {selectedQuest.name.slice(0, 34)}...
              </button>
            )}
          </div>

          {/* Right 4 Cols: Tactical Combat Arena */}
          <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-rose-400">Arena Walki Turowej</span>
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  Runy: +{derived.arcaneBonusDmg} · Tech: +{Math.round(combatTechBonus * 100)}%
                </span>
              </div>

              <div
                className={`relative mt-2.5 bg-[#080b10] border rounded-lg p-3 space-y-2 transition-transform duration-200 ${
                  combatPulse ? 'scale-[0.98] border-rose-500' : 'border-slate-800'
                }`}
              >
                {floatingHitText && (
                  <div className="absolute -top-2.5 right-3 bg-rose-600 text-white font-mono-tabular font-bold text-[11px] px-2 py-0.5 rounded shadow-lg">
                    {floatingHitText}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{selectedQuest.monsterName}</div>
                    <div className="text-[11px] text-rose-400">{selectedQuest.monsterTitle}</div>
                  </div>
                  <div className="text-right font-mono-tabular">
                    <div className="text-xs font-bold text-rose-400">
                      {activeQ ? activeQ.monsterCurrentHp : selectedQuest.monsterMaxHp} /{' '}
                      {selectedQuest.monsterMaxHp} HP
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Atak: {selectedQuest.monsterAttack} · Obrona: {selectedQuest.monsterDefense}
                    </div>
                  </div>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full transition-transform origin-left"
                    style={{ transform: `scaleX(${monsterHpPct / 100})` }}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-300 pt-1">
                  <span>
                    Tura:{' '}
                    <strong className="text-amber-400 font-mono-tabular">
                      {activeQ
                        ? `${activeQ.currentStep} / ${activeQ.totalSteps}`
                        : `0 / ${selectedQuest.turnsRequired}`}
                    </strong>
                  </span>
                  <span className="text-emerald-400 font-mono-tabular">
                    Łup:{' '}
                    {selectedQuest.rewardCommodities
                      .map((rc) => {
                        const c = COMMODITIES.find((x) => x.id === rc.id);
                        return `${rc.qty}x ${c?.symbol}`;
                      })
                      .join(', ')}
                  </span>
                </div>
              </div>

              {/* Tactical Stance Selector */}
              <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[11px]">
                {(
                  [
                    { id: 'aggressive', label: 'Szarża', desc: '+30% Atak' },
                    { id: 'balanced', label: 'Taktyka', desc: 'Równowaga' },
                    { id: 'defensive', label: 'Gardy', desc: '+35% Obrona' },
                  ] as const
                ).map((tac) => (
                  <button
                    key={tac.id}
                    type="button"
                    onClick={() => setSelectedTactic(tac.id)}
                    className={`p-2 rounded border text-left transition-colors cursor-pointer ${
                      selectedTactic === tac.id
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-[#080b10] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{tac.label}</div>
                    <div className="text-[10px] opacity-80">{tac.desc}</div>
                  </button>
                ))}
              </div>

              {/* Combat Chronicle */}
              <div className="mt-2.5 bg-[#080b10] border border-slate-800 rounded p-2.5 h-28 overflow-y-auto space-y-1 text-[11px]">
                {activeQ && activeQ.combatLogs.length > 0 ? (
                  activeQ.combatLogs.map((logLine, idx) => (
                    <div key={idx} className="text-slate-200 border-b border-slate-800/60 pb-1">
                      {logLine}
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400">
                    Twój bohater jest gotów do wymarszu. Wyposaż go w lepszy ekwipunek lub rozwiń
                    specjalizację przed starciem z potężnymi bestiami.
                  </div>
                )}
              </div>
            </div>

            {activeQ ? (
              <button
                type="button"
                disabled={knight.availableTurns <= 0 || knight.hp <= 0}
                onClick={() => {
                  triggerGameFeelHit(`ATAK BOHATERA! (Tura ${activeQ.currentStep}/${activeQ.totalSteps})`);
                  onExecuteKnightTurn(selectedTactic);
                }}
                className="min-h-[42px] w-full py-2 px-4 rounded-md bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                {knight.availableTurns > 0
                  ? `Wykonaj Turę Walki (${activeQ.currentStep}/${activeQ.totalSteps}) · Tury: ${knight.availableTurns}`
                  : 'Brak Tur (Uzupełnij Zbożem)'}
              </button>
            ) : (
              <button
                type="button"
                disabled={knight.availableTurns <= 0}
                onClick={() => {
                  triggerGameFeelHit('SZARŻA NA WYPRAWĘ! (Tura 1)');
                  onStartKnightQuest(selectedQuest);
                }}
                className="min-h-[42px] w-full py-2 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Wyrusz na Wyprawę i Wykonaj 1. Turę
              </button>
            )}
          </div>
        </div>
      )}

      {/* ==================== SUB-VIEW 2: PERSONALIZATION & MULTI-PATH DEVELOPMENT ==================== */}
      {subView === 'personalization' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 5 Cols: Identity, Heraldic Crest & 4 Bespoke Character Portraits */}
          <div className="lg:col-span-5 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-amber-400">
                Personalizacja Bohatera i Portrety Postaci
              </h3>
              <p className="text-[11px] text-slate-400">
                Nadaj imię, tytuł, barwy herbowe oraz wybierz wizerunek swojej postaci
              </p>
            </div>

            {/* Name & Title Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label htmlFor="hero-name-input" className="block text-[11px] text-slate-400 mb-1">
                  Imię Bohatera
                </label>
                <input
                  id="hero-name-input"
                  type="text"
                  maxLength={32}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full bg-[#080b10] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label htmlFor="hero-title-input" className="block text-[11px] text-slate-400 mb-1">
                  Przydomek / Tytuł
                </label>
                <input
                  id="hero-title-input"
                  type="text"
                  maxLength={36}
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  className="w-full bg-[#080b10] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Barwa Herbu:</span>
                {HERO_BANNER_COLORS.map((swatch) => (
                  <button
                    key={swatch.id}
                    type="button"
                    title={swatch.name}
                    aria-label={`Wybierz barwę ${swatch.name}`}
                    onClick={() => onCustomizeHero({ bannerColorHex: swatch.hex })}
                    className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                      knight.bannerColorHex === swatch.hex
                        ? 'border-white scale-110'
                        : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  onCustomizeHero({
                    name: nameDraft.trim() || knight.name,
                    title: titleDraft.trim() || knight.title,
                  })
                }
                className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Zapisz Tożsamość
              </button>
            </div>

            {/* 4 Bespoke Hero Portraits Gallery */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {HERO_PORTRAITS.map((portrait) => {
                const isSelected = portrait.id === knight.portraitId;
                return (
                  <button
                    key={portrait.id}
                    type="button"
                    onClick={() =>
                      onCustomizeHero({
                        portraitId: portrait.id,
                        activePath: portrait.recommendedPath,
                      })
                    }
                    className={`text-left rounded-lg overflow-hidden border transition-colors cursor-pointer bg-[#080b10] ${
                      isSelected
                        ? 'border-amber-400 ring-1 ring-amber-400/60'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="aspect-square w-full overflow-hidden bg-[#111722]">
                      {renderArtwork(
                        portrait.imageUrl,
                        portrait.name,
                        'w-full h-full object-cover',
                      )}
                    </div>
                    <div className="p-1.5">
                      <div className="text-[11px] font-bold text-white truncate">
                        {portrait.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {portrait.archetypeLabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 7 Cols: 4 Development Branches (Skill Points) + Academy Stat Training */}
          <div className="lg:col-span-7 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-amber-400">
                    Kierunki Rozwoju Postaci (4 Ścieżki Specjalizacji)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Wydawaj Punkty Rozwoju (zdobywane przy awansie), łącząc walkę, giełdę, magię i zwiad
                  </p>
                </div>
                <div className="font-mono-tabular text-xs bg-[#080b10] border border-emerald-500/40 rounded px-2.5 py-1">
                  Dostępne Punkty:{' '}
                  <strong className="text-emerald-400">{knight.skillPoints ?? 0} PKT</strong>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {HERO_PATHS.map((path) => {
                  const rank = knight.pathLevels?.[path.id] ?? 0;
                  const canUpgrade = (knight.skillPoints ?? 0) > 0 && rank < path.maxRank;
                  const isActivePath = knight.activePath === path.id;

                  return (
                    <div
                      key={path.id}
                      className={`p-2.5 rounded-lg border bg-[#080b10] flex flex-col justify-between gap-2 ${
                        isActivePath ? 'border-amber-400/70' : 'border-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{path.name}</span>
                          <span className="font-mono-tabular text-[11px] font-bold text-amber-300">
                            Poz. {rank}/{path.maxRank}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">{path.roleTag}</div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          {path.description}
                        </p>
                        <div className="text-[10px] text-emerald-400 font-medium">
                          {path.perRankSummary}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: path.maxRank }).map((_, idx) => (
                            <span
                              key={idx}
                              className="w-4 h-1.5 rounded-sm"
                              style={{
                                backgroundColor: idx < rank ? path.accentHex : '#1e293b',
                              }}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={!canUpgrade}
                          onClick={() => onAllocateSkillPoint(path.id)}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-[11px] cursor-pointer"
                        >
                          {rank >= path.maxRank ? 'Mistrzostwo' : 'Rozwiń (+1)'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Core Academy Stat Training */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 font-mono-tabular">
              <button
                type="button"
                disabled={playerGold < trainCost}
                onClick={() => onTrainKnightStat('strength', trainCost)}
                className="p-2 rounded bg-[#080b10] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-center cursor-pointer"
              >
                <div className="text-[10px] text-slate-400">TRENING SIŁY ({derived.effectiveStrength})</div>
                <div className="text-xs font-bold text-rose-400 mt-0.5">
                  +3 Siły · +40 XP ({trainCost} zł)
                </div>
              </button>
              <button
                type="button"
                disabled={playerGold < trainCost}
                onClick={() => onTrainKnightStat('defense', trainCost)}
                className="p-2 rounded bg-[#080b10] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-center cursor-pointer"
              >
                <div className="text-[10px] text-slate-400">TRENING PANCERZA ({derived.effectiveDefense})</div>
                <div className="text-xs font-bold text-sky-400 mt-0.5">
                  +3 Obrony · +40 XP ({trainCost} zł)
                </div>
              </button>
              <button
                type="button"
                disabled={playerGold < trainCost}
                onClick={() => onTrainKnightStat('tactics', trainCost)}
                className="p-2 rounded bg-[#080b10] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-center cursor-pointer"
              >
                <div className="text-[10px] text-slate-400">TRENING TAKTYKI ({derived.effectiveTactics})</div>
                <div className="text-xs font-bold text-amber-400 mt-0.5">
                  +3 Taktyki · +40 XP ({trainCost} zł)
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-VIEW 3: ARMORY SHOP, LOOT BACKPACK & EQUIPMENT SLOTS ==================== */}
      {subView === 'armory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 5 Cols: 4 Active Equipment Slots + Treasure Scout Action + Owned Backpack */}
          <div className="lg:col-span-5 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  Ekwipunek Bohatera (4 Sloty) i Plecak
                </h3>
                <p className="text-[11px] text-slate-400">
                  Zakładaj i wymieniaj przedmioty bez utraty statystyk
                </p>
              </div>
              <button
                type="button"
                disabled={knight.availableTurns <= 0 || playerGold < scoutCostGold}
                onClick={onScoutForLoot}
                className="px-2.5 py-1.5 rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-[11px] cursor-pointer shrink-0"
              >
                Zwiad po Skarby (1 Tura · {scoutCostGold} zł)
              </button>
            </div>

            {/* 4 Active Equipment Slots */}
            <div className="grid grid-cols-2 gap-2">
              {SLOT_ORDER.map(({ slot, label }) => {
                const itemId = knight.equippedSlots?.[slot];
                const item = itemId ? getHeroItemById(itemId) : null;
                const styles = item ? getRarityStyles(item.rarity) : null;
                return (
                  <div
                    key={slot}
                    className={`p-2 rounded-lg border bg-[#080b10] flex flex-col justify-between gap-1.5 ${
                      styles ? styles.borderClass : 'border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item ? (
                        renderArtwork(
                          item.imageUrl,
                          item.name,
                          'w-10 h-10 rounded object-cover shrink-0 border border-slate-700',
                        )
                      ) : (
                        <div className="w-10 h-10 rounded bg-[#111722] border border-dashed border-slate-700 flex items-center justify-center text-xs text-slate-500 shrink-0">
                          —
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase text-slate-400">{label}</div>
                        <div
                          className={`text-xs font-bold truncate ${
                            styles ? styles.textClass : 'text-slate-500'
                          }`}
                        >
                          {item ? item.name : 'Pusty slot'}
                        </div>
                        {item && (
                          <div className="text-[10px] text-emerald-400 truncate">
                            {item.bonusText}
                          </div>
                        )}
                      </div>
                    </div>

                    {item && (
                      <button
                        type="button"
                        onClick={() => onUnequipHeroSlot(slot)}
                        className="w-full py-1 rounded bg-[#111722] hover:bg-slate-800 text-[10px] text-slate-300 border border-slate-700 cursor-pointer"
                      >
                        Zdejmij do Plecaka
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Owned Backpack Items */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-white">
                Plecak (Kupione i Znalezione: {ownedItems.length})
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {ownedItems.map((item) => {
                  const isEquipped = knight.equippedSlots?.[item.slot] === item.id;
                  const styles = getRarityStyles(item.rarity);
                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded border bg-[#080b10] flex items-center justify-between gap-2 ${styles.borderClass}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderArtwork(
                          item.imageUrl,
                          item.name,
                          'w-9 h-9 rounded object-cover shrink-0 border border-slate-700',
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1 rounded ${styles.badgeBgClass}`}>
                              {item.rarityLabel}
                            </span>
                            <span className="text-xs font-bold text-white truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-400 truncate">
                            [{item.slotLabel}] {item.bonusText}
                          </div>
                        </div>
                      </div>

                      {isEquipped ? (
                        <span className="text-[10px] font-bold text-emerald-400 px-2 py-1 bg-emerald-950/60 rounded shrink-0">
                          Założono
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEquipHeroItem(item.id)}
                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                        >
                          Załóż
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Forge & Armory Shop (Buyable) + Rare Loot Codex (Findable) */}
          <div className="lg:col-span-7 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400">
                  Kuźnia Zbrojowni (Zakup) oraz Katalog Artefaktów (Znaleziska)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Kupuj oręż w Kuźni lub odkrywaj epickie i legendarne skarby w wyprawach, zwiadzie i zdarzeniach na szlaku
                </p>
              </div>
              <span className="text-[11px] font-mono-tabular text-amber-300 shrink-0">
                Złoto: {Math.round(playerGold).toLocaleString('pl-PL')} zł
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
              {/* Column A: Buyable Shop Items */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-white">Kuźnia i Sklep Zbrojowni</div>
                {shopItems.map((item) => {
                  const isOwned = (knight.ownedItemIds ?? []).includes(item.id);
                  const styles = getRarityStyles(item.rarity);
                  const reqComm = item.requiredCommodity
                    ? COMMODITIES.find((c) => c.id === item.requiredCommodity?.id)
                    : null;
                  const hasComm =
                    !item.requiredCommodity ||
                    (playerInventory[item.requiredCommodity.id] ?? 0) >= item.requiredCommodity.qty;
                  const canBuy = !isOwned && playerGold >= item.costGold && hasComm;

                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-lg border bg-[#080b10] flex items-center justify-between gap-2 ${styles.borderClass}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderArtwork(
                          item.imageUrl,
                          item.name,
                          'w-10 h-10 rounded object-cover shrink-0 border border-slate-700',
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1 rounded ${styles.badgeBgClass}`}>
                              {item.rarityLabel}
                            </span>
                            <span className="text-xs font-bold text-white truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-400 truncate">
                            {item.bonusText}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono-tabular truncate">
                            {item.costGold} zł
                            {reqComm && item.requiredCommodity
                              ? ` + ${item.requiredCommodity.qty}x ${reqComm.symbol}`
                              : ''}
                          </div>
                        </div>
                      </div>

                      {isOwned ? (
                        <span className="text-[10px] font-bold text-emerald-400 px-2 py-1 bg-emerald-950/60 rounded shrink-0">
                          W plecaku
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canBuy}
                          onClick={() => onBuyHeroItem(item)}
                          className="px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
                        >
                          Kup / Wykuj
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Column B: Findable / Lootable Artifacts Codex */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-purple-300">
                  Artefakty do Znalezienia (Wyprawy, Zwiad, Szlak)
                </div>
                {lootCatalogItems.map((item) => {
                  const isFound = (knight.ownedItemIds ?? []).includes(item.id);
                  const styles = getRarityStyles(item.rarity);
                  return (
                    <div
                      key={item.id}
                      className={`p-2 rounded-lg border bg-[#080b10] flex items-center justify-between gap-2 ${
                        isFound ? styles.borderClass : 'border-slate-800/90 opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderArtwork(
                          item.imageUrl,
                          item.name,
                          'w-10 h-10 rounded object-cover shrink-0 border border-slate-700',
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-1 rounded ${styles.badgeBgClass}`}>
                              {item.rarityLabel}
                            </span>
                            <span className="text-xs font-bold text-white truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-400 truncate">
                            {item.bonusText}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.sourceLabel}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 ${
                          isFound
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isFound ? 'Odkryto' : 'Do znalezienia'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
