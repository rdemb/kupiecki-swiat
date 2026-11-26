import {useEffect,useState} from 'react';
import {gameRequest} from '../utils/gameServer';
import {DRAGON_SPECIES} from '../economy/dragonBreeding';
import {craftRank} from '../economy/newHope';
import {engravers,firstInn,southernInns,type CabinetBook} from '../economy/southernTrail';
import './curiosityCabinet.css';

const innName=(id:string)=>southernInns.find(inn=>inn.id===id)?.name??id;
export function CuriosityCabinet({token,site,go,onRoute,selected,onSelected}:{token:string|null;site:string;selected:number;onSelected:(id:number)=>void;go:(id:string)=>void;onRoute:(ids:string[])=>void}){
  const [book,setBook]=useState<CabinetBook>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [refresh,setRefresh]=useState(0),[now,setNow]=useState(Date.now);
  const [practiceDone,setPracticeDone]=useState(false);
  const endpoint='/api/cabinet/'+site;
  useEffect(()=>{
    if(busy)return;
    const controller=new AbortController();
    gameRequest(endpoint,{signal:controller.signal,headers:token?{Authorization:'Bearer '+token}:{}})
      .then(async r=>{if(!r.ok) throw Error();const data=await r.json();if(!controller.signal.aborted)setBook(data);})
      .catch(()=>{if(!controller.signal.aborted)setMessage('Nie udało się odczytać księgi.');});
    return ()=>controller.abort();
  },[endpoint,token,refresh,busy]);
  useEffect(()=>{
    const timer=window.setInterval(()=>{if(!document.hidden) setRefresh(n=>n+1);},15000);
    const clock=window.setInterval(()=>setNow(Date.now()),1000);
    return ()=>{clearInterval(timer);clearInterval(clock);};
  },[]);
  const exhibit=book?.shows.find(s=>s.id===selected)??book?.shows[0];
  const stop=exhibit?.route.at(-1),step=exhibit?.route.length??0;
  useEffect(()=>{onRoute(exhibit?.route.map(s=>s.site)??[]);return ()=>onRoute([]);},[exhibit,onRoute]);
  async function act(action:string,payload:Record<string,unknown>={}) {
    if(!token || busy)return;
    setBusy(true);setMessage('');
    try {
      const r=await gameRequest(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({action,show:exhibit?.id,step,...payload})});
      const data=await r.json();
      if(!r.ok) setMessage(data.error??'Sprawdź ponownie księgę.');
      else {
        setBook(data);
        if(action==='lend')onSelected(data.shows[0].id);
        if(action==='vote')setMessage('Twój głos zapisano w księdze.');
      }
    } catch {setMessage('Nie udało się zapisać. Odczytaj księgę ponownie.');}
    finally {setBusy(false);}
  }
  const guest=book?.sampler && engravers[book.sampler.guide];
  const master=stop && engravers[stop.guide];
  const votes=Object.values(stop?.votes??{}).sort((a,b)=>b-a);
  const canDepart=votes.length>0 && votes[0]>(votes[1]??0) && (votes[0]>=2 || (!!stop?.ballotEnds && now>=stop.ballotEnds));
  const portrait=DRAGON_SPECIES[exhibit?.species??'zloty_legendarny'];
  return <section className="curio" aria-label="Wędrowny gabinet osobliwości">
    <header style={{backgroundImage:'linear-gradient(90deg,#221d16 5%,transparent 95%),url('+portrait.artworkUrl+')'}}>
      <h3>Wędrowny gabinet osobliwości</h3><p>{innName(site)}</p>
    </header>
    <div className="curio-body">
      {!book && <p>Otwieranie księgi objazdu…</p>}
      {book && <>
        {book.shows.length>1 && <label>Wystawa <select value={exhibit?.id} onChange={e=>onSelected(Number(e.target.value))}>
          {book.shows.map(s=><option key={s.id} value={s.id}>{s.guild} · sezon {s.edition}{s.done?' · zakończona':''}</option>)}</select></label>}
        {exhibit && stop && master ? <>
          <h4>{portrait.name}</h4><p>{exhibit.guild} wystawia odcisk z sezonu {exhibit.edition}. Oryginał zostaje u tropiciela.</p>
          <ol className="curio-route">{exhibit.route.map((s,i)=><li key={s.site}><button onClick={()=>go(s.site)}>{i+1}. {innName(s.site)}</button></li>)}</ol>
          {exhibit.done?<p>Objazd zakończony. Na mapie pozostały trzy odwiedzone gospody.</p>
            :stop.opens>now?<p>Wóz jedzie do gospody {innName(stop.site)}. Przyjazd za {Math.ceil((stop.opens-now)/1000)} s.</p>
            :stop.site!==site?<button onClick={()=>go(stop.site)}>Odwiedź wystawę · {innName(stop.site)}</button>
            :!stop.engraved?<div><h4>Odbitka wystawowa</h4><p>{master.name} · {master.prompt}</p>{master.choices.map((c,i)=><button key={c} disabled={!token||busy} onClick={()=>void act('engrave',{choice:i})}>{c}</button>)}</div>
            :<div><h4>Wybierz następną gospodę</h4><p>Dwa zgodne głosy pozwalają ruszyć od razu. Przy jednym głosie wóz czeka 90 sekund. Remis rozstrzyga kolejny kupiec lub zmiana głosu.</p>
              {southernInns.filter(inn=>!exhibit.route.some(s=>s.site===inn.id)).map(inn=><button key={inn.id} disabled={busy||!token} aria-pressed={stop.myVote===inn.id}
                onClick={()=>void act('vote',{dest:inn.id})}>{inn.name} · {stop.votes[inn.id]??0}</button>)}
              <button disabled={!token||busy||!canDepart} onClick={()=>void act('depart')}>Wypraw wóz</button></div>}
        </>:<p>Skrzynia czeka na pierwszy odcisk. Tropiciel może wypożyczyć gildii kartę ze swojego atlasu w Domu Matryc.</p>}
        {site===firstInn && !!book.loans.length && <details open><summary>Wypożycz odcisk gildii</summary>
          {book.loans.map(l=><button key={l.edition} disabled={busy||!book.guild} onClick={()=>void act('lend',{edition:l.edition})}>
          {DRAGON_SPECIES[l.species].name} · sezon {l.edition}</button>)}{!book.guild && <p>Wybierz gildię w karczmie.</p>}</details>}
        {guest && <div className="curio-practice"><h4>Przy stole rytownika</h4><p>{guest.name} · {guest.prompt}</p>
          {book.sampler?.stamped||practiceDone?<p>{token?'Odbitka tej gospody jest w twojej tece.':'Próbna odbitka jest czytelna.'}</p>:guest.choices.map((c,i)=>
            <button key={c} disabled={busy} onClick={()=>{
              if(token)void act('practice',{choice:i});
              else if(i===guest.answer){setPracticeDone(true);setMessage('');}else setMessage('Obejrzyj matrycę jeszcze raz.');
            }}>{c}</button>)}
          <p>{token?'Teka rytownika · '+book.sheets+'/9 odbitek · '+craftRank(book.sheets):'Gość może wykonać próbę. Kupcy z kontem zbierają odbitki, głosują i wypożyczają okazy.'}</p></div>}
        {token && !!book.stamps.length && <details><summary>Paszport odbitek · {book.sheets}/9 gospód</summary>
          <ul className="curio-stamps">{book.stamps.map(id=><li key={id}><button onClick={()=>go(id)}>{innName(id)}</button></li>)}</ul></details>}
        {site===firstInn && !book.loans.length && <button onClick={()=>go('sieci_matyldy')}>Poszukaj własnego okazu przy sieciach Matyldy</button>}
        {site!==firstInn && <button onClick={()=>go(firstInn)}>Wróć do Domu Matryc</button>}
      </>}
      <p role="status">{message}</p>{message && <button onClick={()=>{setMessage('');setRefresh(n=>n+1);}}>Odczytaj księgę ponownie</button>}
    </div></section>;
}
