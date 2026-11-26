import { imageUrl } from '../utils/imageUrl';
/**
 * Kupiecki Świat 3D: Odrodzenie — Multi-Species Dragon Breeding & Aviary Sanctuary Engine
 * Pure decoupled logic for incubating dragon eggs, raising dragons across 5 life stages,
 * feeding with real market commodities, cross-breeding rare elemental lines, and
 * dispatching dragons on aerial expeditions, caravan escorts, and disaster relief.
 */

import type { CommodityId } from './economyEngine';

export type DragonSpeciesId = 'ogien' | 'lod' | 'szmaragd' | 'zloto' | 'pseudosmok' | 'blekit' | 'brazowy' | 'dwuglowy' | 'dwuglowy_brazowy' | 'dwuglowy_czerwony' | 'blekitny_legendarny' | 'zloty_legendarny' | 'trzcinowy' | 'krzemienny';

export type DragonLifeStage = 1 | 2 | 3 | 4 | 5;

export interface DragonSpeciesSpec {
  id: DragonSpeciesId;
  name: string;
  elementLabel: string;
  originContinentName: string;
  artworkUrl: string;
  variant3D: 'crimson' | 'frost' | 'emerald' | 'gold' | 'copper' | 'sapphire' | 'umber' | 'twin' | 'ochreTwin' | 'redTwin' | 'deltaSail' | 'ochreCrown' | 'reedFrill' | 'flintShield';
  accentHex: string;
  favoriteCommodity: CommodityId;
  favoriteCommodityName: string;
  specialtySummary: string;
  baseFirePower: number;
  baseFlightSpeed: number;
  baseHoardGreed: number;
  eggCostGold: number;
}

