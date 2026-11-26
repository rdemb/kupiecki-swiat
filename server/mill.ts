import type { DatabaseSync } from 'node:sqlite';
import type { Express, Request } from 'express';
import { CITIES, type WeatherConditionId } from '../src/economy/economyEngine';
import { emptyMark, millRules as rules, type MillOrder, type MillMark } from '../src/economy/mill';

type Actor = { uid: string; displayName: string; guildId: string };
class MillRule extends Error {}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new MillRule(message);
}
const whole = (n: unknown, max: number) =>
  typeof n === 'number' && Number.isSafeInteger(n) && n >= 1 && n <= max;
const day = rules.orderHours * 3600_000;

export function installMill(
  app: Express,
  db: DatabaseSync,
  authenticate: (req: Request) => Actor | null,
  weather: () => WeatherConditionId,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS mills(city TEXT PRIMARY KEY, flour INTEGER NOT NULL DEFAULT 0, grain INTEGER NOT NULL DEFAULT 0, treasury INTEGER NOT NULL, bakeryAt INTEGER NOT NULL, civicAt INTEGER NOT NULL DEFAULT 0, baked INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS millOrders(id INTEGER PRIMARY KEY, city TEXT NOT NULL, issuer TEXT, name TEXT NOT NULL, purpose TEXT NOT NULL, quantity INTEGER NOT NULL, remaining INTEGER NOT NULL, price INTEGER NOT NULL, expires INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'open');
    CREATE INDEX IF NOT EXISTS millOrderBook ON millOrders(city,state,expires);
    CREATE INDEX IF NOT EXISTS millIssuer ON millOrders(issuer,state);
    CREATE TABLE IF NOT EXISTS millDeliveries(id INTEGER PRIMARY KEY, city TEXT NOT NULL, orderId INTEGER NOT NULL, name TEXT NOT NULL, guild TEXT NOT NULL, quantity INTEGER NOT NULL, price INTEGER NOT NULL, purpose TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS millBillBook ON millDeliveries(city,id DESC);
    CREATE TABLE IF NOT EXISTS millRations(uid TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS millCommands(uid TEXT NOT NULL, nonce TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(uid,nonce));
  `);
  const newMill = db.prepare('INSERT OR IGNORE INTO mills(city,treasury,bakeryAt) VALUES(?,?,?)');
  for (const c of CITIES) newMill.run(c.id, rules.openingTreasury, Date.now());
  const towns = new Set(CITIES.map((c) => c.id));
  const getMill = db.prepare('SELECT * FROM mills WHERE city=?');
  const accounts = db.prepare(
    `SELECT username,json_extract(profile,'$.gold') gold,json_extract(profile,'$.inventory.zboze') grain,json_extract(profile,'$.millMark') mark FROM players WHERE json_extract(profile,'$.uid')=?`,
  );
  const setBalance = db.prepare(
    `UPDATE players SET profile=json_set(profile,'$.gold',?,'$.inventory.zboze',?,'$.millMark',json(?)) WHERE username=?`,
  );
  const orders = db.prepare(
    "SELECT id,issuer,name,purpose,quantity,remaining,price,expires FROM millOrders WHERE city=? AND state='open' ORDER BY id DESC",
  );
  const getOrder = db.prepare("SELECT * FROM millOrders WHERE id=? AND city=? AND state='open'");
  const addOrder = db.prepare(
    'INSERT INTO millOrders(city,issuer,name,purpose,quantity,remaining,price,expires) VALUES(?,?,?,?,?,?,?,?)',
  );
  const hasRation = db.prepare('SELECT 1 FROM millRations WHERE uid=?');
  function wallet(uid: string) {
    const p = accounts.get(uid);
    check(p, 'Kupiec nie figuruje w księgach.');
    const mark: MillMark = p.mark ? JSON.parse(String(p.mark)) : emptyMark;
    return {
      username: String(p.username),
      gold: Number(p.gold),
      grain: Number(p.grain ?? 0),
      mark,
    };
  }
  function transfer(uid: string, gold: number, grain: number) {
    const b = wallet(uid);
    const cash = Math.round((b.gold + gold) * 100) / 100,
      stock = b.grain + grain;
    check(cash >= 0, 'W zapisanej sakwie brakuje złota.');
    check(stock >= 0, 'W zapisanym magazynie brakuje zboża.');
    setBalance.run(
      cash,
      stock,
      JSON.stringify({
        revision: b.mark.revision + 1,
        gold: b.mark.gold + gold,
        grain: b.mark.grain + grain,
      }),
      b.username,
    );
  }
  function endOrder(
    o: Pick<MillOrder, 'id' | 'remaining' | 'price' | 'issuer'>,
    city: string,
    state: 'expired' | 'cancelled',
  ) {
    const refund = o.remaining * o.price;
    if (o.issuer) transfer(o.issuer, refund, 0);
    else db.prepare('UPDATE mills SET treasury=treasury+? WHERE city=?').run(refund, city);
    db.prepare('UPDATE millOrders SET state=? WHERE id=?').run(state, o.id);
  }
  // Advance a city's bakery using elapsed real time, including time while the server was offline.
  function advance(city: string, now: number) {
    const expired = db
      .prepare(
        "SELECT id,issuer,remaining,price FROM millOrders WHERE city=? AND state='open' AND expires<=?",
      )
      .all(city, now);
    for (const o of expired)
      endOrder(
        {
          id: Number(o.id),
          remaining: Number(o.remaining),
          price: Number(o.price),
          issuer: o.issuer === null ? null : String(o.issuer),
        },
        city,
        'expired',
      );
    const m = getMill.get(city)!;
    const periods = Math.floor((now - Number(m.bakeryAt)) / rules.bakeryInterval);
    if (periods > 0) {
      const used = Math.min(periods, Number(m.flour));
      db.prepare(
        'UPDATE mills SET flour=flour-?, baked=baked+?, bakeryAt=bakeryAt+? WHERE city=?',
      ).run(used, used, periods * rules.bakeryInterval, city);
    }
    const w = weather(),
      poorHarvest = w === 'ulewne_deszcze' || w === 'zamiec_i_mroz';
    const reserve = rules.citySacks * rules.cityPrice;
    if (
      poorHarvest &&
      Number(m.flour) - Math.max(0, periods) < rules.rationFlour * 4 &&
      Number(m.civicAt) + day <= now &&
      Number(m.treasury) >= reserve
    ) {
      db.prepare('UPDATE mills SET treasury=treasury-?, civicAt=? WHERE city=?').run(
        reserve,
        now,
        city,
      );
      addOrder.run(
        city,
        null,
        'Młyn miejski',
        'mill',
        rules.citySacks,
        rules.citySacks,
        rules.cityPrice,
        now + day,
      );
    }
  }
  function read(city: string, uid: string | null) {
    const m = getMill.get(city)!;
    const purse = uid ? wallet(uid) : null;
    return {
      flour: m.flour,
      grain: m.grain,
      baked: m.baked,
      treasury: m.treasury,
      orders: orders.all(city),
      deliveries: db
        .prepare(
          'SELECT id,name,guild,quantity,price,purpose,at FROM millDeliveries WHERE city=? ORDER BY id DESC LIMIT 12',
        )
        .all(city),
      wallet: purse
        ? {
            uid,
            gold: purse.gold,
            grain: purse.grain,
            mark: purse.mark,
            ration: !!hasRation.get(uid!),
          }
        : null,
    };
  }
  const scope = '/api/mill/:city';
  app.get(scope, (req, res, next) => {
    const city = String(req.params.city);
    if (!towns.has(city)) {
      res.sendStatus(404);
      return;
    }
    try {
      db.exec('BEGIN IMMEDIATE');
      advance(city, Date.now());
      const page = read(city, authenticate(req)?.uid ?? null);
      db.exec('COMMIT');
      res.set('Cache-Control', 'private, no-store').json(page);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      next(e);
    }
  });
  app.post(scope, (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    const me = authenticate(req),
      city = String(req.params.city);
    if (!me) {
      res.status(401).json({ error: 'Zaloguj się, żeby podpisać dokument.' });
      return;
    }
    const { action, nonce, quantity, price, order, purpose } = req.body ?? {};
    const payload = JSON.stringify([city, action, quantity, price, order, purpose]);
    const now = Date.now();
    try {
      check(
        towns.has(city) && typeof nonce === 'string' && /^[0-9a-f-]{36}$/i.test(nonce),
        'Nieprawidłowy dokument.',
      );
      db.exec('BEGIN IMMEDIATE');
      advance(city, now);
      const prior = db
        .prepare('SELECT payload FROM millCommands WHERE uid=? AND nonce=?')
        .get(me.uid, nonce);
      if (prior) check(prior.payload === payload, 'Ten dokument ma inną treść.');
      else {
        if (action === 'post') {
          check(
            whole(quantity, rules.maxSacks) &&
              whole(price, rules.maxPrice) &&
              (purpose === 'mill' || purpose === 'merchant'),
            'Sprawdź liczbę worków, cenę i odbiorcę.',
          );
          check(
            Number(
              db
                .prepare(
                  "SELECT count(*) n FROM millOrders WHERE issuer=? AND state='open' AND expires>?",
                )
                .get(me.uid, now)?.n,
            ) < 3,
            'Możesz wystawić trzy czynne kontrakty.',
          );
          transfer(me.uid, -quantity * price, 0);
          addOrder.run(city, me.uid, me.displayName, purpose, quantity, quantity, price, now + day);
        } else if (action === 'deliver' || action === 'cancel') {
          check(whole(order, Number.MAX_SAFE_INTEGER), 'Wybierz kontrakt.');
          const o = getOrder.get(order, city);
          check(o, 'Ten kontrakt jest już zamknięty lub wygasł.');
          if (action === 'cancel') {
            check(o.issuer === me.uid, 'Kontrakt może odwołać jego wystawca.');
            endOrder(
              { id: order, remaining: Number(o.remaining), price: Number(o.price), issuer: me.uid },
              city,
              'cancelled',
            );
          } else {
            check(o.issuer !== me.uid, 'Zlecenie realizuje inny kupiec.');
            check(whole(quantity, Number(o.remaining)), 'Sprawdź liczbę brakujących worków.');
            const paid = quantity * Number(o.price);
            transfer(me.uid, paid, -quantity);
            if (o.purpose === 'merchant') transfer(String(o.issuer), 0, quantity);
            else {
              const sacks = Number(getMill.get(city)!.grain) + quantity;
              db.prepare('UPDATE mills SET flour=flour+?,grain=? WHERE city=?').run(
                Math.floor(sacks / 4) * 3,
                sacks % 4,
                city,
              );
            }
            const guild = me.guildId
              ? db.prepare('SELECT name FROM innGuilds WHERE id=? AND archived=0').get(me.guildId)
                  ?.name
              : '';
            db.prepare(
              'INSERT INTO millDeliveries(city,orderId,name,guild,quantity,price,purpose,at) VALUES(?,?,?,?,?,?,?,?)',
            ).run(
              city,
              order,
              me.displayName,
              String(guild ?? ''),
              quantity,
              Number(o.price),
              o.purpose,
              now,
            );
            db.prepare(
              "UPDATE millOrders SET remaining=remaining-?,state=CASE WHEN remaining=? THEN 'filled' ELSE 'open' END WHERE id=?",
            ).run(quantity, quantity, order);
          }
        } else if (action === 'ration') {
          check(!hasRation.get(me.uid), 'Masz już prowiant na następny przewóz.');
          check(Number(getMill.get(city)?.flour) >= rules.rationFlour, 'Piekarz czeka na mąkę.');
          transfer(me.uid, -rules.rationGold, 0);
          db.prepare('UPDATE mills SET flour=flour-?,treasury=treasury+? WHERE city=?').run(
            rules.rationFlour,
            rules.rationGold,
            city,
          );
          db.prepare('INSERT INTO millRations VALUES(?)').run(me.uid);
        } else throw new MillRule('Nieznane polecenie.');
        db.prepare('INSERT INTO millCommands VALUES(?,?,?)').run(me.uid, nonce, payload);
      }
      const page = read(city, me.uid);
      db.exec('COMMIT');
      res.json(page);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof MillRule) res.status(409).json({ error: e.message });
      else next(e);
    }
  });
  return {
    useRation: (uid: string) =>
      Number(db.prepare('DELETE FROM millRations WHERE uid=?').run(uid).changes) > 0
        ? rules.rationSeconds * 1000
        : 0,
    advanceTowns: () => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const now = Date.now();
        for (const city of towns) advance(city, now);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
