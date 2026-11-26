import type { Craft } from './newHope';
import type { Course } from './pilotage';

export const hullEmblems = {
  anchor: 'Kotwica', leaf: 'Liść dębu', shell: 'Muszla', star: 'Gwiazda północy',
} as const;
export type HullEmblem = keyof typeof hullEmblems;
export type HullPart = 'keel' | 'oak' | 'iron';
export interface HullHand {
  part: HullPart | 'plank';
  name: string;
  lots: number;
  emblem: HullEmblem | null;
  engraved: number | null;
  mastery: Craft | null;
  mine: boolean;
}
export interface HullRecord {
  hands: HullHand[];
  canFitFirst: boolean;
  routes: {course: Course; trips: number}[];
}
