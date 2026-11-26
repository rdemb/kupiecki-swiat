import type { DatabaseSync } from 'node:sqlite';
import { lighterLoad } from '../src/economy/pilotage';
import {
  shipRules,
  type LighterOffer,
  type YardBook,
} from '../src/economy/shipyard';
import { PilotRule } from './pilotage';

type Merchant = { uid: string; displayName: string; gold: number };

export function installLighters(
  db: DatabaseSync,
  gold: (uid: string, delta: number) => void,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yardLighters(
      id INTEGER PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL,
      fee INTEGER NOT NULL CHECK(fee BETWEEN 1 AND ${shipRules.wage}), expires INTEGER NOT NULL,
      voyage INTEGER UNIQUE REFERENCES yardVoyages(id), barrels INTEGER CHECK(barrels BETWEEN 1 AND 2),
      closed INTEGER, CHECK((voyage IS NULL) = (barrels IS NULL)));
    CREATE UNIQUE INDEX IF NOT EXISTS yardOneLighter ON yardLighters(owner) WHERE closed IS NULL;
    CREATE INDEX IF NOT EXISTS yardLighterBerths ON yardLighters(fee,id) WHERE closed IS NULL AND voyage IS NULL;
  `);
  const afloat = db.prepare(`SELECT s.name AS vessel,v.due AS until,
      CASE WHEN v.captain=? THEN 'skipper' ELSE 'lighter' END AS role,
      CASE WHEN v.captain=? THEN v.wage-COALESCE(l.fee,0) ELSE l.fee END AS fee
    FROM yardVoyages v JOIN yardShips s ON s.id=v.ship
    LEFT JOIN yardLighters l ON l.voyage=v.id
    WHERE v.closed=0 AND v.departed IS NOT NULL AND (v.captain=? OR l.owner=?) LIMIT 1`);
  function duty(uid: string) {
    return (
      (afloat.get(uid, uid, uid, uid) as unknown as NonNullable<
        YardBook['wallet']
      >['duty']) ?? null
    );
  }
  function requireAshore(uid: string) {
    if (duty(uid))
      throw new PilotRule(
        'Masz już wachtę na wodzie. Poczekaj na powrót do portu.',
      );
  }
  function offers(uid: string | null) {
    return db
      .prepare(
        `SELECT id,name,fee,expires,owner=? AS own FROM yardLighters
      WHERE closed IS NULL AND voyage IS NULL ORDER BY fee,id`,
      )
      .all(uid)
      .map((row) => ({
        ...row,
        own: Boolean(row.own),
      })) as unknown as LighterOffer[];
  }
  function post(me: Merchant, fee: unknown, now: number) {
    if (
      typeof fee !== 'number' ||
      !Number.isInteger(fee) ||
      fee < 1 ||
      fee > shipRules.wage
    )
      throw new PilotRule(
        'Wybierz cenę od 1 do ' + shipRules.wage + ' monet za całą przeprawę.',
      );
    requireAshore(me.uid);
    if (
      db
        .prepare('SELECT 1 FROM yardLighters WHERE owner=? AND closed IS NULL')
        .get(me.uid)
    )
      throw new PilotRule('Twoja lichtuga ma już ofertę na kei.');
    db.prepare(
      'INSERT INTO yardLighters(owner,name,fee,expires) VALUES(?,?,?,?)',
    ).run(me.uid, me.displayName, fee, now + shipRules.hiringMs);
  }
  function recall(uid: string, offer: number, now: number) {
    if (
      !db
        .prepare(
          'UPDATE yardLighters SET closed=? WHERE id=? AND owner=? AND closed IS NULL AND voyage IS NULL',
        )
        .run(now, offer, uid).changes
    )
      throw new PilotRule(
        'Możesz wycofać tylko własną ofertę czekającą na kei.',
      );
  }
  function embark(me: Merchant, voyage: number, offer: number, ref: number) {
    const m = db
      .prepare(
        `SELECT m.cm FROM pilotSoundings m JOIN pilotBank b ON b.edition=m.edition
      WHERE m.voyage=? AND b.storm=0`,
      )
      .get(ref);
    const barrels = m ? lighterLoad(Number(m.cm)) : null;
    if (!barrels)
      throw new PilotRule(
        'Ten pomiar nie uzasadnia przeprawy z lichtugą. Sprawdź wpis pilotów.',
      );
    const l = db
      .prepare(
        'SELECT owner,fee FROM yardLighters WHERE id=? AND closed IS NULL AND voyage IS NULL',
      )
      .get(offer);
    if (!l) throw new PilotRule('Ta lichtuga nie czeka już na kei.');
    if (l.owner === me.uid)
      throw new PilotRule('Szkuta i lichtuga potrzebują dwóch różnych osób.');
    requireAshore(String(l.owner));
    if (me.gold < Number(l.fee))
      throw new PilotRule('Brakuje złota na zapłatę dla przewoźnika.');
    gold(me.uid, -Number(l.fee));
    db.prepare('UPDATE yardLighters SET barrels=?,voyage=? WHERE id=?').run(
      barrels,
      voyage,
      offer,
    );
    return barrels;
  }
  function offDuty(uid: string, now: number) {
    db.prepare(
      'UPDATE yardLighters SET closed=? WHERE owner=? AND closed IS NULL AND voyage IS NULL',
    ).run(now, uid);
  }
  function land(voyage: number, due: number) {
    const receipt = db
      .prepare(
        'UPDATE yardLighters SET closed=? WHERE voyage=? AND closed IS NULL RETURNING owner,fee',
      )
      .get(due, voyage);
    if (receipt) gold(String(receipt.owner), Number(receipt.fee));
  }
  function expire(now: number) {
    db.prepare(
      'UPDATE yardLighters SET closed=? WHERE voyage IS NULL AND closed IS NULL AND expires<=?',
    ).run(now, now);
  }
  return {
    offers,
    duty,
    post,
    recall,
    embark,
    land,
    expire,
    requireAshore,
    offDuty,
  };
}
