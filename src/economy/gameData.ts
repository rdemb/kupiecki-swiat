import { CommodityId, RaceId } from './economyEngine';
import type { EquipmentSlot, HeroPathId } from './heroProgression';

export interface RaceSpec {
  id: RaceId;
  name: string;
  title: string;
  bonusText: string;
  feeDiscount: number;       // Zniżka opłat targowych
  productionBonus: number;   // Premia do wydobycia i rzemiosła
  combatEscortBonus: number; // Premia bojowa dla Rycerza i eskorty
  startingCapital: number;
}

export const RACES: RaceSpec[] = [
  {
    id: 'ludzie',
    name: 'Ludzie (Królewska Gildia)',
    title: 'Mistrzowie Dyplomacji i Handlu Królewskiego',
    bonusText: '-20% opłaty giełdowej · +15% dochodu z Księstwa · Zrównoważony Rycerz i Flota',
    feeDiscount: 0.20,
    productionBonus: 0.10,
    combatEscortBonus: 0.15,
    startingCapital: 15000,
  },
  {
    id: 'krasnoludy',
    name: 'Krasnoludy (Klan Żelaznej Kuźni)',
    title: 'Inżynierowie Górnictwa i Płatnerze Mithrilu',
    bonusText: '+28% wydobycia Żelaza i Mithrilu · +25% pojemności spichlerzy · Ciężki Pancerz Rycerza',
    feeDiscount: 0.08,
    productionBonus: 0.28,
    combatEscortBonus: 0.25,
    startingCapital: 14500,
  },
  {
    id: 'elfy',
    name: 'Elfy (Dom Srebrnego Gaju)',
    title: 'Strażnicy Szlaków i Arcymagowie Run',
    bonusText: '+25% szybkości karawan · +22% produkcji Drewna i Pergaminów · Potężne Zaklęcia Maga',
    feeDiscount: 0.12,
    productionBonus: 0.22,
    combatEscortBonus: 0.20,
    startingCapital: 14500,
  },
  {
    id: 'gobliny',
    name: 'Gobliny (Syndykat Złotej Zatoki)',
    title: 'Magnaci Giełdowi i Alchemicy Portowi',
    bonusText: '-30% spreadu na giełdzie towarowej · +20% zysku z floty · Alchemiczne wsparcie bojowe',
    feeDiscount: 0.30,
    productionBonus: 0.12,
    combatEscortBonus: 0.10,
    startingCapital: 16000,
  },
  {
    id: 'orkowie',
    name: 'Orkowie (Wataha Krwawego Szczytu)',
    title: 'Pogromcy Smoków i Miejsc Strachu',
    bonusText: '+40% siły uderzenia Rycerza · +35% łupów ze Smoczych Łusek i wypraw bojowych',
    feeDiscount: 0.05,
    productionBonus: 0.15,
    combatEscortBonus: 0.40,
    startingCapital: 14000,
  },
];

// --- STORY CAMPAIGN CHAPTERS: "OD SAKWY ZŁOTA DO KORONY WŁADCY KSIĘSTWA" ---
export interface StoryChapterSpec {
  id: string;
  chapterNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  rankTitleEarned: string;
  loreNarrative: string;
  requirementSummary: string;
  reqNetWorth: number;
  reqTradesCount: number;
  reqMonstersDefeated: number;
  reqDuchyTotalBuildingLevels: number;
  rewardGold: number;
  rewardCommodity: { id: CommodityId; qty: number };
}

