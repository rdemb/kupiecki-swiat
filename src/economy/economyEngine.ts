/**
 * Kupiecki Świat 3D: Odrodzenie
 * Real-World Seasonal & Physics Economy, P2P Player & City Exchange, and Turn-Based Knight RPG Engine
 */

export type RaceId = 'ludzie' | 'elfy' | 'krasnoludy' | 'orkowie' | 'gobliny';

export type CommodityId =
  | 'zboze'
  | 'zelazo'
  | 'drewno_elfickie'
  | 'mithril'
  | 'krysztaly_many'
  | 'smocza_luska'
  | 'przyprawy'
  | 'runiczny_pergamin';

export type SeasonId = 'wiosna' | 'lato' | 'jesien' | 'zima';

export type WeatherConditionId =
  | 'sloneczna_pogoda'
  | 'ulewne_deszcze'
  | 'zamiec_i_mroz'
  | 'sztorm_na_zatoce'
  | 'wiatr_handlowy';

import type { ActiveWorldDisaster } from './worldDisasters';

export interface SeasonPhysicsMod {
  id: SeasonId;
  name: string;
  shortName: string;
  nextSeason: SeasonId;
  accentHex: string;
  description: string;
  harvestMultiplier: number;      // Affects Zboże & Przyprawy supply
  miningMultiplier: number;       // Affects Żelazo & Mithril supply
  timberMultiplier: number;       // Affects Drewno & Pergamin supply
  travelFriction: number;         // 1.0 = normal, >1.0 = snow/mud raises transport cost
  caravanSpeedMultiplier: number; // Real 3D caravan & galleon speed physics (Lato 1.22x -> Zima 0.64x)
  availabilityMultiplier: number; // Overall commodity supply & surplus stock regeneration multiplier
  priceMultipliers: Partial<Record<CommodityId, number>>;
  availabilityByCommodity: Partial<Record<CommodityId, number>>;
}

export const SEASONS: Record<SeasonId, SeasonPhysicsMod> = {
  wiosna: {
    id: 'wiosna',
    name: 'Wiosna (Roztopy i Siewy)',
    shortName: 'Wiosna',
    nextSeason: 'lato',
    accentHex: '#34D399',
    description: 'Topniejące śniegi w górach odsłaniają żyły rudy, roztopy spowalniają karawany (-14%), a miasta kupują ziarno pod zasiew.',
    harvestMultiplier: 0.92,
    miningMultiplier: 1.15,
    timberMultiplier: 1.18,
    travelFriction: 1.14,
    caravanSpeedMultiplier: 0.86,
    availabilityMultiplier: 0.96,
    priceMultipliers: {
      zboze: 1.14,
      drewno_elfickie: 0.88,
      zelazo: 0.93,
      runiczny_pergamin: 0.96,
    },
    availabilityByCommodity: {
      zboze: 0.82,
      drewno_elfickie: 1.24,
      zelazo: 1.14,
      mithril: 1.08,
    },
  },
  lato: {
    id: 'lato',
    name: 'Lato (Złoty Szlak i Żegluga)',
    shortName: 'Lato',
    nextSeason: 'jesien',
    accentHex: '#FBBF24',
    description: 'Sucha pogoda i spokojne oceany przyspieszają karawany i galeony (+22%). Wielkie floty przypraw docierają do portów wszystkich 6 kontynentów.',
    harvestMultiplier: 1.15,
    miningMultiplier: 1.05,
    timberMultiplier: 1.05,
    travelFriction: 0.82,
    caravanSpeedMultiplier: 1.22,
    availabilityMultiplier: 1.14,
    priceMultipliers: {
      przyprawy: 0.84,
      zboze: 0.92,
      krysztaly_many: 1.10,
      smocza_luska: 1.06,
    },
    availabilityByCommodity: {
      przyprawy: 1.32,
      zboze: 1.12,
      krysztaly_many: 0.90,
      smocza_luska: 0.94,
    },
  },
  jesien: {
    id: 'jesien',
    name: 'Jesień (Wielkie Żniwa i Jarmarki)',
    shortName: 'Jesień',
    nextSeason: 'zima',
    accentHex: '#FB923C',
    description: 'Spichlerze pękają w szwach od świeżego zboża (+45% podaży), a kuźnie i tartaki skupują żelazo oraz drewno przed nadchodzącą zimą.',
    harvestMultiplier: 1.45,
    miningMultiplier: 1.0,
    timberMultiplier: 0.95,
    travelFriction: 1.0,
    caravanSpeedMultiplier: 1.0,
    availabilityMultiplier: 1.24,
    priceMultipliers: {
      zboze: 0.74,
      zelazo: 1.16,
      drewno_elfickie: 1.14,
      runiczny_pergamin: 1.06,
    },
    availabilityByCommodity: {
      zboze: 1.48,
      zelazo: 0.88,
      drewno_elfickie: 0.86,
      przyprawy: 1.08,
    },
  },
  zima: {
    id: 'zima',
    name: 'Zima (Śnieżyce i Oblodzone Przełęcze)',
    shortName: 'Zima',
    nextSeason: 'wiosna',
    accentHex: '#60A5FA',
    description: 'Górskie kopalnie i przełęcze zasypane śniegiem. Karawany jadą o 36% wolniej, dostępność towarów spada, a ceny żywności, drewna i Mithrilu mocno rosną.',
    harvestMultiplier: 0.55,
    miningMultiplier: 0.68,
    timberMultiplier: 0.72,
    travelFriction: 1.48,
    caravanSpeedMultiplier: 0.64,
    availabilityMultiplier: 0.68,
    priceMultipliers: {
      zboze: 1.36,
      drewno_elfickie: 1.28,
      mithril: 1.30,
      smocza_luska: 1.24,
    },
    availabilityByCommodity: {
      zboze: 0.58,
      drewno_elfickie: 0.70,
      mithril: 0.65,
      smocza_luska: 0.72,
    },
  },
};

