import { ContinentId, SeasonId } from '../economy/economyEngine';

export type PbrWeatherId =
  | 'clear'
  | 'rain'
  | 'storm'
  | 'blizzard'
  | 'sandstorm'
  | 'fog';

export interface PbrWeatherParams {
  id: PbrWeatherId;
  label: string;
  shortLabel: string;
  description: string;
  /** 0..1 surface wetness driving porous albedo darkening & low PBR roughness */
  wetness: number;
  /** 0..1 fresh snow accumulation frosting horizontal terrain & roofs */
  snowAccumulation: number;
  /** 0..1 windblown ochre sand/dust film on surfaces */
  dustCoat: number;
  /** 0..1 sky cloud overcast darkening */
  overcast: number;
  /** Multiplier on directional sun intensity (0.25..1.0) */
  sunAttenuation: number;
  /** Multiplier on exponential & aerial fog density */
  fogMultiplier: number;
  /** Fog tint hex override blend */
  fogTintHex: number;
  /** Ocean Gerstner swell & whitecap multiplier */
  waveChoppiness: number;
  /** Wind speed affecting particle slant & mist drift */
  windSpeed: number;
  /** Probability per second of storm lightning flash */
  lightningChance: number;
  /** Precipitation / atmospheric particle shader mode */
  particleType: 'none' | 'rain' | 'snow' | 'sand' | 'fog';
  /** Particle fall speed & density scale */
  particleSpeed: number;
  particleOpacity: number;
  particleColorHex: number;
  /** Gameplay impact on caravans & trade routes */
  caravanSpeedMultiplier: number;
  ambushRiskDeltaPct: number;
}

