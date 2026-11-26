import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Express, Request } from 'express';
import { nestingSites, nestSpecies, scalePrice, witnesses, type NestBook, type NestSpecies } from '../src/economy/northPassage';
import type { installSeaMail } from './seaMail';

type Visitor = {uid:string;displayName:string;guildId:string};
type Ground = {edition:number;site:string;species:NestSpecies};
class NestRule extends Error {}
function requireNest(value:unknown, msg:string):asserts value { if (!value) throw new NestRule(msg); }

export function installNestingGrounds(app:Express,db:DatabaseSync,auth:(r:Request)=>Visitor|null,
  gold:(uid:string,amount:number)=>void,mail:ReturnType<typeof installSeaMail>) {
  db.exec(`CREATE TABLE IF NOT EXISTS nestingGrounds(edition INTEGER PRIMARY KEY,site TEXT NOT NULL,species TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS nestNotes(edition INTEGER NOT NULL,owner TEXT NOT NULL,witness INTEGER NOT NULL,
      stage TEXT NOT NULL,letter INTEGER UNIQUE REFERENCES seaMail(id) ON DELETE SET NULL,PRIMARY KEY(edition,owner));
    CREATE TABLE IF NOT EXISTS nestVisits(edition INTEGER NOT NULL,guild TEXT NOT NULL,owner TEXT NOT NULL,
      PRIMARY KEY(edition,guild,owner));
    CREATE TABLE IF NOT EXISTS nestChronicle(edition INTEGER NOT NULL,guild TEXT NOT NULL,guildName TEXT NOT NULL,
      PRIMARY KEY(edition,guild));`);
  const front=db.prepare('SELECT edition,storm FROM pilotBank WHERE id=1');
  const recent=db.prepare('SELECT * FROM nestingGrounds ORDER BY edition DESC LIMIT 1');
  function current() {
    const sky=front.get()!;
    let ground=recent.get() as Ground|undefined;
    if (!ground || ground.edition!==sky.edition) {
      const sites=nestingSites.filter(s=>s.id!==ground?.site);
      const species=(Object.keys(nestSpecies) as NestSpecies[]).filter(s=>s!==ground?.species);
      ground={edition:Number(sky.edition),site:sites[randomInt(sites.length)].id,species:species[randomInt(species.length)]};
      db.prepare('INSERT INTO nestingGrounds VALUES(?,?,?)').run(ground.edition,ground.site,ground.species);
    }
    return {ground,storm:Boolean(sky.storm)};
  }
  const note=db.prepare(`SELECT n.witness,n.stage,m.id AS letter FROM nestNotes n LEFT JOIN seaMail m ON m.id=n.letter
    WHERE n.edition=? AND n.owner=?`);
  const delivered=db.prepare(`SELECT 1 FROM nestNotes n JOIN seaMail m ON m.id=n.letter LEFT JOIN yardVoyages v ON v.id=m.voyage
    WHERE n.edition=? AND m.destination=? AND (v.settled IS NOT NULL OR m.roadDue<=?) LIMIT 1`);
  function book(me:Visitor|null,now:number):NestBook {
    const {ground,storm}=current(), {edition,site,species}=ground;
    const mine=me?note.get(edition,me.uid):null;
    const stage: NestBook['stage']=mine?.letter?'sent':(mine?.stage as NestBook['stage']??'none');
    const sighting=stage==='none'||stage==='scale'?null:{site,species};
    let invitation:NestBook['invitation']=null;
    if (me?.guildId && delivered.get(edition,me.guildId,now)) {
      const sign=db.prepare('SELECT COUNT(*) AS n, COUNT(CASE WHEN owner=? THEN 1 END) AS mine FROM nestVisits WHERE edition=? AND guild=?')
        .get(me.uid,edition,me.guildId)!;
      invitation={site,species,count:Number(sign.n),signed:!!sign.mine};
    }
    const history=db.prepare(`SELECT c.edition,n.site,n.species,c.guildName FROM nestChronicle c JOIN nestingGrounds n USING(edition)
      WHERE c.edition<? ORDER BY c.edition DESC,c.rowid LIMIT 6`).all(edition) as unknown as NestBook['history'];
    const album=me?db.prepare(`SELECT n.edition,n.site,n.species,m.witness FROM nestNotes m JOIN nestingGrounds n USING(edition)
      WHERE m.owner=? AND m.stage='observed' ORDER BY n.edition DESC LIMIT 24`).all(me.uid) as unknown as NestBook['album']:[];
    return {edition,storm,stage,sighting,album,witness:mine?Number(mine.witness):null,invitation,history};
  }
  function seal(uid:string,sender:string,guild:string,now:number) {
    const {ground}=current(), mine=note.get(ground.edition,uid);
    if (mine?.stage!=='identified' || mine.letter) return 'Najpierw rozpoznaj nieudostępnioną łuskę u Lechosza.';
    const place=nestingSites.find(s=>s.id===ground.site)!;
    const body='Lęgowisko nr '+ground.edition+' · '+place.name+'. '+nestSpecies[ground.species]+'. Zapraszam do wspólnej obserwacji przed następnym sztormem.';
    const problem=mail.seal(uid,sender,guild,body,now);
    if (!problem) db.prepare('UPDATE nestNotes SET letter=(SELECT MAX(id) FROM seaMail WHERE owner=?) WHERE edition=? AND owner=?')
      .run(uid,ground.edition,uid);
    return problem;
  }
  app.get('/api/nests',(req,res)=>res.set('Cache-Control','private, no-store').json(book(auth(req),Date.now())));
  app.post('/api/nests',(req,res,next)=>{
    res.set('Cache-Control','private, no-store');
    const me=auth(req);if (!me){res.status(401).json({error:'Zaloguj się, aby prowadzić własny dziennik.'});return;}
    const {edition,action,site,choice}=req.body??{},now=Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      const {ground,storm}=current();
      requireNest(edition===ground.edition,'Sztorm przeniósł lęgowisko. Odczytaj świeże ślady.');
      const mine=note.get(edition,me.uid);
      if (action==='collect') {
        requireNest(site==='sieci_matyldy'||site==='lawica_krabow','Matyldę znajdziesz przy sieciach.');
        if (!mine) db.prepare("INSERT INTO nestNotes(edition,owner,witness,stage) VALUES(?,?,?,'scale')").run(edition,me.uid,randomInt(witnesses.length));
      } else if (action==='identify') {
        requireNest((site==='latarnia_wylin'||site==='przyladek_dwoch_szyj')&&mine,'Zanieś znalezioną łuskę do Lechosza.');
        if (mine.stage==='scale') db.prepare("UPDATE nestNotes SET stage='identified' WHERE edition=? AND owner=?").run(edition,me.uid);
      } else if (action==='sell' || action==='observe') {
        requireNest(mine && !mine.letter,'Potrzebujesz własnego rozpoznanego tropu.');
        const state=action==='sell'?'sold':'observed';
        requireNest(mine.stage==='identified'||mine.stage===state,'Ten trop został już wykorzystany lub wymaga rozpoznania.');
        if (action==='sell') requireNest(site==='latarnia_wylin'||site==='przyladek_dwoch_szyj','Za zapiski płaci pisarz w latarni.');
        if (action==='observe') {
          requireNest(site===ground.site && !storm,'Odwiedź właściwe miejsce po ustaniu sztormu.');
          requireNest(choice===witnesses[Number(mine.witness)].answer,'Świadek prosi o dokładniejszą obserwację.');
        }
        if (mine.stage==='identified') {
          db.prepare('UPDATE nestNotes SET stage=? WHERE edition=? AND owner=?').run(state,edition,me.uid);
          if (action==='sell') gold(me.uid,scalePrice);
        }
      } else if(action==='join') {
        requireNest(!storm && site===ground.site && me.guildId && delivered.get(edition,me.guildId,now),'Potrzebujesz doręczonego zaproszenia, właściwej zatoki i spokojnej wody.');
        db.prepare('INSERT OR IGNORE INTO nestVisits VALUES(?,?,?)').run(edition,me.guildId,me.uid);
        db.prepare(`INSERT OR IGNORE INTO nestChronicle SELECT ?,id,name FROM innGuilds WHERE id=? AND
          (SELECT COUNT(*) FROM nestVisits WHERE edition=? AND guild=?)>=2`).run(edition,me.guildId,edition,me.guildId);
      } else throw new NestRule('Wybierz czynność w dzienniku.');
      const result=book(me,now);db.exec('COMMIT');res.json(result);
    } catch (err) {
      db.exec('ROLLBACK');if (err instanceof NestRule) res.status(409).json({error:err.message});else next(err);
    }
  });
  return {seal};
}
