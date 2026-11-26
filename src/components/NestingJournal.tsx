import { useEffect, useState } from 'react';
import { gameRequest } from '../utils/gameServer';
import { DRAGON_SPECIES } from '../economy/dragonBreeding';
import { nestSpecies, northernSites, scalePrice, witnesses, type NestBook } from '../economy/northPassage';
import { imageUrl } from '../utils/imageUrl';
import './nestingJournal.css';

const nameOf=(id:string)=>northernSites.find(s=>s.id===id)?.name??id;
export function NestingJournal({site,token,choose,onSighting,onPost}:{onPost:()=>void;site:string;token:string|null;choose:(id:string)=>void;onSighting:(s:NestBook['sighting'])=>void}) {
  const [book,setBook]=useState<NestBook>();
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    gameRequest('/api/nests',{signal:controller.signal,headers:token?{Authorization:'Bearer '+token}:{}})
      .then(async r=>{if (!r.ok) throw Error();const data=await r.json();if(!controller.signal.aborted)setBook(data);})
      .catch(()=>{if(!controller.signal.aborted)setMessage('Dziennik chwilowo niedostępny.');});
    return ()=>controller.abort();
  },[token,reload]);
  const sight=book?.sighting, invitation=book?.invitation;
  const species=sight?.species??invitation?.species;
  const watcher=book?.witness!=null ? witnesses[book.witness] : null;
  async function act(action:string,choice?:number) {
    if (!token || busy || !book) return;
    setBusy(true);setMessage('');
    try {
      const r=await gameRequest('/api/nests',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({edition:book.edition,site,action,choice})});
      const data=await r.json();
      if(r.ok) setBook(data); else {setMessage(data.error);setReload(n=>n+1);}
    } catch {setMessage('Wieść nie dotarła. Odczytaj dziennik ponownie.');}
    finally {setBusy(false);}
  }
  useEffect(()=>{
    const known=!book?.storm && (book?.invitation ?? (book?.stage==='identified'||book?.stage==='observed' ? book.sighting : null));
    onSighting(known && known.site===site ? {site:known.site,species:known.species} : null);
    return ()=>onSighting(null);
  },[book,site,onSighting]);
  useEffect(()=>{
    if(busy)return;
    const timer=window.setInterval(()=>{if(!document.hidden)setReload(n=>n+1);},30000);
    return ()=>window.clearInterval(timer);
  },[busy]);
  const atNets=site==='sieci_matyldy'||site==='lawica_krabow';
  const atLight=site==='latarnia_wylin'||site==='przyladek_dwoch_szyj';
  const buttons=(label:string,onClick:()=>void)=><button type="button" disabled={busy} onClick={onClick}>{label}</button>;
  return <section className="nest-journal" aria-label="Wędrowne lęgowiska">
    <header style={{backgroundImage:'linear-gradient(0deg,#111e20,transparent 90%),url('+
      (species?DRAGON_SPECIES[species].artworkUrl:imageUrl('morze-wylin.webp'))+')'}}>
      <h3>Wędrowne lęgowiska</h3></header>
    <div className="nest-pages">
      {book && <><p className="nest-caption">Sezon lęgowy {book.edition} · {book.storm?'sztorm nad zatoką':'otwarta droga na wyspy'}</p>
        {book.stage==='none' && <><p>„Krab nie zostawia takich łusek”. Matylda odwiązuje kosz i zagląda pod splot wikliny.</p>
          {!token?<p className="nest-caption">Zaloguj się w karcie konta, aby zebrać łuskę.</p>:atNets?
            buttons('Przeszukaj kosz Matyldy',()=>void act('collect')):buttons('Idź do sieci Matyldy',()=>choose('sieci_matyldy'))}</>}
        {book.stage==='scale' && <><p>Między prętami tkwi łuska. Lechosz trzyma w latarni szkatułkę z okazami porównawczymi.</p>
          {atLight?buttons('Porównaj łuskę u Lechosza',()=>void act('identify')):buttons('Idź do latarni',()=>choose('latarnia_wylin'))}</>}
        {sight && <p><strong>{nestSpecies[sight.species]}</strong><br/>{nameOf(sight.site)} · świadek {watcher?.name}</p>}
        {book.stage==='identified' && sight && <>
          {site===sight.site && watcher ? <><p>{watcher.clue}</p>{watcher.answers.map((label,i)=><button type="button" disabled={busy||book.storm} key={label} onClick={()=>void act('observe',i)}>{label}</button>)}
            {book.storm && <p>Łodzie czekają w osłoniętej przystani aż sztorm minie.</p>}</> :
            buttons('Wyrusz na prywatną obserwację',()=>choose(sight.site))}
          {atLight?buttons('Sprzedaj trop pisarzowi · '+scalePrice+' zł',()=>void act('sell')):buttons('Wróć do pisarza, by sprzedać trop',()=>choose('latarnia_wylin'))}
          {buttons('Zanieś wieść na pocztę gildii',onPost)}
        </>}
        {book.stage==='sold' && <p>Pisarz kupił wyłączność na ten trop za {scalePrice} zł.</p>}
        {book.stage==='observed' && <p>Rysunek i zeznanie świadka trafiły do twojego prywatnego atlasu.</p>}
        {book.stage==='sent' && <p>Zaproszenie znajduje się w księdze pocztowej. Gildia odczyta je po doręczeniu.</p>}
        {invitation && <aside><h4>Wyprawa twojej gildii</h4><p>{nameOf(invitation.site)} · {nestSpecies[invitation.species]}<br/>
          {invitation.count>=2?'Dwie niezależne obserwacje potwierdziły lęgowisko.':invitation.count+'/2 potwierdzenia od różnych kupców'}</p>
          {!invitation.signed && (site!==invitation.site?buttons('Płyń do miejsca zbiórki',()=>choose(invitation.site)):
            <button type="button" disabled={busy||book.storm} onClick={()=>void act('join')}>Potwierdź obserwację gildii</button>)}</aside>}
        {!!book.album.length && <details><summary>Mój atlas wylin ({book.album.length})</summary>{book.album.map(a=><figure key={a.edition}>
          <img alt={nestSpecies[a.species]} src={DRAGON_SPECIES[a.species].artworkUrl}/><figcaption>{nameOf(a.site)} · {nestSpecies[a.species]}<br/>
          Sezon {a.edition} · {witnesses[a.witness].name}</figcaption></figure>)}</details>}
        {!!book.history.length && <details><summary>Kronika minionych lęgowisk</summary>{book.history.map(h=><p key={h.edition+h.guildName}>
          Sezon {h.edition} · {h.guildName} · {nameOf(h.site)} · {nestSpecies[h.species]}</p>)}</details>}
      </>}
      <div role="status">{message}</div>
      {buttons('Odczytaj dziennik ponownie',()=>{setMessage('');setReload(n=>n+1);})}
    </div></section>;
}
