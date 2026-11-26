import { useCallback, useEffect, useRef, useState } from 'react';
import { harborRules as r, type HarborAction, type HarborWork } from '../economy/harborWorks';
import { gameRequest } from '../utils/gameServer';
import { cinemaFile } from './MerchantRoad';
import './harborWorks.css';

const stations = {
  fish: {
    place: 'Pomost poławiaczy',
    action: 'Wypłyń po kraby',
    time: r.fishSeconds,
    description:
      'Podnieś wiklinowe więcierze rozstawione u wejścia do zatoki. Po powrocie połów trafi do wspólnej kuchni.',
    cost: 'Wolna załoga',
    yield: r.catchRations + ' racje żywności',
  },
  boil: {
    place: 'Warzelnia soli',
    action: 'Rozpal pod panwią',
    time: r.boilSeconds,
    description:
      'Wydaj posiłek warzelnikom. Odparują solankę w żelaznej panwi i zatoczą beczki do magazynu przy kei.',
    cost: r.crewRations + ' racje żywności',
    yield: r.saltYield + ' beczki soli',
  },
  ship: {
    place: 'Keja frachtowa',
    action: 'Odpraw transport soli',
    time: 0,
    description:
      'Wydaj szyprowi pełny ładunek. Za fracht port opłaci świeży zaprzęg. Pierwszy konwój budowlany lub handlowy z kancelarii w okręgu przystani zyska ' +
      r.savingSeconds +
      ' sekund.',
    cost: r.exportBarrels + ' beczki soli',
    yield: '1 zaprzęg dla kupców',
  },
} as const;
const keys: HarborAction[] = ['fish', 'boil', 'ship'];
type Props = { token: string | null; onClose: () => void; onAccount: () => void; onLanding: () => void; onYard: () => void };

