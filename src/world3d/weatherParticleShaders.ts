import * as THREE from 'three';
import { PbrWeatherParams } from './pbrWeather';

export interface WeatherShaderUniformTargets {
  /** Mode blend weights: [rain, snow, sand, fog] each in 0..1 */
  modeWeights: [number, number, number, number];
  /** Precipitation streak/flake opacity (0..1) */
  precipOpacity: number;
  /** Volumetric drifting fog/mist shader opacity (0..1) */
  fogOpacity: number;
  /** Vertical fall speed in world units/sec */
  fallSpeed: number;
  /** Horizontal wind velocity [x, z] in world units/sec */
  windVector: [number, number];
  /** Sinusoidal 3D turbulence amplitude (strong for snow/sand, subtle for rain) */
  swayAmplitude: number;
  /** Sinusoidal 3D turbulence frequency */
  swayFrequency: number;
  /** Base quad width in world units */
  particleWidth: number;
  /** Base quad height in world units (elongated for rain streaks) */
  particleHeight: number;
  /** 0 = camera billboard (snow), 1 = velocity-aligned stretched ribbon (rain/sand) */
  velocityAlign: number;
  /** Precipitation tint hex */
  precipColorHex: number;
  /** Volumetric fog tint hex */
  fogColorHex: number;
  /** Lightning illumination boost (0..1.5) */
  lightningBoost: number;
  /** Volumetric fog drift speed multiplier */
  fogDriftSpeed: number;
  /** Volumetric fog billboard scale multiplier */
  fogScale: number;
}

/**
 * Pure, unit-testable mapper converting PBR weather presets + live atmospheric state
 * into GPU GLSL shader uniform targets for precipitation and volumetric fog layers.
 */
export function computeWeatherShaderUniformTargets(
  weather: PbrWeatherParams,
  lightningFlash = 0,
  nightFactor = 0,
): WeatherShaderUniformTargets {
  const clampedLightning = Math.max(0, Math.min(1.5, lightningFlash));
  const clampedNight = Math.max(0, Math.min(1, nightFactor));
  const isStorm = weather.id === 'storm';

  if (weather.particleType === 'rain') {
    return {
      modeWeights: [1.0, 0.0, 0.0, 0.0],
      precipOpacity: Math.min(1.0, weather.particleOpacity * (isStorm ? 1.12 : 1.05)),
      fogOpacity: isStorm ? 0.36 : 0.22,
      fallSpeed: weather.particleSpeed * (isStorm ? 1.08 : 0.96),
      windVector: [weather.windSpeed * (isStorm ? 10.2 : 6.8), weather.windSpeed * 2.8],
      swayAmplitude: isStorm ? 0.45 : 0.2,
      swayFrequency: 2.2,
      particleWidth: isStorm ? 0.42 : 0.34,
      particleHeight: isStorm ? 6.6 : 5.0,
      velocityAlign: 1.0,
      precipColorHex: weather.particleColorHex,
      fogColorHex: weather.fogTintHex,
      lightningBoost: clampedLightning * (isStorm ? 1.35 : 0.5),
      fogDriftSpeed: weather.windSpeed * 2.1,
      fogScale: isStorm ? 1.18 : 1.0,
    };
  }

  if (weather.particleType === 'snow') {
    return {
      modeWeights: [0.0, 1.0, 0.0, 0.0],
      precipOpacity: Math.min(1.0, weather.particleOpacity * 1.04),
      fogOpacity: 0.44,
      fallSpeed: weather.particleSpeed * 0.85,
      windVector: [weather.windSpeed * 4.4, weather.windSpeed * 2.4],
      swayAmplitude: 3.4,
      swayFrequency: 1.55,
      particleWidth: 1.08,
      particleHeight: 1.08,
      velocityAlign: 0.0,
      precipColorHex: weather.particleColorHex,
      fogColorHex: 0xd6e6f5,
      lightningBoost: clampedLightning * 0.25 + clampedNight * 0.14,
      fogDriftSpeed: weather.windSpeed * 1.65,
      fogScale: 1.12,
    };
  }

  if (weather.particleType === 'sand') {
    return {
      modeWeights: [0.0, 0.0, 1.0, 0.0],
      precipOpacity: Math.min(1.0, weather.particleOpacity * 1.05),
      fogOpacity: 0.52,
      fallSpeed: weather.particleSpeed * 0.24,
      windVector: [weather.windSpeed * 14.5, weather.windSpeed * 4.8],
      swayAmplitude: 2.6,
      swayFrequency: 2.8,
      particleWidth: 0.72,
      particleHeight: 3.8,
      velocityAlign: 0.85,
      precipColorHex: weather.particleColorHex,
      fogColorHex: 0xd4a468,
      lightningBoost: 0.0,
      fogDriftSpeed: weather.windSpeed * 3.1,
      fogScale: 1.24,
    };
  }

  if (weather.particleType === 'fog') {
    return {
      modeWeights: [0.0, 0.0, 0.0, 1.0],
      precipOpacity: 0.0,
      fogOpacity: Math.min(0.95, Math.max(0.68, weather.particleOpacity * 1.28)),
      fallSpeed: 0.0,
      windVector: [weather.windSpeed * 3.8, weather.windSpeed * 1.9],
      swayAmplitude: 2.8,
      swayFrequency: 0.55,
      particleWidth: 0.0,
      particleHeight: 0.0,
      velocityAlign: 0.0,
      precipColorHex: weather.particleColorHex,
      fogColorHex: 0xcbe0f2,
      lightningBoost: clampedNight * 0.08,
      fogDriftSpeed: Math.max(2.4, weather.windSpeed * 3.6),
      fogScale: 1.38,
    };
  }

  // Clear sky: smoothly fade out all weather particle shaders
  return {
    modeWeights: [0.0, 0.0, 0.0, 0.0],
    precipOpacity: 0.0,
    fogOpacity: 0.0,
    fallSpeed: 0.0,
    windVector: [weather.windSpeed * 1.2, weather.windSpeed * 0.5],
    swayAmplitude: 0.4,
    swayFrequency: 0.8,
    particleWidth: 0.5,
    particleHeight: 0.5,
    velocityAlign: 0.0,
    precipColorHex: weather.particleColorHex,
    fogColorHex: weather.fogTintHex,
    lightningBoost: 0.0,
    fogDriftSpeed: 1.0,
    fogScale: 1.0,
  };
}

