import * as THREE from 'three';
import type { SharedWorldMaterials } from './architectureAndProps';

type Point = [number, number, number];
const frames = [
  // station along the keel, half beam, and sheer (height of the rail)
  [-2.20,.48,1.18], [-1.90,.72,1.02], [-1.35,.90,.83], [-.50,.96,.76],
  [.45,.89,.76], [1.22,.71,.79], [1.85,.42,.91], [2.38,.13,1.12], [2.62,.025,1.32],
];

function clinkerHull() {
  const vertices: number[] = [], colors: number[] = [], uvs: number[] = [];
  const section = [[0,-.53],[.44,-.39],[.76,-.12],[.91,.22],[1,.6],[.96,1]];
  function point(station: number, side: number, lane: number): Point {
    const [z,beam,sheer] = frames[station];
    const [width,height] = section[lane];
    return [width*beam*side,height<0 ? height : height*sheer,z];
  }
  function plank(a: Point,b: Point,c: Point,d: Point,shade: number) {
    for (const p of [a,b,d,b,c,d]) {
      vertices.push(...p); uvs.push(p[2]*.57 + p[0]*.14, p[1]*3.2 + p[0]*.24);
      colors.push(shade,shade*.90,shade*.77);
    }
  }
  for (let i=0; i<frames.length-1; i++) {
    for (const side of [-1,1]) {
      for (let lane=0; lane<section.length-1; lane++) {
        const a=point(i,side,lane), b=point(i+1,side,lane);
        const c=point(i+1,side,lane+1), d=point(i,side,lane+1);
        const shade = [.33,.39,.55,.72,.41][lane];
        if(side>0) plank(a,d,c,b,shade); else plank(a,b,c,d,shade);
      }
    }
    plank(point(i,-1,5),point(i+1,-1,5),point(i+1,1,5),point(i,1,5),.94);
  }
  for (const station of [0,frames.length-1]) for (let j=0;j<section.length-1;j++) {
    const a=point(station,-1,j), b=point(station,1,j), c=point(station,1,j+1), d=point(station,-1,j+1);
    if(station===0) plank(a,d,c,b,.58); else plank(a,b,c,d,.55);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.computeVertexNormals();
  return geo;
}

const hullGeometry = clinkerHull();
const rigging = new THREE.LineBasicMaterial({color:0x352d24,transparent:true,opacity:.85});
const hullFinishes = new WeakMap<THREE.Material,THREE.MeshStandardMaterial>();

export function buildGalleonMesh(materials: SharedWorldMaterials, scale=1) {
  const ship = new THREE.Group();
  let finish = hullFinishes.get(materials.timberWood);
  if (!finish) {
    finish=materials.timberWood.clone();
    finish.vertexColors=true;
    finish.side=THREE.DoubleSide;
    hullFinishes.set(materials.timberWood,finish);
    const shipFinish = finish;
    materials.timberWood.addEventListener('dispose',()=>shipFinish.dispose());
  }
  const hull=new THREE.Mesh(hullGeometry,finish);
  hull.receiveShadow=hull.castShadow=true;
  ship.add(hull);
  const ropes: number[]=[];
  const line=(from: Point,to: Point)=>ropes.push(...from,...to);

  function spar(a: Point,b: Point,foot: number,tip=foot) {
    const from=new THREE.Vector3(...a), to=new THREE.Vector3(...b);
    const dir=to.clone().sub(from);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(tip,foot,dir.length(),7),materials.timberWood);
    beam.position.copy(from).lerp(to,.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
    ship.add(beam);
  }
  function sail(z: number,head: number,width: number,drop: number) {
    const geo=new THREE.PlaneGeometry(width,drop,18,9);
    const p=geo.attributes.position, uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++) {
      const s=uv.getX(i)*2-1,t=1-uv.getY(i);
      const belly=Math.sin(Math.PI*t*.86)*(1-.66*s*s);
      const pleat=Math.sin(s*27+t*1.8)*.027;
      p.setXYZ(i,s*width*(.50-.052*t),head-drop*t+.14*t*s*s,z+belly*(.28+pleat)+s*.095);
    }
    geo.computeVertexNormals();
    const cloth=new THREE.Mesh(geo,materials.sailCloth);
    cloth.castShadow=true; ship.add(cloth);
    spar([-width*.57,head,z-.11],[width*.57,head,z+.11],.021,.019);
    for (const side of [-1,1]) line([side*width*.44,head-drop+.14,z+.1],[side*.68,.83,z-.54]);
  }
  for (const [z,tip] of [[.06,4.75],[1.35,3.52]]) {
    spar([0,.68,z],[0,tip,z-.08],.080,.034);
    for (const side of [-1,1]) {
      for(let j=0;j<3;j++) line([side*.77,.85,z-.63+j*.28],[side*.04,tip-.52,z-.08]);
      for(let j=1;j<8;j++) {
        const t=j/9,x=side*(.77-.73*t),y=.85+(tip-1.37)*t;
        line([x,y,z-.63+.55*t],[x,y,z-.07-.01*t]);
      }
    }
  }
  sail(.08,3.27,2.12,1.52); sail(.015,4.50,1.52,1.01); sail(1.36,3.30,1.62,1.37);
  spar([0,.90,1.93],[0,1.66,3.58],.068,.026);
  line([0,4.71,-.02],[0,3.51,1.27]); line([0,3.50,1.27],[0,1.65,3.58]);
  line([0,4.60,-.02],[0,1.18,-2.16]);
  for(const side of [-1,1]) for(let i=0;i<frames.length-1;i++) {
    const [z,w,h]=frames[i],[nz,nw,nh]=frames[i+1];
    line([side*w*.96,h+.08,z],[side*nw*.96,nh+.08,nz]);
  }
  const cordage=new THREE.BufferGeometry();
  cordage.setAttribute('position',new THREE.Float32BufferAttribute(ropes,3));
  ship.add(new THREE.LineSegments(cordage,rigging));
  const lantern=new THREE.Mesh(new THREE.CylinderGeometry(.075,.093,.18,6),materials.warmWindowGlow);
  lantern.position.set(0,1.38,-2.11);ship.add(lantern);
  ship.scale.setScalar(scale);
  return ship;
}
