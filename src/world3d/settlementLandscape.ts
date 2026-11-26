import * as THREE from 'three';
import {WORLD_REGIONS,getTerrainHeight} from '../economy/worldMapData';
import {shoreTrees} from './coastalScenery';
import {camps} from '../economy/uplandFair';
import type {SharedWorldMaterials} from './architectureAndProps';

// Stone, timber, foliage and cloth share
// instance buffers within it, including the small details at the market.
export function settlementLandscape(m:SharedWorldMaterials){
  const group=new THREE.Group(), stalls=new Map<string,THREE.Group>();
  const cube=new THREE.BoxGeometry(), crown=new THREE.IcosahedronGeometry(1,1);
  const foliage=new THREE.MeshStandardMaterial({color:0x526339,roughness:.98,flatShading:false});
  const geometry=[cube,crown],instances:THREE.InstancedMesh[]=[];
  const trees:{x:number;y:number;z:number;s:number}[]=[];
  const treeMeshes:THREE.InstancedMesh[]=[];
  const transform=new THREE.Object3D();
  function batch(parent:THREE.Group) {
    const sets=new Map<THREE.Material,Map<THREE.BufferGeometry,THREE.Matrix4[]>>();
    return {
      put(mat:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,angle=0,slope=0,geo:THREE.BufferGeometry=cube) {
        transform.position.set(x,y,z);transform.scale.set(w,h,d);transform.rotation.set(slope,angle,0,'YXZ');transform.updateMatrix();
        const byGeo=sets.get(mat)??new Map();sets.set(mat,byGeo);
        const poses=byGeo.get(geo)??[];byGeo.set(geo,poses);poses.push(transform.matrix.clone());
      },
      finish(){for(const [mat,shapes] of sets)for(const [geo,poses] of shapes){
        const mesh=new THREE.InstancedMesh(geo,mat,poses.length);
        poses.forEach((p,i)=>mesh.setMatrixAt(i,p));mesh.castShadow=true;mesh.receiveShadow=true;
        parent.add(mesh);instances.push(mesh);
        if(mat===foliage || mat===m.treeBark)treeMeshes.push(mesh);
      }}
    };
  }
  WORLD_REGIONS.filter(r=>r.type==='workshop').forEach((site,i)=>{
    const [x,z]=site.position2D,ground=getTerrainHeight(x,z),g=new THREE.Group();
    g.position.set(x,ground,z);group.add(g);
    const b=batch(g);
    // A paved working yard, post-and-rail fence, stacked pallets and rain barrels.
    const h=(dx:number,dz:number)=>getTerrainHeight(x+dx,z+dz)-ground;
    for(let j=0;j<18;j++){
      const px=6+(j%3)*.89,pz=-4+Math.floor(j/3)*.91,py=h(px,pz);
      if(py+ground>.25)b.put(m.castleStone,px,py+.02,pz,.84,.13,.86,(j%4)*.02);
    }
    for(let j=0;j<=5;j++) {
      const dz=-6+j*2,dy=h(-6,dz);
      if(dy+ground<.6)continue;
      b.put(m.timberWood,-6,dy+.65,dz,.14,1.5,.15);
      if(j<5 && Math.abs(dy-h(-6,dz+2))<.75)
        for(const lift of [.5,.98])b.put(m.timberWood,-6,dy+lift,dz+1,.11,.10,2.08);
    }
    for(let j=0;j<26;j++){
      const t=j*2.39996+i,rad=16+((i*17+j*31)%29);
      const px=Math.cos(t)*rad,pz=Math.sin(t)*rad,py=h(px,pz),treeH=2.3+(j%6)*.49;
      if(py+ground<1.5 || Math.abs(h(px+1,pz)-py)>.95)continue;
      const rocky=/jar|solne|geod|skal|prog|kreda|lupk/i.test(site.id);
      if(rocky && j%3!==0){
        b.put(m.alpineBoulder,px,py+.26,pz,1.4+(j%3),.72,1.2,t,.12,crown);continue;
      }
      trees.push({x:x+px,y:py+ground,z:z+pz,s:treeH/4.15});
      b.put(m.treeBark,px,py+treeH*.32,pz,.29,treeH*.72,.31,t);
      for(let k=0;k<5;k++){
        const angle=t+k*2.4,offset=k===0?0:treeH*.19;
        b.put(foliage,px+Math.cos(angle)*offset,py+treeH*(k===0?.92:.68),pz+Math.sin(angle)*offset,
          treeH*.38,treeH*(k===0?.46:.31),treeH*.36,angle,.14,crown);
      }
    }
    // Recognisable landmarks for the grain growers, dyers and slate quarry.
    if(site.id==='plac_owsa' || site.id==='mlyn_bielika'){
      const px=7,pz=4,py=h(px,pz);
      for(const dx of [-1.35,1.35])for(const dz of [-1.9,1.9])b.put(m.castleStone,px+dx,py+.46,pz+dz,.65,.9,.65);
      b.put(m.timberWood,px,py+2,pz,3.5,2.5,4.6);
      for(const side of [-1,1])b.put(m.warmTerracottaRoof,px,py+3.77,pz+side*1.22,4.15,.18,2.75,0,side*.37);
      for(let j=0;j<7;j++)b.put(m.timberWood,px-1.79,py+1.97,pz+(j-3)*.58,.14,2.4,.11);
    }
    if(site.id==='plac_buku' || site.id==='farbiarnia_urzetu'){
      for(let j=0;j<3;j++){
        const px=-8+j*2.8,pz=5,py=h(px,pz);
        for(const dz of [-1.8,1.8])b.put(m.timberWood,px,py+1.55,pz+dz,.12,3.12,.12);
        b.put(m.timberWood,px,py+2.98,pz,.09,.10,3.8);
        b.put(j===1?m.sailCloth:m.emeraldRoof,px,py+1.97,pz,.065,1.92,2.9,0,.045*j);
      }
    }
    if(site.id==='plac_lupka' || site.id==='wrota_geod'){
      for(let j=0;j<16;j++){
        const px=6+(j%4)*.83,pz=5+Math.floor(j/4)*.59;
        const level=2+(j*13)%5;
        for(let k=0;k<level;k++)b.put(m.darkBasaltStone,px,h(px,pz)+k*.14+.09,pz,.85,.12,.55,(j%3)*.11);
      }
    }
    b.finish();
    if(!camps.some(id=>id===site.id))return;
    const market=new THREE.Group();g.add(market);market.visible=false;stalls.set(site.id,market);
    const booths=batch(market);
    for(let n=0;n<3;n++){
      const px=-5+n*5.1,pz=9,py=h(px,pz);
      for(const dx of [-1.75,1.75])for(const dz of [-1.15,1.15])
        booths.put(m.timberWood,px+dx,py+1.47,pz+dz,.16,3,.16);
      for(const side of [-1,1])booths.put(m.sailCloth,px,py+3.04,pz+side*.71,4.1,.09,1.59,0,side*.29);
      booths.put(m.timberWood,px,py+1.02,pz+.93,3.6,.17,.85);
      for(let j=-1;j<=1;j++)booths.put(n===1?m.timberWood:m.plasterWall,px+j*.92,py+1.34,pz+.85,.7,.45,.58);
    }
    booths.finish();
  });
  const treeDetail=shoreTrees(trees);group.add(treeDetail.mesh);
  return {group,update(host:string|null,height:number,time:number){
      for(const [id,g] of stalls)g.visible=id===host;
      const detailed=treeDetail.update(height,time,0);
      for(const mesh of treeMeshes)mesh.visible=!detailed;
    },
    dispose(){treeDetail.dispose();instances.forEach(m=>m.dispose());geometry.forEach(g=>g.dispose());foliage.dispose();}};
}
