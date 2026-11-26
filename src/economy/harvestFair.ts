import type { Passage } from './bridge';
import { feastTowns, type FeastTown } from './harvestLoaf';
import type { WeatherConditionId } from './economyEngine';

export const fairGoods = ['zboze', 'zelazo'] as const;
export type FairGood = (typeof fairGoods)[number];
export const isFairTown = (city: string): city is FeastTown =>
  feastTowns.some((town) => town === city);
export const fairHref = (town: string) => '?miejsce=jarmark&miasto=' + town;

export interface FairDelivery {
  good: FairGood;
  carrier: string;
  departed: number;
  arrival: number;
  road: Passage;
  weather: WeatherConditionId;
  round: number;
}
export interface FairBook {
  now: number;
  opening: { id: number; round: number; baker: string } | null;
  wagons: FairDelivery[];
}
export type FairCommand = { action: 'supplyFair'; good: FairGood; loaf: number };
