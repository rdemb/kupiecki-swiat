import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import type {
  Course,
  PilotBook,
  PilotFolio,
  Sounding,
} from '../src/economy/pilotage';
import { keelClearanceCm } from '../src/economy/pilotage';

export function installPilotage(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pilotBank (
      id INTEGER PRIMARY KEY CHECK(id=1), edition INTEGER NOT NULL,
      cm INTEGER NOT NULL, storm INTEGER NOT NULL, lastStorm INTEGER);
    INSERT OR IGNORE INTO pilotBank VALUES (1,1,146,0,NULL);
    CREATE TABLE IF NOT EXISTS pilotLegs (
      voyage INTEGER PRIMARY KEY REFERENCES yardVoyages(id),
      course TEXT NOT NULL CHECK(course IN ('survey','cut')), reference INTEGER);
    CREATE TABLE IF NOT EXISTS pilotSoundings (
      voyage INTEGER PRIMARY KEY REFERENCES yardVoyages(id), edition INTEGER NOT NULL,
      cm INTEGER NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS pilotByTime ON pilotSoundings(at DESC,voyage DESC);
  `);
  const bank = db.prepare(
    'SELECT edition,cm,storm,lastStorm FROM pilotBank WHERE id=1',
  );
  const projection = `SELECT m.voyage,v.ship,s.name AS vessel,v.skipper,m.cm,m.at,m.edition
    FROM pilotSoundings m JOIN yardVoyages v ON v.id=m.voyage JOIN yardShips s ON s.id=v.ship `;
  const order = ' ORDER BY m.at DESC,m.voyage DESC LIMIT 9';
  const recent = db.prepare(projection + order);
  const previous = db.prepare(
    projection +
      'WHERE (m.at,m.voyage) < (SELECT at,voyage FROM pilotSoundings WHERE voyage=?)' +
      order,
  );
  function folio(before?: number): PilotFolio {
    const rows = (before === undefined
      ? recent.all()
      : previous.all(before)) as unknown as Sounding[];
    return { history: rows.slice(0, 8), more: rows.length > 8 };
  }
  function observe(weather: WeatherConditionId, now: number) {
    const row = bank.get()!;
    const storm = weather === 'sztorm_na_zatoce';
    if (storm === Boolean(row.storm)) return;
    if (storm) {
      // Shift the bank once per storm front. A restart in the same storm keeps its bed.
      let depth = randomInt(101, 173);
      if (depth === row.cm) depth++;
      db.prepare(
        'UPDATE pilotBank SET edition=edition+1,cm=?,storm=1,lastStorm=? WHERE id=1',
      ).run(depth, now);
    } else {
      db.prepare('UPDATE pilotBank SET storm=0 WHERE id=1').run();
    }
  }
  function book(): PilotBook {
    const row = bank.get()!;
    const page = folio();
    return {
      edition: Number(row.edition),
      storm: Boolean(row.storm),
      lastStorm: row.lastStorm === null ? null : Number(row.lastStorm),
      latest: page.history[0] ?? null,
      ...page,
    };
  }
  function supports(reference: number) {
    return Boolean(
      db
        .prepare(
          `SELECT 1 FROM pilotSoundings m JOIN pilotBank b
      ON b.edition=m.edition WHERE m.voyage=? AND b.storm=0 AND m.cm>=?`,
        )
        .get(reference, keelClearanceCm),
    );
  }
  function depart(id: number, course: Course, reference: number | null) {
    if (course !== 'outer')
      db.prepare(
        'INSERT INTO pilotLegs(voyage,course,reference) VALUES(?,?,?)',
      ).run(id, course, reference);
  }
  function land(id: number, due: number) {
    db.prepare(
      `INSERT INTO pilotSoundings(voyage,edition,cm,at)
      SELECT l.voyage,b.edition,b.cm,? FROM pilotLegs l CROSS JOIN pilotBank b
      WHERE l.voyage=? AND l.course='survey' AND b.storm=0`,
    ).run(due, id);
  }
  return { observe, book, folio, supports, depart, land };
}
