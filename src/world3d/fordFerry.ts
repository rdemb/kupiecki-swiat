import * as THREE from 'three';
import { riverX } from '../economy/westernMarch';

export function buildFordFerry(timber: THREE.Material) {
  const group = new THREE.Group();
  group.name = 'Prom nad zachodnim brodem';
  group.position.set(riverX(325), 0, 325);
  group.visible = false;
  const boat = new THREE.Group();
  group.add(boat);
  const block = new THREE.BoxGeometry();
  const tar = new THREE.MeshStandardMaterial({color:0x382f26});
  const cargo = new THREE.MeshStandardMaterial({color:0xb38850,roughness:.9});
  function beam(parent:THREE.Group, material:THREE.Material, x:number,y:number,z:number, width:number,height:number,depth:number) {
    const piece = new THREE.Mesh(block, material);
    piece.scale.set(width,height,depth);
    piece.position.set(x,y,z);
    parent.add(piece);
  }
  beam(boat,tar,0,.4,0,10,1.1,4.8);
  for(let plank=0; plank<10; plank++) beam(boat,timber,plank-4.5,1,0,.93,.24,5);
  for(const side of [-1,1]) {
    beam(boat,tar,0,1.55,side*2.38,10,.8,.22);
    beam(group,timber,side*46,1,2.8,1,10,1);
  }
  beam(group,tar,0,4.6,2.8,92,.16,.16);
  beam(boat,timber,1,2.8,2.34,.35,3.4,.4);
  beam(boat,cargo,-2.2,2.05,-.5,3,1.9,2);
  for(const x of [-3.2,-1.2]) beam(boat,tar,x,3.02,-.5,.18,.14,2.1);
  return {group, boat, dispose:()=>{block.dispose();tar.dispose();cargo.dispose();}};
}
