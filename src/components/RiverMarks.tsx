import type { CSSProperties } from 'react';
import {
  floodMark,
  freshFor,
  readingInterval,
  warningMark,
  waterBand,
  type RiverReading,
} from '../economy/river';
import { cinemaFile } from './MerchantRoad';
import './riverMarks.css';

function stamp(at: number) {
  const day = new Date(at);
  const time = day.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return day.toDateString() === new Date().toDateString()
    ? time
    : day.toLocaleDateString('pl-PL') + ', ' + time;
}
function comparison(r: RiverReading, publicBoard = false) {
  if (r.previousCm === null || r.previousAt === null)
    return publicBoard
      ? 'Pierwszy widoczny meldunek na tablicy.'
      : 'To pierwszy odczyt tego kupca.';
  const diff = r.cm - r.previousCm;
  const change =
    diff > 0
      ? 'Wzrost o ' + diff + ' cm'
      : diff < 0
        ? 'Spadek o ' + -diff + ' cm'
        : 'Bez zmiany';
  return (
    change +
    ' od pomiaru ' +
    stamp(r.previousAt) +
    ' (' +
    r.previousCm +
    ' cm).'
  );
}
const position = (cm: number) => ((cm - 60) / (220 - 60)) * 100 + '%';

export function RiverMarks({
  reading,
  now,
  signedIn,
  busy,
  measure,
  publish,
  login,
  board,
}: {
  reading: RiverReading | null;
  now: number;
  signedIn: boolean;
  busy: boolean;
  measure: () => void;
  publish: (id: number) => void;
  login: () => void;
  board: () => void;
}) {
  const age = reading ? now - reading.at : Infinity;
  const wait = Math.max(0, Math.ceil((readingInterval - age) / 1000));
  return (
    <section className="river-station" aria-labelledby="river-title">
      <div
        className="river-plate"
        role="img"
        aria-label={
          reading
            ? 'Zapisany poziom wody ' + reading.cm + ' centymetrów'
            : 'Podziałka filaru ze znakiem ostrzegawczym i znakiem wezbrania'
        }
        style={{
          backgroundImage:
            'linear-gradient(90deg,#0b1d2090,#0b171b25 50%,transparent), url(' +
            cinemaFile('wodowskaz.webp') +
            ')',
        }}
      >
        <div className="river-ruler" aria-hidden="true">
          <i style={{ bottom: position(floodMark) }}>
            <span>{floodMark} · wezbranie</span>
          </i>
          <i style={{ bottom: position(warningMark) }}>
            <span>{warningMark} · ostrzeżenie</span>
          </i>
          {reading && (
            <b style={{ '--waterline': position(reading.cm) } as CSSProperties}>
              <span>{reading.cm} cm</span>
            </b>
          )}
        </div>
      </div>
      <div className="river-field">
        <h2 id="river-title">Znaki wysokiej wody</h2>
        {reading ? (
          <div className="river-measurement">
            <p>
              <strong>{reading.cm} cm</strong> · {waterBand(reading.cm)}
            </p>
            <p>
              Twój odczyt z{' '}
              <time dateTime={new Date(reading.at).toISOString()}>
                {stamp(reading.at)}
              </time>
              . {comparison(reading)}
            </p>
          </div>
        ) : (
          <p>
            Przyłóż miarę do nacięć na filarze. Woda po deszczu przybiera
            stopniowo. Przy {floodMark} cm może zabrać przęsło. Odbudowany most
            wytrzymuje pierwsze 48 godzin.
          </p>
        )}
        <div className="river-actions">
          {signedIn ? (
            <button
              className="inn-primary"
              disabled={busy || wait > 0}
              onClick={measure}
            >
              {wait ? 'Kolejny odczyt za ' + wait + ' s' : 'Zmierz wodę'}
            </button>
          ) : (
            <button className="inn-primary" onClick={login}>
              Zaloguj się, aby zmierzyć wodę
            </button>
          )}
          {reading && age < freshFor && reading.posted === null && (
            <button disabled={busy} onClick={() => publish(reading.id)}>
              Podpisz i wywieś w karczmie
            </button>
          )}
          <button onClick={board}>Tablica w Srebrnym Gaju</button>
        </div>
        {reading && (
          <small>
            {reading.posted !== null
              ? 'Meldunek podpisany. Na tablicy widnieje godzina pomiaru.'
              : age >= freshFor
                ? 'Ten odczyt pozostał w twoim notesie. Zmierz ponownie, aby wysłać świeży meldunek.'
                : 'Odczyt jest prywatny. Masz 45 sekund od pomiaru na wywieszenie meldunku.'}
          </small>
        )}
      </div>
    </section>
  );
}
export function RiverReports({
  reports,
  now,
  go,
}: {
  reports: RiverReading[];
  now: number;
  go: () => void;
}) {
  return (
    <section className="river-reports">
      <h2>Meldunki spod mostu</h2>
      {reports.length ? (
        <ol>
          {reports.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.cm} cm</strong> · {waterBand(r.cm)}
              </div>
              <p>{comparison(r, true)}</p>
              <small>
                {r.name} · pomiar {stamp(r.at)} ·{' '}
                {now - r.at >= freshFor ? 'odczyt archiwalny' : 'świeży odczyt'}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p>
          Nikt jeszcze nie przyniósł aktualnego meldunku. Ostatnie odczyty
          kupców wiszą tu przez dziesięć minut.
        </p>
      )}
      <button onClick={go}>Podejdź do wodowskazu</button>
    </section>
  );
}
