import type { DatabaseSync } from 'node:sqlite';
import {
  navigation,
  portBid,
  raftRules as r,
  raftSeconds,
  type RaftBook,
  type RaftRun,
} from '../src/economy/rafts';

export class RaftRule extends Error {}
export function installRafts(
  db: DatabaseSync,
  settleGold: (uid: string, amount: number) => void,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS raftYard(id INTEGER PRIMARY KEY CHECK(id=1),
      forest INTEGER NOT NULL CHECK(forest>=0), port INTEGER NOT NULL CHECK(port>=0), cutAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS raftRuns(id INTEGER PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL,
      start INTEGER NOT NULL, due INTEGER NOT NULL, price INTEGER NOT NULL, landed INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS raftOwnerOnWater ON raftRuns(owner) WHERE landed=0;
    CREATE INDEX IF NOT EXISTS raftArrival ON raftRuns(due,id) WHERE landed=0;
  `);
  db.prepare('INSERT OR IGNORE INTO raftYard VALUES(1,?,0,?)').run(
    r.forestCapacity,
    Date.now(),
  );
  const yard = db.prepare('SELECT forest,port,cutAt FROM raftYard WHERE id=1');
  const take = db.prepare(
    'UPDATE raftYard SET forest=forest-? WHERE id=1 AND forest>=?',
  );
  const due = db.prepare(
    'SELECT id,owner,name,price FROM raftRuns WHERE landed=0 AND due<=? ORDER BY due,id',
  );
  const inbound = db.prepare(
    'SELECT COUNT(*) AS count FROM raftRuns WHERE landed=0',
  );
  const atPort = db.prepare(
    'UPDATE raftYard SET port=port-1 WHERE id=1 AND port>0',
  );
  // All changes, including every payment, share the caller's SQLite transaction.
  function advance(now: number) {
    const { forest, cutAt } = yard.get()!;
    const periods = Math.floor((now - Number(cutAt)) / r.sawInterval);
    if (periods > 0 && Number(forest) < r.forestCapacity) {
      db.prepare(
        'UPDATE raftYard SET forest=MIN(?,forest+?), cutAt=? WHERE id=1',
      ).run(r.forestCapacity, periods, Number(cutAt) + periods * r.sawInterval);
    }
    for (const run of due.all(now)) {
      settleGold(String(run.owner), Number(run.price));
      db.prepare('UPDATE raftRuns SET landed=1 WHERE id=?').run(run.id);
      db.prepare('UPDATE raftYard SET port=port+? WHERE id=1').run(
        r.loadsPerRaft,
      );
      db.prepare(
        'INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)',
      ).run(
        run.owner,
        run.name,
        'krolewska_przystan',
        'Flisacy dostarczyli z Gaju dwanaście belek dla portowych cieśli.',
      );
    }
  }
  function takeForest(loads: number, now: number) {
    const full = Number(yard.get()!.forest) === r.forestCapacity;
    if (!take.run(loads, loads).changes)
      throw new RaftRule(
        'W tartaku zabrakło drewna. Poczekaj na następną partię.',
      );
    if (full) db.prepare('UPDATE raftYard SET cutAt=? WHERE id=1').run(now);
  }
  function reserved() {
    return Number(inbound.get()!.count) * r.loadsPerRaft;
  }
  function launch(
    actor: { uid: string; displayName: string; gold: number },
    price: unknown,
    level: number,
    now: number,
  ) {
    if (navigation(level) !== 'open')
      throw new RaftRule('Bosman zamknął spław przy tym stanie rzeki.');
    if (
      db
        .prepare('SELECT 1 FROM raftRuns WHERE owner=? AND landed=0')
        .get(actor.uid)
    )
      throw new RaftRule('Twoja tratwa płynie już do portu.');
    const offer = portBid(Number(yard.get()!.port) + reserved());
    if (offer === null) throw new RaftRule('Cieśle mają już komplet dostaw.');
    if (offer !== price)
      throw new RaftRule(
        'Port zmienił cenę. Sprawdź aktualną ofertę przed wypłynięciem.',
      );
    const cost = r.loadsPerRaft * r.loadPrice;
    if (actor.gold < cost)
      throw new RaftRule('W sakwie brakuje złota na zakup belek.');
    takeForest(r.loadsPerRaft, now);
    settleGold(actor.uid, -cost);
    db.prepare(
      'INSERT INTO raftRuns(owner,name,start,due,price) VALUES(?,?,?,?,?)',
    ).run(
      actor.uid,
      actor.displayName,
      now,
      now + raftSeconds(level) * 1000,
      offer,
    );
  }
  function book(
    uid: string | null,
    level: number,
    neededAtBridge: number,
  ): RaftBook {
    const { forest, port, cutAt } = yard.get()!;
    const pending = reserved();
    const cols = 'SELECT id,name,start,due,price,owner=? AS own FROM raftRuns ';
    function runs(query: string): RaftRun[] {
      return db
        .prepare(cols + query)
        .all(uid)
        .map((row) => ({
          id: Number(row.id),
          name: String(row.name),
          start: Number(row.start),
          due: Number(row.due),
          price: Number(row.price),
          own: !!row.own,
        }));
    }
    return {
      forest: Number(forest),
      port: Number(port),
      inbound: pending,
      water: navigation(level),
      seconds: raftSeconds(level),
      offer: portBid(Number(port) + pending),
      neededAtBridge,
      nextCut:
        Number(forest) < r.forestCapacity
          ? Number(cutAt) + r.sawInterval
          : null,
      runs: runs('WHERE landed=0 ORDER BY due,id'),
      arrivals: runs('WHERE landed=1 ORDER BY due DESC,id DESC LIMIT 5'),
    };
  }
  function portStock() {
    return Number(yard.get()!.port);
  }
  return {
    advance,
    launch,
    book,
    takeForest,
    portStock,
    usePortLoad: () => Boolean(atPort.run().changes),
  };
}
