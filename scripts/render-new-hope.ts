// Run with tsx and pipe the PPM to an image encoder. Markers use these same terrain coordinates.
import {getTerrainHeight} from '../src/economy/worldMapData';
const coast=process.argv.includes('--coast');
const west=process.argv.includes('--west');
const south=process.argv.includes('--south');
const north=process.argv.includes('--north');
const w=west?1100:(north||south)?1600:coast?1440:960,h=west?1100:south?800:520;
const rgb=Buffer.alloc(w*h*3);
for(let j=0;j<h;j++) for(let i=0;i<w;i++){
  const x=(west?-2790:(north||south)?-310:coast?930:310)+(i+.5)*((west||north||south)?2480:coast?1240:620)/w;
  const z=(west||north?-930:south?310:-310)+(j+.5)*(west?2480:south?1240:620)/h;
  const y=getTerrainHeight(x,z);
  const light=Math.min(1.32,Math.max(.64,1+(getTerrainHeight(x+1,z+1)-y)*.30));
  const wave=3*Math.sin(z*.91+x*.17);
  const grain=3*Math.sin(113*i+51*j);
  const base=y<0 ? [26+12*(8+y)/8,54+23*(8+y)/8+wave,68+20*(8+y)/8+wave]
    :west && y>2 ? (x < -2100?[159+y*.35,148+y*.32,118+y*.4]:x > -1300?[57+y*.55,94+y*.57,71+y*.49]:[118+y*.82,136+y*.55,91+y*.44])
    :south && y>=3 ? (x<560?[85+y*.4,118-y*.4,80]:x<1240?[170-y*.3,156-y*.4,122-y*.5]:[174-y*.32,120-y*.36,78-y*.26]) :y<3 ? [182,167,125] : [104-1.15*y,127-.84*y,90-.60*y];
  for(let k=0;k<3;k++) rgb[(j*w+i)*3+k]=Math.max(0,Math.min(255,Math.round(base[k]*light+grain)));
}
process.stdout.write('P6\n'+w+' '+h+'\n255\n');
process.stdout.write(rgb);
