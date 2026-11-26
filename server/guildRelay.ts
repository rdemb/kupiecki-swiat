import type { DatabaseSync } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import { otherPost, type GarrisonBook } from '../src/economy/garrison';
import type { FeastTown } from '../src/economy/harvestLoaf';
import { relayLegSeconds, relayWindowSeconds, rideToStationSeconds, type RelayBook, type RelayLoad } from '../src/economy/guildRelay';
import type { RoadGuide } from '../src/economy/standardSchool';
import { FeastRule } from './harvestLoaf';

function requireRelay(test: unknown, message: string): asserts test {
  if (!test) throw new FeastRule(message);
}
type Transfer = (uid: string, gold: number, grain: number) => void;
type Wagon = NonNullable<GarrisonBook['mine']>['wagon'];
export function openGuildRelay(db: DatabaseSync, transfer: Transfer) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS relayLoads(
      id INTEGER PRIMARY KEY, guild TEXT NOT NULL, origin TEXT NOT NULL, destination TEXT NOT NULL,
      firstDriver TEXT NOT NULL, firstGuide INTEGER NOT NULL REFERENCES roadSquires(id),
      secondDriver TEXT, secondGuide INTEGER REFERENCES roadSquires(id),
      started INTEGER NOT NULL, atPost INTEGER NOT NULL, firstHome INTEGER NOT NULL, expires INTEGER NOT NULL,
      ready INTEGER, secondHome INTEGER, secondDelay INTEGER, handoff INTEGER, due INTEGER, road TEXT,
      state TEXT NOT NULL DEFAULT 'open'
    );
    CREATE UNIQUE INDEX IF NOT EXISTS relayDispatch ON relayLoads(guild,origin) WHERE state='open';
    CREATE INDEX IF NOT EXISTS relayDeadlines ON relayLoads(state,expires,due);
    CREATE INDEX IF NOT EXISTS relayFirstGuide ON relayLoads(firstGuide,firstHome);
    CREATE INDEX IF NOT EXISTS relaySecondGuide ON relayLoads(secondGuide,secondHome);
    CREATE INDEX IF NOT EXISTS relayFirstDriver ON relayLoads(firstDriver,firstHome);
    CREATE INDEX IF NOT EXISTS relaySecondDriver ON relayLoads(secondDriver,secondHome);
  `);
  const profile = db.prepare("SELECT json_extract(profile,'$.guildId') guild FROM players WHERE json_extract(profile,'$.uid')=?");
  function guildOf(uid: string) { return String(profile.get(uid)?.guild || ''); }
  const home = db.prepare(`SELECT firstHome at FROM relayLoads WHERE firstGuide=? AND firstHome>?
    UNION ALL SELECT secondHome at FROM relayLoads WHERE secondGuide=? AND secondHome>? LIMIT 1`);
  function guideDue(id: number, now: number) {
    return Number(home.get(id,now,id,now)?.at) || null;
  }
  const busyTeam = db.prepare(`SELECT origin destination,firstHome arrival,1 AS "returning" FROM relayLoads WHERE firstDriver=? AND firstHome>?
    UNION ALL SELECT destination,secondHome,1 FROM relayLoads WHERE secondDriver=? AND secondHome>? LIMIT 1`);
  function wagon(uid: string, now: number): Wagon {
    const team = busyTeam.get(uid,now,uid,now) as unknown as Wagon;
    return team ? {...team,relay:true} : null;
  }
  const ledger = db.prepare(`SELECT r.id,r.origin,r.state,a.name firstName,b.name secondName,
    firstDriver=? mineFirst,secondDriver=? mineSecond,started,atPost,expires,ready,handoff,due,secondGuide,road
    FROM relayLoads r JOIN roadSquires a ON a.id=r.firstGuide LEFT JOIN roadSquires b ON b.id=r.secondGuide
    WHERE guild=? AND r.id IN (SELECT id FROM relayLoads WHERE guild=? AND state IN ('open','carrying','returning')
      UNION ALL SELECT id FROM (SELECT id FROM relayLoads WHERE guild=? AND state IN ('delivered','returned') ORDER BY id DESC LIMIT 3))
    ORDER BY CASE WHEN state IN ('delivered','returned') THEN 1 ELSE 0 END,r.id DESC`);
  function book(uid: string | null): RelayBook {
    const guild = uid ? guildOf(uid) : '';
    if (!guild) return {member:false,loads:[]};
    return {member:true, loads:ledger.all(uid,uid,guild,guild,guild).map(row =>
      ({...row,mineFirst:!!row.mineFirst,mineSecond:!!row.mineSecond})) as unknown as RelayLoad[]};
  }
  const expired = db.prepare(`UPDATE relayLoads SET state='returning',due=expires+(atPost-started)
    WHERE state='open' AND expires<=?`);
  const due = db.prepare(`SELECT r.id,r.destination,r.firstDriver,r.state,s.name FROM relayLoads r
    LEFT JOIN roadSquires s ON s.id=r.secondGuide WHERE r.state IN ('carrying','returning') AND r.due<=? ORDER BY r.due,r.id`);
  const credit = db.prepare(`INSERT INTO garrisonKitchens(town,portions,carrier,sacks) VALUES(?,2,?,1)
    ON CONFLICT(town) DO UPDATE SET portions=portions+2,carrier=excluded.carrier,sacks=1`);
  function advance(now: number) {
    expired.run(now);
    for (const row of due.all(now)) {
      const returned = row.state === 'returning';
      if (returned) transfer(String(row.firstDriver),0,1);
      else credit.run(row.destination,row.name);
      db.prepare('UPDATE relayLoads SET state=? WHERE id=?').run(returned?'returned':'delivered',row.id);
    }
  }
  const parcel = db.prepare('SELECT * FROM relayLoads WHERE id=? AND guild=? AND destination=? AND state=\'open\'');
  function command(town: FeastTown, uid: string, cmd: Record<string,unknown>, now: number,
                   weather: WeatherConditionId, closed: boolean, guides: RoadGuide[], occupied: boolean,
                   provision: (crew: number) => number) {
    const guild = guildOf(uid);
    requireRelay(guild, 'Do sztafety potrzebujesz gildii.');
    if (cmd.action === 'takeRelay') {
      requireRelay(typeof cmd.load === 'number','Wybierz list przewozowy.');
      const row = parcel.get(cmd.load,guild,town);
      requireRelay(row && row.secondDriver===uid && now>=Number(row.atPost) && now>=Number(row.ready),
        'Na popasie muszą stanąć wóz i twój zaprzęg.');
      const road = cmd.road;
      requireRelay(road==='bridge' || road==='detour','Wybierz przeprawę.');
      requireRelay(road!=='bridge' || !closed,'Rzeka zamknęła most. Sprawdź górny bród.');
      requireRelay(guides.find(g=>g.id===row.secondGuide)?.learned.some(l=>l.road===road),
        'Twój przewodnik musi znać wybraną przeprawę.');
      const arrival = now + 1000 * relayLegSeconds(weather,road,Number(row.secondDelay));
      db.prepare("UPDATE relayLoads SET state='carrying',road=?,handoff=?,due=?,secondHome=? WHERE id=?").run(road,now,arrival,arrival,row.id);
      return;
    }
    const guide = guides.find(g=>g.id===cmd.guide && g.own);
    requireRelay(!occupied && guide && !guide.trip && !guide.relayDue && guide.learned.length,
      'Potrzebujesz wolnego wozu i własnego przewodnika po ukończonej nauce.');
    if (cmd.action === 'startRelay') {
      requireRelay(!db.prepare("SELECT id FROM relayLoads WHERE guild=? AND origin=? AND state='open'").get(guild,town),
        'Wasz poprzedni wóz nadal czeka na zmianę.');
      const seconds = relayLegSeconds(weather,'bridge',provision(1));
      transfer(uid,0,-1);
      const atPost = now + seconds*1000;
      db.prepare(`INSERT INTO relayLoads(guild,origin,destination,firstDriver,firstGuide,started,atPost,firstHome,expires)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(guild,town,otherPost(town),uid,guide.id,now,atPost,atPost+seconds*1000,atPost+relayWindowSeconds*1000);
      return;
    }
    requireRelay(cmd.action==='rideToRelay' && typeof cmd.load==='number','Wybierz list przewozowy.');
    const row = parcel.get(cmd.load,guild,town);
    requireRelay(row && row.firstDriver!==uid && row.secondDriver===null,
      'Ten wóz musi przejąć druga chorągiew z tej samej gildii.');
    const delay = provision(1);
    const ride = (rideToStationSeconds(weather)+delay)*1000;
    requireRelay(now+ride<Number(row.expires),'Zaprzęg nie zdąży przed zamknięciem popasu.');
    db.prepare(`UPDATE relayLoads SET secondDriver=?,secondGuide=?,ready=?,secondHome=?,secondDelay=? WHERE id=?`)
      .run(uid,guide.id,now+ride,Number(row.expires)+ride,delay,row.id);
  }
  return { book, command, advance, guideDue, wagon };
}
