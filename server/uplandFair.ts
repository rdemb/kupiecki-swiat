import {randomInt} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {Express,Request} from 'express';
import {camps,hosts,wares,wareKeys,type FairWin,type UplandBook,type Ware} from '../src/economy/uplandFair';
import type {MillMark} from '../src/economy/mill';

type Actor={uid:string;displayName:string;gold:number;millMark?:MillMark};
class FairError extends Error {}
function check(ok:unknown,text:string):asserts ok {if(!ok)throw new FairError(text);}
export function installUplandFair(app:Express,db:DatabaseSync,auth:(req:Request)=>Actor|null,
  transfer:(uid:string,gold:number,grain:number)=>void) {
  db.exec(`CREATE TABLE IF NOT EXISTS uplandCamps(edition INTEGER,site TEXT,guide INTEGER NOT NULL,surveyed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(edition,site));
    CREATE TABLE IF NOT EXISTS uplandGoods(edition INTEGER,site TEXT,good TEXT,owner TEXT NOT NULL,PRIMARY KEY(edition,site,good));
    CREATE TABLE IF NOT EXISTS uplandRoll(edition INTEGER PRIMARY KEY,site TEXT NOT NULL,name TEXT NOT NULL,good TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS uplandWagons(ticket INTEGER PRIMARY KEY,owner TEXT NOT NULL,edition INTEGER NOT NULL,good TEXT NOT NULL,nonce TEXT NOT NULL,closed INTEGER NOT NULL DEFAULT 0,UNIQUE(owner,nonce));
    CREATE UNIQUE INDEX IF NOT EXISTS uplandOneWagon ON uplandWagons(owner) WHERE closed=0;
    CREATE TABLE IF NOT EXISTS uplandSales(edition INTEGER,owner TEXT,PRIMARY KEY(edition,owner));`);
  const front=db.prepare('SELECT edition,storm FROM pilotBank WHERE id=1');
  const local=db.prepare('SELECT guide,surveyed FROM uplandCamps WHERE edition=? AND site=?');
  const create=db.prepare('INSERT OR IGNORE INTO uplandCamps(edition,site,guide) VALUES(?,?,?)');
  const cargo=db.prepare('SELECT ticket,edition,good FROM uplandWagons WHERE owner=? AND closed=0');
  const roll=db.prepare('SELECT * FROM uplandRoll ORDER BY edition DESC LIMIT 6');
  function read(me:Actor|null):UplandBook{
    const sky=front.get()!,edition=Number(sky.edition);
    const history=roll.all() as unknown as FairWin[];
    return {edition,storm:!!sky.storm,winner:history.find(w=>w.edition===edition)??null,history,
      camps:camps.map((site,i)=>{
        let row=local.get(edition,site);
        if(!row){create.run(edition,site,randomInt(hosts[i].length));row=local.get(edition,site)!;}
        const goods=db.prepare('SELECT good FROM uplandGoods WHERE edition=? AND site=? ORDER BY rowid').all(edition,site);
        return {site,guide:Number(row.guide),surveyed:!!row.surveyed,goods:goods.map(r=>r.good as Ware)};
      }),
      cargo:me?(cargo.get(me.uid) as UplandBook['cargo']??null):null,wallet:me?.gold??null,
      claimed:!!me && !!db.prepare('SELECT 1 FROM uplandSales WHERE edition=? AND owner=?').get(edition,me.uid),
      ledger:me?.millMark?{uid:me.uid,mark:me.millMark}:null};
  }
  app.get('/api/upland-fair',(req,res)=>res.set('Cache-Control','private, no-store').json(read(auth(req))));
  app.post('/api/upland-fair',(req,res,next)=>{
    res.set('Cache-Control','private, no-store');
    const me=auth(req);
    if(!me){res.status(401).json({error:'Zaloguj się, aby poprowadzić własny wóz.'});return;}
    const {action,site,edition,choice,good,ticket,nonce}=req.body??{};
    db.exec('BEGIN IMMEDIATE');
    try{
      const book=read(me), camp=book.camps.find(c=>c.site===site);
      if(action==='return'){
        check(book.cargo && ticket===book.cargo.ticket && site===wares[book.cargo.good].source,'Oddaj ten pakunek u dostawcy.');
        transfer(me.uid,wares[book.cargo.good].cost,0);
        db.prepare('UPDATE uplandWagons SET closed=1 WHERE ticket=?').run(ticket);
      }else{
        check(book.edition===edition && !book.storm,'Nowa woda zmieniła drogi. Odczytaj bieżącą księgę.');
        if(action==='buy'){
          check(site===book.winner?.site && book.winner && !book.claimed && me.gold>=5,'Miara zboża kosztuje 5 sztuk złota. Każdy kupiec może kupić jedną na tym jarmarku.');
          transfer(me.uid,-5,1);
          db.prepare('INSERT INTO uplandSales VALUES(?,?)').run(edition,me.uid);
        }else{
          check(!book.winner,'Jarmark ma już gospodarza. Nadmiarowy ładunek przyjmie z powrotem dostawca.');
          if(action==='survey'){
            check(camp && !camp.surveyed,'Wybierz plac z niesprawdzonym dojazdem.');
            const i=book.camps.indexOf(camp);
            check(choice===hosts[i][camp.guide].answer,'Wóz zawrócił. Sprawdź, którędy prowadzi sucha droga.');
            db.prepare('UPDATE uplandCamps SET surveyed=1 WHERE edition=? AND site=?').run(edition,site);
          }else if(action==='load'){
            check(wareKeys.includes(good as Ware),'Nieznany ładunek.');
            const product=wares[good as Ware];
            check(site===product.source && !book.cargo && me.gold>=product.cost,'Odbierz ładunek w jego warsztacie. Potrzebujesz wolnego wozu i kaucji.');
            check(typeof nonce==='string' && /^[a-zA-Z0-9-]{12,64}$/.test(nonce) && !db.prepare('SELECT 1 FROM uplandWagons WHERE owner=? AND nonce=?').get(me.uid,nonce),'Ten list przewozowy już wydano.');
            transfer(me.uid,-product.cost,0);
            db.prepare('INSERT INTO uplandWagons(owner,edition,good,nonce) VALUES(?,?,?,?)').run(me.uid,edition,good,nonce);
          }else if(action==='deliver'){
            const carried=book.cargo;
            check(carried && ticket===carried.ticket && carried.edition===edition,'Wskaż bieżący list przewozowy.');
            check(camp?.surveyed && !camp.goods.includes(carried.good),'Plac musi mieć suchy dojazd i potrzebować tego towaru.');
            db.prepare('INSERT INTO uplandGoods VALUES(?,?,?,?)').run(edition,site,carried.good,me.uid);
            db.prepare('UPDATE uplandWagons SET closed=1 WHERE ticket=?').run(ticket);
            transfer(me.uid,wares[carried.good].cost+2,0);
            if(camp.goods.length===wareKeys.length-1)db.prepare('INSERT INTO uplandRoll VALUES(?,?,?,?)').run(edition,site,me.displayName,carried.good);
          }else throw new FairError('Nieznana czynność na jarmarku.');
        }
      }
      const result=read(auth(req));db.exec('COMMIT');res.json(result);
    }catch(err){db.exec('ROLLBACK');if(err instanceof FairError)res.status(409).json({error:err.message});else next(err);}
  });
}
