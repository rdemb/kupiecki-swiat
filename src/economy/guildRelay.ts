import type { Passage } from './bridge';
import type { WeatherConditionId } from './economyEngine';
import type { Ration } from './garrison';
import type { FeastTown } from './harvestLoaf';
import { journeySeconds } from './waybills';

export const relayWindowSeconds = 180;
export function relayLegSeconds(weather: WeatherConditionId, road: Passage, delay = 0) {
  // A fresh team covers half the direct school run, with a five-second gain.
  return journeySeconds(1, weather, road) - 5 + delay;
}
export function rideToStationSeconds(weather: WeatherConditionId) {
  return Math.ceil(relayLegSeconds(weather, 'bridge') / 2);
}
export type RelayCommand =
  | { action: 'startRelay'; guide: number; ration: Ration }
  | { action: 'rideToRelay'; load: number; guide: number; ration: Ration }
  | { action: 'takeRelay'; load: number; road: Passage };
export type RelayState = 'open' | 'carrying' | 'delivered' | 'returning' | 'returned';
export interface RelayLoad {
  id: number;
  origin: FeastTown;
  state: RelayState;
  firstName: string;
  secondName: string | null;
  mineFirst: boolean;
  mineSecond: boolean;
  started: number;
  atPost: number;
  expires: number;
  ready: number | null;
  handoff: number | null;
  due: number | null;
  secondGuide: number | null;
  road: Passage | null;
}
export interface RelayBook {
  member: boolean;
  loads: RelayLoad[];
}
