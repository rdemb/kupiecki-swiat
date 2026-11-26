import { useState } from 'react';
import { cinemaFile } from './MerchantRoad';
import { WEATHER_CONDITIONS } from '../economy/economyEngine';
import { otherPost, rationPlan, townNames, units, type GarrisonBook, type Ration } from '../economy/garrison';
import type { Passage } from '../economy/bridge';
import type { FeastTown } from '../economy/harvestLoaf';
import type { MillBook } from '../economy/mill';
import { mentorMarks, roadNames, schoolLegSeconds, validRecruitName, type RoadRecord, type SchoolCommand } from '../economy/standardSchool';

const time = new Intl.DateTimeFormat('pl-PL', {hour:'2-digit', minute:'2-digit'});
const stamp = new Intl.DateTimeFormat('pl-PL', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
interface Props {
  town: FeastTown;
  book: GarrisonBook;
  wallet: MillBook['wallet'];
  busy: boolean;
  ration: Ration;
  canProvision: boolean;
  knightAway: boolean;
  onAccount: () => void;
  sign: (cmd: SchoolCommand, note: string) => Promise<boolean>;
}
export function StandardSchool({town,book,wallet,busy,ration,canProvision,knightAway,onAccount,sign}: Props) {
  const [name,setName] = useState('');
  const [choice,setChoice] = useState<Passage>('bridge');
  const { school, mine } = book;
  if (!school) return null;
  const road = school.closed ? 'detour' : choice;
  const leg = schoolLegSeconds(road, school.weather, rationPlan(ration, 1, mine?.fatigue ?? 0).delay);
  const own = school.guides.find(g => g.own);
  return <section id="szkola" className="standard-school">
    <header className="school-cover"><div><h2>Nauka pod chorągwią</h2>
      <p>Za bramą rycerz oddaje uczniowi lejce. Wiozą worek zboża do drugiego garnizonu. Po powrocie giermek może prowadzić wozy swojej gildii tą samą drogą.</p></div>
      <img loading="lazy" src={cinemaFile('nauka-pod-choragwia.webp')} width={1280} height={640} alt="U bramy rycerz przekazuje lejce uczennicy. Na wozie leżą worki zboża, w oddali widać przeprawę."/>
    </header>
    {!mine || !wallet ? <button onClick={onAccount}>Zaloguj się, by przyjąć ucznia</button> : <>
      {!own && <form onSubmit={async e => { e.preventDefault(); if (await sign({action:'enrolSquire',name:name.trim()},'Pisarz wpisał imię do księgi załogi.')) setName(''); }}>
        <label>Imię giermka <input required maxLength={28} value={name} onChange={e=>setName(e.target.value)} autoComplete="off"/></label>
        <button disabled={busy || !mine.available || !validRecruitName(name.trim()) || wallet.gold<units.guards.price || wallet.grain<1}>Przyjmij giermka</button>
        <small>Jedno miejsce w miejscowym poborze, {units.guards.price} złota i worek zboża. Rycerz może szkolić od {mentorMarks} pkt służby.</small>
      </form>}
      {school.guides.length>0 && <>
        <label>Droga do drugiego garnizonu <select value={road} onChange={e=>setChoice(e.target.value as Passage)}>
          <option value="bridge" disabled={school.closed}>{school.closed ? 'Most zamknięty' : roadNames.bridge}</option><option value="detour">{roadNames.detour}</option>
        </select></label>
        <p className="school-itinerary">{townNames[town]} <span aria-hidden="true"> → </span> {townNames[otherPost(town)]}</p>
        <p>{WEATHER_CONDITIONS[school.weather].name} · dostawa za {leg} s · powrót za {2 * leg} s.</p>
        <small>Wóz zabiera worek zboża dla kuchni oraz wybrane wyżej racje dla woźnicy. Po dostawie w kuchni przybędą dwie porcje.</small>
        <ul>{school.guides.map(guide => {
          const learned = guide.learned.find(l => l.road===road);
          const lesson = !learned;
          const mentorReady = guide.own && !mine.duty && !knightAway && mine.marks>=mentorMarks;
          return <li key={guide.id}>
            <h3>{guide.knighted ? 'Sir ' : ''}{guide.name}</h3><small>{guide.own ? 'Twoja chorągiew' : 'Chorągiew kupca '+guide.captain}</small>
            {guide.learned.length ? <p>{guide.learned.map(l=>roadNames[l.road]+' · mentor '+l.mentor).join(' / ')}</p> : <p>Czeka na pierwszą lekcję na trakcie.</p>}
            {guide.relayDue ? <p>Na sztafecie gildii · zaprzęg wolny o {time.format(guide.relayDue)}.</p> : guide.trip ? <div className="school-trip">
              <p role="status">{guide.trip.arrival > book.now ? 'Z ładunkiem do kuchni' : 'Powrót do koszar'} · {roadNames[guide.trip.road]}</p>
              <progress aria-label="Przebieg kursu w obie strony" max={1} value={Math.max(0,1-(guide.trip.returns-book.now)/(2*(guide.trip.returns-guide.trip.arrival)))}/>
              <small>Powrót o {time.format(guide.trip.returns)}.</small>
            </div> : <>
              {(!lesson || guide.own) && <button disabled={busy || !!mine.wagon || !canProvision || (lesson && !mentorReady)}
                onClick={()=>sign({action:'guideWagon',guide:guide.id,road,lesson,ration},
                  lesson ? 'Rycerz i giermek wyruszyli z dostawą.' : 'Przewodnik poprowadził wóz z zaopatrzeniem.')}>
                {lesson ? 'Wyjedź z uczniem' : 'Powierz wóz przewodnikowi'}
              </button>}
              {lesson && !guide.own && <small>Tę drogę musi najpierw pokazać jego rycerz.</small>}
              {lesson && guide.own && !mentorReady && <small>Naukę prowadzi wolny rycerz od {mentorMarks} pkt służby.</small>}
              {(!lesson || guide.own) && !canProvision && <small>Sprawdź zapas zboża i wybrane racje.</small>}
            </>}
          </li>;
        })}</ul>
      </>}
    </>}
  </section>;
}

export function InnRoadLedger({records}: {records:RoadRecord[]}) {
  if (!records.length) return null;
  return <section className="post-register"><h3>Księga przewodników</h3>
    {records.map(r=><details key={r.id}>
      <summary>{r.name} · {r.lesson ? 'z mentorem' : 'samodzielny przewóz'} · {stamp.format(r.arrival)}</summary>
      <p>Wóz przybył z garnizonu {townNames[r.origin]}. Droga w księdze: {roadNames[r.road]}. {r.lesson ? 'Lekcję prowadzi' : 'Tej drogi uczył'} {r.mentor}. Kuchnia otrzymała worek zboża.</p>
    </details>)}
  </section>;
}
