import React,{useEffect,useRef,useState} from 'react';
import {camps,fairName,hosts,wares,wareKeys,type UplandBook,type Ware} from '../economy/uplandFair';
import type {MillMark} from '../economy/mill';
import {gameRequest} from '../utils/gameServer';
import {imageUrl} from '../utils/imageUrl';
import './uplandFair.css';

function useFair(token:string|null){
  const [book,setBook]=useState<UplandBook|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const pending=useRef(false),sequence=useRef(0);
  const headers=():Record<string,string>=>token?{Authorization:'Bearer '+token}:{};
  useEffect(()=>{
    const controller=new AbortController();
    async function read(){
      if(pending.current || document.hidden)return;
      const index=++sequence.current;
      try{
        const res=await gameRequest('/api/upland-fair',{headers:headers(),signal:controller.signal});
        if(!res.ok)throw Error();
        const data=await res.json();
        if(index===sequence.current){setBook(data);setError('');}
      }catch{if(index===sequence.current && !controller.signal.aborted)setError('Księga jarmarku chwilowo nie odpowiada.');}
    }
    void read();const timer=window.setInterval(read,12000);
    return ()=>{controller.abort();clearInterval(timer);sequence.current++;};
  },[token]);
  async function act(body:Record<string,unknown>){
    if(!token || !book || pending.current)return;
    const index=++sequence.current;
    pending.current=true;setBusy(true);setError('');
    try{
      const res=await gameRequest('/api/upland-fair',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({edition:book.edition,...body})});
      const page=await res.json();if(!res.ok)throw Error(page.error??'Nie udało się zapisać dostawy.');
      if(index===sequence.current)setBook(page);
    }catch(e){if(index===sequence.current)setError(e instanceof Error?e.message:'Nie udało się zapisać dostawy.');}
    finally{pending.current=false;if(index===sequence.current)setBusy(false);}
  }
  return {book,error,busy,act};
}
export function FairChronicle({go}:{go:(site:string)=>void}){
  const {book}=useFair(null);
  return <div className="inn-section"><button className="inn-link" onClick={()=>go(book?.winner?.site??'rozhuk')}>Wędrowny jarmark · Wzgórza Trzech Jarmarków</button>
    {book?.history.slice(0,3).map(w=><p key={w.edition}>{fairName(w.site)} otwiera kramy. {w.name} dowiózł ostatni ładunek ({wares[w.good].name.toLowerCase()}).</p>)}</div>;
}
interface Props{token:string|null;site:string;go:(id:string)=>void;onWinner:(site:string|null)=>void;onSettlement:(uid:string,mark:MillMark)=>void}
export function UplandFair({token,site,go,onWinner,onSettlement}:Props){
  const {book,busy,error,act}=useFair(token);
  const [trial,setTrial]=useState<{key:string;ok:boolean}|null>(null);
  const winner=book?.winner, camp=book?.camps.find(c=>c.site===site);
  const guide=camp?hosts[camps.findIndex(id=>id===site)][camp.guide]:null;
  const source=wareKeys.find(k=>wares[k].source===site);
  const cargo=book?.cargo, isOpen=!!book && !winner && !book.storm;
  useEffect(()=>{if(book)onWinner(winner?.site??null);},[!!book,winner?.site,onWinner]);
  useEffect(()=>{if(book?.ledger)onSettlement(book.ledger.uid,book.ledger.mark);},[book,onSettlement]);
  const trialKey=site+'/'+book?.edition;
  function dispatch(action:string,extra:Record<string,unknown>={}){void act({action,site,...extra});}
  function choose(i:number){
    if(token && isOpen && !camp?.surveyed)dispatch('survey',{choice:i});
    else setTrial({key:trialKey,ok:i===guide?.answer});
  }
  return <section id="ks-upland-fair" className="upland-fair">
    <img src={imageUrl('wedrowny-jarmark.webp')} alt="Rogaty smok i jedwabnik nad placem kupieckim" loading="lazy"/>
    <h3>Wędrowny jarmark</h3>
    <p>Trzy osady czekają na mąkę, drewno i płótno. Która pierwsza dostanie komplet, ta rozłoży kramy aż do kolejnej wysokiej wody.</p>
    {error && <p role="alert">{error}</p>}{!book && !error && <p>Otwieranie księgi…</p>}
    {book && <><p aria-live="polite">{book.storm?'Wysoka woda zatrzymała wozy.':winner?'Jarmark otwarty · '+fairName(winner.site):'Wozy mogą ruszać.'}</p>
      <div className="uf-stops">{book.camps.map(c=><button key={c.site} aria-pressed={site===c.site} onClick={()=>go(c.site)}>{fairName(c.site)} <small>{c.goods.length}/3</small></button>)}</div>
      {guide && camp && <><h4>{guide.name}</h4><p>„{guide.hint}”</p>
        {camp.surveyed && <p>Woźnice oznaczyli suchy dojazd.</p>}
        {(!token || (isOpen && !camp.surveyed)) && <><p>{token?'Wskaż przejazd dla kupców.':'Próba przewodnika · którędy przejedzie wóz?'}</p>
          <div>{guide.roads.map((road,i)=><button disabled={busy} key={road} onClick={()=>choose(i)}>{road}</button>)}</div>
          {trial?.key===trialKey && <p role="status">{trial.ok?'Wóz przejechał suchą drogą.':'Koła ugrzęzły. Posłuchaj wskazówki i spróbuj ponownie.'}</p>}</>}
        <p>{camp.goods.length?'Dostarczono '+camp.goods.map(k=>wares[k].name.toLowerCase()).join(', ')+'.':'Plac czeka na pierwszą dostawę.'}</p></>}
      {isOpen && <div className="uf-stops">{wareKeys.map(k=><button key={k} onClick={()=>go(wares[k].source)}>{fairName(wares[k].source)} <small>{wares[k].name}</small></button>)}</div>}
      {!token && <p>Zalogowany kupiec może zabrać ładunek i zdecydować, gdzie stanie jarmark.</p>}
      {token && source && isOpen && !cargo && <button disabled={busy} onClick={()=>dispatch('load',{good:source,nonce:crypto.randomUUID()})}>Załaduj · {wares[source].name} · kaucja {wares[source].cost} zł</button>}
      {token && cargo && <><p>Na wozie · {wares[cargo.good as Ware].name}. Za dostawę kupiec odzyskuje kaucję i zarabia 2 zł.</p>
        {isOpen && cargo.edition===book.edition && camp?.surveyed && !camp.goods.includes(cargo.good) && <button disabled={busy} onClick={()=>dispatch('deliver',{ticket:cargo.ticket})}>Złóż dostawę na placu</button>}
        {site===wares[cargo.good].source?<button disabled={busy} onClick={()=>dispatch('return',{ticket:cargo.ticket})}>Oddaj ładunek i odbierz kaucję</button>:<button onClick={()=>go(wares[cargo.good].source)}>Wróć do dostawcy</button>}</>}
      {winner && <p>Ostatnią dostawę przywiózł kupiec {winner.name}. {site!==winner.site?<button onClick={()=>go(winner.site)}>Odwiedź stoiska</button>:token && !book.storm && <button disabled={busy||book.claimed} onClick={()=>dispatch('buy')}>{book.claimed?'Zboże odebrane':'Kup miarę zboża · 5 zł'}</button>}</p>}
    </>}
  </section>;
}
