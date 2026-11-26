import { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../utils/sound';
import { gameRequest } from '../utils/gameServer';
import { mountBalance, weights } from '../world3d/portBalance';
import './portWeighhouse.css';

interface Manifest {
  watch: number;
  now: number;
  closes: number;
  vessel: { name: string; cargo: string };
  threshold: number;
  count: number;
  signatures: { signer: string; mass: number }[];
  sample: number;
  signed: boolean;
}
type Props = { token: string | null; moving: boolean; onClose: () => void; onAccount: () => void };
const backdrop = import.meta.env.BASE_URL + 'cinema/komora.webp';
const weightLabel = (n: number) =>
  n + ' ' + (n === 1 ? 'łut' : n % 10 >= 2 && n % 10 <= 4 && !(n >= 12 && n <= 14) ? 'łuty' : 'łutów');

function Instrument({ mass, sample, moving }: { mass: number; sample: number; moving: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const instrument = useRef<ReturnType<typeof mountBalance> | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    try {
      instrument.current = mountBalance(host.current);
    } catch {
      setUnsupported(true);
    }
    const el = host.current;
    const lost = (e: Event) => {
      e.preventDefault();
      setUnsupported(true);
    };
    el.addEventListener('webglcontextlost', lost, true);
    return () => {
      el.removeEventListener('webglcontextlost', lost, true);
      instrument.current?.dispose();
      instrument.current = null;
    };
  }, []);
  useEffect(() => {
    instrument.current?.set(mass, sample, !moving);
  }, [mass, sample, moving]);
  const tilt = Math.max(-12, Math.min(12, (sample - mass) * 2));
  return (
    <div ref={host} className="weigh-instrument" aria-hidden="true">
      {unsupported && (
        <div className="weigh-fallback">
          <i style={{ transform: 'rotate(' + -tilt + 'deg)' }} />
        </div>
      )}
    </div>
  );
}

