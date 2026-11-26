import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function exerciseInfirmary({request,db,start,stop}) {
  const town='zelazna_kuznia',other='krolewska_przystan';
  const accounts=await Promise.all(['rycerz_lazaretu','dostawca_lazaretu'].map(async username=>{
    const credentials={username,password:randomUUID()};
    return {...await request('/api/auth/register',201,credentials),credentials};
  }));
  const [hero,carrier]=accounts;
  const read=(actor,city=town)=>request('/api/mill/'+city,200,undefined,actor?.token);
  const send=(actor,cmd,status=200,city=town)=>request('/api/mill/'+city,status,{nonce:randomUUID(),...cmd},actor?.token);
  const calls=async city=>(await request('/api/inn/'+city,200)).reliefCalls;
  const march=(quantity,revision)=>({action:'beginIgnis',quantity,revision});
  const next=b=>({action:'fightIgnis',sortie:b.infirmary.mine.last.id,step:b.infirmary.mine.activeStep,stance:'balanced'});
  async function finish(book){ while(book.infirmary.mine.last.state==='march')book=await send(hero,next(book));return book;}
  async function resupply(){const snapshot=(await request('/api/auth/me',200,undefined,hero.token)).profile.knight;
    await request('/api/profile/sync',200,{knight:{...snapshot,hp:snapshot.maxHp,availableTurns:8}},hero.token);
  }
  assert.equal((await read()).infirmary.mine,null);
  await send(null,march(0,0),401);
  await send(hero,march(3,0),409);
  await send(hero,march(1,0),409,'srebrny_gaj');
  const original=await read(hero);
  const begin={...march(1,0),nonce:randomUUID()};
  const [first]=await Promise.all([send(hero,begin),send(hero,begin)]);
  assert.equal(first.wallet.gold,original.wallet.gold-35);
  assert.equal(first.infirmary.mine.activeStep,2);
  assert.equal(first.wardSnapshot.knight.wardRevision,1);
  await send(hero,{...begin,quantity:2},409);
  await send(hero,march(0,1),409,other);
  const step={...next(first),nonce:randomUUID()};
  const [second]=await Promise.all([send(hero,step),send(hero,step)]);
  assert.equal(second.infirmary.mine.activeStep,3);
  await send(hero,{...step,nonce:randomUUID()},409);
  await send(carrier,next(second),409);
  await stop(); await start();
  for(const actor of accounts) actor.token=(await request('/api/auth/login',200,actor.credentials)).token;
  const resumed=await read(hero);
  assert.equal(resumed.infirmary.mine.last.id,first.infirmary.mine.last.id);
  assert.equal(resumed.infirmary.mine.activeStep,3);
  const wound=await finish(resumed),rec=wound.infirmary.mine.last;
  assert.equal(rec.state,'retreat');
  assert.ok(Math.abs(rec.due-wound.infirmary.now-360000)<1000);
  await send(hero,march(0,wound.infirmary.mine.revision),409,other);
  await send(hero,{action:'knightDuty',unit:'guards'},409);
  assert.deepEqual(await calls(town),[]);
  await send(hero,{action:'callWard',sortie:rec.id});
  assert.deepEqual((await calls(town)).map(c=>c.id),[rec.id]);
  assert.deepEqual(await calls(other),[]);
  const relief={action:'supplyWard',sortie:rec.id,nonce:randomUUID()};
  await send(hero,relief,409);
  await send(carrier,relief,409,other);
  const grain=(await read(carrier)).wallet.grain;
  await Promise.all([send(carrier,relief),send(carrier,relief)]);
  await send(carrier,{...relief,nonce:randomUUID()},409);
  assert.equal((await read(carrier)).wallet.grain,grain-2);
  const helped=(await read(hero)).infirmary.mine.history[0];
  assert.equal(helped.carrier,carrier.profile.displayName);
  assert.ok(helped.savedMs>350000);
  assert.deepEqual(await calls(town),[]);
  await resupply();
  const full=await finish(await send(hero,march(2,wound.infirmary.mine.revision)));
  assert.equal(full.infirmary.mine.last.state,'retreat');
  assert.ok(full.infirmary.mine.last.due<=full.infirmary.now);
  await resupply();
  const empty=await finish(await send(hero,march(0,full.infirmary.mine.revision)));
  assert.ok(Math.abs(empty.infirmary.mine.last.due-empty.infirmary.now-900000)<1000);
  // Advance only the temporary game's clock, then exercise a veteran from the original campaign.
  db.prepare('UPDATE wardSorties SET due=0 WHERE id=?').run(empty.infirmary.mine.last.id);
  const veteran={...empty.wardSnapshot.knight,strength:800,hp:160,availableTurns:8};
  await request('/api/profile/sync',200,{knight:veteran},hero.token);
  const victory=await send(hero,march(2,empty.infirmary.mine.revision));
  assert.equal(victory.infirmary.mine.last.state,'victory');
  assert.equal(victory.infirmary.mine.shelf,2);
  assert.equal(victory.wardSnapshot.scales,hero.profile.inventory.smocza_luska+4);
  assert.equal(victory.wardSnapshot.mithril,hero.profile.inventory.mithril+6);
  assert.equal(victory.wardSnapshot.knight.monstersDefeated,1);
  // An old tab's autosave arriving after the winning turn cannot restore the old fight or erase loot.
  const stale=await request('/api/profile/sync',200,{knight:veteran,inventory:hero.profile.inventory},hero.token);
  assert.equal(stale.profile.knight.monstersDefeated,1);assert.equal(stale.profile.inventory.smocza_luska,victory.wardSnapshot.scales);
  const paid=await send(hero,march(2,victory.infirmary.mine.revision),200,other);
  assert.ok(paid.wallet.gold-victory.wallet.gold>=7800);assert.equal(paid.infirmary.mine.shelf,2);
}