export interface WeatherParticleShaderUpdateParams {
  dt: number;
  elapsed: number;
  cameraPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  weather: PbrWeatherParams;
  lightningFlash: number;
  nightFactor: number;
  fogColor: THREE.Color;
  sunColor: THREE.Color;
  snapNow?: boolean;
}

export interface WeatherParticleShaderSystem {
  group: THREE.Group;
  update: (params: WeatherParticleShaderUpdateParams) => void;
  dispose: () => void;
}

// Pre-allocated module-level scratch objects (Zero GC inside render loop)
const _viewDir = new THREE.Vector3();
const _precipCenter = new THREE.Vector3();
const _fogCamCenter = new THREE.Vector3();
const _targetPrecipCol = new THREE.Color();
const _targetFogCol = new THREE.Color();

function createInstancedQuadGeometry(count: number, seedOffset: number): THREE.InstancedBufferGeometry {
  const baseQuad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = baseQuad.index;
  geo.setAttribute('position', baseQuad.attributes.position);
  geo.setAttribute('uv', baseQuad.attributes.uv);

  const offsets = new Float32Array(count * 3);
  const params = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const idx = i + seedOffset;
    const h1 = Math.abs(Math.sin(idx * 12.9898 + 0.31) * 43758.5453) % 1;
    const h2 = Math.abs(Math.sin(idx * 78.233 + 1.73) * 24634.6345) % 1;
    const h3 = Math.abs(Math.sin(idx * 39.425 + 4.27) * 19532.1234) % 1;
    const h4 = Math.abs(Math.sin(idx * 93.117 + 7.11) * 31415.9265) % 1;

    offsets[i * 3] = h1;
    offsets[i * 3 + 1] = h2;
    offsets[i * 3 + 2] = h3;

    // x: size scale (wider natural variety), y: fall/drift speed variance, z: phase seed (0..2PI), w: layer flag (0..1)
    params[i * 4] = 0.48 + h4 * 0.96;
    params[i * 4 + 1] = 0.74 + ((h1 + h3) * 0.5) * 0.58;
    params[i * 4 + 2] = h2 * Math.PI * 2;
    params[i * 4 + 3] = i / count;
  }

  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geo.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 4));
  geo.instanceCount = count;

  baseQuad.dispose();
  return geo;
}

