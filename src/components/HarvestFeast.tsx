import { useEffect, useRef } from 'react';
import { getCityInteriorSpec } from '../economy/cityAndArenaEngine';
import {
  feastTowns,
  ovenSeconds,
  type FeastBook,
  type FeastCommand,
  type FeastTown,
  type Loaf,
} from '../economy/harvestLoaf';
import type { MillBook } from '../economy/mill';
import { PortLink } from './PortLink';
import { cinemaFile } from './MerchantRoad';
import { SeedRouteLedger } from './SeedRouteLedger';
import './harvestFeast.css';

const tavern = (town: FeastTown) => getCityInteriorSpec(town).tavernName;
const tableLink = (town: FeastTown) => '?miejsce=karczma&miasto=' + town + '#stol-dozynkowy';
const stages = {
  flour: 'Mąka pod płótnem',
  oven: 'Bochen w piecu',
  ready: 'Gotowy do drogi',
  cart: 'Karawana na trakcie',
  served: 'Chleb na stole',
};
const remaining = (until: number, now: number) => Math.max(0, Math.ceil((until - now) / 1000));

function CaravanProgress({ loaf, now }: { loaf: Loaf; now: number }) {
  if (loaf.departed == null || loaf.arrival === null || !loaf.town) return null;
  const duration = loaf.arrival - loaf.departed;
  const elapsed = Math.min(duration, Math.max(0, now - loaf.departed));
  const percent = Math.round((elapsed * 100) / duration);
  return (
    <figure className="feast-road" aria-label={'Przejazd do karczmy · ' + percent + '%'}>
      <div
        className="feast-road-scene"
        style={{ backgroundImage: 'url(' + cinemaFile('trakt.webp') + ')' }}
      >
        <div className="feast-road-line">
          <span style={{ left: percent + '%' }} />
        </div>
      </div>
      <figcaption>
        <span>Srebrny Gaj</span>
        <span>{loaf.town === 'zelazna_kuznia' ? 'Żelazna Kuźnia' : 'Królewska Przystań'}</span>
      </figcaption>
    </figure>
  );
}

function Signatures({ loaf }: { loaf: Loaf }) {
  return (
    <>
      <dl className="feast-names">
        <div>
          <dt>Pierwsze ziarno</dt>
          <dd>{loaf.founder}</dd>
        </div>
        <div>
          <dt>Ostatnie żniwa</dt>
          <dd>{loaf.grower}</dd>
        </div>
        {loaf.baker && (
          <div>
            <dt>Przy piecu</dt>
            <dd>{loaf.baker}</dd>
          </div>
        )}
        {loaf.carrier && (
          <div>
            <dt>Na koźle wozu</dt>
            <dd>{loaf.carrier}</dd>
          </div>
        )}
      </dl>
      {loaf.seedLot !== null && <SeedRouteLedger id={loaf.seedLot} />}
    </>
  );
}

export type FeastVisit = (tab: 'field' | 'feast' | 'board', city?: FeastTown) => void;

export function HarvestTable({ loaves, visit }: { loaves: Loaf[]; visit: FeastVisit }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (location.hash === '#stol-dozynkowy') heading.current?.focus();
  }, []);
  return (
    <section className="feast-table" aria-labelledby="stol-dozynkowy">
      <h2 ref={heading} tabIndex={-1} id="stol-dozynkowy">
        Stół dożynkowy
      </h2>
      {loaves.length ? (
        loaves.map((loaf, i) => (
          <details key={loaf.id} open={i === 0}>
            <summary>
              {i === loaves.length - 1 ? 'Pierwszy bochen tej gospody' : 'Bochen dożynkowy'} ·
              zasiew nr {loaf.round} · {loaf.grower}
            </summary>
            <Signatures loaf={loaf} />
          </details>
        ))
      ) : (
        <p>Karczmarz zostawił wolne miejsce na pierwszy bochen ze Srebrnego Gaju.</p>
      )}
      <PortLink href="?miejsce=dozynki" go={() => visit('feast')}>
        Zajrzyj do piekarni w Srebrnym Gaju
      </PortLink>
    </section>
  );
}

