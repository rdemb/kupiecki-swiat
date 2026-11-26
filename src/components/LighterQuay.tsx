import { useState } from 'react';
import { shipRules, type YardAction, type YardBook } from '../economy/shipyard';
import { lighterLoad } from '../economy/pilotage';
import { cinemaFile } from './MerchantRoad';

export function LighterQuay({
  book,
  busy,
  act,
  login,
}: {
  book: YardBook;
  busy: boolean;
  act: (action: YardAction) => void;
  login: () => void;
}) {
  const [price, setPrice] = useState('6');
  const offers = book.lighterOffers;
  const own = offers.find((o) => o.own);
  const selected = book.ship?.hull.id;
  const { wallet, pilotage } = book;
  const mark = pilotage.latest;
  const current =
    mark && !pilotage.storm && mark.edition === pilotage.edition ? mark : null;
  const loads = current ? lighterLoad(current.cm) : null;
  return (
    <section
      id="keja-lichtug"
      tabIndex={-1}
      className="lighter-quay"
      aria-labelledby="lighter-title"
    >
      <img
        src={cinemaFile('lichtuga.webp')}
        width="1200"
        height="675"
        loading="lazy"
        alt="Przewoźnik prowadzi płaskodenną łódź z dwiema beczkami wzdłuż burty szkuty."
      />
      <div className="lighter-body">
        <h2 id="lighter-title">Keja lichtug</h2>
        <p>
          Masz wprawę przy wiośle? Port użyczy ci płaskodennej łodzi. Podaj cenę
          za przewiezienie jednej lub dwóch beczek soli. Szyper wybierze
          przewoźnika, a po powrocie odbierzesz zapłatę.
        </p>
        <p className="lighter-water">
          {pilotage.storm
            ? 'Sztorm. Obie załogi czekają przy kei.'
            : !current
              ? 'Piloci czekają na świeży pomiar ławicy.'
              : loads
                ? 'Sonda wskazuje ' +
                  current.cm +
                  ' cm. Przełóż ' +
                  (loads === 1 ? 'jedną beczkę' : 'dwie beczki') +
                  ', żeby szkuta przeszła.'
                : current.cm >= 120
                  ? 'Sonda wskazuje ' +
                    current.cm +
                    ' cm. Pełna szkuta mieści się w przesmyku.'
                  : 'Sonda wskazuje ' +
                    current.cm +
                    ' cm. Nawet z lichtugą jest zbyt płytko.'}
        </p>
        <h3>Przewoźnicy przy kei</h3>
        {offers.length ? (
          <ul className="yard-lines">
            {offers.map((o) => (
              <li key={o.id}>
                <strong>{o.name}</strong>
                <span>{o.fee} zł za rejs</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>W tej chwili żaden przewoźnik nie czeka na zlecenie.</p>
        )}
        {wallet?.duty ? (
          <p>
            Na wodzie ze szkutą „{wallet.duty.vessel}”{' '}
            {wallet.duty.role === 'lighter' ? 'jako przewoźnik' : 'jako szyper'}
            . Po rozliczeniu zarobisz {wallet.duty.fee} zł na tym rejsie.
          </p>
        ) : own ? (
          <>
            <p>
              Twoja stawka obowiązuje do{' '}
              {new Date(own.expires).toLocaleTimeString('pl-PL', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              .
            </p>
            <button
              disabled={busy}
              onClick={() =>
                act({ action: 'recallLighter', ship: selected, offer: own.id })
              }
            >
              Wycofaj ofertę
            </button>
          </>
        ) : wallet ? (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              act({
                action: 'offerLighter',
                ship: selected,
                fee: Number(price),
              });
            }}
          >
            <label>
              Cena za przeprawę (zł)
              <input
                type="number"
                inputMode="numeric"
                required
                min={1}
                max={shipRules.wage}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <button disabled={busy}>
              Zgłoś lichtugę na {shipRules.hiringMs / 60000} min
            </button>
          </form>
        ) : (
          <button onClick={login}>Zaloguj się jako przewoźnik</button>
        )}
      </div>
    </section>
  );
}
