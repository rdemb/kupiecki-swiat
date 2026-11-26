import { useId, useState } from 'react';
import { Anchor, Compass, Feather, Hammer, Leaf, Navigation, Shell, Star, Trees } from 'lucide-react';
import { crafts } from '../economy/newHope';
import { courseNames } from '../economy/pilotage';
import { hullEmblems, type HullEmblem, type HullPart } from '../economy/hullMarks';
import { raftRules } from '../economy/rafts';
import type { YardBook } from '../economy/shipyard';
import { cinemaFile } from './MerchantRoad';
import './hullMarks.css';

const emblems = {anchor:Anchor, leaf:Leaf, shell:Shell, star:Star};
const stations = [
  {id:'keel', name:'Stępka', icon:Feather},
  {id:'oak', name:'Poszycie', icon:Trees},
  {id:'iron', name:'Okucia', icon:Hammer},
  {id:'route', name:'Rejsy', icon:Navigation},
] as const;
const note = {
  keel:'Pierwszy podpis należy do kupca, który ufunduje stępkę dla swojej gildii.',
  oak:'Flisacy spławiają dąb do portu. Kupiec, który dostarczy go na pochylnię, może zostawić tu swój znak.',
  iron:'Kupiec, który dostarczy okucia z Żelaznej Kuźni, może tu wyryć swoje godło.',
  route:'Po wypłynięciu pojawi się tu kurs szkuty. Bosman dopisze rejs do księgi dopiero po powrocie.',
};
const date = new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'long',year:'numeric'});
type Ship = YardBook['ship'];
type Part = HullPart | 'route';

export function HullMarks({ship,busy,engrave,fitFirst}:{ship:Ship;busy:boolean;fitFirst:()=>void;engrave:(emblem:HullEmblem)=>void}) {
  const [part,selectPart]=useState<Part>('keel');
  const [emblem,selectEmblem]=useState<HullEmblem>('anchor');
  const [tryMark,setTryMark]=useState(false);
  const panel=useId();
  const hands=ship?.marks?.hands??[];
  const people=hands.filter(h=>h.part===part || (part==='oak' && h.part==='plank'));
  const canEngrave=people.some(h=>h.mine&&!h.emblem);
  const title=stations.find(s=>s.id===part)!.name;
  const Symbol=emblems[emblem];
  return <section className="hull-marks" aria-label="Znaki mistrzów na burcie" id="znaki-burty" tabIndex={-1}>
    <header><h2>Znaki mistrzów na burcie</h2>
      <p>{ship ? (ship.hull.name??'Kadłub na pochylni')+' · '+ship.hull.guild : 'Wzornik stoczni · pierwsza pochylnia czeka na gildię'}</p></header>
    <div className="hull-plate" role="group" aria-label="Miejsca na burcie">
      <img src={cinemaFile('burta-szkuty.webp')} width="1440" height="514" alt="" />
      <div className="hull-pins">{stations.map(s=>{
        const marks=hands.filter(h=>(h.part===s.id || (s.id==='oak' && h.part==='plank')) && h.emblem);
        const Glyph=marks[0]?.emblem?emblems[marks[0].emblem]:s.icon;
        return <button type="button" key={s.id} aria-pressed={part===s.id} aria-controls={panel}
          onClick={()=>{selectPart(s.id);setTryMark(false);}}>
          <span className="hull-boss"><Glyph aria-hidden="true" size={24} strokeWidth={1.6}/></span>
          <span>{s.name}</span>
        </button>;
      })}</div>
    </div>
    <div id={panel} className="hull-entry" aria-live="polite" aria-atomic="true">
      <h3>{title}</h3>
      {part==='route' && ship ? <>
        {ship.job?.departed && <p>W drodze na redę i z powrotem · u steru {ship.job.skipper} · {courseNames[ship.job.course]}.</p>}
        {ship.maiden && <p>Pierwszy powrót z redy do Królewskiej Przystani · {date.format(ship.maiden.settled)}. Szkutę prowadził kupiec <b>{ship.maiden.skipper}</b>.</p>}
        {ship.marks?.routes.length ? <ul>{ship.marks.routes.map(r=><li key={r.course}>{courseNames[r.course]} · ukończone rejsy: {r.trips}</li>)}</ul> :
          <p>Bosman czeka na pierwszy powrót.</p>}
      </> : people.length ? <ul>{people.map((h,i)=>{
        const Seal=h.emblem?emblems[h.emblem]:null;
        return <li key={i}><strong>{h.name}</strong> · {h.part==='keel'?'fundacja stępki':h.part==='plank'?'wygięcie i osadzenie pierwszej klepki':h.part==='oak'?'belki dębowe · '+h.lots*raftRules.beamsPerLoad:'komplet okuć z kuźni'}
          {h.emblem&&Seal&&<small><Seal size={17} aria-hidden="true"/> {hullEmblems[h.emblem]} · {date.format(h.engraved!)}{h.mastery?' · mistrz fachu: '+crafts[h.mastery].name:''}</small>}</li>;
      })}</ul> : <p>{note[part]}</p>}
      {part==='oak' && ship && !hands.some(h=>h.part==='plank') && (ship.hull.launched ?
        <p>W księdze brakuje nazwiska wykonawcy pierwszej klepki.</p> :
        ship.marks?.canFitFirst ? <button type="button" disabled={busy} onClick={fitFirst}>Wygnij i osadź pierwszą klepkę</button> :
        <p>Pierwszą klepkę można osadzić po dostawie dębu. Potrzeba do tego jednego ukończonego zlecenia szkutniczego.</p>)}
    </div>
    {part!=='route' && (canEngrave || !ship) && <div className="hull-carving">
      <button type="button" aria-expanded={tryMark} onClick={()=>setTryMark(!tryMark)}>{canEngrave?'Wybierz własne godło':'Przymierz godło na próbce dębu'}</button>
      {tryMark && <div className="hull-tools">
        <div className="hull-proof" aria-hidden="true" style={{backgroundImage:'url('+cinemaFile('burta-szkuty.webp')+')'}}><Symbol size={42} strokeWidth={2}/></div>
        <label>Godło <select value={emblem} onChange={e=>selectEmblem(e.target.value as HullEmblem)}>
          {Object.entries(hullEmblems).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select></label>
        {canEngrave && <button type="button" disabled={busy} onClick={()=>engrave(emblem)}>Wyryj na stałe</button>}
      </div>}
    </div>}
  </section>;
}
