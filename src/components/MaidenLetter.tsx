import { useState } from 'react';
import { courseNames } from '../economy/pilotage';
import { raftRules } from '../economy/rafts';
import type { YardBook } from '../economy/shipyard';
import { cinemaFile } from './MerchantRoad';
import './maidenLetter.css';

type Ship = NonNullable<YardBook['ship']>;
const stamp = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const leaves = [
  { name: 'Pochylnia', image: 'stocznia.webp' },
  { name: 'Wyjście na redę', image: 'piloci.webp' },
  { name: 'Powrót', image: 'list-przewozowy.webp' },
] as const;

export function MaidenLetter({ ship, busy, sign }: { ship: Ship; busy: boolean; sign: (voyage: number) => void }) {
  const [leaf, setLeaf] = useState(2);
  const letter = ship.maiden;
  const title = 'List z pierwszego rejsu';
  if (!letter) {
    return <section id="list-z-redy" tabIndex={-1} className="maiden-await">
      <h3>{title}</h3>
      <p>{ship.job?.departed ? 'Szkuta jest na wodzie. Bosman wystawi list po powrocie z redy.' :
        'Po pierwszej dostawie soli bosman wpisze tu szypra i ładunek. Fundator oraz dostawcy będą mogli podpisać list.'}</p>
    </section>;
  }
  return <article className="maiden-letter" id="list-z-redy" tabIndex={-1} aria-label={title}>
    <header><h3>{title}</h3><p>„{letter.vessel}” · Królewska Przystań</p></header>
    <div className="maiden-leaves" role="group" aria-label="Karty pierwszego rejsu">
      {leaves.map((entry, i) => <button type="button" key={entry.name} aria-pressed={leaf === i}
        aria-controls="maiden-page" onClick={() => setLeaf(i)}>{entry.name}</button>)}
    </div>
    <figure id="maiden-page">
      <img key={leaf} src={cinemaFile(leaves[leaf].image)} alt="" loading="lazy" width="960" height="430"/>
      <figcaption aria-live="polite" aria-atomic="true">
        {leaf === 0 && <><time dateTime={new Date(ship.hull.begun).toISOString()}>{stamp.format(ship.hull.begun)}</time>
          <p>Na kwicie za stępkę widnieje podpis „{ship.hull.founder}” i znak gildii {ship.hull.guild}.</p>
          <ul>{ship.deliveries.map(d => <li key={d.id}><b>{d.name}</b> · {d.kind === 'oak' ? raftRules.beamsPerLoad + ' belek dębowych' : 'komplet okuć'}</li>)}</ul></>}
        {leaf === 1 && <><time dateTime={new Date(letter.departed).toISOString()}>{stamp.format(letter.departed)}</time>
          <p>Szkuta wypłynęła z solą na redę. U steru <b>{letter.skipper}</b>. List frachtowy nosi podpis „{letter.payer}”.</p>
          <p>Droga na redę · {courseNames[letter.course]}</p></>}
        {leaf === 2 && <><time dateTime={new Date(letter.settled).toISOString()}>{stamp.format(letter.settled)}</time>
          <p><b>{letter.skipper}</b> melduje powrót do przystani. Odbiorcy na redzie przyjęli sól z warzelni.</p>
          <dl><div><dt>Dostarczone beczki</dt><dd>{letter.barrels}</dd></div>
              <div><dt>Zaprzęgi dla portu</dt><dd>{letter.teams}</dd></div></dl></>}
      </figcaption>
    </figure>
    <footer><h4>Poświadczenia budowniczych</h4>
      {letter.signatures.length > 0 ? <ul>{letter.signatures.map((s, i) =>
        <li key={i}><b>{s.name}</b> · <time dateTime={new Date(s.at).toISOString()}>{stamp.format(s.at)}</time></li>)}</ul> :
        <p>List czeka na pierwszy podpis fundatora lub dostawcy materiałów.</p>}
      {letter.canSign && <button type="button" disabled={busy} onClick={() => sign(letter.voyage)}>Złóż podpis pod listem</button>}
    </footer>
  </article>;
}
