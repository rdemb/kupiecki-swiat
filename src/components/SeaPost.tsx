import { useEffect, useRef, useState } from 'react';
import { courierFee, courierSeconds, dispatchTopics, type Dispatch } from '../economy/seaMail';
import type { InnBook } from '../economy/merchantInn';
import { cinemaFile } from './MerchantRoad';

const stamp = (ms: number) => new Date(ms).toLocaleString('pl-PL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export function GuildPost({ letters }: { letters: Dispatch[] }) {
  return <section className="feast-table"><h3>Listy doręczone gildii</h3>
    {letters.length ? letters.map(l=><details key={l.id}><summary>{l.sender} · {stamp(l.delivered!)} · {l.vessel ?? 'goniec'}</summary>
      <p>{l.body}</p><small>Stan z chwili pieczętowania · {stamp(l.written)}</small></details>)
      : <p>Skrytka czeka na pierwszą przesyłkę.</p>}</section>;
}
export function SeaPost({book,busy,login,act}: {book: InnBook; busy:boolean; login:()=>void;
  act:(action:string,params:Record<string,unknown>,success:string)=>Promise<boolean>}) {
  const [guild,setGuild]=useState(''), [topic,setTopic]=useState('grain');
  const desk=useRef<HTMLElement>(null);
  useEffect(()=>{if(location.hash==='#poczta-okretowa') desk.current?.focus()},[]);
  const destination=guild || book.membership || book.groups[0]?.id;
  const pending=book.seaMail.sent.find(l=>l.delivered===null);
  return <section ref={desk} id="poczta-okretowa" tabIndex={-1} className="return-desk">
    <header style={{backgroundImage:'linear-gradient(90deg,#132125e8,transparent),url('+cinemaFile('list-przewozowy.webp')+')'}}>
      <h2>Poczta okrętowa</h2><p>Królewska Przystań · kancelaria nad zatoką</p></header>
    <div className="return-body"><p>Pisarz poświadczy dzisiejszy stan portu. Szyper zabierze zapieczętowaną wieść na wybrany rejs. Po jego zakończeniu adresaci odczytają ją przy stole gildii.</p>
    {pending ? <><h3>Twój list do gildii {pending.guild}</h3><p>{pending.body}</p>
      {pending.vessel ? <p>Na pokładzie szkuty „{pending.vessel}” · rejs {pending.voyage}.</p> : pending.roadDue ?
        <p>Goniec na trakcie · doręczenie {stamp(pending.roadDue)}.</p> :
        <><p>Koperta czeka na szypra. Gońcem dotrze również podczas sztormu.</p>
          <button disabled={busy} onClick={()=>act('roadPost',{notice:pending.id},'Goniec wyruszył.')}>Opłać gońca · {courierFee} zł · {courierSeconds} s</button>
          <button disabled={busy} onClick={()=>act('recallPost',{notice:pending.id},'List wrócił do nadawcy.')}>Odbierz kopertę</button></>}</> :
      <form onSubmit={e=>{e.preventDefault();if (!book.uid) login();else void act('sealPost',{kind:topic,groupId:destination},'Pisarz zapieczętował list.');}}>
        <label>Wieść <select value={topic} onChange={e=>setTopic(e.target.value)}>{Object.entries(dispatchTopics).map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label>
        <label>Gildia adresata <select value={destination} onChange={e=>setGuild(e.target.value)}>{book.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
        <button disabled={busy || !destination}>{book.uid?'Zapieczętuj list':'Zaloguj się, żeby nadać list'}</button></form>}
      {book.seaMail.sent.some(l=>l.delivered) && <details><summary>Pokwitowania doręczenia</summary>{book.seaMail.sent.filter(l=>l.delivered).map(l=><p key={l.id}>{l.guild} · {stamp(l.delivered!)} · {l.vessel ?? 'goniec lądowy'}</p>)}</details>}
    </div></section>;
}
