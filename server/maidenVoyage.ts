import type { DatabaseSync } from 'node:sqlite';
import type { MaidenLetter, MaidenPassage } from '../src/economy/shipyard';

export function maidenRegister(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yardMaidenSignatures (
      ship INTEGER NOT NULL REFERENCES yardShips(id),
      owner TEXT NOT NULL, name TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (ship, owner)
    );
  `);
  // One charter at a time per hull. The first settled charter ignores withdrawn and expired offers.
  const passage = `SELECT s.id AS ship, s.name AS vessel, v.id AS voyage, v.payer, v.skipper,
      v.departed, v.settled, v.barrels, v.teams, COALESCE(l.course, 'outer') AS course
    FROM yardShips s JOIN yardVoyages v ON v.id=(
      SELECT first.id FROM yardVoyages first WHERE first.ship=s.id AND first.settled IS NOT NULL
      ORDER BY first.id LIMIT 1
    ) LEFT JOIN pilotLegs l ON l.voyage=v.id`;
  const forShip = db.prepare(passage + ' WHERE s.id=?');
  const newest = db.prepare(passage + ' ORDER BY v.settled DESC, v.id DESC LIMIT 1');
  const signed = db.prepare('SELECT name,at FROM yardMaidenSignatures WHERE ship=? ORDER BY at,rowid');
  const eligible = db.prepare(`SELECT 1 FROM yardShips s WHERE s.id=? AND
    (s.owner=? OR EXISTS(SELECT 1 FROM yardBuild b WHERE b.ship=s.id AND b.owner=?))
    AND NOT EXISTS(SELECT 1 FROM yardMaidenSignatures w WHERE w.ship=s.id AND w.owner=?)`);
  return {
    latest: () => (newest.get() as unknown as MaidenPassage | undefined) ?? null,
    letter(ship: number, uid: string | null): MaidenLetter | null {
      const first = forShip.get(ship) as unknown as MaidenPassage | undefined;
      if (!first) return null;
      return {
        ...first,
        signatures: signed.all(ship) as unknown as MaidenLetter['signatures'],
        canSign: !!uid && !!eligible.get(ship, uid, uid, uid),
      };
    },
    sign(ship: number, voyage: number, uid: string, name: string, now: number) {
      if (forShip.get(ship)?.voyage !== voyage)
        return 'List można podpisać po powrocie szkuty z pierwszego frachtu.';
      if (!eligible.get(ship, uid, uid, uid))
        return 'Każdy fundator stępki i dostawca budulca może podpisać list jeden raz.';
      db.prepare('INSERT INTO yardMaidenSignatures(ship,owner,name,at) VALUES(?,?,?,?)')
        .run(ship, uid, name, now);
      return null;
    },
  };
}