export interface WeatherPhysicsState {
  id: WeatherConditionId;
  name: string;
  effectSummary: string;
  seaRouteFriction: number;
  mountainPassFriction: number;
  priceImpact: Partial<Record<CommodityId, number>>;
}

export const WEATHER_CONDITIONS: Record<WeatherConditionId, WeatherPhysicsState> = {
  sloneczna_pogoda: {
    id: 'sloneczna_pogoda',
    name: 'Bezchmurne Niebo nad Księstwem',
    effectSummary: 'Idealne warunki drogowe i morskie. Niskie tarcie transportowe na wszystkich traktach.',
    seaRouteFriction: 0.9,
    mountainPassFriction: 0.95,
    priceImpact: {},
  },
  ulewne_deszcze: {
    id: 'ulewne_deszcze',
    name: 'Ulewne Deszcze i Błoto na Traktach',
    effectSummary: 'Rozmokłe drogi spowalniają ciężkie wozy z rudą żelaza i drewnem (+20% kosztu przewozu).',
    seaRouteFriction: 1.05,
    mountainPassFriction: 1.22,
    priceImpact: { zelazo: 1.09, drewno_elfickie: 1.08 },
  },
  zamiec_i_mroz: {
    id: 'zamiec_i_mroz',
    name: 'Górska Zamieć w Przełęczach',
    effectSummary: 'Zasypane trakty do Żelaznej Kuźni i Krwawego Szczytu. Dostawy Mithrilu i Smoczych Łusek ograniczone.',
    seaRouteFriction: 1.15,
    mountainPassFriction: 1.5,
    priceImpact: { mithril: 1.18, smocza_luska: 1.16, zboze: 1.12 },
  },
  sztorm_na_zatoce: {
    id: 'sztorm_na_zatoce',
    name: 'Sztorm na Złotej Zatoce',
    effectSummary: 'Galeony kupieckie wstrzymane w portach. Ceny zamorskich Przypraw i Kryształów Many rosną.',
    seaRouteFriction: 1.6,
    mountainPassFriction: 1.0,
    priceImpact: { przyprawy: 1.22, krysztaly_many: 1.15 },
  },
  wiatr_handlowy: {
    id: 'wiatr_handlowy',
    name: 'Pomyślny Wiatr Pasatowy',
    effectSummary: 'Statki handlowe płyną o 25% szybciej, zwiększając nadwyżki towarów w miastach portowych.',
    seaRouteFriction: 0.75,
    mountainPassFriction: 0.95,
    priceImpact: { przyprawy: 0.91, zboze: 0.95 },
  },
};

export interface CommoditySpec {
  id: CommodityId;
  name: string;
  symbol: string;
  category: 'Podstawowe' | 'Przemysłowe' | 'Magiczne' | 'Rzadkie';
  basePrice: number;          // Cena równowagi naturalnej
  targetInventory: number;    // Optymalny stan zapasów w magazynach miast
  elasticityGamma: number;    // Wrażliwość ceny na niedobór/nadwyżkę
  kyleLambda: number;         // Wpływ dużych zleceń graczy na kurs
  meanReversionTheta: number; // Powrót do ceny sezonowej
  baseVolatility: number;     // Naturalna zmienność kursu
  unitWeightKg: number;       // Fizyczna waga 1 szt. towaru (wpływa na fizykę transportu)
  spoilageRatePct: number;    // Naturalne psucie/zużycie dla żywności przy złej pogodzie
  cpiWeight: number;          // Waga w koszyku dóbr Królewskiej Mennicy
  primaryCityId: string;      // Miasto z naturalną nadwyżką produkcyjną
}

export interface OHLCBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  total: number;
}

export interface PlayerExchangeOffer {
  id: string;
  sellerUid: string;
  sellerName: string;
  sellerGuild: string;
  isCitySurplus: boolean; // true = Miasto wystawia własną nadwyżkę produkcyjną, false = oferta Gracza P2P
  cityId: string;
  cityName: string;
  commodityId: CommodityId;
  quantity: number;
  pricePerUnit: number;
  createdAt: string;
}

export interface CommodityMarketState {
  id: CommodityId;
  currentPrice: number;
  previousPrice: number;
  change24hPct: number;
  inventory: number;
  targetInventory: number;
  volume24h: number;
  netOrderFlow: number;
  vwap: number;
  rsi14: number;
  bollingerUpper: number;
  bollingerLower: number;
  bidPrice: number;
  askPrice: number;
  spreadPct: number;
  seasonalTrendLabel: string;
  cityPrices: Record<string, number>;
  citySurplusStock: Record<string, number>;
  history: OHLCBar[];
  orderBook: {
    bids: OrderBookLevel[];
    asks: OrderBookLevel[];
  };
}

