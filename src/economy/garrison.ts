import type { BarterTerms } from './barter';
import type { FeastTown } from './harvestLoaf';
import type { Passage } from './bridge';
import type { WeatherConditionId } from './economyEngine';

export const units = {
  guards: {
    name: 'Gwardziści',
    duty: 'Obchód miejskiego targu',
    price: 18,
    crew: 1,
    time: 40,
    marks: 1,
  },
  archers: { name: 'Łucznicy', duty: 'Warta na murach', price: 24, crew: 2, time: 65, marks: 2 },
  axemen: {
    name: 'Topornicy',
    duty: 'Zwiad na skraju miejsca strachu',
    price: 32,
    crew: 2,
    time: 95,
    marks: 3,
  },
} as const;
export type Unit = keyof typeof units;
export const unitTypes = Object.keys(units) as Unit[];
export const hallRules = { gold: 180, wood: 2, hourly: 4, beds: 100, max: 3 } as const;
export const garrisonHref = (town: FeastTown) => '?miejsce=koszary&miasto=' + town;
export const townNames = {
  krolewska_przystan: 'Królewska Przystań',
  zelazna_kuznia: 'Żelazna Kuźnia',
};
export const otherPost = (town: FeastTown): FeastTown =>
  town === 'zelazna_kuznia' ? 'krolewska_przystan' : 'zelazna_kuznia';
export function roadRank(marks: number) {
  if (marks >= 9) return { name: 'Przewodnik traktu', seconds: 12, next: null };
  if (marks >= 3) return { name: 'Znawca traktu', seconds: 6, next: 9 };
  return { name: 'Nowicjusz traktu', seconds: 0, next: 3 };
}
export interface Dispatch {
  circle: number;
  origin: FeastTown;
  destination: FeastTown;
  carrier: string;
  signed: number;
  departed: number;
  arrival: number;
  road: Passage;
  weather: WeatherConditionId;
  terms: BarterTerms[];
}
export const rationNames = {
  pack: 'Pełne racje z własnego wozu',
  half: 'Pół racji z kuchni',
  full: 'Pełne racje z kuchni',
  extra: 'Wzmocnione racje z kuchni',
} as const;
export type Ration = keyof typeof rationNames;
export function rationPlan(ration: Ration, crew: number, fatigue: number) {
  const portions = crew * ({ pack: 0, half: 1, full: 2, extra: 3 }[ration]);
  const nextFatigue = Math.min(3, Math.max(0, fatigue + (ration === 'half' ? 1 : ration === 'extra' ? -1 : 0)));
  return { portions, grain: ration === 'pack' ? crew : 0, fatigue: nextFatigue, delay: nextFatigue * 10 };
}
export interface KitchenBook {
  portions: number;
  lastDelivery: null | { carrier: string; sacks: number };
}
export interface GarrisonBook {
  school?: import('./standardSchool').SchoolBook;
  kitchen: KitchenBook;
  now: number;
  letters: Dispatch[];
  documents: { id: number; signed: number; terms: BarterTerms[]; sent: boolean }[];
  mine: null | {
    name: string;
    level: number;
    counts: Record<Unit, number>;
    fatigue: number;
    available: number;
    refill: number | null;
    marks: number;
    duty: null | { town: FeastTown; label: string; due: number };
    wagon: null | { returning?: number; destination: FeastTown; arrival: number };
  };
}
export type GarrisonCommand =
  | import('./standardSchool').SchoolCommand
  | { action: 'fundGarrison'; level: number }
  | { action: 'recruitUnit'; unit: Unit; quantity: number }
  | { action: 'stockKitchen'; quantity: number }
  | { action: 'knightDuty'; unit: Unit; ration?: Ration }
  | { action: 'carryNews'; circle: number; escort: boolean; ration?: Ration };
export function newsAge(now: number, signed: number) {
  const minutes = Math.max(0, Math.floor((now - signed) / 60000));
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return minutes + ' min temu';
  if (minutes < 1440) return Math.floor(minutes / 60) + ' godz. temu';
  const days = Math.floor(minutes / 1440);
  return days === 1 ? '1 dzień temu' : days + ' dni temu';
}
