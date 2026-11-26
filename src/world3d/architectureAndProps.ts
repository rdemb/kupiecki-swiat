import {worksites} from '../economy/newHope';
import { insideCommonField } from './commonField';
import * as THREE from 'three';
import { nearPort, portGroves, portWoodland, type WoodlandGround } from './portWoodland';
import { royalMint } from './royalMint';
import { buildGalleonMesh } from './merchantShip';
export { buildGalleonMesh } from './merchantShip';
import { shoreTrees, scannedRocks } from './coastalScenery';
import { merchantCraft, palmFronds, harbourTimber } from './merchantCraft';
import { CITIES, CityNode } from '../economy/economyEngine';
import {
  WORLD_REGIONS,
  getContinentBiomeWeights,
  getTerrainHeight,
} from '../economy/worldMapData';
import { WorldTexturePack } from './terrainAndShaders';

export interface SharedWorldMaterials {
  castleStone: THREE.MeshStandardMaterial;
  sandstoneBrick: THREE.MeshStandardMaterial;
  darkBasaltStone: THREE.MeshStandardMaterial;
  glacialIceMat: THREE.MeshPhysicalMaterial;
  timberWood: THREE.MeshStandardMaterial;
  crimsonLacquer: THREE.MeshStandardMaterial;
  plasterWall: THREE.MeshStandardMaterial;
  slateRoof: THREE.MeshStandardMaterial;
  warmTerracottaRoof: THREE.MeshStandardMaterial;
  emeraldRoof: THREE.MeshStandardMaterial;
  snowRoof: THREE.MeshStandardMaterial;
  warmWindowGlow: THREE.MeshStandardMaterial;
  frostBeaconGlow: THREE.MeshStandardMaterial;
  gildedBrass: THREE.MeshPhysicalMaterial;
  foliageCanopy: THREE.MeshStandardMaterial;
  palmFrondMat: THREE.MeshStandardMaterial;
  treeBark: THREE.MeshStandardMaterial;
  alpineBoulder: THREE.MeshStandardMaterial;
  sailCloth: THREE.MeshStandardMaterial;
  oasisWaterMat: THREE.MeshPhysicalMaterial;
}

// Drive long rain streaks in world space, across separate blocks and instances.
function weatherMasonry(material:THREE.MeshStandardMaterial,strength:number){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 masonryPosition;\n'+shader.vertexShader.replace('#include <project_vertex>',`
      vec4 masonryVertex=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        masonryVertex=instanceMatrix*masonryVertex;
      #endif
      masonryPosition=(modelMatrix*masonryVertex).xyz;
      #include <project_vertex>`);
    shader.fragmentShader='varying vec3 masonryPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 p=masonryPosition;
      float exposure=.5+.5*sin(p.x*.74+sin(p.z*.87)+sin(p.y*.21+p.z*.31));
      float drip=.5+.5*sin(8.3*p.x+5.2*p.z+.35*sin(2.4*p.y)+1.8*sin(.19*p.z));
      float crust=smoothstep(.59,.92,exposure)*smoothstep(.51,.9,drip);
      diffuseColor.rgb*=mix(vec3(1.),vec3(.66,.69,.55),crust*${strength.toFixed(2)});
    `);
  };
  material.customProgramCacheKey=()=> 'masonry-weathering-'+strength;
}
export function createSharedWorldMaterials(textures: WorldTexturePack): SharedWorldMaterials {
  const grain = harbourTimber();
  const canvas = new THREE.TextureLoader().load(import.meta.env.BASE_URL + 'materials/waga-len.webp');
  canvas.colorSpace = THREE.SRGBColorSpace;
  canvas.wrapS = canvas.wrapT = THREE.RepeatWrapping;
  canvas.repeat.set(5, 4);
  const wind = {value: 0};
  const sailCloth = new THREE.MeshStandardMaterial({
    bumpMap: canvas, bumpScale: .006, roughness: .91, side: THREE.DoubleSide, color: 0xeee4d0,
  });
  sailCloth.userData.wind = wind;
  sailCloth.onBeforeCompile = shader => {
    shader.uniforms.uSailTime = wind;
    shader.vertexShader = 'uniform float uSailTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float freeEdge = smoothstep(0., .8, 1.-uv.y);
      transformed.z += freeEdge * (.037*sin(5.*uv.x + 1.6*uSailTime) + .014*sin(24.*uv.x - 2.3*uSailTime));
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 sheet = vBumpMapUv / vec2(5.,4.);
      float grain = texture2D(bumpMap,vBumpMapUv).r;
      float panel = abs(fract(sheet.x*7.+.5)-.5);
      float seam = 1.-smoothstep(.005,.025+fwidth(sheet.x)*6.,panel);
      diffuseColor.rgb *= (.84 + min(.18,grain*2.5)) * (1.-seam*.23);
    `);
  };
  const shared = {
    castleStone: new THREE.MeshStandardMaterial({
      map: textures.castleStone,
      normalMap: textures.masonryNormal,
      roughnessMap: textures.masonryRoughness,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughness: 1,
      metalness: 0,
    }),
    sandstoneBrick: new THREE.MeshStandardMaterial({
      map: textures.sandstoneWall,
      normalMap: textures.rockNormal,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.84,
      metalness: 0.05,
    }),
    darkBasaltStone: new THREE.MeshStandardMaterial({
      map: textures.alpineRock,
      normalMap: textures.rockNormal,
      normalScale: new THREE.Vector2(0.95, 0.95),
      color: 0x5c5864,
      roughness: 0.85,
      metalness: 0.18,
    }),
    glacialIceMat: new THREE.MeshPhysicalMaterial({
      map: textures.glacierIce,
      normalMap: textures.rockNormal,
      normalScale: new THREE.Vector2(0.55, 0.55),
      color: 0xcbe9ff,
      roughness: 0.24,
      metalness: 0.12,
      clearcoat: 0.75,
      clearcoatRoughness: 0.18,
    }),
    timberWood: new THREE.MeshStandardMaterial({
      color: 0xe2cfba,
      map: grain,
      bumpMap: grain,
      bumpScale: 0.028,
      roughness: 0.82,
      metalness: 0.04,
    }),
    crimsonLacquer: new THREE.MeshStandardMaterial({
      color: 0x9e2124,
      roughness: 0.36,
      metalness: 0.18,
    }),
    plasterWall: new THREE.MeshStandardMaterial({
      color: 0xf1e3cd,
      map: textures.limePlaster,
      bumpMap: textures.rockBump,
      bumpScale: 0.05,
      roughness: 0.88,
      metalness: 0.02,
    }),
    slateRoof: new THREE.MeshStandardMaterial({
      map: textures.slateRoof,
      normalMap: textures.slateNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.54,
      metalness: 0.28,
    }),
    warmTerracottaRoof: new THREE.MeshStandardMaterial({
      map: textures.clayTiles,
      normalMap: textures.clayNormal,
      normalScale: new THREE.Vector2(.72,.72),
      color: 0xf1dbca,
      roughness: 0.64,
      metalness: 0.12,
    }),
    emeraldRoof: new THREE.MeshStandardMaterial({
      map: textures.slateRoof,
      color: 0x3b9d86,
      roughness: 0.38,
      metalness: 0.42,
    }),
    snowRoof: new THREE.MeshStandardMaterial({
      map: textures.glacierIce,
      color: 0xeef6ff,
      roughness: 0.48,
      metalness: 0.08,
    }),
    warmWindowGlow: new THREE.MeshStandardMaterial({
      color: 0x383a32,
      emissive: 0xff9b26,
      emissiveIntensity: 0.06,
      roughness: 0.22,
      metalness: 0.1,
    }),
    frostBeaconGlow: new THREE.MeshStandardMaterial({
      color: 0x9be7ff,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.0,
      roughness: 0.18,
      metalness: 0.2,
    }),
    gildedBrass: new THREE.MeshPhysicalMaterial({
      color: 0xe2b944,
      roughness: 0.2,
      metalness: 0.94,
      clearcoat: 0.65,
    }),
    foliageCanopy: new THREE.MeshStandardMaterial({
      map: textures.forestFoliage,
      bumpMap: textures.rockBump,
      bumpScale: 0.14,
      roughness: 0.8,
      metalness: 0.02,
    }),
    palmFrondMat: new THREE.MeshStandardMaterial({
      map: textures.forestFoliage,
      color: 0x5ea342,
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
    treeBark: new THREE.MeshStandardMaterial({
      color: 0x452f1e,
      bumpMap: textures.rockBump,
      bumpScale: 0.16,
      roughness: 0.94,
      metalness: 0.0,
    }),
    alpineBoulder: new THREE.MeshStandardMaterial({
      map: textures.alpineRock,
      normalMap: textures.rockNormal,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.88,
      metalness: 0.08,
    }),
    sailCloth,
    oasisWaterMat: new THREE.MeshPhysicalMaterial({
      color: 0x14b8a6,
      roughness: 0.12,
      metalness: 0.1,
      clearcoat: 0.9,
    }),
  };
  weatherMasonry(shared.castleStone,.9);weatherMasonry(shared.sandstoneBrick,.62);
  weatherMasonry(shared.plasterWall,.42);weatherMasonry(shared.darkBasaltStone,.7);
  return shared;
}

function buildMedievalHouse(
  width: number,
  height: number,
  depth: number,
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  timberMat: THREE.Material,
  windowMat: THREE.Material,
): THREE.Group {
  const house = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  house.add(body);

  const roofShape = new THREE.Shape();
  const rw = width * 0.58;
  const rh = height * 0.68;
  roofShape.moveTo(-rw, 0);
  roofShape.lineTo(rw, 0);
  roofShape.lineTo(0, rh);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: depth + 0.36, bevelEnabled: false });
  roofGeo.translate(0, 0, -(depth + 0.36) / 2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = height;
  roof.castShadow = true;
  house.add(roof);

  const beam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.14, 0.16, depth + 0.14), timberMat);
  beam.position.y = height * 0.55;
  house.add(beam);

  const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, height * 0.28, 0.08), windowMat);
  win.position.set(0, height * 0.62, depth / 2 + 0.03);
  house.add(win);

  return house;
}

