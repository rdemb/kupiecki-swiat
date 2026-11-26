import type { MillMark } from './mill';
import type { LaunchBoard } from './shipyard';
import type { PilotBook } from './pilotage';
import type { RiverReading } from './river';
import type { SeasonId, WeatherConditionId } from './economyEngine';
import type { ActiveWorldDisaster } from './worldDisasters';

export const noticeKinds = { handel: 'Handel', zaloga: 'Załoga', wyprawa: 'Wyprawa' } as const;
export type NoticeKind = keyof typeof noticeKinds;
export const convoyReduction = (members: number) => Math.max(0, Math.min(20, (members - 1) * 5));
export interface InnGuild {
  id: string;
  name: string;
  tag: string;
  privateHall: number;
  count: number;
  founder: string | null;
}
export interface InnBook {
  groups: InnGuild[];
  uid: string | null;
  walletMark?: MillMark | null;
  membership: string;
  applied: string | null;
  members: { uid: string; name: string }[];
  applicants: { uid: string; name: string }[];
  letters: { id: number; name: string; body: string; at: number }[];
  boardAt: number;
  fair?: import('./harvestFair').FairBook;
  reliefCalls?: import('./infirmary').ReliefCall[];
  newsLetters?: import('./garrison').Dispatch[];
  barterCalls?: import('./barter').BarterCall[];
  harvestTable?: import('./harvestLoaf').Loaf[];
  pilotage: PilotBook | null;
  launches: LaunchBoard | null;
  riverReports: RiverReading[];
  notices: {
    id: number;
    owner: string;
    name: string;
    body: string;
    kind: NoticeKind;
    at: number;
    signed: string[];
    volunteered: number;
  }[];
}
export function grainHarvest(
  base: number,
  season: SeasonId,
  weather: WeatherConditionId,
  disaster: Pick<ActiveWorldDisaster, 'templateId'> | null,
) {
  const seasons = { wiosna: 0.9, lato: 1.2, jesien: 1, zima: 0.55 };
  const skies = {
    sloneczna_pogoda: 1,
    wiatr_handlowy: 1,
    ulewne_deszcze: 0.75,
    zamiec_i_mroz: 0.5,
    sztorm_na_zatoce: 0.9,
  };
  const blight = disaster?.templateId === 'zaraza_zbozowa' ? 0.5 : 1;
  return Math.round(base * seasons[season] * skies[weather] * blight);
}
