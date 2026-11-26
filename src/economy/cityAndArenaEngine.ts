import { imageUrl } from '../utils/imageUrl';
import { CITIES, type CityNode } from './economyEngine';
import type { LeaderboardEntry } from './gameData';
import { HERO_PORTRAITS } from './heroProgression';

export type CityAtmosphereTheme =
  | 'gold_motes'
  | 'desert_shimmer'
  | 'frost_embers'
  | 'volcanic_sparks'
  | 'jade_petals';

export type CityDistrictActionId = 'market' | 'arena' | 'forge' | 'tavern' | 'gate';

export interface CityHotspotSpec {
  id: CityDistrictActionId;
  label: string;
  subtitle: string;
  xPct: number;
  yPct: number;
  accentHex: string;
}

export interface CityInteriorSpec {
  cityId: string;
  backdropUrl: string;
  atmosphere: CityAtmosphereTheme;
  districtTagline: string;
  welcomeLine: string;
  tavernName: string;
  tavernMealLabel: string;
  tavernRestCostGold: number;
  cityPerkLabel: string;
  hotspots: CityHotspotSpec[];
}

export type ArenaMoveId = 'strike' | 'heavy_cleave' | 'shield_riposte' | 'arcane_surge';

export interface ArenaMoveSpec {
  id: ArenaMoveId;
  name: string;
  shortDesc: string;
  staminaCost: number;
  staminaGain: number;
  accentHex: string;
}

export const ARENA_MOVES: ArenaMoveSpec[] = [
  {
    id: 'strike',
    name: 'Cios Rycerski',
    shortDesc: 'Pewne cięcie mieczem · +22 Furii',
    staminaCost: 0,
    staminaGain: 22,
    accentHex: '#F59E0B',
  },
  {
    id: 'heavy_cleave',
    name: 'Potężne Rozcięcie',
    shortDesc: 'Przebija pancerz · wysoka szansa krytyka (-25 Furii)',
    staminaCost: 25,
    staminaGain: 0,
    accentHex: '#F43F5E',
  },
  {
    id: 'shield_riposte',
    name: 'Garda i Kontra',
    shortDesc: 'Blokuje 55% obrażeń · szybka kontra + oddech (+16 Furii)',
    staminaCost: 0,
    staminaGain: 16,
    accentHex: '#38BDF8',
  },
  {
    id: 'arcane_surge',
    name: 'Uderzenie Runiczne',
    shortDesc: 'Obrażenia runiczne ignorujące pancerz + ogłuszenie (-40 Furii)',
    staminaCost: 40,
    staminaGain: 0,
    accentHex: '#A855F7',
  },
];

export interface ArenaOpponentSpec {
  id: string;
  name: string;
  title: string;
  guildTag: string;
  cityId: string;
  cityName: string;
  level: number;
  archetypeLabel: string;
  portraitUrl: string;
  bannerHex: string;
  maxHp: number;
  strength: number;
  defense: number;
  tactics: number;
  entryFeeGold: number;
  rewardGold: number;
  rewardXp: number;
  ratingGain: number;
  signatureMoveName: string;
  isCityChampion?: boolean;
  isPlayerRival?: boolean;
}

export interface ArenaCombatantStats {
  name: string;
  title: string;
  level: number;
  portraitUrl: string;
  bannerHex: string;
  maxHp: number;
  strength: number;
  defense: number;
  tactics: number;
  arcaneBonusDmg: number;
}

export interface ArenaTurnExchange {
  round: number;
  playerMove: ArenaMoveId;
  enemyMove: ArenaMoveId;
  playerMoveName: string;
  enemyMoveName: string;
  playerDmgDealt: number;
  enemyDmgDealt: number;
  playerHeal: number;
  playerCrit: boolean;
  enemyCrit: boolean;
  playerBlocked: boolean;
  enemyBlocked: boolean;
  enemyStaggered: boolean;
  narrative: string;
}

export interface ArenaDuelState {
  opponent: ArenaOpponentSpec;
  player: ArenaCombatantStats;
  playerHp: number;
  playerStamina: number;
  enemyHp: number;
  enemyStamina: number;
  round: number;
  status: 'fighting' | 'victory' | 'defeat';
  lastExchange: ArenaTurnExchange | null;
  log: string[];
}

const IMG_ROYAL_PLAZA = imageUrl('city_interior_royal_plaza_1795677100750.jpg');
const IMG_DESERT_BAZAAR = imageUrl('city_interior_desert_bazaar_1795677101435.jpg');
const IMG_FROST_CITADEL = imageUrl('city_interior_frost_citadel_1795677103496.jpg');
const IMG_CITADEL_FALLBACK = imageUrl('cinematic_city_citadel_1795641277369.jpg');
export const IMG_KNIGHT_ARENA = imageUrl('knight_tournament_arena_1795677103437.jpg');

