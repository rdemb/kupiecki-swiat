import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getTerrainHeight } from '../economy/worldMapData';

type Tree = { x: number; y: number; z: number; s: number };
const materialsPath = () => import.meta.env.BASE_URL + 'materials/';

// Eight silhouettes baked from the same detailed tree. Each tree selects its own view,
// including in the mirrored camera. The atlas stays geometric overhead.
export function shoreTrees(trees: Tree[]) {
  let ready = false;
  const atlas = new THREE.TextureLoader().load(materialsPath() + 'drzewa-zatoki.webp', () => { ready = true; });
  atlas.colorSpace = THREE.SRGBColorSpace;
  const wind = { value: 0 };
  const material = new THREE.MeshLambertMaterial({
    map: atlas, alphaTest: .34, side: THREE.DoubleSide, color: 0xe0dbc0,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uBreeze = wind;
    shader.vertexShader = 'uniform float uBreeze;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      vec3 root = (modelMatrix * instanceMatrix[3]).xyz;
      vec2 toEye = normalize(cameraPosition.xz - root.xz + vec2(.00001));
      float azimuth = atan(toEye.x,toEye.y);
      float heading = floor(fract(sin(root.x*2.+root.z)*43758.5)*8.);
      float tile = mod(floor(azimuth * 1.273239545 + .5) + heading + 16., 8.);
      vMapUv = (uv + vec2(mod(tile,4.), 1.-floor(tile*.25))) / vec2(4.,2.);
    `).replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float sway = sin(uBreeze*1.15 + root.x + position.y*.47) * pow(uv.y,2.) * .045;
      transformed.xz = vec2(toEye.y,-toEye.x) * (position.x+sway);
    `);
  };
  const geo = new THREE.PlaneGeometry(7.68, 4.50, 1, 4);
  geo.translate(0, 2.15, 0);
  const normals = geo.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
  // Plane faces the camera by construction; front-side lighting makes the two directions identical.
  material.side = THREE.FrontSide;
  const mesh = new THREE.InstancedMesh(geo, material, trees.length);
  const transform = new THREE.Object3D();
  trees.forEach((tree, i) => {
    transform.position.set(tree.x, tree.y, tree.z);
    transform.scale.setScalar(tree.s);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  });
  mesh.computeBoundingSphere();
  mesh.visible = false;
  return {
    mesh,
    update(height: number, time: number) {
      wind.value = time;
      mesh.visible = ready && height < 48;
      return mesh.visible;
    },
    dispose() { geo.dispose(); material.dispose(); atlas.dispose(); mesh.dispose(); },
  };
}

function tidalRocks() {
  const poses: THREE.Matrix4[] = [];
  const transform = new THREE.Object3D();
  for (const west of [true, false]) {
    // Follow the actual zero-height contour, including the southern bend of the inlet.
    for (let i = 0; i < 38; i++) {
      const z = 12 + i * .71;
      let a = west ? -45 : 18;
      let b = west ? -11 : 58;
      if (getTerrainHeight(a,z) * getTerrainHeight(b,z) >= 0) continue;
      for (let iteration = 0; iteration < 11; iteration++) {
        const x = (a + b) / 2;
        if ((getTerrainHeight(x,z) > 0) === west) a = x; else b = x;
      }
      const scatter = Math.sin(i*3.71) * 1.7 + Math.cos(i*1.1)*.8;
      const x = (a+b)/2 + scatter;
      const size = .35 + .86 * (.5 + .5*Math.cos(i*1.74));
      transform.position.set(x, getTerrainHeight(x,z) + size*.03, z);
      transform.rotation.set(Math.sin(i*.83)*.20, i*2.39, Math.cos(i*1.73)*.26);
      transform.scale.set(size, size*(.72+.18*Math.sin(i*.94)),size);
      transform.updateMatrix();
      poses.push(transform.matrix.clone());
    }
  }
  return poses;
}

export function scannedRocks(parent: THREE.Group, fallback: THREE.InstancedMesh) {
  let closed = false;
  const release: Array<() => void> = [];
  new GLTFLoader().load(materialsPath() + 'skaly-zatoki.glb', gltf => {
    const models = gltf.scene.children as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[];
    const poses = tidalRocks();
    const matrix = new THREE.Matrix4();
    for (let i=0; i<fallback.count; i++) {
      fallback.getMatrixAt(i,matrix);
      poses.push(matrix.clone());
    }
    const materials = new Set(models.map(model=>model.material));
    for (const material of materials) release.push(() => {
      new Set([material.map,material.normalMap,material.roughnessMap,material.metalnessMap]).forEach(tex=>tex?.dispose());
      material.dispose();
    });
    models.forEach((model, index) => {
      const subset = poses.filter((_, i) => i % models.length === index);
      const group = new THREE.InstancedMesh(model.geometry, model.material, subset.length);
      subset.forEach((pose, i) => group.setMatrixAt(i, pose));
      group.receiveShadow = true;
      group.castShadow = true;
      group.computeBoundingSphere();
      if (!closed) parent.add(group);
      release.push(() => {parent.remove(group); group.dispose(); model.geometry.dispose();});
    });
    if (closed) release.splice(0).forEach(dispose=>dispose());
    else fallback.visible=false;
  }, undefined, () => { /* The procedural rocks remain in the scene. */ });
  return () => { closed = true; release.splice(0).forEach(dispose=>dispose()); };
}

// The hand-placed loading stage lives on the western shore, in game coordinates.
export function loadLanding(scene: THREE.Scene) {
  let closed = false;
  let stage: THREE.Group | undefined;
  function release(root: THREE.Group) {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.MeshStandardMaterial>();
    const maps = new Set<THREE.Texture>();
    root.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      geometries.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : [node.material]) materials.add(mat);
    });
    for (const mat of materials) {
      for (const tex of [mat.map,mat.normalMap,mat.roughnessMap,mat.metalnessMap]) if (tex) maps.add(tex);
      mat.dispose();
    }
    maps.forEach(tex=>tex.dispose());
    geometries.forEach(geo=>geo.dispose());
  }
  new GLTFLoader().load(materialsPath()+'przystan-ladunkowa.glb', gltf=>{
    if (closed) { release(gltf.scene); return; }
    stage = gltf.scene;
    stage.traverse(node=>{if(node instanceof THREE.Mesh) node.castShadow = node.receiveShadow = true;});
    scene.add(stage);
  });
  return () => {
    closed=true;
    if (stage) { scene.remove(stage); release(stage); }
  };
}
