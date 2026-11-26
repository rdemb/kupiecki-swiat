import type { DatabaseSync } from 'node:sqlite';
import { townNames } from '../src/economy/garrison';
import type { FeastTown } from '../src/economy/harvestLoaf';
import type { SpurPetition, SpurReceipt, SpurVerdict } from '../src/economy/spurTrial';
import { roadNames } from '../src/economy/standardSchool';
import { FeastRule } from './harvestLoaf';

export function openSpurTrial(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS spurPetitions(
      load INTEGER PRIMARY KEY REFERENCES relayLoads(id), guide INTEGER NOT NULL REFERENCES roadSquires(id),
      witnessId TEXT NOT NULL, witness TEXT NOT NULL, name TEXT NOT NULL, mentor TEXT NOT NULL, captain TEXT NOT NULL,
      origin TEXT NOT NULL, destination TEXT NOT NULL, road TEXT NOT NULL, testimony TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','knighted','declined')),
      sealedBy TEXT, emperorId TEXT, decided INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS spurLivingClaim ON spurPetitions(guide) WHERE state<>'declined';
    CREATE INDEX IF NOT EXISTS spurWitness ON spurPetitions(witnessId,origin,load);
    CREATE INDEX IF NOT EXISTS spurRoll ON spurPetitions(destination,state,decided);
    CREATE INDEX IF NOT EXISTS spurReceipts ON relayLoads(firstDriver,origin,state,id);
  `);
  // The second guide drove the witness's cargo. Evidence of instruction must predate the handoff.
  const eligible = `SELECT r.id AS load,s.id AS guide,s.name,w.mentor,json_extract(p.profile,'$.displayName') captain,
    r.origin,r.destination,r.road
    FROM relayLoads r JOIN roadSquires s ON s.id=r.secondGuide AND s.owner=r.secondDriver
    JOIN players p ON json_extract(p.profile,'$.uid')=s.owner
    JOIN schoolWagons w ON w.id=(SELECT id FROM schoolWagons WHERE guide=s.id AND lesson=1
      AND road=r.road AND returns<=r.handoff ORDER BY returns,id LIMIT 1)
    WHERE r.state='delivered' AND r.firstDriver=? AND r.origin=? AND r.firstDriver<>s.owner
      AND NOT EXISTS(SELECT 1 FROM spurPetitions t WHERE t.load=r.id OR (t.guide=s.id AND t.state<>'declined'))`;
  const available = db.prepare(eligible+' ORDER BY r.id DESC LIMIT 12');
  const receipt = db.prepare(eligible+' AND r.id=?');
  const columns = 'load,name,mentor,captain,origin,destination,road,witness,testimony,state,sealedBy';
  const list = 'SELECT '+columns+' FROM spurPetitions ';
  const personal = db.prepare(list+`WHERE (witnessId=? AND origin=?) OR (destination=? AND guide IN
    (SELECT id FROM roadSquires WHERE owner=? AND town=?)) ORDER BY load DESC LIMIT 12`);
  const pending = db.prepare(list+"WHERE state='pending' ORDER BY load LIMIT 40");
  const seals = db.prepare(list+"WHERE destination=? AND state='knighted' ORDER BY decided DESC,load DESC LIMIT 12");
  const titled = db.prepare("SELECT 1 FROM spurPetitions WHERE guide=? AND state='knighted'");
  function book(town: FeastTown, uid: string | null) {
    if (!uid) return {receipts:[],petitions:[]};
    return {
      receipts:available.all(uid,town).map(({guide,...row})=>row) as unknown as SpurReceipt[],
      petitions:personal.all(uid,town,town,uid,town) as unknown as SpurPetition[],
    };
  }
  function witness(town: FeastTown, me: {uid:string;displayName:string}, load:unknown, note:unknown) {
    if (typeof load!=='number' || !Number.isSafeInteger(load) || typeof note!=='string' ||
        !note.trim() || note.trim().length>180) throw new FeastRule('Wybierz list i napisz od 1 do 180 znaków świadectwa.');
    const row=receipt.get(me.uid,town,load);
    if (!row) throw new FeastRule('Ten list nie jest dostępny do poświadczenia.');
    db.prepare(`INSERT INTO spurPetitions(load,guide,witnessId,witness,name,mentor,captain,origin,destination,road,testimony)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(load,row.guide,me.uid,me.displayName,row.name,row.mentor,row.captain,row.origin,row.destination,row.road,note.trim());
  }
  // The court holds a write transaction covering the seal and the public chronicle.
  function decide(load: number, verdict: SpurVerdict, emperor: {uid:string;displayName:string}) {
    const row = db.prepare("SELECT * FROM spurPetitions WHERE load=?").get(load);
    if (!row) throw new FeastRule('Nie znaleziono świadectwa.');
    if (row.state!=='pending') {
      if (row.state===verdict && row.emperorId===emperor.uid) return;
      throw new FeastRule('Dwór już rozstrzygnął tę próbę.');
    }
    db.prepare('UPDATE spurPetitions SET state=?,sealedBy=?,emperorId=?,decided=? WHERE load=?')
      .run(verdict,emperor.displayName,emperor.uid,Date.now(),load);
    if (verdict==='knighted') {
      const story = 'Sir '+row.name+' otrzymuje ostrogę. List nr '+load+' · '+townNames[row.origin as FeastTown]+' → '+
        townNames[row.destination as FeastTown]+', '+roadNames[row.road as keyof typeof roadNames]+'. Worek zboża dotarł do kuchni. '+
        'Mentor: '+row.mentor+'. Świadek: '+row.witness+'. „'+row.testimony+'” Pieczęć: '+emperor.displayName+'.';
      db.prepare('INSERT INTO annals(person,name,site,story) VALUES(?,?,?,?)')
        .run('squire_'+row.guide,'Sir '+row.name,row.destination,story);
    }
  }
  return {book,witness,decide,knighted:(id:number)=>!!titled.get(id),
    pending:()=>pending.all() as unknown as SpurPetition[],
    seals:(town:string)=>seals.all(town) as unknown as SpurPetition[]};
}
