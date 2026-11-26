export const harborRules = {
  fishSeconds: 25,
  catchRations: 4,
  boilSeconds: 35,
  crewRations: 2,
  saltYield: 2,
  exportBarrels: 4,
  savingSeconds: 15,
} as const;

export type HarborAction = 'fish' | 'boil' | 'ship';
export type HarborWork = {
  food: number;
  salt: number;
  provisions: number;
  shipments: number;
  now: number;
  workers: { name: string; kind: 'fish' | 'boil'; due: number }[];
  mine: { kind: 'fish' | 'boil'; due: number } | null;
  lastShip: { name: string; created: number } | null;
};
