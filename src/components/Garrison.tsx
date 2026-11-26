import { useState } from 'react';
import { barterLot, type BarterTerms } from '../economy/barter';
import { WEATHER_CONDITIONS } from '../economy/economyEngine';
import {
  hallRules,
  newsAge,
  otherPost,
  roadRank,
  townNames,
  units,
  unitTypes,
  type Dispatch,
  type GarrisonBook,
  type GarrisonCommand,
} from '../economy/garrison';
import type { FeastTown } from '../economy/harvestLoaf';
import type { MillBook } from '../economy/mill';
import { cinemaFile } from './MerchantRoad';
import './garrison.css';

const date = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const left = (due: number, now: number) => Math.max(0, Math.ceil((due - now) / 1000)) + ' s';

function Terms({ terms }: { terms: BarterTerms[] }) {
  return (
    <ul>
      {terms.map((t) => (
        <li key={t.give}>
          {barterLot(t.give, t.giveQty)} za {barterLot(t.want, t.wantQty)}
        </li>
      ))}
    </ul>
  );
}
export function NewsBoard({ letters, now }: { letters: Dispatch[]; now: number }) {
  return (
    <div className="post-register">
      <h3>Wieści z traktu</h3>
      {!letters.length && (
        <p>
          Półka na odpisy jest pusta. Pierwsza wieść pojawi się, gdy wóz przywiezie umowę z drugiego
          miasta.
        </p>
      )}
      {letters.map((letter) => (
        <details key={letter.circle}>
          <summary>
            {townNames[letter.origin]} · umowa zawarta {newsAge(now, letter.signed)}
          </summary>
          <p>
            Tak wymieniono towary {date.format(letter.signed)}. Odpis dotarł{' '}
            {date.format(letter.arrival)}. Przywiózł go kupiec {letter.carrier}.
          </p>
          <Terms terms={letter.terms} />
          <small>
            {letter.road === 'detour' ? 'Objazd' : 'Przez most'} ·{' '}
            {WEATHER_CONDITIONS[letter.weather].name}
          </small>
        </details>
      ))}
    </div>
  );
}
type Props = {
  town: FeastTown;
  book: GarrisonBook;
  wallet: MillBook['wallet'];
  busy: boolean;
  sign: (c: GarrisonCommand, note: string) => Promise<boolean>;
  login: () => void;
};
export function Garrison({ town, book, wallet, busy, sign, login }: Props) {
  const [qty, setQty] = useState('1');
  const [escort, setEscort] = useState(false);
  const m = book.mine,
    rank = roadRank(m?.marks ?? 0),
    n = Number(qty);
  const canEscort = !!m && !m.duty && m.counts.guards > 0;
  const withEscort = canEscort && escort;
  const soldiers = m ? Object.values(m.counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <article className="garrison">
      <header className="field-hero garrison-cover">
        <img
          src={cinemaFile('garnizon.webp')}
          alt="Rycerz czeka przy kupieckim wozie u bramy kamiennego garnizonu."
        />
        <div>
          <span>{townNames[town]}</span>
          <h1>Koszary traktowe</h1>
        </div>
      </header>
      <div className="garrison-pages">
        <section>
          <h2>Księga załogi</h2>
          <p>
            Pisarz zapisuje pobór. Gwardziści znają zaułki targu, łucznicy obejmują wartę na murach,
            a topornicy ruszają z rycerzem na zwiad.
          </p>
          {!m || !wallet ? (
            <>
              <p>
                Pierwsze piętro kosztuje {hallRules.gold} złota i {hallRules.wood} bale elfickiego
                drewna.
              </p>
              <button className="inn-primary" onClick={login}>
                Zaloguj się, by objąć garnizon
              </button>
            </>
          ) : (
            <>
              <p>
                <b>{m.name}</b> · {rank.name} · {m.marks} pkt służby
                {rank.next !== null ? ' · kolejna ranga od ' + rank.next + ' pkt' : ''}
              </p>
              {m.duty && (
                <p role="status">
                  Służba w toku · {m.duty.label} · {townNames[m.duty.town]} · pozostało{' '}
                  {left(m.duty.due, book.now)}.
                </p>
              )}
              {m.level > 0 && (
                <p>
                  Załoga {soldiers} / {m.level * hallRules.beds} · dostępny pobór {m.available} /{' '}
                  {m.level * hallRules.hourly} na godzinę.
                  {m.refill && m.available < m.level * hallRules.hourly
                    ? ' Najbliższe odnowienie o ' + date.format(m.refill) + '.'
                    : ''}
                </p>
              )}
              {m.level < hallRules.max && (
                <div className="garrison-fund">
                  <button
                    className="inn-primary"
                    disabled={
                      busy || wallet.gold < hallRules.gold || (wallet.wood ?? 0) < hallRules.wood
                    }
                    onClick={() =>
                      sign(
                        { action: 'fundGarrison', level: m.level },
                        'Pisarz otworzył piętro dla załogi.',
                      )
                    }
                  >
                    {m.level ? 'Dobuduj piętro' : 'Ufunduj garnizon'}
                  </button>
                  <small>
                    {hallRules.gold} złota i {hallRules.wood} bale drewna · 100 miejsc i 4 rekrutów
                    na godzinę na każde piętro.
                  </small>
                </div>
              )}
              <p className="garrison-purse">
                W sakwie {wallet.gold} złota · w magazynie {wallet.grain} zboża i {wallet.wood ?? 0}{' '}
                drewna.
              </p>
              {m.level > 0 && (
                <label className="garrison-quantity">
                  Liczba rekrutów{' '}
                  <input
                    type="number"
                    min="1"
                    max={m.available}
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <div className="garrison-roster">
            {unitTypes.map((unit) => {
              const u = units[unit];
              const canHire =
                !!m &&
                !!wallet &&
                m.level > 0 &&
                Number.isSafeInteger(n) &&
                n >= 1 &&
                n <= m.available &&
                wallet.grain >= n &&
                wallet.gold >= n * u.price;
              return (
                <section key={unit}>
                  <h3>
                    {u.name}
                    {m && <small> · {m.counts[unit]} w koszarach</small>}
                  </h3>
                  <p>
                    {u.duty}. Załoga {u.crew} · {u.time} s · {u.marks} pkt służby.
                  </p>
                  {m && wallet && m.level > 0 && (
                    <div>
                      <button
                        disabled={busy || !canHire}
                        onClick={() =>
                          sign(
                            { action: 'recruitUnit', unit, quantity: n },
                            'Rekruci stawili się w koszarach.',
                          )
                        }
                      >
                        Zwerbuj
                      </button>
                      <button
                        disabled={
                          busy || !!m.duty || m.counts[unit] < u.crew || wallet.grain < u.crew
                        }
                        onClick={() =>
                          sign({ action: 'knightDuty', unit }, 'Rycerz objął służbę z załogą.')
                        }
                      >
                        Wyślij na służbę
                      </button>
                    </div>
                  )}
                  <small>
                    Werbunek jednej osoby kosztuje {u.price} złota i 1 zboże. Prowiant na służbę
                    wynosi {u.crew} zboża.
                  </small>
                </section>
              );
            })}
          </div>
        </section>
        <aside>
          <h2>Poczta traktowa</h2>
          <p>
            Weź odpis zamkniętej wymiany i zawieź go do drugiej karczmy. Na czas przewozu wpływają
            pogoda i przejezdność mostu.
          </p>
          <p>
            <b>Cel przewozu</b> · {townNames[otherPost(town)]}
          </p>
          {m?.wagon && (
            <p role="status">
              Wóz w drodze · {townNames[m.wagon.destination]} · {left(m.wagon.arrival, book.now)}
            </p>
          )}
          {!book.documents.length && (
            <p>
              Pisarz czeka na pierwszą wymianę podpisaną przez trzech kupców na miejscowym targu.
            </p>
          )}
          {!!book.documents.length && m && (
            <label className="garrison-escort">
              <input
                type="checkbox"
                checked={withEscort}
                disabled={busy || !canEscort}
                onChange={(e) => setEscort(e.target.checked)}
              />{' '}
              Zabierz rycerza i gwardzistę
            </label>
          )}
          <small>
            Sam wóz zużywa 1 zboże. Z eskortą zużyje 2 i dotrze o {4 + rank.seconds} s wcześniej.
            Rycerz wróci do koszar z 2 pkt służby.
          </small>
          {book.documents.map((d) => (
            <section key={d.id} className="garrison-document">
              <details>
                <summary>
                  Odpis umowy nr {d.id} · {newsAge(book.now, d.signed)}
                </summary>
                <Terms terms={d.terms} />
              </details>
              {d.sent ? (
                <small>Odpis wydany przewoźnikowi.</small>
              ) : (
                wallet && (
                  <button
                    disabled={busy || !!m?.wagon || wallet.grain < (withEscort ? 2 : 1)}
                    onClick={() =>
                      sign(
                        { action: 'carryNews', circle: d.id, escort: withEscort },
                        'Wóz z zapieczętowaną umową wyruszył.',
                      )
                    }
                  >
                    Zawieź odpis
                  </button>
                )
              )}
            </section>
          ))}
          <NewsBoard letters={book.letters} now={book.now} />
        </aside>
      </div>
    </article>
  );
}