const PRECIPITATION_VERTEX_SHADER = `
  attribute vec3 aOffset;
  attribute vec4 aParams;

  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBoxSize;
  uniform vec2 uWind;
  uniform float uFallSpeed;
  uniform float uSwayAmp;
  uniform float uSwayFreq;
  uniform vec2 uParticleSize;
  uniform float uVelocityAlign;
  uniform vec4 uModeWeights;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vSeed;
  varying float vSparkle;

  void main() {
    vUv = uv;
    vSeed = aParams.z;

    // 100% GPU wrapped motion inside a camera-ahead 3D volume (zero CPU updates!)
    float speedVar = aParams.y;
    vec3 motion = vec3(
      uWind.x * speedVar * uTime,
      -uFallSpeed * speedVar * uTime,
      uWind.y * speedVar * uTime
    );

    vec3 wrapped01 = fract((aOffset * uBoxSize + motion - uCenter) / uBoxSize);
    vec3 localPos = (wrapped01 - 0.5) * uBoxSize;

    // Smooth sinusoidal 3D turbulence (swirling snowflakes & drifting sand eddies)
    float phase = uTime * uSwayFreq + aParams.z;
    vec3 sway = vec3(
      sin(phase) * uSwayAmp,
      cos(phase * 0.72) * uSwayAmp * 0.22,
      cos(phase * 0.88 + aParams.z * 0.7) * uSwayAmp
    );

    vec3 worldCenter = uCenter + localPos + sway;

    // Camera basis extracted from viewMatrix for crisp GPU billboarding
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 toCam = normalize(cameraPosition - worldCenter);

    // Velocity-aligned stretched ribbon axis for rain streaks & sandstorm gusts
    vec3 velAxis = vec3(-uWind.x, max(uFallSpeed, 1.5), -uWind.y);
    vec3 streakUp = normalize(velAxis);
    vec3 streakRight = normalize(cross(toCam, streakUp) + vec3(0.0001, 0.0, 0.0001));

    // Rotating camera-facing billboard basis for crystalline snowflakes
    float rot = aParams.z + uTime * (0.55 + aParams.y * 0.65) * uModeWeights.y;
    float cRot = cos(rot);
    float sRot = sin(rot);
    vec3 snowRight = camRight * cRot - camUp * sRot;
    vec3 snowUp = camRight * sRot + camUp * cRot;

    vec3 quadRight = normalize(mix(snowRight, streakRight, uVelocityAlign));
    vec3 quadUp = normalize(mix(snowUp, streakUp, uVelocityAlign));

    // Smooth distance-proportional sizing: slender rain streaks up close, crisp & visible in panorama
    float distToCam = length(cameraPosition - worldCenter);
    float distScale = clamp(distToCam * 0.0115, 0.26, 2.15);
    float sizeMul = aParams.x * distScale;

    vec3 worldPos = worldCenter
      + quadRight * (position.x * uParticleSize.x * sizeMul)
      + quadUp * (position.y * uParticleSize.y * sizeMul);

    // Soft volume boundary fade + gentle lens near-plane guard + sea-level cutoff
    float edgeX = smoothstep(0.0, 0.12, wrapped01.x) * smoothstep(1.0, 0.88, wrapped01.x);
    float edgeY = smoothstep(0.0, 0.14, wrapped01.y) * smoothstep(1.0, 0.86, wrapped01.y);
    float edgeZ = smoothstep(0.0, 0.12, wrapped01.z) * smoothstep(1.0, 0.88, wrapped01.z);
    float nearFade = smoothstep(3.5, 13.0, distToCam);
    float farFade = 1.0 - smoothstep(195.0, 315.0, distToCam);
    float seaFade = smoothstep(-1.0, 2.5, worldCenter.y);

    vAlpha = edgeX * edgeY * edgeZ * nearFade * farFade * seaFade;
    vSparkle = 0.72 + 0.28 * sin(uTime * 4.2 + aParams.z * 3.0);

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const PRECIPITATION_FRAGMENT_SHADER = `
  uniform vec4 uModeWeights;
  uniform vec3 uColor;
  uniform vec3 uSunColor;
  uniform float uOpacity;
  uniform float uLightning;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vSeed;
  varying float vSparkle;

  void main() {
    vec2 centered = (vUv - 0.5) * 2.0;

    // 1. Rain & Storm elongated luminous water streak with specular glint
    float rainCore = exp(-centered.x * centered.x * 7.5);
    float rainTail = smoothstep(-1.0, -0.15, centered.y) * smoothstep(1.0, 0.28, centered.y);
    float rainHighlight = exp(-centered.x * centered.x * 24.0) * smoothstep(0.05, 0.78, centered.y);
    float rainMask = clamp(rainCore * rainTail + rainHighlight * 0.45, 0.0, 1.0);

    // 2. Blizzard 6-fold crystalline snowflake + soft depth-of-field bokeh halo
    float r = length(centered);
    float ang = atan(centered.y, centered.x);
    float hexArms = pow(abs(cos(ang * 3.0)), 5.0);
    float crystal = smoothstep(0.95, 0.12, r) * (0.56 + 0.44 * hexArms);
    float bokeh = exp(-r * r * 3.8);
    float snowMask = clamp(mix(bokeh, crystal, 0.68) * (1.0 - smoothstep(0.78, 1.0, r)), 0.0, 1.0);

    // 3. Sandstorm wind-streaked grit & swirling golden dust wisp
    float grainWave = 0.78 + 0.22 * sin(centered.y * 9.0 + vSeed * 4.0);
    float sandCore = exp(-centered.x * centered.x * 5.2 - centered.y * centered.y * 1.45);
    float sandMask = clamp(sandCore * grainWave * (1.0 - smoothstep(0.82, 1.0, r)), 0.0, 1.0);

    float shapeMask =
      rainMask * uModeWeights.x +
      snowMask * uModeWeights.y +
      sandMask * uModeWeights.z;

    float finalAlpha = shapeMask * vAlpha * uOpacity;
    if (finalAlpha < 0.01) discard;

    // Physical lighting response: warm sunlit glint + storm lightning sheet flash
    vec3 baseCol = mix(uColor, uSunColor, 0.18 + uModeWeights.z * 0.22);
    vec3 rainGlint = vec3(0.82, 0.93, 1.0) * (rainHighlight * 0.55 + uLightning * 0.95) * uModeWeights.x;
    vec3 snowGlint = vec3(0.96, 0.99, 1.0) * vSparkle * 0.28 * uModeWeights.y;
    vec3 finalCol = baseCol * (0.88 + 0.22 * vSparkle) + rainGlint + snowGlint;

    gl_FragColor = vec4(finalCol, clamp(finalAlpha, 0.0, 0.92));
  }
