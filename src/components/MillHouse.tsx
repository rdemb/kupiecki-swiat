import { useCallback, useEffect, useRef, useState } from 'react';
import { gameRequest } from '../utils/gameServer';
import {
  millRules as rules,
  type Consignee,
  type MillMark,
  type MillBook,
  type MillOrder,
} from '../economy/mill';
import type { FreightCommand } from '../economy/waybills';
import { PortLink } from './PortLink';
import { BarterMarket } from './BarterMarket';
import type { BarterCommand } from '../economy/barter';
import { HarvestFair } from './HarvestFair';
import type { FairCommand } from '../economy/harvestFair';
import { HarvestFeast, type FeastVisit } from './HarvestFeast';
import type { FeastCommand } from '../economy/harvestLoaf';
import { CommonField } from './CommonField';
import type { FieldCommand } from '../economy/commonField';
import CarrierMutual from './CarrierMutual';
import WaybillDesk from './WaybillDesk';
const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
type Command = FieldCommand | FreightCommand | FeastCommand | FairCommand | BarterCommand
  | { action: 'post'; quantity: number; price: number; purpose: Consignee }
  | { action: 'deliver'; order: number; quantity: number }
  | { action: 'cancel'; order: number }
  | { action: 'ration' };
interface Props {
  visit: FeastVisit;
  room?: 'mill' | 'freight' | 'mutual' | 'field' | 'feast' | 'fair' | 'barter';
  city: string;
  token: string | null;
  onAccount: () => void;
  onSettlement: (uid: string, mark: MillMark) => void;
}

