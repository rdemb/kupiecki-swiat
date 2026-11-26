import type { DatabaseSync } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import { cropPoints, fieldRules as rules, type FieldBook, type FieldStage } from '../src/economy/commonField';

import { openSeedChest } from './seedChest';

export class FieldRule extends Error {}
function requireField(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new FieldRule(reason);
}
type Round = {id: number; sown: number | null; harvested: number | null; observations: number; lastDay: number | null};
type Transfer = (uid: string, gold: number, grain: number) => void;
function stage(r: Round): FieldStage {
  if (r.harvested !== null) return 'stubble';
  if (r.observations >= 3) return 'gold';
  return r.observations >= 1 ? 'green' : 'earth';
}
export function openCommonField(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fieldRounds(id INTEGER PRIMARY KEY, sown INTEGER, harvested INTEGER, observations INTEGER NOT NULL DEFAULT 0, lastDay INTEGER, yield INTEGER);
    CREATE TABLE IF NOT EXISTS fieldGrowers(id INTEGER PRIMARY KEY, round INTEGER NOT NULL, uid TEXT NOT NULL, seed INTEGER NOT NULL CHECK(seed>0), voted INTEGER NOT NULL DEFAULT 0, share INTEGER, UNIQUE(round,uid));
    CREATE TABLE IF NOT EXISTS fieldDays(round INTEGER NOT NULL, day INTEGER NOT NULL, weather TEXT NOT NULL, points INTEGER NOT NULL, PRIMARY KEY(round,day));
    INSERT OR IGNORE INTO fieldRounds(id) VALUES(1);
  `);
  const chest = openSeedChest(db);
  const latest = db.prepare('SELECT * FROM fieldRounds ORDER BY id DESC LIMIT 1');
  const current = () => latest.get() as unknown as Round;
  const totals = db.prepare('SELECT COALESCE(SUM(seed),0) total, COUNT(*) growers, COALESCE(SUM(voted),0) votes FROM fieldGrowers WHERE round=?');
  const participant = db.prepare('SELECT seed,voted FROM fieldGrowers WHERE round=? AND uid=?');
  const notes = db.prepare('SELECT day,weather,points FROM fieldDays WHERE round=? ORDER BY day');
  const harvest = db.prepare('SELECT id,harvested,yield FROM fieldRounds WHERE harvested IS NOT NULL ORDER BY id DESC LIMIT 1');

  // Caller owns the same transaction as the wallet and the signed document.
  function advance(day: number, weather: WeatherConditionId, transfer: Transfer) {
    const r = current();
    if (r.harvested !== null) {
      if (day >= r.harvested + rules.restDays) db.exec('INSERT INTO fieldRounds DEFAULT VALUES');
      return;
    }
    if (r.sown === null || day <= (r.lastDay ?? r.sown)) return;
    const points = cropPoints(weather, r.observations + 1);
    db.prepare('INSERT INTO fieldDays VALUES(?,?,?,?)').run(r.id, day, weather, points);
    db.prepare('UPDATE fieldRounds SET observations=observations+1,lastDay=? WHERE id=?').run(day,r.id);
    if (r.observations + 1 < rules.growthDays) return;

    const score = Number(db.prepare('SELECT SUM(points) AS n FROM fieldDays WHERE round=?').get(r.id)!.n);
    const plots = db.prepare('SELECT id,uid,seed FROM fieldGrowers WHERE round=? ORDER BY id').all(r.id).map(g => {
      const quarters = Number(g.seed) * score;
      return { id:Number(g.id), uid:String(g.uid), quarters, sacks:Math.floor(quarters / rules.growthDays) };
    });
    const yieldSacks = Math.floor(plots.reduce((sum,p) => sum + p.quarters, 0) / rules.growthDays);
    const extra = yieldSacks - plots.reduce((sum,p) => sum + p.sacks, 0);
    plots.sort((a,b) => (b.quarters % rules.growthDays) - (a.quarters % rules.growthDays) || a.id - b.id);
    for (const [i,p] of plots.entries()) {
      const share = p.sacks + Number(i < extra);
      if (share > 0) transfer(p.uid, 0, share);
      db.prepare('UPDATE fieldGrowers SET share=? WHERE id=?').run(share, p.id);
    }
    db.prepare('UPDATE fieldRounds SET harvested=?,yield=? WHERE id=?').run(day,yieldSacks,r.id);
  }

  function command(uid: string, name: string, c: Record<string,unknown>, day: number, transfer: Transfer) {
    const r = current();
    requireField(c.round === r.id, 'Księga dotyczy już innego zasiewu. Odśwież pole.');
    const target = r.harvested === null ? r.id : r.id + 1;
    if (c.action === 'offerHarvestSeed' || c.action === 'recallHarvestSeed') {
      requireField(r.sown === null || r.harvested !== null, 'Poczekaj na żniwa.');
      if (c.action === 'offerHarvestSeed') {
        requireField(chest.offer(uid, name, target, transfer), 'Możesz przekazać jeden worek po własnych udanych żniwach.');
      } else {
        requireField(typeof c.lot === 'number' && Number.isSafeInteger(c.lot) && chest.recall(uid, target, c.lot, transfer), 'Ten worek został już podjęty albo należy do innego gospodarza.');
      }
      return;
    }
    requireField(r.sown === null, 'Ten zasiew jest zamknięty. Odśwież księgę pola.');
    const seed = Number(participant.get(r.id, uid)?.seed ?? 0);
    if (c.action === 'bringSeed' || c.action === 'acceptHarvestSeed') {
      const gift = c.action === 'acceptHarvestSeed';
      const qty = gift ? 1 : c.quantity;
      requireField(typeof qty === 'number' && Number.isSafeInteger(qty) && qty > 0 && seed + qty <= rules.perMerchant, 'Na kupca przypadają najwyżej cztery worki na zasiew.');
      requireField(Number(totals.get(r.id)!.total) + qty <= rules.capacity, 'Na polu brakuje miejsca na tyle ziarna.');
      if (gift) {
        requireField(typeof c.lot === 'number' && Number.isSafeInteger(c.lot) && chest.reserve(uid, name, target, c.lot), 'Wybierz dostępny worek sąsiada. Na gospodarza przypada jeden dar.');
      } else transfer(uid, 0, -qty);
      db.prepare('INSERT INTO fieldGrowers(round,uid,seed) VALUES(?,?,?) ON CONFLICT(round,uid) DO UPDATE SET seed=seed+excluded.seed').run(r.id,uid,qty);
    } else {
      requireField(seed > 0, 'Najpierw przynieś własne ziarno.');
      if (c.action === 'takeSeed') {
        const ownSeed = seed - chest.release(uid, target);
        if (ownSeed > 0) transfer(uid, 0, ownSeed);
        db.prepare('DELETE FROM fieldGrowers WHERE round=? AND uid=?').run(r.id,uid);
      } else {
        requireField(c.action === 'voteSow' || c.action === 'holdSow', 'Nieznana decyzja o zasiewie.');
        db.prepare('UPDATE fieldGrowers SET voted=? WHERE round=? AND uid=?').run(c.action === 'voteSow' ? 1 : 0, r.id,uid);
      }
    }
    const t = totals.get(r.id)!;
    if (Number(t.votes) * 2 > Number(t.growers)) {
      chest.sow(target, day, transfer);
      db.prepare('UPDATE fieldRounds SET sown=?,lastDay=? WHERE id=?').run(day,day,r.id);
    }
  }

  function book(uid: string | null, day: number, weather: WeatherConditionId): FieldBook {
    const r = current(), t = totals.get(r.id)!;
    const mine = uid === null ? null : participant.get(r.id,uid);
    const h = harvest.get();
    const share = h && uid ? db.prepare('SELECT share FROM fieldGrowers WHERE round=? AND uid=?').get(h.id,uid) : null;
    return {
      round:r.id, day, weather, stage:stage(r), sown:r.sown, harvested:r.harvested,
      total:Number(t.total), growers:Number(t.growers), votes:Number(t.votes),
      journal:notes.all(r.id) as unknown as FieldBook['journal'],
      mine:uid === null ? null : {seed:Number(mine?.seed ?? 0), voted:!!mine?.voted},
      chest:chest.book(uid, r.harvested === null ? r.id : r.id + 1, r.sown === null || r.harvested !== null),
      lastHarvest:h ? {day:Number(h.harvested), seed:Number(totals.get(h.id)!.total), yield:Number(h.yield), myShare:share ? Number(share.share) : null} : null,
    };
  }
  return { advance, command, book, seedRoute:chest.route, landscape: () => stage(current()) };
}
