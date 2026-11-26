import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Express, Request } from 'express';

const watchLength = 30 * 60_000;
const sealsToClear = 3;
const vessels = [
  { name: 'Srebrna Mewa', cargo: 'zboże' },
  { name: 'Bursztynowa Łania', cargo: 'przyprawy' },
  { name: 'Czarny Kormoran', cargo: 'żelazo' },
];
const watchAt = (time: number) => Math.floor(time / watchLength);
function parcel(watch: number, owner: string) {
  return (
    3 +
    (createHash('sha256')
      .update(watch + '/' + owner)
      .digest()
      .readUInt8(0) %
      27)
  );
}

export function installWeighhouse(
  app: Express,
  db: DatabaseSync,
  authenticate: (req: Request) => { uid: string; displayName: string } | null,
  notify: () => void,
) {
  db.exec(`CREATE TABLE IF NOT EXISTS portSeals (
    watch INTEGER NOT NULL, owner TEXT NOT NULL, signer TEXT NOT NULL, mass INTEGER NOT NULL,
    PRIMARY KEY (watch,owner))`);
  const signatures = db.prepare(
    'SELECT signer, mass FROM portSeals WHERE watch=? ORDER BY rowid LIMIT 10',
  );
  const alreadySigned = db.prepare('SELECT mass FROM portSeals WHERE watch=? AND owner=?');
  const count = db.prepare('SELECT COUNT(*) AS n FROM portSeals WHERE watch=?');
  const sealCount = (watch: number) => Number(count.get(watch)?.n ?? 0);
  function manifest(uid?: string) {
    const now = Date.now();
    const watch = watchAt(now);
    return {
      watch,
      now,
      closes: (watch + 1) * watchLength,
      vessel: vessels[watch % vessels.length],
      threshold: sealsToClear,
      count: sealCount(watch),
      signatures: signatures.all(watch),
      sample: parcel(watch, uid ?? 'practice'),
      signed: !!uid && !!alreadySigned.get(watch, uid),
    };
  }
  app.get('/api/weighhouse', (req, res) => {
    res.set('Cache-Control', 'no-store').json(manifest(authenticate(req)?.uid));
  });
  app.post('/api/weighhouse/seal', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const who = authenticate(req);
    if (!who) {
      res.status(401).json({ error: 'Zaloguj się, żeby podpisać manifest.' });
      return;
    }
    const { watch, mass } = req.body ?? {};
    if (!Number.isSafeInteger(watch) || !Number.isSafeInteger(mass) || mass < 1 || mass > 31) {
      res.status(400).json({ error: 'Podaj odczyt wagi w łutach.' });
      return;
    }
    try {
      db.exec('BEGIN IMMEDIATE');
      const current = watchAt(Date.now());
      const prior = alreadySigned.get(watch, who.uid);
      if (prior && prior.mass === mass) {
        db.exec('COMMIT');
        res.json(manifest(who.uid));
        return;
      }
      if (current !== watch || parcel(current, who.uid) !== mass) {
        db.exec('ROLLBACK');
        res
          .status(current !== watch ? 409 : 422)
          .json({ error: current !== watch ? 'Statek już odpłynął.' : 'Szale nie są w równowadze.' });
        return;
      }
      db.prepare('INSERT INTO portSeals VALUES(?,?,?,?)').run(watch, who.uid, who.displayName, mass);
      if (sealCount(watch) === sealsToClear) {
        const ship = vessels[watch % vessels.length];
        db.prepare('INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)').run(
          who.uid,
          who.displayName,
          'krolewska_przystan',
          'Trzej kupcy odprawili statek „' +
            ship.name +
            '”. Do końca wachty wozy przy nabrzeżu mają pierwszeństwo.',
        );
      }
      db.exec('COMMIT');
      notify();
      res.status(201).json(manifest(who.uid));
    } catch (error) {
      if (db.isTransaction) db.exec('ROLLBACK');
      next(error);
    }
  });
  return () => sealCount(watchAt(Date.now())) >= sealsToClear;
}
