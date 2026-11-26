import { useState } from 'react';
import {
  courseNames,
  keelClearanceCm,
  lighterLoad,
  passageSeconds,
  reliefPerBarrelCm,
  transferSeconds,
  usableSounding,
  type Course,
} from '../economy/pilotage';
import type { YardBook } from '../economy/shipyard';
export function PassageOrder({
  page,
  busy,
  sail,
}: {
  page: YardBook;
  busy: boolean;
  sail: (course: Course, reference?: number, offer?: number, letter?: number) => void;
}) {
  const [letter,setLetter] = useState(0);
  const [choice, setChoice] = useState('outer');
  const { pilotage: book, seconds, wallet } = page;
  const offers = page.lighterOffers ?? [];
  const deep = usableSounding(book);
  const sounding =
    book.latest && !book.storm && book.latest.edition === book.edition
      ? book.latest
      : null;
  const barrels = sounding ? lighterLoad(sounding.cm) : null;
  const options: {
    key: string;
    label: string;
    course: Course;
    reference?: number;
    offer?: number;
    price?: number;
  }[] = [
    { key: 'outer', label: courseNames.outer, course: 'outer' },
    { key: 'survey', label: courseNames.survey, course: 'survey' },
  ].map((o) => ({
    ...o,
    course: o.course as Course,
    label:
      o.label +
      (seconds === null
        ? ''
        : ' · ' + passageSeconds(seconds, o.course as Course) + ' s'),
  }));
  if (deep && seconds !== null)
    options.push({
      key: 'cut/' + deep.voyage,
      label: courseNames.cut + ' · ' + passageSeconds(seconds, 'cut') + ' s',
      course: 'cut',
      reference: deep.voyage,
    });
  if (sounding && barrels && seconds !== null)
    for (const o of offers.filter((o) => !o.own)) {
      options.push({
        key: 'lighter/' + sounding.voyage + '/' + o.id,
        label:
          'Z lichtugą · ' +
          o.name +
          ' · ' +
          o.fee +
          ' zł · ' +
          transferSeconds(seconds, barrels) +
          ' s',
        course: 'cut',
        reference: sounding.voyage,
        offer: o.id,
        price: o.fee,
      });
    }
  const route = options.find((o) => o.key === choice);
  const missingLetter = !!letter && !page.mailbag?.some(m=>m.id===letter);
  const short = route?.price !== undefined && (wallet?.gold ?? 0) < route.price;
  return (
    <div className="yard-passage">
      <label>
        Droga na redę
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={busy}
        >
          {!route && (
            <option disabled value={choice}>
              Wybrana przeprawa już się zmieniła
            </option>
          )}
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {(!!page.mailbag?.length || missingLetter) && <label>Worek pocztowy
        <select value={letter} onChange={e=>setLetter(Number(e.target.value))} disabled={busy}>
          {missingLetter && <option value={letter} disabled>Kopertę zabrano · wybierz ponownie</option>}
          <option value={0}>Wypłyń bez listu</option>
          {page.mailbag.map(m=><option key={m.id} value={m.id}>{m.sender} → {m.guild} · list {m.id}</option>)}
        </select></label>}
      {book.storm ? (
        <p>Sztorm zamknął redę.</p>
      ) : !route ? (
        <p>Wybierz ponownie drogę lub przewoźnika.</p>
      ) : route.offer && sounding && barrels && seconds !== null ? (
        <p>
          Pomiar {sounding.cm} cm. Na szkucie zostaną {4 - barrels} beczki, a po
          przeładunku wystarczy {keelClearanceCm - barrels * reliefPerBarrelCm}{' '}
          cm wody. Zyskasz {seconds - transferSeconds(seconds, barrels)} s. Z
          twoich {page.ship?.job?.wage} zł żołdu pozostanie{' '}
          {(page.ship?.job?.wage ?? 0) - route.price!} zł. Opłatę wykładasz przy
          wypłynięciu.
        </p>
      ) : route.course === 'survey' ? (
        <p>Załoga zmierzy głębokość na powrocie, o ile pozwoli pogoda.</p>
      ) : route.course === 'cut' && deep ? (
        <p>
          Sonda ze szkuty „{deep.vessel}” wskazała {deep.cm} cm. Pomiar podpisał{' '}
          {deep.skipper}.
        </p>
      ) : (
        <p>Ławicę opłyniecie po głębokiej wodzie, bez opłaty za lichtugę.</p>
      )}
      {barrels && !offers.some((o) => !o.own) && (
        <p>Do skrótu potrzebujesz drugiego gracza z ofertą na kei lichtug.</p>
      )}
      {!!book.fund?.total && (
        <p>Nagroda za pierwszy świeży pomiar wynosi {book.fund.total} zł.</p>
      )}
      {short && <p>W sakwie brakuje monet na wybraną lichtugę.</p>}
      <button
        className="inn-primary"
        disabled={busy || seconds === null || !route || short || missingLetter || !!wallet?.duty}
        onClick={() =>
          route && sail(route.course, route.reference, route.offer, letter || undefined)
        }
      >
        {route?.offer ? 'Wynajmij lichtugę i wypłyń' : 'Obejmij ster i wypłyń'}
      </button>
    </div>
  );
}
