import type { DatabaseSync } from 'node:sqlite';
import type { SeedChestBook, SeedRoute } from '../src/economy/commonField';

type Transfer = (uid: string, gold: number, grain: number) => void;
type Lot = { id: number; donor: string; donorName: string; founder: string; generation: number; receiver: string | null; receiverName: string | null };

export function openSeedChest(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fieldSeedGifts(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target INTEGER NOT NULL, donor TEXT NOT NULL, donorName TEXT NOT NULL,
      founder TEXT NOT NULL, generation INTEGER NOT NULL CHECK(generation >= 1),
      receiver TEXT, receiverName TEXT, sownDay INTEGER, parent INTEGER REFERENCES fieldSeedGifts(id),
      UNIQUE(target, donor), UNIQUE(target, receiver)
    );
    CREATE INDEX IF NOT EXISTS fieldSeedHistory ON fieldSeedGifts(sownDay DESC,id DESC);
  `);
  const lots = db.prepare('SELECT * FROM fieldSeedGifts WHERE target=? ORDER BY id');
  const lookup = db.prepare('SELECT * FROM fieldSeedGifts WHERE target=? AND id=? AND sownDay IS NULL');
  const fromDonor = db.prepare('SELECT 1 FROM fieldSeedGifts WHERE target=? AND donor=?');
  const incoming = db.prepare('SELECT * FROM fieldSeedGifts WHERE target=? AND receiver=?');
  const crop = db.prepare('SELECT share FROM fieldGrowers WHERE round=? AND uid=? AND share>0');
  const entries = db.prepare(`SELECT id,donorName AS donor,receiverName AS receiver,founder,generation,sownDay AS day
    FROM fieldSeedGifts WHERE sownDay IS NOT NULL ORDER BY sownDay DESC,id DESC LIMIT 8`);

  const trace = db.prepare(`WITH RECURSIVE lineage(id,parent,depth) AS (
    SELECT id,parent,1 FROM fieldSeedGifts WHERE id=? AND sownDay IS NOT NULL
    UNION ALL
    SELECT g.id,g.parent,l.depth+1 FROM fieldSeedGifts g JOIN lineage l ON g.id=l.parent
      WHERE l.depth<8 AND g.sownDay IS NOT NULL
  ) SELECT g.id,g.donorName donor,g.receiverName receiver,g.founder,g.generation,g.sownDay day,l.parent
    FROM lineage l JOIN fieldSeedGifts g ON g.id=l.id ORDER BY l.depth`);
  function route(id: number): SeedRoute | null {
    const rows = trace.all(id);
    if (!rows.length) return null;
    return {
      steps: rows.map(({parent, ...step}) => step) as unknown as SeedRoute['steps'],
      older: rows.at(-1)!.parent as number | null,
    };
  }
  function eligible(uid: string, target: number) {
    return !!crop.get(target-1,uid) && !fromDonor.get(target,uid);
  }
  function book(uid: string | null, target: number, accepting: boolean): SeedChestBook {
    const active = accepting ? lots.all(target) as unknown as Lot[] : [];
    return {
      target,
      canOffer: !!uid && accepting && eligible(uid,target),
      reserved: !!uid && active.some(lot => lot.receiver === uid),
      lots: active.map(lot => ({
        id:lot.id, donor:lot.donorName, founder:lot.founder, generation:lot.generation,
        receiver:lot.receiverName, mine:uid === lot.donor,
      })),
      history: entries.all() as unknown as SeedChestBook['history'],
    };
  }
  function offer(uid: string, name: string, target: number, transfer: Transfer) {
    if (!eligible(uid,target)) return false;
    const parent = incoming.get(target-1,uid);
    transfer(uid,0,-1);
    db.prepare(`INSERT INTO fieldSeedGifts(target,donor,donorName,founder,generation,parent) VALUES(?,?,?,?,?,?)`)
      .run(target,uid,name,String(parent?.founder ?? name),Number(parent?.generation ?? 0) + 1, parent?.id ?? null);
    return true;
  }
  function recall(uid: string, target: number, id: number, transfer: Transfer) {
    const lot = lookup.get(target,id);
    if (!lot || lot.donor !== uid || lot.receiver !== null) return false;
    transfer(uid,0,1);
    db.prepare('DELETE FROM fieldSeedGifts WHERE id=?').run(id);
    return true;
  }
  function reserve(uid: string, name: string, target: number, id: number) {
    const lot = lookup.get(target,id);
    if (!lot || lot.donor === uid || lot.receiver !== null || incoming.get(target,uid)) return false;
    db.prepare('UPDATE fieldSeedGifts SET receiver=?,receiverName=? WHERE id=?').run(uid,name,id);
    return true;
  }
  function release(uid: string, target: number) {
    return Number(db.prepare(`UPDATE fieldSeedGifts SET receiver=NULL,receiverName=NULL
      WHERE target=? AND receiver=? AND sownDay IS NULL`).run(target,uid).changes);
  }
  function sow(target: number, day: number, transfer: Transfer) {
    for (const lot of lots.all(target)) {
      if (lot.receiver === null) {
        transfer(String(lot.donor),0,1);
        db.prepare('DELETE FROM fieldSeedGifts WHERE id=?').run(lot.id);
      } else {
        db.prepare('UPDATE fieldSeedGifts SET sownDay=? WHERE id=?').run(day,lot.id);
      }
    }
  }
  return { route, book, offer, recall, reserve, release, sow };
}
