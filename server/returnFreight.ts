import type { DatabaseSync } from 'node:sqlite';
import { roadstead, returnTerms as rules, type ReturnOrder, type ReturnChoice, type FreightAccount } from '../src/economy/returnFreight';

type Merchant = { uid: string; displayName: string; gold: number };
export class ReturnRule extends Error {}
function requireTerm(ok: unknown, message: string): asserts ok {
  if (!ok) throw new ReturnRule(message);
}
const integer = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= max;

export function installReturnFreight(db: DatabaseSync, transfer: (uid: string, gold: number, grain: number) => void) {
  // Successful, nonce-deduplicated shipyard receipts survive restarts. Older purchases
  // had a fixed price (the original ask); newer clients sign the price they saw.
  const receiptOffer = "COALESCE(json_extract(payload,'$[#-1].offer'),json_extract(payload,'$[#-2].offer'))";
  const receiptQuote = "COALESCE(json_extract(payload,'$[#-1].quote'),json_extract(payload,'$[#-2].quote'))";
  db.exec(`
    CREATE TABLE IF NOT EXISTS returnOrders(
      id INTEGER PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, fee INTEGER NOT NULL, ask INTEGER NOT NULL,
      cost INTEGER NOT NULL, sacks INTEGER NOT NULL, remaining INTEGER NOT NULL DEFAULT 0, expires INTEGER NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('open','aboard','stall','sold','collected','refunded')));
    CREATE UNIQUE INDEX IF NOT EXISTS returnOneListing ON returnOrders(owner) WHERE state IN ('open','aboard','stall');
    CREATE INDEX IF NOT EXISTS returnExpiry ON returnOrders(expires) WHERE state='open';
    CREATE TABLE IF NOT EXISTS returnChoices(voyage INTEGER PRIMARY KEY REFERENCES yardVoyages(id),
      cargo INTEGER UNIQUE REFERENCES returnOrders(id));
    CREATE TABLE IF NOT EXISTS returnQuotes(orderId INTEGER PRIMARY KEY REFERENCES returnOrders(id), ask INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS returnPurchaseSlips ON yardSlips(${receiptOffer})
      WHERE json_extract(payload,'$[0]')='buyReturn';
    CREATE INDEX IF NOT EXISTS returnBookByOwner ON returnOrders(owner,id DESC);
  `);
  const get = db.prepare(`SELECT o.*,q.ask AS revised FROM returnOrders o
    LEFT JOIN returnQuotes q ON q.orderId=o.id WHERE o.id=?`);
  const refund = db.prepare("UPDATE returnOrders SET state='refunded' WHERE id=? AND state='open' RETURNING owner,cost,fee");
  function refundOrder(id: number) {
    const row = refund.get(id);
    if (row) transfer(String(row.owner), Number(row.cost) + Number(row.fee), 0);
  }
  const manifest = db.prepare(`SELECT o.name,o.fee FROM returnChoices c
    LEFT JOIN returnOrders o ON o.id=c.cargo WHERE c.voyage=?`);
  const listings = db.prepare(`SELECT o.id,o.name,o.fee,COALESCE(q.ask,o.ask) AS ask,o.remaining,o.state,o.expires,o.owner=? AS own,
      s.name AS vessel,s.id AS ship FROM returnOrders o LEFT JOIN returnQuotes q ON q.orderId=o.id LEFT JOIN returnChoices c ON c.cargo=o.id
      LEFT JOIN yardVoyages v ON v.id=c.voyage LEFT JOIN yardShips s ON s.id=v.ship
      WHERE (o.state='open' AND o.expires>?) OR o.state IN ('aboard','stall') ORDER BY o.id`);
  const folio = db.prepare(`WITH own AS (
      SELECT o.id,o.cost,o.fee,o.sacks,o.remaining,o.ask,s.name AS vessel,v.settled AS landed
      FROM returnOrders o JOIN returnChoices c ON c.cargo=o.id JOIN yardVoyages v ON v.id=c.voyage
      JOIN yardShips s ON s.id=v.ship WHERE o.owner=? AND o.state IN ('stall','sold','collected')
      ORDER BY o.id DESC LIMIT 8)
    SELECT own.id,own.cost,own.fee,own.sacks,own.remaining,own.vessel,own.landed,
      COUNT(p.nonce) AS sold,COALESCE(SUM(CASE WHEN p.nonce IS NOT NULL
        THEN COALESCE(${receiptQuote},own.ask) END),0) AS revenue
    FROM own LEFT JOIN yardSlips p ON json_extract(payload,'$[0]')='buyReturn' AND ${receiptOffer}=own.id
    GROUP BY own.id ORDER BY own.id DESC`);
  return {
    accounts(uid: string | null): FreightAccount[] {
      return uid ? folio.all(uid) as unknown as FreightAccount[] : [];
    },
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
    trade(me: Merchant, action: 'cancelReturn' | 'collectReturn' | 'buyReturn' | 'repriceReturn',
      offer: number, quote: unknown, ask: unknown) {
      const order = get.get(offer);
      requireTerm(order, 'Nie znaleziono tego listu.');
      if (action === 'cancelReturn') {
        requireTerm(order.owner === me.uid && order.state === 'open', 'Możesz wycofać własny list przed przyjęciem przez szypra.');
        refundOrder(offer);
        return;
      }
      const left = Number(order.remaining);
      requireTerm(order.state === 'stall' && left > 0, 'Ta partia nie czeka na straganie.');
      const price = Number(order.revised ?? order.ask);
      if (action === 'repriceReturn') {
        requireTerm(order.owner === me.uid, 'Cenę może zmienić właściciel straganu.');
        requireTerm(integer(ask, rules.maxAsk), 'Wpisz cenę od 1 do ' + rules.maxAsk + ' zł.');
        requireTerm(quote === price, 'Cena na straganie już się zmieniła. Sprawdź ją ponownie.');
        requireTerm(ask !== price, 'Taka cena już widnieje na tabliczce.');
        db.prepare(`INSERT INTO returnQuotes(orderId,ask) VALUES(?,?)
          ON CONFLICT(orderId) DO UPDATE SET ask=excluded.ask`).run(offer, ask);
        return;
      }
      if (action === 'collectReturn') {
        requireTerm(order.owner === me.uid, 'Zboże może odebrać jego właściciel.');
        transfer(me.uid, 0, left);
        db.prepare("UPDATE returnOrders SET remaining=0,state='collected' WHERE id=?").run(offer);
      } else {
        requireTerm(quote === price || (quote === undefined && order.revised === null),
          'Cena na tabliczce się zmieniła. Sprawdź ją przed zakupem.');
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