export const STORY_CAMPAIGN_CHAPTERS: StoryChapterSpec[] = [
  {
    id: 'chap_1_sakwa',
    chapterNumber: 1,
    title: 'Akt I: Zwykły Kupiec z Sakwą Złota',
    rankTitleEarned: 'Wędrowny Kupiec Szlaku',
    loreNarrative:
      'Przybywasz do Królewskiej Przystani z jedną sakwą złota i skromnym zapasem zboża w spichlerzu. Stare kroniki Kupieckiego Świata głoszą, że po tajemniczym zniknięciu Wielkiego Księcia Aethelgarda na Smoczym Przesmyku, tylko ten, kto zjednoczy handel, miecz i magię, sięgnie po koronę Księstwa.',
    requirementSummary: 'Wykonaj min. 1 transakcję na giełdzie oraz osiągnij 18 000 zł majątku netto.',
    reqNetWorth: 18_000,
    reqTradesCount: 1,
    reqMonstersDefeated: 0,
    reqDuchyTotalBuildingLevels: 1,
    rewardGold: 1500,
    rewardCommodity: { id: 'zboze', qty: 30 },
  },
  {
    id: 'chap_2_rebelianci',
    chapterNumber: 2,
    title: 'Akt II: Cień Rebeliantów na Trakcie Królewskim',
    rankTitleEarned: 'Obrońca Traktów Kupieckich',
    loreNarrative:
      'Twoje wozy zaczynają przynosić zyski, lecz na mostach pod Królewską Przystanią i w lasach Srebrnego Gaju wyrastają obozy Rebeliantów dowodzonych przez Krwawego Korda. Musisz wyszkolić swojego Rycerza i oczyścić szlaki, by przywrócić swobodny przepływ żelaza i drewna.',
    requirementSummary: 'Pokonaj min. 1 obóz wroga swoim Rycerzem oraz osiągnij 24 000 zł majątku.',
    reqNetWorth: 24_000,
    reqTradesCount: 2,
    reqMonstersDefeated: 1,
    reqDuchyTotalBuildingLevels: 2,
    rewardGold: 2600,
    rewardCommodity: { id: 'zelazo', qty: 18 },
  },
  {
    id: 'chap_3_miasta',
    chapterNumber: 3,
    title: 'Akt III: Zarządca Ziem, Magów i Floty Morskiej',
    rankTitleEarned: 'Komandor Floty i Faktorii',
    loreNarrative:
      'Magistraty pięciu miast dostrzegają Twoją potęgę. Otrzymujesz prawo rozbudowy Faktorii Kupieckich, Koszar Rycerskich, Wieży Magów oraz Stoczni na Złotej Zatoce. Zrekrutuj własnego Maga Bitewnego i stwórz flotę galeonów handlowych!',
    requirementSummary: 'Rozbuduj budynki Księstwa do łącznego poziomu 4 oraz zgromadź 34 000 zł majątku.',
    reqNetWorth: 34_000,
    reqTradesCount: 3,
    reqMonstersDefeated: 2,
    reqDuchyTotalBuildingLevels: 4,
    rewardGold: 4200,
    rewardCommodity: { id: 'krysztaly_many', qty: 10 },
  },
  {
    id: 'chap_4_strach',
    chapterNumber: 4,
    title: 'Akt IV: Wyprawa w Głąb Miejsc Strachu',
    rankTitleEarned: 'Pogromca Miejsc Strachu',
    loreNarrative:
      'W podziemiach Żelaznej Kuźni i we mgle Złotej Zatoki budzą się pradawne potwory – Runiczny Golem oraz Widmowy Galeon Valthora. Połącz stal swojego Rycerza z zaklęciami Maga i błogosławieństwem Chowańca, aby zdobyć czysty Mithril i zwoje przodków.',
    requirementSummary: 'Pokonaj min. 3 bestie w wyprawach turowych oraz osiągnij 48 000 zł majątku.',
    reqNetWorth: 48_000,
    reqTradesCount: 4,
    reqMonstersDefeated: 3,
    reqDuchyTotalBuildingLevels: 5,
    rewardGold: 6500,
    rewardCommodity: { id: 'mithril', qty: 8 },
  },
  {
    id: 'chap_5_korona',
    chapterNumber: 5,
    title: 'Akt V: Korona Władcy Księstwa i Ogień Ignisa',
    rankTitleEarned: 'Wielki Książę Kupieckiego Świata',
    loreNarrative:
      'Nadszedł czas ostatecznej próby na Krwawym Szczycie, gdzie nad wulkaniczną iglicą krąży Pradawny Smok Ignis. Pokonując bestię i dominując nad gospodarką wszystkich pięciu stolic, zasiadasz na tronie jako prawowity Władca Księstwa Kupieckiego Świata!',
    requirementSummary: 'Osiągnij 65 000 zł majątku netto, pokonaj min. 4 bestie i rozbuduj Księstwo (poz. 6).',
    reqNetWorth: 65_000,
    reqTradesCount: 5,
    reqMonstersDefeated: 4,
    reqDuchyTotalBuildingLevels: 6,
    rewardGold: 12000,
    rewardCommodity: { id: 'smocza_luska', qty: 5 },
  },
];

// --- DUCHY, CITY MANAGEMENT, ARMY & FLEET SYSTEM (ZARZĄDZANIE MIASTEM, KSIĘSTWEM, ARMIĄ I FLOTĄ) ---
export interface DuchyBuildingSpec {
  id: 'faktoria' | 'koszary' | 'wieza_magow' | 'stocznia';
  name: string;
  subtitle: string;
  loreDesc: string;
  baseCostGold: number;
  requiredCommodity: { id: CommodityId; baseQty: number };
  incomeGoldPerLevel: number;
  commodityYieldPerLevel: { id: CommodityId; qty: number };
  specialEffectText: string;
}

