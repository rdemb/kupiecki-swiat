import type { installRafts } from './rafts';
import type { Express, Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { harborRules as rules } from '../src/economy/harborWorks';

export function installHarborWorks(
  app: Express,
  db: DatabaseSync,
  authenticate: (req: Request) => { uid: string; displayName: string } | null,
  rafts: ReturnType<typeof installRafts>,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS harborStores(
      id INTEGER PRIMARY KEY CHECK(id=1), food INTEGER NOT NULL CHECK(food>=0),
      salt INTEGER NOT NULL CHECK(salt>=0), provisions INTEGER NOT NULL CHECK(provisions>=0),
      shipments INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO harborStores VALUES(1,0,0,0,0);
    CREATE TABLE IF NOT EXISTS harborShifts(
      owner TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('fish','boil')), due INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS harborReceipts(
      owner TEXT NOT NULL, nonce TEXT NOT NULL, action TEXT NOT NULL, name TEXT NOT NULL,
      created INTEGER NOT NULL, PRIMARY KEY(owner,nonce)
    );
    CREATE INDEX IF NOT EXISTS harborShipLog ON harborReceipts(created DESC) WHERE action='ship';
  `);
  const stores = db.prepare('SELECT food,salt,provisions,shipments FROM harborStores WHERE id=1');
  const shifts = db.prepare('SELECT name,kind,due FROM harborShifts ORDER BY due,owner');
  const myShift = db.prepare('SELECT kind,due FROM harborShifts WHERE owner=?');
  const lastShip = db.prepare(
    "SELECT name,created FROM harborReceipts WHERE action='ship' ORDER BY created DESC,rowid DESC LIMIT 1",
  );
  const receive = db.prepare('UPDATE harborStores SET food=food+?,salt=salt+? WHERE id=1');
  function finishDue(now: number) {
    rafts.advance(now);
    const loads = db
      .prepare('SELECT kind,COUNT(*) AS n FROM harborShifts WHERE due<=? GROUP BY kind')
      .all(now);
    if (!loads.length) return;
    for (const row of loads) {
      const count = Number(row.n);
      receive.run(
        row.kind === 'fish' ? count * rules.catchRations : 0,
        row.kind === 'boil' ? count * rules.saltYield : 0,
      );
    }
    db.prepare('DELETE FROM harborShifts WHERE due<=?').run(now);
  }
  const issueSalt = db.prepare('UPDATE harborStores SET salt=salt-? WHERE id=1 AND salt>=?');
  function reserveSalt() {
    return Boolean(issueSalt.run(rules.exportBarrels, rules.exportBarrels).changes);
  }
  function completeShipment(uid: string, name: string, story?: string) {
    const extra = rafts.usePortLoad();
    const teams = extra ? 2 : 1;
    db.prepare('UPDATE harborStores SET provisions=provisions+?,shipments=shipments+1 WHERE id=1').run(teams);
    const news = story ?? (extra
      ? 'Szyper odebrał sól. Cieśle zużyli partię belek z Gaju i przygotowali drugi zaprzęg.'
      : 'Odprawiono transport soli. Fracht opłacił zaprzęg na następny przewóz portowy.');
    db.prepare('INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)').run(uid,name,'krolewska_przystan',news);
    return teams;
  }
  function state(uid: string | undefined, now: number) {
    return {
      ...stores.get(),
      timber: rafts.portStock(),
      workers: shifts.all(),
      mine: uid ? (myShift.get(uid) ?? null) : null,
      lastShip: lastShip.get() ?? null,
      now,
    };
  }
  app.get('/api/harbor-works', (req, res, next) => {
    try {
      const me = authenticate(req);
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      finishDue(now);
      const result = state(me?.uid, now);
      db.exec('COMMIT');
      res.set('Cache-Control', 'no-store').json(result);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      next(e);
    }
  });
  app.post('/api/harbor-works', (req, res, next) => {
    const me = authenticate(req);
    if (!me) {
      res.status(401).json({ error: 'Zaloguj się, żeby pracować w porcie.' });
      return;
    }
    const { action, nonce } = req.body ?? {};
    if (
      !['fish', 'boil', 'ship'].includes(action) ||
      typeof nonce !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(nonce)
    ) {
      res.status(400).json({ error: 'Nieprawidłowe polecenie dla przystani.' });
      return;
    }
    try {
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      finishDue(now);
      const prior = db
        .prepare('SELECT action FROM harborReceipts WHERE owner=? AND nonce=?')
        .get(me.uid, nonce);
      let conflict = '';
      if (prior && prior.action !== action) conflict = 'Ten list przewozowy jest już wykorzystany.';
      else if (!prior) {
        if (myShift.get(me.uid)) conflict = 'Twoja załoga jest jeszcze na zmianie.';
        else if (action === 'ship') {
          if (!reserveSalt()) conflict = 'W magazynie jest za mało beczek na wysyłkę.';
          else completeShipment(me.uid, me.displayName);
        } else {
          if (action === 'boil') {
            const ration = db
              .prepare('UPDATE harborStores SET food=food-? WHERE id=1 AND food>=?')
              .run(rules.crewRations, rules.crewRations);
            if (!ration.changes) conflict = 'Załodze brakuje racji. Najpierw wróćcie z połowu.';
          }
          if (!conflict) {
            const duration = action === 'fish' ? rules.fishSeconds : rules.boilSeconds;
            db.prepare('INSERT INTO harborShifts VALUES(?,?,?,?)').run(
              me.uid,
              me.displayName,
              action,
              now + duration * 1000,
            );
          }
        }
        if (!conflict)
          db.prepare('INSERT INTO harborReceipts VALUES(?,?,?,?,?)').run(
            me.uid,
            nonce,
            action,
            me.displayName,
            now,
          );
      }
      const result = state(me.uid, now);
      db.exec('COMMIT');
      if (conflict) res.status(409).json({ error: conflict });
      else res.status(prior ? 200 : 201).json(result);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      next(e);
    }
  });
  // The freight dispatcher calls this inside the same transaction that issues the waybill.
  const useTeam = db.prepare(
    'UPDATE harborStores SET provisions=provisions-1 WHERE id=1 AND provisions>0',
  );
  return {
    useTeam: () => Boolean(useTeam.run().changes), finishDue, reserveSalt,
    salt: () => Number(stores.get()!.salt),
    returnSalt: (barrels:number) => receive.run(0, barrels),
    receiveCharter(uid:string, name:string, ship:string, voyage:number, at:number) {
      const teams = completeShipment(uid, name, 'Szkuta „'+ship+'” wróciła z redy po dostawie soli. Szyper: '+name+'.');
      db.prepare('INSERT INTO harborReceipts(owner,nonce,action,name,created) VALUES(?,?,?,?,?)')
        .run(uid,'szkuta/'+voyage,'ship',name,at);
      return teams;
    },
  };
}
