import { imageUrl } from '../utils/imageUrl';
import { Reflector } from 'three/addons/objects/Reflector.js';
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
  limePlaster: THREE.Texture;
  masonryNormal: THREE.Texture;
  masonryRoughness: THREE.Texture;
  slateRoof: THREE.Texture;
  slateNormal: THREE.Texture;
  clayTiles: THREE.Texture;
  clayNormal: THREE.Texture;
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
    alpineRock: loadTex(scans + 'skarpa.webp', 5, 5),
    cobblestone: loadTex(scans + 'bruk.webp', 32, 32),
    castleStone: loadTex(scans + 'mur.webp', 3, 2),
    limePlaster: loadTex(scans + 'tynk.webp', 1.3, 1.3),
    masonryNormal: loadTex(scans + 'mur-normal.webp', 3, 2, THREE.NoColorSpace),
    masonryRoughness: loadTex(scans + 'mur-szorstkosc.webp', 3, 2, THREE.NoColorSpace),
    slateRoof: loadTex(scans + 'lupek-kolor.webp', 2, 1),
    slateNormal: loadTex(scans + 'lupek-normal.webp', 2, 1, THREE.NoColorSpace),
    clayTiles: loadTex(scans + 'dachowka-kolor.webp', 2, 1),
    clayNormal: loadTex(scans + 'dachowka-normal.webp', 2, 1, THREE.NoColorSpace),
    forestFoliage: loadTex(imageUrl('pbr_forest_foliage_seamless_1795643350683.jpg'), 2, 2),
    desertSand: loadTex(imageUrl('pbr_desert_sand_seamless_1795644303427.jpg'), 26, 26),
    glacierIce: loadTex(imageUrl('pbr_glacier_ice_seamless_1795644303312.jpg'), 24, 24),
    sandstoneWall: loadTex(imageUrl('pbr_sandstone_architecture_seamless_1795644304962.jpg'), 3, 2),
    rockBump,
    rockNormal,
  };
}

// Put extra grid rows along the populated inner coastline and the mountain pass.
// The mesh is continuous across the transition and still covers every continent.
function surveyAxis(t: number, near: number, far: number): number {
  const outerStep = (620 - (far - near)) / 166;
  const leftRows = Math.round((near + 310) / outerStep);
  const row = t * 324;
  if (row < leftRows) return -310 + row * (near + 310) / leftRows;
  if (row < leftRows + 158) return near + (row - leftRows) * (far - near) / 158;
  return far + (row - leftRows - 158) * (310 - far) / (166 - leftRows);
}

