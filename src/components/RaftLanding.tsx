import { raftRules as r } from '../economy/rafts';
import type { BridgeBook } from '../economy/bridge';
import { cinemaFile } from './MerchantRoad';
import { InnGuide } from './InnGuide';
import './raftLanding.css';

interface Props {
  page: BridgeBook | null;
  now: number;
  busy: boolean;
  error: string;
  note: string;
  muted: boolean;
  launch: (offer: number) => void;
  bridge: () => void;
  harbor: () => void;
  close: () => void;
  login: () => void;
  refresh: () => void;
}

const nouns = new Intl.PluralRules('pl');
function beamLabel(n: number) {
  return nouns.select(n) === 'few' ? 'belki' : n === 1 ? 'belka' : 'belek';
}
const description = {
  shallow: 'Za płytko. Belki zostały na brzegu.',
  open: 'Bosman otworzył spław.',
  flood: 'Wezbranie. Bosman wstrzymał wypłynięcia.',
};
function remaining(at: number, now: number) {
  const seconds = Math.max(0, Math.ceil((at - now) / 1000));
  return seconds >= 60
    ? Math.floor(seconds / 60) + ' min ' + (seconds % 60) + ' s'
    : seconds + ' s';
}

export function RaftLanding({
  page,
  now,
  busy,
  error,
  note,
  muted,
  launch,
  bridge,
  harbor,
  close,
  login,
  refresh,
}: Props) {
  const book = page?.rafting;
  const voyage = book?.runs.find((run) => run.own) ?? book?.runs[0];
  const cost = r.loadsPerRaft * r.loadPrice;
  const obstacle =
    book &&
    (book.water !== 'open'
      ? description[book.water]
      : book.runs.some((run) => run.own)
        ? 'Twoja załoga jest już na rzece.'
        : book.forest < r.loadsPerRaft
          ? 'Za mało belek. Tartak przygotowuje kolejną partię.'
          : book.offer === null
            ? 'Port czeka na wydanie drewna cieślom.'
            : page.wallet && page.wallet.gold < cost
              ? 'Na zakup drewna potrzeba ' + cost + ' zł.'
              : '');
  const progress = voyage
    ? Math.max(
        0,
        Math.min(1, (now - voyage.start) / (voyage.due - voyage.start)),
      )
    : 0;
  return (
    <main className="merchant-inn raft-house">
      <header
        className="inn-hero raft-scene"
        style={{ backgroundImage: 'url(' + cinemaFile('flisacy.webp') + ')' }}
      >
        <div className="inn-heading">
          <span>Srebrny Gaj · nad rzeką</span>
          <h1>Przystań flisaków</h1>
        </div>
        <button onClick={close}>Wróć do gry</button>
      </header>
      <section className="inn-room">
        <div className="bridge-nav">
          <button onClick={bridge}>Most i wodowskaz</button>
          <button onClick={harbor}>Keja w Królewskiej Przystani</button>
          <button onClick={refresh}>Odśwież księgę</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {!book && !error && <p role="status">Flisak otwiera księgę spławu…</p>}
        {book && (
          <>
            <div className="inn-spread raft-spread">
              <article>
                <div className="raft-heading">
                  <h2>Skład nad rzeką</h2>
                  <span className={'river-signal ' + book.water}>
                    {description[book.water]}
                  </span>
                </div>
                <p>
                  Tartak wydaje sześć dębowych belek na wóz. Dwie takie partie
                  można związać w tratwę i sprzedać w Królewskiej Przystani.
                </p>
                <div className="raft-stocks">
                  <div>
                    <small>Na brzegu</small>
                    <strong>
                      {book.forest * r.beamsPerLoad} <span>{beamLabel(book.forest * r.beamsPerLoad)}</span>
                    </strong>
                    <small>
                      {book.nextCut
                        ? 'Kolejna partia za ' + remaining(book.nextCut, now)
                        : 'Pełny skład'}
                    </small>
                  </div>
                  <div>
                    <small>Do zamówienia na most</small>
                    <strong>
                      {book.neededAtBridge * r.beamsPerLoad} <span>{beamLabel(book.neededAtBridge * r.beamsPerLoad)}</span>
                    </strong>
                    <small>
                      {page.damaged
                        ? 'Pozostało do opłacenia'
                        : 'Przeprawa przejezdna'}
                    </small>
                  </div>
                  <div>
                    <small>Na kei w porcie</small>
                    <strong>
                      {book.port * r.beamsPerLoad} <span>{beamLabel(book.port * r.beamsPerLoad)}</span>
                    </strong>
                    <small>W drodze {book.inbound * r.beamsPerLoad}</small>
                  </div>
                </div>
                <h3>Oferta na następny spław</h3>
                <p>
                  {book.offer === null ? (
                    'Cieśle zakontraktowali już całe wolne miejsce na kei.'
                  ) : (
                    <>
                      Zakup drewna kosztuje <b>{cost} zł</b>. Port zapłaci{' '}
                      <b>{book.offer} zł</b> po przybiciu. Zarobek z tego spławu
                      wynosi <b>{book.offer - cost} zł</b>.
                    </>
                  )}
                </p>
                <p>
                  Flisacy wypływają od {r.minWater} cm do progu wezbrania przy{' '}
                  {r.floodWater} cm. W silniejszym nurcie szybciej dopłyną. Cenę
                  zapisują przy odbiciu.
                </p>
                {page.wallet ? (
                  <>
                    <button
                      className="inn-primary"
                      disabled={busy || !!error || !!obstacle}
                      onClick={() => book.offer !== null && launch(book.offer)}
                    >
                      Kup belki i zleć spław · {cost} zł
                    </button>
                    {obstacle && <p>{obstacle}</p>}
                  </>
                ) : (
                  <button className="inn-primary" onClick={login}>
                    Zaloguj się, aby zlecić spław
                  </button>
                )}
                {note && <p role="status">{note}</p>}
                <InnGuide cue="flisacy" muted={muted} />
              </article>
              <aside>
                <h2>Szlak rzeczny</h2>
                <div className="raft-route">
                  <div className="raft-track" aria-hidden="true">
                    {voyage && <i style={{ left: progress * 100 + '%' }} />}
                  </div>
                  <div className="raft-places">
                    <span>Srebrny Gaj</span>
                    <span>Królewska Przystań</span>
                  </div>
                </div>
                {voyage ? (
                  <p>
                    <b>{voyage.own ? 'Twoja tratwa' : voyage.name}</b> ·{' '}
                    {progress >= 1
                      ? 'przybija do kei'
                      : 'do kei ' + remaining(voyage.due, now)}
                    . Umówiona zapłata {voyage.price} zł.{' '}
                    {book.runs.length > 1 &&
                      'Tratwy na wodzie: ' + book.runs.length + '.'}
                  </p>
                ) : (
                  <p>
                    {book.water === 'open'
                      ? 'Rzeka jest wolna. Rejs w tym nurcie zajmie ' +
                        book.seconds +
                        ' s.'
                      : 'Żadna tratwa nie jest teraz na rzece.'}
                  </p>
                )}
                <p>
                  Przy odprawie soli cieśle zużywają sześć dostarczonych belek
                  na drugi zaprzęg. Każda taka odprawa zwalnia miejsce na nową
                  dostawę.
                </p>
                <h3>Kto dopłynął</h3>
                {book.arrivals.length ? (
                  <ol className="raft-arrivals">
                    {book.arrivals.map((run) => (
                      <li key={run.id}>
                        <span>
                          <b>{run.name}</b>
                          <small>
                            {new Date(run.due).toLocaleTimeString('pl-PL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · 12 belek
                          </small>
                        </span>
                        <strong>{run.price} zł</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Tu cieśla zapisze pierwszą odebraną tratwę.</p>
                )}
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
