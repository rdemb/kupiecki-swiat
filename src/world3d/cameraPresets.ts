import { CITIES, COMMODITIES, CommodityId, ContinentId } from '../economy/economyEngine';
import { WORLD_CONTINENTS, WORLD_REGIONS } from '../economy/worldMapData';

export type CameraPresetId = 'world' | 'continent' | 'city' | 'routes' | 'caravan';

export interface CameraPresetSpec {
  id: CameraPresetId;
  label: string;
  description: string;
}

export const CAMERA_PRESETS: Record<CameraPresetId, CameraPresetSpec> = {
  world: {
    id: 'world',
    label: 'Świat 4K',
    description: 'Panorama wszystkich 6 kontynentów',
  },
  continent: {
    id: 'continent',
    label: 'Kontynent',
    description: 'Przegląd wybranego kontynentu',
  },
  city: {
    id: 'city',
    label: 'Zbliżenie',
    description: 'Zbliżenie na wybrane miasto lub region',
  },
  routes: {
    id: 'routes',
    label: 'Szlaki',
    description: 'Wysoki przegląd szlaków handlowych',
  },
  caravan: {
    id: 'caravan',
    label: 'Karawana 3D',
    description: 'Dynamiczne śledzenie karawany w locie',
  },
};

export interface AmbientCaravanRouteSpec {
  id: string;
  originCityId: string;
  destinationCityId: string;
  routeKey: string;
  continentId: ContinentId;
  cargoLabel: string;
  initialPhase: number;
  speed: number;
}

/**
 * Canonical continental land caravan routes shared between World3DCanvas
 * (live 3D wagons) and WorldMapAtlasPanel (interactive active routes list).
 */
export const AMBIENT_CARAVAN_ROUTES: AmbientCaravanRouteSpec[] = [
  {
    id: 'ambient_0',
    originCityId: 'krolewska_przystan',
    destinationCityId: 'srebrny_gaj',
    routeKey: 'krolewska_przystan__srebrny_gaj',
    continentId: 'stary_kontynent',
    cargoLabel: 'Zboże i Jedwab',
    initialPhase: 0.14,
    speed: 0.03,
  },
  {
    id: 'ambient_1',
    originCityId: 'krolewska_przystan',
    destinationCityId: 'zelazna_kuznia',
    routeKey: 'krolewska_przystan__zelazna_kuznia',
    continentId: 'stary_kontynent',
    cargoLabel: 'Ruda Żelaza',
    initialPhase: 0.31,
    speed: 0.034,
  },
  {
    id: 'ambient_2',
    originCityId: 'krolewska_przystan',
    destinationCityId: 'krwawy_szczyt',
    routeKey: 'krolewska_przystan__krwawy_szczyt',
    continentId: 'stary_kontynent',
    cargoLabel: 'Stal i Przyprawy',
    initialPhase: 0.48,
    speed: 0.038,
  },
  {
    id: 'ambient_3',
    originCityId: 'srebrny_gaj',
    destinationCityId: 'zelazna_kuznia',
    routeKey: 'srebrny_gaj__zelazna_kuznia',
    continentId: 'stary_kontynent',
    cargoLabel: 'Drewno Szlachetne',
    initialPhase: 0.65,
    speed: 0.042,
  },
  {
    id: 'ambient_4',
    originCityId: 'zelazna_kuznia',
    destinationCityId: 'krwawy_szczyt',
    routeKey: 'zelazna_kuznia__krwawy_szczyt',
    continentId: 'stary_kontynent',
    cargoLabel: 'Mithril Górski',
    initialPhase: 0.82,
    speed: 0.03,
  },
  {
    id: 'ambient_5',
    originCityId: 'valgard',
    destinationCityId: 'smocza_przystan',
    routeKey: 'valgard__smocza_przystan',
    continentId: 'valoria_zachod',
    cargoLabel: 'Smocze Łuski',
    initialPhase: 0.22,
    speed: 0.034,
  },
  {
    id: 'ambient_6',
    originCityId: 'obsydianowa_cytadela',
    destinationCityId: 'port_popiolow',
    routeKey: 'obsydianowa_cytadela__port_popiolow',
    continentId: 'obsydian_wulkan',
    cargoLabel: 'Obsydian i Siarka',
    initialPhase: 0.56,
    speed: 0.038,
  },
];

export interface PlayerCaravanSummaryInput {
  id: string;
  originCityId: string;
  destinationCityId: string;
  commodityId: CommodityId;
  quantity: number;
  escortLevel: number;
  progress: number;
  expectedProfit: number;
}

export interface ActiveRouteListItem {
  id: string;
  kind: 'player' | 'royal';
  originCityId: string;
  originCityName: string;
  destinationCityId: string;
  destinationCityName: string;
  continentId: ContinentId;
  cargoLabel: string;
  progressPct: number | null;
  expectedProfit: number | null;
  atlasPercent: [number, number];
}

export interface CameraPose3D {
  position: [number, number, number];
  target: [number, number, number];
}

/**
 * Computes a cinematic 3/4 elevated chase camera pose tracking a moving caravan
 * in 3D space while guaranteeing clearance above local terrain elevation.
 */
