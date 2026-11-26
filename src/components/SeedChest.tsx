import { useEffect, useRef } from 'react';
import { fieldRules, type FieldBook, type FieldCommand, type SeedChestBook } from '../economy/commonField';
import { SeedRouteLedger } from './SeedRouteLedger';
import { cinemaFile } from './MerchantRoad';

interface Props {
  field: FieldBook;
  chest: SeedChestBook;
  grain: number | null;
  busy: boolean;
  onAccount: () => void;
  sign: (command: FieldCommand, receipt: string) => Promise<boolean>;
}

export function SeedChest({field, chest, grain, busy, sign, onAccount}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (window.location.hash === '#skrzynia') heading.current?.focus();
  }, []);
  const accepting = field.sown === null;
  const room = field.total < fieldRules.capacity && (field.mine?.seed ?? 0) < fieldRules.perMerchant;
  const canTake = accepting && room && !chest.reserved;
  return <section className="seed-chest" aria-labelledby="skrzynia">
    <div className="seed-cover">
      <img loading="lazy" width="900" height="600" alt="" src={cinemaFile('skrzynia-siewna.webp')} />
      <h2 id="skrzynia" tabIndex={-1} ref={heading}>Ziarno po sąsiedzku</h2>
    </div>
    <div className="seed-pages">
      <section>
        <h3>Skrzynia siewna</h3>
        <p>Po udanych żniwach możesz zostawić jeden worek dla innego gospodarza. W następnym zasiewie to on odbierze swój udział w plonie.</p>
        {chest.lots.length > 0 ? <ul className="seed-lots">{chest.lots.map(lot => <li key={lot.id}>
          <strong>{lot.donor}</strong> · 1 worek
          <small>{lot.generation > 1 ? 'Pierwszy dar · ' + lot.founder + ' · przekazanie ' + lot.generation : 'Pierwsze przekazanie'}</small>
          {lot.receiver !== null ? <span>Na zagonie · {lot.receiver}</span>
            : lot.mine ? <button disabled={busy} onClick={()=>void sign({action:'recallHarvestSeed',round:field.round,lot:lot.id},'Worek wrócił do twojego magazynu.')}>Odbierz swój worek</button>
            : grain !== null && canTake ? <button disabled={busy} onClick={()=>void sign({action:'acceptHarvestSeed',round:field.round,lot:lot.id},'Worek sąsiada trafił na twój zagon. Masz głos w sprawie siewu.')}>Weź na zasiew</button>
            : <span>{!accepting ? 'Czeka na otwarcie pola' : 'Czeka w skrzyni'}</span>}
        </li>)}</ul> : <p className="seed-empty">{field.sown !== null && field.harvested === null ? 'Pole obsiane. Skrzynia otworzy się po żniwach.' : 'Skrzynia czeka na pierwszy dar z ostatnich żniw.'}</p>}
        {chest.canOffer && grain !== null && <button className="inn-primary" disabled={busy || grain < 1} onClick={()=>void sign({action:'offerHarvestSeed',round:field.round},'Odłożono twój worek dla następnego gospodarza.')}>Zostaw 1 worek dla sąsiada</button>}
        {chest.canOffer && grain === 0 && <p>Do przekazania daru potrzebujesz jednego worka zboża w magazynie.</p>}
        {grain === null && chest.lots.some(lot=>!lot.receiver) && accepting && <button onClick={onAccount}>Zaloguj się, żeby wybrać worek</button>}
        {chest.reserved && <p>Masz na zagonie worek sąsiada. Jeśli wycofasz ziarno przed siewem, dar wróci do skrzyni.</p>}
        {chest.lots.some(lot=>lot.mine && lot.receiver === null) && <p>Jeśli nikt nie podejmie twojego worka do siewu, wróci do magazynu.</p>}
      </section>
      <section><h3>Księga siewów</h3>
        {chest.history.length === 0 ? <p>Gdy zasiejecie pierwszy podarowany worek, tu pojawią się imiona obojga gospodarzy.</p> :
        <ol className="seed-chain">{chest.history.map(entry=><li key={entry.id}>
          <small>Dzień {entry.day} · przekazanie {entry.generation}</small>
          <p><b>{entry.donor}</b> <span aria-label="przekazuje ziarno">→</span> <b>{entry.receiver}</b></p>
          {entry.generation > 1 && <><small>Pierwszy dar · {entry.founder}</small><SeedRouteLedger id={entry.id}/></>}
        </li>)}</ol>}
      </section>
    </div>
  </section>;
}