`;

const VOLUMETRIC_FOG_VERTEX_SHADER = `
  attribute vec3 aOffset;
  attribute vec4 aParams;

  uniform float uTime;
  uniform vec3 uCamVolumeCenter;
  uniform vec3 uTerrainVolumeCenter;
  uniform float uVolumeScale;
  uniform vec2 uWind;
  uniform float uDriftSpeed;
  uniform float uFogScale;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vSeed;
  varying float vHeightT;

  void main() {
    vUv = uv;
    vSeed = aParams.z;

    // Dual-layer volumetric mist:
    // Layer A (aParams.w < 0.50): Valley & Coastal Fog Banks hugging terrain & straits
    // Layer B (aParams.w >= 0.50): Atmospheric Midground Fog Wisps drifting across camera view
    float isCamLayer = step(0.50, aParams.w);

    vec3 boxSize = mix(vec3(340.0, 28.0, 300.0), vec3(210.0, 88.0, 175.0), isCamLayer) * uVolumeScale;
    vec3 volumeCenter = mix(
      vec3(uTerrainVolumeCenter.x, 12.0, uTerrainVolumeCenter.z),
      uCamVolumeCenter,
      isCamLayer
    );

    float driftVar = (0.65 + aParams.y * 0.55) * uDriftSpeed;
    vec3 drift = vec3(
      (uWind.x * 0.35 + 1.4) * driftVar * uTime,
      sin(uTime * 0.28 + aParams.z) * 2.2,
      (uWind.y * 0.35 + 0.55) * driftVar * uTime
    );

    vec3 wrapped01 = fract((aOffset * boxSize + drift - volumeCenter) / boxSize);
    vec3 worldCenter = volumeCenter + (wrapped01 - 0.5) * boxSize;
    worldCenter.y = max(worldCenter.y, 2.2);

    // Camera-facing billboard with gentle continuous cloud rotation
    vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    float rot = aParams.z + uTime * 0.045 * (aParams.y - 0.5);
    float cRot = cos(rot);
    float sRot = sin(rot);
    vec3 rotRight = camRight * cRot - camUp * sRot;
    vec3 rotUp = camRight * sRot + camUp * cRot;

    float baseWidth = mix(68.0, 56.0, isCamLayer) * aParams.x * uFogScale * mix(0.58, 1.05, clamp(uVolumeScale, 0.35, 1.15));
    float baseHeight = baseWidth * mix(0.46, 0.56, isCamLayer);

    vec3 worldPos = worldCenter
      + rotRight * (position.x * baseWidth)
      + rotUp * (position.y * baseHeight);

    float distToCam = length(cameraPosition - worldCenter);
    float edgeX = smoothstep(0.0, 0.14, wrapped01.x) * smoothstep(1.0, 0.86, wrapped01.x);
    float edgeZ = smoothstep(0.0, 0.14, wrapped01.z) * smoothstep(1.0, 0.86, wrapped01.z);
    float nearFade = smoothstep(14.0, 44.0, distToCam);
    float farFade = 1.0 - smoothstep(280.0, 480.0, distToCam);

    vAlpha = edgeX * edgeZ * nearFade * farFade * mix(0.92, 0.78, isCamLayer);
    vHeightT = clamp((worldCenter.y - 2.0) / 34.0, 0.0, 1.0);

    gl_Position = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  }