export interface MacroEconomyState {
  fieldStage?: import('./commonField').FieldStage;
  moneySupplyM: number;
  targetMoneySupplyMStar: number;
  velocityV: number;
  cpiIndex: number;
  inflationRatePct: number;
  dynamicTaxRatePct: number;
  royalMintBondYieldPct: number;
  totalGoldBurned: number;
  totalGoldMinted: number;
  storageDemurrageRate: number;
  activeSeason: SeasonId;
  activeSeasonName: string;
  activeSeasonDesc: string;
  nextSeason?: SeasonId;
  seasonDayProgress?: number;        // 0..1 progress within current season
  daysUntilNextSeason?: number;
  caravanSpeedMultiplier?: number;   // Combined season + disaster caravan speed
  seasonalAvailabilityIndex?: number;// 100 = normal, >100 = harvest abundance, <100 = winter scarcity
  activeDisaster?: ActiveWorldDisaster | null;
  activeWeather: WeatherConditionId;
  activeWeatherName: string;
  activeWeatherEffect: string;
  worldDayNumber: number;
  activeEventTitle: string;
  activeEventEffect: string;
  activeEventMultiplier: Partial<Record<CommodityId, number>>;
}

export type ContinentId =
  | 'stary_kontynent'
  | 'solaria_poludnie'
  | 'frostheim_polnoc'
  | 'aetheris_wschod'
  | 'valoria_zachod'
  | 'obsydian_wulkan'
  | 'nowa_nadzieja'
  | 'kresy_nadziei';

export interface CityNode {
  id: string;
  name: string;
  continentId: ContinentId;
  race: RaceId;
  raceLabel: string;
  description: string;
  position3D: [number, number, number];
  altitudeMeters: number; // Fizyka świata: wysokość n.p.m. wpływa na koszty wspinaczki i śnieżyce zimą
  isCoastalPort: boolean; // Dostęp do szlaków morskich
  specialty: CommodityId;
  demandCommodity: CommodityId;
  dangerLevel: number;
  colorHex: string;
}

export const CITIES: CityNode[] = [
  {
    id: 'krolewska_przystan',
    name: 'Królewska Przystań',
    continentId: 'stary_kontynent',
    race: 'ludzie',
    raceLabel: 'Ludzie',
    description: 'Stolica Księstwa, siedziba Królewskiej Mennicy, Głównej Giełdy Kupieckiej oraz warownego portu nad Centralną Zatoką.',
    position3D: [4, 0, 2],
    altitudeMeters: 25,
    isCoastalPort: true,
    specialty: 'zboze',
    demandCommodity: 'mithril',
    dangerLevel: 0.12,
    colorHex: '#D4AF37',
  },
  {
    id: 'srebrny_gaj',
    name: 'Srebrny Gaj',
    continentId: 'stary_kontynent',
    race: 'elfy',
    raceLabel: 'Elfy',
    description: 'Leśne sanktuarium w zachodniej dolinie rzeki, słynące z tartaków Drewna Elfickiego i skryptoriów Runicznych Pergaminów.',
    position3D: [-56, 0, -4],
    altitudeMeters: 180,
    isCoastalPort: false,
    specialty: 'drewno_elfickie',
    demandCommodity: 'zelazo',
    dangerLevel: 0.18,
    colorHex: '#10B981',
  },
  {
    id: 'zelazna_kuznia',
    name: 'Żelazna Kuźnia',
    continentId: 'stary_kontynent',
    race: 'krasnoludy',
    raceLabel: 'Krasnoludy',
    description: 'Północna górska forteca w ośnieżonych szczytach (1150 m n.p.m.), główne centrum wydobycia Żelaza oraz wytopu czystego Mithrilu.',
    position3D: [-6, 0, -56],
    altitudeMeters: 1150,
    isCoastalPort: false,
    specialty: 'mithril',
    demandCommodity: 'zboze',
    dangerLevel: 0.25,
    colorHex: '#F59E0B',
  },
  {
    id: 'krwawy_szczyt',
    name: 'Krwawy Szczyt',
    continentId: 'stary_kontynent',
    race: 'orkowie',
    raceLabel: 'Orkowie',
    description: 'Wschodnia bazaltowa warownia u stóp dymiącego wulkanu (1420 m n.p.m.), skąd pogromcy przywożą Smocze Łuski.',
    position3D: [64, 0, -8],
    altitudeMeters: 1420,
    isCoastalPort: false,
    specialty: 'smocza_luska',
    demandCommodity: 'przyprawy',
    dangerLevel: 0.35,
    colorHex: '#F43F5E',
  },
  {
    id: 'zlota_zatoka',
    name: 'Złota Zatoka',
    continentId: 'solaria_poludnie',
    race: 'gobliny',
    raceLabel: 'Gobliny',
    description: 'Wyspiarski archipelag i brama do Kontynentu Południowego, gdzie przypływają galeony z Przyprawami i Kryształami Many.',
    position3D: [14, 0, 76],
    altitudeMeters: 10,
    isCoastalPort: true,
    specialty: 'krysztaly_many',
    demandCommodity: 'drewno_elfickie',
    dangerLevel: 0.22,
    colorHex: '#38BDF8',
  },
  {
    id: 'oaza_alkharim',
    name: 'Oaza Al-Kharim',
    continentId: 'solaria_poludnie',
    race: 'ludzie',
    raceLabel: 'Sułtanat Solarii',
    description: 'Wielki pustynny port i bazar korzenny na Kontynencie Południowym otoczony złotymi wydmami i palmową oazą.',
    position3D: [-64, 0, 118],
    altitudeMeters: 45,
    isCoastalPort: true,
    specialty: 'przyprawy',
    demandCommodity: 'zelazo',
    dangerLevel: 0.26,
    colorHex: '#FB923C',
  },
  {
    id: 'frostgard',
    name: 'Frostgard',
    continentId: 'frostheim_polnoc',
    race: 'krasnoludy',
    raceLabel: 'Klany Frostheimu',
    description: 'Lodowa twierdza w głębokim fiordzie Północnego Kontynentu — centrum wydobycia mroźnej rudy żelaza i szlaków arktycznych.',
    position3D: [-128, 0, -118],
    altitudeMeters: 320,
    isCoastalPort: true,
    specialty: 'zelazo',
    demandCommodity: 'przyprawy',
    dangerLevel: 0.32,
    colorHex: '#60A5FA',
  },
  {
    id: 'jadeitowa_przystan',
    name: 'Jadeitowa Przystań',
    continentId: 'aetheris_wschod',
    race: 'elfy',
    raceLabel: 'Cesarstwo Aetheris',
    description: 'Zamorska metropolia pagód i szmaragdowych szczytów na Wschodnim Kontynencie, słynąca z Runicznych Pergaminów i Kryształów Many.',
    position3D: [158, 0, 18],
    altitudeMeters: 65,
    isCoastalPort: true,
    specialty: 'runiczny_pergamin',
    demandCommodity: 'mithril',
    dangerLevel: 0.28,
    colorHex: '#2DD4BF',
  },
  {
    id: 'valgard',
    name: 'Valgard (Wyżyny)',
    continentId: 'valoria_zachod',
    race: 'elfy',
    raceLabel: 'Klan Valorii',
    description: 'Szmaragdowa twierdza nad wodospadami Zachodniego Kontynentu Valorii — spichlerz pradawnych lasów i hodowców wywern.',
    position3D: [-168, 0, 8],
    altitudeMeters: 420,
    isCoastalPort: true,
    specialty: 'drewno_elfickie',
    demandCommodity: 'mithril',
    dangerLevel: 0.24,
    colorHex: '#22C55E',
  },
  {
    id: 'smocza_przystan',
    name: 'Smocza Przystań',
    continentId: 'valoria_zachod',
    race: 'ludzie',
    raceLabel: 'Zakon Smoczych Hodowców',
    description: 'Południowo-zachodni port i wielkie sanktuarium gniazd smoczych na klifach Valorii — serce hodowli smoków i handlu łuskami.',
    position3D: [-192, 0, 46],
    altitudeMeters: 165,
    isCoastalPort: true,
    specialty: 'smocza_luska',
    demandCommodity: 'zboze',
    dangerLevel: 0.30,
    colorHex: '#4ADE80',
  },
  {
    id: 'obsydianowa_cytadela',
    name: 'Obsydianowa Cytadela',
    continentId: 'obsydian_wulkan',
    race: 'krasnoludy',
    raceLabel: 'Kuźnie Magmy',
    description: 'Potężna czarna twierdza wyciosana w bazalcie nad rzekami płynnej lawy na Archipelagu Obsydianowym. Najbogatsze kuźnie Mithrilu i Smoczych Łusek.',
    position3D: [156, 0, 148],
    altitudeMeters: 980,
    isCoastalPort: true,
    specialty: 'mithril',
    demandCommodity: 'zboze',
    dangerLevel: 0.38,
    colorHex: '#F97316',
  },
  {
    id: 'port_popiolow',
    name: 'Port Popiołów',
    continentId: 'obsydian_wulkan',
    race: 'gobliny',
    raceLabel: 'Korsarze Obsydianu',
    description: 'Geotermalny port na południowym skraju Archipelagu Obsydianowego, łączący szlaki magmowych kopalni z Solarią i Aetheris.',
    position3D: [124, 0, 174],
    altitudeMeters: 40,
    isCoastalPort: true,
    specialty: 'krysztaly_many',
    demandCommodity: 'drewno_elfickie',
    dangerLevel: 0.34,
    colorHex: '#EA580C',
  },
];