function OrderLine({
  order: o,
  wallet,
  busy,
  onAction,
}: {
  order: MillOrder;
  wallet: MillBook['wallet'];
  busy: boolean;
  onAction: (c: Command, note: string) => Promise<boolean>;
}) {
  const [qty, setQty] = useState('');
  const max = Math.min(o.remaining, wallet?.grain ?? 0);
  const amount = qty === '' ? Math.min(5, max) : Number(qty);
  return (
    <article className="mill-order">
      <div className="mill-order-title">
        <h3>{o.issuer === null ? 'Zamówienie miejskie' : o.name}</h3>
        <span>{o.price} zł / worek</span>
      </div>
      <p>
        {o.purpose === 'mill' ? 'Przemiał dla miasta' : 'Do magazynu wystawcy'} · do{' '}
        {new Date(o.expires).toLocaleString('pl-PL', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <progress value={o.quantity - o.remaining} max={o.quantity} aria-label="Dostarczono worków" />
      <small>
        Brakuje {o.remaining} z {o.quantity} worków · w depozycie{' '}
        {number.format(o.remaining * o.price)} zł
      </small>
      {wallet &&
        (o.issuer === wallet.uid ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onAction({ action: 'cancel', order: o.id }, 'Pozostałe złoto wróciło do sakwy.')
            }
          >
            Odwołaj i odbierz depozyt
          </button>
        ) : max > 0 ? (
          <form
            className="mill-deliver"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await onAction(
                  { action: 'deliver', order: o.id, quantity: amount },
                  'Dostawa przyjęta. Zapłata trafiła do twojej sakwy.',
                )
              )
                setQty('');
            }}
          >
            <label>
              Worki
              <input
                type="number"
                min={1}
                max={max}
                required
                value={qty === '' ? amount : qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <button
              className="inn-primary"
              disabled={busy || !Number.isInteger(amount) || amount < 1 || amount > max}
            >
              Dostarcz za {number.format(amount * o.price)} zł
            </button>
          </form>
        ) : (
          <p>Do dostawy potrzebujesz zboża w magazynie.</p>
        ))}
    </article>
  );
}
export function MillHouse({ city, token, onSettlement, onAccount, visit, room = 'mill' }: Props) {
  const [book, setBook] = useState<MillBook | null>(null),
    [loadError, setLoadError] = useState(false),
    [error, setError] = useState(''),
    [note, setNote] = useState('');
  const [busy, setBusy] = useState(false),
    lock = useRef(false),
    sequence = useRef(0);
  const [qty, setQty] = useState('30'),
    [price, setPrice] = useState('28'),
    [purpose, setPurpose] = useState<Consignee>('mill');
  const retry = useRef<{ key: string; nonce: string } | null>(null);
  const endpoint = '/api/mill/' + city;
  const apply = useCallback(
    (b: MillBook) => {
      setBook(b);
      setLoadError(false);
      if (b.wallet) onSettlement(b.wallet.uid, b.wallet.mark);
    },
    [onSettlement],
  );
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const n = ++sequence.current;
    try {
      const r = await gameRequest(endpoint, {
        cache: 'no-store',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!r.ok) throw Error();
      const b = await r.json();
      if (n === sequence.current) apply(b);
    } catch {
      if (n === sequence.current) setLoadError(true);
    }
  }, [endpoint, token, apply]);
  useEffect(() => {
    void refresh();
    const update = () => {
      if (!document.hidden) void refresh();
    };
    const timer = setInterval(update, 4000);
    document.addEventListener('visibilitychange', update);
    return () => {
      sequence.current++;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [refresh]);
  async function action(c: Command, success: string) {
    if (!token || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setNote('');
    setError('');
    const n = ++sequence.current,
      key = JSON.stringify(c);
    if (retry.current?.key !== key) retry.current = { key, nonce: crypto.randomUUID() };
    try {
      const r = await gameRequest(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ ...c, nonce: retry.current.nonce }),
      });
      const b = await r.json();
      if (!r.ok) {
        if (r.status < 500) retry.current = null;
        throw Error(b.error ?? 'Nie udało się rozliczyć dokumentu.');
      }
      if (n !== sequence.current) return false;
      retry.current = null;
      apply(b);
      setNote(success);
      return true;
    } catch (e) {
      if (n === sequence.current)
        setError(
          e instanceof TypeError
            ? 'Utracono połączenie. Ponów dokument, aby sprawdzić rozliczenie.'
            : (e as Error).message,
        );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const cost = Number(qty) * Number(price);
  const invalid =
    !Number.isInteger(+qty) ||
    +qty < 1 ||
    +qty > rules.maxSacks ||
    !Number.isInteger(+price) ||
    +price < 1 ||
    +price > rules.maxPrice;
  return (
    <section className="mill-house" aria-label={room==='barter' ? 'Targ bez monety' : room==='fair' ? 'Plac dożynkowy' : room==='feast' ? 'Piekarnia dożynkowa' : room==='field' ? "Wspólne pole pod Srebrnym Gajem" : room==='mutual' ? "Kasa gildii" : room==='freight' ? "Listy przewozowe"  : "Kontrakty na zboże"}>
      {loadError && (
        <p role="alert">
          Księga młyna jest chwilowo niedostępna. <button onClick={refresh}>Odśwież</button>
        </p>
      )}
      {note && <p role="status">{note}</p>}
      {error && <p role="alert">{error}</p>}
      {!book && !loadError && <p>Młynarz otwiera księgę…</p>}
      {book && room==='barter' && (book.barter ? <BarterMarket key={city} city={city} book={book.barter} wallet={book.wallet} busy={busy} sign={action} login={onAccount}/> : <p role="alert">Księga targu jest chwilowo niedostępna.</p>)}
      {book && room==='fair' && (book.fair ? <HarvestFair city={city} fair={book.fair} wallet={book.wallet} busy={busy} login={onAccount} sign={action} visit={visit}/> : <p role="alert">Księga jarmarku jest chwilowo niedostępna.</p>)}
      {book && room==='feast' && (book.feast ? <HarvestFeast visit={visit} feast={book.feast} book={book} busy={busy} login={onAccount} sign={action}/> : <p role="alert">Księga wypieków jest chwilowo niedostępna.</p>)}
      {book && room==='mutual' && (book.freight?.insurance ? <CarrierMutual funds={book.freight.insurance} wallet={book.wallet} busy={busy} sign={action} onAccount={onAccount}/> : <p role="alert">Kasa czeka na połączenie z księgą.</p>)}
      {book && room==='field' && (book.field ? <CommonField bakery={()=>visit('feast')} field={book.field} wallet={book.wallet} busy={busy} sign={action} onAccount={onAccount}/> : <p role="alert">Księga pola jest chwilowo niedostępna.</p>)}
      {book && room==='freight' && (book.freight ? <WaybillDesk book={book} desk={book.freight} busy={busy} onAccount={onAccount} onAction={action}/> : <p role="alert">Kantor czeka na połączenie z księgą przewozów.</p>)}
      {book && room==='mill' && (
        <>
          {book.feast && <p><PortLink href="?miejsce=dozynki" go={()=>visit('feast')}>Przejdź do pieca dożynkowego</PortLink></p>}
          <dl className="mill-stocks">
            <div>
              <dt>Mąka w mieście</dt>
              <dd>
                {number.format(book.flour + (book.feast?.publicQuarters ?? 0)/4)} <small>miar</small>
              </dd>
            </div>
            <div>
              <dt>Ziarno do przemiału</dt>
              <dd>
                {book.grain} <small>/ 4 worki</small>
              </dd>
            </div>
            <div>
              <dt>Skarbiec młyna</dt>
              <dd>
                {number.format(book.treasury)} <small>zł</small>
              </dd>
            </div>
          </dl>
          <div className="inn-spread">
            <section>
              <h2>Zamówienia na zboże</h2>
              {book.orders.length === 0 && (
                <p>
                  Nie ma otwartych zamówień. Możesz ustalić własną cenę i wybrać, dokąd trafi
                  ziarno.
                </p>
              )}
              {book.orders.map((o) => (
                <OrderLine
                  key={o.id}
                  order={o}
                  wallet={book.wallet}
                  busy={busy}
                  onAction={action}
                />
              ))}
              <details className="mill-ledger">
                <summary>Ostatnie dostawy ({book.deliveries.length})</summary>
                {book.deliveries.length === 0 ? (
                  <p>Pierwszy list przewozowy czeka na podpis.</p>
                ) : (
                  <ol>
                    {book.deliveries.map((d) => (
                      <li key={d.id}>
                        <strong>{d.name}</strong>
                        {d.guild ? ' · ' + d.guild : ''}
                        <br />
                        {d.quantity} worków · {number.format(d.quantity * d.price)} zł ·{' '}
                        {d.purpose === 'mill' ? 'młyn' : 'magazyn kupca'}{' '}
                        <time>
                          {new Date(d.at).toLocaleString('pl-PL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
              </details>
            </section>
            <aside>
              <h2>Wystaw kontrakt</h2>
              {book.wallet ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(
                      { action: 'post', quantity: +qty, price: +price, purpose },
                      'Kontrakt wisi w karczmie. Złoto czeka na dostawców.',
                    );
                  }}
                >
                  <p className="mill-wallet">
                    Twoja sakwa · {number.format(book.wallet.gold)} zł
                    <br />
                    Twój magazyn · {book.wallet.grain} worków zboża
                  </p>
                  <label>
                    Dokąd trafi ziarno?
                    <select
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value as Consignee)}
                    >
                      <option value="mill">Do młyna dla miasta</option>
                      <option value="merchant">Do mojego magazynu</option>
                    </select>
                  </label>
                  <div className="mill-terms">
                    <label>
                      Liczba worków
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        required
                        min={1}
                        max={rules.maxSacks}
                      />
                    </label>
                    <label>
                      Złoto za worek
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        min={1}
                        max={rules.maxPrice}
                      />
                    </label>
                  </div>
                  <small>
                    Każda dostawa jest opłacana z depozytu. Niewydane złoto wraca po 24 godzinach
                    albo po odwołaniu zlecenia.
                  </small>
                  <button
                    className="inn-primary"
                    disabled={busy || invalid || cost > book.wallet.gold}
                  >
                    Złóż w depozycie {number.format(cost)} zł
                  </button>
                </form>
              ) : (
                <>
                  <p>
                    Ustal liczbę worków i cenę. Kilku kupców może wspólnie zrealizować jedno
                    zamówienie.
                  </p>
                  <button className="inn-primary" onClick={onAccount}>
                    Zaloguj się w młynie
                  </button>
                </>
              )}
              <h3>Chleb na drogę</h3>
              <p>
                Cztery worki zboża dają trzy miary mąki. Piekarze zużywają jedną miarę co dziesięć
                minut, dopóki mają zapas.
              </p>
              <p>
                Prowiant kosztuje {rules.rationGold} zł i {rules.rationFlour} miary miejskiej mąki.
                Skraca twój następny przewóz kancelarii o {rules.rationSeconds} sekund.
              </p>
              {book.wallet && (
                <button
                  disabled={
                    busy ||
                    book.wallet.ration ||
                    book.flour < rules.rationFlour ||
                    book.wallet.gold < rules.rationGold
                  }
                  onClick={() =>
                    action({ action: 'ration' }, 'Prowiant jest gotowy na następny konwój.')
                  }
                >
                  {book.wallet.ration ? 'Masz prowiant na drogę' : 'Kup prowiant'}
                </button>
              )}
              <details>
                <summary>Kiedy zamawia miasto?</summary>
                <p>
                  W czasie ulewy lub mrozu, gdy pozostało mniej niż 12 miar mąki, młyn może raz na
                  dobę zamówić {rules.citySacks} worków. Musi mieć{' '}
                  {rules.cityPrice * rules.citySacks} zł w skarbcu. Wpływy z prowiantu wracają do
                  kasy młyna.
                </p>
              </details>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
