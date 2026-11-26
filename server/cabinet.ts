import {createHash, randomInt} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {Express, Request} from 'express';
import {engravers, firstInn, southernInns, type CabinetBook, type CabinetStop, type Exhibit} from '../src/economy/southernTrail';
import type {NestSpecies} from '../src/economy/northPassage';

type Visitor = {uid:string;guildId:string};
type ShowRow = {id:number;guildName:string;species:NestSpecies;edition:number;closed:number};
type StopRow = {site:string;step:number;printed:number;arrives:number;guide:number;voteAt:number|null};
class CabinetRule extends Error {}
function check(value:unknown, text:string):asserts value {
  if (!value) throw new CabinetRule(text);
}
const validSite = (site:unknown):site is string => southernInns.some(inn=>inn.id===site);
const localGuide = (uid:string, site:string) =>
  createHash('sha256').update(uid+'|'+site).digest().readUInt32BE(0)%engravers.length;

export function installCabinet(app:Express, db:DatabaseSync, auth:(req:Request)=>Visitor|null) {
  db.exec(`CREATE TABLE IF NOT EXISTS cabinetShows(id INTEGER PRIMARY KEY, guild TEXT NOT NULL, guildName TEXT NOT NULL,
    lender TEXT NOT NULL, edition INTEGER NOT NULL, species TEXT NOT NULL, closed INTEGER NOT NULL DEFAULT 0, UNIQUE(lender,edition));
    CREATE UNIQUE INDEX IF NOT EXISTS touringGuild ON cabinetShows(guild) WHERE closed=0;
    CREATE TABLE IF NOT EXISTS cabinetStops(show INTEGER NOT NULL REFERENCES cabinetShows(id), step INTEGER NOT NULL, site TEXT NOT NULL,
    arrives INTEGER NOT NULL, guide INTEGER NOT NULL, printed INTEGER NOT NULL DEFAULT 0, voteAt INTEGER, PRIMARY KEY(show,step), UNIQUE(show,site));
    CREATE TABLE IF NOT EXISTS cabinetVotes(show INTEGER NOT NULL, step INTEGER NOT NULL, voter TEXT NOT NULL, dest TEXT NOT NULL,
    PRIMARY KEY(show,step,voter), FOREIGN KEY(show,step) REFERENCES cabinetStops(show,step));
    CREATE TABLE IF NOT EXISTS cabinetPrints(owner TEXT NOT NULL, site TEXT NOT NULL, PRIMARY KEY(owner,site));`);
  const oneGuild=db.prepare('SELECT name FROM innGuilds WHERE id=? AND archived=0');
  const stamp=db.prepare('SELECT 1 FROM cabinetPrints WHERE owner=? AND site=?');
  const stops=db.prepare('SELECT * FROM cabinetStops WHERE show=? ORDER BY step');
  const tally=db.prepare('SELECT dest,COUNT(*) n FROM cabinetVotes WHERE show=? AND step=? GROUP BY dest ORDER BY n DESC,dest');
  const insertStop=db.prepare('INSERT INTO cabinetStops(show,step,site,arrives,guide) VALUES(?,?,?,?,?)');
  function book(me:Visitor|null,site:string):CabinetBook {
    const active=db.prepare('SELECT * FROM cabinetShows WHERE closed=0 ORDER BY id DESC').all();
    const past=db.prepare('SELECT * FROM cabinetShows WHERE closed=1 ORDER BY id DESC LIMIT 8').all();
    const shows=[...active,...past].map(raw=>{
      const s=raw as ShowRow;
      const route=(stops.all(s.id) as StopRow[]).map(stop=>{
        const counts=tally.all(s.id,stop.step);
        const mine=me && db.prepare('SELECT dest FROM cabinetVotes WHERE show=? AND step=? AND voter=?').get(s.id,stop.step,me.uid);
        return {site:stop.site,guide:stop.guide,engraved:!!stop.printed,opens:stop.arrives,
          votes:Object.fromEntries(counts.map(v=>[String(v.dest),Number(v.n)])),myVote:mine?String(mine.dest):null,
          ballotEnds:stop.voteAt ? stop.voteAt+90000 : null} satisfies CabinetStop;
      });
      return {id:s.id,guild:s.guildName,species:s.species,edition:s.edition,done:!!s.closed,route} satisfies Exhibit;
    });
    const loans=me?db.prepare(`SELECT n.edition,g.species FROM nestNotes n JOIN nestingGrounds g USING(edition)
      WHERE n.owner=? AND n.stage='observed' AND NOT EXISTS(SELECT 1 FROM cabinetShows s WHERE s.lender=n.owner AND s.edition=n.edition)
      ORDER BY n.edition DESC LIMIT 24`).all(me.uid) as unknown as CabinetBook['loans']:[];
    const guild=me && oneGuild.get(me.guildId);
    const stamps=me?db.prepare('SELECT site FROM cabinetPrints WHERE owner=? ORDER BY rowid').all(me.uid).map(row=>String(row.site)):[];
    return {shows,loans,stamps,sheets:stamps.length,guild:guild?String(guild.name):null,sampler:{guide:localGuide(me?.uid??'guest',site),stamped:!!(me && stamp.get(me.uid,site))}};
  }
  app.get('/api/cabinet/:site',(req,res)=>{
    res.set('Cache-Control','private, no-store');
    const site=req.params.site;
    if(!validSite(site)){res.status(404).json({error:'Tu nie ma gospody na południowym trakcie.'});return;}
    res.json(book(auth(req),site));
  });
  app.post('/api/cabinet/:site',(req,res,next)=>{
    res.set('Cache-Control','private, no-store');
    const me=auth(req),site=req.params.site;
    if(!me){res.status(401).json({error:'Zaloguj się, by dopisać się do księgi.'});return;}
    const {action,edition,choice,show,step,dest}=req.body??{},now=Date.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      check(validSite(site),'Wybierz karczmę na południowym trakcie.');
      if(action==='practice'){
        check(choice===engravers[localGuide(me.uid,site)].answer,'Mistrz pokazuje matrycę jeszcze raz. Spróbuj inaczej.');
        db.prepare('INSERT OR IGNORE INTO cabinetPrints VALUES(?,?)').run(me.uid,site);
      } else if(action==='lend'){
        check(site===firstInn,'Objazd zaczyna się w Domu Matryc.');
        const guild=oneGuild.get(me.guildId);
        check(guild,'Do rozpoczęcia objazdu potrzebna jest gildia.');
        check(Number.isSafeInteger(edition),'Wybierz odcisk z własnego atlasu.');
        const specimen=db.prepare("SELECT g.species FROM nestNotes n JOIN nestingGrounds g USING(edition) WHERE n.owner=? AND n.edition=? AND n.stage='observed'").get(me.uid,edition);
        check(specimen,'Potrzebujesz osobiście potwierdzonej obserwacji.');
        check(!db.prepare('SELECT 1 FROM cabinetShows WHERE lender=? AND edition=?').get(me.uid,edition),'Ten odcisk odbył już swój objazd.');
        check(!db.prepare('SELECT 1 FROM cabinetShows WHERE guild=? AND closed=0').get(me.guildId),'Gabinet twojej gildii jest już w drodze.');
        const created=db.prepare('INSERT INTO cabinetShows(guild,guildName,lender,edition,species) VALUES(?,?,?,?,?)').run(me.guildId,guild.name,me.uid,edition,specimen.species);
        insertStop.run(created.lastInsertRowid,1,site,now,randomInt(engravers.length));
      } else {
        check(Number.isSafeInteger(show) && Number.isSafeInteger(step),'Otwórz stronę wybranej wystawy.');
        const current=db.prepare('SELECT t.* FROM cabinetStops t JOIN cabinetShows s ON s.id=t.show WHERE s.closed=0 AND s.id=? ORDER BY step DESC LIMIT 1').get(show) as StopRow|undefined;
        check(current && current.step===step && current.site===site && current.arrives<=now,'Sprawdź aktualny postój i godzinę przyjazdu wozu.');
        if(action==='engrave'){
          check(!current.printed && choice===engravers[current.guide].answer,'Sprawdź wskazówkę rytownika i stan matrycy.');
          db.prepare('UPDATE cabinetStops SET printed=1 WHERE show=? AND step=?').run(show,step);
          db.prepare('INSERT OR IGNORE INTO cabinetPrints VALUES(?,?)').run(me.uid,site);
          if(step===3) db.prepare('UPDATE cabinetShows SET closed=1 WHERE id=?').run(show);
        } else if(action==='vote'){
          check(current.printed && validSite(dest) && !db.prepare('SELECT 1 FROM cabinetStops WHERE show=? AND site=?').get(show,dest),'Najpierw odbij okaz. Wybierz nieodwiedzoną gospodę.');
          db.prepare('INSERT INTO cabinetVotes VALUES(?,?,?,?) ON CONFLICT(show,step,voter) DO UPDATE SET dest=excluded.dest').run(show,step,me.uid,dest);
          db.prepare('UPDATE cabinetStops SET voteAt=COALESCE(voteAt,?) WHERE show=? AND step=?').run(now,show,step);
        } else if(action==='depart'){
          const counts=tally.all(show,step);
          check(current.printed && counts.length && current.voteAt,'Brakuje odbitki lub głosu gościa.');
          check(!counts[1] || counts[0].n!==counts[1].n,'Przy remisie potrzeba rozstrzygającego głosu.');
          check(Number(counts[0].n)>=2 || now-current.voteAt>=90000,'Drugi zgodny głos pozwala ruszyć od razu. Przy jednym wóz czeka 90 sekund.');
          const from=southernInns.find(i=>i.id===site)!,to=southernInns.find(i=>i.id===counts[0].dest)!;
          const seconds=Math.max(20,Math.ceil(Math.hypot(to.x-from.x,to.z-from.z)/20));
          insertStop.run(show,step+1,to.id,now+seconds*1000,randomInt(engravers.length));
        } else throw new CabinetRule('Wybierz działanie przy gabinecie.');
      }
      const response=book(me,site);
      db.exec('COMMIT');res.json(response);
    } catch(error) {
      db.exec('ROLLBACK');
      if(error instanceof CabinetRule) res.status(409).json({error:error.message});else next(error);
    }
  });
}