`;

const VOLUMETRIC_FOG_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform vec3 uSunColor;
  uniform float uOpacity;
  uniform float uLightning;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vSeed;
  varying float vHeightT;

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbmMist(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 3; i++) {
      v += a * valueNoise(p);
      p = p * 2.04 + vec2(3.1, 5.7);
      a *= 0.48;
    }
    return v;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r >= 1.0) discard;

    // Procedural swirling FBM volumetric cloud wisp (zero external texture, zero hard quad borders)
    vec2 noiseUv = vUv * 2.65 + vec2(vSeed * 1.7 + uTime * 0.045, vSeed * 0.9 - uTime * 0.025);
    float n = fbmMist(noiseUv);
    float radialFade = pow(1.0 - smoothstep(0.04, 1.0, r), 1.48);
    float wisp = smoothstep(0.18, 0.78, n) * radialFade;

    float finalAlpha = wisp * vAlpha * uOpacity * 0.76;
    if (finalAlpha < 0.008) discard;

    // Upper edges catch warm sunlight/sky bounce; lower valleys stay cool misty slate
    vec3 mistCol = mix(uFogColor * 0.94, mix(uFogColor, uSunColor, 0.30), vHeightT * 0.58 + n * 0.42);
    mistCol += vec3(0.58, 0.72, 0.95) * uLightning * 0.55;

    gl_FragColor = vec4(mistCol, clamp(finalAlpha, 0.0, 0.72));
  }
`;

/**
 * Builds the 100% GPU-driven Three.js GLSL Weather Particle Shader System:
 *  - Layer 1: Instanced GLSL Precipitation Shader (wind-slanted rain streaks,
 *    rotating 6-fold crystalline snowflakes, and swirling sandstorm gusts)
 *  - Layer 2: Instanced GLSL Volumetric Fog/Mist Shader (procedural FBM cloud
 *    wisps enveloping valleys, straits, and the camera view volume)
 */
