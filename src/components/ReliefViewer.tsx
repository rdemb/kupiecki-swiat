import {useEffect,useRef,useState} from 'react';
import {atlasSheets,projectAtlas,type AtlasSheet} from '../economy/atlasSheets';
import {WORLD_CONTINENTS,WORLD_REGIONS} from '../economy/worldMapData';
import './reliefViewer.css';

export const reliefUrl=(sheet:AtlasSheet)=>import.meta.env.BASE_URL+'atlas/'+sheet+'.webp';
function belongs(sheet:AtlasSheet,continent:string){
  return sheet==='swiat'||sheet===continent||(sheet==='stary_lad'&&!Object.hasOwn(atlasSheets,continent));
}
export function ReliefViewer({initial,visit,close}:{initial:AtlasSheet;visit:(region:string)=>void;close:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),viewport=useRef<HTMLDivElement>(null);
  const [sheet,setSheet]=useState(initial),[zoom,setZoom]=useState(1),[pins,setPins]=useState(true);
  useEffect(()=>{const el=dialog.current!;el.showModal();return ()=>el.close();},[]);
  const [west,north,east,south]=atlasSheets[sheet],aspect=(east-west)/(south-north);
  const places=WORLD_REGIONS.filter(r=>belongs(sheet,r.continentId));
  function travel(id:string){visit(id);close();}
  function switchSheet(value:AtlasSheet){setSheet(value);setZoom(1);viewport.current?.scrollTo(0,0);}
  return <dialog ref={dialog} aria-label="Atlas rzeźby świata" className="relief-viewer" onCancel={close}>
    <header><strong>Atlas rzeźby świata</strong><select aria-label="Arkusz atlasu" value={sheet} onChange={e=>switchSheet(e.target.value as AtlasSheet)}>
      {Object.keys(atlasSheets).map(k=><option key={k} value={k}>{k==='swiat'?'Cały świat':k==='stary_lad'?'Stary Ląd':WORLD_CONTINENTS.find(c=>c.id===k)?.shortName}</option>)}</select>
      <select aria-label="Odwiedź miejsce" value="" onChange={e=>travel(e.target.value)}><option value="" disabled>Odwiedź miejsce…</option>
        {places.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button aria-label="Oddal mapę" disabled={zoom===1} onClick={()=>setZoom(z=>z-1)}>−</button><span>{zoom}×</span>
      <button aria-label="Przybliż mapę" disabled={zoom===4} onClick={()=>setZoom(z=>z+1)}>+</button>
      <button aria-pressed={pins} onClick={()=>setPins(!pins)}>Nazwy {pins?'wł.':'wył.'}</button>
      <button onClick={close}>Zamknij</button></header>
    <div className="relief-viewport" ref={viewport} tabIndex={0} aria-label="Mapa do przewijania">
      <div className={sheet==='swiat' && zoom<3 ? 'relief-sheet overview' : 'relief-sheet'} style={{width:'min('+zoom*100+'cqw, '+zoom*aspect*100+'cqh)',aspectRatio:aspect}}>
        <img src={reliefUrl(sheet)} alt="Rzeźba terenu, zabudowa i głębokość wody" draggable={false}/>
        {pins && places.map(r=>{
          const [x,y]=projectAtlas(sheet,r.position2D);
          return <button key={r.id} className="relief-pin" style={{left:x+'%',top:y+'%'}} title={r.name}
            onClick={()=>travel(r.id)}><span>{r.name.split(' (')[0]}</span></button>;
        })}
      </div>
    </div>
  </dialog>;
}
