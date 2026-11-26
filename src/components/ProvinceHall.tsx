import { useCallback, useEffect, useRef, useState } from 'react';
import { CITIES } from '../economy/economyEngine';
import { gameRequest } from '../utils/gameServer';

export type Town = {
  id: number;
  name: string;
  owner: string;
  governor: string;
  site: string;
  approved: number;
  wood: number;
  iron: number;
  capital: number | null;
  toll: number;
  treasury: number;
};
type Entry = {
  id: number;
  name: string;
  person: string;
  site: string;
  story: string;
  created: string;
  witnesses: string[];
};
type Register = {
  towns: Town[];
  uid?: string;
  admin: boolean;
  invitations: { town: number; capital: number; toll: number }[];
  freight?: { town: number; due: number; cargo: string };
};
const empty: Register = { towns: [], admin: false, invitations: [] };
export function useProvinceRegister(token: string | null) {
  const [data, setData] = useState<Register>(empty);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++seq.current;
    try {
      const r = await gameRequest('/api/provinces', {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
      });
      if (!r.ok) throw Error();
      const result: Register = await r.json();
      if (id === seq.current) {
        setData(result);
        setError('');
      }
    } catch {
      if (id === seq.current) setError('Nie udało się odczytać rejestru.');
    }
  }, [token]);
  useEffect(() => {
    setData(empty);
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 20000);
    return () => {
      seq.current++;
      clearInterval(timer);
    };
  }, [refresh]);
  return { data, refresh, error };
}
const complete = (t: Town) => t.wood >= 2 && t.iron >= 2;
const place = (id: string) => CITIES.find((c) => c.id === id)?.name ?? id;
const button =
  'rounded border border-amber-700/60 px-3 py-2 text-amber-200 hover:bg-amber-900/40 disabled:opacity-50';
