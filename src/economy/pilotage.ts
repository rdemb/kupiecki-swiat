export type Course = 'outer' | 'survey' | 'cut';
export const keelClearanceCm = 120;
export const courseNames: Record<Course, string> = {
  outer: 'Tor zewnętrzny',
  survey: 'Rejs z sondą',
  cut: 'Przesmyk przez ławicę',
};
export function passageSeconds(base: number, course: Course) {
  if (course === 'cut') return Math.ceil((base * 2) / 3);
  if (course === 'survey') return base + 12;
  return base;
}

export interface Sounding {
  voyage: number;
  ship: number;
  vessel: string;
  skipper: string;
  cm: number;
  at: number;
  edition: number;
  reward: number;
}
export const maxSoundingPledge = 500;
export interface SoundingFund {
  total: number;
  patrons: { name: string; amount: number }[];
  mine: number;
  last: {
    total: number;
    at: number;
    skipper: string | null;
    cm: number | null;
  } | null;
}
export interface PilotFolio {
  history: Sounding[];
  more: boolean;
}
export interface PilotBook extends PilotFolio {
  fund: SoundingFund;
  edition: number;
  storm: boolean;
  lastStorm: number | null;
  latest: Sounding | null;
}
export function usableSounding(book: PilotBook) {
  const mark = book.latest;
  return !book.storm &&
    mark &&
    mark.edition === book.edition &&
    mark.cm >= keelClearanceCm
    ? mark
    : null;
}