export const DRAGON_SPECIES: Record<DragonSpeciesId, DragonSpeciesSpec> = {
  trzcinowy: {
    id:'trzcinowy',name:'Smok trzcinowy',elementLabel:'Ols i woda',originContinentName:'Olszyna Łusek',artworkUrl:imageUrl('smok-trzcinowy.webp'),
    variant3D:'reedFrill',accentHex:'#9bb46c',favoriteCommodity:'zboze',favoriteCommodityName:'Zboże',specialtySummary:'Lekki lot między trzcinami. Zwiad skarbca zużywa o 8 punktów energii mniej.',
    baseFirePower:12,baseFlightSpeed:31,baseHoardGreed:11,eggCostGold:2100,
  },
  krzemienny: {
    id:'krzemienny',name:'Smok krzemienny',elementLabel:'Kreda i krzemień',originContinentName:'Jar Krzemienia',artworkUrl:imageUrl('smok-krzemienny.webp'),
    variant3D:'flintShield',accentHex:'#bd976a',favoriteCommodity:'zelazo',favoriteCommodityName:'Żelazo',specialtySummary:'Wypatruje zrzuconych pancerzy w rumoszu. Z wyprawy na kalderę przynosi jedną dodatkową łuskę.',
    baseFirePower:30,baseFlightSpeed:12,baseHoardGreed:21,eggCostGold:2750,
  },
  blekitny_legendarny: {
    id:'blekitny_legendarny',name:'Legendarny błękitny smok',elementLabel:'Mgła i nurt',originContinentName:'Delta Perłowa',
    artworkUrl:imageUrl('legendarny-blekitny.webp'),variant3D:'deltaSail',accentHex:'#84bad9',favoriteCommodity:'krysztaly_many',favoriteCommodityName:'Kryształy Many',
    specialtySummary:'Płetwa grzbietowa pozwala szybować nad deltą. Eskorta powietrzna kosztuje 12 punktów energii mniej. Jajo wymaga dorosłego błękitnego smoka przypływu.',
    baseFirePower:28,baseFlightSpeed:35,baseHoardGreed:18,eggCostGold:4100,
  },
  zloty_legendarny: {
    id:'zloty_legendarny',name:'Legendarny złoty smok',elementLabel:'Ochra i słońce',originContinentName:'Wrota Płaskowyżu',
    artworkUrl:imageUrl('legendarny-zloty.webp'),variant3D:'ochreCrown',accentHex:'#dab665',favoriteCommodity:'mithril',favoriteCommodityName:'Mithril',
    specialtySummary:'Podczas zwiadu skarbca odnajduje dwa dodatkowe pergaminy. Jajo wymaga dorosłego złotego smoka skarbca.',
    baseFirePower:32,baseFlightSpeed:17,baseHoardGreed:35,eggCostGold:4600,
  },
  dwuglowy_brazowy: {
    id:'dwuglowy_brazowy',name:'Brązowy smok dwugłowy',elementLabel:'Kamień i sól',originContinentName:'Morze Wylin',
    artworkUrl:imageUrl('dwuglowy-brazowy.webp'),variant3D:'ochreTwin',accentHex:'#c5a683',favoriteCommodity:'zelazo',favoriteCommodityName:'Żelazo',
    specialtySummary:'Zbiera minerały odsłonięte odpływem. Przynosi księstwu dodatkowe 6 punktów premii do dochodu.',
    baseFirePower:30,baseFlightSpeed:13,baseHoardGreed:26,eggCostGold:3450,
  },
  dwuglowy_czerwony: {
    id:'dwuglowy_czerwony',name:'Czerwony smok dwugłowy',elementLabel:'Bazalt i gorąca para',originContinentName:'Morze Wylin',
    artworkUrl:imageUrl('dwuglowy-czerwony.webp'),variant3D:'redTwin',accentHex:'#d88a70',favoriteCommodity:'smocza_luska',favoriteCommodityName:'Smocza łuska',
    specialtySummary:'Patron rycerzy północnego szlaku. Dodaje 7 punktów do siły rycerza.',
    baseFirePower:35,baseFlightSpeed:19,baseHoardGreed:12,eggCostGold:3700,
  },
  brazowy: {
    id:'brazowy', name:'Brązowy smok klifowy', elementLabel:'Ziemia i urwiska', originContinentName:'Dalekie Wybrzeże Nowej Nadziei',
    artworkUrl:imageUrl('smok-klifowy.webp'),variant3D:'umber',accentHex:'#cd9566',favoriteCommodity:'mithril',favoriteCommodityName:'Sztaby Mithrilu',
    specialtySummary:'Krępy smok skalnych półek. Wyróżnia się siłą i odpornością podczas klęsk (+5 pkt odporności).',
    baseFirePower:32,baseFlightSpeed:14,baseHoardGreed:17,eggCostGold:3100,
  },
  dwuglowy: {
    id:'dwuglowy', name:'Dwugłowy zielony smok', elementLabel:'Bagna i szuwary', originContinentName:'Dalekie Wybrzeże Nowej Nadziei',
    artworkUrl:imageUrl('smok-dwuglowy.webp'),variant3D:'twin',accentHex:'#a4c484',favoriteCommodity:'zboze',favoriteCommodityName:'Zboże',
    specialtySummary:'Obie głowy wypatrują drogi po przeciwnych stronach konwoju. Pod eskortą karawana zyskuje 5 dodatkowych punktów prędkości.',
    baseFirePower:25,baseFlightSpeed:21,baseHoardGreed:19,eggCostGold:3250,
  },
  pseudosmok: {
    id: 'pseudosmok', name: 'Pseudosmok pokładowy', elementLabel: 'Wiatr przybrzeżny',
    originContinentName: 'Nowa Nadzieja', artworkUrl: imageUrl('pseudosmok.webp'), variant3D: 'copper',
    accentHex: '#e39d65', favoriteCommodity: 'zboze', favoriteCommodityName: 'Zboże',
    specialtySummary: 'Lekki zwiadowca. Podczas eskorty dodaje 4 punkty do premii prędkości karawan.',
    baseFirePower: 9, baseFlightSpeed: 32, baseHoardGreed: 11, eggCostGold: 1600,
  },
  blekit: {
    id: 'blekit', name: 'Błękitny smok przypływu', elementLabel: 'Woda i sztorm',
    originContinentName: 'Nowa Nadzieja', artworkUrl: imageUrl('blekit-przyplywu.webp'), variant3D: 'sapphire',
    accentHex: '#79b8d7', favoriteCommodity: 'krysztaly_many', favoriteCommodityName: 'Kryształy Many',
    specialtySummary: 'Wyczuwa zmianę ciśnienia. Zwiększa odporność na katastrofy o 8 punktów.',
    baseFirePower: 23, baseFlightSpeed: 25, baseHoardGreed: 18, eggCostGold: 3400,
  },
  ogien: {
    id: 'ogien',
    name: 'Smok Ognia Ignisa',
    elementLabel: 'Żywioł Magmy i Ognia',
    originContinentName: 'Archipelag Obsydianowy',
    artworkUrl: imageUrl('dragon_fire_ignis_1795672943919.jpg'),
    variant3D: 'crimson',
    accentHex: '#F97316',
    favoriteCommodity: 'smocza_luska',
    favoriteCommodityName: 'Smocza Łuska',
    specialtySummary: 'Potężna siła bitewna (+Siła Rycerza) i poskramianie erupcji oraz zamieci.',
    baseFirePower: 28,
    baseFlightSpeed: 18,
    baseHoardGreed: 16,
    eggCostGold: 2600,
  },
  lod: {
    id: 'lod',
    name: 'Smok Lodu Frostheimu',
    elementLabel: 'Żywioł Zorzy i Szronu',
    originContinentName: 'Frostheim (Północ)',
    artworkUrl: imageUrl('dragon_frost_vyrm_1795672944162.jpg'),
    variant3D: 'frost',
    accentHex: '#38BDF8',
    favoriteCommodity: 'mithril',
    favoriteCommodityName: 'Sztaby Mithrilu',
    specialtySummary: 'Odporność na zimowe zamiecie (+Prędkość karawan zimą) i wysoka obrona.',
    baseFirePower: 22,
    baseFlightSpeed: 24,
    baseHoardGreed: 18,
    eggCostGold: 2900,
  },
  szmaragd: {
    id: 'szmaragd',
    name: 'Szmaragdowy Smok Aetheris',
    elementLabel: 'Żywioł Wiatru i Many',
    originContinentName: 'Valoria & Aetheris',
    artworkUrl: imageUrl('dragon_emerald_aether_1795672945143.jpg'),
    variant3D: 'emerald',
    accentHex: '#10B981',
    favoriteCommodity: 'krysztaly_many',
    favoriteCommodityName: 'Kryształy Many',
    specialtySummary: 'Błyskawiczny lot (+Szybkość ekspedycji i karawan) oraz bonus do łupów runicznych.',
    baseFirePower: 20,
    baseFlightSpeed: 30,
    baseHoardGreed: 20,
    eggCostGold: 3100,
  },
  zloto: {
    id: 'zloto',
    name: 'Złoty Smok Skarbca',
    elementLabel: 'Żywioł Królewskiego Złota',
    originContinentName: 'Stary Kontynent & Solaria',
    artworkUrl: imageUrl('dragon_golden_hoard_1795672945636.jpg'),
    variant3D: 'gold',
    accentHex: '#FBBF24',
    favoriteCommodity: 'przyprawy',
    favoriteCommodityName: 'Przyprawy Wschodnie',
    specialtySummary: 'Magnetyzm bogactwa (+Dochód Księstwa, +Złoto z powietrznych wypraw i zniżka opłat).',
    baseFirePower: 24,
    baseFlightSpeed: 22,
    baseHoardGreed: 34,
    eggCostGold: 3600,
  },
};

