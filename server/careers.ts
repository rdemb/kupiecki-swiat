import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Express, Request } from 'express';
import { assignments, crafts, outfitting, worksites, type Craft, type CareerBook, type CareerJob } from '../src/economy/newHope';

export function installCareers(app:Express,db:DatabaseSync,account:(req:Request)=>{uid:string;displayName:string}|null) {
  db.exec(`CREATE TABLE IF NOT EXISTS craftJobs(
    id TEXT PRIMARY KEY,owner TEXT NOT NULL,site TEXT NOT NULL,craft TEXT NOT NULL,
    patron TEXT NOT NULL,task INTEGER NOT NULL,finished INTEGER NOT NULL DEFAULT 0,units INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS craftOutput(site TEXT PRIMARY KEY,craft TEXT NOT NULL,units INTEGER NOT NULL);
    INSERT OR IGNORE INTO craftOutput SELECT site,craft,SUM(units) FROM craftJobs WHERE finished>0 GROUP BY site,craft;
    CREATE TABLE IF NOT EXISTS craftSailings(voyage INTEGER PRIMARY KEY,name TEXT NOT NULL,site TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS craftOpenJob ON craftJobs(owner) WHERE finished=0;
    CREATE INDEX IF NOT EXISTS craftLedger ON craftJobs(owner,craft,finished);
    CREATE TABLE IF NOT EXISTS craftFirstMasters(craft TEXT PRIMARY KEY,name TEXT NOT NULL);`);
  const jobColumns='id,site,craft,patron,task,finished,units';
  const personal=db.prepare('SELECT '+jobColumns+' FROM craftJobs WHERE owner=? ORDER BY rowid DESC LIMIT 5');
  const byId=db.prepare('SELECT '+jobColumns+',owner FROM craftJobs WHERE id=?');
  const active=db.prepare('SELECT id FROM craftJobs WHERE owner=? AND finished=0');
  const totals=db.prepare('SELECT craft,COUNT(*) AS n FROM craftJobs WHERE owner=? AND finished>0 GROUP BY craft');
  const stocks=db.prepare('SELECT site,units AS n FROM craftOutput');
  const last=db.prepare('SELECT task,patron FROM craftJobs WHERE owner=? AND craft=? ORDER BY rowid DESC LIMIT 1');
  const masters=db.prepare('SELECT craft,name FROM craftFirstMasters ORDER BY rowid');
  const craftTotals=db.prepare('SELECT craft,SUM(units) AS n FROM craftOutput GROUP BY craft');
  function provision() {
    const stores:Record<Craft,number>={bursztynnik:0,warzelnik:0,szkutnik:0};
    for(const row of craftTotals.all()) stores[row.craft as Craft]=Number(row.n);
    const ids=Object.keys(outfitting) as Craft[];
    const sailings=Math.min(...ids.map(c=>Math.floor(stores[c]/outfitting[c])));
    for(const c of ids) stores[c]-=sailings*outfitting[c];
    return {sailings,stores};
  }
  function book(uid?:string):CareerBook {
    return {
      ...provision(),lastShipment:(db.prepare('SELECT name,site FROM craftSailings ORDER BY voyage DESC LIMIT 1').get()??null) as CareerBook['lastShipment'],
      jobs:uid ? personal.all(uid) as unknown as CareerJob[] : [],
      progress:Object.fromEntries(uid ? totals.all(uid).map(r=>[r.craft,r.n]) : []),
      stocks:Object.fromEntries(stocks.all().map(r=>[r.site,r.n])),
      marks:masters.all() as unknown as CareerBook['marks'],
    };
  }
  app.get('/api/careers',(req,res)=>{res.set('Cache-Control','no-store').json(book(account(req)?.uid));});
  app.post('/api/careers',(req,res,next)=>{
    res.set('Cache-Control','no-store');
    const me=account(req);
    if(!me){res.status(401).json({error:'Zaloguj się do księgi fachów.'});return;}
    const {action,id,site,choice}=req.body??{};
    const station=worksites.find(w=>w.id===site);
    if(typeof id!=='string'||!/^[a-z0-9-]{12,64}$/i.test(id)||!station||
      (action!=='start'&&action!=='finish')||(action==='finish'&&(!Number.isInteger(choice)||choice<0||choice>2))){
      res.status(400).json({error:'Wybierz warsztat i zlecenie.'});return;
    }
    db.exec('BEGIN IMMEDIATE');
    try{
      const job=byId.get(id);
      function reject(error:string){
        db.exec('ROLLBACK');res.status(409).json({error});
      }
      if(job&&(job.owner!==me.uid||job.site!==site)){reject('Ten wpis należy do innego zlecenia.');return;}
      const craft=station.craft;
      const done=Number(totals.all(me.uid).find(t=>t.craft===craft)?.n??0);
      if(action==='start'&&!job){
        if(active.get(me.uid)){reject('Najpierw ukończ przyjęte zlecenie.');return;}
        const previous=last.get(me.uid,craft);
        const patrons=crafts[craft].patrons.filter(name=>name!==previous?.patron);
        // The masterwork becomes available once the apprentice has delivered three orders.
        const tasks=assignments[craft].map((_,i)=>i).filter(i=>(i<2||done>=3)&&i!==previous?.task);
        db.prepare('INSERT INTO craftJobs(id,owner,site,craft,patron,task) VALUES(?,?,?,?,?,?)')
          .run(id,me.uid,site,craft,patrons[randomInt(patrons.length)],tasks[randomInt(tasks.length)]);
      }else if(action==='finish'){
        if(!job){reject('Zlecenie wygasło lub należy do innej księgi.');return;}
        if(!job.finished){
          const task=assignments[job.craft as Craft][Number(job.task)];
          if(choice!==task.answer){reject('Mistrz odkłada próbkę. Przyjrzyj się materiałowi i spróbuj jeszcze raz.');return;}
          const units=done>=8?3:done>=3?2:1;
          db.prepare('UPDATE craftJobs SET finished=?,units=? WHERE id=?').run(Date.now(),units,id);
          db.prepare('INSERT INTO craftOutput VALUES(?,?,?) ON CONFLICT(site) DO UPDATE SET units=units+excluded.units')
            .run(site,craft,units);
          const {sailings}=provision();
          if(sailings)db.prepare('INSERT OR IGNORE INTO craftSailings VALUES(?,?,?)').run(sailings,me.displayName,site);
          if(done+1===8) db.prepare('INSERT OR IGNORE INTO craftFirstMasters VALUES(?,?)').run(craft,me.displayName);
        }
      }
      const result=book(me.uid);db.exec('COMMIT');res.json(result);
    }catch(err){db.exec('ROLLBACK');next(err);}
  });
}
