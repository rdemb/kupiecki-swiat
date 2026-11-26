import { garrisonHref, otherPost, rationPlan, townNames, type GarrisonBook, type Ration } from '../economy/garrison';
import { relayLegSeconds, relayWindowSeconds, rideToStationSeconds, type RelayCommand, type RelayLoad } from '../economy/guildRelay';
import type { FeastTown } from '../economy/harvestLoaf';
import type { MillBook } from '../economy/mill';
import { PortLink } from './PortLink';
import { roadNames, schoolLegSeconds } from '../economy/standardSchool';
import { cinemaFile } from './MerchantRoad';

const secondsLeft = (at: number, now: number) => Math.max(0,Math.ceil((at-now)/1000));
function condition(load: RelayLoad, now: number) {
  switch (load.state) {
    case 'open':
      if (now<load.atPost) return 'Wóz dotrze na popas za '+secondsLeft(load.atPost,now)+' s';
      return 'Wóz na popasie · na zmianę zostało '+secondsLeft(load.expires,now)+' s';
    case 'carrying': return 'Wóz po przeprzęgu · dostawa za '+secondsLeft(load.due!,now)+' s';
    case 'delivered': return 'Kuchnia otrzymała dwie porcje';
    case 'returning': return 'Minął czas na zmianę · powrót worka za '+secondsLeft(load.due!,now)+' s';
    case 'returned': return 'Worek wrócił do magazynu nadawcy';
  }
}
function cargoPosition(load: RelayLoad, now: number) {
  if (load.state==='delivered') return 100;
  if (load.state==='returned') return 0;
  if (load.state==='returning') return 50*secondsLeft(load.due!,now)/Math.max(1,secondsLeft(load.due!,load.expires));
  if (load.state==='carrying') {
    const ratio = (now-load.handoff!)/Math.max(1,load.due!-load.handoff!);
    return 50+50*Math.max(0,Math.min(1,ratio));
  }
  return 50*Math.min(1,Math.max(0,(now-load.started)/Math.max(1,load.atPost-load.started)));
}
type Props = {
  town: FeastTown; book: GarrisonBook; ration: Ration; wallet: MillBook['wallet']; busy: boolean;
  visit: (tab: 'garrison' | 'guild', city: FeastTown) => void;
  sign: (cmd: RelayCommand, note: string) => Promise<boolean>; login: () => void;
};
export function GuildRelay({town,book,ration,wallet,busy,sign,login,visit}: Props) {
  const { now, mine } = book;
  const relay=book.relay!, school=book.school!;
  const own=school.guides.find(g=>g.own);
  const meal=rationPlan(ration,1,mine?.fatigue ?? 0);
  const canRide=!!wallet && !!own?.learned.length && !own.trip && !own.relayDue && !mine?.wagon &&
    wallet.grain>=meal.grain && book.kitchen.portions>=meal.portions;
  const next=otherPost(town);
  const road=school.closed ? 'detour' : 'bridge';
  const coordinated=relayLegSeconds(school.weather,'bridge')+relayLegSeconds(school.weather,road);
  const ride=rideToStationSeconds(school.weather)+meal.delay;
  return <section id="sztafeta" className="standard-school guild-relay">
    <header className="relay-cover">
      <img src={cinemaFile('popas-gildii.webp')} loading="lazy" width="1320" height="660" alt="Dwaj woźnice przeprzęgają konia przy wozie z zapieczętowanym workiem zboża. W oddali widać most."/>
      <h2>Gildijna sztafeta</h2>
    </header>
    <p>Jeden wóz, dwa zaprzęgi. Pierwsza chorągiew wiezie worek zboża na popas. Drugi kupiec z tej samej gildii wyprowadza świeże konie z przeciwnego garnizonu. Na popasie sprawdza rzekę i wybiera przeprawę do swojej kuchni.</p>
    <div className="relay-docket">
      <h3>Stacja przeprzęgowa</h3>
      <p>{townNames[town]} → Popas → {townNames[next]}.</p>
      {school.closed ? <p>Most zamknięty. Wóz może przejąć przewodnik znający górny bród.</p> :
        <p>Most otwarty. O drodze decyduje przewodnik drugiej chorągwi przy odbiorze.</p>}
      <small>Przy dzisiejszej pogodzie i wypoczętych załogach przejazd {school.closed ? 'brodem' : 'mostem'} zajmuje {schoolLegSeconds(road,school.weather,0)} s jednym zaprzęgiem lub {coordinated} s ze zmianą czekającą na popasie.</small>
      {!wallet ? <button onClick={login}>Zaloguj się, by prowadzić zaprzęg</button> : !relay.member ?
        <p>Dołącz do gildii w karczmie, żeby zobaczyć jej wozy. <PortLink href={'?miejsce=gildia&miasto='+town} go={()=>visit('guild',town)}>Stół gildii</PortLink></p> : <>
        <p>Do popasu {relayLegSeconds(school.weather,'bridge',meal.delay)} s. Drugi kupiec może wyjechać po wóz, gdy tylko zobaczy list. Na odbiór ma {relayWindowSeconds/60} min od przyjazdu wozu. Potem skład odsyła zboże nadawcy.</p>
        <button disabled={busy || !canRide || wallet.grain<1+meal.grain || relay.loads.some(l=>l.origin===town && l.state==='open')}
          onClick={()=>own && sign({action:'startRelay',guide:own.id,ration},'Zapieczętowany worek wyruszył na popas.')}>
          Wyślij worek na popas
        </button>
        <small>{own?.learned.length ? 'Każda załoga zabiera wybrane w kuchni racje.' : 'Ukończ z własnym giermkiem przynajmniej jedną lekcję w szkole pod chorągwią.'}</small>
        {relay.loads.map(load=>{
          const dest=otherPost(load.origin);
          return <article className="relay-load" key={load.id}>
            <h4>List przewozowy nr {load.id}</h4>
            <p>{load.firstName} {load.secondName ? 'i '+load.secondName : 'przy pierwszym zaprzęgu'}{load.road ? ' · '+roadNames[load.road] : ''}</p>
            <div className="relay-track" aria-hidden="true"><i style={{left:cargoPosition(load,now)+'%'}}/></div>
            <div className="relay-stops"><span>{townNames[load.origin]}</span><span>Popas</span><span>{townNames[dest]}</span></div>
            <p>{condition(load,now)}</p>
            {load.state==='open' && load.secondName && <small>{load.ready!>now?'Zmiana dojedzie za '+secondsLeft(load.ready!,now)+' s.':'Zmiana czeka przy koniach.'}</small>}
            {load.state==='open' && town===dest && !load.secondName && !load.mineFirst && <button
              disabled={busy || !canRide || now+ride*1000>=load.expires}
              onClick={()=>own && sign({action:'rideToRelay',load:load.id,guide:own.id,ration},'Świeży zaprzęg wyruszył po ten wóz.')}>
              Wyjedź po ten wóz · {ride} s
            </button>}
            {load.state==='open' && load.mineSecond && town===dest && <div>
              {(['bridge','detour'] as const).map(road=><button key={road} disabled={busy || now<Math.max(load.atPost,load.ready!) ||
                (road==='bridge' && school.closed) || !own?.learned.some(l=>l.road===road)}
                onClick={()=>sign({action:'takeRelay',load:load.id,road},'Druga chorągiew przejęła ten sam wóz.')}>
                {road==='bridge'?'Przejmij przez most':'Przejmij przez bród'}</button>)}
              <small>Potrzebna jest ukończona nauka wybranej przeprawy.</small>
            </div>}
            {load.state==='open' && town!==dest && <PortLink href={garrisonHref(dest)+'#sztafeta'} go={()=>visit('garrison',dest)}>Koszary drugiej zmiany · {townNames[dest]}</PortLink>}
          </article>;
        })}
      </>}
    </div>
  </section>;
}
