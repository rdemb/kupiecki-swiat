import { useState } from 'react';
import type {
  FreightCommand,
  GuildQuote,
  MutualBook,
  Waybill,
} from '../economy/waybills';
import type { MillBook } from '../economy/mill';

type Sign = (command: FreightCommand, message: string) => Promise<boolean>;
const integer = (s: string, max: number) =>
  Number.isSafeInteger(+s) && +s >= 1 && +s <= max;

export function InsuranceReceipt({ b }: { b: Waybill }) {
  if (!b.insurer && !b.floodAt) return null;
  return (
    <div className="insurance-receipt">
      {b.floodAt != null && (
        <p>Powódź przed przeprawą. Wóz skierowano na górny bród.</p>
      )}
      {b.insurer && (
        <p>
          <strong>{b.insurer}</strong> · składka {b.fee} zł.{' '}
          {b.paid == null
            ? b.floodAt != null
              ? `Przy rozładunku woźnica otrzyma ${b.cover} zł odszkodowania.`
              : `Na ten wóz odłożono ${b.cover} zł.`
            : b.paid > 0
              ? `Wypłacono woźnicy ${b.paid} zł odszkodowania.`
              : 'Bez szkody. Rezerwa wróciła do kasy.'}
        </p>
      )}
    </div>
  );
}
export function CoverChoice({
  offers,
  selected,
  choose,
}: {
  offers: GuildQuote[];
  selected: string;
  choose: (id: string) => void;
}) {
  const rates = offers.filter((g) => g.quote !== null);
  if (!rates.length && !selected) return null;
  return (
    <label className="cover-choice">
      Ochrona przejazdu przez most
      <select value={selected} onChange={(e) => choose(e.target.value)}>
        <option value="">Bez polisy · 0 zł</option>
        {selected && !rates.some((g) => String(g.quote) === selected) && (
          <option value={selected} disabled>
            Oferta wygasła · wybierz ponownie
          </option>
        )}
        {rates.map((g) => (
          <option
            key={g.quote}
            value={String(g.quote)}
            disabled={g.free < g.cover!}
          >
            {g.name} · składka {g.fee} zł · wypłata {g.cover} zł
             · wolna rezerwa {g.free} zł
          </option>
        ))}
      </select>
    </label>
  );
}
export default function CarrierMutual({
  funds,
  wallet,
  busy,
  sign,
  onAccount,
}: {
  funds: MutualBook;
  wallet: MillBook['wallet'];
  busy: boolean;
  sign: Sign;
  onAccount: () => void;
}) {
  const [amount, setAmount] = useState('50'),
    [fee, setFee] = useState('4'),
    [cover, setCover] = useState('30');
  const mine = funds.guilds.find((g) => g.id === funds.memberGuild);
  return (
    <section className="carrier-mutual">
      <p className="mutual-terms">
        Królewska Przystań → Srebrny Gaj. Polisa chroni woźnicę od wyjazdu do
        przeprawy w połowie trasy. Jeśli powódź zerwie most w tym czasie, górny
        bród wydłuży kurs o 25 sekund. Odszkodowanie trafi do sakwy przy
        rozładunku.
      </p>
      <div className="inn-spread">
        <section>
          <h2>Poręczenia na trakcie</h2>
          {funds.guilds.length === 0 && (
            <p>
              Żadna gildia nie wystawiła jeszcze poręczenia. Pierwszą ofertę
              może podpisać mistrz gildii graczy.
            </p>
          )}
          {funds.guilds.map((g) => (
            <article className="freight-slip" key={g.id}>
              <div className="freight-seal">
                <span>{g.tag}</span>
                <span>
                  {g.quote === null
                    ? 'Przyjmowanie polis zamknięte'
                    : g.free >= g.cover!
                      ? 'Wystawia polisy'
                      : 'Czeka na wkład'}
                </span>
              </div>
              <h3>{g.name}</h3>
              {g.quote != null && (
                <p>
                  Składka <strong>{g.fee} zł</strong> za wóz · odszkodowanie{' '}
                  <strong>{g.cover} zł</strong>.
                </p>
              )}
              <p>
                {g.free} zł wolne · {g.locked} zł odłożone na wozy w drodze.
              </p>
              <p>
                Rozliczone polisy · {g.trips}. Wypłaty za objazd · {g.claims}.
                Woźnice otrzymali łącznie {g.paid} zł.
              </p>
            </article>
          ))}
          <h3>Jak zawrzeć umowę?</h3>
          <p>
            W „Listach przewozowych” znajdź opieczętowany ładunek. Wybierz
            ofertę i rusz przez most. Przy dobrowolnym wyjeździe brodem składka
            wynosi zero.
          </p>
        </section>
        <aside>
          <h2>Wkład do kasy</h2>
          {wallet && mine ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (integer(amount, 1000000))
                  void sign(
                    { action: 'pledge', guild: mine.id, amount: +amount },
                    'Wkład zapisano na twoje nazwisko.',
                  );
              }}
            >
              <p>
                Gildia {mine.name}. Kasa poręcza wóz najpierw z największych
                wolnych wkładów. Ryzykujesz tylko złotem przypisanym do tego
                wozu. Po rozładunku otrzymasz część składki proporcjonalną do
                swojego udziału.
              </p>
              <label>
                Kwota wkładu w złocie
                <input
                  type="number"
                  required
                  min="1"
                  max="1000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <button
                className="inn-primary"
                disabled={
                  busy || !integer(amount, 1000000) || +amount > wallet.gold
                }
              >
                Wpłać wkład
              </button>
            </form>
          ) : wallet ? (
            <p>
              Dołącz przy stole gildii do cechu prowadzonego przez graczy albo
              załóż własny.
            </p>
          ) : (
            <button className="inn-primary" onClick={onAccount}>
              Zaloguj się w kasie
            </button>
          )}
          {funds.holdings.map((h) => (
            <div key={h.guild} className="insurance-receipt">
              <h3>Twój wkład · {h.name}</h3>
              <p>
                {h.free} zł do odbioru · {h.locked} zł poręcza wozy.
              </p>
              <button
                disabled={busy || h.free === 0}
                onClick={() =>
                  sign(
                    {
                      action: 'redeem',
                      guild: h.guild,
                      amount: Math.min(h.free, 1000000),
                    },
                    'Wolny wkład wrócił do sakwy.',
                  )
                }
              >
                Odbierz {Math.min(h.free, 1000000)} zł
              </button>
            </div>
          ))}
          {mine && funds.master && (
            <form
              className="mutual-charter"
              onSubmit={(e) => {
                e.preventDefault();
                void sign(
                  {
                    action: 'tariff',
                    guild: mine.id,
                    fee: +fee,
                    cover: +cover,
                  },
                  'Oferta dla nowych wozów wisi w kantorze.',
                );
              }}
            >
              <h3>Warunki mistrza gildii</h3>
              <div className="mill-terms">
                <label>
                  Składka od wozu
                  <input
                    type="number"
                    min={1}
                    max={999}
                    required
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                  />
                </label>
                <label>
                  Odszkodowanie
                  <input
                    type="number"
                    min={2}
                    max={1000}
                    required
                    value={cover}
                    onChange={(e) => setCover(e.target.value)}
                  />
                </label>
              </div>
              <button
                disabled={
                  busy || !integer(cover, 1000) || !integer(fee, +cover - 1)
                }
              >
                Ogłoś warunki
              </button>
              {mine.quote !== null && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    sign(
                      { action: 'suspendCover', guild: mine.id },
                      'Wstrzymano sprzedaż nowych polis. Podpisane umowy są nadal rozliczane.',
                    )
                  }
                >
                  Wstrzymaj nowe polisy
                </button>
              )}
            </form>
          )}
        </aside>
      </div>
    </section>
  );
}
