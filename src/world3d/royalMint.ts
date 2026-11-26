import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mintRamparts } from './mintRamparts';
import type { SharedWorldMaterials } from './architectureAndProps';

type Point = [number, number, number];
const pi = Math.PI;

// The mint, the sea gate and the bell tower share the same stone courses.
export function royalMint(m: SharedWorldMaterials, gateCenter: Point, gateHeading: number, wallRadius: number, wallSides: number) {
  const group = new THREE.Group();
  group.name = 'mennica-krolewska';
  const pieces = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const owned = new Set<THREE.Material>();
  function finish(color: number, roughness = .9, metalness = 0) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    owned.add(mat);
    return mat;
  }
  // Sandstone cuttings use the same scale as the lower stone courses.
  const limestone = new THREE.MeshStandardMaterial({
    color: 0xc3b49a, map: m.castleStone.map, normalMap: m.castleStone.normalMap,
    normalScale: new THREE.Vector2(.31,.31), roughness: .88,
  });
  owned.add(limestone);
  const recess = finish(0x312b23);
  const iron = finish(0x3e3b37,.7,.32), bronze = finish(0x886842,.46,.63);
  const lancetGlass = m.warmWindowGlow.clone();
  lancetGlass.emissive.setHex(0xf8a758);
  lancetGlass.roughness=.34;
  owned.add(lancetGlass);
  // Lead cames and varied transmission break up the candlelit panes at dusk.
  lancetGlass.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vGlass;\n' + shader.vertexShader.replace('#include <uv_vertex>',
      '#include <uv_vertex>\n vGlass = uv;');
    shader.fragmentShader = 'varying vec2 vGlass;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 diamonds = vec2(vGlass.x*5.5 + vGlass.y*3.5, vGlass.x*5.5 - vGlass.y*3.5);
      vec2 edge = abs(fract(diamonds+.5)-.5);
      vec2 blur = max(fwidth(diamonds),vec2(.012));
      vec2 leading = smoothstep(vec2(.024)-blur*.5,vec2(.024)+blur*.5,edge);
      float openGlass = mix(.15,1.,leading.x*leading.y);
      float variation = fract(sin(dot(floor(diamonds+.5),vec2(61.3,48.7)))*4385.23);
      diffuseColor.rgb *= openGlass*(.64+.35*variation);
    `).replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      totalEmissiveRadiance *= openGlass*(.28+.40*variation);
    `);
  };
  const slate = m.slateRoof, stone = m.castleStone, wood = m.timberWood;
  const model = new THREE.Object3D();
  function put(geo: THREE.BufferGeometry, mat: THREE.Material, at: Point, heading = 0, parent?: THREE.Matrix4) {
    model.position.set(...at);
    model.rotation.set(0, heading, 0);
    model.updateMatrix();
    geo.applyMatrix4(model.matrix);
    if (parent) geo.applyMatrix4(parent);
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if (geo !== flat) geo.dispose();
    // Anchor the courses in metres even on narrow buttresses and very long faces.
    if (mat === stone || mat === slate || mat === wood || mat === limestone) {
      const pos = flat.getAttribute('position'), norm = flat.getAttribute('normal'), uv = flat.getAttribute('uv');
      for (let i = 0; i < pos.count; i++) {
        const nx = Math.abs(norm.getX(i)), nz = Math.abs(norm.getZ(i)), ny = Math.abs(norm.getY(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (ny > .88) uv.setXY(i, x * .25, z * .35);
        else uv.setXY(i, (nx > nz ? z : x) * .25, y * .35);
      }
    }
    if (!pieces.has(mat)) pieces.set(mat, []);
    pieces.get(mat)!.push(flat);
  }
  function box(mat: THREE.Material, at: Point, size: Point, parent?: THREE.Matrix4) {
    put(new THREE.BoxGeometry(...size), mat, at, 0, parent);
  }
  function face(at: Point, heading: number) {
    return new THREE.Matrix4().makeRotationY(heading).setPosition(...at);
  }
  function lathe(mat: THREE.Material, at: Point, profile: Array<[number,number]>, ring = 16) {
    put(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),ring),mat,at);
  }
  // An arched opening actually cut out of the front wall. Positive Z faces the visitor.
  function arch(path: THREE.Path, x: number, base: number, radius: number, jamb: number) {
    path.moveTo(x-radius,base);
    path.lineTo(x-radius,base+jamb);
    path.absarc(x,base+jamb,radius,pi,0,true);
    path.lineTo(x+radius,base);
    path.closePath();
  }
  function archFrame(parent: THREE.Matrix4, x: number, base: number, r: number, jamb: number, band: number) {
    const depth=band*1.18;
    for (const side of [-1,1]) {
      box(limestone,[x+side*(r+band*.5),base+jamb*.5,depth*.18],[band,jamb,depth],parent);
      box(limestone,[x+side*(r+band*.5),base+jamb-.04,depth*.21],[band*1.44,band*.65,depth*1.27],parent);
    }
    for (let i=0; i<11; i++) {
      const a=i*pi/11+.013, b=(i+1)*pi/11-.013;
      const ro=r+band*(i===5?1.38:1);
      const s=new THREE.Shape();
      s.absarc(0,0,ro,a,b,false);
      s.absarc(0,0,r,b,a,true);
      s.closePath();
      put(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:3}),limestone,
        [x,base+jamb,-depth*.38],0,parent);
    }
  }
  function wall(width: number, height: number, depth: number, parent: THREE.Matrix4,
    openings: number[], base: number, radius: number, jamb: number, gateway=false) {
    const outline=new THREE.Shape();
    outline.moveTo(-width/2,0);outline.lineTo(width/2,0);outline.lineTo(width/2,height);outline.lineTo(-width/2,height);outline.closePath();
    for(const x of openings) {
      const hole=new THREE.Path();
      arch(hole,x,base,radius,jamb);outline.holes.push(hole);
      archFrame(parent,x,base,radius,jamb,gateway ? .19 : .105);
      if (!gateway) {
        const pane=new THREE.Shape();arch(pane,x,base,radius,jamb);
        put(new THREE.ShapeGeometry(pane),lancetGlass,[0,0,-depth*.87],0,parent);
        box(limestone,[x,base+jamb*.53,-depth*.18],[.066,jamb*1.06,.083],parent);
        box(iron,[x,base+jamb*.59,-depth*.24],[radius*1.96,.041,.065],parent);
        box(limestone,[x,base-.045,.015],[radius*2+.35,.09,.27],parent);
      }
    }
    put(new THREE.ExtrudeGeometry(outline,{depth,bevelEnabled:false,curveSegments:10}),stone,[0,0,-depth],0,parent);
  }

  mintRamparts(m, wallRadius, wallSides, put);

  // Great hall: windows on all four sides sit inside deep stone reveals.
  const cx=-.65, cz=-.75, width=4.9, length=6.2, eaves=6.18;
  for (let side=0; side<4; side++) {
    const heading=side*pi/2, longSide=side%2===1;
    const run=longSide?length:width;
    const out=(longSide?width:length)*.5;
    const f=face([cx+Math.sin(heading)*out,0,cz+Math.cos(heading)*out],heading);
    const bays=longSide?[-2,0,2]:[-1.32,1.32];
    wall(run,eaves,.25,f,bays,3.75,.39,1.12);
    for(const x of bays) {
      box(recess,[x,1.7,.012],[.27,.75,.075],f);
      box(limestone,[x,1.29,.075],[.45,.095,.2],f);
    }
    for(const y of [.6,3.28,eaves-.18])
      box(limestone,[0,y,.006],[run+.1,.13,y<1?.32:.20],f);
    for(const x of [-(run/2-.24),0,run/2-.24]) {
      if (longSide && x===0) continue;
      box(stone,[x,1.42,.17],[.41,2.84,.65],f);
      box(limestone,[x,2.88,.14],[.48,.13,.63],f);
      box(stone,[x,4.03,.085],[.31,2.19,.4],f);
      box(limestone,[x,5.17,.09],[.39,.12,.43],f);
    }
  }
  // A gabled slate roof, closed at both ends, with raised ridge and dormers.
  function gable(at: Point, w: number, h: number, d: number, mat: THREE.Material, heading=0) {
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,h);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});
    geo.translate(0,0,-d/2);
    put(geo,mat,at,heading);
  }
  gable([cx,eaves,cz],width+.57,2.63,length+.54,slate);
  // The roof tiles end at the verge. The walls beneath them have timbered gables.
  for (const end of [-1,1]) {
    const z = cz + end * (length/2 + .281);
    const f = face([cx,eaves,z],end===1 ? 0 : pi);
    const gableWall = new THREE.Shape();
    gableWall.moveTo(-2.53,0); gableWall.lineTo(2.53,0); gableWall.lineTo(0,2.41); gableWall.closePath();
    put(new THREE.ShapeGeometry(gableWall),m.plasterWall,[0,0,0],0,f);
    box(wood,[0,.072,.025],[5.04,.14,.12],f);
    box(wood,[0,.81,.028],[3.35,.105,.12],f);
    for (const x of [-1.72,-.86,0,.86,1.72]) {
      const h=2.35*(1-Math.abs(x)/2.53);
      box(wood,[x,h/2,.04],[.108,h,.12],f);
    }
    for(const side of [-1,1]) {
      const rake=new THREE.BoxGeometry(.15,3.66,.22);
      rake.rotateZ(side*.813);
      put(rake,wood,[side*1.31,1.24,.06],0,f);
      const brace=new THREE.BoxGeometry(.10,1.18,.12);
      brace.rotateZ(side*.79);
      put(brace,wood,[side*.42,1.24,.06],0,f);
    }
    box(recess,[0,.53,.075],[.48,.65,.13],f);
    for(const x of [-.16,0,.16]) box(wood,[x,.52,.15],[.038,.64,.04],f);
  }
  box(iron,[cx,eaves+2.62,cz],[.115,.12,length+.61]);
  for (const side of [-1,1]) {
    for(const dz of [-1.9,.10,1.85]) {
      const x=cx+side*1.90;
      box(m.plasterWall,[x,6.94,cz+dz],[.82,.92,.82]);
      for (const post of [-.36,.36]) box(wood,[x+side*.42,6.98,cz+dz+post],[.095,.80,.08]);
      box(wood,[x+side*.42,6.62,cz+dz],[.09,.09,.88]);
      box(recess,[x+side*.416,7.08,cz+dz],[.04,.45,.35]);
      gable([x,7.39,cz+dz],1.09,.72,1.16,m.warmTerracottaRoof,pi/2);
    }
  }
  // Spiral stair turret, bell chamber with open arches and a cast bronze bell.
  const tx=2.52, tz=-.92;
  lathe(stone,[tx,0,tz],[[1.52,0],[1.48,.65],[1.24,1.04],[1.23,7.26],[1.42,7.48],[1.42,7.65]],12);
  for (const y of [.7,4.55,7.53]) lathe(limestone,[tx,y,tz],[[1.28,-.08],[1.49,0],[1.49,.11],[1.3,.16]],12);
  for(let i=0;i<10;i++) {
    const a=i*1.45,r=1.22;
    const f=face([tx+Math.sin(a)*r,0,tz+Math.cos(a)*r],a);
    box(recess,[0,1.25+i*.60,.017],[.17,.48,.078],f);
  }
  for(let side=0;side<4;side++) {
    const a=side*pi/2;
    const f=face([tx+Math.sin(a)*1.01,7.59,tz+Math.cos(a)*1.01],a);
    wall(2.08,1.99,.23,f,[0],.10,.60,.86,true);
  }
  const bell = new THREE.Group();
  bell.name = 'mint_bell';
  bell.position.set(tx,8.73,tz);
  const casting = new THREE.LatheGeometry(
    [[.46,-.91],[.56,-.86],[.54,-.78],[.39,-.68],[.26,-.27],[.23,-.15],[.04,-.11]].map(([r,y])=>new THREE.Vector2(r,y)),32);
  const bellShell = new THREE.Mesh(casting,bronze);
  bellShell.castShadow = bellShell.receiveShadow = true;
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(.11,10,8),iron);
  tongue.position.y=-.91;
  bell.add(bellShell,tongue);
  group.add(bell);
  box(wood,[tx,8.82,tz],[2,.24,.28]);
  box(wood,[tx,9.59,tz],[2.21,.15,2.21]);
  lathe(slate,[tx,9.57,tz],[[1.70,0],[1.70,.11],[1.1,.46],[.66,1.02],[.50,1.73],[.30,2.12],[.15,2.89],[.035,3.54]],8);
  lathe(bronze,[tx,13.10,tz],[[.10,0],[.13,.15],[.05,.28],[.038,1.26]],12);
  // The passage is clear through the curtain and aligned with the octagonal wall.
  const gate=face(gateCenter,gateHeading);
  wall(6.63,3.45,1.21,gate,[0],.18,1.04,1.12,true);
  for(const x of [-2.55,2.55]) {
    box(stone,[x,1.57,.27],[.8,3.14,1.02],gate);
    box(limestone,[x,3.15,.21],[1,.18,1.12],gate);
  }
  box(limestone,[0,3.48,-.42],[6.74,.19,1.68],gate);
  for(let i=-3;i<=3;i++) box(stone,[i*.93,3.84,.1],[.50,.56,.49],gate);
  // Recessed grooves and a raised gate leave daylight visible below the teeth.
  for(let i=-3;i<=3;i++) {
    const x=i*.22, y=1.30+Math.sqrt(1.04**2-x*x);
    box(iron,[x,y-.06,-.29],[.063,.30,.07],gate);
  }
  box(wood,[0,.145,-.22],[2.06,.10,2.75],gate);
  for(let i=0;i<3;i++) box(limestone,[0,.07-i*.06,1.35+i*.36],[2.4+i*.23,.13,.38],gate);

  const flagGeo = new THREE.PlaneGeometry(1.63,.83,12,5);
  flagGeo.translate(.815,-.415,0);
  const flagMat = finish(0x952f29);
  flagMat.vertexColors=true; flagMat.side=THREE.DoubleSide;
  const uv=flagGeo.getAttribute('uv'), colors=[];
  for (let i=0;i<uv.count;i++) {
    const x=uv.getX(i), y=uv.getY(i);
    const border=y<.05||y>.95||x<.10;
    colors.push(1,border?.84:.25,border?.40:.18);
  }
  flagMat.color.setHex(0xf6cfaa);
  flagGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const wind={value:0};
  flagMat.onBeforeCompile=shader=>{
    shader.uniforms.uFlagTime=wind;
    shader.vertexShader='uniform float uFlagTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float free = uv.x;
      transformed.z += free * (.18*sin(7.*free-2.2*uFlagTime) + .06*sin(15.*free+2.*uv.y-3.1*uFlagTime));
      transformed.y -= .14*free*free;
    `);
  };
  const flag=new THREE.Mesh(flagGeo,flagMat);
  flag.position.set(tx,14.28,tz);flag.name='city_banner';
  flag.onBeforeRender=()=>{wind.value=performance.now()*.001;};
  group.add(flag);
  const geometries: THREE.BufferGeometry[]=[flagGeo,casting,tongue.geometry];
  for(const [mat,input] of pieces) {
    const geometry=mergeGeometries(input);
    input.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(geometry,mat);
    if (mat === lancetGlass) mesh.onBeforeRender=()=>{lancetGlass.emissiveIntensity=m.warmWindowGlow.emissiveIntensity;};
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);geometries.push(geometry);
  }
  group.userData.releaseMint=()=>{
    geometries.forEach(g=>g.dispose());
    owned.forEach(material=>material.dispose());
  };
  return group;
}
