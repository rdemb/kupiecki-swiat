import { RaftRule, type installRafts } from './rafts';
import type { installRiverGauge } from './riverGauge';
import { floodMark } from '../src/economy/river';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import { divertCarts } from './carrierMutual';
import { wagonHaulingGrain } from './waybills';
import type { DatabaseSync } from 'node:sqlite';
import type { Express, Request } from 'express';
import {
  bridgeRules,
  bridgeSite,
  type BridgeMaterial,
  type BridgeSign,
} from '../src/economy/bridge';
import type { MillMark } from '../src/economy/mill';
import { emptyMark } from '../src/economy/mill';

type Actor = {
  uid: string;
  displayName: string;
  guildId: string;
  gold: number;
  millMark?: MillMark;
};
class BridgeRule extends Error {}
function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new BridgeRule(message);
}
const protection = 48 * 3600_000;
const unloadWindow = 15 * 60_000;

export function installBridge(
  app: Express,
  db: DatabaseSync,
  authenticate: (req: Request) => Actor | null,
  weather: () => WeatherConditionId,
  river: ReturnType<typeof installRiverGauge>,
  settleGold: (uid: string, change: number) => void,
  rafts: ReturnType<typeof installRafts>,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bridgeState(id INTEGER PRIMARY KEY CHECK(id=1),cycle INTEGER NOT NULL,damaged INTEGER NOT NULL,wet INTEGER NOT NULL,opened INTEGER NOT NULL,flag TEXT NOT NULL);
    INSERT OR IGNORE INTO bridgeState VALUES(1,0,0,0,0,'');
    CREATE TABLE IF NOT EXISTS bridgeLoads(id INTEGER PRIMARY KEY,cycle INTEGER NOT NULL,material TEXT NOT NULL,cost INTEGER NOT NULL,wage INTEGER NOT NULL,guild TEXT NOT NULL,guildName TEXT NOT NULL,patron TEXT NOT NULL,driver TEXT,driverName TEXT,due INTEGER,delivered INTEGER);
    CREATE INDEX IF NOT EXISTS bridgeLoadsCycle ON bridgeLoads(cycle,id);
    CREATE UNIQUE INDEX IF NOT EXISTS bridgeOneWagon ON bridgeLoads(driver) WHERE driver IS NOT NULL AND delivered IS NULL;
    CREATE TABLE IF NOT EXISTS bridgeOpenings(cycle INTEGER PRIMARY KEY,guildName TEXT NOT NULL,tag TEXT NOT NULL,opened INTEGER NOT NULL,builders TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bridgeReceipts(uid TEXT NOT NULL,nonce TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(uid,nonce));
  `);
  const state = db.prepare('SELECT * FROM bridgeState WHERE id=1');
  const group = db.prepare('SELECT id,name,tag,archived FROM innGuilds WHERE id=?');
  const slips = db.prepare('SELECT * FROM bridgeLoads WHERE cycle=? ORDER BY id');
  const slip = db.prepare('SELECT * FROM bridgeLoads WHERE cycle=? AND id=?');
  const record = (uid: string, name: string, story: string) =>
    db
      .prepare('INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)')
      .run(uid, name, bridgeSite, story);
  // Invoked inside the same transaction as a dispatch or a bridge action.
  function advance(now: number, checkpoint = false) {
    const b = state.get()!;
    const water = river.advance(now, weather(), checkpoint);
    const wet = Number(water.level >= floodMark * 1000);
    const floodedAt = water.crossedAt ?? now;
    if (wet !== b.wet) {
      db.prepare('UPDATE bridgeState SET wet=? WHERE id=1').run(wet);
      if (wet && !b.damaged && floodedAt - Number(b.opened) >= protection) {
        db.exec("UPDATE bridgeState SET damaged=1, cycle=cycle+1, flag='' WHERE id=1");
        divertCarts(db, Number(b.cycle) + 1, floodedAt);
        record(
          '',
          'Straż przeprawy',
          'Ulewa porwała przęsło mostu w Srebrnym Gaju. Wozy skierowano na objazd.',
        );
      }
    }
    db.prepare(
      'UPDATE bridgeLoads SET driver=NULL, driverName=NULL, due=NULL WHERE delivered IS NULL AND due<=?',
    ).run(now - unloadWindow);
    rafts.advance(now);
    return water.level;
  }
  function sign(): BridgeSign {
    const b = state.get()!;
    const guild = group.get(b.flag);
    return {
      damaged: !!b.damaged,
      flag: String(b.flag),
      tag: String(guild?.tag ?? ''),
      guildName: String(guild?.name ?? ''),
    };
  }
  function complete(cycle: number, now: number, actor: Actor) {
    const rows = slips.all(cycle);
    if (
      rows.filter((r) => r.delivered !== null).length !==
      bridgeRules.wood.loads + bridgeRules.iron.loads
    )
      return;
    // Largest paid contribution wins. For equal sums the first signed contract wins.
    const paid = new Map<string, number>();
    for (const row of rows) {
      const id = String(row.guild);
      paid.set(id, (paid.get(id) ?? 0) + Number(row.cost));
    }
    const winner = [...paid].sort((a, b) => b[1] - a[1])[0][0];
    const g = group.get(winner)!;
    const builders = [...new Set(rows.map((r) => String(r.driverName)))].join(', ');
    db.prepare('UPDATE bridgeState SET damaged=0, opened=?, flag=? WHERE id=1').run(now, winner);
    db.prepare('INSERT INTO bridgeOpenings VALUES(?,?,?,?,?)').run(
      cycle,
      g.name,
      g.tag,
      now,
      builders,
    );
    record(
      actor.uid,
      actor.displayName,
      'Otwarto most w Srebrnym Gaju. Proporzec: ' + g.name + '. Dostawy: ' + builders + '.',
    );
  }
  function read(me: Actor | null, now: number, level: number) {
    const cycle = Number(state.get()!.cycle);
    const loads = slips.all(cycle);
    const bridge = sign();
    return {
      ...bridge,
      rafting: rafts.book(me?.uid ?? null, level, bridge.damaged ? bridgeRules.wood.loads - loads.filter(row => row.material === 'wood').length : 0),
      cycle,
      now,
      reading: river.personal(me?.uid ?? null),
      loads: loads.map((r) => ({
        id: r.id,
        material: r.material,
        guildName: r.guildName,
        patron: r.patron, wage: r.wage,
        driver: r.driverName,
        delivered: r.delivered,
        due: r.due,
        myWagon: !!me && r.driver === me.uid && r.delivered === null,
      })),
      openings: db.prepare('SELECT * FROM bridgeOpenings ORDER BY cycle DESC LIMIT 20').all(),
      wallet: me
        ? {
            uid: me.uid,
            guildName: String(group.get(me.guildId)?.name ?? ''),
            gold: me.gold,
            mark: me.millMark ?? emptyMark,
          }
        : null,
    };
  }
  app.get('/api/bridge', (req, res, next) => {
    try {
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      const level = advance(now);
      const page = read(authenticate(req), now, level);
      db.exec('COMMIT');
      res.set('Cache-Control', 'private, no-store').json(page);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      next(e);
    }
  });
  app.post('/api/bridge', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    const me = authenticate(req);
    if (!me) {
      res.status(401).json({ error: 'Zaloguj się, aby działać przy przeprawie.' });
      return;
    }
    const { action, nonce, cycle, material, load, reading, offer } = req.body ?? {};
    const observation = action === 'measure' || action === 'publishReading';
    const payload = JSON.stringify(action === 'launchRaft' ? [action, offer] : observation ? [action, reading] : [action, cycle, material, load]);
    try {
      requireRule(
        typeof nonce === 'string' && /^[a-f0-9-]{36}$/i.test(nonce),
        'Niepoprawny numer dokumentu.',
      );
      db.exec('BEGIN IMMEDIATE');
      const now = Date.now();
      const level = advance(now);
      const prior = db
        .prepare('SELECT payload FROM bridgeReceipts WHERE uid=? AND nonce=?')
        .get(me.uid, nonce);
      if (prior) requireRule(prior.payload === payload, 'Ten dokument ma inną treść.');
      else if (action === 'launchRaft') {
        rafts.launch(authenticate(req)!, offer, level, now);
        db.prepare('INSERT INTO bridgeReceipts VALUES(?,?,?)').run(me.uid, nonce, payload);
      } else if (observation) {
        if (action === 'measure') river.measure(me.uid, me.displayName, level, now);
        else requireRule(
          Number.isSafeInteger(reading) && river.publish(me.uid, reading, now),
          'Do karczmy możesz wysłać własny najnowszy odczyt przez 45 sekund od pomiaru.',
        );
        db.prepare('INSERT INTO bridgeReceipts VALUES(?,?,?)').run(me.uid, nonce, payload);
      } else {
        const b = state.get()!;
        requireRule(b.damaged && b.cycle === cycle, 'To wezwanie do odbudowy już wygasło.');
        if (action === 'fund') {
          const guild = group.get(me.guildId);
          requireRule(
            guild && !guild.archived,
            'Zapisz się do gildii, aby wystawić kontrakt pod jej proporcem.',
          );
          requireRule(material === 'wood' || material === 'iron', 'Wybierz drewno lub żelazo.');
          const rule = bridgeRules[material as BridgeMaterial];
          requireRule(
            slips.all(cycle).filter((r) => r.material === material).length < rule.loads,
            'Wszystkie wozy z tym materiałem mają już fundatora.',
          );
          requireRule(me.gold >= rule.cost, 'W sakwie brakuje złota na opłacenie kursu.');
          if (material === 'wood') rafts.takeForest(1, now);
          settleGold(me.uid, -rule.cost);
          db.prepare(
            'INSERT INTO bridgeLoads(cycle,material,cost,wage,guild,guildName,patron) VALUES(?,?,?,?,?,?,?)',
          ).run(cycle, material, rule.cost, rule.wage, guild.id, guild.name, me.displayName);
        } else {
          requireRule(Number.isSafeInteger(load), 'Wybierz list przewozowy.');
          const wagon = slip.get(cycle, load);
          requireRule(wagon && wagon.delivered === null, 'Ta dostawa jest już rozliczona.');
          const rule = bridgeRules[wagon.material as BridgeMaterial];
          if (action === 'haul') {
            requireRule(!wagonHaulingGrain(db, me.uid), 'Twój wóz wiezie zboże do młyna.');
            requireRule(wagon.driver === null, 'Ten wóz ma już woźnicę.');
            requireRule(
              !db
                .prepare('SELECT 1 FROM bridgeLoads WHERE driver=? AND delivered IS NULL')
                .get(me.uid),
              'Najpierw rozładuj swój wóz.',
            );
            db.prepare('UPDATE bridgeLoads SET driver=?,driverName=?,due=? WHERE id=?').run(
              me.uid,
              me.displayName,
              now + rule.seconds * 1000,
              load,
            );
          } else if (action === 'unload') {
            requireRule(
              wagon.driver === me.uid && Number(wagon.due) <= now,
              'Rozładuj własny wóz po dojechaniu na miejsce.',
            );
            db.prepare('UPDATE bridgeLoads SET delivered=? WHERE id=?').run(now, load);
            settleGold(me.uid, Number(wagon.wage));
            complete(cycle, now, me);
          } else throw new BridgeRule('Nieznana czynność przy moście.');
        }
        db.prepare('INSERT INTO bridgeReceipts VALUES(?,?,?)').run(me.uid, nonce, payload);
      }
      const page = read(authenticate(req), now, level);
      db.exec('COMMIT');
      res.json(page);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof BridgeRule || e instanceof RaftRule) res.status(409).json({ error: e.message });
      else next(e);
    }
  });
  return { sign, advance };
}
