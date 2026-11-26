import { GuildPost, SeaPost } from './SeaPost';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CITIES, WEATHER_CONDITIONS, type WeatherConditionId } from '../economy/economyEngine';
import { getCityInteriorSpec } from '../economy/cityAndArenaEngine';
import {
  convoyReduction,
  noticeKinds,
  type InnBook,
  type NoticeKind,
} from '../economy/merchantInn';
import { gameRequest } from '../utils/gameServer';
import { InnSpurRoll } from './SpurTrial';
import { InnRoadLedger } from './StandardSchool';
import { NewsBoard } from './Garrison';
import { infirmaryHref,type WardSnapshot } from '../economy/infirmary';
import { garrisonHref } from '../economy/garrison';
import { cinemaFile } from './MerchantRoad';
import { RiverReports } from './RiverMarks';
import BridgeHouse from './BridgeHouse';
import Shipyard from './Shipyard';
import { PortLink } from './PortLink';
import { ReturnFreightDesk } from './ReturnFreight';
import { LaunchBoard } from './LaunchBoard';
import { SoundingBounty } from './SoundingBounty';
import { PilotHouse, PilotNotice } from './PilotHouse';
import { barterHref, barterLot } from '../economy/barter';
import { fairGoods, fairHref, isFairTown } from '../economy/harvestFair';
import { HarvestTable } from './HarvestFeast';
import { feastTowns, type FeastTown } from '../economy/harvestLoaf';
import {MillHouse} from './MillHouse';
import type {MillMark} from '../economy/mill';
import { InnGuide } from './InnGuide';
import './merchantInn.css';
export type InnTab = 'board' | 'guild' | 'mill' | 'bridge' | 'shipyard' | 'pilots' | 'rafting' | 'freight' | 'mutual' | 'field' | 'feast' | 'fair' | 'barter' | 'garrison' | 'ward';
interface Props {
  city: string;
  token: string | null;
  tab: InnTab;
  onTab: (v: InnTab, town?:FeastTown) => void;
  onClose: () => void;
  onHarbor: () => void;
  onCabinet:()=>void;
  onNests:()=>void;
  postFromNests:boolean;
  onAccount: () => void;
  onSettlement:(uid:string,mark:MillMark,snapshot?:WardSnapshot)=>void;
  onMembership: (id: string, tag: string) => void;
  weather: WeatherConditionId;
  muted: boolean;
}
export default function MerchantInn({
  city,
  token,
  tab,
  onTab,
  onClose,
  onHarbor,onCabinet,onNests,postFromNests,
  onAccount,
  onSettlement,
  onMembership,
  weather,
  muted,
}: Props) {
  const [book, setBook] = useState<InnBook | null>(null),
    [error, setError] = useState(''),
    [readError, setReadError] = useState(false),
    [notice, setNotice] = useState(''),
    [kind, setKind] = useState<NoticeKind>('handel'),
    [letter, setLetter] = useState(''),
    [name, setName] = useState(''),
    [tag, setTag] = useState(''),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState('');
  const seq = useRef(0),
    locked = useRef(false),
    draft = useRef<{ json: string; nonce: string } | null>(null);
  const endpoint = '/api/inn/' + city;
  const headers = token ? { Authorization: 'Bearer ' + token } : undefined;
  const apply = useCallback(
    (b: InnBook) => {
      setBook(b);
      if (token && b.uid && b.walletMark) onSettlement(b.uid, b.walletMark);
      if (token && b.uid)
        onMembership(b.membership, b.groups.find((g) => g.id === b.membership)?.tag ?? '');
    },
    [onMembership, onSettlement, token],
  );
  const read = useCallback(async () => {
    if (locked.current) return;
    const n = ++seq.current;
    try {
      const r = await gameRequest(endpoint, {
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        cache: 'no-store',
      });
      if (!r.ok) throw Error();
      const b = await r.json();
      if (n === seq.current) {
        apply(b);
        setReadError(false);
      }
    } catch {
      if (n === seq.current) {
        setBook(null);
        setReadError(true);
      }
    }
  }, [endpoint, token, apply]);
  useEffect(() => {
    void read();
    const refresh = () => {
      if (!document.hidden) void read();
    };
    const timer = setInterval(refresh, 4000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      seq.current++;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [read]);
  async function act(action: string, params: Record<string, unknown>, success: string) {
    if (!token || locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setReceipt('');
    const n = ++seq.current;
    const json = JSON.stringify({ action, ...params });
    if (draft.current?.json !== json) draft.current = { json, nonce: crypto.randomUUID() };
    try {
      const r = await gameRequest(endpoint, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params, nonce: draft.current.nonce }),
      });
      const b = await r.json();
      if (!r.ok) {
        if (r.status < 500) draft.current = null;
        throw Error(b.error ?? 'Polecenie nie powiodło się.');
      }
      if (n !== seq.current) return false;
      draft.current = null;
      apply(b);
      setReceipt(success);
      return true;
    } catch (e) {
      if (n === seq.current)
        setError(
          e instanceof TypeError
            ? 'Brak połączenia. Możesz ponowić tę samą czynność.'
            : (e as Error).message,
        );
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const signedIn = !!book?.uid;
  const mine = book?.groups.find((g) => g.id === book.membership),
    chief = !!mine && mine.founder === book?.uid;
  const [handover, setHandover] = useState('');
  const [filter, setFilter] = useState('all');
  const board = book?.notices.filter((n) => filter === 'all' || n.kind === filter) ?? [];
  if ((tab === 'fair' || tab === 'barter' || tab === 'garrison' || tab === 'ward') && isFairTown(city)) return <main className="merchant-inn common-field">
    <nav className="field-nav" aria-label="Drogi między targiem i koszarami">{tab!=='ward' && <PortLink href={infirmaryHref(city)} go={()=>onTab('ward',city)}>Lazaret</PortLink>}{tab !== 'garrison' && <PortLink href={garrisonHref(city)} go={()=>onTab('garrison',city)}>Koszary i poczta traktowa</PortLink>}{tab !== 'barter' ? <PortLink href={barterHref(city)} go={()=>onTab('barter',city)}>Targ bez monety</PortLink> : <PortLink href={fairHref(city)} go={()=>onTab('fair',city)}>Wróć na plac dożynkowy</PortLink>}<PortLink href={'?miejsce=karczma&miasto='+city+'#stol-dozynkowy'} go={()=>onTab('board',city)}>Do stołu w karczmie</PortLink><button onClick={onClose}>Na trakt</button></nav>
    <MillHouse visit={onTab} room={tab} city={city} token={token} onAccount={onAccount} onSettlement={onSettlement}/>
  </main>;
  if (tab === 'feast') return <main className="merchant-inn common-field">
    <nav className="field-nav" aria-label="Drogi z piekarni"><button onClick={()=>onTab('field')}>Na wspólne pole</button><button onClick={()=>onTab('mill')}>Do młyna</button></nav>
    <MillHouse visit={onTab} room="feast" city={city} token={token} onAccount={onAccount} onSettlement={onSettlement}/>
  </main>;
  if (tab === 'field') return <main className="merchant-inn common-field">
    <nav className="field-nav" aria-label="Drogi ze wspólnego pola"><button onClick={onClose}>Wróć do gry</button><button onClick={()=>onTab('mill')}>Do młyna</button></nav>
    <MillHouse visit={onTab} room="field" city={city} token={token} onAccount={onAccount} onSettlement={onSettlement}/>
  </main>;
  if(tab==='pilots') return <PilotHouse yard={()=>onTab('shipyard')} inn={()=>onTab('board')} book={book?.pilotage ?? null} error={readError} retry={read} close={onClose} muted={muted}/>;
  if(tab==='shipyard') return <Shipyard inn={()=>onTab('board')} pilots={()=>onTab('pilots')} token={token} muted={muted} close={onClose} login={onAccount} guild={()=>onTab('guild')} landing={()=>onTab('rafting')} harbor={onHarbor} settlement={onSettlement}/>;
  if(tab==='bridge' || tab==='rafting') return <BridgeHouse onYard={()=>onTab('shipyard')} onHarbor={onHarbor} key={tab} atLanding={tab==='rafting'} switchLanding={()=>onTab(tab==='rafting'?'bridge':'rafting')} token={token} muted={muted} onAccount={onAccount} onClose={onClose} onGuild={()=>onTab('guild')} onBoard={()=>onTab('board')} onSettlement={onSettlement}/>;
  return (
    <main className="merchant-inn">
      <header
        className="inn-hero"
        style={{ backgroundImage: 'url(' + cinemaFile(tab==='mutual'?'sakwa.webp':tab==='freight'?'list-przewozowy.webp':tab==='mill'?'mlyn.webp':'gospoda.webp') + ')' }}
      >
        <div className="inn-heading">
          <span>{CITIES.find((c) => c.id === city)?.name}</span>
          <h1>{tab==='mutual'?'Kasa gildii':tab==='freight'?'Listy przewozowe':tab==='mill'?'Młyn miejski':getCityInteriorSpec(city).tavernName}</h1>
        </div>
        <button onClick={onClose}>Wróć do gry</button>
      </header>
      <section className="inn-room">
        <div className="inn-nav">
          <nav aria-label="Sale karczmy">
            <button
              aria-pressed={tab === 'board'}
              onClick={() => {
                onTab('board');
                setReceipt('');
              }}
            >
              Tablica ogłoszeń
            </button>
            <button
              aria-pressed={tab === 'guild'}
              onClick={() => {
                onTab('guild');
                setReceipt('');
              }}
            >
              Stół gildii
            </button>
            <button aria-pressed={tab==='mill'} onClick={()=>{onTab('mill');setReceipt('');}}>Kontrakty i młyn</button>
            <button aria-pressed={tab==='freight'} onClick={()=>{onTab('freight');setReceipt('');}}>Listy przewozowe</button>
            <button aria-pressed={tab==='mutual'} onClick={()=>{onTab('mutual');setReceipt('');}}>Kasa gildii</button>
            <button onClick={()=>onTab('shipyard')}>Stocznia szkutnicza</button>
            <button onClick={()=>onTab('rafting')}>Przystań flisaków</button>
            {city === 'srebrny_gaj' && <button onClick={()=>onTab('field')}>Wspólne pole</button>}
            <button onClick={()=>onTab('bridge')}>Most w Srebrnym Gaju</button>
          </nav>
          {tab!=='freight' && <span>{WEATHER_CONDITIONS[weather].name}</span>}
        </div>
        <InnGuide key={tab} cue={tab === 'mutual' ? 'kasa' : tab === 'freight' ? 'przewozy' : tab === 'board' ? 'karczma' : tab==='mill'?'mlyn':'gildia'} muted={muted} />
        {error && <p role="alert">{error}</p>}
        {readError && (
          <p role="alert">
            Nie udało się otworzyć księgi. <button onClick={read}>Spróbuj ponownie</button>
          </p>
        )}
        {tab==='guild' && book?.membership && book.seaMail && <GuildPost onNests={onNests} letters={book.seaMail.received}/>}
        {receipt && <p role="status">{receipt}</p>}
        {!book && !readError && <p>Karczmarz przynosi księgę…</p>}
        {(tab==='mill' || tab==='freight' || tab==='mutual') && <MillHouse visit={onTab} key={tab} room={tab} city={city} token={token} onAccount={onAccount} onSettlement={onSettlement}/>}
        {!!book && tab!=='mill' && tab!=='freight' && tab!=='mutual' && (
          <div className="inn-spread">
            <section>
              {tab === 'board' ? (
                <>
                  {<button className="inn-link" onClick={onCabinet}>Wędrowny gabinet · droga do Domu Matryc</button>}
                  {city==='krolewska_przystan' && book.seaMail && <SeaPost postFromNests={postFromNests} book={book} busy={busy} login={onAccount} act={act}/>}
                  {isFairTown(city) && <section className="feast-table">{!!book.reliefCalls?.length && <MillHouse visit={onTab} room="relief" city={city} token={token} onAccount={onAccount} onSettlement={onSettlement}/>}<PortLink href={infirmaryHref(city)} go={()=>onTab('ward',city)}>Do lazaretu przy koszarach</PortLink><InnSpurRoll entries={book.spurRoll ?? []}/><InnRoadLedger records={book.roadRecords ?? []}/><NewsBoard letters={book.newsLetters ?? []} now={book.boardAt}/><PortLink href={garrisonHref(city)+'#kuchnia'} go={()=>onTab('garrison',city)}>Kuchnia polowa, koszary i poczta traktowa</PortLink></section>}
                  {isFairTown(city) && book.barterCalls && (
                    <section className="feast-table" id="wezwania-kupcow" aria-label="Wezwania z targu">
                      <h3>Wezwania z targu</h3>
                      {book.barterCalls.length ? <ul>{book.barterCalls.map(call => (
                        <li key={call.id}>
                          <strong>{call.firstName} i {call.secondName}</strong> szukają trzeciego kupca.
                          <p>Przynieś {barterLot(call.give, call.giveQty)}. Otrzymasz {barterLot(call.want, call.wantQty)} po podpisaniu umowy.</p>
                          <PortLink href={barterHref(city, call.id)} go={() => onTab('barter', city)}>Obejrzyj tę wymianę</PortLink>
                        </li>
                      ))}</ul> : <p>Dziś na tablicy nie ma czynnych wezwań.</p>}
                      <PortLink href={barterHref(city)} go={() => onTab('barter', city)}>Przejdź na targ bez monety</PortLink>
                    </section>
                  )}
                  {book.harvestTable && feastTowns.some(town=>town===city) && <HarvestTable visit={onTab} loaves={book.harvestTable}/>}
                  {isFairTown(city) && <section className="feast-table">
                    {book.fair?.opening && <><h3>Zamówienia przy stole</h3><ul>{fairGoods.map(good=>{
                      const wagon = book.fair!.wagons.find(w=>w.good===good);
                      const order = good==='zboze' ? 'Piekarz prosi o worek królewskiego zboża.' : 'Kowal prosi o partię rudy żelaza.';
                      return <li key={good}>{order} {wagon ? (wagon.arrival<=book.boardAt ? 'Dowieziono' : 'W drodze')+' · '+wagon.carrier : 'Czeka na dostawcę.'}</li>;
                    })}</ul></>}
                    <PortLink href={fairHref(city)} go={()=>onTab('fair',city)}>{book.fair?.opening ? 'Zamówienia piekarza i kowala na placu' : 'Przejdź na plac dożynkowy'}</PortLink>
                  </section>}
                  {book.launches?.returns && <ReturnFreightDesk orders={book.launches.returns} accounts={book.launches.freightAccounts ?? []} bids={book.launches.stallBids ?? []} token={token} login={onAccount}
                    yard={()=>onTab('shipyard')} refresh={read} update={page => {
                      ++seq.current;
                      setBook(prev => prev?.launches ? { ...prev, launches: { ...prev.launches, returns: page.returns, freightAccounts: page.freightAccounts, stallBids: page.stallBids } } : prev);
                      if (page.wallet) onSettlement(page.wallet.uid, page.wallet.mark);
                    }}/>}
                  {book.launches && <LaunchBoard board={book.launches} yard={()=>onTab('shipyard')}/>}
                  {book.pilotage && <>
                    <PortLink href="?miejsce=stocznia&keja=lichtugi" go={()=>onTab('shipyard')}>Praca na wodzie · keja lichtug</PortLink>
                    <PilotNotice book={book.pilotage} open={()=>onTab('pilots')} />
                    <SoundingBounty key={book.pilotage.edition} book={book.pilotage} token={token} login={onAccount} yard={()=>onTab('shipyard')}
                      refresh={read} update={(pilotage, uid, mark) => {
                        ++seq.current;
                        setBook(prev => prev ? { ...prev, pilotage, walletMark: mark } : prev);
                        onSettlement(uid, mark);
                      }} />
                  </>}
                  {city === 'srebrny_gaj' && <RiverReports reports={book.riverReports} now={book.boardAt} go={()=>onTab('bridge')}/>}
                  <div className="inn-subhead">
                    <h2>Ogłoszenia kupców</h2>
                    <select
                      aria-label="Rodzaj ogłoszeń"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Wszystkie</option>
                      {Object.entries(noticeKinds).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  {board.length === 0 && (
                    <p>
                      {filter === 'all'
                        ? 'W tej gospodzie jest jeszcze miejsce na pierwsze ogłoszenie.'
                        : 'Nie ma ogłoszeń tego rodzaju.'}
                    </p>
                  )}
                  {board.map((n) => (
                    <article className="inn-post" key={n.id}>
                      <small>
                        {noticeKinds[n.kind]} · {new Date(n.at).toLocaleDateString('pl-PL')}
                      </small>
                      <h3>{n.name}</h3>
                      <p>{n.body}</p>
                      {n.signed.length > 0 && <p>Chętni · {n.signed.join(', ')}</p>}
                      {signedIn && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            act(
                              n.owner === book.uid ? 'close' : n.volunteered ? 'unsign' : 'sign',
                              { notice: n.id },
                              n.owner === book.uid
                                ? 'Sprawa zamknięta.'
                                : n.volunteered
                                  ? 'Wycofano zgłoszenie.'
                                  : 'Twój podpis jest na tablicy.',
                            )
                          }
                        >
                          {n.owner === book.uid
                            ? 'Zamknij ogłoszenie'
                            : n.volunteered
                              ? 'Wycofaj podpis'
                              : 'Zgłoś się'}
                        </button>
                      )}
                    </article>
                  ))}
                </>
              ) : mine ? (
                <>
                  <h2>{mine.name}</h2>
                  <PortLink href={garrisonHref(isFairTown(city)?city:'zelazna_kuznia')+'#sztafeta'} go={()=>onTab('garrison',isFairTown(city)?city:'zelazna_kuznia')}>Do stacji przeprzęgowej gildii</PortLink>
                  <p className="inn-meta">
                    {book.members.length} przy stole · czas nowych konwojów kancelarii krótszy o{' '}
                    {convoyReduction(mine.count)}%
                  </p>
                  <h3>Rozmowa członków</h3>
                  {!book.letters.length && <p>Przy tym stole nikt jeszcze nie zabrał głosu.</p>}
                  <ol className="inn-letters">
                    {book.letters.map((m) => (
                      <li key={m.id}>
                        <strong>{m.name}</strong>{' '}
                        <time>
                          {new Date(m.at).toLocaleString('pl-PL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                        <p>{m.body}</p>
                      </li>
                    ))}
                  </ol>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await act(
                          'letter',
                          { groupId: mine.id, body: letter },
                          'Wiadomość przyjęta.',
                        )
                      )
                        setLetter('');
                    }}
                  >
                    <label>
                      Wiadomość do gildii
                      <textarea
                        maxLength={480}
                        required
                        value={letter}
                        onChange={(e) => setLetter(e.target.value)}
                      />
                    </label>
                    <button className="inn-primary" disabled={busy || !letter.trim()}>
                      Wyślij do gildii
                    </button>
                  </form>
                  <details>
                    <summary>Członkowie i proporzec</summary>
                    <ul>
                      {book.members.map((m) => (
                        <li key={m.uid}>
                          {m.name}
                          {m.uid === mine.founder ? ' · mistrz gildii' : ''}
                        </li>
                      ))}
                    </ul>
                    {chief && book.members.length > 1 && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (window.confirm('Przekazać temu kupcowi prowadzenie gildii?'))
                            void act(
                              'transfer',
                              { who: handover },
                              'Przekazano prowadzenie gildii.',
                            );
                        }}
                      >
                        <label>
                          Nowy mistrz
                          <select
                            required
                            value={handover}
                            onChange={(e) => setHandover(e.target.value)}
                          >
                            <option value="">Wybierz kupca</option>
                            {book.members
                              .filter((m) => m.uid !== book.uid)
                              .map((m) => (
                                <option key={m.uid} value={m.uid}>
                                  {m.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button disabled={busy || !handover}>Przekaż proporzec</button>
                      </form>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            chief && book.members.length === 1
                              ? 'Zamknąć gildię i zdjąć proporzec?'
                              : 'Opuścić tę gildię?',
                          )
                        )
                          void act('leave', {}, 'Opuszczono gildię.');
                      }}
                    >
                      {chief && book.members.length === 1 ? 'Zamknij swoją gildię' : 'Opuść gildię'}
                    </button>
                  </details>
                  {chief && book.applicants.length > 0 && (
                    <>
                      <h3>Prośby o przyjęcie</h3>
                      {book.applicants.map((p) => (
                        <p key={p.uid}>
                          {p.name}{' '}
                          <button
                            disabled={busy}
                            onClick={() => act('accept', { who: p.uid }, 'Kupiec przyjęty.')}
                          >
                            Przyjmij
                          </button>{' '}
                          <button
                            disabled={busy}
                            onClick={() => act('decline', { who: p.uid }, 'Prośba oddalona.')}
                          >
                            Oddal
                          </button>
                        </p>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <>
                  <h2>Przy wspólnym stole</h2>
                  <p>
                    Wybierz istniejący proporzec albo daj początek własnej gildii. Każdy kolejny
                    zrzeszony kupiec skraca przewóz kancelarii o 5%, aż do 20%.
                  </p>
                </>
              )}
            </section>
            <aside>
              {tab === 'board' ? (
                <>
                  <h2>Przybij ogłoszenie</h2>
                  {signedIn ? (
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          await act('post', { body: notice, kind }, 'Ogłoszenie wisi na tablicy.')
                        )
                          setNotice('');
                      }}
                    >
                      <label>
                        Sprawa
                        <select
                          value={kind}
                          onChange={(e) => setKind(e.target.value as NoticeKind)}
                        >
                          {Object.entries(noticeKinds).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Treść
                        <textarea
                          minLength={5}
                          maxLength={360}
                          required
                          value={notice}
                          onChange={(e) => setNotice(e.target.value)}
                          placeholder="Kogo lub czego szukasz?"
                        />
                      </label>
                      <small>
                        Ogłoszenie wisi w tym mieście przez siedem dni lub do zamknięcia przez
                        autora.
                      </small>
                      <button className="inn-primary" disabled={busy}>
                        Wywieś ogłoszenie
                      </button>
                    </form>
                  ) : (
                    <>
                      <p>Kupcy mogą zostawiać zlecenia i podpisywać się pod ogłoszeniami innych.</p>
                      <button className="inn-primary" onClick={onAccount}>
                        Zaloguj się w karczmie
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <h2>Gildie kupieckie</h2>
                  {!signedIn && <button onClick={onAccount}>Zaloguj się w karczmie</button>}
                  {book.groups.map((g) => (
                    <div className="inn-company" key={g.id}>
                      <strong>{g.name}</strong>
                      <small>
                        {g.tag} · zrzeszeni gracze {g.count}
                      </small>
                      {signedIn && g.id !== mine?.id && !chief && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            book.applied === g.id
                              ? act('withdraw', {}, 'Prośba wycofana.')
                              : act(
                                  'apply',
                                  { groupId: g.id },
                                  g.privateHall
                                    ? 'Prośba czeka na decyzję mistrza.'
                                    : 'Zasiadasz przy nowym stole.',
                                )
                          }
                        >
                          {book.applied === g.id
                            ? 'Wycofaj prośbę'
                            : g.privateHall
                              ? 'Poproś o przyjęcie'
                              : 'Dołącz do gildii'}
                        </button>
                      )}
                    </div>
                  ))}
                  {signedIn && !chief && (
                    <details>
                      <summary>Załóż własną gildię</summary>
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            await act(
                              'create',
                              { body: name, tag },
                              'Proporzec nowej gildii zawisł w karczmie.',
                            )
                          ) {
                            setName('');
                            setTag('');
                          }
                        }}
                      >
                        <label>
                          Nazwa gildii
                          <input
                            required
                            minLength={3}
                            maxLength={36}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <label>
                          Znak proporca
                          <input
                            required
                            minLength={2}
                            maxLength={6}
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                          />
                        </label>
                        <button className="inn-primary" disabled={busy}>
                          Załóż gildię
                        </button>
                      </form>
                    </details>
                  )}
                </>
              )}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