/**
 * Helper: Sculpted Onion Dome (LatheGeometry) for Solaria Desert Sultanate Citadels!
 */
function createOnionDomeGeometry(radius: number, height: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI;
    const r = Math.sin(angle) * radius * (1 + (1 - t) * 0.16);
    const y = t * height;
    pts.push(new THREE.Vector2(Math.max(0.02, r), y));
  }
  return new THREE.LatheGeometry(pts, 16);
}

/**
 * Helper: Builds a Multi-Tiered Swept-Eaves Imperial Pagoda for Aetheris East Continent!
 */
function buildImperialPagoda(
  tiers: number,
  baseWidth: number,
  materials: SharedWorldMaterials,
): THREE.Group {
  const pagoda = new THREE.Group();
  let curY = 0;
  for (let t = 0; t < tiers; t++) {
    const scale = 1 - t * 0.17;
    const w = baseWidth * scale;
    const h = 2.05 - t * 0.14;

    const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), materials.plasterWall);
    core.position.y = curY + h / 2;
    core.castShadow = true;
    pagoda.add(core);

    // 4 Crimson corner pillars
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, h, 6), materials.crimsonLacquer);
        col.position.set(sx * (w * 0.48), curY + h / 2, sz * (w * 0.48));
        pagoda.add(col);
      }
    }

    // Warm paper-lantern facade strip
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(w * 0.52, h * 0.38, w + 0.08), materials.warmWindowGlow);
    lantern.position.y = curY + h * 0.52;
    pagoda.add(lantern);

    // Curved overhanging jade roof tier (4-sided pyramid with broad eaves)
    const eaves = new THREE.Mesh(new THREE.ConeGeometry(w * 1.12, 1.15, 4), materials.emeraldRoof);
    eaves.position.y = curY + h + 0.45;
    eaves.rotation.y = Math.PI / 4;
    eaves.castShadow = true;
    pagoda.add(eaves);

    curY += h + 0.62;
  }

  // Gilded finial spire
  const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.22, 2.4, 8), materials.gildedBrass);
  finial.position.y = curY + 1.1;
  pagoda.add(finial);

  return pagoda;
}

/**
 * Builds culturally authentic 35+ part Capital Cities across ALL 4 Continents:
 * - Stary Kontynent: Medieval Fortified European Citadels
 * - Solaria: Golden Sandstone Sultanate Palaces with Onion Domes, Minarets & Oasis
 * - Frostheim: Nordic Glacial Fjord Fortress with A-Frame Longhouses & Frost Beacon
 * - Aetheris: Multi-Tiered Imperial Jade Pagoda Metropolis
 */
