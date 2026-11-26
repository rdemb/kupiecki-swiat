import type { DatabaseSync } from 'node:sqlite';
import { roadstead, returnTerms as rules, type ReturnOrder, type ReturnChoice, type FreightAccount, type StallBid, type BargainAction } from '../src/economy/returnFreight';

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
    CREATE TABLE IF NOT EXISTS stallBids(
      id INTEGER PRIMARY KEY,offer INTEGER NOT NULL REFERENCES returnOrders(id),bidder TEXT NOT NULL,buyer TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount > 0),expires INTEGER NOT NULL,finished INTEGER,
      state TEXT NOT NULL CHECK(state IN ('open','accepted','declined','withdrawn','expired','closed','cheaper')));
    CREATE UNIQUE INDEX IF NOT EXISTS stallBidOne ON stallBids(offer,bidder) WHERE state='open';
    CREATE INDEX IF NOT EXISTS stallBidExpiry ON stallBids(expires) WHERE state='open';
    CREATE INDEX IF NOT EXISTS stallBidOutcome ON stallBids(offer,state);
    CREATE INDEX IF NOT EXISTS stallBuyerBook ON stallBids(bidder,finished DESC,id DESC);
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
      COUNT(p.nonce) + (SELECT COUNT(*) FROM stallBids b WHERE b.offer=own.id AND b.state='accepted') AS sold,
      (SELECT COALESCE(SUM(b.amount),0) FROM stallBids b WHERE b.offer=own.id AND b.state='accepted')
      + COALESCE(SUM(CASE WHEN p.nonce IS NOT NULL
        THEN COALESCE(${receiptQuote},own.ask) END),0) AS revenue
    FROM own LEFT JOIN yardSlips p ON json_extract(payload,'$[0]')='buyReturn' AND ${receiptOffer}=own.id
    GROUP BY own.id ORDER BY own.id DESC`);
  const readBids = `SELECT b.id,b.offer,b.buyer,o.name AS seller,b.amount,b.expires,b.state
    FROM stallBids b JOIN returnOrders o ON o.id=b.offer`;
  const openBids = db.prepare(readBids + " WHERE b.state='open' AND (o.owner=? OR b.bidder=?) ORDER BY b.offer,b.amount DESC,b.id");
  const finishedBids = db.prepare(readBids + " WHERE b.bidder=? AND b.state!='open' ORDER BY b.finished DESC,b.id DESC LIMIT 8");
  const refundBid = db.prepare(`UPDATE stallBids SET state=?,finished=? WHERE id=? AND state='open' RETURNING bidder,amount`);
  const activeAtStall = db.prepare("SELECT id,amount FROM stallBids WHERE offer=? AND state='open'");
  const buyerBid = db.prepare("SELECT id,amount FROM stallBids WHERE offer=? AND bidder=? AND state='open'");
  function releaseBid(id: number, reason: 'withdrawn' | 'declined' | 'expired' | 'closed' | 'cheaper', now: number) {
    const row = refundBid.get(reason, now, id);
    if (row) transfer(String(row.bidder), Number(row.amount), 0);
  }
  function closeStall(offer: number, now: number) {
    for (const row of activeAtStall.all(offer)) releaseBid(Number(row.id), 'closed', now);
  }
  function deliverSack(offer: number, owner: string, buyer: string, amount: number, left: number, now: number) {
    transfer(buyer, 0, 1);
    transfer(owner, amount, 0);
    db.prepare("UPDATE returnOrders SET remaining=?,state=? WHERE id=?").run(left - 1, left === 1 ? 'sold' : 'stall', offer);
    if (left === 1) closeStall(offer, now);
  }
  return {
    bids(uid: string | null): StallBid[] {
      return uid ? [...openBids.all(uid,uid), ...finishedBids.all(uid)] as unknown as StallBid[] : [];
    },
    bargain(me: Merchant, action: BargainAction['action'], offer: number, ask: unknown, quote: unknown, bid: unknown, now: number) {
      const order = get.get(offer);
      requireTerm(order && order.state === 'stall' && Number(order.remaining) > 0, 'Ten stragan zakończył już sprzedaż partii.');
      if (action === 'bidReturn') {
        const price = Number(order.revised ?? order.ask);
        requireTerm(order.owner !== me.uid && price === quote, 'Wybierz cudzy stragan i sprawdź aktualną cenę.');
        requireTerm(integer(ask, price - 1), 'Zaproponuj co najmniej jedną monetę i mniej niż cena na tabliczce.');
        requireTerm(!buyerBid.get(offer,me.uid), 'Przy tej partii leży już twoja oferta.');
        requireTerm(me.gold >= ask, 'W sakwie brakuje monet na tę ofertę.');
        transfer(me.uid, -ask, 0);
        db.prepare(`INSERT INTO stallBids(offer,bidder,buyer,amount,expires,state) VALUES(?,?,?,?,?,'open')`)
          .run(offer,me.uid,me.displayName,ask,now+rules.bidMs);
        return;
      }
      requireTerm(integer(bid, Number.MAX_SAFE_INTEGER), 'Wybierz ofertę z tego straganu.');
      const row = db.prepare("SELECT bidder,amount FROM stallBids WHERE id=? AND offer=? AND state='open' AND expires>?")
        .get(bid,offer,now);
      requireTerm(row, 'Ta oferta została już rozliczona.');
      if (action === 'recallReturnBid') {
        requireTerm(row.bidder === me.uid, 'Możesz odebrać tylko własną sakiewkę.');
        releaseBid(bid,'withdrawn',now);
        return;
      }
      requireTerm(order.owner === me.uid, 'Ofertę rozpatruje właściciel straganu.');
      if (action === 'refuseReturnBid') {
        releaseBid(bid,'declined',now);
        return;
      }
      db.prepare("UPDATE stallBids SET state='accepted',finished=? WHERE id=?").run(now,bid);
      deliverSack(offer, me.uid, String(row.bidder), Number(row.amount), Number(order.remaining), now);
    },
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
      for (const row of db.prepare("SELECT id FROM stallBids WHERE state='open' AND expires<=?").all(now))
        releaseBid(Number(row.id), 'expired', now);
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
      offer: number, quote: unknown, ask: unknown, now: number) {
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
        for (const row of activeAtStall.all(offer)) {
          if (Number(row.amount) >= ask) releaseBid(Number(row.id), 'cheaper', now);
        }
        return;
      }
      if (action === 'collectReturn') {
        requireTerm(order.owner === me.uid, 'Zboże może odebrać jego właściciel.');
        transfer(me.uid, 0, left);
        db.prepare("UPDATE returnOrders SET remaining=0,state='collected' WHERE id=?").run(offer);
        closeStall(offer, now);
      } else {
        requireTerm(quote === price || (quote === undefined && order.revised === null),
          'Cena na tabliczce się zmieniła. Sprawdź ją przed zakupem.');
        const reserved = buyerBid.get(offer, me.uid);
        requireTerm(order.owner !== me.uid && me.gold + Number(reserved?.amount ?? 0) >= price, 'Sprawdź cenę i wybierz worek innego kupca.');
        if (reserved) releaseBid(Number(reserved.id), 'withdrawn', now);
        transfer(me.uid, -price, 0);
        deliverSack(offer, String(order.owner), me.uid, price, left, now);
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
