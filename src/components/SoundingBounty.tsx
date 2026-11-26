import { useRef, useState } from 'react';
import { maxSoundingPledge, type PilotBook } from '../economy/pilotage';
import type { MillMark } from '../economy/mill';
import { gameRequest } from '../utils/gameServer';
import { cinemaFile } from './MerchantRoad';

type Props = {
  book: PilotBook;
  token: string | null;
  login: () => void;
  update: (book: PilotBook, uid: string, mark: MillMark) => void;
  refresh: () => void;
  yard: () => void;
};

export function SoundingBounty({
  book,
  token,
  login,
  update,
  refresh,
  yard,
}: Props) {
  const [amount, setAmount] = useState('12');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const sending = useRef(false);
  const slip = useRef<{
    edition: number;
    amount: number;
    nonce: string;
  } | null>(null);
  const fund = book.fund;
  if (!fund) return null;
  const available =
    book.lastStorm !== null && book.latest?.edition !== book.edition;
  async function pledge() {
    if (!token || sending.current || !available || fund.mine) return;
    const value = Number(amount);
    if (!Number.isInteger(value) || value < 1 || value > maxSoundingPledge)
      return;
    if (
      !slip.current ||
      slip.current.edition !== book.edition ||
      slip.current.amount !== value
    )
      slip.current = {
        edition: book.edition,
        amount: value,
        nonce: crypto.randomUUID(),
      };
    sending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const response = await gameRequest('/api/pilots/pledges', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slip.current),
      });
      const receipt = await response.json();
      if (!response.ok) {
        if (response.status < 500) slip.current = null;
        setNotice(receipt.error ?? 'Karczmarz nie potwierdził wpłaty.');
        refresh();
        return;
      }
      slip.current = null;
      update(receipt.book, receipt.uid, receipt.mark);
      setNotice('Karczmarz potwierdził kwit na ' + value + ' szt. złota.');
    } catch {
      setNotice(
        'Brak potwierdzenia. Sprawdź stan sakwy albo ponów tę samą wpłatę.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <article className="sound-contract" aria-labelledby="bounty-title">
      <header
        style={{
          backgroundImage:
            'linear-gradient(90deg,#151a14b0,#171a1240 55%,transparent 82%),url(' +
            cinemaFile('nagroda-za-sondaz.webp') +
            ')',
        }}
      >
        <h3 id="bounty-title">Nagroda za pierwszy sondaż</h3>
        <p>
          <strong>{fund.total}</strong> szt. złota w sakwie
        </p>
      </header>
      <div className="sound-contract-body">
        <p>
          {available
            ? 'Po sztormie kupcy składają się na świeży pomiar ławicy. Całą sakwę otrzyma pierwszy szyper, który wróci z odczytem. Płycizna też liczy się do nagrody.'
            : book.lastStorm === null
              ? 'Pierwszy sztorm otworzy zbiórkę na nowy pomiar ławicy.'
              : 'Świeży pomiar jest już w księdze. Następną zbiórkę otworzy sztorm.'}
        </p>
        {fund.patrons.length > 0 && (
          <details>
            <summary>Wystawcy nagrody ({fund.patrons.length})</summary>
            <ul>
              {fund.patrons.map((p, i) => (
                <li key={i}>
                  {p.name} · {p.amount} szt. złota
                </li>
              ))}
            </ul>
          </details>
        )}
        {available && (
          <>
            <p className="sound-terms">
              Jeśli kolejny sztorm nadejdzie przed pomiarem, każdy kupiec
              odzyska swoją wpłatę.
            </p>
            {fund.mine > 0 ? (
              <p>
                W sakwie jest już twoja wpłata · <b>{fund.mine} szt. złota</b>.
              </p>
            ) : token ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void pledge();
                }}
              >
                <label>
                  Jednorazowy wkład (1–{maxSoundingPledge} szt. złota)
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={maxSoundingPledge}
                    step="1"
                    required
                    value={amount}
                    disabled={busy}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <button className="inn-primary" disabled={busy}>
                  {busy
                    ? 'Karczmarz przyjmuje złoto…'
                    : 'Złóż złoto na nagrodę'}
                </button>
              </form>
            ) : (
              <button className="inn-primary" onClick={login}>
                Zaloguj się, by dołożyć złoto
              </button>
            )}
            {fund.total > 0 && (
              <button className="sound-yard" onClick={yard}>
                Szukaj rejsu w stoczni
              </button>
            )}
          </>
        )}
        {notice && <p role="status">{notice}</p>}
        {fund.last && (
          <p className="sound-receipt">
            <strong>Ostatnie rozliczenie</strong>{' '}
            {fund.last.skipper === null
              ? 'Sztorm wrócił przed pomiarem. Wystawcy odzyskali łącznie ' +
                fund.last.total +
                ' szt. złota.'
              : fund.last.skipper +
                ' · pomiar ' +
                fund.last.cm +
                ' cm · wypłacono ' +
                fund.last.total +
                ' szt. złota.'}
          </p>
        )}
      </div>
    </article>
  );
}