const PORTRAIT_PALADIN = HERO_PORTRAITS[0].imageUrl;
const PORTRAIT_MERCHANT = HERO_PORTRAITS[1].imageUrl;
const PORTRAIT_ARCANIST = HERO_PORTRAITS[2].imageUrl;
const PORTRAIT_RANGER = HERO_PORTRAITS[3].imageUrl;

const ROYAL_PLAZA_HOTSPOTS: CityHotspotSpec[] = [
  { id: 'forge', label: 'Kuźnia Mistrzów', subtitle: 'Zbrojownia & Ulepszenia', xPct: 16, yPct: 68, accentHex: '#F97316' },
  { id: 'tavern', label: 'Karczma Kupiecka', subtitle: 'Leczenie HP + Plotki', xPct: 31, yPct: 50, accentHex: '#10B981' },
  { id: 'arena', label: 'Arena Rycerska', subtitle: 'Pojedynki Rycerzy', xPct: 58, yPct: 28, accentHex: '#F43F5E' },
  { id: 'market', label: 'Hala Giełdowa', subtitle: 'Handel Towarami Live', xPct: 67, yPct: 64, accentHex: '#F59E0B' },
  { id: 'gate', label: 'Port & Karawany', subtitle: 'Wysyłka Konwojów 3D', xPct: 87, yPct: 52, accentHex: '#38BDF8' },
];

const DESERT_BAZAAR_HOTSPOTS: CityHotspotSpec[] = [
  { id: 'market', label: 'Wielki Bazar', subtitle: 'Przyprawy & Handel Live', xPct: 24, yPct: 72, accentHex: '#F59E0B' },
  { id: 'arena', label: 'Arena Sułtana', subtitle: 'Pojedynki Rycerzy', xPct: 50, yPct: 33, accentHex: '#F43F5E' },
  { id: 'tavern', label: 'Pawilon Oazy', subtitle: 'Pełne HP + Regeneracja', xPct: 50, yPct: 66, accentHex: '#10B981' },
  { id: 'forge', label: 'Zbrojownia Pustyni', subtitle: 'Broń & Relikty', xPct: 79, yPct: 66, accentHex: '#F97316' },
  { id: 'gate', label: 'Brama Karawan', subtitle: 'Szlaki Zamorskie 3D', xPct: 82, yPct: 36, accentHex: '#38BDF8' },
];

const FROST_CITADEL_HOTSPOTS: CityHotspotSpec[] = [
  { id: 'tavern', label: 'Hala Biesiadna', subtitle: 'Ogień, Miód & Leczenie', xPct: 15, yPct: 52, accentHex: '#10B981' },
  { id: 'arena', label: 'Krąg Walki', subtitle: 'Turniej Rycerzy', xPct: 45, yPct: 33, accentHex: '#F43F5E' },
  { id: 'forge', label: 'Wielki Piec Kuźni', subtitle: 'Pancerze & Mithril', xPct: 62, yPct: 60, accentHex: '#F97316' },
  { id: 'market', label: 'Dom Kupiecki', subtitle: 'Giełda Surowców', xPct: 80, yPct: 56, accentHex: '#F59E0B' },
  { id: 'gate', label: 'Przełęcz Karawan', subtitle: 'Konwoje Górskie 3D', xPct: 36, yPct: 74, accentHex: '#38BDF8' },
];

