import { useState } from 'react';
import { townNames } from '../economy/garrison';
import { roadNames } from '../economy/standardSchool';
import type { SpurBook, SpurPetition, SpurReceipt } from '../economy/spurTrial';
import { cinemaFile } from './MerchantRoad';

export function ReceiptFacts({receipt:r}: {receipt:SpurReceipt}) {
  return <div className="spur-facts">
    <p>List nr {r.load} · {townNames[r.origin]} → {townNames[r.destination]} · {roadNames[r.road]}</p>
    <p>Mentor: <b>{r.mentor}</b> · Chorągiew kupca: <b>{r.captain}</b></p>
    <p>Dostarczono worek zboża. Kuchnia otrzymała dwie porcje.</p>
  </div>;
}
export function Testimony({petition:p}: {petition:SpurPetition}) {
  return <><ReceiptFacts receipt={p}/><blockquote>„{p.testimony}” <cite>— {p.witness}, nadawca zboża</cite></blockquote></>;
}
type Sign = (cmd:{action:'witnessSpur';load:number;testimony:string}, note:string)=>Promise<boolean>;
function WitnessForm({receipt,busy,sign}: {receipt:SpurReceipt;busy:boolean;sign:Sign}) {
  const [note,setNote]=useState('');
  return <form className="spur-document" onSubmit={async e=>{
    e.preventDefault();
    if (await sign({action:'witnessSpur',load:receipt.load,testimony:note.trim()},'Świadectwo trafiło na dwór.')) setNote('');
  }}>
    <h3>{receipt.name}</h3>
    <ReceiptFacts receipt={receipt}/>
    <label>Twoje świadectwo<textarea required maxLength={180} rows={2} value={note}
      onChange={e=>setNote(e.target.value)} placeholder="Co zawdzięczasz temu przewodnikowi?"/></label>
    <small>Po pasowaniu karczmarz wpisze twoje słowa i imię do publicznej kroniki.</small>
    <button disabled={busy || !note.trim()}>Poświadcz dostawę na dworze</button>
  </form>;
}
export function SpurTrial({book,signedIn,login,sign,busy}: {book:SpurBook;signedIn:boolean;login:()=>void;sign:Sign;busy:boolean}) {
  return <section id="ostroga" className="standard-school spur-trial">
    <header className="spur-heading">
      <img src={cinemaFile('proba-ostrogi.webp')} loading="lazy" width="1400" height="596" alt="Srebrna ostroga i kupiecka pieczęć na stole pisarza."/>
      <div><h2>Próba ostrogi</h2><p>Za drugim zaprzęgiem stoi czyjeś imię. Kiedy giermek dowiezie twoje zboże, możesz zaświadczyć za nim przed Imperatorem. Jego służbę zna mistrz. Teraz dwór chce usłyszeć kupca.</p></div>
    </header>
    {book.receipts.map(r=><WitnessForm key={r.load} receipt={r} sign={sign} busy={busy}/>)}
    {!signedIn ? <button onClick={login}>Zaloguj się do księgi świadectw</button> :
      !book.receipts.length && <p>Gdy druga załoga ukończy twoją sztafetę, list do poświadczenia znajdziesz w koszarach miasta, z którego wysłano zboże.</p>}
    {book.petitions.map(p=><details className="spur-document" key={p.load}>
      <summary>{p.state==='knighted'?'Sir ':''}{p.name} · {p.state==='knighted'?'pasowanie':p.state==='declined'?'dwór odmówił pasowania':'oczekuje na pieczęć'}</summary>
      <Testimony petition={p}/>{p.sealedBy && <p>Pieczęć dworu · {p.sealedBy}</p>}
    </details>)}
  </section>;
}
export function InnSpurRoll({entries}: {entries:SpurPetition[]}) {
  if (!entries.length) return null;
  return <section className="post-register"><h3>Księga pasowań</h3>
    {entries.map(p=><details key={p.load}><summary>Sir {p.name} · list nr {p.load}</summary>
      <Testimony petition={p}/><p>Pieczęć Imperatora · {p.sealedBy}</p>
    </details>)}
  </section>;
}