export const COMMODITIES: CommoditySpec[] = [
  {
    id: 'zboze',
    name: 'Zboże Królewskie',
    symbol: 'ZBO',
    category: 'Podstawowe',
    basePrice: 24,
    targetInventory: 5000,
    elasticityGamma: 0.75,
    kyleLambda: 0.14,
    meanReversionTheta: 0.18,
    baseVolatility: 0.012,
    unitWeightKg: 25,
    spoilageRatePct: 2.5,
    cpiWeight: 0.22,
    primaryCityId: 'krolewska_przystan',
  },
  {
    id: 'zelazo',
    name: 'Ruda Żelaza',
    symbol: 'ZEL',
    category: 'Przemysłowe',
    basePrice: 68,
    targetInventory: 3200,
    elasticityGamma: 0.65,
    kyleLambda: 0.16,
    meanReversionTheta: 0.15,
    baseVolatility: 0.018,
    unitWeightKg: 45,
    spoilageRatePct: 0,
    cpiWeight: 0.18,
    primaryCityId: 'zelazna_kuznia',
  },
  {
    id: 'drewno_elfickie',
    name: 'Drewno Elfickie',
    symbol: 'DRW',
    category: 'Przemysłowe',
    basePrice: 95,
    targetInventory: 2400,
    elasticityGamma: 0.62,
    kyleLambda: 0.17,
    meanReversionTheta: 0.14,
    baseVolatility: 0.020,
    unitWeightKg: 35,
    spoilageRatePct: 0.5,
    cpiWeight: 0.14,
    primaryCityId: 'srebrny_gaj',
  },
  {
    id: 'przyprawy',
    name: 'Przyprawy Wschodnie',
    symbol: 'PRZ',
    category: 'Podstawowe',
    basePrice: 140,
    targetInventory: 1800,
    elasticityGamma: 0.58,
    kyleLambda: 0.19,
    meanReversionTheta: 0.12,
    baseVolatility: 0.022,
    unitWeightKg: 10,
    spoilageRatePct: 1.2,
    cpiWeight: 0.12,
    primaryCityId: 'zlota_zatoka',
  },
  {
    id: 'runiczny_pergamin',
    name: 'Runiczny Pergamin',
    symbol: 'RUN',
    category: 'Magiczne',
    basePrice: 230,
    targetInventory: 1100,
    elasticityGamma: 0.60,
    kyleLambda: 0.22,
    meanReversionTheta: 0.11,
    baseVolatility: 0.025,
    unitWeightKg: 5,
    spoilageRatePct: 0.8,
    cpiWeight: 0.10,
    primaryCityId: 'srebrny_gaj',
  },
  {
    id: 'krysztaly_many',
    name: 'Kryształy Many',
    symbol: 'MAN',
    category: 'Magiczne',
    basePrice: 360,
    targetInventory: 850,
    elasticityGamma: 0.68,
    kyleLambda: 0.25,
    meanReversionTheta: 0.10,
    baseVolatility: 0.030,
    unitWeightKg: 12,
    spoilageRatePct: 0,
    cpiWeight: 0.10,
    primaryCityId: 'zlota_zatoka',
  },
  {
    id: 'mithril',
    name: 'Sztaby Mithrilu',
    symbol: 'MTH',
    category: 'Rzadkie',
    basePrice: 620,
    targetInventory: 500,
    elasticityGamma: 0.72,
    kyleLambda: 0.28,
    meanReversionTheta: 0.09,
    baseVolatility: 0.035,
    unitWeightKg: 30,
    spoilageRatePct: 0,
    cpiWeight: 0.08,
    primaryCityId: 'zelazna_kuznia',
  },
  {
    id: 'smocza_luska',
    name: 'Smocza Łuska',
    symbol: 'SML',
    category: 'Rzadkie',
    basePrice: 1150,
    targetInventory: 240,
    elasticityGamma: 0.80,
    kyleLambda: 0.34,
    meanReversionTheta: 0.08,
    baseVolatility: 0.042,
    unitWeightKg: 18,
    spoilageRatePct: 0,
    cpiWeight: 0.06,
    primaryCityId: 'krwawy_szczyt',
  },
];