export const CITY_INTERIOR_SPECS: Record<string, CityInteriorSpec> = {
  krolewska_przystan: {
    cityId: 'krolewska_przystan',
    backdropUrl: IMG_ROYAL_PLAZA,
    atmosphere: 'gold_motes',
    districtTagline: 'Plac Złotej Wagi · Stolica Księstwa',
    welcomeLine: 'Dzwony portu wybijają otwarcie sesji. Na dziedzińcu krzyżują się szlaki sześciu kontynentów.',
    tavernName: 'Gospoda Pod Złotym Gryfem',
    tavernMealLabel: 'Królewska uczta i ziołowy napar',
    tavernRestCostGold: 120,
    cityPerkLabel: 'Główna Mennica i największa płynność giełdowa Zboża',
    hotspots: ROYAL_PLAZA_HOTSPOTS,
  },
  srebrny_gaj: {
    cityId: 'srebrny_gaj',
    backdropUrl: IMG_CITADEL_FALLBACK,
    atmosphere: 'jade_petals',
    districtTagline: 'Dziedziniec Srebrnych Koron · Dolina Elfów',
    welcomeLine: 'Wśród kamiennych łuków pachnie żywicą elfickich dębów i atramentem runicznych skryptoriów.',
    tavernName: 'Pawilon Księżycowej Rosy',
    tavernMealLabel: 'Eliksir żywotności i leśny chleb',
    tavernRestCostGold: 140,
    cityPerkLabel: 'Tanie Drewno Elfickie i błogosławieństwa skryptoriów',
    hotspots: ROYAL_PLAZA_HOTSPOTS,
  },
  zelazna_kuznia: {
    cityId: 'zelazna_kuznia',
    backdropUrl: IMG_FROST_CITADEL,
    atmosphere: 'frost_embers',
    districtTagline: 'Taras Wielkich Kowadeł · 1 150 m n.p.m.',
    welcomeLine: 'Rytmiczny łoskot młotów krasnoludzkich niesie się po ośnieżonych murach cytadeli.',
    tavernName: 'Karczma Żarzącego Kowadła',
    tavernMealLabel: 'Grzany miód górski i pieczeń z dzika',
    tavernRestCostGold: 150,
    cityPerkLabel: 'Najlepsze ceny czystego Mithrilu i mistrzowska kuźnia',
    hotspots: FROST_CITADEL_HOTSPOTS,
  },
  krwawy_szczyt: {
    cityId: 'krwawy_szczyt',
    backdropUrl: IMG_FROST_CITADEL,
    atmosphere: 'volcanic_sparks',
    districtTagline: 'Bazaltowy Dziedziniec Wojenny · 1 420 m n.p.m.',
    welcomeLine: 'Iskry z pobliskiego krateru tańczą nad areną, gdzie łowcy smoków testują nową stal.',
    tavernName: 'Szałas Pogromców Smoka',
    tavernMealLabel: 'Ognisty gulasz wojenny',
    tavernRestCostGold: 170,
    cityPerkLabel: 'Centrum handlu Smoczymi Łuskami i twarda arena mistrzów',
    hotspots: FROST_CITADEL_HOTSPOTS,
  },
  zlota_zatoka: {
    cityId: 'zlota_zatoka',
    backdropUrl: IMG_DESERT_BAZAAR,
    atmosphere: 'desert_shimmer',
    districtTagline: 'Kolumnada Galeonów · Archipelag Południowy',
    welcomeLine: 'Kupcy z całej Solarii licytują skrzynie Kryształów Many w cieniu jedwabnych baldachimów.',
    tavernName: 'Dom Bursztynowej Latarni',
    tavernMealLabel: 'Korzenne wino i pieczona dorada',
    tavernRestCostGold: 150,
    cityPerkLabel: 'Brama morska dla Kryształów Many i handlu międzykontynentalnego',
    hotspots: DESERT_BAZAAR_HOTSPOTS,
  },
  oaza_alkharim: {
    cityId: 'oaza_alkharim',
    backdropUrl: IMG_DESERT_BAZAAR,
    atmosphere: 'desert_shimmer',
    districtTagline: 'Wielki Suk Sułtanatu · Oaza Przypraw',
    welcomeLine: 'Szum mozaikowej fontanny chłodzi powietrze przesycone szafranem, kardamonem i złotem.',
    tavernName: 'Karawanseraj Tysiąca Lamp',
    tavernMealLabel: 'Daktyle, szafranowa herbata i odpoczynek',
    tavernRestCostGold: 160,
    cityPerkLabel: 'Najniższe ceny egzotycznych Przypraw w całym świecie',
    hotspots: DESERT_BAZAAR_HOTSPOTS,
  },
  frostgard: {
    cityId: 'frostgard',
    backdropUrl: IMG_FROST_CITADEL,
    atmosphere: 'frost_embers',
    districtTagline: 'Twierdza Lodowego Fiordu · Północny Bastion',
    welcomeLine: 'Żelazne koksowniki płoną jasno pod północnym niebem, witając galeony ze stali i futer.',
    tavernName: 'Długi Dom Zorzy Polarnej',
    tavernMealLabel: 'Rozgrzewający bulion z łososia i miód',
    tavernRestCostGold: 165,
    cityPerkLabel: 'Obfite złoża północnego Żelaza i hartowani rycerze fiordu',
    hotspots: FROST_CITADEL_HOTSPOTS,
  },
  jadeitowa_przystan: {
    cityId: 'jadeitowa_przystan',
    backdropUrl: IMG_DESERT_BAZAAR,
    atmosphere: 'jade_petals',
    districtTagline: 'Cesarski Dziedziniec Pagód · Cesarstwo Aetheris',
    welcomeLine: 'Jedwabne chorągwie powiewają nad dziedzińcem uczonych, gdzie rodzą się potężne pergaminy.',
    tavernName: 'Herbaciarnia Szmaragdowego Smoka',
    tavernMealLabel: 'Cesarska herbata regenerująca siły',
    tavernRestCostGold: 175,
    cityPerkLabel: 'Mistrzowskie Runiczne Pergaminy i wysoki popyt na Mithril',
    hotspots: DESERT_BAZAAR_HOTSPOTS,
  },
  valgard: {
    cityId: 'valgard',
    backdropUrl: IMG_ROYAL_PLAZA,
    atmosphere: 'jade_petals',
    districtTagline: 'Górny Rynek Wodospadów · Wyżyny Valorii',
    welcomeLine: 'Nad szmaragdowymi urwiskami słychać krzyk wywern, a targowisko tętni handlem drewnem.',
    tavernName: 'Gospoda Pod Skrzydłem Wywerny',
    tavernMealLabel: 'Biesiada góralska i ziołowy balsam',
    tavernRestCostGold: 170,
    cityPerkLabel: 'Dostawy szlachetnego Drewna i szlaki ku Smoczej Przystani',
    hotspots: ROYAL_PLAZA_HOTSPOTS,
  },
  smocza_przystan: {
    cityId: 'smocza_przystan',
    backdropUrl: IMG_ROYAL_PLAZA,
    atmosphere: 'gold_motes',
    districtTagline: 'Sanktuarium Smoczych Klifów · Zachodni Port',
    welcomeLine: 'Rycerze Zakonu Smoczych Hodowców szykują wierzchowce do turnieju nad klifową zatoką.',
    tavernName: 'Dom Złotej Łuski',
    tavernMealLabel: 'Uczta smoczych jeźdźców',
    tavernRestCostGold: 185,
    cityPerkLabel: 'Elitarny rynek Smoczych Łusek i prestiżowe pojedynki',
    hotspots: ROYAL_PLAZA_HOTSPOTS,
  },
  obsydianowa_cytadela: {
    cityId: 'obsydianowa_cytadela',
    backdropUrl: IMG_FROST_CITADEL,
    atmosphere: 'volcanic_sparks',
    districtTagline: 'Czarne Tarasy Magmy · Archipelag Obsydianowy',
    welcomeLine: 'Wśród łuny podziemnych rzek lawy wykuwa się najtwardsze miecze i pancerze starego świata.',
    tavernName: 'Kuźnia i Gospoda Bazaltowa',
    tavernMealLabel: 'Wulkaniczny napar wzmacniający',
    tavernRestCostGold: 210,
    cityPerkLabel: 'Najwyższej próby Mithril i najbogatsza pula nagród Areny',
    hotspots: FROST_CITADEL_HOTSPOTS,
  },
  port_popiolow: {
    cityId: 'port_popiolow',
    backdropUrl: IMG_DESERT_BAZAAR,
    atmosphere: 'volcanic_sparks',
    districtTagline: 'Geotermalne Nabrzeże · Południowy Obsydian',
    welcomeLine: 'Korsarze i magnaci spotykają się w świetle latarń nad gorącymi źródłami wulkanicznej zatoki.',
    tavernName: 'Tawerna Czarnej Kotwicy',
    tavernMealLabel: 'Rum korzenny i pieczeń korsarska',
    tavernRestCostGold: 195,
    cityPerkLabel: 'Szybkie szlaki z Kryształami Many i turnieje bez taryfy ulgowej',
    hotspots: DESERT_BAZAAR_HOTSPOTS,
  },
};