export const PBR_WEATHER_PRESETS: Record<PbrWeatherId, PbrWeatherParams> = {
  clear: {
    id: 'clear',
    label: 'Czyste Niebo (PBR)',
    shortLabel: 'Słońce',
    description: 'Przejrzyste powietrze, suche kamienne trakty i pełny blask słońca.',
    wetness: 0.0,
    snowAccumulation: 0.0,
    dustCoat: 0.0,
    overcast: 0.0,
    sunAttenuation: 1.0,
    fogMultiplier: 1.0,
    fogTintHex: 0xcbb79b,
    waveChoppiness: 1.0,
    windSpeed: 1.0,
    lightningChance: 0.0,
    particleType: 'none',
    particleSpeed: 0,
    particleOpacity: 0.0,
    particleColorHex: 0xffffff,
    caravanSpeedMultiplier: 1.05,
    ambushRiskDeltaPct: 0,
  },
  rain: {
    id: 'rain',
    label: 'Ulewny Deszcz (Mokry PBR)',
    shortLabel: 'Deszcz',
    description: 'Deszcz tworzy lśniące kałuże na traktach i obniża szorstkość kamienia.',
    wetness: 0.78,
    snowAccumulation: 0.0,
    dustCoat: 0.0,
    overcast: 0.58,
    sunAttenuation: 0.62,
    fogMultiplier: 1.48,
    fogTintHex: 0x6f8399,
    waveChoppiness: 1.55,
    windSpeed: 2.2,
    lightningChance: 0.0,
    particleType: 'rain',
    particleSpeed: 58,
    particleOpacity: 0.62,
    particleColorHex: 0xcce4ff,
    caravanSpeedMultiplier: 0.88,
    ambushRiskDeltaPct: 4,
  },
  storm: {
    id: 'storm',
    label: 'Nawałnica i Błyskawice (PBR)',
    shortLabel: 'Burza',
    description: 'Ciężkie chmury burzowe, błyskawice, wzburzony ocean i zalane trakty.',
    wetness: 1.0,
    snowAccumulation: 0.0,
    dustCoat: 0.0,
    overcast: 0.88,
    sunAttenuation: 0.36,
    fogMultiplier: 1.95,
    fogTintHex: 0x3b4d63,
    waveChoppiness: 2.35,
    windSpeed: 3.8,
    lightningChance: 0.28,
    particleType: 'rain',
    particleSpeed: 84,
    particleOpacity: 0.82,
    particleColorHex: 0xd8ecff,
    caravanSpeedMultiplier: 0.74,
    ambushRiskDeltaPct: 10,
  },
  blizzard: {
    id: 'blizzard',
    label: 'Arktyczna Śnieżyca (PBR)',
    shortLabel: 'Śnieg',
    description: 'Gęsty opad śniegu pokrywa szrony i dachy miast lśniącą warstwą mrozu.',
    wetness: 0.22,
    snowAccumulation: 0.92,
    dustCoat: 0.0,
    overcast: 0.72,
    sunAttenuation: 0.55,
    fogMultiplier: 2.1,
    fogTintHex: 0xb9cfe3,
    waveChoppiness: 1.7,
    windSpeed: 2.8,
    lightningChance: 0.0,
    particleType: 'snow',
    particleSpeed: 18,
    particleOpacity: 0.88,
    particleColorHex: 0xf4f9ff,
    caravanSpeedMultiplier: 0.76,
    ambushRiskDeltaPct: 8,
  },
  sandstorm: {
    id: 'sandstorm',
    label: 'Burza Piaskowa Solarii (PBR)',
    shortLabel: 'Piasek',
    description: 'Gorący wiatr niesie chmury złotego piasku, ograniczając widoczność na traktach.',
    wetness: 0.0,
    snowAccumulation: 0.0,
    dustCoat: 0.85,
    overcast: 0.45,
    sunAttenuation: 0.68,
    fogMultiplier: 2.25,
    fogTintHex: 0xc9965b,
    waveChoppiness: 1.65,
    windSpeed: 4.1,
    lightningChance: 0.0,
    particleType: 'sand',
    particleSpeed: 42,
    particleOpacity: 0.72,
    particleColorHex: 0xe8bc76,
    caravanSpeedMultiplier: 0.8,
    ambushRiskDeltaPct: 9,
  },
  fog: {
    id: 'fog',
    label: 'Gęsta Mgła Nadbrzeżna (PBR)',
    shortLabel: 'Mgła',
    description: 'Wilgotna mgła spowija doliny i porty, sprzyjając zasadzkom na szlakach.',
    wetness: 0.45,
    snowAccumulation: 0.0,
    dustCoat: 0.0,
    overcast: 0.5,
    sunAttenuation: 0.72,
    fogMultiplier: 2.65,
    fogTintHex: 0x9aaec2,
    waveChoppiness: 0.85,
    windSpeed: 0.7,
    lightningChance: 0.0,
    particleType: 'fog',
    particleSpeed: 6,
    particleOpacity: 0.68,
    particleColorHex: 0xdbeafe,
    caravanSpeedMultiplier: 0.9,
    ambushRiskDeltaPct: 12,
  },
};

export const PBR_WEATHER_LIST: PbrWeatherParams[] = [
  PBR_WEATHER_PRESETS.clear,
  PBR_WEATHER_PRESETS.rain,
  PBR_WEATHER_PRESETS.storm,
  PBR_WEATHER_PRESETS.blizzard,
  PBR_WEATHER_PRESETS.sandstorm,
  PBR_WEATHER_PRESETS.fog,
];

export function getPbrWeatherParams(id: PbrWeatherId): PbrWeatherParams {
  return PBR_WEATHER_PRESETS[id] ?? PBR_WEATHER_PRESETS.clear;
}

export function getRecommendedWeatherForSeasonAndContinent(
  season: SeasonId,
  continent: ContinentId | 'all',
): PbrWeatherId {
  if (continent === 'frostheim_polnoc' || season === 'zima') return 'blizzard';
  if (continent === 'solaria_poludnie') return 'sandstorm';
  if (continent === 'aetheris_wschod') return 'fog';
  if (season === 'jesien') return 'rain';
  return 'clear';
}

export function getWeatherTradeModifiers(id: PbrWeatherId): {
  speedMultiplier: number;
  ambushRiskDeltaPct: number;
  label: string;
} {
  const p = getPbrWeatherParams(id);
  return {
    speedMultiplier: p.caravanSpeedMultiplier,
    ambushRiskDeltaPct: p.ambushRiskDeltaPct,
    label: p.label,
  };
}