export function buildRealisticCity(city: CityNode, materials: SharedWorldMaterials): THREE.Group {
  const group = new THREE.Group();
  const craft = merchantCraft(materials);
  group.name = `city_${city.id}`;
  const cx = city.position3D[0];
  const cz = city.position3D[2];
  const groundY = getTerrainHeight(cx, cz);

  const isDesertSultanate = city.id === 'oaza_alkharim';
  const isNordicFjord = city.id === 'frostgard';
  const isImperialPagoda = city.id === 'jadeitowa_przystan';
  const isValoriaHighland = city.continentId === 'valoria_zachod';
  const isObsidianFortress = city.continentId === 'obsydian_wulkan';
  const isDarkFortress = isObsidianFortress || city.race === 'krasnoludy' || city.race === 'orkowie';

  const primaryStone = isDesertSultanate
    ? materials.sandstoneBrick
    : isDarkFortress
      ? materials.darkBasaltStone
      : materials.castleStone;

  const primaryRoof = isNordicFjord
    ? materials.snowRoof
    : isImperialPagoda || isValoriaHighland || city.race === 'elfy'
      ? materials.emeraldRoof
      : isObsidianFortress
        ? materials.crimsonLacquer
        : city.race === 'ludzie' || city.race === 'gobliny'
          ? materials.warmTerracottaRoof
          : materials.slateRoof;

  // 1. Deep Stone Retaining Foundation so sloped hillsides never expose gaps
  const foundation = new THREE.Mesh(new THREE.CylinderGeometry(10.0, 12.2, 4.6, 12), primaryStone);
  foundation.position.y = -2.1;
  foundation.receiveShadow = true;
  group.add(foundation);

  // 2. Fortified Perimeter Curtain Wall Ring + Watchtowers
  const wallSides = 8;
  const wallRadius = 8.6;
  const domeGeo = isDesertSultanate ? createOnionDomeGeometry(1.15, 1.85) : null;

  for (let i = 0; i < wallSides; i++) {
    const a1 = (i / wallSides) * Math.PI * 2;
    const a2 = ((i + 1) / wallSides) * Math.PI * 2;
    const x1 = Math.cos(a1) * wallRadius;
    const z1 = Math.sin(a1) * wallRadius;
    const x2 = Math.cos(a2) * wallRadius;
    const z2 = Math.sin(a2) * wallRadius;

    const isHarborOpening = city.isCoastalPort && i === 1;
    const isMintGate = city.id === 'krolewska_przystan' && i === 2;
    if (isMintGate) {
      const bearing = (a1 + a2) * .5;
      group.add(royalMint(materials, [(x1+x2)/2,0,(z1+z2)/2], Math.PI/2-bearing, wallRadius, wallSides));
    }
    if (!isHarborOpening && !isMintGate) {
      const segLen = Math.hypot(x2 - x1, z2 - z1);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen, 2.35, 0.82), primaryStone);
      wall.position.set((x1 + x2) / 2, 1.15, (z1 + z2) / 2);
      wall.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      const wallFoot=wall.matrix.clone().makeRotationY(wall.rotation.y).setPosition(wall.position.x,0,wall.position.z);
      craft.rampart(wallFoot,segLen,primaryStone);

      for (let m = -2; m <= 2; m++) {
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.88), primaryStone);
        const t = (m + 3) / 6;
        merlon.position.set(x1 + (x2 - x1) * t, 2.52, z1 + (z2 - z1) * t);
        merlon.rotation.y = wall.rotation.y;
        group.add(merlon);
      }
    }

    if (city.id === 'krolewska_przystan') continue; // All eight mint defences are batched with its masonry.
    const towerH = i % 2 === 0 ? 4.6 : 3.7;
    const tower = new THREE.Mesh(
      isDesertSultanate ? new THREE.CylinderGeometry(0.92, 1.08, towerH, 10) : new THREE.BoxGeometry(1.78, towerH, 1.78),
      primaryStone,
    );
    tower.position.set(x1, towerH / 2, z1);
    tower.rotation.y = -a1;
    tower.castShadow = true;
    group.add(tower);

    if (isDesertSultanate && domeGeo) {
      const dCap = new THREE.Mesh(domeGeo, i % 2 === 0 ? materials.gildedBrass : materials.emeraldRoof);
      dCap.position.set(x1, towerH - 0.1, z1);
      group.add(dCap);
    } else {
      const tRoof = new THREE.Mesh(new THREE.ConeGeometry(1.48, 1.75, 4), primaryRoof);
      tRoof.position.set(x1, towerH + 0.85, z1);
      tRoof.rotation.y = -a1 + Math.PI / 4;
      tRoof.castShadow = true;
      group.add(tRoof);
    }

    const tWin = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.58, 1.84),
      isNordicFjord ? materials.frostBeaconGlow : materials.warmWindowGlow,
    );
    tWin.position.set(x1, towerH - 0.72, z1);
    tWin.rotation.y = -a1;
    group.add(tWin);
  }

  // 3. Culturally Distinct Central Monument / Citadel Keep
  if (isDesertSultanate) {
    // Grand Solaria Sultanate Palace with Golden Onion Dome & Twin Slender Minarets + Oasis Pool
    const palaceBase = new THREE.Mesh(new THREE.BoxGeometry(5.8, 3.8, 5.2), materials.sandstoneBrick);
    palaceBase.position.set(0, 1.9, -1.2);
    palaceBase.castShadow = true;
    group.add(palaceBase);

    const grandDome = new THREE.Mesh(createOnionDomeGeometry(2.8, 4.4), materials.gildedBrass);
    grandDome.position.set(0, 3.6, -1.2);
    grandDome.castShadow = true;
    group.add(grandDome);

    for (const mx of [-3.2, 3.2]) {
      const minaret = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.78, 9.6, 10), materials.sandstoneBrick);
      minaret.position.set(mx, 4.8, -2.2);
      minaret.castShadow = true;
      group.add(minaret);

      const mDome = new THREE.Mesh(createOnionDomeGeometry(0.82, 1.5), materials.gildedBrass);
      mDome.position.set(mx, 9.5, -2.2);
      group.add(mDome);

      const mGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.75, 10), materials.warmWindowGlow);
      mGlow.position.set(mx, 8.6, -2.2);
      group.add(mGlow);
    }

    // Shimmering Turquoise Oasis Pool in front of Palace!
    const oasisPool = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.14, 18), materials.oasisWaterMat);
    oasisPool.position.set(0, 0.18, 3.8);
    group.add(oasisPool);
  } else if (isImperialPagoda) {
    // 4-Tiered Aetheris Imperial Jade & Crimson Pagoda!
    const grandPagoda = buildImperialPagoda(4, 4.4, materials);
    grandPagoda.position.set(0, 0, -1.0);
    group.add(grandPagoda);

    const sidePagoda = buildImperialPagoda(2, 2.6, materials);
    sidePagoda.position.set(-4.2, 0, 2.2);
    group.add(sidePagoda);
  } else if (isNordicFjord) {
    // Nordic Frostgard Great Mead Hall + Glacial Runic Beacon Tower
    const hall = buildMedievalHouse(
      4.4,
      3.4,
      7.2,
      materials.timberWood,
      materials.snowRoof,
      materials.darkBasaltStone,
      materials.warmWindowGlow,
    );
    hall.position.set(-1.2, 0, -0.8);
    group.add(hall);

    const iceTower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.8, 9.4, 8), materials.darkBasaltStone);
    iceTower.position.set(2.8, 4.7, -1.8);
    iceTower.castShadow = true;
    group.add(iceTower);

    const frostBrazier = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), materials.frostBeaconGlow);
    frostBrazier.position.set(2.8, 10.6, -1.8);
    frostBrazier.name = 'city_banner';
    group.add(frostBrazier);
  } else if (city.id !== 'krolewska_przystan') {
    // Classic Fortified Medieval Citadel Keep & Cathedral Spire
    const keepBase = new THREE.Mesh(new THREE.BoxGeometry(4.8, 4.6, 4.4), primaryStone);
    keepBase.position.set(0, 2.3, -0.8);
    keepBase.castShadow = true;
    keepBase.receiveShadow = true;
    group.add(keepBase);

    const keepUpper = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 3.0), primaryStone);
    keepUpper.position.set(0, 6.2, -0.8);
    keepUpper.castShadow = true;
    group.add(keepUpper);

    const keepRoofShape = new THREE.Shape();
    keepRoofShape.moveTo(-1.85, 0);
    keepRoofShape.lineTo(1.85, 0);
    keepRoofShape.lineTo(0, 2.3);
    keepRoofShape.closePath();
    const keepRoofGeo = new THREE.ExtrudeGeometry(keepRoofShape, { depth: 3.4, bevelEnabled: false });
    keepRoofGeo.translate(0, 0, -1.7);
    const keepRoof = new THREE.Mesh(keepRoofGeo, primaryRoof);
    keepRoof.position.set(0, 8.0, -0.8);
    keepRoof.castShadow = true;
    group.add(keepRoof);

    const bellTower = new THREE.Mesh(new THREE.BoxGeometry(1.45, 9.4, 1.45), primaryStone);
    bellTower.position.set(2.3, 4.7, -1.9);
    bellTower.castShadow = true;
    group.add(bellTower);

    const bellSpire = new THREE.Mesh(new THREE.ConeGeometry(1.18, 2.7, 4), materials.slateRoof);
    bellSpire.position.set(2.3, 10.65, -1.9);
    bellSpire.rotation.y = Math.PI / 4;
    group.add(bellSpire);

    for (let w = -1; w <= 1; w++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.15, 4.54), materials.warmWindowGlow);
      win.position.set(w * 1.35, 3.0, -0.8);
      group.add(win);
    }

    const bannerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.4, 6), materials.gildedBrass);
    bannerPole.position.set(2.3, 12.8, -1.9);
    group.add(bannerPole);

    const bannerFlag = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.72, 0.08),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(city.colorHex),
        emissive: new THREE.Color(city.colorHex),
        emissiveIntensity: 0.45,
        roughness: 0.5,
      }),
    );
    bannerFlag.position.set(2.98, 13.5, -1.9);
    bannerFlag.name = 'city_banner';
    group.add(bannerFlag);
  }

  // 4. Organic Cluster of 11 Town Houses / Desert Terraces / Nordic Longhouses
  const houseLayout: Array<[number, number, number, number, number, number]> = [
    [-4.3, 2.3, 2.2, 1.6, 1.6, 0.3],
    [-2.1, 4.7, 2.0, 1.5, 1.5, -0.2],
    [3.9, 2.8, 2.4, 1.7, 1.7, 0.5],
    [5.1, -1.4, 2.1, 1.6, 1.5, 1.2],
    [-5.2, -2.5, 2.3, 1.8, 1.6, -0.8],
    [2.0, -5.2, 2.1, 1.6, 1.5, 0.1],
    [-2.5, -5.1, 2.2, 1.5, 1.6, 0.4],
    [4.4, 4.8, 1.9, 1.4, 1.4, -0.5],
    [10.2, -3.5, 2.1, 1.5, 1.6, 0.3],
    [-10.4, 2.5, 2.2, 1.5, 1.5, -0.4],
    [9.4, 5.2, 2.0, 1.4, 1.5, 0.9],
  ];

  for (let i = 0; i < houseLayout.length; i++) {
    const [plotX, hz, hw, hh, hd, rot] = houseLayout[i];
    // Keep the path between the sea gate and the great hall clear.
    const hx = city.id === 'krolewska_przystan' && i === 1 ? -4.9 : plotX;
    const localGroundDelta = getTerrainHeight(cx + hx, cz + hz) - groundY;
    if (groundY + localGroundDelta < 0.85) continue;

    if (isDesertSultanate) {
      // Flat-roofed terraced sandstone desert house with glowing arched doorway
      const dHouse = new THREE.Mesh(new THREE.BoxGeometry(hw, hh * 1.15, hd), materials.sandstoneBrick);
      dHouse.position.set(hx, Math.max(-0.2, localGroundDelta) + hh * 0.55, hz);
      dHouse.rotation.y = rot;
      dHouse.castShadow = true;
      group.add(dHouse);
      dHouse.updateMatrix();craft.terrace(dHouse.matrix,hw,hh*1.15,hd);
    } else {
      const wallM = i % 2 === 0 ? materials.plasterWall : primaryStone;
      const roofM = isNordicFjord ? materials.snowRoof : i % 3 === 0 ? materials.slateRoof : primaryRoof;
      const hMesh = buildMedievalHouse(hw, hh, hd, wallM, roofM, materials.timberWood, materials.warmWindowGlow);
      hMesh.position.set(hx, Math.max(-0.2, localGroundDelta - 0.1), hz);
      hMesh.rotation.y = rot;
      hMesh.updateMatrix();
      craft.facade(hMesh.matrix,hw,hh,hd);
      group.add(hMesh);
    }
  }

  // 5. Connected Stone Quay, Wooden Harbor Pier & Moored Sailing Galleon for Coastal Capitals
  if (city.isCoastalPort && !isDesertSultanate) {
    const pierY = -groundY + 0.55;
    const causeway = new THREE.Mesh(new THREE.BoxGeometry(3.6, groundY + 0.9, 6.2), primaryStone);
    causeway.position.set(1.2, (pierY - groundY) * 0.5 + 0.5, 9.2);
    causeway.receiveShadow = true;
    group.add(causeway);

    const mainPier = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.38, 9.2), materials.timberWood);
    mainPier.position.set(1.2, pierY, 13.6);
    mainPier.castShadow = true;
    group.add(mainPier);

    const crossPier = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.38, 2.2), materials.timberWood);
    crossPier.position.set(1.2, pierY, 17.6);
    group.add(crossPier);

    for (let p = 0; p < 5; p++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.6, 6), materials.timberWood);
      post.position.set(1.2 + (p - 2) * 2.0, pierY - 1.6, 17.6);
      group.add(post);
    }

    craft.quay(1.2,pierY+0.2,13.6);
    const mooredShip = buildGalleonMesh(materials, 1.15);
    mooredShip.position.set(-4.6, -groundY + 0.1, 17.4);
    mooredShip.rotation.y = Math.PI * 0.42;
    group.add(mooredShip);
  }

  // 6. Glowing Smelter Chimneys for Mining/Volcanic Fortresses
  if (isDarkFortress && !isNordicFjord) {
    const furnace = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.45, 5.2, 8), materials.darkBasaltStone);
    furnace.position.set(-3.8, 2.6, -2.5);
    group.add(furnace);

    const lavaMouth = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.2, 1.6),
      new THREE.MeshStandardMaterial({
        color: 0xff6b00,
        emissive: 0xff4500,
        emissiveIntensity: 2.4,
      }),
    );
    lavaMouth.position.set(-3.8, 1.0, -1.6);
    group.add(lavaMouth);
  }

  // Invisible Raycast Hit Proxy (Layer 1)
  const hitProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(11.0, 11.0, 15, 10),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitProxy.position.y = 6.8;
  hitProxy.layers.enable(1);
  hitProxy.userData = { regionId: city.id, cityId: city.id, name: city.name };
  group.add(hitProxy);

  craft.finish(group);
  group.position.set(cx, groundY, cz);
  return group;
}

