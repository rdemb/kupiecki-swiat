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
export type BarterBook = {
  waiting: BarterOffer[];
  circles: BarterCircle[];
  recent: BarterCircle[];
};
export type BarterCommand =
  | ({ action: 'postBarter' } & BarterTerms)
  | { action: 'withdrawBarter'; offer: number }
  | { action: 'sealBarter'; circle: number; offer: number };
export const barterHref = (town: string) => '?miejsce=targ&miasto=' + town;