/**
 * 1. INVENTORY & SEASONAL EQUILIBRIUM CURVE:
 */
export function calculateInventoryEquilibriumPrice(
  basePrice: number,
  currentInventory: number,
  targetInventory: number,
  gamma: number,
  eventMultiplier = 1.0,
): number {
  const safeInventory = Math.max(currentInventory, targetInventory * 0.12);
  const ratio = targetInventory / safeInventory;
  const rawPrice = basePrice * Math.pow(ratio, gamma) * eventMultiplier;
  return Number(Math.max(basePrice * 0.2, Math.min(basePrice * 6.0, rawPrice)).toFixed(2));
}

/**
 * 2. DYNAMIC COMMODITY PRICE STEP (Supply/Demand + Season/Weather + Order Flow):
 */
export function stepDynamicCommodityPrice(params: {
  currentPrice: number;
  basePrice: number;
  currentInventory: number;
  targetInventory: number;
  gamma: number;
  kyleLambda: number;
  theta: number;
  netOrderFlow: number;
  averageVolume: number;
  eventMultiplier?: number;
  noiseShock?: number;
}): number {
  const {
    currentPrice,
    basePrice,
    currentInventory,
    targetInventory,
    gamma,
    kyleLambda,
    theta,
    netOrderFlow,
    averageVolume,
    eventMultiplier = 1.0,
    noiseShock = 0,
  } = params;

  const pInv = calculateInventoryEquilibriumPrice(
    basePrice,
    currentInventory,
    targetInventory,
    gamma,
    eventMultiplier,
  );

  const safeAvgVol = Math.max(10, averageVolume);
  const sign = netOrderFlow > 0 ? 1 : netOrderFlow < 0 ? -1 : 0;
  const normalizedFlow = Math.min(4.0, Math.abs(netOrderFlow) / safeAvgVol);
  const volumeImpactFactor = 1 + kyleLambda * sign * Math.sqrt(normalizedFlow);

  const impactedPrice = currentPrice * volumeImpactFactor;
  const meanReversionDelta = theta * (pInv - impactedPrice);
  const stochasticDelta = currentPrice * noiseShock;

  const nextPrice = impactedPrice + meanReversionDelta + stochasticDelta;
  const minBound = basePrice * 0.22;
  const maxBound = basePrice * 5.5;

  return Number(Math.max(minBound, Math.min(maxBound, nextPrice)).toFixed(2));
}

/**
 * 3. ROYALTRADE FEE / ANTI-INFLATION STABILIZER:
 */
export function calculateDynamicAntiInflationTax(
  moneySupplyM: number,
  targetMoneySupplyMStar: number,
  baseTaxPct = 1.5,
  kappa = 8.0,
): number {
  const excessRatio = Math.max(0, (moneySupplyM - targetMoneySupplyMStar) / Math.max(1, targetMoneySupplyMStar));
  const taxPct = baseTaxPct + kappa * excessRatio;
  return Number(Math.min(18.0, Math.max(0.5, taxPct)).toFixed(2));
}

/**
 * 4. WAREHOUSE STORAGE COST:
 */
export function calculateStorageDemurrageCost(
  totalUnitsStored: number,
  freeCapacity = 150,
  c0 = 0.18,
): number {
  const taxableUnits = Math.max(0, totalUnitsStored - freeCapacity);
  if (taxableUnits === 0) return 0;
  return Number((c0 * Math.pow(taxableUnits, 1.25)).toFixed(2));
}

