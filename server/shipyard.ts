import type { Express, Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { emptyMark, type MillMark } from '../src/economy/mill';
import {
  sailingSeconds,
  shipRules as r,
  type Hull,
  type YardBook,
} from '../src/economy/shipyard';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import type { installHarborWorks } from './harborWorks';
import type { installRafts } from './rafts';

type Actor = {
  uid: string;
  displayName: string;
  guildId: string;
  gold: number;
  millMark?: MillMark;
};
class YardRule extends Error {}
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new YardRule(message);
}
const hullColumns =
  's.id,s.name,s.guildName AS guild,s.tag,s.founder,s.begun,s.launched';
const positive = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
export function installShipyard(
  app: Express,
  db: DatabaseSync,
  auth: (req: Request) => Actor | null,
  rafts: ReturnType<typeof installRafts>,
  harbor: ReturnType<typeof installHarborWorks>,
  gold: (uid: string, delta: number) => void,
  weather: () => WeatherConditionId,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yardShips(id INTEGER PRIMARY KEY, guild TEXT NOT NULL UNIQUE,guildName TEXT NOT NULL,
      tag TEXT NOT NULL,owner TEXT NOT NULL,founder TEXT NOT NULL,begun INTEGER NOT NULL,name TEXT,nameKey TEXT UNIQUE,launched INTEGER);
    CREATE TABLE IF NOT EXISTS yardBuild(id INTEGER PRIMARY KEY,ship INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('oak','iron')),
      owner TEXT NOT NULL,name TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS yardBuildHull ON yardBuild(ship,id);
    CREATE TABLE IF NOT EXISTS yardVoyages(id INTEGER PRIMARY KEY, ship INTEGER NOT NULL,sponsor TEXT NOT NULL,payer TEXT NOT NULL,
      captain TEXT,skipper TEXT,offered INTEGER NOT NULL,expires INTEGER NOT NULL,departed INTEGER,due INTEGER,settled INTEGER,
      closed INTEGER NOT NULL DEFAULT 0,barrels INTEGER NOT NULL,wage INTEGER NOT NULL,freight INTEGER NOT NULL, teams INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS yardOneTrip ON yardVoyages(ship) WHERE closed=0;
    CREATE UNIQUE INDEX IF NOT EXISTS yardOneHelm ON yardVoyages(captain) WHERE closed=0 AND captain IS NOT NULL;
    CREATE INDEX IF NOT EXISTS yardPortLog ON yardVoyages(ship,id DESC) WHERE settled IS NOT NULL;
    CREATE TABLE IF NOT EXISTS yardSlips(uid TEXT NOT NULL,nonce TEXT NOT NULL,payload TEXT NOT NULL,ship INTEGER NOT NULL,PRIMARY KEY(uid,nonce));
  `);
  const hull = db.prepare('SELECT * FROM yardShips WHERE id=?');
  const guild = db.prepare(
    'SELECT id,name,tag,founder,archived FROM innGuilds WHERE id=?',
  );
  const plank = db.prepare(
    'SELECT id,name,kind,at FROM yardBuild WHERE ship=? ORDER BY id',
  );
  const live = db.prepare(
    'SELECT * FROM yardVoyages WHERE ship=? AND closed=0',
  );
  const logCols =
    'id,payer,skipper,offered,expires,departed,due,settled,teams,barrels,wage,freight,sponsor=? AS mine,captain=? AS myJob';
  function master(
    me: Actor | null,
    s: NonNullable<ReturnType<typeof hull.get>>,
  ) {
    if (!me) return false;
    const g = guild.get(s.guild);
    if (g && !g.archived) return g.founder === me.uid && g.id === me.guildId;
    return (
      s.owner === me.uid ||
      !!db
        .prepare('SELECT 1 FROM yardBuild WHERE ship=? AND owner=?')
        .get(s.id, me.uid)
    );
  }
  function refund(id: number) {
    const job = db
      .prepare(
        'SELECT sponsor,wage,barrels FROM yardVoyages WHERE id=? AND closed=0 AND departed IS NULL',
      )
      .get(id);
    if (!job) return;
    gold(String(job.sponsor), Number(job.wage));
    harbor.returnSalt(Number(job.barrels));
    db.prepare('UPDATE yardVoyages SET closed=1 WHERE id=?').run(id);
  }
  function advance(now: number) {
    for (const v of db
      .prepare(
        'SELECT id FROM yardVoyages WHERE closed=0 AND departed IS NULL AND expires<=? ORDER BY id',
      )
      .all(now))
      refund(Number(v.id));
    const arrivals = db.prepare(
      'SELECT v.*,s.name FROM yardVoyages v JOIN yardShips s ON s.id=v.ship WHERE v.closed=0 AND v.due<=? ORDER BY v.due,v.id',
    );
    for (const v of arrivals.all(now)) {
      const teams = harbor.receiveCharter(
        String(v.captain),
        String(v.skipper),
        String(v.name),
        Number(v.id),
        Number(v.due),
      );
      gold(String(v.captain), Number(v.wage));
      gold(String(v.sponsor), Number(v.freight));
      db.prepare(
        'UPDATE yardVoyages SET closed=1,settled=due,teams=? WHERE id=?',
      ).run(teams, v.id);
    }
  }
  function read(
    me: Actor | null,
    id: number | null,
    before: number | null,
    now: number,
  ) {
    const fleet = db
      .prepare('SELECT ' + hullColumns + ' FROM yardShips s ORDER BY s.id DESC')
      .all() as unknown as Hull[];
    const g = me ? guild.get(me.guildId) : null;
    const own = g
      ? db.prepare('SELECT id FROM yardShips WHERE guild=?').get(g.id)
      : null;
    const s = hull.get(id ?? own?.id ?? fleet[0]?.id ?? 0);
    const book: YardBook = {
      now,
      oak: rafts.portStock(),
      salt: harbor.salt(),
      seconds: sailingSeconds(weather()),
      fleet,
      wallet: me
        ? {
            uid: me.uid,
            gold: me.gold,
            mark: me.millMark ?? emptyMark,
            guildName: String(g?.name ?? ''),
            canCommission: !!g && !g.archived && g.founder === me.uid && !own,
          }
        : null,
      ship: null,
    };
    if (!s) return book;
    const uid = me?.uid ?? null;
    const deliveries = plank.all(s.id) as unknown as NonNullable<
      YardBook['ship']
    >['deliveries'];
    const fields = 'SELECT ' + logCols + ' FROM yardVoyages ';
    type Voyage = NonNullable<YardBook['ship']>['journal'][number];
    const rows = db
      .prepare(
        fields +
          'WHERE ship=? AND settled IS NOT NULL AND id<? ORDER BY id DESC LIMIT 9',
      )
      .all(
        uid,
        uid,
        s.id,
        before ?? Number.MAX_SAFE_INTEGER,
      ) as unknown as Voyage[];
    const job = db
      .prepare(fields + 'WHERE ship=? AND closed=0')
      .get(uid, uid, s.id) as unknown as Voyage | undefined;
    const charter = (v: Voyage): Voyage => ({
      ...v,
      mine: Boolean(v.mine),
      myJob: Boolean(v.myJob),
    });
    book.ship = {
      hull: fleet.find((x) => x.id === s.id)!,
      mayManage: master(me, s),
      archived: !!guild.get(s.guild)?.archived,
      oak: deliveries.filter((i) => i.kind === 'oak').length,
      iron: deliveries.filter((i) => i.kind === 'iron').length,
      deliveries,
      job: job ? charter(job) : null,
      journal: rows.slice(0, 8).map(charter),
      more: rows.length > 8,
      completed: Number(
        db
          .prepare(
            'SELECT COUNT(*) AS n FROM yardVoyages WHERE ship=? AND settled IS NOT NULL',
          )
          .get(s.id)!.n,
      ),
    };
    return book;
  }
  function command(
    me: Actor,
    action: string,
    ship: unknown,
    rawName: unknown,
    charter: unknown,
    now: number,
  ): number {
    if (action === 'commission') {
      const g = guild.get(me.guildId);
      check(
        g && !g.archived && g.founder === me.uid,
        'Pochylnię zamawia mistrz czynnej gildii.',
      );
      check(
        !db.prepare('SELECT id FROM yardShips WHERE guild=?').get(g.id),
        'Ta gildia ma już szkutę w rejestrze.',
      );
      check(me.gold >= r.berthPrice, 'W sakwie brakuje złota na stępkę.');
      gold(me.uid, -r.berthPrice);
      return Number(
        db
          .prepare(
            'INSERT INTO yardShips(guild,guildName,tag,owner,founder,begun) VALUES(?,?,?,?,?,?)',
          )
          .run(g.id, g.name, g.tag, me.uid, me.displayName, now)
          .lastInsertRowid,
      );
    }
    check(positive(ship), 'Wybierz statek z rejestru.');
    const s = hull.get(ship);
    check(s, 'W rejestrze nie ma takiego statku.');
    if (action === 'oak' || action === 'iron') {
      check(s.launched === null, 'Ta szkuta jest już na wodzie.');
      const isOak = action === 'oak',
        max = isOak ? r.oakLoads : r.ironLots,
        price = isOak ? r.oakPrice : r.ironPrice;
      const count = plank.all(ship).filter((row) => row.kind === action).length;
      check(
        count < max,
        'Wszystkie dostawy tego materiału są już na pochylni.',
      );
      check(me.gold >= price, 'W sakwie brakuje złota na zakup tej partii.');
      if (isOak)
        check(
          rafts.usePortLoad(),
          'Portowy skład jest pusty. Drewno przypłynie z flisakami z Gaju.',
        );
      gold(me.uid, -price);
      db.prepare(
        'INSERT INTO yardBuild(ship,kind,owner,name,at) VALUES(?,?,?,?,?)',
      ).run(ship, action, me.uid, me.displayName, now);
    } else if (action === 'launch') {
      check(master(me, s), 'Imię nadaje opiekun szkuty.');
      check(
        s.launched === null &&
          plank.all(ship).length === r.oakLoads + r.ironLots,
        'Do wodowania potrzeba całego poszycia i okuć.',
      );
      const name =
        typeof rawName === 'string'
          ? rawName.normalize('NFC').trim().replace(/\s+/g, ' ')
          : '';
      check(
        /^[\p{L}\p{N}][\p{L}\p{N} ’-]{2,31}$/u.test(name),
        'Wybierz imię od 3 do 32 znaków.',
      );
      const key = name.toLocaleLowerCase('pl');
      check(
        !db.prepare('SELECT id FROM yardShips WHERE nameKey=?').get(key),
        'Pod tym imieniem pływa już inna szkuta.',
      );
      db.prepare(
        'UPDATE yardShips SET name=?,nameKey=?,launched=? WHERE id=?',
      ).run(name, key, now, ship);
      db.prepare(
        'INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)',
      ).run(
        me.uid,
        me.displayName,
        'krolewska_przystan',
        'Zwodowano szkutę „' +
          name +
          '” pod proporcem gildii ' +
          s.guildName +
          '.',
      );
    } else if (action === 'hire') {
      check(
        master(me, s) && s.launched !== null,
        'List wystawia opiekun zwodowanej szkuty.',
      );
      check(!live.get(ship), 'Ta szkuta ma już list frachtowy.');
      check(me.gold >= r.wage, 'W sakwie brakuje złota na żołd szypra.');
      check(
        harbor.reserveSalt(),
        'Warzelnia musi najpierw dostarczyć cztery beczki soli.',
      );
      gold(me.uid, -r.wage);
      db.prepare(
        'INSERT INTO yardVoyages(ship,sponsor,payer,offered,expires,barrels,wage,freight) VALUES(?,?,?,?,?,?,?,?)',
      ).run(
        ship,
        me.uid,
        me.displayName,
        now,
        now + r.hiringMs,
        r.barrels,
        r.wage,
        r.freight,
      );
    } else {
      const v = live.get(ship);
      check(
        v && positive(charter) && v.id === charter && v.departed === null,
        'Ten list nie czeka już na szypra.',
      );
      if (action === 'withdraw') {
        check(
          v.sponsor === me.uid || master(me, s),
          'Tylko wystawca lub opiekun może wycofać list.',
        );
        refund(charter);
      } else {
        check(action === 'sail', 'Nieznana czynność w stoczni.');
        const sec = sailingSeconds(weather());
        check(sec !== null, 'Sztorm zamknął wyjście na redę.');
        check(
          !db
            .prepare('SELECT id FROM yardVoyages WHERE captain=? AND closed=0')
            .get(me.uid),
          'Prowadzisz już inny statek.',
        );
        db.prepare(
          'UPDATE yardVoyages SET captain=?,skipper=?,departed=?,due=? WHERE id=?',
        ).run(me.uid, me.displayName, now, now + sec * 1000, charter);
      }
    }
    return ship;
  }
  app.get('/api/shipyard', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      harbor.finishDue(now);
      advance(now);
      const selected = Number(req.query.ship),
        before = Number(req.query.before);
      const book = read(
        auth(req),
        positive(selected) ? selected : null,
        positive(before) ? before : null,
        now,
      );
      db.exec('COMMIT');
      res.json(book);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      next(e);
    }
  });
  app.post('/api/shipyard', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!auth(req)) {
      res
        .status(401)
        .json({ error: 'Zaloguj się, aby podpisać dokument w stoczni.' });
      return;
    }
    try {
      const { action, ship, name, charter, nonce } = req.body ?? {};
      check(
        typeof nonce === 'string' && /^[a-f0-9-]{36}$/i.test(nonce),
        'Dokument nie ma poprawnego numeru.',
      );
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      harbor.finishDue(now);
      advance(now);
      const me = auth(req)!;
      const payload = JSON.stringify([action, ship, name, charter]);
      const slip = db
        .prepare('SELECT payload,ship FROM yardSlips WHERE uid=? AND nonce=?')
        .get(me.uid, nonce);
      let selected: number;
      if (slip) {
        check(
          slip.payload === payload,
          'Ten podpis widnieje już na innym dokumencie.',
        );
        selected = Number(slip.ship);
      } else {
        selected = command(me, action, ship, name, charter, now);
        db.prepare('INSERT INTO yardSlips VALUES(?,?,?,?)').run(
          me.uid,
          nonce,
          payload,
          selected,
        );
      }
      const book = read(auth(req), selected, null, now);
      db.exec('COMMIT');
      res.json(book);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof YardRule) res.status(409).json({ error: e.message });
      else next(e);
    }
  });
  return { advance };
}
