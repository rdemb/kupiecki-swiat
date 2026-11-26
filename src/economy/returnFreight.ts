export const returnTerms = {
  sacks: 2, lotCost: 48, maxFee: 18, maxAsk: 100, loadMs: 12_000,
  unloadMs: 8_000, orderMs: 15 * 60_000,
} as const;

export type ReturnOrder = {
  id: number; name: string; fee: number; ask: number; remaining: number;
  state: 'open' | 'aboard' | 'stall'; expires: number; own: boolean;
  ship: number | null; vessel: string | null;
};
export type ReturnChoice = { cargo: null | { name: string; fee: number } };
export type ReturnDeskAction =
  | { action: 'postReturn'; fee: number; ask: number }
  | { action: 'cancelReturn' | 'buyReturn' | 'collectReturn'; offer: number };

export function roadstead(departed: number, due: number, loaded = false) {
  const baseDue = due - (loaded ? returnTerms.loadMs : 0);
  const alongside = Math.floor((departed + baseDue - returnTerms.unloadMs) / 2);
  const deadline = alongside + returnTerms.unloadMs;
  return { alongside, deadline, castOff: deadline + (loaded ? returnTerms.loadMs : 0) };
}