/**
 * 5. MACRO INDICATORS:
 */
export function calculateMacroIndicators(
  prices: Record<CommodityId, number>,
  moneySupplyM: number,
  targetMoneySupplyMStar: number,
): {
  cpiIndex: number;
  inflationRatePct: number;
  dynamicTaxRatePct: number;
  royalMintBondYieldPct: number;
} {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const spec of COMMODITIES) {
    const p = prices[spec.id] ?? spec.basePrice;
    weightedSum += spec.cpiWeight * (p / spec.basePrice);
    totalWeight += spec.cpiWeight;
  }

  const cpiIndex = Number(((weightedSum / Math.max(0.01, totalWeight)) * 100).toFixed(2));
  const inflationRatePct = Number((cpiIndex - 100).toFixed(2));
  const dynamicTaxRatePct = calculateDynamicAntiInflationTax(moneySupplyM, targetMoneySupplyMStar);

  const royalMintBondYieldPct = Number(
    Math.min(25.0, Math.max(2.5, 4.0 + 0.45 * Math.max(0, inflationRatePct) + 0.35 * (dynamicTaxRatePct - 1.5))).toFixed(2),
  );

  return {
    cpiIndex,
    inflationRatePct,
    dynamicTaxRatePct,
    royalMintBondYieldPct,
  };
}

/**
 * 6. ORDER BOOK GENERATOR (Real Exchange Bid/Ask):
 */
export function generateOrderBook(
  currentPrice: number,
  currentInventory: number,
  targetInventory: number,
  volatility: number,
  techSpreadReduction = 0,
): {
  bidPrice: number;
  askPrice: number;
  spreadPct: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
} {
  const inventoryImbalance = Math.abs(currentInventory - targetInventory) / Math.max(1, targetInventory);
  const rawHalfSpreadPct = Math.max(
    0.0025,
    (0.004 + volatility * 0.22 + inventoryImbalance * 0.008) * (1 - Math.min(0.65, techSpreadReduction)),
  );

  const bidPrice = Number((currentPrice * (1 - rawHalfSpreadPct)).toFixed(2));
  const askPrice = Number((currentPrice * (1 + rawHalfSpreadPct)).toFixed(2));
  const spreadPct = Number((((askPrice - bidPrice) / currentPrice) * 100).toFixed(2));

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let cumBid = 0;
  let cumAsk = 0;
  const baseDepth = Math.max(15, Math.round(targetInventory * 0.04));

  for (let level = 0; level < 6; level++) {
    const stepFactor = 1 + (level + 1) * 0.0045;
    const lvlBidPrice = Number((bidPrice / stepFactor).toFixed(2));
    const lvlAskPrice = Number((askPrice * stepFactor).toFixed(2));

    const bidQty = Math.round(baseDepth * (1 + level * 0.45));
    const askQty = Math.round(baseDepth * (1 + level * 0.42));

    cumBid += bidQty;
    cumAsk += askQty;

    bids.push({ price: lvlBidPrice, quantity: bidQty, total: cumBid });
    asks.push({ price: lvlAskPrice, quantity: askQty, total: cumAsk });
  }

  return { bidPrice, askPrice, spreadPct, bids, asks };
}

/**
 * 7. REGIONAL CITY PRICING WITH WORLD PHYSICS (Altitude, Season, Coastal vs Mountain):
 * Miasta posiadają naturalną nadwyżkę swojego głównego surowca (-16% taniej) oraz
 * naturalny popyt na surowce brakujące w ich klimacie/wysokości (+18% drożej).
 */
export function calculateRegionalCityPrices(
  commodityId: CommodityId,
  globalPrice: number,
  tickSeed = 0,
  season: SeasonId = 'lato',
): Record<string, number> {
  const result: Record<string, number> = {};
  const seasonObj = SEASONS[season] ?? SEASONS.lato;

  for (let idx = 0; idx < CITIES.length; idx++) {
    const city = CITIES[idx];
    let multiplier = 1.0;

    if (city.specialty === commodityId) {
      // Miasto produkuje nadwyżkę tego surowca
      multiplier = 0.84;
    } else if (city.demandCommodity === commodityId) {
      // Miasto potrzebuje tego surowca
      multiplier = 1.19;
    } else {
      const wave = Math.sin(tickSeed * 0.3 + idx * 1.7) * 0.04;
      multiplier = 1.0 + wave;
    }

    // Fizyka świata: Zimą w górskich miastach (>1000 m n.p.m.) żywność i drewno drożeją przez zasypane przełęcze
    if (seasonObj.id === 'zima' && city.altitudeMeters >= 1000 && (commodityId === 'zboze' || commodityId === 'drewno_elfickie')) {
      multiplier *= 1.12;
    }

    result[city.id] = Number(Math.max(1, globalPrice * multiplier).toFixed(2));
  }
  return result;
}

/**
 * 8. CARAVAN TRANSPORT & WORLD PHYSICS CALCULATOR:
 * Oblicza koszty transportu towaru między miastami uwzględniając odległość 3D,
 * różnicę wysokości n.p.m. (wspinaczka wozów), ciężar ładunku (kg) oraz porę roku.
 */
