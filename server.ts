import express from 'express';
import { installBridge } from './server/bridge';
import { installMill } from './server/mill';
import {emptyMark,type MillMark} from './src/economy/mill';
import { installMerchantInn } from './server/merchantInn';
import { installHarborWorks } from './server/harborWorks';
import { installWeighhouse } from './server/weighhouse';
import { installProvinces } from './server/provinces';
import { installCourt } from './server/court';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseSync } from 'node:sqlite';
import {
  CITIES,
  COMMODITIES,
  CommodityId,
  CommodityMarketState,
  MacroEconomyState,
  OHLCBar,
  PlayerExchangeOffer,
  SEASONS,
  SeasonId,
  WEATHER_CONDITIONS,
  WeatherConditionId,
  calculateMacroIndicators,
  calculateRegionalCityPrices,
  generateOrderBook,
  stepDynamicCommodityPrice,
} from './src/economy/economyEngine';
import {
  AuctionItem,
  ChatMessage,
  DuchyState,
  GuildInfo,
  KnightState,
  RACES,
  createInitialDuchyState,
  createInitialKnightState,
} from './src/economy/gameData';
import {
  ActiveWorldDisaster,
  DisasterId,
  getDisasterPriceMultiplier,
  pickRandomDisaster,
} from './src/economy/worldDisasters';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

