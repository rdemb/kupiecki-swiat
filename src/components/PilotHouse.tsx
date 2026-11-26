import { useRef, useState } from 'react';
import {
  courseNames,
  keelClearanceCm,
  usableSounding,
  type Course,
  type PilotBook,
  type PilotFolio,
} from '../economy/pilotage';
import { gameRequest } from '../utils/gameServer';
import { BayChart } from './BayChart';
import { InnGuide } from './InnGuide';
import { cinemaFile } from './MerchantRoad';
import './pilotHouse.css';

const when = (at: number) =>
  new Date(at).toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
function news(book: PilotBook) {
  const m = book.latest;
  if (book.storm) return 'Sztorm na Zatoce. Bosman zatrzymał wypłynięcia.';
  if (!m)
    return 'Kto pierwszy zmierzy przesmyk? W księdze wciąż brakuje podpisu szypra.';
  if (m.edition !== book.edition)
    return 'Od pomiaru przeszedł sztorm. Karczmarz wypatruje załogi z nowym odczytem.';
  return (
    'Ostatni wpis ze szkuty „' +
    m.vessel +
    '” podaje ' +
    m.cm +
    ' cm. ' +
    (usableSounding(book)
      ? 'Załadowana szkuta może przejść.'
      : 'Szkuty z solą muszą opłynąć ławicę.')
  );
}
export function PilotNotice({ book }: { book: PilotBook }) {
  return (
    <section className="pilot-notice">
      <h3>Wieści z redy</h3>
      <p>{news(book)}</p>
      <a href="?miejsce=piloci">Otwórz księgę pilotów</a>
    </section>
  );
}
const descriptions: Record<Course, string> = {
  outer:
    'Tor obchodzi ławicę od północy. Szyper może tędy wyjść przy każdej pogodzie dopuszczającej żeglugę.',
  survey:
    'Na powrocie załoga podchodzi pod ławicę od głębokiej wody i rzuca ołowiankę. Pomiar wydłuża rejs o 12 sekund. Gdy trwa sztorm, sonda zostaje na pokładzie.',
  cut:
    'Przez przesmyk płynie się około jednej trzeciej krócej. Szkuta z czterema beczkami soli potrzebuje co najmniej ' +
    keelClearanceCm +
    ' cm wody i podpisanego pomiaru z obecnego układu dna.',
};
export function PilotHouse({
  book,
  error,
  retry,
  close,
  muted,
}: {
  book: PilotBook | null;
  error: boolean;
  retry: () => void;
  close: () => void;
  muted: boolean;
}) {
  const [course, setCourse] = useState<Course>('outer');
  const latest = book?.latest;
  const [pages, setPages] = useState<PilotFolio[]>([]);
  const [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false);
  const reading = useRef(false);
  const page = pages.at(-1) ?? book;
  async function earlier() {
    const last = page?.history.at(-1);
    if (!last || reading.current) return;
    reading.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const res = await gameRequest('/api/pilots?before=' + last.voyage, {
        cache: 'no-store',
      });
      if (!res.ok) throw Error();
      const older: PilotFolio = await res.json();
      setPages((p) => [...p, older]);
    } catch {
      setFailed(true);
    } finally {
      reading.current = false;
      setLoading(false);
    }
  }
  return (
    <main className="merchant-inn pilot-house">
      <header
        className="inn-hero pilot-hero"
        style={{ backgroundImage: 'url(' + cinemaFile('piloci.webp') + ')' }}
      >
        <div className="inn-heading">
          <span>Królewska Przystań · Centralna Zatoka</span>
          <h1>Księga pilotów Zatoki</h1>
        </div>
        <button onClick={close}>Wróć do gry</button>
      </header>
      <div className="inn-room">
        <nav className="pilot-nav" aria-label="Miejsca przy porcie">
          <a href="?miejsce=stocznia">Przejdź do stoczni</a>
          <a href="?miejsce=karczma">Portowa karczma</a>
        </nav>
        {error && (
          <p role="alert">
            Nie udało się otworzyć księgi.{' '}
            <button onClick={retry}>Ponów odczyt</button>
          </p>
        )}
        {!book && !error && <p role="status">Pisarz otwiera księgę…</p>}
        {book && page && (
          <div className="pilot-spread">
            <section>
              <h2>Tory wodne</h2>
              <div
                className="pilot-tabs"
                role="group"
                aria-label="Podejrzyj przebieg toru"
              >
                {(Object.keys(courseNames) as Course[]).map((c) => (
                  <button
                    key={c}
                    aria-pressed={c === course}
                    onClick={() => setCourse(c)}
                  >
                    {courseNames[c]}
                  </button>
                ))}
              </div>
              <figure className="pilot-plate">
                <BayChart
                  course={course}
                  reading={latest?.cm ?? null}
                  stale={!!latest && latest.edition !== book.edition}
                />
                <figcaption>{descriptions[course]}</figcaption>
              </figure>
              <InnGuide cue="piloci" muted={muted} />
            </section>
            <section className="pilot-register">
              <h2>Sondaże z pokładu</h2>
              <p className="pilot-news">{news(book)}</p>
              {book.lastStorm && (
                <p className="pilot-storm">
                  Ostatni sztorm · {when(book.lastStorm)}
                </p>
              )}
              {!!page.history.length && (
                <ol>
                  {page.history.map((m) => (
                    <li key={m.voyage}>
                      <strong>{m.cm} cm</strong>
                      <span>
                        {m.edition === book.edition
                          ? 'Bieżący pomiar'
                          : 'Sprzed sztormu'}
                      </span>
                      <p>
                        <b>{m.skipper}</b> ·{' '}
                        <a href={'?miejsce=stocznia&szkuta=' + m.ship}>
                          {m.vessel}
                        </a>
                        <br />
                        <time dateTime={new Date(m.at).toISOString()}>
                          {when(m.at)}
                        </time>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              {failed && (
                <p role="alert">
                  Nie udało się odczytać starszych wpisów. Możesz ponowić
                  odczyt.
                </p>
              )}
              {page.more && (
                <button disabled={loading} onClick={earlier}>
                  Starsze sondaże
                </button>
              )}{' '}
              {!!pages.length && (
                <button
                  disabled={loading}
                  onClick={() => {
                    setPages((p) => p.slice(0, -1));
                    setFailed(false);
                  }}
                >
                  Nowsze sondaże
                </button>
              )}
              {!book.history.length && (
                <p>
                  W stoczni obejmij ster szkuty z listem frachtowym i wybierz
                  rejs z sondą. Twój pierwszy wpis będzie widoczny także w
                  portowej karczmie.
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
