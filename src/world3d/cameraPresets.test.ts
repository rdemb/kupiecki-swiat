import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMBIENT_CARAVAN_ROUTES,
  CAMERA_PRESETS,
  buildActiveRouteList,
  computeCaravanCameraPose,
  computeStaticCameraPresetPose,
  type PlayerCaravanSummaryInput,
} from './cameraPresets';

describe('computeCaravanCameraPose', () => {
  it('places the 3D chase camera behind and above the caravan heading without clipping terrain', () => {
    const pos: [number, number, number] = [10, 4, 20];
    const lookAhead: [number, number, number] = [20, 4, 20]; // heading +X
    const pose = computeCaravanCameraPose(pos, lookAhead, () => 2.5);

    // Camera must trail behind (+X heading -> camera X < caravan X)
    assert.ok(pose.position[0] < pos[0], `Expected camX < caravanX, got ${pose.position[0]}`);
    // Camera must be clearly elevated above both caravan and terrain
    assert.ok(pose.position[1] >= pos[1] + 10, `Expected elevated camY, got ${pose.position[1]}`);
    // Target must look slightly ahead of caravan
    assert.ok(pose.target[0] > pos[0], `Expected targetX ahead of caravan, got ${pose.target[0]}`);
  });

  it('clamps camera height above steep hills behind the caravan', () => {
    const pos: [number, number, number] = [0, 3, 0];
    const lookAhead: [number, number, number] = [0, 3, 10];
    const steepMountainTerrain = () => 30;
    const pose = computeCaravanCameraPose(pos, lookAhead, steepMountainTerrain);

    assert.ok(
      pose.position[1] >= 36.5,
      `Expected camera Y to clear 30m mountain behind caravan, got ${pose.position[1]}`,
    );
  });

  it('handles degenerate zero-length direction vectors without NaN', () => {
    const pose = computeCaravanCameraPose([5, 2, -4], [5, 2, -4], () => 1);
    for (const coord of [...pose.position, ...pose.target]) {
      assert.ok(Number.isFinite(coord), `Expected finite coordinate, got ${coord}`);
    }
  });
});

describe('computeStaticCameraPresetPose & CAMERA_PRESETS', () => {
  it('defines all 5 CameraPresets including caravan chase mode', () => {
    assert.ok(CAMERA_PRESETS.world);
    assert.ok(CAMERA_PRESETS.continent);
    assert.ok(CAMERA_PRESETS.city);
    assert.ok(CAMERA_PRESETS.routes);
    assert.ok(CAMERA_PRESETS.caravan);
  });

  it('computes distinct camera poses for city, continent, routes, and world presets', () => {
    const cityPose = computeStaticCameraPresetPose('city', [12, 3, -8], 'stary_kontynent');
    const worldPose = computeStaticCameraPresetPose('world', [12, 3, -8], 'stary_kontynent');
    const routesPose = computeStaticCameraPresetPose('routes', [12, 3, -8], 'stary_kontynent');

    assert.equal(cityPose.position[0], 36);
    assert.ok(worldPose.position[1] > cityPose.position[1]);
    assert.ok(routesPose.position[1] > worldPose.position[1]);
  });
});

describe('buildActiveRouteList', () => {
  it('prioritizes player-dispatched caravans ahead of continental royal convoys', () => {
    const playerCaravans: PlayerCaravanSummaryInput[] = [
      {
        id: 'caravan_player_1',
        originCityId: 'krolewska_przystan',
        destinationCityId: 'zelazna_kuznia',
        commodityId: 'zboze',
        quantity: 25,
        escortLevel: 2,
        progress: 0.45,
        expectedProfit: 1450,
      },
    ];

    const list = buildActiveRouteList(playerCaravans, 'all');
    assert.equal(list.length, 1 + AMBIENT_CARAVAN_ROUTES.length);
    assert.equal(list[0].id, 'caravan_player_1');
    assert.equal(list[0].kind, 'player');
    assert.equal(list[0].progressPct, 45);
    assert.equal(list[0].expectedProfit, 1450);
    assert.equal(list[1].kind, 'royal');
    assert.equal(list[1].id, 'ambient_0');
  });

  it('filters active routes cleanly by selected continent', () => {
    const valoriaOnly = buildActiveRouteList([], 'valoria_zachod');
    assert.equal(valoriaOnly.length, 1);
    assert.equal(valoriaOnly[0].id, 'ambient_5');
    assert.equal(valoriaOnly[0].originCityId, 'valgard');
  });
});