export const DRAGON_STAGE_LABELS: Record<DragonLifeStage, { label: string; xpThreshold: number; scale3D: number }> = {
  1: { label: 'Świeżo Wyklute Pisklę', xpThreshold: 0, scale3D: 0.95 },
  2: { label: 'Młody Skrzydlaty Smok', xpThreshold: 100, scale3D: 1.25 },
  3: { label: 'Dorosły Smok Bojowy', xpThreshold: 260, scale3D: 1.6 },
  4: { label: 'Mistrz Przestworzy', xpThreshold: 500, scale3D: 1.95 },
  5: { label: 'Pradawny Władca Niebios', xpThreshold: 820, scale3D: 2.35 },
};

export interface BredDragon {
  id: string;
  name: string;
  speciesId: DragonSpeciesId;
  stage: DragonLifeStage;
  xp: number;
  bondPct: number; // 0..100
  firePower: number;
  flightSpeed: number;
  hoardGreed: number;
  energy: number;
  maxEnergy: number;
  missionsCompleted: number;
  generation: number; // 1 = wild egg, 2+ = bred in sanctuary
}

export interface DragonEgg {
  id: string;
  speciesId: DragonSpeciesId;
  incubationProgress: number; // 0..100
  rarityLabel: 'Szlachetne Jajo' | 'Królewska Hybryda';
  generation: number;
  parentNames?: string;
}

