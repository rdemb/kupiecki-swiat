import * as THREE from 'three';
import type { SharedWorldMaterials } from './architectureAndProps';

// Batch small repeated pieces by geometry and finish across a whole town.
const block = new THREE.BoxGeometry(1, 1, 1);
const spindle = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const hoop = new THREE.TorusGeometry(0.5, 0.045, 5, 32);
type Point = [number, number, number];
export function merchantCraft(materials: SharedWorldMaterials) {
  const batches = new Map<THREE.BufferGeometry, Map<THREE.Material, THREE.Matrix4[]>>();
  function piece(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    parent: THREE.Matrix4,
    position: Point,
    scale: Point,
    rotation: Point = [0, 0, 0],
  ) {
    let finishes = batches.get(geometry);
    if (!finishes) {
      finishes = new Map();
      batches.set(geometry, finishes);
    }
    let matrices = finishes.get(material);
    if (!matrices) {
      matrices = [];
      finishes.set(material, matrices);
    }
    const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation));
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      quaternion,
      new THREE.Vector3(...scale),
    );
    matrices.push(matrix.premultiply(parent));
  }
  function beam(parent: THREE.Matrix4, from: Point, to: Point, thickness: number) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const delta = b.clone().sub(a);
    const rotation = new THREE.Euler().setFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()),
    );
    const mid = a.lerp(b, 0.5);
    piece(
      block,
      materials.timberWood,
      parent,
      [mid.x, mid.y, mid.z],
      [thickness, delta.length(), thickness],
      [rotation.x, rotation.y, rotation.z],
    );
  }
  return {
    facade(parent: THREE.Matrix4, w: number, h: number, d: number) {
      const z = d / 2 + 0.04;
      for (const side of [-1, 1]) {
        const edge = side * w * 0.46;
        piece(block,materials.timberWood,parent,[side*w*.21,h*.62,z+.055],[w*.095,h*.31,.055],[0,side*.30,0]);
        piece(block,materials.castleStone,parent,[side*w*.46,.12,0],[w*.13,.24,d+.10]);
        piece(block,materials.timberWood,parent,[side*w*.52,h-.025,0],[.10,.13,d+.35]);
        for(let r=0;r<5;r++)piece(block,materials.timberWood,parent,[side*w*.52,h+.016,(r/4-.5)*d],[.19,.13,.085]);
        piece(block, materials.timberWood, parent, [edge, h / 2, z], [0.095, h, 0.1]);
        beam(parent, [edge, h * 0.59, z], [side * w * 0.19, h * 0.94, z], 0.085);
      }
      piece(block, materials.timberWood, parent, [-w * 0.25, h * 0.24, z], [w * 0.28, h * 0.48, 0.09]);
      piece(
        block,
        materials.castleStone,
        parent,
        [w * 0.29, h * 1.39, -d * 0.17],
        [0.28, h * 0.85, 0.33],
      );
      piece(block, materials.darkBasaltStone, parent, [w * 0.29, h * 1.82, -d * 0.17], [0.35, 0.1, 0.4]);
      piece(block, materials.timberWood, parent, [0, h * 0.62, z + 0.04], [0.035, h * 0.29, 0.04]);
    },
    rampart(parent:THREE.Matrix4,length:number,stone:THREE.Material) {
      for(const side of [-1,1]){
        piece(block,stone,parent,[0,.22,side*.42],[length,.42,.23]);
        piece(block,stone,parent,[0,2.29,side*.42],[length+.08,.13,.21]);
        for(let i=-1;i<=1;i++){
          const x=length*i*.33;
          piece(block,stone,parent,[x,1.16,side*.5],[.39,2.1,.38]);
          piece(block,stone,parent,[x,.40,side*.59],[.56,.78,.44]);
          piece(block,materials.darkBasaltStone,parent,[x+length*.15,1.59,side*.424],[.10,.54,.045]);
        }
      }
    },
    terrace(parent:THREE.Matrix4,w:number,h:number,d:number) {
      for(const sign of [-1,1]){
        piece(block,materials.sandstoneBrick,parent,[0,h/2,sign*d*.49],[w+.12,.32,.16]);
        piece(block,materials.sandstoneBrick,parent,[sign*w*.49,h/2,0],[.16,.32,d]);
      }
      for(let j=-2;j<=2;j++)piece(block,materials.timberWood,parent,[j*w*.18,h*.33,d*.51],[.11,.12,.32]);
      piece(block,materials.timberWood,parent,[0,-h*.23,d*.51],[w*.28,h*.54,.08]);
    },
    quay(x: number, y: number, z: number) {
      const local = new THREE.Matrix4().makeTranslation(x, y, z);
      const wood = materials.timberWood,
        iron = materials.darkBasaltStone;
      // Uneven deck ends, plank seams and a human-powered treadwheel crane.
      for (let i = 0; i < 30; i++)
        piece(block, wood, local, [0, 0, -4.4 + i * 0.3], [2.72 + Math.sin(i * 7.1) * 0.09, 0.1, 0.27]);
      for (let i = 0; i < 23; i++)
        piece(block, wood, local, [-4.22 + i * 0.38, 0.04, 4.0], [0.35, 0.12, 2.12]);
      for (const dx of [-0.54, 0.54]) {
        beam(local, [dx, 0, -0.8], [dx, 2.85, 0.15], 0.19);
        beam(local, [dx, 0, 0.95], [dx, 2.85, 0.15], 0.19);
        piece(hoop, wood, local, [dx, 1.48, 0], [1.68, 1.68, 1.68], [0, Math.PI / 2, 0]);
        for (let i = 0; i < 4; i++)
          piece(block, wood, local, [dx, 1.48, 0], [0.08, 1.68, 0.07], [(i * Math.PI) / 4, 0, 0]);
      }
      for (let i = 0; i < 14; i++) {
        const angle = (i * 2 * Math.PI) / 14;
        piece(
          block,
          wood,
          local,
          [0, 1.48 + 0.82 * Math.cos(angle), 0.82 * Math.sin(angle)],
          [1.12, 0.08, 0.12],
          [angle, 0, 0],
        );
      }
      beam(local, [0, 2.7, 0.1], [-2.4, 3.85, 0.15], 0.21);
      beam(local, [0, 1.45, 0.12], [-1.75, 3.55, 0.15], 0.13);
      piece(spindle, iron, local, [-2.35, 2.97, 0.15], [0.045, 1.7, 0.045]);
      piece(block, wood, local, [-2.35, 1.85, 0.15], [0.9, 0.55, 0.62]);
      for (const dx of [-2.62, -2.08]) piece(block, iron, local, [dx, 1.85, 0.15], [0.06, 0.58, 0.66]);
      for (let i = 0; i < 4; i++) {
        const bx = 2.0 + (i % 2) * 0.66,
          bz = 3.6 + Math.floor(i / 2) * 0.66;
        piece(spindle, wood, local, [bx, 0.48, bz], [0.56, 0.86, 0.56]);
        for (const by of [0.22, 0.73]) piece(spindle, iron, local, [bx, by, bz], [0.58, 0.065, 0.58]);
      }
    },
    finish(group: THREE.Group) {
      for (const [geometry, finishes] of batches)
        for (const [material, matrices] of finishes) {
          const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
          matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
    },
  };
}