/**
 * Builds Multi-Biome World Nature across ALL 4 Continents:
 * - 460+ Multi-Clump Organic Oaks, Pines & Aetheris Jade Trees (InstancedMesh)
 * - 80+ Desert Oasis Palm Trees with Curved Trunks & Arched Frond Crowns
 * - 36 Sculpted Crystalline Floating Icebergs in Frostheim's Arctic Strait
 * - 140+ Firmly Grounded Coastal Boulders & Karst Sea Stacks
 */
export function buildOrganicForestsAndBoulders(materials: SharedWorldMaterials, ground: WoodlandGround) {
  const forestGroup = new THREE.Group();

  const createClumpGeo = (radius: number, seed: number): THREE.BufferGeometry => {
    const geo = new THREE.IcosahedronGeometry(radius, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const disp =
        1.0 +
        Math.sin(vx * 3.1 + seed) * 0.18 +
        Math.cos(vy * 3.7 - seed) * 0.15 +
        Math.sin(vz * 2.9 + seed * 1.4) * 0.18;
      pos.setXYZ(i, vx * disp, vy * disp * 0.85, vz * disp);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // --- 1. TEMPERATE, ALPINE & JADE HIGHLANDS ORGANIC FORESTS ---
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.34, 2.2, 6);
  const lowerCanopyGeo = createClumpGeo(1.58, 1.3);
  const upperCanopyGeo = createClumpGeo(1.14, 4.7);

  const treePoints: Array<{ x: number; y: number; z: number; s: number; biomeType: 'oak' | 'pine' | 'jade' }> = [];
  for (let i = 0; i < 2800 && treePoints.length < 520; i++) {
    const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const rz = ((Math.sin(i * 78.233 + 1.5) * 28461.123) % 1 + 1) % 1;
    const x = -238 + rx * 476;
    const z = -210 + rz * 425;

    const y = getTerrainHeight(x, z);
    if (y < 1.4 || y > 11.8) continue;

    const bw = getContinentBiomeWeights(x, z);
    if (bw.volcanic > 0.35) continue;
    if (bw.desert > 0.45 && bw.oasis < 0.3) continue; // Palms grow in desert oases separately
    if (bw.glacier > 0.65 && y > 5.8) continue; // Only hardy fjord pines near Frostheim coast

    const slope = Math.hypot(getTerrainHeight(x + 1.6, z) - y, getTerrainHeight(x, z + 1.6) - y);
    if (slope > 1.35) continue;

    const nearRegion = WORLD_REGIONS.some(
      (r) => Math.hypot(r.position2D[0] - x, r.position2D[1] - z) < (r.type === 'capital' ? 13.5 : 7.0),
    );
    if (nearRegion) continue;

    const biomeType = bw.jade > 0.45 ? 'jade' : bw.glacier > 0.35 || z < -28 ? 'pine' : 'oak';
    const scale = 0.72 + ((i * 19) % 58) / 100;
    if (ground.nearRoad(x,z) || insideCommonField(x,z)) continue;
    treePoints.push({ x, y:ground.heightAt(x,z), z, s: scale, biomeType });
  }

  for(const tree of portGroves(ground,treePoints)) treePoints.push({...tree,biomeType:'oak'});
  // Port trees form a contiguous tail in each broadleaf batch. Switch the
  // whole tail to 3D with one count change, including during an atlas load failure.
  treePoints.sort((a,b)=>Number(nearPort(a))-Number(nearPort(b)));
  const nearTrees=treePoints.filter(t=>nearPort(t) && t.biomeType!=='pine');
  const groves=portWoodland(nearTrees,ground);
  forestGroup.add(groves.group);
  const count = treePoints.length;
  const pineCount=treePoints.filter(t=>t.biomeType==='pine').length;
  const needles=new THREE.InstancedMesh(new THREE.ConeGeometry(1,2,9),materials.foliageCanopy,pineCount*3);
  needles.castShadow=true;
  let pineIndex=0, broadleafIndex=0;
  const instTrunks = new THREE.InstancedMesh(trunkGeo, materials.treeBark, count - pineCount);
  const pineTrunks = new THREE.InstancedMesh(trunkGeo, materials.treeBark, pineCount);
  let pineTrunkIndex = 0;
  const instLower = new THREE.InstancedMesh(lowerCanopyGeo, materials.foliageCanopy, count);
  const instUpper = new THREE.InstancedMesh(upperCanopyGeo, materials.foliageCanopy, count);
  instLower.castShadow = true;
  instLower.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const t = treePoints[i];
    dummy.position.set(t.x, t.y + 0.9 * t.s, t.z);
    dummy.rotation.set(0, i * 1.1, 0);
    dummy.scale.setScalar(t.s);
    dummy.updateMatrix();
    if (t.biomeType === 'pine') pineTrunks.setMatrixAt(pineTrunkIndex++, dummy.matrix);
    else instTrunks.setMatrixAt(broadleafIndex, dummy.matrix);

    if(t.biomeType==='pine'){
      for(let tier=0;tier<3;tier++){
        const radius=(1.42-0.34*tier)*t.s;
        dummy.position.set(t.x,t.y+(1.75+tier*0.87)*t.s,t.z);
        dummy.rotation.set(0.025*Math.sin(i),i*1.17+tier*0.37,0);
        dummy.scale.set(radius,(1.32-tier*0.09)*t.s,radius);dummy.updateMatrix();
        needles.setMatrixAt(pineIndex,dummy.matrix);
        needles.setColorAt(pineIndex++,tint.setHSL(0.38,0.28,0.32+tier*0.06));
      }
      continue;
    }
    dummy.position.set(t.x, t.y + 2.35 * t.s, t.z);
    dummy.rotation.set(0.08 * (i % 3), i * 1.7, 0.06);
    dummy.scale.set(t.s * 1.05, t.s * 0.95, t.s * 1.05);
    dummy.updateMatrix();
    instLower.setMatrixAt(broadleafIndex, dummy.matrix);

    dummy.position.set(t.x + 0.35 * t.s, t.y + 3.45 * t.s, t.z - 0.25 * t.s);
    dummy.rotation.set(-0.08, i * 2.3, 0.1);
    dummy.scale.setScalar(t.s * 0.92);
    dummy.updateMatrix();
    instUpper.setMatrixAt(broadleafIndex, dummy.matrix);

    if (t.biomeType === 'jade') {
      tint.setHSL(0.42 + ((i % 7) - 3) * 0.012, 0.48, 0.46 + (i % 4) * 0.04);

    } else {
      tint.setHSL(0.28 + ((i % 9) - 4) * 0.014, 0.46, 0.54 + (i % 4) * 0.04);
    }
    instLower.setColorAt(broadleafIndex, tint);
    tint.offsetHSL(0.01, 0.05, 0.06);
    instUpper.setColorAt(broadleafIndex++, tint);
  }

  instLower.count=instUpper.count=broadleafIndex;
  forestGroup.add(needles);
  instTrunks.instanceMatrix.needsUpdate = true;
  instLower.instanceMatrix.needsUpdate = true;
  instUpper.instanceMatrix.needsUpdate = true;
  if (instLower.instanceColor) instLower.instanceColor.needsUpdate = true;
  if (instUpper.instanceColor) instUpper.instanceColor.needsUpdate = true;
  instTrunks.computeBoundingSphere();
  instLower.computeBoundingSphere();
  instUpper.computeBoundingSphere();
  const leafTrees = shoreTrees(treePoints.filter(tree => tree.biomeType !== 'pine'));
  forestGroup.add(pineTrunks, instTrunks, instLower, instUpper, leafTrees.mesh);

  // --- 2. SOLARIA DESERT OASIS & ARCHIPELAGO PALM TREES ---
  const palmPoints: Array<{ x: number; y: number; z: number; s: number; rot: number }> = [];
  // Ring of lush palms hugging Oaza Al-Kharim (-64, 118) + Złota Zatoka (14, 76)
  for (let i = 0; i < 42; i++) {
    const a = (i / 42) * Math.PI * 2;
    const rad = 12.2 + (i % 4) * 3.1;
    const px = -64 + Math.cos(a) * rad;
    const pz = 118 + Math.sin(a) * rad;
    const py = getTerrainHeight(px, pz);
    if (py > 0.8) palmPoints.push({ x: px, y: py, z: pz, s: 0.9 + (i % 4) * 0.16, rot: a });
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rad = 11.5 + (i % 3) * 3.0;
    const px = 14 + Math.cos(a) * rad;
    const pz = 76 + Math.sin(a) * rad;
    const py = getTerrainHeight(px, pz);
    if (py > 0.7) palmPoints.push({ x: px, y: py, z: pz, s: 0.85 + (i % 3) * 0.15, rot: a * 1.4 });
  }

  if (palmPoints.length > 0) {
    const palmTrunkGeo = new THREE.CylinderGeometry(0.12, 0.28, 4.4, 6);
    const palmCrownGeo = palmFronds();
    materials.palmFrondMat.side = THREE.DoubleSide;
    const instPalmTrunks = new THREE.InstancedMesh(palmTrunkGeo, materials.treeBark, palmPoints.length);
    const instPalmCrowns = new THREE.InstancedMesh(palmCrownGeo, materials.palmFrondMat, palmPoints.length);

    for (let i = 0; i < palmPoints.length; i++) {
      const p = palmPoints[i];
      dummy.position.set(p.x, p.y + 1.9 * p.s, p.z);
      dummy.rotation.set(0.14, p.rot, 0.08);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      instPalmTrunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x + Math.sin(p.rot) * 0.45 * p.s, p.y + 4.1 * p.s, p.z + Math.cos(p.rot) * 0.45 * p.s);
      dummy.rotation.set(0.05, p.rot, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      instPalmCrowns.setMatrixAt(i, dummy.matrix);
    }
    instPalmTrunks.instanceMatrix.needsUpdate = true;
    instPalmCrowns.instanceMatrix.needsUpdate = true;
    instPalmTrunks.computeBoundingSphere();
    instPalmCrowns.computeBoundingSphere();
    forestGroup.add(instPalmTrunks, instPalmCrowns);
  }

  // --- 3. FROSTHEIM FLOATING CRYSTALLINE ICEBERGS ---
  const icebergGeo = createClumpGeo(2.8, 13.7);
  const icebergCount = 34;
  const instIcebergs = new THREE.InstancedMesh(icebergGeo, materials.glacialIceMat, icebergCount);
  let icePlaced = 0;
  for (let i = 0; i < 320 && icePlaced < icebergCount; i++) {
    const rx = ((Math.sin(i * 51.3) * 43758.5453) % 1 + 1) % 1;
    const rz = ((Math.sin(i * 17.9 + 2.2) * 19843.21) % 1 + 1) % 1;
    const x = -185 + rx * 145;
    const z = -185 + rz * 135;
    const y = getTerrainHeight(x, z);
    // Only float in deep arctic sea channels around Frostheim!
    if (y > -1.2) continue;

    const s = 0.75 + (i % 5) * 0.34;
    dummy.position.set(x, -0.35 * s, z);
    dummy.rotation.set((i % 3) * 0.15, i * 1.4, (i % 2) * 0.12);
    dummy.scale.set(s * 1.35, s * 0.78, s * 1.1);
    dummy.updateMatrix();
    instIcebergs.setMatrixAt(icePlaced, dummy.matrix);
    icePlaced++;
  }
  instIcebergs.count = icePlaced;
  instIcebergs.instanceMatrix.needsUpdate = true;
  instIcebergs.computeBoundingSphere();
  forestGroup.add(instIcebergs);

  // --- 4. SCULPTED CRAGGY BOULDERS & COASTAL ROCKS ---
  const boulderGeo = createClumpGeo(1.4, 9.2);
  const boulderCount = 140;
  const instBoulders = new THREE.InstancedMesh(boulderGeo, materials.alpineBoulder, boulderCount);
  let placed = 0;
  for (let i = 0; i < 1200 && placed < boulderCount; i++) {
    const rx = ((Math.sin(i * 39.17) * 43758.5453) % 1 + 1) % 1;
    const rz = ((Math.sin(i * 91.43) * 19283.412) % 1 + 1) % 1;
    const x = -205 + rx * 415;
    const z = -185 + rz * 355;
    const y = getTerrainHeight(x, z);
    if (y < 0.08 || y > 11.2) continue;

    const slope = Math.hypot(getTerrainHeight(x + 1.8, z) - y, getTerrainHeight(x, z + 1.8) - y);
    if (slope > 1.05) continue;

    const nearCap = CITIES.some((c) => Math.hypot(c.position3D[0] - x, c.position3D[2] - z) < 14.0);
    if (nearCap) continue;

    const s = 0.65 + (i % 5) * 0.3;
    dummy.position.set(x, y - 0.44 * s, z);
    dummy.rotation.set(i * 0.5, i * 1.3, i * 0.3);
    dummy.scale.set(s * 1.25, s * 0.65, s);
    dummy.updateMatrix();
    instBoulders.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  instBoulders.count = placed;
  instBoulders.instanceMatrix.needsUpdate = true;
  instBoulders.computeBoundingSphere();
  forestGroup.add(instBoulders);

  const releaseRocks = scannedRocks(forestGroup, instBoulders);
  return {
    forestGroup,
    update(height: number, time: number, wind:number, autumn:number, snow:number) {
      const detailed=groves.update(height,time,wind,autumn,snow);
      const replaced=detailed ? nearTrees.length : 0;
      const close=leafTrees.update(height,time,replaced);
      instTrunks.count=instLower.count=instUpper.count=broadleafIndex-replaced;
      instTrunks.visible = instLower.visible = instUpper.visible = !close;
    },
    dispose() { groves.dispose(); leafTrees.dispose(); releaseRocks(); },
  };
}

/**
 * Builds ALL 12 Explorable World Landmarks & Fear Places across the 4 Continents!
 */
export function buildWorldLandmarks(materials: SharedWorldMaterials): {
  group: THREE.Group;
  clickableProxies: THREE.Object3D[];
  lighthouseBeam: THREE.Object3D | null;
  arcaneCrystal: THREE.Object3D | null;
} {
  const group = new THREE.Group();
  const clickableProxies: THREE.Object3D[] = [];
  let lighthouseBeam: THREE.Object3D | null = null;
  let arcaneCrystal: THREE.Object3D | null = null;

  const landmarks = WORLD_REGIONS.filter((r) => r.type !== 'capital');

  for (const lm of landmarks) {
    const lmGroup = new THREE.Group();
    const [lx, lz] = lm.position2D;
    const ly = Math.max(0.05, getTerrainHeight(lx, lz));

    if (lm.type === 'workshop') {
      const craft = worksites.find(s=>s.id===lm.id)!.craft;
      function block(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material) {
        const part=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
        part.position.set(x,y,z);lmGroup.add(part);return part;
      }
      block(0,.15,0,9,2.2,6,materials.castleStone);
      for(const x of [-3.8,3.8]) for(const z of [-2.2,2.2])
        block(x,3.1,z,.24,4,.24,materials.timberWood);
      for(const side of [-1,1]) block(0,5.4,side*1.46,9.4,.16,3.25,materials.slateRoof).rotation.x=side*.35;
      if(craft==='szkutnik') {
        const yard=merchantCraft(materials);yard.quay(-5,1.2,2);yard.finish(lmGroup);
      }else if(craft==='warzelnik'){
        for(const x of [-2.1,2.1]){
          block(x,1.65,.1,3.3,.7,3.5,materials.darkBasaltStone);
          block(x,2.01,.1,3.07,.05,3.26,materials.oasisWaterMat);
        }
      }else{
        block(0,1.9,1,5.8,.38,1.7,materials.timberWood);
        for(let i=0;i<8;i++){
          const amber=new THREE.Mesh(new THREE.IcosahedronGeometry(.22+(i%3)*.06),materials.gildedBrass);
          amber.position.set(-2.3+i*.65,2.28,1+Math.sin(i)*.31);lmGroup.add(amber);
        }
      }
    } else if (lm.id === 'twierdza_rebeliantow') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.6, 6), materials.timberWood);
        log.position.set(Math.cos(a) * 3.6, 1.2, Math.sin(a) * 3.6);
        lmGroup.add(log);
      }
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.4, 2.0), materials.timberWood);
      tower.position.set(0, 2.2, -1.2);
      lmGroup.add(tower);
      const fire = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: 0xff6a00 }));
      fire.position.set(0.5, 0.55, 1.2);
      lmGroup.add(fire);
    } else if (lm.id === 'puszcza_arachny') {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const deadTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.55, 5.2, 6), materials.treeBark);
        deadTrunk.position.set(Math.cos(a) * 3.2, 2.3, Math.sin(a) * 3.2);
        deadTrunk.rotation.z = 0.25 * (i % 2 === 0 ? 1 : -1);
        lmGroup.add(deadTrunk);
      }
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.15, 1),
        new THREE.MeshStandardMaterial({
          color: 0xa855f7,
          emissive: 0x7e22ce,
          emissiveIntensity: 1.8,
          roughness: 0.2,
        }),
      );
      orb.position.y = 2.2;
      lmGroup.add(orb);
    } else if (lm.id === 'sztolnia_mithrilu') {
      // The abandoned adit opens downhill. Its supports extend below both
      // sides of the entrance so the outer jamb cannot hang off the ridge.
      const slopeX=getTerrainHeight(lx-2,lz)-getTerrainHeight(lx+2,lz);
      const slopeZ=getTerrainHeight(lx,lz-2)-getTerrainHeight(lx,lz+2);
      const portal=new THREE.Group();
      portal.rotation.y=Math.atan2(slopeX,slopeZ);
      lmGroup.add(portal);
      const r=1.14, spring=.76, depth=1.35;
      const opening=new THREE.Shape();
      opening.moveTo(-r,-1.4);opening.lineTo(-r,spring);
      opening.absarc(0,spring,r,Math.PI,0,true);opening.lineTo(r,-1.4);opening.closePath();
      const throat=new THREE.Mesh(new THREE.ShapeGeometry(opening),new THREE.MeshStandardMaterial({color:0x171717,roughness:1}));
      throat.position.z=.01;portal.add(throat);
      for(let i=0;i<9;i++){
        const a=i*Math.PI/9+.015,b=(i+1)*Math.PI/9-.015;
        const rib=new THREE.Shape();
        rib.absarc(0,0,r+.40+(i===4?.11:0),a,b,false);
        rib.absarc(0,0,r,b,a,true);rib.closePath();
        const stone=new THREE.Mesh(new THREE.ExtrudeGeometry(rib,{depth,bevelEnabled:false,curveSegments:3}),materials.darkBasaltStone);
        stone.position.set(0,spring,-.91);stone.castShadow=stone.receiveShadow=true;portal.add(stone);
      }
      for(const side of [-1,1]) {
        const support=new THREE.Mesh(new THREE.BoxGeometry(.42,3.35,depth),materials.timberWood);
        support.position.set(side*(r+.19),spring-1.67,-.23);
        portal.add(support);
        const ore=new THREE.Mesh(new THREE.OctahedronGeometry(.24,0),materials.frostBeaconGlow);
        ore.position.set(side*1.52,.20,.43);ore.scale.y=1.4;portal.add(ore);
      }
    } else if (lm.id === 'wrak_valthora') {
      const ghostShip = buildGalleonMesh(materials, 1.45);
      ghostShip.rotation.z = 0.34;
      ghostShip.rotation.x = -0.18;
      ghostShip.position.y = -0.4;
      lmGroup.add(ghostShip);
      const ghostBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.68, 12, 12), materials.frostBeaconGlow);
      ghostBeacon.position.set(0, 4.2, 0);
      lmGroup.add(ghostBeacon);
    } else if (lm.id === 'iglica_ignisa') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6.2 + (i % 3) * 1.5, 5), materials.darkBasaltStone);
        spire.position.set(Math.cos(a) * 5.2, 1.2, Math.sin(a) * 5.2);
        spire.rotation.z = Math.cos(a) * 0.25;
        lmGroup.add(spire);
      }
    } else if (lm.id === 'krolewska_stocznia') {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 9.6, 10), materials.castleStone);
      base.position.y = 4.8;
      base.castShadow = true;
      lmGroup.add(base);
      const lanternRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.8, 8), materials.warmWindowGlow);
      lanternRoom.position.y = 10.4;
      lmGroup.add(lanternRoom);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.8, 8), materials.warmTerracottaRoof);
      cap.position.y = 12.1;
      lmGroup.add(cap);

      const beamPivot = new THREE.Group();
      beamPivot.position.y = 10.4;
      const beamCone = new THREE.Mesh(
        new THREE.ConeGeometry(3.6, 22, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffe599,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beamCone.rotation.z = Math.PI / 2;
      beamCone.position.x = 11.0;
      beamPivot.add(beamCone);
      lmGroup.add(beamPivot);
      lighthouseBeam = beamPivot;

      const ship = buildGalleonMesh(materials, 1.15);
      ship.position.set(-6.2, -ly + 0.1, 4.8);
      ship.rotation.y = 0.8;
      lmGroup.add(ship);
    } else if (lm.id === 'krag_arcymaga') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const monolith = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.2 + (i % 2) * 1.0, 0.7), materials.castleStone);
        monolith.position.set(Math.cos(a) * 4.5, 2.0, Math.sin(a) * 4.5);
        monolith.rotation.y = -a;
        lmGroup.add(monolith);
      }
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.35, 0),
        new THREE.MeshStandardMaterial({
          color: 0x818cf8,
          emissive: 0x4f46e5,
          emissiveIntensity: 2.0,
          roughness: 0.12,
          metalness: 0.4,
        }),
      );
      crystal.position.y = 4.6;
      lmGroup.add(crystal);
      arcaneCrystal = crystal;
    } else if (lm.id === 'piramidy_slonca') {
      // Monumental Stepped Golden Sandstone Pyramids of Solaria!
      for (let tier = 0; tier < 4; tier++) {
        const w = 9.2 - tier * 2.0;
        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 1.75, w), materials.sandstoneBrick);
        step.position.y = 0.85 + tier * 1.68;
        step.castShadow = true;
        lmGroup.add(step);
      }
      const apex = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.1, 4), materials.gildedBrass);
      apex.position.y = 8.4;
      apex.rotation.y = Math.PI / 4;
      lmGroup.add(apex);

      const smallPyr = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4.6, 4), materials.sandstoneBrick);
      smallPyr.position.set(7.2, 2.2, 4.2);
      smallPyr.rotation.y = Math.PI / 4;
      lmGroup.add(smallPyr);
    } else if (lm.id === 'cytadela_lodu') {
      // Towering Glacial Crystalline Spire Fortress of Frostheim
      const core = new THREE.Mesh(new THREE.ConeGeometry(4.4, 12.5, 6), materials.glacialIceMat);
      core.position.y = 6.0;
      core.castShadow = true;
      lmGroup.add(core);

      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const shard = new THREE.Mesh(new THREE.ConeGeometry(1.8, 7.6, 5), materials.glacialIceMat);
        shard.position.set(Math.cos(a) * 4.4, 3.6, Math.sin(a) * 4.4);
        shard.rotation.z = Math.cos(a) * 0.18;
        lmGroup.add(shard);
      }
      const crown = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), materials.frostBeaconGlow);
      crown.position.y = 13.6;
      lmGroup.add(crown);
    } else if (lm.id === 'ciesnina_lodowa') {
      // Arctic Stone Whaler Beacon & Pier
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 7.2, 8), materials.darkBasaltStone);
      beacon.position.y = 3.6;
      lmGroup.add(beacon);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(1.0, 10, 10), materials.frostBeaconGlow);
      glow.position.y = 7.8;
      lmGroup.add(glow);
      const longship = buildGalleonMesh(materials, 0.95);
      longship.position.set(5.6, -ly + 0.1, 3.2);
      lmGroup.add(longship);
    } else if (lm.id === 'swiatynia_smokow') {
      // Cliffside 5-Tiered Temple of a Thousand Dragons Pagoda!
      const temple = buildImperialPagoda(5, 4.8, materials);
      lmGroup.add(temple);
    } else if (lm.id === 'czarna_zatoka') {
      // Corsair Cove Sea Fortress + Moored Pirate Galleon
      const fort = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.8, 5.2), materials.darkBasaltStone);
      fort.position.y = 1.9;
      lmGroup.add(fort);
      const watch = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 6.8, 8), materials.darkBasaltStone);
      watch.position.set(2.4, 3.4, -2.0);
      lmGroup.add(watch);
      const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), materials.warmWindowGlow);
      brazier.position.set(2.4, 7.3, -2.0);
      lmGroup.add(brazier);
      const corsairShip = buildGalleonMesh(materials, 1.25);
      corsairShip.position.set(-7.5, -ly + 0.1, 5.5);
      corsairShip.rotation.y = -0.6;
      lmGroup.add(corsairShip);
    } else if (lm.id === 'gniazdo_wywern') {
      // Valoria Emerald Wyvern Roost & Ancient Druidic Stone Arch
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 1.05, 5.8 + (i % 2) * 1.4, 7), materials.castleStone);
        pillar.position.set(Math.cos(a) * 4.8, 2.8, Math.sin(a) * 4.8);
        lmGroup.add(pillar);
      }
      const nestCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), materials.emeraldRoof);
      nestCrystal.position.y = 4.6;
      lmGroup.add(nestCrystal);
    } else if (lm.id === 'otchlan_magmy') {
      // Obsidian Archipelago Giant Basalt Spires & Magma Core
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7.4 + (i % 3) * 1.8, 5), materials.darkBasaltStone);
        spire.position.set(Math.cos(a) * 5.6, 2.2, Math.sin(a) * 5.6);
        spire.rotation.z = Math.cos(a) * 0.22;
        lmGroup.add(spire);
      }
      const magmaCore = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.9, 0),
        new THREE.MeshStandardMaterial({
          color: 0xff6b00,
          emissive: 0xff4500,
          emissiveIntensity: 2.6,
          roughness: 0.25,
        }),
      );
      magmaCore.position.y = 3.2;
      lmGroup.add(magmaCore);
    }

    const hitProxy = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 6.5, 11, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitProxy.position.y = 4.8;
    hitProxy.layers.enable(1);
    hitProxy.userData = { regionId: lm.id, name: lm.name };
    lmGroup.add(hitProxy);
    clickableProxies.push(hitProxy);

    lmGroup.position.set(lx, ly, lz);
    group.add(lmGroup);
  }

  return { group, clickableProxies, lighthouseBeam, arcaneCrystal };
}

