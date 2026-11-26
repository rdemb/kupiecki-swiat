/**
 * Kupiecki Świat 3D: Odrodzenie
 * Pure Hero Personalization, Multi-Direction Development Paths, RPG Equipment Slots & Loot Engine
 */
import type { CommodityId } from './economyEngine';

export type HeroPathId = 'paladyn' | 'kupiec_magnat' | 'arcymag' | 'zwiadowca';
export type EquipmentSlot = 'weapon' | 'armor' | 'mount' | 'relic';
export type ItemRarity = 'pospolity' | 'rzadki' | 'epicki' | 'legendarny';

export interface HeroPortraitSpec {
  id: string;
  name: string;
  archetypeLabel: string;
  recommendedPath: HeroPathId;
  imageUrl: string;
}

export const HERO_PORTRAITS: HeroPortraitSpec[] = [
  {
    id: 'portrait_paladin',
    name: 'Paladyn Złotego Lwa',
    archetypeLabel: 'Dowódca Szlaku i Obrońca',
    recommendedPath: 'paladyn',
    imageUrl: '/src/assets/images/hero_paladin_portrait_1795671865906.jpg',
  },
  {
    id: 'portrait_merchant',
    name: 'Magnat Królewskiej Giełdy',
    archetypeLabel: 'Lord Kupiecki i Bankier',
    recommendedPath: 'kupiec_magnat',
    imageUrl: '/src/assets/images/avatar_merchant_lord_1795641278352.jpg',
  },
  {
    id: 'portrait_arcanist',
    name: 'Arcymag Kolegium Run',
    archetypeLabel: 'Mistrz Magii i Alchemii',
    recommendedPath: 'arcymag',
    imageUrl: '/src/assets/images/hero_arcanist_portrait_1795671867084.jpg',
  },
  {
    id: 'portrait_ranger',
    name: 'Zwiadowca Czarnych Szlaków',
    archetypeLabel: 'Łowca Skarbów i Kartograf',
    recommendedPath: 'zwiadowca',
    imageUrl: '/src/assets/images/hero_ranger_portrait_1795671867628.jpg',
  },
];

export interface HeroBannerColorSpec {
  id: string;
  name: string;
  hex: string;
}

export const HERO_BANNER_COLORS: HeroBannerColorSpec[] = [
  { id: 'gold', name: 'Złoto Hanzy', hex: '#D4AF37' },
  { id: 'crimson', name: 'Szkarłat Zakonu', hex: '#E11D48' },
  { id: 'emerald', name: 'Szmaragd Gaju', hex: '#10B981' },
  { id: 'sapphire', name: 'Szafir Frostheimu', hex: '#38BDF8' },
];

export interface HeroPathSpec {
  id: HeroPathId;
  name: string;
  shortTitle: string;
  roleTag: string;
  description: string;
  maxRank: number;
  perRankSummary: string;
  accentHex: string;
  portraitId: string;
}

