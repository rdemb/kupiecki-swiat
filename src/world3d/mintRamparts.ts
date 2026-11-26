import * as THREE from 'three';
import type { SharedWorldMaterials } from './architectureAndProps';

type Point = [number, number, number];
type AddStonework = (geometry: THREE.BufferGeometry, material: THREE.Material, at: Point,
  heading: number, parent: THREE.Matrix4) => void;

// The harbour has grown in stages. The open sea-facing platforms, tile-roofed
// gate ward and timber lookouts have different plans even from across the bay.
export function mintRamparts(m: SharedWorldMaterials, radius: number, sides: number, put: AddStonework) {
  const pi = Math.PI;
  const kinds = ['platform','watch','ward','platform','ward','watch','platform','watch'] as const;
  for (let i = 0; i < sides; i++) {
    const kind = kinds[i % kinds.length];
    const angle = i * 2 * pi / sides;
    const root = new THREE.Matrix4().makeRotationY(pi / 2 - angle);
    root.setPosition(radius * Math.cos(angle), 0, radius * Math.sin(angle));
    const stone = m.castleStone, timber = m.timberWood;
    function localFace(a: number) {
      return root.clone().multiply(new THREE.Matrix4().makeRotationY(a));
    }
    function block(mat: THREE.Material, at: Point, size: Point, frame = root) {
      put(new THREE.BoxGeometry(...size), mat, at, 0, frame);
    }
    function turned(profile: [number,number][], mat: THREE.Material, segments: number, y = 0) {
      const points = profile.map(([r,h]) => new THREE.Vector2(r,h));
      put(new THREE.LatheGeometry(points,segments),mat,[0,y,0],0,root);
    }
    function pier(at: Point, end: Point, width: number, frame: THREE.Matrix4) {
      const a = new THREE.Vector3(...at), b = new THREE.Vector3(...end), d = b.clone().sub(a);
      const geo = new THREE.BoxGeometry(width,d.length(),width);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
      put(geo,timber,a.lerp(b,.5).toArray(),0,frame);
    }
    const height = kind === 'platform' ? 3.35 + .16*(i%3) : kind === 'ward' ? 4.05 : 4.35+.22*(i%3);
    const facets = kind === 'ward' ? 4 : kind === 'watch' ? 8 : 20;
    const r = kind === 'platform' ? 1.18 : kind === 'ward' ? 1.51 : .98;
    // Slightly battered base, two sloping string courses and a projecting wall walk.
    turned([[r*1.13,-.15],[r*1.13,.37],[r*.99,1.02],[r*.94,height-.46],
      [r*1.01,height-.35],[r*1.02,height-.19],[r*1.09,height-.1],[r*1.09,height]],stone,facets);
    const cap = new THREE.CylinderGeometry(r*1.09,r*1.09,.09,facets);
    put(cap,stone,[0,height,0],0,root);
    // Loops have splayed, shaded reveals and projecting sills at staggered levels.
    for (let side=0;side<Math.min(8,facets);side++) {
      const yaw = facets===4 ? (side+.5)*pi/2 : (side+.5)*pi/4;
      const face = localFace(yaw);
      const z = r*.982*Math.cos(pi/facets);
      const y = height-(side%2===0 ? 1.11 : 1.92);
      block(m.darkBasaltStone,[0,y,z],[.13,.48,.08],face);
      block(stone,[0,y-.27,z+.035],[.28,.08,.13],face);
    }
    if (kind === 'platform') {
      const lip = r*1.12;
      turned([[lip,height],[lip,height+.34],[lip-.22,height+.34],[lip-.22,height]],stone,20);
      for (let merlon=0;merlon<11;merlon++) {
        const face = localFace(merlon*2*pi/11);
        block(stone,[0,height+.56,lip-.10],[.44,.45,.27],face);
        block(stone,[0,height+.81,lip-.10],[.48,.08,.32],face);
        block(stone,[0,height-.26,lip-.13],[.21,.39,.27],face);
      }
      block(timber,[-.22,height+.075,.28],[.74,.09,.91]);
    } else if (kind === 'watch') {
      // Cantilevered lookout: daylight passes between posts, braces and handrails.
      const platform = new THREE.CylinderGeometry(1.32,1.26,.15,8);
      put(platform,timber,[0,height+.11,0],0,root);
      for(let side=0;side<8;side++) {
        const f=localFace(side*pi/4);
        block(timber,[0,height+.74,1.15],[.11,1.25,.11],f);
        pier([0,height-.48,.85],[0,height+.06,1.20],.13,f);
        const rail=localFace((side+.5)*pi/4);
        block(timber,[0,height+.62,1.05],[.91,.09,.08],rail);
        pier([-.39,height+.24,1.05],[.39,height+.59,1.05],.063,rail);
        if ((side+i)%8<4) {
          // Windbreak boards shelter half the gallery, leaving a view out to sea.
          for(let course=0;course<3;course++)
            block(timber,[0,height+.26+.12*course,1.08],[.87,.105,.046],rail);
        }
        pier([0,height+1.31,1.15],[0,height+1.53,.61],.085,f);
      }
      // A suspended harbour lantern hangs from the beam, with a dark hood and iron cage.
      block(timber,[0,height+1.36,0],[2.14,.12,.15]);
      block(timber,[0,height+1.13,0],[.035,.39,.035]);
      put(new THREE.CylinderGeometry(.18,.15,.40,6),m.warmWindowGlow,[0,height+.80,0],0,root);
      put(new THREE.ConeGeometry(.28,.22,6),m.darkBasaltStone,[0,height+1.06,0],0,root);
      put(new THREE.CylinderGeometry(.20,.13,.085,6),m.darkBasaltStone,[0,height+.57,0],0,root);
      for(let rib=0;rib<6;rib++) {
        const f=localFace(rib*pi/3);
        block(m.darkBasaltStone,[0,height+.80,.165],[.024,.40,.024],f);
      }
      const top=height+1.37;
      turned([[1.48,0],[1.48,.10],[1.28,.23],[.60,1.31],[.31,1.82],[.06,2.22],[0,2.25]],m.slateRoof,8,top);
      turned([[.06,0],[.055,.27],[0,.52]],m.gildedBrass,8,top+2.2);
    } else {
      const frame=localFace(pi/4);
      block(m.plasterWall,[0,height+.47,0],[2.23,.95,2.12],frame);
      for(let side=0;side<4;side++) {
        const f=localFace(pi/4+side*pi/2);
        const z=side%2===0 ? 1.075 : 1.128;
        block(timber,[0,height+.10,z],[2.24,.15,.1],f);
        block(timber,[0,height+.90,z],[2.24,.12,.1],f);
        for(const x of [-.98,-.46,.46,.98]) block(timber,[x,height+.50,z],[.12,.83,.1],f);
        pier([-.96,height+.15,z],[-.49,height+.85,z],.093,f);
        pier([.96,height+.15,z],[.49,height+.85,z],.093,f);
        block(m.warmWindowGlow,[0,height+.54,z],[.62,.52,.08],f);
        block(timber,[0,height+.54,z+.056],[.048,.55,.035],f);
      }
      const roof=new THREE.Shape();
      roof.moveTo(-1.38,0); roof.lineTo(1.38,0); roof.lineTo(0,1.26); roof.closePath();
      const geo=new THREE.ExtrudeGeometry(roof,{depth:2.73,bevelEnabled:false});
      geo.translate(0,0,-1.365);
      put(geo,m.warmTerracottaRoof,[0,height+.96,0],0,frame);
      for(const end of [-1,1]) {
        const g=localFace(pi/4+(end===1?0:pi));
        const face=new THREE.Shape();
        face.moveTo(-1.24,0);face.lineTo(1.24,0);face.lineTo(0,1.13);face.closePath();
        put(new THREE.ShapeGeometry(face),m.plasterWall,[0,height+.962,1.37],0,g);
        block(timber,[0,height+1.5,1.385],[.12,1.1,.08],g);
        block(timber,[0,height+1.01,1.385],[2.5,.13,.08],g);
      }
      block(stone,[.70,height+1.87,-.73],[.34,.93,.42],frame);
      block(stone,[.70,height+2.32,-.73],[.45,.13,.50],frame);
    }
  }
}
