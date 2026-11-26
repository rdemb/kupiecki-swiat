import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CITIES,
  COMMODITIES,
  CommodityId,
  CommodityMarketState,
  ContinentId,
  MacroEconomyState,
  PlayerExchangeOffer,
  SEASONS,
  SeasonId,
  calculateMacroIndicators,
  calculateRegionalCityPrices,
  calculateStorageDemurrageCost,
  generateOrderBook,
} from './economy/economyEngine';
import {
  AuctionItem,
  ChatMessage,
  DUCHY_BUILDINGS,
  DuchyBuildingSpec,
  DuchyState,
  GuildInfo,
  KnightState,
  LeaderboardEntry,
  MageSpellSpec,
  MONSTER_QUESTS,
  MonsterQuestSpec,
  RACES,
  StoryChapterSpec,
  TECH_TREE,
  TechNode,
  createInitialDuchyState,
  createInitialKnightState,
} from './economy/gameData';
import {
  EquipmentSlot,
  HeroPathId,
  RpgEquipmentItem,
  allocateHeroSkillPoint,
  computeDerivedHeroStats,
  equipHeroItem,
  rollLootDrop,
  unequipHeroSlot,
} from './economy/heroProgression';
import {
  DisasterMitigationResult,
  getDisasterPriceMultiplier,
  pickRandomDisaster,
  resolveDisasterMitigation,
} from './economy/worldDisasters';
import {
  DragonMissionType,
  DragonSanctuaryState,
  DragonSpeciesId,
  computeDragonGlobalBonuses,
  createInitialDragonSanctuary,
  dispatchDragonMission,
  feedAndTrainDragon,
  incubateOrHatchEgg,
  purchaseOrBreedDragonEgg,
} from './economy/dragonBreeding';
import { ActiveCaravan3D, CameraPresetId, World3DCanvas } from './components/World3DCanvas';
import { LightingMoodId } from './world3d/terrainAndShaders';
import {
  PBR_WEATHER_LIST,
  PbrWeatherId,
  getWeatherTradeModifiers,
} from './world3d/pbrWeather';
import {
  ActiveTrailEvent,
  TrailEventOutcome,
  generateTrailEventsForWorld,
  resolveTrailEventChoice,
} from './economy/trailEvents';
import { TrailEventModal } from './components/TrailEventModal';
import { DisasterEventModal } from './components/DisasterEventModal';
import { DayTraderTerminal } from './components/DayTraderTerminal';
import { KnightAndMissionsPanel } from './components/KnightAndMissionsPanel';
import { DuchyAndStoryCampaignPanel } from './components/DuchyAndStoryCampaignPanel';
import { WorldMapAtlasPanel } from './components/WorldMapAtlasPanel';
import { AuthAndProfilePanel, TradeRecordItem } from './components/AuthAndProfilePanel';
import { CityInteriorModal } from './components/CityInteriorModal';
import type { ArenaOpponentSpec } from './economy/cityAndArenaEngine';
import { WORLD_CONTINENTS, WORLD_REGIONS } from './economy/worldMapData';
import {
  AchievementSpec,
  RoyalSupplyContract,
  calculateNobleRank,
} from './economy/achievementsAndQuests';
import {
  AuctionHouseView,
  CaravanRoutesView,
  GuildChatAndRankingsView,
  TechTreeView,
} from './components/AuctionTechGuildPanel';
import { soundEngine } from './utils/sound';
import {
  User,
  auth,
  loadPlayerProfileFromFirestore,
  logTradeToFirestore,
  onAuthStateChanged,
  savePlayerProfileToFirestore,
} from './firebase';

export interface PushNotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'trade' | 'caravan' | 'auction' | 'event';
  timestamp: string;
  read: boolean;
}

type DockTab =
  | 'world_map'
  | 'terminal'
  | 'caravans'
  | 'knight'
  | 'duchy_story'
  | 'auctions'
  | 'tech'
  | 'guilds_chat'
  | 'profile';

const INITIAL_OFFERS: PlayerExchangeOffer[] = [
  {
    id: 'off_city_1',
    sellerUid: 'city_krolewska_przystan',
    sellerName: 'Magistrat: Królewska Przystań',
    sellerGuild: '[MIASTO]',
    isCitySurplus: true,
    cityId: 'krolewska_przystan',
    cityName: 'Królewska Przystań',
    commodityId: 'zboze',
    quantity: 120,
    pricePerUnit: 20.5,
    createdAt: '12:15',
  },
  {
    id: 'off_city_2',
    sellerUid: 'city_zelazna_kuznia',
    sellerName: 'Cech Górniczy: Żelazna Kuźnia',
    sellerGuild: '[MIASTO]',
    isCitySurplus: true,
    cityId: 'zelazna_kuznia',
    cityName: 'Żelazna Kuźnia',
    commodityId: 'zelazo',
    quantity: 65,
    pricePerUnit: 58.0,
    createdAt: '12:18',
  },
  {
    id: 'off_p2p_1',
    sellerUid: 'npc_kupiec_aldor',
    sellerName: 'Kupiec Aldor',
    sellerGuild: '[ZŁOTO]',
    isCitySurplus: false,
    cityId: 'srebrny_gaj',
    cityName: 'Srebrny Gaj',
    commodityId: 'drewno_elfickie',
    quantity: 35,
    pricePerUnit: 84.0,
    createdAt: '12:22',
  },
];

function createInitialOfflineMarkets(): Record<CommodityId, CommodityMarketState> {
  const now = Date.now();
  const out = {} as Record<CommodityId, CommodityMarketState>;
  for (const spec of COMMODITIES) {
    const ob = generateOrderBook(spec.basePrice, spec.targetInventory, spec.targetInventory, spec.baseVolatility, 0);
    const citySurplusStock: Record<string, number> = {};
    for (const c of CITIES) {
      citySurplusStock[c.id] =
        c.specialty === spec.id
          ? Math.round(spec.targetInventory * 0.14)
          : Math.round(spec.targetInventory * 0.03);
    }
    out[spec.id] = {
      id: spec.id,
      currentPrice: spec.basePrice,
      previousPrice: spec.basePrice,
      change24hPct: 1.4,
      inventory: spec.targetInventory,
      targetInventory: spec.targetInventory,
      volume24h: spec.targetInventory * 2,
      netOrderFlow: 0,
      vwap: spec.basePrice,
      rsi14: 52.4,
      bollingerUpper: Number((spec.basePrice * 1.05).toFixed(2)),
      bollingerLower: Number((spec.basePrice * 0.95).toFixed(2)),
      bidPrice: ob.bidPrice,
      askPrice: ob.askPrice,
      spreadPct: ob.spreadPct,
      seasonalTrendLabel: 'Równowaga sezonowa (Lato)',
      cityPrices: calculateRegionalCityPrices(spec.id, spec.basePrice, 1, 'lato'),
      citySurplusStock,
      history: Array.from({ length: 24 }, (_, idx) => {
        const p = Number((spec.basePrice * (1 + Math.sin(idx * 0.4) * 0.025)).toFixed(2));
        return {
          time: now - (24 - idx) * 60_000,
          open: p,
          high: Number((p * 1.015).toFixed(2)),
          low: Number((p * 0.985).toFixed(2)),
          close: p,
          volume: Math.round(spec.targetInventory * 0.08),
        };
      }),
      orderBook: { bids: ob.bids, asks: ob.asks },
    };
  }
  return out;
}