export interface DragonSanctuaryState {
  sanctuaryLevel: number;
  dragons: BredDragon[];
  eggs: DragonEgg[];
  activeCompanionId: string;
  totalAerialGoldEarned: number;
  recentLogs: string[];
}

export interface DragonGlobalBonuses {
  knightAttackBonus: number;
  caravanSpeedBonusPct: number;
  duchyIncomeBonusPct: number;
  disasterResistancePct: number;
  activeSpecies: DragonSpeciesId;
  activeStage: DragonLifeStage;
}

export type DragonMissionType = 'zwiad_skarbca' | 'eskorta_powietrzna' | 'polowanie_lusek';

export interface DragonMissionSpec {
  id: DragonMissionType;
  name: string;
  subtitle: string;
  energyCost: number;
  minStage: DragonLifeStage;
  baseGoldReward: number;
  xpReward: number;
  commodityReward: { id: CommodityId; qty: number };
}

export const DRAGON_MISSIONS: DragonMissionSpec[] = [
  {
    id: 'zwiad_skarbca',
    name: 'Powietrzny Zwiad Skarbców Valorii',
    subtitle: 'Szybki lot ponad górskimi ruinami w poszukiwaniu złota i zwojów.',
    energyCost: 25,
    minStage: 1,
    baseGoldReward: 950,
    xpReward: 55,
    commodityReward: { id: 'runiczny_pergamin', qty: 3 },
  },
  {
    id: 'eskorta_powietrzna',
    name: 'Eskorta Konwojów Transoceanicznych',
    subtitle: 'Patrol powietrzny nad 6 kontynentami odstraszający korsarzy i bestie.',
    energyCost: 35,
    minStage: 2,
    baseGoldReward: 1550,
    xpReward: 85,
    commodityReward: { id: 'przyprawy', qty: 9 },
  },
  {
    id: 'polowanie_lusek',
    name: 'Wyprawa na Kalderę Obsydianu',
    subtitle: 'Elitarny lot po pradawne Smocze Łuski i czysty Mithril.',
    energyCost: 45,
    minStage: 3,
    baseGoldReward: 2600,
    xpReward: 130,
    commodityReward: { id: 'smocza_luska', qty: 2 },
  },
];

const DRAGON_NAMES_BY_SPECIES: Record<DragonSpeciesId, string[]> = {
  trzcinowy:['Wiklin','Sitowie','Tatarak'],
  krzemienny:['Buła','Krzesiwo','Otoczak'],
  blekitny_legendarny:['Opar','Szafir','Rusał'],
  zloty_legendarny:['Wachlarz','Talarek','Aurek'],
  dwuglowy_brazowy:['Dwułom','Łupek','Rogacz'],
  dwuglowy_czerwony:['Dwużar','Skoria','Iskra'],
  brazowy:['Rdzawiec','Skalnik','Krzemień'],
  dwuglowy:['Dwugłos','Rozwidleniec','Szuwar'],
  pseudosmok: ['Szelest', 'Kłębek', 'Bosman'],
  blekit: ['Głębia', 'Bryzg', 'Witraż'],
  ogien: ['Ignis Vaelor', 'Pyrrhos Żaru', 'Karmazynowy Kael', 'Magmos'],
  lod: ['Glacius Boreal', 'Kryształowy Fenrir', 'Aurelia Szronu', 'Błękitny Skadi'],
  szmaragd: ['Aetherion Wiatru', 'Jadeitowy Sylph', 'Virelia z Valorii', 'Zefiros'],
  zloto: ['Aureus Midas', 'Solarius Korony', 'Złoty Chryzos', 'Skarbiec Królów'],
};

