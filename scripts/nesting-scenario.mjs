import {exerciseFord} from './ford-scenario.mjs';
import {exerciseCabinet} from './cabinet-scenario.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function exerciseNests({request,db,account,setSky,read,post}) {
  await setSky(0);
  const scout=await account('tropiciel_wylin','Kalina'), buyer=await account('pisarz_wylin','Wojmir'),
    scribe=await account('rytownik_wylin','Nuta'), guide=await account('pilot_wylin','Roman');
  const book=actor=>request('/api/nests',200,undefined,actor?.token);
  const edition=(await book()).edition;
  const doAt=(actor,action,site,extra={},status=200)=>request('/api/nests',status,{edition,action,site,...extra},actor?.token);
  const net='sieci_matyldy', light='latarnia_wylin';
  const guild=(await request('/api/inn/krolewska_przystan',200,undefined,scout.token)).groups.find(g=>!g.privateHall).id;
  for(const a of [scout,guide]){
    const existing=(await request('/api/inn/krolewska_przystan',200,undefined,a.token)).membership;
    if(existing!==guild) await post(a,'apply',{groupId:guild});
  }
  await doAt(null,'collect',net,{},401);
  assert.equal((await book()).sighting,null);
  await doAt(scout,'identify',light,{},409);
  for(const a of [scout,buyer,scribe]) {
    const scale=await doAt(a,'collect',net);assert.equal(scale.sighting,null);assert.equal(scale.stage,'scale');
    assert.equal((await doAt(a,'collect',net)).witness,scale.witness);
    await doAt(a,'identify',light);
  }
  const entry=await book(scout), {site,species}=entry.sighting;
  const purse=(await read(buyer)).wallet.gold;
  await Promise.all([doAt(buyer,'sell',light),doAt(buyer,'sell',light)]);
  assert.equal((await read(buyer)).wallet.gold,purse+14);
  await post(buyer,'sealPost',{kind:'nest',groupId:guild},400);
  const correct=(await book(scribe)).witness%2;
  await doAt(scribe,'observe',site,{choice:1-correct},409);
  await doAt(scribe,'observe',net,{choice:correct},409);
  assert.equal((await doAt(scribe,'observe',site,{choice:correct})).album[0].species,species);
  assert.deepEqual((await book(buyer)).album,[]);
  await exerciseCabinet({request,db,owner:scribe,guest:buyer,voter:guide,edition,post,guild});
  await exerciseFord({request,db,owner:scribe,partner:buyer});
  const seal=async()=> (await post(scout,'sealPost',{kind:'nest',groupId:guild,nonce:randomUUID()})).seaMail.sent[0];
  const first=await seal();await post(scout,'recallPost',{notice:first.id});
  assert.equal((await book(scout)).stage,'identified');
  const letter=await seal();
  assert.equal((await book(scout)).stage,'sent');
  await doAt(scout,'sell',light,{},409);
  await doAt(guide,'join',site,{},409);
  await post(scout,'roadPost',{notice:letter.id});
  assert.equal((await book(guide)).invitation,null);
  db.prepare('UPDATE seaMail SET roadDue=? WHERE id=?').run(Date.now()-1,letter.id);
  assert.equal((await book(guide)).invitation.species,species);
  assert.equal((await book()).invitation,null);
  await doAt(guide,'join',net,{},409);
  assert.equal((await doAt(guide,'join',site)).invitation.count,1);
  assert.equal((await doAt(guide,'join',site)).invitation.count,1);
  assert.equal((await doAt(scout,'join',site)).invitation.count,2);
  await setSky(3);
  // Server sessions are reset by the isolated fixture restart.
  const relog=async a=>{a.token=(await request('/api/auth/login',200,a.credentials)).token;};
  await relog(scout);await relog(scribe);
  const ford=await request('/api/lost-letter',200,undefined,scribe.token);
  assert.ok(ford.found && ford.stage===5 && ford.fund===36 && ford.parcel.origin==='brod_wschodni');
  const when=Date.now();
  const stormLoad=await request('/api/lost-letter',200,{action:'book',site:'brod_wschodni'},scout.token);
  assert.ok(stormLoad.parcel.arrives>=when+30000 && stormLoad.parcel.arrives<=Date.now()+30000);
  const archive=await request('/api/cabinet/dom_matryc',200,undefined,scribe.token);
  assert.ok(archive.shows[0].done && archive.shows[0].route.length===3);
  assert.deepEqual(archive.stamps,['dom_matryc']);
  const next=await book(scout);
  assert.ok(next.edition>edition && next.storm);assert.equal(next.stage,'none');
  assert.equal(next.invitation,null);assert.deepEqual(next.history.map(h=>[h.edition,h.site]),[[edition,site]]);
  assert.equal((await book(scribe)).album[0].edition,edition);
  await doAt(scout,'collect',net,{},409);
  await doAt(scout,'collect',net,{edition:next.edition});
  const fresh=await doAt(scout,'identify',light,{edition:next.edition});
  assert.notEqual(fresh.sighting.site,site);assert.notEqual(fresh.sighting.species,species);
  await doAt(scout,'observe',fresh.sighting.site,{edition:next.edition,choice:fresh.witness%2},409);
}
