export const returnTerms = {
  sacks: 2, lotCost: 48, maxFee: 18, maxAsk: 100, loadMs: 12_000,
  unloadMs: 8_000, orderMs: 15 * 60_000, bidMs: 24 * 60 * 60_000,
} as const;

export type ReturnOrder = {
  id: number; name: string; fee: number; ask: number; remaining: number;
  state: 'open' | 'aboard' | 'stall'; expires: number; own: boolean;
  ship: number | null; vessel: string | null;
};
export interface FreightAccount {
  id: number; vessel: string; landed: number;
  cost: number; fee: number; sacks: number; remaining: number; sold: number; revenue: number;
}

export function freightEstimate(cost: number, fee: number, stock: number, ask: number, revenue = 0) {
  const outlay = cost + fee;
  return {
    outlay,
    breakEven: stock > 0 ? Math.ceil(Math.max(0, outlay - revenue) / stock) : null,
    projected: revenue + stock * ask - outlay,
  };
}

export type StallBidState = 'open' | 'accepted' | 'declined' | 'withdrawn' | 'expired' | 'closed' | 'cheaper';
export interface StallBid {
  id: number; offer: number; buyer: string; seller: string; amount: number;
  expires: number; state: StallBidState;
}
export type BargainAction =
  | { action: 'bidReturn'; offer: number; quote: number; ask: number }
  | { action: 'takeReturnBid' | 'refuseReturnBid' | 'recallReturnBid'; offer: number; bid: number };

export type ReturnChoice = { cargo: null | { name: string; fee: number } };
export type ReturnDeskAction = BargainAction
  | { action: 'postReturn'; fee: number; ask: number }
  | { action: 'buyReturn'; offer: number; quote: number }
  | { action: 'repriceReturn'; offer: number; quote: number; ask: number }
  | { action: 'cancelReturn' | 'collectReturn'; offer: number };

export function roadstead(departed: number, due: number, loaded = false) {
  const baseDue = due - (loaded ? returnTerms.loadMs : 0);
  const alongside = Math.floor((departed + baseDue - returnTerms.unloadMs) / 2);
  const deadline = alongside + returnTerms.unloadMs;
  return { alongside, deadline, castOff: deadline + (loaded ? returnTerms.loadMs : 0) };
}