export function stageForDragonXp(xp: number): DragonLifeStage {
  if (xp >= DRAGON_STAGE_LABELS[5].xpThreshold) return 5;
  if (xp >= DRAGON_STAGE_LABELS[4].xpThreshold) return 4;
  if (xp >= DRAGON_STAGE_LABELS[3].xpThreshold) return 3;
  if (xp >= DRAGON_STAGE_LABELS[2].xpThreshold) return 2;
  return 1;
}

export function createInitialDragonSanctuary(): DragonSanctuaryState {
  const starter: BredDragon = {
    id: 'dragon_starter_vaelor',
    name: 'Ignis Vaelor',
    speciesId: 'ogien',
    stage: 2,
    xp: 120,
    bondPct: 58,
    firePower: 34,
    flightSpeed: 22,
    hoardGreed: 20,
    energy: 100,
    maxEnergy: 100,
    missionsCompleted: 1,
    generation: 1,
  };

  const starterEgg: DragonEgg = {
    id: 'egg_frost_starter',
    speciesId: 'lod',
    incubationProgress: 60,
    rarityLabel: 'Szlachetne Jajo',
    generation: 1,
  };

  return {
    sanctuaryLevel: 1,
    dragons: [starter],
    eggs: [starterEgg],
    activeCompanionId: starter.id,
    totalAerialGoldEarned: 0,
    recentLogs: [
      'Smocze Sanktuarium otwarte! Ignis Vaelor strzeże Twojej stolicy, a jajo Smoka Lodu ogrzewa się w inkubatorze.',
    ],
  };
}

export function computeDragonGlobalBonuses(sanctuary: DragonSanctuaryState): DragonGlobalBonuses {
  const active =
    sanctuary.dragons.find((d) => d.id === sanctuary.activeCompanionId) ?? sanctuary.dragons[0];
  if (!active) {
    return {
      knightAttackBonus: 0,
      caravanSpeedBonusPct: 0,
      duchyIncomeBonusPct: 0,
      disasterResistancePct: 0,
      activeSpecies: 'ogien',
      activeStage: 1,
    };
  }

  const fleetBonus = Math.max(0, sanctuary.dragons.length - 1);
  const knightAttackBonus = Math.round(active.firePower * 0.45 + active.stage * 4 + fleetBonus * 3 + (active.speciesId==='dwuglowy_czerwony'?7:0));
  const caravanSpeedBonusPct = Math.min(
    40,
    Math.round(active.flightSpeed * 0.45 + (active.speciesId === 'szmaragd' ? 6 : active.speciesId === 'pseudosmok' ? 4 : active.speciesId === 'dwuglowy' ? 5 : 0) + fleetBonus * 2),
  );
  const duchyIncomeBonusPct = Math.min(
    55,
    Math.round(active.hoardGreed * 0.6 + active.stage * 3 + (active.speciesId === 'zloto' ? 8 : active.speciesId === 'dwuglowy_brazowy' ? 6 : 0)),
  );
  const disasterResistancePct = Math.min(
    50,
    Math.round(active.stage * 7 + active.bondPct * 0.15 + fleetBonus * 3 + (active.speciesId === 'blekit' ? 8 : active.speciesId === 'brazowy' ? 5 : 0)),
  );

  return {
    knightAttackBonus,
    caravanSpeedBonusPct,
    duchyIncomeBonusPct,
    disasterResistancePct,
    activeSpecies: active.speciesId,
    activeStage: active.stage,
  };
}

