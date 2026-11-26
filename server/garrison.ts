import type { DatabaseSync } from 'node:sqlite';
import type { BarterTerms } from '../src/economy/barter';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import type { FeastTown } from '../src/economy/harvestLoaf';
import {
  hallRules,
  rationPlan,
  rationNames,
  type Ration,
  otherPost,
  roadRank,
  units,
  unitTypes,
  type Dispatch,
  type GarrisonBook,
} from '../src/economy/garrison';
import { openSpurTrial } from './spurTrial';
import { openGuildRelay } from './guildRelay';
import { openStandardSchool } from './standardSchool';
import { mentorMarks, schoolLegSeconds } from '../src/economy/standardSchool';
import { journeySeconds } from '../src/economy/waybills';
import { FeastRule } from './harvestLoaf';

function requireRule(test: unknown, message: string): asserts test {
  if (!test) throw new FeastRule(message);
}
type Transfer = (uid: string, gold: number, grain: number, iron?: number, wood?: number) => void;
type Member = NonNullable<GarrisonBook['mine']>;
export function openGarrison(db: DatabaseSync, transfer: Transfer) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS garrisonKitchens(town TEXT PRIMARY KEY, portions INTEGER NOT NULL CHECK(portions>=0), carrier TEXT NOT NULL, sacks INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS garrisonMorale(town TEXT NOT NULL,uid TEXT NOT NULL,fatigue INTEGER NOT NULL CHECK(fatigue BETWEEN 0 AND 3),PRIMARY KEY(town,uid));
    CREATE TABLE IF NOT EXISTS garrisonHalls(uid TEXT NOT NULL,town TEXT NOT NULL,level INTEGER NOT NULL, PRIMARY KEY(uid,town));
    CREATE TABLE IF NOT EXISTS garrisonMusters(id INTEGER PRIMARY KEY,uid TEXT NOT NULL,town TEXT NOT NULL,unit TEXT NOT NULL,qty INTEGER NOT NULL,at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS garrisonRoll ON garrisonMusters(uid,town,at);
    CREATE TABLE IF NOT EXISTS knightDuties(id INTEGER PRIMARY KEY,uid TEXT NOT NULL,town TEXT NOT NULL,label TEXT NOT NULL,due INTEGER NOT NULL,marks INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS knightDue ON knightDuties(uid,due);
    CREATE TABLE IF NOT EXISTS marketNews(circle INTEGER PRIMARY KEY REFERENCES barterCircles(id),origin TEXT NOT NULL,destination TEXT NOT NULL,uid TEXT NOT NULL,carrier TEXT NOT NULL,signed INTEGER NOT NULL,departed INTEGER NOT NULL,arrival INTEGER NOT NULL,road TEXT NOT NULL,weather TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS newsAtInn ON marketNews(destination,arrival);
    CREATE INDEX IF NOT EXISTS newsWagon ON marketNews(uid,arrival);
  `);
  const school = openStandardSchool(db);
  const relay = openGuildRelay(db,transfer);
  const spurs = openSpurTrial(db);
  const localGuides = (town: FeastTown, uid: string, now: number) =>
    school.guides(town,uid,now).map(g => ({...g,knighted:spurs.knighted(g.id),relayDue:relay.guideDue(g.id,now)}));
  const terms = db.prepare(
    'SELECT give,giveQty,want,wantQty FROM barterOffers WHERE circle=? ORDER BY id',
  );
  const legs = (id: number) => terms.all(id) as unknown as BarterTerms[];
  const arrived = db.prepare(
    'SELECT circle,origin,destination,carrier,signed,departed,arrival,road,weather FROM marketNews WHERE destination=? AND arrival<=? ORDER BY arrival DESC,circle DESC LIMIT 6',
  );
  function letters(town: string, now: number): Dispatch[] {
    return arrived
      .all(town, now)
      .map((row) => ({ ...row, terms: legs(Number(row.circle)) })) as unknown as Dispatch[];
  }
  const hour = 3600_000;
  function member(town: FeastTown, uid: string, now: number): Member {
    const hero = db
      .prepare(
        "SELECT json_extract(profile,'$.knight.name') name FROM players WHERE json_extract(profile,'$.uid')=?",
      )
      .get(uid);
    const level = Number(
      db.prepare('SELECT level FROM garrisonHalls WHERE uid=? AND town=?').get(uid, town)?.level ??
        0,
    );
    const counts = { guards: 0, archers: 0, axemen: 0 };
    const rolls = db
      .prepare('SELECT unit,sum(qty) qty FROM garrisonMusters WHERE uid=? AND town=? GROUP BY unit')
      .all(uid, town);
    for (const kind of unitTypes)
      counts[kind] = Number(rolls.find((r) => r.unit === kind)?.qty ?? 0);
    const spent = db
      .prepare(
        'SELECT sum(qty) hired,min(at) earliest FROM garrisonMusters WHERE uid=? AND town=? AND at>?',
      )
      .get(uid, town, now - hour)!;
    const duty = db
      .prepare('SELECT town,label,due FROM knightDuties WHERE uid=? AND due>? ORDER BY due LIMIT 1')
      .get(uid, now) as unknown as Member['duty'];
    const marks = Number(
      db
        .prepare('SELECT sum(marks) AS total FROM knightDuties WHERE uid=? AND due<=?')
        .get(uid, now)?.total ?? 0,
    );
    const wagon = db
      .prepare(
        `SELECT destination,arrival,0 AS "returning" FROM marketNews WHERE uid=? AND arrival>?
         UNION ALL SELECT CASE WHEN arrival<=? THEN origin ELSE destination END,
           CASE WHEN arrival<=? THEN returns ELSE arrival END, arrival<=?
           FROM schoolWagons WHERE driver=? AND returns>? ORDER BY arrival LIMIT 1`,
      )
      .get(uid, now, now, now, now, uid, now) as unknown as Member['wagon'];
    return {
      name: String(hero?.name || 'Rycerz'),
      level,
      counts,
      fatigue: Number(db.prepare('SELECT fatigue FROM garrisonMorale WHERE town=? AND uid=?').get(town,uid)?.fatigue ?? 0),
      available: Math.min(
        level * hallRules.hourly - Number(spent.hired ?? 0),
        level * hallRules.beds - rolls.reduce((total, row) => total + Number(row.qty), 0),
      ),
      refill: spent.earliest === null ? null : Number(spent.earliest) + hour,
      marks,
      duty: duty ?? null,
      wagon: wagon ?? relay.wagon(uid,now),
    };
  }
  function book(town: FeastTown, uid: string | null, now: number, closed: boolean, weather: WeatherConditionId): GarrisonBook {
    const rows = db
      .prepare(
        'SELECT c.id,c.completed signed,n.circle sent FROM barterCircles c LEFT JOIN marketNews n ON n.circle=c.id WHERE c.town=? AND c.completed IS NOT NULL ORDER BY c.completed DESC,c.id DESC LIMIT 5',
      )
      .all(town);
    const kitchen = db.prepare('SELECT portions,carrier,sacks FROM garrisonKitchens WHERE town=?').get(town);
    return {
      spurs: spurs.book(town,uid),
      relay: relay.book(uid),
      school: { closed, weather, guides: uid ? localGuides(town,uid,now) : [] },
      kitchen: {portions:Number(kitchen?.portions ?? 0), lastDelivery:kitchen ? {carrier:String(kitchen.carrier), sacks:Number(kitchen.sacks)} : null},
      now,
      documents: rows.map((r) => ({
        id: Number(r.id),
        signed: Number(r.signed),
        terms: legs(Number(r.id)),
        sent: r.sent !== null,
      })),
      letters: letters(town, now),
      mine: uid ? member(town, uid, now) : null,
    };
  }
  const duty = db.prepare('INSERT INTO knightDuties(uid,town,label,due,marks) VALUES(?,?,?,?,?)');
  // All commands share the mill transaction, including supplies, receipts and the sealed dispatch.
  function command(
    town: FeastTown,
    me: { uid: string; displayName: string },
    cmd: Record<string, unknown>,
    now: number,
    weather: WeatherConditionId,
    closed: boolean,
  ) {
    const uid = me.uid;
    if (cmd.action === 'witnessSpur') {
      spurs.witness(town,me,cmd.load,cmd.testimony);
      return;
    }
    if (cmd.action === 'stockKitchen') {
      const sacks = cmd.quantity;
      requireRule(typeof sacks === 'number' && Number.isSafeInteger(sacks) && sacks >= 1 && sacks <= 20, 'Wybierz od 1 do 20 worków.');
      transfer(uid, 0, -sacks);
      db.prepare(`INSERT INTO garrisonKitchens VALUES(?,?,?,?) ON CONFLICT(town) DO UPDATE SET
        portions=portions+excluded.portions,carrier=excluded.carrier,sacks=excluded.sacks`).run(town,sacks*2,me.displayName,sacks);
      return;
    }
    const m = member(town, uid, now);
    function provision(crew: number) {
      const ration = cmd.ration === undefined ? 'pack' : cmd.ration;
      requireRule(typeof ration === 'string' && Object.hasOwn(rationNames,ration), 'Wybierz sposób wydania racji.');
      const plan = rationPlan(ration as Ration, crew, m.fatigue);
      if (plan.portions) {
        const taken = db.prepare('UPDATE garrisonKitchens SET portions=portions-? WHERE town=? AND portions>=?').run(plan.portions,town,plan.portions);
        requireRule(taken.changes === 1, 'Kuchnia ma za mało porcji. Sprawdź zapas lub weź własny prowiant.');
      }
      if (plan.grain) transfer(uid, 0, -plan.grain);
      if (plan.fatigue !== m.fatigue)
        db.prepare('INSERT INTO garrisonMorale VALUES(?,?,?) ON CONFLICT(town,uid) DO UPDATE SET fatigue=excluded.fatigue').run(town,uid,plan.fatigue);
      return plan.delay;
    }
    if (cmd.action === 'startRelay' || cmd.action === 'rideToRelay' || cmd.action === 'takeRelay') {
      relay.command(town,uid,cmd,now,weather,closed,localGuides(town,uid,now),!!m.wagon,provision);
      return;
    }
    if (cmd.action === 'enrolSquire') {
      requireRule(m.level > 0 && m.available > 0, 'Potrzebujesz miejsca w koszarach i wolnego poboru.');
      school.enrol(town,uid,cmd.name);
      transfer(uid,-units.guards.price,-1);
      db.prepare("INSERT INTO garrisonMusters(uid,town,unit,qty,at) VALUES(?,?,'squire',1,?)").run(uid,town,now);
      return;
    }
    if (cmd.action === 'guideWagon') {
      const { road, lesson } = cmd;
      requireRule((road === 'bridge' || road === 'detour') && typeof lesson === 'boolean', 'Wybierz drogę i obsadę wozu.');
      requireRule(road !== 'bridge' || !closed, 'Most jest zamknięty. Wybierz górny bród.');
      requireRule(!m.wagon, 'Twój wóz jest jeszcze na trakcie.');
      const guide = localGuides(town,uid,now).find(g => g.id === cmd.guide);
      requireRule(guide && !guide.trip && !guide.relayDue, 'Ten przewodnik jest w drodze lub poza twoją chorągwią.');
      const trained = guide.learned.find(entry => entry.road === road);
      if (lesson) {
        requireRule(guide.own && !trained && !m.duty && m.marks >= mentorMarks,
          'Nauka wymaga własnego ucznia, nowej drogi i wolnego rycerza z trzema punktami służby.');
      } else {
        requireRule(trained, 'Samodzielny przewóz wymaga powrotu z nauki dokładnie tą drogą.');
      }
      const delay = provision(1);
      transfer(uid,0,-1);
      const seconds = schoolLegSeconds(road, weather, delay);
      const returns = school.depart(town,uid,guide.id,road,lesson ? m.name : trained!.mentor,lesson,now,seconds);
      if (lesson) duty.run(uid,town,'Nauka traktu · ' + guide.name,returns,2);
      return;
    }
    if (cmd.action === 'fundGarrison') {
      requireRule(
        m.level === cmd.level && m.level < hallRules.max,
        'Stan garnizonu się zmienił. Sprawdź księgę.',
      );
      transfer(uid, -hallRules.gold, 0, 0, -hallRules.wood);
      db.prepare(
        'INSERT INTO garrisonHalls VALUES(?,?,1) ON CONFLICT(uid,town) DO UPDATE SET level=level+1',
      ).run(uid, town);
      return;
    }
    if (cmd.action === 'carryNews') {
      requireRule(
        typeof cmd.circle === 'number' &&
          Number.isSafeInteger(cmd.circle) &&
          typeof cmd.escort === 'boolean',
        'Wybierz zapieczętowany odpis i sposób podróży.',
      );
      const source = db
        .prepare(
          'SELECT completed FROM barterCircles WHERE town=? AND id=? AND completed IS NOT NULL',
        )
        .get(town, cmd.circle);
      requireRule(source, 'Odpis wystawia miasto, w którym zamknięto wymianę.');
      requireRule(!m.wagon, 'Twój wóz jest jeszcze na trakcie.');
      requireRule(
        !db.prepare('SELECT 1 FROM marketNews WHERE circle=?').get(cmd.circle),
        'Ten odpis został już zabrany.',
      );
      if (cmd.escort)
        requireRule(
          !m.duty && m.counts.guards > 0,
          'Eskorta wymaga wolnego rycerza i miejscowego gwardzisty.',
        );
      const road = closed ? 'detour' : 'bridge';
      const rationDelay = cmd.escort ? provision(1) : 0;
      const seconds =
        journeySeconds(1, weather, road) * 2 - (cmd.escort ? 4 + roadRank(m.marks).seconds : 0) + rationDelay;
      const arrival = now + seconds * 1000;
      transfer(uid, 0, -1);
      db.prepare(
        'INSERT INTO marketNews(circle,origin,destination,uid,carrier,signed,departed,arrival,road,weather) VALUES(?,?,?,?,?,?,?,?,?,?)',
      ).run(
        cmd.circle,
        town,
        otherPost(town),
        uid,
        me.displayName,
        source.completed,
        now,
        arrival,
        road,
        weather,
      );
      if (cmd.escort)
        duty.run(uid, town, 'Eskorta odpisu i powrót do koszar', arrival + seconds * 1000, 2);
      return;
    }
    const unit = unitTypes.find((u) => u === cmd.unit);
    requireRule(unit && m.level > 0, 'Najpierw ufunduj miejscowy garnizon i wybierz formację.');
    const rules = units[unit];
    if (cmd.action === 'recruitUnit') {
      const qty = cmd.quantity;
      requireRule(
        typeof qty === 'number' && Number.isSafeInteger(qty) && qty >= 1 && qty <= m.available,
        'Brakuje miejsc w zamku lub wolnego poboru na tę godzinę.',
      );
      transfer(uid, -qty * rules.price, -qty);
      db.prepare('INSERT INTO garrisonMusters(uid,town,unit,qty,at) VALUES(?,?,?,?,?)').run(
        uid,
        town,
        unit,
        qty,
        now,
      );
      return;
    }
    requireRule(cmd.action === 'knightDuty' && !m.duty, 'Rycerz jest już na służbie.');
    requireRule(m.counts[unit] >= rules.crew, 'W koszarach brakuje ludzi tej formacji.');
    const delay = provision(rules.crew);
    duty.run(uid, town, rules.duty, now + (rules.time + delay) * 1000, rules.marks);
  }
  return { book, letters, command, school, relay, spurs };
}
