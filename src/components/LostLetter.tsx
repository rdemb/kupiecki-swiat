import {useEffect,useRef,useState} from 'react';
import {ferryGoal,landings,letterStages,otherBank,ticketPrice,westName,witnessesByStage,type LetterPage} from '../economy/westernMarch';
import type {MillMark} from '../economy/mill';
import {gameRequest} from '../utils/gameServer';
import {imageUrl} from '../utils/imageUrl';
import './lostLetter.css';

type Trial = {stage:number;witness:number};
function readTrial():Trial {
  try {
    const t=JSON.parse(sessionStorage.getItem('ks-ford-trial')??'null');
    if(t && Number.isInteger(t.stage) && t.stage>=0 && t.stage<=5 && Number.isInteger(t.witness) && t.witness>=0 && t.witness<3)return t;
  } catch { /* trial remains playable in memory */ }
  return {stage:0,witness:0};
}
const actionLabels=['Podnieś przemoczony list','','','','Odprowadź kupca i ocal księgę'];
interface Props {
  token:string|null; site:string; go:(id:string)=>void; onOpen:(opened:boolean)=>void; onSettlement:(uid:string,mark:MillMark)=>void;
}
export function LostLetter({token,site,go,onOpen,onSettlement}:Props) {
  const [page,setPage]=useState<LetterPage|null>(null);
  const [trial,setTrial]=useState(readTrial),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [tick,setTick]=useState(Date.now);
  const requestNo=useRef(0),pending=useRef(false);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    const clock=window.setInterval(()=>setTick(Date.now()),1000);
    const refresh=window.setInterval(()=>{if(!document.hidden && !pending.current)setReload(n=>n+1);},15000);
    return ()=>{clearInterval(clock);clearInterval(refresh);requestNo.current++;};
  },[]);
  useEffect(()=>{
    const controller=new AbortController(),seq=++requestNo.current;
    gameRequest('/api/lost-letter',{signal:controller.signal,headers:token?{Authorization:'Bearer '+token}:{}})
      .then(async r=>{if(!r.ok)throw Error();const p=await r.json();if(requestNo.current===seq)setPage(p);})
      .catch(()=>{if(!controller.signal.aborted && requestNo.current===seq)setError('Księga przystani nie odpowiada.');});
    return ()=>controller.abort();
  },[token,reload]);
  const open=page?.fund===ferryGoal;
  useEffect(()=>{onOpen(open);},[open,onOpen]);
  useEffect(()=>{if(page?.ledger)onSettlement(page.ledger.uid,page.ledger.mark);},[page,onSettlement]);
  const progress=(token?page:trial);
  const stage=progress?.stage??0,clue=letterStages[stage];
  const witness=stage>=1 && stage<=3?witnessesByStage[stage-1][progress?.witness??0]:null;
  function keepTrial(t:Trial){
    setTrial(t);
    try{sessionStorage.setItem('ks-ford-trial',JSON.stringify(t));}catch{ /* private browsing */ }
  }
  function move(id:string){setError('');go(id);}
  async function act(action:string,choice?:number){
    if(pending.current)return;
    setError('');
    if(!token){
      if(action!=='trace' || clue?.site!==site)return;
      if(witness && choice!==witness.answer){setError('Świadek przeczy temu tropowi. Przyjrzyj się zeznaniu.');return;}
      keepTrial({stage:stage+1,witness:Math.floor(Math.random()*3)});return;
    }
    pending.current=true;setBusy(true);
    const seq=++requestNo.current;
    try{
      const res=await gameRequest('/api/lost-letter',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({action,site,stage,choice,fund:page?.fund})});
      const result=await res.json();
      if(requestNo.current!==seq)return;
      if(res.ok)setPage(result);
      else{setError(result.error??'Sprawdź księgę jeszcze raz.');setReload(n=>n+1);}
    }catch{if(requestNo.current===seq)setError('Zapis nie dotarł do przystani. Sprawdź księgę.');}
    finally{pending.current=false;setBusy(false);}
  }
  const landing=landings.some(id=>id===site);
  const parcel=page?.parcel;
  const remaining=parcel?Math.max(0,Math.ceil((parcel.arrives-tick)/1000)):0;
  return <section className="ford-letter" aria-label="List zaginionego kupca">
    <header style={{backgroundImage:'linear-gradient(90deg,#182c26 12%,#1b3223b3 55%,transparent),url('+imageUrl('smok-trzcinowy.webp')+')'}}>
      <h3>List zaginionego kupca</h3><p>{westName(site)}</p>
    </header>
    <div className="ford-paper">
      {progress && <>{clue ? <>
        <h4>{clue.title}</h4>
        {clue.site!==site?<button onClick={()=>move(clue.site)}>Podążaj za tropem · {westName(clue.site)}</button>:<>
          <p>{clue.description}</p>
          {witness?<><blockquote><strong>{witness.name}</strong><br/>{witness.line}</blockquote>
            {witness.choices.map((v,i)=><button key={v} disabled={busy} onClick={()=>void act('trace',i)}>{v}</button>)}</>:
            <button disabled={busy} onClick={()=>void act('trace')}>{actionLabels[stage]}</button>}
        </>}
      </>:<><h4>Kupiec wrócił do gospody</h4><p>W księdze ocalały pomiary brodu po obu stronach rzeki.</p>
        {!token && <button onClick={()=>{keepTrial({stage:0,witness:0});move(letterStages[0].site);}}>Rozegraj historię ponownie</button>}</>}
        {!token && <small>Wersja gościnna zapisuje tropy w tej karcie. Na koncie możesz oddać księgę mieszkańcom i współfinansować prom.</small>}
      </>}
    </div>
    <div className="ford-register"><h4>Przeprawa nad brodem</h4>
      {!page?<p>Odczytywanie księgi przystani…</p>:<>
        {!page.found?<p>Prom czeka na odnalezienie księgi przewoźnika.</p>:open?<p>Prom publiczny kursuje. Przewoźnik przyjmuje skrzynie na obu brzegach.</p>:<>
          <p>Zebrano {page.fund} z {ferryGoal} sztuk złota na linę, pokład i okucia.</p>
          <progress aria-label="Zbiórka na prom" value={page.fund} max={ferryGoal}/>
          {token && landing && <button disabled={busy || (page.wallet??0)<ticketPrice} onClick={()=>void act('fund')}>Dołóż {ticketPrice} sztuk złota</button>}
        </>}
        {(page.found || stage===5) && !landing && <button onClick={()=>move(landings[0])}>Odwiedź zachodni brzeg</button>}
        {open && landing && <>
          <button onClick={()=>move(otherBank(site))}>Przepraw się · {westName(otherBank(site))}</button>
          {token && page.canBook && <button disabled={busy} onClick={()=>void act('book')}>Załaduj skrzynię faktorii · fracht 8 zł</button>}
          {parcel && !parcel.delivered && <p>{remaining>0?'Skrzynia na wodzie · '+remaining+' s':'Skrzynia czeka na rozładunek'} · {westName(otherBank(parcel.origin))}</p>}
          {parcel && !parcel.delivered && otherBank(parcel.origin)===site && <button disabled={busy || remaining>0} onClick={()=>void act('unload')}>Oddaj skrzynię faktorii</button>}
          {parcel?.delivered && !page.canBook && <p>Odebrano 8 sztuk złota. Kolejna skrzynia będzie dostępna dobę po załadunku.</p>}
        </>}
      </>}
      {error && <div role="status">{error} <button onClick={()=>{setError('');setReload(n=>n+1);}}>Odczytaj księgę</button></div>}
    </div>
  </section>;
}
