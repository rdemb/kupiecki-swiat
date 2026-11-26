import { useState } from 'react';
import { WEATHER_CONDITIONS } from '../economy/economyEngine';
import { fieldLabels, fieldRules as rules, type FieldBook, type FieldCommand } from '../economy/commonField';
import type { MillBook } from '../economy/mill';
import { cinemaFile } from './MerchantRoad';
import { PortLink } from './PortLink';
import { SeedChest } from './SeedChest';
import { sacks } from '../utils/sacks';
import './commonField.css';

interface Props {
  field: FieldBook;
  bakery: ()=>void;
  wallet: MillBook['wallet'];
  busy: boolean;
  onAccount: () => void;
  sign: (c: FieldCommand, receipt: string) => Promise<boolean>;
}
export function CommonField({field:f, wallet, busy, onAccount, sign, bakery}: Props) {
  const [amount,setAmount] = useState('1');
  const open = f.sown === null;
  const seed = f.mine?.seed ?? 0;
  const max = Math.min(rules.perMerchant - seed, rules.capacity - f.total, wallet?.grain ?? 0);
  const votesNeeded = Math.floor(f.growers / 2) + 1;
  const beforeSowing = open && f.total === 0 ? 'Miedza czeka na pierwszy worek.' : 'Kupcy wybierają dzień siewu.';
  return <>
    <header className="field-hero">
      <img key={f.stage} src={cinemaFile('pole-' + f.stage + '.webp')} alt={fieldLabels[f.stage] + ' nad rzeką w Srebrnym Gaju'} />
      <div><span>Srebrny Gaj · dzień {f.day}</span><h1>Wspólne pole</h1><p>{fieldLabels[f.stage]} · {WEATHER_CONDITIONS[f.weather].name}</p></div>
    </header>
    <div className="inn-room field-room">
      <section>
        <h2>{open ? 'Ziarno na zasiew' : f.harvested !== null ? 'Po żniwach' : 'Od siewu do żniw'}</h2>
        <p>{open ? beforeSowing : f.harvested !== null
          ? 'Ziemia odpoczywa. Kolejny zasiew można przygotować od dnia ' + (f.harvested + rules.restDays) + '.'
          : 'Siew odbył się w dniu ' + f.sown + '. Po czterech odczytach pogody plon trafi do magazynów uczestników.'}</p>
        <dl className="field-stats">
          <div><dt>Wspólne ziarno</dt><dd>{f.total} <small>/ {rules.capacity}</small></dd></div>
          <div><dt>Gospodarze</dt><dd>{f.growers}</dd></div>
          <div><dt>{open ? 'Głosy za siewem' : 'Odczyty pogody'}</dt><dd>{open ? f.votes : f.journal.length} <small>/ {open ? votesNeeded : rules.growthDays}</small></dd></div>
        </dl>
        {f.journal.length > 0 && <><h3>Pogoda na polu</h3><ol className="field-log">{f.journal.map(entry=>
          <li key={entry.day}><span>Dzień {entry.day}</span><b>{WEATHER_CONDITIONS[entry.weather].name}</b><span>{entry.points}/3 do plonu</span></li>)}</ol></>}
        {f.lastHarvest && <section className="field-last"><h3>Ostatnie żniwa · dzień {f.lastHarvest.day}</h3>
          <p>Wysiano {sacks(f.lastHarvest.seed)}. Zebrano {sacks(f.lastHarvest.yield)}.
          {f.lastHarvest.myShare !== null && <strong> Twój udział w zbiorze wyniósł {f.lastHarvest.myShare}.</strong>}</p></section>}
        <details><summary>Jak pogoda i udziały zmieniają zbiór?</summary>
          <p>Deszcz sprzyja wschodom, ale obciąża dojrzałe kłosy. Słońce najbardziej pomaga pod koniec. Mróz wstrzymuje przyrost. Za każdy dzień przypada od zera do trzech ćwierci worka na worek zasiewu.</p>
          <p>Całe worki dzielimy według ilości ziarna. Ostatnie worki przypadają największym ułamkowym udziałom, a przy remisie decyduje kolejność wniesienia ziarna.</p>
        </details>
      </section>
      <aside><h2>Twoja część pola</h2>
        {f.chest && <a className="field-chest-link" href="#skrzynia">Zajrzyj do skrzyni siewnej ↓</a>}
        {wallet ? <>
          <p>Twój magazyn · <b>{sacks(wallet.grain)}</b> zboża<br/>Twój wkład w zasiew · <b>{seed}</b></p>
          {open && <>
            {max > 0 && <form onSubmit={ev => {ev.preventDefault(); void sign({action:'bringSeed',round:f.round,quantity:Number(amount)},'Ziarno przeniesiono z magazynu na wspólny zasiew.');}}>
              <label>Worki na zasiew<input type="number" min={1} max={max} value={amount} required onChange={e=>setAmount(e.target.value)}/></label>
              <button className="inn-primary" disabled={busy || !Number.isInteger(+amount) || +amount<1 || +amount>max}>Wnieś ziarno</button></form>}
            {max === 0 && seed === 0 && <p>{f.total >= rules.capacity ? 'Wszystkie zagony są zajęte.' : f.chest?.lots.some(lot => !lot.mine && lot.receiver === null) ? 'W skrzyni siewnej czeka dar sąsiada.' : 'Zboże na zasiew możesz kupić na targu.'}</p>}
            {seed > 0 && <div className="field-decisions">
              <button className="inn-primary" disabled={busy} onClick={()=>void sign({action:f.mine?.voted?'holdSow':'voteSow',round:f.round},'Zapisano decyzję o siewie.')}>{f.mine?.voted?'Cofnij głos':'Głosuję za siewem'}</button>
              <button disabled={busy} onClick={()=>void sign({action:'takeSeed',round:f.round},f.chest?.reserved ? 'Twój zagon został zwolniony. Dar wrócił do skrzyni, a własne ziarno do magazynu.' : 'Ziarno wróciło do twojego magazynu.')}>Wycofaj ziarno ({seed})</button></div>}
          </>}
        </> : <button className="inn-primary" onClick={onAccount}>Zaloguj się, żeby siać</button>}
        {open && <p className="field-hint">Każdy kupiec wnosi do czterech worków i ma jeden głos. Gdy siew poprze ponad połowa uczestników, ziarno trafia w ziemię. Do tego czasu możesz je wycofać.</p>}
      </aside>
    </div>
    <p className="feast-field-link"><PortLink href="?miejsce=dozynki" go={bakery}>Zanieś ziarno do piekarni dożynkowej →</PortLink></p>
    {f.chest && <SeedChest field={f} chest={f.chest} busy={busy} sign={sign} grain={wallet?.grain ?? null} onAccount={onAccount}/>}
  </>;
}