export default function PortWeighhouse({ token, moving, onClose, onAccount }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Manifest | null>(null);
  const [mass, setMass] = useState(0),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [busy, setBusy] = useState(false),
    [time, setTime] = useState(Date.now);
  const [entries, setEntries] = useState(false);
  const sequence = useRef(0),
    clockOffset = useRef(0),
    submitted = useRef(false);
  const lastWatch = useRef<number | null>(null),
    expires = useRef(0);
  const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {};
  function accept(result: Manifest) {
    if (lastWatch.current !== result.watch) {
      if (lastWatch.current !== null) setMessage('Do nabrzeża przybił kolejny statek.');
      setMass(result.signed ? result.sample : 0);
      lastWatch.current = result.watch;
    } else if (result.signed) setMass(result.sample);
    expires.current = result.closes;
    clockOffset.current = result.now - Date.now();
    setTime(result.now);
    setData(result);
    setError('');
  }
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  useEffect(() => {
    lastWatch.current = null;
    setData(null);
    setMessage('');
    setMass(0);
    setError('');
    let alive = true,
      overdueWatch: number | null = null;
    async function refresh() {
      const id = ++sequence.current;
      try {
        const r = await gameRequest('/api/weighhouse', { headers, cache: 'no-store' });
        if (!r.ok) throw Error();
        const result: Manifest = await r.json();
        if (typeof result.sample !== 'number') throw Error();
        if (alive && id === sequence.current) accept(result);
      } catch {
        if (alive && id === sequence.current)
          setError('Brak łączności z komorą. Ponawiam odczyt manifestu.');
      }
    }
    const read = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const poll = window.setInterval(read, 15000);
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const now = Date.now() + clockOffset.current;
      setTime(now);
      const watch = lastWatch.current;
      if (watch !== null && now >= expires.current && overdueWatch !== watch) {
        overdueWatch = watch;
        read();
      }
    }, 1000);
    window.addEventListener('port:manifest', read);
    document.addEventListener('visibilitychange', read);
    return () => {
      alive = false;
      sequence.current++;
      clearInterval(poll);
      clearInterval(timer);
      window.removeEventListener('port:manifest', read);
      document.removeEventListener('visibilitychange', read);
    };
  }, [token]);
  const even = !!data && mass === data.sample;
  const expired = !!data && time >= data.closes;
  const cleared = !!data && data.count >= data.threshold;
  const seconds = Math.max(0, Math.ceil(((data?.closes ?? time) - time) / 1000));
  const reading = !data
    ? 'Czekam na próbkę'
    : even
      ? 'Szale w równowadze'
      : mass < data.sample
        ? 'Próbka jest cięższa'
        : 'Odważniki są cięższe';
  async function seal() {
    if (!data || expired || !even || submitted.current) return;
    if (!token) {
      setMessage(
        'Próba udana. Masa próbki to ' +
          weightLabel(mass) +
          '. Zaloguj się, aby podpisać manifest statku.',
      );
      return;
    }
    submitted.current = true;
    setBusy(true);
    setMessage('');
    try {
      const res = await gameRequest('/api/weighhouse/seal', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ watch: data.watch, mass }),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.error || 'Komora nie potwierdziła wpisu.');
      sequence.current++;
      accept(result);
      setMessage('Pieczęć przyjęta. Twój pomiar jest w manifeście statku.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Nie udało się potwierdzić pieczęci.');
    } finally {
      submitted.current = false;
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="weigh-room"
      aria-labelledby="weigh-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="weigh-location" style={{ backgroundImage: 'url(' + backdrop + ')' }} />
      <div className="weigh-scrim" />
      <header className="weigh-top">
        <span>Królewska Przystań</span>
        <button className="weigh-back" onClick={onClose} autoFocus>
          Wróć na targ
        </button>
      </header>
      <Instrument mass={mass} sample={data?.sample ?? 13} moving={moving} />
      <div className="weigh-content">
        <p className="weigh-kicker">Komora celna</p>
        <h1 id="weigh-title">Waga portowa</h1>
        <p className="weigh-ship">
          {data ? '„' + data.vessel.name + '” · ' + data.vessel.cargo : 'Odczytywanie manifestu…'}
        </p>
        <p className="weigh-guide">
          Na lewej szali leży próbka ładunku. Dobierz odważniki na prawą. Dotknij odważnika ponownie,
          aby go zdjąć.
        </p>
        <fieldset disabled={!data || busy || data.signed || expired}>
          <legend>Odważniki w łutach</legend>
          <div className="weigh-weights">
            {weights.map((w) => (
              <button
                type="button"
                key={w}
                aria-pressed={!!(mass & w)}
                aria-label={weightLabel(w)}
                onClick={() => {
                  soundEngine.playWeight(w, !(mass & w));
                  setMass((previous) => previous ^ w);
                  setMessage('');
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="weigh-reading" role="status">
          <b>{reading}</b>
          <span>{weightLabel(mass)}</span>
        </div>
        <div className="weigh-actions">
          <button
            className="weigh-seal"
            disabled={!even || busy || data?.signed || expired || !!error}
            onClick={() => void seal()}
          >
            {data?.signed
              ? 'Twój pomiar zapisany'
              : busy
                ? 'Pieczętowanie…'
                : token
                  ? 'Opieczętuj pomiar'
                  : 'Sprawdź próbkę'}
          </button>
          {!token && <button onClick={onAccount}>Podpisz z konta</button>}
        </div>
        {message && (
          <p role="status" className="weigh-message">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="weigh-message">
            {error}
          </p>
        )}
        <div className="weigh-manifest">
          <button aria-expanded={entries} onClick={() => setEntries(!entries)}>
            Manifest statku{' '}
            <strong>
              {data
                ? cleared
                  ? 'Odprawiono · ' + data.count
                  : data.count + ' / ' + data.threshold + ' pieczęci'
                : '…'}{' '}
              <span aria-hidden="true">{entries ? '−' : '+'}</span>
            </strong>
          </button>
          <p>
            {cleared
              ? 'Odprawa otwarta. Nowe przewozy przy przystani trwają 30 sekund.'
              : 'Po pieczęciach trzech kupców przewóz przy przystani skróci się z 60 do 30 sekund.'}
          </p>
          {entries &&
            (data?.signatures.length ? (
              <ol>
                {data.signatures.map((s, i) => (
                  <li key={i}>
                    <span>{s.signer}</span>
                    <span>{weightLabel(s.mass)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Nikt jeszcze nie podpisał manifestu tej wachty.</p>
            ))}
          {data && (
            <small>
              Zmiana wachty za {Math.floor(seconds / 60)} min {String(seconds % 60).padStart(2, '0')} s
            </small>
          )}
        </div>
      </div>
    </dialog>
  );
}
