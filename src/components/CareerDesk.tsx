import { useEffect, useRef, useState } from 'react';
import { assignments, crafts, craftRank, outfitting, worksites, type CareerBook, type Craft } from '../economy/newHope';
import { gameRequest } from '../utils/gameServer';

export function CareerDesk({token,site,choose}:{token:string|null;site:string;choose:(id:string)=>void}) {
  const [book,setBook]=useState<CareerBook>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [revision,reload]=useState(0);
  const attempt=useRef({site:'',id:''});
  const alive=useRef(true);
  useEffect(()=>{
    alive.current=true;
    const controller=new AbortController();
    gameRequest('/api/careers',{signal:controller.signal,headers:token?{Authorization:'Bearer '+token}:{}})
      .then(async r=>{if(!r.ok)throw Error();const b=await r.json();if(!controller.signal.aborted)setBook(b);})
      .catch(()=>{if(!controller.signal.aborted)setMessage('Księga nie odpowiada.');});
    return ()=>{alive.current=false;controller.abort();};
  },[token,revision]);
  const station=worksites.find(w=>w.id===site)??worksites[0];
  const craft=crafts[station.craft];
  const active=book?.jobs.find(j=>!j.finished);
  const recent=book?.jobs.find(j=>j.finished && j.site===station.id);
  const jobSite=worksites.find(w=>w.id===active?.site);
  const task=active && assignments[active.craft][active.task];
  async function write(action:'start'|'finish',choice?:number) {
    if(busy||!token)return;
    setBusy(true);setMessage('');
    if(action==='start' && attempt.current.site!==station.id) attempt.current={site:station.id,id:crypto.randomUUID()};
    const id=action==='finish'?active?.id:attempt.current.id;
    try {
      const r=await gameRequest('/api/careers',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({action,id,site:action==='finish'?active?.site:station.id,choice})});
      const data=await r.json();
      if(!alive.current)return;
      if(!r.ok){setMessage(data.error);if(r.status===409)reload(n=>n+1);return;}
      setBook(data);attempt.current={site:'',id:''};
      if(action==='finish'&&task)setMessage(task.reason);
    } catch {if(alive.current)setMessage('Nie udało się odebrać wpisu. Możesz ponowić.');}
    finally {if(alive.current)setBusy(false);}
  }
  return <section className="career-desk rounded-md border border-amber-800/60 bg-stone-950 p-3 space-y-2 text-sm" aria-label="Księga fachów">
    <h3 className="font-serif text-xl text-amber-200">Księga fachów</h3>
    <label>Warsztat <select aria-label="Warsztat" value={station.id} onChange={e=>choose(e.target.value)} className="bg-stone-900 p-1">
      {worksites.map(w=><option key={w.id} value={w.id}>{w.name} · {crafts[w.craft].name}</option>)}</select></label>
    <p>{station.description}</p>
    {book && <><p>Urobek warsztatu · {craft.product} · {book.stocks[station.id]??0}</p>
      {token && <ul className="flex flex-wrap gap-3 text-amber-100">{(Object.keys(crafts) as Craft[]).map(c=><li key={c}>
        {crafts[c].name} · {craftRank(book.progress[c]??0)} ({book.progress[c]??0})
      </li>)}</ul>}
      <a className="text-amber-200 underline" href="?miejsce=stocznia#znaki-burty">Obejrzyj znaki budowniczych na szkucie gildii</a>
      <details><summary className="cursor-pointer text-amber-200">Wyprawa trzech fachów · odpłynęło {book.sailings}</summary>
        <p>Sól na prowiant, klepki na poszycie, bursztyn na zapłatę dla pilota. Kiedy zbierze się komplet, statek odpływa.</p>
        {(Object.keys(outfitting) as Craft[]).map(c=><p key={c}>{crafts[c].name} · {Math.min(book.stores[c],outfitting[c])} / {outfitting[c]}</p>)}
        {book.lastShipment && <p>Ostatnią dostawę do wyprawy zamknięto w osadzie {worksites.find(w=>w.id===book.lastShipment?.site)?.name}. Znak kupca · {book.lastShipment.name}</p>}
      </details>
      {book.marks.length>0 && <p>Pierwsze znaki mistrzowskie · {book.marks.map(m=>crafts[m.craft].name+' — '+m.name).join(', ')}</p>}
      {active&&task ? <div className="space-y-2 border-t border-stone-700 pt-2"><strong>{active.patron} · {jobSite?.name}</strong>
        <p>{task.prompt}</p><div className="flex flex-wrap gap-2">{task.choices.map((answer,i)=><button type="button" className="road-chip" disabled={busy} key={answer} onClick={()=>void write('finish',i)}>{answer}</button>)}</div>
      </div> : token ? <button type="button" disabled={busy} className="road-primary" onClick={()=>void write('start')}>Przyjmij zlecenie</button> :
        <p>Zaloguj się w karcie konta, żeby rozpocząć naukę.</p>}
      {recent && <p>Ostatnia dostawa · {recent.patron} · {craft.product} · {recent.units}</p>}
      <small>Po 3 dostawach otwierają się nowe zadania. Po 8 zdobywasz tytuł mistrza tego fachu.</small></>}
    <p role="status">{message}</p>{!book && message && <button className="road-chip" onClick={()=>reload(n=>n+1)}>Odczytaj ponownie</button>}
  </section>;
}