/**
 * Builds a detailed 12-part Articulated Dragon supporting all 4 Elemental Species
 * ('crimson' Fire, 'frost' Ice, 'emerald' Aether/Valoria, 'gold' Sovereign Hoard)!
 */
export function buildArticulatedDragon(
  materials: SharedWorldMaterials,
  variant: 'crimson' | 'frost' | 'emerald' | 'gold' | 'copper' | 'sapphire' | 'umber' | 'twin' | 'ochreTwin' | 'redTwin' | 'deltaSail' | 'ochreCrown' | 'reedFrill' | 'flintShield' | 'ramHorn' | 'silkMoth' = 'crimson',
): THREE.Group {
  const dragon = new THREE.Group();

  const palette = {
    ramHorn:{body:0xc9b99c,wing:0xcdb988,emissive:0x302417,roughness:.83,metalness:.04},
    silkMoth:{body:0x393655,wing:0x544781,emissive:0x382447,roughness:.63,metalness:.16},
    reedFrill:{body:0x66794c,wing:0x445c3d,emissive:0x273b20,roughness:.62,metalness:.13},
    flintShield:{body:0x564e46,wing:0x825c47,emissive:0x463328,roughness:.82,metalness:.18},
    deltaSail:{body:0x326789,wing:0x32577d,emissive:0x5386b2,roughness:.49,metalness:.21},
    ochreCrown:{body:0x9e7336,wing:0x604526,emissive:0x8d5e2c,roughness:.65,metalness:.35},
    ochreTwin: {body:0x6e5947,wing:0x604837,emissive:0x392719,roughness:.94,metalness:.08},
    redTwin: {body:0x9a483a,wing:0x772f25,emissive:0x782d18,roughness:.54,metalness:.32},
    umber: {body:0x593922,wing:0x4d322a,emissive:0x48291b,roughness:.88,metalness:.08},
    twin: {body:0x46613b,wing:0x30472a,emissive:0x283524,roughness:.67,metalness:.18},
    copper: { body: 0x765035, wing: 0x955939, emissive: 0x763817, roughness: 0.77, metalness: 0.14 },
    sapphire: { body: 0x194767, wing: 0x284357, emissive: 0x31608b, roughness: 0.32, metalness: 0.45 },
    crimson: { body: 0x7f1d1d, wing: 0x450a0a, emissive: 0x9a3412, roughness: 0.42, metalness: 0.48 },
    frost: { body: 0x1e40af, wing: 0x0f172a, emissive: 0x0ea5e9, roughness: 0.28, metalness: 0.52 },
    emerald: { body: 0x065f46, wing: 0x022c22, emissive: 0x10b981, roughness: 0.34, metalness: 0.50 },
    gold: { body: 0xd97706, wing: 0x78350f, emissive: 0xfbbf24, roughness: 0.22, metalness: 0.88 },
  }[variant];

  const scaleMat = new THREE.MeshStandardMaterial({
    color: palette.body,
    bumpMap: materials.alpineBoulder.bumpMap,
    bumpScale: 0.14,
    roughness: palette.roughness,
    metalness: palette.metalness * .23,
  });
  const wingMembrane = new THREE.MeshStandardMaterial({
    color: palette.wing,
    emissive: palette.emissive,
    emissiveIntensity: 0.045,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });

  function detailSurface(material:THREE.MeshStandardMaterial, membrane:boolean) {
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 hidePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n hidePosition=position;');
      const pattern=membrane ? `
        vec2 ray=hidePosition.xz-vec2(2.42,1.56);
        float angle=atan(ray.x,ray.y);
        float vein=abs(sin(angle*28.+.37*sin(length(ray)*7.+angle*3.)));
        float fine=clamp(1.-fwidth(angle)*44.,0.,1.);
        float rib=(1.-smoothstep(.02,.17,vein))*fine;
        float folds=.5+.5*sin(8.*angle+length(ray)*1.4);
        diffuseColor.rgb*=mix(vec3(.60,.54,.55),vec3(1.24,1.10,1.03),folds)*(1.-.37*rib);
      ` : `
        vec2 tile=vec2(hidePosition.z*6.3,(hidePosition.y+hidePosition.x*.71)*9.);
        tile.x+=.5*mod(floor(tile.y),2.);
        vec2 cell=fract(tile)-.5;
        float ridge=1.-smoothstep(.025,.15,abs(length(cell*vec2(1.,1.35))-.48));
        float fade=clamp(1.-length(fwidth(tile)),0.,1.);
        float speck=fract(sin(dot(floor(tile),vec2(12.35,78.17)))*4375.);
        diffuseColor.rgb*=1.+fade*(.24*(speck-.5)-.32*ridge);
      `;
      shader.fragmentShader='varying vec3 hidePosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n'+pattern);
    };
    material.customProgramCacheKey=()=>membrane?'dragon-wing-veins':'dragon-scales';
  }
  detailSurface(scaleMat,false);
  detailSurface(wingMembrane,true);

  // A continuous tapered spine gives the chest, hips, tail and neck a single silhouette.
  type Station = [number, number, number, number, number]; // z, x/y centre, half width/height
  const stations: Station[] = [
    [-7.1,.90,.46,.014,.018],[-6.3,.86,.20,.10,.09],[-5.45,.63,-.14,.17,.14],
    [-4.5,.33,-.30,.25,.22],[-3.3,.10,-.15,.40,.35],[-2.3,0,.03,.54,.51],
    [-1.45,0,.13,.63,.59],[-.35,0,.08,.81,.90],[.60,0,.12,.73,.82],
    [1.35,0,.29,.48,.60],[2.04,0,.66,.32,.45],[2.76,0,.94,.27,.32],
    [3.02,0,1.06,.42,.38],[3.43,0,1.08,.47,.31],[3.79,0,.99,.32,.18],
    [4.30,0,1.02,.20,.13],[4.39,0,1.05,.035,.035],
  ];
  const body: number[]=[], indices: number[]=[];
  const sides=14;
  const twoHeads=variant==='twin'||variant==='redTwin'||variant==='ochreTwin';
  const sections: Station[][] = twoHeads ? [
    stations.slice(0,10),
    ...[-1,1].map(side=>stations.slice(9).map(([z,x,y,w,h]):Station=>
      [z,x+side*(z-1.35)*.48,y+side*(z-1.35)*.08,w,h])),
  ] : [stations];
  for (const section of sections) {
    const start=body.length/3;
    section.forEach(([z,x,y,w,h],row)=>{
    for(let i=0;i<sides;i++){
      const a=i*2*Math.PI/sides;
      body.push(x+Math.cos(a)*w,y+Math.sin(a)*h,z);
      if(row) {
        const p=start+(row-1)*sides+i, q=start+(row-1)*sides+(i+1)%sides;
        indices.push(p,q,q+sides,p,q+sides,p+sides);
      }
    }
    });
  }
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position',new THREE.Float32BufferAttribute(body,3));
  skin.setIndex(indices);skin.computeVertexNormals();
  dragon.add(new THREE.Mesh(skin,scaleMat));
  function spur(parent: THREE.Group,from: number[],to: number[],radius: number,tip: number,finish=scaleMat) {
    const a=new THREE.Vector3(...from), b=new THREE.Vector3(...to);
    const d=b.clone().sub(a);
    const part=new THREE.Mesh(new THREE.CylinderGeometry(tip,radius,d.length(),6),finish);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    part.position.copy(a).lerp(b,.5); parent.add(part);
  }
  for(const side of [-1,1]){
    for(const neck of (twoHeads?[-1,1]:[0])) {
      const dx=neck*.87,dy=neck*.14;
      const eye=new THREE.Mesh(new THREE.SphereGeometry(.096,12,8),materials.gildedBrass);
      eye.scale.set(.54,.8,1);eye.position.set(dx+.43*side,1.19+dy,3.45);dragon.add(eye);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(.059,8,6),materials.darkBasaltStone);
      pupil.scale.set(.45,1,.31);pupil.position.copy(eye.position);pupil.position.x+=side*.043;dragon.add(pupil);
      spur(dragon,[dx+.27*side,dy+1.28,3.17],[dx+.61*side,dy+1.78,2.4],.14,.013);
    }
    spur(dragon,[.54*side,-.04,-1.18],[.85*side,-.66,-1.78],.27,.17);
    spur(dragon,[.85*side,-.66,-1.78],[.70*side,-.77,-2.47],.17,.08);
    for(let toe=-1;toe<=1;toe++) spur(dragon,[.7*side,-.77,-2.47],[(.71+toe*.12)*side,-.97,-2.77],.047,.008);
  }
  for(const [z,x,y,w,h] of stations.slice(2,twoHeads?10:13)){
    spur(dragon,[x,y+h*.86,z],[x,y+h+.09+w*.44,z-.24-w*.19],.045+w*.11,.008);
  }
  for(const side of [-1,1]) {
    if(variant==='ramHorn') {
      const horn=new THREE.Mesh(new THREE.TorusGeometry(.46,.12,8,22,Math.PI*1.76),materials.gildedBrass);
      horn.rotation.y=side*Math.PI/2;horn.position.set(side*.44,1.53,3.02);dragon.add(horn);
    }
    if(variant==='silkMoth') {
      spur(dragon,[side*.22,1.3,3.2],[side*1.13,2.48,3.66],.07,.015,materials.timberWood);
      for(let j=1;j<=6;j++) {
        const k=j/7,x=side*(.22+.91*k),y=1.3+1.18*k,z=3.2+.46*k;
        spur(dragon,[x,y,z],[x+side*.39,y+.23,z-.24],.045,.006,materials.timberWood);
      }
    }
  }
  if(variant==='reedFrill'){
    for(const side of [-1,1]) for(let i=0;i<5;i++){
      const z=1.6+i*.27;
      spur(dragon,[side*.26,1.23,z],[side*(1.45-i*.12),1.68+i*.13,z-.85],.13,.006);
    }
  }
  if(variant==='flintShield'){
    for(const side of [-1,1]) for(let i=0;i<6;i++){
      const plate=new THREE.Mesh(new THREE.DodecahedronGeometry(1),scaleMat);
      plate.scale.set(.47,.31,.72);plate.position.set(side*.54,.87,2.1-i*.67);dragon.add(plate);
    }
  }
  if (variant==='deltaSail') {
    const fin=new THREE.BufferGeometry();
    fin.setAttribute('position',new THREE.Float32BufferAttribute([-0.01,.7,-3, 0,2.65,-1.4, 0,1.05,.55, 0,1.85,.8, 0,.75,1.6],3));
    fin.setIndex([0,1,2,2,3,4]);fin.computeVertexNormals();dragon.add(new THREE.Mesh(fin,wingMembrane));
  }
  if (variant==='ochreCrown') {
    for(let i=-2;i<=2;i++){
      const plate=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),scaleMat);
      plate.scale.set(.39,.79,.12);plate.position.set(i*.28,1.55-.07*Math.abs(i),2.87);
      plate.rotation.z=-i*.39;plate.rotation.x=-.38;dragon.add(plate);
    }
  }
  const wing=new THREE.Group();
  const wrist=new THREE.Vector3(2.42,.98,1.56);
  const tips=[[6.35,-.23,-.60],[5.29,-.57,-1.83],[3.91,-.61,-2.58],[2.34,-.43,-2.97],[.40,-.21,-2.12],[0,.05,0]];
  const membrane:number[]=[], triangles:number[]=[];
  for(let finger=0;finger<tips.length-1;finger++){
    const a=new THREE.Vector3(...tips[finger]), b=new THREE.Vector3(...tips[finger+1]);
    const offset=membrane.length/3, divisions=7;
    for(let j=0;j<=divisions;j++) {
      const t=j/divisions, scallop=Math.sin(t*Math.PI);
      const edge=a.clone().lerp(b,t);
      edge.z+=scallop*(finger===0?.18:.48);
      for(let k=0;k<=4;k++) {
        const r=k/4, p=wrist.clone().lerp(edge,r);
        p.y+=.24*scallop*Math.sin(r*Math.PI);
        membrane.push(p.x,p.y,p.z);
        if(j && k){const i=offset+j*5+k;triangles.push(i-6,i-1,i,i-6,i,i-5);}
      }
    }
  }
  const wingGeo=new THREE.BufferGeometry();
  wingGeo.setAttribute('position',new THREE.Float32BufferAttribute(membrane,3));
  wingGeo.setIndex(triangles);wingGeo.computeVertexNormals();
  wing.add(new THREE.Mesh(wingGeo,wingMembrane));
  spur(wing,[0,0,0],wrist.toArray(),.21,.13);
  tips.slice(0,5).forEach((point,i)=>spur(wing,wrist.toArray(),point,.092-i*.009,.012));
  spur(wing,wrist.toArray(),[2.74,1.16,1.95],.085,.015);
  wing.name='right_wing';wing.position.set(.52,.27,.42);
  const leftWing=wing.clone();leftWing.name='left_wing';leftWing.scale.x=-1;leftWing.position.x=-.52;
  dragon.add(wing,leftWing);

  dragon.scale.setScalar(1.4);
  return dragon;
}

export function buildDetailedCaravanWagon(materials: SharedWorldMaterials): THREE.Group {
  const wagon = new THREE.Group();

  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.48, 2.55), materials.timberWood);
  bed.position.y = 0.62;
  wagon.add(bed);

  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.78, 2.35, 10, 1, false, 0, Math.PI),
    materials.sailCloth,
  );
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.y = 0.85;
  wagon.add(canopy);

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelCoords: Array<[number, number, number]> = [
    [-0.82, 0.42, -0.82],
    [0.82, 0.42, -0.82],
    [-0.82, 0.42, 0.82],
    [0.82, 0.42, 0.82],
  ];
  for (const [wx, wy, wz] of wheelCoords) {
    const w = new THREE.Mesh(wheelGeo, materials.timberWood);
    w.position.set(wx, wy, wz);
    wagon.add(w);
  }

  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), materials.warmWindowGlow);
  lantern.position.set(0, 1.72, 1.15);
  wagon.add(lantern);

  return wagon;
}