// A palm crown with arched, split leaflets. All coastal palms share one mesh.
export function palmFronds() {
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  for (let j = 0; j < 11; j++) {
    const angle = j * 2.39996,
      dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const length = 1.6 + 0.55 * Math.cos(j * 5);
    const spine = (t: number) =>
      dir
        .clone()
        .multiplyScalar(length * t)
        .setY(1.4 * Math.sin(t * Math.PI * 0.92) - 0.65 * t);
    for (let i = 0; i < 11; i++) {
      const t = i / 11,
        a = spine(t),
        b = spine(t + 1 / 11);
      const width = 0.06 + 0.32 * Math.sin(Math.PI * t);
      for (const sign of [-1, 1]) {
        const tip = spine(Math.min(1, t + 0.17)).addScaledVector(side, sign * width);
        tip.y -= width * 0.68;
        if (sign === 1) triangle(a, tip, b);
        else triangle(a, b, tip);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Deterministic, tileable grain: long fibres bend around a knot; the same
// relief drives grazing light on deck planks, cargo crates and framing.
export function harbourTimber() {
  const width = 256,
    height = 128;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y / height) * 2 * Math.PI;
    for (let x = 0; x < width; x++) {
      const u = (x / width) * 2 * Math.PI;
      const knot = Math.exp(-4 * (1 - Math.cos(u)) - 9 * (1 - Math.cos(v)));
      const grain = v * 23 + Math.sin(u + v) * 0.8 + 5 * knot;
      const light =
        0.78 +
        0.11 * Math.sin(grain) +
        0.06 * Math.sin(grain * 3 + Math.sin(u * 2)) +
        0.05 * Math.cos(v * 4) -
        0.16 * knot;
      const at = 4 * (y * width + x);
      pixels[at] = 167 * light;
      pixels[at + 1] = 135 * light;
      pixels[at + 2] = 100 * light;
      pixels[at + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
