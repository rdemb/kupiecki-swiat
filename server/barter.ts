import type { DatabaseSync } from 'node:sqlite';
import {
  barterGoods,
  maxBarterLot,
  missingBarterTerms,
  type BarterCall,
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
    CREATE TABLE IF NOT EXISTS barterCalls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first INTEGER NOT NULL REFERENCES barterOffers(id) ON DELETE CASCADE,
      second INTEGER NOT NULL REFERENCES barterOffers(id) ON DELETE CASCADE,
      postedBy INTEGER NOT NULL UNIQUE CHECK (postedBy IN (first,second)),
      UNIQUE(first,second)
    );
    CREATE INDEX IF NOT EXISTS barterCalledSecond ON barterCalls(second);
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
  const callRows = db.prepare(`SELECT n.id,n.first,n.second,n.postedBy,
    a.name firstName,b.name secondName,b.want give,b.wantQty giveQty,a.give want,a.giveQty wantQty
    FROM barterCalls n JOIN barterOffers a ON a.id=n.first JOIN barterOffers b ON b.id=n.second
    WHERE a.town=? AND b.town=a.town AND a.active=1 AND b.active=1
      AND a.circle IS NULL AND b.circle IS NULL ORDER BY n.id`);
  const calls = (town: string) => callRows.all(town) as unknown as BarterCall[];
  const dismiss = db.prepare('DELETE FROM barterCalls WHERE first=? OR second=?');
  function seat(town: string, first: number, second: number, third: number) {
    const circle = db
      .prepare('INSERT INTO barterCircles(town) VALUES(?)')
      .run(town).lastInsertRowid;
    for (const id of [first, second, third]) dismiss.run(id, id);
    db.prepare('UPDATE barterOffers SET circle=? WHERE id IN (?,?,?)').run(
      circle,
      first,
      second,
      third,
    );
  }
  function pairWaiting(town: string) {
    for (let ids = match.get(town); ids; ids = match.get(town)) {
      seat(town, Number(ids.a), Number(ids.b), Number(ids.c));
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
      calls: calls(town),
      waiting: waiting.map((o) => publicOffer(o, uid)),
      circles: open.map((r) => circle({ id: Number(r.id), completed: null })),
      recent: recent.map((r) => circle({ id: Number(r.id), completed: Number(r.completed) })),
    };
  }
  const insertOffer = db.prepare(
    'INSERT INTO barterOffers(town,owner,name,give,giveQty,want,wantQty) VALUES(?,?,?,?,?,?,?)',
  );
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
    if (cmd.action === 'inviteBarter') {
      ensure(
        own && own.circle === null && (own.id === cmd.first || own.id === cmd.second),
        'Wezwanie może wywiesić jeden z dwóch wystawców.',
      );
      ensure(
        typeof cmd.first === 'number' &&
          typeof cmd.second === 'number' &&
          Number.isSafeInteger(cmd.first) &&
          Number.isSafeInteger(cmd.second),
        'Wskaż dwie wolne oferty.',
      );
      const free = db.prepare(
        'SELECT * FROM barterOffers WHERE town=? AND id=? AND active=1 AND circle IS NULL',
      );
      const first = free.get(town, cmd.first) as unknown as Row | undefined;
      const second = free.get(town, cmd.second) as unknown as Row | undefined;
      ensure(
        first && second && first.id !== second.id && missingBarterTerms(first, second),
        'Te oferty nie tworzą już wspólnego wezwania.',
      );
      ensure(
        !db
          .prepare('SELECT id FROM barterCalls WHERE postedBy=? OR (first=? AND second=?)')
          .get(own.id, first.id, second.id),
        'Wezwanie już wisi w karczmie.',
      );
      db.prepare('INSERT INTO barterCalls(first,second,postedBy) VALUES(?,?,?)').run(
        first.id,
        second.id,
        own.id,
      );
      return;
    }
    if (cmd.action === 'recallBarterCall' || cmd.action === 'answerBarterCall') {
      ensure(
        typeof cmd.call === 'number' && Number.isSafeInteger(cmd.call),
        'Wskaż wezwanie z tablicy.',
      );
      const call = calls(town).find((n) => n.id === cmd.call);
      ensure(call, 'To wezwanie już wygasło. Towar pozostał w magazynie.');
      if (cmd.action === 'recallBarterCall') {
        ensure(own && call.postedBy === own.id, 'Tylko wystawca może zdjąć wezwanie.');
        db.prepare('DELETE FROM barterCalls WHERE id=?').run(call.id);
        return;
      }
      ensure(!own, 'Na tym placu masz już ofertę.');
      move(me.uid, call.give, -call.giveQty);
      const third = insertOffer.run(
        town,
        me.uid,
        me.displayName,
        call.give,
        call.giveQty,
        call.want,
        call.wantQty,
      );
      seat(town, call.first, call.second, Number(third.lastInsertRowid));
      return;
    }
    if (cmd.action === 'postBarter') {
      ensure(!own, 'Na tym placu masz już ofertę.');
      const { give, giveQty, want, wantQty } = cmd;
      ensure(
        good(give) && good(want) && give !== want && quantity(giveQty) && quantity(wantQty),
        'Wybierz dwa różne towary i pełne ilości od 1 do 99.',
      );
      move(me.uid, give, -giveQty);
      insertOffer.run(town, me.uid, me.displayName, give, giveQty, want, wantQty);
      pairWaiting(town);
      return;
    }
    ensure(own && own.id === cmd.offer, 'Ta oferta nie należy już do ciebie na tym placu.');
    if (cmd.action === 'withdrawBarter') {
      move(me.uid, own.give, own.giveQty);
      dismiss.run(own.id, own.id);
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
  return { book, command, calls };
}
