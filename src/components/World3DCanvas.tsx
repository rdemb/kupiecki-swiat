import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadLanding } from '../world3d/coastalScenery';
import { outdoorReflections } from '../world3d/outdoorReflections';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Town } from './ProvinceHall';
import { charteredTowns } from '../world3d/charteredTowns';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CITIES, CommodityId, ContinentId, SEASONS, SeasonId } from '../economy/economyEngine';
import { ActiveWorldDisaster } from '../economy/worldDisasters';
import { DRAGON_STAGE_LABELS, DragonLifeStage, DragonSpeciesId } from '../economy/dragonBreeding';
import { WORLD_CONTINENTS, WORLD_REGIONS, getTerrainHeight } from '../economy/worldMapData';
import {
  LightingMoodId,
  buildAtmosphericSkyDome,
  buildRealisticOcean,
  buildSculptedTerrain,
  buildVolumetricMistBands,
  getLightingAtmosphere,
  loadWorldTextures,
} from '../world3d/terrainAndShaders';
import { PbrWeatherId, getPbrWeatherParams } from '../world3d/pbrWeather';
import { buildWeatherParticleShaderSystem } from '../world3d/weatherParticleShaders';
import {
  AMBIENT_CARAVAN_ROUTES,
  type CameraPresetId,
  computeCaravanCameraPose,
  computeStaticCameraPresetPose,
} from '../world3d/cameraPresets';
import { ActiveTrailEvent } from '../economy/trailEvents';
import {
  buildArticulatedDragon,
  buildDetailedCaravanWagon,
  buildGalleonMesh,
  buildOrganicForestsAndBoulders,
  buildRealisticCity,
  buildWorldLandmarks,
  createSharedWorldMaterials,
} from '../world3d/architectureAndProps';

export interface ActiveCaravan3D {
  id: string;
  originCityId: string;
  destinationCityId: string;
  commodityId: CommodityId;
  quantity: number;
  escortLevel: number;
  progress: number; // 0..1
  passage?: 'bridge' | 'detour';
  departedAt?: number;
  journeyMs?: number;
  expectedProfit: number;
}

export type { CameraPresetId };

interface World3DCanvasProps {
  visible: boolean;
  towns:Town[];
  gameState: 'title' | 'playing' | 'paused' | 'gameover';
  selectedRegionId: string;
  selectedContinentId: ContinentId | 'all';
  onSelectRegion: (regionId: string) => void;
  activeCaravans: ActiveCaravan3D[];
  cameraPreset: CameraPresetId;
  coastTracking?: boolean;
  bellStrike?: number;
  trackedCaravanId?: string | null;
  activeSeason: SeasonId;
  lightingMood: LightingMoodId;
  pbrWeather: PbrWeatherId;
  trailEvents: ActiveTrailEvent[];
  onSelectTrailEvent: (eventId: string) => void;
  showWorldLabels?: boolean;
  activeDisaster?: ActiveWorldDisaster | null;
  playerDragonSpecies?: DragonSpeciesId;
  playerDragonStage?: DragonLifeStage;
  cinematicTourActive?: boolean;
  onTourContinentChange?: (continentId: ContinentId) => void;
}

