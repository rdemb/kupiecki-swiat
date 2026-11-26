import type { DatabaseSync } from 'node:sqlite';
import {
  feastTowns,
  ovenSeconds,
  type FeastBook,
  type FeastTown,
  type Loaf,
} from '../src/economy/harvestLoaf';
import { journeySeconds, waybillTown } from '../src/economy/waybills';
import type { WeatherConditionId } from '../src/economy/economyEngine';

export class FeastRule extends Error {}
function requireFeast(ok: unknown, message: string): asserts ok {
  if (!ok) throw new FeastRule(message);
}
type Row = Omit<Loaf, 'stage'>;

export function openHarvestFeast(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS harvestLoaves(
      id INTEGER PRIMARY KEY, round INTEGER NOT NULL UNIQUE REFERENCES fieldRounds(id),
      owner TEXT NOT NULL, grower TEXT NOT NULL, founder TEXT NOT NULL, seedLot INTEGER REFERENCES fieldSeedGifts(id),
      baker TEXT, readyAt INTEGER, carrier TEXT, town TEXT, road TEXT, departed INTEGER, arrival INTEGER
    );
    CREATE INDEX IF NOT EXISTS harvestInnTable ON harvestLoaves(town,arrival);
    CREATE TABLE IF NOT EXISTS harvestFlour(
      city TEXT PRIMARY KEY, quarters INTEGER NOT NULL CHECK(quarters BETWEEN 0 AND 3)
    );
    CREATE TABLE IF NOT EXISTS harvestInnVotes(
      id INTEGER PRIMARY KEY, loaf INTEGER NOT NULL REFERENCES harvestLoaves(id), uid TEXT NOT NULL,
      town TEXT NOT NULL, UNIQUE(loaf,uid)
    );
  `);
  const columns =
    'id,round,grower,founder,seedLot,baker,readyAt,carrier,town,road,departed,arrival';
  const latest = db.prepare('SELECT ' + columns + ' FROM harvestLoaves ORDER BY id DESC LIMIT 1');
  const deliveries = db.prepare(
    'SELECT ' +
      columns +
      ' FROM harvestLoaves WHERE town=? AND arrival<=? ORDER BY arrival DESC LIMIT 5',
  );
  const first = db.prepare(
    'SELECT ' +
      columns +
      ' FROM harvestLoaves WHERE town=? AND arrival<=? ORDER BY arrival LIMIT 1',
  );
  const rankedVotes = db.prepare(
    'SELECT town,COUNT(*) count FROM harvestInnVotes WHERE loaf=? GROUP BY town ORDER BY count DESC, MIN(id)',
  );
  const individualVote = db.prepare('SELECT town FROM harvestInnVotes WHERE loaf=? AND uid=?');
  function describe(row: Row, now: number): Loaf {
    const stage =
      row.arrival !== null
        ? now >= row.arrival
          ? 'served'
          : 'cart'
        : row.readyAt !== null
          ? now >= row.readyAt
            ? 'ready'
            : 'oven'
          : 'flour';
    return { ...row, stage };
  }
  function used(round: number, uid: string) {
    return !!db.prepare('SELECT 1 FROM harvestLoaves WHERE round=? AND owner=?').get(round, uid);
  }
  function book(uid: string | null, round: number, now: number): FeastBook {
    const row = latest.get() as unknown as Row | undefined;
    const votes = row ? (rankedVotes.all(row.id) as unknown as FeastBook['votes']) : [];
    return {
      now,
      publicQuarters: Number(
        db.prepare('SELECT quarters FROM harvestFlour WHERE city=?').get(waybillTown)?.quarters ??
          0,
      ),
      latest: row ? describe(row, now) : null,
      alreadyMilled: row?.round === round,
      votes,
      leading: votes[0]?.town ?? null,
      choice: uid && row ? ((individualVote.get(row.id, uid)?.town as FeastTown) ?? null) : null,
    };
  }
  function table(town: string, now: number): Loaf[] {
    const rows = deliveries.all(town, now) as unknown as Row[];
    if (rows.length === 5) {
      const founder = first.get(town, now) as unknown as Row;
      if (founder.id !== rows[4].id) rows.push(founder);
    }
    return rows.map((r) => describe(r, now));
  }
  // The field has verified a paid harvest share. Of its three quarter-measures,
  // one is sealed for the baker. Two join the city's flour stock.
  function mill(
    round: number,
    uid: string,
    name: string,
    now: number,
    transfer: (uid: string, gold: number, grain: number) => void,
  ) {
    const b = book(uid, round, now);
    requireFeast(
      !b.alreadyMilled && (!b.latest || b.latest.stage === 'served'),
      'Wieś już przeznaczyła ziarno na ten wypiek albo czeka na poprzednią dostawę.',
    );
    const parent = db
      .prepare(
        'SELECT id,founder FROM fieldSeedGifts WHERE target=? AND receiver=? AND sownDay IS NOT NULL',
      )
      .get(round, uid);
    transfer(uid, 0, -1);
    const surplus = b.publicQuarters + 2;
    if (surplus >= 4) db.prepare('UPDATE mills SET flour=flour+1 WHERE city=?').run(waybillTown);
    db.prepare(
      'INSERT INTO harvestFlour(city,quarters) VALUES(?,?) ON CONFLICT(city) DO UPDATE SET quarters=excluded.quarters',
    ).run(waybillTown, surplus % 4);
    db.prepare(
      'INSERT INTO harvestLoaves(round,owner,grower,founder,seedLot) VALUES(?,?,?,?,?)',
    ).run(round, uid, name, parent?.founder ?? name, parent?.id ?? null);
  }
  function command(
    uid: string,
    name: string,
    cmd: Record<string, unknown>,
    now: number,
    weather: WeatherConditionId,
    bridgeClosed: (now: number) => boolean,
  ) {
    const b = book(uid, 0, now),
      loaf = b.latest;
    requireFeast(
      loaf && cmd.loaf === loaf.id,
      'Ten dokument dotyczy innego wypieku. Odśwież młyn.',
    );
    if (cmd.action === 'bakeHarvestLoaf') {
      requireFeast(loaf.stage === 'flour', 'Ta mąka trafiła już do pieca.');
      db.prepare('UPDATE harvestLoaves SET baker=?,readyAt=? WHERE id=?').run(
        name,
        now + ovenSeconds * 1000,
        loaf.id,
      );
      return;
    }
    const town = cmd.town as FeastTown;
    requireFeast(feastTowns.includes(town), 'Wybierz karczmę przy trakcie.');
    if (cmd.action === 'voteHarvestInn') {
      requireFeast(loaf.arrival === null, 'Karawana jest już w drodze.');
      if (b.choice !== town) {
        // A changed vote takes its new place in the tie-break order.
        db.prepare('DELETE FROM harvestInnVotes WHERE loaf=? AND uid=?').run(loaf.id, uid);
        db.prepare('INSERT INTO harvestInnVotes(loaf,uid,town) VALUES(?,?,?)').run(
          loaf.id,
          uid,
          town,
        );
      }
      return;
    }
    requireFeast(
      cmd.action === 'carryHarvestLoaf' && loaf.stage === 'ready',
      'Poczekaj na gotowy bochen i wolny wóz.',
    );
    requireFeast(town === b.leading, 'Cel musi zgadzać się z aktualnym wynikiem głosowania.');
    const road = bridgeClosed(now) ? 'detour' : 'bridge';
    const seconds = journeySeconds(1, weather, road) + (town === 'zelazna_kuznia' ? 15 : 0);
    db.prepare(
      'UPDATE harvestLoaves SET carrier=?,town=?,road=?,departed=?,arrival=? WHERE id=?',
    ).run(name, town, road, now, now + seconds * 1000, loaf.id);
  }
  return { used, book, table, mill, command };
}
