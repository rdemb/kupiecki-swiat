import * as THREE from 'three';
import { CITIES } from '../economy/economyEngine';
import { getTerrainHeight } from '../economy/worldMapData';
import type { SharedWorldMaterials } from './architectureAndProps';
import type { Town } from '../components/ProvinceHall';

// One shared set of geometries for every building site in the realm.
export function charteredTowns(scene: THREE.Scene, m: SharedWorldMaterials) {
  const root = new THREE.Group();
  scene.add(root);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const roof = new THREE.ConeGeometry(1, 1, 4);
  roof.rotateY(Math.PI / 4);
  const round = new THREE.CylinderGeometry(1, 1.12, 1, 8);
  let signature = '';
  function update(towns: Town[]) {
    const approved = towns.filter((t) => t.approved);
    const key = approved.map((t) => [t.id, t.site, t.wood, t.iron, t.capital].join('/')).join('|');
    if (key === signature) return;
    signature = key;
    root.clear();
    for (const town of approved) {
      const city = CITIES.find((c) => c.id === town.site);
      if (!city) continue;
      const [cx, , cz] = city.position3D;
      // Survey a ring outside the capital and choose a dry plot with a low gradient.
      let x = cx,
        z = cz,
        best = -Infinity;
      for (let k = 0; k < 12; k++) {
        const px = cx + 13 * Math.cos((k * Math.PI) / 6),
          pz = cz + 13 * Math.sin((k * Math.PI) / 6);
        const h = getTerrainHeight(px, pz);
        const score =
          Math.min(h, 1.5) -
          Math.abs(h - getTerrainHeight(px + 2, pz)) -
          Math.abs(h - getTerrainHeight(px, pz + 2));
        if (score > best) {
          best = score;
          x = px;
          z = pz;
        }
      }
      const group = new THREE.Group();
      group.position.set(x, Math.max(0.2, getTerrainHeight(x, z)), z);
      root.add(group);
      function part(
        geo: THREE.BufferGeometry,
        material: THREE.Material,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
      ) {
        const obj = new THREE.Mesh(geo, material);
        obj.position.set(x, y, z);
        obj.scale.set(w, h, d);
        obj.castShadow = true;
        obj.receiveShadow = true;
        group.add(obj);
      }
      part(box, m.castleStone, 0, -0.55, 0, 7, 1.3, 5);
      for (const offset of [-2, 2]) {
        for (const dz of [-1, 1]) part(box, m.timberWood, offset, 1, dz, 0.15, 2, 0.15);
        part(box, m.timberWood, offset, 2, 0, 0.2, 0.22, 2.3);
      }
      for (let i = 0; i < town.wood; i++) {
        const dx = i * 3 - 1.5;
        part(box, m.plasterWall, dx, 1, 0, 2.4, 2, 2.6);
        part(roof, m.slateRoof, dx, 2.65, 0, 2.05, 1.4, 2.15);
        part(box, m.warmWindowGlow, dx, 1.15, 1.32, 0.45, 0.65, 0.06);
      }
      for (let i = 0; i < town.iron; i++)
        part(round, m.castleStone, i * 5 - 2.5, 1.5, -1.7, 0.85, 3, 0.85);
      if (town.capital === town.id) {
        part(box, m.gildedBrass, 0, 3.2, -1.8, 0.1, 6.4, 0.1);
        part(box, m.crimsonLacquer, 0.8, 5.8, -1.8, 1.6, 0.9, 0.08);
      }
    }
  }
  return {
    update,
    dispose() {
      scene.remove(root);
      root.clear();
      box.dispose();
      roof.dispose();
      round.dispose();
    },
  };
}