export default function HarborWorks({ token, onClose, onAccount, onLanding, onYard }: Props) {
  const [data, setData] = useState<HarborWork | null>(null);
  const [selected, setSelected] = useState<HarborAction>('fish');
  const [error, setError] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const offset = useRef(0);
  const seq = useRef(0);
  const locked = useRef(false);
  const slip = useRef<{ action: HarborAction; nonce: string } | null>(null);
  const apply = useCallback((state: HarborWork) => {
    offset.current = state.now - Date.now();
    setNow(state.now);
    setData(state);
    setLoadingError('');
  }, []);
  const read = useCallback(async () => {
    const id = ++seq.current;
    try {
      const response = await gameRequest('/api/harbor-works', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        cache: 'no-store',
      });
      if (!response.ok) throw Error();
      const state = await response.json();
      if (id === seq.current) apply(state);
    } catch {
      if (id === seq.current) setLoadingError('Nie udało się odczytać księgi portowej.');
    }
  }, [token, apply]);
  useEffect(() => {
    void read();
    const poll = () => {
      if (!document.hidden && !locked.current) void read();
    };
    const id = setInterval(poll, 7000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      seq.current++;
      clearInterval(id);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [read]);
  const due = data?.workers[0]?.due;
  useEffect(() => {
    if (!due) return;
    const tick = setInterval(() => setNow(Date.now() + offset.current), 500);
    const finish = setTimeout(
      () => {
        if (!locked.current) void read();
      },
      Math.max(0, due - Date.now() - offset.current) + 150,
    );
    return () => {
      clearInterval(tick);
      clearTimeout(finish);
    };
  }, [due, read]);
  async function work() {
    if (locked.current || !token) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    if (slip.current?.action !== selected)
      slip.current = { action: selected, nonce: crypto.randomUUID() };
    const id = ++seq.current;
    try {
      const response = await gameRequest('/api/harbor-works', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(slip.current),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500) slip.current = null;
        throw Error(body.error || 'Brak potwierdzenia z portu. Ponów polecenie.');
      }
      if (seq.current === id) apply(body);
      slip.current = null;
      setMessage(
        selected === 'ship'
          ? 'Szyper odebrał sól. Zaprzęg czeka na pierwszy konwój w kancelarii.'
          : 'Zmiana przyjęta. Towar trafi do magazynu także po twoim wyjściu.',
      );
    } catch (e) {
      setError(
        e instanceof TypeError
          ? 'Połączenie przerwane. Ponów to samo polecenie.'
          : (e as Error).message,
      );
    } finally {
      locked.current = false;
      setBusy(false);
      void read();
    }
  }
  const station = stations[selected];
  const remaining = (due: number) => Math.max(0, Math.ceil((due - now) / 1000));
  const shortage =
    data &&
    (selected === 'boil' && data.food < r.crewRations
      ? 'Brakuje racji. Wyślij łódź po kraby.'
      : selected === 'ship' && data.salt < r.exportBarrels
        ? 'Brakuje soli. Dostarcz ją z warzelni.'
        : '');
  return (
    <main className="harbor-works">
      <header
        className="harbor-scene"
        style={{ backgroundImage: 'url(' + cinemaFile('warzelnia.webp') + ')' }}
      >
        <div className="harbor-top">
          <span>Królewska Przystań</span>
          <button onClick={onClose}>Wróć na targ</button>
        </div>
        <div className="harbor-title">
          <h1>Warzelnia nad zatoką</h1>
          <p>Bez połowu załoga zostanie głodna. Bez załogi sól zostanie w panwi.</p>
        </div>
      </header>
      <div className="harbor-ledger">
        <section className="harbor-stock" aria-label="Wspólne zapasy portu">
          {(
            [
              ['food', 'Racje żywności'],
              ['salt', 'Beczki soli'],
              ['provisions', 'Wolne zaprzęgi'],
              ['timber', 'Partie drewna z Gaju'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <strong>{data?.[key] ?? '—'}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>
        <div className="harbor-columns">
          <section>
            <div className="harbor-stations" aria-label="Stanowiska portowe">
              {keys.map((k) => (
                <button
                  key={k}
                  aria-pressed={selected === k}
                  onClick={() => {
                    setSelected(k);
                    setMessage('');
                    setError('');
                  }}
                >
                  {stations[k].place}
                </button>
              ))}
            </div>
            <h2>{station.place}</h2>
            <p>{station.description}</p>
            {selected === 'ship' && <p>Cieśle mogą przygotować drugi wóz do tego samego transportu, jeśli na kei leży partia drewna od flisaków.</p>}
            <dl className="harbor-recipe">
              <div>
                <dt>Potrzeba</dt>
                <dd>{station.cost}</dd>
              </div>
              <div>
                <dt>Do odbioru</dt>
                <dd>{selected === 'ship' && (data?.timber ?? 0) > 0 ? '2 zaprzęgi dla kupców' : station.yield}</dd>
              </div>
              <div>
                <dt>Czas</dt>
                <dd>{station.time ? station.time + ' s' : 'Od ręki'}</dd>
              </div>
            </dl>
            {data?.mine ? (
              <div className="harbor-order">
                <b>
                  {data.mine.kind === 'fish' ? 'Twoja łódź na wodzie' : 'Twoja załoga przy panwi'}
                </b>
                <progress
                  aria-label="Postęp twojej zmiany"
                  max={stations[data.mine.kind].time}
                  value={Math.max(0, stations[data.mine.kind].time - remaining(data.mine.due))}
                />
                <span>
                  {remaining(data.mine.due)
                    ? 'Do zakończenia ' + remaining(data.mine.due) + ' s'
                    : 'Przyjmowanie dostawy…'}
                </span>
              </div>
            ) : token ? (
              <>
                <button
                  className="harbor-primary"
                  disabled={busy || !data || !!shortage || !!loadingError}
                  onClick={work}
                >
                  {station.action}
                </button>
                {shortage && <p className="harbor-note">{shortage}</p>}
              </>
            ) : (
              <button className="harbor-primary" onClick={onAccount}>
                Zaloguj się do pracy w porcie
              </button>
            )}
            <p role="status" className="harbor-note">
              {error || message}
            </p>
            {loadingError && (
              <p role="alert">
                {loadingError}{' '}
                <button className="harbor-reload" onClick={read}>
                  Ponów odczyt
                </button>
              </p>
            )}
          </section>
          <aside>
            <h2>Księga portowa</h2>
            {!data ? (
              <p>Otwieranie księgi…</p>
            ) : (
              <>
                <button onClick={onYard}>Stocznia szkutnicza</button>
                <button onClick={onLanding}>Odwiedź przystań flisaków</button>
                <h3>Na zmianie</h3>
                {data.workers.length ? (
                  <ul>
                    {data.workers.map((w, i) => (
                      <li key={w.due + '-' + i}>
                        <b>{w.name}</b> · {w.kind === 'fish' ? 'połów' : 'warzenie'} ·{' '}
                        {remaining(w.due)} s
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Łodzie i panwie czekają na załogę.</p>
                )}
                <h3>
                  Odprawione transporty <b>{data.shipments}</b>
                </h3>
                <p>
                  {data.lastShip
                    ? 'Ostatni list przewozowy podpisuje ' + data.lastShip.name + '.'
                    : 'Pierwszy szyper czeka na cztery beczki soli.'}
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
