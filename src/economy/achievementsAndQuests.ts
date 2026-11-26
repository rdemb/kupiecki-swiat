import { CommodityId, ContinentId } from './economyEngine';

export interface RoyalSupplyContract {
  id: string;
  title: string;
  issuingContinent: ContinentId;
  issuingCityId: string;
  issuingCityName: string;
  commodityId: CommodityId;
  requiredQty: number;
  rewardGold: number;
  rewardPrestige: number;
  loreText: string;
}

export const ROYAL_SUPPLY_CONTRACTS: RoyalSupplyContract[] = [
  {
    id: 'contract_zboze_przystan',
    title: 'Zaopatrzenie Spichlerzy Gwardii Królewskiej',
    issuingContinent: 'stary_kontynent',
    issuingCityId: 'krolewska_przystan',
    issuingCityName: 'Królewska Przystań',
    commodityId: 'zboze',
    requiredQty: 25,
    rewardGold: 1350,
    rewardPrestige: 60,
    loreText: 'Królewska Gwardia gromadzi zapasy chleba przed zimowymi patrolami na szlakach.',
  },
  {
    id: 'contract_zelazo_frostgard',
    title: 'Kucie Lodołamaczy dla Klanu Frostgardu',
    issuingContinent: 'frostheim_polnoc',
    issuingCityId: 'frostgard',
    issuingCityName: 'Frostgard',
    commodityId: 'zelazo',
    requiredQty: 15,
    rewardGold: 1850,
    rewardPrestige: 95,
    loreText: 'Stocznia w lodowym fiordzie potrzebuje stali na okucie dziobów arktycznych okrętów.',
  },
  {
    id: 'contract_przyprawy_solaria',
    title: 'Wielki Bankiet Sułtana Oazy Al-Kharim',
    issuingContinent: 'solaria_poludnie',
    issuingCityId: 'oaza_alkharim',
    issuingCityName: 'Oaza Al-Kharim',
    commodityId: 'przyprawy',
    requiredQty: 10,
    rewardGold: 2450,
    rewardPrestige: 120,
    loreText: 'Kupcy Solarii płacą premię królewską za świeże transporty rzadkich przypraw korzennych.',
  },
  {
    id: 'contract_pergamin_aetheris',
    title: 'Archiwum Cesarskie Jadeitowej Przystani',
    issuingContinent: 'aetheris_wschod',
    issuingCityId: 'jadeitowa_przystan',
    issuingCityName: 'Jadeitowa Przystań',
    commodityId: 'runiczny_pergamin',
    requiredQty: 5,
    rewardGold: 2900,
    rewardPrestige: 145,
    loreText: 'Mistrzowie ze Świątyni Tysiąca Smoków poszukują czystych runicznych pergaminów.',
  },
  {
    id: 'contract_mithril_kuznia',
    title: 'Zamówienie Wielkiego Płatnerza Mithrilu',
    issuingContinent: 'stary_kontynent',
    issuingCityId: 'zelazna_kuznia',
    issuingCityName: 'Żelazna Kuźnia',
    commodityId: 'mithril',
    requiredQty: 4,
    rewardGold: 4200,
    rewardPrestige: 210,
    loreText: 'Krasnoludzki cech mistrzów wykuwa pancerze na wyprawy w głąb Miejsc Strachu.',
  },
];

export interface AchievementSpec {
  id: string;
  title: string;
  category: 'Handel' | 'Eksploracja' | 'Walka' | 'Księstwo';
  description: string;
  rewardGold: number;
  rewardPrestige: number;
  targetValue: number;
  metricKey:
    | 'tradesExecuted'
    | 'netWorth'
    | 'monstersDefeated'
    | 'buildingLevels'
    | 'contractsCompleted'
    | 'unlockedTechs'
    | 'fleetGalleons'
    | 'chaptersCompleted';
}