export function getCityInteriorSpec(cityId: string): CityInteriorSpec {
  return CITY_INTERIOR_SPECS[cityId] ?? CITY_INTERIOR_SPECS.krolewska_przystan;
}

export const CITY_ARENA_CHAMPIONS: ArenaOpponentSpec[] = [
  {
    id: 'champ_krolewska_przystan',
    name: 'Sir Aldric Złotopióry',
    title: 'Czempion Królewskiej Przystani',
    guildTag: '[KORONA]',
    cityId: 'krolewska_przystan',
    cityName: 'Królewska Przystań',
    level: 1,
    archetypeLabel: 'Paladyn Gwardii',
    portraitUrl: PORTRAIT_PALADIN,
    bannerHex: '#D4AF37',
    maxHp: 115,
    strength: 18,
    defense: 11,
    tactics: 12,
    entryFeeGold: 150,
    rewardGold: 480,
    rewardXp: 75,
    ratingGain: 22,
    signatureMoveName: 'Szarża Złotego Lwa',
    isCityChampion: true,
  },
  {
    id: 'champ_srebrny_gaj',
    name: 'Faelar Srebrne Ostrze',
    title: 'Mistrz Ostrzy Srebrnego Gaju',
    guildTag: '[GAJ]',
    cityId: 'srebrny_gaj',
    cityName: 'Srebrny Gaj',
    level: 2,
    archetypeLabel: 'Fechmistrz Elfów',
    portraitUrl: PORTRAIT_RANGER,
    bannerHex: '#10B981',
    maxHp: 132,
    strength: 22,
    defense: 13,
    tactics: 18,
    entryFeeGold: 220,
    rewardGold: 680,
    rewardXp: 95,
    ratingGain: 26,
    signatureMoveName: 'Taniec Liści',
    isCityChampion: true,
  },
  {
    id: 'champ_zelazna_kuznia',
    name: 'Thain Borin Żelaznobrody',
    title: 'Młot Żelaznej Kuźni',
    guildTag: '[KUŹNIA]',
    cityId: 'zelazna_kuznia',
    cityName: 'Żelazna Kuźnia',
    level: 3,
    archetypeLabel: 'Pancerny Krasnolud',
    portraitUrl: PORTRAIT_PALADIN,
    bannerHex: '#F59E0B',
    maxHp: 165,
    strength: 26,
    defense: 20,
    tactics: 14,
    entryFeeGold: 300,
    rewardGold: 950,
    rewardXp: 120,
    ratingGain: 30,
    signatureMoveName: 'Grzmot Kowadła',
    isCityChampion: true,
  },
  {
    id: 'champ_krwawy_szczyt',
    name: 'Wódz Kargath Krwawy Kieł',
    title: 'Gladiator Krwawego Szczytu',
    guildTag: '[SZCZYT]',
    cityId: 'krwawy_szczyt',
    cityName: 'Krwawy Szczyt',
    level: 4,
    archetypeLabel: 'Berserker Wulkanu',
    portraitUrl: PORTRAIT_RANGER,
    bannerHex: '#F43F5E',
    maxHp: 185,
    strength: 33,
    defense: 17,
    tactics: 18,
    entryFeeGold: 380,
    rewardGold: 1220,
    rewardXp: 145,
    ratingGain: 34,
    signatureMoveName: 'Furia Smoczego Ognia',
    isCityChampion: true,
  },
  {
    id: 'champ_zlota_zatoka',
    name: 'Kapitan Vexis Złotoszpon',
    title: 'Szermierz Złotej Zatoki',
    guildTag: '[ZATOKA]',
    cityId: 'zlota_zatoka',
    cityName: 'Złota Zatoka',
    level: 3,
    archetypeLabel: 'Korsarz-Taktyk',
    portraitUrl: PORTRAIT_MERCHANT,
    bannerHex: '#38BDF8',
    maxHp: 148,
    strength: 25,
    defense: 15,
    tactics: 24,
    entryFeeGold: 280,
    rewardGold: 890,
    rewardXp: 115,
    ratingGain: 28,
    signatureMoveName: 'Podwójny Sztych',
    isCityChampion: true,
  },
  {
    id: 'champ_oaza_alkharim',
    name: 'Emir Tariq al-Sahra',
    title: 'Strażnik Słońca Solarii',
    guildTag: '[SOLARIA]',
    cityId: 'oaza_alkharim',
    cityName: 'Oaza Al-Kharim',
    level: 4,
    archetypeLabel: 'Jeździec Pustyni',
    portraitUrl: PORTRAIT_MERCHANT,
    bannerHex: '#FB923C',
    maxHp: 172,
    strength: 29,
    defense: 18,
    tactics: 22,
    entryFeeGold: 360,
    rewardGold: 1150,
    rewardXp: 140,
    ratingGain: 32,
    signatureMoveName: 'Burza Bułatu',
    isCityChampion: true,
  },
  {
    id: 'champ_frostgard',
    name: 'Jarl Sigurd Mroźna Tarcza',
    title: 'Obrońca Fiordów Frostgardu',
    guildTag: '[LÓD]',
    cityId: 'frostgard',
    cityName: 'Frostgard',
    level: 5,
    archetypeLabel: 'Wiking Runiczny',
    portraitUrl: PORTRAIT_PALADIN,
    bannerHex: '#60A5FA',
    maxHp: 215,
    strength: 34,
    defense: 24,
    tactics: 20,
    entryFeeGold: 450,
    rewardGold: 1480,
    rewardXp: 175,
    ratingGain: 38,
    signatureMoveName: 'Lodowy Rozłam',
    isCityChampion: true,
  },
  {
    id: 'champ_jadeitowa_przystan',
    name: 'Mistrz Shen Aetheris',
    title: 'Arcymag Ostrza Jadeitu',
    guildTag: '[AETHER]',
    cityId: 'jadeitowa_przystan',
    cityName: 'Jadeitowa Przystań',
    level: 5,
    archetypeLabel: 'Mag Bitewny',
    portraitUrl: PORTRAIT_ARCANIST,
    bannerHex: '#2DD4BF',
    maxHp: 196,
    strength: 35,
    defense: 20,
    tactics: 28,
    entryFeeGold: 480,
    rewardGold: 1580,
    rewardXp: 185,
    ratingGain: 40,
    signatureMoveName: 'Błyskawica Jadeitu',
    isCityChampion: true,
  },
  {
    id: 'champ_valgard',
    name: 'Lady Lyra z Wyżyn',
    title: 'Łowczyni Wywern Valorii',
    guildTag: '[VALORIA]',
    cityId: 'valgard',
    cityName: 'Valgard (Wyżyny)',
    level: 6,
    archetypeLabel: 'Zwiadowca Królewski',
    portraitUrl: PORTRAIT_RANGER,
    bannerHex: '#22C55E',
    maxHp: 224,
    strength: 39,
    defense: 22,
    tactics: 30,
    entryFeeGold: 540,
    rewardGold: 1820,
    rewardXp: 210,
    ratingGain: 42,
    signatureMoveName: 'Strzał Sokolnicy',
    isCityChampion: true,
  },
  {
    id: 'champ_smocza_przystan',
    name: 'Komtur Drakonis',
    title: 'Mistrz Zakonu Smoczych Jeźdźców',
    guildTag: '[SMOKI]',
    cityId: 'smocza_przystan',
    cityName: 'Smocza Przystań',
    level: 7,
    archetypeLabel: 'Rycerz Smoczy',
    portraitUrl: PORTRAIT_PALADIN,
    bannerHex: '#4ADE80',
    maxHp: 260,
    strength: 44,
    defense: 27,
    tactics: 26,
    entryFeeGold: 640,
    rewardGold: 2200,
    rewardXp: 250,
    ratingGain: 46,
    signatureMoveName: 'Płonąca Lanca',
    isCityChampion: true,
  },
  {
    id: 'champ_obsydianowa_cytadela',
    name: 'Lord Ignis-Zbrojny',
    title: 'Niepokonany z Obsydianu',
    guildTag: '[MAGMA]',
    cityId: 'obsydianowa_cytadela',
    cityName: 'Obsydianowa Cytadela',
    level: 8,
    archetypeLabel: 'Tytan Kuźni',
    portraitUrl: PORTRAIT_ARCANIST,
    bannerHex: '#F97316',
    maxHp: 305,
    strength: 50,
    defense: 32,
    tactics: 28,
    entryFeeGold: 780,
    rewardGold: 2750,
    rewardXp: 310,
    ratingGain: 52,
    signatureMoveName: 'Kataklizm Obsydianu',
    isCityChampion: true,
  },
  {
    id: 'champ_port_popiolow',
    name: 'Admirał Kaelen Popielny',
    title: 'Czempion Portu Popiołów',
    guildTag: '[POPIÓŁ]',
    cityId: 'port_popiolow',
    cityName: 'Port Popiołów',
    level: 7,
    archetypeLabel: 'Pojedynkowicz Korsarzy',
    portraitUrl: PORTRAIT_MERCHANT,
    bannerHex: '#EA580C',
    maxHp: 252,
    strength: 43,
    defense: 25,
    tactics: 32,
    entryFeeGold: 620,
    rewardGold: 2150,
    rewardXp: 245,
    ratingGain: 45,
    signatureMoveName: 'Salwa Żaru',
    isCityChampion: true,
  },
];