export const DUCHY_BUILDINGS: DuchyBuildingSpec[] = [
  {
    id: 'faktoria',
    name: 'Wielka Faktoria i Spichlerz Książęcy',
    subtitle: 'Centrum Podatkowe i Magazynowe Miasta',
    loreDesc:
      'Rozbudowa sukiennic, kantorów wymiany i kamiennych spichlerzy generuje stały czynsz w złocie oraz świeże dostawy Zboża po każdych żniwach.',
    baseCostGold: 1600,
    requiredCommodity: { id: 'drewno_elfickie', baseQty: 6 },
    incomeGoldPerLevel: 420,
    commodityYieldPerLevel: { id: 'zboze', qty: 12 },
    specialEffectText: '+420 zł czynszu i +12 Zboża na cykl · +80 pojemności spichlerza',
  },
  {
    id: 'koszary',
    name: 'Cytadela i Koszary Gwardii Rycerskiej',
    subtitle: 'Rekrutacja Armii i Garnizonów Szlaku',
    loreDesc:
      'Kuźnie płatnerskie i place ćwiczebne szkolące zbrojnych gwardzistów, którzy chronią Twoje karawany i wspierają Rycerza podczas szturmów.',
    baseCostGold: 1900,
    requiredCommodity: { id: 'zelazo', baseQty: 8 },
    incomeGoldPerLevel: 260,
    commodityYieldPerLevel: { id: 'zelazo', qty: 6 },
    specialEffectText: '+6 Siły Armii dla Rycerza · +260 zł kontrybucji i +6 Rudy Żelaza',
  },
  {
    id: 'wieza_magow',
    name: 'Iglica Kolegium Magów i Alchemików',
    subtitle: 'Zaklęcia Handlowe, Runy i Kryształy Many',
    loreDesc:
      'Sanktuarium uczonych ze Srebrnego Gaju i Złotej Zatoki. Zwiększa regenerację Many Twojego Maga oraz destyluje czyste Kryształy Many.',
    baseCostGold: 2400,
    requiredCommodity: { id: 'runiczny_pergamin', baseQty: 4 },
    incomeGoldPerLevel: 340,
    commodityYieldPerLevel: { id: 'krysztaly_many', qty: 3 },
    specialEffectText: '+20 Max Many Maga · +340 zł oraz +3 Kryształy Many na cykl',
  },
  {
    id: 'stocznia',
    name: 'Królewska Stocznia i Admiralicja Floty',
    subtitle: 'Budowa Galeonów Kupieckich i Okrętów Wojennych',
    loreDesc:
      'Dok morski pomiędzy Królewską Przystanią a Złotą Zatoką. Pozwala wodować flotę galeonów przywożących zamorskie Przyprawy i złoto.',
    baseCostGold: 2200,
    requiredCommodity: { id: 'drewno_elfickie', baseQty: 10 },
    incomeGoldPerLevel: 520,
    commodityYieldPerLevel: { id: 'przyprawy', qty: 7 },
    specialEffectText: '+520 zł z handlu morskiego i +7 Przypraw Wschodnich na cykl',
  },
];

export interface MageSpellSpec {
  id: 'spell_midas_harvest' | 'spell_portal_wind' | 'spell_arcane_thunder';
  name: string;
  school: string;
  manaCost: number;
  scrollCost: number;
  description: string;
  effectLabel: string;
}

export const MAGE_SPELLS: MageSpellSpec[] = [
  {
    id: 'spell_midas_harvest',
    name: 'Rytuał Złotego Żniwa i Transmutacji',
    school: 'Magia Ekonomii i Alchemii',
    manaCost: 30,
    scrollCost: 1,
    description:
      'Arcymag zaklina spichlerze i piece hutnicze Księstwa, natychmiast materializując złoto oraz partię rzadkich surowców.',
    effectLabel: 'Natychmiast: +1850 zł, +15 Zboża, +4 Kryształy Many i +2 Sztaby Mithrilu',
  },
  {
    id: 'spell_portal_wind',
    name: 'Wiatr Astralny i Błogosławieństwo Szlaków',
    school: 'Magia Przestrzeni i Podróży',
    manaCost: 25,
    scrollCost: 1,
    description:
      'Otwiera korytarze powietrzne dla Twoich karawan i drużyny rycerskiej, regenerując tury wypraw i pełne zdrowie Rycerza.',
    effectLabel: 'Natychmiast: +4 Tury Wypraw Rycerza, Pełne Uleczenie HP i przyśpieszenie karawan',
  },
  {
    id: 'spell_arcane_thunder',
    name: 'Piorun Runiczny w Miejsce Strachu',
    school: 'Magia Bitewna Kolegium',
    manaCost: 35,
    scrollCost: 1,
    description:
      'Uderza czystą energią many w potwora, z którym aktualnie walczy Twój Rycerz (lub wzmacnia jego miecz na kolejną bitwę).',
    effectLabel: 'Zadaje 140 pkt. obrażeń magicznych bestii + dodaje +6 Siły Rycerzowi',
  },
];

export interface DuchyState {
  duchyName: string;
  rankIndex: number; // 0..4 corresponding to completed story chapters
  completedChapterIds: string[];
  buildings: {
    faktoria: number;
    koszary: number;
    wieza_magow: number;
    stocznia: number;
  };
  armyGuardsCount: number;     // Zbrojni gwardziści Księstwa
  fleetGalleonsCount: number;  // Galeony Floty Kupieckiej
  mageName: string;
  mageLevel: number;
  mageMana: number;
  mageMaxMana: number;
  dragonCompanionName: string;
  dragonCompanionStage: 1 | 2 | 3; // 1 = Pisklę, 2 = Młody Smok, 3 = Pradawny Smok Strażnik
}

