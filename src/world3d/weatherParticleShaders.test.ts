import test from 'node:test';
import assert from 'node:assert/strict';
import { getPbrWeatherParams } from './pbrWeather';
import { computeWeatherShaderUniformTargets } from './weatherParticleShaders';

test('computeWeatherShaderUniformTargets maps rain and storm presets to velocity-aligned rain streak shaders', () => {
  const rainTargets = computeWeatherShaderUniformTargets(getPbrWeatherParams('rain'), 0, 0);
  assert.deepEqual(rainTargets.modeWeights, [1, 0, 0, 0]);
  assert.equal(rainTargets.velocityAlign, 1.0);
  assert.ok(rainTargets.particleHeight > rainTargets.particleWidth * 10, 'Rain streaks must be strongly elongated');
  assert.ok(rainTargets.precipOpacity > 0.5);
  assert.ok(rainTargets.fogOpacity > 0.15, 'Rain should pair with subtle storm mist');

  const stormTargets = computeWeatherShaderUniformTargets(getPbrWeatherParams('storm'), 0.9, 0.5);
  assert.deepEqual(stormTargets.modeWeights, [1, 0, 0, 0]);
  assert.ok(stormTargets.fallSpeed > rainTargets.fallSpeed, 'Storm rain must fall faster than regular rain');
  assert.ok(stormTargets.particleHeight > rainTargets.particleHeight, 'Storm streaks must be longer');
  assert.ok(stormTargets.windVector[0] > rainTargets.windVector[0], 'Storm wind must slant rain harder');
  assert.ok(stormTargets.lightningBoost > 1.0, 'Storm lightning flash must boost rain shader luminance');
});

test('computeWeatherShaderUniformTargets maps blizzard preset to rotating camera-billboarded crystalline snow shader', () => {
  const snowTargets = computeWeatherShaderUniformTargets(getPbrWeatherParams('blizzard'), 0, 0.8);
  assert.deepEqual(snowTargets.modeWeights, [0, 1, 0, 0]);
  assert.equal(snowTargets.velocityAlign, 0.0, 'Snowflakes must billboard toward camera rather than stretch');
  assert.equal(snowTargets.particleWidth, snowTargets.particleHeight);
  assert.ok(snowTargets.swayAmplitude >= 3.0, 'Snowflakes must have visible 3D wind swirl');
  assert.ok(snowTargets.precipOpacity > 0.8);
  assert.ok(snowTargets.fogOpacity > 0.35, 'Blizzard must include cold drifting whiteout mist');
});

test('computeWeatherShaderUniformTargets maps fog preset to high-density volumetric FBM fog shader', () => {
  const fogPreset = getPbrWeatherParams('fog');
  assert.equal(fogPreset.particleType, 'fog');

  const fogTargets = computeWeatherShaderUniformTargets(fogPreset, 0, 0.2);
  assert.deepEqual(fogTargets.modeWeights, [0, 0, 0, 1]);
  assert.equal(fogTargets.precipOpacity, 0, 'Fog mode must not draw falling rain/snow streaks');
  assert.ok(fogTargets.fogOpacity >= 0.7, 'Fog mode must strongly activate volumetric FBM fog shader');
  assert.ok(fogTargets.fogScale > 1.2, 'Fog mode should enlarge volumetric mist wisps');
});

test('computeWeatherShaderUniformTargets maps sandstorm and clear presets cleanly', () => {
  const sandTargets = computeWeatherShaderUniformTargets(getPbrWeatherParams('sandstorm'), 0, 0);
  assert.deepEqual(sandTargets.modeWeights, [0, 0, 1, 0]);
  assert.ok(sandTargets.windVector[0] > 40, 'Sandstorm must drive strong horizontal wind');
  assert.ok(sandTargets.fogOpacity >= 0.5, 'Sandstorm must render dusty volumetric haze');

  const clearTargets = computeWeatherShaderUniformTargets(getPbrWeatherParams('clear'), 0, 0);
  assert.deepEqual(clearTargets.modeWeights, [0, 0, 0, 0]);
  assert.equal(clearTargets.precipOpacity, 0);
  assert.equal(clearTargets.fogOpacity, 0);
});
