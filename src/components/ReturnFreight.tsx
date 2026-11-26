import { useEffect, useRef, useState } from 'react';
import { returnTerms as terms, type ReturnDeskAction, type ReturnOrder, type FreightAccount, type StallBid } from '../economy/returnFreight';
import type { Charter, YardBook } from '../economy/shipyard';
import { gameRequest } from '../utils/gameServer';
import { FreightLedger, FreightQuote, StallPrice } from './FreightLedger';
import { StallBargains, BargainReceipts } from './StallBargains';
import { PortLink } from './PortLink';
import { cinemaFile } from './MerchantRoad';
import './returnFreight.css';

type DeskProps = {
  orders: ReturnOrder[]; accounts: FreightAccount[]; bids: StallBid[]; token: string | null; login: () => void; yard: () => void;
  update: (page: YardBook) => void; refresh: () => void;
};
export function ReturnFreightDesk({ orders, accounts, bids, token, login, yard, update, refresh }: DeskProps) {
  const [fee, setFee] = useState('8'), [ask, setAsk] = useState('32');
  const [busy, setBusy] = useState(false), [note, setNote] = useState('');
  const lock = useRef(false), retry = useRef<{ key: string; nonce: string } | null>(null);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (location.hash === '#fracht-powrotny') panel.current?.focus();
    if (location.hash === '#targowanie') panel.current?.querySelector<HTMLElement>('#targowanie')?.focus();
  }, []);
  const mine = orders.some(o => o.own);
  async function send(cmd: ReturnDeskAction, message: string) {
    if (!token || lock.current) return;
    const key = JSON.stringify(cmd);
    if (retry.current?.key !== key) retry.current = { key, nonce: crypto.randomUUID() };
    lock.current = true;
    setBusy(true);
    setNote('');
    try {
      const response = await gameRequest('/api/shipyard', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cmd, nonce: retry.current.nonce }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) retry.current = null;
        setNote(result.error ?? 'Karczmarz nie potwierdził kwitu.');
        refresh();
        return;
      }
      retry.current = null;
      update(result);
      setNote(message);
    } catch {
      setNote('Brak potwierdzenia. Możesz ponowić tę samą czynność.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return <section ref={panel} id="fracht-powrotny" tabIndex={-1} className="return-desk" aria-labelledby="return-title">
    <header style={{ backgroundImage: 'linear-gradient(90deg,#152525ed,#15252542),url(' + cinemaFile('piloci.webp') + ')' }}>
      <h2 id="return-title">Fracht powrotny</h2>
      <p>Reda → Królewska Przystań</p>
    </header>
    <div className="return-body">
      <p>Zamów dwa worki zboża u kupców na redzie. Szyper może zabrać je po dostawie soli.
        Po powrocie dostanie przewoźne, a twoje zboże trafi na stragan po cenie, którą wpiszesz.</p>
      {!mine && (token ? <form onSubmit={e => { e.preventDefault(); void send({ action:'postReturn', fee:Number(fee), ask:Number(ask) }, 'List wisi w karczmie. Złoto odłożone.'); }}>
        <FreightQuote {...{ fee, ask, setFee, setAsk }} />
        <p>Dwa worki kosztują {terms.lotCost} zł. Jeśli nikt nie przyjmie listu przez {terms.orderMs/60000} minut, cały depozyt wróci do sakwy.</p>
        <button type="submit" disabled={busy}>Wywieś list i odłóż {terms.lotCost + Number(fee)} zł</button>
      </form> : <>
        <details className="freight-price"><summary>Policz opłacalność rejsu</summary>
          <FreightQuote {...{ fee, ask, setFee, setAsk }} /></details>
        <button onClick={login}>Zaloguj się, żeby zamówić fracht</button></>)}
      {orders.some(o=>o.state !== 'stall') && <h3>Listy frachtowe</h3>}
      {orders.filter(o=>o.state !== 'stall').map(o=><div className="return-lot" key={o.id}>
        <b>{o.name}</b> · 2 worki zboża · {o.fee} zł dla szypra.
        {o.state === 'aboard' ? <> Fracht przyjęła szkuta „{o.vessel}”.{' '}
          <PortLink href={'?miejsce=stocznia&szkuta='+o.ship} go={yard}>Zobacz rejs</PortLink></> :
          <> List czeka do {new Date(o.expires).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}.{' '}
          {o.own ? <button disabled={busy} onClick={()=>send({action:'cancelReturn',offer:o.id},'Pełny depozyt wrócił do sakwy.')}>Wycofaj list</button> :
            <PortLink href="?miejsce=stocznia" go={yard}>Przejdź do stoczni</PortLink>}</>}
      </div>)}
      <h3 id="targowanie" tabIndex={-1}>Stragan na nabrzeżu</h3>
      <p>Kup worek po cenie z tabliczki albo zostaw sprzedawcy własną ofertę. Tylko wy dwoje widzicie proponowaną cenę.</p>
      {!orders.some(o=>o.state==='stall') && <p>Stragan czeka na dostawę z redy.</p>}
      {orders.filter(o=>o.state==='stall').map(o=><div className="return-lot" key={o.id}>
        <b>{o.name}</b> · szkuta „{o.vessel}” · na straganie {o.remaining === 1 ? '1 worek' : o.remaining + ' worki'} · {o.ask} zł za worek.{' '}
        {o.own ? <>
          <StallPrice key={o.ask} order={o} entry={accounts.find(entry => entry.id === o.id)} busy={busy}
            change={ask => void send({action:'repriceReturn', offer:o.id, quote:o.ask, ask}, 'Nowa cena wisi na straganie.')} />
          <button disabled={busy} onClick={()=>send({action:'collectReturn',offer:o.id},'Pozostałe zboże trafiło do twojego magazynu.')}>Odbierz pozostałe zboże</button></> :
          token ? <button disabled={busy} onClick={()=>send({action:'buyReturn',offer:o.id,quote:o.ask},'Worek trafił do twojego magazynu. Kupiec otrzymał zapłatę.')}>Kup worek za {o.ask} zł</button> :
          <button onClick={login}>Zaloguj się, by kupić zboże</button>}
        {token && <StallBargains order={o} bids={bids.filter(b => b.offer === o.id && b.state === 'open')} busy={busy} send={send}/>}
      </div>)}
      {token && <BargainReceipts bids={bids} />}
      {token && <FreightLedger entries={accounts} />}
      {note && <p role="status">{note}</p>}
    </div>
  </section>;
}

export function ReturnOrderAtSea({ job, orders, closed, busy, choose }: {
  job: Charter; orders: ReturnOrder[]; closed: boolean; busy: boolean; choose: (order?: number) => void;
}) {
  const cargo = job.backhaul?.cargo;
  if (cargo) return <p>List powrotny · {cargo.name}. Dwa worki zboża, {cargo.fee} zł przewoźnego po powrocie.</p>;
  if (closed || job.backhaul) return <p>Dyspozycja na powrót · pusta ładownia.</p>;
  if (!job.myJob) return null;
  const choices = orders.filter(o => o.state === 'open' && !o.own);
  return <fieldset className="return-choice"><legend>Ładownia na powrót</legend>
    <p>Załadunek dwóch worków wydłuży rejs o {terms.loadMs/1000} s. Dyspozycję możesz wydać do końca rozładunku soli.</p>
    {!choices.length && <p>W karczmie nie ma teraz zlecenia od innego kupca.</p>}
    {choices.map(o => <button key={o.id} disabled={busy} onClick={()=>choose(o.id)}>Zabierz zboże · {o.name} · {o.fee} zł</button>)}
    <button disabled={busy} onClick={()=>choose()}>Po rozładunku wracaj z pustą ładownią</button>
  </fieldset>;
}
