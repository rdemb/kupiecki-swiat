import assert from 'node:assert/strict';

export async function exerciseCabinet({request,db,owner,guest,voter,edition,post,guild}) {
  const home='dom_matryc',prom='prom_lnu',well='studnia_luster';
  const get=(actor,site=home)=>request('/api/cabinet/'+site,200,undefined,actor?.token);
  const act=(actor,action,site,payload={},status=200)=>request('/api/cabinet/'+site,status,{action,...payload},actor?.token);
  // Expected solutions to the eight printed briefs.
  const keys=[0,1,1,0,1,0,0,1];
  await request('/api/cabinet/nieznane',404);
  await act(null,'practice',home,{choice:0},401);
  const guide=(await get(owner)).sampler.guide;
  await act(owner,'practice',home,{choice:1-keys[guide]},409);
  await Promise.all([0,1].map(()=>act(owner,'practice',home,{choice:keys[guide]})));
  assert.deepEqual((await get(owner)).stamps,[home]);
  assert.deepEqual((await get(null)).stamps,[]);
  const membership=(await request('/api/inn/krolewska_przystan',200,undefined,owner.token)).membership;
  if(membership!==guild)await post(owner,'apply',{groupId:guild});
  assert.equal((await get(owner)).loans[0].edition,edition);
  await act(guest,'lend',home,{edition},409);
  await act(owner,'lend',well,{edition},409);
  let show=(await act(owner,'lend',home,{edition})).shows[0];
  await act(owner,'lend',home,{edition},409);
  assert.equal((await get(null)).shows[0].species,show.species);
  const doStep=(a,action,site,step,extra={},status=200)=>act(a,action,site,{show:show.id,step,...extra},status);
  const print=async(site,step)=>{
    const at=(await get(voter,site)).shows[0].route.at(-1);
    return doStep(voter,'engrave',site,step,{choice:keys[at.guide]});
  };
  await doStep(owner,'vote',home,1,{dest:well},409);
  await print(home,1);
  await doStep(owner,'vote',home,1,{dest:home},409);
  await doStep(owner,'vote',home,1,{dest:prom});
  await doStep(owner,'vote',home,1,{dest:prom});
  await doStep(owner,'depart',home,1,{},409);
  await doStep(voter,'vote',home,1,{dest:well});
  await doStep(owner,'depart',home,1,{},409);
  await doStep(voter,'vote',home,1,{dest:prom});
  show=(await doStep(owner,'depart',home,1)).shows[0];
  assert.equal(show.route[1].site,prom);
  await doStep(owner,'depart',home,1,{},409);
  await doStep(voter,'engrave',prom,2,{choice:keys[show.route[1].guide]},409);
  db.prepare('UPDATE cabinetStops SET arrives=0 WHERE show=? AND step=2').run(show.id);
  await print(prom,2);
  await doStep(voter,'vote',prom,2,{dest:well});
  db.prepare('UPDATE cabinetStops SET voteAt=? WHERE show=? AND step=2').run(Date.now()-91000,show.id);
  await doStep(voter,'depart',prom,2);
  db.prepare('UPDATE cabinetStops SET arrives=0 WHERE show=? AND step=3').run(show.id);
  const finished=(await print(well,3)).shows[0];
  assert.ok(finished.done);assert.deepEqual(finished.route.map(s=>s.site),[home,prom,well]);
  assert.deepEqual((await get(voter)).stamps,[home,prom,well]);
  assert.deepEqual((await get(null)).loans,[]);
  await act(owner,'lend',home,{edition},409);
}
