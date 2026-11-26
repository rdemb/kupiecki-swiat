import { useState } from 'react';
import { freightEstimate, returnTerms as terms, type FreightAccount, type ReturnOrder } from '../economy/returnFreight';

const money = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const zl = (amount: number) => money.format(amount) + ' zł';
function result(amount: number) {
  if (amount === 0) return 'na zero';
  return amount > 0 ? 'zysk ' + zl(amount) : 'strata ' + zl(-amount);
}
function valid(value: string, max: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max;
}

export function FreightQuote({ fee, ask, setFee, setAsk }: {
  fee: string; ask: string; setFee: (value: string) => void; setAsk: (value: string) => void;
}) {
  const estimate = freightEstimate(terms.lotCost, Number(fee), terms.sacks, Number(ask));
  return <div className="freight-quote">
    <label>Przewoźne za oba worki (zł)<input type="number" min="1" max={terms.maxFee}
      required step="1" value={fee} onChange={e => setFee(e.target.value)} /></label>
    <label>Cena sprzedaży za worek (zł)<input type="number" min="1" max={terms.maxAsk}
      required step="1" value={ask} onChange={e => setAsk(e.target.value)} /></label>
    <p aria-live="polite">{valid(fee, terms.maxFee) && valid(ask, terms.maxAsk) ?
      <>Zakup z przewozem wyniesie <b>{zl(estimate.outlay)}</b>. Żeby ten wydatek się zwrócił,
        oba worki muszą się sprzedać średnio po co najmniej <b>{zl(estimate.outlay / terms.sacks)}</b>.
        Po sprzedaży obu <b>{estimate.projected === 0 ? 'wyjdziesz na zero' :
          estimate.projected > 0 ? 'zarobisz ' + zl(estimate.projected) : 'stracisz ' + zl(-estimate.projected)}</b>.</>
      : 'Wpisz przewoźne i cenę w pełnych monetach.'}</p>
  </div>;
}

export function StallPrice({ order, entry, busy, change }: {
  order: ReturnOrder; entry?: FreightAccount; busy: boolean; change: (ask: number) => void;
}) {
  const [draft, setDraft] = useState(String(order.ask));
  const amount = Number(draft);
  const estimate = entry && freightEstimate(entry.cost, entry.fee, order.remaining, amount, entry.revenue);
  return <details className="freight-price">
    <summary>Zmień cenę na straganie</summary>
    <form onSubmit={e => { e.preventDefault(); if (valid(draft, terms.maxAsk) && amount !== order.ask) change(amount); }}>
      <label>Nowa cena za worek (zł)<input type="number" required min="1" max={terms.maxAsk}
        step="1" value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <button disabled={busy || !valid(draft, terms.maxAsk) || amount === order.ask}>Wywieś nową cenę</button>
      {estimate && estimate.breakEven !== null && valid(draft, terms.maxAsk) && <p aria-live="polite">
        {estimate.breakEven === 0 ? 'Dotychczasowa sprzedaż pokryła już wydatek.' :
          <>Sprzedając cały pozostały zapas, odzyskasz pełny wydatek od {zl(estimate.breakEven)} za worek.</>}{' '}
        Przy wpisanej cenie końcowy wynik to <b>{result(estimate.projected)}</b>.
      </p>}
    </form>
  </details>;
}

export function FreightLedger({ entries }: { entries: FreightAccount[] }) {
  return <details className="freight-ledger">
    <summary>Moja księga frachtowa</summary>
    {!entries.length ? <p>Pierwszy wpis pojawi się, gdy szkuta przywiezie twoje zboże.</p> : <>
      <p>Ostatnie dostawy. Każdy sprzedany worek ponosi równą część kosztu zakupu i przewozu.</p>
      <ol>{entries.map(row => {
        const total = row.cost + row.fee;
        const warehouse = row.sacks - row.sold - row.remaining;
        return <li key={row.id}>
          <div className="freight-ledger-line"><b>{row.vessel}</b>
            <time dateTime={new Date(row.landed).toISOString()}>{date.format(row.landed)}</time></div>
          <div>Zakup {zl(row.cost)} · przewóz {zl(row.fee)}</div>
          <div>Sprzedane worki {row.sold}/{row.sacks} · wpływy {zl(row.revenue)}</div>
          {row.sold > 0 && <div>Wynik na sprzedanych workach <strong>{result(row.revenue - total * row.sold / row.sacks)}</strong></div>}
          {row.remaining > 0 && <div>Pozostałe worki na straganie · {row.remaining}</div>}
          {warehouse > 0 && <div>Worki odebrane do magazynu · {warehouse}</div>}
        </li>;
      })}</ol>
    </>}
  </details>;
}
