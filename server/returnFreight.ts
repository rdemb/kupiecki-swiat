import type { DatabaseSync } from 'node:sqlite';
import { roadstead, returnTerms as rules, type ReturnOrder, type ReturnChoice } from '../src/economy/returnFreight';

type Merchant = { uid: string; displayName: string; gold: number };
export class ReturnRule extends Error {}
function requireTerm(ok: unknown, message: string): asserts ok {
  if (!ok) throw new ReturnRule(message);
}
const integer = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= max;

export function installReturnFreight(db: DatabaseSync, transfer: (uid: string, gold: number, grain: number) => void) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS returnOrders(
      id INTEGER PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, fee INTEGER NOT NULL, ask INTEGER NOT NULL,
      cost INTEGER NOT NULL, sacks INTEGER NOT NULL, remaining INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('open','aboard','stall','sold','collected','refunded')));
    CREATE UNIQUE INDEX IF NOT EXISTS returnOneListing ON returnOrders(owner) WHERE state IN ('open','aboard','stall');
    CREATE INDEX IF NOT EXISTS returnExpiry ON returnOrders(expires) WHERE state='open';
    CREATE TABLE IF NOT EXISTS returnChoices(voyage INTEGER PRIMARY KEY REFERENCES yardVoyages(id),
      cargo INTEGER UNIQUE REFERENCES returnOrders(id));
  `);
  const get = db.prepare('SELECT * FROM returnOrders WHERE id=?');
  const refund = db.prepare("UPDATE returnOrders SET state='refunded' WHERE id=? AND state='open' RETURNING owner,cost,fee");
  function refundOrder(id: number) {
    const row = refund.get(id);
    if (row) transfer(String(row.owner), Number(row.cost) + Number(row.fee), 0);
  }
  const manifest = db.prepare(`SELECT o.name,o.fee FROM returnChoices c
    LEFT JOIN returnOrders o ON o.id=c.cargo WHERE c.voyage=?`);
  const listings = db.prepare(`SELECT o.id,o.name,o.fee,o.ask,o.remaining,o.state,o.expires,o.owner=? AS own,
      s.name AS vessel,s.id AS ship FROM returnOrders o LEFT JOIN returnChoices c ON c.cargo=o.id
      LEFT JOIN yardVoyages v ON v.id=c.voyage LEFT JOIN yardShips s ON s.id=v.ship
      WHERE (o.state='open' AND o.expires>?) OR o.state IN ('aboard','stall') ORDER BY o.id`);
  return {
    board(uid: string | null, now: number) {
      return listings.all(uid, now).map(r => ({ ...r, own: Boolean(r.own) })) as unknown as ReturnOrder[];
    },
    choice(voyage: number): ReturnChoice | null {
      const row = manifest.get(voyage);
      return row ? { cargo: row.name === null ? null : { name: String(row.name), fee: Number(row.fee) } } : null;
    },
    expire(now: number) {
      for (const r of db.prepare("SELECT id FROM returnOrders WHERE state='open' AND expires<=?").all(now))
        refundOrder(Number(r.id));
    },
    post(me: Merchant, fee: unknown, ask: unknown, now: number) {
      requireTerm(integer(fee, rules.maxFee) && integer(ask, rules.maxAsk), 'Sprawdź przewoźne i cenę worka.');
      requireTerm(me.gold >= rules.lotCost + fee, 'Brakuje złota na zakup zboża i przewóz.');
      requireTerm(!db.prepare("SELECT 1 FROM returnOrders WHERE owner=? AND state IN ('open','aboard','stall')").get(me.uid),
        'Najpierw zamknij swój poprzedni fracht lub odbierz zboże ze straganu.');
      transfer(me.uid, -(rules.lotCost + fee), 0);
      db.prepare(`INSERT INTO returnOrders(owner,name,fee,ask,cost,sacks,expires,state)
        VALUES(?,?,?,?,?,?,?,'open')`).run(me.uid, me.displayName, fee, ask, rules.lotCost, rules.sacks, now + rules.orderMs);
    },
    trade(me: Merchant, action: 'cancelReturn' | 'collectReturn' | 'buyReturn', offer: number) {
      const order = get.get(offer);
      requireTerm(order, 'Nie znaleziono tego listu.');
      if (action === 'cancelReturn') {
        requireTerm(order.owner === me.uid && order.state === 'open', 'Możesz wycofać własny list przed przyjęciem przez szypra.');
        refundOrder(offer);
        return;
      }
      const left = Number(order.remaining);
      requireTerm(order.state === 'stall' && left > 0, 'Ta partia nie czeka na straganie.');
      if (action === 'collectReturn') {
        requireTerm(order.owner === me.uid, 'Zboże może odebrać jego właściciel.');
        transfer(me.uid, 0, left);
        db.prepare("UPDATE returnOrders SET remaining=0,state='collected' WHERE id=?").run(offer);
      } else {
        const price = Number(order.ask);
        requireTerm(order.owner !== me.uid && me.gold >= price, 'Sprawdź cenę i wybierz worek innego kupca.');
        transfer(me.uid, -price, 1);
        transfer(String(order.owner), price, 0);
        db.prepare("UPDATE returnOrders SET remaining=?,state=? WHERE id=?").run(left - 1, left === 1 ? 'sold' : 'stall', offer);
      }
    },
    choose(uid: string, ship: number, voyage: number, cargo: number | null, now: number) {
      const trip = db.prepare(`SELECT captain,departed,due FROM yardVoyages
        WHERE id=? AND ship=? AND departed IS NOT NULL AND closed=0`).get(voyage, ship);
      requireTerm(trip && trip.captain === uid, 'O powrocie decyduje szyper tego rejsu.');
      requireTerm(!manifest.get(voyage), 'Dyspozycja powrotna już zapadła.');
      requireTerm(now < roadstead(Number(trip.departed), Number(trip.due)).deadline, 'Szkuta opuściła już redę.');
      if (cargo !== null) {
        const order = get.get(cargo);
        requireTerm(order && order.state === 'open' && order.owner !== uid && Number(order.expires) > now,
          'Wybierz dostępny fracht innego kupca.');
        db.prepare("UPDATE returnOrders SET state='aboard' WHERE id=?").run(cargo);
        db.prepare('UPDATE yardVoyages SET due=due+? WHERE id=?').run(rules.loadMs, voyage);
      }
      db.prepare('INSERT INTO returnChoices(voyage,cargo) VALUES(?,?)').run(voyage, cargo);
    },
    land(voyage: number, captain: string) {
      const row = db.prepare(`UPDATE returnOrders SET state='stall',remaining=sacks WHERE state='aboard'
        AND id=(SELECT cargo FROM returnChoices WHERE voyage=?) RETURNING fee`).get(voyage);
      if (row) transfer(captain, Number(row.fee), 0);
    },
  };
}
