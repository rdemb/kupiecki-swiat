import type { Express, Request } from 'express';
import type { DatabaseSync } from 'node:sqlite';

interface Player { uid: string; username: string }
export function installCourt(app: Express, db: DatabaseSync, authenticate: (req: Request) => Player | null,
  announce: (uid: string, prefix: string) => void) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS emperor (seat INTEGER PRIMARY KEY CHECK(seat=1), uid TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS decrees (
      id INTEGER PRIMARY KEY, requestId TEXT UNIQUE NOT NULL, actor TEXT NOT NULL, recipient TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('bars','prefix')), bars INTEGER NOT NULL DEFAULT 0,
      prefix TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL, created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS decrees_recipient ON decrees(recipient,kind,id);
  `);
  const emperor = db.prepare('SELECT 1 FROM emperor WHERE seat=1 AND uid=?');
  const holdings = db.prepare(`SELECT COALESCE(SUM(bars),0) AS bars,
    COALESCE((SELECT prefix FROM decrees WHERE recipient=? AND kind='prefix' ORDER BY id DESC LIMIT 1),'') AS prefix
    FROM decrees WHERE recipient=?`);
  const insignia = (uid: string) => holdings.get(uid,uid)!;
  const history = db.prepare(`SELECT id,recipient,kind,bars,prefix,reason,created FROM decrees ORDER BY id DESC LIMIT 50`);
  app.get('/api/court', (req,res) => {
    const me = authenticate(req);
    if (!me) { res.sendStatus(401); return; }
    const admin = Boolean(emperor.get(me.uid));
    const players = admin ? db.prepare(`SELECT username,json_extract(profile,'$.uid') uid,
      json_extract(profile,'$.displayName') name FROM players ORDER BY username`).all().map(p => ({
      ...p,...insignia(String(p.uid))
    })) : [];
    res.set('Cache-Control','no-store').json({ ...insignia(me.uid), admin, players, history:admin ? history.all() : [] });
  });
  app.post('/api/court/decrees', (req,res) => {
    const me = authenticate(req);
    if (!me) { res.sendStatus(401); return; }
    if (!emperor.get(me.uid)) { res.sendStatus(403); return; }
    const {requestId,recipient,kind,value,reason} = req.body ?? {};
    if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId) ||
        typeof recipient !== 'string' || !/^usr_[0-9a-f]{16}$/.test(recipient) ||
        typeof reason !== 'string' || !reason.trim() || reason.length>180 ||
        !(kind==='bars' && Number.isSafeInteger(value) && value>=1 && value<=1000 ||
          kind==='prefix' && typeof value==='string' && ['', 'Sir','Dama','Baron','Baronessa','Hrabia','Hrabina'].includes(value))) {
      res.status(400).json({error:'Sprawdź rodzaj nadania, wartość i uzasadnienie.'}); return;
    }
    if (!db.prepare("SELECT 1 FROM players WHERE json_extract(profile,'$.uid')=?").get(recipient)) {
      res.status(404).json({error:'Nie znaleziono gracza.'}); return;
    }
    const bars = kind==='bars' ? value : 0;
    const prefix = kind==='prefix' ? value : '';
    const prior = db.prepare('SELECT * FROM decrees WHERE requestId=?').get(requestId);
    if (prior) {
      if (prior.actor!==me.uid || prior.recipient!==recipient || prior.bars!==bars ||
          prior.prefix!==prefix || prior.kind!==kind || prior.reason!==reason.trim()) {
        res.status(409).json({error:'Identyfikator dekretu jest już zajęty.'}); return;
      }
    } else {
      db.prepare('INSERT INTO decrees(requestId,actor,recipient,kind,bars,prefix,reason) VALUES(?,?,?,?,?,?,?)')
        .run(requestId,me.uid,recipient,kind,bars,prefix,reason.trim());
      if (kind==='prefix') announce(recipient,prefix);
    }
    res.status(prior ? 200 : 201).json(insignia(recipient));
  });
  return insignia;
}
