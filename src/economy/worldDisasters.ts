/**
 * Kupiecki Świat 3D: Odrodzenie — Dynamic World Disasters & Crisis Mitigation Engine
 * Pure decoupled logic: seasonal/continental catastrophes affecting prices, supply,
 * caravan speed, and 3D atmospheric visuals, with interactive player response choices.
 */

import type { CommodityId, ContinentId, SeasonId } from './economyEngine';

export type DisasterId =
  | 'erupcja_wulkanu'
  | 'powodz_roztopowa'
  | 'burza_piaskowa_solarii'
  | 'zamiec_tysiaclecia'
  | 'zaraza_zbozowa'
  | 'wstrzas_kopaln_mithrilu';

export type DisasterAtmosphereMode = 'ash' | 'flood' | 'sand' | 'blizzard' | 'blight' | 'quake';

export interface DisasterMitigationOption {
  id: string;
  label: string;
  description: string;
  costGold: number;
  requiredCommodity?: { id: CommodityId; qty: number };
  requiresDragonOrKnight?: boolean;
  rewardGold: number;
  rewardPrestige: number;
  rewardCommodity?: { id: CommodityId; qty: number };
  clearsDisasterImmediately: boolean;
  reducesDurationTicks: number;
}

export interface WorldDisasterTemplate {
  id: DisasterId;
  title: string;
  shortLabel: string;
  continentId: ContinentId;
  preferredSeasons: SeasonId[];
  atmosphereMode: DisasterAtmosphereMode;
  severityLabel: 'Katastrofa Regionalna' | 'Kataklizm Kontynentalny' | 'Kryzys Globalny';
  accentHex: string;
  description: string;
  economicImpactSummary: string;
  caravanSpeedMultiplier: number; // e.g. 0.55 means caravans move 45% slower
  supplyShockMultiplier: number;  // e.g. 0.65 means 35% drop in supply availability
  priceMultipliers: Partial<Record<CommodityId, number>>;
  durationTicks: number;
  mitigationOptions: DisasterMitigationOption[];
}

export interface ActiveWorldDisaster {
  instanceId: string;
  templateId: DisasterId;
  title: string;
  shortLabel: string;
  continentId: ContinentId;
  atmosphereMode: DisasterAtmosphereMode;
  severityLabel: 'Katastrofa Regionalna' | 'Kataklizm Kontynentalny' | 'Kryzys Globalny';
  accentHex: string;
  description: string;
  economicImpactSummary: string;
  caravanSpeedMultiplier: number;
  supplyShockMultiplier: number;
  priceMultipliers: Partial<Record<CommodityId, number>>;
  remainingTicks: number;
  totalTicks: number;
  startedAtDay: number;
  mitigatedByPlayer: boolean;
}