/**
 * Builds the arena challenger roster for a given city:
 * 1. Local City Champion (always featured first)
 * 2. Rival Player Knights from the live realm leaderboard (excluding the player)
 */
export function buildArenaOpponentsForCity(
  cityId: string,
  leaderboard: LeaderboardEntry[],
  playerLevel: number,
): ArenaOpponentSpec[] {
  const localChampion =
    CITY_ARENA_CHAMPIONS.find((c) => c.cityId === cityId) ?? CITY_ARENA_CHAMPIONS[0];
  const cityObj: CityNode = CITIES.find((c) => c.id === cityId) ?? CITIES[0];

  const portraits = [PORTRAIT_PALADIN, PORTRAIT_ARCANIST, PORTRAIT_RANGER, PORTRAIT_MERCHANT];
  const banners = ['#D4AF37', '#38BDF8', '#F43F5E', '#10B981', '#A855F7'];

  const rivalKnights: ArenaOpponentSpec[] = leaderboard
    .filter((entry) => !entry.isPlayer)
    .slice(0, 4)
    .map((entry, idx) => {
      const lvl = Math.max(1, Math.min(10, entry.knightLevel || Math.max(1, playerLevel + idx - 1)));
      const maxHp = 95 + lvl * 24;
      const strength = 15 + lvl * 4;
      const defense = 9 + lvl * 3;
      const tactics = 10 + lvl * 3;
      const entryFeeGold = 120 + lvl * 65;
      const rewardGold = Math.round(entryFeeGold * 3.1);

      return {
        id: `rival_${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${idx}`,
        name: entry.name,
        title: `Rycerz Gracza · ${entry.race}`,
        guildTag: entry.guildTag || '[RYWAL]',
        cityId: cityObj.id,
        cityName: cityObj.name,
        level: lvl,
        archetypeLabel: entry.specialty || 'Rycerz Gildii',
        portraitUrl: portraits[idx % portraits.length],
        bannerHex: banners[idx % banners.length],
        maxHp,
        strength,
        defense,
        tactics,
        entryFeeGold,
        rewardGold,
        rewardXp: 65 + lvl * 28,
        ratingGain: 20 + lvl * 4,
        signatureMoveName: idx % 2 === 0 ? 'Kontra Kupiecka' : 'Natarcie Zakonu',
        isPlayerRival: true,
      };
    });

  return [localChampion, ...rivalKnights];
}

