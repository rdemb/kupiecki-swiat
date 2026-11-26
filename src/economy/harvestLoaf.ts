import type { Passage } from './bridge';

export const feastTowns = ['krolewska_przystan', 'zelazna_kuznia'] as const;
export type FeastTown = (typeof feastTowns)[number];
export type LoafStage = 'flour' | 'oven' | 'ready' | 'cart' | 'served';
export const ovenSeconds = 45;
export type FeastCommand =
  | { action: 'millHarvestLoaf'; round: number }
  | { action: 'bakeHarvestLoaf'; loaf: number }
  | { action: 'voteHarvestInn' | 'carryHarvestLoaf'; loaf: number; town: FeastTown };

export interface Loaf {
  id: number;
  round: number;
  grower: string;
  founder: string;
  seedLot: number | null;
  baker: string | null;
  carrier: string | null;
  town: FeastTown | null;
  readyAt: number | null;
  departed: number | null;
  arrival: number | null;
  road: Passage | null;
  stage: LoafStage;
}
export interface FeastBook {
  publicQuarters: number;
  now: number;
  latest: Loaf | null;
  alreadyMilled: boolean;
  votes: { town: FeastTown; count: number }[];
  choice: FeastTown | null;
  leading: FeastTown | null;
}