// UE5-style subtle cinematic color grading & edge vignette post-processing pass (GPU only)
const UE5FilmicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.28 },
    uContrast: { value: 1.035 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uContrast;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb;
      // Subtle cinema S-curve contrast lift
      col = (col - 0.5) * uContrast + 0.5;
      // Soft cinematic lens vignette
      vec2 centered = vUv - 0.5;
      float vig = 1.0 - smoothstep(0.28, 0.92, length(centered));
      col *= mix(1.0 - uVignette, 1.0, vig);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
    }
  `,
};

// Pre-allocated scratch vectors outside render loop (Zero GC)
const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _actorPos = new THREE.Vector3();
const _actorLook = new THREE.Vector3();
const _trackedPos = new THREE.Vector3();
const _trackedLook = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();
const _projVec = new THREE.Vector3();
const _tmpColor = new THREE.Color();
const _tmpWxColor = new THREE.Color();
const _tmpSunPos = new THREE.Vector3();

export const World3DCanvas: React.FC<World3DCanvasProps> = ({
  visible,
  gameState, towns,
  selectedRegionId,
  selectedContinentId,
  onSelectRegion,
  activeCaravans,
  cameraPreset,
  coastTracking = false,
  bellStrike = -Infinity,
  trackedCaravanId = null,
  activeSeason,
  lightingMood,
  pbrWeather,
  trailEvents,
  onSelectTrailEvent,
  showWorldLabels = true,
  activeDisaster = null,
  playerDragonSpecies = 'ogien',
  playerDragonStage = 2,
  cinematicTourActive = false,
  onTourContinentChange,
}) => {
  const townsRef=useRef(towns);
  townsRef.current=towns;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const eventLabelRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Store latest props in refs so React state updates never rebuild the WebGL scene
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const selectedRegionIdRef = useRef(selectedRegionId);
  selectedRegionIdRef.current = selectedRegionId;

  const selectedContinentIdRef = useRef(selectedContinentId);
  selectedContinentIdRef.current = selectedContinentId;

  const onSelectRegionRef = useRef(onSelectRegion);
  onSelectRegionRef.current = onSelectRegion;

  const activeCaravansRef = useRef(activeCaravans);
  activeCaravansRef.current = activeCaravans;

  const bellStrikeRef = useRef(bellStrike);
  bellStrikeRef.current = bellStrike;
  const coastTrackingRef = useRef(coastTracking);
  coastTrackingRef.current = coastTracking;
  const cameraPresetRef = useRef(cameraPreset);
  cameraPresetRef.current = cameraPreset;

  const trackedCaravanIdRef = useRef(trackedCaravanId);
  trackedCaravanIdRef.current = trackedCaravanId;

  const activeSeasonRef = useRef(activeSeason);
  activeSeasonRef.current = activeSeason;

  const lightingMoodRef = useRef(lightingMood);
  lightingMoodRef.current = lightingMood;

  const pbrWeatherRef = useRef(pbrWeather);
  pbrWeatherRef.current = pbrWeather;

  const trailEventsRef = useRef(trailEvents);
  trailEventsRef.current = trailEvents;

  const onSelectTrailEventRef = useRef(onSelectTrailEvent);
  onSelectTrailEventRef.current = onSelectTrailEvent;

  const showWorldLabelsRef = useRef(showWorldLabels);
  showWorldLabelsRef.current = showWorldLabels;

  const activeDisasterRef = useRef(activeDisaster);
  activeDisasterRef.current = activeDisaster;

  const playerDragonSpeciesRef = useRef(playerDragonSpecies);
  playerDragonSpeciesRef.current = playerDragonSpecies;

  const playerDragonStageRef = useRef(playerDragonStage);
  playerDragonStageRef.current = playerDragonStage;

  const cinematicTourActiveRef = useRef(cinematicTourActive);
  cinematicTourActiveRef.current = cinematicTourActive;

  const onTourContinentChangeRef = useRef(onTourContinentChange);
  onTourContinentChangeRef.current = onTourContinentChange;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.autoUpdate = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initAtmo = getLightingAtmosphere(lightingMoodRef.current, activeSeasonRef.current);
    scene.background = new THREE.Color(initAtmo.horizonColor);
    scene.fog = new THREE.FogExp2(initAtmo.fogColor, 0.00175);

    // 2. PBR Environment Reflections via PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    let reflections = outdoorReflections(pmremGenerator,initAtmo);
    let reflectionSeason=activeSeasonRef.current;
    scene.environment = reflections.texture;


    const camera = new THREE.PerspectiveCamera(44, width / height, 1.0, 1550);
    camera.position.set(16, 152, 266);

    function isHarbourView() {
      return cameraPresetRef.current === 'coast' || cameraPresetRef.current === 'mint';
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.maxPolarAngle = isHarbourView() ? Math.PI * .525 : Math.PI / 2.12;
    controls.minDistance = 16;
    controls.maxDistance = 460;
    controls.target.set(4, 3, 12);

    // On a tall screen keep both the quay and the nearest ship in frame.
    const portraitFraming = () => THREE.MathUtils.clamp((1.05 - camera.aspect) / .6, 0, 1);
    function frameCoast(target: THREE.Vector3) {
      const amount = portraitFraming();
      target.x += 2.65 * amount;
      target.z += 3.40 * amount;
    }
    if (isHarbourView()) {
      const initial = computeStaticCameraPresetPose(cameraPresetRef.current === 'mint' ? 'mint' : 'coast', [0,0,0], 'stary_kontynent');
      camera.position.set(...initial.position);
      controls.target.set(...initial.target);
      if (cameraPresetRef.current === 'coast') frameCoast(controls.target);
      controls.update();
    }
    let coastPhase = 0;
    let lastHarbourShadow = -Infinity;
    let wasTracking = false;
    let userInteractingWithCamera = false;
    controls.addEventListener('start', () => {
      userInteractingWithCamera = true;
    });

    // 3. Unreal-Engine-5 GPU Post-Processing Composer (Bloom + Filmic Grade)
    let composer: EffectComposer | null = null;
    if (!isSoftwareGl) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(Math.floor(width / 2), Math.floor(height / 2)),
        0.38, // subtle golden sunlight & magma/lantern halo
        0.52,
        0.86,
      );
      composer.addPass(bloomPass);
      const gradePass = new ShaderPass(UE5FilmicGradeShader);
      composer.addPass(new OutputPass());
      composer.addPass(gradePass);
    }

    // 4. Outdoor UE5 Lighting Rig (Sun Key + Sky/Ground Hemisphere + Ocean Bounce Rim)
    const hemiLight = new THREE.HemisphereLight(initAtmo.hemiSky, initAtmo.hemiGround, initAtmo.hemiIntensity);
    hemiLight.position.set(0, 180, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(initAtmo.sunColor, initAtmo.sunIntensity);
    sunLight.position.set(...initAtmo.sunPos);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.setScalar(isSoftwareGl ? 768 : 2048);
    sunLight.shadow.camera.near = 25;
    sunLight.shadow.camera.far = 520;
    const d = 195;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.00045;
    sunLight.shadow.normalBias = 0.035;
    scene.add(sunLight);

    const seaRimLight = new THREE.DirectionalLight(0x7dd3fc, 0.72);
    seaRimLight.position.set(-140, 58, 165);
    scene.add(seaRimLight);

    // 5. Load PBR Textures & Build 4-Continent Sculpted Terrain, Ocean, Volumetric Cloud Sky & Mist
    const textures = loadWorldTextures(renderer);
    const materials = createSharedWorldMaterials(textures);
    const closeLanding = loadLanding(scene);
    const settlements=charteredTowns(scene,materials);
    let lastTowns: Town[] | null=null;

    const skyDome = buildAtmosphericSkyDome();
    scene.add(skyDome.mesh);

    const terrain = buildSculptedTerrain(textures);
    scene.add(terrain.mesh);

    const ocean = buildRealisticOcean(isSoftwareGl);
    scene.add(ocean.mesh);

    const mistBands = buildVolumetricMistBands();
    scene.add(mistBands);

    // 5b. Real-Time GPU GLSL Weather Particle Shaders (Rain Streaks / Snowflakes / Sandstorm / Volumetric Fog)
    const weatherParticles = buildWeatherParticleShaderSystem({ isSoftwareGl });
    scene.add(weatherParticles.group);

    // 6. Build ALL 8 Culturally Distinct Continental Capitals + City Lantern Lights
    const cityGroups: Record<string, THREE.Group> = {};
    const clickableProxies: THREE.Object3D[] = [];
    const cityPointLights: THREE.PointLight[] = [];

    for (const city of CITIES) {
      const cityGroup = buildRealisticCity(city, materials);
      scene.add(cityGroup);
      cityGroups[city.id] = cityGroup;
      cityGroup.traverse((child) => {
        if (child.userData?.regionId) {
          clickableProxies.push(child);
        }
      });

      const cy = getTerrainHeight(city.position3D[0], city.position3D[2]);
      const lightHex = city.id === 'frostgard' ? 0x7dd3fc : 0xffb454;
      const warmLight = new THREE.PointLight(lightHex, 4.6, 30, 1.65);
      warmLight.position.set(city.position3D[0], cy + 8.0, city.position3D[2]);
      warmLight.castShadow = false;
      scene.add(warmLight);
      cityPointLights.push(warmLight);
    }

    const mintBell = cityGroups.krolewska_przystan.getObjectByName('mint_bell');

    // 7. Build ALL 12 Explorable World Landmarks & Fear Places across the 4 Continents
    const landmarks = buildWorldLandmarks(materials);
    scene.add(landmarks.group);
    clickableProxies.push(...landmarks.clickableProxies);

    // 9. Soft Volumetric-Style Feathered Sprite Smoke Plume above Ignis's Caldera (82, y, -20)
    const smokeTexCanvas = document.createElement('canvas');
    smokeTexCanvas.width = 128;
    smokeTexCanvas.height = 128;
    const sctx = smokeTexCanvas.getContext('2d');
    if (sctx) {
      const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 62);
      grad.addColorStop(0, 'rgba(62, 54, 58, 0.72)');
      grad.addColorStop(0.45, 'rgba(48, 44, 48, 0.38)');
      grad.addColorStop(0.78, 'rgba(38, 36, 40, 0.12)');
      grad.addColorStop(1, 'rgba(30, 30, 34, 0.0)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 128, 128);
    }
    const smokeTex = new THREE.CanvasTexture(smokeTexCanvas);
    smokeTex.colorSpace = THREE.SRGBColorSpace;

    const smokePuffs: Array<{ sprite: THREE.Sprite; mat: THREE.SpriteMaterial; phase: number; speed: number; seed: number }> = [];
    const craterY = getTerrainHeight(82, -20);
    for (let i = 0; i < 10; i++) {
      const spMat = new THREE.SpriteMaterial({
        map: smokeTex,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spMat);
      sprite.position.set(82, craterY + 3 + i * 2.2, -20);
      scene.add(sprite);
      smokePuffs.push({
        sprite,
        mat: spMat,
        phase: i / 10,
        speed: 0.11 + (i % 3) * 0.015,
        seed: i * 1.9,
      });
    }

    // 10. Active Region Ground Selection Ring
    const selectionRingGeo = new THREE.RingGeometry(10.2, 11.4, 44);
    selectionRingGeo.rotateX(-Math.PI / 2);
    const selectionRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const selectionRing = new THREE.Mesh(selectionRingGeo, selectionRingMat);
    selectionRing.position.set(4, getTerrainHeight(4, 2) + 0.38, 2);
    scene.add(selectionRing);

    // 11. Heartland Cobblestone Roads & Intercontinental Sea Shipping Lanes
    const landRoutePairs: [string, string][] = [
      ['krolewska_przystan', 'srebrny_gaj'],
      ['krolewska_przystan', 'zelazna_kuznia'],
      ['krolewska_przystan', 'krwawy_szczyt'],
      ['srebrny_gaj', 'zelazna_kuznia'],
      ['zelazna_kuznia', 'krwawy_szczyt'],
      ['valgard', 'smocza_przystan'],
      ['obsydianowa_cytadela', 'port_popiolow'],
    ];
    const seaRoutePairs: [string, string][] = [
      ['krolewska_przystan', 'zlota_zatoka'],
      ['zlota_zatoka', 'oaza_alkharim'],
      ['krolewska_przystan', 'jadeitowa_przystan'],
      ['zlota_zatoka', 'jadeitowa_przystan'],
      ['srebrny_gaj', 'frostgard'],
      ['krolewska_przystan', 'frostgard'],
      ['oaza_alkharim', 'frostgard'],
      ['krwawy_szczyt', 'jadeitowa_przystan'],
      ['srebrny_gaj', 'valgard'],
      ['oaza_alkharim', 'smocza_przystan'],
      ['frostgard', 'valgard'],
      ['jadeitowa_przystan', 'obsydianowa_cytadela'],
      ['zlota_zatoka', 'port_popiolow'],
      ['krolewska_przystan', 'obsydianowa_cytadela'],
    ];

    const routeCurves: Record<string, THREE.CatmullRomCurve3> = {};
    const landCurves = new Set<THREE.CatmullRomCurve3>();
    const buildRoadCurve = (idA: string, idB: string, isSea: boolean, detour=false) => {
      const cityA = CITIES.find((c) => c.id === idA);
      const cityB = CITIES.find((c) => c.id === idB);
      if (!cityA || !cityB || idA === idB) return;
      const suffix=detour?'_ford':'';
      const pts: THREE.Vector3[] = [];
      const steps = isSea ? 24 : Math.ceil(Math.hypot(cityB.position3D[0]-cityA.position3D[0],cityB.position3D[2]-cityA.position3D[2]));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let px = THREE.MathUtils.lerp(cityA.position3D[0], cityB.position3D[0], t);
        let pz = THREE.MathUtils.lerp(cityA.position3D[2], cityB.position3D[2], t);
        const bow = Math.sin(t * Math.PI) * (detour ? -15 : isSea ? 14 : 7);
        px += ((cityB.position3D[2] - cityA.position3D[2]) / 120) * bow;
        pz -= ((cityB.position3D[0] - cityA.position3D[0]) / 120) * bow;
        const py = isSea ? 0.16 : Math.max(0.35, terrain.heightAt(px, pz) + 0.065);
        pts.push(new THREE.Vector3(px, py, pz));
      }
      const fwd = new THREE.CatmullRomCurve3(pts);
      const rev = new THREE.CatmullRomCurve3([...pts].reverse());
      routeCurves[`${idA}__${idB}${suffix}`] = fwd;
      routeCurves[`${idB}__${idA}${suffix}`] = rev;

      if (!isSea) {
        landCurves.add(fwd); landCurves.add(rev);
        terrain.addRoad(pts);
      }
    };

    for (const [a, b] of landRoutePairs) buildRoadCurve(a, b, false);
    for (const [a, b] of seaRoutePairs) buildRoadCurve(a, b, true);

    // Plant against the same ground and road mask used by the wagons.
    const reduceLandscapeMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const scenery = buildOrganicForestsAndBoulders(materials, terrain);
    scene.add(scenery.forestGroup);

    // On-demand fallback curve for any player-dispatched pair not pre-seeded above
    const getOrCreateRouteCurve = (originId: string, destId: string, detour=false): THREE.CatmullRomCurve3 | null => {
      const key = `${originId}__${destId}${detour?'_ford':''}`;
      if (routeCurves[key]) return routeCurves[key];
      const cityA = CITIES.find((c) => c.id === originId);
      const cityB = CITIES.find((c) => c.id === destId);
      if (!cityA || !cityB) return null;
      const isSea = cityA.continentId !== cityB.continentId;
      buildRoadCurve(originId, destId, isSea,detour);
      return routeCurves[key] ?? null;
    };

    // 12. 8 Animated Intercontinental Sailing Galleons patrolling oceans between ALL 4 Continents!
    const sailingShips: Array<{ mesh: THREE.Group; curve: THREE.CatmullRomCurve3; t: number; speed: number }> = [];
    const oceanLoops = [
      // Central Bay & Solaria Strait
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(8, 0.12, 22),
          new THREE.Vector3(32, 0.12, 38),
          new THREE.Vector3(36, 0.12, 72),
          new THREE.Vector3(-8, 0.12, 62),
          new THREE.Vector3(-14, 0.12, 34),
        ],
        true,
      ),
      // Eastern Jade Strait (Stary Kontynent <-> Aetheris)
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(96, 0.12, 48),
          new THREE.Vector3(122, 0.12, 24),
          new THREE.Vector3(120, 0.12, -32),
          new THREE.Vector3(106, 0.12, -62),
          new THREE.Vector3(134, 0.12, 74),
        ],
        true,
      ),
      // Northern Glacial Strait (Stary Kontynent <-> Frostheim)
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-84, 0.12, -46),
          new THREE.Vector3(-104, 0.12, -96),
          new THREE.Vector3(-76, 0.12, -116),
          new THREE.Vector3(-48, 0.12, -88),
        ],
        true,
      ),
      // Southern Solaria Spice Channel (Złota Zatoka <-> Oaza Al-Kharim Coast)
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(4, 0.12, 92),
          new THREE.Vector3(-22, 0.12, 118),
          new THREE.Vector3(-28, 0.12, 82),
          new THREE.Vector3(24, 0.12, 102),
        ],
        true,
      ),
      // Far West Valoria Dragon Strait
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-124, 0.12, 14),
          new THREE.Vector3(-136, 0.12, 64),
          new THREE.Vector3(-118, 0.12, 76),
          new THREE.Vector3(-108, 0.12, -26),
        ],
        true,
      ),
      // Far SE Obsidian Magma Archipelago Strait
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(82, 0.12, 116),
          new THREE.Vector3(128, 0.12, 108),
          new THREE.Vector3(166, 0.12, 104),
          new THREE.Vector3(96, 0.12, 168),
        ],
        true,
      ),
    ];

    for (let i = 0; i < 10; i++) {
      const galleon = buildGalleonMesh(materials, 1.05);
      scene.add(galleon);
      sailingShips.push({
        mesh: galleon,
        curve: oceanLoops[i % oceanLoops.length],
        t: (i * 0.29) % 1,
        speed: 0.016 + (i % 3) * 0.004,
      });
    }

    // Heartland & Continental Land Caravans (IDs shared with WorldMapAtlasPanel)
    const ambientCaravans: Array<{
      id: string;
      mesh: THREE.Group;
      key: string;
      t: number;
      speed: number;
    }> = [];
    for (const spec of AMBIENT_CARAVAN_ROUTES) {
      const wagon = buildDetailedCaravanWagon(materials);
      scene.add(wagon);
      ambientCaravans.push({
        id: spec.id,
        mesh: wagon,
        key: spec.routeKey,
        t: spec.initialPhase,
        speed: spec.speed,
      });
    }

    const playerCaravanPool: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const wagon = buildDetailedCaravanWagon(materials);
      wagon.scale.setScalar(1.3);
      wagon.visible = false;
      scene.add(wagon);
      playerCaravanPool.push(wagon);
    }

    // 13. Legendary Sky Guardians + Player's Bred Dragon Companion (all 4 species!)
    const crimsonDragon = buildArticulatedDragon(materials, 'crimson');
    crimsonDragon.position.set(82, craterY + 14, -20);
    scene.add(crimsonDragon);

    const frostCitadelY = getTerrainHeight(-162, -148);
    const frostWyvern = buildArticulatedDragon(materials, 'frost');
    frostWyvern.position.set(-162, frostCitadelY + 15, -148);
    scene.add(frostWyvern);

    const playerDragonRig = new THREE.Group();
    const playerDragonModels: Record<DragonSpeciesId, THREE.Group> = {
      ogien: buildArticulatedDragon(materials, 'crimson'),
      lod: buildArticulatedDragon(materials, 'frost'),
      szmaragd: buildArticulatedDragon(materials, 'emerald'),
      zloto: buildArticulatedDragon(materials, 'gold'),
    };
    (Object.keys(playerDragonModels) as DragonSpeciesId[]).forEach((sp) => {
      playerDragonModels[sp].visible = sp === playerDragonSpeciesRef.current;
      playerDragonRig.add(playerDragonModels[sp]);
    });
    scene.add(playerDragonRig);

    // 6-Continent Cinematic Showcase Tour Curve
    const tourPosCurve = new THREE.CatmullRomCurve3(
      WORLD_CONTINENTS.map((c) => new THREE.Vector3(...c.cameraOverviewPos)),
      true,
    );
    const tourLookCurve = new THREE.CatmullRomCurve3(
      WORLD_CONTINENTS.map((c) => new THREE.Vector3(...c.cameraOverviewLook)),
      true,
    );
    let tourProgress = 0;
    let lastTourContIdx = -1;

    // 13b. Pool of 6 Grounded 3D Trail Event Beacons (Stone Cairn + Signal Ring + Rotating Crystal)
    const eventBeaconGeoPedestal = new THREE.CylinderGeometry(1.1, 1.55, 1.5, 8);
    const eventBeaconGeoCrystal = new THREE.OctahedronGeometry(1.45, 0);
    const eventBeaconGeoRing = new THREE.RingGeometry(2.8, 3.65, 28);
    eventBeaconGeoRing.rotateX(-Math.PI / 2);
    const eventBeaconProxyGeo = new THREE.SphereGeometry(4.6, 8, 8);
    const eventBeaconProxyMat = new THREE.MeshBasicMaterial({ visible: false });

    const eventBeaconPool: Array<{
      group: THREE.Group;
      crystal: THREE.Mesh;
      crystalMat: THREE.MeshStandardMaterial;
      ring: THREE.Mesh;
      ringMat: THREE.MeshBasicMaterial;
      proxy: THREE.Mesh;
    }> = [];

    for (let i = 0; i < 6; i++) {
      const grp = new THREE.Group();
      grp.visible = false;

      const pedestal = new THREE.Mesh(eventBeaconGeoPedestal, materials.castleStone);
      pedestal.position.y = 0.75;
      grp.add(pedestal);

      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.6,
        roughness: 0.22,
        metalness: 0.35,
      });
      const crystal = new THREE.Mesh(eventBeaconGeoCrystal, crystalMat);
      crystal.position.y = 4.6;
      grp.add(crystal);

      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(eventBeaconGeoRing, ringMat);
      ring.position.y = 0.45;
      grp.add(ring);

      const proxy = new THREE.Mesh(eventBeaconProxyGeo, eventBeaconProxyMat);
      proxy.position.y = 3.2;
      proxy.layers.set(1);
      grp.add(proxy);
      clickableProxies.push(proxy);

      scene.add(grp);
      eventBeaconPool.push({ group: grp, crystal, crystalMat, ring, ringMat, proxy });
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let lastSelectedRegion = selectedRegionIdRef.current;
    let lastSelectedContinent = selectedContinentIdRef.current;
    let lastPreset = cameraPresetRef.current;
    let lastTrackedCaravanId = trackedCaravanIdRef.current;
    let lastLightingMood = lightingMoodRef.current;
    let lastPbrWeather = pbrWeatherRef.current;
    let lightningFlash = 0;
    let lightningCooldown = 2.4;

    // 14. Raycasting for Clicking any of the 20 Regions or Active Trail Event Beacons
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);

    const handlePointerClick = (e: MouseEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const rect = renderer.domElement.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(clickableProxies, false);
      if (hits.length > 0) {
        const eventHit = hits.find((h) => h.object.userData?.trailEventId && h.object.parent?.visible);
        if (eventHit) {
          onSelectTrailEventRef.current(eventHit.object.userData.trailEventId);
          return;
        }
        const hitRegionId = hits[0].object.userData?.regionId;
        if (hitRegionId) {
          userInteractingWithCamera = false;
          onSelectRegionRef.current(hitRegionId);
        }
      }
    };
    renderer.domElement.addEventListener('click', handlePointerClick);

    // Keyboard WASD camera pan support
    const keysHeld = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      keysHeld.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keysHeld.delete(e.code);
    const onBlur = () => keysHeld.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 15. Animation Loop (Zero GC, performance.now(), afterDraw on software WebGL)
    let frameId = 0;
    let disposed = false;
    let shadowAtHarbour = false;
    let prevTimeMs = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function updateProjectedLabels() {
      const w = renderer.domElement.clientWidth || window.innerWidth;
      const h = renderer.domElement.clientHeight || window.innerHeight;
      const visible = gameStateRef.current === 'playing' && showWorldLabelsRef.current && cameraPresetRef.current !== 'quay' && !isHarbourView();
      const camDist = camera.position.distanceTo(controls.target);

      for (const reg of WORLD_REGIONS) {
        const el = labelRefs.current[reg.id];
        if (!el) continue;
        if (!visible) {
          el.style.display = 'none';
          continue;
        }
        // When zoomed far out into full 4-continent World view, show only the 8 Capitals + selected region to keep view crisp!
        if (camDist > 210 && reg.type !== 'capital' && reg.id !== selectedRegionIdRef.current) {
          el.style.display = 'none';
          continue;
        }

        const [rx, rz] = reg.position2D;
        const ry = Math.max(0.5, getTerrainHeight(rx, rz)) + (reg.type === 'capital' ? 14.8 : 8.5);
        _projVec.set(rx, ry, rz).project(camera);

        if (_projVec.z > 1 || _projVec.z < -1) {
          el.style.display = 'none';
          continue;
        }
        const sx = (_projVec.x * 0.5 + 0.5) * w;
        const sy = (-_projVec.y * 0.5 + 0.5) * h;

        if (sx < 34 || sx > w - 34 || sy < 72 || sy > h - 68) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = 'flex';
        el.style.transform = `translate(-50%, -100%) translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      }

      // Project clickable 3D Trail Event callout badges across the 4 continents
      const activeEvents = trailEventsRef.current;
      const showEvents = gameStateRef.current === 'playing' && !isHarbourView();
      for (const ev of activeEvents) {
        const el = eventLabelRefs.current[ev.id];
        if (!el) continue;
        if (!showEvents) {
          el.style.display = 'none';
          continue;
        }
        const [ex, ez] = ev.position2D;
        const ey = Math.max(0.6, getTerrainHeight(ex, ez)) + 9.2;
        _projVec.set(ex, ey, ez).project(camera);

        if (_projVec.z > 1 || _projVec.z < -1) {
          el.style.display = 'none';
          continue;
        }
        const sx = (_projVec.x * 0.5 + 0.5) * w;
        const sy = (-_projVec.y * 0.5 + 0.5) * h;

        if (sx < 38 || sx > w - 38 || sy < 74 || sy > h - 72) {
          el.style.display = 'none';
          continue;
        }

        el.style.display = 'flex';
        el.style.transform = `translate(-50%, -100%) translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
      }
    }

    function tick() {
      if(lastTowns!==townsRef.current){lastTowns=townsRef.current;settlements.update(lastTowns); }
      if (disposed) return;
      if (!visibleRef.current || document.hidden) {
        frameId = window.setTimeout(tick, 180);
        return;
      }
      const nowMs = performance.now();
      const dt = Math.min((nowMs - prevTimeMs) / 1000, 0.05);
      prevTimeMs = nowMs;
      elapsed += dt;

      if (gameStateRef.current !== 'paused') {
        // Dynamically blend UE5 Lighting Mood + Active World Season + Real-Time PBR Weather!
        const moodChanged = lightingMoodRef.current !== lastLightingMood;
        if (moodChanged) {
          lastLightingMood = lightingMoodRef.current;
        }
        const weatherChanged = pbrWeatherRef.current !== lastPbrWeather;
        if (weatherChanged) {
          lastPbrWeather = pbrWeatherRef.current;
        }
        const snapNow = moodChanged || weatherChanged;
        const atmo = getLightingAtmosphere(lightingMoodRef.current, activeSeasonRef.current);
        if(moodChanged || reflectionSeason!==activeSeasonRef.current){
          const next=outdoorReflections(pmremGenerator,atmo);
          scene.environment=next.texture;
          reflections.dispose();
          reflections=next;
          reflectionSeason=activeSeasonRef.current;
        }
        const weatherParams = getPbrWeatherParams(pbrWeatherRef.current);
        const atmoLerp = snapNow ? 1.0 : Math.min(1, dt * 4.5);

        // Storm Lightning Flash pulse (for PBR Storm preset)
        if (weatherParams.lightningChance > 0) {
          lightningCooldown -= dt;
          if (lightningCooldown <= 0) {
            lightningFlash = 1.0;
            lightningCooldown = 2.8 + ((Math.sin(elapsed * 7.3) * 0.5 + 0.5) * 3.4);
          }
        }
        lightningFlash = Math.max(0, lightningFlash - dt * 3.8);

        const seasonMod = SEASONS[activeSeasonRef.current] ?? SEASONS.lato;
        const activeDis = activeDisasterRef.current;
        const disasterAshTarget =
          activeDis && (activeDis.atmosphereMode === 'ash' || activeDis.atmosphereMode === 'quake') ? 0.82 : 0.0;
        const seasonCaravanSpeed =
          seasonMod.caravanSpeedMultiplier * (activeDis ? activeDis.caravanSpeedMultiplier : 1.0);

        terrain.uniforms.uTime.value = elapsed;
        terrain.uniforms.uSeasonSnow.value = THREE.MathUtils.damp(
          terrain.uniforms.uSeasonSnow.value,
          atmo.snowAmount,
          2.2,
          dt,
        );
        terrain.uniforms.uSeasonAutumn.value = THREE.MathUtils.damp(
          terrain.uniforms.uSeasonAutumn.value,
          atmo.autumnAmount,
          2.2,
          dt,
        );
        terrain.uniforms.uSeasonSpring.value = THREE.MathUtils.damp(
          terrain.uniforms.uSeasonSpring.value,
          atmo.springAmount,
          2.2,
          dt,
        );
        terrain.uniforms.uDisasterAsh.value = THREE.MathUtils.damp(
          terrain.uniforms.uDisasterAsh.value,
          disasterAshTarget,
          2.4,
          dt,
        );
        terrain.uniforms.uWeatherWetness.value = snapNow
          ? weatherParams.wetness
          : THREE.MathUtils.damp(terrain.uniforms.uWeatherWetness.value, weatherParams.wetness, 3.5, dt);
        terrain.uniforms.uWeatherSnow.value = snapNow
          ? weatherParams.snowAccumulation
          : THREE.MathUtils.damp(terrain.uniforms.uWeatherSnow.value, weatherParams.snowAccumulation, 3.0, dt);
        terrain.uniforms.uWeatherDust.value = snapNow
          ? weatherParams.dustCoat
          : THREE.MathUtils.damp(terrain.uniforms.uWeatherDust.value, weatherParams.dustCoat, 3.0, dt);
        terrain.uniforms.uAerialFogDensity.value = snapNow
          ? weatherParams.fogMultiplier
          : THREE.MathUtils.damp(terrain.uniforms.uAerialFogDensity.value, weatherParams.fogMultiplier, 3.5, dt);

        // Dynamic PBR Wetness Roughness & Environment Reflection Modulation on City Stone, Roofs & Roads!
        const wet = terrain.uniforms.uWeatherWetness.value;
        const envBoost = 1.0 + wet * 0.52;
        materials.castleStone.roughness = THREE.MathUtils.lerp(0.82, 0.28, wet);
        materials.castleStone.envMapIntensity = envBoost;
        materials.sandstoneBrick.roughness = THREE.MathUtils.lerp(0.84, 0.34, wet);
        materials.sandstoneBrick.envMapIntensity = envBoost;
        materials.darkBasaltStone.roughness = THREE.MathUtils.lerp(0.85, 0.24, wet);
        materials.darkBasaltStone.envMapIntensity = envBoost;
        materials.slateRoof.roughness = THREE.MathUtils.lerp(0.54, 0.16, wet);
        materials.slateRoof.envMapIntensity = envBoost;

        _tmpSunPos.set(...atmo.sunPos);
        sunLight.position.lerp(_tmpSunPos, atmoLerp);
        const sunDirNorm = _tmpSunPos.copy(sunLight.position).normalize();
        skyDome.uniforms.uSunDir.value.copy(sunDirNorm);
        ocean.uniforms.uSunDir.value.copy(sunDirNorm);
        terrain.uniforms.uSunDir.value.copy(sunDirNorm);

        _tmpColor.setHex(atmo.topColor);
        skyDome.uniforms.uTopColor.value.lerp(_tmpColor, atmoLerp);
        ocean.uniforms.uSkyZenith.value.copy(skyDome.uniforms.uTopColor.value);

        _tmpColor.setHex(atmo.horizonColor);
        if (weatherParams.overcast > 0.05 || weatherParams.dustCoat > 0.05) {
          const tintWeight = Math.min(0.65, weatherParams.overcast * 0.55 + weatherParams.dustCoat * 0.6);
          _tmpWxColor.setHex(weatherParams.fogTintHex);
          _tmpColor.lerp(_tmpWxColor, tintWeight);
        }
        skyDome.uniforms.uHorizonColor.value.lerp(_tmpColor, atmoLerp);
        ocean.uniforms.uSkyHorizon.value.copy(skyDome.uniforms.uHorizonColor.value);
        terrain.uniforms.uHorizonColor.value.copy(skyDome.uniforms.uHorizonColor.value);

        _tmpColor.setHex(atmo.sunColor);
        skyDome.uniforms.uSunColor.value.lerp(_tmpColor, atmoLerp);
        ocean.uniforms.uSunColor.value.copy(skyDome.uniforms.uSunColor.value);
        terrain.uniforms.uSunColor.value.copy(skyDome.uniforms.uSunColor.value);
        sunLight.color.copy(skyDome.uniforms.uSunColor.value);
        const targetSunIntensity = atmo.sunIntensity * weatherParams.sunAttenuation + lightningFlash * 3.6;
        sunLight.intensity = snapNow
          ? targetSunIntensity
          : THREE.MathUtils.damp(sunLight.intensity, targetSunIntensity, 5.0, dt);

        _tmpColor.setHex(atmo.hemiSky);
        hemiLight.color.lerp(_tmpColor, atmoLerp);
        _tmpColor.setHex(atmo.hemiGround);
        hemiLight.groundColor.lerp(_tmpColor, atmoLerp);
        const targetHemiIntensity = atmo.hemiIntensity * (0.75 + weatherParams.sunAttenuation * 0.25) + lightningFlash * 1.1;
        hemiLight.intensity = snapNow
          ? targetHemiIntensity
          : THREE.MathUtils.damp(hemiLight.intensity, targetHemiIntensity, 4.5, dt);

        skyDome.uniforms.uTime.value = elapsed;
        skyDome.uniforms.uNightFactor.value = snapNow
          ? atmo.nightFactor
          : THREE.MathUtils.damp(skyDome.uniforms.uNightFactor.value, atmo.nightFactor, 4.0, dt);
        skyDome.uniforms.uOvercast.value = snapNow
          ? weatherParams.overcast
          : THREE.MathUtils.damp(skyDome.uniforms.uOvercast.value, weatherParams.overcast, 3.5, dt);
        skyDome.uniforms.uLightning.value = lightningFlash;
        renderer.toneMappingExposure = snapNow
          ? atmo.exposure
          : THREE.MathUtils.damp(renderer.toneMappingExposure, atmo.exposure, 4.0, dt);

        // Boost city lantern windows & lights dramatically at Dusk / Night / Storm!
        const lanternBoost = 0.045 + atmo.nightFactor * atmo.windowGlow + weatherParams.overcast * .18;
        materials.warmWindowGlow.emissiveIntensity = snapNow
          ? lanternBoost
          : THREE.MathUtils.damp(materials.warmWindowGlow.emissiveIntensity, lanternBoost, 4.5, dt);
        const targetCityLight = 0.18 + atmo.nightFactor * 6.5 + weatherParams.overcast * 2.2;
        for (const pl of cityPointLights) {
          pl.intensity = snapNow
            ? targetCityLight
            : THREE.MathUtils.damp(pl.intensity, targetCityLight, 4.5, dt);
        }

        if (scene.fog instanceof THREE.FogExp2) {
          _tmpColor.setHex(atmo.fogColor);
          if (weatherParams.fogMultiplier > 1.05) {
            _tmpWxColor.setHex(weatherParams.fogTintHex);
            _tmpColor.lerp(_tmpWxColor, Math.min(0.75, (weatherParams.fogMultiplier - 1.0) * 0.55));
          }
          scene.fog.color.lerp(_tmpColor, atmoLerp);
          const targetFogDensity = 0.00175 * weatherParams.fogMultiplier;
          scene.fog.density = snapNow
            ? targetFogDensity
            : THREE.MathUtils.damp(scene.fog.density, targetFogDensity, 3.5, dt);
        }

        // Animate ocean Gerstner waves & ripples scaled by PBR weather choppiness
        materials.sailCloth.userData.wind.value = elapsed;
        ocean.uniforms.uTime.value = elapsed;
        ocean.uniforms.uWaveChoppiness.value = snapNow
          ? weatherParams.waveChoppiness
          : THREE.MathUtils.damp(ocean.uniforms.uWaveChoppiness.value, weatherParams.waveChoppiness, 3.0, dt);

        // Update 100% GPU GLSL Weather Particle Shaders (Rain Streaks / Blizzard Snowflakes / Sandstorm / Volumetric Fog)
        weatherParticles.update({
          dt,
          elapsed,
          cameraPosition: camera.position,
          targetPosition: controls.target,
          weather: weatherParams,
          lightningFlash,
          nightFactor: atmo.nightFactor,
          fogColor: scene.fog instanceof THREE.FogExp2 ? scene.fog.color : skyDome.uniforms.uHorizonColor.value,
          sunColor: skyDome.uniforms.uSunColor.value,
          snapNow,
        });

        // Update Grounded 3D Trail Event Beacons along Continental Routes
        const activeTrailList = trailEventsRef.current;
        for (let i = 0; i < eventBeaconPool.length; i++) {
          const b = eventBeaconPool[i];
          const ev = activeTrailList[i];
          if (!ev || isHarbourView()) {
            b.group.visible = false;
            b.proxy.userData.trailEventId = null;
            continue;
          }
          b.group.visible = true;
          const [ex, ez] = ev.position2D;
          const ey = Math.max(0.35, getTerrainHeight(ex, ez));
          b.group.position.set(ex, ey, ez);
          b.proxy.userData.trailEventId = ev.id;
          b.crystalMat.color.set(ev.colorHex);
          b.crystalMat.emissive.set(ev.colorHex);
          b.ringMat.color.set(ev.colorHex);
          b.crystal.rotation.y = elapsed * 1.85 + i;
          b.crystal.position.y = 4.6 + Math.sin(elapsed * 2.6 + i) * 0.65;
          const ringScale = 1.0 + Math.sin(elapsed * 2.4 + i) * 0.14;
          b.ring.scale.set(ringScale, ringScale, 1);
        }

        // Subtle drift on volumetric valley mist bands scaled by PBR wind speed
        mistBands.children.forEach((cl, idx) => {
          cl.position.x += Math.sin(elapsed * 0.22 + idx) * dt * 0.35 * weatherParams.windSpeed;
        });

        // Animate soft wispy volcanic steam & ash plume rising from Ignis's caldera
        for (const puff of smokePuffs) {
          puff.phase = (puff.phase + dt * puff.speed) % 1;
          const p = puff.phase;
          puff.sprite.position.set(
            82 + p * 12 + Math.sin(elapsed * 0.65 + puff.seed) * (1.2 + p * 2.2),
            craterY + 2.4 + p * 22,
            -20 - p * 5 + Math.cos(elapsed * 0.55 + puff.seed) * (1.1 + p * 1.8),
          );
          const sc = 4.5 + p * 14.5;
          puff.sprite.scale.set(sc, sc * 0.88, 1);
          puff.mat.opacity = Math.sin(p * Math.PI) * 0.34;
        }

        // Rotate coastal lighthouse beacon & Archmage arcane crystal
        if (landmarks.lighthouseBeam) {
          landmarks.lighthouseBeam.rotation.y = elapsed * 0.75;
        }
        if (landmarks.arcaneCrystal) {
          landmarks.arcaneCrystal.rotation.y = elapsed * 1.2;
          landmarks.arcaneCrystal.position.y = 4.6 + Math.sin(elapsed * 2.2) * 0.45;
        }

        // Wind flutter on capital banners & frost beacon rotation
        for (const city of CITIES) {
          const b = cityGroups[city.id]?.getObjectByName('city_banner');
          if (b) b.rotation.y = Math.sin(elapsed * 3.2 + city.position3D[0]) * 0.25;
        }

        // Animate Intercontinental Sailing Galleons (speed governed by Season + Disaster physics!)
        for (const s of sailingShips) {
          s.t = (s.t + dt * s.speed * seasonCaravanSpeed) % 1;
          s.curve.getPointAt(s.t, _actorPos);
          s.curve.getPointAt((s.t + 0.02) % 1, _actorLook);
          s.mesh.position.set(_actorPos.x, 0.12 + Math.sin(elapsed * 2.2 + s.t * 15) * 0.09, _actorPos.z);
          s.mesh.lookAt(_actorLook.x, s.mesh.position.y, _actorLook.z);
          s.mesh.rotateZ(Math.sin(elapsed*1.15+s.t*31) * .024 * weatherParams.waveChoppiness);
          s.mesh.rotateX(Math.cos(elapsed*.88+s.t*22) * .012 * weatherParams.waveChoppiness);
        }

        // Animate Continental Caravans (speed governed by Season + Disaster physics!)
        // Animate Ambient Continental Caravans & capture tracked pose if matched
        const desiredCaravanId = trackedCaravanIdRef.current;
        let hasTrackedCaravan = false;

        for (const item of ambientCaravans) {
          item.t = (item.t + dt * item.speed * seasonCaravanSpeed) % 1;
          const curve = routeCurves[item.key];
          if (curve) {
            curve.getPointAt(item.t, _actorPos);
            curve.getPointAt(Math.min(1, item.t + 0.02), _actorLook);
            _actorPos.y = Math.max(.35,terrain.heightAt(_actorPos.x,_actorPos.z)+.065);
            _actorLook.y = Math.max(.35,terrain.heightAt(_actorLook.x,_actorLook.z)+.065);
            item.mesh.position.copy(_actorPos);
            item.mesh.lookAt(_actorLook);
            if (desiredCaravanId && item.id === desiredCaravanId) {
              _trackedPos.copy(_actorPos);
              _trackedLook.copy(_actorLook);
              hasTrackedCaravan = true;
            }
          }
        }

        // Animate Player-Dispatched Caravans
        const liveCaravans = activeCaravansRef.current;
        for (let i = 0; i < playerCaravanPool.length; i++) {
          const mesh = playerCaravanPool[i];
          const data = liveCaravans[i];
          if (!data) {
            mesh.visible = false;
            continue;
          }
          const curve = getOrCreateRouteCurve(data.originCityId, data.destinationCityId,data.passage==='detour');
          if (curve) {
            mesh.visible = true;
            const clampedT = Math.max(0, Math.min(0.99, data.progress));
            curve.getPointAt(clampedT, _actorPos);
            curve.getPointAt(Math.min(1, clampedT + 0.02), _actorLook);
            if (landCurves.has(curve)) {
              _actorPos.y=Math.max(.35,terrain.heightAt(_actorPos.x,_actorPos.z)+.065);
              _actorLook.y=Math.max(.35,terrain.heightAt(_actorLook.x,_actorLook.z)+.065);
            }
            mesh.position.copy(_actorPos);
            mesh.lookAt(_actorLook);
            if (desiredCaravanId && data.id === desiredCaravanId) {
              _trackedPos.copy(_actorPos);
              _trackedLook.copy(_actorLook);
              hasTrackedCaravan = true;
            }
          } else {
            mesh.visible = false;
          }
        }

        // Animate Crimson Dragon over Ignis, Frost Wyvern over Frostheim, and Player's Bred Dragon Companion!
        const dAng = elapsed * 0.42;
        crimsonDragon.position.set(
          82 + Math.cos(dAng) * 16,
          craterY + 13.5 + Math.sin(elapsed * 1.4) * 1.6,
          -20 + Math.sin(dAng) * 16,
        );
        crimsonDragon.rotation.y = -dAng;
        const lWing = crimsonDragon.getObjectByName('left_wing');
        const rWing = crimsonDragon.getObjectByName('right_wing');
        if (lWing && rWing) {
          const flap = Math.sin(elapsed * 4.5) * 0.42;
          lWing.rotation.z = flap;
          rWing.rotation.z = -flap;
        }

        const fAng = -elapsed * 0.34 + 1.4;
        frostWyvern.position.set(
          -162 + Math.cos(fAng) * 18,
          frostCitadelY + 14 + Math.sin(elapsed * 1.2) * 1.8,
          -148 + Math.sin(fAng) * 18,
        );
        frostWyvern.rotation.y = -fAng + Math.PI;
        const flWing = frostWyvern.getObjectByName('left_wing');
        const frWing = frostWyvern.getObjectByName('right_wing');
        if (flWing && frWing) {
          const flap = Math.sin(elapsed * 3.8 + 1.0) * 0.42;
          flWing.rotation.z = flap;
          frWing.rotation.z = -flap;
        }

        // Player's Bred Dragon orbits gracefully around the selected Region/Capital!
        const activeSp = playerDragonSpeciesRef.current;
        const activeStage = playerDragonStageRef.current;
        const stageScale = (DRAGON_STAGE_LABELS[activeStage]?.scale3D ?? 1.25) * 0.85;
        playerDragonRig.scale.setScalar(stageScale);
        (Object.keys(playerDragonModels) as DragonSpeciesId[]).forEach((sp) => {
          const model = playerDragonModels[sp];
          model.visible = sp === activeSp;
          if (model.visible) {
            const plw = model.getObjectByName('left_wing');
            const prw = model.getObjectByName('right_wing');
            if (plw && prw) {
              const pFlap = Math.sin(elapsed * 5.2 + 0.6) * 0.46;
              plw.rotation.z = pFlap;
              prw.rotation.z = -pFlap;
            }
          }
        });
        const homeReg = WORLD_REGIONS.find((r) => r.id === selectedRegionIdRef.current) ?? WORLD_REGIONS[0];
        const [hx, hz] = homeReg.position2D;
        const hy = Math.max(2.0, getTerrainHeight(hx, hz));
        const pAng = elapsed * 0.52;
        playerDragonRig.position.set(
          hx + Math.cos(pAng) * 20,
          hy + 17 + Math.sin(elapsed * 1.8) * 1.8,
          hz + Math.sin(pAng) * 20,
        );
        playerDragonRig.rotation.y = -pAng;

        // Track region / continent / preset / tracked-caravan selection changes
        if (
          selectedRegionIdRef.current !== lastSelectedRegion ||
          selectedContinentIdRef.current !== lastSelectedContinent ||
          cameraPresetRef.current !== lastPreset ||
          trackedCaravanIdRef.current !== lastTrackedCaravanId
        ) {
          lastSelectedRegion = selectedRegionIdRef.current;
          lastSelectedContinent = selectedContinentIdRef.current;
          lastPreset = cameraPresetRef.current;
          lastTrackedCaravanId = trackedCaravanIdRef.current;
          userInteractingWithCamera = false;
        }

        const activeRegion =
          WORLD_REGIONS.find((r) => r.id === selectedRegionIdRef.current) ?? WORLD_REGIONS[0];
        const [ax, az] = activeRegion.position2D;
        const ay = Math.max(0.35, getTerrainHeight(ax, az));

        const byWater = isHarbourView();
        controls.maxPolarAngle = byWater ? Math.PI * .525 : Math.PI / 2.12;
        const fov = 44 + (byWater ? 18 * portraitFraming() : 0);
        if (camera.fov !== fov) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        const ringTargetX =
          cameraPresetRef.current === 'caravan' && hasTrackedCaravan ? _trackedPos.x : ax;
        const ringTargetZ =
          cameraPresetRef.current === 'caravan' && hasTrackedCaravan ? _trackedPos.z : az;
        const ringTargetY =
          cameraPresetRef.current === 'caravan' && hasTrackedCaravan
            ? _trackedPos.y + 0.35
            : ay + 0.38;

        selectionRing.visible = cameraPresetRef.current !== 'quay' && !isHarbourView();
        selectionRing.position.x = THREE.MathUtils.damp(selectionRing.position.x, ringTargetX, 7, dt);
        selectionRing.position.z = THREE.MathUtils.damp(selectionRing.position.z, ringTargetZ, 7, dt);
        selectionRing.position.y = THREE.MathUtils.damp(selectionRing.position.y, ringTargetY, 7, dt);
        selectionRing.rotation.z = elapsed * 0.5;

        // Camera Choreography across the 6-Continent World (with Cinematic Flyover Tour Mode!)
        if (gameStateRef.current === 'title') {
          const tourAngle = elapsed * 0.08 + 0.25;
          camera.position.set(
            Math.sin(tourAngle) * 155,
            90 + Math.sin(elapsed * 0.2) * 8,
            Math.cos(tourAngle) * 175 + 32,
          );
          controls.target.set(6, 5, 8);
          camera.lookAt(controls.target);
        } else if (cinematicTourActiveRef.current) {
          tourProgress = (tourProgress + dt * 0.036) % 1;
          tourPosCurve.getPointAt(tourProgress, _targetPos);
          tourLookCurve.getPointAt(tourProgress, _targetLook);
          const camDamp = isSoftwareGl ? 10.0 : 3.2;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetPos.x, camDamp, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetPos.y, camDamp, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetPos.z, camDamp, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, camDamp, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, camDamp, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, camDamp, dt);
          controls.update();

          const contIdx = Math.floor(tourProgress * WORLD_CONTINENTS.length) % WORLD_CONTINENTS.length;
          if (contIdx !== lastTourContIdx) {
            lastTourContIdx = contIdx;
            onTourContinentChangeRef.current?.(WORLD_CONTINENTS[contIdx].id);
          }
        } else {
          const panSpeed = 62 * dt;
          if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) {
            userInteractingWithCamera = true;
            camera.position.z -= panSpeed;
            controls.target.z -= panSpeed;
          }
          if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) {
            userInteractingWithCamera = true;
            camera.position.z += panSpeed;
            controls.target.z += panSpeed;
          }
          if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) {
            userInteractingWithCamera = true;
            camera.position.x -= panSpeed;
            controls.target.x -= panSpeed;
          }
          if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) {
            userInteractingWithCamera = true;
            camera.position.x += panSpeed;
            controls.target.x += panSpeed;
          }

          if (wasTracking !== coastTrackingRef.current) {
            wasTracking=coastTrackingRef.current;userInteractingWithCamera=false;
          }
          if (!userInteractingWithCamera) {
            const preset = cameraPresetRef.current;
            if (preset === 'caravan' && hasTrackedCaravan) {
              const chasePose = computeCaravanCameraPose(
                [_trackedPos.x, _trackedPos.y, _trackedPos.z],
                [_trackedLook.x, _trackedLook.y, _trackedLook.z],
                getTerrainHeight,
              );
              _targetPos.set(...chasePose.position);
              _targetLook.set(...chasePose.target);
            } else {
              const targetContId =
                selectedContinentIdRef.current !== 'all'
                  ? selectedContinentIdRef.current
                  : activeRegion.continentId;
              const staticPreset = preset === 'caravan' ? 'city' : preset;
              const staticPose = computeStaticCameraPresetPose(
                staticPreset,
                [ax, ay, az],
                targetContId,
              );
              _targetPos.set(...staticPose.position);
              _targetLook.set(...staticPose.target);
              if (preset === 'coast' || preset === 'mint') {
                if (preset === 'coast') frameCoast(_targetLook);
                if (coastTrackingRef.current) coastPhase += dt * .19;
                const radius = preset === 'mint' ? 1.5 : 3.1;
                _targetPos.x += Math.sin(coastPhase) * radius;
                _targetPos.z += Math.sin(coastPhase * .68) * radius;
                _targetLook.x += Math.sin(coastPhase) * radius * .45;
              } else coastPhase = 0;
            }

            const distToTarget = camera.position.distanceTo(_targetPos);
            const camDamp =
              preset === 'caravan' && hasTrackedCaravan
                ? isSoftwareGl
                  ? 32.0
                  : distToTarget > 24
                    ? 9.5
                    : 5.8
                : isSoftwareGl
                  ? 14.0
                  : 4.2;
            camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetPos.x, camDamp, dt);
            camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetPos.y, camDamp, dt);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetPos.z, camDamp, dt);

            controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLook.x, camDamp + 1.2, dt);
            controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLook.y, camDamp + 1.2, dt);
            controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLook.z, camDamp + 1.2, dt);
          }
          controls.update();
        }
      }

      const quayDetail = isHarbourView();
      if (shadowAtHarbour !== quayDetail) {
        shadowAtHarbour = quayDetail;
        if (isSoftwareGl) renderer.shadowMap.enabled = sunLight.castShadow = quayDetail;
        const shadowCamera=sunLight.shadow.camera;
        const radius = quayDetail ? 37 : d;
        shadowCamera.left=shadowCamera.bottom=-radius;
        shadowCamera.right=shadowCamera.top=radius;
        shadowCamera.updateProjectionMatrix();
        sunLight.shadow.needsUpdate=true;
      }
      // Cache shadows on software WebGL. The quay still gets sunlight between
      // the buttresses without rendering a second full scene on every frame.
      if (isSoftwareGl && quayDetail && elapsed - lastHarbourShadow > .65) {
        renderer.shadowMap.needsUpdate = true;
        lastHarbourShadow = elapsed;
      }
      if (mintBell) {
        const seconds = (performance.now()-bellStrikeRef.current) / 1000;
        mintBell.rotation.z = seconds < 4 ? .49*Math.exp(-seconds*1.13)*Math.sin(7.6*seconds) : 0;
      }
      scenery.update(camera.position.y, reduceLandscapeMotion.matches ? 0 : elapsed, getPbrWeatherParams(pbrWeatherRef.current).windSpeed,
        terrain.uniforms.uSeasonAutumn.value, terrain.uniforms.uSeasonSnow.value);
      ocean.updateReflection(renderer, scene, camera, performance.now());
      if (composer && !isSoftwareGl) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
      updateProjectedLabels();

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      renderer.domElement.removeEventListener('click', handlePointerClick);
      materials.sailCloth.bumpMap?.dispose();
      materials.sailCloth.dispose();
      materials.timberWood.map?.dispose();
      materials.timberWood.dispose();
      cityGroups.krolewska_przystan?.getObjectByName('mennica-krolewska')?.userData.releaseMint?.();
      settlements.dispose();
      closeLanding();
      terrain.dispose();
      ocean.dispose();
      skyDome.dispose();
      scenery.dispose();
      composer?.passes.forEach(pass=>pass.dispose());
      composer?.dispose();
      weatherParticles.dispose();
      eventBeaconGeoPedestal.dispose();
      eventBeaconGeoCrystal.dispose();
      eventBeaconGeoRing.dispose();
      eventBeaconProxyGeo.dispose();
      eventBeaconProxyMat.dispose();
      for (const b of eventBeaconPool) {
        b.crystalMat.dispose();
        b.ringMat.dispose();
      }
      pmremGenerator.dispose();
      controls.dispose();
      reflections.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full z-0">
      <div
        ref={mountRef}
        data-testid="world-3d-canvas"
        data-weather-preset={pbrWeather}
        data-camera-preset={cameraPreset}
        data-tracked-caravan={trackedCaravanId ?? ''}
        className="w-full h-full"
        aria-label="Trójwymiarowy realistyczny świat 6 kontynentów Kupiecki Świat"
      />

      {/* Projected 3D Region Labels across all 6 Continents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[5]">
        {WORLD_REGIONS.map((reg) => {
          const isSelected = reg.id === selectedRegionId;
          const isCapital = reg.type === 'capital';
          return (
            <button
              key={reg.id}
              ref={(el) => {
                labelRefs.current[reg.id] = el;
              }}
              type="button"
              style={{ display: 'none', position: 'absolute', left: 0, top: 0 }}
              onClick={() => onSelectRegion(reg.id)}
              className={`pointer-events-auto items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold shadow-lg transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-200'
                  : isCapital
                    ? 'bg-[#090e16]/90 text-white border-amber-500/50 hover:bg-amber-500/20'
                    : 'bg-[#120d16]/85 text-rose-200 border-rose-500/40 hover:bg-rose-900/50'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: reg.colorHex }}
              />
              <span className="whitespace-nowrap">{reg.name}{towns.some(t=>t.approved && t.site===reg.linkedCityId) && <small className="block text-[10px]">⚑ {towns.find(t=>t.approved && t.site===reg.linkedCityId)?.name}</small>}</span>
            </button>
          );
        })}

        {/* Projected 3D Trail Event Encounter Callout Badges */}
        {trailEvents.map((ev) => {
          const badgeTone =
            ev.severity === 'danger'
              ? 'bg-rose-600/95 text-white border-rose-200 hover:bg-rose-500'
              : ev.severity === 'mystery'
                ? 'bg-purple-600/95 text-white border-purple-200 hover:bg-purple-500'
                : 'bg-amber-500/95 text-slate-950 border-amber-100 hover:bg-amber-400';
          return (
            <button
              key={ev.id}
              ref={(el) => {
                eventLabelRefs.current[ev.id] = el;
              }}
              type="button"
              data-testid={`world3d-trail-event-${ev.templateId}`}
              style={{ display: 'none', position: 'absolute', left: 0, top: 0 }}
              onClick={() => onSelectTrailEvent(ev.id)}
              className={`pointer-events-auto items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-extrabold shadow-xl transition-colors cursor-pointer ${badgeTone}`}
            >
              <span>!</span>
              <span className="whitespace-nowrap">{ev.categoryLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