export const WORLD_DISASTERS: WorldDisasterTemplate[] = [
  {
    id: 'erupcja_wulkanu',
    title: 'Erupcja Kalder Archipelagu Obsydianowego',
    shortLabel: 'Erupcja Wulkanu',
    continentId: 'obsydian_wulkan',
    preferredSeasons: ['lato', 'jesien', 'wiosna', 'zima'],
    atmosphereMode: 'ash',
    severityLabel: 'Kataklizm Kontynentalny',
    accentHex: '#F97316',
    description:
      'Potężne wstrząsy rozerwały kratery na Archipelagu Obsydianowym oraz Krwawym Szczycie. Chmury żaru i popiołu zasnuwają niebo, wstrzymując wytop rudy i polowania na smoki.',
    economicImpactSummary: 'Smocza Łuska +38% · Mithril +28% · Prędkość karawan -32%',
    caravanSpeedMultiplier: 0.68,
    supplyShockMultiplier: 0.64,
    priceMultipliers: {
      smocza_luska: 1.38,
      mithril: 1.28,
      zelazo: 1.18,
    },
    durationTicks: 10,
    mitigationOptions: [
      {
        id: 'obsidian_relief_fleet',
        label: 'Wyślij Flotę Ratunkową i Zapasy',
        description: 'Dostarcz wodę, drewno i pomoc dla Obsydianowej Cytadeli, stabilizując szlaki.',
        costGold: 1800,
        requiredCommodity: { id: 'zboze', qty: 15 },
        rewardGold: 2900,
        rewardPrestige: 85,
        rewardCommodity: { id: 'smocza_luska', qty: 2 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 10,
      },
      {
        id: 'dragon_caldera_tame',
        label: 'Poskrom Żar ze Smokiem i Rycerzem',
        description: 'Wspólna wyprawa powietrzna Smoka i Rycerza otwiera bezpieczny korytarz w popiołach.',
        costGold: 950,
        requiresDragonOrKnight: true,
        rewardGold: 2400,
        rewardPrestige: 110,
        rewardCommodity: { id: 'mithril', qty: 3 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 10,
      },
      {
        id: 'volcanic_speculation',
        label: 'Zabezpiecz Magazyny i Przeczekaj',
        description: 'Wzmocnij dachy spichlerzy przed popiołem i wykorzystaj wysokie kursy na giełdzie.',
        costGold: 350,
        rewardGold: 600,
        rewardPrestige: 20,
        clearsDisasterImmediately: false,
        reducesDurationTicks: 4,
      },
    ],
  },
  {
    id: 'powodz_roztopowa',
    title: 'Wielka Powódź Roztopowa na Starym Kontynencie',
    shortLabel: 'Wielka Powódź',
    continentId: 'stary_kontynent',
    preferredSeasons: ['wiosna', 'jesien'],
    atmosphereMode: 'flood',
    severityLabel: 'Katastrofa Regionalna',
    accentHex: '#38BDF8',
    description:
      'Gwałtowne roztopy i ulewy podniosły poziom rzek od Srebrnego Gaju aż po Królewską Przystań. Zalane trakty i mosty paraliżują przewóz drewna i zboża.',
    economicImpactSummary: 'Zboże +32% · Drewno Elfickie +26% · Prędkość karawan -35%',
    caravanSpeedMultiplier: 0.65,
    supplyShockMultiplier: 0.70,
    priceMultipliers: {
      zboze: 1.32,
      drewno_elfickie: 1.26,
      runiczny_pergamin: 1.14,
    },
    durationTicks: 8,
    mitigationOptions: [
      {
        id: 'build_dikes',
        label: 'Sfinansuj Wały i Mosty Pontonowe',
        description: 'Wyślij cieśli z drewnem elfickim do odbudowy traktów pod Królewską Przystanią.',
        costGold: 1400,
        requiredCommodity: { id: 'drewno_elfickie', qty: 8 },
        rewardGold: 2450,
        rewardPrestige: 75,
        rewardCommodity: { id: 'zboze', qty: 28 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 8,
      },
      {
        id: 'aerial_supply_drop',
        label: 'Powietrzny Most Zaopatrzeniowy',
        description: 'Smok i gwardia przerzucają zapasy nad zalaną doliną, ratując kupców.',
        costGold: 850,
        requiresDragonOrKnight: true,
        rewardGold: 1950,
        rewardPrestige: 90,
        rewardCommodity: { id: 'runiczny_pergamin', qty: 4 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 8,
      },
      {
        id: 'flood_wait',
        label: 'Przekieruj Wozy na Wyżyny',
        description: 'Omiń zalane doliny dłuższą trasą górską, minimalizując straty.',
        costGold: 250,
        rewardGold: 450,
        rewardPrestige: 15,
        clearsDisasterImmediately: false,
        reducesDurationTicks: 3,
      },
    ],
  },
  {
    id: 'burza_piaskowa_solarii',
    title: 'Wielki Habub i Susza Pustynna w Solarii',
    shortLabel: 'Burza Piaskowa',
    continentId: 'solaria_poludnie',
    preferredSeasons: ['lato'],
    atmosphereMode: 'sand',
    severityLabel: 'Kataklizm Kontynentalny',
    accentHex: '#F59E0B',
    description:
      'Ściana gorącego pyłu pochłonęła szlaki karawanowe wokół Oazy Al-Kharim i Złotej Zatoki. Statki korzenne stoją w portach, a ceny przypraw wystrzeliły.',
    economicImpactSummary: 'Przyprawy +42% · Kryształy Many +22% · Prędkość karawan -38%',
    caravanSpeedMultiplier: 0.62,
    supplyShockMultiplier: 0.62,
    priceMultipliers: {
      przyprawy: 1.42,
      krysztaly_many: 1.22,
      zboze: 1.15,
    },
    durationTicks: 9,
    mitigationOptions: [
      {
        id: 'oasis_caravan_rescue',
        label: 'Wyślij Konwój Wodny dla Sułtanatu',
        description: 'Uratuj zasypane karawany korzenne i przejmij wdzięczność bazarów Solarii.',
        costGold: 1650,
        rewardGold: 2950,
        rewardPrestige: 80,
        rewardCommodity: { id: 'przyprawy', qty: 18 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 9,
      },
      {
        id: 'mage_wind_clear',
        label: 'Rozprosz Burzę Rycerzem i Smokiem',
        description: 'Potężny prąd skrzydeł i zaklęcie wiatru otwierają szlak do Oazy Al-Kharim.',
        costGold: 900,
        requiresDragonOrKnight: true,
        rewardGold: 2250,
        rewardPrestige: 95,
        rewardCommodity: { id: 'krysztaly_many', qty: 5 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 9,
      },
      {
        id: 'sand_wait',
        label: 'Zamknij Porty na Czas Burzy',
        description: 'Zatrzymaj galeony na redzie i sprzedawaj zapasy przypraw z zyskiem.',
        costGold: 300,
        rewardGold: 550,
        rewardPrestige: 18,
        clearsDisasterImmediately: false,
        reducesDurationTicks: 4,
      },
    ],
  },
  {
    id: 'zamiec_tysiaclecia',
    title: 'Arktyczna Zamieć Tysiąclecia z Frostheimu',
    shortLabel: 'Arktyczna Zamieć',
    continentId: 'frostheim_polnoc',
    preferredSeasons: ['zima'],
    atmosphereMode: 'blizzard',
    severityLabel: 'Kryzys Globalny',
    accentHex: '#60A5FA',
    description:
      'Potężny front polarny z Frostheimu skuł lodem północne cieśniny i zasypał przełęcze górskie. Spichlerze opróżniają się błyskawicznie, a ruda i żywność osiągają rekordowe ceny.',
    economicImpactSummary: 'Zboże +36% · Żelazo +28% · Mithril +30% · Karawany -45%',
    caravanSpeedMultiplier: 0.55,
    supplyShockMultiplier: 0.58,
    priceMultipliers: {
      zboze: 1.36,
      zelazo: 1.28,
      mithril: 1.30,
      drewno_elfickie: 1.24,
    },
    durationTicks: 10,
    mitigationOptions: [
      {
        id: 'icebreaker_expedition',
        label: 'Wypraw Lodołamacze z Zaopatrzeniem',
        description: 'Przebij lód w fiordach Frostgardu, ratując kopalnie i garnizony przed głodem.',
        costGold: 1900,
        requiredCommodity: { id: 'zboze', qty: 20 },
        rewardGold: 3300,
        rewardPrestige: 100,
        rewardCommodity: { id: 'mithril', qty: 4 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 10,
      },
      {
        id: 'fire_dragon_thaw',
        label: 'Odtaj Przełęcze Oddechem Smoka',
        description: 'Twój Smok toruje ognistym podmuchem przejście przez zaspy dla karawan.',
        costGold: 1000,
        requiresDragonOrKnight: true,
        rewardGold: 2650,
        rewardPrestige: 115,
        rewardCommodity: { id: 'zelazo', qty: 26 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 10,
      },
      {
        id: 'blizzard_bunker',
        label: 'Ogrzej Spichlerze i Przeczekaj Mróz',
        description: 'Zabezpiecz zapasy przed mrozem, skracając straty o połowę.',
        costGold: 400,
        rewardGold: 650,
        rewardPrestige: 22,
        clearsDisasterImmediately: false,
        reducesDurationTicks: 4,
      },
    ],
  },
  {
    id: 'zaraza_zbozowa',
    title: 'Plaga Rdzy Zbożowej w Wyżynach Valorii',
    shortLabel: 'Plaga Zbożowa',
    continentId: 'valoria_zachod',
    preferredSeasons: ['wiosna', 'jesien'],
    atmosphereMode: 'blight',
    severityLabel: 'Katastrofa Regionalna',
    accentHex: '#A855F7',
    description:
      'Tajemnicza zaraza zaatakowała spichlerze i lasy w Valorii. Alchemicy z Aetheris poszukują czystych Kryształów Many i Pergaminów, aby uwarzyć antidotum.',
    economicImpactSummary: 'Zboże +30% · Runiczny Pergamin +28% · Kryształy Many +24%',
    caravanSpeedMultiplier: 0.78,
    supplyShockMultiplier: 0.72,
    priceMultipliers: {
      zboze: 1.30,
      runiczny_pergamin: 1.28,
      krysztaly_many: 1.24,
    },
    durationTicks: 8,
    mitigationOptions: [
      {
        id: 'alchemy_cure',
        label: 'Uwarz Eliksir Oczyszczenia',
        description: 'Zleć Kolegium Magów uzdrowienie pól Valorii za pomocą Kryształów Many.',
        costGold: 1500,
        requiredCommodity: { id: 'krysztaly_many', qty: 4 },
        rewardGold: 2800,
        rewardPrestige: 88,
        rewardCommodity: { id: 'drewno_elfickie', qty: 18 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 8,
      },
      {
        id: 'knight_quarantine',
        label: 'Oczyść Źródło Plagi z Rycerzem',
        description: 'Wytrop zakażone chowańce w puszczy Valorii i przerwij epidemię.',
        costGold: 800,
        requiresDragonOrKnight: true,
        rewardGold: 2150,
        rewardPrestige: 92,
        rewardCommodity: { id: 'smocza_luska', qty: 1 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 8,
      },
      {
        id: 'blight_wait',
        label: 'Wprowadź Kwarantannę Spichlerzy',
        description: 'Odizoluj składy, chroniąc własny towar przed zepsuciem.',
        costGold: 280,
        rewardGold: 480,
        rewardPrestige: 15,
        clearsDisasterImmediately: false,
        reducesDurationTicks: 3,
      },
    ],
  },
  {
    id: 'wstrzas_kopaln_mithrilu',
    title: 'Trzęsienie Ziemi w Szczytach Aetheris i Kuźni',
    shortLabel: 'Trzęsienie Ziemi',
    continentId: 'aetheris_wschod',
    preferredSeasons: ['jesien', 'zima', 'lato'],
    atmosphereMode: 'quake',
    severityLabel: 'Kataklizm Kontynentalny',
    accentHex: '#EF4444',
    description:
      'Potężny wstrząs tektoniczny zawalił korytarze kopalni Mithrilu oraz skalne przełęcze Cesarstwa Aetheris. Wydobycie metali szlachetnych gwałtownie spadło.',
    economicImpactSummary: 'Mithril +40% · Żelazo +25% · Runiczny Pergamin +20%',
    caravanSpeedMultiplier: 0.72,
    supplyShockMultiplier: 0.66,
    priceMultipliers: {
      mithril: 1.40,
      zelazo: 1.25,
      runiczny_pergamin: 1.20,
    },
    durationTicks: 9,
    mitigationOptions: [
      {
        id: 'mining_rescue_guild',
        label: 'Sfinansuj Ekipę Ratunkową Górników',
        description: 'Odkop zasypane sztolnie Mithrilu, zdobywając prawo pierwokupu nowej żyły.',
        costGold: 1750,
        requiredCommodity: { id: 'zelazo', qty: 12 },
        rewardGold: 3150,
        rewardPrestige: 90,
        rewardCommodity: { id: 'mithril', qty: 4 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 9,
      },
      {
        id: 'dragon_mountain_bridge',
        label: 'Otwórz Szlak Powietrzny ze Smokiem',
        description: 'Twoja smocza eskorta przenosi ładunki ponad zawalonymi przełęczami.',
        costGold: 950,
        requiresDragonOrKnight: true,
        rewardGold: 2350,
        rewardPrestige: 105,
        rewardCommodity: { id: 'krysztaly_many', qty: 5 },
        clearsDisasterImmediately: true,
        reducesDurationTicks: 9,
      },
      {
        id: 'quake_wait',
        label: 'Wzmocnij Fundamenty Faktorii',
        description: 'Zabezpiecz własne składy i przeczekaj wstrząsy wtórne.',
        costGold: 320,
        rewardGold: 520,
        rewardPrestige: 20,
        clearsDisasterImmediately: false,
        reducesDurationTicks: 4,
      },
    ],
  },
];

export function getDisasterTemplateById(id: DisasterId): WorldDisasterTemplate {
  return WORLD_DISASTERS.find((d) => d.id === id) ?? WORLD_DISASTERS[0];
}

export function pickRandomDisaster(
  season: SeasonId,
  worldDayNumber: number,
  seed: number = Date.now(),
): ActiveWorldDisaster {
  const seasonalPool = WORLD_DISASTERS.filter((d) => d.preferredSeasons.includes(season));
  const pool = seasonalPool.length > 0 ? seasonalPool : WORLD_DISASTERS;
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  const tpl = pool[idx];

  return {
    instanceId: `dis_${tpl.id}_${worldDayNumber}_${Math.abs(Math.floor(seed)) % 9999}`,
    templateId: tpl.id,
    title: tpl.title,
    shortLabel: tpl.shortLabel,
    continentId: tpl.continentId,
    atmosphereMode: tpl.atmosphereMode,
    severityLabel: tpl.severityLabel,
    accentHex: tpl.accentHex,
    description: tpl.description,
    economicImpactSummary: tpl.economicImpactSummary,
    caravanSpeedMultiplier: tpl.caravanSpeedMultiplier,
    supplyShockMultiplier: tpl.supplyShockMultiplier,
    priceMultipliers: { ...tpl.priceMultipliers },
    remainingTicks: tpl.durationTicks,
    totalTicks: tpl.durationTicks,
    startedAtDay: worldDayNumber,
    mitigatedByPlayer: false,
  };
}

export function getDisasterPriceMultiplier(
  disaster: ActiveWorldDisaster | null | undefined,
  commodityId: CommodityId,
): number {
  if (!disaster) return 1.0;
  return disaster.priceMultipliers[commodityId] ?? 1.0;
}

export function getDisasterCaravanSpeedMultiplier(
  disaster: ActiveWorldDisaster | null | undefined,
  continentIds?: ContinentId[],
): number {
  if (!disaster) return 1.0;
  if (!continentIds || continentIds.includes(disaster.continentId)) {
    return disaster.caravanSpeedMultiplier;
  }
  // Global ripple effect is milder on other continents
  return Number((1 - (1 - disaster.caravanSpeedMultiplier) * 0.45).toFixed(2));
}

export interface DisasterMitigationResult {
  success: boolean;
  errorMessage?: string;
  goldDelta: number;
  prestigeDelta: number;
  consumedCommodity?: { id: CommodityId; qty: number };
  rewardCommodity?: { id: CommodityId; qty: number };
  nextDisaster: ActiveWorldDisaster | null;
  logMessage: string;
}

export function resolveDisasterMitigation(params: {
  disaster: ActiveWorldDisaster;
  optionId: string;
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  hasDragonBonus?: boolean;
}): DisasterMitigationResult {
  const { disaster, optionId, playerGold, playerInventory, hasDragonBonus = false } = params;
  const tpl = getDisasterTemplateById(disaster.templateId);
  const option = tpl.mitigationOptions.find((o) => o.id === optionId);

  if (!option) {
    return {
      success: false,
      errorMessage: 'Nie znaleziono wybranej akcji kryzysowej.',
      goldDelta: 0,
      prestigeDelta: 0,
      nextDisaster: disaster,
      logMessage: '',
    };
  }

  if (playerGold < option.costGold) {
    return {
      success: false,
      errorMessage: `Brakuje złota (wymagane ${option.costGold} zł).`,
      goldDelta: 0,
      prestigeDelta: 0,
      nextDisaster: disaster,
      logMessage: '',
    };
  }

  if (option.requiredCommodity) {
    const held = playerInventory[option.requiredCommodity.id] ?? 0;
    if (held < option.requiredCommodity.qty) {
      return {
        success: false,
        errorMessage: `Brakuje surowca w spichlerzu (wymagane ${option.requiredCommodity.qty} szt.).`,
        goldDelta: 0,
        prestigeDelta: 0,
        nextDisaster: disaster,
        logMessage: '',
      };
    }
  }

  const dragonBonusGold = option.requiresDragonOrKnight && hasDragonBonus ? 450 : 0;
  const goldDelta = option.rewardGold + dragonBonusGold - option.costGold;
  const prestigeDelta = option.rewardPrestige + (dragonBonusGold > 0 ? 20 : 0);

  const nextRemaining = option.clearsDisasterImmediately
    ? 0
    : Math.max(1, disaster.remainingTicks - option.reducesDurationTicks);

  const nextDisaster: ActiveWorldDisaster | null =
    nextRemaining <= 0
      ? null
      : {
          ...disaster,
          remainingTicks: nextRemaining,
          mitigatedByPlayer: true,
        };

  return {
    success: true,
    goldDelta,
    prestigeDelta,
    consumedCommodity: option.requiredCommodity,
    rewardCommodity: option.rewardCommodity,
    nextDisaster,
    logMessage: option.clearsDisasterImmediately
      ? `Katastrofa opanowana (${disaster.shortLabel})! ${option.label}: +${option.rewardGold + dragonBonusGold} zł, +${prestigeDelta} Prestiżu.`
      : `Skutki katastrofy złagodzone (${disaster.shortLabel}): skrócono czas trwania o ${option.reducesDurationTicks} cykli.`,
  };
}