export function createInitialDuchyState(raceId: string = 'ludzie'): DuchyState {
  return {
    duchyName:
      raceId === 'krasnoludy'
        ? 'Marchia Żelaznego Szczytu'
        : raceId === 'elfy'
          ? 'Księstwo Srebrnej Korony'
          : 'Księstwo Złotej Przystani',
    rankIndex: 0,
    completedChapterIds: [],
    buildings: {
      faktoria: 1,
      koszary: 1,
      wieza_magow: 1,
      stocznia: 1,
    },
    armyGuardsCount: 25,
    fleetGalleonsCount: 2,
    mageName: 'Arcymag Aureliusz',
    mageLevel: 1,
    mageMana: 60,
    mageMaxMana: 80,
    dragonCompanionName: 'Szkarłatny Vaelor (Smoczy Strażnik)',
    dragonCompanionStage: 1,
  };
}

// --- KNIGHT / HERO SYSTEM & TURN-BASED EXPEDITIONS (WYPRAWY NA REBELIANTÓW I MIEJSCA STRACHU) ---

export interface KnightEquipmentItem {
  id: string;
  slot: 'weapon' | 'armor' | 'mount' | 'relic';
  slotLabel: string;
  name: string;
  bonusText: string;
  costGold: number;
  requiredCommodity?: { id: CommodityId; qty: number };
  strengthBonus: number;
  defenseBonus: number;
  tacticsBonus: number;
  maxHpBonus: number;
}

export const KNIGHT_EQUIPMENT_SHOP: KnightEquipmentItem[] = [
  {
    id: 'eq_miecz_zelazny',
    slot: 'weapon',
    slotLabel: 'Broń Główna',
    name: 'Kuty Miecz z Żelaznej Kuźni',
    bonusText: '+12 Siły Ataku · +4 Taktyki',
    costGold: 1200,
    requiredCommodity: { id: 'zelazo', qty: 8 },
    strengthBonus: 12,
    defenseBonus: 0,
    tacticsBonus: 4,
    maxHpBonus: 15,
  },
  {
    id: 'eq_ostrze_mithril',
    slot: 'weapon',
    slotLabel: 'Broń Główna',
    name: 'Runiczny Claymore z Czystego Mithrilu',
    bonusText: '+28 Siły Ataku · +12 Taktyki · Przebija Smoczą Łuskę',
    costGold: 4200,
    requiredCommodity: { id: 'mithril', qty: 4 },
    strengthBonus: 28,
    defenseBonus: 5,
    tacticsBonus: 12,
    maxHpBonus: 40,
  },
  {
    id: 'eq_zbroja_plytowa',
    slot: 'armor',
    slotLabel: 'Pancerz Rycerski',
    name: 'Królewska Zbroja Płytowa',
    bonusText: '+18 Pancerza · +65 Max HP',
    costGold: 1650,
    requiredCommodity: { id: 'zelazo', qty: 12 },
    strengthBonus: 2,
    defenseBonus: 18,
    tacticsBonus: 0,
    maxHpBonus: 65,
  },
  {
    id: 'eq_pancerz_smoczy',
    slot: 'armor',
    slotLabel: 'Pancerz Rycerski',
    name: 'Pancerz ze Smoczych Łusek i Mithrilu',
    bonusText: '+36 Pancerza · +140 Max HP · Odporność na Ogień',
    costGold: 5600,
    requiredCommodity: { id: 'smocza_luska', qty: 2 },
    strengthBonus: 6,
    defenseBonus: 36,
    tacticsBonus: 8,
    maxHpBonus: 140,
  },
  {
    id: 'eq_rumak_bojowy',
    slot: 'mount',
    slotLabel: 'Wierzchowiec',
    name: 'Opancerzony Destrier Królewski',
    bonusText: '+14 Taktyki · +8 Siły Szarży · +1 Max Tur Wypraw',
    costGold: 1900,
    requiredCommodity: { id: 'zboze', qty: 20 },
    strengthBonus: 8,
    defenseBonus: 6,
    tacticsBonus: 14,
    maxHpBonus: 35,
  },
  {
    id: 'eq_ksiega_run',
    slot: 'relic',
    slotLabel: 'Relikt / Magia',
    name: 'Grymuar Srebrnego Gaju',
    bonusText: '+18 Taktyki i Magii · Leczenie +20 HP po każdej turze',
    costGold: 2800,
    requiredCommodity: { id: 'krysztaly_many', qty: 6 },
    strengthBonus: 10,
    defenseBonus: 8,
    tacticsBonus: 18,
    maxHpBonus: 45,
  },
];

export interface MonsterQuestSpec {
  id: string;
  category: 'rebelianci' | 'miejsca_strachu' | 'smocze_legowisko';
  categoryLabel: string;
  name: string;
  monsterName: string;
  monsterTitle: string;
  loreDescription: string;
  nearCityId: string;
  recommendedLevel: number;
  monsterMaxHp: number;
  monsterAttack: number;
  monsterDefense: number;
  turnsRequired: number;
  rewardGold: number;
  rewardXp: number;
  rewardCommodities: Array<{ id: CommodityId; qty: number }>;
}