export const HERO_PATHS: HeroPathSpec[] = [
  {
    id: 'paladyn',
    name: 'Droga Paladyna Szlaku',
    shortTitle: 'Paladyn',
    roleTag: 'Wojownik i Obrońca',
    description:
      'Mistrz ciężkiej stali i przełamywania blokad. Maksymalizuje siłę ataku, pancerz i żywotność podczas turowych wypraw na potwory.',
    maxRank: 5,
    perRankSummary: '+5 Siły · +4 Pancerza · +22 Max HP za każdy poziom',
    accentHex: '#F43F5E',
    portraitId: 'portrait_paladin',
  },
  {
    id: 'kupiec_magnat',
    name: 'Droga Magnata Giełdowego',
    shortTitle: 'Magnat',
    roleTag: 'Dyplomacja i Handel',
    description:
      'Wybitny negocjator Królewskiej Giełdy. Obniża podatek antyinflacyjny od transakcji oraz zwiększa złote łupy ze wszystkich wypraw.',
    maxRank: 5,
    perRankSummary: '-4% Opłaty Giełdowej · +12% Złota z Łupów · +2 Taktyki',
    accentHex: '#F59E0B',
    portraitId: 'portrait_merchant',
  },
  {
    id: 'arcymag',
    name: 'Droga Arcymaga Run',
    shortTitle: 'Arcymag',
    roleTag: 'Magia i Alchemia',
    description:
      'Łączy miecz z energią Kryształów Many. Zadaje dodatkowe obrażenia runiczne ignorujące pancerz bestii i leczy bohatera po każdej turze.',
    maxRank: 5,
    perRankSummary: '+8 Obrażeń Runicznych · +6 Leczenia/turę · +2 Siły',
    accentHex: '#38BDF8',
    portraitId: 'portrait_arcanist',
  },
  {
    id: 'zwiadowca',
    name: 'Droga Łowcy Skarbów',
    shortTitle: 'Zwiadowca',
    roleTag: 'Zwiad i Rzadkie Łupy',
    description:
      'Ekspert dalekich wypraw i ukrytych skarbców. Zwiększa szansę na znajdowanie rzadkich i legendarnych przedmiotów oraz przyspiesza karawany.',
    maxRank: 5,
    perRankSummary: '+5 Taktyki (Krytyki) · +10% Szansy na Łup · +6% Prędkości Karawan',
    accentHex: '#10B981',
    portraitId: 'portrait_ranger',
  },
];

export interface RpgEquipmentItem {
  id: string;
  name: string;
  slot: EquipmentSlot;
  slotLabel: string;
  rarity: ItemRarity;
  rarityLabel: string;
  source: 'shop' | 'loot';
  sourceLabel: string;
  lore: string;
  imageUrl: string;
  costGold: number;
  requiredCommodity?: { id: CommodityId; qty: number };
  strengthBonus: number;
  defenseBonus: number;
  tacticsBonus: number;
  maxHpBonus: number;
  maxTurnsBonus?: number;
  tradeFeeDiscountPct?: number;
  lootFindBonusPct?: number;
  arcaneBonusDmg?: number;
  turnHealBonus?: number;
  bonusText: string;
}

const IMG_BLADE = '/src/assets/images/item_mithril_blade_1795671868160.jpg';
const IMG_ARMOR = '/src/assets/images/item_dragon_armor_1795671868902.jpg';
const IMG_RELIC = '/src/assets/images/item_arcane_relic_1795671870433.jpg';
const IMG_PALADIN = '/src/assets/images/hero_paladin_portrait_1795671865906.jpg';
const IMG_RANGER = '/src/assets/images/hero_ranger_portrait_1795671867628.jpg';