interface Props {
  feast: FeastBook;
  visit: FeastVisit;
  book: MillBook;
  busy: boolean;
  login: () => void;
  sign: (cmd: FeastCommand, note: string) => Promise<boolean>;
}
export function HarvestFeast({ feast, book, busy, login, sign, visit }: Props) {
  const loaf = feast.latest,
    field = book.field;
  const canMill =
    field?.chest?.canOffer && !feast.alreadyMilled && (!loaf || loaf.stage === 'served');
  return (
    <article className="feast-house">
      <header className="feast-cover">
        <img
          src={cinemaFile('bochen-dozynkowy.webp')}
          width="1100"
          height="458"
          alt="Rustykalny bochen na lnianym obrusie w przydrożnej gospodzie"
        />
        <div>
          <span>Młyn w Srebrnym Gaju</span>
          <h1>Bochen dożynkowy</h1>
        </div>
      </header>
      <div className="feast-spread">
        <section>
          <h2>{loaf ? stages[loaf.stage] : 'Kto przyniesie pierwsze ziarno?'}</h2>
          {!loaf && (
            <p>
              Po żniwach jeden z gospodarzy może przynieść worek do młyna. Piekarz przejmie mąkę, a
              kupcy wybiorą gospodę, w której podzielą się chlebem.
            </p>
          )}
          {loaf && (
            <>
              <p className="feast-season">Zasiew nr {loaf.round} · Srebrny Gaj</p>
              {loaf.stage === 'flour' && (
                <>
                  <p>
                    Ćwierć miary mąki czeka na piekarza. Pół miary z tego samego worka trafiło do
                    miejskiej piekarni.
                  </p>
                  {book.wallet && (
                    <button
                      className="inn-primary"
                      disabled={busy}
                      onClick={() =>
                        void sign(
                          { action: 'bakeHarvestLoaf', loaf: loaf.id },
                          'Bochen trafił do pieca.',
                        )
                      }
                    >
                      Uformuj bochen i wsuń do pieca
                    </button>
                  )}
                </>
              )}
              {loaf.stage === 'oven' && (
                <>
                  <p>
                    {loaf.baker} czuwa przy piecu. Do wyjęcia około{' '}
                    {remaining(loaf.readyAt!, feast.now)} s.
                  </p>
                  <progress
                    aria-label="Wypiek chleba"
                    max={ovenSeconds}
                    value={ovenSeconds - remaining(loaf.readyAt!, feast.now)}
                  />
                </>
              )}
              {loaf.stage === 'ready' && <p>Chleb wystygł na tyle, żeby zabrać go na wóz.</p>}
              {loaf.stage === 'cart' && (
                <>
                  <CaravanProgress loaf={loaf} now={feast.now} />
                  <p>
                    {loaf.carrier} wiezie bochen{' '}
                    {loaf.road === 'detour' ? 'objazdem' : 'przez most'}. Cel podróży —{' '}
                    {tavern(loaf.town!)}. Do przyjazdu około {remaining(loaf.arrival!, feast.now)}{' '}
                    s.
                  </p>
                </>
              )}
              {loaf.stage === 'served' && (
                <p>
                  <PortLink href={tableLink(loaf.town!)} go={() => visit('board', loaf.town!)}>
                    Odwiedź stół · {tavern(loaf.town!)}
                  </PortLink>
                </p>
              )}
              <Signatures loaf={loaf} />
            </>
          )}
          {(!loaf || loaf.stage === 'served') && (
            <>
              {canMill && field && (
                <button
                  className="inn-primary"
                  disabled={busy || !book.wallet?.grain}
                  onClick={() =>
                    void sign(
                      { action: 'millHarvestLoaf', round: field.round },
                      'Worek zmielono. Mąka jest gotowa na wspólny wypiek.',
                    )
                  }
                >
                  Zmiel 1 worek z moich żniw
                </button>
              )}
              {canMill && !book.wallet?.grain && (
                <p>Potrzebujesz jednego worka zboża w magazynie.</p>
              )}
              <p>
                Z jednego worka młyn odkłada ćwierć miary mąki na świąteczny chleb i pół miary dla
                miasta. Wieś wybiera jeden worek z każdego zbioru. Swój wyróżniony worek możesz też
                zachować dla sąsiada.{' '}
                <PortLink href="?miejsce=pole#skrzynia" go={() => visit('field')}>
                  Wróć do skrzyni siewnej
                </PortLink>
              </p>
            </>
          )}
          {!book.wallet && (!loaf || loaf.stage !== 'served') && (
            <button onClick={login}>Zaloguj się, żeby dołączyć</button>
          )}
        </section>
        <aside>
          <h2>Dokąd jedzie wóz?</h2>
          <p>
            Każdy kupiec ma jeden głos. Możesz zmienić wybór do odjazdu. Przy remisie wygrywa
            gospoda, która najwcześniej dostała głos, który wciąż się liczy.
          </p>
          <ul>
            {feastTowns.map((town) => (
              <li key={town}>
                <span>{tavern(town)}</span>
                <small>
                  {town === 'zelazna_kuznia' ? 'Żelazna Kuźnia' : 'Królewska Przystań'} · głosy{' '}
                  {feast.votes.find((v) => v.town === town)?.count ?? 0}
                </small>
                {book.wallet && loaf && loaf.arrival === null && (
                  <button
                    disabled={busy || feast.choice === town}
                    aria-pressed={feast.choice === town}
                    onClick={() =>
                      void sign(
                        { action: 'voteHarvestInn', loaf: loaf.id, town },
                        'Zapisano twój wybór karczmy.',
                      )
                    }
                  >
                    {feast.choice === town ? 'Twój głos' : 'Wybieram tę gospodę'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {book.wallet &&
            loaf?.stage === 'ready' &&
            (feast.leading ? (
              <button
                className="inn-primary"
                disabled={busy}
                onClick={() =>
                  void sign(
                    { action: 'carryHarvestLoaf', loaf: loaf.id, town: feast.leading! },
                    'Wóz wyruszył do wybranej gospody.',
                  )
                }
              >
                Zawieź bochen · {tavern(feast.leading)}
              </button>
            ) : (
              <p>Woźnica czeka na pierwszy głos.</p>
            ))}
        </aside>
      </div>
    </article>
  );
}