export function buildWeatherParticleShaderSystem(options?: {
  isSoftwareGl?: boolean;
}): WeatherParticleShaderSystem {
  const isSoftwareGl = Boolean(options?.isSoftwareGl);
  const precipCount = isSoftwareGl ? 1600 : 2500;
  const fogCount = isSoftwareGl ? 170 : 260;

  const group = new THREE.Group();
  group.name = 'pbr_weather_shader_system';

  // Layer 1: Precipitation GLSL Shader (Rain / Storm / Snow / Sandstorm)
  const precipGeo = createInstancedQuadGeometry(precipCount, 1);
  const precipUniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3(0, 40, 0) },
    uBoxSize: { value: new THREE.Vector3(185, 118, 175) },
    uWind: { value: new THREE.Vector2(4.0, 2.0) },
    uFallSpeed: { value: 55.0 },
    uSwayAmp: { value: 0.4 },
    uSwayFreq: { value: 1.8 },
    uParticleSize: { value: new THREE.Vector2(0.28, 5.8) },
    uVelocityAlign: { value: 1.0 },
    uModeWeights: { value: new THREE.Vector4(0, 0, 0, 0) },
    uColor: { value: new THREE.Color(0xd8ecff) },
    uSunColor: { value: new THREE.Color(0xfff1cc) },
    uOpacity: { value: 0.0 },
    uLightning: { value: 0.0 },
  };

  const precipMat = new THREE.ShaderMaterial({
    uniforms: precipUniforms,
    vertexShader: PRECIPITATION_VERTEX_SHADER,
    fragmentShader: PRECIPITATION_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });

  const precipMesh = new THREE.Mesh(precipGeo, precipMat);
  precipMesh.frustumCulled = false;
  precipMesh.renderOrder = 12;
  precipMesh.visible = false;
  group.add(precipMesh);

  // Layer 2: Volumetric FBM Fog / Mist GLSL Shader
  const fogGeo = createInstancedQuadGeometry(fogCount, 4001);
  const fogUniforms = {
    uTime: { value: 0 },
    uCamVolumeCenter: { value: new THREE.Vector3(0, 36, 0) },
    uTerrainVolumeCenter: { value: new THREE.Vector3(0, 14, 0) },
    uVolumeScale: { value: 1.0 },
    uWind: { value: new THREE.Vector2(2.0, 1.0) },
    uDriftSpeed: { value: 2.0 },
    uFogScale: { value: 1.0 },
    uFogColor: { value: new THREE.Color(0xcbe0f2) },
    uSunColor: { value: new THREE.Color(0xfff1cc) },
    uOpacity: { value: 0.0 },
    uLightning: { value: 0.0 },
  };

  const fogMat = new THREE.ShaderMaterial({
    uniforms: fogUniforms,
    vertexShader: VOLUMETRIC_FOG_VERTEX_SHADER,
    fragmentShader: VOLUMETRIC_FOG_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });

  const fogMesh = new THREE.Mesh(fogGeo, fogMat);
  fogMesh.frustumCulled = false;
  fogMesh.renderOrder = 11;
  fogMesh.visible = false;
  group.add(fogMesh);

  const update = ({
    dt,
    elapsed,
    cameraPosition,
    targetPosition,
    weather,
    lightningFlash,
    nightFactor,
    fogColor,
    sunColor,
    snapNow = false,
  }: WeatherParticleShaderUpdateParams) => {
    const targets = computeWeatherShaderUniformTargets(weather, lightningFlash, nightFactor);

    // Position the precipitation & foreground fog volumes smoothly along the camera's sightline
    // so rain streaks, snowflakes & mist fill the viewport at BOTH sweeping panorama AND city zoom!
    _viewDir.subVectors(targetPosition, cameraPosition);
    const camDist = _viewDir.length();
    if (camDist > 0.001) {
      _viewDir.divideScalar(camDist);
    } else {
      _viewDir.set(0, -0.4, -0.9).normalize();
    }

    // Dynamically tighten the GPU wrap volume when zoomed into a city so rain/snow/fog stay dense up close,
    // and expand seamlessly across the 6 continents in sweeping panorama view!
    const volumeScale = THREE.MathUtils.clamp(camDist / 195.0, 0.28, 1.08);
    const boxY = 112 * volumeScale;
    precipUniforms.uBoxSize.value.set(185 * volumeScale, boxY, 175 * volumeScale);
    fogUniforms.uVolumeScale.value = THREE.MathUtils.clamp(camDist / 220.0, 0.42, 1.08);

    const precipAhead = Math.min(camDist * 0.56, 98.0);
    _precipCenter.copy(cameraPosition).addScaledVector(_viewDir, precipAhead);
    _precipCenter.y = Math.max(targetPosition.y + boxY * 0.48, _precipCenter.y);

    const fogAhead = Math.min(camDist * 0.62, 132.0);
    _fogCamCenter.copy(cameraPosition).addScaledVector(_viewDir, fogAhead);
    _fogCamCenter.y = Math.max(16.0, _fogCamCenter.y * 0.72);

    const dampK = 5.2;
    const lerpVal = (cur: number, dst: number) =>
      snapNow ? dst : THREE.MathUtils.damp(cur, dst, dampK, dt);

    // Update Precipitation Shader Uniforms
    precipUniforms.uTime.value = elapsed;
    precipUniforms.uCenter.value.copy(_precipCenter);
    precipUniforms.uModeWeights.value.set(
      lerpVal(precipUniforms.uModeWeights.value.x, targets.modeWeights[0]),
      lerpVal(precipUniforms.uModeWeights.value.y, targets.modeWeights[1]),
      lerpVal(precipUniforms.uModeWeights.value.z, targets.modeWeights[2]),
      lerpVal(precipUniforms.uModeWeights.value.w, targets.modeWeights[3]),
    );
    precipUniforms.uOpacity.value = lerpVal(precipUniforms.uOpacity.value, targets.precipOpacity);
    precipUniforms.uFallSpeed.value = lerpVal(precipUniforms.uFallSpeed.value, targets.fallSpeed);
    precipUniforms.uWind.value.set(
      lerpVal(precipUniforms.uWind.value.x, targets.windVector[0]),
      lerpVal(precipUniforms.uWind.value.y, targets.windVector[1]),
    );
    precipUniforms.uSwayAmp.value = lerpVal(precipUniforms.uSwayAmp.value, targets.swayAmplitude);
    precipUniforms.uSwayFreq.value = lerpVal(precipUniforms.uSwayFreq.value, targets.swayFrequency);
    precipUniforms.uParticleSize.value.set(
      lerpVal(precipUniforms.uParticleSize.value.x, targets.particleWidth),
      lerpVal(precipUniforms.uParticleSize.value.y, targets.particleHeight),
    );
    precipUniforms.uVelocityAlign.value = lerpVal(
      precipUniforms.uVelocityAlign.value,
      targets.velocityAlign,
    );
    precipUniforms.uLightning.value = targets.lightningBoost;

    _targetPrecipCol.setHex(targets.precipColorHex);
    if (snapNow) {
      precipUniforms.uColor.value.copy(_targetPrecipCol);
    } else {
      precipUniforms.uColor.value.lerp(_targetPrecipCol, Math.min(1, dt * 5.0));
    }
    precipUniforms.uSunColor.value.copy(sunColor);

    precipMesh.visible = precipUniforms.uOpacity.value > 0.015;

    // Update Volumetric Fog / Mist Shader Uniforms
    fogUniforms.uTime.value = elapsed;
    fogUniforms.uCamVolumeCenter.value.copy(_fogCamCenter);
    fogUniforms.uTerrainVolumeCenter.value.set(targetPosition.x, 14.0, targetPosition.z);
    fogUniforms.uWind.value.set(
      lerpVal(fogUniforms.uWind.value.x, targets.windVector[0]),
      lerpVal(fogUniforms.uWind.value.y, targets.windVector[1]),
    );
    fogUniforms.uDriftSpeed.value = lerpVal(fogUniforms.uDriftSpeed.value, targets.fogDriftSpeed);
    fogUniforms.uFogScale.value = lerpVal(fogUniforms.uFogScale.value, targets.fogScale);
    fogUniforms.uOpacity.value = lerpVal(fogUniforms.uOpacity.value, targets.fogOpacity);
    fogUniforms.uLightning.value = targets.lightningBoost;

    _targetFogCol.setHex(targets.fogColorHex).lerp(fogColor, 0.35);
    if (snapNow) {
      fogUniforms.uFogColor.value.copy(_targetFogCol);
    } else {
      fogUniforms.uFogColor.value.lerp(_targetFogCol, Math.min(1, dt * 4.5));
    }
    fogUniforms.uSunColor.value.copy(sunColor);

    fogMesh.visible = fogUniforms.uOpacity.value > 0.015;
  };

  const dispose = () => {
    precipGeo.dispose();
    precipMat.dispose();
    fogGeo.dispose();
    fogMat.dispose();
  };

  return { group, update, dispose };
}
