export const barterGoods = ['zboze', 'drewno_elfickie', 'zelazo'] as const;
export type BarterGood = (typeof barterGoods)[number];
export const barterNames: Record<BarterGood, string> = {
  zboze: 'Zboże',
  drewno_elfickie: 'Drewno elfickie',
  zelazo: 'Ruda żelaza',
};
export const maxBarterLot = 99;
export type BarterTerms = { give: BarterGood; giveQty: number; want: BarterGood; wantQty: number };
export type BarterOffer = BarterTerms & {
  id: number;
  name: string;
  mine: boolean;
  sealed: boolean;
};
export type BarterCircle = { id: number; offers: BarterOffer[]; completed: number | null };
export type BarterCall = BarterTerms & {
  id: number;
  first: number;
  second: number;
  firstName: string;
  secondName: string;
  postedBy: number;
};
export function missingBarterTerms(first: BarterTerms, second: BarterTerms): BarterTerms | null {
  if (first.want !== second.give || first.wantQty !== second.giveQty || second.want === first.give)
    return null;
  return { give: second.want, giveQty: second.wantQty, want: first.give, wantQty: first.giveQty };
}
export function findBarterPair(waiting: BarterOffer[], own?: BarterOffer) {
  if (own) {
    for (const other of waiting) {
      const after = missingBarterTerms(own, other);
      if (after) return { first: own, second: other, terms: after };
      const before = missingBarterTerms(other, own);
      if (before) return { first: other, second: own, terms: before };
    }
    return;
  }
  const legs = new Map<string, BarterOffer>();
  const key = (g: BarterGood, qty: number, w: BarterGood) => [g, qty, w].join('/');
  for (const offer of waiting) {
    const k = key(offer.give, offer.giveQty, offer.want);
    if (!legs.has(k)) legs.set(k, offer);
  }
  for (const first of waiting) {
    const thirdGood = barterGoods.find((g) => g !== first.give && g !== first.want)!;
    const second = legs.get(key(first.want, first.wantQty, thirdGood));
    if (second) return { first, second, terms: missingBarterTerms(first, second)! };
  }
}
export type BarterBook = {
  calls?: BarterCall[];
  waiting: BarterOffer[];
  circles: BarterCircle[];
  recent: BarterCircle[];
};
export type BarterCommand =
  | ({ action: 'postBarter' } & BarterTerms)
  | { action: 'inviteBarter'; first: number; second: number }
  | { action: 'recallBarterCall' | 'answerBarterCall'; call: number }
  | { action: 'withdrawBarter'; offer: number }
  | { action: 'sealBarter'; circle: number; offer: number };
export const barterHref = (town: string, call?: number) =>
  '?miejsce=targ&miasto=' + town + (call ? '&wezwanie=' + call : '');
const lotUnits = {
  zboze: ['worek zboża', 'worki zboża', 'worków zboża'],
  drewno_elfickie: ['bal elfickiego drewna', 'bale elfickiego drewna', 'bali elfickiego drewna'],
  zelazo: ['miarę rudy żelaza', 'miary rudy żelaza', 'miar rudy żelaza'],
} as const;
const plural = new Intl.PluralRules('pl');
export function barterLot(item: BarterGood, qty: number) {
  const form = plural.select(qty);
  return qty + ' ' + lotUnits[item][form === 'one' ? 0 : form === 'few' ? 1 : 2];
}