export function incubateOrHatchEgg(params: {
  sanctuary: DragonSanctuaryState;
  eggId: string;
  playerGold: number;
}): {
  success: boolean;
  errorMessage?: string;
  goldCost: number;
  hatchedDragon?: BredDragon;
  nextSanctuary: DragonSanctuaryState;
  logMessage: string;
} {
  const { sanctuary, eggId, playerGold } = params;
  const egg = sanctuary.eggs.find((e) => e.id === eggId);
  if (!egg) {
    return {
      success: false,
      errorMessage: 'Nie znaleziono wskazanego jaja w inkubatorze.',
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const warmCost = egg.incubationProgress >= 100 ? 0 : 450;
  if (playerGold < warmCost) {
    return {
      success: false,
      errorMessage: `Potrzeba ${warmCost} zł na rozpalenie runicznego inkubatora.`,
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const nextProg = Math.min(100, egg.incubationProgress + 40);
  if (nextProg < 100) {
    const nextEggs = sanctuary.eggs.map((e) =>
      e.id === eggId ? { ...e, incubationProgress: nextProg } : e,
    );
    const log = `Ogrzano jajo (${DRAGON_SPECIES[egg.speciesId].name}) do ${nextProg}% inkubacji.`;
    return {
      success: true,
      goldCost: warmCost,
      nextSanctuary: {
        ...sanctuary,
        eggs: nextEggs,
        recentLogs: [log, ...sanctuary.recentLogs].slice(0, 10),
      },
      logMessage: log,
    };
  }

  // Hatch into a brand-new dragon!
  const spec = DRAGON_SPECIES[egg.speciesId];
  const namePool = DRAGON_NAMES_BY_SPECIES[egg.speciesId];
  const nameIdx = sanctuary.dragons.length % namePool.length;
  const genBonus = Math.max(0, egg.generation - 1) * 5;

  const newDragon: BredDragon = {
    id: `dragon_${egg.speciesId}_${Date.now()}_${sanctuary.dragons.length}`,
    name: `${namePool[nameIdx]}${egg.generation > 1 ? ` II` : ''}`,
    speciesId: egg.speciesId,
    stage: 1,
    xp: 20,
    bondPct: 45,
    firePower: spec.baseFirePower + genBonus,
    flightSpeed: spec.baseFlightSpeed + genBonus,
    hoardGreed: spec.baseHoardGreed + genBonus,
    energy: 100,
    maxEnergy: 100,
    missionsCompleted: 0,
    generation: egg.generation,
  };

  const log = `Wykluł się nowy smok: ${newDragon.name} (${spec.name}, Pokolenie ${newDragon.generation})!`;
  return {
    success: true,
    goldCost: warmCost,
    hatchedDragon: newDragon,
    nextSanctuary: {
      ...sanctuary,
      dragons: [...sanctuary.dragons, newDragon],
      eggs: sanctuary.eggs.filter((e) => e.id !== eggId),
      recentLogs: [log, ...sanctuary.recentLogs].slice(0, 10),
    },
    logMessage: log,
  };
}

export function feedAndTrainDragon(params: {
  sanctuary: DragonSanctuaryState;
  dragonId: string;
  feedMode: 'grain' | 'favorite_commodity';
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
}): {
  success: boolean;
  errorMessage?: string;
  goldCost: number;
  consumedCommodity?: { id: CommodityId; qty: number };
  evolvedToStage?: DragonLifeStage;
  nextSanctuary: DragonSanctuaryState;
  logMessage: string;
} {
  const { sanctuary, dragonId, feedMode, playerGold, playerInventory } = params;
  const dragon = sanctuary.dragons.find((d) => d.id === dragonId);
  if (!dragon) {
    return {
      success: false,
      errorMessage: 'Nie znaleziono wybranego smoka.',
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const spec = DRAGON_SPECIES[dragon.speciesId];
  const goldCost = feedMode === 'favorite_commodity' ? 650 : 420;
  const reqComm: { id: CommodityId; qty: number } =
    feedMode === 'favorite_commodity'
      ? { id: spec.favoriteCommodity, qty: spec.favoriteCommodity === 'smocza_luska' ? 1 : 3 }
      : { id: 'zboze', qty: 12 };

  if (playerGold < goldCost) {
    return {
      success: false,
      errorMessage: `Brakuje złota na karmienie i trening (${goldCost} zł).`,
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  if ((playerInventory[reqComm.id] ?? 0) < reqComm.qty) {
    return {
      success: false,
      errorMessage: `Brakuje w spichlerzu: ${reqComm.qty}x ${feedMode === 'favorite_commodity' ? spec.favoriteCommodityName : 'Zboże Królewskie'}.`,
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const xpGain = feedMode === 'favorite_commodity' ? 95 : 48;
  const statGain = feedMode === 'favorite_commodity' ? 6 : 3;
  const nextXp = dragon.xp + xpGain;
  const nextStage = stageForDragonXp(nextXp);
  const evolved = nextStage > dragon.stage;

  const updated: BredDragon = {
    ...dragon,
    xp: nextXp,
    stage: nextStage,
    bondPct: Math.min(100, dragon.bondPct + (feedMode === 'favorite_commodity' ? 12 : 6)),
    firePower: dragon.firePower + statGain + (evolved ? 8 : 0),
    flightSpeed: dragon.flightSpeed + statGain + (evolved ? 6 : 0),
    hoardGreed: dragon.hoardGreed + Math.max(2, Math.round(statGain * 0.8)) + (evolved ? 6 : 0),
    energy: dragon.maxEnergy,
  };

  const log = evolved
    ? `EWOLUCJA SMOKA! ${updated.name} osiągnął stadium: ${DRAGON_STAGE_LABELS[nextStage].label}!`
    : `Nakarmiono i wytrenowano ${updated.name} (+${xpGain} XP, +${statGain} do atrybutów, pełna energia).`;

  return {
    success: true,
    goldCost,
    consumedCommodity: reqComm,
    evolvedToStage: evolved ? nextStage : undefined,
    nextSanctuary: {
      ...sanctuary,
      dragons: sanctuary.dragons.map((d) => (d.id === dragonId ? updated : d)),
      recentLogs: [log, ...sanctuary.recentLogs].slice(0, 10),
    },
    logMessage: log,
  };
}

export function purchaseOrBreedDragonEgg(params: {
  sanctuary: DragonSanctuaryState;
  speciesId: DragonSpeciesId;
  playerGold: number;
  isCrossBreed?: boolean;
}): {
  success: boolean;
  errorMessage?: string;
  goldCost: number;
  nextSanctuary: DragonSanctuaryState;
  logMessage: string;
} {
  const { sanctuary, speciesId, playerGold, isCrossBreed = false } = params;
  if (sanctuary.eggs.length >= 4) {
    return {
      success: false,
      errorMessage: 'Inkubator jest pełny (maks. 4 jaja). Wykluj najpierw istniejące jajo.',
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const spec = DRAGON_SPECIES[speciesId];
  const ancestor = speciesId==='blekitny_legendarny'?'blekit':speciesId==='zloty_legendarny'?'zloto':null;
  if (ancestor && !sanctuary.dragons.some(d=>d.speciesId===ancestor && d.stage>=3)) {
    return {success:false,errorMessage:'Wychowaj dorosłego smoka z linii „'+DRAGON_SPECIES[ancestor].name+'”.',goldCost:0,nextSanctuary:sanctuary,logMessage:''};
  }
  const goldCost = isCrossBreed ? 1400 : spec.eggCostGold;
  if (isCrossBreed && sanctuary.dragons.length < 2) {
    return {
      success: false,
      errorMessage: 'Krzyżowanie linii wymaga co najmniej 2 dorosłych/młodych smoków w Sanktuarium.',
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }
  if (playerGold < goldCost) {
    return {
      success: false,
      errorMessage: `Brakuje złota (${goldCost} zł).`,
      goldCost: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const maxGen = sanctuary.dragons.reduce((m, d) => Math.max(m, d.generation), 1);
  const newEgg: DragonEgg = {
    id: `egg_${speciesId}_${Date.now()}_${sanctuary.eggs.length}`,
    speciesId,
    incubationProgress: isCrossBreed ? 45 : 25,
    rarityLabel: isCrossBreed ? 'Królewska Hybryda' : 'Szlachetne Jajo',
    generation: isCrossBreed ? maxGen + 1 : 1,
    parentNames: isCrossBreed
      ? `${sanctuary.dragons[0].name} × ${sanctuary.dragons[1].name}`
      : undefined,
  };

  const log = isCrossBreed
    ? `Skrzyżowano smoki! W inkubatorze spoczęło jajo Pokolenia ${newEgg.generation}: ${spec.name}.`
    : `Nabyto jajo z gniazd ${spec.originContinentName}: ${spec.name}.`;

  return {
    success: true,
    goldCost,
    nextSanctuary: {
      ...sanctuary,
      eggs: [...sanctuary.eggs, newEgg],
      recentLogs: [log, ...sanctuary.recentLogs].slice(0, 10),
    },
    logMessage: log,
  };
}

export function dispatchDragonMission(params: {
  sanctuary: DragonSanctuaryState;
  dragonId: string;
  missionId: DragonMissionType;
}): {
  success: boolean;
  errorMessage?: string;
  rewardGold: number;
  rewardCommodity?: { id: CommodityId; qty: number };
  nextSanctuary: DragonSanctuaryState;
  logMessage: string;
} {
  const { sanctuary, dragonId, missionId } = params;
  const dragon = sanctuary.dragons.find((d) => d.id === dragonId);
  const mission = DRAGON_MISSIONS.find((m) => m.id === missionId);

  if (!dragon || !mission) {
    return {
      success: false,
      errorMessage: 'Nieprawidłowy smok lub wyprawa powietrzna.',
      rewardGold: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  if (dragon.stage < mission.minStage) {
    return {
      success: false,
      errorMessage: `Wymagane stadium smoka: ${DRAGON_STAGE_LABELS[mission.minStage].label}.`,
      rewardGold: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  let energyCost=mission.energyCost;
  if(dragon.speciesId==='blekitny_legendarny' && missionId==='eskorta_powietrzna') energyCost-=12;
  if(dragon.speciesId==='trzcinowy' && missionId==='zwiad_skarbca') energyCost-=8;
  const rewardCommodity={...mission.commodityReward};
  if(dragon.speciesId==='zloty_legendarny' && missionId==='zwiad_skarbca') rewardCommodity.qty+=2;
  if(dragon.speciesId==='krzemienny' && missionId==='polowanie_lusek') rewardCommodity.qty++;
  if (dragon.energy < energyCost) {
    return {
      success: false,
      errorMessage: `Smok potrzebuje odpoczynku lub karmienia (Energia ${dragon.energy}/${energyCost}).`,
      rewardGold: 0,
      nextSanctuary: sanctuary,
      logMessage: '',
    };
  }

  const greedMult = 1 + dragon.hoardGreed * 0.014 + (dragon.stage - 1) * 0.14;
  const rewardGold = Math.round(mission.baseGoldReward * greedMult);
  const nextXp = dragon.xp + mission.xpReward;
  const nextStage = stageForDragonXp(nextXp);

  const updated: BredDragon = {
    ...dragon,
    xp: nextXp,
    stage: nextStage,
    energy: Math.max(0, dragon.energy - energyCost),
    bondPct: Math.min(100, dragon.bondPct + 4),
    missionsCompleted: dragon.missionsCompleted + 1,
  };

  const log = `${dragon.name} wrócił z misji „${mission.name}”: +${rewardGold} zł oraz +${rewardCommodity.qty}x surowca!`;

  return {
    success: true,
    rewardGold,
    rewardCommodity,
    nextSanctuary: {
      ...sanctuary,
      dragons: sanctuary.dragons.map((d) => (d.id === dragonId ? updated : d)),
      totalAerialGoldEarned: sanctuary.totalAerialGoldEarned + rewardGold,
      recentLogs: [log, ...sanctuary.recentLogs].slice(0, 10),
    },
    logMessage: log,
  };
}
