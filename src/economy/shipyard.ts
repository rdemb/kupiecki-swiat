import type { Course, PilotBook } from './pilotage';
import { bridgeRules } from './bridge';
import { harborRules } from './harborWorks';
import { raftRules } from './rafts';
import type { MillMark } from './mill';
import type { WeatherConditionId } from './economyEngine';

export const shipRules = {
  berthPrice: 35,
  oakLoads: 2,
  ironLots: 1,
  oakPrice: raftRules.loadPrice,
  ironPrice: bridgeRules.iron.cost - bridgeRules.iron.wage,
  wage: 18,
  freight: 36,
  barrels: harborRules.exportBarrels,
  hiringMs: 15 * 60_000,
} as const;

export function sailingSeconds(sky: WeatherConditionId): number | null {
  switch (sky) {
    case 'sztorm_na_zatoce':
      return null;
    case 'wiatr_handlowy':
      return 45;
    case 'zamiec_i_mroz':
      return 90;
    case 'ulewne_deszcze':
      return 75;
    default:
      return 60;
  }
}
export interface Hull {
  id: number;
  name: string | null;
  guild: string;
  tag: string;
  founder: string;
  begun: number;
  launched: number | null;
}
export interface Charter {
  id: number;
  payer: string;
  skipper: string | null;
  offered: number;
  expires: number;
  departed: number | null;
  due: number | null;
  settled: number | null;
  teams: number;
  barrels: number;
  wage: number;
  freight: number;
  mine: boolean;
  myJob: boolean;
  course: Course;
  pilot: string | null;
  depth: number | null;
}
export type YardAction =
  | { action: 'commission' }
  | { action: 'oak' | 'iron' | 'hire'; ship: number }
  | { action: 'launch'; ship: number; name: string }
  | { action: 'withdraw'; ship: number; charter: number }
  | { action: 'sail'; ship: number; charter: number; course?: Course; reference?: number };
export interface YardBook {
  now: number;
  oak: number;
  salt: number;
  seconds: number | null;
  fleet: Hull[];
  pilotage: PilotBook;
  wallet: {
    uid: string;
    gold: number;
    mark: MillMark;
    canCommission: boolean;
    guildName: string;
  } | null;
  ship: null | {
    hull: Hull;
    mayManage: boolean;
    archived: boolean;
    oak: number;
    iron: number;
    deliveries: {
      id: number;
      name: string;
      kind: 'oak' | 'iron';
      at: number;
    }[];
    job: Charter | null;
    journal: Charter[];
    more: boolean;
    completed: number;
  };
}
