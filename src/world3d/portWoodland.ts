import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD_REGIONS } from '../economy/worldMapData';

export type WoodlandTree = {x: number; y: number; z: number; s: number};
export type WoodlandGround = {
  heightAt(x: number, z: number): number;
  nearRoad(x: number, z: number): boolean;
  paintUnderTree(x: number, z: number, radius: number): void;
};
export const nearPort = (t: WoodlandTree) => Math.hypot(t.x-4,t.z-2) < 57;

function generator(seed: number) {
  return () => {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Clumps on sheltered slopes, with clearings between them and clearance for wagons.
export function portGroves(ground: WoodlandGround, existing: WoodlandTree[]) {
  const random = generator(31337);
  const groves: WoodlandTree[] = [];
  const neighbours = existing.filter(nearPort);
  for (const [cx,cz] of [[-26,-13],[-10,-21],[14,-22],[-29,9],[28,8],[35,-15],[-34,-29],[22,-32]]) {
    for (let j=0;j<14;j++) {
      const a=random()*2*Math.PI, d=Math.sqrt(random())*9;
      const x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d*.73, y=ground.heightAt(x,z);
      const s=.68+random()*.65;
      if (y<1.2 || y>16 || Math.hypot(ground.heightAt(x+1,z)-y,ground.heightAt(x,z+1)-y)>.82) continue;
      if (ground.nearRoad(x,z) || WORLD_REGIONS.some(r=>Math.hypot(x-r.position2D[0],z-r.position2D[1])<(r.type==='capital'?14:7))) continue;
      if (neighbours.some(t=>Math.hypot(t.x-x,t.z-z)<1.55*(s+t.s))) continue;
      const tree={x,y,z,s};
      neighbours.push(tree);
      groves.push(tree);
    }
  }
  return groves;
}

function specimen(form: number) {
  const random = generator(31993+form*2081);
  const stems: THREE.BufferGeometry[] = [];
  const positions: number[]=[], normals: number[]=[], uv: number[]=[], colors: number[]=[], ranks: number[]=[], indices: number[]=[];
  const v = (x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const up = v(0,1,0);
  const height=[4.56,5.45,3.78][form], spread=[1.77,1.03,2.24][form];
  // Each tapered section meets its parent. Buttress roots extend below the triangulated slope.
  function stem(a: THREE.Vector3,b: THREE.Vector3,r0: number,r1: number,sides=6) {
    const d=b.clone().sub(a);
    const g=new THREE.CylinderGeometry(r1,r0,d.length(),sides,1,true);
    const tex=g.getAttribute('uv');
    for(let i=0;i<tex.count;i++) tex.setXY(i,tex.getX(i)*Math.max(.32,6*r0),tex.getY(i)*d.length()*.55+a.y*.55);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,d.normalize()));
    const mid=a.clone().lerp(b,.5);g.translate(mid.x,mid.y,mid.z);stems.push(g);
  }
  // A photographed spray lies along the diagonal of its texture. Fold it gently
  // down the stem and across the leaflets, giving every spray a permanent 3D pose.
  function spray(at: THREE.Vector3,dir: THREE.Vector3,length: number,roll: number) {
    const f=dir.clone().normalize();
    const right=new THREE.Vector3().crossVectors(f,up).normalize().applyAxisAngle(f,roll);
    const shade=.70+random()*.34, rank=random(), base=positions.length/3;
    for (let j=0;j<=2;j++) for (let i=0;i<=2;i++) {
      const u=i/2, t=j/2, along=(u+t)*.5, cross=(u-t)*.66;
      const p=at.clone().addScaledVector(f,(along-.07)*length).addScaledVector(right,cross*length);
      p.y += length*(.15*Math.sin(Math.PI*along)-.16*Math.abs(cross));
      positions.push(...p.toArray());
      // Canopy lighting follows the crown volume instead of the card's two flat sides.
      const n=v(p.x*.63,.82+(p.y-height*.52)*.34,p.z*.63).normalize();
      normals.push(...n.toArray());uv.push(u,t);
      colors.push(shade*(.88+.10*rank),shade,shade*(.82+.16*rank));ranks.push(rank);
      if(j<2 && i<2){const k=base+j*3+i;indices.push(k,k+1,k+3,k+1,k+4,k+3);}
    }
  }
  const root=v(0,-.42,0), ankle=v(.025,.25,-.015);
  for(let i=0;i<6;i++) {
    const a=i*1.047+random()*.25;
    stem(v(Math.cos(a)*.34,-.42,Math.sin(a)*.34),ankle,.055,.10);
  }
  let last = root;
  const nodes: THREE.Vector3[]=[];
  for (let i=1;i<=7;i++) {
    const t=i/7;
    const p=v(.14*Math.sin(t*6+form)*t+.13*t,height*t,.16*Math.sin(t*4.2)*t);
    stem(last,p,.025+.21*(1-(i-1)/7),.025+.21*(1-t),9);
    nodes.push(p);last=p;
  }
  // The windward tree forks near the ground. A sweep of the outer boughs
  // leaves a gap between its two crowns when seen in profile.
  const twin: THREE.Vector3[]=[];
  if (form===2) {
    let prev=nodes[0];
    for (let i=0;i<7;i++) {
      const t=(i+1)/7;
      const next=v(-1.05*Math.sin(t*1.8),.60+height*.87*t,.65*t+.14*Math.sin(t*5));
      stem(prev,next,.16-.127*i/7,.16-.127*t,7);
      twin.push(next);prev=next;
    }
  }
  for (let k=0;k<17;k++) {
    const t=k/16, phi=k*2.39996+random()*.32;
    const leaders=(form===2 && k%2===0) ? twin : nodes;
    const origin=leaders[Math.min(5,1+Math.floor(4.85*t))].clone();
    origin.y+=random()*.28;
    const wide=spread*(.62+.42*Math.sin((t+.17)*Math.PI))*(.72+.48*random())*(1+.20*Math.cos(phi+form));
    const dir=v(Math.cos(phi),0,Math.sin(phi)), side=v(-dir.z,0,dir.x);
    const bend=origin.clone().addScaledVector(dir,wide*.49);
    bend.y+=form===1?.67:.25;
    const end=bend.clone().addScaledVector(dir,wide*.52).addScaledVector(side,(random()-.5)*.38);
    end.y+=(form===1?.56:.18)+random()*.69;
    stem(origin,bend,.11*(1-.44*t),.065);
    stem(bend,end,.069,.029);
    for (let j=0;j<4;j++) {
      const sideSign=j%2===0 ? 1 : -1;
      const start=bend.clone().lerp(end,.16+.22*j);
      const twig=start.clone().addScaledVector(side,sideSign*(.36+.26*random())).addScaledVector(dir,.24);
      twig.y+=.18+random()*.28;
      stem(start,twig,.030,.009,4);
      for(let fan=-1;fan<=1;fan++) {
        const aim=dir.clone().addScaledVector(side,sideSign*(.45+.53*fan));
        aim.y=(form===2 ? -.38 : form===1 ? .09 : -.24)+random()*.65;
        spray(twig,aim,1.02+.78*random(),(random()-.5)*2.1);
        if (form!==1 && j%2===0 && fan===0) {
          // Drooping tips and interior sprays give the broad crown a broken, rounded edge.
          const tip=twig.clone().addScaledVector(aim.clone().normalize(),.73);
          spray(tip,aim.clone().setY(-.48-random()*.32),.95+.38*random(),(random()-.5)*1.8);
          spray(start,side.clone().multiplyScalar(sideSign).setY(.27),1.44,(random()-.5)*1.6);
        }
      }
    }
  }
  for(let j=0;j<7;j++) {
    const a=j*2.4;
    spray(nodes[6],v(Math.cos(a),.18+random()*.6,Math.sin(a)),.85+random()*.45,random()-.5);
  }
  const bark=mergeGeometries(stems);
  stems.forEach(g=>g.dispose());
  const crown=new THREE.BufferGeometry();
  crown.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  crown.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  crown.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  crown.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  crown.setAttribute('leafRank',new THREE.Float32BufferAttribute(ranks,1));
  crown.setIndex(indices);
  return {bark,crown};
}

export function portWoodland(trees: WoodlandTree[], ground: WoodlandGround) {
  const group = new THREE.Group();
  group.name='Gaje Królewskiej Przystani';
  let loaded=false;
  const loader=new THREE.TextureLoader(), dir=(import.meta.env?.BASE_URL ?? '/')+'materials/';
  const spray=loader.load(dir+'galaz-portowa.webp',()=>{loaded=true;});
  const barkMap=loader.load(dir+'kora-nadwodna.webp');
  spray.colorSpace=barkMap.colorSpace=THREE.SRGBColorSpace;
  barkMap.wrapS=barkMap.wrapT=THREE.RepeatWrapping;
  const bark=new THREE.MeshStandardMaterial({map:barkMap,bumpMap:barkMap,bumpScale:.021,roughness:.92});
  const leaves=new THREE.MeshLambertMaterial({map:spray,alphaTest:.31,alphaToCoverage:true,vertexColors:true,side:THREE.DoubleSide});
  const leafDepth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:spray,alphaTest:.31,side:THREE.DoubleSide});
  const time={value:0}, strength={value:1}, shed={value:0};
  for (const mat of [leaves,leafDepth]) {
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uTreeTime:time,uGust:strength,uLeafShed:shed});
      shader.vertexShader='uniform float uTreeTime, uGust; attribute float leafRank; varying float vLeafRank;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
        #include <begin_vertex>
        vec2 root = instanceMatrix[3].xz;
        float phase = dot(root,vec2(.23,.12));
        float flex = smoothstep(.8,5.,position.y);
        float wind = sin(uTreeTime*1.17+phase+.43*position.y) + .34*sin(uTreeTime*2.43+phase+leafRank*6.28);
        transformed.xz += vec2(.036,.016)*wind*flex*uGust;
        transformed.y += .013*sin(uTreeTime*2.8+phase+leafRank*17.)*flex*uGust;
        vLeafRank=leafRank;
      `);
      shader.fragmentShader='uniform float uLeafShed; varying float vLeafRank;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
        #include <alphatest_fragment>
        if (vLeafRank < uLeafShed) discard;
      `);
      if(mat===leaves) shader.fragmentShader=shader.fragmentShader
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += .11 * irradiance * diffuseColor.rgb;');
    };
  }
  const random=generator(88171), pose=new THREE.Object3D(), tint=new THREE.Color();
  const batches: THREE.InstancedMesh[]=[];
  const forms: {pose:THREE.Matrix4; tint:THREE.Color}[][]=[[],[],[]];
  trees.forEach(t=>{
    const form=Math.floor(random()*3);
    pose.position.set(t.x,ground.heightAt(t.x,t.z),t.z);
    pose.rotation.set((random()-.5)*.09,random()*Math.PI*2,(random()-.5)*.08);
    const w=t.s*(.84+random()*.30);
    pose.scale.set(w,t.s*(.84+.28*random()),w);
    pose.updateMatrix();
    tint.setRGB(.78+random()*.23,.83+random()*.18,.76+random()*.21);
    forms[form].push({pose:pose.matrix.clone(),tint:tint.clone()});
    ground.paintUnderTree(t.x,t.z,w*(form===1?1.62:2.15));
  });
  forms.forEach((items,form)=>{
    if (!items.length) return;
    const model=specimen(form);
    for(const [geo,material] of [[model.bark,bark],[model.crown,leaves]] as const) {
      const mesh=new THREE.InstancedMesh(geo,material,items.length);
      items.forEach((item,i)=>{mesh.setMatrixAt(i,item.pose);if(material===leaves) mesh.setColorAt(i,item.tint);});
      if(material===leaves) mesh.customDepthMaterial=leafDepth;
      mesh.castShadow=mesh.receiveShadow=true;mesh.computeBoundingSphere();
      group.add(mesh);batches.push(mesh);
    }
  });
  group.visible=false;
  return {
    group,
    update(height:number, seconds:number, wind:number, autumn:number, snow:number) {
      group.visible=loaded && height<48;
      time.value=seconds; strength.value=wind;
      shed.value=.19*autumn+.92*snow;
      leaves.color.setRGB(1+.65*autumn,1-.32*autumn,1-.58*autumn);
      return group.visible;
    },
    dispose() {
      for(const mesh of batches){mesh.geometry.dispose();mesh.dispose();}
      leaves.dispose();leafDepth.dispose();bark.dispose();spray.dispose();barkMap.dispose();
    },
  };
}
