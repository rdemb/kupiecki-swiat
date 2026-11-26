import {randomInt} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import type {Express,Request} from 'express';
import {ferryGoal,landings,letterStages,marshSites,otherBank,ticketPrice,witnessesByStage,type LetterPage} from '../src/economy/westernMarch';

import type {WeatherConditionId} from '../src/economy/economyEngine';

import type {MillMark} from '../src/economy/mill';
type Actor = {uid:string;gold:number;millMark?:MillMark};
type Trace = {stage:number;witness:number};
type Parcel = {origin:string;booked:number;arrives:number;delivered:number};
class LetterRule extends Error {}
function requireRule(value:unknown, reason:string):asserts value {
  if (!value) throw new LetterRule(reason);
}
const day = 24*60*60*1000;

export function installLostLetter(app:Express, db:DatabaseSync, auth:(req:Request)=>Actor|null, gold:(uid:string,delta:number)=>void, sky:()=>WeatherConditionId) {
  db.exec(`CREATE TABLE IF NOT EXISTS fordLetters(owner TEXT PRIMARY KEY,stage INTEGER NOT NULL,witness INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS fordTreasury(id INTEGER PRIMARY KEY CHECK(id=1),fund INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO fordTreasury(id) VALUES(1);
    CREATE TABLE IF NOT EXISTS fordParcels(owner TEXT PRIMARY KEY,origin TEXT NOT NULL,booked INTEGER NOT NULL,arrives INTEGER NOT NULL,delivered INTEGER NOT NULL);`);
  const trace=db.prepare('SELECT stage,witness FROM fordLetters WHERE owner=?');
  const project=db.prepare('SELECT fund,EXISTS(SELECT 1 FROM fordLetters WHERE stage=5) AS found FROM fordTreasury WHERE id=1');
  const parcel=db.prepare('SELECT origin,booked,arrives,delivered FROM fordParcels WHERE owner=?');
  function page(actor:Actor|null,now:number):LetterPage {
    const world=project.get()!;
    const record=actor && trace.get(actor.uid) as Trace|undefined;
    const load=actor && parcel.get(actor.uid) as Parcel|undefined;
    return {ledger:actor?.millMark?{uid:actor.uid,mark:actor.millMark}:null,stage:record?.stage??0,witness:record?.witness??0,found:!!world.found,fund:Number(world.fund),wallet:actor?.gold??null,
      parcel:load?{origin:load.origin,arrives:load.arrives,delivered:!!load.delivered}:null,
      canBook:!!actor && (!load || (!!load.delivered && now>=load.booked+day))};
  }
  app.get('/api/lost-letter',(req,res)=>res.set('Cache-Control','private, no-store').json(page(auth(req),Date.now())));
  app.post('/api/lost-letter',(req,res,next)=>{
    res.set('Cache-Control','private, no-store');
    const me=auth(req);
    if(!me){res.status(401).json({error:'Zaloguj się, by zapisać własną wyprawę.'});return;}
    const {action,site,stage,choice,fund}=req.body??{};
    const now=Date.now();
    db.exec('BEGIN IMMEDIATE');
    try{
      const current=page(me,now);
      requireRule(marshSites.some(s=>s.id===site),'Wybierz miejsce na rozlewiskach.');
      if(action==='trace'){
        const clue=letterStages[current.stage];
        requireRule(clue && stage===current.stage && site===clue.site,'Sprawdź miejsce następnego śladu w liście.');
        if(current.stage>=1 && current.stage<=3){
          const witness=witnessesByStage[current.stage-1][current.witness];
          requireRule(choice===witness.answer,'Świadek przeczy temu tropowi. Przeczytaj zeznanie ponownie.');
        }
        const next=current.stage+1;
        const draw=next<=3?randomInt(witnessesByStage[next-1].length):0;
        db.prepare('INSERT INTO fordLetters VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET stage=excluded.stage,witness=excluded.witness').run(me.uid,next,draw);
      }else if(action==='fund'){
        requireRule(landings.some(s=>s===site) && current.found,'Księga przewoźnika musi dotrzeć nad bród.');
        requireRule(fund===current.fund && fund<ferryGoal,'Stan zbiórki się zmienił. Odczytaj księgę.');
        requireRule(me.gold>=ticketPrice,'W sakwie brakuje złota na udział.');
        gold(me.uid,-ticketPrice);
        db.prepare('UPDATE fordTreasury SET fund=fund+? WHERE id=1').run(ticketPrice);
      }else if(action==='book' || action==='unload'){
        requireRule(current.fund===ferryGoal && landings.some(s=>s===site),'Przewozy ruszą po ufundowaniu promu.');
        if(action==='book'){
          requireRule(current.canBook,'Masz już skrzynię lub odebrano dzisiejszy fracht.');
          const weather=sky();
          const seconds=weather==='sztorm_na_zatoce'?30:weather==='ulewne_deszcze'||weather==='zamiec_i_mroz'?20:10;
          db.prepare('INSERT INTO fordParcels VALUES(?,?,?,?,0) ON CONFLICT(owner) DO UPDATE SET origin=excluded.origin,booked=excluded.booked,arrives=excluded.arrives,delivered=0').run(me.uid,site,now,now+seconds*1000);
        }else{
          requireRule(current.parcel && !current.parcel.delivered && otherBank(current.parcel.origin)===site,'Oddaj bieżącą skrzynię na przeciwległym brzegu.');
          requireRule(now>=current.parcel.arrives,'Prom jest jeszcze na wodzie.');
          db.prepare('UPDATE fordParcels SET delivered=1 WHERE owner=?').run(me.uid);gold(me.uid,8);
        }
      }else throw new LetterRule('Nieznane działanie nad brodem.');
      const result=page(auth(req),now);
      db.exec('COMMIT');res.json(result);
    }catch(e){db.exec('ROLLBACK');if(e instanceof LetterRule)res.status(409).json({error:e.message});else next(e);}
  });
}