export function calculateCaravanQuote(params: {
  originCityId: string;
  destinationCityId: string;
  commodityId: CommodityId;
  quantity: number;
  escortLevel: number;
  cityPrices: Record<string, number>;
  logisticsTechBonus?: number;
  season?: SeasonId;
  activeDisaster?: ActiveWorldDisaster | null;
}) {
  const originCity = CITIES.find((c) => c.id === params.originCityId) ?? CITIES[0];
  const destCity = CITIES.find((c) => c.id === params.destinationCityId) ?? CITIES[1];
  const commSpec = COMMODITIES.find((c) => c.id === params.commodityId) ?? COMMODITIES[0];
  const seasonMod = SEASONS[params.season ?? 'lato'] ?? SEASONS.lato;

  const buyUnit = params.cityPrices[originCity.id] ?? 100;
  const sellUnit = params.cityPrices[destCity.id] ?? 110;

  const dx = destCity.position3D[0] - originCity.position3D[0];
  const dz = destCity.position3D[2] - originCity.position3D[2];
  const distance = Math.max(10, Math.hypot(dx, dz));

  // Fizyka świata: wspinaczka pod górę, masa ładunku (kg), pora roku i ewentualna katastrofa
  const altitudeClimb = Math.max(0, destCity.altitudeMeters - originCity.altitudeMeters);
  const climbFactor = 1 + altitudeClimb / 2800;
  const totalWeightKg = commSpec.unitWeightKg * params.quantity;

  const disasterSpeedMult =
    params.activeDisaster &&
    (params.activeDisaster.continentId === originCity.continentId ||
      params.activeDisaster.continentId === destCity.continentId)
      ? params.activeDisaster.caravanSpeedMultiplier
      : params.activeDisaster
        ? Number((1 - (1 - params.activeDisaster.caravanSpeedMultiplier) * 0.35).toFixed(2))
        : 1.0;

  const effectiveSpeedMult = Number(
    Math.max(0.35, seasonMod.caravanSpeedMultiplier * disasterSpeedMult).toFixed(2),
  );

  const escortCostPerUnitDist = [0, 2.2, 5.0, 9.5][params.escortLevel] ?? 0;
  const escortProtection = [0, 0.55, 0.85, 0.98][params.escortLevel] ?? 0;

  const baseTransport =
    distance * (1.1 + params.quantity * 0.035 + totalWeightKg * 0.0005) * climbFactor * seasonMod.travelFriction;
  const transportFee = Math.round(baseTransport + distance * escortCostPerUnitDist);

  const rawAmbushRisk = ((originCity.dangerLevel + destCity.dangerLevel) / 2) * (1 - escortProtection);
  const effectiveAmbushRiskPct = Number((Math.max(0.01, rawAmbushRisk) * 100).toFixed(1));

  const cargoPurchaseCost = Number((buyUnit * params.quantity).toFixed(2));
  const grossRevenue = Number((sellUnit * params.quantity * (1 + (params.logisticsTechBonus ?? 0))).toFixed(2));
  const expectedNetProfit = Number((grossRevenue - cargoPurchaseCost - transportFee).toFixed(2));

  return {
    distance: Math.round(distance),
    altitudeClimb,
    totalWeightKg,
    seasonName: seasonMod.name,
    caravanSpeedMultiplier: effectiveSpeedMult,
    buyUnit,
    sellUnit,
    cargoPurchaseCost,
    transportFee,
    grossRevenue,
    expectedNetProfit,
    effectiveAmbushRiskPct,
    durationSeconds: Math.max(6, Math.round((distance * 0.25) / effectiveSpeedMult)),
  };
}

/**
 * 9. CITY MARKET SENTIMENT / MOOD GAUGE ENGINE (ANTI-INFLATION MODEL + CITY TRENDS):
 * Synthesizes Królewska Mennica anti-inflation telemetry (CPI, M/M*, Tobin Tax, Bond Yield, Gold Burn)
 * with local city commodity price premiums, 24h momentum, and surplus stocks into a 0-100 visual mood gauge.
 */
export type CityMarketMoodId = 'panic' | 'caution' | 'balanced' | 'optimism' | 'overheated';

export interface CityMarketSentimentReport {
  cityId: string;
  cityName: string;
  score: number; // 0..100 (0 = Deflacyjna Panika, 50 = Złota Równowaga, 100 = Przegrzanie Inflacyjne)
  moodId: CityMarketMoodId;
  moodLabel: string;
  moodSubtitle: string;
  actionHint: string;
  inflationPressure: number; // 0..100
  cityDemandIndex: number;   // 0..100
  surplusHealth: number;     // 0..100
  moneySupplyRatio: number;  // M / M*
  burnCoveragePct: number;   // totalGoldBurned / totalGoldMinted %
  localPricePremiumPct: number;
  avgMomentum24hPct: number;
  cpiIndex: number;
  inflationRatePct: number;
  dynamicTaxRatePct: number;
  royalMintBondYieldPct: number;
  specialtyName: string;
  demandName: string;
}

