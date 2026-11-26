import type { FeastTown } from './harvestLoaf';
import type { KnightState } from './gameData';
import type { Stance } from './questTurn';
export const ignisQuest = 'quest_smok_szczyt';
export const vialPrice = 35;
export const supplySacks = 2;
export const restMinutes = [15, 6, 0] as const;
export const infirmaryHref = (town: FeastTown) => '?miejsce=lazaret&miasto=' + town;
export interface ReliefCall {
  id: number;
  knight: string;
  town: FeastTown;
  due: number;
}
export interface WardReport extends ReliefCall {
  packed: number;
  state: 'march' | 'victory' | 'retreat';
  called: boolean;
  savedMs: number;
  carrier: string | null;
}
export interface WardBook {
  now: number;
  calls: ReliefCall[];
  mine: null | {
    last: WardReport | null;
    history: WardReport[];
    shelf: number;
    dutyUntil: number;
    turns: number;
    revision: number;
    activeStep: number;
    enemyHp: number;
    hp: number;
    lastTurn: string | null;
    name: string;
    otherQuest: boolean;
  };
}
export interface WardSnapshot {
  knight: KnightState;
  scales: number;
  mithril: number;
}
export type WardCommand =
  | { action: 'beginIgnis'; quantity: number; revision: number }
  | { action: 'fightIgnis'; sortie: number; step: number; stance: Stance }
  | { action: 'callWard' | 'supplyWard'; sortie: number };
export const wardActions = ['beginIgnis', 'fightIgnis', 'callWard', 'supplyWard'];
export const waitingForCare = (report: WardReport | null | undefined, now: number) =>
  !!report && report.state === 'retreat' && report.due > now;
