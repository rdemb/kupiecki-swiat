import { imageUrl } from '../utils/imageUrl';
import * as THREE from 'three';
import { CITIES, SeasonId } from '../economy/economyEngine';
import {
  fbm2D,
  getContinentBiomeWeights,
  getTerrainHeight,
} from '../economy/worldMapData';

import { PbrWeatherParams } from './pbrWeather';

export type LightingMoodId = 'golden_hour' | 'midday' | 'dusk' | 'night';

export interface WorldTexturePack {
  meadowGrass: THREE.Texture;
  alpineRock: THREE.Texture;
  cobblestone: THREE.Texture;
  castleStone: THREE.Texture;
  masonryNormal: THREE.Texture;
  masonryRoughness: THREE.Texture;
  slateRoof: THREE.Texture;
  forestFoliage: THREE.Texture;
  desertSand: THREE.Texture;
  glacierIce: THREE.Texture;
  sandstoneWall: THREE.Texture;
  rockBump: THREE.CanvasTexture;
  rockNormal: THREE.CanvasTexture;
}

function createProceduralDetailBumpAndNormal(): {
  bump: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
} {
  const size = 256;
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Seamless periodic coordinate approximation via wrapped blend
      const n = fbm2D(x * 0.08, y * 0.08, 4);
      const grain = Math.sin(x * 0.72) * Math.cos(y * 0.72) * 0.08;
      heights[y * size + x] = Math.max(0, Math.min(1, n + grain));
    }
  }

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');
  if (bCtx) {
    const img = bCtx.createImageData(size, size);
    for (let i = 0; i < heights.length; i++) {
      const v = Math.round(heights[i] * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    bCtx.putImageData(img, 0, 0);
  }

  // Sobel tangent-space normal map for crisp UE5-style stone/terrain micro-lighting
  const normCanvas = document.createElement('canvas');
  normCanvas.width = size;
  normCanvas.height = size;
  const nCtx = normCanvas.getContext('2d');
  if (nCtx) {
    const img = nCtx.createImageData(size, size);
    const strength = 3.2;
    for (let y = 0; y < size; y++) {
      const yPrev = (y - 1 + size) % size;
      const yNext = (y + 1) % size;
      for (let x = 0; x < size; x++) {
        const xPrev = (x - 1 + size) % size;
        const xNext = (x + 1) % size;
        const dx = (heights[y * size + xNext] - heights[y * size + xPrev]) * strength;
        const dy = (heights[yNext * size + x] - heights[yPrev * size + x]) * strength;
        const dz = 1.0;
        const invLen = 1 / Math.hypot(dx, dy, dz);
        const idx = (y * size + x) * 4;
        img.data[idx] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
        img.data[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
        img.data[idx + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
        img.data[idx + 3] = 255;
      }
    }
    nCtx.putImageData(img, 0, 0);
  }

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(10, 10);

  const normal = new THREE.CanvasTexture(normCanvas);
  normal.colorSpace = THREE.NoColorSpace;
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(10, 10);

  return { bump, normal };
}

export function loadWorldTextures(
  renderer: THREE.WebGLRenderer,
  onReady?: () => void,
): WorldTexturePack {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const loader = new THREE.TextureLoader();

  const loadTex = (url: string, repeatX: number, repeatY: number, space: THREE.ColorSpace = THREE.SRGBColorSpace): THREE.Texture => {
    const tex = loader.load(url, (loaded) => {
      loaded.colorSpace = space;
      loaded.wrapS = THREE.RepeatWrapping;
      loaded.wrapT = THREE.RepeatWrapping;
      loaded.repeat.set(repeatX, repeatY);
      loaded.anisotropy = maxAniso;
      loaded.generateMipmaps = true;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.needsUpdate = true;
      onReady?.();
    });
    tex.colorSpace = space;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAniso;
    return tex;
  };

  const scans = (import.meta.env?.BASE_URL ?? '/') + 'materials/';
  const { bump: rockBump, normal: rockNormal } = createProceduralDetailBumpAndNormal();
  rockBump.anisotropy = maxAniso;
  rockNormal.anisotropy = maxAniso;

  return {
    meadowGrass: loadTex(scans + 'laka.webp', 28, 28),
    alpineRock: loadTex(imageUrl('pbr_alpine_rock_seamless_1795643331475.jpg'), 24, 24),
    cobblestone: loadTex(scans + 'bruk.webp', 32, 32),
    castleStone: loadTex(scans + 'mur.webp', 3, 2),
    masonryNormal: loadTex(scans + 'mur-normal.webp', 3, 2, THREE.NoColorSpace),
    masonryRoughness: loadTex(scans + 'mur-szorstkosc.webp', 3, 2, THREE.NoColorSpace),
    slateRoof: loadTex(imageUrl('pbr_slate_roof_seamless_1795643331651.jpg'), 2, 2),
    forestFoliage: loadTex(imageUrl('pbr_forest_foliage_seamless_1795643350683.jpg'), 2, 2),
    desertSand: loadTex(imageUrl('pbr_desert_sand_seamless_1795644303427.jpg'), 26, 26),
    glacierIce: loadTex(imageUrl('pbr_glacier_ice_seamless_1795644303312.jpg'), 24, 24),
    sandstoneWall: loadTex(imageUrl('pbr_sandstone_architecture_seamless_1795644304962.jpg'), 3, 2),
    rockBump,
    rockNormal,
  };
}

/**
 * Builds the 520x520 High-Resolution 4-Continent Sculpted Terrain with Unreal-Engine-5-Grade
 * Triplanar Cliff Projection, Analytical Micro-Normal Shading, 6-Biome PBR Splatmapping,
 * Glowing Magma Veins, and Built-In Aerial Perspective Fog.
 */
export function buildSculptedTerrain(textures: WorldTexturePack): {
  mesh: THREE.Mesh;
  uniforms: {
    uSeasonSnow: { value: number };
    uSeasonAutumn: { value: number };
    uSeasonSpring: { value: number };
    uDisasterAsh: { value: number };
    uTime: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uWeatherWetness: { value: number };
    uWeatherSnow: { value: number };
    uWeatherDust: { value: number };
    uAerialFogDensity: { value: number };
  };
} {
  const size = 620;
  const segments = 224;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const count = posAttr.count;
  const biomeData = new Float32Array(count * 4);     // x: height, y: volcanic, z: cityPlaza, w: lavaGlow
  const continentData = new Float32Array(count * 4); // x: desert, y: glacier, z: jade, w: oasis

  for (let i = 0; i < count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setY(i, vy);

    const w = getContinentBiomeWeights(vx, vz);

    // Distance to nearest of the 12 continental capitals for cobblestone/sandstone plaza blending
    let cityBlend = 0;
    for (const c of CITIES) {
      const dist = Math.hypot(vx - c.position3D[0], vz - c.position3D[2]);
      if (dist < 14.0) {
        cityBlend = Math.max(cityBlend, 1 - Math.max(0, (dist - 7.5) / 6.5));
      }
    }

    // Molten magma craters at Ignis Volcano (82, -20) AND Obsidian Archipelago Caldera (188, 168)
    const distCrater1 = Math.hypot(vx - 82, vz + 20);
    const distCrater2 = Math.hypot(vx - 188, vz - 168);
    const lavaStream2 = Math.hypot(vx - 170, vz - 158) < 12 ? Math.max(0, 1 - Math.abs((vx - 170) - (vz - 158) * 0.8) / 2.6) * 0.72 : 0;
    const lavaGlow = Math.max(
      distCrater1 < 7.8 ? Math.max(0, 1 - distCrater1 / 7.8) : 0,
      distCrater2 < 9.5 ? Math.max(0, 1 - distCrater2 / 9.5) : 0,
      lavaStream2,
    );

    biomeData[i * 4] = vy;
    biomeData[i * 4 + 1] = w.volcanic;
    biomeData[i * 4 + 2] = cityBlend;
    biomeData[i * 4 + 3] = lavaGlow;

    continentData[i * 4] = w.desert;
    continentData[i * 4 + 1] = w.glacier;
    continentData[i * 4 + 2] = w.jade;
    continentData[i * 4 + 3] = w.oasis;
  }

  geo.setAttribute('aBiome', new THREE.BufferAttribute(biomeData, 4));
  geo.setAttribute('aContinent', new THREE.BufferAttribute(continentData, 4));
  geo.computeVertexNormals();

  const uniforms = {
    uSeasonSnow: { value: 0.0 },
    uSeasonAutumn: { value: 0.0 },
    uSeasonSpring: { value: 0.0 },
    uDisasterAsh: { value: 0.0 },
    uTime: { value: 0.0 },
    uSunDir: { value: new THREE.Vector3(0.58, 0.34, -0.68).normalize() },
    uHorizonColor: { value: new THREE.Color(0xe6be8a) },
    uSunColor: { value: new THREE.Color(0xfff1cc) },
    uWeatherWetness: { value: 0.0 },
    uWeatherSnow: { value: 0.0 },
    uWeatherDust: { value: 0.0 },
    uAerialFogDensity: { value: 1.0 },
    uGrassTex: { value: textures.meadowGrass },
    uRockTex: { value: textures.alpineRock },
    uCobbleTex: { value: textures.cobblestone },
    uDesertTex: { value: textures.desertSand },
    uGlacierTex: { value: textures.glacierIce },
  };

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    metalness: 0.05,
    normalMap: textures.rockNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSeasonSnow = uniforms.uSeasonSnow;
    shader.uniforms.uSeasonAutumn = uniforms.uSeasonAutumn;
    shader.uniforms.uSeasonSpring = uniforms.uSeasonSpring;
    shader.uniforms.uDisasterAsh = uniforms.uDisasterAsh;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uHorizonColor = uniforms.uHorizonColor;
    shader.uniforms.uSunColor = uniforms.uSunColor;
    shader.uniforms.uWeatherWetness = uniforms.uWeatherWetness;
    shader.uniforms.uWeatherSnow = uniforms.uWeatherSnow;
    shader.uniforms.uWeatherDust = uniforms.uWeatherDust;
    shader.uniforms.uAerialFogDensity = uniforms.uAerialFogDensity;
    shader.uniforms.uGrassTex = uniforms.uGrassTex;
    shader.uniforms.uRockTex = uniforms.uRockTex;
    shader.uniforms.uCobbleTex = uniforms.uCobbleTex;
    shader.uniforms.uDesertTex = uniforms.uDesertTex;
    shader.uniforms.uGlacierTex = uniforms.uGlacierTex;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
        #include <common>
        attribute vec4 aBiome;
        attribute vec4 aContinent;
        varying vec4 vBiome;
        varying vec4 vContinent;
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vBiome = aBiome;
        vContinent = aContinent;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWorldNorm = normalize(mat3(modelMatrix) * objectNormal);
        `,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
        #include <common>
        uniform float uSeasonSnow;
        uniform float uSeasonAutumn;
        uniform float uSeasonSpring;
        uniform float uDisasterAsh;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform float uWeatherWetness;
        uniform float uWeatherSnow;
        uniform float uWeatherDust;
        uniform float uAerialFogDensity;
        uniform sampler2D uGrassTex;
        uniform sampler2D uRockTex;
        uniform sampler2D uCobbleTex;
        uniform sampler2D uDesertTex;
        uniform sampler2D uGlacierTex;
        varying vec4 vBiome;
        varying vec4 vContinent;
        varying vec3 vWorldPos;
        varying vec3 vWorldNorm;
        `,
      )
      .replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        // Multi-scale macro + micro UV sampling to eliminate tiling repetition across 520m continents
        vec2 uvGrass = vWorldPos.xz * 0.052;
        vec2 uvGrassMacro = vWorldPos.xz * 0.011;
        vec2 uvDesert = vWorldPos.xz * 0.058;
        vec2 uvGlacier = vWorldPos.xz * 0.044;
        vec2 uvCobble = vWorldPos.xz * 0.125;

        // True Triplanar Rock Projection for steep mountain cliffs & karst spires (Zero stretching!)
        vec3 triW = abs(vWorldNorm);
        triW = pow(triW, vec3(4.0));
        triW /= max(dot(triW, vec3(1.0)), 0.0001);
        vec3 rockX = texture2D(uRockTex, vWorldPos.zy * 0.052).rgb;
        vec3 rockY = texture2D(uRockTex, vWorldPos.xz * 0.052).rgb;
        vec3 rockZ = texture2D(uRockTex, vWorldPos.xy * 0.052).rgb;
        vec3 rockCol = rockX * triW.x + rockY * triW.y + rockZ * triW.z;

        vec3 grassDetail = texture2D(uGrassTex, uvGrass).rgb;
        vec3 grassMacro = texture2D(uGrassTex, uvGrassMacro).rgb;
        vec3 grassCol = mix(grassDetail, grassDetail * (0.76 + grassMacro * 0.48), 0.55);

        vec3 desertCol = texture2D(uDesertTex, uvDesert).rgb;
        vec3 glacierCol = texture2D(uGlacierTex, uvGlacier).rgb;
        vec3 cobbleCol = texture2D(uCobbleTex, uvCobble).rgb;

        float h = vBiome.x;
        float volc = vBiome.y;
        float cityPlaza = vBiome.z;
        float desertW = vContinent.x;
        float glacierW = vContinent.y;
        float jadeW = vContinent.z;
        float oasisW = vContinent.w;

        // Vibrant spring emerald & wildflower tint during Wiosna
        vec3 springTint = vec3(grassCol.r * 0.92, grassCol.g * 1.24 + 0.04, grassCol.b * 0.88);
        grassCol = mix(grassCol, springTint, uSeasonSpring * 0.62 * (1.0 - desertW));

        // Subtle autumn gold & copper warmth on temperate meadows
        vec3 autumnTint = vec3(grassCol.r * 1.32 + 0.09, grassCol.g * 0.88, grassCol.b * 0.52);
        grassCol = mix(grassCol, autumnTint, uSeasonAutumn * 0.74 * (1.0 - jadeW * 0.5) * (1.0 - desertW));

        // Emerald Jade Highlands tint for Aetheris East & Valoria West Continents
        vec3 jadeGrass = grassCol * vec3(0.76, 1.16, 0.92);
        vec3 landBase = mix(grassCol, jadeGrass, jadeW * 0.85);

        // Solaria Golden Desert Dunes + Red Sandstone Canyons (minus lush green Palm Oasis)
        float canyonMask = smoothstep(4.5, 11.5, h) * desertW;
        vec3 redSandstone = rockCol * vec3(1.22, 0.72, 0.48);
        vec3 solariaCol = mix(desertCol * 1.05, redSandstone, canyonMask * 0.82);
        landBase = mix(landBase, solariaCol, clamp(desertW * (1.0 - oasisW * 0.92), 0.0, 1.0));

        // Lush vibrant emerald oasis ring right around Oaza Al-Kharim
        vec3 oasisGreen = grassDetail * vec3(0.78, 1.18, 0.72);
        landBase = mix(landBase, oasisGreen, oasisW * 0.88);

        // Slope factor (1.0 = flat ground, 0.0 = vertical cliff)
        float flatness = clamp(vWorldNorm.y, 0.0, 1.0);
        float cliffWeight = 1.0 - smoothstep(0.62, 0.88, flatness);

        // Wet shoreline darkening + coastal sand transition
        vec3 wetSand = vec3(0.32, 0.28, 0.21);
        vec3 drySand = desertCol * 1.04;
        vec3 beachCol = mix(wetSand, drySand, smoothstep(-0.25, 0.95, h));
        float beachMask = (1.0 - smoothstep(0.25, 1.55, h)) * (1.0 - glacierW * 0.85);
        vec3 terrainCol = mix(landBase, beachCol, beachMask);

        // Steep cliff rock strata + high altitude granite exposure
        float highRockMask = smoothstep(7.8, 14.5, h) * (1.0 - desertW * 0.55);
        vec3 cliffTint = mix(rockCol * 0.96, redSandstone, desertW * 0.85);
        cliffTint = mix(cliffTint, rockCol * vec3(0.76, 0.88, 0.84), jadeW * 0.55); // Limestone karst
        terrainCol = mix(terrainCol, cliffTint, clamp(cliffWeight * 0.96 + highRockMask * 0.72, 0.0, 1.0));

        // Frostheim Glacial Continent (Cracked Blue-White Glacier Ice + Snowdrifts)
        float frostCoverage = glacierW * smoothstep(-0.4, 1.6, h);
        vec3 frostCliff = mix(rockCol * vec3(0.62, 0.72, 0.85), glacierCol * 0.96, 0.45);
        vec3 frostSurface = mix(glacierCol * 1.04, frostCliff, cliffWeight * 0.72);
        terrainCol = mix(terrainCol, frostSurface, clamp(frostCoverage, 0.0, 0.98));

        // Volcanic dark obsidian basalt & ash slopes in Eastern Caldera
        vec3 basaltCol = rockCol * vec3(0.42, 0.37, 0.39);
        terrainCol = mix(terrainCol, basaltCol, volc * 0.90);

        // Snow-capped Alpine Peaks on Stary Kontynent (dynamic seasonal snowline!)
        float snowLine = mix(14.2, 4.4, uSeasonSnow);
        float snowNoise = sin(vWorldPos.x * 0.22) * cos(vWorldPos.z * 0.22) * 1.5;
        float snowMask = smoothstep(snowLine - 1.5, snowLine + 4.5, h + snowNoise) * smoothstep(0.45, 0.78, flatness);
        snowMask *= (1.0 - volc * 0.92) * (1.0 - desertW * 0.96) * (1.0 - jadeW * 0.65);
        terrainCol = mix(terrainCol, glacierCol * 1.06, clamp(snowMask, 0.0, 0.95));

        // Capital Plazas (Cobblestone in Heartland/Frostheim/Aetheris, Carved Sandstone in Solaria)
        vec3 plazaMat = mix(cobbleCol * 0.95, desertCol * vec3(1.06, 0.96, 0.82), desertW);
        terrainCol = mix(terrainCol, plazaMat, clamp(cityPlaza * 0.86, 0.0, 0.9));

        // Subtle crevice micro-AO from texture luminance (UE5 micro-cavity shading!)
        float lum = dot(terrainCol, vec3(0.299, 0.587, 0.114));
        terrainCol *= (0.86 + smoothstep(0.08, 0.85, lum) * 0.24);

        // Underwater seabed turquoise/deep darkening
        float seabedMask = 1.0 - smoothstep(-4.2, -0.1, h);
        terrainCol = mix(terrainCol, vec3(0.06, 0.22, 0.28), seabedMask * 0.88);

        // Real-Time PBR Weather Surface Effects (Porous Wet Albedo Darkening, Blizzard Snow Coat, Sandstorm Dust)
        float landAboveSea = smoothstep(-0.1, 1.3, h);
        if (uWeatherWetness > 0.01) {
          terrainCol *= mix(1.0, 0.62, uWeatherWetness * landAboveSea);
        }
        if (uWeatherSnow > 0.01) {
          float pbrSnowDrift = sin(vWorldPos.x * 0.17 + vWorldPos.z * 0.13) * 0.14;
          float pbrSnowMask = clamp(uWeatherSnow * smoothstep(0.42, 0.85, flatness + pbrSnowDrift) * landAboveSea * (1.0 - volc * 0.85), 0.0, 0.92);
          terrainCol = mix(terrainCol, glacierCol * 1.08, pbrSnowMask);
        }
        if (uWeatherDust > 0.01) {
          vec3 dustTint = vec3(0.78, 0.58, 0.34);
          terrainCol = mix(terrainCol, dustTint, uWeatherDust * 0.42 * landAboveSea);
        }
        if (uDisasterAsh > 0.01) {
          vec3 ashTint = vec3(0.38, 0.28, 0.24);
          terrainCol = mix(terrainCol, ashTint, uDisasterAsh * 0.45 * landAboveSea);
        }

        diffuseColor.rgb *= terrainCol;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
        #include <roughnessmap_fragment>
        // Dynamic wet shoreline, glossy glacial ice, and PBR Rain Puddles with micro-roughness drop!
        float wetShore = 1.0 - smoothstep(-0.2, 0.95, vBiome.x);
        roughnessFactor = mix(roughnessFactor, 0.22, wetShore * 0.75);
        roughnessFactor = mix(roughnessFactor, 0.34, vContinent.y * 0.65);

        if (uWeatherWetness > 0.02) {
          float flatGround = smoothstep(0.74, 0.96, clamp(vWorldNorm.y, 0.0, 1.0));
          float puddleField = sin(vWorldPos.x * 0.21) * cos(vWorldPos.z * 0.19) + sin((vWorldPos.x + vWorldPos.z) * 0.11) * 0.55;
          float puddleMask = smoothstep(0.28, 0.78, puddleField) * flatGround * smoothstep(0.1, 1.8, vBiome.x);
          float dampRoughness = mix(roughnessFactor, 0.24, uWeatherWetness * 0.78);
          float rippleShimmer = 0.06 + 0.04 * sin(uTime * 5.2 + vWorldPos.x * 2.1 + vWorldPos.z * 2.3);
          roughnessFactor = mix(dampRoughness, rippleShimmer, clamp(puddleMask * uWeatherWetness, 0.0, 1.0));
        }
        if (uWeatherSnow > 0.02) {
          roughnessFactor = mix(roughnessFactor, 0.32, uWeatherSnow * smoothstep(0.55, 0.88, clamp(vWorldNorm.y, 0.0, 1.0)) * 0.65);
        }
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        // Glowing molten magma veins inside Ignis's Volcanic Crater
        if (vBiome.w > 0.05) {
          float pulse = 0.76 + 0.24 * sin(uTime * 2.4 + vWorldPos.x * 0.75 + vWorldPos.z * 0.75);
          float crack = smoothstep(0.18, 0.85, vBiome.w);
          totalEmissiveRadiance += vec3(2.8, 0.62, 0.09) * crack * pulse;
        }
        `,
      )
      .replace(
        '#include <fog_fragment>',
        `
        // Unreal Engine 5 Atmospheric Aerial Perspective + PBR Weather Fog Multiplier
        vec3 viewVec = vWorldPos - cameraPosition;
        float distCam = length(viewVec);
        vec3 viewDir = viewVec / max(distCam, 0.001);
        float sunAlign = max(dot(viewDir, normalize(uSunDir)), 0.0);
        vec3 scatterCol = mix(uHorizonColor, uSunColor, pow(sunAlign, 5.0) * 0.45);
        float heightAtten = exp(-max(vWorldPos.y, 0.0) * 0.045);
        float aerialFog = 1.0 - exp(-distCam * 0.0021 * uAerialFogDensity * (0.65 + 0.35 * heightAtten));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, scatterCol, clamp(aerialFog, 0.0, 0.88));
        `,
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return { mesh, uniforms };
}

/**
 * Builds the 1040x1040 UE5-Grade Animated Ocean with Multi-Directional Gerstner Waves,
 * 4-Octave Sparkling Normals, Subsurface Turquoise Scattering, Fresnel Sky Reflections,
 * Golden Sun Glitter Road, and Dynamic Breaking Shoreline Foam around all 4 Continents.
 */
export function buildRealisticOcean(): {
  mesh: THREE.Mesh;
  uniforms: {
    uTime: { value: number };
    uSunDir: { value: THREE.Vector3 };
    uSkyHorizon: { value: THREE.Color };
    uSkyZenith: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uWaveChoppiness: { value: number };
  };
} {
  const geo = new THREE.PlaneGeometry(1240, 1240, 148, 148);
  geo.rotateX(-Math.PI / 2);

  // Store exact seabed depth at every ocean vertex for turquoise coral shallows & surf foam!
  const pos = geo.attributes.position;
  const depths = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const groundY = getTerrainHeight(x, z);
    depths[i] = Math.max(0, -groundY);
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));

  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.58, 0.34, -0.68).normalize() },
    uSkyHorizon: { value: new THREE.Color(0xe6be8a) },
    uSkyZenith: { value: new THREE.Color(0x1b4678) },
    uSunColor: { value: new THREE.Color(0xfff1cc) },
    uWaveChoppiness: { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: `
      attribute float aDepth;
      uniform float uTime;
      uniform float uWaveChoppiness;
      varying float vDepth;
      varying float vWaveCrest;
      varying vec3 vWorldPos;

      void main() {
        vDepth = aDepth;
        vec3 p = position;
        float waveMask = smoothstep(0.0, 2.4, aDepth);

        // Multi-directional Gerstner swell displacement scaled by PBR weather choppiness
        float speedScale = mix(1.0, 1.55, clamp((uWaveChoppiness - 1.0) * 0.7, 0.0, 1.0));
        float w1 = sin(p.x * 0.11 + p.z * 0.05 + uTime * 1.25 * speedScale) * 0.18;
        float w2 = cos(p.z * 0.14 - p.x * 0.06 - uTime * 1.05 * speedScale) * 0.14;
        float w3 = sin((p.x - p.z) * 0.08 + uTime * 0.85 * speedScale) * 0.11;
        float disp = (w1 + w2 + w3) * waveMask * uWaveChoppiness;
        p.y += disp;
        vWaveCrest = clamp(disp * 2.4 + 0.5, 0.0, 1.0);

        vec4 wp = modelMatrix * vec4(p, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSkyHorizon;
      uniform vec3 uSkyZenith;
      uniform vec3 uSunColor;
      uniform float uWaveChoppiness;
      varying float vDepth;
      varying float vWaveCrest;
      varying vec3 vWorldPos;

      void main() {
        // 4-octave non-orthogonal analytical wave normals (zero periodic moire/grid banding!)
        vec2 wp = vWorldPos.xz;
        float distCamInit = length(cameraPosition.xz - wp);
        float rippleAtten = (1.0 / (1.0 + distCamInit * 0.0055)) * clamp(uWaveChoppiness, 0.8, 2.2);
        float a1 = dot(wp, vec2(0.29, 0.17)) + uTime * 1.35;
        float a2 = dot(wp, vec2(-0.41, 0.53)) - uTime * 1.75;
        float a3 = dot(wp, vec2(0.87, -0.64)) + uTime * 2.25;
        float a4 = dot(wp, vec2(-1.31, -1.07)) - uTime * 2.85;
        float nx = (cos(a1) * 0.055 + sin(a2) * 0.038 + cos(a3) * 0.022 + sin(a4) * 0.011) * rippleAtten;
        float nz = (sin(a1 * 1.13) * 0.055 + cos(a2 * 0.91) * 0.038 + sin(a3 * 1.07) * 0.022 + cos(a4 * 0.89) * 0.011) * rippleAtten;
        vec3 N = normalize(vec3(nx, 1.0, nz));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Depth-based optical absorption (Coral Turquoise Lagoon -> Sapphire -> Deep Abyssal Ocean)
        vec3 shallowCol = vec3(0.06, 0.58, 0.62);
        vec3 midSeaCol  = vec3(0.04, 0.27, 0.45);
        vec3 deepSeaCol = vec3(0.018, 0.095, 0.21);

        float shallowT = smoothstep(0.0, 2.8, vDepth);
        float deepT = smoothstep(2.6, 8.2, vDepth);
        vec3 waterCol = mix(shallowCol, midSeaCol, shallowT);
        waterCol = mix(waterCol, deepSeaCol, deepT);

        // Subsurface emerald wave-crest translucency when sunlit!
        float sss = pow(max(dot(V, -L + N * 0.4), 0.0), 4.0) * vWaveCrest;
        waterCol += vec3(0.04, 0.38, 0.40) * sss * (1.0 - deepT * 0.55) * 0.75;

        // Schlick Fresnel reflection of actual zenith-to-horizon sky gradient
        float cosTheta = max(dot(N, V), 0.0);
        float fresnel = 0.0204 + 0.9796 * pow(1.0 - cosTheta, 5.0);
        vec3 R = reflect(-V, N);
        vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
        vec3 col = mix(waterCol, skyRefl, clamp(fresnel * 0.88, 0.06, 0.88));

        // Dual-lobe UE5 Sun Specular Glitter (sharp pinpoint sun path + broad warm sheen)
        vec3 H = normalize(L + V);
        float ndh = max(dot(N, H), 0.0);
        // Pixel footprint broadens distant glints instead of letting them shimmer.
        float spread = clamp(fwidth(ndh) * 160.0 + 0.18 * uWaveChoppiness, 0.0, 1.0);
        float power = mix(340.0, 64.0, spread);
        float specSharp = pow(ndh, power) * (power / 145.0);
        float specBroad = pow(ndh, 36.0) * 0.32;
        col += uSunColor * (specSharp + specBroad);

        // Dynamic Breaking Shoreline Surf Foam Rings + Storm Whitecaps
        float waveBreak = sin(vDepth * 8.5 - uTime * 2.8 + sin(wp.x * 0.35 + wp.y * 0.25) * 1.6);
        float shoreEdge = 1.0 - smoothstep(0.0, 0.85, vDepth);
        float foamBands = smoothstep(0.48, 0.90, waveBreak) * (1.0 - smoothstep(0.15, 1.85, vDepth));
        float stormWhitecaps = smoothstep(0.76, 0.97, vWaveCrest) * clamp((uWaveChoppiness - 1.2) * 0.45, 0.0, 0.65);
        float lace = sin(wp.x * 2.1 + uTime + sin(wp.y * 1.7)) * cos(wp.y * 2.6 - 0.55 * uTime);
        float pores = mix(0.40, 1.0, smoothstep(-0.45, 0.65, lace));
        float foam = pores * clamp(shoreEdge * 0.82 + foamBands * 0.48 + stormWhitecaps, 0.0, 0.95);
        col = mix(col, mix(vec3(0.92, 0.97, 0.99), uSunColor, 0.16), foam);

        // Seamless UE5 Atmospheric Horizon Haze Blend
        float distCam = length(cameraPosition.xz - wp);
        float fogFactor = 1.0 - exp(-max(0.0, distCam - 110.0) * 0.0038);
        col = mix(col, uSkyHorizon, clamp(fogFactor, 0.0, 0.96));

        float alpha = clamp(0.84 + smoothstep(0.0, 1.2, vDepth) * 0.15 + foam * 0.15, 0.0, 0.99);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.0;
  return { mesh, uniforms };
}

/**
 * Builds an Unreal-Engine-5-Style Atmospheric Sky Dome with Procedural Volumetric
 * Sunlit FBM Cloud Canopy, Mie Solar Halo, Night Starfield & Northern Aurora Borealis!
 */
export function buildAtmosphericSkyDome(): {
  mesh: THREE.Mesh;
  uniforms: {
    uTime: { value: number };
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uNightFactor: { value: number };
    uOvercast: { value: number };
    uLightning: { value: number };
  };
} {
  const geo = new THREE.SphereGeometry(680, 40, 28);
  const uniforms = {
    uTime: { value: 0 },
    uTopColor: { value: new THREE.Color(0x1a4475) },
    uHorizonColor: { value: new THREE.Color(0xe6be8a) },
    uSunColor: { value: new THREE.Color(0xfff4d6) },
    uSunDir: { value: new THREE.Vector3(0.58, 0.28, -0.68).normalize() },
    uNightFactor: { value: 0.0 },
    uOvercast: { value: 0.0 },
    uLightning: { value: 0.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uNightFactor;
      uniform float uOvercast;
      uniform float uLightning;
      varying vec3 vDir;

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
          mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      float fbmClouds(vec2 p) {
        float v = 0.0;
        float a = 0.52;
        for (int i = 0; i < 4; i++) {
          v += a * noise2(p);
          p = p * 2.05 + vec2(1.7, 9.2);
          a *= 0.48;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);

        // Physically inspired Rayleigh Zenith-to-Horizon Sky Gradient
        vec3 sky = mix(uHorizonColor, uTopColor, pow(h, 0.52));

        // Storm & Overcast PBR sky dampening
        vec3 stormSlate = mix(vec3(0.24, 0.30, 0.38), vec3(0.09, 0.13, 0.20), uNightFactor);
        sky = mix(sky, stormSlate, uOvercast * 0.62);

        // Horizon atmospheric warm Mie band
        vec3 L = normalize(uSunDir);
        float sunDot = max(dot(d, L), 0.0);
        float horizonBand = pow(1.0 - h, 4.5);
        sky += uSunColor * horizonBand * 0.18 * (1.0 - uNightFactor * 0.7) * (1.0 - uOvercast * 0.75);

        // Mie Solar Halo & Crisp Solar Disc (attenuated by overcast storm canopy)
        float halo = pow(sunDot, 12.0) * 0.36 + pow(sunDot, 180.0) * 1.45;
        sky += uSunColor * halo * (1.0 - uNightFactor * 0.75) * (1.0 - uOvercast * 0.85);

        // Procedural Volumetric Sky Cloud Canopy (projected onto high-altitude sky plane)
        if (d.y > 0.025) {
          vec2 cloudUV = (d.xz / (d.y + 0.14)) * 1.15 + vec2(uTime * 0.0085, uTime * 0.003);
          float c1 = fbmClouds(cloudUV);
          float c2 = fbmClouds(cloudUV * 2.1 - vec2(uTime * 0.012, 0.0));
          float cloudFloor = mix(0.44, 0.22, uOvercast);
          float density = smoothstep(cloudFloor, 0.78, c1 * 0.7 + c2 * 0.3) * smoothstep(0.03, 0.22, d.y);

          // Cloud silver-lining & warm golden sunlit underside vs dark storm cumulonimbus
          vec3 cloudShadow = mix(uTopColor * 0.85, uHorizonColor * 0.62, 0.45);
          cloudShadow = mix(cloudShadow, vec3(0.11, 0.15, 0.22), uOvercast * 0.82);
          vec3 cloudLit = mix(vec3(0.98, 0.97, 0.95), uSunColor * 1.15, 0.55);
          cloudLit = mix(cloudLit, vec3(0.42, 0.48, 0.58), uOvercast * 0.72);
          float sunEdge = pow(sunDot, 4.0) * 0.65 + (1.0 - c1) * 0.35;
          vec3 cloudCol = mix(cloudShadow, cloudLit, clamp(sunEdge, 0.15, 1.0));
          cloudCol *= (1.0 - uNightFactor * 0.62);

          // Storm Lightning Flash Sheet Illumination inside thunderclouds!
          cloudCol += vec3(0.75, 0.88, 1.0) * uLightning * (0.45 + 0.55 * c2);

          sky = mix(sky, cloudCol, density * mix(0.72, 0.94, uOvercast));
        }

        // Starfield & Shimmering Northern Aurora Borealis over Frostheim at Dusk/Night!
        if (uNightFactor > 0.1 && d.y > 0.08 && uOvercast < 0.75) {
          float clearSkyMult = 1.0 - uOvercast;
          vec2 starCell = floor(d.xz / max(d.y, 0.15) * 95.0);
          float starSeed = hash2(starCell);
          float star = smoothstep(0.992, 0.999, starSeed) * smoothstep(0.12, 0.45, d.y);
          sky += vec3(0.85, 0.92, 1.0) * star * uNightFactor * 1.25 * clearSkyMult;

          // Aurora ribbons in Northern/Northwest quadrant (Frostheim sky)
          float northMask = smoothstep(-0.1, -0.55, d.z) * smoothstep(0.08, 0.32, d.y) * (1.0 - smoothstep(0.45, 0.78, d.y));
          float ribbon = sin(d.x * 14.0 + uTime * 0.55 + sin(d.z * 9.0) * 2.0) * 0.5 + 0.5;
          vec3 auroraCol = mix(vec3(0.1, 0.92, 0.62), vec3(0.32, 0.52, 1.0), ribbon);
          sky += auroraCol * pow(ribbon, 2.5) * northMask * uNightFactor * 0.55 * clearSkyMult;
        }

        // Subtle sky-wide lightning ambient pulse
        sky += vec3(0.28, 0.38, 0.55) * uLightning * 0.45;

        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, uniforms };
}

/**
 * Builds a GPU-friendly 3D PBR Weather Precipitation System (Rain Streaks, Blizzard Snowflakes,
 * or Sandstorm Gusts) orbiting cleanly around the active camera focus with zero per-frame allocations.
 */
export function buildPbrWeatherParticles(particleCount = 960): {
  points: THREE.Points;
  update: (dt: number, elapsed: number, focus: THREE.Vector3, weather: PbrWeatherParams) => void;
  dispose: () => void;
} {
  const positions = new Float32Array(particleCount * 3);
  const seeds = new Float32Array(particleCount);
  const spanX = 240;
  const spanZ = 240;
  const spanY = 95;

  for (let i = 0; i < particleCount; i++) {
    const h1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const h2 = Math.abs(Math.sin(i * 78.233 + 1.7) * 24634.6345) % 1;
    const h3 = Math.abs(Math.sin(i * 39.425 + 4.2) * 19532.1234) % 1;
    positions[i * 3] = (h1 - 0.5) * spanX;
    positions[i * 3 + 1] = h2 * spanY + 2;
    positions[i * 3 + 2] = (h3 - 0.5) * spanZ;
    seeds[i] = h1 * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  geo.setAttribute('position', posAttr);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1.0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
    grad.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const spriteTex = new THREE.CanvasTexture(canvas);
  spriteTex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.PointsMaterial({
    map: spriteTex,
    color: 0xd8ecff,
    size: 1.6,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;

  const update = (dt: number, elapsed: number, focus: THREE.Vector3, weather: PbrWeatherParams) => {
    if (weather.particleType === 'none' || weather.particleOpacity <= 0.01) {
      points.visible = false;
      return;
    }

    points.visible = true;
    mat.color.setHex(weather.particleColorHex);
    mat.opacity = weather.particleOpacity;
    mat.size =
      weather.particleType === 'snow'
        ? 2.35
        : weather.particleType === 'sand'
          ? 2.85
          : 1.55;

    const fallSpeed = weather.particleSpeed;
    const windX =
      weather.particleType === 'sand'
        ? weather.windSpeed * 18
        : weather.particleType === 'rain'
          ? weather.windSpeed * 5.2
          : weather.windSpeed * 3.4;
    const windZ = weather.windSpeed * 2.4;

    const arr = posAttr.array as Float32Array;
    const halfX = spanX * 0.5;
    const halfZ = spanZ * 0.5;

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      let px = arr[idx];
      let py = arr[idx + 1];
      let pz = arr[idx + 2];

      if (weather.particleType === 'snow') {
        px += (windX + Math.sin(elapsed * 1.8 + seeds[i]) * 4.5) * dt;
        py -= fallSpeed * dt;
        pz += (windZ + Math.cos(elapsed * 1.5 + seeds[i]) * 3.2) * dt;
      } else if (weather.particleType === 'sand') {
        px += windX * dt;
        py -= fallSpeed * 0.22 * dt;
        pz += (windZ + Math.sin(elapsed * 3.2 + seeds[i]) * 6.0) * dt;
      } else {
        // Rain & Storm slanted streaks
        px += windX * dt;
        py -= fallSpeed * dt;
        pz += windZ * dt;
      }

      if (py < 0.5) py += spanY;
      if (px > focus.x + halfX) px -= spanX;
      if (px < focus.x - halfX) px += spanX;
      if (pz > focus.z + halfZ) pz -= spanZ;
      if (pz < focus.z - halfZ) pz += spanZ;

      arr[idx] = px;
      arr[idx + 1] = py;
      arr[idx + 2] = pz;
    }

    posAttr.needsUpdate = true;
  };

  const dispose = () => {
    geo.dispose();
    mat.dispose();
    spriteTex.dispose();
  };

  return { points, update, dispose };
}

/**
 * Builds subtle volumetric valley mist & high cloud wisps hovering around Aetheris Karst Peaks,
 * Frostheim Fjords, and Northern Alpine Passes.
 */
export function buildVolumetricMistBands(): THREE.Group {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(248, 250, 255, 0.42)');
    grad.addColorStop(0.55, 'rgba(225, 236, 248, 0.18)');
    grad.addColorStop(1, 'rgba(225, 236, 248, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const mistTex = new THREE.CanvasTexture(canvas);
  mistTex.colorSpace = THREE.SRGBColorSpace;

  const mistMat = new THREE.SpriteMaterial({
    map: mistTex,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });

  const mistSeeds: Array<[number, number, number, number]> = [
    // Aetheris Karst Valley Mist
    [168, 16, -24, 42],
    [182, 19, -40, 38],
    [156, 14, 52, 36],
    // Frostheim Fjord Mist
    [-132, 18, -128, 44],
    [-156, 24, -146, 40],
    // Northern Alps Mist
    [-18, 22, -62, 42],
    [22, 20, -52, 38],
    // Valoria Emerald Waterfall Mist
    [-184, 16, 16, 42],
    [-196, 18, -12, 36],
    // Obsidian Archipelago Volcanic Plume Haze
    [176, 22, 162, 46],
    [144, 15, 160, 36],
  ];

  for (const [mx, my, mz, scale] of mistSeeds) {
    const cluster = new THREE.Group();
    cluster.position.set(mx, my, mz);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Sprite(mistMat);
      sp.position.set((i - 1) * (scale * 0.34), (i % 2) * 1.8, ((i * 5) % 3 - 1) * 5);
      sp.scale.set(scale * (0.9 + (i % 2) * 0.2), scale * 0.34, 1);
      cluster.add(sp);
    }
    group.add(cluster);
  }

  return group;
}

/**
 * Returns coordinated Unreal Engine 5 Atmosphere, Lighting, Fog, Sun Vector, and Window Glow
 * combining the player's chosen Time-of-Day Mood + Active World Season!
 */
export function getLightingAtmosphere(
  mood: LightingMoodId,
  season: SeasonId,
): {
  topColor: number;
  horizonColor: number;
  sunColor: number;
  fogColor: number;
  hemiSky: number;
  hemiGround: number;
  sunIntensity: number;
  hemiIntensity: number;
  sunPos: [number, number, number];
  windowGlow: number;
  nightFactor: number;
  snowAmount: number;
  autumnAmount: number;
  springAmount: number;
  exposure: number;
} {
  const snowAmount = season === 'zima' ? 1.0 : season === 'wiosna' ? 0.16 : season === 'jesien' ? 0.08 : 0.0;
  const autumnAmount = season === 'jesien' ? 1.0 : season === 'lato' ? 0.12 : 0.0;
  const springAmount = season === 'wiosna' ? 1.0 : 0.0;

  if (mood === 'midday') {
    return {
      topColor: season === 'zima' ? 0x204d7d : 0x1659a1,
      horizonColor: season === 'zima' ? 0xc2d8eb : 0xcce3f2,
      sunColor: 0xfffaf0,
      fogColor: season === 'zima' ? 0xb4cde2 : 0xbad4e8,
      hemiSky: 0xd6eeff,
      hemiGround: 0x3b4836,
      sunIntensity: 2.85,
      hemiIntensity: 1.25,
      sunPos: [95, 165, -75],
      windowGlow: 0.7,
      nightFactor: 0.0,
      snowAmount,
      autumnAmount,
      springAmount,
      exposure: 1.08,
    };
  }

  if (mood === 'dusk') {
    return {
      topColor: 0x151e3f,
      horizonColor: 0xd97652,
      sunColor: 0xffa65c,
      fogColor: 0x7c5058,
      hemiSky: 0x7b78a8,
      hemiGround: 0x2a2026,
      sunIntensity: 2.15,
      hemiIntensity: 0.85,
      sunPos: [-165, 34, -110],
      windowGlow: 2.6,
      nightFactor: 0.45,
      snowAmount,
      autumnAmount,
      springAmount,
      exposure: 1.12,
    };
  }

  if (mood === 'night') {
    return {
      topColor: 0x050b1c,
      horizonColor: 0x16294a,
      sunColor: 0x9cc4ff,
      fogColor: 0x0e1d36,
      hemiSky: 0x3b5c8c,
      hemiGround: 0x101824,
      sunIntensity: 1.05,
      hemiIntensity: 0.65,
      sunPos: [-120, 95, -135],
      windowGlow: 3.4,
      nightFactor: 1.0,
      snowAmount,
      autumnAmount,
      springAmount,
      exposure: 1.16,
    };
  }

  // Default: Cinematic Unreal Engine Golden Hour (blended distinctly per Season!)
  if (season === 'zima') {
    return {
      topColor: 0x1a3861,
      horizonColor: 0xbfd4e8,
      sunColor: 0xf2f7ff,
      fogColor: 0x9fb8cf,
      hemiSky: 0xc2e0ff,
      hemiGround: 0x394959,
      sunIntensity: 2.35,
      hemiIntensity: 1.15,
      sunPos: [145, 76, -130],
      windowGlow: 2.1,
      nightFactor: 0.0,
      snowAmount,
      autumnAmount,
      springAmount,
      exposure: 1.1,
    };
  }

  if (season === 'wiosna') {
    return {
      topColor: 0x19578c,
      horizonColor: 0xd4ebd8,
      sunColor: 0xfff8e2,
      fogColor: 0xb4d3c5,
      hemiSky: 0xcbeeff,
      hemiGround: 0x355238,
      sunIntensity: 2.7,
      hemiIntensity: 1.22,
      sunPos: [140, 88, -120],
      windowGlow: 1.4,
      nightFactor: 0.0,
      snowAmount,
      autumnAmount,
      springAmount,
      exposure: 1.12,
    };
  }

  return {
    topColor: season === 'jesien' ? 0x22325c : 0x18467a,
    horizonColor: season === 'jesien' ? 0xe8995a : 0xeac28c,
    sunColor: season === 'jesien' ? 0xffcb82 : 0xfff0c7,
    fogColor: season === 'jesien' ? 0xc89262 : 0xcbb79b,
    hemiSky: 0xbde0ff,
    hemiGround: 0x3c4230,
    sunIntensity: 2.75,
    hemiIntensity: 1.15,
    sunPos: [148, 72, -132],
    windowGlow: 1.75,
    nightFactor: 0.0,
    snowAmount,
    autumnAmount,
    springAmount,
    exposure: 1.12,
  };
}
