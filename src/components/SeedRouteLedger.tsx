import { useEffect, useState } from 'react';
import type { SeedRoute } from '../economy/commonField';
import { gameRequest } from '../utils/gameServer';

export function SeedRouteLedger({id}: {id:number}) {
  const [open, setOpen] = useState(false);
  return <details onToggle={ev => setOpen(ev.currentTarget.open)}>
    <summary>Prześledź drogę tego ziarna</summary>
    {open && <Passages id={id}/>}
  </details>;
}

function Passages({id}: {id:number}) {
  const [cursor, setCursor] = useState(id);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<SeedRoute | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const request = new AbortController();
    setPage(null);
    setFailed(false);
    async function read() {
      try {
        const response = await gameRequest('/api/field/seed/' + cursor, {signal:request.signal});
        if (!response.ok) throw Error();
        const result: SeedRoute = await response.json();
        if (!request.signal.aborted) setPage(result);
      } catch {
        if (!request.signal.aborted) setFailed(true);
      }
    }
    void read();
    return () => request.abort();
  }, [cursor, attempt]);
  if (failed) return <p role="alert">Nie udało się odczytać księgi. <button onClick={()=>setAttempt(attempt+1)}>Spróbuj ponownie</button></p>;
  if (!page) return <p role="status">Odczytywanie podpisów…</p>;
  return <div className="seed-route"><ol aria-label="Droga ziarna od najnowszego siewu">{page.steps.map(s =>
    <li key={s.id}><small>Dzień {s.day}</small> {s.donor} → {s.receiver}</li>)}</ol>
    {page.older !== null && <button onClick={()=>setCursor(page.older!)}>Wcześniejsze siewy</button>}
    {cursor !== id && <button onClick={()=>setCursor(id)}>Wróć do ostatniego siewu</button>}
  </div>;
}
