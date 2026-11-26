import type { DatabaseSync } from 'node:sqlite';
import { hullEmblems, type HullHand, type HullRecord } from '../src/economy/hullMarks';

export function hullMarks(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS yardMakerMarks(
    ship INTEGER NOT NULL REFERENCES yardShips(id), owner TEXT NOT NULL, emblem TEXT NOT NULL,
    engraved INTEGER NOT NULL, mastery TEXT, PRIMARY KEY(ship,owner))`);

  db.exec(`CREATE TABLE IF NOT EXISTS yardFirstPlanks(
    ship INTEGER PRIMARY KEY REFERENCES yardShips(id), owner TEXT NOT NULL, name TEXT NOT NULL, fitted INTEGER NOT NULL)`);
  const ready = db.prepare(`SELECT 1 FROM yardShips s WHERE s.id=? AND s.launched IS NULL
    AND EXISTS(SELECT 1 FROM yardBuild b WHERE b.ship=s.id AND b.kind='oak')
    AND NOT EXISTS(SELECT 1 FROM yardFirstPlanks p WHERE p.ship=s.id)
    AND EXISTS(SELECT 1 FROM craftJobs j WHERE j.owner=? AND j.craft='szkutnik' AND j.finished>0)`);
  // The oldest material receipt supplies the name used at that time, even after a rename.
  const hands = db.prepare(`WITH worked(part,owner,name,lots,firstReceipt) AS (
    SELECT 'keel',owner,founder,1,0 FROM yardShips WHERE id=?
    UNION ALL
    SELECT kind,owner,name,COUNT(*),MIN(id) FROM yardBuild WHERE ship=? GROUP BY kind,owner
    UNION ALL SELECT 'plank',owner,name,1,0 FROM yardFirstPlanks WHERE ship=?
  ) SELECT w.part,w.name,w.lots,m.emblem,m.engraved,m.mastery,w.owner=? AS mine
    FROM worked w LEFT JOIN yardMakerMarks m ON m.ship=? AND m.owner=w.owner
    ORDER BY firstReceipt,w.part`);
  const routes = db.prepare(`SELECT COALESCE(l.course,'outer') AS course,COUNT(*) AS trips
    FROM yardVoyages v LEFT JOIN pilotLegs l ON l.voyage=v.id
    WHERE v.ship=? AND v.settled IS NOT NULL GROUP BY COALESCE(l.course,'outer') ORDER BY MIN(v.id)`);
  const mastery = db.prepare(`SELECT craft FROM craftJobs WHERE owner=? AND finished>0
    GROUP BY craft HAVING COUNT(*)>=8 ORDER BY COUNT(*) DESC,craft LIMIT 1`);
  const insert = db.prepare('INSERT INTO yardMakerMarks(ship,owner,emblem,engraved,mastery) VALUES(?,?,?,?,?)');

  function builders(ship: number, uid: string | null): HullHand[] {
    return hands.all(ship,ship,ship,uid,ship).map(row => ({...row,mine:Boolean(row.mine)})) as unknown as HullHand[];
  }
  return {
    record(ship:number,uid:string|null): HullRecord {
      return {hands:builders(ship,uid),canFitFirst:!!uid && !!ready.get(ship,uid),routes:routes.all(ship) as unknown as HullRecord['routes']};
    },
    fitFirst(ship:number,uid:string,name:string,now:number): string | null {
      if(!ready.get(ship,uid)) return 'Pierwszą klepkę osadza szkutnik po zleceniu w warsztacie, gdy na pochylni jest już dąb i miejsce na pierwszą klepkę.';
      db.prepare('INSERT INTO yardFirstPlanks(ship,owner,name,fitted) VALUES(?,?,?,?)').run(ship,uid,name,now);
      return null;
    },
    engrave(ship:number,uid:string,emblem:unknown,now:number): string | null {
      if(typeof emblem!=='string' || !Object.hasOwn(hullEmblems,emblem)) return 'Wybierz jedno z godeł stoczni.';
      const hand=builders(ship,uid).find(entry=>entry.mine);
      if(!hand) return 'Znak może wyryć fundator stępki, wykonawca pierwszej klepki lub dostawca materiałów tej szkuty.';
      if(hand.emblem) return 'Twój znak jest już wyryty na tej burcie.';
      insert.run(ship,uid,emblem,now,mastery.get(uid)?.craft??null);
      return null;
    },
  };
}