export function buildSculptedTerrain(textures: WorldTexturePack): {
  heightAt: (x: number, z: number) => number;
  nearRoad: (x:number,z:number) => boolean;
  paintUnderTree: (x:number,z:number,radius:number) => void;
  addRoad: (points: THREE.Vector3[]) => void;
  dispose: () => void;
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
  const segments = 324;
  const eastColumns = 176;
  const columns = segments + eastColumns;
  const geo = new THREE.PlaneGeometry(size, size, columns, segments);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const count = posAttr.count;
  const biomeData = new Float32Array(count * 4);     // x: height, y: volcanic, z: cityPlaza, w: lavaGlow
  const continentData = new Float32Array(count * 4); // x: desert, y: glacier, z: jade, w: oasis

  for (let i = 0; i < count; i++) {
    const column = i % (columns+1);
    const vx = column <= segments ? surveyAxis(column/segments,-76,98) : size/2+(column-segments)*size/eastColumns;
    const vz = surveyAxis(posAttr.getZ(i) / size + 0.5, -96, 42);
    const vy = getTerrainHeight(vx, vz);
    posAttr.setXYZ(i, vx, vy, vz);

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

  // Four terrain horizons let the sun drop behind actual ridges and keep the
  // distant valleys in shade even outside the city shadow map.
  const horizons = new Float32Array(count * 4);
  const rowLength = columns + 1;
  const offsets = [[1,0],[-1,0],[0,1],[0,-1]];
  const steps = [2,5,10,19,34];
  for (let row = 0; row <= segments; row++) {
    for (let col = 0; col <= columns; col++) {
      const i = row * rowLength + col;
      for (let direction = 0; direction < offsets.length; direction++) {
        const [dc, dr] = offsets[direction];
        let horizon = 0;
        for (const step of steps) {
          const c = col + dc * step, r = row + dr * step;
          if (c < 0 || r < 0 || c > columns || r > segments) break;
          const j = r * rowLength + c;
          const distance = Math.abs(dc ? posAttr.getX(j) - posAttr.getX(i) : posAttr.getZ(j) - posAttr.getZ(i));
          horizon = Math.max(horizon, (posAttr.getY(j) - posAttr.getY(i)) / distance);
        }
        horizons[i * 4 + direction] = Math.min(4,horizon);
      }
    }
  }
  geo.setAttribute('aHorizon', new THREE.BufferAttribute(horizons,4));
  geo.setAttribute('aBiome', new THREE.BufferAttribute(biomeData, 4));
  geo.setAttribute('aContinent', new THREE.BufferAttribute(continentData, 4));
  geo.computeVertexNormals();

  // A single channel paints the actual carriageways onto the terrain. It
  // shares the mountain lighting, snow and wetness and can never hover.
  const maskSize = 1536, pixelsPerUnit = maskSize / size;
  const ink = new Uint8Array(maskSize * maskSize * 2);
  const roadMask = new THREE.DataTexture(ink, maskSize, maskSize, THREE.RGFormat);
  roadMask.generateMipmaps = true;
  roadMask.minFilter = THREE.LinearMipmapLinearFilter;
  roadMask.magFilter = THREE.LinearFilter;
  roadMask.needsUpdate = true;
  function addRoad(points: THREE.Vector3[]) {
    for (let i=1; i<points.length; i++) {
      const a=points[i-1], b=points[i];
      const x0=(a.x+size/2)*pixelsPerUnit, z0=(a.z+size/2)*pixelsPerUnit;
      const dx=(b.x-a.x)*pixelsPerUnit, dz=(b.z-a.z)*pixelsPerUnit;
      const length2=dx*dx+dz*dz;
      const left=Math.max(0,Math.floor(x0+Math.min(0,dx)-2));
      const right=Math.min(maskSize-1,Math.ceil(x0+Math.max(0,dx)+2));
      const top=Math.max(0,Math.floor(z0+Math.min(0,dz)-2));
      const bottom=Math.min(maskSize-1,Math.ceil(z0+Math.max(0,dz)+2));
      for (let z=top;z<=bottom;z++) for(let x=left;x<=right;x++) {
        const px=x+.5-x0, pz=z+.5-z0;
        const t=THREE.MathUtils.clamp((px*dx+pz*dz)/Math.max(length2,.0001),0,1);
        const distance=Math.hypot(px-t*dx,pz-t*dz);
        const coverage=1-THREE.MathUtils.smoothstep(distance,.48,1.8);
        const index=2*(z*maskSize+x);
        ink[index]=Math.max(ink[index],Math.round(coverage*255));
      }
    }
    roadMask.needsUpdate=true;
  }

  function nearRoad(x:number,z:number) {
    if (Math.abs(x)>=size/2 || Math.abs(z)>=size/2) return false;
    const col=Math.floor((x+size/2)*pixelsPerUnit),row=Math.floor((z+size/2)*pixelsPerUnit);
    for(let j=-3;j<=3;j++) for(let i=-3;i<=3;i++) {
      if(ink[2*((row+j)*maskSize+col+i)]>32) return true;
    }
    return false;
  }
  function paintUnderTree(x:number,z:number,radius:number) {
    const cx=(x+size/2)*pixelsPerUnit,cz=(z+size/2)*pixelsPerUnit,r=radius*pixelsPerUnit;
    for(let j=Math.max(0,Math.floor(cz-r));j<Math.min(maskSize,cz+r);j++)
      for(let i=Math.max(0,Math.floor(cx-r));i<Math.min(maskSize,cx+r);i++) {
        const t=Math.min(1,Math.hypot(i+.5-cx,j+.5-cz)/r);
        const index=2*(j*maskSize+i)+1;
        ink[index]=Math.max(ink[index],Math.round(255*(1-t*t*(3-2*t))));
      }
    roadMask.needsUpdate=true;
  }

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
    metalness: 0.01,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRoadMask = {value:roadMask};
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
        attribute vec4 aHorizon;
        varying vec4 vHorizon;
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
        vHorizon = aHorizon;
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
        varying vec4 vHorizon;
        uniform sampler2D uRoadMask;
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
        vec2 uvGrass = vWorldPos.xz * 0.31;
        vec2 uvGrassMacro = vWorldPos.xz * 0.011;
        vec2 uvDesert = vWorldPos.xz * 0.058;
        vec2 uvGlacier = vWorldPos.xz * 0.044;
        vec2 uvCobble = vWorldPos.xz * 0.54;

        // True Triplanar Rock Projection for steep mountain cliffs & karst spires (Zero stretching!)
        vec3 triW = abs(vWorldNorm);
        triW = pow(triW, vec3(4.0));
        triW /= max(dot(triW, vec3(1.0)), 0.0001);
        // Keep the displacement paired with the scanned rock on every projection.
        vec3 strata = vWorldPos * vec3(.115,.20,.115);
        strata.y += .24 * sin(vWorldPos.x * .09 + vWorldPos.z * .06);
        vec4 exposed = texture2D(uRockTex, strata.zy) * triW.x
                     + texture2D(uRockTex, strata.xz) * triW.y
                     + texture2D(uRockTex, strata.xy) * triW.z;
        vec3 rockCol = exposed.rgb;

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
        vec3 springTint = vec3(grassCol.r * 0.92, grassCol.g * 1.12 + 0.01, grassCol.b * 0.88);
        grassCol = mix(grassCol, springTint, uSeasonSpring * 0.62 * (1.0 - desertW));

        // Subtle autumn gold & copper warmth on temperate meadows
        vec3 autumnTint = vec3(grassCol.r * 1.19 + 0.03, grassCol.g * 0.88, grassCol.b * 0.52);
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
        vec3 wetSand = mix(vec3(.095,.083,.065),rockCol, .48);
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

        vec2 groundUse = texture2D(uRoadMask, vWorldPos.xz / 620. + .5).rg;
        terrainCol *= mix(vec3(1.),vec3(.68,.58,.47),groundUse.g);
        float carriageway = groundUse.r;
        float wear = carriageway * smoothstep(.15,.5,h) * (1.-cityPlaza*.75);
        vec3 gravel = mix(cobbleCol*.80,vec3(.29,.21,.14),.48);
        terrainCol = mix(terrainCol,gravel,wear*(.61+.30*exposed.a));

        // Snow-capped Alpine Peaks on Stary Kontynent (dynamic seasonal snowline!)
        float snowLine = mix(26., 5.5, uSeasonSnow);
        float northFace = clamp(.5 - .5 * normalize(vWorldNorm).z, 0., 1.);
        float ledge = smoothstep(.48, .88, flatness + (exposed.a - .5) * .34);
        float snowMask = ledge * smoothstep(-2., 5., h - snowLine + northFace * 3.8 + (exposed.a - .5) * 4.);
        snowMask *= (1. - volc * .96) * (1. - desertW) * (1. - jadeW * .78);
        vec3 granularSnow = mix(vec3(.52,.59,.65),vec3(.86,.9,.93), exposed.a);
        terrainCol = mix(terrainCol, granularSnow, snowMask);

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
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        // Screen-space surface gradient in view space, using the measured rock relief.
        vec3 dpX = dFdx(-vViewPosition), dpY = dFdy(-vViewPosition);
        vec3 across = cross(dpY,normal), along = cross(normal,dpX);
        float area = dot(dpX,across);
        float reliefHeight = .19 * exposed.a * max(cliffWeight, highRockMask) * (1.-snowMask);
        vec3 change = across * dFdx(reliefHeight) + along * dFdy(reliefHeight);
        normal = normalize(max(abs(area),.000001)*normal - sign(area)*change);
      `)
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
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        vec2 bearing = uSunDir.xz / max(length(uSunDir.xz), .001);
        float xRidge = bearing.x > 0. ? vHorizon.x : vHorizon.y;
        float zRidge = bearing.y > 0. ? vHorizon.z : vHorizon.w;
        float crest = dot(vec2(xRidge,zRidge), bearing*bearing);
        float solarSlope = uSunDir.y / max(length(uSunDir.xz),.001);
        float sun = smoothstep(crest-.08, crest+.09, solarSlope);
        float skyView = 1. - .48 * dot(vHorizon/(1.+vHorizon),vec4(.25));
        reflectedLight.directDiffuse *= mix(.38,1.,sun);
        reflectedLight.directSpecular *= sun;
        reflectedLight.indirectDiffuse *= skyView;
      `)
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
  const xGrid = Float32Array.from({length:rowLength},(_,i)=>posAttr.getX(i));
  const zGrid = Float32Array.from({length:segments+1},(_,i)=>posAttr.getZ(i*rowLength));
  function cell(axis: Float32Array, value: number) {
    let lo = 0, hi = axis.length-1;
    while (hi-lo > 1) {
      const mid = (lo+hi) >>> 1;
      if (axis[mid] <= value) lo=mid; else hi=mid;
    }
    return lo;
  }
  function heightAt(x: number, z: number) {
    const c=cell(xGrid,x), r=cell(zGrid,z), i=r*rowLength+c;
    const u=THREE.MathUtils.clamp((x-xGrid[c])/(xGrid[c+1]-xGrid[c]),0,1);
    const v=THREE.MathUtils.clamp((z-zGrid[r])/(zGrid[r+1]-zGrid[r]),0,1);
    const b=posAttr.getY(i+rowLength), d=posAttr.getY(i+1);
    if (u+v<=1) return (1-u-v)*posAttr.getY(i)+v*b+u*d;
    return (u+v-1)*posAttr.getY(i+rowLength+1)+(1-u)*b+(1-v)*d;
  }
  return { mesh, uniforms, heightAt, addRoad, nearRoad, paintUnderTree, dispose() { roadMask.dispose(); geo.dispose(); mat.dispose(); } };
}

