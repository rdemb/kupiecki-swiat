import assert from 'node:assert/strict';

export async function exerciseFord({request, db, owner, partner}) {
  const url='/api/lost-letter';
  const get=actor=>request(url,200,undefined,actor?.token);
  const act=(actor,action,site,extra={},status=200)=>request(url,status,{action,site,...extra},actor?.token);
  const [inn,mill,store,guard,west,east]=['gospoda_koperty','mlyn_znakow','sklad_beczek','straznica_lanowa','brod_zachodni','brod_wschodni'];
  const stages=[mill,store,guard];
  const answers=[[0,1,0],[1,0,1],[0,1,0]];
  assert.equal((await get()).found,false);
  await act(null,'trace',inn,{stage:0},401);
  await act(partner,'fund',west,{fund:0},409);
  await act(owner,'trace',guard,{stage:0},409);
  let entry=await act(owner,'trace',inn,{stage:0});
  await act(owner,'trace',inn,{stage:0},409);
  for(let i=0;i<stages.length;i++) {
    const stage=i+1;
    assert.equal(entry.stage,stage);
    assert.ok([0,1,2].includes(entry.witness));
    const choice=answers[i][entry.witness];
    await act(owner,'trace',stages[i],{stage,choice:1-choice},409);
    assert.equal((await get(owner)).witness,entry.witness);
    entry=await act(owner,'trace',stages[i],{stage,choice});
  }
  await act(owner,'trace',west,{stage:4});
  assert.equal((await get()).found,true);
  assert.equal((await get(partner)).stage,0);
  const goldA=(await get(owner)).wallet, goldB=(await get(partner)).wallet;
  await act(owner,'book',west,{},409);
  const simultaneous=await Promise.allSettled([0,1].map(()=>act(owner,'fund',west,{fund:0})));
  assert.equal(simultaneous.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await get(owner)).wallet,goldA-12);
  await act(partner,'fund',east,{fund:12});
  await act(partner,'fund',east,{fund:24});
  assert.equal((await get(partner)).wallet,goldB-24);
  await act(partner,'fund',east,{fund:36},409);
  assert.equal((await get()).fund,36);
  const start=Date.now();
  entry=await act(owner,'book',west);
  assert.ok(entry.parcel.arrives>=start+10000 && entry.parcel.arrives<=Date.now()+10000);
  await act(owner,'book',east,{},409);
  await act(owner,'unload',east,{},409);
  db.prepare('UPDATE fordParcels SET arrives=0').run();
  await act(owner,'unload',west,{},409);
  await act(partner,'unload',east,{},409);
  assert.equal((await act(owner,'unload',east)).wallet,goldA-12+8);
  await act(owner,'unload',east,{},409);
  await act(owner,'book',east,{},409);
  db.prepare('UPDATE fordParcels SET booked=booked-86400001').run();
  assert.equal((await act(owner,'book',east)).parcel.origin,east);
}
