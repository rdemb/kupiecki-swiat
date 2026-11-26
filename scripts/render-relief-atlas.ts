// Offline orthophotos. Sample the game's elevation and surface weights, then expose
// ridge shadows, sandbars, tree crowns and the roofs around each actual settlement.
import {spawnSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {atlasSheets,projectAtlas,type AtlasSheet} from '../src/economy/atlasSheets';
import {WORLD_REGIONS,getTerrainHeight,getContinentBiomeWeights} from '../src/economy/worldMapData';
const width=3840,height=2160, stride=5;
const out='public/atlas';
mkdirSync(out,{recursive:true});
function texture(name:string){
  const result=spawnSync('ffmpeg',['-v','error','-i','public/materials/'+name+'.webp','-vf','scale=256:256','-f','rawvideo','-pix_fmt','gray','pipe:1'],{maxBuffer:200000});
  if(result.status!==0 || result.stdout.length!==65536)throw Error('Texture '+name);
  const mean=result.stdout.reduce((a,b)=>a+b,0)/65536;
  return Float32Array.from(result.stdout,v=>v-mean);
}
const grass=texture('laka'),rock=texture('skarpa');
const clamp=(x:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,x));
function hash(x:number,z:number) {
  let n=Math.imul(x,374761393)+Math.imul(z,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
}
function encode(name:string,pixels:Buffer){
  const command=['-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',width+'x'+height,'-i','pipe:0','-frames:v','1','-quality','79',out+'/'+name+'.webp'];
  const result=spawnSync('ffmpeg',command,{input:pixels});if(result.status!==0)throw Error(String(result.stderr));
}
for(const sheet of Object.keys(atlasSheets) as AtlasSheet[]){
  const [west,north,east,south]=atlasSheets[sheet],dx=(east-west)/width,dz=(south-north)/height;
  const cols=width/stride+1,rows=height/stride+1;
  const terrain=new Float32Array(cols*rows);
  const pixels=Buffer.alloc(width*height*3);
  const channels=Array.from({length:4},()=>new Float32Array(cols*rows));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const x=west+i*stride*dx,z=north+j*stride*dz,n=j*cols+i,y=getTerrainHeight(x,z);
    terrain[n]=y;
    const b=getContinentBiomeWeights(x,z);
    channels[0][n]=b.desert;channels[1][n]=b.glacier;channels[2][n]=b.volcanic;channels[3][n]=b.jade;
  }
  const row=(i:number,j:number)=>terrain[clamp(j,0,rows-1)*cols+clamp(i,0,cols-1)];
  const shore=Float32Array.from(terrain,y=>y>=0?0:1e4);
  for(const dir of [1,-1]) {
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const x=dir===1?i:cols-1-i,z=dir===1?j:rows-1-j,n=z*cols+x;
      if(i)shore[n]=Math.min(shore[n],shore[n-dir]+1);
      if(j)shore[n]=Math.min(shore[n],shore[n-dir*cols]+1);
      if(i&&j)shore[n]=Math.min(shore[n],shore[n-dir*(cols+1)]+1.414);
    }
  }
  const colors=Array.from({length:4},()=>new Float32Array(rows*cols));
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const n=j*cols+i,y=terrain[n];
    const sx=(row(i+1,j)-row(i-1,j))/(2*dx*stride),sz=(row(i,j+1)-row(i,j-1))/(2*dz*stride);
    let shade=0;
    for(const step of [2,6,16,38])shade=Math.max(shade,(row(i-step,j-step)-y)/Math.hypot(step*stride*dx,step*stride*dz));
    const sun=clamp((.68+.58*sx+.46*sz)/Math.sqrt(1+sx*sx+sz*sz));
    const illumination=(.50+.61*sun)*(1-.32*clamp((shade-.38)*1.7));
    const cliff=clamp(Math.hypot(sx,sz)*.95+.30*clamp((y-27)/19)),snow=clamp(channels[1][n]*(.36+clamp(y/30)));
    const moisture=channels[3][n],sand=channels[0][n],volcano=channels[2][n];
    let red=101+74*sand-40*moisture,green=112+34*sand-16*moisture,blue=66+30*sand-3*moisture;
    red+=(127-red)*cliff;green+=(122-green)*cliff;blue+=(113-blue)*cliff;
    red+=(72-red)*volcano;green+=(67-green)*volcano;blue+=(65-blue)*volcano;
    red+=(217-red)*snow;green+=(227-green)*snow;blue+=(230-blue)*snow;
    const beach=clamp(1-y/2.9);
    colors[0][n]=(red+(185-red)*beach)*illumination;colors[1][n]=(green+(171-green)*beach)*illumination;
    colors[2][n]=(blue+(131-blue)*beach)*illumination;colors[3][n]=cliff;
  }
  for(let j=0;j<height;j++){
    const v=j/stride,iy=Math.floor(v),fy=v-iy;
    for(let i=0;i<width;i++){
      const u=i/stride,ix=Math.floor(u),fx=u-ix,n=iy*cols+ix,idx=(j*width+i)*3;
      const interp=(a:Float32Array)=>(a[n]*(1-fx)+a[n+1]*fx)*(1-fy)+(a[n+cols]*(1-fx)+a[n+cols+1]*fx)*fy;
      const y=interp(terrain),tex=((j&255)*256+(i&255)),coarse=grass[(((j>>2)&255)*256+((i>>2)&255))];
      if(y<0){
        const depth=clamp(-y/12),glint=Math.sin(j*.68+i*.14+.07*coarse)*1.4+rock[tex]*.035;
        const coast=interp(shore),gulf=Math.exp(-coast*.11),shelf=Math.exp(-coast*.032);
        const tide=Math.sin(coast*1.9+.09*coarse+.8*Math.sin(i*.016+j*.005));
        const foam=14*clamp(1+2*y)+gulf*clamp((tide-.26)*2.6)*(3+2*Math.sin(i*.10));
        pixels[idx]=14+(1-depth)*43+glint+foam+shelf*7;pixels[idx+1]=38+54*(1-depth)+glint+foam+shelf*35;pixels[idx+2]=53+(1-depth)*39+glint+foam+shelf*27;
      }else{
        const slope=interp(colors[3]);
        const surface=(grass[tex]*(1-slope)*.14+rock[tex]*slope*.29+coarse*.17);
        const cell=12,cx=Math.floor(i/cell),cz=Math.floor(j/cell),seed=hash(cx,cz);
        const canopy=clamp((y-2)*.5)*(1-slope)*clamp((coarse+8)/24);
        const ax=i%cell-3-seed*6,az=j%cell-3-hash(cx+17,cz)*6;
        const rr=2.1+2.8*seed,crown=clamp(1-(ax*ax+az*az)/(rr*rr));
        const shadow=clamp(1-((ax-2)*(ax-2)+(az-2)*(az-2))/(rr*rr));
        const leaves=canopy*(.44*shadow+crown*(.12+.13*(ax+az)/rr));
        // Fields occupy the sheltered lowlands. Long strips, headlands and
        // hedgerows remain legible at the scale of an estate.
        const uField=(i*.84+j*.47+13*Math.sin(j*.005))/42;
        const vField=(-i*.41+j*.89+8*Math.cos(i*.006))/20;
        const field=hash(Math.floor(uField),Math.floor(vField));
        const farm=clamp((y-1.8)/2)*clamp((18-y)/8)*clamp((.38-slope)*4.5)*clamp((17-coarse)/22);
        const hedge=Math.max(clamp(1-(uField-Math.floor(uField))*19),clamp(1-(vField-Math.floor(vField))*13));
        const furrow=2.8*Math.sin(vField*42)*farm;
        for(let k=0;k<3;k++){
          const crop=(field-.45)*[32,22,8][k]-hedge*22;
          pixels[idx+k]=clamp(interp(colors[k])*(1-leaves)+surface+farm*crop+furrow,0,255);
        }
      }
    }
  }
  function ink(x:number,z:number,rgb:number[],alpha:number){
    if(x<0||x>=width||z<0||z>=height)return;
    const idx=(Math.floor(z)*width+Math.floor(x))*3;
    for(let c=0;c<3;c++) pixels[idx+c]+=(rgb[c]-pixels[idx+c])*alpha;
  }
  for(const [s,town] of WORLD_REGIONS.entries()){
    if(town.type==='fear_place'||town.type==='sanctuary')continue;
    const [px,pz]=projectAtlas(sheet,town.position2D);
    if(px<0||px>100||pz<0||pz>100)continue;
    const fort=town.type==='capital',radius=clamp((fort?14:8)/dx,6,86);
    const bx=px*width/100,bz=pz*height/100;
    for(let b=0;b<(fort?72:16);b++){
      const a=hash(s,b)*Math.PI*2,rad=Math.sqrt(hash(s+89,b))*radius;
      const x=Math.floor(bx+rad*Math.cos(a)),z=Math.floor(bz+rad*Math.sin(a)*dx/dz);
      const size=Math.max(1,Math.round(radius*(.022+.027*hash(b,13))));
      for(let h=-size;h<=size;h++)for(let w=-2*size;w<=2*size;w++){
        ink(x+w+size,z+h+size,[41,37,31],.6);
        ink(x+w,z+h,h<0?[173,135,99]:[91,73,66],.9);
      }
    }
  }
  encode(sheet,pixels);console.log(sheet);
}
