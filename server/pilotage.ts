import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import type {
  Course,
  PilotBook,
  PilotFolio,
  Sounding,
  SoundingFund,
} from '../src/economy/pilotage';
import { keelClearanceCm, maxSoundingPledge } from '../src/economy/pilotage';

export class PilotRule extends Error {}
export function installPilotage(
  db: DatabaseSync,
  gold: (uid: string, delta: number) => void,
) {
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
    CREATE TABLE IF NOT EXISTS pilotPledges (
      edition INTEGER NOT NULL, sponsor TEXT NOT NULL, name TEXT NOT NULL,
      amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND ${maxSoundingPledge}), nonce TEXT NOT NULL,
      offered INTEGER NOT NULL, closed INTEGER, voyage INTEGER REFERENCES pilotSoundings(voyage),
      PRIMARY KEY(edition,sponsor), UNIQUE(sponsor,nonce));
    CREATE INDEX IF NOT EXISTS pilotByVoyage ON pilotPledges(voyage);
    CREATE INDEX IF NOT EXISTS pilotClosed ON pilotPledges(edition DESC) WHERE closed IS NOT NULL;
    CREATE INDEX IF NOT EXISTS pilotByEdition ON pilotSoundings(edition);
    CREATE INDEX IF NOT EXISTS pilotByTime ON pilotSoundings(at DESC,voyage DESC);
  `);
  const bank = db.prepare(
    'SELECT edition,cm,storm,lastStorm FROM pilotBank WHERE id=1',
  );
  const projection = `SELECT m.voyage,v.ship,s.name AS vessel,v.skipper,m.cm,m.at,m.edition,
    COALESCE((SELECT SUM(amount) FROM pilotPledges WHERE voyage=m.voyage),0) AS reward
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
  const openPledges = db.prepare(
    'SELECT sponsor,name,amount FROM pilotPledges WHERE edition=? AND closed IS NULL ORDER BY offered,rowid',
  );
  const latestSettlement = db.prepare(`
    SELECT SUM(p.amount) AS total,p.closed AS at,v.skipper,m.cm
    FROM pilotPledges p LEFT JOIN pilotSoundings m ON m.voyage=p.voyage
    LEFT JOIN yardVoyages v ON v.id=m.voyage
    WHERE p.edition=(SELECT MAX(edition) FROM pilotPledges WHERE closed IS NOT NULL)
      AND p.closed IS NOT NULL GROUP BY p.edition,p.closed,v.skipper,m.cm`);
  function fund(edition: number, uid?: string | null): SoundingFund {
    const offers = openPledges.all(edition);
    return {
      total: offers.reduce((n, p) => n + Number(p.amount), 0),
      patrons: offers.map((p) => ({
        name: String(p.name),
        amount: Number(p.amount),
      })),
      mine: Number(offers.find((p) => p.sponsor === uid)?.amount ?? 0),
      last: (latestSettlement.get() as unknown as SoundingFund['last']) ?? null,
    };
  }
  function pledge(
    me: { uid: string; displayName: string; gold: number },
    edition: number,
    amount: number,
    nonce: string,
    now: number,
  ) {
    const prior = db
      .prepare(
        'SELECT edition,amount FROM pilotPledges WHERE sponsor=? AND nonce=?',
      )
      .get(me.uid, nonce);
    if (prior) {
      if (prior.edition !== edition || prior.amount !== amount)
        throw new PilotRule('Ten kwit wystawiono już na inną wpłatę.');
      return;
    }
    const row = bank.get()!;
    if (row.edition !== edition || row.lastStorm === null)
      throw new PilotRule(
        'To zlecenie dotyczy innego sztormu. Odczytaj ponownie tablicę.',
      );
    if (
      db
        .prepare('SELECT 1 FROM pilotSoundings WHERE edition=? LIMIT 1')
        .get(edition)
    )
      throw new PilotRule('Pierwszy pomiar już dotarł do karczmy.');
    if (
      db
        .prepare('SELECT 1 FROM pilotPledges WHERE edition=? AND sponsor=?')
        .get(edition, me.uid)
    )
      throw new PilotRule('Twoje złoto jest już w tej sakwie.');
    if (me.gold < amount)
      throw new PilotRule('W sakwie kupca brakuje złota na tę nagrodę.');
    gold(me.uid, -amount);
    db.prepare(
      'INSERT INTO pilotPledges(edition,sponsor,name,amount,nonce,offered) VALUES(?,?,?,?,?,?)',
    ).run(edition, me.uid, me.displayName, amount, nonce, now);
  }
  function observe(weather: WeatherConditionId, now: number) {
    const row = bank.get()!;
    const storm = weather === 'sztorm_na_zatoce';
    if (storm === Boolean(row.storm)) return;
    if (storm) {
      for (const p of openPledges.all(row.edition))
        gold(String(p.sponsor), Number(p.amount));
      db.prepare(
        'UPDATE pilotPledges SET closed=? WHERE edition=? AND closed IS NULL',
      ).run(now, row.edition);
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
  function book(uid?: string | null): PilotBook {
    const row = bank.get()!;
    const page = folio();
    return {
      edition: Number(row.edition),
      fund: fund(Number(row.edition), uid),
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
    const inserted = db
      .prepare(
        `INSERT INTO pilotSoundings(voyage,edition,cm,at)
      SELECT l.voyage,b.edition,b.cm,? FROM pilotLegs l CROSS JOIN pilotBank b
      WHERE l.voyage=? AND l.course='survey' AND b.storm=0`,
      )
      .run(due, id);
    if (inserted.changes) {
      const result = db
        .prepare(
          `SELECT SUM(p.amount) AS total,v.captain,m.edition
        FROM pilotSoundings m JOIN yardVoyages v ON v.id=m.voyage
        JOIN pilotPledges p ON p.edition=m.edition AND p.closed IS NULL
        WHERE m.voyage=? GROUP BY v.captain,m.edition`,
        )
        .get(id);
      if (result) {
        gold(String(result.captain), Number(result.total));
        db.prepare(
          'UPDATE pilotPledges SET closed=?,voyage=? WHERE edition=? AND closed IS NULL',
        ).run(due, id, result.edition);
      }
    }
  }
  return { observe, book, folio, supports, depart, land, pledge };
}