export const RPG_ITEM_CATALOG: RpgEquipmentItem[] = [
  // --- 6 SHOP / FORGE ITEMS (KUPOWANE I WYKUWANE W ZBROJOWNI) ---
  {
    id: 'item_sztylet_kupca',
    name: 'Kordelas Straży Gildii',
    slot: 'weapon',
    slotLabel: 'Broń',
    rarity: 'pospolity',
    rarityLabel: 'Pospolity',
    source: 'shop',
    sourceLabel: 'Kuźnia Miejska',
    lore: 'Niezawodna broń boczna każdego kupca podróżującego między Królewską Przystanią a Srebrnym Gajem.',
    imageUrl: IMG_BLADE,
    costGold: 650,
    strengthBonus: 6,
    defenseBonus: 2,
    tacticsBonus: 3,
    maxHpBonus: 0,
    bonusText: '+6 Siły · +2 Pancerza · +3 Taktyki',
  },
  {
    id: 'eq_miecz_zelazny',
    name: 'Klinga Gwardii Królewskiej',
    slot: 'weapon',
    slotLabel: 'Broń',
    rarity: 'rzadki',
    rarityLabel: 'Rzadki',
    source: 'shop',
    sourceLabel: 'Kuźnia Miejska',
    lore: 'Dwuręczny miecz z krasnoludzkiej stali hartowanej w ogniu Żelaznej Kuźni.',
    imageUrl: IMG_BLADE,
    costGold: 1350,
    requiredCommodity: { id: 'zelazo', qty: 8 },
    strengthBonus: 14,
    defenseBonus: 3,
    tacticsBonus: 4,
    maxHpBonus: 0,
    bonusText: '+14 Siły · +3 Pancerza · +4 Taktyki',
  },
  {
    id: 'eq_ostrze_mithril',
    name: 'Runiczne Ostrze z Mithrilu',
    slot: 'weapon',
    slotLabel: 'Broń',
    rarity: 'epicki',
    rarityLabel: 'Epicki',
    source: 'shop',
    sourceLabel: 'Wielka Kuźnia Mithrilu',
    lore: 'Lekki jak pióro i twardy jak diament miecz inkrustowany runami Królewskiego Zakonu.',
    imageUrl: IMG_BLADE,
    costGold: 3600,
    requiredCommodity: { id: 'mithril', qty: 5 },
    strengthBonus: 28,
    defenseBonus: 4,
    tacticsBonus: 10,
    maxHpBonus: 0,
    arcaneBonusDmg: 10,
    bonusText: '+28 Siły · +10 Taktyki · +10 Obrażeń Runicznych',
  },
  {
    id: 'eq_zbroja_plytowa',
    name: 'Zbroja Płytowa Lwa',
    slot: 'armor',
    slotLabel: 'Pancerz',
    rarity: 'rzadki',
    rarityLabel: 'Rzadki',
    source: 'shop',
    sourceLabel: 'Kuźnia Miejska',
    lore: 'Zdobiony złotym lwem pancerz chroniący przed strzałami rebeliantów i kłami bestii.',
    imageUrl: IMG_ARMOR,
    costGold: 1800,
    requiredCommodity: { id: 'zelazo', qty: 12 },
    strengthBonus: 0,
    defenseBonus: 18,
    tacticsBonus: 2,
    maxHpBonus: 55,
    bonusText: '+18 Pancerza · +55 Max HP · +2 Taktyki',
  },
  {
    id: 'eq_rumak_bojowy',
    name: 'Rumak Bojowy ze Srebrnego Gaju',
    slot: 'mount',
    slotLabel: 'Wierzchowiec',
    rarity: 'rzadki',
    rarityLabel: 'Rzadki',
    source: 'shop',
    sourceLabel: 'Stajnie Królewskie',
    lore: 'Rączy ogier szkolony do pokonywania górskich przełęczy, zwiększający liczbę dostępnych tur wypraw.',
    imageUrl: IMG_PALADIN,
    costGold: 2200,
    requiredCommodity: { id: 'zboze', qty: 24 },
    strengthBonus: 6,
    defenseBonus: 6,
    tacticsBonus: 12,
    maxHpBonus: 35,
    maxTurnsBonus: 2,
    bonusText: '+6 Siły · +12 Taktyki · +2 Max Tur Wypraw',
  },
  {
    id: 'eq_ksiega_run',
    name: 'Księga Runicznych Zaklęć',
    slot: 'relic',
    slotLabel: 'Relikt',
    rarity: 'epicki',
    rarityLabel: 'Epicki',
    source: 'shop',
    sourceLabel: 'Kolegium Magów',
    lore: 'Starożytny grymuar regenerujący siły bohatera po każdej rundzie starcia.',
    imageUrl: IMG_RELIC,
    costGold: 3100,
    requiredCommodity: { id: 'krysztaly_many', qty: 6 },
    strengthBonus: 8,
    defenseBonus: 8,
    tacticsBonus: 14,
    maxHpBonus: 30,
    arcaneBonusDmg: 14,
    turnHealBonus: 14,
    bonusText: '+14 Obrażeń Runicznych · +14 Leczenia/turę · +14 Taktyki',
  },

  // --- 6 LOOTABLE / FINDABLE ITEMS (ZNAJDOWANE W WYPRAWACH, ZWIADZIE I ZDARZENIACH NA SZLAKU) ---
  {
    id: 'loot_sygnet_hanzy',
    name: 'Złoty Sygnet Wielkiej Hanzy',
    slot: 'relic',
    slotLabel: 'Relikt',
    rarity: 'rzadki',
    rarityLabel: 'Rzadki',
    source: 'loot',
    sourceLabel: 'Łup ze Szlaku / Zwiadu',
    lore: 'Zaginiony pierścień pierwszego Syndyka Królewskiej Przystani — obniża opłaty na każdej giełdzie.',
    imageUrl: IMG_RELIC,
    costGold: 0,
    strengthBonus: 3,
    defenseBonus: 4,
    tacticsBonus: 10,
    maxHpBonus: 20,
    tradeFeeDiscountPct: 8,
    lootFindBonusPct: 8,
    bonusText: '-8% Podatku Giełdowego · +8% Szansy Łupu · +10 Taktyki',
  },
  {
    id: 'loot_kompas_solarii',
    name: 'Astrolabium Karawan Solarii',
    slot: 'relic',
    slotLabel: 'Relikt',
    rarity: 'epicki',
    rarityLabel: 'Epicki',
    source: 'loot',
    sourceLabel: 'Łup z Wypraw i Zwiadu',
    lore: 'Złoty przyrząd nawigacyjny pustynnych żeglarzy, odsłaniający ukryte skarbce i skróty handlowe.',
    imageUrl: IMG_RELIC,
    costGold: 0,
    strengthBonus: 5,
    defenseBonus: 6,
    tacticsBonus: 16,
    maxHpBonus: 25,
    tradeFeeDiscountPct: 6,
    lootFindBonusPct: 18,
    bonusText: '+18% Szansy Łupu · -6% Podatku · +16 Taktyki',
  },
  {
    id: 'loot_szabla_korsarzy',
    name: 'Szmaragdowa Szabla z Aetheris',
    slot: 'weapon',
    slotLabel: 'Broń',
    rarity: 'epicki',
    rarityLabel: 'Epicki',
    source: 'loot',
    sourceLabel: 'Łup z Potworów / Zwiadu',
    lore: 'Zakrzywione ostrze zaklęte wiatrem Wschodniego Kontynentu, słynące z błyskawicznych trafień krytycznych.',
    imageUrl: IMG_BLADE,
    costGold: 0,
    strengthBonus: 24,
    defenseBonus: 5,
    tacticsBonus: 18,
    maxHpBonus: 15,
    arcaneBonusDmg: 8,
    bonusText: '+24 Siły · +18 Taktyki · +8 Obrażeń Runicznych',
  },
  {
    id: 'loot_pancerz_smoczy',
    name: 'Smocza Zbroja Ignisa',
    slot: 'armor',
    slotLabel: 'Pancerz',
    rarity: 'legendarny',
    rarityLabel: 'Legendarny',
    source: 'loot',
    sourceLabel: 'Legendarny Łup z Wypraw',
    lore: 'Pancerz wykuty z hartowanych łusek Pradawnego Smoka — niemal nieprzebijalny w boju.',
    imageUrl: IMG_ARMOR,
    costGold: 0,
    strengthBonus: 12,
    defenseBonus: 34,
    tacticsBonus: 8,
    maxHpBonus: 110,
    turnHealBonus: 8,
    bonusText: '+34 Pancerza · +110 Max HP · +12 Siły · +8 Leczenia/turę',
  },
  {
    id: 'loot_gryf_polnocy',
    name: 'Śnieżny Wierzchowiec Frostheimu',
    slot: 'mount',
    slotLabel: 'Wierzchowiec',
    rarity: 'epicki',
    rarityLabel: 'Epicki',
    source: 'loot',
    sourceLabel: 'Łup ze Szlaku / Zwiadu',
    lore: 'Wytrzymały wierzchowiec z północnych fiordów, nieulękły wobec zamieci i ryku smoków.',
    imageUrl: IMG_RANGER,
    costGold: 0,
    strengthBonus: 10,
    defenseBonus: 12,
    tacticsBonus: 15,
    maxHpBonus: 50,
    maxTurnsBonus: 3,
    lootFindBonusPct: 10,
    bonusText: '+3 Max Tur · +12 Pancerza · +15 Taktyki · +10% Łupu',
  },
  {
    id: 'loot_miecz_aethelgarda',
    name: 'Miecz Wielkiego Księcia Aethelgarda',
    slot: 'weapon',
    slotLabel: 'Broń',
    rarity: 'legendarny',
    rarityLabel: 'Legendarny',
    source: 'loot',
    sourceLabel: 'Legendarny Artefakt Kronik',
    lore: 'Zaginione królewskie ostrze z najstarszych kronik Kupieckiego Świata — symbol władzy nad czterema kontynentami.',
    imageUrl: IMG_BLADE,
    costGold: 0,
    strengthBonus: 38,
    defenseBonus: 12,
    tacticsBonus: 20,
    maxHpBonus: 45,
    arcaneBonusDmg: 18,
    tradeFeeDiscountPct: 5,
    bonusText: '+38 Siły · +20 Taktyki · +18 Runicznych · -5% Podatku',
  },
];

