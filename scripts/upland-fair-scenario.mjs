import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function exerciseUplands({request,owner,partner,scout}) {
  const path='/api/upland-fair',get=a=>request(path,200,undefined,a?.token);
  const {edition,camps,cargo,ledger}=await get();assert.equal(camps.length,3);assert.equal(cargo,null);assert.equal(ledger,null);
  const act=(a,action,site,extra={},status=200)=>request(path,status,{edition,action,site,...extra},a?.token);
  const a=camps[0].site,b=camps[1].site;
  await act(null,'survey',a,{choice:0},401);
  for(const [i,camp] of camps.slice(0,2).entries()){
    const correct=[[0,1,0,1],[1,0,1,0]][i][camp.guide];
    await act(owner,'survey',camp.site,{choice:1-correct},409);
    assert.ok((await act(owner,'survey',camp.site,{choice:correct})).camps[i].surveyed);
  }
  const sources={maka:'mlyn_bielika',drewno:'pila_nad_jarem',plotno:'folusz_ciem'};
  const load=(a,good)=>act(a,'load',sources[good],{good,nonce:randomUUID()});
  const before=(await get(owner)).wallet;
  const held=(await load(owner,'maka')).cargo;
  assert.equal((await get(owner)).wallet,before-4);
  await act(owner,'deliver',a,{ticket:held.ticket+1},409);
  await act(owner,'deliver',a,{ticket:held.ticket});
  await act(owner,'deliver',a,{ticket:held.ticket},409);
  assert.equal((await get(owner)).wallet,before+2);
  for(const [who,good,camp] of [[owner,'drewno',a],[partner,'maka',b],[partner,'drewno',b]]){
    const {cargo}=await load(who,good);await act(who,'deliver',camp,{ticket:cargo.ticket});
  }
  const spare=(await load(scout,'maka')).cargo;
  const lastA=(await load(owner,'plotno')).cargo,lastB=(await load(partner,'plotno')).cargo;
  const result=await act(owner,'deliver',a,{ticket:lastA.ticket});
  await act(partner,'deliver',b,{ticket:lastB.ticket},409);
  assert.equal(result.winner.site,a);assert.equal(result.winner.good,'plotno');
  assert.equal((await get()).history[0].name,result.winner.name);assert.ok(result.winner.name);
  const prior=result.ledger.mark.grain,gold=result.wallet;
  await act(owner,'buy',b,{},409);const purchased=await act(owner,'buy',a);
  assert.equal(purchased.ledger.mark.grain,prior+1);assert.equal(purchased.wallet,gold-5);
  await act(owner,'buy',a,{},409);
  assert.equal((await act(partner,'return',sources.plotno,{ticket:lastB.ticket})).cargo,null);
  assert.equal((await get(scout)).cargo.ticket,spare.ticket);
  return async()=>{
    const next=await get(scout);
    assert.ok(next.storm && next.edition>edition);assert.equal(next.winner,null);
    assert.equal(next.history[0].site,a);assert.equal(next.camps[0].goods.length,0);
    assert.equal((await act(scout,'return',sources.maka,{ticket:spare.ticket})).wallet,next.wallet+4);
  };
}