export const MONSTER_QUESTS: MonsterQuestSpec[] = [
  {
    id: 'quest_rebelianci_szlak',
    category: 'rebelianci',
    categoryLabel: 'Wyprawa na Rebeliantów',
    name: 'Obóz Herszta Rebeliantów na Trakcie Zbożowym',
    monsterName: 'Herszt Krwawy Kord i Szajka Maruderów',
    monsterTitle: 'Bandyci Szlaku Królewskiego',
    loreDescription:
      'Zuchwali rebelianci blokują mosty pod Królewską Przystanią, napadając na wozy ze zbożem i żelazem. Rozbij ich obóz, by przywrócić bezpieczny handel!',
    nearCityId: 'krolewska_przystan',
    recommendedLevel: 1,
    monsterMaxHp: 135,
    monsterAttack: 22,
    monsterDefense: 10,
    turnsRequired: 3,
    rewardGold: 1450,
    rewardXp: 120,
    rewardCommodities: [
      { id: 'zboze', qty: 20 },
      { id: 'zelazo', qty: 10 },
    ],
  },
  {
    id: 'quest_pajaki_gaj',
    category: 'rebelianci',
    categoryLabel: 'Ochrona Szlaków Leśnych',
    name: 'Gniazdo Cienistych Pająków i Przemytników Run',
    monsterName: 'Matriarchini Arachna z Mrocznej Puszczy',
    monsterTitle: 'Bestia Srebrnego Gaju',
    loreDescription:
      'W głębi lasu wokół Srebrnego Gaju ogromne pająki oplotły sieciami stare skryptoria i tartaki. Oczyść trakt i odzyskaj cenne zwoje.',
    nearCityId: 'srebrny_gaj',
    recommendedLevel: 2,
    monsterMaxHp: 210,
    monsterAttack: 32,
    monsterDefense: 16,
    turnsRequired: 3,
    rewardGold: 2200,
    rewardXp: 190,
    rewardCommodities: [
      { id: 'drewno_elfickie', qty: 14 },
      { id: 'runiczny_pergamin', qty: 6 },
    ],
  },
  {
    id: 'quest_golem_kuznia',
    category: 'miejsca_strachu',
    categoryLabel: 'Wyprawa do Miejsca Strachu',
    name: 'Przeklęta Sztolnia Bazaltowego Golema',
    monsterName: 'Pradawny Golem Runiczny z Głębin Kuźni',
    monsterTitle: 'Strażnik Żyły Mithrilu',
    loreDescription:
      'W najgłębszych korytarzach Żelaznej Kuźni przebudził się kamienny kolos napędzany dziką maną. Pokonanie go otworzy dostęp do czystego Mithrilu.',
    nearCityId: 'zelazna_kuznia',
    recommendedLevel: 3,
    monsterMaxHp: 320,
    monsterAttack: 44,
    monsterDefense: 28,
    turnsRequired: 4,
    rewardGold: 3600,
    rewardXp: 310,
    rewardCommodities: [
      { id: 'mithril', qty: 5 },
      { id: 'krysztaly_many', qty: 6 },
    ],
  },
  {
    id: 'quest_upior_zatoka',
    category: 'miejsca_strachu',
    categoryLabel: 'Wyprawa do Miejsca Strachu',
    name: 'Wrak Widmowego Galeonu na Złotej Zatoce',
    monsterName: 'Kapitan-Upiór Valthor i Przeklęta Załoga',
    monsterTitle: 'Postrach Kupieckiej Floty',
    loreDescription:
      'We mgle Złotej Zatoki pojawia się widmowy okręt pełen skrzyń z zamorskimi przyprawami i kryształami many. Poprowadź abordaż swojego Rycerza!',
    nearCityId: 'zlota_zatoka',
    recommendedLevel: 4,
    monsterMaxHp: 410,
    monsterAttack: 54,
    monsterDefense: 32,
    turnsRequired: 4,
    rewardGold: 4800,
    rewardXp: 420,
    rewardCommodities: [
      { id: 'przyprawy', qty: 18 },
      { id: 'krysztaly_many', qty: 9 },
    ],
  },
  {
    id: 'quest_smok_szczyt',
    category: 'smocze_legowisko',
    categoryLabel: 'Legendarne Miejsce Strachu',
    name: 'Iglica Ognistego Smoka Ignisa na Krwawym Szczycie',
    monsterName: 'Pradawny Smok Ignis Krwiożerczy',
    monsterTitle: 'Władca Krwawego Szczytu',
    loreDescription:
      'Największe wyzwanie w całym Kupieckim Świecie. W wulkanicznej pieczarze Krwawego Szczytu drzemie smok strzegący skarbca i bezcennych Smoczych Łusek.',
    nearCityId: 'krwawy_szczyt',
    recommendedLevel: 5,
    monsterMaxHp: 580,
    monsterAttack: 72,
    monsterDefense: 45,
    turnsRequired: 5,
    rewardGold: 7800,
    rewardXp: 680,
    rewardCommodities: [
      { id: 'smocza_luska', qty: 4 },
      { id: 'mithril', qty: 6 },
    ],
  },
  {
    id: 'quest_sfinks_solaria',
    category: 'miejsca_strachu',
    categoryLabel: 'Wyprawa Zamorska · Solaria',
    name: 'Piramidy Słońca i Piaskowy Sfinks Solarii',
    monsterName: 'Złoty Sfinks Zapomnianych Faraonów',
    monsterTitle: 'Strażnik Czerwonych Kanionów',
    loreDescription:
      'Na południu, wśród palących wydm Kontynentu Solarii, pradawny Sfinks z piaskowca strzeże skarbca pełnego korzennych przypraw i kryształów słońca.',
    nearCityId: 'oaza_alkharim',
    recommendedLevel: 4,
    monsterMaxHp: 440,
    monsterAttack: 58,
    monsterDefense: 34,
    turnsRequired: 4,
    rewardGold: 5200,
    rewardXp: 460,
    rewardCommodities: [
      { id: 'przyprawy', qty: 24 },
      { id: 'krysztaly_many', qty: 8 },
    ],
  },
  {
    id: 'quest_tytan_frostheim',
    category: 'smocze_legowisko',
    categoryLabel: 'Wyprawa Arktyczna · Frostheim',
    name: 'Cytadela Wiecznego Lodu na Północnym Kontynencie',
    monsterName: 'Mroźny Tytan i Wywerna Lodowca',
    monsterTitle: 'Władca Fiordów Frostheimu',
    loreDescription:
      'Pod tańczącą zorzą polarną Północnego Kontynentu drzemie kolos z błękitnego lodu, który uwięził największe złoża żelaza i mithrilu w całym świecie.',
    nearCityId: 'frostgard',
    recommendedLevel: 5,
    monsterMaxHp: 620,
    monsterAttack: 75,
    monsterDefense: 48,
    turnsRequired: 5,
    rewardGold: 8400,
    rewardXp: 720,
    rewardCommodities: [
      { id: 'mithril', qty: 7 },
      { id: 'zelazo', qty: 30 },
    ],
  },
  {
    id: 'quest_korsarz_aetheris',
    category: 'miejsca_strachu',
    categoryLabel: 'Wyprawa Wschodnia · Aetheris',
    name: 'Czarna Zatoka Korsarzy i Skarbiec Pagody',
    monsterName: 'Admirał Cieni i Flota Szmaragdowych Korsarzy',
    monsterTitle: 'Postrach Cieśniny Aetheris',
    loreDescription:
      'Wśród mglisitych szczytów karstowych Wschodniego Kontynentu korsarze przejęli cesarski transport runicznych pergaminów oraz smoczych łusek.',
    nearCityId: 'jadeitowa_przystan',
    recommendedLevel: 4,
    monsterMaxHp: 480,
    monsterAttack: 62,
    monsterDefense: 36,
    turnsRequired: 4,
    rewardGold: 5900,
    rewardXp: 510,
    rewardCommodities: [
      { id: 'runiczny_pergamin', qty: 12 },
      { id: 'smocza_luska', qty: 2 },
    ],
  },
  {
    id: 'quest_wywerny_valoria',
    category: 'smocze_legowisko',
    categoryLabel: 'Wyprawa Zachodnia · Valoria',
    name: 'Gniazdo Pradawnych Wywern nad Wodospadami Valorii',
    monsterName: 'Królowa Wywern Szmaragdowego Klifu',
    monsterTitle: 'Strażniczka Smoczych Gniazd',
    loreDescription:
      'Na niedostępnych wyżynach Valorii dzikie wywerny zagrażają hodowlom młodych smoków i tartakom Valgardu. Zdobądź ich łuski i rzadkie jaja!',
    nearCityId: 'valgard',
    recommendedLevel: 4,
    monsterMaxHp: 510,
    monsterAttack: 64,
    monsterDefense: 38,
    turnsRequired: 4,
    rewardGold: 6400,
    rewardXp: 540,
    rewardCommodities: [
      { id: 'smocza_luska', qty: 3 },
      { id: 'drewno_elfickie', qty: 22 },
    ],
  },
  {
    id: 'quest_tytan_obsydian',
    category: 'smocze_legowisko',
    categoryLabel: 'Wyprawa Wulkaniczna · Obsydian',
    name: 'Otchłań Tytana Magmy na Archipelagu Obsydianowym',
    monsterName: 'Władca Bazaltu i Ognia — Kolos Magmowy',
    monsterTitle: 'Władca Południowo-Wschodniej Kaldery',
    loreDescription:
      'W sercu aktywnego wulkanu Archipelagu Obsydianowego przebudził się ognisty tytan. Tylko najpotężniejszy Rycerz wsparty smokiem wyrwie mu czysty Mithril.',
    nearCityId: 'obsydianowa_cytadela',
    recommendedLevel: 5,
    monsterMaxHp: 690,
    monsterAttack: 82,
    monsterDefense: 52,
    turnsRequired: 5,
    rewardGold: 9600,
    rewardXp: 820,
    rewardCommodities: [
      { id: 'mithril', qty: 8 },
      { id: 'smocza_luska', qty: 5 },
    ],
  },
];