export interface HeroProgressionCarrier {
  name: string;
  title: string;
  level: number;
  hp: number;
  maxHp: number;
  strength: number;
  defense: number;
  tactics: number;
  maxTurns: number;
  equippedIds: string[];
  portraitId?: string;
  bannerColorHex?: string;
  activePath?: HeroPathId;
  skillPoints?: number;
  pathLevels?: Record<HeroPathId, number>;
  ownedItemIds?: string[];
  equippedSlots?: Partial<Record<EquipmentSlot, string>>;
  recentLootLog?: string[];
}

export interface DerivedHeroStats {
  effectiveStrength: number;
  effectiveDefense: number;
  effectiveTactics: number;
  effectiveMaxHp: number;
  effectiveMaxTurns: number;
  tradeFeeDiscountPct: number;   // e.g. 12 => 0.12 rebate
  goldLootBonusPct: number;      // e.g. 24 => +24% gold from quests
  lootFindBonusPct: number;      // e.g. 20 => higher chance for rare/epic/legendary loot
  arcaneBonusDmg: number;        // bonus flat rune damage per combat turn
  turnHealBonus: number;         // extra HP regen per combat turn
  caravanSpeedBonus: number;     // decimal bonus e.g. 0.12
  equippedItems: RpgEquipmentItem[];
}

