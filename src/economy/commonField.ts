import type { WeatherConditionId } from './economyEngine';

export const fieldRules = { capacity: 24, perMerchant: 4, growthDays: 4, restDays: 4 } as const;
export const fieldLabels = {
  earth: 'Ziemia pod zasiew', green: 'Zielone wschody',
  gold: 'Dojrzewające kłosy', stubble: 'Ściernisko po żniwach',
} as const;
export type FieldStage = keyof typeof fieldLabels;
export type FieldCommand = {
  action: 'bringSeed' | 'takeSeed' | 'voteSow' | 'holdSow';
  round: number;
  quantity?: number;
};
export interface FieldBook {
  round: number;
  day: number;
  weather: WeatherConditionId;
  stage: FieldStage;
  sown: number | null;
  harvested: number | null;
  total: number;
  growers: number;
  votes: number;
  journal: {day: number; weather: WeatherConditionId; points: number}[];
  mine: { seed: number; voted: boolean } | null;
  lastHarvest: { day: number; seed: number; yield: number; myShare: number | null } | null;
}

// Each day's weather contributes quarter-sacks per sack sown. Rain helps roots
// before heading, then weighs down ripe ears. Four frosts can cost the crop.
export function cropPoints(weather: WeatherConditionId, observation: number): number {
  switch (weather) {
    case 'ulewne_deszcze': return observation <= 2 ? 3 : 1;
    case 'sloneczna_pogoda': return observation <= 2 ? 2 : 3;
    case 'wiatr_handlowy': return 2;
    case 'sztorm_na_zatoce': return 1;
    case 'zamiec_i_mroz': return 0;
  }
}
