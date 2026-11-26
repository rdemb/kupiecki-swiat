import type { DatabaseSync, SQLOutputValue } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import {
  journeySeconds,
  wagonLimit,
  waybillTown,
} from '../src/economy/waybills';

export class WaybillRule extends Error {}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new WaybillRule(message);
}
function positive(n: unknown, limit: number): n is number {
  return (
    typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= limit
  );
}
type Row = Record<string, SQLOutputValue>;
export function wagonHaulingGrain(db: DatabaseSync, uid: string) {
  return !!db
    .prepare("SELECT 1 FROM grainWaybills WHERE driver=? AND status='rolling'")
    .get(uid);
}

export function installWaybills(
  db: DatabaseSync,
  transfer: (uid: string, gold: number, grain: number) => void,
  grind: (city: string, quantity: number) => void,
  bakeUntil: (city: string, time: number) => void,
  weather: () => WeatherConditionId,
  bridgeClosed: (now: number) => boolean,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS grainWaybills(
      id INTEGER PRIMARY KEY, buyer TEXT NOT NULL, buyerName TEXT NOT NULL,
      grower TEXT, growerName TEXT, driver TEXT, driverName TEXT,
      quantity INTEGER NOT NULL, price INTEGER NOT NULL, wage INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open', expires INTEGER NOT NULL, road TEXT, departed INTEGER, due INTEGER);
    CREATE INDEX IF NOT EXISTS waybillArrivals ON grainWaybills(status,due);
    CREATE INDEX IF NOT EXISTS waybillExpiry ON grainWaybills(status,expires);
    CREATE UNIQUE INDEX IF NOT EXISTS waybillCart ON grainWaybills(driver) WHERE status='rolling';
  `);
  const columns =
    'id,buyerName,growerName,driverName,quantity,price,wage,status,expires,road,departed,due,coalesce(buyer=?,0) AS mine';
  const active = db.prepare(
    'SELECT ' +
      columns +
      " FROM grainWaybills WHERE status IN ('open','sealed','rolling') ORDER BY id DESC",
  );
  const receipts = db.prepare(
    'SELECT ' +
      columns +
      " FROM grainWaybills WHERE status='delivered' ORDER BY due DESC,id DESC LIMIT 20",
  );
  function refund(b: Row, state: 'cancelled' | 'expired') {
    transfer(
      String(b.buyer),
      Number(b.quantity) * Number(b.price) + Number(b.wage),
      0,
    );
    if (b.grower !== null) transfer(String(b.grower), 0, Number(b.quantity));
    db.prepare('UPDATE grainWaybills SET status=? WHERE id=?').run(state, b.id);
  }
  function advance(now: number) {
    for (const b of db
      .prepare(
        "SELECT * FROM grainWaybills WHERE status IN ('open','sealed') AND expires<=?",
      )
      .all(now)) {
      refund(b, 'expired');
    }
    // Settle in arrival order, replaying bakery time even after the server was offline.
    for (const b of db
      .prepare(
        "SELECT * FROM grainWaybills WHERE status='rolling' AND due<=? ORDER BY due,id",
      )
      .all(now)) {
      bakeUntil(waybillTown, Number(b.due));
      grind(waybillTown, Number(b.quantity));
      transfer(String(b.grower), Number(b.quantity) * Number(b.price), 0);
      transfer(String(b.driver), Number(b.wage), 0);
      db.prepare("UPDATE grainWaybills SET status='delivered' WHERE id=?").run(
        b.id,
      );
    }
  }
  function command(
    me: { uid: string; displayName: string },
    body: Record<string, unknown>,
    now: number,
  ) {
    const { action, quantity, price, wage, road, bill } = body;
    if (action === 'commission') {
      check(
        positive(quantity, wagonLimit) &&
          positive(price, 1000) &&
          positive(wage, 1000),
        'Podaj 1–20 worków, cenę i osobną zapłatę za kurs (po 1–1000 zł).',
      );
      const count = db
        .prepare(
          "SELECT count(*) AS n FROM grainWaybills WHERE buyer=? AND status IN ('open','sealed','rolling')",
        )
        .get(me.uid);
      check(Number(count?.n) < 3, 'Masz już trzy czynne listy.');
      transfer(me.uid, -quantity * price - wage, 0);
      db.prepare(
        'INSERT INTO grainWaybills(buyer,buyerName,quantity,price,wage,expires) VALUES(?,?,?,?,?,?)',
      ).run(me.uid, me.displayName, quantity, price, wage, now + 86400_000);
      return;
    }
    check(positive(bill, Number.MAX_SAFE_INTEGER), 'Wybierz list przewozowy.');
    const b = db.prepare('SELECT * FROM grainWaybills WHERE id=?').get(bill);
    check(b, 'Taki list nie figuruje w księdze.');
    if (action === 'withdraw') {
      check(
        b.buyer === me.uid && (b.status === 'open' || b.status === 'sealed'),
        'Wystawca może odwołać list do chwili wyjazdu.',
      );
      refund(b, 'cancelled');
    } else if (action === 'seal') {
      check(
        b.status === 'open' && b.buyer !== me.uid,
        'Otwarty list może opieczętować inny kupiec.',
      );
      transfer(me.uid, 0, -Number(b.quantity));
      db.prepare(
        "UPDATE grainWaybills SET status='sealed',grower=?,growerName=? WHERE id=?",
      ).run(me.uid, me.displayName, bill);
    } else if (action === 'depart') {
      check(
        b.status === 'sealed',
        'Wóz musi mieć gotowy, zapieczętowany ładunek.',
      );
      check(
        road === 'bridge' || road === 'detour',
        'Wybierz most lub górny bród.',
      );
      const closed = bridgeClosed(now);
      check(
        road !== 'bridge' || !closed,
        'Most jest zamknięty. Wybierz górny bród.',
      );
      check(
        !wagonHaulingGrain(db, me.uid) &&
          !db.prepare('SELECT 1 FROM freight WHERE carrier=?').get(me.uid) &&
          !db
            .prepare(
              'SELECT 1 FROM bridgeLoads WHERE driver=? AND delivered IS NULL',
            )
            .get(me.uid),
        'Twój wóz jest już na służbie. Zakończ poprzedni kurs.',
      );
      const due =
        now + journeySeconds(Number(b.quantity), weather(), road) * 1000;
      db.prepare(
        "UPDATE grainWaybills SET status='rolling',driver=?,driverName=?,road=?,departed=?,due=? WHERE id=?",
      ).run(me.uid, me.displayName, road, now, due, bill);
    } else throw new WaybillRule('Nieznane polecenie przewozowe.');
  }
  return {
    advance,
    command,
    book(uid: string | null, now: number) {
      return {
        now,
        weather: weather(),
        closed: bridgeClosed(now),
        bills: active.all(uid),
        receipts: receipts.all(uid),
      };
    },
  };
}