export function getHeroItemById(itemId: string): RpgEquipmentItem | undefined {
  return RPG_ITEM_CATALOG.find((i) => i.id === itemId);
}

export function getDefaultPathLevels(): Record<HeroPathId, number> {
  return {
    paladyn: 0,
    kupiec_magnat: 0,
    arcymag: 0,
    zwiadowca: 0,
  };
}

export function computeDerivedHeroStats(hero: HeroProgressionCarrier): DerivedHeroStats {
  const pathLevels = hero.pathLevels ?? getDefaultPathLevels();
  const paladinLvl = pathLevels.paladyn ?? 0;
  const merchantLvl = pathLevels.kupiec_magnat ?? 0;
  const archmageLvl = pathLevels.arcymag ?? 0;
  const rangerLvl = pathLevels.zwiadowca ?? 0;

  // Resolve equipped items strictly from slots (1 item per slot -> prevents double-stacking bug!)
  const equippedSlots: Partial<Record<EquipmentSlot, string>> = hero.equippedSlots ?? {};
  const slotItemIds = (['weapon', 'armor', 'mount', 'relic'] as EquipmentSlot[])
    .map((slot) => equippedSlots[slot])
    .filter((id): id is string => Boolean(id));

  const equippedItems = slotItemIds
    .map((id) => getHeroItemById(id))
    .filter((item): item is RpgEquipmentItem => Boolean(item));

  let itemStr = 0;
  let itemDef = 0;
  let itemTac = 0;
  let itemHp = 0;
  let itemTurns = 0;
  let itemFeeDiscount = 0;
  let itemLootFind = 0;
  let itemArcane = 0;
  let itemHeal = 0;

  for (const item of equippedItems) {
    itemStr += item.strengthBonus;
    itemDef += item.defenseBonus;
    itemTac += item.tacticsBonus;
    itemHp += item.maxHpBonus;
    itemTurns += item.maxTurnsBonus ?? 0;
    itemFeeDiscount += item.tradeFeeDiscountPct ?? 0;
    itemLootFind += item.lootFindBonusPct ?? 0;
    itemArcane += item.arcaneBonusDmg ?? 0;
    itemHeal += item.turnHealBonus ?? 0;
  }

  return {
    effectiveStrength: hero.strength + paladinLvl * 5 + archmageLvl * 2 + itemStr,
    effectiveDefense: hero.defense + paladinLvl * 4 + itemDef,
    effectiveTactics: hero.tactics + rangerLvl * 5 + merchantLvl * 2 + itemTac,
    effectiveMaxHp: hero.maxHp + paladinLvl * 22 + itemHp,
    effectiveMaxTurns: hero.maxTurns + itemTurns,
    tradeFeeDiscountPct: Math.min(35, merchantLvl * 4 + itemFeeDiscount),
    goldLootBonusPct: merchantLvl * 12,
    lootFindBonusPct: rangerLvl * 10 + itemLootFind,
    arcaneBonusDmg: archmageLvl * 8 + itemArcane,
    turnHealBonus: archmageLvl * 6 + itemHeal,
    caravanSpeedBonus: Number((rangerLvl * 0.06).toFixed(2)),
    equippedItems,
  };
}

