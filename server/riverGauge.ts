import type { DatabaseSync } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import {
  boardDuration,
  freshFor,
  readingInterval,
  riverAfter,
  type RiverReading,
} from '../src/economy/river';

export function installRiverGauge(db: DatabaseSync, sky: WeatherConditionId) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS riverGauge(id INTEGER PRIMARY KEY CHECK(id=1),level INTEGER NOT NULL,sampled INTEGER NOT NULL,sky TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS riverReadings(id INTEGER PRIMARY KEY AUTOINCREMENT,uid TEXT NOT NULL,name TEXT NOT NULL,at INTEGER NOT NULL,cm INTEGER NOT NULL,previousAt INTEGER,previousCm INTEGER,posted INTEGER);
    CREATE INDEX IF NOT EXISTS riverByReader ON riverReadings(uid,id DESC);
    CREATE INDEX IF NOT EXISTS riverBoard ON riverReadings(at DESC) WHERE posted IS NOT NULL;
  `);
  // Resume the last recorded waterline. The shared clock pauses while the server is offline.
  db.prepare(
    `INSERT INTO riverGauge VALUES(1,100000,?,?) ON CONFLICT(id) DO UPDATE SET sampled=excluded.sampled,sky=excluded.sky`,
  ).run(Date.now(), sky);
  const gauge = db.prepare(
    'SELECT level,sampled,sky FROM riverGauge WHERE id=1',
  );
  const anchor = db.prepare(
    'UPDATE riverGauge SET level=?,sampled=?,sky=? WHERE id=1',
  );
  const columns = 'id,name,at,cm,previousAt,previousCm,posted';
  const latest = db.prepare(
    'SELECT ' +
      columns +
      ' FROM riverReadings WHERE uid=? ORDER BY id DESC LIMIT 1',
  );
  function personal(uid: string | null) {
    return uid
      ? ((latest.get(uid) as unknown as RiverReading | undefined) ?? null)
      : null;
  }
  function advance(
    now: number,
    weather: WeatherConditionId,
    checkpoint: boolean,
  ) {
    const last = gauge.get()!;
    const since = Number(last.sampled);
    const current = riverAfter(
      Number(last.level),
      since,
      last.sky as WeatherConditionId,
      now,
    );
    if (checkpoint || weather !== last.sky)
      anchor.run(current.level, Math.max(now, since), weather);
    return current;
  }
  function measure(uid: string, name: string, level: number, now: number) {
    const previous = personal(uid);
    if (previous && now - previous.at < readingInterval) return;
    db.prepare(
      'INSERT INTO riverReadings(uid,name,at,cm,previousAt,previousCm) VALUES(?,?,?,?,?,?)',
    ).run(
      uid,
      name,
      now,
      Math.floor(level / 1000),
      previous?.at ?? null,
      previous?.cm ?? null,
    );
    // Keep the latest private snapshot and the reports still on the board.
    db.prepare(
      'DELETE FROM riverReadings WHERE uid=? AND id<>(SELECT MAX(id) FROM riverReadings WHERE uid=?) AND (posted IS NULL OR at<=?)',
    ).run(uid, uid, now - boardDuration);
  }
  function publish(uid: string, id: number, now: number) {
    const own = personal(uid);
    if (!own || own.id !== id) return false;
    if (own.posted !== null) return true;
    if (now - own.at >= freshFor) return false;
    db.prepare('UPDATE riverReadings SET posted=? WHERE id=? AND uid=?').run(
      now,
      id,
      uid,
    );
    return true;
  }
  function reports(now: number) {
    // The tavern compares public marks only. A merchant's earlier notebook stays private.
    return db
      .prepare(
        `SELECT id,name,at,cm,posted,
        LAG(at) OVER river AS previousAt, LAG(cm) OVER river AS previousCm
      FROM riverReadings WHERE posted IS NOT NULL AND at>?
      WINDOW river AS (ORDER BY at,id) ORDER BY at DESC,id DESC LIMIT 8`,
      )
      .all(now - boardDuration) as unknown as RiverReading[];
  }
  return { advance, personal, measure, publish, reports };
}
