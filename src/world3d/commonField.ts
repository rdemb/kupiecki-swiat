import * as THREE from 'three';
import type { FieldStage } from '../economy/commonField';

// A clearing on the western terraces, outside the Silver Grove's retaining wall.
const west = -78, north = -18, width = 10, depth = 7;
export function insideCommonField(x: number, z: number) {
  return x >= west - 1 && x <= west + width + 1 && z >= north - 1 && z <= north + depth + 1;
}

export function buildCommonField(heightAt: (x:number,z:number)=>number) {
  const group = new THREE.Group();
  group.name = 'Wspólne pole pod Srebrnym Gajem';
  const soil = new THREE.PlaneGeometry(width, depth, 36, 10);
  soil.rotateX(-Math.PI / 2);
  const points = soil.attributes.position;
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < points.count; i++) {
    const x = west + width / 2 + points.getX(i), z = north + depth / 2 + points.getZ(i);
    const ridge = .5 + .5 * Math.cos(18 * Math.PI * (x-west) / width);
    points.setXYZ(i, x, heightAt(x,z) + .11 + .15*ridge, z);
    color.set('#5a4230').multiplyScalar(.78 + .31*ridge);
    colors.push(color.r,color.g,color.b);
  }
  soil.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  soil.computeVertexNormals();
  const soilMaterial = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.98});
  const ground = new THREE.Mesh(soil,soilMaterial);
  ground.receiveShadow=true;
  group.add(ground);

  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position',new THREE.Float32BufferAttribute([
    -.13,0,0,  .08,0,0,  .16,.9,.05,
    .03,0,-.11, 0,0,.12, -.18,.72,.13,
    -.05,0,0, .07,0,.06, .02,1.14,-.04,
  ],3));
  blade.computeVertexNormals();
  const straw = new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.86});
  const crops = new THREE.InstancedMesh(blade,straw,9*22);
  crops.receiveShadow=true;
  group.add(crops);
  const dummy = new THREE.Object3D();
  let last: FieldStage | undefined;
  function update(value: FieldStage) {
    if (value === last) return;
    last = value;
    crops.visible = value !== 'earth';
    if (value === 'earth') return;
    const h = {green:.56,gold:1.27,stubble:.19}[value];
    straw.color.set(value === 'green' ? '#799046' : value === 'gold' ? '#cba44e' : '#a98250');
    for (let i=0;i<crops.count;i++) {
      const x=west + .58 + (i%9)*width/9 + .08*Math.sin(i*17);
      const z=north + .22 + Math.floor(i/9)*(depth-.4)/21 + .06*Math.cos(i*3);
      dummy.position.set(x,heightAt(x,z)+.21,z);
      dummy.scale.set(1.6,h*(.85+.15*Math.sin(i)),1.6);
      dummy.rotation.y=i*2.39;
      dummy.updateMatrix();
      crops.setMatrixAt(i,dummy.matrix);
    }
    crops.instanceMatrix.needsUpdate=true;
    crops.computeBoundingSphere();
  }
  update('earth');
  return {group,update,dispose() {soil.dispose();blade.dispose();straw.dispose();soilMaterial.dispose();crops.dispose();}};
}
