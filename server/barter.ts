import type { DatabaseSync } from 'node:sqlite';
import {
  barterGoods,
  maxBarterLot,
  type BarterBook,
  type BarterCircle,
  type BarterGood,
  type BarterOffer,
  type BarterTerms,
} from '../src/economy/barter';
import { FeastRule } from './harvestLoaf';

type Row = BarterTerms & {
  id: number;
  town: string;
  owner: string;
  name: string;
  circle: number | null;
  sealed: number;
};
type Move = (uid: string, good: BarterGood, delta: number) => void;
function ensure(value: unknown, message: string): asserts value {
  if (!value) throw new FeastRule(message);
}
function good(value: unknown): value is BarterGood {
  return barterGoods.some((g) => g === value);
}
function quantity(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= maxBarterLot
  );
}

export function openBarter(db: DatabaseSync, move: Move) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS barterCircles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, town TEXT NOT NULL, completed INTEGER
    );
    CREATE TABLE IF NOT EXISTS barterOffers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, town TEXT NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL,
      give TEXT NOT NULL, giveQty INTEGER NOT NULL CHECK(giveQty>0),
      want TEXT NOT NULL, wantQty INTEGER NOT NULL CHECK(wantQty>0 AND give<>want),
      circle INTEGER REFERENCES barterCircles(id), sealed INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS barterOwnSlot ON barterOffers(town,owner) WHERE active=1;
    CREATE INDEX IF NOT EXISTS barterMatch ON barterOffers(town,give,giveQty,want,wantQty) WHERE active=1 AND circle IS NULL;
    CREATE INDEX IF NOT EXISTS barterMembers ON barterOffers(circle,id);
    CREATE INDEX IF NOT EXISTS barterLedger ON barterCircles(town,completed,id);
  `);
  // Since all three give a different good, each leg has exactly one recipient.
  const match = db.prepare(`SELECT a.id AS a,b.id AS b,c.id AS c FROM barterOffers a
    JOIN barterOffers b ON b.town=a.town AND b.give=a.want AND b.giveQty=a.wantQty
    JOIN barterOffers c ON c.town=a.town AND c.give=b.want AND c.giveQty=b.wantQty
    WHERE a.town=? AND c.want=a.give AND c.wantQty=a.giveQty
      AND a.active=1 AND b.active=1 AND c.active=1 AND a.circle IS NULL AND b.circle IS NULL AND c.circle IS NULL
      AND a.id<b.id AND a.id<c.id AND b.id<>c.id ORDER BY a.id,b.id,c.id LIMIT 1`);
  const members = db.prepare('SELECT * FROM barterOffers WHERE circle=? ORDER BY id');
  function pairWaiting(town: string) {
    for (let ids = match.get(town); ids; ids = match.get(town)) {
      const circle = db
        .prepare('INSERT INTO barterCircles(town) VALUES(?)')
        .run(town).lastInsertRowid;
      db.prepare('UPDATE barterOffers SET circle=? WHERE id IN (?,?,?)').run(
        circle,
        ids.a,
        ids.b,
        ids.c,
      );
    }
  }
  function publicOffer(o: Row, uid: string | null): BarterOffer {
    return {
      id: o.id,
      name: o.name,
      give: o.give,
      giveQty: o.giveQty,
      want: o.want,
      wantQty: o.wantQty,
      mine: o.owner === uid,
      sealed: !!o.sealed,
    };
  }
  function book(town: string, uid: string | null): BarterBook {
    const waiting = db
      .prepare(
        'SELECT * FROM barterOffers WHERE town=? AND active=1 AND circle IS NULL ORDER BY id',
      )
      .all(town) as unknown as Row[];
    function circle(row: { id: number; completed: number | null }): BarterCircle {
      const offers = members.all(row.id) as unknown as Row[];
      return {
        id: row.id,
        completed: row.completed,
        offers: offers.map((o) => publicOffer(o, uid)),
      };
    }
    const open = db
      .prepare(
        'SELECT id,completed FROM barterCircles WHERE town=? AND completed IS NULL ORDER BY id',
      )
      .all(town);
    const recent = db
      .prepare(
        'SELECT id,completed FROM barterCircles WHERE town=? AND completed IS NOT NULL ORDER BY completed DESC,id DESC LIMIT 5',
      )
      .all(town);
    return {
      waiting: waiting.map((o) => publicOffer(o, uid)),
      circles: open.map((r) => circle({ id: Number(r.id), completed: null })),
      recent: recent.map((r) => circle({ id: Number(r.id), completed: Number(r.completed) })),
    };
  }
  // Called inside the same BEGIN IMMEDIATE transaction as the command receipt and wallet writes.
  function command(
    town: string,
    me: { uid: string; displayName: string },
    cmd: Record<string, unknown>,
    now: number,
  ) {
    const own = db
      .prepare('SELECT * FROM barterOffers WHERE town=? AND owner=? AND active=1')
      .get(town, me.uid) as unknown as Row | undefined;
    if (cmd.action === 'postBarter') {
      ensure(!own, 'Na tym placu masz już ofertę.');
      const { give, giveQty, want, wantQty } = cmd;
      ensure(
        good(give) && good(want) && give !== want && quantity(giveQty) && quantity(wantQty),
        'Wybierz dwa różne towary i pełne ilości od 1 do 99.',
      );
      move(me.uid, give, -giveQty);
      db.prepare(
        'INSERT INTO barterOffers(town,owner,name,give,giveQty,want,wantQty) VALUES(?,?,?,?,?,?,?)',
      ).run(town, me.uid, me.displayName, give, giveQty, want, wantQty);
      pairWaiting(town);
      return;
    }
    ensure(own && own.id === cmd.offer, 'Ta oferta nie należy już do ciebie na tym placu.');
    if (cmd.action === 'withdrawBarter') {
      move(me.uid, own.give, own.giveQty);
      db.prepare('DELETE FROM barterOffers WHERE id=?').run(own.id);
      if (own.circle !== null) {
        db.prepare('UPDATE barterOffers SET circle=NULL,sealed=0 WHERE circle=?').run(own.circle);
        db.prepare('DELETE FROM barterCircles WHERE id=?').run(own.circle);
        pairWaiting(town);
      }
      return;
    }
    ensure(
      own.circle !== null && cmd.circle === own.circle,
      'Ten układ już się zmienił. Sprawdź kupców przed podpisaniem.',
    );
    db.prepare('UPDATE barterOffers SET sealed=1 WHERE id=?').run(own.id);
    const trio = members.all(own.circle) as unknown as Row[];
    ensure(trio.length === 3, 'Księga nie zawiera trzech ofert.');
    if (trio.every((o) => o.sealed)) {
      for (const offer of trio) move(offer.owner, offer.want, offer.wantQty);
      db.prepare('UPDATE barterOffers SET active=0 WHERE circle=?').run(own.circle);
      db.prepare('UPDATE barterCircles SET completed=? WHERE id=?').run(now, own.circle);
    }
  }
  return { book, command };
}
