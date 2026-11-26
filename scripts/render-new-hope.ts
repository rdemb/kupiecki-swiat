// Run with tsx and pipe the PPM to an image encoder. Markers use these same terrain coordinates.
import {newHopeHeight} from '../src/economy/worldMapData';
const w=960,h=520;
const rgb=Buffer.alloc(w*h*3);
for(let j=0;j<h;j++) for(let i=0;i<w;i++){
  const x=310+(i+.5)*620/w, z=-310+(j+.5)*620/h;
  const y=newHopeHeight(x,z);
  const light=Math.min(1.32,Math.max(.64,1+(newHopeHeight(x+1,z+1)-y)*.30));
  const wave=3*Math.sin(z*.91+x*.17);
  const grain=3*Math.sin(113*i+51*j);
  const base=y<0 ? [26+12*(8+y)/8,54+23*(8+y)/8+wave,68+20*(8+y)/8+wave]
    :y<3 ? [182,167,125] : [104-1.15*y,127-.84*y,90-.60*y];
  for(let k=0;k<3;k++) rgb[(j*w+i)*3+k]=Math.round(base[k]*light+grain);
}
process.stdout.write('P6\n'+w+' '+h+'\n255\n');
process.stdout.write(rgb);
