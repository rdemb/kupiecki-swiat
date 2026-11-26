import { useState } from 'react';
import {
  type PilotBook,
  type Course,
  courseNames,
  passageSeconds,
  usableSounding,
  keelClearanceCm,
} from '../economy/pilotage';

export function PassageOrder({
  book,
  seconds,
  busy,
  sail,
}: {
  book: PilotBook;
  seconds: number | null;
  busy: boolean;
  sail: (course: Course, reference?: number) => void;
}) {
  const [choice, setChoice] = useState('outer');
  const mark = usableSounding(book);
  const cut = mark ? 'cut/' + mark.voyage : '';
  const course: Course = choice.startsWith('cut/')
    ? 'cut'
    : choice === 'survey'
      ? 'survey'
      : 'outer';
  const outdated = course === 'cut' && choice !== cut;
  const label = (c: Course) =>
    courseNames[c] +
    (seconds === null ? '' : ' · ' + passageSeconds(seconds, c) + ' s');
  return (
    <div className="yard-passage">
      <label>
        Droga na redę
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          disabled={busy}
        >
          <option value="outer">{label('outer')}</option>
          <option value="survey">{label('survey')}</option>
          {outdated && (
            <option value={choice} disabled>
              Wybrany pomiar już się zmienił
            </option>
          )}
          <option value={cut || 'closed'} disabled={!mark}>
            {label('cut')}
          </option>
        </select>
      </label>
      <p>
        {course === 'survey'
          ? 'Przy powrocie załoga spróbuje sondowania. Przy spokojnej wodzie podpisany wynik trafi do księgi.'
          : outdated
            ? 'Otwórz listę i wybierz drogę ponownie.'
            : course === 'cut' && mark
              ? 'Skrót wytyczono na podstawie wpisu ze szkuty „' +
                mark.vessel +
                '”. Pomiar ' +
                mark.cm +
                ' cm podpisał szyper „' +
                mark.skipper +
                '”.'
              : 'Ławicę opłyniecie po głębokiej wodzie.'}
      </p>
      {!!book.fund?.total && <p><strong>Nagroda w karczmie · {book.fund.total} szt. złota.</strong> Otrzyma ją pierwsza załoga, która przywiezie świeży pomiar, także przy zbyt płytkiej wodzie.</p>}
      {!mark && (
        <p>
          {book.storm
            ? 'Wyjście zamknięte przez sztorm.'
            : 'Skrót czeka na aktualne potwierdzenie co najmniej ' +
              keelClearanceCm +
              ' cm wody.'}
        </p>
      )}
      <button
        className="inn-primary"
        disabled={busy || seconds === null || outdated}
        onClick={() =>
          sail(course, course === 'cut' && mark ? mark.voyage : undefined)
        }
      >
        Obejmij ster i wypłyń
      </button>
    </div>
  );
}