export const WORLD_ACHIEVEMENTS: AchievementSpec[] = [
  {
    id: 'ach_first_trade',
    title: 'Pierwszy Kontrakt Giełdowy',
    category: 'Handel',
    description: 'Wykonaj min. 3 transakcje kupna lub sprzedaży na Giełdzie Towarowej.',
    rewardGold: 1200,
    rewardPrestige: 50,
    targetValue: 3,
    metricKey: 'tradesExecuted',
  },
  {
    id: 'ach_magnate_wealth',
    title: 'Złoty Skarbiec Magnata',
    category: 'Handel',
    description: 'Zgromadź łącznie co najmniej 30 000 zł majątku netto.',
    rewardGold: 2500,
    rewardPrestige: 120,
    targetValue: 30000,
    metricKey: 'netWorth',
  },
  {
    id: 'ach_monster_slayer',
    title: 'Pogromca Miejsc Strachu',
    category: 'Walka',
    description: 'Pokonaj swoim Rycerzem co najmniej 2 bossów w wyprawach turowych.',
    rewardGold: 2200,
    rewardPrestige: 110,
    targetValue: 2,
    metricKey: 'monstersDefeated',
  },
  {
    id: 'ach_duchy_architect',
    title: 'Wielki Budowniczy Księstwa',
    category: 'Księstwo',
    description: 'Rozbuduj infrastrukturę Księstwa do łącznego poziomu 6.',
    rewardGold: 2000,
    rewardPrestige: 100,
    targetValue: 6,
    metricKey: 'buildingLevels',
  },
  {
    id: 'ach_royal_supplier',
    title: 'Dostawca Czterech Kontynentów',
    category: 'Eksploracja',
    description: 'Zrealizuj co najmniej 2 Kontrakty Królewskie dla stolic świata.',
    rewardGold: 2800,
    rewardPrestige: 150,
    targetValue: 2,
    metricKey: 'contractsCompleted',
  },
  {
    id: 'ach_admiral_fleet',
    title: 'Admirał Transoceanicznej Floty',
    category: 'Eksploracja',
    description: 'Zbuduj i utrzymuj flotę min. 4 galeonów kupieckich.',
    rewardGold: 2400,
    rewardPrestige: 130,
    targetValue: 4,
    metricKey: 'fleetGalleons',
  },
  {
    id: 'ach_tech_pioneer',
    title: 'Mistrz Technologii i Alchemii',
    category: 'Handel',
    description: 'Odblokuj co najmniej 3 węzły w drzewku technologicznym.',
    rewardGold: 1800,
    rewardPrestige: 90,
    targetValue: 3,
    metricKey: 'unlockedTechs',
  },
  {
    id: 'ach_crown_chronicle',
    title: 'Kronikarz Odrodzenia Księstwa',
    category: 'Księstwo',
    description: 'Ukończ co najmniej 3 Akty głównej kampanii fabularnej.',
    rewardGold: 3500,
    rewardPrestige: 200,
    targetValue: 3,
    metricKey: 'chaptersCompleted',
  },
];

export interface PlayerProgressMetrics {
  tradesExecuted: number;
  netWorth: number;
  monstersDefeated: number;
  buildingLevels: number;
  contractsCompleted: number;
  unlockedTechs: number;
  fleetGalleons: number;
  chaptersCompleted: number;
}

export function evaluateAchievementProgress(
  spec: AchievementSpec,
  metrics: PlayerProgressMetrics,
): { current: number; target: number; unlocked: boolean; pct: number } {
  const current = metrics[spec.metricKey] ?? 0;
  const unlocked = current >= spec.targetValue;
  const pct = Math.min(100, Math.round((current / Math.max(1, spec.targetValue)) * 100));
  return { current, target: spec.targetValue, unlocked, pct };
}

export interface NobleRankInfo {
  rankTitle: string;
  tier: number;
  nextRankTitle: string | null;
  pointsToNext: number;
  score: number;
}

const NOBLE_RANKS: Array<{ minScore: number; title: string }> = [
  { minScore: 0, title: 'Wędrowny Kramarz' },
  { minScore: 150, title: 'Czeladnik Gildii Kupieckiej' },
  { minScore: 380, title: 'Kupiec Królewski' },
  { minScore: 750, title: 'Baron Szlaków Handlowych' },
  { minScore: 1300, title: 'Książę Czterech Kontynentów' },
  { minScore: 2200, title: 'Cesarz Kupieckiego Świata' },
];

export function calculateNobleRank(params: {
  netWorth: number;
  prestigePoints: number;
  monstersDefeated: number;
  contractsCompleted: number;
}): NobleRankInfo {
  const score = Math.round(
    params.prestigePoints +
      params.netWorth / 220 +
      params.monstersDefeated * 65 +
      params.contractsCompleted * 70,
  );

  let tier = 0;
  for (let i = 0; i < NOBLE_RANKS.length; i++) {
    if (score >= NOBLE_RANKS[i].minScore) {
      tier = i;
    }
  }
  const next = NOBLE_RANKS[tier + 1] ?? null;
  return {
    rankTitle: NOBLE_RANKS[tier].title,
    tier: tier + 1,
    nextRankTitle: next ? next.title : null,
    pointsToNext: next ? Math.max(0, next.minScore - score) : 0,
    score,
  };
}
