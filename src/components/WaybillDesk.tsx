import { useEffect, useState } from 'react';
import { Wheat } from 'lucide-react';
import type { MillBook } from '../economy/mill';
import {
  journeySeconds,
  wagonLimit,
  type FreightBook,
  type FreightCommand,
  type Waybill,
} from '../economy/waybills';
import { WEATHER_CONDITIONS } from '../economy/economyEngine';
import './waybills.css';

type Props = {
  book: MillBook;
  desk: FreightBook;
  busy: boolean;
  onAccount: () => void;
  onAction: (command: FreightCommand, message: string) => Promise<boolean>;
};
const roadNames = { bridge: 'Most w Srebrnym Gaju', detour: 'Górny bród' };
const time = (t: number) =>
  new Date(t).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
const plural = new Intl.PluralRules('pl');
function sacks(n: number) {
  const form = plural.select(n);
  return (
    n + ' ' + (form === 'one' ? 'worek' : form === 'few' ? 'worki' : 'worków')
  );
}
function Passage({ bill, now }: { bill: Waybill; now: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const tick = window.setInterval(
      () => setElapsed(performance.now() - start),
      500,
    );
    return () => window.clearInterval(tick);
  }, [now]);
  if (!bill.road || bill.departed === null || bill.due === null) return null;
  const duration = Math.max(1, bill.due - bill.departed);
  const progress = Math.min(
    100,
    Math.max(0, (100 * (now + elapsed - bill.departed)) / duration),
  );
  return (
    <div className="load-route">
      <div
        className="load-track"
        role="progressbar"
        aria-label="Droga do młyna"
        aria-valuenow={Math.floor(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ left: progress + '%' }}>
          <Wheat aria-hidden="true" size={15} />
        </span>
      </div>
      <div className="load-ends">
        <span>Przystań</span>
        <span>{roadNames[bill.road]}</span>
        <span>Młyn</span>
      </div>
      <p>
        {progress >= 100
          ? 'Wóz u młynarza. Trwa odbiór.'
          : 'Do rozładunku około ' +
            Math.ceil((bill.due - now - elapsed) / 1000) +
            ' s.'}
      </p>
    </div>
  );
}
export default function WaybillDesk({
  book,
  desk,
  busy,
  onAction,
  onAccount,
}: Props) {
  const [quantity, setQuantity] = useState('8'),
    [price, setPrice] = useState('20'),
    [wage, setWage] = useState('18');
  const total = +quantity * +price + +wage;
  const valid =
    [+quantity, +price, +wage].every((n) => Number.isInteger(n) && n >= 1) &&
    +quantity <= wagonLimit &&
    +price <= 1000 &&
    +wage <= 1000;
  const terms = [
    {
      label: 'Worki zboża',
      value: quantity,
      set: setQuantity,
      max: wagonLimit,
    },
    { label: 'Złoto za worek', value: price, set: setPrice, max: 1000 },
    { label: 'Zapłata za kurs', value: wage, set: setWage, max: 1000 },
  ];
  const { wallet } = book;
  return (
    <div className="waybill-desk">
      <div className="waybill-weather">
        <strong>
          {desk.closed
            ? 'Most zamknięty · przejazd brodem'
            : 'Most w Srebrnym Gaju otwarty'}
        </strong>
        <span>{WEATHER_CONDITIONS[desk.weather].name}</span>
      </div>
      <div className="inn-spread">
        <section>
          <h2>Wozy na trakcie</h2>
          {desk.bills.length === 0 && (
            <p>
              Żaden wóz nie czeka na załadunek. Wystaw list, aby sprowadzić
              zboże z Królewskiej Przystani do młyna w Srebrnym Gaju.
            </p>
          )}
          {desk.bills.map((b) => (
            <article key={b.id} className="freight-slip">
              <div className="freight-seal">
                List {b.id}
                <span>
                  {b.status === 'open'
                    ? 'Czeka na zboże'
                    : b.status === 'sealed'
                      ? 'Ładunek gotowy'
                      : 'W drodze'}
                </span>
              </div>
              <h3>{sacks(b.quantity)} dla młyna</h3>
              <p>
                Zamawia {b.buyerName}. Za ziarno {b.price * b.quantity} zł, dla
                woźnicy {b.wage} zł.
              </p>
              {b.growerName && (
                <p>Na pieczęci dostawcy widnieje podpis „{b.growerName}”.</p>
              )}
              {b.status === 'rolling' && (
                <>
                  <p>Wóz prowadzi {b.driverName}.</p>
                  <Passage bill={b} now={desk.now} />
                </>
              )}
              {b.status !== 'rolling' && (
                <small>
                  Na wyjazd do{' '}
                  {new Date(b.expires).toLocaleString('pl-PL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  .
                </small>
              )}
              {wallet && b.status === 'open' && !b.mine && (
                <button
                  disabled={busy || wallet.grain < b.quantity}
                  onClick={() =>
                    onAction(
                      { action: 'seal', bill: b.id },
                      'Ziarno opieczętowane. Wóz może ruszać.',
                    )
                  }
                >
                  {wallet.grain < b.quantity
                    ? 'Za mało zboża w magazynie'
                    : 'Załaduj ' + sacks(b.quantity) + ' z magazynu'}
                </button>
              )}
              {wallet && b.status === 'sealed' && (
                <div className="freight-routes">
                  {(['bridge', 'detour'] as const).map((road) => (
                    <button
                      key={road}
                      disabled={busy || (road === 'bridge' && desk.closed)}
                      onClick={() =>
                        onAction(
                          { action: 'depart', bill: b.id, road },
                          'Wóz jest w drodze. Młyn rozliczy list po przyjeździe.',
                        )
                      }
                    >
                      {road === 'bridge' ? 'Przez most' : 'Górnym brodem'} ·{' '}
                      {road === 'bridge' && desk.closed
                        ? 'zamknięty'
                        : journeySeconds(b.quantity, desk.weather, road) + ' s'}
                    </button>
                  ))}
                </div>
              )}
              {!!b.mine && b.status !== 'rolling' && (
                <button
                  disabled={busy}
                  onClick={() =>
                    onAction(
                      { action: 'withdraw', bill: b.id },
                      'List odwołany. Depozyt i powierzony towar zwrócono właścicielom.',
                    )
                  }
                >
                  Odwołaj list
                </button>
              )}
            </article>
          ))}
          <h2>Pokwitowania młynarza</h2>
          {desk.receipts.length === 0 ? (
            <p>Księga czeka na pierwszy przyjazd.</p>
          ) : (
            <ol className="freight-receipts">
              {desk.receipts.map((b) => (
                <li key={b.id}>
                  <strong>
                    List {b.id} · {sacks(b.quantity)}
                  </strong>
                  <span>
                    {b.road && roadNames[b.road]} ·{' '}
                    {new Date(b.due!).toLocaleDateString('pl-PL')} ·{' '}
                    {time(b.due!)}
                  </span>
                  <p>
                    Na liście widnieje podpis „{b.buyerName}”. Za ziarno
                    wypłacono {b.quantity * b.price} zł ({b.growerName}), za
                    przewóz {b.wage} zł ({b.driverName}).
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
        <aside>
          <h2>Wystaw list przewozowy</h2>
          <p>
            Płacisz osobno za ziarno i przewóz. Złoto zostaje w depozycie do
            przyjazdu wozu. Dostawca może sam chwycić za lejce albo zostawić
            kurs innemu graczowi.
          </p>
          {wallet ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valid)
                  void onAction(
                    {
                      action: 'commission',
                      quantity: +quantity,
                      price: +price,
                      wage: +wage,
                    },
                    'List wisi w karczmie. Złoto czeka w depozycie.',
                  );
              }}
            >
              <p className="mill-wallet">
                W sakwie {wallet.gold} zł · w magazynie {sacks(wallet.grain)}
              </p>
              <div className="mill-terms">
                {terms.map((t) => (
                  <label key={t.label}>
                    {t.label}
                    <input
                      type="number"
                      min={1}
                      max={t.max}
                      value={t.value}
                      required
                      onChange={(e) => t.set(e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <small>
                Jeśli nikt nie wyjedzie w ciągu doby, złoto i worki wrócą do
                właścicieli.
              </small>
              <button
                className="inn-primary"
                disabled={busy || !valid || total > wallet.gold}
              >
                Złóż {valid ? total : '…'} zł w depozycie
              </button>
            </form>
          ) : (
            <button className="inn-primary" onClick={onAccount}>
              Zaloguj się w kantorze
            </button>
          )}
          <dl className="mill-stocks">
            <div>
              <dt>Mąka w Srebrnym Gaju</dt>
              <dd>
                {book.flour} <small>miar</small>
              </dd>
            </div>
            <div>
              <dt>Ziarno do przemiału</dt>
              <dd>
                {book.grain} <small>/ 4</small>
              </dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
