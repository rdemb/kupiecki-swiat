import { installReturnFreight, ReturnRule } from './returnFreight';
import { maidenRegister } from './maidenVoyage';
import { installLighters } from './lighters';
import { installPilotage, PilotRule } from './pilotage';
import {
  passageSeconds,
  transferSeconds,
  maxSoundingPledge,
} from '../src/economy/pilotage';
import type { Express, Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { emptyMark, type MillMark } from '../src/economy/mill';
import {
  sailingSeconds,
  shipRules as r,
  type Hull,
  type LaunchBoard,
  type LaunchNotice,
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
  transfer: (uid: string, gold: number, grain: number) => void,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS yardShips(id INTEGER PRIMARY KEY, guild TEXT NOT NULL UNIQUE,guildName TEXT NOT NULL,
      tag TEXT NOT NULL,owner TEXT NOT NULL,founder TEXT NOT NULL,begun INTEGER NOT NULL,name TEXT,nameKey TEXT UNIQUE,launched INTEGER);
    CREATE TABLE IF NOT EXISTS yardBuild(id INTEGER PRIMARY KEY,ship INTEGER NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('oak','iron')),
      owner TEXT NOT NULL,name TEXT NOT NULL,at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS yardBuildHull ON yardBuild(ship,id);
    CREATE TABLE IF NOT EXISTS yardInvitations(ship INTEGER PRIMARY KEY REFERENCES yardShips(id), signer TEXT NOT NULL, posted INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS yardVoyages(id INTEGER PRIMARY KEY, ship INTEGER NOT NULL,sponsor TEXT NOT NULL,payer TEXT NOT NULL,
      captain TEXT,skipper TEXT,offered INTEGER NOT NULL,expires INTEGER NOT NULL,departed INTEGER,due INTEGER,settled INTEGER,
      closed INTEGER NOT NULL DEFAULT 0,barrels INTEGER NOT NULL,wage INTEGER NOT NULL,freight INTEGER NOT NULL, teams INTEGER NOT NULL DEFAULT 0);
    CREATE UNIQUE INDEX IF NOT EXISTS yardOneTrip ON yardVoyages(ship) WHERE closed=0;
    CREATE UNIQUE INDEX IF NOT EXISTS yardOneHelm ON yardVoyages(captain) WHERE closed=0 AND captain IS NOT NULL;
    CREATE INDEX IF NOT EXISTS yardPortLog ON yardVoyages(ship,id DESC) WHERE settled IS NOT NULL;
    CREATE TABLE IF NOT EXISTS yardSlips(uid TEXT NOT NULL,nonce TEXT NOT NULL,payload TEXT NOT NULL,ship INTEGER NOT NULL,PRIMARY KEY(uid,nonce));
  `);
  const pilots = installPilotage(db, gold);
  const lighters = installLighters(db, gold);
  const maidens = maidenRegister(db);
  const returns = installReturnFreight(db, transfer);
  const hull = db.prepare('SELECT * FROM yardShips WHERE id=?');
  const guild = db.prepare(
    'SELECT id,name,tag,founder,archived FROM innGuilds WHERE id=?',
  );
  const plank = db.prepare(
    'SELECT id,name,kind,at FROM yardBuild WHERE ship=? ORDER BY id',
  );
  const invitation = db.prepare(
    'SELECT signer,posted FROM yardInvitations WHERE ship=?',
  );
  // Deliveries and launch status always come from the ship's original register.
  const notices = `SELECT s.id AS ship,s.guildName AS guild,i.signer,i.posted,s.name AS vessel,s.launched,
    ${r.oakLoads}-(SELECT COUNT(*) FROM yardBuild b WHERE b.ship=s.id AND b.kind='oak') AS oakMissing,
    ${r.ironLots}-(SELECT COUNT(*) FROM yardBuild b WHERE b.ship=s.id AND b.kind='iron') AS ironMissing
    FROM yardInvitations i JOIN yardShips s ON s.id=i.ship JOIN innGuilds g ON g.id=s.guild `;
  const openNotices = db.prepare(
    notices +
      'WHERE s.launched IS NULL AND g.archived=0 ORDER BY i.posted,s.id',
  );
  const lastLaunch = db.prepare(
    notices +
      'WHERE s.launched IS NOT NULL ORDER BY s.launched DESC,s.id DESC LIMIT 1',
  );
  function launchBoard(uid: string | null): LaunchBoard {
    return {
      returns: returns.board(uid, Date.now()),
      lastMaiden: maidens.latest(),
      open: openNotices.all() as unknown as LaunchNotice[],
      lastLaunch:
        (lastLaunch.get() as unknown as LaunchNotice | undefined) ?? null,
      portOak: rafts.portStock(),
    };
  }
  const live = db.prepare(
    'SELECT * FROM yardVoyages WHERE ship=? AND closed=0',
  );
  const logCols = `v.id,v.payer,v.skipper,v.offered,v.expires,v.departed,v.due,v.settled,v.teams,v.barrels,v.wage,v.freight,
     v.sponsor=? AS mine,v.captain=? AS myJob,COALESCE(l.course,'outer') AS course,
     witness.skipper AS pilot,m.cm AS depth,boat.name AS boatman,boat.barrels AS moved,boat.fee AS fare`;
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
    lighters.expire(now);
    returns.expire(now);
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
      pilots.land(Number(v.id), Number(v.due));
      const teams = harbor.receiveCharter(
        String(v.captain),
        String(v.skipper),
        String(v.name),
        Number(v.id),
        Number(v.due),
      );
      lighters.land(Number(v.id), Number(v.due));
      returns.land(Number(v.id), String(v.captain));
      gold(String(v.captain), Number(v.wage));
      gold(String(v.sponsor), Number(v.freight));
      db.prepare(
        'UPDATE yardVoyages SET closed=1,settled=due,teams=? WHERE id=?',
      ).run(teams, v.id);
    }
    // Arrivals up to this instant saw the previous seabed. Then record the new weather front.
    pilots.observe(weather(), now);
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
      returns: returns.board(me?.uid ?? null, now),
      now,
      oak: rafts.portStock(),
      salt: harbor.salt(),
      seconds: sailingSeconds(weather()),
      fleet,
      lighterOffers: lighters.offers(me?.uid ?? null),
      pilotage: pilots.book(me?.uid),
      wallet: me
        ? {
            uid: me.uid,
            gold: me.gold,
            mark: me.millMark ?? emptyMark,
            guildName: String(g?.name ?? ''),
            duty: lighters.duty(me.uid),
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
    const fields =
      'SELECT ' +
      logCols +
      ` FROM yardVoyages v
      LEFT JOIN pilotLegs l ON l.voyage=v.id
      LEFT JOIN pilotSoundings m ON m.voyage=CASE WHEN l.course='cut' THEN l.reference ELSE v.id END
      LEFT JOIN yardLighters boat ON boat.voyage=v.id
      LEFT JOIN yardVoyages witness ON witness.id=m.voyage `;
    type Voyage = NonNullable<YardBook['ship']>['journal'][number];
    type RecordRow = Omit<Voyage, 'lighter' | 'backhaul'> & {
      boatman: string | null;
      moved: number;
      fare: number;
    };
    const rows = db
      .prepare(
        fields +
          'WHERE v.ship=? AND v.settled IS NOT NULL AND v.id<? ORDER BY v.id DESC LIMIT 9',
      )
      .all(
        uid,
        uid,
        s.id,
        before ?? Number.MAX_SAFE_INTEGER,
      ) as unknown as RecordRow[];
    const job = db
      .prepare(fields + 'WHERE v.ship=? AND v.closed=0')
      .get(uid, uid, s.id) as unknown as RecordRow | undefined;
    const charter = ({ boatman, moved, fare, ...v }: RecordRow): Voyage => ({
      ...v,
      backhaul: returns.choice(v.id),
      lighter: boatman ? { name: boatman, barrels: moved, fee: fare } : null,
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
      invitation:
        (invitation.get(s.id) as unknown as NonNullable<
          YardBook['ship']
        >['invitation']) ?? null,
      maiden: maidens.letter(Number(s.id), uid),
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
    course: unknown,
    reference: unknown,
    offer: unknown,
    fee: unknown,
    ask: unknown,
    now: number,
  ): number {
    if (action === 'postReturn') {
      returns.post(me, fee, ask, now);
      return 0;
    }
    if (action === 'cancelReturn' || action === 'buyReturn' || action === 'collectReturn') {
      check(positive(offer), 'Wybierz zlecenie frachtowe.');
      returns.trade(me, action, offer);
      return 0;
    }
    if (action === 'offerLighter' || action === 'recallLighter') {
      if (action === 'offerLighter') lighters.post(me, fee, now);
      else {
        check(positive(offer), 'Wybierz ofertę lichtugi.');
        lighters.recall(me.uid, offer, now);
      }
      return positive(ship) ? ship : 0;
    }
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
    if (action === 'loadReturn' || action === 'emptyReturn') {
      check(positive(charter), 'Wybierz czynny rejs.');
      if (action === 'loadReturn') {
        check(positive(offer), 'Wybierz ładunek na redzie.');
        returns.choose(me.uid, ship, charter, offer, now);
      } else returns.choose(me.uid, ship, charter, null, now);
    } else if (action === 'signMaiden') {
      check(positive(charter), 'Wybierz list z pierwszego rejsu tej szkuty.');
      const problem = maidens.sign(ship, charter, me.uid, me.displayName, now);
      if (problem) throw new YardRule(problem);
    } else if (action === 'inviteBuilders' || action === 'removeInvitation') {
      check(s.launched === null, 'Ta szkuta została już zwodowana.');
      check(
        !guild.get(s.guild)?.archived && master(me, s),
        'Zaproszeniem rozporządza mistrz czynnej gildii.',
      );
      if (action === 'inviteBuilders') {
        check(
          !invitation.get(ship),
          'Zaproszenie na tę pochylnię już wisi w gospodzie.',
        );
        check(
          plank.all(ship).length < r.oakLoads + r.ironLots,
          'Kadłub ma już wszystkie materiały.',
        );
        db.prepare(
          'INSERT INTO yardInvitations(ship,signer,posted) VALUES(?,?,?)',
        ).run(ship, me.displayName, now);
      } else {
        check(
          db.prepare('DELETE FROM yardInvitations WHERE ship=?').run(ship)
            .changes,
          'W karczmie nie ma tego zaproszenia.',
        );
      }
    } else if (action === 'oak' || action === 'iron') {
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
        lighters.requireAshore(me.uid);
        const way = course === undefined ? 'outer' : course;
        check(
          way === 'outer' || way === 'survey' || way === 'cut',
          'Wybierz tor z mapy Zatoki.',
        );
        const mark = positive(reference) ? reference : null;
        let seconds = passageSeconds(sec, way);
        if (offer !== undefined) {
          check(
            way === 'cut' && mark !== null && positive(offer),
            'Wybierz lichtugę i podpisany pomiar.',
          );
          const barrels = lighters.embark(me, charter, offer, mark);
          seconds = transferSeconds(sec, barrels);
        } else if (way === 'cut') {
          check(
            mark !== null && pilots.supports(mark),
            'Ten pomiar nie potwierdza przejścia. Wybierz tor zewnętrzny albo wypłyń z sondą.',
          );
        }
        lighters.offDuty(me.uid, now);
        pilots.depart(charter, way, way === 'cut' ? mark : null);
        db.prepare(
          'UPDATE yardVoyages SET captain=?,skipper=?,departed=?,due=? WHERE id=?',
        ).run(me.uid, me.displayName, now, now + seconds * 1000, charter);
      }
    }
    return ship;
  }
  app.post('/api/pilots/pledges', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!auth(req)) {
      res.status(401).json({ error: 'Zaloguj się, aby ufundować pomiar.' });
      return;
    }
    try {
      const { edition, amount, nonce } = req.body ?? {};
      check(positive(edition), 'Brakuje numeru wydania księgi.');
      check(
        positive(amount) && amount <= maxSoundingPledge,
        'Wpisz od 1 do ' + maxSoundingPledge + ' pełnych monet.',
      );
      check(
        typeof nonce === 'string' && /^[a-f0-9-]{36}$/i.test(nonce),
        'Brakuje podpisu na kwicie.',
      );
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      advance(now);
      const me = auth(req)!;
      pilots.pledge(me, edition, amount, nonce, now);
      const payer = auth(req)!;
      const result = {
        book: pilots.book(payer.uid),
        uid: payer.uid,
        mark: payer.millMark ?? emptyMark,
      };
      db.exec('COMMIT');
      res.json(result);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof YardRule || e instanceof PilotRule)
        res.status(409).json({ error: e.message });
      else next(e);
    }
  });
  app.get('/api/pilots', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.query.before === undefined) {
      res.json(pilots.book());
      return;
    }
    const before = Number(req.query.before);
    if (!positive(before)) {
      res.status(400).json({ error: 'Nieprawidłowa karta księgi.' });
      return;
    }
    res.json(pilots.folio(before));
  });
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
      const {
        action,
        ship,
        name,
        charter,
        course,
        reference,
        offer,
        fee,
        ask,
        nonce,
      } = req.body ?? {};
      check(
        typeof nonce === 'string' && /^[a-f0-9-]{36}$/i.test(nonce),
        'Dokument nie ma poprawnego numeru.',
      );
      const now = Date.now();
      db.exec('BEGIN IMMEDIATE');
      harbor.finishDue(now);
      advance(now);
      const me = auth(req)!;
      // Keep receipts from clients that predate route selection replayable.
      const parts = [action, ship, name, charter];
      if (course !== undefined || reference !== undefined)
        parts.push(course, reference);
      if (offer !== undefined || fee !== undefined) parts.push({ offer, fee });
      if (ask !== undefined) parts.push({ ask });
      const payload = JSON.stringify(parts);
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
        selected = command(
          me,
          action,
          ship,
          name,
          charter,
          course,
          reference,
          offer,
          fee,
          ask,
          now,
        );
        db.prepare('INSERT INTO yardSlips VALUES(?,?,?,?)').run(
          me.uid,
          nonce,
          payload,
          selected,
        );
      }
      const book = read(auth(req), selected || null, null, now);
      db.exec('COMMIT');
      res.json(book);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof YardRule || e instanceof PilotRule || e instanceof ReturnRule)
        res.status(409).json({ error: e.message });
      else next(e);
    }
  });
  // Catch up any crossing that ended while the world clock was paused.
  db.exec('BEGIN IMMEDIATE');
  try {
    advance(Date.now());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { advance, pilotBook: pilots.book, launchBoard };
}