export function equipHeroItem<T extends HeroProgressionCarrier>(hero: T, itemId: string): T {
  const item = getHeroItemById(itemId);
  if (!item) return hero;
  const owned = hero.ownedItemIds ?? [];
  if (!owned.includes(itemId)) return hero;

  const nextSlots: Partial<Record<EquipmentSlot, string>> = {
    ...(hero.equippedSlots ?? {}),
    [item.slot]: item.id,
  };
  const nextEquippedIds = Object.values(nextSlots).filter((v): v is string => Boolean(v));
  const nextDerived = computeDerivedHeroStats({ ...hero, equippedSlots: nextSlots });

  return {
    ...hero,
    equippedSlots: nextSlots,
    equippedIds: nextEquippedIds,
    hp: Math.min(nextDerived.effectiveMaxHp, hero.hp),
  };
}

export function unequipHeroSlot<T extends HeroProgressionCarrier>(hero: T, slot: EquipmentSlot): T {
  const currentSlots = { ...(hero.equippedSlots ?? {}) };
  if (!currentSlots[slot]) return hero;
  delete currentSlots[slot];
  const nextEquippedIds = Object.values(currentSlots).filter((v): v is string => Boolean(v));
  const nextDerived = computeDerivedHeroStats({ ...hero, equippedSlots: currentSlots });

  return {
    ...hero,
    equippedSlots: currentSlots,
    equippedIds: nextEquippedIds,
    hp: Math.min(nextDerived.effectiveMaxHp, hero.hp),
  };
}

