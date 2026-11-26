import { useEffect, useRef, useState } from 'react';
import { CITIES } from '../economy/economyEngine';
import { Testimony } from './SpurTrial';
import type { SpurPetition, SpurVerdict } from '../economy/spurTrial';
import { Crown } from 'lucide-react';
import { gameRequest } from '../utils/gameServer';

type Player = { uid: string; username: string; name: string; bars: number; prefix: string };
type Decree = { id: number; recipient: string; kind: string; bars: number; prefix: string; reason: string; created: string };
type Court = { spurPetitions?: SpurPetition[]; admin: boolean; bars: number; prefix: string; players: Player[]; history: Decree[] };

export function ImperialCourt({ token }: { token: string }) {
  const [court, setCourt] = useState<Court>();
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState('');
  const [kind, setKind] = useState('bars');
  const [bars, setBars] = useState('1');
  const [site,setSite] = useState('');
  const [prefix, setPrefix] = useState('Sir');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef({ body: '', id: '' });
  const sending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    gameRequest('/api/court', {signal:controller.signal, headers:{Authorization:'Bearer '+token}})
      .then(async r => { if (!r.ok) throw Error(); return r.json(); })
      .then(data => { if (!controller.signal.aborted) setCourt(data); })
      .catch(() => { if (!controller.signal.aborted) setMessage('Nie udało się odczytać skarbca.'); });
    return () => controller.abort();
  }, [token,revision]);
  const player = court?.players.find(p => p.uid===target);
  async function seal(load:number,verdict:SpurVerdict) {
    if (sending.current) return;
    sending.current=true;
    setBusy(true);
    setMessage('');
    try {
      const r = await gameRequest('/api/court/spurs',{method:'POST',headers:{
        Authorization:'Bearer '+token,'Content-Type':'application/json'
      },body:JSON.stringify({load,verdict})});
      const reply=await r.json();
      if (!r.ok) throw Error(reply.error || 'Nie udało się opieczętować świadectwa.');
      setMessage(verdict==='knighted' ? 'Pasowanie zapisano w koszarach i karczmie docelowej.' : 'Odmowę wpisano do akt próby.');
      setRevision(n=>n+1);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Sprawdź decyzję w księdze dworu.'); }
    finally { sending.current=false; setBusy(false); }
  }
  async function grant() {
    if (!player || sending.current) return;
    sending.current = true;
    setBusy(true);
    const payload = {recipient:player.uid, kind, value:kind==='bars' ? Number(bars) : prefix, reason:reason.trim(),site:kind==='prefix' && site || undefined};
    const body = JSON.stringify(payload);
    if (attempt.current.body!==body) attempt.current = {body,id:crypto.randomUUID()};
    try {
      const r = await gameRequest('/api/court/decrees', {method:'POST',headers:{
        Authorization:'Bearer '+token,'Content-Type':'application/json'
      },body:JSON.stringify({...payload,requestId:attempt.current.id})});
      if (!r.ok) throw Error();
      attempt.current = {body:'',id:''};
      setReason('');
      setMessage('Dekret zapisano.');
      setRevision(n => n+1);
    } catch { setMessage('Brak potwierdzenia dekretu. Możesz ponowić tę samą operację.'); }
    finally { sending.current = false; setBusy(false); }
  }
  const input = 'bg-slate-950 border border-slate-700 rounded px-2 py-2 w-full';
  return <section className="lg:col-span-12 rounded-lg border border-amber-700/50 bg-[#15130f] p-4 text-sm space-y-3">
    <header className="flex items-center gap-2 text-amber-300"><Crown size={19}/><h2 className="font-bold">{court?.admin ? 'Dwór Imperatora' : 'Skarbiec cesarski'}</h2>
      <button className="ml-auto text-xs underline" onClick={()=>setRevision(n=>n+1)}>Odśwież</button></header>
    {court && <p>Sztabki złota: <strong>{court.bars}</strong> · Przedrostek: <strong>{court.prefix || 'brak'}</strong></p>}
    {court?.admin && <>
      <section className="border-y border-amber-700/50 py-3">
        <h3 className="font-bold text-amber-200">Świadectwa do Próby ostrogi</h3>
        {!court.spurPetitions?.length && <p>Dwór czeka na świadectwo nadawcy ukończonej sztafety.</p>}
        {court.spurPetitions?.map(p=><article key={p.load} className="my-3 space-y-2 border-l-2 border-amber-700 pl-3">
          <h4 className="font-bold">{p.name} · kandydat do pasowania</h4>
          <Testimony petition={p}/>
          <button className="rounded bg-amber-300 px-3 py-2 text-slate-950" disabled={busy}
            onClick={()=>seal(p.load,'knighted')}>Nadaj tytuł Sir · {p.name}</button>
          <button className="ml-3 underline" disabled={busy} onClick={()=>seal(p.load,'declined')}>Odmów pasowania</button>
        </article>)}
      </section>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault(); void grant();}}>
        <label>Gracz<select required className={input} value={target} onChange={e=>setTarget(e.target.value)}>
          <option value="">Wybierz gracza</option>{court.players.map(p=><option key={p.uid} value={p.uid}>{[p.prefix,p.name].filter(Boolean).join(' ')} (@{p.username}) · {p.bars} szt.</option>)}</select></label>
        <label>Dekret<select className={input} value={kind} onChange={e=>setKind(e.target.value)}><option value="bars">Przyznaj sztabki złota</option><option value="prefix">Zmień przedrostek</option></select></label>
        {kind==='bars' ? <label>Liczba sztabek<input className={input} required type="number" min="1" max="1000" value={bars} onChange={e=>setBars(e.target.value)}/></label>
          : <label>Przedrostek<select className={input} value={prefix} onChange={e=>setPrefix(e.target.value)}>{['Sir','Dama','Baron','Baronessa','Hrabia','Hrabina',''].map(p=><option key={p} value={p}>{p || 'Cofnij tytuł'}</option>)}</select></label>}
        {kind==='prefix' && <label>Publikacja uzasadnienia w kronice<select value={site} className={input} onChange={e=>setSite(e.target.value)}><option value="">Tylko księga Dworu</option>{CITIES.map(c=><option key={c.id} value={c.id}>Publicznie · {c.name}</option>)}</select></label>}
        <label>Uzasadnienie<input className={input} required maxLength={180} value={reason} onChange={e=>setReason(e.target.value)}/></label>
        <button className="rounded bg-amber-400 p-2 font-bold text-slate-950 disabled:opacity-50" disabled={busy || !player || !reason.trim()}>Zatwierdź dekret</button>
      </form>
      <details><summary className="cursor-pointer">Księga dekretów ({court.history.length} ostatnich)</summary>
        <ol className="mt-2 divide-y divide-amber-900">{court.history.map(d=><li key={d.id} className="py-2">
          {d.created} UTC · @{court.players.find(p=>p.uid===d.recipient)?.username || '—'} · {d.kind==='bars' ? '+'+d.bars+' szt.' : d.prefix || 'Cofnięcie tytułu'} · {d.reason}
        </li>)}</ol></details>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
