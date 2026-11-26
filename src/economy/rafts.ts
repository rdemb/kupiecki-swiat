import { bridgeRules } from './bridge';
import { floodMark } from './river';

export const raftRules = {
  beamsPerLoad: 6,
  loadsPerRaft: 2,
  forestCapacity: 4,
  portCapacity: 6,
  sawInterval: 240_000,
  minWater: 110,
  floodWater: floodMark,
  loadPrice: bridgeRules.wood.cost - bridgeRules.wood.wage,
} as const;

export type Navigation = 'shallow' | 'open' | 'flood';
export function navigation(level: number): Navigation {
  if (level < raftRules.minWater * 1000) return 'shallow';
  return level >= floodMark * 1000 ? 'flood' : 'open';
}
export function raftSeconds(level: number) {
  // A faster current below flood stage shortens the first leg.
  return (
    55 -
    Math.min(
      20,
      Math.max(0, Math.floor((level / 1000 - raftRules.minWater) / 3)),
    )
  );
}
export function portBid(occupied: number) {
  const room = raftRules.portCapacity - occupied;
  return room < raftRules.loadsPerRaft
    ? null
    : (34 + room * 2) * raftRules.loadsPerRaft;
}
export interface RaftRun {
  id: number;
  name: string;
  start: number;
  due: number;
  price: number;
  own: boolean;
}
export interface RaftBook {
  forest: number;
  port: number;
  inbound: number;
  nextCut: number | null;
  water: Navigation;
  seconds: number;
  offer: number | null;
  neededAtBridge: number;
  runs: RaftRun[];
  arrivals: RaftRun[];
}
