import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { exerciseHarvestFair } from './harvest-fair-scenario.mjs';

export async function exerciseCommonField({request, db, start, stop}) {
  const api = '/api/mill/srebrny_gaj';
  const read = token => request(api,200,undefined,token);
  const people = await Promise.all(['marta_z_miedzy','jan_znad_mlyna'].map(async username => {
    const credentials = {username,password:randomUUID()};
    const {token,profile} = await request('/api/auth/register',201,credentials);
    return {credentials, token, before:profile.inventory.zboze};
  }));
  const [marta,jan] = people;
  const opening = (await read()).field;
  assert.equal(opening.mine,null);
  assert.equal(opening.lastHarvest,null);
  assert.equal(opening.stage,'earth');
  const round = opening.round;
  const send = (p,action,extra={},status=200) => request(api,status,{action,nonce:randomUUID(),round,...extra},p?.token);
  await send(null,'bringSeed',{quantity:1},401);
  await request('/api/mill/krolewska_przystan',409,{action:'bringSeed',round,quantity:1,nonce:randomUUID()},jan.token);
  for (const quantity of [0,1.5,5]) await send(marta,'bringSeed',{quantity},409);
  await send(jan,'voteSow',{},409);
  const slip = {nonce:randomUUID(),quantity:2};
  await Promise.all([send(marta,'bringSeed',slip),send(marta,'bringSeed',slip)]);
  await send(marta,'bringSeed',{...slip,quantity:1},409);
  assert.equal((await read(marta.token)).wallet.grain,marta.before-2);
  await send(jan,'bringSeed',{quantity:1});
  await send(jan,'takeSeed');
  assert.equal((await read(jan.token)).wallet.grain,jan.before);
  await send(jan,'bringSeed',{quantity:1});
  const waiting = await send(marta,'voteSow');
  assert.equal(waiting.field.sown,null);
  assert.equal(waiting.field.votes,1);
  await send(marta,'holdSow');
  assert.equal((await read()).field.votes,0);
  await send(marta,'voteSow');
  const sowing = await send(jan,'voteSow');
  const day = sowing.field.sown;
  assert.equal(day,sowing.field.day);
  await send(jan,'takeSeed',{},409);

  // Advance only the isolated test world's persisted calendar between restarts.
  async function nextDay(n,weatherIndex) {
    await stop();
    db.prepare("UPDATE world SET snapshot=json_set(snapshot,'$.worldDayNumber',?,'$.activeWeatherIndex',?) WHERE id=1").run(day+n,weatherIndex);
    await start();
    return read();
  }
  const weather = [2,4,0,3], stages=['green','green','gold','stubble'];
  for (const [i,w] of weather.entries()) {
    const page = await nextDay(i+1,w);
    assert.equal(page.field.stage,stages[i]);
    assert.equal(page.field.journal.length,i+1);
    assert.equal((await request('/api/state',200)).macro.fieldStage,stages[i]);
    assert.equal((await read()).field.journal.length,i+1);
  }
  const last = (await read()).field;
  assert.deepEqual(last.journal.map(d=>d.points),[3,0,3,1]);
  assert.deepEqual(last.lastHarvest,{day:day+4,seed:3,yield:5,myShare:null});
  for (const [i,p] of people.entries()) {
    p.token = (await request('/api/auth/login',200,p.credentials)).token;
    const receipt = await read(p.token);
    assert.equal(receipt.field.lastHarvest.myShare,[3,2][i]);
    assert.equal(receipt.wallet.grain,p.before+1);
  }
  await send(marta,'bringSeed',slip);
  assert.equal((await read(marta.token)).wallet.grain,marta.before+1);
  // The chest is funded from the grower's wallet during the fallow or the following open round.
  const offer = {nonce:randomUUID()};
  const baseline = marta.before + 1;
  await Promise.all([send(marta,'offerHarvestSeed',offer),send(marta,'offerHarvestSeed',offer)]);
  assert.equal((await read(marta.token)).wallet.grain,baseline-1);
  assert.equal((await read()).field.chest.lots.length,1);
  await send(marta,'offerHarvestSeed',{},409);
  const previousLot = (await read()).field.chest.lots[0].id;
  await send(jan,'recallHarvestSeed',{lot:previousLot},409);
  await send(jan,'acceptHarvestSeed',{lot:previousLot},409);
  await send(marta,'recallHarvestSeed',{lot:previousLot});
  assert.equal((await read(marta.token)).wallet.grain,baseline);
  const reopened=(await nextDay(8,1)).field;
  assert.equal(reopened.round,round+1);
  assert.equal(reopened.total,0);
  assert.equal(reopened.stage,'earth');
  assert.equal(reopened.lastHarvest.yield,5);
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  await send(marta,'bringSeed',{quantity:1},409);
  assert.equal((await read(marta.token)).wallet.grain,marta.before+1);
  jan.token=(await request('/api/auth/login',200,jan.credentials)).token;
  const current = {round:reopened.round};
  assert.equal((await read(marta.token)).field.chest.canOffer,true);
  const chest = (await send(marta,'offerHarvestSeed',current)).field.chest;
  const lot = chest.lots[0].id;
  await request('/api/field/seed/'+lot,404);
  assert.ok(lot > previousLot);
  const janLot = (await send(jan,'offerHarvestSeed',current)).field.chest.lots.find(l=>l.mine).id;
  await send(jan,'acceptHarvestSeed',{...current,lot:previousLot},409);
  await send(marta,'acceptHarvestSeed',{...current,lot},409);
  await send(null,'acceptHarvestSeed',{...current,lot},401);
  await send(jan,'bringSeed',{...current,quantity:4});
  await send(jan,'acceptHarvestSeed',{...current,lot},409);
  await send(jan,'takeSeed',current);
  const take = {...current,lot,nonce:randomUUID()};
  await Promise.all([send(jan,'acceptHarvestSeed',take),send(jan,'acceptHarvestSeed',take)]);
  assert.equal((await read(jan.token)).field.mine.seed,1);
  await send(jan,'acceptHarvestSeed',{...take,lot:janLot},409);
  await send(marta,'recallHarvestSeed',{...current,lot},409);
  await send(jan,'bringSeed',{...current,quantity:1});
  await send(jan,'takeSeed',current);
  assert.equal((await read(jan.token)).wallet.grain,jan.before); // Only Jan's personally donated sack is outside his warehouse.
  assert.equal((await read()).field.chest.lots.find(l=>l.id===lot).receiver,null);
  const guest = await request('/api/auth/register',201,{username:'kupiec_pola',password:randomUUID()});
  await send(guest,'offerHarvestSeed',current,409);
  await send(jan,'acceptHarvestSeed',{...current,lot});
  await send(guest,'acceptHarvestSeed',{...current,lot},409);
  await send(jan,'voteSow',current);
  const ledger=(await read()).field.chest;
  assert.deepEqual(ledger.lots,[]);
  assert.deepEqual(ledger.history.map(x=>[x.donor,x.receiver,x.generation]),[[marta.credentials.username,jan.credentials.username,1]]);
  assert.equal((await read(jan.token)).wallet.grain,jan.before+1); // Unclaimed gift refunded at sowing.
  for (let dayOffset=9;dayOffset<=12;dayOffset++) await nextDay(dayOffset,0);
  jan.token=(await request('/api/auth/login',200,jan.credentials)).token;
  assert.equal((await read(jan.token)).field.lastHarvest.myShare,2);
  assert.equal((await read(jan.token)).wallet.grain,jan.before+3);
  const second = (await send(jan,'offerHarvestSeed',current)).field.chest.lots[0];
  assert.equal(second.generation,2);
  assert.equal(second.founder,marta.credentials.username);
  const thirdSeason = (await nextDay(16,0)).field;
  assert.equal(thirdSeason.chest.lots[0].id,second.id);
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  await send(marta,'acceptHarvestSeed',{round:thirdSeason.round,lot:second.id});
  const book=(await send(marta,'voteSow',{round:thirdSeason.round})).field.chest;
  assert.deepEqual(book.history.map(x=>[x.founder,x.generation]),[[marta.credentials.username,2],[marta.credentials.username,1]]);
  const trace = await request('/api/field/seed/'+second.id,200);
  assert.deepEqual(trace.steps.map(x=>x.id),[second.id,lot]);
  assert.equal(trace.older,null);
  assert.equal(trace.steps[0].receiver,marta.credentials.username);
  assert.equal(trace.steps[1].receiver,jan.credentials.username);
  assert.deepEqual(Object.keys(trace.steps[0]).sort(),['day','donor','founder','generation','id','receiver']);
  // A sack from the third harvest can have exactly one fate: seed gift or flour.
  for (let n=17;n<=20;n++) await nextDay(n,0);
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  jan.token=(await request('/api/auth/login',200,jan.credentials)).token;
  const lastRound={round:thirdSeason.round};
  const stock=await read(marta.token);
  const gift=(await send(marta,'offerHarvestSeed',lastRound)).field.chest.lots[0];
  await send(marta,'millHarvestLoaf',lastRound,409);
  await send(marta,'recallHarvestSeed',{...lastRound,lot:gift.id});
  await send(jan,'millHarvestLoaf',lastRound,409);
  await send(null,'millHarvestLoaf',lastRound,401);
  const millSlip={...lastRound,nonce:randomUUID()};
  const [milled]=await Promise.all([send(marta,'millHarvestLoaf',millSlip),send(marta,'millHarvestLoaf',millSlip)]);
  const loaf=milled.feast.latest.id;
  assert.equal(milled.wallet.grain,stock.wallet.grain-1);
  assert.equal(milled.flour,stock.flour);
  assert.equal(milled.feast.publicQuarters,2);
  assert.equal(milled.grain,stock.grain);
  assert.equal(milled.feast.latest.stage,'flour');
  assert.equal(milled.feast.latest.seedLot,second.id);
  assert.equal(milled.feast.latest.founder,marta.credentials.username);
  assert.equal(milled.field.chest.canOffer,false);
  await send(marta,'offerHarvestSeed',lastRound,409);
  await send(marta,'millHarvestLoaf',lastRound,409);
  await send(marta,'bakeHarvestLoaf',{loaf:loaf+1},409);
  const bake={loaf,nonce:randomUUID()};
  await Promise.all([send(jan,'bakeHarvestLoaf',bake),send(jan,'bakeHarvestLoaf',bake)]);
  await send(marta,'bakeHarvestLoaf',{loaf},409);
  const port='krolewska_przystan', forge='zelazna_kuznia';
  await send(marta,'carryHarvestLoaf',{loaf,town:port},409);
  await send(marta,'voteHarvestInn',{loaf,town:'atlantyda'},409);
  const ballot={loaf,town:port,nonce:randomUUID()};
  await send(jan,'voteHarvestInn',ballot);
  await send(jan,'voteHarvestInn',{...ballot,town:forge},409);
  const tied=await send(marta,'voteHarvestInn',{loaf,town:forge});
  assert.equal(tied.feast.leading,port);
  await stop(); await start();
  jan.token=(await request('/api/auth/login',200,jan.credentials)).token;
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  assert.equal((await read(jan.token)).feast.choice,port);
  const united=await send(jan,'voteHarvestInn',{loaf,town:forge});
  assert.deepEqual(united.feast.votes,[{town:forge,count:2}]);
  db.prepare('UPDATE harvestLoaves SET readyAt=? WHERE id=?').run(Date.now()-1000,loaf);
  await send(marta,'carryHarvestLoaf',{loaf,town:port},409);
  const freight={loaf,town:forge,nonce:randomUUID()};
  const driver=await request('/api/auth/register',201,{username:'woznica_dozynkowy',password:randomUUID()});
  const wagon=(await send(driver,'carryHarvestLoaf',freight)).feast.latest;
  assert.equal(wagon.stage,'cart');
  assert.ok(wagon.arrival>Date.now());
  assert.ok(wagon.departed <= Date.now() && wagon.departed < wagon.arrival);
  await send(driver,'carryHarvestLoaf',freight);
  await send(jan,'carryHarvestLoaf',{loaf,town:forge},409);
  await send(marta,'voteHarvestInn',{loaf,town:port},409);
  assert.deepEqual((await request('/api/inn/'+forge,200)).harvestTable,[]);
  db.prepare('UPDATE harvestLoaves SET arrival=? WHERE id=?').run(Date.now()-1000,loaf);
  await stop(); await start();
  const [served]=(await request('/api/inn/'+forge,200)).harvestTable;
  assert.equal(served.stage,'served');
  assert.equal(served.grower,marta.credentials.username);
  assert.equal(served.baker,jan.credentials.username);
  assert.equal(served.carrier,'woznica_dozynkowy');
  assert.deepEqual((await request('/api/inn/'+port,200)).harvestTable,[]);
  assert.deepEqual((await request('/api/field/seed/'+served.seedLot,200)).steps.map(s=>s.id),[second.id,lot]);
  await exerciseHarvestFair({request,db,start,stop,loaf,forge,port,marta,jan});
  // The other half measure combines with the next real harvest's contribution.
  const fourth=(await nextDay(24,0)).field.round;
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  await send(marta,'bringSeed',{round:fourth,quantity:1});
  await send(marta,'voteSow',{round:fourth});
  for (let n=25;n<=28;n++) await nextDay(n,0);
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  const beforeNext=await read(marta.token);
  const otherBake=await send(marta,'millHarvestLoaf',{round:fourth});
  assert.equal(otherBake.feast.publicQuarters,0);
  assert.equal(otherBake.flour,beforeNext.flour+1);
  assert.equal(otherBake.feast.latest.seedLot,null);
  assert.equal((await request('/api/inn/'+forge,200)).harvestTable[0].id,loaf);
  // Model an old lineage in this isolated world. Paging follows parents across
  // seasons even when the village ledger has already rolled past the founder.
  let ancestor = second.id;
  for (let generation=3; generation<=10; generation++) {
    const row = db.prepare(`INSERT INTO fieldSeedGifts(target,donor,donorName,founder,generation,receiver,receiverName,sownDay,parent)
      VALUES(?,?,?,?,?,?,?,?,?)`).run(40+generation,'a','A',marta.credentials.username,generation,'b','B',200+generation,ancestor);
    ancestor = Number(row.lastInsertRowid);
  }
  const recent = await request('/api/field/seed/'+ancestor,200);
  assert.deepEqual(recent.steps.map(s=>s.generation),[10,9,8,7,6,5,4,3]);
  assert.equal(recent.older,second.id);
  const oldest = await request('/api/field/seed/'+recent.older,200);
  assert.deepEqual(oldest.steps.map(s=>s.generation),[2,1]);
  assert.equal(oldest.older,null);
}