export function calculateCityMarketSentiment(
  cityId: string,
  markets: Record<CommodityId, CommodityMarketState>,
  macro: MacroEconomyState,
): CityMarketSentimentReport {
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  const specialtySpec = COMMODITIES.find((c) => c.id === city.specialty) ?? COMMODITIES[0];
  const demandSpec = COMMODITIES.find((c) => c.id === city.demandCommodity) ?? COMMODITIES[1];

  let weightedPremiumSum = 0;
  let weightedMomentumSum = 0;
  let totalWeight = 0;
  let surplusRatioSum = 0;
  let count = 0;

  for (const spec of COMMODITIES) {
    const m = markets[spec.id];
    if (!m) continue;
    const localPrice = m.cityPrices?.[city.id] ?? m.currentPrice;
    const premiumPct = ((localPrice - spec.basePrice) / Math.max(1, spec.basePrice)) * 100;
    const w =
      spec.id === city.demandCommodity
        ? spec.cpiWeight * 2.1
        : spec.id === city.specialty
          ? spec.cpiWeight * 1.6
          : spec.cpiWeight;

    weightedPremiumSum += premiumPct * w;
    weightedMomentumSum += m.change24hPct * w;
    totalWeight += w;

    const citySurplus = m.citySurplusStock?.[city.id] ?? Math.round(spec.targetInventory * 0.04);
    const healthySurplus =
      city.specialty === spec.id ? spec.targetInventory * 0.14 : spec.targetInventory * 0.04;
    surplusRatioSum += Math.min(1.6, citySurplus / Math.max(1, healthySurplus));
    count += 1;
  }

  const localPricePremiumPct = Number((weightedPremiumSum / Math.max(0.01, totalWeight)).toFixed(1));
  const avgMomentum24hPct = Number((weightedMomentumSum / Math.max(0.01, totalWeight)).toFixed(1));

  const moneySupplyRatio = Number(
    (macro.moneySupplyM / Math.max(1, macro.targetMoneySupplyMStar)).toFixed(3),
  );
  const burnCoveragePct = Number(
    Math.min(100, (macro.totalGoldBurned / Math.max(1, macro.totalGoldMinted)) * 100).toFixed(1),
  );

  // Anti-inflation pressure (0..100): rises with CPI inflation, excess M/M*, and Tobin tax
  const excessMoneyPct = (moneySupplyRatio - 1) * 100;
  const rawInflationPressure =
    35 +
    macro.inflationRatePct * 1.9 +
    excessMoneyPct * 1.45 +
    (macro.dynamicTaxRatePct - 1.5) * 4.2 -
    burnCoveragePct * 0.15;
  const inflationPressure = Math.round(Math.max(4, Math.min(98, rawInflationPressure)));

  // City local demand heat (0..100)
  const rawCityDemand = 50 + localPricePremiumPct * 1.4 + avgMomentum24hPct * 2.6;
  const cityDemandIndex = Math.round(Math.max(5, Math.min(98, rawCityDemand)));

  // Local warehouse surplus health (0..100)
  const avgSurplusNorm = count > 0 ? surplusRatioSum / count : 0.7;
  const surplusHealth = Math.round(Math.max(8, Math.min(98, avgSurplusNorm * 72)));

  // Composite visual mood score (0 = deflationary panic, 50 = golden balance, 100 = inflationary overheat)
  const rawScore =
    50 +
    (inflationPressure - 46) * 0.52 +
    (cityDemandIndex - 50) * 0.48 -
    (surplusHealth - 65) * 0.16;
  const score = Math.round(Math.max(2, Math.min(98, rawScore)));

  let moodId: CityMarketMoodId;
  let moodLabel: string;
  let moodSubtitle: string;
  let actionHint: string;

  if (score <= 22) {
    moodId = 'panic';
    moodLabel = 'Panika Deflacyjna';
    moodSubtitle = 'Silny odpływ kapitału i głębokie przeceny surowców';
    actionHint = `Okazja akumulacji: skupuj tanie nadwyżki (${specialtySpec.name}) i magazynuj przed odbiciem kursu.`;
  } else if (score <= 41) {
    moodId = 'caution';
    moodLabel = 'Ostrożny Rynek';
    moodSubtitle = 'Spokojny popyt pod ochroną mechanizmów Mennicy';
    actionHint = `Niskie opłaty targowe (${macro.dynamicTaxRatePct}%). Dobry moment na załadunek karawan z ${city.name}.`;
  } else if (score <= 60) {
    moodId = 'balanced';
    moodLabel = 'Złota Równowaga';
    moodSubtitle = 'Stabilny koszyk CPI i zdrowe zapasy w spichlerzach';
    actionHint = `Rynek zrównoważony. Kupuj lokalną nadwyżkę (${specialtySpec.name}) i sprzedawaj deficyt (${demandSpec.name}).`;
  } else if (score <= 79) {
    moodId = 'optimism';
    moodLabel = 'Hossa Kupiecka';
    moodSubtitle = 'Rosnący popyt miast i podwyższona presja pieniądza M/M*';
    actionHint = `Wysokie marże sprzedaży dla ${demandSpec.name}. Rozważ lokatę nadwyżki złota w Obligacje (${macro.royalMintBondYieldPct}%).`;
  } else {
    moodId = 'overheated';
    moodLabel = 'Przegrzanie Inflacyjne';
    moodSubtitle = 'Wysoki indeks CPI — Podatek Tobina aktywnie chłodzi giełdę';
    actionHint = `Realizuj zyski na szczycie i chroń kapitał przed podatkiem (${macro.dynamicTaxRatePct}%) poprzez towary rzadkie lub obligacje.`;
  }

  return {
    cityId: city.id,
    cityName: city.name,
    score,
    moodId,
    moodLabel,
    moodSubtitle,
    actionHint,
    inflationPressure,
    cityDemandIndex,
    surplusHealth,
    moneySupplyRatio,
    burnCoveragePct,
    localPricePremiumPct,
    avgMomentum24hPct,
    cpiIndex: macro.cpiIndex,
    inflationRatePct: macro.inflationRatePct,
    dynamicTaxRatePct: macro.dynamicTaxRatePct,
    royalMintBondYieldPct: macro.royalMintBondYieldPct,
    specialtyName: specialtySpec.name,
    demandName: demandSpec.name,
  };
}