export default function App() {
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [gameState, setGameState] = useState<'title' | 'playing' | 'paused' | 'gameover'>(
    isAutostart ? 'playing' : 'title',
  );
  const [selectedRaceId, setSelectedRaceId] = useState<string>('ludzie');
  const [selectedContinentId, setSelectedContinentId] = useState<ContinentId | 'all'>('all');
  const [selectedCityId, setSelectedCityId] = useState<string>('krolewska_przystan');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('krolewska_przystan');
  const [selectedCommodityId, setSelectedCommodityId] = useState<CommodityId>('mithril');
  const [activeTab, setActiveTab] = useState<DockTab>('world_map');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('world');
  const [trackedCaravanId, setTrackedCaravanId] = useState<string | null>(null);
  const [lightingMood, setLightingMood] = useState<LightingMoodId>('golden_hour');
  const [pbrWeather, setPbrWeather] = useState<PbrWeatherId>('clear');
  const [trailEventSeed, setTrailEventSeed] = useState<number>(1);
  const [trailEvents, setTrailEvents] = useState<ActiveTrailEvent[]>(() =>
    generateTrailEventsForWorld({
      lightingMood: 'golden_hour',
      pbrWeather: 'clear',
      season: 'lato',
      seed: 1,
      count: 4,
    }),
  );
  const [activeTrailEvent, setActiveTrailEvent] = useState<ActiveTrailEvent | null>(null);
  const [trailEventOutcome, setTrailEventOutcome] = useState<TrailEventOutcome | null>(null);
  const [showWorldLabels, setShowWorldLabels] = useState<boolean>(true);
  const [muted, setMuted] = useState<boolean>(false);
  const [showCinematicIntro, setShowCinematicIntro] = useState<boolean>(false);
  const [cinematicSceneIdx, setCinematicSceneIdx] = useState<number>(0);
  const [cityInteriorOpen, setCityInteriorOpen] = useState<boolean>(false);
  const [cityInteriorMode, setCityInteriorMode] = useState<'plaza' | 'arena'>('plaza');
  const [arenaWins, setArenaWins] = useState<number>(0);
  const [arenaRating, setArenaRating] = useState<number>(1000);

  // Account & Authentication State (Token strictly in React memory, never in localStorage)
  const [backendToken, setBackendToken] = useState<string | null>(null);
  const [backendUsername, setBackendUsername] = useState<string | null>(null);
  const [playerDisplayName, setPlayerDisplayName] = useState<string>('Lord Kupiecki');
  const [playerTitle, setPlayerTitle] = useState<string>('Kupiec i Dowódca Szlaku');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [hasExistingCloudDoc, setHasExistingCloudDoc] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('Sesja aktywna');
  const [tradeHistory, setTradeHistory] = useState<TradeRecordItem[]>([]);

  // Player Financial, Inventory & Knight State
  const [playerGold, setPlayerGold] = useState<number>(15000);
  const [playerBondsGold, setPlayerBondsGold] = useState<number>(0);
  const [tradesExecutedCount, setTradesExecutedCount] = useState<number>(0);
  const [profitableTradesCount, setProfitableTradesCount] = useState<number>(0);
  const [playerInventory, setPlayerInventory] = useState<Record<CommodityId, number>>({
    zboze: 35,
    zelazo: 20,
    drewno_elfickie: 12,
    przyprawy: 10,
    runiczny_pergamin: 6,
    krysztaly_many: 5,
    mithril: 4,
    smocza_luska: 1,
  });

  const [knight, setKnight] = useState<KnightState>(() => createInitialKnightState('ludzie'));
  const [duchy, setDuchy] = useState<DuchyState>(() => createInitialDuchyState('ludzie'));
  const [dragonSanctuary, setDragonSanctuary] = useState<DragonSanctuaryState>(() =>
    createInitialDragonSanctuary(),
  );
  const [dragonFeedback, setDragonFeedback] = useState<string>('');
  const [disasterModalOpen, setDisasterModalOpen] = useState<boolean>(false);
  const [lastDisasterResult, setLastDisasterResult] = useState<DisasterMitigationResult | null>(null);
  const [cinematicTourActive, setCinematicTourActive] = useState<boolean>(false);
  const [tourContinentId, setTourContinentId] = useState<ContinentId>('stary_kontynent');
  const [completedContractIds, setCompletedContractIds] = useState<string[]>([]);
  const [claimedAchievementIds, setClaimedAchievementIds] = useState<string[]>([]);
  const [prestigePoints, setPrestigePoints] = useState<number>(120);

  // Tech Tree, Guild, Caravans & Push Notifications
  const [unlockedTechIds, setUnlockedTechIds] = useState<string[]>(['handel_1']);
  const [playerGuildId, setPlayerGuildId] = useState<string>('g_zloto');
  const [activeCaravans, setActiveCaravans] = useState<ActiveCaravan3D[]>([]);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([
    {
      id: 'notif_init_1',
      title: 'Królewska Giełda i Szlaki Otwarte',
      body: 'Miasta wystawiły sezonowe nadwyżki towarów, a Twój Rycerz jest gotowy do wyprawy na Rebeliantów.',
      category: 'trade',
      timestamp: '12:30:00',
      read: false,
    },
  ]);

  // Server-Synced Authoritative State
  const [markets, setMarkets] = useState<Record<CommodityId, CommodityMarketState>>(
    createInitialOfflineMarkets,
  );
  const [exchangeOffers, setExchangeOffers] = useState<PlayerExchangeOffer[]>(INITIAL_OFFERS);
  const [macro, setMacro] = useState<MacroEconomyState>(() => {
    const basePrices = Object.fromEntries(COMMODITIES.map((c) => [c.id, c.basePrice])) as Record<
      CommodityId,
      number
    >;
    const ind = calculateMacroIndicators(basePrices, 1_265_000, 1_200_000);
    return {
      moneySupplyM: 1_265_000,
      targetMoneySupplyMStar: 1_200_000,
      velocityV: 1.42,
      cpiIndex: ind.cpiIndex,
      inflationRatePct: ind.inflationRatePct,
      dynamicTaxRatePct: ind.dynamicTaxRatePct,
      royalMintBondYieldPct: ind.royalMintBondYieldPct,
      totalGoldBurned: 48_920,
      totalGoldMinted: 113_920,
      storageDemurrageRate: 0.18,
      activeSeason: 'lato',
      activeSeasonName: SEASONS.lato.name,
      activeSeasonDesc: SEASONS.lato.description,
      nextSeason: SEASONS.lato.nextSeason,
      seasonDayProgress: 0.25,
      daysUntilNextSeason: 3,
      caravanSpeedMultiplier: SEASONS.lato.caravanSpeedMultiplier,
      seasonalAvailabilityIndex: Math.round(SEASONS.lato.availabilityMultiplier * 100),
      activeWeather: 'sloneczna_pogoda',
      activeWeatherName: 'Bezchmurne Niebo nad Księstwem',
      activeWeatherEffect: 'Niskie tarcie transportowe na wszystkich traktach.',
      worldDayNumber: 14,
      activeEventTitle: 'Przebudzenie Smoka w Górach Bazaltowych',
      activeEventEffect: 'Podaż Mithrilu i Żelaza spada (-25%), popyt na Smoczą Łuskę rośnie (+30%).',
      activeEventMultiplier: { mithril: 1.24, zelazo: 1.15, smocza_luska: 1.30 },
      activeDisaster: null,
    };
  });

  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [guilds, setGuilds] = useState<GuildInfo[]>([]);
  const [registeredPlayers, setRegisteredPlayers] = useState<
    Array<{
      uid: string;
      displayName: string;
      title: string;
      raceId: string;
      guildId: string;
      netWorth: number;
      knightLevel: number;
      monstersDefeated: number;
      tradesExecutedCount: number;
      profitableTradesCount: number;
    }>
  >([]);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Regenerate dynamic Trail Events whenever Time-of-Day, PBR Weather, Season, or Refresh Seed changes
  const trailEventsInitRef = useRef(true);
  useEffect(() => {
    if (trailEventsInitRef.current) {
      trailEventsInitRef.current = false;
      return;
    }
    setTrailEvents(
      generateTrailEventsForWorld({
        lightingMood,
        pbrWeather,
        season: macro.activeSeason,
        seed: trailEventSeed,
        count: 4,
      }),
    );
  }, [lightingMood, pbrWeather, macro.activeSeason, trailEventSeed]);

  // Listen to Firebase Auth State Changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (usr) => {
      setFirebaseUser(usr);
      if (usr && usr.emailVerified) {
        try {
          const loaded = await loadPlayerProfileFromFirestore(usr.uid);
          if (loaded) {
            setHasExistingCloudDoc(true);
            setPlayerDisplayName(loaded.displayName);
            setPlayerTitle(loaded.title);
            setSelectedRaceId(loaded.raceId);
            setPlayerGuildId(loaded.guildId);
            setPlayerGold(loaded.gold);
            setPlayerBondsGold(loaded.bondsGold);
            setTradesExecutedCount(loaded.tradesExecutedCount);
            setProfitableTradesCount(loaded.profitableTradesCount);
            setPlayerInventory(loaded.inventory);
            setUnlockedTechIds(loaded.unlockedTechIds);
            setSyncStatusMsg('Wczytano z Firebase Cloud');
          }
        } catch {
          // Ignore if no cloud doc yet
        }
      }
    });
    return () => unsub();
  }, []);

  const pushNotification = (
    title: string,
    body: string,
    category: PushNotificationItem['category'] = 'trade',
  ) => {
    const item: PushNotificationItem = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      body,
      category,
      timestamp: new Date().toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      read: false,
    };
    setNotifications((prev) => [item, ...prev.slice(0, 19)]);
    soundEngine.playAlertNotification();

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        new Notification(title, { body });
      } catch {
        // Ignore browser notification restrictions inside iframe
      }
    }
  };

  // Connect to Authoritative Server + WebSocket
  useEffect(() => {
    fetch('/api/state')
      .then((r) => r.json())
      .then((data) => {
        if (data.markets) setMarkets(data.markets);
        if (data.macro) setMacro(data.macro);
        if (data.auctions) setAuctions(data.auctions);
        if (data.exchangeOffers) setExchangeOffers(data.exchangeOffers);
        if (data.chatMessages) setChatMessages(data.chatMessages);
        if (data.guilds) setGuilds(data.guilds);
        if (data.registeredPlayers) setRegisteredPlayers(data.registeredPlayers);
      })
      .catch(() => {});

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    let ws: WebSocket | null = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'init') {
              if (msg.payload.markets) setMarkets(msg.payload.markets);
              if (msg.payload.macro) setMacro(msg.payload.macro);
              if (msg.payload.auctions) setAuctions(msg.payload.auctions);
              if (msg.payload.exchangeOffers) setExchangeOffers(msg.payload.exchangeOffers);
              if (msg.payload.chatMessages) setChatMessages(msg.payload.chatMessages);
              if (msg.payload.guilds) setGuilds(msg.payload.guilds);
            } else if (msg.type === 'market:update') {
              if (msg.payload.markets) setMarkets(msg.payload.markets);
              if (msg.payload.macro) setMacro(msg.payload.macro);
              if (msg.payload.auctions) setAuctions(msg.payload.auctions);
              if (msg.payload.exchangeOffers) setExchangeOffers(msg.payload.exchangeOffers);
            } else if (msg.type === 'chat:new') {
              setChatMessages((prev) => {
                if (prev.some((m) => m.id === msg.payload.id)) return prev;
                return [...prev, msg.payload];
              });
            } else if (msg.type === 'guilds:update') {
              setGuilds(msg.payload);
            } else if (msg.type === 'notification:push') {
              pushNotification(msg.payload.title, msg.payload.body, msg.payload.category || 'event');
            } else if (msg.type === 'auction:sold') {
              pushNotification(
                'Aukcja Rozstrzygnięta',
                `${msg.payload.winner} nabył ${msg.payload.itemName} za ${msg.payload.price} zł.`,
                'auction',
              );
            }
          } catch {
            // ignore malformed frame
          }
        };
      } catch {
        // ignore connection errors
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Derived Hero, Dragon, Tech & Faction Modifiers
  const selectedRace = RACES.find((r) => r.id === selectedRaceId) ?? RACES[0];
  const playerGuild = guilds.find((g) => g.id === playerGuildId);
  const heroDerivedStats = useMemo(() => computeDerivedHeroStats(knight), [knight]);
  const dragonBonuses = useMemo(() => computeDragonGlobalBonuses(dragonSanctuary), [dragonSanctuary]);

  const techModifiers = useMemo(() => {
    let spreadRebate =
      selectedRace.feeDiscount +
      (playerGuild ? playerGuild.taxRebatePct / 100 : 0) +
      heroDerivedStats.tradeFeeDiscountPct / 100;
    let freeStorageCap = 150 + (selectedRace.id === 'krasnoludy' ? 50 : 0);
    let caravanSpeedBonus =
      (selectedRace.id === 'elfy' ? 0.25 : 0) +
      heroDerivedStats.caravanSpeedBonus +
      dragonBonuses.caravanSpeedBonusPct / 100;
    let combatEscortBonus = selectedRace.combatEscortBonus;

    for (const id of unlockedTechIds) {
      const node = TECH_TREE.find((n) => n.id === id);
      if (!node) continue;
      if (node.effectType === 'spread_rebate') spreadRebate += node.effectValue;
      if (node.effectType === 'storage_cap') freeStorageCap += node.effectValue;
      if (node.effectType === 'caravan_speed') caravanSpeedBonus += node.effectValue;
      if (node.effectType === 'combat_escort') combatEscortBonus += node.effectValue;
    }

    return {
      spreadRebate: Math.min(0.65, spreadRebate),
      freeStorageCap,
      caravanSpeedBonus,
      combatEscortBonus: Math.min(0.92, combatEscortBonus),
    };
  }, [
    unlockedTechIds,
    selectedRace,
    playerGuild,
    heroDerivedStats.tradeFeeDiscountPct,
    heroDerivedStats.caravanSpeedBonus,
    dragonBonuses.caravanSpeedBonusPct,
  ]);

  // Calculate Player Net Worth
  const { totalUnitsStored, netWorth } = useMemo(() => {
    let invVal = 0;
    let units = 0;
    for (const spec of COMMODITIES) {
      const qty = playerInventory[spec.id] ?? 0;
      const price = markets[spec.id]?.currentPrice ?? spec.basePrice;
      invVal += qty * price;
      units += qty;
    }
    return {
      totalUnitsStored: units,
      netWorth: Math.round(playerGold + playerBondsGold + invVal),
    };
  }, [playerInventory, markets, playerGold, playerBondsGold]);

  // Helper to sync profile to backend & Firebase Cloud
  const syncProfileToCloudAndBackend = async (overrideToken?: string | null) => {
    const activeToken = overrideToken !== undefined ? overrideToken : backendToken;
    if (activeToken) {
      try {
        const res = await fetch('/api/profile/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`,
          },
          body: JSON.stringify({
            displayName: playerDisplayName,
            title: playerTitle,
            raceId: selectedRaceId,
            guildId: playerGuildId,
            gold: playerGold,
            bondsGold: playerBondsGold,
            netWorth,
            tradesExecutedCount,
            profitableTradesCount,
            inventory: playerInventory,
            unlockedTechIds,
            knight,
            duchy,
          }),
        });
        if (res.ok) {
          setSyncStatusMsg(`Zapisano ${new Date().toLocaleTimeString('pl-PL')}`);
        }
      } catch {
        // Ignore network error
      }
    }

    if (firebaseUser && firebaseUser.emailVerified) {
      try {
        await savePlayerProfileToFirestore(
          {
            uid: firebaseUser.uid,
            displayName: playerDisplayName,
            title: playerTitle,
            raceId: selectedRaceId,
            guildId: playerGuildId,
            gold: playerGold,
            bondsGold: playerBondsGold,
            netWorth,
            tradesExecutedCount,
            profitableTradesCount,
            inventory: playerInventory,
            unlockedTechIds,
          },
          hasExistingCloudDoc,
        );
        setHasExistingCloudDoc(true);
      } catch {
        // Handled by handleFirestoreError
      }
    }
  };

  // Automatic periodic sync when logged in
  useEffect(() => {
    if (!backendToken && !firebaseUser) return;
    const t = window.setTimeout(() => {
      syncProfileToCloudAndBackend();
    }, 1500);
    return () => clearTimeout(t);
  }, [
    playerGold,
    playerBondsGold,
    netWorth,
    unlockedTechIds,
    knight.level,
    knight.monstersDefeated,
    knight.availableTurns,
    duchy.rankIndex,
    duchy.armyGuardsCount,
    duchy.fleetGalleonsCount,
    backendToken,
  ]);

  // Caravan Progress, Knight Turn Regeneration & Bond Interest Loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = window.setInterval(() => {
      // Advance 3D caravans
      setActiveCaravans((prev) => {
        if (prev.length === 0) return prev;
        const remaining: ActiveCaravan3D[] = [];
        for (const c of prev) {
          const weatherSpeed = getWeatherTradeModifiers(pbrWeather).speedMultiplier;
          const seasonSpeed = SEASONS[macro.activeSeason]?.caravanSpeedMultiplier ?? 1.0;
          const disasterSpeed = macro.activeDisaster?.caravanSpeedMultiplier ?? 1.0;
          const step =
            0.08 *
            (1 + techModifiers.caravanSpeedBonus) *
            weatherSpeed *
            seasonSpeed *
            disasterSpeed;
          const nextProg = c.progress + step;
          if (nextProg >= 1) {
            const grossPayout = Math.round(c.expectedProfit + c.quantity * (markets[c.commodityId]?.currentPrice ?? 100));
            setPlayerGold((g) => g + grossPayout);
            setTradesExecutedCount((cnt) => cnt + 1);
            setProfitableTradesCount((cnt) => cnt + 1);
            const destName = CITIES.find((ct) => ct.id === c.destinationCityId)?.name ?? c.destinationCityId;
            pushNotification(
              `Karawana Dotarła do: ${destName}`,
              `Rozładowano ${c.quantity} szt. towaru. Zysk handlowy: +${Math.round(c.expectedProfit)} zł!`,
              'caravan',
            );
          } else {
            remaining.push({ ...c, progress: nextProg });
          }
        }
        return remaining;
      });

      // Regenerate Knight Turns automatically over time
      setKnight((prev) => {
        const effMaxTurns = computeDerivedHeroStats(prev).effectiveMaxTurns;
        if (prev.availableTurns >= effMaxTurns) return prev;
        if (Date.now() >= prev.nextTurnRegenAt) {
          return {
            ...prev,
            availableTurns: Math.min(effMaxTurns, prev.availableTurns + 1),
            nextTurnRegenAt: Date.now() + 1000 * 90,
          };
        }
        return prev;
      });

      // Regenerate Duchy Mage Mana slowly
      setDuchy((prev) => {
        if (prev.mageMana >= prev.mageMaxMana) return prev;
        const towerLvl = prev.buildings.wieza_magow ?? 1;
        return {
          ...prev,
          mageMana: Math.min(prev.mageMaxMana, prev.mageMana + 2 + towerLvl),
        };
      });

      // Accrue Royal Mint Bond yield & storage cost
      setPlayerBondsGold((bonds) => {
        if (bonds <= 0) return 0;
        const tickYield = bonds * (macro.royalMintBondYieldPct / 100) * 0.015;
        return Number((bonds + tickYield).toFixed(2));
      });

      const demurrage = calculateStorageDemurrageCost(
        totalUnitsStored,
        techModifiers.freeStorageCap,
        macro.storageDemurrageRate,
      );
      if (demurrage > 0) {
        setPlayerGold((g) => Math.max(0, Number((g - demurrage * 0.25).toFixed(2))));
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [
    gameState,
    techModifiers.caravanSpeedBonus,
    techModifiers.freeStorageCap,
    macro.royalMintBondYieldPct,
    macro.storageDemurrageRate,
    macro.activeSeason,
    macro.activeDisaster,
    totalUnitsStored,
    markets,
    pbrWeather,
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (gameState === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleStartGame();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (activeTrailEvent) {
          setActiveTrailEvent(null);
          setTrailEventOutcome(null);
        } else if (showCinematicIntro) {
          setShowCinematicIntro(false);
        } else if (gameState === 'playing') {
          setGameState('paused');
        } else if (gameState === 'paused') {
          setGameState('playing');
        }
      } else if ((e.key === 'h' || e.key === 'H') && gameState === 'playing') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        const nextMuted = soundEngine.toggleMute();
        setMuted(nextMuted);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, showCinematicIntro, activeTrailEvent]);

  const handleStartGame = () => {
    const race = RACES.find((r) => r.id === selectedRaceId) ?? RACES[0];
    if (!backendUsername && !firebaseUser) {
      setPlayerGold(race.startingCapital);
      setKnight(createInitialKnightState(race.id));
    }
    document.body.dataset.state = 'playing';
    setGameState('playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundEngine.playTechUnlock();
  };

  // --- P2P & SPOT TRADE HANDLERS ---
  const handleExecuteTrade = async (params: {
    commodityId: CommodityId;
    side: 'buy' | 'sell';
    quantity: number;
    cityId: string;
  }) => {
    const st = markets[params.commodityId];
    if (!st) return;
    const spot = st.cityPrices[params.cityId] ?? st.currentPrice;
    const effectiveTaxPct = macro.dynamicTaxRatePct * (1 - techModifiers.spreadRebate);
    const unitPrice =
      params.side === 'buy'
        ? spot * (1 + st.spreadPct / 200)
        : spot * (1 - st.spreadPct / 200);
    const gross = unitPrice * params.quantity;
    const tax = gross * (effectiveTaxPct / 100);

    if (params.side === 'buy') {
      const totalCost = gross + tax;
      if (totalCost > playerGold) return;
      setPlayerGold((g) => Number((g - totalCost).toFixed(2)));
      setPlayerInventory((inv) => ({
        ...inv,
        [params.commodityId]: (inv[params.commodityId] ?? 0) + params.quantity,
      }));
    } else {
      const held = playerInventory[params.commodityId] ?? 0;
      if (params.quantity > held) return;
      const totalNet = gross - tax;
      setPlayerGold((g) => Number((g + totalNet).toFixed(2)));
      setPlayerInventory((inv) => ({
        ...inv,
        [params.commodityId]: Math.max(0, (inv[params.commodityId] ?? 0) - params.quantity),
      }));
    }

    const newRecord: TradeRecordItem = {
      id: `tr_${Date.now()}`,
      commodityId: params.commodityId,
      side: params.side,
      quantity: params.quantity,
      price: Number(unitPrice.toFixed(2)),
      cityId: params.cityId,
      timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setTradeHistory((prev) => [newRecord, ...prev.slice(0, 29)]);
    setTradesExecutedCount((c) => c + 1);
    setProfitableTradesCount((c) => c + 1);
    soundEngine.playTradeFill(params.side === 'buy');

    const commSpec = COMMODITIES.find((c) => c.id === params.commodityId);
    pushNotification(
      `Transakcja ${params.side === 'buy' ? 'KUPNA' : 'SPRZEDAŻY'} na Giełdzie`,
      `${params.quantity} szt. ${commSpec?.name} @ ${unitPrice.toFixed(1)} zł`,
      'trade',
    );

    if (firebaseUser && firebaseUser.emailVerified) {
      logTradeToFirestore({
        commodityId: params.commodityId,
        side: params.side,
        quantity: params.quantity,
        price: Number(unitPrice.toFixed(2)),
        cityId: params.cityId,
      }).catch(() => {});
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (backendToken) headers.Authorization = `Bearer ${backendToken}`;
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.updatedMarket) {
        setMarkets((prev) => ({ ...prev, [params.commodityId]: data.updatedMarket }));
      }
      if (data.macro) {
        setMacro(data.macro);
      }
    } catch {
      // Optimistic local state already applied
    }
  };

  const handleBuyExchangeOffer = async (offer: PlayerExchangeOffer) => {
    const totalCost = Math.round(offer.quantity * offer.pricePerUnit);
    if (playerGold < totalCost) return;

    setPlayerGold((g) => g - totalCost);
    setPlayerInventory((inv) => ({
      ...inv,
      [offer.commodityId]: (inv[offer.commodityId] ?? 0) + offer.quantity,
    }));
    setExchangeOffers((prev) => prev.filter((o) => o.id !== offer.id));
    setTradesExecutedCount((c) => c + 1);
    setProfitableTradesCount((c) => c + 1);
    soundEngine.playTradeFill(true);

    const comm = COMMODITIES.find((c) => c.id === offer.commodityId);
    pushNotification(
      offer.isCitySurplus ? 'Wykupiono Nadwyżkę Miejską' : 'Kupiono Towar od Gracza',
      `Nabyto ${offer.quantity}x ${comm?.name} od ${offer.sellerName} za ${totalCost} zł.`,
      'trade',
    );

    try {
      const res = await fetch('/api/exchange/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: offer.id }),
      });
      const data = await res.json();
      if (data.exchangeOffers) setExchangeOffers(data.exchangeOffers);
      if (data.markets) setMarkets(data.markets);
      if (data.macro) setMacro(data.macro);
    } catch {
      // Local state already updated
    }
  };

  const handleCreateExchangeOffer = async (params: {
    commodityId: CommodityId;
    quantity: number;
    pricePerUnit: number;
    cityId: string;
  }) => {
    const held = playerInventory[params.commodityId] ?? 0;
    if (params.quantity <= 0 || params.quantity > held) return;

    // Buyer matches or listing goes on board; seller receives immediate escrow advance (95%) + listing on board
    const immediateAdvance = Math.round(params.quantity * params.pricePerUnit);
    setPlayerInventory((inv) => ({
      ...inv,
      [params.commodityId]: Math.max(0, (inv[params.commodityId] ?? 0) - params.quantity),
    }));
    setPlayerGold((g) => g + immediateAdvance);
    setTradesExecutedCount((c) => c + 1);
    setProfitableTradesCount((c) => c + 1);
    soundEngine.playTradeFill(false);

    const comm = COMMODITIES.find((c) => c.id === params.commodityId);
    pushNotification(
      'Oferta Kupiecka Wystawiona na Giełdzie',
      `Wystawiono ${params.quantity}x ${comm?.name} po ${params.pricePerUnit} zł/szt. (Rozliczono: +${immediateAdvance} zł).`,
      'trade',
    );

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (backendToken) headers.Authorization = `Bearer ${backendToken}`;
      const res = await fetch('/api/exchange/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sellerName: playerDisplayName,
          sellerGuild: `[${playerGuild?.tag ?? 'ZŁOTO'}]`,
          cityId: params.cityId,
          commodityId: params.commodityId,
          quantity: params.quantity,
          pricePerUnit: params.pricePerUnit,
        }),
      });
      const data = await res.json();
      if (data.exchangeOffers) setExchangeOffers(data.exchangeOffers);
    } catch {
      // Local state already updated
    }
  };

  // --- KNIGHT RPG, PERSONALIZATION, MULTI-PATH PROGRESSION, EQUIPMENT & EXPEDITIONS HANDLERS ---
  const handleTrainKnightStat = (stat: 'strength' | 'defense' | 'tactics' | 'heal', costGold: number) => {
    if (playerGold < costGold) return;
    setPlayerGold((g) => g - costGold);
    soundEngine.playTechUnlock();

    setKnight((prev) => {
      const derivedBefore = computeDerivedHeroStats(prev);
      if (stat === 'heal') {
        return { ...prev, hp: derivedBefore.effectiveMaxHp };
      }
      const nextXp = prev.xp + 40;
      const leveledUp = nextXp >= prev.xpToNextLevel;
      const nextLevel = leveledUp ? prev.level + 1 : prev.level;
      const nextMaxHp = leveledUp ? prev.maxHp + 25 : prev.maxHp;

      const updated: KnightState = {
        ...prev,
        level: nextLevel,
        xp: leveledUp ? nextXp - prev.xpToNextLevel : nextXp,
        xpToNextLevel: leveledUp ? Math.round(prev.xpToNextLevel * 1.35) : prev.xpToNextLevel,
        maxHp: nextMaxHp,
        strength: stat === 'strength' ? prev.strength + 3 : prev.strength + (leveledUp ? 2 : 0),
        defense: stat === 'defense' ? prev.defense + 3 : prev.defense + (leveledUp ? 2 : 0),
        tactics: stat === 'tactics' ? prev.tactics + 3 : prev.tactics + (leveledUp ? 2 : 0),
        skillPoints: (prev.skillPoints ?? 0) + (leveledUp ? 1 : 0),
      };
      const derivedAfter = computeDerivedHeroStats(updated);
      return {
        ...updated,
        hp: leveledUp ? derivedAfter.effectiveMaxHp : Math.min(derivedAfter.effectiveMaxHp, prev.hp),
      };
    });
  };

  const handleCustomizeHero = (updates: {
    name?: string;
    title?: string;
    portraitId?: string;
    bannerColorHex?: string;
    activePath?: HeroPathId;
  }) => {
    setKnight((prev) => ({
      ...prev,
      ...(updates.name ? { name: updates.name } : {}),
      ...(updates.title ? { title: updates.title } : {}),
      ...(updates.portraitId ? { portraitId: updates.portraitId } : {}),
      ...(updates.bannerColorHex ? { bannerColorHex: updates.bannerColorHex } : {}),
      ...(updates.activePath ? { activePath: updates.activePath } : {}),
    }));
    soundEngine.playTradeFill(true);
    pushNotification(
      'Zaktualizowano Personalizację Bohatera',
      'Nowy wizerunek i tożsamość postaci zostały zapisane.',
      'event',
    );
  };

  const handleAllocateSkillPoint = (pathId: HeroPathId) => {
    if ((knight.skillPoints ?? 0) <= 0) return;
    setKnight((prev) => allocateHeroSkillPoint(prev, pathId));
    soundEngine.playTechUnlock();
    pushNotification(
      'Rozwinięto Ścieżkę Specjalizacji',
      'Punkt Rozwoju został przydzielony — statystyki bojowe i ekonomiczne wzrosły.',
      'event',
    );
  };

  const handleBuyHeroItem = (item: RpgEquipmentItem) => {
    const owned = knight.ownedItemIds ?? [];
    if (playerGold < item.costGold || owned.includes(item.id)) return;
    if (item.requiredCommodity) {
      const held = playerInventory[item.requiredCommodity.id] ?? 0;
      if (held < item.requiredCommodity.qty) return;
      const reqId = item.requiredCommodity.id;
      const reqQty = item.requiredCommodity.qty;
      setPlayerInventory((inv) => ({
        ...inv,
        [reqId]: Math.max(0, (inv[reqId] ?? 0) - reqQty),
      }));
    }

    setPlayerGold((g) => g - item.costGold);
    soundEngine.playTechUnlock();

    setKnight((prev) => {
      const withOwned: KnightState = {
        ...prev,
        ownedItemIds: [...(prev.ownedItemIds ?? []), item.id],
        recentLootLog: [
          `Kupiono w Kuźni: [${item.rarityLabel}] ${item.name} (${item.bonusText}).`,
          ...(prev.recentLootLog ?? []).slice(0, 14),
        ],
      };
      return equipHeroItem(withOwned, item.id);
    });

    pushNotification(
      `Wykuto Ekwipunek: ${item.name}`,
      `${item.bonusText} — przedmiot został założony w slocie ${item.slotLabel}.`,
      'event',
    );
  };

  const handleEquipHeroItem = (itemId: string) => {
    setKnight((prev) => equipHeroItem(prev, itemId));
    soundEngine.playTradeFill(true);
  };

  const handleUnequipHeroSlot = (slot: EquipmentSlot) => {
    setKnight((prev) => unequipHeroSlot(prev, slot));
    soundEngine.playTradeFill(false);
  };

  const handleScoutForLoot = () => {
    const scoutCost = 180;
    if (knight.availableTurns <= 0 || playerGold < scoutCost) return;
    setPlayerGold((g) => Math.max(0, g - scoutCost));

    const derived = computeDerivedHeroStats(knight);
    const seed = Date.now() + knight.monstersDefeated * 37 + (knight.ownedItemIds?.length ?? 0) * 17;
    const drop = rollLootDrop({
      source: 'scout',
      lootFindBonusPct: derived.lootFindBonusPct,
      ownedItemIds: knight.ownedItemIds ?? [],
      seed,
    });

    if (drop.duplicateBonusGold > 0) {
      setPlayerGold((g) => g + drop.duplicateBonusGold);
    }

    setKnight((prev) => {
      const nextOwned =
        drop.foundItem && !drop.isDuplicate
          ? [...(prev.ownedItemIds ?? []), drop.foundItem.id]
          : prev.ownedItemIds ?? [];
      return {
        ...prev,
        availableTurns: Math.max(0, prev.availableTurns - 1),
        ownedItemIds: nextOwned,
        recentLootLog: [drop.narrative, ...(prev.recentLootLog ?? []).slice(0, 14)],
      };
    });

    soundEngine.playTechUnlock();
    pushNotification(
      drop.foundItem && !drop.isDuplicate
        ? `Odkryto Artefakt: ${drop.foundItem.name}!`
        : 'Zwiad po Skarby Zakończony',
      drop.narrative,
      'event',
    );
  };

  const executeSingleCombatTurn = (
    currentKnight: KnightState,
    questSpec: MonsterQuestSpec,
    tactic: 'aggressive' | 'balanced' | 'defensive',
    isFirstTurn: boolean,
  ) => {
    const derived = computeDerivedHeroStats(currentKnight);
    const activeQ = isFirstTurn
      ? {
          questId: questSpec.id,
          currentStep: 1,
          totalSteps: questSpec.turnsRequired,
          monsterCurrentHp: questSpec.monsterMaxHp,
          monsterMaxHp: questSpec.monsterMaxHp,
          combatLogs: [`[Wyprawa rozpoczęta] ${currentKnight.name} wkracza do: ${questSpec.name}!`],
          status: 'in_progress' as const,
        }
      : currentKnight.activeQuest!;

    const stanceAtkMult = tactic === 'aggressive' ? 1.3 : tactic === 'defensive' ? 0.85 : 1.05;
    const stanceDefMult = tactic === 'defensive' ? 1.35 : tactic === 'aggressive' ? 0.8 : 1.0;

    const critBonus = 1 + derived.effectiveTactics * 0.008 + techModifiers.combatEscortBonus * 0.35;
    const rawPlayerDmg =
      derived.effectiveStrength * 1.45 * stanceAtkMult * critBonus +
      derived.arcaneBonusDmg +
      dragonBonuses.knightAttackBonus -
      questSpec.monsterDefense * 0.35;
    const playerDmg = Math.max(12, Math.round(rawPlayerDmg));

    const nextMonsterHp = Math.max(0, activeQ.monsterCurrentHp - playerDmg);

    const rawMonsterDmg =
      questSpec.monsterAttack * 0.75 - derived.effectiveDefense * 0.55 * stanceDefMult;
    const monsterDmg = nextMonsterHp === 0 ? 0 : Math.max(6, Math.round(rawMonsterDmg));

    const healAfterTurn = 6 + derived.turnHealBonus;
    const nextKnightHp = Math.max(
      15,
      Math.min(derived.effectiveMaxHp, currentKnight.hp - monsterDmg + healAfterTurn),
    );

    const turnLog = `Tura ${activeQ.currentStep}/${activeQ.totalSteps}: ${currentKnight.name} zadaje ${playerDmg} obr.${
      derived.arcaneBonusDmg > 0 ? ` (w tym +${derived.arcaneBonusDmg} runicznych)` : ''
    }! ${
      monsterDmg > 0 ? `${questSpec.monsterName} kontratakuje za ${monsterDmg} HP.` : 'Wróg powalony!'
    }`;

    const isVictory = nextMonsterHp <= 0;
    const isOutOfTurnsRetreat = !isVictory && activeQ.currentStep >= activeQ.totalSteps;

    if (isVictory) {
      soundEngine.playTechUnlock();
      const goldReward = Math.round(questSpec.rewardGold * (1 + derived.goldLootBonusPct / 100));
      setPlayerGold((g) => g + goldReward);
      setPlayerInventory((inv) => {
        const nextInv = { ...inv };
        for (const item of questSpec.rewardCommodities) {
          nextInv[item.id] = (nextInv[item.id] ?? 0) + item.qty;
        }
        return nextInv;
      });

      const drop = rollLootDrop({
        source: 'quest',
        lootFindBonusPct: derived.lootFindBonusPct,
        ownedItemIds: currentKnight.ownedItemIds ?? [],
        seed: Date.now() + currentKnight.monstersDefeated * 53,
      });
      if (drop.duplicateBonusGold > 0) {
        setPlayerGold((g) => g + drop.duplicateBonusGold);
      }

      const totalXp = currentKnight.xp + questSpec.rewardXp;
      const leveledUp = totalXp >= currentKnight.xpToNextLevel;
      const nextLvl = leveledUp ? currentKnight.level + 1 : currentKnight.level;
      const nextBaseMaxHp = leveledUp ? currentKnight.maxHp + 30 : currentKnight.maxHp;

      pushNotification(
        `Zwycięstwo: ${questSpec.name}!`,
        `Pokonano ${questSpec.monsterName}! +${goldReward} zł, surowce${
          drop.foundItem && !drop.isDuplicate ? ` oraz artefakt ${drop.foundItem.name}!` : '.'
        }`,
        'event',
      );

      const nextOwned =
        drop.foundItem && !drop.isDuplicate
          ? [...(currentKnight.ownedItemIds ?? []), drop.foundItem.id]
          : currentKnight.ownedItemIds ?? [];

      const updatedWinner: KnightState = {
        ...currentKnight,
        level: nextLvl,
        xp: leveledUp ? totalXp - currentKnight.xpToNextLevel : totalXp,
        xpToNextLevel: leveledUp ? Math.round(currentKnight.xpToNextLevel * 1.35) : currentKnight.xpToNextLevel,
        maxHp: nextBaseMaxHp,
        strength: leveledUp ? currentKnight.strength + 4 : currentKnight.strength,
        defense: leveledUp ? currentKnight.defense + 3 : currentKnight.defense,
        tactics: leveledUp ? currentKnight.tactics + 3 : currentKnight.tactics,
        skillPoints: (currentKnight.skillPoints ?? 0) + (leveledUp ? 1 : 0),
        availableTurns: Math.max(0, currentKnight.availableTurns - 1),
        monstersDefeated: currentKnight.monstersDefeated + 1,
        totalLootGold: currentKnight.totalLootGold + goldReward,
        ownedItemIds: nextOwned,
        recentLootLog: [
          `Pokonano ${questSpec.monsterName}: +${goldReward} zł. ${drop.narrative}`,
          ...(currentKnight.recentLootLog ?? []).slice(0, 14),
        ],
        activeQuest: null,
      };
      const winnerDerived = computeDerivedHeroStats(updatedWinner);
      return {
        ...updatedWinner,
        hp: leveledUp ? winnerDerived.effectiveMaxHp : nextKnightHp,
      };
    }

    if (isOutOfTurnsRetreat) {
      soundEngine.playCaravanHorn();
      const partialXp = Math.round(questSpec.rewardXp * 0.3);
      pushNotification(
        `Taktyczny Odwrót: ${questSpec.name}`,
        `${questSpec.monsterName} przetrwał z ${nextMonsterHp} HP! Zdobyto +${partialXp} XP — wzmocnij ekwipunek lub ścieżkę rozwoju i wróć.`,
        'event',
      );
      return {
        ...currentKnight,
        xp: currentKnight.xp + partialXp,
        hp: nextKnightHp,
        availableTurns: Math.max(0, currentKnight.availableTurns - 1),
        recentLootLog: [
          `Taktyczny odwrót z ${questSpec.name} (wróg miał ${nextMonsterHp} HP, +${partialXp} XP).`,
          ...(currentKnight.recentLootLog ?? []).slice(0, 14),
        ],
        activeQuest: null,
      };
    }

    soundEngine.playCaravanHorn();
    return {
      ...currentKnight,
      hp: nextKnightHp,
      availableTurns: Math.max(0, currentKnight.availableTurns - 1),
      activeQuest: {
        ...activeQ,
        currentStep: activeQ.currentStep + 1,
        monsterCurrentHp: nextMonsterHp,
        combatLogs: [turnLog, ...activeQ.combatLogs],
      },
    };
  };

  const handleStartKnightQuest = (quest: MonsterQuestSpec) => {
    if (knight.availableTurns <= 0) return;
    setKnight((prev) => executeSingleCombatTurn(prev, quest, 'balanced', true));
  };

  const handleExecuteKnightTurn = (tactic: 'aggressive' | 'balanced' | 'defensive') => {
    if (knight.availableTurns <= 0 || !knight.activeQuest) return;
    const questSpec =
      MONSTER_QUESTS.find((q) => q.id === knight.activeQuest?.questId) ?? MONSTER_QUESTS[0];
    setKnight((prev) => executeSingleCombatTurn(prev, questSpec, tactic, false));
  };

  const handleRestockKnightTurnsWithGrain = (grainCost: number, goldCost: number) => {
    if ((playerInventory.zboze ?? 0) < grainCost || playerGold < goldCost) return;
    setPlayerGold((g) => g - goldCost);
    setPlayerInventory((inv) => ({
      ...inv,
      zboze: Math.max(0, (inv.zboze ?? 0) - grainCost),
    }));
    setKnight((prev) => {
      const derived = computeDerivedHeroStats(prev);
      return {
        ...prev,
        availableTurns: Math.min(derived.effectiveMaxTurns, prev.availableTurns + 4),
        hp: Math.min(derived.effectiveMaxHp, prev.hp + 45),
      };
    });
    soundEngine.playTradeFill(true);
    pushNotification(
      'Wydano Prowiant dla Drużyny Bohatera',
      'Zregenerowano +4 Tury Wypraw oraz +45 HP ze spichlerza Zboża.',
      'event',
    );
  };

  const handleDispatchCaravan = (params: {
    originCityId: string;
    destinationCityId: string;
    commodityId: CommodityId;
    quantity: number;
    escortLevel: number;
    totalUpfrontCost: number;
    expectedProfit: number;
  }) => {
    setPlayerGold((g) => Math.max(0, Number((g - params.totalUpfrontCost).toFixed(2))));
    const newCaravan: ActiveCaravan3D = {
      id: `car_${Date.now()}`,
      originCityId: params.originCityId,
      destinationCityId: params.destinationCityId,
      commodityId: params.commodityId,
      quantity: params.quantity,
      escortLevel: params.escortLevel,
      progress: 0.04,
      expectedProfit: params.expectedProfit,
    };
    setActiveCaravans((prev) => [...prev, newCaravan]);
    soundEngine.playCaravanHorn();
    const origName = CITIES.find((c) => c.id === params.originCityId)?.name ?? params.originCityId;
    const destName = CITIES.find((c) => c.id === params.destinationCityId)?.name ?? params.destinationCityId;
    pushNotification(
      'Karawana 3D Wyruszyła na Szlak',
      `Trasa: ${origName} → ${destName} (${params.quantity} szt.). Spodziewany zysk: +${Math.round(params.expectedProfit)} zł.`,
      'caravan',
    );
  };

  const handleLaunchFearExpedition = (cost: number, dungeonName: string) => {
    if (playerGold < cost) return;
    setPlayerGold((g) => g - cost);
    soundEngine.playCaravanHorn();
    setPlayerInventory((inv) => ({
      ...inv,
      smocza_luska: (inv.smocza_luska ?? 0) + 2,
      mithril: (inv.mithril ?? 0) + 3,
    }));
    setKnight((prev) => ({
      ...prev,
      monstersDefeated: prev.monstersDefeated + 1,
    }));
    pushNotification(
      `Zwycięska Wyprawa: ${dungeonName}`,
      'Twoi Rycerze i Magowie pokonali strażników! Zdobyto +2 Smocze Łuski oraz +3 Sztaby Mithrilu.',
      'event',
    );
  };

  const handleBidAuction = (auc: AuctionItem, bidAmount: number, isBuyout: boolean) => {
    if (playerGold < bidAmount) return;
    soundEngine.playAuctionGavel();

    if (isBuyout || bidAmount >= auc.buyoutPrice) {
      setPlayerGold((g) => g - auc.buyoutPrice);
      setPlayerInventory((inv) => ({
        ...inv,
        [auc.commodityId]: (inv[auc.commodityId] ?? 0) + auc.quantity,
      }));
      setAuctions((prev) => prev.filter((a) => a.id !== auc.id));
    } else {
      setPlayerGold((g) => g - Math.round(bidAmount * 0.1));
      setAuctions((prev) =>
        prev.map((a) =>
          a.id === auc.id
            ? { ...a, currentBid: bidAmount, highestBidder: playerDisplayName, bidsCount: a.bidsCount + 1 }
            : a,
        ),
      );
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auction:bid',
          payload: {
            auctionId: auc.id,
            bidderName: playerDisplayName,
            bidAmount,
            isBuyout,
          },
        }),
      );
    }
  };

  const handleCreateAuction = (params: {
    itemName: string;
    commodityId: CommodityId;
    quantity: number;
    auctionType: 'english' | 'dutch';
    startPrice: number;
    buyoutPrice: number;
  }) => {
    setPlayerInventory((inv) => ({
      ...inv,
      [params.commodityId]: Math.max(0, (inv[params.commodityId] ?? 0) - params.quantity),
    }));
    const newId = `auc_${Date.now()}`;
    const newAuc: AuctionItem = {
      id: newId,
      sellerName: playerDisplayName,
      sellerGuild: `[${playerGuild?.tag ?? 'ZŁOTO'}]`,
      itemName: params.itemName,
      commodityId: params.commodityId,
      quantity: params.quantity,
      rarity: 'Rzadki',
      auctionType: params.auctionType,
      startPrice: params.startPrice,
      currentBid: params.startPrice,
      buyoutPrice: params.buyoutPrice,
      highestBidder: 'Brak ofert',
      bidsCount: 0,
      expiresAt: Date.now() + 1000 * 60 * 20,
    };
    setAuctions((prev) => [newAuc, ...prev]);
    soundEngine.playAuctionGavel();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'auction:create',
          payload: newAuc,
        }),
      );
    }
  };

  const handleUnlockTech = (node: TechNode) => {
    if (playerGold < node.costGold || unlockedTechIds.includes(node.id)) return;
    setPlayerGold((g) => g - node.costGold);
    if (node.requiredCommodity) {
      const reqId = node.requiredCommodity.id;
      const reqQty = node.requiredCommodity.qty;
      setPlayerInventory((inv) => ({
        ...inv,
        [reqId]: Math.max(0, (inv[reqId] ?? 0) - reqQty),
      }));
    }
    setUnlockedTechIds((prev) => [...prev, node.id]);
    soundEngine.playTechUnlock();
    pushNotification(
      `Odblokowano Technologię: ${node.name}`,
      node.effectSummary,
      'event',
    );
  };

  const handleSendChatMessage = (channel: 'globalny' | 'handel' | 'gildia', text: string) => {
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      channel,
      sender: playerDisplayName,
      senderTitle: selectedRace.name.split(' ')[0],
      guildTag: `[${playerGuild?.tag ?? 'ZŁOTO'}]`,
      text,
      timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat:send',
          payload: newMsg,
        }),
      );
    }
  };

  const handleDonateGuild = (guildId: string, amount: number) => {
    if (playerGold < amount) return;
    setPlayerGold((g) => g - amount);
    setGuilds((prev) =>
      prev.map((g) => (g.id === guildId ? { ...g, treasuryGold: g.treasuryGold + amount } : g)),
    );
    soundEngine.playTradeFill(true);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'guild:donate',
          payload: { guildId, amount },
        }),
      );
    }
  };

  // ==================== DUCHY, STORY CAMPAIGN & MAGE HANDLERS ====================
  const handleClaimStoryChapter = (chapter: StoryChapterSpec) => {
    if (duchy.completedChapterIds.includes(chapter.id)) return;
    setPlayerGold((g) => g + chapter.rewardGold);
    setPlayerInventory((inv) => ({
      ...inv,
      [chapter.rewardCommodity.id]:
        (inv[chapter.rewardCommodity.id] ?? 0) + chapter.rewardCommodity.qty,
    }));
    setPlayerTitle(chapter.rankTitleEarned);
    setDuchy((prev) => ({
      ...prev,
      rankIndex: Math.max(prev.rankIndex, chapter.chapterNumber),
      completedChapterIds: [...prev.completedChapterIds, chapter.id],
    }));
    soundEngine.playTechUnlock();
    pushNotification(
      `Ukończono ${chapter.title}!`,
      `Awansowano na tytuł "${chapter.rankTitleEarned}". Nagroda: +${chapter.rewardGold} zł oraz +${chapter.rewardCommodity.qty} szt. ${chapter.rewardCommodity.id}!`,
      'event',
    );
  };

  const handleUpgradeDuchyBuilding = (
    building: DuchyBuildingSpec,
    costGold: number,
    reqQty: number,
  ) => {
    const currentLvl = duchy.buildings[building.id] ?? 0;
    if (currentLvl >= 10) return;
    if (playerGold < costGold) return;
    const haveComm = playerInventory[building.requiredCommodity.id] ?? 0;
    if (haveComm < reqQty) return;

    setPlayerGold((g) => g - costGold);
    setPlayerInventory((inv) => ({
      ...inv,
      [building.requiredCommodity.id]: Math.max(
        0,
        (inv[building.requiredCommodity.id] ?? 0) - reqQty,
      ),
    }));

    setDuchy((prev) => ({
      ...prev,
      buildings: {
        ...prev.buildings,
        [building.id]: (prev.buildings[building.id] ?? 0) + 1,
      },
      mageMaxMana:
        building.id === 'wieza_magow' ? prev.mageMaxMana + 20 : prev.mageMaxMana,
      mageMana:
        building.id === 'wieza_magow'
          ? Math.min(prev.mageMaxMana + 20, prev.mageMana + 20)
          : prev.mageMana,
      armyGuardsCount:
        building.id === 'koszary' ? prev.armyGuardsCount + 8 : prev.armyGuardsCount,
      fleetGalleonsCount:
        building.id === 'stocznia' ? prev.fleetGalleonsCount + 1 : prev.fleetGalleonsCount,
    }));

    if (building.id === 'koszary') {
      setKnight((prev) => ({ ...prev, strength: prev.strength + 6 }));
    }

    soundEngine.playTechUnlock();
    pushNotification(
      `Rozbudowano: ${building.name} (Poz. ${currentLvl + 1})`,
      building.specialEffectText,
      'event',
    );
  };

  const handleCastMageSpell = (spell: MageSpellSpec) => {
    if (duchy.mageMana < spell.manaCost) return;
    const scrolls = playerInventory.runiczny_pergamin ?? 0;
    if (scrolls < spell.scrollCost) return;

    setDuchy((prev) => ({
      ...prev,
      mageMana: Math.max(0, prev.mageMana - spell.manaCost),
    }));
    setPlayerInventory((inv) => ({
      ...inv,
      runiczny_pergamin: Math.max(0, (inv.runiczny_pergamin ?? 0) - spell.scrollCost),
    }));

    if (spell.id === 'spell_midas_harvest') {
      const goldBonus = 1850 + (duchy.buildings.faktoria ?? 0) * 350;
      setPlayerGold((g) => g + goldBonus);
      setPlayerInventory((inv) => ({
        ...inv,
        zboze: (inv.zboze ?? 0) + 15,
        krysztaly_many: (inv.krysztaly_many ?? 0) + 4,
        mithril: (inv.mithril ?? 0) + 2,
      }));
      pushNotification(
        `Zaklęcie: ${spell.name}`,
        `Złoty Deszcz Kupiecki zasilił Twój skarbiec o +${goldBonus} zł oraz +15 Zboża, +4 Kryształy Many i +2 Mithril!`,
        'event',
      );
    } else if (spell.id === 'spell_portal_wind') {
      setKnight((prev) => ({
        ...prev,
        hp: prev.maxHp,
        availableTurns: Math.min(prev.maxTurns + 2, prev.availableTurns + 4),
      }));
      pushNotification(
        `Zaklęcie: ${spell.name}`,
        'Twój Rycerz otrzymał +4 Tury Wypraw oraz pełne uleczenie punktów życia!',
        'event',
      );
    } else if (spell.id === 'spell_arcane_thunder') {
      setKnight((prev) => {
        const nextActiveQuest = prev.activeQuest
          ? {
              ...prev.activeQuest,
              monsterCurrentHp: Math.max(5, prev.activeQuest.monsterCurrentHp - 140),
              combatLogs: [
                ...prev.activeQuest.combatLogs,
                `⚡ [Mag Księstwa] Rzucono ${spell.name}! Bestia otrzymuje 140 obrażeń magicznych, a Siła Rycerza rośnie o +6!`,
              ],
            }
          : null;
        return {
          ...prev,
          strength: prev.strength + 6,
          activeQuest: nextActiveQuest,
        };
      });
      pushNotification(
        `Zaklęcie Bojowe: ${spell.name}`,
        'Piorun uderzył w cel wyprawy (140 obr. magicznych) i wzmocnił Siłę Rycerza na stałe o +6!',
        'event',
      );
    }

    soundEngine.playTechUnlock();
  };

  const handleRecruitForces = (
    unitType: 'guards' | 'galleons' | 'dragon_feed',
    costGold: number,
  ) => {
    if (playerGold < costGold) return;
    setPlayerGold((g) => g - costGold);

    if (unitType === 'guards') {
      setDuchy((prev) => ({ ...prev, armyGuardsCount: prev.armyGuardsCount + 15 }));
      setKnight((prev) => ({ ...prev, defense: prev.defense + 3 }));
      pushNotification(
        'Zwerbowano Gwardię Książęcą',
        'Do Twojego garnizonu dołączyło +15 zbrojnych gwardzistów (+3 Pancerz Rycerza).',
        'event',
      );
    } else if (unitType === 'galleons') {
      setDuchy((prev) => ({ ...prev, fleetGalleonsCount: prev.fleetGalleonsCount + 1 }));
      pushNotification(
        'Zwodowano Nowy Galeon Kupiecki',
        'Twoja Flota Morska powiększyła się o 1 Galeon (+160 zł dywidendy z zamorskich szlaków).',
        'event',
      );
    } else if (unitType === 'dragon_feed') {
      setDuchy((prev) => ({
        ...prev,
        dragonCompanionStage: (prev.dragonCompanionStage >= 2 ? 3 : 2) as 1 | 2 | 3,
      }));
      setKnight((prev) => ({ ...prev, strength: prev.strength + 8 }));
      pushNotification(
        'Przebudzenie Smoczego Towarzysza!',
        'Smok Vaelor wyrósł na kolejny etap (+8 Siły Rycerza w wyprawach turowych)!',
        'event',
      );
    }
    soundEngine.playTradeFill(true);
  };

  const handleCollectDuchyTribute = () => {
    const faktoriaGold = (duchy.buildings.faktoria ?? 0) * 420;
    const koszaryGold = (duchy.buildings.koszary ?? 0) * 260;
    const wiezaGold = (duchy.buildings.wieza_magow ?? 0) * 340;
    const stoczniaGold = (duchy.buildings.stocznia ?? 0) * 520;
    const fleetGold = duchy.fleetGalleonsCount * 160;
    const basePayout = Math.max(
      250,
      Math.round((faktoriaGold + koszaryGold + wiezaGold + stoczniaGold + fleetGold) * 0.5),
    );
    const payoutGold = Math.round(basePayout * (1 + dragonBonuses.duchyIncomeBonusPct / 100));

    setPlayerGold((g) => g + payoutGold);
    setPlayerInventory((inv) => {
      const next = { ...inv };
      for (const b of DUCHY_BUILDINGS) {
        const lvl = duchy.buildings[b.id] ?? 0;
        if (lvl > 0) {
          next[b.commodityYieldPerLevel.id] =
            (next[b.commodityYieldPerLevel.id] ?? 0) + b.commodityYieldPerLevel.qty * lvl;
        }
      }
      return next;
    });
    soundEngine.playTradeFill(true);
    pushNotification(
      'Zebrano Podatki i Plony Księstwa',
      `Skarbiec Księstwa wypłacił +${payoutGold} zł dywidendy oraz dostarczył surowce z Twoich budowli do magazynu!`,
      'trade',
    );
  };

  const handleCompleteRoyalContract = (contract: RoyalSupplyContract) => {
    if (completedContractIds.includes(contract.id)) return;
    const held = playerInventory[contract.commodityId] ?? 0;
    if (held < contract.requiredQty) return;

    setPlayerInventory((inv) => ({
      ...inv,
      [contract.commodityId]: Math.max(0, (inv[contract.commodityId] ?? 0) - contract.requiredQty),
    }));
    setPlayerGold((g) => g + contract.rewardGold);
    setPrestigePoints((p) => p + contract.rewardPrestige);
    setCompletedContractIds((prev) => [...prev, contract.id]);
    setTradesExecutedCount((c) => c + 1);
    setProfitableTradesCount((c) => c + 1);
    soundEngine.playTechUnlock();
    pushNotification(
      `Kontrakt Królewski Zrealizowany: ${contract.issuingCityName}`,
      `Wypłacono +${contract.rewardGold} zł oraz +${contract.rewardPrestige} Prestiżu Szlacheckiego!`,
      'trade',
    );
  };

  const handleClaimAchievement = (achievement: AchievementSpec) => {
    if (claimedAchievementIds.includes(achievement.id)) return;
    setClaimedAchievementIds((prev) => [...prev, achievement.id]);
    setPlayerGold((g) => g + achievement.rewardGold);
    setPrestigePoints((p) => p + achievement.rewardPrestige);
    soundEngine.playTechUnlock();
    pushNotification(
      `Osiągnięcie Odblokowane: ${achievement.title}`,
      `Nagroda: +${achievement.rewardGold} zł oraz +${achievement.rewardPrestige} Prestiżu!`,
      'event',
    );
  };

  // --- DYNAMIC 4-SEASON TRANSITIONS, WORLD DISASTERS & DRAGON BREEDING HANDLERS ---
  const handleAdvanceSeason = async (targetSeason?: SeasonId) => {
    const nextSeasonId: SeasonId = targetSeason ?? SEASONS[macro.activeSeason].nextSeason;
    const seasonSpec = SEASONS[nextSeasonId];

    // Sync PBR weather visually with the incoming season
    const nextWeatherMeta =
      nextSeasonId === 'zima'
        ? { pbr: 'blizzard' as const, id: 'zamiec_i_mroz' as const, name: 'Zamieć Śnieżna i Mróz' }
        : nextSeasonId === 'jesien'
          ? { pbr: 'rain' as const, id: 'ulewne_deszcze' as const, name: 'Ulewne Deszcze Jesienne' }
          : nextSeasonId === 'wiosna'
            ? { pbr: 'fog' as const, id: 'wiatr_handlowy' as const, name: 'Pomyślne Wiatry Handlowe' }
            : { pbr: 'clear' as const, id: 'sloneczna_pogoda' as const, name: 'Bezchmurne Niebo nad Księstwem' };
    setPbrWeather(nextWeatherMeta.pbr);

    // Immediate responsive client update (also works offline)
    setMacro((prev) => ({
      ...prev,
      activeSeason: nextSeasonId,
      activeSeasonName: seasonSpec.name,
      activeSeasonDesc: seasonSpec.description,
      activeWeather: nextWeatherMeta.id,
      activeWeatherName: nextWeatherMeta.name,
      nextSeason: seasonSpec.nextSeason,
      seasonDayProgress: 0.08,
      daysUntilNextSeason: 4,
      worldDayNumber: prev.worldDayNumber + 4,
      caravanSpeedMultiplier: Number(
        (
          seasonSpec.caravanSpeedMultiplier *
          (prev.activeDisaster?.caravanSpeedMultiplier ?? 1)
        ).toFixed(2),
      ),
      seasonalAvailabilityIndex: Math.round(
        seasonSpec.availabilityMultiplier *
          (prev.activeDisaster?.supplyShockMultiplier ?? 1) *
          100,
      ),
    }));

    setMarkets((prev) => {
      const next = { ...prev };
      for (const spec of COMMODITIES) {
        const st = prev[spec.id];
        if (!st) continue;
        const seasonMult = seasonSpec.priceMultipliers[spec.id] ?? 1.0;
        const disasterMult = getDisasterPriceMultiplier(macro.activeDisaster, spec.id);
        const targetP = Number((spec.basePrice * seasonMult * disasterMult).toFixed(2));
        const blended = Number((st.currentPrice * 0.45 + targetP * 0.55).toFixed(2));
        const avail = seasonSpec.availabilityByCommodity[spec.id] ?? seasonSpec.availabilityMultiplier;
        next[spec.id] = {
          ...st,
          previousPrice: st.currentPrice,
          currentPrice: blended,
          inventory: Math.round(spec.targetInventory * avail),
          cityPrices: calculateRegionalCityPrices(spec.id, blended, macro.worldDayNumber + 4, nextSeasonId),
          seasonalTrendLabel:
            seasonMult <= 0.92
              ? `Nadwyżka sezonowa (${seasonSpec.shortName})`
              : seasonMult >= 1.12
                ? `Niedobór sezonowy (${seasonSpec.shortName})`
                : `Równowaga (${seasonSpec.shortName})`,
        };
      }
      return next;
    });

    soundEngine.playCaravanHorn();
    pushNotification(
      `Zmiana Pory Roku: ${seasonSpec.name}`,
      `${seasonSpec.description} Prędkość karawan: ${seasonSpec.caravanSpeedMultiplier.toFixed(2)}x.`,
      'event',
    );

    try {
      const res = await fetch('/api/world/season', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId: nextSeasonId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.macro) setMacro(data.macro);
        if (data.markets) setMarkets(data.markets);
        if (data.exchangeOffers) setExchangeOffers(data.exchangeOffers);
      }
    } catch {
      // Offline fallback already applied
    }
  };

  const handleTriggerDisaster = async () => {
    const seed = Date.now();
    const spawned = pickRandomDisaster(macro.activeSeason, macro.worldDayNumber, seed);
    setLastDisasterResult(null);

    if (spawned.atmosphereMode === 'blizzard') setPbrWeather('blizzard');
    else if (spawned.atmosphereMode === 'flood') setPbrWeather('storm');
    else if (spawned.atmosphereMode === 'ash' || spawned.atmosphereMode === 'sand') setPbrWeather('sandstorm');
    else setPbrWeather('fog');

    setMacro((prev) => ({
      ...prev,
      activeDisaster: spawned,
      caravanSpeedMultiplier: Number(
        (SEASONS[prev.activeSeason].caravanSpeedMultiplier * spawned.caravanSpeedMultiplier).toFixed(2),
      ),
      seasonalAvailabilityIndex: Math.round(
        SEASONS[prev.activeSeason].availabilityMultiplier * spawned.supplyShockMultiplier * 100,
      ),
    }));
    setDisasterModalOpen(true);
    soundEngine.playAlertNotification();
    pushNotification(
      `KATASTROFA ŚWIATA: ${spawned.shortLabel}!`,
      spawned.economicImpactSummary,
      'event',
    );

    try {
      const res = await fetch('/api/world/disaster/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.macro) setMacro(data.macro);
        if (data.markets) setMarkets(data.markets);
      }
    } catch {
      // Offline fallback already applied
    }
  };

  const handleMitigateDisaster = async (optionId: string) => {
    if (!macro.activeDisaster) return;
    const res = resolveDisasterMitigation({
      disaster: macro.activeDisaster,
      optionId,
      playerGold,
      playerInventory,
      hasDragonBonus: dragonSanctuary.dragons.length > 0,
    });
    setLastDisasterResult(res);
    if (!res.success) return;

    if (res.goldDelta !== 0) {
      setPlayerGold((g) => Math.max(0, Math.round(g + res.goldDelta)));
    }
    if (res.prestigeDelta > 0) {
      setPrestigePoints((p) => p + res.prestigeDelta);
    }
    if (res.consumedCommodity || res.rewardCommodity) {
      setPlayerInventory((inv) => {
        const next = { ...inv };
        if (res.consumedCommodity) {
          next[res.consumedCommodity.id] = Math.max(
            0,
            (next[res.consumedCommodity.id] ?? 0) - res.consumedCommodity.qty,
          );
        }
        if (res.rewardCommodity) {
          next[res.rewardCommodity.id] =
            (next[res.rewardCommodity.id] ?? 0) + res.rewardCommodity.qty;
        }
        return next;
      });
    }

    setMacro((prev) => ({
      ...prev,
      activeDisaster: res.nextDisaster,
      caravanSpeedMultiplier: Number(
        (
          SEASONS[prev.activeSeason].caravanSpeedMultiplier *
          (res.nextDisaster?.caravanSpeedMultiplier ?? 1)
        ).toFixed(2),
      ),
      seasonalAvailabilityIndex: Math.round(
        SEASONS[prev.activeSeason].availabilityMultiplier *
          (res.nextDisaster?.supplyShockMultiplier ?? 1) *
          100,
      ),
    }));

    if (!res.nextDisaster) {
      setPbrWeather(macro.activeSeason === 'zima' ? 'blizzard' : 'clear');
    }

    soundEngine.playTechUnlock();
    pushNotification('Sztab Kryzysowy', res.logMessage, 'event');

    try {
      await fetch('/api/world/disaster/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextDisaster: res.nextDisaster }),
      });
    } catch {
      // Ignore network error
    }
  };

  const handleSelectCompanionDragon = (dragonId: string) => {
    setDragonSanctuary((prev) => ({
      ...prev,
      activeCompanionId: dragonId,
    }));
    const d = dragonSanctuary.dragons.find((item) => item.id === dragonId);
    if (d) {
      setDragonFeedback(`${d.name} wzbił się w przestworza nad Twoją stolicą 3D!`);
    }
  };

  const handleFeedDragon = (dragonId: string, feedMode: 'grain' | 'favorite_commodity') => {
    const res = feedAndTrainDragon({
      sanctuary: dragonSanctuary,
      dragonId,
      feedMode,
      playerGold,
      playerInventory,
    });
    if (!res.success) {
      setDragonFeedback(res.errorMessage ?? 'Nie można nakarmić smoka.');
      return;
    }
    setPlayerGold((g) => Math.max(0, g - res.goldCost));
    if (res.consumedCommodity) {
      const c = res.consumedCommodity;
      setPlayerInventory((inv) => ({
        ...inv,
        [c.id]: Math.max(0, (inv[c.id] ?? 0) - c.qty),
      }));
    }
    setDragonSanctuary(res.nextSanctuary);
    setDragonFeedback(res.logMessage);
    soundEngine.playTechUnlock();
    if (res.evolvedToStage) {
      pushNotification('Ewolucja Smoka!', res.logMessage, 'event');
    }
  };

  const handleIncubateEgg = (eggId: string) => {
    const res = incubateOrHatchEgg({
      sanctuary: dragonSanctuary,
      eggId,
      playerGold,
    });
    if (!res.success) {
      setDragonFeedback(res.errorMessage ?? 'Nie można ogrzać jaja.');
      return;
    }
    if (res.goldCost > 0) setPlayerGold((g) => Math.max(0, g - res.goldCost));
    setDragonSanctuary(res.nextSanctuary);
    setDragonFeedback(res.logMessage);
    soundEngine.playTechUnlock();
    if (res.hatchedDragon) {
      pushNotification(`Wykluł się Smok: ${res.hatchedDragon.name}!`, res.logMessage, 'event');
    }
  };

  const handleBuyOrBreedEgg = (speciesId: DragonSpeciesId, isCrossBreed: boolean) => {
    const res = purchaseOrBreedDragonEgg({
      sanctuary: dragonSanctuary,
      speciesId,
      playerGold,
      isCrossBreed,
    });
    if (!res.success) {
      setDragonFeedback(res.errorMessage ?? 'Nie można zdobyć jaja.');
      return;
    }
    setPlayerGold((g) => Math.max(0, g - res.goldCost));
    setDragonSanctuary(res.nextSanctuary);
    setDragonFeedback(res.logMessage);
    soundEngine.playTradeFill(true);
  };

  const handleDispatchDragonMission = (dragonId: string, missionId: DragonMissionType) => {
    const res = dispatchDragonMission({
      sanctuary: dragonSanctuary,
      dragonId,
      missionId,
    });
    if (!res.success) {
      setDragonFeedback(res.errorMessage ?? 'Nie można wysłać smoka na wyprawę.');
      return;
    }
    setPlayerGold((g) => g + res.rewardGold);
    if (res.rewardCommodity) {
      const c = res.rewardCommodity;
      setPlayerInventory((inv) => ({
        ...inv,
        [c.id]: (inv[c.id] ?? 0) + c.qty,
      }));
    }
    setDragonSanctuary(res.nextSanctuary);
    setDragonFeedback(res.logMessage);
    soundEngine.playCaravanHorn();
    pushNotification('Wyprawa Powietrzna Smoka', res.logMessage, 'event');
  };

  // --- RANDOM TRAIL EVENTS HANDLERS ---
  const handleSelectTrailEvent = (eventId: string) => {
    const found = trailEvents.find((ev) => ev.id === eventId);
    if (!found) return;
    setActiveTrailEvent(found);
    setTrailEventOutcome(null);
  };

  const handleResolveTrailEventChoice = (choiceId: string) => {
    if (!activeTrailEvent) return;
    const outcome = resolveTrailEventChoice(activeTrailEvent, choiceId, {
      playerGold,
      knightStrength: heroDerivedStats.effectiveStrength,
      knightDefense: heroDerivedStats.effectiveDefense,
    });
    setTrailEventOutcome(outcome);

    if (!outcome.success) return;

    if (outcome.goldDelta !== 0) {
      setPlayerGold((g) => Math.max(0, Math.round(g + outcome.goldDelta)));
    }
    if (outcome.prestigeDelta !== 0) {
      setPrestigePoints((p) => p + outcome.prestigeDelta);
    }
    if (outcome.commodityDelta) {
      const { id, qty } = outcome.commodityDelta;
      setPlayerInventory((inv) => ({
        ...inv,
        [id]: (inv[id] ?? 0) + qty,
      }));
    }

    let lootNote = '';
    let foundLootId: string | null = null;
    if (!outcome.bypassed) {
      const drop = rollLootDrop({
        source: 'trail_event',
        lootFindBonusPct: heroDerivedStats.lootFindBonusPct,
        ownedItemIds: knight.ownedItemIds ?? [],
        seed: Date.now() + activeTrailEvent.id.length * 19,
      });
      if (drop.foundItem && !drop.isDuplicate) {
        foundLootId = drop.foundItem.id;
        lootNote = ` ${drop.narrative}`;
      }
    }

    if (outcome.knightHpDelta !== 0 || outcome.monstersDefeatedDelta > 0 || foundLootId) {
      setKnight((prev) => ({
        ...prev,
        hp: Math.max(
          15,
          Math.min(heroDerivedStats.effectiveMaxHp, prev.hp + outcome.knightHpDelta),
        ),
        monstersDefeated: prev.monstersDefeated + outcome.monstersDefeatedDelta,
        ownedItemIds: foundLootId
          ? [...(prev.ownedItemIds ?? []), foundLootId]
          : prev.ownedItemIds ?? [],
        recentLootLog: lootNote
          ? [lootNote.trim(), ...(prev.recentLootLog ?? []).slice(0, 14)]
          : prev.recentLootLog ?? [],
      }));
    }

    setTrailEvents((prev) => prev.filter((ev) => ev.id !== activeTrailEvent.id));
    if (outcome.bypassed) {
      soundEngine.playCaravanHorn();
    } else {
      soundEngine.playTechUnlock();
    }
    pushNotification(outcome.headline, `${outcome.narrative}${lootNote}`, 'event');
  };

  // --- CITY INTERIOR & ANIMATED KNIGHT ARENA HANDLERS ---
  const handleEnterCityInterior = (cityId: string, mode: 'plaza' | 'arena' = 'plaza') => {
    setSelectedCityId(cityId);
    setSelectedRegionId(cityId);
    const reg = WORLD_REGIONS.find((r) => r.id === cityId);
    if (reg) setSelectedContinentId(reg.continentId);
    setCinematicTourActive(false);
    setCityInteriorMode(mode);
    setCityInteriorOpen(true);
    soundEngine.playCaravanHorn();
  };

  const handleTavernRest = (costGold: number, cityName: string) => {
    if (playerGold < costGold) return;
    setPlayerGold((g) => Math.max(0, Math.round(g - costGold)));
    setKnight((prev) => {
      const derived = computeDerivedHeroStats(prev);
      return {
        ...prev,
        hp: derived.effectiveMaxHp,
        availableTurns: Math.min(derived.effectiveMaxTurns, prev.availableTurns + 2),
      };
    });
    soundEngine.playTechUnlock();
    pushNotification(
      `Odpoczynek w Karczmie (${cityName})`,
      'Twój Rycerz odzyskał pełnię zdrowia oraz +2 tury wyprawowe.',
      'event',
    );
  };

  const handleStartArenaDuelWager = (entryFeeGold: number): boolean => {
    if (playerGold < entryFeeGold) return false;
    setPlayerGold((g) => Math.max(0, Math.round(g - entryFeeGold)));
    return true;
  };

  const handleArenaDuelComplete = (result: {
    won: boolean;
    opponent: ArenaOpponentSpec;
    remainingHp: number;
  }) => {
    if (result.won) {
      setPlayerGold((g) => Math.round(g + result.opponent.rewardGold));
      setArenaWins((w) => w + 1);
      setArenaRating((r) => r + result.opponent.ratingGain);
      setPrestigePoints((p) => p + Math.round(result.opponent.ratingGain * 1.5));
      setKnight((prev) => {
        const nextXp = prev.xp + result.opponent.rewardXp;
        const leveledUp = nextXp >= prev.xpToNextLevel;
        const nextLevel = leveledUp ? prev.level + 1 : prev.level;
        const nextMaxHp = leveledUp ? prev.maxHp + 25 : prev.maxHp;
        const updated: KnightState = {
          ...prev,
          level: nextLevel,
          xp: leveledUp ? nextXp - prev.xpToNextLevel : nextXp,
          xpToNextLevel: leveledUp ? Math.round(prev.xpToNextLevel * 1.35) : prev.xpToNextLevel,
          maxHp: nextMaxHp,
          strength: prev.strength + (leveledUp ? 2 : 0),
          defense: prev.defense + (leveledUp ? 2 : 0),
          tactics: prev.tactics + (leveledUp ? 2 : 0),
          skillPoints: (prev.skillPoints ?? 0) + (leveledUp ? 1 : 0),
          monstersDefeated: prev.monstersDefeated + 1,
        };
        const derivedAfter = computeDerivedHeroStats(updated);
        return {
          ...updated,
          hp: leveledUp
            ? derivedAfter.effectiveMaxHp
            : Math.max(Math.round(derivedAfter.effectiveMaxHp * 0.25), result.remainingHp),
        };
      });
      pushNotification(
        `Zwycięstwo na Arenie Rycerskiej!`,
        `Pokonano ${result.opponent.name} — nagroda: +${result.opponent.rewardGold} zł, +${result.opponent.rewardXp} XP, +${result.opponent.ratingGain} ELO.`,
        'event',
      );
    } else {
      setArenaRating((r) => Math.max(800, r - 8));
      setKnight((prev) => {
        const derived = computeDerivedHeroStats(prev);
        return {
          ...prev,
          hp: Math.max(Math.round(derived.effectiveMaxHp * 0.25), result.remainingHp),
        };
      });
      pushNotification(
        `Porażka na Arenie (${result.opponent.cityName})`,
        `${result.opponent.name} zwyciężył. Ulecz rycerza w Karczmie lub ulepsz uzbrojenie.`,
        'event',
      );
    }
  };

  const nobleRankInfo = useMemo(
    () =>
      calculateNobleRank({
        netWorth,
        prestigePoints,
        monstersDefeated: knight.monstersDefeated,
        contractsCompleted: completedContractIds.length,
      }),
    [netWorth, prestigePoints, knight.monstersDefeated, completedContractIds.length],
  );

  const leaderboard: LeaderboardEntry[] = useMemo(() => {
    const baseEntries: LeaderboardEntry[] = [
      {
        rank: 1,
        name: 'Wielki Syndyk Vonelor',
        race: 'Ludzie',
        guildTag: '[ZŁOTO]',
        netWorth: 94_200,
        knightLevel: 7,
        monstersDefeated: 19,
        winRatePct: 78,
        specialty: 'Magnat Mithrilu & Pogromca',
      },
      {
        rank: 2,
        name: 'Arcymag Elandor',
        race: 'Elfy',
        guildTag: '[RUNA]',
        netWorth: 76_450,
        knightLevel: 6,
        monstersDefeated: 14,
        winRatePct: 74,
        specialty: 'Kupiec Kryształów Many',
      },
      {
        rank: 3,
        name: 'Kowal Thorgar',
        race: 'Krasnoludy',
        guildTag: '[SMOK]',
        netWorth: 58_900,
        knightLevel: 5,
        monstersDefeated: 12,
        winRatePct: 71,
        specialty: 'Mistrz Żelaznej Kuźni',
      },
      {
        rank: 4,
        name: playerDisplayName,
        race: selectedRace.name.split(' ')[0],
        guildTag: `[${playerGuild?.tag ?? 'ZŁOTO'}]`,
        netWorth,
        knightLevel: knight.level,
        monstersDefeated: knight.monstersDefeated,
        winRatePct: tradesExecutedCount > 0 ? Math.round((profitableTradesCount / tradesExecutedCount) * 100) : 100,
        specialty: playerTitle,
        isPlayer: true,
      },
      {
        rank: 5,
        name: 'Alchemik Grizz',
        race: 'Gobliny',
        guildTag: '[ZŁOTO]',
        netWorth: 21_300,
        knightLevel: 3,
        monstersDefeated: 5,
        winRatePct: 65,
        specialty: 'Handel Przyprawami',
      },
    ];

    for (const reg of registeredPlayers) {
      if (reg.displayName !== playerDisplayName && !baseEntries.some((b) => b.name === reg.displayName)) {
        baseEntries.push({
          rank: 99,
          name: reg.displayName,
          race: RACES.find((r) => r.id === reg.raceId)?.name.split(' ')[0] ?? 'Ludzie',
          guildTag: '[GRACZ]',
          netWorth: reg.netWorth,
          knightLevel: reg.knightLevel || 1,
          monstersDefeated: reg.monstersDefeated || 0,
          winRatePct: 80,
          specialty: reg.title,
        });
      }
    }

    return baseEntries
      .sort((a, b) => b.netWorth - a.netWorth)
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [
    netWorth,
    playerDisplayName,
    playerTitle,
    selectedRace,
    playerGuild,
    knight.level,
    knight.monstersDefeated,
    tradesExecutedCount,
    profitableTradesCount,
    registeredPlayers,
  ]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#080b10] select-none">
      {/* Persistent 3D World WebGL Canvas (Isolated Container) */}
      <World3DCanvas
        gameState={gameState}
        selectedRegionId={selectedRegionId}
        selectedContinentId={selectedContinentId}
        onSelectRegion={(regionId) => {
          setSelectedRegionId(regionId);
          const reg = WORLD_REGIONS.find((r) => r.id === regionId);
          if (reg) {
            setSelectedContinentId(reg.continentId);
            if (reg.linkedCityId) setSelectedCityId(reg.linkedCityId);
          }
          setTrackedCaravanId(null);
          setCameraPreset('city');
        }}
        activeCaravans={activeCaravans}
        cameraPreset={cameraPreset}
        trackedCaravanId={trackedCaravanId}
        activeSeason={macro.activeSeason}
        activeDisaster={macro.activeDisaster}
        lightingMood={lightingMood}
        pbrWeather={pbrWeather}
        trailEvents={trailEvents}
        onSelectTrailEvent={handleSelectTrailEvent}
        showWorldLabels={showWorldLabels}
        playerDragonSpecies={dragonBonuses.activeSpecies}
        playerDragonStage={dragonBonuses.activeStage}
        cinematicTourActive={cinematicTourActive}
        onTourContinentChange={setTourContinentId}
      />

      {/* ==================== 1. CLEAN REAL-TIME 3D TITLE SCREEN OVERLAY ==================== */}
      {gameState === 'title' && (
        <div className="fixed inset-0 z-30 flex items-center justify-start px-6 md:px-16 bg-gradient-to-r from-[#05080d]/95 via-[#05080d]/80 to-transparent">
          <div className="relative z-10 max-w-xl w-full py-6 space-y-4">
            {/* Custom Inline SVG Heraldic Emblem & Title Lockup */}
            <div className="flex items-center gap-4">
              <svg
                viewBox="0 0 72 72"
                className="w-16 h-16 shrink-0"
                role="img"
                aria-label="Herb Kupieckiego Świata"
              >
                <polygon
                  points="36,4 64,18 64,52 36,68 8,52 8,18"
                  fill="#0c131f"
                  stroke="#d4af37"
                  strokeWidth="2.5"
                />
                <line x1="22" y1="24" x2="22" y2="48" stroke="#10b981" strokeWidth="2" />
                <rect x="19" y="30" width="6" height="12" fill="#10b981" />
                <line x1="36" y1="16" x2="36" y2="50" stroke="#d4af37" strokeWidth="2.5" />
                <rect x="32" y="22" width="8" height="18" fill="#d4af37" />
                <line x1="50" y1="22" x2="50" y2="46" stroke="#f43f5e" strokeWidth="2" />
                <rect x="47" y="27" width="6" height="11" fill="#f43f5e" />
                <path
                  d="M16 54 Q36 62 56 54"
                  fill="none"
                  stroke="#f8fafc"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              <div>
                <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-white">
                  KUPIECKI ŚWIAT 3D
                </h1>
                <p className="text-sm font-medium text-amber-400">
                  6 Kontynentów · 12 Stolic Handlowych · 4 Pory Roku, Hodowla Smoków i Katastrofy
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">
              Żegluj między sześcioma kontynentami — od Starego Kontynentu po pustynie Solarii, lodowce Frostheimu, pagody Aetheris, wodospady Valorii i wulkany Archipelagu Obsydianowego. Handluj w rytmie 4 pór roku, hoduj żywiołowe smoki i reaguj na katastrofy świata!
            </p>

            {/* Choose Starting Faction / Race from Original Kupiecki Świat */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-300">
                Wybierz Frakcję Kupiecką (5 Ras Oryginału):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RACES.map((race) => {
                  const active = race.id === selectedRaceId;
                  return (
                    <button
                      key={race.id}
                      type="button"
                      onClick={() => {
                        setSelectedRaceId(race.id);
                        setKnight(createInitialKnightState(race.id));
                        setDuchy(createInitialDuchyState(race.id));
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-[#0c1118]/95 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{race.name}</span>
                        <span className="font-mono-tabular text-xs text-amber-400">
                          {race.startingCapital} zł
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{race.bonusText}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Start CTA + Account Login / Cinematic Trailer Buttons */}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                data-start="true"
                onClick={handleStartGame}
                className="min-h-[48px] px-7 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm tracking-wide transition-transform active:scale-95 cursor-pointer"
              >
                Wkrocz do Kupieckiego Świata (Enter)
              </button>

              <button
                type="button"
                onClick={() => {
                  handleStartGame();
                  setActiveTab('profile');
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-lg bg-[#0c1118]/95 hover:bg-slate-800 border border-amber-500/50 text-amber-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Logowanie / Rejestracja Konta
              </button>

              <button
                type="button"
                onClick={() => {
                  setCinematicSceneIdx(0);
                  setShowCinematicIntro(true);
                }}
                className="min-h-[48px] px-4 py-2.5 rounded-lg bg-[#0c1118]/95 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
              >
                Zwiastun Filmowy (Cinematic)
              </button>
            </div>

            {/* Single Flat Control-Hint Line */}
            <div className="pt-1 text-xs text-slate-400">
              WASD / Mysz Kamera 3D · Kliknij Miasto na Mapie · H Zwiń/Rozwiń Panel · M Dźwięk · Esc Pauza
            </div>
          </div>
        </div>
      )}

      {/* ==================== CINEMATIC INTRO STORY TRAILER MODAL ==================== */}
      {showCinematicIntro && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4"
        >
          <div className="relative max-w-4xl w-full bg-[#090d14] border border-amber-500/50 rounded-xl overflow-hidden shadow-2xl">
            <div className="relative h-80 sm:h-96 overflow-hidden">
              <img
                src={
                  cinematicSceneIdx === 0
                    ? '/src/assets/images/cinematic_title_backdrop_1795641276504.jpg'
                    : '/src/assets/images/cinematic_city_citadel_1795641277369.jpg'
                }
                alt="Scena filmowa Kupieckiego Świata"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-1000 scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-[#090d14]/40 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 space-y-2">
                <div className="text-xs font-bold text-amber-400 tracking-wider">
                  {cinematicSceneIdx === 0
                    ? 'ROZDZIAŁ I: ZŁOTE SZLAKI I GIEŁDA KRÓLEWSKIEJ PRZYSTANI'
                    : 'ROZDZIAŁ II: ZAKON RYCERZY I WYPRAWY W MIEJSCA STRACHU'}
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {cinematicSceneIdx === 0
                    ? 'Pory Roku, Żniwa i Wielka Wymiana Kupiecka'
                    : 'Stal, Mithril i Potyczki Turowe z Bestiami'}
                </h2>
                <p className="text-sm text-slate-200 max-w-2xl">
                  {cinematicSceneIdx === 0
                    ? 'Gdy jesienne żniwa zapełniają spichlerze Królewskiej Przystani, a zimowe zamiecie odcinają górskie przełęcze Żelaznej Kuźni, mądrzy kupcy wystawiają swoje towary na tablicy giełdowej i wysyłają wozy przez 5 krain.'
                    : 'Lecz szlaki nie są bezpieczne. Zuchwali Rebelianci, Pradawne Golemy i Ognisty Smok Ignis z Krwawego Szczytu czyhają na bogactwa. Szkól swojego Rycerza, wykuwaj broń i zdobywaj legendarne łupy w bitwach turowych!'}
                </p>
              </div>
            </div>

            <div className="p-4 flex items-center justify-between bg-[#0c1118] border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCinematicSceneIdx(0)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    cinematicSceneIdx === 0 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Scena 1: Handel i Pory Roku
                </button>
                <button
                  type="button"
                  onClick={() => setCinematicSceneIdx(1)}
                  className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer ${
                    cinematicSceneIdx === 1 ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Scena 2: Rycerz i Miejsca Strachu
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowCinematicIntro(false)}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                Przejdź do Gry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. PLAYING HUD (WORLD-MATCHED, LOW-OCCLUSION) ==================== */}
      {gameState !== 'title' && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 md:p-4">
          {/* Top Perimeter Bar */}
          <div className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-2">
            {/* Top-Left Cluster: Player Capital, Net Worth, Season/Weather & Active Region */}
            <div className="pointer-events-auto flex items-center gap-2.5 bg-[#0c1118]/95 border border-slate-800 rounded-lg px-2.5 py-1.5 shadow-lg min-w-0">
              <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-800 shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" fill="#1e293b" />
                  <path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" />
                </svg>
                <div>
                  <div className="text-[9px] font-semibold text-slate-400">SAKWA ZŁOTA</div>
                  <div className="font-mono-tabular text-sm font-bold text-amber-400 leading-tight">
                    {Math.round(playerGold).toLocaleString('pl-PL')} zł
                  </div>
                </div>
              </div>

              <div className="pr-2.5 border-r border-slate-800 shrink-0">
                <div className="text-[9px] font-semibold text-slate-400">MAJĄTEK</div>
                <div className="font-mono-tabular text-sm font-bold text-white leading-tight">
                  {netWorth.toLocaleString('pl-PL')} zł
                </div>
              </div>

              <div className="pr-2.5 border-r border-slate-800 hidden sm:block shrink-0">
                <div className="text-[9px] font-semibold text-slate-400">
                  DZIEŃ {macro.worldDayNumber}
                </div>
                <div className="text-[11px] font-bold text-emerald-400 leading-tight">
                  {macro.activeSeasonName.split(' ')[0]} · {macro.activeWeatherName.split(' ')[0]}
                </div>
              </div>

              <div className="pr-2.5 border-r border-slate-800 hidden md:block shrink-0">
                <div className="text-[9px] font-semibold text-slate-400">RYCERZ</div>
                <div className="font-mono-tabular text-[11px] font-bold text-rose-400 leading-tight">
                  Poz.{knight.level} · {knight.availableTurns}/{knight.maxTurns}t
                </div>
              </div>

              <div className="min-w-0">
                <div className="text-[9px] font-semibold text-slate-400 truncate">
                  {nobleRankInfo.rankTitle}
                </div>
                <div className="text-[11px] font-bold text-amber-300 truncate max-w-[116px] leading-tight">
                  {WORLD_REGIONS.find((r) => r.id === selectedRegionId)?.name ?? 'Królewska Przystań'}
                </div>
              </div>
            </div>

            {/* Top-Center Live World & Seasonal Event Strip */}
            <div className="pointer-events-auto hidden 2xl:flex items-center gap-2.5 bg-[#0c1118]/95 border border-amber-500/40 rounded-lg px-3 py-1.5 max-w-xs">
              <div className="text-xs min-w-0">
                <span className="font-bold text-amber-400">Kronika: </span>
                <span className="font-semibold text-white">{macro.activeEventTitle}</span>
                <div className="text-[11px] text-slate-400 truncate">{macro.activeSeasonDesc}</div>
              </div>
            </div>

            {/* Top-Right Cluster: Camera Presets, Time-of-Day, PBR Weather, Trail Events & Controls */}
            <div className="pointer-events-auto flex items-center gap-1 bg-[#0c1118]/95 border border-slate-800 rounded-lg p-1 shadow-lg">
              {/* 3D Camera Preset Switcher */}
              <div className="hidden lg:flex items-center gap-0.5 pr-1 border-r border-slate-800">
                {(
                  [
                    { id: 'world', label: 'Świat 4K' },
                    { id: 'continent', label: 'Kontynent' },
                    { id: 'city', label: 'Zbliżenie' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => {
                      setTrackedCaravanId(null);
                      setCameraPreset(cam.id);
                    }}
                    className={`px-1.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      cameraPreset === cam.id
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
                {cameraPreset === 'caravan' && trackedCaravanId && (
                  <button
                    type="button"
                    data-testid="hud-camera-preset-caravan"
                    onClick={() => {
                      setTrackedCaravanId(null);
                      setCameraPreset('world');
                    }}
                    title="Aktywne śledzenie karawany 3D — kliknij, aby wrócić do panoramy świata"
                    className="px-1.5 py-1 rounded text-[10.5px] font-bold bg-emerald-500 text-slate-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Karawana ×
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowWorldLabels((v) => !v)}
                  className={`px-1.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    showWorldLabels
                      ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Etykiety
                </button>
                <button
                  type="button"
                  data-testid="hud-cinematic-tour-btn"
                  onClick={() => {
                    const next = !cinematicTourActive;
                    setCinematicTourActive(next);
                    if (next) {
                      setTrackedCaravanId(null);
                      setDockCollapsed(true);
                    }
                  }}
                  className={`px-1.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    cinematicTourActive
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25'
                  }`}
                >
                  {cinematicTourActive ? 'Stop Kino' : 'Kino 3D'}
                </button>
              </div>

              {/* UE5 Atmospheric Time-of-Day Lighting Mood Switcher */}
              <div className="hidden xl:flex items-center gap-0.5 pr-1 border-r border-slate-800">
                {(
                  [
                    { id: 'golden_hour', label: 'Złota' },
                    { id: 'midday', label: 'Dzień' },
                    { id: 'dusk', label: 'Zmierzch' },
                    { id: 'night', label: 'Noc' },
                  ] as const
                ).map((mood) => (
                  <button
                    key={mood.id}
                    type="button"
                    onClick={() => setLightingMood(mood.id)}
                    className={`px-1.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      lightingMood === mood.id
                        ? 'bg-sky-500 text-slate-950 font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {mood.label}
                  </button>
                ))}
              </div>

              {/* Real-Time PBR Weather Selector */}
              <div className="flex items-center gap-1 pr-1 border-r border-slate-800">
                <select
                  aria-label="System pogodowy PBR"
                  data-testid="pbr-weather-select"
                  value={pbrWeather}
                  onChange={(e) => setPbrWeather(e.target.value as PbrWeatherId)}
                  className="bg-[#111722] hover:bg-slate-800 border border-sky-500/50 rounded px-1.5 py-1 text-[11px] font-bold text-sky-300 cursor-pointer outline-none"
                >
                  {PBR_WEATHER_LIST.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#0c1118] text-slate-100">
                      PBR: {w.shortLabel}
                    </option>
                  ))}
                </select>

                {/* Active Trail Events Quick-Access Button */}
                <button
                  type="button"
                  data-testid="hud-trail-events-btn"
                  title="Otwórz losowe zdarzenie na szlaku"
                  onClick={() => {
                    if (trailEvents.length > 0) {
                      handleSelectTrailEvent(trailEvents[0].id);
                    } else {
                      setTrailEventSeed((s) => s + 1);
                    }
                  }}
                  className={`px-2 py-1 rounded border text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    trailEvents.length > 0
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/70 text-amber-300'
                      : 'bg-[#111722] hover:bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  ! Szlak ({trailEvents.length})
                </button>

                {macro.activeDisaster && (
                  <button
                    type="button"
                    data-testid="hud-disaster-alert-btn"
                    onClick={() => {
                      setLastDisasterResult(null);
                      setDisasterModalOpen(true);
                    }}
                    className="px-2 py-1 rounded border border-rose-300/70 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Katastrofa!
                  </button>
                )}
              </div>

              {/* Quick Profile / Login Button */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('profile');
                  setDockCollapsed(false);
                }}
                className="px-2 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-amber-500/40 text-[11px] font-semibold text-amber-300 cursor-pointer whitespace-nowrap"
              >
                {backendUsername ? `@${backendUsername}` : 'Profil'}
              </button>

              {/* Push Notification Toggle */}
              <button
                type="button"
                onClick={() => {
                  setShowNotificationsDrawer((prev) => !prev);
                  setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  if (
                    typeof window !== 'undefined' &&
                    'Notification' in window &&
                    Notification.permission === 'default'
                  ) {
                    Notification.requestPermission().catch(() => {});
                  }
                }}
                aria-label="Powiadomienia Push"
                className="relative px-2 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                <span className="font-mono-tabular">{unreadCount}</span>
              </button>

              {/* Mute [M] */}
              <button
                type="button"
                tabIndex={-1}
                aria-label={muted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMuted(soundEngine.toggleMute());
                }}
                className="w-8 h-8 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  {muted ? (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                  )}
                </svg>
              </button>

              {/* Pause [P] */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Pauza"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameState((s) => (s === 'paused' ? 'playing' : 'paused'));
                }}
                className="w-8 h-8 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              </button>

              {/* Restart [R] */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Powrót do ekranu tytułowego"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameState('title');
                }}
                className="w-8 h-8 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Push Notification Feed Drawer (Top-Right Popover) */}
          {showNotificationsDrawer && (
            <div className="pointer-events-auto self-end w-full max-w-sm bg-[#0c1118] border border-slate-700 rounded-lg p-3 shadow-2xl space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400">
                  Centrum Powiadomień Push ({notifications.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotificationsDrawer(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Zamknij
                </button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <div key={n.id} className="bg-[#080b10] border border-slate-800 rounded p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{n.title}</span>
                      <span className="font-mono-tabular text-[10px] text-slate-400">{n.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">{n.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ==================== COLLAPSIBLE BOTTOM CONTROL DOCK ==================== */}
          <div className="pointer-events-auto w-full max-w-[1340px] mx-auto flex flex-col items-center">
            {/* Collapse / Expand Toggle Bar + Main Module Navigation Tabs */}
            <div className="w-full lg:w-auto flex flex-nowrap overflow-x-auto items-center justify-start lg:justify-center gap-1 bg-[#0c1118]/95 border border-slate-700 rounded-t-xl px-2.5 py-1.5 shadow-xl">
              {(
                [
                  { id: 'world_map', label: '1. Mapa Świata' },
                  { id: 'terminal', label: '2. Giełda' },
                  { id: 'caravans', label: '3. Szlaki 3D' },
                  { id: 'knight', label: '4. Rycerz' },
                  { id: 'duchy_story', label: '5. Księstwo & Fabuła' },
                  { id: 'auctions', label: '6. Aukcje' },
                  { id: 'tech', label: '7. Technologie' },
                  { id: 'guilds_chat', label: '8. Gildie & Czat' },
                  { id: 'profile', label: '9. Konto' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setDockCollapsed(false);
                  }}
                  className={`min-h-[36px] px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === tab.id && !dockCollapsed
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#111722] hover:bg-slate-800 text-slate-200 border border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <button
                type="button"
                data-testid="dock-enter-city-btn"
                onClick={() => handleEnterCityInterior(selectedCityId, 'plaza')}
                className="min-h-[36px] px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-[11px] font-bold text-white whitespace-nowrap shrink-0 ml-0.5 cursor-pointer"
              >
                Wejdź do Miasta
              </button>

              <button
                type="button"
                onClick={() => setDockCollapsed((prev) => !prev)}
                className="min-h-[36px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-amber-300 whitespace-nowrap shrink-0 ml-0.5 cursor-pointer"
              >
                {dockCollapsed ? 'Rozwiń Panel [H]' : 'Odsłoń Świat 3D [H]'}
              </button>
            </div>

            {/* Active Module Content Drawer */}
            {!dockCollapsed && (
              <div className="w-full bg-[#080b10]/95 border border-slate-700 rounded-b-xl rounded-tr-xl p-3.5 shadow-2xl max-h-[58vh] overflow-y-auto">
                {activeTab === 'world_map' && (
                  <WorldMapAtlasPanel
                    selectedRegionId={selectedRegionId}
                    selectedContinentId={selectedContinentId}
                    onSelectContinent={(cid) => {
                      setSelectedContinentId(cid);
                      if (cid !== 'all') {
                        const firstReg = WORLD_REGIONS.find((r) => r.continentId === cid);
                        if (firstReg) {
                          setSelectedRegionId(firstReg.id);
                          if (firstReg.linkedCityId) setSelectedCityId(firstReg.linkedCityId);
                        }
                      }
                    }}
                    onSelectRegion={(regId) => {
                      setSelectedRegionId(regId);
                      const reg = WORLD_REGIONS.find((r) => r.id === regId);
                      if (reg) {
                        setSelectedContinentId(reg.continentId);
                        if (reg.linkedCityId) setSelectedCityId(reg.linkedCityId);
                      }
                    }}
                    onFocus3DCameraOnRegion={(regId) => {
                      setSelectedRegionId(regId);
                      const reg = WORLD_REGIONS.find((r) => r.id === regId);
                      if (reg) {
                        setSelectedContinentId(reg.continentId);
                        if (reg.linkedCityId) setSelectedCityId(reg.linkedCityId);
                      }
                      setTrackedCaravanId(null);
                      setCameraPreset('city');
                      setDockCollapsed(true);
                    }}
                    onFocus3DCameraOnContinent={(cid) => {
                      setSelectedContinentId(cid);
                      setTrackedCaravanId(null);
                      setCameraPreset('continent');
                      setDockCollapsed(true);
                    }}
                    onFocus3DCameraOnCaravan={(caravanId) => {
                      setCinematicTourActive(false);
                      setTrackedCaravanId(caravanId);
                      setCameraPreset('caravan');
                      setDockCollapsed(true);
                    }}
                    onOpenCaravanRoutesTab={() => setActiveTab('caravans')}
                    onEnterCityInterior={(cityId) => handleEnterCityInterior(cityId, 'plaza')}
                    activeCaravans={activeCaravans}
                    trackedCaravanId={trackedCaravanId}
                    cameraPreset={cameraPreset}
                    onTradeInCity={(cityId) => {
                      setSelectedCityId(cityId);
                      setSelectedRegionId(cityId);
                      setActiveTab('terminal');
                    }}
                    onLaunchQuestForRegion={(questId) => {
                      const quest = MONSTER_QUESTS.find((q) => q.id === questId);
                      if (quest && !knight.activeQuest) {
                        handleStartKnightQuest(quest);
                      }
                      setActiveTab('knight');
                    }}
                    onOpenDuchyTab={() => setActiveTab('duchy_story')}
                    markets={markets}
                    macro={macro}
                    pbrWeather={pbrWeather}
                    trailEvents={trailEvents}
                    onSelectTrailEvent={handleSelectTrailEvent}
                    onRefreshTrailEvents={() => setTrailEventSeed((s) => s + 1)}
                    cinematicTourActive={cinematicTourActive}
                    onToggleCinematicTour={() => {
                      const next = !cinematicTourActive;
                      setCinematicTourActive(next);
                      if (next) setDockCollapsed(true);
                    }}
                    onOpenDisasterModal={() => {
                      setLastDisasterResult(null);
                      setDisasterModalOpen(true);
                    }}
                  />
                )}

                {activeTab === 'terminal' && (
                  <DayTraderTerminal
                    markets={markets}
                    macro={macro}
                    exchangeOffers={exchangeOffers}
                    selectedCommodityId={selectedCommodityId}
                    onSelectCommodity={setSelectedCommodityId}
                    selectedCityId={selectedCityId}
                    onSelectCity={(cityId) => {
                      setSelectedCityId(cityId);
                      setSelectedRegionId(cityId);
                    }}
                    playerGold={playerGold}
                    playerInventory={playerInventory}
                    techFeeRebate={techModifiers.spreadRebate}
                    onExecuteTrade={handleExecuteTrade}
                    onBuyExchangeOffer={handleBuyExchangeOffer}
                    onCreateExchangeOffer={handleCreateExchangeOffer}
                    onAdvanceSeason={handleAdvanceSeason}
                    onTriggerDisaster={handleTriggerDisaster}
                    onOpenDisasterModal={() => {
                      setLastDisasterResult(null);
                      setDisasterModalOpen(true);
                    }}
                  />
                )}

                {activeTab === 'caravans' && (
                  <CaravanRoutesView
                    markets={markets}
                    activeSeason={macro.activeSeason}
                    activeDisaster={macro.activeDisaster}
                    selectedCityId={selectedCityId}
                    onSelectCity={setSelectedCityId}
                    playerGold={playerGold}
                    activeCaravans={activeCaravans}
                    logisticsTechBonus={techModifiers.caravanSpeedBonus}
                    combatEscortBonus={techModifiers.combatEscortBonus}
                    onDispatchCaravan={handleDispatchCaravan}
                    onLaunchFearExpedition={handleLaunchFearExpedition}
                  />
                )}

                {activeTab === 'knight' && (
                  <KnightAndMissionsPanel
                    knight={knight}
                    playerGold={playerGold}
                    playerInventory={playerInventory}
                    combatTechBonus={techModifiers.combatEscortBonus}
                    onTrainKnightStat={handleTrainKnightStat}
                    onBuyHeroItem={handleBuyHeroItem}
                    onEquipHeroItem={handleEquipHeroItem}
                    onUnequipHeroSlot={handleUnequipHeroSlot}
                    onCustomizeHero={handleCustomizeHero}
                    onAllocateSkillPoint={handleAllocateSkillPoint}
                    onScoutForLoot={handleScoutForLoot}
                    onStartKnightQuest={handleStartKnightQuest}
                    onExecuteKnightTurn={handleExecuteKnightTurn}
                    onRestockKnightTurnsWithGrain={handleRestockKnightTurnsWithGrain}
                    onOpenKnightArena={() => handleEnterCityInterior(selectedCityId, 'arena')}
                  />
                )}

                {activeTab === 'duchy_story' && (
                  <DuchyAndStoryCampaignPanel
                    duchy={duchy}
                    knight={knight}
                    playerGold={playerGold}
                    netWorth={netWorth}
                    tradesExecutedCount={tradesExecutedCount}
                    unlockedTechCount={unlockedTechIds.length}
                    prestigePoints={prestigePoints}
                    completedContractIds={completedContractIds}
                    claimedAchievementIds={claimedAchievementIds}
                    playerInventory={playerInventory}
                    onClaimStoryChapter={handleClaimStoryChapter}
                    onUpgradeDuchyBuilding={handleUpgradeDuchyBuilding}
                    onCastMageSpell={handleCastMageSpell}
                    onRecruitForces={handleRecruitForces}
                    onCollectDuchyTribute={handleCollectDuchyTribute}
                    onCompleteRoyalContract={handleCompleteRoyalContract}
                    onClaimAchievement={handleClaimAchievement}
                    dragonSanctuary={dragonSanctuary}
                    dragonFeedback={dragonFeedback}
                    onSelectCompanionDragon={handleSelectCompanionDragon}
                    onFeedDragon={handleFeedDragon}
                    onIncubateEgg={handleIncubateEgg}
                    onBuyOrBreedEgg={handleBuyOrBreedEgg}
                    onDispatchDragonMission={handleDispatchDragonMission}
                  />
                )}

                {activeTab === 'auctions' && (
                  <AuctionHouseView
                    auctions={auctions}
                    playerGold={playerGold}
                    playerInventory={playerInventory}
                    onBidAuction={handleBidAuction}
                    onCreateAuction={handleCreateAuction}
                  />
                )}

                {activeTab === 'tech' && (
                  <TechTreeView
                    unlockedTechIds={unlockedTechIds}
                    playerGold={playerGold}
                    playerInventory={playerInventory}
                    onUnlockTech={handleUnlockTech}
                  />
                )}

                {activeTab === 'guilds_chat' && (
                  <GuildChatAndRankingsView
                    guilds={guilds}
                    playerGuildId={playerGuildId}
                    onJoinGuild={setPlayerGuildId}
                    onDonateGuild={handleDonateGuild}
                    chatMessages={chatMessages}
                    onSendChatMessage={handleSendChatMessage}
                    leaderboard={leaderboard}
                    playerGold={playerGold}
                  />
                )}

                {activeTab === 'profile' && (
                  <AuthAndProfilePanel
                    backendUsername={backendUsername}
                    playerDisplayName={playerDisplayName}
                    playerTitle={playerTitle}
                    selectedRaceId={selectedRaceId}
                    playerGuildTag={`[${playerGuild?.tag ?? 'ZŁOTO'}]`}
                    playerGold={playerGold}
                    playerBondsGold={playerBondsGold}
                    netWorth={netWorth}
                    tradesExecutedCount={tradesExecutedCount}
                    profitableTradesCount={profitableTradesCount}
                    playerInventory={playerInventory}
                    unlockedTechIds={unlockedTechIds}
                    knight={knight}
                    tradeHistory={tradeHistory}
                    firebaseUser={firebaseUser}
                    syncStatusMsg={syncStatusMsg}
                    onBackendAuthSuccess={({ token, profile }) => {
                      setBackendToken(token);
                      setBackendUsername(profile.username);
                      setPlayerDisplayName(profile.displayName);
                      setPlayerTitle(profile.title);
                      setSelectedRaceId(profile.raceId);
                      setPlayerGuildId(profile.guildId);
                      setPlayerGold(profile.gold);
                      setPlayerBondsGold(profile.bondsGold);
                      setTradesExecutedCount(profile.tradesExecutedCount);
                      setProfitableTradesCount(profile.profitableTradesCount);
                      setPlayerInventory(profile.inventory);
                      setUnlockedTechIds(profile.unlockedTechIds);
                      if (profile.knight) {
                        setKnight({
                          ...createInitialKnightState(profile.raceId),
                          ...profile.knight,
                        });
                      }
                      if (profile.duchy) setDuchy(profile.duchy);
                      if (profile.tradeHistory) setTradeHistory(profile.tradeHistory);
                      setSyncStatusMsg('Zalogowano i zsynchronizowano z bazą');
                      pushNotification(
                        `Witaj w Księstwie, ${profile.displayName}!`,
                        'Twój profil kupiecki oraz postępy Rycerza zostały wczytane z bazy danych.',
                        'event',
                      );
                    }}
                    onBackendLogout={async () => {
                      if (backendToken) {
                        fetch('/api/auth/logout', {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${backendToken}` },
                        }).catch(() => {});
                      }
                      setBackendToken(null);
                      setBackendUsername(null);
                      setSyncStatusMsg('Wylogowano');
                    }}
                    onUpdateIdentity={(newName, newTitle, newKnightName) => {
                      if (newName.trim()) setPlayerDisplayName(newName.trim());
                      if (newTitle.trim()) setPlayerTitle(newTitle.trim());
                      if (newKnightName.trim()) {
                        setKnight((prev) => ({ ...prev, name: newKnightName.trim() }));
                      }
                      setSyncStatusMsg('Zaktualizowano profil');
                    }}
                    onManualSyncToBackend={() => syncProfileToCloudAndBackend()}
                    onOpenCinematicIntro={() => {
                      setCinematicSceneIdx(0);
                      setShowCinematicIntro(true);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== 2b. CINEMATIC 6-CONTINENT 3D FLYOVER CAPTION ==================== */}
      <AnimatePresence>
        {gameState === 'playing' && cinematicTourActive && (
          <motion.div
            key={tourContinentId}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-20 max-w-xl w-[92vw] bg-[#070b12]/94 border border-amber-500/60 rounded-xl px-4 py-3 shadow-2xl flex items-center justify-between gap-4"
          >
            {(() => {
              const cont =
                WORLD_CONTINENTS.find((c) => c.id === tourContinentId) ?? WORLD_CONTINENTS[0];
              return (
                <>
                  <div className="min-w-0">
                    <div
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: cont.colorHex }}
                    >
                      Przelot Filmowy 3D · {cont.climate}
                    </div>
                    <div className="font-display text-lg font-bold text-white leading-tight">
                      {cont.name} — {cont.subtitle}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                      {cont.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCinematicTourActive(false)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Zakończ Przelot
                  </button>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== 2c. TRAIL EVENT INTERACTION / BYPASS MODAL ==================== */}
      {activeTrailEvent && (
        <TrailEventModal
          event={activeTrailEvent}
          outcome={trailEventOutcome}
          playerGold={playerGold}
          knightStrength={heroDerivedStats.effectiveStrength}
          knightHp={knight.hp}
          knightMaxHp={heroDerivedStats.effectiveMaxHp}
          onSelectChoice={handleResolveTrailEventChoice}
          onClose={() => {
            setActiveTrailEvent(null);
            setTrailEventOutcome(null);
          }}
        />
      )}

      {/* ==================== 2d. WORLD DISASTER CRISIS MODAL ==================== */}
      {disasterModalOpen && (
        <DisasterEventModal
          disaster={macro.activeDisaster ?? null}
          lastResult={lastDisasterResult}
          playerGold={playerGold}
          playerInventory={playerInventory}
          hasDragonCompanion={dragonSanctuary.dragons.length > 0}
          onSelectMitigation={handleMitigateDisaster}
          onClose={() => {
            setDisasterModalOpen(false);
            setLastDisasterResult(null);
          }}
        />
      )}

      {/* ==================== 2e. INTERACTIVE CITY INTERIOR & KNIGHT ARENA MODAL ==================== */}
      {gameState === 'playing' && (
        <CityInteriorModal
          isOpen={cityInteriorOpen}
          initialMode={cityInteriorMode}
          cityId={selectedCityId}
          onChangeCity={(nextCityId) => {
            setSelectedCityId(nextCityId);
            setSelectedRegionId(nextCityId);
            const reg = WORLD_REGIONS.find((r) => r.id === nextCityId);
            if (reg) setSelectedContinentId(reg.continentId);
          }}
          onClose={() => setCityInteriorOpen(false)}
          knight={knight}
          playerGold={playerGold}
          markets={markets}
          leaderboard={leaderboard}
          arenaWins={arenaWins}
          arenaRating={arenaRating}
          onOpenMarket={(cityId) => {
            setSelectedCityId(cityId);
            setSelectedRegionId(cityId);
            setActiveTab('terminal');
            setDockCollapsed(false);
          }}
          onOpenForge={() => {
            setActiveTab('knight');
            setDockCollapsed(false);
          }}
          onOpenCaravans={(cityId) => {
            setSelectedCityId(cityId);
            setActiveTab('caravans');
            setDockCollapsed(false);
          }}
          onTavernRest={handleTavernRest}
          onStartArenaDuelWager={handleStartArenaDuelWager}
          onArenaDuelComplete={handleArenaDuelComplete}
        />
      )}

      {/* ==================== 3. PAUSE MODAL ==================== */}
      {gameState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sesja wstrzymana"
          className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4"
        >
          <div className="bg-[#0c1118] border border-amber-500/50 rounded-xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">SESJA WSTRZYMANA</h2>
            <p className="text-xs text-slate-300">
              Świat 3D został zatrzymany. Twój majątek netto wynosi{' '}
              <strong className="text-amber-400 font-mono-tabular">
                {netWorth.toLocaleString('pl-PL')} zł
              </strong>
              , a Twój Rycerz posiada <strong className="text-emerald-400">Poziom {knight.level}</strong>.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGameState('playing')}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Wznów Grę (Esc)
              </button>
              <button
                type="button"
                onClick={() => setGameState('title')}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
              >
                Ekran Tytułowy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