export interface ActiveKnightQuestState {
  questId: string;
  currentStep: number; // 1..turnsRequired
  totalSteps: number;
  monsterCurrentHp: number;
  monsterMaxHp: number;
  combatLogs: string[];
  status: 'in_progress' | 'victory' | 'defeat';
}

export interface KnightState {
  name: string;
  title: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  hp: number;
  maxHp: number;
  strength: number;     // Bazowa siła uderzenia
  defense: number;      // Bazowy pancerz i obrona
  tactics: number;      // Bazowa taktyka, szansa na cios krytyczny i uniki
  availableTurns: number; // Dostępne tury misji
  maxTurns: number;
  nextTurnRegenAt: number; // Timestamp ms
  equippedIds: string[];
  monstersDefeated: number;
  totalLootGold: number;
  activeQuest: ActiveKnightQuestState | null;
  // Personalization, Multi-Path Development & Slot-Based RPG Inventory
  portraitId: string;
  bannerColorHex: string;
  activePath: HeroPathId;
  skillPoints: number;
  pathLevels: Record<HeroPathId, number>;
  ownedItemIds: string[];
  equippedSlots: Partial<Record<EquipmentSlot, string>>;
  recentLootLog: string[];
}

export function createInitialKnightState(raceId: string = 'ludzie'): KnightState {
  const isOrc = raceId === 'orkowie';
  const isDwarf = raceId === 'krasnoludy';
  const isElf = raceId === 'elfy';
  const isGoblin = raceId === 'gobliny';

  const defaultPath: HeroPathId = isElf
    ? 'arcymag'
    : isGoblin
      ? 'kupiec_magnat'
      : isOrc || isDwarf
        ? 'paladyn'
        : 'paladyn';

  const defaultPortrait = isElf
    ? 'portrait_arcanist'
    : isGoblin
      ? 'portrait_merchant'
      : 'portrait_paladin';

  return {
    name: 'Sir Roland z Przystani',
    title: 'Rycerz Gildii Kupieckiej',
    level: 1,
    xp: 0,
    xpToNextLevel: 150,
    hp: isDwarf ? 180 : 160,
    maxHp: isDwarf ? 180 : 160,
    strength: isOrc ? 28 : 22,
    defense: isDwarf ? 20 : 15,
    tactics: isElf ? 22 : 16,
    availableTurns: 6,
    maxTurns: 8,
    nextTurnRegenAt: Date.now() + 1000 * 120,
    equippedIds: ['item_sztylet_kupca'],
    monstersDefeated: 0,
    totalLootGold: 0,
    activeQuest: null,
    portraitId: defaultPortrait,
    bannerColorHex: '#D4AF37',
    activePath: defaultPath,
    skillPoints: 2,
    pathLevels: {
      paladyn: 0,
      kupiec_magnat: 0,
      arcymag: 0,
      zwiadowca: 0,
    },
    ownedItemIds: ['item_sztylet_kupca'],
    equippedSlots: {
      weapon: 'item_sztylet_kupca',
    },
    recentLootLog: [
      'Otrzymano ekwipunek startowy: Kordelas Straży Gildii (+6 Siły, +2 Pancerza).',
    ],
  };
}