export function computeCaravanCameraPose(
  caravanPos: [number, number, number],
  caravanLookAhead: [number, number, number],
  terrainHeightAt: (x: number, z: number) => number,
): CameraPose3D {
  let dx = caravanLookAhead[0] - caravanPos[0];
  let dz = caravanLookAhead[2] - caravanPos[2];
  const horizLen = Math.hypot(dx, dz);

  if (horizLen < 1e-4) {
    dx = 0.7071;
    dz = 0.7071;
  } else {
    dx /= horizLen;
    dz /= horizLen;
  }

  // Perpendicular right vector in XZ plane for 3/4 heroic chase framing
  const rightX = -dz;
  const rightZ = dx;

  const backDist = 15.5;
  const sideDist = 7.8;
  const heightAboveCaravan = 11.5;

  const camX = caravanPos[0] - dx * backDist + rightX * sideDist;
  const camZ = caravanPos[2] - dz * backDist + rightZ * sideDist;
  const groundUnderCam = terrainHeightAt(camX, camZ);
  const camY = Math.max(caravanPos[1] + heightAboveCaravan, groundUnderCam + 6.5);

  const lookX = caravanPos[0] + dx * 2.2;
  const lookZ = caravanPos[2] + dz * 2.2;
  const lookY = caravanPos[1] + 1.8;

  return {
    position: [camX, camY, camZ],
    target: [lookX, lookY, lookZ],
  };
}

/**
 * Computes camera position & look-at target for static CameraPresets
 * ('world' | 'continent' | 'city' | 'routes').
 */
export function computeStaticCameraPresetPose(
  preset: Exclude<CameraPresetId, 'caravan'>,
  activeRegionPos: [number, number, number],
  activeContinentId: ContinentId,
): CameraPose3D {
  const [ax, ay, az] = activeRegionPos;
  if (preset === 'city') {
    return {
      position: [ax + 24, ay + 20, az + 28],
      target: [ax, ay + 3.8, az],
    };
  }
  if (preset === 'continent') {
    const contSpec =
      WORLD_CONTINENTS.find((c) => c.id === activeContinentId) ?? WORLD_CONTINENTS[0];
    return {
      position: [...contSpec.cameraOverviewPos],
      target: [...contSpec.cameraOverviewLook],
    };
  }
  if (preset === 'routes') {
    return {
      position: [6, 240, 215],
      target: [6, 2, 10],
    };
  }
  return {
    position: [10, 178, 306],
    target: [0, 4, 14],
  };
}

function getCityAtlasPercent(cityId: string): [number, number] {
  const reg =
    WORLD_REGIONS.find((r) => r.linkedCityId === cityId || r.id === cityId) ??
    WORLD_REGIONS[0];
  return reg.atlasPercent;
}

function getCityShortName(cityId: string): string {
  const city = CITIES.find((c) => c.id === cityId);
  return city ? city.name.split(' (')[0] : cityId;
}

function getCityContinentId(cityId: string): ContinentId {
  const reg = WORLD_REGIONS.find((r) => r.linkedCityId === cityId || r.id === cityId);
  return reg?.continentId ?? 'stary_kontynent';
}

/**
 * Builds the sorted interactive list of in-flight caravan routes for WorldMapAtlasPanel,
 * combining player-dispatched caravans (prioritized first with live progress) and
 * live continental trade convoys rendered in World3DCanvas.
 */
export function buildActiveRouteList(
  playerCaravans: PlayerCaravanSummaryInput[],
  selectedContinentId: ContinentId | 'all' = 'all',
): ActiveRouteListItem[] {
  const playerItems: ActiveRouteListItem[] = playerCaravans.map((c) => {
    const origPct = getCityAtlasPercent(c.originCityId);
    const destPct = getCityAtlasPercent(c.destinationCityId);
    const t = Math.max(0, Math.min(1, Number.isFinite(c.progress) ? c.progress : 0));
    const comm = COMMODITIES.find((item) => item.id === c.commodityId);
    const origContinent = getCityContinentId(c.originCityId);
    const destContinent = getCityContinentId(c.destinationCityId);
    const effectiveContinent =
      selectedContinentId !== 'all' && destContinent === selectedContinentId
        ? destContinent
        : origContinent;

    return {
      id: c.id,
      kind: 'player',
      originCityId: c.originCityId,
      originCityName: getCityShortName(c.originCityId),
      destinationCityId: c.destinationCityId,
      destinationCityName: getCityShortName(c.destinationCityId),
      continentId: effectiveContinent,
      cargoLabel: `${c.quantity}× ${comm?.name ?? c.commodityId}`,
      progressPct: Math.round(t * 100),
      expectedProfit: Math.round(c.expectedProfit),
      atlasPercent: [
        origPct[0] + (destPct[0] - origPct[0]) * t,
        origPct[1] + (destPct[1] - origPct[1]) * t,
      ],
    };
  });

  const royalItems: ActiveRouteListItem[] = AMBIENT_CARAVAN_ROUTES.map((route) => {
    const origPct = getCityAtlasPercent(route.originCityId);
    const destPct = getCityAtlasPercent(route.destinationCityId);
    const t = route.initialPhase;
    return {
      id: route.id,
      kind: 'royal',
      originCityId: route.originCityId,
      originCityName: getCityShortName(route.originCityId),
      destinationCityId: route.destinationCityId,
      destinationCityName: getCityShortName(route.destinationCityId),
      continentId: route.continentId,
      cargoLabel: route.cargoLabel,
      progressPct: null,
      expectedProfit: null,
      atlasPercent: [
        origPct[0] + (destPct[0] - origPct[0]) * t,
        origPct[1] + (destPct[1] - origPct[1]) * t,
      ],
    };
  });

  const allItems = [...playerItems, ...royalItems];
  if (selectedContinentId === 'all') return allItems;

  return allItems.filter((item) => {
    const origCont = getCityContinentId(item.originCityId);
    const destCont = getCityContinentId(item.destinationCityId);
    return (
      item.continentId === selectedContinentId ||
      origCont === selectedContinentId ||
      destCont === selectedContinentId
    );
  });
}
