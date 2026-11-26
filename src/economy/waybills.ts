import { detourSeconds, type Passage } from './bridge';
import type { WeatherConditionId } from './economyEngine';

export const waybillTown = 'srebrny_gaj';
export const wagonLimit = 20;
export function journeySeconds(
  quantity: number,
  weather: WeatherConditionId,
  road: Passage,
) {
  const delay =
    weather === 'ulewne_deszcze' ? 8 : weather === 'zamiec_i_mroz' ? 14 : 0;
  return 24 + quantity + delay + (road === 'detour' ? detourSeconds : 0);
}
export type FreightCommand =
  | { action: 'commission'; quantity: number; price: number; wage: number }
  | { action: 'seal' | 'withdraw'; bill: number }
  | { action: 'depart'; bill: number; road: Passage; quote?: number }
  | { action: 'tariff'; guild: string; fee: number; cover: number }
  | { action: 'suspendCover'; guild: string }
  | { action: 'pledge' | 'redeem'; guild: string; amount: number };
export interface Waybill {
  id: number;
  buyerName: string;
  growerName: string | null;
  driverName: string | null;
  quantity: number;
  price: number;
  wage: number;
  status: 'open' | 'sealed' | 'rolling' | 'delivered';
  expires: number;
  departed: number | null;
  due: number | null;
  road: Passage | null;
  mine: number;
  crosses: number | null;
  floodAt: number | null;
  insurer: string | null;
  cover: number | null;
  fee: number | null;
  paid: number | null;
}
export interface GuildQuote {
  id: string;
  name: string;
  tag: string;
  quote: number | null;
  cover: number | null;
  fee: number | null;
  free: number;
  locked: number;
  trips: number;
  claims: number;
  paid: number;
}
export interface MutualBook {
  guilds: GuildQuote[];
  holdings: { guild: string; name: string; free: number; locked: number }[];
  memberGuild: string | null;
  master: boolean;
}
export interface FreightBook {
  insurance?: MutualBook;
  bills: Waybill[];
  receipts: Waybill[];
  closed: boolean;
  weather: WeatherConditionId;
  now: number;
}
