import type { MillMark } from '../src/economy/mill';
import type { LaunchBoard } from '../src/economy/shipyard';
import type { PilotBook } from '../src/economy/pilotage';
import type { RiverReading } from '../src/economy/river';
import { bridgeSite } from '../src/economy/bridge';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Express, Request } from 'express';
import { isFairTown, type FairBook } from '../src/economy/harvestFair';
import { CITIES } from '../src/economy/economyEngine';
import type { GuildInfo } from '../src/economy/gameData';
import { convoyReduction, noticeKinds } from '../src/economy/merchantInn';

class InnRule extends Error {}
function requireRule(ok: unknown, msg: string): asserts ok {
  if (!ok) throw new InnRule(msg);
}
const clean = (value: unknown) => (typeof value === 'string' ? value.normalize('NFC').trim() : '');
const week = 7 * 86400_000;
export function installMerchantInn(
  app: Express,
  db: DatabaseSync,
  authenticate: (req: Request) => { uid: string; displayName: string; guildId: string; millMark?: MillMark } | null,
  companies: GuildInfo[],
  riverReports: (now: number) => RiverReading[],
  pilotBook: (uid: string | null) => PilotBook,
  launchBoard: (uid: string | null) => LaunchBoard,
  harvestTable: (city:string, now:number)=>import('../src/economy/harvestLoaf').Loaf[],
  fairBook: (city:string, now:number)=>FairBook,
  barterCalls: (city: string) => import('../src/economy/barter').BarterCall[],
) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS innGuilds(id TEXT PRIMARY KEY, name TEXT NOT NULL, nameKey TEXT NOT NULL UNIQUE, tag TEXT NOT NULL UNIQUE, founder TEXT, archived INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS innPetitions(uid TEXT PRIMARY KEY, guild TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS innLetters(id INTEGER PRIMARY KEY, guild TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS innLetterPage ON innLetters(guild,id DESC);
  CREATE TABLE IF NOT EXISTS innNotices(id INTEGER PRIMARY KEY, city TEXT NOT NULL, owner TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, at INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX IF NOT EXISTS innNoticePage ON innNotices(city,closed,at);
  CREATE TABLE IF NOT EXISTS innSigns(notice INTEGER NOT NULL, uid TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(notice,uid));
  CREATE TABLE IF NOT EXISTS innReceipts(owner TEXT NOT NULL, nonce TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(owner,nonce));`);
  const seed = db.prepare('INSERT OR IGNORE INTO innGuilds(id,name,nameKey,tag) VALUES(?,?,?,?)');
  for (const g of companies) seed.run(g.id, g.name, g.name.toLocaleLowerCase('pl'), g.tag);
  const people =
    "(SELECT json_extract(profile,'$.uid') uid,json_extract(profile,'$.displayName') name,json_extract(profile,'$.guildId') guild FROM players)";
  const members = db.prepare('SELECT uid,name FROM ' + people + ' WHERE guild=? ORDER BY name,uid');
  const group = db.prepare('SELECT * FROM innGuilds WHERE id=? AND archived=0');
  const setMembership = db.prepare(
    "UPDATE players SET profile=json_set(profile,'$.guildId',?) WHERE json_extract(profile,'$.uid')=?",
  );
  const population = db.prepare('SELECT count(*) AS n FROM ' + people + ' WHERE guild=?');
  const requests = db.prepare('DELETE FROM innPetitions WHERE uid=?');
  const current = db.prepare('SELECT guild FROM ' + people + ' WHERE uid=?');
  function move(uid: string, guild: string) {
    setMembership.run(guild, uid);
    requests.run(uid);
  }
  function read(uid: string | null, city: string) {
    const membership = uid ? String(current.get(uid)?.guild ?? '') : '';
    const mine = group.get(membership);
    const boardAt = Date.now();
    return {
      uid,
      membership: mine ? membership : '',
      applied: uid
        ? (db.prepare('SELECT guild FROM innPetitions WHERE uid=?').get(uid)?.guild ?? null)
        : null,
      groups: db
        .prepare(
          'SELECT g.id,g.name,g.tag,g.founder,(g.founder IS NOT NULL) privateHall,(SELECT COUNT(*) FROM ' +
            people +
            ' p WHERE p.guild=g.id) count FROM innGuilds g WHERE archived=0 ORDER BY g.name',
        )
        .all(),
      members: mine ? members.all(membership) : [],
      applicants:
        uid && mine?.founder === uid
          ? db
              .prepare(
                'SELECT p.uid,p.name FROM innPetitions a JOIN ' +
                  people +
                  ' p ON p.uid=a.uid WHERE a.guild=? ORDER BY p.name',
              )
              .all(membership)
          : [],
      letters: mine
        ? db
            .prepare(
              'SELECT id,name,body,at FROM innLetters WHERE guild=? ORDER BY id DESC LIMIT 60',
            )
            .all(membership)
            .reverse()
        : [],
      boardAt,
      harvestTable:harvestTable(city,boardAt),
      ...(isFairTown(city) ? {fair:fairBook(city,boardAt), barterCalls:barterCalls(city)} : {}),
      launches: city === 'krolewska_przystan' ? launchBoard(uid) : null,
      pilotage: city === 'krolewska_przystan' ? pilotBook(uid) : null,
      riverReports: city === bridgeSite ? riverReports(boardAt) : [],
      notices: db
        .prepare(
          `SELECT n.id,n.owner,n.name,n.kind,n.body,n.at,(SELECT json_group_array(s.name) FROM innSigns s WHERE s.notice=n.id) AS signed,EXISTS(SELECT 1 FROM innSigns s WHERE s.notice=n.id AND s.uid=?) AS volunteered FROM innNotices n WHERE n.city=? AND n.closed=0 AND n.at>? ORDER BY n.id DESC LIMIT 60`,
        )
        .all(uid ?? '', city, Date.now() - week)
        .map((row) => ({ ...row, signed: JSON.parse(String(row.signed)) })),
    };
  }
  app.get('/api/inn/:city', (req, res) => {
    if (!CITIES.some((c) => c.id === req.params.city)) {
      res.sendStatus(404);
      return;
    }
    const me = authenticate(req);
    res.set('Cache-Control', 'private, no-store')
      .json({ ...read(me?.uid ?? null, String(req.params.city)), walletMark: me?.millMark ?? null });
  });
  app.post('/api/inn/:city', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    const me = authenticate(req),
      city = String(req.params.city);
    if (!me) {
      res.status(401).json({ error: 'Najpierw zaloguj się jako kupiec.' });
      return;
    }
    const {
      action,
      nonce,
      groupId = '',
      who = '',
      notice = 0,
      kind = '',
      tag = '',
      body = '',
    } = req.body ?? {};
    const payload = JSON.stringify([city, action, groupId, who, notice, kind, tag, body]);
    const now = Date.now(),
      uid = me.uid;
    try {
      requireRule(
        CITIES.some((c) => c.id === city) &&
          typeof nonce === 'string' &&
          /^[0-9a-f-]{36}$/i.test(nonce),
        'Nieprawidłowy dokument.',
      );
      db.exec('BEGIN IMMEDIATE');
      const prior = db
        .prepare('SELECT payload FROM innReceipts WHERE owner=? AND nonce=?')
        .get(uid, nonce);
      if (prior) requireRule(prior.payload === payload, 'Ten dokument został już użyty.');
      else {
        const mine = group.get(me.guildId);
        const target = typeof groupId === 'string' ? group.get(groupId) : undefined;
        const leader = mine?.founder === uid;
        if (action === 'create') {
          const name = clean(body),
            badge = clean(tag).toLocaleUpperCase('pl');
          requireRule(!leader, 'Najpierw przekaż prowadzenie lub opuść swoją gildię.');
          requireRule(
            /^[\p{L}\p{N}][\p{L}\p{N} ’-]{2,35}$/u.test(name) && /^[\p{L}0-9]{2,6}$/u.test(badge),
            'Podaj nazwę (3–36 znaków) i znak proporca (2–6 liter lub cyfr).',
          );
          const key = name.toLocaleLowerCase('pl');
          requireRule(
            !db.prepare('SELECT 1 FROM innGuilds WHERE nameKey=? OR tag=?').get(key, badge),
            'Ta nazwa lub znak są już zajęte.',
          );
          const id = 'cech_' + randomUUID();
          db.prepare('INSERT INTO innGuilds(id,name,nameKey,tag,founder) VALUES(?,?,?,?,?)').run(
            id,
            name,
            key,
            badge,
            uid,
          );
          move(uid, id);
        } else if (action === 'apply') {
          requireRule(
            !leader && target && mine?.id !== target.id,
            'Wybierz inną gildię. Mistrz musi najpierw przekazać proporzec.',
          );
          if (target.founder)
            db.prepare('INSERT OR REPLACE INTO innPetitions VALUES(?,?)').run(
              uid,
              String(target.id),
            );
          else move(uid, String(target.id));
        } else if (action === 'withdraw') {
          requests.run(uid);
        } else if (action === 'accept' || action === 'decline') {
          requireRule(
            leader &&
              typeof who === 'string' &&
              db.prepare('SELECT 1 FROM innPetitions WHERE uid=? AND guild=?').get(who, me.guildId),
            'Brak takiej prośby do twojej gildii.',
          );
          if (action === 'accept') move(who, me.guildId);
          else requests.run(who);
        } else if (action === 'transfer') {
          requireRule(
            leader &&
              typeof who === 'string' &&
              who !== uid &&
              current.get(who)?.guild === me.guildId,
            'Wybierz członka swojej gildii.',
          );
          db.prepare('UPDATE innGuilds SET founder=? WHERE id=?').run(who, me.guildId);
          requests.run(who);
        } else if (action === 'leave') {
          requireRule(mine, 'Nie należysz do gildii.');
          if (leader) {
            requireRule(
              Number(population.get(me.guildId)?.n) === 1,
              'Przed odejściem przekaż proporzec jednemu z członków.',
            );
            db.prepare('UPDATE innGuilds SET archived=1 WHERE id=?').run(me.guildId);
            db.prepare('DELETE FROM innPetitions WHERE guild=?').run(me.guildId);
          }
          move(uid, '');
        } else if (action === 'letter') {
          const content = clean(body);
          requireRule(
            mine && groupId === me.guildId && content.length >= 1 && content.length <= 480,
            'Wybierz swój stół i wpisz od 1 do 480 znaków.',
          );
          db.prepare('INSERT INTO innLetters(guild,name,body,at) VALUES(?,?,?,?)').run(
            me.guildId,
            me.displayName,
            content,
            now,
          );
        } else if (action === 'post') {
          const content = clean(body);
          requireRule(
            Object.hasOwn(noticeKinds, kind) && content.length >= 5 && content.length <= 360,
            'Wybierz rodzaj ogłoszenia i wpisz od 5 do 360 znaków.',
          );
          requireRule(
            Number(
              db
                .prepare('SELECT COUNT(*) n FROM innNotices WHERE owner=? AND at>? AND closed=0')
                .get(uid, now - week)?.n,
            ) < 3,
            'Możesz mieć trzy czynne ogłoszenia. Zamknij zakończoną sprawę.',
          );
          db.prepare(
            'INSERT INTO innNotices(city,owner,name,kind,body,at) VALUES(?,?,?,?,?,?)',
          ).run(city, uid, me.displayName, kind, content, now);
        } else if (['sign', 'unsign', 'close'].includes(action)) {
          const n = Number.isSafeInteger(notice)
            ? db
                .prepare('SELECT owner FROM innNotices WHERE id=? AND city=? AND at>? AND closed=0')
                .get(notice, city, now - week)
            : null;
          requireRule(n, 'Ogłoszenie jest nieaktualne.');
          if (action === 'close') {
            requireRule(n.owner === uid, 'Tylko autor zamyka sprawę.');
            db.prepare('UPDATE innNotices SET closed=1 WHERE id=?').run(notice);
          } else if (action === 'sign') {
            requireRule(n.owner !== uid, 'To twoje ogłoszenie.');
            db.prepare('INSERT OR IGNORE INTO innSigns VALUES(?,?,?)').run(
              notice,
              uid,
              me.displayName,
            );
          } else db.prepare('DELETE FROM innSigns WHERE notice=? AND uid=?').run(notice, uid);
        } else throw new InnRule('Nieznana czynność.');
        db.prepare('INSERT INTO innReceipts VALUES(?,?,?)').run(uid, nonce, payload);
      }
      const result = read(uid, city);
      db.exec('COMMIT');
      res.json(result);
    } catch (e) {
      if (db.isTransaction) db.exec('ROLLBACK');
      if (e instanceof InnRule) res.status(400).json({ error: e.message });
      else next(e);
    }
  });
  return (uid: string) => {
    const guild = String(current.get(uid)?.guild ?? '');
    return guild && group.get(guild) ? convoyReduction(Number(population.get(guild)?.n)) : 0;
  };
}