export function initArenaDuel(
  player: ArenaCombatantStats,
  opponent: ArenaOpponentSpec,
): ArenaDuelState {
  return {
    opponent,
    player,
    playerHp: Math.max(1, Math.round(player.maxHp)),
    playerStamina: 40,
    enemyHp: Math.max(1, Math.round(opponent.maxHp)),
    enemyStamina: 35,
    round: 1,
    status: 'fighting',
    lastExchange: null,
    log: [
      `Herold ogłasza pojedynek na Arenie (${opponent.cityName}): ${player.name} vs ${opponent.name} (Poz. ${opponent.level})!`,
    ],
  };
}

function deterministicRoll(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function chooseEnemyMove(
  enemyHp: number,
  enemyMaxHp: number,
  enemyStamina: number,
  round: number,
  roll: number,
): ArenaMoveId {
  if (enemyStamina >= 40 && (roll > 0.55 || round % 3 === 0)) return 'arcane_surge';
  if (enemyHp < enemyMaxHp * 0.42 && roll > 0.45) return 'shield_riposte';
  if (enemyStamina >= 25 && roll > 0.35) return 'heavy_cleave';
  return 'strike';
}

/**
 * Pure deterministic turn-based Knight Arena combat resolver.
 */
export function resolveArenaTurn(
  state: ArenaDuelState,
  moveId: ArenaMoveId,
  rngSeed: number = state.round * 131 + state.playerHp * 17,
): ArenaDuelState {
  if (state.status !== 'fighting') return state;

  const moveSpec = ARENA_MOVES.find((m) => m.id === moveId) ?? ARENA_MOVES[0];
  const effectiveMove: ArenaMoveId =
    state.playerStamina >= moveSpec.staminaCost ? moveSpec.id : 'strike';
  const effectiveSpec = ARENA_MOVES.find((m) => m.id === effectiveMove) ?? ARENA_MOVES[0];

  const r1 = deterministicRoll(rngSeed + 1);
  const r2 = deterministicRoll(rngSeed + 2);
  const r3 = deterministicRoll(rngSeed + 3);
  const r4 = deterministicRoll(rngSeed + 4);

  const enemyMove = chooseEnemyMove(
    state.enemyHp,
    state.opponent.maxHp,
    state.enemyStamina,
    state.round,
    r1,
  );
  const enemyMoveSpec = ARENA_MOVES.find((m) => m.id === enemyMove) ?? ARENA_MOVES[0];

  const playerBlocked = effectiveMove === 'shield_riposte';
  const enemyBlocked = enemyMove === 'shield_riposte';
  const enemyStaggered = effectiveMove === 'arcane_surge';

  // --- Player Attack Damage ---
  const playerCritChance =
    Math.min(0.55, 0.1 + state.player.tactics * 0.008 + (effectiveMove === 'heavy_cleave' ? 0.18 : 0));
  const playerCrit = r2 < playerCritChance;

  let rawPlayerDmg = state.player.strength * (0.92 + r3 * 0.24);
  if (effectiveMove === 'heavy_cleave') rawPlayerDmg *= 1.48;
  else if (effectiveMove === 'shield_riposte') rawPlayerDmg *= 0.72;
  else if (effectiveMove === 'arcane_surge') rawPlayerDmg = rawPlayerDmg * 1.25 + 16 + state.player.arcaneBonusDmg;

  if (playerCrit) rawPlayerDmg *= 1.5;

  const enemyArmorMitigation =
    effectiveMove === 'arcane_surge'
      ? 0
      : effectiveMove === 'heavy_cleave'
        ? state.opponent.defense * 0.25
        : state.opponent.defense * 0.52;

  let playerDmgDealt = Math.max(8, Math.round(rawPlayerDmg - enemyArmorMitigation));
  if (enemyBlocked && effectiveMove !== 'arcane_surge') {
    playerDmgDealt = Math.max(5, Math.round(playerDmgDealt * 0.45));
  }

  const playerHeal = playerBlocked ? Math.max(8, Math.round(state.player.maxHp * 0.08)) : 0;

  // --- Enemy Attack Damage (if enemy survives) ---
  const nextEnemyHp = Math.max(0, state.enemyHp - playerDmgDealt);
  let enemyDmgDealt = 0;
  let enemyCrit = false;

  if (nextEnemyHp > 0) {
    const enemyCritChance = Math.min(
      0.42,
      0.08 + state.opponent.tactics * 0.007 + (enemyMove === 'heavy_cleave' ? 0.14 : 0),
    );
    enemyCrit = !enemyStaggered && r4 < enemyCritChance;

    let rawEnemyDmg = state.opponent.strength * (0.88 + r1 * 0.24);
    if (enemyMove === 'heavy_cleave') rawEnemyDmg *= 1.42;
    else if (enemyMove === 'shield_riposte') rawEnemyDmg *= 0.68;
    else if (enemyMove === 'arcane_surge') rawEnemyDmg = rawEnemyDmg * 1.25 + 12;

    if (enemyCrit) rawEnemyDmg *= 1.45;
    if (enemyStaggered) rawEnemyDmg *= 0.6;

    const playerArmorMitigation =
      enemyMove === 'arcane_surge' ? state.player.defense * 0.15 : state.player.defense * 0.55;

    enemyDmgDealt = Math.max(5, Math.round(rawEnemyDmg - playerArmorMitigation));
    if (playerBlocked) {
      enemyDmgDealt = Math.max(3, Math.round(enemyDmgDealt * 0.45));
    }
  }

  const nextPlayerHp = Math.min(
    state.player.maxHp,
    Math.max(0, state.playerHp + playerHeal - enemyDmgDealt),
  );

  const nextPlayerStamina = Math.max(
    0,
    Math.min(100, state.playerStamina - effectiveSpec.staminaCost + effectiveSpec.staminaGain),
  );
  const nextEnemyStamina = Math.max(
    0,
    Math.min(100, state.enemyStamina - enemyMoveSpec.staminaCost + enemyMoveSpec.staminaGain),
  );

  const status: 'fighting' | 'victory' | 'defeat' =
    nextEnemyHp <= 0 ? 'victory' : nextPlayerHp <= 0 ? 'defeat' : 'fighting';

  const enemyMoveDisplay =
    enemyMove === 'arcane_surge' ? state.opponent.signatureMoveName : enemyMoveSpec.name;

  const narrativeParts = [
    `Runda ${state.round}: ${effectiveSpec.name} zadaje ${playerDmgDealt} obr.${playerCrit ? ' (KRYTYK!)' : ''}${enemyBlocked ? ' (częściowo zablokowane)' : ''}`,
  ];
  if (playerHeal > 0) {
    narrativeParts.push(`Garda odnawia +${playerHeal} HP.`);
  }
  if (nextEnemyHp > 0) {
    narrativeParts.push(
      `${state.opponent.name} odpowiada ruchem „${enemyMoveDisplay}” za ${enemyDmgDealt} obr.${enemyCrit ? ' (KRYTYK!)' : ''}${playerBlocked ? ' (zablokowane tarczą!)' : ''}.`,
    );
  } else {
    narrativeParts.push(`ZWYCIĘSTWO! ${state.opponent.name} pada na piasek areny przy wiwacie tłumu!`);
  }
  if (status === 'defeat') {
    narrativeParts.push(`Porażka — ${state.opponent.name} zwycięża w tej rundzie turnieju.`);
  }

  const narrative = narrativeParts.join(' ');
  const exchange: ArenaTurnExchange = {
    round: state.round,
    playerMove: effectiveMove,
    enemyMove,
    playerMoveName: effectiveSpec.name,
    enemyMoveName: enemyMoveDisplay,
    playerDmgDealt,
    enemyDmgDealt,
    playerHeal,
    playerCrit,
    enemyCrit,
    playerBlocked,
    enemyBlocked,
    enemyStaggered,
    narrative,
  };

  return {
    ...state,
    playerHp: nextPlayerHp,
    playerStamina: nextPlayerStamina,
    enemyHp: nextEnemyHp,
    enemyStamina: nextEnemyStamina,
    round: state.round + 1,
    status,
    lastExchange: exchange,
    log: [narrative, ...state.log].slice(0, 8),
  };
}
