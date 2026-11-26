import { useState } from 'react';
import { CITIES } from '../economy/economyEngine';
import {
  barterGoods,
  barterNames,
  maxBarterLot,
  type BarterBook,
  type BarterCircle,
  type BarterCommand,
  type BarterGood,
  type BarterOffer,
  type BarterTerms,
} from '../economy/barter';
import type { MillBook } from '../economy/mill';
import { cinemaFile } from './MerchantRoad';
import './barterMarket.css';

type Props = {
  city: string;
  book: BarterBook;
  wallet: MillBook['wallet'];
  busy: boolean;
  sign: (cmd: BarterCommand, note: string) => Promise<boolean>;
  login: () => void;
};
const lot = (item: BarterGood, qty: number) => qty + ' × ' + barterNames[item];
const stockKey = { zboze: 'grain', drewno_elfickie: 'wood', zelazo: 'iron' } as const;
function missingOffer(waiting: BarterOffer[]) {
  for (const a of waiting) {
    const b = waiting.find(
      (o) => a.want === o.give && a.wantQty === o.giveQty && o.want !== a.give,
    );
    if (b)
      return {
        first: a,
        second: b,
        terms: { give: b.want, giveQty: b.wantQty, want: a.give, wantQty: a.giveQty },
      };
  }
}
function Contract({ circle, busy, sign }: { circle: BarterCircle } & Pick<Props, 'busy' | 'sign'>) {
  const seals = circle.offers.filter((o) => o.sealed).length;
  const mine = circle.offers.find((o) => o.mine);
  return (
    <article className="barter-contract">
      <h3>
        {circle.completed ? 'Wymiana zamknięta' : 'Umowa do podpisania'}{' '}
        <small>nr {circle.id}</small>
      </h3>
      <ol>
        {circle.offers.map((o) => {
          const recipient = circle.offers.find((p) => p.want === o.give)!;
          return (
            <li key={o.id}>
              <span
                className={'barter-seal' + (o.sealed ? ' signed' : '')}
                aria-label={o.sealed ? 'Podpisano' : 'Czeka na podpis'}
              >
                {o.sealed ? '✓' : '·'}
              </span>
              <span>
                <strong>{o.name}</strong>
                {o.mine ? ' (ty)' : ''}
                <br />
                {lot(o.give, o.giveQty)} → {recipient.name}
              </span>
            </li>
          );
        })}
      </ol>
      {circle.completed ? (
        <p>Towary trafiły do trzech magazynów.</p>
      ) : (
        <>
          <p>{seals} z 3 pieczęci</p>
          {mine && (
            <>
              <p>Dostaniesz {lot(mine.want, mine.wantQty)}.</p>
              {!mine.sealed && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void sign(
                      { action: 'sealBarter', circle: circle.id, offer: mine.id },
                      'Twoją pieczęć wpisano do księgi.',
                    )
                  }
                >
                  Przyłóż pieczęć
                </button>
              )}
              <button
                className="barter-quiet"
                disabled={busy}
                onClick={() =>
                  void sign(
                    { action: 'withdrawBarter', offer: mine.id },
                    'Odebrano twój depozyt. Pozostali kupcy mogą zawrzeć nową umowę.',
                  )
                }
              >
                Wycofaj ofertę i odbierz towar
              </button>
            </>
          )}
        </>
      )}
    </article>
  );
}
export function BarterMarket({ city, book, wallet, busy, sign, login }: Props) {
  const [terms, setTerms] = useState<BarterTerms>({
    give: 'zboze',
    giveQty: 1,
    want: 'drewno_elfickie',
    wantQty: 1,
  });
  const own = book.waiting.find((o) => o.mine);
  const engaged = !!own || book.circles.some((c) => c.offers.some((o) => o.mine));
  const missing = missingOffer(book.waiting);
  const stock = wallet?.[stockKey[terms.give]] ?? 0;
  function input(side: 'give' | 'want', label: string) {
    const opposite = side === 'give' ? 'want' : 'give';
    const qty = side === 'give' ? 'giveQty' : 'wantQty';
    return (
      <fieldset>
        <legend>{label}</legend>
        <label>
          Towar
          <select
            value={terms[side]}
            onChange={(e) => {
              const next = e.target.value as BarterGood;
              setTerms((t) => ({
                ...t,
                [side]: next,
                [opposite]: next === t[opposite] ? t[side] : t[opposite],
              }));
            }}
          >
            {barterGoods.map((g) => (
              <option key={g} value={g}>
                {barterNames[g]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ilość
          <input
            type="number"
            min="1"
            max={maxBarterLot}
            required
            step="1"
            value={terms[qty] || ''}
            onChange={(e) => setTerms({ ...terms, [qty]: Number(e.target.value) })}
          />
        </label>
      </fieldset>
    );
  }
  return (
    <article className="barter-market">
      <header
        className="barter-header"
        style={{
          backgroundImage:
            'linear-gradient(90deg,rgba(20,15,11,.94),rgba(20,15,11,.64) 55%,rgba(20,15,11,.14)),url(' +
            cinemaFile('rynek.webp') +
            ')',
        }}
      >
        <span>{CITIES.find((c) => c.id === city)?.name}</span>
        <h1>Targ bez monety</h1>
        <p>
          Powiedz, co masz i czego szukasz. Gdy oferty trzech kupców połączą się w krąg, trzecia
          pieczęć przeniesie towar do każdego magazynu.
        </p>
      </header>
      <div className="barter-content">
        <section>
          <h2>Księga ofert</h2>
          {book.waiting.length === 0 ? (
            <p>Na stole nie leży jeszcze żadna wolna oferta.</p>
          ) : (
            <ul className="barter-offers">
              {book.waiting.map((o) => (
                <li key={o.id}>
                  <strong>
                    {o.name}
                    {o.mine ? ' (ty)' : ''}
                  </strong>
                  <br />
                  Oddaje {lot(o.give, o.giveQty)} · szuka {lot(o.want, o.wantQty)}
                </li>
              ))}
            </ul>
          )}
          {own && (
            <button
              disabled={busy}
              onClick={() =>
                void sign(
                  { action: 'withdrawBarter', offer: own.id },
                  'Towar wrócił do twojego magazynu.',
                )
              }
            >
              Wycofaj ofertę i odbierz towar
            </button>
          )}
          {!engaged && missing && (
            <aside className="barter-tip">
              <strong>Brakuje trzeciego kupca</strong>
              <p>
                {missing.first.name} i {missing.second.name} mogą zawrzeć umowę z kimś, kto odda{' '}
                {lot(missing.terms.give, missing.terms.giveQty)} za{' '}
                {lot(missing.terms.want, missing.terms.wantQty)}.
              </p>
              {wallet && (
                <button onClick={() => setTerms({ ...missing.terms })}>
                  Wpisz te warunki do mojej oferty
                </button>
              )}
            </aside>
          )}
          {!engaged &&
            (wallet ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sign(
                    { action: 'postBarter', ...terms },
                    'Oferta leży na stole. Twój towar jest w depozycie.',
                  );
                }}
              >
                <h3>Twoja oferta</h3>
                <div className="barter-fields">
                  {input('give', 'Oddaję')}
                  {input('want', 'Chcę otrzymać')}
                </div>
                <p>
                  W magazynie masz {lot(terms.give, stock)}. Możesz odebrać depozyt aż do trzeciej
                  pieczęci.
                </p>
                <button disabled={busy || stock < terms.giveQty}>Złóż ofertę i odłóż towar</button>
              </form>
            ) : (
              <button onClick={login}>Zaloguj się, żeby złożyć ofertę</button>
            ))}
        </section>
        <section>
          <h2>Stół pieczęci</h2>
          {book.circles.length === 0 && (
            <p>Tu trzej kupcy zobaczą, kto komu dostarczy towar, zanim podpiszą umowę.</p>
          )}
          {book.circles.map((c) => (
            <Contract key={c.id} circle={c} busy={busy} sign={sign} />
          ))}
          {book.recent.length > 0 && (
            <>
              <h2>Ostatnie wymiany</h2>
              {book.recent.map((c) => (
                <Contract key={c.id} circle={c} busy={busy} sign={sign} />
              ))}
            </>
          )}
        </section>
      </div>
    </article>
  );
}