export function allocateHeroSkillPoint<T extends HeroProgressionCarrier>(
  hero: T,
  pathId: HeroPathId,
): T {
  const currentPoints = hero.skillPoints ?? 0;
  if (currentPoints <= 0) return hero;

  const pathSpec = HERO_PATHS.find((p) => p.id === pathId);
  if (!pathSpec) return hero;

  const currentLevels = {
    ...getDefaultPathLevels(),
    ...(hero.pathLevels ?? {}),
  };
  if (currentLevels[pathId] >= pathSpec.maxRank) return hero;

  currentLevels[pathId] += 1;
  const nextHero: T = {
    ...hero,
    activePath: pathId,
    skillPoints: currentPoints - 1,
    pathLevels: currentLevels,
  };
  const nextDerived = computeDerivedHeroStats(nextHero);

  return {
    ...nextHero,
    hp: Math.min(nextDerived.effectiveMaxHp, hero.hp + (pathId === 'paladyn' ? 22 : 0)),
  };
}

export interface LootDropResult {
  foundItem: RpgEquipmentItem | null;
  isDuplicate: boolean;
  duplicateBonusGold: number;
  narrative: string;
}

export function rollLootDrop(params: {
  source: 'quest' | 'trail_event' | 'scout';
  lootFindBonusPct: number;
  ownedItemIds: string[];
  seed: number;
}): LootDropResult {
  const lootPool = RPG_ITEM_CATALOG.filter((i) => i.source === 'loot');
  const unownedPool = lootPool.filter((i) => !params.ownedItemIds.includes(i.id));

  // Deterministic pseudo-random roll in [0, 1)
  const hash = Math.abs(Math.sin(params.seed * 12.9898 + 78.233) * 43758.5453);
  const roll = hash - Math.floor(hash);

  const baseChance =
    params.source === 'scout' ? 0.85 : params.source === 'quest' ? 0.72 : 0.45;
  const effectiveChance = Math.min(0.98, baseChance + params.lootFindBonusPct / 150);

  if (roll > effectiveChance) {
    const consolationGold = Math.round(220 + (params.seed % 180));
    return {
      foundItem: null,
      isDuplicate: false,
      duplicateBonusGold: consolationGold,
      narrative: `Zwiad nie natrafił na artefakt, lecz odnaleziono sakwę ze złotem (+${consolationGold} zł).`,
    };
  }

  const targetPool = unownedPool.length > 0 ? unownedPool : lootPool;
  const pickIdx = Math.floor(Math.abs(Math.sin(params.seed * 91.17 + 19.3) * 10000)) % targetPool.length;
  const chosen = targetPool[pickIdx];
  const isDuplicate = params.ownedItemIds.includes(chosen.id);

  if (isDuplicate) {
    const dupGold = chosen.rarity === 'legendarny' ? 1400 : chosen.rarity === 'epicki' ? 850 : 480;
    return {
      foundItem: chosen,
      isDuplicate: true,
      duplicateBonusGold: dupGold,
      narrative: `Odnaleziono duplikat artefaktu „${chosen.name}” — sprzedano kolekcjonerom za +${dupGold} zł!`,
    };
  }

  return {
    foundItem: chosen,
    isDuplicate: false,
    duplicateBonusGold: 0,
    narrative: `Znaleziono [${chosen.rarityLabel}] ${chosen.name} (${chosen.bonusText})! Dodano do plecaka.`,
  };
}

export function getRarityStyles(rarity: ItemRarity): {
  borderClass: string;
  textClass: string;
  badgeBgClass: string;
} {
  switch (rarity) {
    case 'legendarny':
      return {
        borderClass: 'border-amber-400/70',
        textClass: 'text-amber-300',
        badgeBgClass: 'bg-amber-500/20 text-amber-300',
      };
    case 'epicki':
      return {
        borderClass: 'border-purple-400/60',
        textClass: 'text-purple-300',
        badgeBgClass: 'bg-purple-500/20 text-purple-300',
      };
    case 'rzadki':
      return {
        borderClass: 'border-sky-400/60',
        textClass: 'text-sky-300',
        badgeBgClass: 'bg-sky-500/20 text-sky-300',
      };
    default:
      return {
        borderClass: 'border-slate-700',
        textClass: 'text-slate-300',
        badgeBgClass: 'bg-slate-800 text-slate-300',
      };
  }
}