// --- Persistent Backend Player Accounts & Profiles Store ---
export interface ServerPlayerAccount {
  uid: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  displayName: string;
  title: string;
  raceId: string;
  guildId: string;
  gold: number;
  millMark?: MillMark;
  bondsGold: number;
  netWorth: number;
  tradesExecutedCount: number;
  profitableTradesCount: number;
  inventory: Record<CommodityId, number>;
  unlockedTechIds: string[];
  knight: KnightState;
  duchy: DuchyState;
  tradeHistory: Array<{
    id: string;
    commodityId: CommodityId;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    cityId: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.env.GAME_DATA_DIR || '.data');
fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(path.join(DATA_DIR, 'game.sqlite'));
db.exec(`CREATE TABLE IF NOT EXISTS players (
  username TEXT PRIMARY KEY, profile TEXT NOT NULL
)`);
const insertPlayer = db.prepare('INSERT INTO players(username, profile) VALUES (?, ?)');
const updatePlayer = db.prepare('UPDATE players SET profile = ? WHERE username = ?');
const selectPlayer = db.prepare('SELECT profile FROM players WHERE username = ?');
const activeSessions = new Map<string, string>();

// Each live tab reports cumulative changes from ordinary play, excluding mill settlements
// and changes already attributed to another tab. A delayed save can then be replayed safely.
interface WalletCursor {sequence:number; gold:number; grain:number}
const walletCursors = new Map<string,WalletCursor>();
function openWallet(token:string, acc:ServerPlayerAccount) {
  const mark=acc.millMark??emptyMark;
  walletCursors.set(token,{sequence:0,gold:acc.gold-mark.gold,grain:acc.inventory.zboze-mark.grain});
}
function readAccount(username: string): ServerPlayerAccount | null {
  const row = selectPlayer.get(username);
  return row ? JSON.parse(String(row.profile)) : null;
}

function saveAccount(account: ServerPlayerAccount) {
  updatePlayer.run(JSON.stringify(account), account.username.toLowerCase());
}

function migrateLegacyAccounts() {
  if (db.prepare('PRAGMA user_version').get()?.user_version !== 0) return;
  db.exec('BEGIN IMMEDIATE');
  try {
    const file = path.join(DATA_DIR, 'players.json');
    if (fs.existsSync(file)) {
      const accounts = JSON.parse(fs.readFileSync(file, 'utf8')) as ServerPlayerAccount[];
      if (!Array.isArray(accounts)) throw new Error('Niepoprawny format players.json');
      for (const account of accounts) {
        if (!account.uid || !account.passwordHash || !account.passwordSalt) {
          throw new Error('Niekompletny profil w players.json');
        }
        account.knight ??= createInitialKnightState(account.raceId);
        account.duchy ??= createInitialDuchyState(account.raceId);
        insertPlayer.run(account.username.toLowerCase(), JSON.stringify(account));
      }
    }
    db.exec('PRAGMA user_version = 1; COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actualBuf = Buffer.from(hashPassword(password, salt), 'hex');
  const expectedBuf = Buffer.from(expectedHash, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

function sanitizeAccountForClient(acc: ServerPlayerAccount) {
  const { passwordHash: _ph, passwordSalt: _ps, ...safeProfile } = acc;
  return safeProfile;
}

migrateLegacyAccounts();

// --- Server-Authoritative Economy, Seasons, Weather & Multi-User State ---
let marketState: Record<CommodityId, CommodityMarketState> = {} as Record<CommodityId, CommodityMarketState>;

const TICKS_PER_SEASON = 16;
let tickCounter = 1;
let worldDayNumber = 14;
const SEASON_ORDER: SeasonId[] = ['wiosna', 'lato', 'jesien', 'zima'];
let activeSeasonIndex = 1; // Starts in Lato
const WEATHER_ORDER: WeatherConditionId[] = [
  'sloneczna_pogoda',
  'wiatr_handlowy',
  'ulewne_deszcze',
  'sztorm_na_zatoce',
  'zamiec_i_mroz',
];
let activeWeatherIndex = 0;
let activeDisaster: ActiveWorldDisaster | null = null;

const TARGET_MONEY_SUPPLY = 1_200_000;
let currentMoneySupply = 1_265_000;
let totalGoldBurned = 48_920;
let totalGoldMinted = 113_920;

interface WorldEventDef {
  title: string;
  effect: string;
  multipliers: Partial<Record<CommodityId, number>>;
}

const WORLD_EVENTS: WorldEventDef[] = [
  {
    title: 'Przebudzenie Smoka w Górach Bazaltowych',
    effect: 'Podaż Mithrilu i Żelaza spada (-25%), popyt na Smoczą Łuskę rośnie (+30%).',
    multipliers: { mithril: 1.24, zelazo: 1.15, smocza_luska: 1.30 },
  },
  {
    title: 'Wielki Jarmark Królewskiej Przystani',
    effect: 'Miasta wystawiają dodatkowe nadwyżki Zboża i Przypraw dla kupców.',
    multipliers: { zboze: 0.92, przyprawy: 0.94 },
  },
  {
    title: 'Bunt Rebeliantów na Szlaku Bursztynowym',
    effect: 'Zuchwali maruderzy utrudniają dostawy Drewna Elfickiego i Przypraw (+18%). Wyślij Rycerza!',
    multipliers: { przyprawy: 1.18, drewno_elfickie: 1.16 },
  },
  {
    title: 'Konwent Magów w Srebrnym Gaju',
    effect: 'Wzrost zapotrzebowania na Kryształy Many (+25%) oraz Runiczne Pergaminy (+20%).',
    multipliers: { krysztaly_many: 1.25, runiczny_pergamin: 1.20 },
  },
  {
    title: 'Obfite Żniwa w Dolinie Królewskiej',
    effect: 'Spichlerze miejskie pełne świeżego Zboża obniżają ceny żywności (-18%).',
    multipliers: { zboze: 0.82 },
  },
];

let activeEventIndex = 0;

// --- P2P Player & City Surplus Exchange Offers ---
let exchangeOffers: PlayerExchangeOffer[] = [
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
  {
    id: 'off_p2p_2',
    sellerUid: 'npc_kowal_thorgar',
    sellerName: 'Kowal Thorgar',
    sellerGuild: '[SMOK]',
    isCitySurplus: false,
    cityId: 'zelazna_kuznia',
    cityName: 'Żelazna Kuźnia',
    commodityId: 'mithril',
    quantity: 12,
    pricePerUnit: 545.0,
    createdAt: '12:26',
  },
  {
    id: 'off_city_3',
    sellerUid: 'city_zlota_zatoka',
    sellerName: 'Kapitanat Portu: Złota Zatoka',
    sellerGuild: '[MIASTO]',
    isCitySurplus: true,
    cityId: 'zlota_zatoka',
    cityName: 'Złota Zatoka',
    commodityId: 'przyprawy',
    quantity: 50,
    pricePerUnit: 122.0,
    createdAt: '12:29',
  },
];

function computeTechnicalIndicators(history: OHLCBar[], currentPrice: number) {
  const closes = history.slice(-14).map((b) => b.close);
  if (closes.length < 2) {
    return {
      vwap: currentPrice,
      rsi14: 50,
      bollingerUpper: Number((currentPrice * 1.04).toFixed(2)),
      bollingerLower: Number((currentPrice * 0.96).toFixed(2)),
    };
  }

  let gains = 0;
  let losses = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / closes.length;
  const avgLoss = losses / closes.length;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = Number((100 - 100 / (1 + rs)).toFixed(1));

  let volSum = 0;
  let pvSum = 0;
  const recent = history.slice(-20);
  for (const bar of recent) {
    const typical = (bar.high + bar.low + bar.close) / 3;
    pvSum += typical * bar.volume;
    volSum += bar.volume;
  }
  const vwap = Number((volSum > 0 ? pvSum / volSum : currentPrice).toFixed(2));

  const mean = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / closes.length;
  const stdDev = Math.max(currentPrice * 0.012, Math.sqrt(variance));

  return {
    vwap,
    rsi14,
    bollingerUpper: Number((mean + 2 * stdDev).toFixed(2)),
    bollingerLower: Number(Math.max(1, mean - 2 * stdDev).toFixed(2)),
  };
}

function getSeasonalTrendLabel(commId: CommodityId, seasonId: SeasonId): string {
  const s = SEASONS[seasonId];
  const mult = s.priceMultipliers[commId] ?? 1.0;
  if (mult <= 0.92) return `Nadwyżka sezonowa (${s.name.split(' ')[0]})`;
  if (mult >= 1.12) return `Niedobór sezonowy (${s.name.split(' ')[0]})`;
  return 'Równowaga sezonowa';
}

function initializeMarkets() {
  const now = Date.now();
  const currentSeason = SEASON_ORDER[activeSeasonIndex];
  for (const spec of COMMODITIES) {
    const history: OHLCBar[] = [];
    let price = spec.basePrice;
    const inv = spec.targetInventory;

    for (let i = 32; i >= 1; i--) {
      const wave = Math.sin(i * 0.45 + spec.basePrice) * spec.baseVolatility * 1.3;
      const open = price;
      const close = Number(Math.max(spec.basePrice * 0.4, open * (1 + wave)).toFixed(2));
      const high = Number((Math.max(open, close) * (1 + spec.baseVolatility * 0.85)).toFixed(2));
      const low = Number((Math.min(open, close) * (1 - spec.baseVolatility * 0.85)).toFixed(2));
      const volume = Math.round(spec.targetInventory * (0.06 + Math.abs(wave) * 1.5));
      history.push({
        time: now - i * 60_000,
        open,
        high,
        low,
        close,
        volume,
      });
      price = close;
    }

    const indicators = computeTechnicalIndicators(history, price);
    const ob = generateOrderBook(price, inv, spec.targetInventory, spec.baseVolatility, 0);
    const firstOpen = history[0]?.open ?? spec.basePrice;

    const citySurplusStock: Record<string, number> = {};
    for (const city of CITIES) {
      citySurplusStock[city.id] =
        city.specialty === spec.id
          ? Math.round(spec.targetInventory * 0.14)
          : Math.round(spec.targetInventory * 0.03);
    }

    marketState[spec.id] = {
      id: spec.id,
      currentPrice: price,
      previousPrice: history[history.length - 2]?.close ?? spec.basePrice,
      change24hPct: Number((((price - firstOpen) / firstOpen) * 100).toFixed(2)),
      inventory: inv,
      targetInventory: spec.targetInventory,
      volume24h: history.reduce((acc, b) => acc + b.volume, 0),
      netOrderFlow: 0,
      vwap: indicators.vwap,
      rsi14: indicators.rsi14,
      bollingerUpper: indicators.bollingerUpper,
      bollingerLower: indicators.bollingerLower,
      bidPrice: ob.bidPrice,
      askPrice: ob.askPrice,
      spreadPct: ob.spreadPct,
      seasonalTrendLabel: getSeasonalTrendLabel(spec.id, currentSeason),
      cityPrices: calculateRegionalCityPrices(spec.id, price, 1, currentSeason),
      citySurplusStock,
      history,
      orderBook: { bids: ob.bids, asks: ob.asks },
    };
  }
}

initializeMarkets();

function getMacroState(): MacroEconomyState {
  const priceMap = Object.fromEntries(
    COMMODITIES.map((c) => [c.id, marketState[c.id].currentPrice]),
  ) as Record<CommodityId, number>;

  const indicators = calculateMacroIndicators(priceMap, currentMoneySupply, TARGET_MONEY_SUPPLY);
  const ev = WORLD_EVENTS[activeEventIndex];
  const seasonObj = SEASONS[SEASON_ORDER[activeSeasonIndex]];
  const weatherObj = WEATHER_CONDITIONS[WEATHER_ORDER[activeWeatherIndex]];
  const ticksInSeason = tickCounter % TICKS_PER_SEASON;
  const seasonDayProgress = Number((ticksInSeason / TICKS_PER_SEASON).toFixed(3));
  const daysUntilNextSeason = Math.max(1, Math.ceil((TICKS_PER_SEASON - ticksInSeason) / 4));
  const combinedCaravanSpeed = Number(
    (
      seasonObj.caravanSpeedMultiplier *
      (activeDisaster ? activeDisaster.caravanSpeedMultiplier : 1.0)
    ).toFixed(2),
  );
  const seasonalAvailabilityIndex = Math.round(
    seasonObj.availabilityMultiplier *
      (activeDisaster ? activeDisaster.supplyShockMultiplier : 1.0) *
      100,
  );

  return {
    moneySupplyM: Math.round(currentMoneySupply),
    targetMoneySupplyMStar: TARGET_MONEY_SUPPLY,
    velocityV: Number((1.42 + (indicators.cpiIndex - 100) * 0.008).toFixed(2)),
    cpiIndex: indicators.cpiIndex,
    inflationRatePct: indicators.inflationRatePct,
    dynamicTaxRatePct: indicators.dynamicTaxRatePct,
    royalMintBondYieldPct: indicators.royalMintBondYieldPct,
    totalGoldBurned: Math.round(totalGoldBurned),
    totalGoldMinted: Math.round(totalGoldMinted),
    storageDemurrageRate: 0.18,
    activeSeason: seasonObj.id,
    activeSeasonName: seasonObj.name,
    activeSeasonDesc: seasonObj.description,
    nextSeason: seasonObj.nextSeason,
    seasonDayProgress,
    daysUntilNextSeason,
    caravanSpeedMultiplier: combinedCaravanSpeed,
    seasonalAvailabilityIndex,
    activeWeather: weatherObj.id,
    activeWeatherName: weatherObj.name,
    activeWeatherEffect: weatherObj.effectSummary,
    worldDayNumber,
    activeEventTitle: ev.title,
    activeEventEffect: ev.effect,
    activeEventMultiplier: ev.multipliers,
    activeDisaster,
  };
}

// --- Authoritative Auctions ---
let auctions: AuctionItem[] = [
  {
    id: 'auc_1',
    sellerName: 'Baron Vonelor',
    sellerGuild: '[ZŁOTO]',
    itemName: 'Partia Czystego Mithrilu z Żelaznej Kuźni',
    commodityId: 'mithril',
    quantity: 15,
    rarity: 'Epicki',
    auctionType: 'english',
    startPrice: 7800,
    currentBid: 8450,
    buyoutPrice: 10500,
    highestBidder: 'Kupiec_Aldor',
    bidsCount: 6,
    expiresAt: Date.now() + 1000 * 60 * 18,
  },
  {
    id: 'auc_2',
    sellerName: 'Arcymag Elandor',
    sellerGuild: '[RUNA]',
    itemName: 'Królewska Skrzynia Kryształów Many',
    commodityId: 'krysztaly_many',
    quantity: 25,
    rarity: 'Rzadki',
    auctionType: 'english',
    startPrice: 7500,
    currentBid: 8100,
    buyoutPrice: 9800,
    highestBidder: 'Gildia_Srebra',
    bidsCount: 4,
    expiresAt: Date.now() + 1000 * 60 * 12,
  },
  {
    id: 'auc_3',
    sellerName: 'Wódz Garrok',
    sellerGuild: '[SMOK]',
    itemName: 'Pradawne Smocze Łuski z Krwawego Szczytu',
    commodityId: 'smocza_luska',
    quantity: 8,
    rarity: 'Legendarny',
    auctionType: 'dutch',
    startPrice: 11200,
    currentBid: 8900,
    buyoutPrice: 8900,
    highestBidder: 'Aukcja Holenderska (Zegar)',
    bidsCount: 1,
    expiresAt: Date.now() + 1000 * 60 * 25,
  },
  {
    id: 'auc_4',
    sellerName: 'Kapitan Vane',
    sellerGuild: '[FLOTA]',
    itemName: 'Kontyngent Przypraw Wschodnich ze Złotej Zatoki',
    commodityId: 'przyprawy',
    quantity: 45,
    rarity: 'Pospolity',
    auctionType: 'english',
    startPrice: 5200,
    currentBid: 5650,
    buyoutPrice: 6800,
    highestBidder: 'Lady_Miriam',
    bidsCount: 5,
    expiresAt: Date.now() + 1000 * 60 * 9,
  },
];

// --- Authoritative Multi-Channel Chat ---
let chatMessages: ChatMessage[] = [
  {
    id: 'msg_1',
    channel: 'globalny',
    sender: 'Mistrz_Kildor',
    senderTitle: 'Wielki Syndyk',
    guildTag: '[ZŁOTO]',
    text: 'Królewska Przystań wystawiła świeżą nadwyżkę Zboża po żniwach! A mój Rycerz właśnie rozbił obóz Rebeliantów pod mostem.',
    timestamp: '12:28',
  },
  {
    id: 'msg_2',
    channel: 'handel',
    sender: 'Kowal_Thorgar',
    senderTitle: 'Mistrz Kuźni',
    guildTag: '[SMOK]',
    text: 'Wystawiłem na tablicy giełdowej 12 sztab czystego Mithrilu po 545 zł. Kto pierwszy, ten lepszy!',
    timestamp: '12:30',
  },
  {
    id: 'msg_3',
    channel: 'gildia',
    sender: 'Lady_Miriam',
    senderTitle: 'Skarbnik Gildii',
    guildTag: '[ZŁOTO]',
    text: 'Skarbiec Gildii wypłacił zniżkę opłat targowych -18% dla naszych członków.',
    timestamp: '12:31',
  },
];

// --- Authoritative Guilds ---
let guilds: GuildInfo[] = [
  {
    id: 'g_zloto',
    name: 'Hanza Złotego Gryfa',
    tag: 'ZŁOTO',
    level: 14,
    membersCount: 48,
    treasuryGold: 428_500,
    specialty: 'Handel Giełdowy, Szlaki Kupieckie & Mennica',
    taxRebatePct: 18,
    leader: 'Mistrz_Kildor',
  },
  {
    id: 'g_runa',
    name: 'Syndykat Srebrnej Runy',
    tag: 'RUNA',
    level: 12,
    membersCount: 39,
    treasuryGold: 315_200,
    specialty: 'Kryształy Many, Pergaminy & Magia Bitewna',
    taxRebatePct: 15,
    leader: 'Arcymag Elandor',
  },
  {
    id: 'g_smok',
    name: 'Zakon Pogromców z Kuźni',
    tag: 'SMOK',
    level: 11,
    membersCount: 34,
    treasuryGold: 289_000,
    specialty: 'Wyprawy Rycerskie na Rebeliantów i Miejsca Strachu',
    taxRebatePct: 12,
    leader: 'Wódz Garrok',
  },
];

// A single process owns the shared world. Commit each finished market update
// or chat message before connected players see it.
db.exec('CREATE TABLE IF NOT EXISTS world (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot TEXT NOT NULL)');
const writeWorld = db.prepare('INSERT OR REPLACE INTO world(id, snapshot) VALUES (1, ?)');
function worldSnapshot() {
  return {
    marketState, exchangeOffers, auctions, chatMessages, guilds,
    tickCounter, worldDayNumber, activeSeasonIndex, activeWeatherIndex,
    activeEventIndex, activeDisaster, currentMoneySupply, totalGoldBurned, totalGoldMinted,
  };
}
const existingWorld = db.prepare('SELECT snapshot FROM world WHERE id = 1').get();
if (existingWorld) {
  ({
    marketState, exchangeOffers, auctions, chatMessages, guilds,
    tickCounter, worldDayNumber, activeSeasonIndex, activeWeatherIndex,
    activeEventIndex, activeDisaster, currentMoneySupply, totalGoldBurned, totalGoldMinted,
  } = JSON.parse(String(existingWorld.snapshot)) as ReturnType<typeof worldSnapshot>);
} else {
  writeWorld.run(JSON.stringify(worldSnapshot()));
}

function getAuthenticatedAccount(req: express.Request): ServerPlayerAccount | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  const usernameKey = activeSessions.get(token);
  if (!usernameKey) return null;
  return readAccount(usernameKey);
}

async function startServer() {
  const app = express();
  const pagesOrigin = 'https://rdemb.github.io';
  app.use('/api', (req, res, next) => {
    res.vary('Origin');
    if (req.get('Origin') === pagesOrigin) {
      res.set('Access-Control-Allow-Origin', pagesOrigin);
      if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.set('Access-Control-Max-Age', '600');
        res.sendStatus(204);
        return;
      }
    }
    next();
  });
  app.use(express.json());

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function broadcast(type: string, payload: unknown) {
    if (type === 'market:update' || type === 'chat:new') {
      writeWorld.run(JSON.stringify(worldSnapshot()));
    }
    const raw = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    });
  }

  function advanceEconomyTick(customShock?: {
    commodityId?: CommodityId;
    orderFlowDelta?: number;
    inventoryDelta?: number;
    moneySupplyDelta?: number;
    eventIndex?: number;
  }) {
    tickCounter++;

    if (tickCounter % 4 === 0) {
      worldDayNumber++;
    }

    // Rotate Season every 16 ticks (simulating real seasonal progression)
    if (tickCounter % 16 === 0) {
      activeSeasonIndex = (activeSeasonIndex + 1) % SEASON_ORDER.length;
      const newSeason = SEASONS[SEASON_ORDER[activeSeasonIndex]];

      // Pick weather realistic for season
      if (newSeason.id === 'zima') {
        activeWeatherIndex = 4; // zamiec_i_mroz
      } else if (newSeason.id === 'jesien') {
        activeWeatherIndex = 2; // ulewne_deszcze
      } else if (newSeason.id === 'wiosna') {
        activeWeatherIndex = 1; // wiatr_handlowy
      } else {
        activeWeatherIndex = 0; // sloneczna_pogoda
      }

      // Cities post fresh seasonal surplus offers onto the P2P Exchange Board!
      const randomCity = CITIES[tickCounter % CITIES.length];
      const commSpec = COMMODITIES.find((c) => c.id === randomCity.specialty) ?? COMMODITIES[0];
      const currentSt = marketState[commSpec.id];
      const discountedPrice = Number(((currentSt?.currentPrice ?? commSpec.basePrice) * 0.86).toFixed(1));
      const surplusQty = Math.round(25 + (commSpec.targetInventory * 0.015));

      const cityOffer: PlayerExchangeOffer = {
        id: `off_city_${Date.now()}`,
        sellerUid: `city_${randomCity.id}`,
        sellerName: `Magistrat Miejski: ${randomCity.name}`,
        sellerGuild: '[NADWYŻKA MIASTA]',
        isCitySurplus: true,
        cityId: randomCity.id,
        cityName: randomCity.name,
        commodityId: commSpec.id,
        quantity: surplusQty,
        pricePerUnit: discountedPrice,
        createdAt: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      };

      exchangeOffers.unshift(cityOffer);
      if (exchangeOffers.length > 14) exchangeOffers.pop();

      broadcast('notification:push', {
        id: `season_${Date.now()}`,
        title: `Nadeszła Pora Roku: ${newSeason.name}`,
        body: `${newSeason.description} Miasto ${randomCity.name} wystawiło ${surplusQty} szt. (${commSpec.name}) po ${discountedPrice} zł!`,
        category: 'event',
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    } else if (tickCounter % 9 === 0) {
      activeWeatherIndex = (activeWeatherIndex + 1) % WEATHER_ORDER.length;
    }

    if (customShock?.eventIndex !== undefined) {
      activeEventIndex = customShock.eventIndex % WORLD_EVENTS.length;
    } else if (tickCounter % 22 === 0) {
      activeEventIndex = (activeEventIndex + 1) % WORLD_EVENTS.length;
      const ev = WORLD_EVENTS[activeEventIndex];
      broadcast('notification:push', {
        id: `ev_${Date.now()}`,
        title: `Wieści z Księstwa: ${ev.title}`,
        body: ev.effect,
        category: 'event',
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }

    if (customShock?.moneySupplyDelta) {
      currentMoneySupply = Math.max(400_000, currentMoneySupply + customShock.moneySupplyDelta);
      if (customShock.moneySupplyDelta < 0) {
        totalGoldBurned += Math.abs(customShock.moneySupplyDelta);
      } else {
        totalGoldMinted += customShock.moneySupplyDelta;
      }
    }

    // Tick down or randomly trigger seasonal World Disasters
    if (activeDisaster) {
      if (activeDisaster.remainingTicks <= 1) {
        const clearedName = activeDisaster.shortLabel;
        activeDisaster = null;
        broadcast('notification:push', {
          id: `dis_end_${Date.now()}`,
          title: `Katastrofa Ustała: ${clearedName}`,
          body: 'Szlaki handlowe wracają do normy, a podaż towarów zaczyna się odbudowywać.',
          category: 'event',
          timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      } else {
        activeDisaster = {
          ...activeDisaster,
          remainingTicks: activeDisaster.remainingTicks - 1,
        };
      }
    } else if (tickCounter % 26 === 0) {
      activeDisaster = pickRandomDisaster(SEASON_ORDER[activeSeasonIndex], worldDayNumber, tickCounter * 17);
      broadcast('notification:push', {
        id: `dis_new_${Date.now()}`,
        title: `KATASTROFA ŚWIATA: ${activeDisaster.shortLabel}!`,
        body: `${activeDisaster.economicImpactSummary}. Otwórz raport kryzysowy, aby zareagować!`,
        category: 'event',
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }

    const activeEvent = WORLD_EVENTS[activeEventIndex];
    const currentSeasonId = SEASON_ORDER[activeSeasonIndex];
    const currentSeason = SEASONS[currentSeasonId];
    const currentWeather = WEATHER_CONDITIONS[WEATHER_ORDER[activeWeatherIndex]];

    for (const spec of COMMODITIES) {
      const st = marketState[spec.id];
      const isTargeted = customShock?.commodityId === spec.id;

      // Seasonal production, commodity availability & disaster supply shock
      let seasonalProdFactor = currentSeason.availabilityByCommodity[spec.id] ?? currentSeason.availabilityMultiplier;
      if (spec.id === 'zboze' || spec.id === 'przyprawy') {
        seasonalProdFactor = (seasonalProdFactor + currentSeason.harvestMultiplier) * 0.5;
      } else if (spec.id === 'zelazo' || spec.id === 'mithril') {
        seasonalProdFactor = (seasonalProdFactor + currentSeason.miningMultiplier) * 0.5;
      } else if (spec.id === 'drewno_elfickie' || spec.id === 'runiczny_pergamin') {
        seasonalProdFactor = (seasonalProdFactor + currentSeason.timberMultiplier) * 0.5;
      }
      if (activeDisaster) {
        seasonalProdFactor *= activeDisaster.supplyShockMultiplier;
      }

      const seasonalTarget = Math.round(spec.targetInventory * seasonalProdFactor);
      const naturalReplenishment = (seasonalTarget - st.inventory) * 0.085;
      const flowShock = isTargeted && customShock?.orderFlowDelta ? customShock.orderFlowDelta : 0;
      const invShock = isTargeted && customShock?.inventoryDelta ? customShock.inventoryDelta : 0;

      const organicFlow = Math.round(Math.sin(tickCounter * 0.4 + spec.basePrice) * (spec.targetInventory * 0.012));
      const totalNetOrderFlow = st.netOrderFlow * 0.35 + organicFlow + flowShock;

      const nextInventory = Math.max(
        Math.round(spec.targetInventory * 0.15),
        Math.min(
          Math.round(spec.targetInventory * 3.0),
          Math.round(st.inventory + naturalReplenishment - totalNetOrderFlow * 0.45 + invShock),
        ),
      );

      const eventMult = activeEvent.multipliers[spec.id] ?? 1.0;
      const seasonPriceMult = currentSeason.priceMultipliers[spec.id] ?? 1.0;
      const weatherPriceMult = currentWeather.priceImpact[spec.id] ?? 1.0;
      const disasterPriceMult = getDisasterPriceMultiplier(activeDisaster, spec.id);
      const combinedWorldMultiplier = Number(
        (eventMult * seasonPriceMult * weatherPriceMult * disasterPriceMult).toFixed(3),
      );

      const microWave = Math.cos(tickCounter * 0.65 + spec.targetInventory) * spec.baseVolatility * 0.35;

      const nextPrice = stepDynamicCommodityPrice({
        currentPrice: st.currentPrice,
        basePrice: spec.basePrice,
        currentInventory: nextInventory,
        targetInventory: spec.targetInventory,
        gamma: spec.elasticityGamma,
        kyleLambda: spec.kyleLambda,
        theta: spec.meanReversionTheta,
        netOrderFlow: totalNetOrderFlow,
        averageVolume: Math.max(40, spec.targetInventory * 0.08),
        eventMultiplier: combinedWorldMultiplier,
        noiseShock: microWave,
      });

      const tradeVol = Math.max(10, Math.round(Math.abs(totalNetOrderFlow) + spec.targetInventory * 0.025));
      const prevClose = st.currentPrice;
      const high = Number((Math.max(prevClose, nextPrice) * (1 + spec.baseVolatility * 0.4)).toFixed(2));
      const low = Number((Math.min(prevClose, nextPrice) * (1 - spec.baseVolatility * 0.4)).toFixed(2));

      const newBar: OHLCBar = {
        time: Date.now(),
        open: prevClose,
        high,
        low,
        close: nextPrice,
        volume: tradeVol,
      };

      const nextHistory = [...st.history.slice(-47), newBar];
      const indicators = computeTechnicalIndicators(nextHistory, nextPrice);
      const ob = generateOrderBook(nextPrice, nextInventory, spec.targetInventory, spec.baseVolatility, 0);
      const firstOpen = nextHistory[0]?.open ?? spec.basePrice;

      const macroNow = getMacroState();
      const organicBurn = tradeVol * nextPrice * (macroNow.dynamicTaxRatePct / 100) * 0.025;
      currentMoneySupply = Math.max(850_000, currentMoneySupply - organicBurn);
      totalGoldBurned += organicBurn;

      // Update city surplus stock based on season
      const updatedSurplus = { ...st.citySurplusStock };
      for (const city of CITIES) {
        if (city.specialty === spec.id) {
          updatedSurplus[city.id] = Math.max(
            10,
            Math.round(spec.targetInventory * 0.12 * seasonalProdFactor),
          );
        }
      }

      marketState[spec.id] = {
        ...st,
        previousPrice: prevClose,
        currentPrice: nextPrice,
        change24hPct: Number((((nextPrice - firstOpen) / firstOpen) * 100).toFixed(2)),
        inventory: nextInventory,
        volume24h: nextHistory.reduce((acc, b) => acc + b.volume, 0),
        netOrderFlow: Math.round(totalNetOrderFlow),
        vwap: indicators.vwap,
        rsi14: indicators.rsi14,
        bollingerUpper: indicators.bollingerUpper,
        bollingerLower: indicators.bollingerLower,
        bidPrice: ob.bidPrice,
        askPrice: ob.askPrice,
        spreadPct: ob.spreadPct,
        seasonalTrendLabel: getSeasonalTrendLabel(spec.id, currentSeasonId),
        cityPrices: calculateRegionalCityPrices(spec.id, nextPrice, tickCounter, currentSeasonId),
        citySurplusStock: updatedSurplus,
        history: nextHistory,
        orderBook: { bids: ob.bids, asks: ob.asks },
      };
    }

    for (const auc of auctions) {
      if (auc.auctionType === 'dutch' && auc.currentBid > auc.startPrice * 0.55) {
        auc.currentBid = Math.round(auc.currentBid * 0.985);
        auc.buyoutPrice = auc.currentBid;
      }
    }

    broadcast('market:update', {
      markets: marketState,
      macro: getMacroState(),
      auctions,
      exchangeOffers,
    });
  }

  setInterval(() => {
    advanceEconomyTick();
    mill.advanceTowns();
    db.exec('BEGIN IMMEDIATE');
    try { bridge.advance(Date.now()); db.exec('COMMIT'); }
    catch(e) { db.exec('ROLLBACK'); throw e; }
  }, 4500);

  // --- AUTHENTICATION & PLAYER PROFILE BACKEND ROUTES ---
  app.post('/api/auth/register', (req, res) => {
    const { username, password, displayName, raceId, title } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      raceId?: string;
      title?: string;
    };

    const cleanUser = String(username || '').trim().toLowerCase();
    if (!cleanUser || cleanUser.length < 3 || cleanUser.length > 32 || !/^[a-z0-9_-]+$/.test(cleanUser)) {
      res.status(400).json({ error: 'Login musi mieć 3-32 znaki (litery, cyfry, _, -).' });
      return;
    }
    if (!password || String(password).length < 6) {
      res.status(400).json({ error: 'Hasło musi zawierać minimum 6 znaków.' });
      return;
    }
    if (readAccount(cleanUser)) {
      res.status(409).json({ error: 'Konto o tym loginie już istnieje. Zaloguj się.' });
      return;
    }

    const validRace = RACES.find((r) => r.id === raceId) ?? RACES[0];
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(String(password), salt);
    const uid = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const newAccount: ServerPlayerAccount = {
      uid,
      username: cleanUser,
      passwordHash,
      passwordSalt: salt,
      displayName: String(displayName || cleanUser).trim().slice(0, 50),
      title: String(title || 'Kupiec i Dowódca').trim().slice(0, 50),
      raceId: validRace.id,
      guildId: '',
      gold: validRace.startingCapital,
      bondsGold: 0,
      netWorth: validRace.startingCapital + 11500,
      tradesExecutedCount: 0,
      profitableTradesCount: 0,
      inventory: {
        zboze: 35,
        zelazo: 20,
        drewno_elfickie: 12,
        przyprawy: 10,
        runiczny_pergamin: 6,
        krysztaly_many: 5,
        mithril: 4,
        smocza_luska: 1,
      },
      unlockedTechIds: ['handel_1'],
      knight: createInitialKnightState(validRace.id),
      duchy: createInitialDuchyState(validRace.id),
      tradeHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    insertPlayer.run(cleanUser, JSON.stringify(newAccount));

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, cleanUser);
    openWallet(token, newAccount);

    res.status(201).json({
      token,
      profile: sanitizeAccountForClient(newAccount),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const cleanUser = String(username || '').trim().toLowerCase();
    const acc = readAccount(cleanUser);

    if (!acc || !password || !verifyPassword(String(password), acc.passwordSalt, acc.passwordHash)) {
      res.status(401).json({ error: 'Nieprawidłowy login lub hasło kupieckie.' });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, cleanUser);
    openWallet(token, acc);

    res.json({
      token,
      profile: sanitizeAccountForClient(acc),
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const acc = getAuthenticatedAccount(req);
    if (!acc) {
      res.status(401).json({ error: 'Sesja wygasła lub brak autoryzacji.' });
      return;
    }
    res.json({ profile: sanitizeAccountForClient(acc) });
  });

  app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      activeSessions.delete(token);
      walletCursors.delete(token);
    }
    res.json({ success: true });
  });

  app.post('/api/profile/sync', (req, res) => {
    const acc = getAuthenticatedAccount(req);
    if (!acc) {
      res.status(401).json({ error: 'Brak autoryzacji Bearer token.' });
      return;
    }

    const {
      displayName,
      title,
      raceId,
      gold,
      bondsGold,
      netWorth,
      tradesExecutedCount,
      profitableTradesCount,
      inventory,
      unlockedTechIds,
      knight,
      duchy,
    } = req.body;

    if (typeof displayName === 'string' && displayName.trim().length >= 2) {
      acc.displayName = displayName.trim().slice(0, 50);
    }
    if (typeof title === 'string' && title.trim().length >= 2) {
      acc.title = title.trim().slice(0, 50);
    }
    if (typeof raceId === 'string' && RACES.some((r) => r.id === raceId)) {
      acc.raceId = raceId;
    }
    // Membership changes are handled by the guild register.
    const mark = acc.millMark ?? emptyMark;
    const entry = req.body.walletSave;
    const alignedMill = entry===undefined && (req.body.millRevision ?? 0) === mark.revision;
    let walletAdjustment:WalletCursor|undefined;
    let acceptedSave:WalletCursor|undefined;
    if(entry!==undefined){
      let cursor=walletCursors.get(req.headers.authorization!.slice(7).trim());
      if(!cursor || !entry || !Number.isSafeInteger(entry.sequence) || entry.sequence<1 ||
        !Number.isSafeInteger(Math.round(entry.gold*100)) || typeof entry.gold!=='number' || !Number.isSafeInteger(entry.grain)){
        res.status(400).json({error:'Niepoprawny zapis sakwy.'});return;
      }
      if(entry.sequence>cursor.sequence){
        const cash=Math.round((acc.gold+entry.gold-cursor.gold)*100)/100;
        const grain=acc.inventory.zboze+entry.grain-cursor.grain;
        if(cash>=0 && grain>=0){acc.gold=cash;acc.inventory.zboze=grain;}
        cursor=acceptedSave={sequence:entry.sequence,gold:entry.gold,grain:entry.grain};
      }
      walletAdjustment={sequence:cursor.sequence,gold:Math.round((acc.gold-mark.gold-cursor.gold)*100)/100,
        grain:acc.inventory.zboze-mark.grain-cursor.grain};
    }
    if (alignedMill && typeof gold === 'number' && Number.isFinite(gold) && gold >= 0) {
      acc.gold = Number(gold.toFixed(2));
    }
    if (typeof bondsGold === 'number' && Number.isFinite(bondsGold) && bondsGold >= 0) {
      acc.bondsGold = Number(bondsGold.toFixed(2));
    }
    if (typeof netWorth === 'number' && Number.isFinite(netWorth) && netWorth >= 0) {
      acc.netWorth = Math.round(netWorth);
    }
    if (typeof tradesExecutedCount === 'number' && tradesExecutedCount >= 0) {
      acc.tradesExecutedCount = Math.round(tradesExecutedCount);
    }
    if (typeof profitableTradesCount === 'number' && profitableTradesCount >= 0) {
      acc.profitableTradesCount = Math.round(profitableTradesCount);
    }
    if (inventory && typeof inventory === 'object') {
      for (const spec of COMMODITIES) {
        if (spec.id === 'zboze' && !alignedMill) continue;
        const val = Number(inventory[spec.id]);
        if (Number.isFinite(val) && val >= 0) {
          acc.inventory[spec.id] = Math.round(val);
        }
      }
    }
    if (Array.isArray(unlockedTechIds)) {
      acc.unlockedTechIds = unlockedTechIds.map((x) => String(x).slice(0, 40)).slice(0, 20);
    }
    if (knight && typeof knight === 'object') {
      acc.knight = {
        ...acc.knight,
        name: String(knight.name || acc.knight.name).slice(0, 50),
        title: String(knight.title || acc.knight.title).slice(0, 50),
        level: Math.max(1, Number(knight.level) || 1),
        xp: Math.max(0, Number(knight.xp) || 0),
        xpToNextLevel: Math.max(100, Number(knight.xpToNextLevel) || 150),
        hp: Math.max(0, Number(knight.hp) || 100),
        maxHp: Math.max(50, Number(knight.maxHp) || 160),
        strength: Math.max(5, Number(knight.strength) || 20),
        defense: Math.max(5, Number(knight.defense) || 15),
        tactics: Math.max(5, Number(knight.tactics) || 15),
        availableTurns: Math.max(0, Number(knight.availableTurns) ?? 6),
        maxTurns: Math.max(3, Number(knight.maxTurns) || 8),
        nextTurnRegenAt: Number(knight.nextTurnRegenAt) || Date.now() + 120_000,
        equippedIds: Array.isArray(knight.equippedIds) ? knight.equippedIds.slice(0, 10) : [],
        monstersDefeated: Math.max(0, Number(knight.monstersDefeated) || 0),
        totalLootGold: Math.max(0, Number(knight.totalLootGold) || 0),
        activeQuest: knight.activeQuest || null,
      };
    }
    if (duchy && typeof duchy === 'object') {
      acc.duchy = {
        ...acc.duchy,
        ...duchy,
      };
    }
    acc.updatedAt = new Date().toISOString();

    saveAccount(acc);
    if(acceptedSave)walletCursors.set(req.headers.authorization!.slice(7).trim(),acceptedSave);
    res.json({ profile: sanitizeAccountForClient(acc), walletAdjustment });
  });

  const insignia = installCourt(app, db, getAuthenticatedAccount, (uid, prefix) => broadcast('court:prefix', {uid, prefix}));

  const portCleared = installWeighhouse(app, db, getAuthenticatedAccount, () => broadcast('port:manifest', {}));
  const useHarborTeam = installHarborWorks(app, db, getAuthenticatedAccount);
  const guildTravelBonus = installMerchantInn(app, db, getAuthenticatedAccount, guilds);
  const mill = installMill(app,db,getAuthenticatedAccount,()=>WEATHER_ORDER[activeWeatherIndex]);
  mill.advanceTowns();
  const bridge = installBridge(app,db,getAuthenticatedAccount,()=>WEATHER_ORDER[activeWeatherIndex],mill.settleGold);
  installProvinces(app, db, getAuthenticatedAccount, portCleared, useHarborTeam, guildTravelBonus, mill.useRation, bridge);

  // Public State & Registered Leaderboard
  app.get('/api/state', (_req, res) => {
    const registeredPlayers = db.prepare('SELECT profile FROM players').all().map((row) => JSON.parse(String(row.profile)) as ServerPlayerAccount).map((acc) => ({
      uid: acc.uid,
      prefix: insignia(acc.uid).prefix,
      displayName: acc.displayName,
      title: acc.title,
      raceId: acc.raceId,
      guildId: acc.guildId,
      netWorth: acc.netWorth,
      knightLevel: acc.knight?.level ?? 1,
      monstersDefeated: acc.knight?.monstersDefeated ?? 0,
      tradesExecutedCount: acc.tradesExecutedCount,
      profitableTradesCount: acc.profitableTradesCount,
    }));

    res.json({
      markets: marketState,
      macro: getMacroState(),
      auctions,
      exchangeOffers,
      chatMessages: chatMessages.filter(m=>m.channel !== 'gildia'),
      guilds,
      registeredPlayers,
    });
  });

  // P2P Player & City Exchange Offers API
  app.post('/api/exchange/create', (req, res) => {
    const { sellerName, sellerGuild, cityId, commodityId, quantity, pricePerUnit } = req.body as {
      sellerName?: string;
      sellerGuild?: string;
      cityId: string;
      commodityId: CommodityId;
      quantity: number;
      pricePerUnit: number;
    };

    const st = marketState[commodityId];
    const cityObj = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
    if (!st || !quantity || quantity <= 0 || !pricePerUnit || pricePerUnit <= 0) {
      res.status(400).json({ error: 'Nieprawidłowe parametry oferty sprzedaży.' });
      return;
    }

    const acc = getAuthenticatedAccount(req);
    const offer: PlayerExchangeOffer = {
      id: `off_p2p_${Date.now()}`,
      sellerUid: acc?.uid ?? 'local_player',
      sellerName: acc?.displayName ?? sellerName ?? 'Kupiec',
      sellerGuild: sellerGuild ?? '[ZŁOTO]',
      isCitySurplus: false,
      cityId: cityObj.id,
      cityName: cityObj.name,
      commodityId,
      quantity: Math.round(quantity),
      pricePerUnit: Number(Number(pricePerUnit).toFixed(2)),
      createdAt: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    };

    exchangeOffers.unshift(offer);
    if (exchangeOffers.length > 18) exchangeOffers.pop();

    broadcast('market:update', {
      markets: marketState,
      macro: getMacroState(),
      auctions,
      exchangeOffers,
    });

    res.status(201).json({ success: true, offer, exchangeOffers });
  });

  app.post('/api/exchange/buy', (req, res) => {
    const { offerId } = req.body as { offerId: string };
    const idx = exchangeOffers.findIndex((o) => o.id === offerId);
    if (idx === -1) {
      res.status(404).json({ error: 'Oferta została już wykupiona przez innego gracza.' });
      return;
    }

    const offer = exchangeOffers[idx];
    exchangeOffers.splice(idx, 1);

    // Executing an offer on the exchange shifts supply/demand naturally
    advanceEconomyTick({
      commodityId: offer.commodityId,
      orderFlowDelta: offer.quantity * 1.8,
      inventoryDelta: -offer.quantity,
    });

    res.json({
      success: true,
      purchasedOffer: offer,
      exchangeOffers,
      markets: marketState,
      macro: getMacroState(),
    });
  });

  app.post('/api/trade', (req, res) => {
    const { commodityId, side, quantity, cityId } = req.body as {
      commodityId: CommodityId;
      side: 'buy' | 'sell';
      quantity: number;
      cityId?: string;
    };

    const st = marketState[commodityId];
    if (!st || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'Nieprawidłowe parametry zlecenia.' });
      return;
    }

    const signedFlow = side === 'buy' ? quantity : -quantity;
    const invDelta = side === 'buy' ? -quantity : quantity;

    const unitPrice =
      cityId && st.cityPrices[cityId]
        ? st.cityPrices[cityId]
        : side === 'buy'
          ? st.askPrice
          : st.bidPrice;

    const grossValue = unitPrice * quantity;
    const macro = getMacroState();
    const taxGold = Number((grossValue * (macro.dynamicTaxRatePct / 100)).toFixed(2));

    const acc = getAuthenticatedAccount(req);
    if (acc) {
      acc.tradeHistory.unshift({
        id: `tr_${Date.now()}`,
        commodityId,
        side,
        quantity,
        price: unitPrice,
        cityId: cityId || 'krolewska_przystan',
        timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
      acc.tradeHistory = acc.tradeHistory.slice(0, 30);
      saveAccount(acc);
    }

    advanceEconomyTick({
      commodityId,
      orderFlowDelta: signedFlow * 3.0,
      inventoryDelta: invDelta,
      moneySupplyDelta: -taxGold,
    });

    res.json({
      success: true,
      executedPrice: unitPrice,
      taxBurned: taxGold,
      updatedMarket: marketState[commodityId],
      macro: getMacroState(),
    });
  });

  // --- Dynamic 4-Season Transition & World Disaster Endpoints ---
  app.post('/api/world/season', (req, res) => {
    const { seasonId } = (req.body ?? {}) as { seasonId?: SeasonId };
    if (seasonId && SEASON_ORDER.includes(seasonId)) {
      activeSeasonIndex = SEASON_ORDER.indexOf(seasonId);
    } else {
      activeSeasonIndex = (activeSeasonIndex + 1) % SEASON_ORDER.length;
    }

    const newSeason = SEASONS[SEASON_ORDER[activeSeasonIndex]];
    if (newSeason.id === 'zima') activeWeatherIndex = 4;
    else if (newSeason.id === 'jesien') activeWeatherIndex = 2;
    else if (newSeason.id === 'wiosna') activeWeatherIndex = 1;
    else activeWeatherIndex = 0;

    worldDayNumber += 4;
    // Align tickCounter to start of new season so progress bar resets cleanly
    tickCounter = Math.ceil(tickCounter / TICKS_PER_SEASON) * TICKS_PER_SEASON + 1;

    // Post a fresh seasonal city surplus offer matching the new season
    const chosenCity = CITIES[worldDayNumber % CITIES.length];
    const commSpec = COMMODITIES.find((c) => c.id === chosenCity.specialty) ?? COMMODITIES[0];
    const currentSt = marketState[commSpec.id];
    const availFactor = newSeason.availabilityByCommodity[commSpec.id] ?? 1.0;
    const surplusQty = Math.max(12, Math.round(28 * availFactor));
    const discountedPrice = Number(
      ((currentSt?.currentPrice ?? commSpec.basePrice) * (newSeason.priceMultipliers[commSpec.id] ?? 1) * 0.88).toFixed(1),
    );
    exchangeOffers.unshift({
      id: `off_season_${Date.now()}`,
      sellerUid: `city_${chosenCity.id}`,
      sellerName: `Magistrat Sezonowy: ${chosenCity.name}`,
      sellerGuild: `[${newSeason.shortName.toUpperCase()}]`,
      isCitySurplus: true,
      cityId: chosenCity.id,
      cityName: chosenCity.name,
      commodityId: commSpec.id,
      quantity: surplusQty,
      pricePerUnit: discountedPrice,
      createdAt: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
    });
    if (exchangeOffers.length > 14) exchangeOffers.pop();

    advanceEconomyTick();

    res.json({
      success: true,
      macro: getMacroState(),
      markets: marketState,
      exchangeOffers,
    });
  });

  app.post('/api/world/disaster/trigger', (req, res) => {
    const { seed } = (req.body ?? {}) as { disasterId?: DisasterId; seed?: number };
    const currentSeasonId = SEASON_ORDER[activeSeasonIndex];
    activeDisaster = pickRandomDisaster(currentSeasonId, worldDayNumber, seed ?? Date.now());

    advanceEconomyTick();

    res.json({
      success: true,
      disaster: activeDisaster,
      macro: getMacroState(),
      markets: marketState,
    });
  });

  app.post('/api/world/disaster/clear', (req, res) => {
    const { nextDisaster } = (req.body ?? {}) as { nextDisaster?: ActiveWorldDisaster | null };
    activeDisaster = nextDisaster ?? null;

    broadcast('market:update', {
      markets: marketState,
      macro: getMacroState(),
      auctions,
      exchangeOffers,
    });

    res.json({
      success: true,
      macro: getMacroState(),
    });
  });

  // WebSocket Real-Time Event Handling
  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'init',
        payload: {
          markets: marketState,
          macro: getMacroState(),
          auctions,
          exchangeOffers,
          chatMessages: chatMessages.filter(m=>m.channel !== 'gildia'),
          guilds,
        },
      }),
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'chat:send') {
          const { id, channel, sender, senderTitle, guildTag, text } = msg.payload;
          if (channel !== undefined && channel !== 'globalny' && channel !== 'handel') return;
          if (!text || !String(text).trim()) return;
          if (chatMessages.some((m) => m.id === id)) return;

          const newMsg: ChatMessage = {
            id: id || `msg_${Date.now()}`,
            channel: channel || 'globalny',
            sender: sender || 'Kupiec',
            senderTitle: senderTitle || 'Kupiec Królewski',
            guildTag: guildTag || '[ZŁOTO]',
            text: String(text).trim().slice(0, 280),
            timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
          };
          chatMessages.push(newMsg);
          if (chatMessages.length > 60) chatMessages.shift();
          broadcast('chat:new', newMsg);
        } else if (msg.type === 'auction:bid') {
          const { auctionId, bidderName, bidAmount, isBuyout } = msg.payload;
          const auc = auctions.find((a) => a.id === auctionId);
          if (!auc) return;

          if (isBuyout || bidAmount >= auc.buyoutPrice) {
            const burnedFee = auc.buyoutPrice * 0.04;
            currentMoneySupply = Math.max(800_000, currentMoneySupply - burnedFee);
            totalGoldBurned += burnedFee;

            const idx = auctions.findIndex((a) => a.id === auctionId);
            if (idx !== -1) auctions.splice(idx, 1);

            broadcast('auction:sold', {
              auctionId,
              winner: bidderName,
              price: auc.buyoutPrice,
              itemName: auc.itemName,
              commodityId: auc.commodityId,
              quantity: auc.quantity,
            });
            broadcast('market:update', {
              markets: marketState,
              macro: getMacroState(),
              auctions,
              exchangeOffers,
            });
          } else if (bidAmount > auc.currentBid) {
            auc.currentBid = Math.round(bidAmount);
            auc.highestBidder = bidderName;
            auc.bidsCount += 1;
            if (auc.expiresAt - Date.now() < 30_000) {
              auc.expiresAt += 15_000;
            }
            broadcast('market:update', {
              markets: marketState,
              macro: getMacroState(),
              auctions,
              exchangeOffers,
            });
          }
        } else if (msg.type === 'auction:create') {
          const {
            id,
            sellerName,
            sellerGuild,
            itemName,
            commodityId,
            quantity,
            rarity,
            auctionType,
            startPrice,
            buyoutPrice,
          } = msg.payload;
          if (auctions.some((a) => a.id === id)) return;

          const newAuc: AuctionItem = {
            id: id || `auc_${Date.now()}`,
            sellerName: sellerName || 'Ty (Kupiec)',
            sellerGuild: sellerGuild || '[ZŁOTO]',
            itemName,
            commodityId,
            quantity: Number(quantity) || 10,
            rarity: rarity || 'Rzadki',
            auctionType: auctionType || 'english',
            startPrice: Number(startPrice) || 1000,
            currentBid: Number(startPrice) || 1000,
            buyoutPrice: Number(buyoutPrice) || 1500,
            highestBidder: 'Brak ofert',
            bidsCount: 0,
            expiresAt: Date.now() + 1000 * 60 * 20,
          };
          auctions.unshift(newAuc);
          broadcast('market:update', {
            markets: marketState,
            macro: getMacroState(),
            auctions,
            exchangeOffers,
          });
        } else if (msg.type === 'guild:donate') {
          const { guildId, amount } = msg.payload;
          const g = guilds.find((item) => item.id === guildId);
          if (g && amount > 0) {
            g.treasuryGold += Number(amount);
            const sink = Number(amount) * 0.35;
            currentMoneySupply = Math.max(800_000, currentMoneySupply - sink);
            totalGoldBurned += sink;
            broadcast('guilds:update', guilds);
            broadcast('market:update', {
              markets: marketState,
              macro: getMacroState(),
              auctions,
              exchangeOffers,
            });
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    const address = httpServer.address();
    if (address && typeof address === 'object') {
      console.log(`Kupiecki Swiat 3D Server running on http://${HOST}:${address.port}`);
    }
  });
}

startServer();
