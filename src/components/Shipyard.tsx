import { useCallback, useEffect, useRef, useState } from 'react';
import {
  shipRules as r,
  type YardAction,
  type YardBook,
} from '../economy/shipyard';
import type { MillMark } from '../economy/mill';
import { gameRequest } from '../utils/gameServer';
import { cinemaFile } from './MerchantRoad';
import { InnGuide } from './InnGuide';
import { courseNames } from '../economy/pilotage';
import { PortLink } from './PortLink';
import { PassageOrder } from './PassageOrder';
import './shipyard.css';

type Props = {
  token: string | null;
  muted: boolean;
  close: () => void;
  login: () => void;
  pilots: () => void;
  guild: () => void;
  harbor: () => void;
  landing: () => void;
  settlement: (uid: string, mark: MillMark) => void;
};
const date = (ms: number) =>
  new Date(ms).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
const number = (id: number) => String(id).padStart(3, '0');
function linkedShip() {
  const n = Number(new URLSearchParams(location.search).get('szkuta'));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
function shipLink(id: number) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('miejsce', 'stocznia');
  url.searchParams.set('szkuta', String(id));
  return url;
}
export default function Shipyard({
  token,
  muted,
  close,
  login,
  guild,
  pilots,
  harbor,
  landing,
  settlement,
}: Props) {
  const [selected, setSelected] = useState<number | null>(linkedShip);
  const [before, setBefore] = useState<number | null>(null);
  const [page, setPage] = useState<YardBook | null>(null),
    [name, setName] = useState('');
  const [error, setError] = useState(''),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now);
  const seq = useRef(0),
    lock = useRef(false),
    offset = useRef(0),
    retry = useRef<{ key: string; nonce: string } | null>(null);
  const apply = useCallback(
    (b: YardBook) => {
      setPage(b);
      offset.current = b.now - Date.now();
      setNow(b.now);
      if (b.wallet) settlement(b.wallet.uid, b.wallet.mark);
    },
    [settlement],
  );
  const read = useCallback(async () => {
    if (lock.current) return;
    const id = ++seq.current;
    const query = new URLSearchParams();
    if (selected) query.set('ship', String(selected));
    if (before) query.set('before', String(before));
    try {
      const resp = await gameRequest('/api/shipyard?' + query, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        cache: 'no-store',
      });
      if (!resp.ok) throw Error();
      const b: YardBook = await resp.json();
      if (id === seq.current) {
        apply(b);
        setError('');
      }
    } catch {
      if (id === seq.current)
        setError('Nie udało się odczytać rejestru stoczni.');
    }
  }, [token, selected, before, apply]);
  useEffect(() => {
    void read();
    const poll = () => {
      if (!document.hidden) void read();
    };
    const t = setInterval(poll, 4000);
    document.addEventListener('visibilitychange', poll);
    return () => {
      seq.current++;
      clearInterval(t);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [read]);
  const ship = page?.ship,
    job = ship?.job,
    hull = ship?.hull;
  useEffect(() => {
    if (!job) return;
    const t = setInterval(() => setNow(Date.now() + offset.current), 500);
    return () => clearInterval(t);
  }, [job?.id]);
  function select(id: number) {
    if (lock.current) return;
    seq.current++;
    setSelected(id);
    setBefore(null);
    setPage(null);
    setNote('');
    setError('');
    setName('');
    history.replaceState(history.state, '', shipLink(id));
  }
  async function act(cmd: YardAction) {
    if (!token || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNote('');
    const id = ++seq.current,
      key = JSON.stringify(cmd);
    if (retry.current?.key !== key)
      retry.current = { key, nonce: crypto.randomUUID() };
    try {
      const resp = await gameRequest('/api/shipyard', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...cmd, nonce: retry.current.nonce }),
      });
      const b = await resp.json();
      if (id !== seq.current) return;
      if (!resp.ok) {
        if (resp.status < 500) retry.current = null;
        setNote(b.error ?? 'Dokument wrócił bez podpisu.');
        return;
      }
      retry.current = null;
      apply(b);
      setBefore(null);
      setSelected(b.ship.hull.id);
      history.replaceState(history.state, '', shipLink(b.ship.hull.id));
      const messages: Record<YardAction['action'], string> = {
        commission: 'Stępka położona. Można dostarczać materiały.',
        oak: 'Sześć dębowych belek wydano na poszycie.',
        iron: 'Okucia z kuźni przyjęte na pochylnię.',
        launch: 'Szkuta jest na wodzie. Jej metryka pozostanie w rejestrze.',
        hire: 'Żołd i cztery beczki czekają na szypra.',
        withdraw: 'Żołd wrócił do wystawcy, a sól do warzelni.',
        sail: 'Cumę oddano. Bosman zapisał wyjście na redę.',
      };
      setNote(messages[cmd.action]);
    } catch {
      if (id === seq.current)
        setNote('Brak potwierdzenia. Możesz ponowić ten sam podpis.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const disabled = busy || !!error;
  const sea = job?.departed != null && job.due != null;
  const progress = sea
    ? Math.min(
        1,
        Math.max(0, (now - job.departed!) / (job.due! - job.departed!)),
      )
    : 0;
  const hullReady = ship?.oak === r.oakLoads && ship?.iron === r.ironLots;
  return (
    <main className="merchant-inn shipyard">
      <header
        className="inn-hero yard-hero"
        style={{ backgroundImage: 'url(' + cinemaFile('stocznia.webp') + ')' }}
      >
        <div className="inn-heading">
          <span>Królewska Przystań · Centralna Zatoka</span>
          <h1>Stocznia szkutnicza</h1>
        </div>
        <button onClick={close}>Wróć do gry</button>
      </header>
      <section className="inn-room">
        <nav className="bridge-nav" aria-label="Drogi ze stoczni">
          <button onClick={landing}>Flisacy i drewno</button>
          <button onClick={harbor}>Warzelnia i sól</button>
          <button onClick={guild}>Stół gildii</button>
          <PortLink href="?miejsce=piloci" go={pilots}>Księga pilotów Zatoki</PortLink>
        </nav>
        {error && (
          <p role="alert">
            {error} <button onClick={read}>Ponów odczyt</button>
          </p>
        )}
        {!page && !error && (
          <p role="status">Pisarz otwiera księgę okrętową…</p>
        )}
        {page && (
          <div className="yard-grid">
            <section>
              <div className="yard-register">
                <h2>Rejestr szkut</h2>
                {page.fleet.length > 0 && (
                  <label>
                    Wybierz szkutę{' '}
                    <select
                      value={hull?.id ?? ''}
                      disabled={busy}
                      onChange={(e) => select(Number(e.target.value))}
                    >
                      {!hull && <option value="">Wybierz z rejestru</option>}
                      {page.fleet.map((h) => (
                        <option key={h.id} value={h.id}>
                          {number(h.id)} · {h.name ?? 'Kadłub na pochylni'} ·{' '}
                          {h.guild}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {page.wallet?.canCommission && (
                <button
                  disabled={disabled || page.wallet.gold < r.berthPrice}
                  onClick={() => act({ action: 'commission' })}
                >
                  Połóż stępkę dla gildii · {r.berthPrice} zł
                </button>
              )}
              {!ship && (
                <div className="yard-empty">
                  <h3>
                    {selected
                      ? 'Nie znaleziono tej szkuty'
                      : 'Pierwsza pochylnia czeka na gildię'}
                  </h3>
                  <p>
                    Mistrz kładzie stępkę za {r.berthPrice} zł. Drewno mogą
                    przynieść kupcy z całej krainy, a okucia zamówić w Żelaznej
                    Kuźni. Po wodowaniu imię statku i nazwiska budowniczych
                    pozostaną w księdze.
                  </p>
                  <dl className="yard-estimate">
                    <div><dt>Stępka</dt><dd>{r.berthPrice} zł</dd></div>
                    <div><dt>Dwie partie dębu</dt><dd>{r.oakLoads * r.oakPrice} zł</dd></div>
                    <div><dt>Okucia</dt><dd>{r.ironPrice} zł</dd></div>
                    <div><dt>Razem</dt><dd>{r.berthPrice + r.oakLoads * r.oakPrice + r.ironPrice} zł</dd></div>
                  </dl>
                </div>
              )}
              {ship && hull && (
                <>
                  <article className="yard-certificate">
                    <div className="yard-folio">
                      <span>Metryka okrętowa</span>
                      <span>Nr {number(hull.id)}</span>
                    </div>
                    <h2>{hull.name ?? 'Kadłub na pochylni'}</h2>
                    <p>
                      Gildia <b>{hull.guild}</b> · {hull.tag}
                    </p>
                    <p>
                      Stępkę położono {date(hull.begun)}. Wpis fundatora nosi podpis „{hull.founder}”.
                      {hull.launched && ' Szkutę zwodowano ' + date(hull.launched) + '.'}
                    </p>
                    {ship.archived && (
                      <p>
                        Po rozwiązaniu gildii opiekę nad szkutą sprawują
                        fundator i budowniczowie.
                      </p>
                    )}
                    <a href={shipLink(hull.id).href}>
                      Stały adres metryki nr {number(hull.id)}
                    </a>
                  </article>
                  {!hull.launched ? (
                    <section className="yard-build">
                      <h3>Na pochylni</h3>
                      <p>
                        Dębowe partie {ship.oak}/{r.oakLoads} · Komplety okuć{' '}
                        {ship.iron}/{r.ironLots}
                      </p>
                      {page.wallet && (
                        <div className="yard-buttons">
                          {ship.oak < r.oakLoads && (
                            <button
                              disabled={
                                disabled ||
                                page.oak < 1 ||
                                page.wallet.gold < r.oakPrice
                              }
                              onClick={() =>
                                act({ action: 'oak', ship: hull.id })
                              }
                            >
                              Dostarcz 6 belek z kei · {r.oakPrice} zł
                            </button>
                          )}
                          {ship.iron < r.ironLots && (
                            <button
                              disabled={
                                disabled || page.wallet.gold < r.ironPrice
                              }
                              onClick={() =>
                                act({ action: 'iron', ship: hull.id })
                              }
                            >
                              Dostarcz okucia z kuźni · {r.ironPrice} zł
                            </button>
                          )}
                        </div>
                      )}
                      {hullReady &&
                        (ship.mayManage ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void act({
                                action: 'launch',
                                ship: hull.id,
                                name,
                              });
                            }}
                          >
                            <label>
                              Imię szkuty{' '}
                              <input
                                value={name}
                                minLength={3}
                                maxLength={32}
                                required
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Imię dla twojej szkuty"
                              />
                            </label>
                            <button
                              className="inn-primary"
                              disabled={disabled || name.trim().length < 3}
                            >
                              Woduj i wpisz do rejestru
                            </button>
                          </form>
                        ) : (
                          <p>Gotowy kadłub czeka na imię od opiekuna.</p>
                        ))}
                    </section>
                  ) : (
                    <section className="yard-build">
                      <h3>List frachtowy na redę</h3>
                      {!job ? (
                        <>
                          <p>
                            Cztery beczki z warzelni popłyną do kupców na
                            redzie. Wystawca wykłada {r.wage} zł na żołd. Po
                            powrocie szyper dostaje żołd, wystawca {r.freight}{' '}
                            zł frachtu, a port zaprzęg do dalszego przewozu.
                          </p>
                          {ship.mayManage && (
                            <button
                              disabled={
                                disabled ||
                                page.salt < r.barrels ||
                                page.wallet!.gold < r.wage
                              }
                              onClick={() =>
                                act({ action: 'hire', ship: hull.id })
                              }
                            >
                              Zatrudnij szypra · odłóż {r.wage} zł
                            </button>
                          )}
                        </>
                      ) : sea ? (
                        <>
                          <p>
                            <b>{job.skipper}</b> ·{' '}
                            {progress < 0.5
                              ? 'Płynie z solą na redę'
                              : 'Wraca z redy do portu'}
                            . Do powrotu{' '}
                            {Math.max(0, Math.ceil((job.due! - now) / 1000))} s.
                          </p>
                          <p>{courseNames[job.course]}{job.pilot && ' · według pomiaru: '+job.pilot}</p>
                          <progress
                            value={progress}
                            max={1}
                            aria-label="Przebieg rejsu"
                          />
                          <div className="yard-route">
                            <span>Port</span>
                            <span>Reda</span>
                            <span>Port</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>
                            {job.payer} podpisał list na {job.barrels} beczki.
                            Na szypra czeka {job.wage} zł. List ważny do{' '}
                            {clock(job.expires)}.
                          </p>
                          {page.wallet && (
                            <div className="yard-buttons">
                              <PassageOrder key={job.id} book={page.pilotage} seconds={page.seconds} busy={disabled}
                                sail={(course,reference)=>act({action:'sail',ship:hull.id,charter:job.id,course,reference})}/>
                              {(ship.mayManage || job.mine) && (
                                <button
                                  disabled={disabled}
                                  onClick={() =>
                                    act({
                                      action: 'withdraw',
                                      ship: hull.id,
                                      charter: job.id,
                                    })
                                  }
                                >
                                  Wycofaj list i zwróć ładunek
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )}
                  <h3>Podpisy budowniczych</h3>
                  {ship.deliveries.length ? (
                    <ul className="yard-lines">
                      {ship.deliveries.map((d) => (
                        <li key={d.id}>
                          <strong>{d.name}</strong>
                          <span>
                            {d.kind === 'oak'
                              ? '6 belek dębowych'
                              : 'Okucia z kuźni'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Cieśla wpisze tu kupca przy pierwszej dostawie.</p>
                  )}
                  {hull.launched && (
                    <>
                      <h3>Dziennik rejsów · {ship.completed}</h3>
                      {ship.journal.length ? (
                        <ol className="yard-log">
                          {ship.journal.map((v) => (
                            <li key={v.id}>
                              <b>{v.skipper}</b> · {date(v.settled!)} ·{' '}
                              {clock(v.departed!)}–{clock(v.settled!)}
                              <small>
                                {v.barrels} beczki soli na redę · wystawca{' '}
                                {v.payer} · żołd {v.wage} zł
                              </small>
                              <small>{courseNames[v.course]}{v.course === 'survey' && (v.depth === null ? ' · sztorm uniemożliwił pomiar' : ' · sonda wskazała '+v.depth+' cm')}
                                {v.course === 'cut' && ' · pomiar: '+v.pilot+' ('+v.depth+' cm)'}</small>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p>
                          Po powrocie pierwszej załogi bosman wpisze tu rejs.
                        </p>
                      )}
                      {ship.more && (
                        <button
                          disabled={busy}
                          onClick={() => setBefore(ship.journal.at(-1)!.id)}
                        >
                          Wcześniejsze rejsy
                        </button>
                      )}{' '}
                      {before && (
                        <button disabled={busy} onClick={() => setBefore(null)}>
                          Najnowsze rejsy
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
              {!page.wallet && (
                <button className="inn-primary" onClick={login}>
                  Zaloguj się do pracy w stoczni
                </button>
              )}
              {note && (
                <p className="yard-note" role="status">
                  {note}
                </p>
              )}
            </section>
            <aside>
              <h2>Zapasy nabrzeża</h2>
              <dl className="yard-stores">
                <div>
                  <dt>Dąb na kei</dt>
                  <dd>
                    {page.oak * 6} <small>szt.</small>
                  </dd>
                </div>
                <div>
                  <dt>Beczki soli</dt>
                  <dd>
                    {page.salt} <small>szt.</small>
                  </dd>
                </div>
              </dl>
              <p>
                Poszycie jednej szkuty wymaga dwunastu belek. Z tego samego
                stosu cieśle biorą drewno na wozy portowe.
              </p>
              <h3>Wyjście na redę</h3>
              <p>
                {page.seconds === null
                  ? 'Sztorm zamknął wyjście. Ładunek i żołd czekają w porcie.'
                  : 'Przy tej pogodzie nowy rejs tam i z powrotem potrwa ' +
                    page.seconds +
                    ' s.'}
              </p>
              <InnGuide cue="stocznia" muted={muted} />
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
