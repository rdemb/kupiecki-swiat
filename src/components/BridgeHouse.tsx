import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bridgeRules,
  detourSeconds,
  type BridgeBook,
  type BridgeMaterial,
} from '../economy/bridge';
import type { MillMark } from '../economy/mill';
import { gameRequest } from '../utils/gameServer';
import { cinemaFile } from './MerchantRoad';
import { RiverMarks } from './RiverMarks';
import { InnGuide } from './InnGuide';
import './bridgeHouse.css';

type Action =
  | { action: 'measure' }
  | { action: 'publishReading'; reading: number }
  | { action: 'fund'; material: BridgeMaterial }
  | { action: 'haul' | 'unload'; load: number };
interface Props {
  token: string | null;
  muted: boolean;
  onClose: () => void;
  onAccount: () => void;
  onGuild: () => void;
  onBoard: () => void;
  onSettlement: (uid: string, mark: MillMark) => void;
}
export default function BridgeHouse({
  token,
  muted,
  onClose,
  onAccount,
  onGuild,
  onBoard,
  onSettlement,
}: Props) {
  const [page, setPage] = useState<BridgeBook | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const lock = useRef(false),
    sequence = useRef(0),
    clockOffset = useRef(0);
  const retry = useRef<{ key: string; nonce: string } | null>(null);
  const commit = useCallback(
    (p: BridgeBook) => {
      setPage(p);
      clockOffset.current = p.now - Date.now();
      setNow(p.now);
      if (p.wallet) onSettlement(p.wallet.uid, p.wallet.mark);
    },
    [onSettlement],
  );
  const refresh = useCallback(async () => {
    if (lock.current) return;
    const id = ++sequence.current;
    try {
      const r = await gameRequest('/api/bridge', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        cache: 'no-store',
      });
      if (!r.ok) throw Error();
      const p = await r.json();
      if (sequence.current === id) {
        commit(p);
        setError('');
      }
    } catch {
      if (sequence.current === id) setError('Nie udało się odczytać księgi mostu.');
    }
  }, [token, commit]);
  useEffect(() => {
    void refresh();
    const poll = () => {
      if (!document.hidden) void refresh();
    };
    const t = setInterval(poll, 4000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      sequence.current++;
      clearInterval(t);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [refresh]);
  const mine = page?.loads.find((s) => s.myWagon);
  useEffect(() => {
    if (!mine && !page?.reading) return;
    const t = setInterval(() => setNow(Date.now() + clockOffset.current), 500);
    return () => clearInterval(t);
  }, [mine?.id, page?.reading?.id]);
  async function act(command: Action) {
    if (!token || !page || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNote('');
    const id = ++sequence.current,
      key = JSON.stringify(command.action === 'measure' || command.action === 'publishReading' ? command : { cycle: page.cycle, ...command });
    if (retry.current?.key !== key) retry.current = { key, nonce: crypto.randomUUID() };
    try {
      const r = await gameRequest('/api/bridge', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle: page.cycle, ...command, nonce: retry.current.nonce }),
      });
      const result = await r.json();
      if (sequence.current !== id) return;
      if (!r.ok) {
        if (r.status < 500) retry.current = null;
        setNote(result.error ?? 'Zlecenie nie zostało przyjęte.');
        return;
      }
      retry.current = null;
      commit(result);
      setNote(
        command.action === 'measure'
          ? 'Pomiar zapisany w twoim notesie.'
          : command.action === 'publishReading'
            ? 'Podpisany meldunek wisi w karczmie w Srebrnym Gaju.'
            : command.action === 'fund'
          ? 'Opłacony list przewozowy czeka na woźnicę.'
          : command.action === 'haul'
            ? 'Wóz w drodze. Po dojechaniu odbierz zapłatę przy rozładunku.'
            : result.damaged
              ? 'Rozładowano wóz. Zapłata trafiła do sakwy.'
              : 'Ostatni wóz rozładowany. Most otwarty!',
      );
    } catch {
      if (sequence.current === id)
        setNote('Nie dotarło potwierdzenie. Możesz ponowić tę samą czynność.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const materialTypes = ['wood', 'iron'] as const;
  const wait = Math.max(0, Math.ceil(((mine?.due ?? 0) - now) / 1000));
  return (
    <main className="merchant-inn bridge-house">
      <header
        className="inn-hero bridge-view"
        style={
          page
            ? {
                backgroundImage:
                  'url(' +
                  cinemaFile(page.damaged ? 'most-zerwane.webp' : 'most-otwarte.webp') +
                  ')',
              }
            : {}
        }
      >
        {page?.tag && (
          <div className="bridge-pennon" title={page.guildName}>
            <span>{page.tag}</span>
          </div>
        )}
        <div className="inn-heading">
          <span>Królewski trakt · Srebrny Gaj</span>
          <h1>Przeprawa kupców</h1>
        </div>
        <button onClick={onClose}>Wróć do gry</button>
      </header>
      <section className="inn-room">
        <div className="bridge-nav">
          <button onClick={onGuild}>Stół gildii</button>
          <button onClick={refresh}>Odśwież księgę</button>
        </div>
        {error && <p role="alert">{error}</p>}
        {!page && !error && <p role="status">Strażnik przynosi księgę przeprawy…</p>}
        {page && (
          <>
            <RiverMarks reading={page.reading} now={now} signedIn={!!page.wallet} busy={busy}
              measure={()=>act({action:'measure'})} publish={reading=>act({action:'publishReading',reading})}
              board={onBoard} login={onAccount}/>
            {note && <p role="status">{note}</p>}
            <div className="inn-spread">
              <article>
                <h2>{page.damaged ? 'Rzeka zabrała przęsło' : 'Trakt przez most otwarty'}</h2>
                <p>
                  {page.damaged
                    ? 'Wozy jadą przez górny bród. Do odbudowy potrzeba trzech wozów dębowych belek i dwóch wozów żelaznych okuć.'
                    : page.guildName
                      ? 'Nad przeprawą powiewa proporzec gildii ' +
                        page.guildName +
                        '. Ostatnia dostawa otworzyła drogę wszystkim kupcom.'
                      : 'Przeprawa jest przejezdna. Strażnik obserwuje wodę przy kamiennym przyczółku.'}
                </p>
                <InnGuide cue="most" muted={muted} />
                {page.damaged && (
                  <>
                    <h2>Wozy na odbudowę</h2>
                    {materialTypes.map((k) => {
                      const r = bridgeRules[k],
                        loads = page.loads.filter((s) => s.material === k);
                      const landed = loads.filter((s) => s.delivered !== null).length;
                      return (
                        <section className="mill-order" key={k}>
                          <div className="mill-order-title">
                            <h3>{r.label}</h3>
                            <span>
                              {landed} z {r.loads} na budowie
                            </span>
                          </div>
                          <progress aria-label={r.label} value={landed} max={r.loads} />
                          <p>
                            Opłacone wozy {loads.length}/{r.loads} · materiał {r.cost-r.wage} zł · przewóz {r.seconds} s za{' '}
                            {r.wage} zł.
                          </p>
                          {page.wallet?.guildName && loads.length < r.loads && (
                            <button
                              disabled={busy || page.wallet.gold < r.cost}
                              onClick={() => act({ action: 'fund', material: k })}
                            >
                              Opłać wóz z własnej sakwy · {r.cost} zł
                            </button>
                          )}
                          <ul>
                            {loads.map((s) => (
                              <li className="bridge-slip" key={s.id}>
                                <div>
                                  <strong>{s.patron}</strong> · {s.guildName}
                                  <small>
                                    {s.delivered !== null
                                      ? 'Dostarczono · ' + s.driver
                                      : s.driver
                                        ? 'W drodze · ' + s.driver
                                        : 'Wóz czeka · ' + r.source}
                                  </small>
                                </div>
                                {s.myWagon ? (
                                  <button
                                    disabled={busy || wait > 0}
                                    onClick={() => act({ action: 'unload', load: s.id })}
                                  >
                                    {wait
                                      ? 'Do przyjazdu ' + wait + ' s'
                                      : 'Rozładuj · ' + s.wage + ' zł'}
                                  </button>
                                ) : (
                                  s.driver === null &&
                                  page.wallet && (
                                    <button
                                      disabled={busy || !!mine}
                                      onClick={() => act({ action: 'haul', load: s.id })}
                                    >
                                      Podejmij kurs · {s.wage} zł
                                    </button>
                                  )
                                )}
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                    {!page.wallet && (
                      <button className="inn-primary" onClick={onAccount}>
                        Zaloguj się, aby pomóc
                      </button>
                    )}
                    {page.wallet && (
                      <p>
                        Sakwa {page.wallet.gold.toLocaleString('pl-PL')} zł.{' '}
                        {page.wallet.guildName
                          ? 'Podpisujesz kontrakty dla gildii ' + page.wallet.guildName + '.'
                          : 'Możesz przewozić jako wolny kupiec. Aby finansować, dołącz do gildii.'}
                      </p>
                    )}
                    <small>
                      Ładunek wydaje tartak lub kuźnia. Nierozładowany wóz po 15 minutach od
                      przyjazdu może przejąć inny woźnica.
                    </small>
                  </>
                )}

              </article>
              <aside>
                <h2>Prawo przeprawy</h2>
                <p>
                  Objazd konwoju ziemskiego wydłuża podróż o {detourSeconds} s. Myto miejskie ustala
                  księstwo. Przy wjeździe mostem do Srebrnego Gaju członek gildii fundatorów ma
                  wolny przejazd przy stawce poniżej 10%, a przy stawce 10% płaci 10%.
                </p>
                <p>
                  Proporzec zdobywa gildia, która opłaciła najwięcej złota w danej odbudowie. Przy
                  remisie pierwszeństwo ma wcześniejszy kontrakt.
                </p>
                <h2>Księga budowniczych</h2>
                {page.openings.length === 0 ? (
                  <p>Pierwszy wpis powstanie po zakończeniu odbudowy.</p>
                ) : (
                  <ol className="mill-ledger">
                    {page.openings.map((o) => (
                      <li key={o.cycle}>
                        <strong>
                          {o.guildName} · {o.tag}
                        </strong>
                        <time>{new Date(o.opened).toLocaleString('pl-PL')}</time>Woźnice:{' '}
                        {o.builders}
                      </li>
                    ))}
                  </ol>
                )}
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
