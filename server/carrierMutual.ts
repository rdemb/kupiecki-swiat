import type { DatabaseSync } from 'node:sqlite';
import { detourSeconds } from '../src/economy/bridge';
import { check, positive } from './waybillRules';

// Called in the same SQLite transaction as the destruction of the bridge.
// A cart at the crossing at this instant has already reached the far bank.
export function divertCarts(db: DatabaseSync, cycle: number, now: number) {
  db.prepare(
    `UPDATE grainCrossings SET floodAt=?, floodCycle=?
    WHERE floodAt IS NULL AND crosses>? AND bill IN
    (SELECT id FROM grainWaybills WHERE status='rolling' AND road='bridge' AND departed<=?)`,
  ).run(now, cycle, now, now);
  db.prepare(
    `UPDATE grainWaybills SET road='detour', due=due+?
    WHERE road='bridge' AND id IN (SELECT bill FROM grainCrossings WHERE floodCycle=?)`,
  ).run(detourSeconds * 1000, cycle);
}

export function installCarrierMutual(
  db: DatabaseSync,
  transfer: (uid: string, gold: number, grain: number) => void,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS grainCrossings(bill INTEGER PRIMARY KEY, crosses INTEGER NOT NULL, floodAt INTEGER, floodCycle INTEGER);
    CREATE INDEX IF NOT EXISTS pendingCrossings ON grainCrossings(crosses) WHERE floodAt IS NULL;
    CREATE INDEX IF NOT EXISTS riverLosses ON grainCrossings(floodCycle) WHERE floodCycle IS NOT NULL;
    CREATE TABLE IF NOT EXISTS mutualQuotes(id INTEGER PRIMARY KEY, guild TEXT NOT NULL, fee INTEGER NOT NULL, cover INTEGER NOT NULL, active INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS liveMutualQuote ON mutualQuotes(guild) WHERE active=1;
    CREATE TABLE IF NOT EXISTS mutualCapital(guild TEXT NOT NULL, owner TEXT NOT NULL, free INTEGER NOT NULL CHECK(free>=0), PRIMARY KEY(guild,owner));
    CREATE TABLE IF NOT EXISTS mutualPolicies(bill INTEGER PRIMARY KEY, quote INTEGER NOT NULL, paid INTEGER, closedAt INTEGER);
    CREATE INDEX IF NOT EXISTS mutualByQuote ON mutualPolicies(quote);
    CREATE TABLE IF NOT EXISTS mutualStakes(bill INTEGER NOT NULL, owner TEXT NOT NULL, capital INTEGER NOT NULL, earnings INTEGER NOT NULL, PRIMARY KEY(bill,owner));
  `);
  const moveCapital = db.prepare(
    'UPDATE mutualCapital SET free=free+? WHERE guild=? AND owner=?',
  );
  const member =
    db.prepare(`SELECT g.id,g.name,g.founder FROM players p JOIN innGuilds g ON g.id=json_extract(p.profile,'$.guildId')
    WHERE json_extract(p.profile,'$.uid')=? AND g.archived=0 AND g.founder IS NOT NULL`);
  function manage(uid: string, body: Record<string, unknown>) {
    const { action, amount, guild, fee, cover } = body;
    const current = member.get(uid);
    check(typeof guild === 'string', 'Wybierz kasę gildii.');
    if (action === 'redeem') {
      check(positive(amount, 1000000), 'Podaj kwotę wypłaty.');
      const capital = db
        .prepare('SELECT free FROM mutualCapital WHERE guild=? AND owner=?')
        .get(guild, uid);
      check(
        Number(capital?.free ?? 0) >= amount,
        'Możesz odebrać tylko swój wolny wkład.',
      );
      moveCapital.run(-amount, guild, uid);
      transfer(uid, amount, 0);
      return;
    }
    check(current?.id === guild, 'Wybierz własną gildię graczy.');
    if (action === 'pledge') {
      check(positive(amount, 1000000), 'Podaj kwotę wkładu.');
      transfer(uid, -amount, 0);
      db.prepare(
        'INSERT INTO mutualCapital VALUES(?,?,?) ON CONFLICT(guild,owner) DO UPDATE SET free=free+excluded.free',
      ).run(guild, uid, amount);
      return;
    }
    check(current.founder === uid, 'Warunki ustala mistrz gildii.');
    db.prepare(
      'UPDATE mutualQuotes SET active=0 WHERE guild=? AND active=1',
    ).run(guild);
    if (action === 'tariff') {
      check(
        positive(cover, 1000) && positive(fee, cover - 1),
        'Odszkodowanie musi być wyższe od składki i wynosić najwyżej 1000 zł.',
      );
      db.prepare(
        'INSERT INTO mutualQuotes(guild,fee,cover,active) VALUES(?,?,?,1)',
      ).run(guild, fee, cover);
    }
  }
  function insure(bill: number, driver: string, quote: unknown) {
    check(
      positive(quote, Number.MAX_SAFE_INTEGER),
      'Wybierz aktualną ofertę gildii.',
    );
    const q = db
      .prepare(
        'SELECT q.* FROM mutualQuotes q JOIN innGuilds g ON g.id=q.guild WHERE q.id=? AND q.active=1 AND g.archived=0',
      )
      .get(quote);
    check(q, 'Oferta zmieniła się. Sprawdź aktualne warunki przed wyjazdem.');
    const fee = Number(q.fee),
      cover = Number(q.cover);
    const backers = db
      .prepare(
        'SELECT owner,free FROM mutualCapital WHERE guild=? AND free>0 ORDER BY free DESC,owner',
      )
      .all(q.guild);
    check(
      backers.reduce((sum, b) => sum + Number(b.free), 0) >= cover,
      'Inny wóz zajął rezerwę gildii. Wybierz inną ofertę lub rusz bez ochrony.',
    );
    transfer(driver, -fee, 0);
    db.prepare('INSERT INTO mutualPolicies(bill,quote) VALUES(?,?)').run(
      bill,
      quote,
    );
    let reserved = 0;
    for (const b of backers) {
      const stake = Math.min(Number(b.free), cover - reserved);
      // Cumulative rounding allocates every coin of the premium, even across small stakes.
      const earnings =
        Math.floor(((reserved + stake) * fee) / cover) -
        Math.floor((reserved * fee) / cover);
      moveCapital.run(-stake, q.guild, b.owner);
      db.prepare('INSERT INTO mutualStakes VALUES(?,?,?,?)').run(
        bill,
        b.owner,
        stake,
        earnings,
      );
      reserved += stake;
      if (reserved === cover) break;
    }
  }
  function settle(bill: number, driver: string, arrival: number) {
    const policy = db
      .prepare(
        `SELECT q.guild,q.cover,c.floodAt FROM mutualPolicies p JOIN mutualQuotes q ON q.id=p.quote
      JOIN grainCrossings c ON c.bill=p.bill WHERE p.bill=? AND p.closedAt IS NULL`,
      )
      .get(bill);
    if (!policy) return;
    const paid = policy.floodAt === null ? 0 : Number(policy.cover);
    for (const stake of db
      .prepare('SELECT * FROM mutualStakes WHERE bill=?')
      .all(bill)) {
      moveCapital.run(
        Number(stake.earnings) + (paid ? 0 : Number(stake.capital)),
        policy.guild,
        stake.owner,
      );
    }
    if (paid) transfer(driver, paid, 0);
    db.prepare('UPDATE mutualPolicies SET paid=?,closedAt=? WHERE bill=?').run(
      paid,
      arrival,
      bill,
    );
  }
  function book(uid: string | null) {
    const mine = uid ? member.get(uid) : null;
    const guilds = db
      .prepare(
        `WITH stats AS (
      SELECT q.guild,COUNT(p.closedAt) trips,COALESCE(SUM(p.paid>0),0) claims,COALESCE(SUM(p.paid),0) paid,
        SUM(CASE WHEN p.closedAt IS NULL THEN q.cover ELSE 0 END) locked
      FROM mutualPolicies p JOIN mutualQuotes q ON q.id=p.quote GROUP BY q.guild)
      SELECT g.id,g.name,g.tag,q.id quote,q.cover,q.fee,
        COALESCE((SELECT SUM(free) FROM mutualCapital WHERE guild=g.id),0) free,
        COALESCE(s.trips,0) trips,COALESCE(s.claims,0) claims,COALESCE(s.paid,0) paid,COALESCE(s.locked,0) locked
      FROM innGuilds g LEFT JOIN stats s ON s.guild=g.id
      LEFT JOIN mutualQuotes q ON q.guild=g.id AND q.active=1 AND g.archived=0
      WHERE q.id IS NOT NULL OR s.guild IS NOT NULL OR g.id=? ORDER BY g.name`,
      )
      .all(mine?.id ?? '');
    const holdings = uid
      ? db
          .prepare(
            `SELECT c.guild,g.name,c.free,COALESCE((SELECT SUM(s.capital) FROM mutualStakes s
      JOIN mutualPolicies p ON p.bill=s.bill JOIN mutualQuotes q ON q.id=p.quote WHERE s.owner=c.owner AND q.guild=c.guild AND p.closedAt IS NULL),0) locked
      FROM mutualCapital c JOIN innGuilds g ON g.id=c.guild WHERE c.owner=? AND (c.free>0 OR locked>0) ORDER BY g.name`,
          )
          .all(uid)
      : [];
    return {
      guilds,
      holdings,
      memberGuild: mine?.id ?? null,
      master: !!mine && mine.founder === uid,
    };
  }
  return { manage, insure, settle, book };
}
