import type { Passage } from './bridge';
import type { FeastTown } from './harvestLoaf';

export interface SpurReceipt {
  load: number;
  name: string;
  mentor: string;
  captain: string;
  origin: FeastTown;
  destination: FeastTown;
  road: Passage;
}
export type SpurVerdict = 'knighted' | 'declined';
export interface SpurPetition extends SpurReceipt {
  witness: string;
  testimony: string;
  state: 'pending' | SpurVerdict;
  sealedBy: string | null;
}
export interface SpurBook {
  receipts: SpurReceipt[];
  petitions: SpurPetition[];
}