const field = 'rounded bg-slate-950 border border-slate-700 p-2 text-white';
export function ProvinceHall({
  register,
  token,
  site,
  onSite,
  person,
  onPerson,
}: {
  register: ReturnType<typeof useProvinceRegister>;
  token: string | null;
  site: string;
  onSite: (id: string) => void;
  person: string;
  onPerson: (uid: string) => void;
}) {
  const { data, refresh, error } = register;
  const [name, setName] = useState('');
  const [toll, setToll] = useState(5);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const retry = useRef({ body: '', nonce: '' });
  const [before, setBefore] = useState(Number.MAX_SAFE_INTEGER);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [more, setMore] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  useEffect(() => {
    setBefore(Number.MAX_SAFE_INTEGER);
  }, [person]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ before: String(before), person });
    gameRequest('/api/provinces/chronicle?' + query, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((page) => {
        if (!controller.signal.aborted) {
          setEntries(page.entries);
          setMore(page.more);
          setArchiveError('');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setArchiveError('Nie udało się otworzyć kroniki.');
      });
    return () => controller.abort();
  }, [before, person, data]);
  const mine = data.towns.find((t) => t.owner === data.uid);
  const invitation = data.invitations[0];
  const cityName = (id: number) => data.towns.find((t) => t.id === id)?.name;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!data.freight) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data.freight?.due]);
  async function act(action: string, details: Record<string, unknown> = {}) {
    if (!token || lock.current) return;
    lock.current = true;
    setBusy(true);
    setStatus('');
    const body = JSON.stringify({ action, ...details });
    if (body !== retry.current.body) retry.current = { body, nonce: crypto.randomUUID() };
    try {
      const r = await gameRequest('/api/provinces/orders', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...details, nonce: retry.current.nonce }),
      });
      if (!r.ok) {
        setStatus((await r.json().catch(() => null))?.error || 'Zaloguj się ponownie.');
        return;
      }
      retry.current = { body: '', nonce: '' };
      setStatus('Zapisano w rejestrze.');
      await refresh();
    } catch {
      setStatus('Brak odpowiedzi. Ponów to samo polecenie.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mb-4 rounded-lg border border-amber-800/70 bg-gradient-to-br from-[#211a13] to-[#101920] p-4 text-sm text-slate-100 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-amber-200">Kancelaria ziemska</h2>
        <button className={button} onClick={() => void refresh()}>
          Odśwież
        </button>
      </header>
      {(status || error) && <p role="status">{status || error}</p>}
      {!token && <p>Zaloguj się w zakładce Konto, aby złożyć petycję lub poprowadzić karawanę.</p>}
      <fieldset disabled={busy} className="space-y-3">
        {token && !mine && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act('petition', { name, site });
            }}
          >
            <label>
              Nazwa miasta
              <br />
              <input
                className={field}
                required
                minLength={3}
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Okręg na mapie
              <br />
              <select className={field} value={site} onChange={(e) => onSite(e.target.value)}>
                {CITIES.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={button}>Złóż petycję · 4 sztabki po zatwierdzeniu</button>
          </form>
        )}
        {data.freight && (
          <button
            className={button}
            disabled={now < data.freight.due}
            onClick={() => act('arrive', { town: data.freight!.town })}
          >
            Rozładuj konwój · {cityName(data.freight.town)} ·{' '}
            {Math.max(0, Math.ceil((data.freight.due - now) / 1000))} s
          </button>
        )}
        {invitation && (
          <div>
            Propozycja unii ze stolicą {cityName(invitation.capital)} · myto {invitation.toll}%{' '}
            <button className={button} onClick={() => act('accept', { town: invitation.town })}>
              Przyjmij
            </button>{' '}
            <button className={button} onClick={() => act('decline', { town: invitation.town })}>
              Odrzuć
            </button>
          </div>
        )}
        {!!mine && mine.capital === mine.id && (
          <label>
            Proponowane myto (%){' '}
            <input
              className={field}
              type="number"
              min={0}
              max={10}
              value={toll}
              onChange={(e) => setToll(Number(e.target.value))}
            />
          </label>
        )}
        {data.towns.map((t) => (
          <article key={t.id} className="border-t border-amber-900/60 pt-2 space-y-2">
            <h3 className="font-semibold">
              {t.name} · {t.governor}
            </h3>
            <button className="underline text-amber-200" onClick={() => onSite(t.site)}>
              {place(t.site)}
            </button>
            <p>
              {!t.approved ? 'Czeka na pieczęć' : !complete(t) ? 'Plac budowy' : 'Miasto'} · drewno{' '}
              {t.wood}/2 · żelazo {t.iron}/2
              {t.capital
                ? ' · Księstwo: ' + cityName(t.capital) + (t.capital===t.id?' · tytuł zarządcy: książę':' · 20% myta dla stolicy') + ' · skarbiec miasta: ' + t.treasury + ' zł'
                : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {!t.approved && data.admin && (
                <>
                  <button className={button} onClick={() => act('approve', { town: t.id })}>
                    Opieczętuj akt
                  </button>
                  <button className={button} onClick={() => act('reject', { town: t.id })}>
                    Oddal petycję
                  </button>
                </>
              )}
              {token &&
                !!t.approved &&
                !complete(t) &&
                !data.freight &&
                (['wood', 'iron'] as const)
                  .filter((k) => t[k] < 2)
                  .map((k) => (
                    <button
                      className={button}
                      key={k}
                      onClick={() => act('dispatch', { town: t.id, cargo: k })}
                    >
                      Przewieź {k === 'wood' ? 'drewno z tartaku' : 'żelazo z huty'} · 1 min
                    </button>
                  ))}
              {mine?.id === t.id && complete(t) && !t.capital && (
                <button className={button} onClick={() => act('found', { town: t.id })}>
                  Ustanów księstwo · 10 sztabek
                </button>
              )}
              {mine && mine.capital === mine.id && complete(t) && !t.capital && (
                <button className={button} onClick={() => act('invite', { town: t.id, toll })}>
                  Zaproś do unii · {toll}%
                </button>
              )}
              {mine &&
                mine.id !== t.id &&
                mine.capital &&
                mine.capital === t.capital &&
                !data.freight && (
                  <button
                    className={button}
                    onClick={() => act('dispatch', { town: t.id, cargo: 'handel' })}
                  >
                    Konwój handlowy · 100 zł · myto {t.toll}%
                  </button>
                )}
            </div>
          </article>
        ))}
      </fieldset>
      <div className="border-t border-amber-900/60 pt-3">
        <h3 className="font-serif text-lg">Kronika ziem i nadań</h3>
        {person && (
          <button className={button} onClick={() => onPerson('')}>
            Pokaż wszystkich
          </button>
        )}
        {archiveError && <p role="status">{archiveError}</p>}
        {!entries.length && <p className="text-slate-400">Brak wpisów{person ? ' o tym kupcu' : ''}.</p>}
        <ol className="max-h-64 overflow-y-auto divide-y divide-slate-700">
          {entries.map((e) => (
            <li key={e.id} className="py-2">
              <strong>{e.name}</strong> ·{' '}
              <button className="underline" onClick={() => onSite(e.site)}>
                {place(e.site)}
              </button>{' '}
              · {e.created} UTC
              <p>{e.story}</p>
              {e.witnesses.length > 0 && <p>Świadkowie: {e.witnesses.join(', ')}</p>}
              {token && (
                <button
                  disabled={busy}
                  className="text-amber-300 underline"
                  onClick={() => act('witness', { town: e.id })}
                >
                  Potwierdzam jako świadek
                </button>
              )}
            </li>
          ))}
        </ol>
        {more && (
          <button className={button} onClick={() => setBefore(entries[entries.length - 1].id)}>
            Starsze zapisy
          </button>
        )}
        {before < Number.MAX_SAFE_INTEGER && (
          <button className={button} onClick={() => setBefore(Number.MAX_SAFE_INTEGER)}>
            Najnowsze zapisy
          </button>
        )}
      </div>
    </section>
  );
}
