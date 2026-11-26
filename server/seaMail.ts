import type { DatabaseSync } from 'node:sqlite';
import { courierFee, courierSeconds, type Dispatch, type Envelope, type PostBook } from '../src/economy/seaMail';

export function installSeaMail(db: DatabaseSync, gold: (uid: string, delta: number) => void) {
  db.exec(`CREATE TABLE IF NOT EXISTS seaMail(
    id INTEGER PRIMARY KEY, owner TEXT NOT NULL, sender TEXT NOT NULL, destination TEXT NOT NULL REFERENCES innGuilds(id),
    written INTEGER NOT NULL, body TEXT NOT NULL, voyage INTEGER UNIQUE REFERENCES yardVoyages(id), roadDue INTEGER,
    CHECK(voyage IS NULL OR roadDue IS NULL));
    CREATE INDEX IF NOT EXISTS seaMailSender ON seaMail(owner,id DESC);
    CREATE INDEX IF NOT EXISTS seaMailGuild ON seaMail(destination,id DESC);`);
  const delivery = 'COALESCE(v.settled,CASE WHEN m.roadDue<=:now THEN m.roadDue END)';
  const records = `SELECT m.id,m.sender,g.name AS guild,m.written,m.body,m.voyage,s.name AS vessel,m.roadDue,${delivery} AS delivered
    FROM seaMail m JOIN innGuilds g ON g.id=m.destination LEFT JOIN yardVoyages v ON v.id=m.voyage
    LEFT JOIN yardShips s ON s.id=v.ship`;
  const sent = db.prepare(records + ' WHERE m.owner=:uid ORDER BY m.id DESC LIMIT 12');
  const received = db.prepare(records + ' WHERE m.destination=:guild AND '+delivery+' IS NOT NULL ORDER BY delivered DESC,m.id DESC LIMIT 20');
  function book(uid: string | null, guild: string, now: number): PostBook {
    return {
      sent: uid ? sent.all({uid,now}) as unknown as Dispatch[] : [],
      received: uid && guild ? received.all({guild,now}) as unknown as Dispatch[] : [],
    };
  }
  function waiting() {
    return db.prepare(`SELECT m.id,m.sender,g.name AS guild FROM seaMail m JOIN innGuilds g ON g.id=m.destination
      WHERE m.voyage IS NULL AND m.roadDue IS NULL ORDER BY m.id LIMIT 50`).all() as unknown as Envelope[];
  }
  function seal(uid: string, sender: string, destination: string, body: string, now: number) {
    const recent = sent.all({uid,now}) as unknown as Dispatch[];
    if (recent.some(m => m.delivered === null)) return 'Najpierw doręcz lub odbierz poprzedni list.';
    if (recent.filter(m => m.written > now - 86400000).length >= 12) return 'Wykorzystano dwanaście pieczęci na dobę.';
    db.prepare('INSERT INTO seaMail(owner,sender,destination,written,body) VALUES(?,?,?,?,?)')
      .run(uid,sender,destination,now,body);
  }
  function reroute(uid: string, id: number, balance: number, recall: boolean, now: number) {
    const pending = ' WHERE id=? AND owner=? AND voyage IS NULL AND roadDue IS NULL';
    if (recall) {
      if (!db.prepare('DELETE FROM seaMail'+pending).run(id,uid).changes) return 'List już opuścił stół albo należy do innego kupca.';
    } else {
      if (balance < courierFee) return 'W sakwie brakuje monet dla gońca.';
      if (!db.prepare('UPDATE seaMail SET roadDue=?'+pending).run(now+courierSeconds*1000,id,uid).changes)
        return 'List już opuścił stół albo należy do innego kupca.';
      gold(uid,-courierFee);
    }
  }
  function embark(id: number, voyage: number) {
    return !!db.prepare('UPDATE seaMail SET voyage=? WHERE id=? AND roadDue IS NULL AND voyage IS NULL').run(voyage,id).changes;
  }
  function grainReport() {
    const sacks = Number(db.prepare("SELECT COALESCE(SUM(remaining),0) AS n FROM returnOrders WHERE state='stall'").get()!.n);
    return 'Stragan frachtowy w Królewskiej Przystani. Worki zboża wystawione na sprzedaż: '+sacks+'.';
  }
  return {book,waiting,seal,reroute,embark,grainReport};
}
