import type { WeatherConditionId } from './economyEngine';

export const warningMark = 135;
export const floodMark = 170;
export const readingInterval = 10_000;
export const freshFor = 45_000;
export const boardDuration = 10 * 60_000;

export interface RiverReading {
  id: number;
  name: string;
  at: number;
  cm: number;
  previousAt: number | null;
  previousCm: number | null;
  posted: number | null;
}

export function waterBand(cm: number) {
  if (cm >= floodMark) return 'Znak wezbrania osiągnięty';
  if (cm >= warningMark) return 'Woda ostrzegawcza';
  return 'Poniżej znaku ostrzegawczego';
}

// Millimetres would introduce rounding on repeated reads. Store thousandths
// of a centimetre, so rates in cm/s are also integer units per millisecond.
const currents: Record<WeatherConditionId, { target: number; rate: number }> = {
  sloneczna_pogoda: { target: 74, rate: 2 },
  wiatr_handlowy: { target: 110, rate: 1 },
  ulewne_deszcze: { target: 216, rate: 4 },
  sztorm_na_zatoce: { target: 152, rate: 2 },
  zamiec_i_mroz: { target: 86, rate: 1 },
};

export function riverAfter(
  level: number,
  since: number,
  sky: WeatherConditionId,
  now: number,
) {
  const { target, rate } = currents[sky];
  const gap = target * 1000 - level;
  const movement = Math.min(Math.abs(gap), Math.max(0, now - since) * rate);
  const next = level + Math.sign(gap) * movement;
  const crest = floodMark * 1000;
  const crossedAt =
    level < crest && next >= crest
      ? since + Math.ceil((crest - level) / rate)
      : null;
  return { level: next, crossedAt };
}
