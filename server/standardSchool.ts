import type { DatabaseSync } from 'node:sqlite';
import type { Passage } from '../src/economy/bridge';
import type { FeastTown } from '../src/economy/harvestLoaf';
import type { RoadGuide, RoadRecord } from '../src/economy/standardSchool';
import { validRecruitName } from '../src/economy/standardSchool';
import { otherPost } from '../src/economy/garrison';
import { FeastRule } from './harvestLoaf';

export function openStandardSchool(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roadSquires(
      id INTEGER PRIMARY KEY, owner TEXT NOT NULL, town TEXT NOT NULL, name TEXT NOT NULL,
      UNIQUE(owner,town)
    );
    CREATE TABLE IF NOT EXISTS schoolWagons(
      id INTEGER PRIMARY KEY, guide INTEGER NOT NULL REFERENCES roadSquires(id), driver TEXT NOT NULL,
      origin TEXT NOT NULL, destination TEXT NOT NULL, road TEXT NOT NULL, mentor TEXT NOT NULL,
      lesson INTEGER NOT NULL, arrival INTEGER NOT NULL, returns INTEGER NOT NULL, delivered INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS schoolGuideTrips ON schoolWagons(guide,returns);
    CREATE INDEX IF NOT EXISTS schoolLoadsDue ON schoolWagons(delivered,arrival);
    CREATE INDEX IF NOT EXISTS schoolWagonDriver ON schoolWagons(driver,arrival);
    CREATE INDEX IF NOT EXISTS schoolInnLedger ON schoolWagons(destination,arrival);
  `);
  const roster = db.prepare(`
    SELECT s.id,s.name,s.owner=? AS own,json_extract(p.profile,'$.displayName') AS captain
    FROM roadSquires s JOIN players p ON json_extract(p.profile,'$.uid')=s.owner
    WHERE s.town=? AND (s.owner=? OR (json_extract(p.profile,'$.guildId')<>'' AND
      json_extract(p.profile,'$.guildId')=(SELECT json_extract(profile,'$.guildId') FROM players WHERE json_extract(profile,'$.uid')=?)))
    ORDER BY own DESC,s.id`);
  const lessons = db.prepare('SELECT road,mentor FROM schoolWagons WHERE guide=? AND lesson=1 AND returns<=? ORDER BY id');
  const away = db.prepare('SELECT road,arrival,returns FROM schoolWagons WHERE guide=? AND returns>? ORDER BY returns DESC LIMIT 1');
  function guides(town: FeastTown, uid: string, now: number): RoadGuide[] {
    return roster.all(uid,town,uid,uid).map(row => ({
      id: Number(row.id), name: String(row.name), own: !!row.own, captain: String(row.captain),
      learned: lessons.all(row.id,now) as unknown as RoadGuide['learned'],
      trip: (away.get(row.id,now) as unknown as RoadGuide['trip']) ?? null,
    }));
  }
  const log = db.prepare(`SELECT w.id,s.name,w.mentor,w.road,w.origin,w.arrival,w.lesson
    FROM schoolWagons w JOIN roadSquires s ON s.id=w.guide
    WHERE w.destination=? AND w.arrival<=? ORDER BY w.arrival DESC,w.id DESC LIMIT 8`);
  function records(town: string, now: number): RoadRecord[] {
    return log.all(town,now).map(r => ({ ...r, lesson: !!r.lesson })) as unknown as RoadRecord[];
  }
  function enrol(town: FeastTown, uid: string, raw: unknown) {
    const name = typeof raw === 'string' ? raw.normalize('NFC').trim() : '';
    if (!validRecruitName(name)) throw new FeastRule('Wpisz imię rekruta od 2 do 28 znaków.');
    if (db.prepare('SELECT id FROM roadSquires WHERE owner=? AND town=?').get(uid,town))
      throw new FeastRule('Masz już ucznia w tym garnizonie.');
    db.prepare('INSERT INTO roadSquires(owner,town,name) VALUES(?,?,?)').run(uid,town,name);
  }
  function depart(town: FeastTown, uid: string, guide: number, road: Passage, mentor: string,
                  lesson: boolean, now: number, seconds: number) {
    const arrival = now + seconds * 1000;
    const returns = arrival + seconds * 1000;
    db.prepare(`INSERT INTO schoolWagons(guide,driver,origin,destination,road,mentor,lesson,arrival,returns)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(guide,uid,town,otherPost(town),road,mentor,Number(lesson),arrival,returns);
    return returns;
  }
  const deliveries = db.prepare(`SELECT w.id,w.destination,s.name FROM schoolWagons w
    JOIN roadSquires s ON s.id=w.guide WHERE w.delivered=0 AND w.arrival<=? ORDER BY w.arrival,w.id`);
  const stock = db.prepare(`INSERT INTO garrisonKitchens(town,portions,carrier,sacks) VALUES(?,2,?,1)
    ON CONFLICT(town) DO UPDATE SET portions=portions+2,carrier=excluded.carrier,sacks=1`);
  const delivered = db.prepare('UPDATE schoolWagons SET delivered=1 WHERE id=?');
  function advance(now: number) {
    for (const row of deliveries.all(now)) {
      stock.run(row.destination,row.name);
      delivered.run(row.id);
    }
  }
  return { enrol, depart, advance, guides, records };
}
