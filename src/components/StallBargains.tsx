import { useState } from 'react';
import { returnTerms, type BargainAction, type ReturnOrder, type StallBid } from '../economy/returnFreight';

const expiresAt = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
type Props = {
  order: ReturnOrder; bids: StallBid[]; busy: boolean;
  send: (cmd: BargainAction, message: string) => void;
};

export function StallBargains({ order, bids, busy, send }: Props) {
  const [draft, setDraft] = useState('');
  const price = Number(draft);
  if (order.own) {
    if (!bids.length) return null;
    return <section className="stall-bids" aria-label="Oferty do rozpatrzenia">
      <h4>Oferty za jeden worek</h4>
      <ul>{bids.map(bid => <li key={bid.id}>
        <strong>{bid.buyer} · {bid.amount} zł</strong><span>Do {expiresAt.format(bid.expires)}</span>
        <div><button disabled={busy} onClick={() => send({ action:'takeReturnBid', offer:order.id, bid:bid.id },
          'Umowa zawarta. Monety są w twojej sakwie, a worek trafił do kupującego.')}>Przyjmij {bid.amount} zł</button>
        <button disabled={busy} onClick={() => send({ action:'refuseReturnBid', offer:order.id, bid:bid.id },
          'Oferta odrzucona. Kupujący odzyskał monety.')}>Odrzuć ofertę</button></div>
      </li>)}</ul>
    </section>;
  }
  const mine = bids[0];
  if (mine) return <div className="stall-bids"><strong>Twoja oferta · {mine.amount} zł za worek</strong>
    <p>Monety czekają u karczmarza do {expiresAt.format(mine.expires)}. Możesz je wcześniej odebrać.</p>
    <button disabled={busy} onClick={() => send({ action:'recallReturnBid', offer:order.id, bid:mine.id },
      'Oferta wycofana. Monety wróciły do twojej sakwy.')}>Wycofaj ofertę</button>
  </div>;
  if (order.ask <= 1) return null;
  return <details className="freight-price"><summary>Targuj się o worek</summary>
    <form onSubmit={e => { e.preventDefault();
      if (Number.isInteger(price) && price > 0 && price < order.ask)
        send({ action:'bidReturn', offer:order.id, quote:order.ask, ask:price }, 'Karczmarz przyjął sakiewkę i przekazał ofertę sprzedawcy.');
    }}>
      <label>Twoja cena za worek (zł)<input type="number" required step="1" min="1" max={order.ask - 1}
        value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <button disabled={busy || !Number.isInteger(price) || price < 1 || price >= order.ask}>Zostaw ofertę</button>
      <p>Karczmarz przechowa monety przez {returnTerms.bidMs / 3600000} godziny. Jeśli sprzedawca przyjmie ofertę, worek trafi
        do twojego magazynu, nawet gdy wyjdziesz z gry. Gdy zabraknie towaru albo minie termin, odzyskasz monety.</p>
    </form>
  </details>;
}

const outcome = {
  accepted: 'Worek trafił do magazynu',
  declined: 'Sprzedawca odmówił · zwrot',
  withdrawn: 'Oferta wycofana · zwrot',
  expired: 'Termin minął · zwrot',
  closed: 'Partia zeszła ze straganu · zwrot',
  cheaper: 'Nowa cena na straganie jest równa twojej lub niższa · zwrot',
};
export function BargainReceipts({ bids }: { bids: StallBid[] }) {
  const finished = bids.filter(bid => bid.state !== 'open');
  if (!finished.length) return null;
  return <details className="freight-ledger"><summary>Kwitki z targowania</summary>
    <ol>{finished.map(bid => <li key={bid.id}>
      <b>Stragan · {bid.seller}</b><div>{bid.state !== 'open' && outcome[bid.state]} · {bid.amount} zł</div>
    </li>)}</ol>
  </details>;
}
