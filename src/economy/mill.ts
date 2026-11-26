import type { FreightBook } from './waybills';
export const millRules = {
  orderHours: 24,
  maxSacks: 300,
  maxPrice: 1000,
  citySacks: 30,
  cityPrice: 28,
  openingTreasury: 900,
  rationFlour: 3,
  rationGold: 32,
  rationSeconds: 5,
  bakeryInterval: 600_000,
} as const;

export interface MillMark {
  revision: number;
  iron?: number;
  wood?: number;
  gold: number;
  grain: number;
}
export const emptyMark: MillMark = { revision: 0, gold: 0, grain: 0 };
export type Consignee = 'mill' | 'merchant';
export interface MillOrder {
  id: number;
  issuer: string | null;
  name: string;
  purpose: Consignee;
  quantity: number;
  remaining: number;
  price: number;
  expires: number;
}
export interface MillBook {
  garrison?: import('./garrison').GarrisonBook;
  barter?: import('./barter').BarterBook;
  fair?: import('./harvestFair').FairBook;
  feast?: import('./harvestLoaf').FeastBook;
  freight?: FreightBook;
  field?: import('./commonField').FieldBook;
  flour: number;
  grain: number;
  treasury: number;
  baked: number;
  orders: MillOrder[];
  deliveries: {
    id: number;
    name: string;
    guild: string;
    quantity: number;
    price: number;
    purpose: Consignee;
    at: number;
  }[];
  wallet: { uid: string; gold: number; grain: number; iron?: number; wood?: number; ration: boolean; mark: MillMark } | null;
}
