import type { RiverReading } from './river';
import type { MillMark } from './mill';

export const bridgeSite = 'srebrny_gaj';
export const bridgeRules = {
  wood: { label: 'Drewno', source: 'tartak', loads: 3, cost: 48, wage: 18, seconds: 25 },
  iron: { label: 'Żelazo', source: 'kuźnia', loads: 2, cost: 66, wage: 24, seconds: 35 },
} as const;
export type BridgeMaterial = keyof typeof bridgeRules;
export type Passage = 'bridge' | 'detour';
export const detourSeconds = 25;
export interface BridgeSign {
  damaged: boolean;
  flag: string;
  tag: string;
  guildName: string;
}
export function crossing(origin: string, destination: string) {
  return origin === bridgeSite || destination === bridgeSite;
}
export function bridgeToll(rate: number, sign: BridgeSign, guild: string) {
  if (sign.damaged || !guild || guild !== sign.flag) return rate;
  return rate < 10 ? 0 : Math.min(rate, 10);
}
export interface CargoSlip {
  id: number;
  material: BridgeMaterial;
  guildName: string;
  patron: string;
  wage: number;
  driver: string | null;
  delivered: number | null;
  due: number | null;
  myWagon: boolean;
}
export interface BridgeBook extends BridgeSign {
  cycle: number;
  now: number;
  reading: RiverReading | null;
  loads: CargoSlip[];
  openings: { cycle: number; guildName: string; tag: string; opened: number; builders: string }[];
  wallet: { uid: string; guildName: string; gold: number; mark: MillMark } | null;
}