/** Water mesh with more shoreline samples in the central trading archipelago. */
export function buildRealisticOcean(softwareRenderer: boolean) {
  const geo = new THREE.PlaneGeometry(1240, 1240, 192, 192);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const depths = new Float32Array(pos.count);
  function gridCoordinate(n: number) {
    const t = Math.abs(n) / 620;
    return Math.sign(n) * (t < 0.65 ? t * 150 : 97.5 + (t - 0.65) * (522.5 / 0.35));
  }
  for (let i = 0; i < pos.count; i++) {
    const innerX = gridCoordinate(pos.getX(i));
    const x = innerX + Math.max(0,innerX-240)*620/380;
    const z = gridCoordinate(pos.getZ(i));
    pos.setXYZ(i, x, 0, z);
    depths[i] = -getTerrainHeight(x, z);
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depths, 1));

  const size = softwareRenderer ? 256 : 640;
  const mirror = new Reflector(new THREE.PlaneGeometry(1, 1), {
    textureWidth: size, textureHeight: size, clipBias: 0.002, multisample: 0,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.updateMatrixWorld();
  const mirrorMaterial = mirror.material as THREE.ShaderMaterial;
  // Reflector implements the renderer hook with these three arguments.
  const captureMirror = mirror.onBeforeRender.bind(mirror) as
    (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
  const uniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.58, 0.34, -0.68).normalize() },
    uSkyHorizon: { value: new THREE.Color(0xe6be8a) },
    uSkyZenith: { value: new THREE.Color(0x1b4678) },
    uSunColor: { value: new THREE.Color(0xfff1cc) },
    uMirror: {value: mirror.getRenderTarget().texture},
    uMirrorMatrix: {value: mirrorMaterial.uniforms.textureMatrix.value},
    uMirrorWeight: {value: 0},
    uWaveChoppiness: { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    vertexShader: `
      uniform mat4 uMirrorMatrix;
      varying vec4 vMirror;
      attribute float aDepth;
      uniform float uTime;
      uniform float uWaveChoppiness;
      varying float vDepth;
      varying float vWaveCrest;
      varying vec3 vWorldPos;

      void main() {
        vMirror = uMirrorMatrix * vec4(position.x, -position.z, 0., 1.);
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
      uniform sampler2D uMirror;
      uniform float uMirrorWeight;
      varying vec4 vMirror;
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
        float detail = (1.0-smoothstep(12.0,65.0,distCamInit)) * rippleAtten;
        vec2 capillary = vec2(cos(dot(wp,vec2(7.1,4.3))+a1-uTime*3.1),
                             sin(dot(wp,vec2(-3.2,5.1))+a2+uTime*2.7));
        vec3 N = normalize(vec3(nx + capillary.x*.018*detail, 1.0, nz + capillary.y*.015*detail));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(uSunDir);

        // Depth-based optical absorption (Coral Turquoise Lagoon -> Sapphire -> Deep Abyssal Ocean)
        vec3 shallowCol = vec3(0.079, 0.124, 0.091);
        vec3 midSeaCol  = vec3(0.030, 0.076, 0.079);
        vec3 deepSeaCol = vec3(0.009, 0.033, 0.047);

        float shallowT = smoothstep(0.0, 2.8, vDepth);
        float deepT = smoothstep(2.6, 8.2, vDepth);
        vec3 waterCol = mix(shallowCol, midSeaCol, shallowT);
        waterCol = mix(waterCol, deepSeaCol, deepT) * (0.26 + 0.94 * sqrt(dot(uSkyHorizon,vec3(.21,.72,.07))));

        // Subsurface emerald wave-crest translucency when sunlit!
        float sss = pow(max(dot(V, -L + N * 0.4), 0.0), 4.0) * vWaveCrest;
        waterCol += vec3(0.01, 0.067, 0.058) * sss * (1.0 - deepT * 0.55) * 0.75;

        // Schlick Fresnel reflection of actual zenith-to-horizon sky gradient
        float cosTheta = max(dot(N, V), 0.0);
        float fresnel = 0.0204 + 0.9796 * pow(1.0 - cosTheta, 5.0);
        vec3 R = reflect(-V, N);
        vec3 skyRefl = mix(uSkyHorizon, uSkyZenith, pow(clamp(R.y, 0.0, 1.0), 0.55));
        if (uMirrorWeight > 0.0 && vMirror.w > 0.0) {
          vec2 uv = vMirror.xy / vMirror.w;
          vec2 edge = min(uv, 1.0 - uv);
          vec2 distort = vec2(N.x+.55*N.z,N.z-.35*N.x) * (.025 + .065/(1.+distCamInit*.03));
          vec3 sceneReflection = texture2D(uMirror,clamp(uv+distort,.002,.998)).rgb;
          skyRefl = mix(skyRefl,sceneReflection,uMirrorWeight*smoothstep(0.,.035,min(edge.x,edge.y)));
        }
        vec3 col = mix(waterCol, skyRefl, .10 + .86 * fresnel);

        // Dual-lobe UE5 Sun Specular Glitter (sharp pinpoint sun path + broad warm sheen)
        vec3 H = normalize(L + V);
        float ndh = max(dot(N, H), 0.0);
        // Pixel footprint broadens distant glints instead of letting them shimmer.
        float spread = clamp(fwidth(ndh) * 160.0 + 0.18 * uWaveChoppiness, 0.0, 1.0);
        float power = mix(340.0, 64.0, spread);
        float specSharp = pow(ndh, power) * (power / 145.0);
        float specBroad = pow(ndh, 36.0) * 0.32;
        col += uSunColor * (specSharp * 0.48 + specBroad * 0.35);

        // Dynamic Breaking Shoreline Surf Foam Rings + Storm Whitecaps
        float waveBreak = sin(vDepth * 8.5 - uTime * 2.8 + sin(wp.x * 0.35 + wp.y * 0.25) * 1.6);
        float shoreEdge = 1.0 - smoothstep(0.0, 0.85, vDepth);
        float foamBands = smoothstep(0.48, 0.90, waveBreak) * (1.0 - smoothstep(0.15, 1.85, vDepth));
        float stormWhitecaps = smoothstep(0.76, 0.97, vWaveCrest) * clamp((uWaveChoppiness - 1.2) * 0.45, 0.0, 0.65);
        float lace = sin(wp.x * 2.1 + uTime + sin(wp.y * 1.7)) * cos(wp.y * 2.6 - 0.55 * uTime);
        float pores = mix(0.40, 1.0, smoothstep(-0.45, 0.65, lace));
        float foam = pores * clamp(shoreEdge * 0.26 + foamBands * 0.23 + stormWhitecaps, 0.0, 0.95);
        col = mix(col, mix((vec3(.21,.23,.22)+uSkyHorizon*.44), uSunColor, 0.16), foam);

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
  let lastCapture = -Infinity;
  function updateReflection(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, now: number) {
    const weight = 1 - THREE.MathUtils.smoothstep(camera.position.y, 20, 38);
    uniforms.uMirrorWeight.value = camera.position.y > 0 ? weight : 0;
    if (uniforms.uMirrorWeight.value === 0) {
      lastCapture = -Infinity;
      return;
    }
    if (now - lastCapture < (softwareRenderer ? 240 : 75)) return;
    lastCapture = now;
    camera.updateMatrixWorld();
    mesh.visible = false;
    try {
      captureMirror(renderer, scene, camera);
    } finally {
      mesh.visible = true;
    }
  }
  function dispose() {
    mirror.dispose();
    mirror.geometry.dispose();
    geo.dispose();
    mat.dispose();
  }
  return { mesh, uniforms, updateReflection, dispose };
}

/**
 * Builds an Unreal-Engine-5-Style Atmospheric Sky Dome with Procedural Volumetric
 * Sunlit FBM Cloud Canopy, Mie Solar Halo, Night Starfield & Northern Aurora Borealis!
 */
export function buildAtmosphericSkyDome() {
  const geo = new THREE.SphereGeometry(680, 40, 28);
  const photoReady = { value: 0 };
  const skyPhoto = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'materials/niebo-przystani.webp',
    () => { photoReady.value = 1; });
  skyPhoto.colorSpace = THREE.SRGBColorSpace;
  skyPhoto.wrapS = THREE.RepeatWrapping;
  const uniforms = {
    uSkyPhoto: {value: skyPhoto},
    uPhotoReady: photoReady,
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
      uniform sampler2D uSkyPhoto;
      uniform float uPhotoReady;
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

        // Latitude-longitude photograph. Keep the authored weather, dusk and night lighting.
        vec2 skyUV = vec2(atan(d.z,d.x)/6.283185+.54 + uTime*.00009,
                          .5+asin(clamp(d.y,-1.,1.))/3.141593);
        vec3 clouds = texture2D(uSkyPhoto, skyUV).rgb;
        float luminance = dot(clouds,vec3(.2126,.7152,.0722));
        clouds = mix(clouds,vec3(luminance),.18+uOvercast*.58);
        clouds *= mix(vec3(.97,1.01,1.05),uSunColor*.63+.22,uNightFactor);
        clouds *= (1.-uOvercast*.45)*(1.-uNightFactor*.89);
        float photoMix = smoothstep(-.008,.065,d.y)*uPhotoReady*(.95-.33*uNightFactor);
        sky = mix(sky,clouds,photoMix);
        // Starfield & Shimmering Northern Aurora Borealis over Frostheim at Dusk/Night!
        if (uNightFactor > 0.1 && d.y > 0.08 && uOvercast < 0.75) {
          float clearSkyMult = 1.0 - uOvercast;
          vec2 starField = d.xz / max(d.y, 0.15) * 95.0;
          vec2 starCell = floor(starField);
          float starSeed = hash2(starCell);
          vec2 withinCell = fract(starField) - .5;
          float pinLight = exp(-dot(withinCell,withinCell)*100.);
          float footprint = max(fwidth(starField.x),fwidth(starField.y));
          float star = smoothstep(.992,.999,starSeed) * pinLight * smoothstep(.12,.45,d.y)
                     * (1.-smoothstep(.3,1.,footprint)) * (1.-.65*smoothstep(.22,.72,luminance));
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
  return { mesh, uniforms, dispose() {skyPhoto.dispose(); mat.dispose(); geo.dispose();} };
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
