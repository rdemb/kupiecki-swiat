import type { Express, Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { CITIES } from '../src/economy/economyEngine';

class Rule extends Error {}
function requireRule(test: unknown, message: string): asserts test {
  if (!test) throw new Rule(message);
}

export function installProvinces(
  app: Express,
  db: DatabaseSync,
  authenticate: (req: Request) => { uid: string; displayName: string } | null,
  portCleared: () => boolean,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS towns (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL UNIQUE, name TEXT NOT NULL, nameKey TEXT NOT NULL UNIQUE,
      site TEXT NOT NULL UNIQUE, approved INTEGER DEFAULT 0, wood INTEGER DEFAULT 0, iron INTEGER DEFAULT 0,
      capital INTEGER, toll INTEGER DEFAULT 0, treasury INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS charters (town INTEGER PRIMARY KEY, capital INTEGER NOT NULL, toll INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS freight (carrier TEXT PRIMARY KEY, town INTEGER NOT NULL, cargo TEXT NOT NULL, due INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS annals (id INTEGER PRIMARY KEY, person TEXT NOT NULL, name TEXT NOT NULL, site TEXT NOT NULL, story TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS witnesses (entry INTEGER, uid TEXT, name TEXT NOT NULL, PRIMARY KEY(entry,uid));
    CREATE TABLE IF NOT EXISTS provinceRequests (actor TEXT, nonce TEXT, body TEXT NOT NULL, PRIMARY KEY(actor,nonce));
  `);
  const townById = db.prepare('SELECT * FROM towns WHERE id=?');
  const byOwner = db.prepare('SELECT * FROM towns WHERE owner=?');
  const balance = db.prepare(
    'SELECT COALESCE((SELECT SUM(bars) FROM decrees WHERE recipient=?),0)-COALESCE((SELECT SUM(cost) FROM barPayments WHERE owner=?),0) AS n',
  );
  const spend = (uid: string, id: number, purpose: string, cost: number) => {
    requireRule(Number(balance.get(uid, uid)?.n) >= cost, 'Brak sztabek w skarbcu.');
    db.prepare('INSERT INTO barPayments VALUES(?,?,?,?)').run(id, purpose, uid, cost);
  };
  const entry = db.prepare('INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)');
  const ledger =
    db.prepare(`SELECT a.*, (SELECT json_group_array(name) FROM witnesses w WHERE w.entry=a.id) witnesses
    FROM annals a WHERE (?='' OR person=?) AND id<? ORDER BY id DESC LIMIT 41`);
  app.get('/api/provinces/chronicle', (req, res) => {
    const person = typeof req.query.person === 'string' ? req.query.person : '';
    const before = Number(req.query.before ?? Number.MAX_SAFE_INTEGER);
    if (!Number.isSafeInteger(before) || before < 1) {
      res.sendStatus(400);
      return;
    }
    const rows = ledger.all(person, person, before);
    res
      .set('Cache-Control', 'no-store')
      .json({
        more: rows.length > 40,
        entries: rows
          .slice(0, 40)
          .map((row) => ({ ...row, witnesses: JSON.parse(String(row.witnesses)) })),
      });
  });
  app.get('/api/provinces', (req, res) => {
    const me = authenticate(req);
    res.set('Cache-Control', 'no-store').json({
      towns: db
        .prepare(
          `SELECT t.*, json_extract(p.profile,'$.displayName') governor FROM towns t JOIN players p ON json_extract(p.profile,'$.uid')=t.owner
        WHERE approved=1 OR owner=? OR EXISTS(SELECT 1 FROM emperor WHERE uid=?) ORDER BY t.id`,
        )
        .all(me?.uid ?? '', me?.uid ?? ''),
      uid: me?.uid,
      admin: !!me && !!db.prepare('SELECT 1 FROM emperor WHERE uid=?').get(me.uid),
      invitations: me
        ? db
            .prepare('SELECT c.* FROM charters c JOIN towns t ON t.id=c.town WHERE t.owner=?')
            .all(me.uid)
        : [],
      freight: me ? db.prepare('SELECT town,cargo,due FROM freight WHERE carrier=?').get(me.uid) : null,
    });
  });
  app.post('/api/provinces/orders', (req, res, next) => {
    const me = authenticate(req);
    if (!me) {
      res.sendStatus(401);
      return;
    }
    const { action, nonce, town, name, site, cargo, toll } = req.body ?? {};
    const body = JSON.stringify([action, town, name, site, cargo, toll]);
    try {
      requireRule(
        typeof nonce === 'string' && /^[a-f0-9-]{36}$/i.test(nonce),
        'Niepoprawny numer dokumentu.',
      );
      db.exec('BEGIN IMMEDIATE');
      const prior = db
        .prepare('SELECT body FROM provinceRequests WHERE actor=? AND nonce=?')
        .get(me.uid, nonce);
      if (prior) {
        requireRule(prior.body === body, 'Numer dokumentu jest zajęty.');
        db.exec('COMMIT');
        res.json({ ok: true });
        return;
      }
      const mine = byOwner.get(me.uid);
      const target = Number.isSafeInteger(town) ? townById.get(town) : undefined;
      const developed = (t: typeof mine) =>
        t && t.approved && Number(t.wood) >= 2 && Number(t.iron) >= 2;
      const log = (place: string, story: string) => entry.run(me.uid, me.displayName, place, story);
      if (action === 'petition') {
        const clean = typeof name === 'string' ? name.trim().normalize('NFC') : '';
        requireRule(
          /^[\p{L}\p{N}][\p{L}\p{N} ’-]{2,39}$/u.test(clean) && CITIES.some((c) => c.id === site),
          'Wybierz okręg i nazwę (3–40 znaków).',
        );
        const key = clean.toLocaleLowerCase('pl');
        requireRule(
          !mine &&
            !CITIES.some((c) => c.name.toLocaleLowerCase('pl') === key) &&
            !db.prepare('SELECT 1 FROM towns WHERE site=? OR nameKey=?').get(site, key),
          'Nazwa, okręg lub prawo lokacji są już zajęte.',
        );
        requireRule(
          Number(balance.get(me.uid, me.uid)?.n) >= 4,
          'Do złożenia petycji potrzebujesz 4 sztabek.',
        );
        db.prepare('INSERT INTO towns(owner,name,nameKey,site) VALUES(?,?,?,?)').run(
          me.uid,
          clean,
          key,
          site,
        );
      } else if (action === 'witness') {
        requireRule(
          Number.isSafeInteger(town) && db.prepare('SELECT 1 FROM annals WHERE id=?').get(town),
          'Brak wpisu kroniki.',
        );
        db.prepare('INSERT OR IGNORE INTO witnesses VALUES(?,?,?)').run(town, me.uid, me.displayName);
      } else {
        requireRule(target, 'Nie znaleziono miasta.');
        if (action === 'approve' || action === 'reject') {
          requireRule(
            !target.approved && db.prepare('SELECT 1 FROM emperor WHERE uid=?').get(me.uid),
            'Tylko Imperator rozpatruje oczekujące petycje.',
          );
          if (action === 'reject') db.prepare('DELETE FROM towns WHERE id=?').run(town);
          else {
            spend(String(target.owner), town, 'lokacja', 4);
            db.prepare('UPDATE towns SET approved=1 WHERE id=?').run(town);
            log(String(target.site), 'Opieczętowano akt lokacji: ' + target.name + '.');
          }
        } else if (action === 'dispatch') {
          requireRule(
            target.approved && !db.prepare('SELECT 1 FROM freight WHERE carrier=?').get(me.uid),
            'Dokończ poprzedni przewóz lub wybierz zatwierdzone miasto.',
          );
          if (cargo === 'handel') {
            requireRule(
              developed(mine) &&
                developed(target) &&
                mine?.id !== town &&
                mine?.capital &&
                mine.capital === target.capital,
              'Szlak wymaga dwóch różnych miast tego samego księstwa.',
            );
          } else
            requireRule(
              (cargo === 'wood' || cargo === 'iron') && Number(target[cargo]) < 2,
              'Budowa nie potrzebuje tego materiału.',
            );
          const callsAtPort = target.site === 'krolewska_przystan' || (cargo === 'handel' && mine?.site === 'krolewska_przystan');
          const duration = callsAtPort && portCleared() ? 30_000 : 60_000;
          db.prepare('INSERT INTO freight VALUES(?,?,?,?)').run(me.uid, town, cargo, Date.now() + duration);
        } else if (action === 'arrive') {
          const job = db.prepare('SELECT * FROM freight WHERE carrier=?').get(me.uid);
          requireRule(
            job && job.town === town && Number(job.due) <= Date.now(),
            'Karawana jeszcze nie dotarła.',
          );
          db.prepare('DELETE FROM freight WHERE carrier=?').run(me.uid);
          if (job.cargo === 'handel') {
            requireRule(mine?.capital && mine.capital === target.capital, 'Umowa szlaku wygasła.');
            const duty = Number(target.toll);
            const tribute = town === target.capital ? 0 : duty * 0.2;
            const credit = db.prepare('UPDATE towns SET treasury=ROUND(treasury+?,2) WHERE id=?');
            credit.run(duty-tribute, town);
            credit.run(100-duty, mine.id);
            if(tribute) credit.run(tribute,target.capital);
            log(
              String(target.site),
              'Konwój z ' + mine.name + ' do ' + target.name + ' rozliczył myto ' + duty + ' zł (lenno do stolicy: '+tribute.toFixed(2)+' zł).',
            );
          } else {
            const material = job.cargo === 'wood' ? 'wood' : 'iron';
            db.prepare('UPDATE towns SET ' + material + '=MIN(2,' + material + '+1) WHERE id=?').run(
              town,
            );
            log(
              String(target.site),
              'Dostawa ' + (material === 'wood' ? 'drewna' : 'żelaza') + ' do ' + target.name + '.',
            );
            if (!developed(target) && developed(townById.get(town)))
              log(String(target.site), 'Zakończono budowę miasta ' + target.name + '.');
          }
        } else if (action === 'found') {
          requireRule(
            mine?.id === town && developed(target) && !target.capital,
            'Potrzebujesz własnego ukończonego, niezależnego miasta.',
          );
          spend(me.uid, town, 'księstwo', 10);
          db.prepare('UPDATE towns SET capital=id WHERE id=?').run(town);
          db.prepare('DELETE FROM charters WHERE town=?').run(town);
          log(String(target.site), 'Ustanowiono stolicę księstwa w ' + target.name + '.');
        } else if (action === 'invite') {
          requireRule(
            mine &&
              mine.capital === mine.id &&
              developed(target) &&
              !target.capital &&
              Number.isInteger(toll) &&
              toll >= 0 &&
              toll <= 10,
            'Zaproponuj niezależnemu miastu myto od 0 do 10%.',
          );
          const invite = db.prepare('SELECT capital FROM charters WHERE town=?').get(town);
          requireRule(!invite || invite.capital === mine.id, 'Miasto rozpatruje inną ofertę.');
          db.prepare('INSERT OR REPLACE INTO charters VALUES(?,?,?)').run(town, mine.id, toll);
        } else if (action === 'accept' || action === 'decline') {
          const invite = db.prepare('SELECT * FROM charters WHERE town=?').get(town);
          requireRule(
            target.owner === me.uid && !target.capital && invite,
            'Tylko zarządca zaproszonego miasta może odpowiedzieć.',
          );
          if (action === 'accept') {
            db.prepare('UPDATE towns SET capital=?,toll=? WHERE id=?').run(
              invite.capital,
              invite.toll,
              town,
            );
            log(
              String(target.site),
              target.name +
                ' zawarło unię z ' +
                townById.get(invite.capital)?.name +
                '; myto ' +
                invite.toll +
                '%.',
            );
          }
          db.prepare('DELETE FROM charters WHERE town=?').run(town);
        } else throw new Rule('Nieznane polecenie.');
      }
      db.prepare('INSERT INTO provinceRequests VALUES(?,?,?)').run(me.uid, nonce, body);
      db.exec('COMMIT');
      res.json({ ok: true });
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof Rule) res.status(400).json({ error: e.message });
      else next(e);
    }
  });
}