export interface TechNode {
  id: string;
  branch: 'handel' | 'produkcja' | 'wojna_fantasy';
  branchLabel: string;
  tier: 1 | 2 | 3;
  name: string;
  description: string;
  effectSummary: string;
  costGold: number;
  requiredCommodity?: { id: CommodityId; qty: number };
  prerequisiteId?: string;
  effectType: 'spread_rebate' | 'storage_cap' | 'caravan_speed' | 'production_yield' | 'combat_escort' | 'mint_yield';
  effectValue: number;
}

export const TECH_TREE: TechNode[] = [
  // Branch 1: Droga Handlu i Giełdy
  {
    id: 'handel_1',
    branch: 'handel',
    branchLabel: 'Droga Handlu i Giełdy',
    tier: 1,
    name: 'Księgi Kupieckie i Prawo Targowe',
    description: 'Oficjalny wpis do rejestru kupców Królewskiej Przystani z dostępem do tablicy ofert miast i graczy.',
    effectSummary: '-15% opłaty targowej i korzystniejsze kursy wymiany',
    costGold: 2200,
    effectType: 'spread_rebate',
    effectValue: 0.15,
  },
  {
    id: 'handel_2',
    branch: 'handel',
    branchLabel: 'Droga Handlu i Giełdy',
    tier: 2,
    name: 'Wieże Sygnałowe i Gołębie Pocztowe',
    description: 'Szybkie przekazywanie aktualnych kursów surowców i pogody pomiędzy wszystkimi 5 miastami.',
    effectSummary: '+25% prędkości karawan handlowych i +12% zysku na szlaku',
    costGold: 4800,
    requiredCommodity: { id: 'runiczny_pergamin', qty: 8 },
    prerequisiteId: 'handel_1',
    effectType: 'caravan_speed',
    effectValue: 0.25,
  },
  {
    id: 'handel_3',
    branch: 'handel',
    branchLabel: 'Droga Handlu i Giełdy',
    tier: 3,
    name: 'Przywilej Królewskiego Bankiera',
    description: 'Pełny udział w operacjach Królewskiej Mennicy oraz pierwszeństwo zakupu nadwyżek miejskich.',
    effectSummary: '-25% kosztów transakcyjnych oraz wyższe oprocentowanie lokat Mennicy',
    costGold: 9500,
    requiredCommodity: { id: 'krysztaly_many', qty: 12 },
    prerequisiteId: 'handel_2',
    effectType: 'mint_yield',
    effectValue: 0.25,
  },

  // Branch 2: Droga Produkcji i Rzemiosła
  {
    id: 'prod_1',
    branch: 'produkcja',
    branchLabel: 'Droga Produkcji i Spichlerzy',
    tier: 1,
    name: 'Młyny Wodne i Dymarki',
    description: 'Rozbudowa warsztatów przetwarzających zboże, drewno oraz rudę żelaza.',
    effectSummary: '+20% wydajności produkcji własnych manufaktur',
    costGold: 2000,
    effectType: 'production_yield',
    effectValue: 0.20,
  },
  {
    id: 'prod_2',
    branch: 'produkcja',
    branchLabel: 'Droga Produkcji i Spichlerzy',
    tier: 2,
    name: 'Kamienne Spichlerze Zimowe',
    description: 'Zabezpieczenie zapasów przed mrozem, wilgocią oraz opłatami składowymi.',
    effectSummary: '+200 jednostek bezpłatnej pojemności magazynów kupieckich',
    costGold: 4500,
    requiredCommodity: { id: 'zelazo', qty: 25 },
    prerequisiteId: 'prod_1',
    effectType: 'storage_cap',
    effectValue: 200,
  },
  {
    id: 'prod_3',
    branch: 'produkcja',
    branchLabel: 'Droga Produkcji i Spichlerzy',
    tier: 3,
    name: 'Wielka Kuźnia Alchemiczna Mithrilu',
    description: 'Połączenie krasnoludzkiego kowalstwa z magią kryształów many do wytopu najczystszych sztab.',
    effectSummary: '+35% produkcji rzadkich surowców (Mithril, Kryształy Many)',
    costGold: 9200,
    requiredCommodity: { id: 'mithril', qty: 8 },
    prerequisiteId: 'prod_2',
    effectType: 'production_yield',
    effectValue: 0.35,
  },

  // Branch 3: Droga Rycerza i Wypraw Bojowych
  {
    id: 'wojna_1',
    branch: 'wojna_fantasy',
    branchLabel: 'Droga Rycerza i Wypraw (Rebelianci & Smoki)',
    tier: 1,
    name: 'Zakon Rycerzy Szlaku',
    description: 'Szkolenie taktyczne dla Twojego Rycerza oraz zbrojnych eskortujących wozy kupieckie.',
    effectSummary: '+15% siły bojowej Rycerza i -35% ryzyka napadu Rebeliantów',
    costGold: 2100,
    effectType: 'combat_escort',
    effectValue: 0.35,
  },
  {
    id: 'wojna_2',
    branch: 'wojna_fantasy',
    branchLabel: 'Droga Rycerza i Wypraw (Rebelianci & Smoki)',
    tier: 2,
    name: 'Kolegium Magów Bitewnych',
    description: 'Wsparcie zaklęć ochronnych i runicznych ostrzy podczas turowych wypraw do Miejsc Strachu.',
    effectSummary: '+25% obrażeń Rycerza przeciw potworom oraz większe łupy z wypraw',
    costGold: 5000,
    requiredCommodity: { id: 'krysztaly_many', qty: 10 },
    prerequisiteId: 'wojna_1',
    effectType: 'combat_escort',
    effectValue: 0.25,
  },
  {
    id: 'wojna_3',
    branch: 'wojna_fantasy',
    branchLabel: 'Droga Rycerza i Wypraw (Rebelianci & Smoki)',
    tier: 3,
    name: 'Bractwo Pogromców Smoków',
    description: 'Mistrzowskie wyszkolenie pozwalające stawiać czoła Pradawnym Smokom z Krwawego Szczytu.',
    effectSummary: 'Maksymalna siła Rycerza oraz 98% bezpieczeństwa wszystkich szlaków',
    costGold: 10500,
    requiredCommodity: { id: 'smocza_luska', qty: 4 },
    prerequisiteId: 'wojna_2',
    effectType: 'combat_escort',
    effectValue: 0.40,
  },
];

export interface AuctionItem {
  id: string;
  sellerName: string;
  sellerGuild: string;
  itemName: string;
  commodityId: CommodityId;
  quantity: number;
  rarity: 'Pospolity' | 'Rzadki' | 'Epicki' | 'Legendarny';
  auctionType: 'english' | 'dutch';
  startPrice: number;
  currentBid: number;
  buyoutPrice: number;
  highestBidder: string;
  bidsCount: number;
  expiresAt: number;
}

export interface ChatMessage {
  id: string;
  channel: 'globalny' | 'handel' | 'gildia';
  sender: string;
  senderTitle: string;
  guildTag: string;
  text: string;
  timestamp: string;
}

export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  level: number;
  membersCount: number;
  treasuryGold: number;
  specialty: string;
  taxRebatePct: number;
  leader: string;
}

export interface LeaderboardEntry {
  historyUid?: string;
  rank: number;
  name: string;
  race: string;
  guildTag: string;
  netWorth: number;
  knightLevel: number;
  monstersDefeated: number;
  winRatePct: number;
  specialty: string;
  isPlayer?: boolean;
}
